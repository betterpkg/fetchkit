import { InterceptorManager } from "./core/interceptorManager";
import { cloneRetryConfig } from "./core/retry";
import { executeRequest } from "./core/request";
import { DEFAULT_CLIENT_DEFAULTS } from "./defaults";
import type {
  ClientDefaults,
  ClientResponse,
  HttpClient,
  RequestConfig,
  RequestInput,
} from "./types";

type DataMethod = "patch" | "post" | "put";
type NoDataMethod = "delete" | "get" | "head" | "options";

/**
 * Creates a new HTTP client with isolated defaults and interceptor state.
 *
 * @param defaults - Default request config applied to every request issued by the client.
 * @returns A callable client instance.
 */
export function createClient(defaults: ClientDefaults = {}): HttpClient {
  const requestInterceptors = new InterceptorManager<RequestConfig>();
  const responseInterceptors = new InterceptorManager<ClientResponse>();
  let params: ClientDefaults["params"];

  if (defaults.params instanceof URLSearchParams) {
    params = new URLSearchParams(defaults.params);
  } else if (defaults.params) {
    params = { ...defaults.params };
  }

  const instance = async function clientInstance<T = unknown>(
    input: RequestInput,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>> {
    return executeRequest<T>(
      instance.defaults,
      instance.interceptors,
      input,
      config,
    );
  } as HttpClient;

  instance.defaults = {
    ...DEFAULT_CLIENT_DEFAULTS,
    ...defaults,
    fetchOptions: defaults.fetchOptions
      ? { ...defaults.fetchOptions }
      : undefined,
    headers: defaults.headers ? new Headers(defaults.headers) : undefined,
    params,
    retry: cloneRetryConfig(defaults.retry),
    transformRequest: [...(defaults.transformRequest ?? [])],
    transformResponse: [...(defaults.transformResponse ?? [])],
  };

  instance.interceptors = {
    request: requestInterceptors,
    response: responseInterceptors,
  };

  instance.request = function request<T = unknown>(
    input: RequestInput,
    config?: RequestConfig,
  ): Promise<ClientResponse<T>> {
    return instance<T>(input, config);
  };

  instance.create = function create(
    nextDefaults: ClientDefaults = {},
  ): HttpClient {
    return createClient({
      ...instance.defaults,
      ...nextDefaults,
      headers: new Headers(instance.defaults.headers ?? undefined),
      retry: cloneRetryConfig(nextDefaults.retry ?? instance.defaults.retry),
    });
  };

  const assignNoDataMethod = (method: NoDataMethod): void => {
    instance[method] = function methodRequest<T = unknown>(
      url: string | URL,
      config?: RequestConfig,
    ): Promise<ClientResponse<T>> {
      return instance<T>(url, {
        ...config,
        method,
      });
    };
  };

  const assignDataMethod = (method: DataMethod): void => {
    instance[method] = function dataMethodRequest<T = unknown>(
      url: string | URL,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<ClientResponse<T>> {
      return instance<T>(url, {
        ...config,
        data,
        method,
      });
    };
  };

  assignNoDataMethod("delete");
  assignNoDataMethod("get");
  assignNoDataMethod("head");
  assignNoDataMethod("options");
  assignDataMethod("patch");
  assignDataMethod("post");
  assignDataMethod("put");

  return instance;
}
