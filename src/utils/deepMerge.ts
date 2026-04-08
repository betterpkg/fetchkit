import { isPlainObject } from "./isPlainObject";

/**
 * Deeply merges plain-object sources into a new object.
 *
 * Arrays are shallow-cloned and later sources override earlier ones.
 *
 * @typeParam T - Object shape being merged.
 * @param sources - Source objects merged from left to right.
 * @returns A merged copy of the provided sources.
 */
export function deepMerge<T extends Record<string, unknown>>(...sources: Array<T | undefined>): T {
  const result = {} as T;

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      const existing = result[key as keyof T];

      if (isPlainObject(existing) && isPlainObject(value)) {
        result[key as keyof T] = deepMerge(existing, value) as T[keyof T];
        continue;
      }

      if (Array.isArray(value)) {
        result[key as keyof T] = [...value] as T[keyof T];
        continue;
      }

      result[key as keyof T] = value as T[keyof T];
    }
  }

  return result;
}
