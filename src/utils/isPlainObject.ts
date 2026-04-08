/**
 * Checks whether a value is a plain object with either `Object.prototype` or
 * a `null` prototype.
 *
 * @param value - Value to test.
 * @returns `true` when the value is a plain object.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}
