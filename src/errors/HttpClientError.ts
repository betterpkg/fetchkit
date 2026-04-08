import type { ErrorOptions } from "../types";

/**
 * Error type used for all client request failures.
 *
 * @typeParam T - Config shape attached to the error instance.
 */
export class HttpClientError<T = unknown> extends Error {
  /** Stable client-specific error code. */
  readonly code?: string;
  /** Request config associated with the failure. */
  readonly config?: T;
  /** Marker used to identify client errors reliably across module boundaries. */
  readonly isHttpClientError = true;
  /** Native request associated with the failure, when available. */
  readonly request?: Request;
  /** Native response associated with the failure, when available. */
  readonly response?: Response;
  /** HTTP status associated with the failure, when available. */
  readonly status?: number;

  /**
   * Creates a new HTTP client error instance.
   *
   * @param message - Human-readable error message.
   * @param options - Structured error metadata.
   */
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "HttpClientError";
    this.code = options.code;
    this.config = options.config as T | undefined;
    this.request = options.request;
    this.response = options.response;
    this.status = options.status;
  }
}

/**
 * Determines whether a value is a {@link HttpClientError}.
 *
 * @param error - Value to inspect.
 * @returns `true` when the value is a client error.
 */
export function isHttpClientError(error: unknown): error is HttpClientError {
  return Boolean(
    error &&
    typeof error === "object" &&
    "isHttpClientError" in error &&
    (error as { isHttpClientError?: boolean }).isHttpClientError,
  );
}
