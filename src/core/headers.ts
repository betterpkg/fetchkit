/**
 * Creates a normalized {@link Headers} instance from any supported header input.
 *
 * @param input - Header input to normalize.
 * @returns A new `Headers` instance.
 */
export function createHeaders(input?: HeadersInit): Headers {
  return new Headers(input);
}

/**
 * Merges multiple header inputs using native `Headers` semantics.
 *
 * Later inputs overwrite earlier values for the same header name.
 *
 * @param inputs - Header collections to merge.
 * @returns A merged `Headers` instance.
 */
export function mergeHeaders(...inputs: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const input of inputs) {
    if (!input) {
      continue;
    }

    new Headers(input).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}
