import { ERROR_CODES } from "../errors/codes";
import { HttpClientError, isHttpClientError } from "../errors/HttpClientError";
import type { RequestConfig, RetryConfig, RetryContext } from "../types";
import { isReadableStream } from "../utils/isReadableStream";

const DEFAULT_RETRY_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PUT"];
const DEFAULT_RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_BASE_DELAY = 300;
const DEFAULT_RETRY_MAX_DELAY = 30_000;

interface ResolvedRetryConfig {
  attempts: number;
  backoff: "exponential" | "static";
  baseDelay: number;
  jitter: boolean;
  maxDelay: number;
  methods: Set<string>;
  onRetry?: (context: RetryContext) => void | Promise<void>;
  retryAfter: boolean;
  shouldRetry?: (context: RetryContext) => boolean | Promise<boolean>;
  statusCodes: Set<number>;
}

function cloneRetryMethods(methods?: string[]): string[] | undefined {
  return methods ? [...methods] : undefined;
}

function cloneRetryStatusCodes(statusCodes?: number[]): number[] | undefined {
  return statusCodes ? [...statusCodes] : undefined;
}

function normalizeRetryConfig(
  retry?: number | RetryConfig,
): RetryConfig | undefined {
  if (retry === undefined) {
    return undefined;
  }

  if (typeof retry === "number") {
    return { attempts: retry };
  }

  return {
    ...retry,
    methods: cloneRetryMethods(retry.methods),
    statusCodes: cloneRetryStatusCodes(retry.statusCodes),
  };
}

function resolveRetryConfig(
  retry?: number | RetryConfig,
): ResolvedRetryConfig | undefined {
  const normalized = normalizeRetryConfig(retry);

  if (!normalized) {
    return undefined;
  }

  return {
    attempts: Math.max(0, Math.trunc(normalized.attempts ?? 0)),
    backoff: normalized.backoff ?? "exponential",
    baseDelay: Math.max(0, normalized.baseDelay ?? DEFAULT_RETRY_BASE_DELAY),
    jitter: normalized.jitter ?? true,
    maxDelay: Math.max(0, normalized.maxDelay ?? DEFAULT_RETRY_MAX_DELAY),
    methods: new Set(
      (normalized.methods ?? DEFAULT_RETRY_METHODS).map((method) =>
        method.toUpperCase(),
      ),
    ),
    onRetry: normalized.onRetry,
    retryAfter: normalized.retryAfter ?? true,
    shouldRetry: normalized.shouldRetry,
    statusCodes: new Set(normalized.statusCodes ?? DEFAULT_RETRY_STATUS_CODES),
  };
}

function isTimeoutReason(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === "TimeoutError";
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return Math.max(0, timestamp - Date.now());
}

function calculateRetryDelay(
  retry: ResolvedRetryConfig,
  error: HttpClientError<RequestConfig>,
  attempt: number,
): number {
  const retryAfterDelay = retry.retryAfter
    ? parseRetryAfter(error.response?.headers.get("retry-after") ?? null)
    : undefined;
  const computedDelay =
    retry.backoff === "static"
      ? retry.baseDelay
      : retry.baseDelay * 2 ** Math.max(0, attempt - 1);
  const boundedDelay = Math.min(
    retry.maxDelay,
    retryAfterDelay ?? computedDelay,
  );

  if (!retry.jitter || boundedDelay === 0) {
    return boundedDelay;
  }

  return Math.round(Math.random() * boundedDelay);
}

function hasNonReplayableBody(config: RequestConfig): boolean {
  if (isReadableStream(config.data)) {
    return true;
  }

  if (
    config.request &&
    config.request.method !== "GET" &&
    config.request.method !== "HEAD" &&
    config.request.body !== null
  ) {
    return true;
  }

  return false;
}

function shouldRetryError(
  error: HttpClientError<RequestConfig>,
  config: RequestConfig,
  retry: ResolvedRetryConfig,
): boolean {
  if (hasNonReplayableBody(config)) {
    return false;
  }

  const method = (
    config.method ??
    config.request?.method ??
    "GET"
  ).toUpperCase();
  if (!retry.methods.has(method)) {
    return false;
  }

  if (error.code === ERROR_CODES.ERR_CANCELED) {
    return false;
  }

  if (
    error.code === ERROR_CODES.ERR_NETWORK ||
    error.code === ERROR_CODES.ERR_TIMEOUT
  ) {
    return true;
  }

  return (
    typeof error.status === "number" && retry.statusCodes.has(error.status)
  );
}

