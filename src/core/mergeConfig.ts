import type { ClientDefaults, Params, RequestConfig } from "../types";
import { deepMerge } from "../utils/deepMerge";
import { isPlainObject } from "../utils/isPlainObject";
import { mergeHeaders } from "./headers";
import { mergeRetryConfig } from "./retry";

function mergeParams(defaults?: Params, request?: Params): Params | undefined {
  if (!defaults) {
    return request;
  }

  if (!request) {
    return defaults instanceof URLSearchParams
      ? new URLSearchParams(defaults)
      : { ...defaults };
  }

  if (
    defaults instanceof URLSearchParams &&
    request instanceof URLSearchParams
  ) {
    const merged = new URLSearchParams(defaults);
    request.forEach((value, key) => {
      merged.append(key, value);
    });
    return merged;
  }

  if (isPlainObject(defaults) && isPlainObject(request)) {
    return { ...defaults, ...request };
  }

  return request;
}

/**
 * Merges instance defaults with request-specific overrides.
 *
 * Header values are merged with native `Headers` semantics, params are merged
 * shallowly, and transform arrays are concatenated in execution order.
 *
 * @param defaults - Client-level defaults.
 * @param request - Per-request overrides.
 * @returns A normalized merged config.
 */
export function mergeConfig(
  defaults: ClientDefaults = {},
  request: RequestConfig = {},
): RequestConfig {
  const fetchOptions =
    defaults.fetchOptions || request.fetchOptions
      ? {
          ...defaults.fetchOptions,
          ...request.fetchOptions,
        }
      : undefined;

  const merged: RequestConfig = {
    ...defaults,
    ...request,
    fetchOptions,
    headers: mergeHeaders(defaults.headers, request.headers),
    params: mergeParams(defaults.params, request.params),
    retry: mergeRetryConfig(defaults.retry, request.retry),
    transformRequest: [
      ...(defaults.transformRequest ?? []),
      ...(request.transformRequest ?? []),
    ],
    transformResponse: [
      ...(defaults.transformResponse ?? []),
      ...(request.transformResponse ?? []),
    ],
  };

  if (defaults.signal && request.signal === undefined) {
    merged.signal = defaults.signal;
  }

  if (
    isPlainObject(defaults.fetchOptions) ||
    isPlainObject(request.fetchOptions)
  ) {
    merged.fetchOptions = deepMerge(
      (defaults.fetchOptions ?? {}) as Record<string, unknown>,
      (request.fetchOptions ?? {}) as Record<string, unknown>,
    ) as RequestInit;
  }

  return merged;
}
