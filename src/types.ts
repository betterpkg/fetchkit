import type { ErrorCode } from "./errors/codes";
import type { HttpClientError } from "./errors/HttpClientError";

/**
 * Supported response parsing modes.
 */
export type ResponseType =
  | "json"
  | "text"
  | "blob"
  | "arrayBuffer"
  | "stream"
  | "raw";

/**
 * Represents either a direct value or a promise for that value.
 *
 * @typeParam T - Value resolved by the awaitable.
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * Primitive values supported in query-string serialization.
 */
export type PrimitiveParam =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

/**
 * Accepted query parameter input.
 */
export type Params =
  | URLSearchParams
  | Record<string, PrimitiveParam | PrimitiveParam[]>;

/**
 * Request configuration accepted by the client.
 *
 * This extends {@link RequestInit} with client-specific options such as
 * URL resolution, body transforms, timeout handling, and response parsing.
 */
export interface RequestConfig extends Omit<
  RequestInit,
  "body" | "headers" | "method" | "signal"
> {
  /** Base URL used to resolve relative request URLs. */
  baseURL?: string;
  /** Request payload to serialize into the native fetch body. */
  data?: unknown;
  /** Additional low-level fetch options merged into the native request init. */
  fetchOptions?: RequestInit;
  /** Request headers accepted by the native `Headers` constructor. */
  headers?: HeadersInit;
  /** HTTP method for the request. */
  method?: string;
  /** Query parameters appended to the resolved request URL. */
  params?: Params;
  /** Retry policy applied after failed attempts. */
  retry?: number | RetryConfig;
  /** Pre-built native request to use as the starting point for dispatch. */
  request?: Request;
  /** Preferred response parsing mode. */
  responseType?: ResponseType;
  /** Caller-provided abort signal for request cancellation. */
  signal?: AbortSignal | null;
  /** Timeout in milliseconds before the request is aborted. */
  timeout?: number;
  /** Request transforms executed before body serialization. */
  transformRequest?: TransformRequest[];
  /** Response transforms executed after body parsing. */
  transformResponse?: TransformResponse[];
  /** Absolute or relative request URL. */
  url?: string | URL;
  /** Custom status validator that determines whether a response should reject. */
  validateStatus?: (status: number) => boolean;
  /** Convenience flag mapped to native fetch credentials when not otherwise set. */
  withCredentials?: boolean;
}

/**
 * Default configuration stored on a client instance.
 */
export interface ClientDefaults extends Omit<
  RequestConfig,
  "request" | "url"
> {}

/**
 * Runtime details exposed to retry callbacks.
 */
export interface RetryContext {
  /** Current retry number, starting at `1` for the first retry. */
  attempt: number;
  /** Final request config used for the failed attempt. */
  config: RequestConfig;
  /** Delay in milliseconds before the next retry starts. */
  delay: number;
  /** Typed error produced by the failed attempt. */
  error: HttpClientError<RequestConfig>;
  /** Maximum number of retries configured for the request. */
  maxRetries: number;
}

/**
 * Retry policy used to re-dispatch transient failures.
 */
export interface RetryConfig {
  /** Retry attempts after the initial request. */
  attempts?: number;
  /** Delay algorithm used between retries. */
  backoff?: "exponential" | "static";
  /** Base retry delay in milliseconds. */
  baseDelay?: number;
  /** Applies jitter to the computed delay when enabled. */
  jitter?: boolean;
  /** Upper bound for computed retry delays. */
  maxDelay?: number;
  /** HTTP methods eligible for retry. */
  methods?: string[];
  /** Callback invoked before each retry wait begins. */
  onRetry?: (context: RetryContext) => Awaitable<void>;
  /** Respects `Retry-After` response headers when available. */
  retryAfter?: boolean;
  /** HTTP status codes eligible for retry. */
  statusCodes?: number[];
  /** Custom predicate that can veto or allow a retry after built-in checks. */
  shouldRetry?: (context: RetryContext) => Awaitable<boolean>;
}

/**
 * Normalized client response object.
 *
 * @typeParam T - Parsed response payload type.
 */
