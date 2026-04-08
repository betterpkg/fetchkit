import { HttpClientError, isHttpClientError } from "../errors/HttpClientError";
import { defaultValidateStatus } from "../defaults";
import { ERROR_CODES } from "../errors/codes";
import { HTTP_STATUS_RANGE } from "../http";
import type { ErrorCode } from "../errors/codes";
import type { ClientResponse, RequestConfig } from "../types";
import { applyRequestTransforms, applyResponseTransforms } from "./transform";
import { createHeaders } from "./headers";
import { serializeRequestBody } from "../runtime/body";
import { createNativeRequest } from "../runtime/request";
import { parseResponseBody } from "../runtime/response";

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "name" in error &&
    ((error as { name?: string }).name === "AbortError" ||
      (error as { name?: string }).name === "TimeoutError"),
  );
}

function createStatusError<T>(
  response: ClientResponse<T>,
  config: RequestConfig,
): HttpClientError<RequestConfig> {
  const code =
    response.status >= HTTP_STATUS_RANGE.CLIENT_ERROR_MIN &&
    response.status < HTTP_STATUS_RANGE.CLIENT_ERROR_MAX_EXCLUSIVE
      ? ERROR_CODES.ERR_BAD_REQUEST
      : ERROR_CODES.ERR_BAD_RESPONSE;

  return new HttpClientError(`Request failed with status code ${response.status}`, {
    code,
    config,
    request: response.request,
    response: response.response,
    status: response.status,
  });
}

function getAbortErrorCode(request: Request): ErrorCode {
  const reason = request.signal.reason;
  if (reason instanceof DOMException && reason.name === "TimeoutError") {
    return ERROR_CODES.ERR_TIMEOUT;
  }

  return ERROR_CODES.ERR_CANCELED;
}

function createRequestFailure(
  error: unknown,
  config: RequestConfig,
  request: Request,
): HttpClientError {
  const code = isAbortError(error) ? getAbortErrorCode(request) : ERROR_CODES.ERR_NETWORK;
  const message = code === ERROR_CODES.ERR_TIMEOUT ? "Request timed out." : "Request failed.";

  return new HttpClientError(message, {
    cause: error,
    code,
    config,
    request,
  });
}

async function finalizeResponse<T>(
  response: Response,
  request: Request,
  config: RequestConfig,
): Promise<ClientResponse<T>> {
  const parsed = await parseResponseBody<T>(response, config);
  const data = await applyResponseTransforms(parsed, response, config, config.transformResponse);
  const result: ClientResponse<T> = {
    config,
    data,
    headers: response.headers,
    request,
    response,
    status: response.status,
    statusText: response.statusText,
  };

  const validateStatus = config.validateStatus ?? defaultValidateStatus;
  if (!validateStatus(response.status)) {
    throw createStatusError(result, config);
  }

  return result;
}

/**
 * Dispatches a normalized request config via the global `fetch` implementation.
 *
 * @typeParam T - Expected parsed response payload type.
 * @param config - Normalized request config.
 * @returns The normalized client response.
 */
export async function dispatchRequest<T>(config: RequestConfig): Promise<ClientResponse<T>> {
  const headers = createHeaders(config.headers);
  const transformedData = await applyRequestTransforms(
    config.data,
    headers,
    config,
    config.transformRequest,
  );
  const body = serializeRequestBody(transformedData, headers);
  const { cleanup, request } = createNativeRequest(
    {
      ...config,
      headers,
    },
    body,
  );

  if (typeof globalThis.fetch !== "function") {
    cleanup();
    throw new HttpClientError("Global fetch is not available in this runtime.", {
      code: ERROR_CODES.ERR_INVALID_CONFIG,
      config,
      request,
    });
  }

  let response: Response;

  try {
    response = await globalThis.fetch(request);
  } catch (error) {
    cleanup();

    if (isHttpClientError(error)) {
      throw error;
    }

    throw createRequestFailure(error, config, request);
  }

  try {
    return await finalizeResponse<T>(response, request, config);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw error;
    }

    throw new HttpClientError("Request failed while processing the response.", {
      cause: error,
      code: ERROR_CODES.ERR_BAD_RESPONSE,
      config,
      request,
      response,
      status: response.status,
    });
    /* v8 ignore next 3 -- V8 reports a synthetic branch on finalizer entry */
  } finally {
    cleanup();
  }
}
