import type { InterceptorHandler, InterceptorManagerLike } from "../types";

/**
 * Default interceptor manager used by client instances.
 *
 * @typeParam V - Value handled by the interceptor chain.
 */
export class InterceptorManager<V> implements InterceptorManagerLike<V> {
  private handlers: Array<InterceptorHandler<V> | null> = [];

  use(
    fulfilled?: (value: V) => V | Promise<V>,
    rejected?: (error: unknown) => V | Promise<V>,
  ): number {
    const handler: InterceptorHandler<V> = {};

    if (fulfilled) {
      handler.fulfilled = fulfilled;
    }

    if (rejected) {
      handler.rejected = rejected;
    }

    this.handlers.push(handler);
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  clear(): void {
    this.handlers = [];
  }

  forEach(callback: (handler: InterceptorHandler<V>) => void): void {
    for (const handler of this.handlers) {
      if (handler) {
        callback(handler);
      }
    }
  }
}
