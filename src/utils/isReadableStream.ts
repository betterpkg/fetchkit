/**
 * Determines whether a value is a native {@link ReadableStream} instance.
 *
 * The runtime guard keeps stream-aware code safe in environments where
 * `ReadableStream` may not be defined.
 *
 * @param value - Value to inspect.
 * @returns `true` when the value is a native readable stream.
 */
export function isReadableStream(value: unknown): value is ReadableStream {
  return (
    typeof ReadableStream !== "undefined" && value instanceof ReadableStream
  );
}
