import type { RequestConfig } from "../types";
import { buildURL } from "../core/buildURL";
import { mergeHeaders } from "../core/headers";
import { isReadableStream } from "../utils/isReadableStream";
import { composeAbortSignal } from "./abort";

type RequestInitWithDuplex = RequestInit & {
  duplex?: "half";
};

function applyBaseInit(config: RequestConfig): RequestInitWithDuplex {
  const init: RequestInitWithDuplex = config.fetchOptions
    ? { ...(config.fetchOptions as RequestInitWithDuplex) }
    : {};

  if (config.cache !== undefined) {
    init.cache = config.cache;
  }
  if (config.credentials !== undefined) {
    init.credentials = config.credentials;
  }
  if (config.integrity !== undefined) {
    init.integrity = config.integrity;
  }
  if (config.keepalive !== undefined) {
    init.keepalive = config.keepalive;
  }
  if (config.mode !== undefined) {
    init.mode = config.mode;
  }
  if (config.redirect !== undefined) {
    init.redirect = config.redirect;
  }
  if (config.referrer !== undefined) {
    init.referrer = config.referrer;
  }
  if (config.referrerPolicy !== undefined) {
    init.referrerPolicy = config.referrerPolicy;
  }

  return init;
}

/**
 * Materializes a native {@link Request} from client config and serialized body data.
 *
 * @param config - Normalized request config.
 * @param body - Serialized request body, if any.
 * @returns The native request, merged headers, and cleanup callback for abort resources.
 */
export function createNativeRequest(
  config: RequestConfig,
  body?: BodyInit | null,
): { cleanup: () => void; headers: Headers; request: Request } {
  const headers = mergeHeaders(config.request?.headers, config.headers);
  const composedSignal = composeAbortSignal(config.signal, config.timeout);
  const method = (
    config.method ??
    config.request?.method ??
    "GET"
  ).toUpperCase();
  const init = applyBaseInit(config);

  init.headers = headers;
  init.method = method;
  init.signal = composedSignal.signal;

  if (config.withCredentials !== undefined && init.credentials === undefined) {
    init.credentials = config.withCredentials ? "include" : "omit";
  }

  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = body;

    if (isReadableStream(body) && init.duplex === undefined) {
      init.duplex = "half";
    }
  }

  const request = config.request
    ? new Request(config.request, init)
    : new Request(
        buildURL({
          baseURL: config.baseURL,
          params: config.params,
          request: config.request,
          url: config.url,
        }),
        init,
      );

  return {
    cleanup: composedSignal.cleanup,
    headers,
    request,
  };
}
