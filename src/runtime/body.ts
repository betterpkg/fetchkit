import { isPlainObject } from "../utils/isPlainObject";
import { isReadableStream } from "../utils/isReadableStream";

function isArrayBufferView(value: unknown): value is ArrayBufferView {
  return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value);
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

/**
 * Serializes request data into a native fetch body value.
 *
 * Plain objects and arrays are encoded as JSON and receive a default
 * `application/json` content type when one is not already present.
 *
 * @param data - Request payload supplied by the caller.
 * @param headers - Mutable request headers.
 * @returns A native fetch body value or `undefined` when no body should be sent.
 */
export function serializeRequestBody(
  data: unknown,
  headers: Headers,
): BodyInit | null | undefined {
  if (data === undefined) {
    return undefined;
  }

  if (data === null) {
    return null;
  }

  if (
    typeof data === "string" ||
    data instanceof URLSearchParams ||
    isFormData(data) ||
    isBlob(data) ||
    data instanceof ArrayBuffer ||
    isArrayBufferView(data) ||
    isReadableStream(data)
  ) {
    return data as BodyInit;
  }

  if (Array.isArray(data) || isPlainObject(data)) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return JSON.stringify(data);
  }

  return data as BodyInit;
}
