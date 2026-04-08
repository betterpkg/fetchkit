/**
 * Result of combining caller-provided and internal timeout abort behavior.
 */
export interface ComposedAbortSignal {
  /** Releases any timeout or event-listener resources associated with the signal. */
  cleanup(): void;
  /** Composed signal passed through to the native request, when needed. */
  signal?: AbortSignal;
  /** Indicates whether the composed signal aborted because of the configured timeout. */
  wasTimeout(): boolean;
}

/**
 * Composes an optional caller signal with an optional timeout-backed signal.
 *
 * @param signal - Caller-provided abort signal.
 * @param timeout - Timeout in milliseconds.
 * @returns A composed signal and cleanup callback.
 */
export function composeAbortSignal(
  signal?: AbortSignal | null,
  timeout?: number,
): ComposedAbortSignal {
  if (!signal && (timeout === undefined || timeout <= 0)) {
    return {
      cleanup() {},
      signal: undefined,
      wasTimeout: () => false,
    };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;

  const abortFromSignal = () => {
    controller.abort(
      signal?.reason ?? new DOMException("The operation was aborted.", "AbortError"),
    );
  };

  if (signal) {
    if (signal.aborted) {
      abortFromSignal();
    } else {
      signal.addEventListener("abort", abortFromSignal, { once: true });
    }
  }

  if (timeout !== undefined && timeout > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort(new DOMException(`timeout of ${timeout}ms exceeded`, "TimeoutError"));
    }, timeout);
  }

  return {
    cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (signal) {
        signal.removeEventListener("abort", abortFromSignal);
      }
    },
    signal: controller.signal,
    wasTimeout: () => didTimeout,
  };
}
