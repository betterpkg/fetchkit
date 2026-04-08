import type {
  ClientDefaults,
  ClientInterceptors,
  ClientResponse,
  InterceptorHandler,
  RequestConfig,
  RequestInput,
} from "../types";
import { dispatchRequest } from "./dispatch";
import { mergeConfig } from "./mergeConfig";
import { getRetryContext, notifyRetry, waitForRetry } from "./retry";

function applyInterceptorChain<T>(
  promise: Promise<T>,
  handlers: Array<InterceptorHandler<T>>,
): Promise<T> {
  let chain = promise;

  for (const handler of handlers) {
    chain = chain.then(handler.fulfilled, handler.rejected);
  }

  return chain;
}

function collectInterceptors<T>(
  interceptors: ClientInterceptors["request"] | ClientInterceptors["response"],
): Array<InterceptorHandler<T>> {
  const handlers: Array<InterceptorHandler<T>> = [];

  interceptors.forEach((handler) => {
    handlers.push(handler as unknown as InterceptorHandler<T>);
  });

  return handlers;
}

/**
 * Normalizes overloaded request input into a config object.
 *
 * @param input - Request URL or config object supplied by the caller.
 * @param config - Optional config paired with a URL input.
 * @returns A normalized request config.
 */
export function normalizeRequestInput(
  input: RequestInput,
  config?: RequestConfig,
): RequestConfig {
  if (typeof input === "string" || input instanceof URL) {
    return {
      ...config,
      url: input,
    };
  }

  return { ...input };
}

/**
 * Executes a request through config merging, interceptors, and dispatch.
 *
 * @typeParam T - Expected parsed response payload type.
 * @param defaults - Client defaults.
 * @param interceptors - Request and response interceptor containers.
 * @param input - Request URL or config.
 * @param config - Optional config paired with a URL input.
 * @returns The normalized client response.
 */
export async function executeRequest<T>(
  defaults: ClientDefaults,
  interceptors: ClientInterceptors,
  input: RequestInput,
  config?: RequestConfig,
): Promise<ClientResponse<T>> {
  const normalizedInput = normalizeRequestInput(input, config);
  const requestHandlers = collectInterceptors<RequestConfig>(
    interceptors.request,
  );
  const responseHandlers = collectInterceptors<ClientResponse<unknown>>(
    interceptors.response,
  );
  let attempt = 0;
  let finalError: unknown;

  while (true) {
    const mergedConfig = mergeConfig(defaults, normalizedInput);
    let attemptConfig: RequestConfig;

    try {
      attemptConfig = await applyInterceptorChain(
        Promise.resolve(mergedConfig),
        requestHandlers,
      );
    } catch (error) {
      finalError = error;
      break;
    }

    try {
      const response = await dispatchRequest<T>(attemptConfig);
      return (await applyInterceptorChain(
        Promise.resolve(response as ClientResponse<unknown>),
        responseHandlers,
      )) as ClientResponse<T>;
    } catch (error) {
      attempt += 1;

      const retryContext = await getRetryContext(error, attemptConfig, attempt);
      if (!retryContext) {
        finalError = error;
        break;
      }

      await notifyRetry(attemptConfig, retryContext);
      await waitForRetry(attemptConfig, retryContext.delay);
    }
  }

  return (await applyInterceptorChain(
    Promise.reject(finalError),
    responseHandlers,
  )) as ClientResponse<T>;
}
