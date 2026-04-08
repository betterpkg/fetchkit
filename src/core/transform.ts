import type { RequestConfig, TransformRequest, TransformResponse } from "../types";

/**
 * Applies request transforms in registration order.
 *
 * @param data - Current request payload.
 * @param headers - Mutable request headers.
 * @param config - Active request config.
 * @param transforms - Request transforms to execute.
 * @returns The transformed request payload.
 */
export async function applyRequestTransforms(
  data: unknown,
  headers: Headers,
  config: RequestConfig,
  transforms: TransformRequest[] = [],
): Promise<unknown> {
  let next = data;

  for (const transform of transforms) {
    next = await transform(next, headers, config);
  }

  return next;
}

/**
 * Applies response transforms in registration order.
 *
 * @typeParam T - Parsed response payload type.
 * @param data - Current response payload.
 * @param response - Native response object.
 * @param config - Active request config.
 * @param transforms - Response transforms to execute.
 * @returns The transformed response payload.
 */
export async function applyResponseTransforms<T>(
  data: T,
  response: Response,
  config: RequestConfig,
  transforms: TransformResponse[] = [],
): Promise<T> {
  let next: unknown = data;

  for (const transform of transforms) {
    next = await transform(next, response, config);
  }

  return next as T;
}