export interface ClientResponse<T = unknown> {
  /** Final request config used to dispatch the response. */
  config: RequestConfig;
  /** Parsed response payload. */
  data: T;
  /** Native response headers. */
  headers: Headers;
  /** Native request object issued by the client. */
  request: Request;
  /** Native response object returned by `fetch`. */
  response: Response;
  /** Numeric HTTP status code. */
  status: number;
  /** HTTP reason phrase reported by the runtime. */
  statusText: string;
}

/**
 * Metadata used when constructing an {@link HttpClientError}.
 */
export interface ErrorOptions {
  /** Underlying cause of the failure. */
  cause?: unknown;
  /** Stable client-specific error code. */
  code?: ErrorCode;
  /** Request config associated with the failure. */
  config?: RequestConfig;
  /** Native request associated with the failure, when available. */
  request?: Request;
  /** Native response associated with the failure, when available. */
  response?: Response;
  /** HTTP status associated with the failure, when available. */
  status?: number;
}

/**
 * Transforms request data before the native request is created.
 */
export type TransformRequest = (
  data: unknown,
  headers: Headers,
  config: RequestConfig,
) => Awaitable<unknown>;

/**
 * Transforms parsed response data before it is returned to the caller.
 */
export type TransformResponse = (
  data: unknown,
  response: Response,
  config: RequestConfig,
) => Awaitable<unknown>;

/**
 * Single interceptor registration for a request or response pipeline.
 *
 * @typeParam V - Value flowing through the interceptor chain.
 */
export interface InterceptorHandler<V> {
  /** Handler invoked when the pipeline step succeeds. */
  fulfilled?: (value: V) => V | Promise<V>;
  /** Handler invoked when the pipeline step rejects. */
  rejected?: (error: unknown) => V | Promise<V>;
}

/**
 * Manages registration and iteration of interceptors.
 *
 * @typeParam V - Value handled by the interceptor chain.
 */
export interface InterceptorManagerLike<V> {
  /** Removes every registered interceptor. */
  clear(): void;
  /** Ejects a previously registered interceptor by id. */
  eject(id: number): void;
  /** Iterates over currently active interceptors. */
  forEach(callback: (handler: InterceptorHandler<V>) => void): void;
  /** Registers a new interceptor and returns its id. */
  use(
    fulfilled?: (value: V) => V | Promise<V>,
    rejected?: (error: unknown) => V | Promise<V>,
  ): number;
}

/**
 * Interceptor containers exposed by a client.
 */
export interface ClientInterceptors {
  /** Interceptors applied before dispatch. */
  request: InterceptorManagerLike<RequestConfig>;
  /** Interceptors applied after dispatch and parsing. */
  response: InterceptorManagerLike<ClientResponse>;
}

/**
 * Input accepted by the main request entrypoints.
 */
export type RequestInput = string | URL | RequestConfig;

/**
 * Callable HTTP client interface with convenience request method helpers.
 */
export interface HttpClient {
  /** Dispatches a request using URL/config overloads. */
  <T = unknown>(
    input: RequestInput,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Creates a new client inheriting this instance's defaults. */
  create(defaults?: ClientDefaults): HttpClient;
  /** Mutable defaults applied to every request issued by the client. */
  defaults: ClientDefaults;
  /** Dispatches a `DELETE` request. */
  delete<T = unknown>(
    url: string | URL,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Dispatches a `GET` request. */
  get<T = unknown>(
    url: string | URL,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Dispatches a `HEAD` request. */
  head<T = unknown>(
    url: string | URL,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Request and response interceptor containers. */
  interceptors: ClientInterceptors;
  /** Dispatches an `OPTIONS` request. */
  options<T = unknown>(
    url: string | URL,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Dispatches a `PATCH` request. */
  patch<T = unknown>(
    url: string | URL,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Dispatches a `POST` request. */
  post<T = unknown>(
    url: string | URL,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Dispatches a `PUT` request. */
  put<T = unknown>(
    url: string | URL,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
  /** Canonical named request method equivalent to calling the instance directly. */
  request<T = unknown>(
    input: RequestInput,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>>;
}
