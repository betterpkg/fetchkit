import { HttpClientError } from "../errors/HttpClientError";
import { ERROR_CODES } from "../errors/codes";
import { HTTP_STATUS } from "../http";
import type { RequestConfig, ResponseType } from "../types";

function inferResponseType(response: Response, requested?: ResponseType): ResponseType {
  if (requested) {
    return requested;
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("json") ? "json" : "text";
}

function isNoContentResponse(response: Response): boolean {
  return (
    response.status === HTTP_STATUS.NO_CONTENT ||
    response.status === HTTP_STATUS.RESET_CONTENT ||
    response.headers.get("content-length") === "0"
  );
}

/**
 * Parses a native response body according to the resolved client response type.
 *
 * @typeParam T - Expected parsed payload type.
 * @param response - Native response to parse.
 * @param config - Active request config.
 * @returns The parsed response payload.
 */
export async function parseResponseBody<T>(response: Response, config: RequestConfig): Promise<T> {
  const responseType = inferResponseType(response, config.responseType);

  if (responseType === "raw") {
    return response as T;
  }

  if (responseType === "stream") {
    return response.body as T;
  }

  try {
    switch (responseType) {
      case "arrayBuffer":
        return (await response.arrayBuffer()) as T;
      case "blob":
        return (await response.blob()) as T;
      case "text":
        return (await response.text()) as T;
      case "json": {
        if (isNoContentResponse(response)) {
          return null as T;
        }

        const text = await response.text();
        if (!text) {
          return null as T;
        }

        return JSON.parse(text) as T;
      }
      default:
        return (await response.text()) as T;
    }
  } catch (error) {
    throw new HttpClientError("Failed to parse response body.", {
      cause: error,
      code: ERROR_CODES.ERR_PARSE_RESPONSE,
      config,
      response,
      status: response.status,
    });
  }
}
