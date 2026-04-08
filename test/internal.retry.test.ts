import {
  ERROR_CODES,
  HTTP_STATUS,
  HttpClientError,
  type RequestConfig,
} from "../src/index";
import {
  cloneRetryConfig,
  getRetryContext,
  mergeRetryConfig,
  notifyRetry,
  waitForRetry,
} from "../src/core/retry";

describe("retry helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clones and merges retry configs across supported shapes", () => {
    expect(cloneRetryConfig()).toBeUndefined();
    expect(cloneRetryConfig(2)).toBe(2);

    const cloned = cloneRetryConfig({
      attempts: 1,
      methods: ["GET"],
      statusCodes: [503],
    }) as {
      attempts: number;
      methods: string[];
      statusCodes: number[];
    };

    expect(cloned).toEqual({
      attempts: 1,
      methods: ["GET"],
      statusCodes: [503],
    });
    expect(cloned.methods).not.toBeUndefined();
    expect(cloned.statusCodes).not.toBeUndefined();

    expect(mergeRetryConfig()).toBeUndefined();
    expect(mergeRetryConfig(2, { jitter: false })).toEqual({
      attempts: 2,
      jitter: false,
    });
  });

  it("builds retry contexts for numeric, status, timeout, and date-based policies", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    const networkContext = await getRetryContext(
      new HttpClientError("network", { code: ERROR_CODES.ERR_NETWORK }),
      {
        retry: 2,
      },
      1,
    );

    expect(networkContext).toMatchObject({
      attempt: 1,
      delay: 150,
      maxRetries: 2,
    });

    const staticContext = await getRetryContext(
      new HttpClientError("busy", {
        code: ERROR_CODES.ERR_BAD_RESPONSE,
        response: new Response("busy", {
          headers: {
            "retry-after": new Date(2_000).toUTCString(),
          },
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        }),
        status: HTTP_STATUS.SERVICE_UNAVAILABLE,
      }),
      {
        retry: {
          attempts: 1,
          backoff: "static",
          baseDelay: 25,
          jitter: false,
          maxDelay: 2_000,
        },
      },
      1,
    );

    expect(staticContext?.delay).toBe(1_000);

    const timeoutContext = await getRetryContext(
      new HttpClientError("timeout", { code: ERROR_CODES.ERR_TIMEOUT }),
      {
        method: "put",
        retry: {
          attempts: 1,
          baseDelay: 0,
          jitter: false,
        },
      },
      1,
    );

    expect(timeoutContext?.delay).toBe(0);

    const requestMethodContext = await getRetryContext(
      new HttpClientError("network", { code: ERROR_CODES.ERR_NETWORK }),
      {
        request: new Request("https://example.com/from-request", {
          method: "DELETE",
        }),
        retry: {
          attempts: 1,
          baseDelay: 0,
          jitter: false,
          methods: ["DELETE"],
        },
      },
      1,
    );

    expect(requestMethodContext?.delay).toBe(0);
  });

  it("rejects retries when policy or error type does not allow them", async () => {
    const responseError = new HttpClientError("not found", {
      code: ERROR_CODES.ERR_BAD_REQUEST,
      response: new Response("missing", { status: HTTP_STATUS.NOT_FOUND }),
      status: HTTP_STATUS.NOT_FOUND,
    });
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    await expect(
      getRetryContext(new Error("plain error"), { retry: 1 }, 1),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(responseError, { retry: 0 }, 1),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(responseError, { method: "post", retry: 1 }, 1),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(
        new HttpClientError("stream body", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        {
          data: streamBody,
          method: "post",
          retry: {
            attempts: 1,
            baseDelay: 0,
            jitter: false,
            methods: ["POST"],
          },
        },
        1,
      ),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(
        new HttpClientError("non-replayable", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        {
          request: new Request("https://example.com/upload", {
            body: "payload",
            method: "POST",
          }),
          retry: {
            attempts: 1,
            baseDelay: 0,
            jitter: false,
            methods: ["POST"],
          },
        },
        1,
      ),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(
        new HttpClientError("canceled", { code: ERROR_CODES.ERR_CANCELED }),
        { retry: 1 },
        1,
      ),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(
        new HttpClientError("bad header", {
          code: ERROR_CODES.ERR_BAD_RESPONSE,
          response: new Response("busy", {
            headers: { "retry-after": "bad-value" },
            status: HTTP_STATUS.SERVICE_UNAVAILABLE,
          }),
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        }),
        {
          retry: {
            attempts: 1,
            jitter: false,
            retryAfter: false,
            shouldRetry: async () => false,
          },
        },
        1,
      ),
    ).resolves.toBeUndefined();

    await expect(
      getRetryContext(
        new HttpClientError("bad header fallback", {
          code: ERROR_CODES.ERR_BAD_RESPONSE,
          response: new Response("busy", {
            headers: { "retry-after": "definitely-not-a-date" },
            status: HTTP_STATUS.SERVICE_UNAVAILABLE,
          }),
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        }),
        {
          retry: {
            attempts: 1,
            baseDelay: 25,
            jitter: false,
          },
        },
        1,
      ),
    ).resolves.toMatchObject({
      delay: 25,
    });

    await expect(
      getRetryContext(
        new HttpClientError("stream upload failed", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        {
          data: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            },
          }),
          method: "put",
          retry: 1,
        },
        1,
      ),
    ).resolves.toBeUndefined();
    await expect(
      getRetryContext(
        new HttpClientError("request body failed", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        {
          request: new Request("https://example.com/request-body", {
            body: "payload",
            method: "POST",
          }),
          retry: {
            attempts: 1,
            methods: ["POST"],
          },
        },
        1,
      ),
    ).resolves.toBeUndefined();

    await expect(
      getRetryContext(
        new HttpClientError("get request body absent", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        {
          request: new Request("https://example.com/no-body"),
          retry: 1,
        },
        1,
      ),
    ).resolves.toMatchObject({
      attempt: 1,
    });
  });

  it("invokes retry callbacks and handles delay completion, timeout aborts, and active aborts", async () => {
    vi.useFakeTimers();

    const events: string[] = [];
    const config: RequestConfig = {
      retry: {
        attempts: 1,
        onRetry(context) {
          events.push(`${context.attempt}:${context.delay}`);
        },
      },
    };

    await notifyRetry(config, {
      attempt: 1,
      config,
      delay: 10,
      error: new HttpClientError("network", { code: ERROR_CODES.ERR_NETWORK }),
      maxRetries: 1,
    });
    await notifyRetry(
      {
        retry: {
          onRetry(context) {
            events.push(`default:${context.delay}`);
          },
        },
      },
      {
        attempt: 0,
        config: {},
        delay: 0,
        error: new HttpClientError("network", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        maxRetries: 0,
      },
    );
    await notifyRetry(
      {},
      {
        attempt: 1,
        config: {},
        delay: 0,
        error: new HttpClientError("network", {
          code: ERROR_CODES.ERR_NETWORK,
        }),
        maxRetries: 1,
      },
    );

    const waitPromise = waitForRetry({}, 5);
    await vi.advanceTimersByTimeAsync(5);
    await expect(waitPromise).resolves.toBeUndefined();

    const passiveController = new AbortController();
    const passiveWait = waitForRetry({ signal: passiveController.signal }, 5);
    await vi.advanceTimersByTimeAsync(5);
    await expect(passiveWait).resolves.toBeUndefined();

    await expect(waitForRetry({}, 0)).resolves.toBeUndefined();

    const timeoutController = new AbortController();
    timeoutController.abort(new DOMException("Timed out", "TimeoutError"));
    await expect(
      waitForRetry({ signal: timeoutController.signal }, 5),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_TIMEOUT,
    });

    const controller = new AbortController();
    const activeWait = waitForRetry({ signal: controller.signal }, 50);
    controller.abort();
    await expect(activeWait).rejects.toMatchObject({
      code: ERROR_CODES.ERR_CANCELED,
    });

    expect(events).toEqual(["1:10", "default:0"]);
  });
});