function createRetryAbortError(
  config: RequestConfig,
): HttpClientError<RequestConfig> {
  const code = isTimeoutReason(config.signal?.reason)
    ? ERROR_CODES.ERR_TIMEOUT
    : ERROR_CODES.ERR_CANCELED;
  const message =
    code === ERROR_CODES.ERR_TIMEOUT
      ? "Request timed out while waiting to retry."
      : "Request was canceled while waiting to retry.";

  return new HttpClientError(message, {
    cause: config.signal?.reason,
    code,
    config,
  });
}

/**
 * Clones retry configuration so callers can safely reuse defaults without
 * sharing mutable array references.
 *
 * @param retry - Retry policy expressed as a count or full config object.
 * @returns A cloned retry policy preserving the original shape.
 */
export function cloneRetryConfig(
  retry?: number | RetryConfig,
): number | RetryConfig | undefined {
  if (retry === undefined || typeof retry === "number") {
    return retry;
  }

  return normalizeRetryConfig(retry);
}

/**
 * Merges client-level and request-level retry policies.
 *
 * Request values override defaults while array fields are cloned so the merged
 * result can be mutated independently of its inputs.
 *
 * @param defaults - Retry policy inherited from client defaults.
 * @param request - Retry policy supplied for a single request.
 * @returns The merged retry policy, or `undefined` when neither input exists.
 */
export function mergeRetryConfig(
  defaults?: number | RetryConfig,
  request?: number | RetryConfig,
): number | RetryConfig | undefined {
  const defaultConfig = normalizeRetryConfig(defaults);
  const requestConfig = normalizeRetryConfig(request);

  if (!defaultConfig && !requestConfig) {
    return undefined;
  }

  return {
    ...defaultConfig,
    ...requestConfig,
    methods: cloneRetryMethods(
      requestConfig?.methods ?? defaultConfig?.methods,
    ),
    statusCodes: cloneRetryStatusCodes(
      requestConfig?.statusCodes ?? defaultConfig?.statusCodes,
    ),
  };
}

/**
 * Resolves retry metadata for a failed attempt when the error and request are
 * eligible for another dispatch.
 *
 * This filters out non-client errors, exhausted retry budgets, canceled
 * requests, and non-replayable bodies such as upload streams.
 *
 * @param error - Failure raised by the previous attempt.
 * @param config - Final request config used for the failed attempt.
 * @param attempt - Retry number, starting at `1` for the first retry.
 * @returns Retry metadata for the next attempt, or `undefined` when no retry should occur.
 */
export async function getRetryContext(
  error: unknown,
  config: RequestConfig,
  attempt: number,
): Promise<RetryContext | undefined> {
  const retry = resolveRetryConfig(config.retry);
  if (!retry || attempt > retry.attempts || !isHttpClientError(error)) {
    return undefined;
  }

  const retryError = error as HttpClientError<RequestConfig>;

  if (!shouldRetryError(retryError, config, retry)) {
    return undefined;
  }

  const context: RetryContext = {
    attempt,
    config,
    delay: calculateRetryDelay(retry, retryError, attempt),
    error: retryError,
    maxRetries: retry.attempts,
  };

  if (retry.shouldRetry && !(await retry.shouldRetry(context))) {
    return undefined;
  }

  return context;
}

/**
 * Invokes the configured retry callback before the next attempt begins.
 *
 * @param config - Active request config.
 * @param context - Retry metadata for the upcoming attempt.
 */
export async function notifyRetry(
  config: RequestConfig,
  context: RetryContext,
): Promise<void> {
  const retry = resolveRetryConfig(config.retry);
  if (retry?.onRetry) {
    await retry.onRetry(context);
  }
}

/**
 * Waits for the computed retry delay while remaining responsive to caller
 * cancellation.
 *
 * @param config - Active request config, used for cancellation tracking.
 * @param delay - Delay in milliseconds before the next retry should start.
 */
export async function waitForRetry(
  config: RequestConfig,
  delay: number,
): Promise<void> {
  if (delay <= 0) {
    return;
  }

  if (config.signal?.aborted) {
    throw createRetryAbortError(config);
  }

  await new Promise<void>((resolve, reject) => {
    const handleAbort = (): void => {
      globalThis.clearTimeout(timer);
      config.signal?.removeEventListener("abort", handleAbort);
      reject(createRetryAbortError(config));
    };

    const timer = globalThis.setTimeout(() => {
      config.signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delay);

    config.signal?.addEventListener("abort", handleAbort, { once: true });
  });
}
