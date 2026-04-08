import { createClient } from "./createClient";

export { createClient } from "./createClient";
export { InterceptorManager } from "./core/interceptorManager";
export {
  DEFAULT_CLIENT_DEFAULTS,
  DEFAULT_TIMEOUT,
  defaultValidateStatus,
} from "./defaults";
export { HttpClientError, isHttpClientError } from "./errors/HttpClientError";
export { ERROR_CODES } from "./errors/codes";
export { HTTP_STATUS, HTTP_STATUS_RANGE } from "./http";
export type {
  ClientDefaults,
  ClientInterceptors,
  ClientResponse,
  ErrorOptions,
  HttpClient,
  InterceptorManagerLike,
  Params,
  PrimitiveParam,
  RequestInput,
  RequestConfig,
  ResponseType,
  RetryConfig,
  RetryContext,
  TransformRequest,
  TransformResponse,
} from "./types";
export type { HttpStatusCode } from "./http";
export type { ErrorCode } from "./errors/codes";

/**
 * Default fetchkit client instance for module-level usage.
 */
const fetchkit = createClient();

export default fetchkit;
