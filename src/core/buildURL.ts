import { HttpClientError } from "../errors/HttpClientError";
import { ERROR_CODES } from "../errors/codes";
import type { Params } from "../types";

/**
 * Input used to build the final request URL.
 */
export interface BuildURLOptions {
  /** Base URL used to resolve relative request URLs. */
  baseURL?: string;
  /** Query params appended to the resolved URL. */
  params?: Params;
  /** Existing native request that may already carry a URL. */
  request?: Request;
  /** Explicit URL override for the request. */
  url?: string | URL;
}

function isAbsoluteURL(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function appendParam(searchParams: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (value instanceof Date) {
    searchParams.append(key, value.toISOString());
    return;
  }

  if (typeof value === "object") {
    throw new TypeError(`Invalid query param for key "${key}".`);
  }

  searchParams.append(key, typeof value === "string" ? value : `${value}`);
}

function applyParams(url: string, params?: Params): string {
  if (!params) {
    return url;
  }

  const [withoutHash = "", hash = ""] = url.split("#", 2);
  const [pathname, queryString = ""] = withoutHash.split("?", 2);
  const searchParams = new URLSearchParams(queryString);

  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      searchParams.append(key, value);
    });
  } else {
    for (const [key, rawValue] of Object.entries(params)) {
      if (Array.isArray(rawValue)) {
        for (const value of rawValue) {
          appendParam(searchParams, key, value);
        }
        continue;
      }

      appendParam(searchParams, key, rawValue);
    }
  }

  const query = searchParams.toString();
  const resolvedHash = hash ? `#${hash}` : "";
  return query ? `${pathname}?${query}${resolvedHash}` : `${pathname}${resolvedHash}`;
}

/**
 * Resolves the final request URL from base URL, request URL, and query params.
 *
 * @param options - URL resolution inputs.
 * @returns The resolved request URL.
 */
export function buildURL(options: BuildURLOptions): string {
  const input = options.url ?? options.request?.url;

  if (!input) {
    throw new HttpClientError("Missing request URL.", {
      code: ERROR_CODES.ERR_INVALID_URL,
    });
  }

  const value = input instanceof URL ? input.toString() : input;

  if (options.baseURL && !isAbsoluteURL(value)) {
    return applyParams(new URL(value, options.baseURL).toString(), options.params);
  }

  return applyParams(value, options.params);
}
