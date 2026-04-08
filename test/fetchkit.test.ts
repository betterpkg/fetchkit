import fetchkit, {
  type ClientResponse,
  type HttpClient,
  HttpClientError,
  type Params,
  type RequestConfig,
  DEFAULT_CLIENT_DEFAULTS,
  DEFAULT_TIMEOUT,
  ERROR_CODES,
  HTTP_STATUS,
  createClient,
} from "../src/index";
import { buildURL } from "../src/core/buildURL";
import { mergeConfig } from "../src/core/mergeConfig";

describe("http constants", () => {
  it("exposes named status codes", () => {
    expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
  });
});

describe("buildURL", () => {
  it("combines baseURL and params", () => {
    expect(
      buildURL({
        baseURL: "https://api.example.com/v1/",
        params: { page: 1, tags: ["a", "b"] },
        url: "/users",
      }),
    ).toBe("https://api.example.com/users?page=1&tags=a&tags=b");
  });
});

describe("mergeConfig", () => {
  it("merges headers, params, and transform arrays without mutating inputs", () => {
    const defaults: RequestConfig = {
      headers: { Accept: "application/json" },
      params: { page: 1 },
      transformResponse: [(value: unknown) => value],
    };
    const request = {
      headers: { "X-Trace": "1" },
      params: { q: "fetchkit" } as Params,
      transformResponse: [(value: unknown) => value],
    };

    const merged = mergeConfig(defaults, request);

    expect(new Headers(merged.headers).get("accept")).toBe("application/json");
    expect(new Headers(merged.headers).get("x-trace")).toBe("1");
    expect(merged.params).toEqual({ page: 1, q: "fetchkit" });
    expect(merged.transformResponse).toHaveLength(2);
    expect(defaults.params).toEqual({ page: 1 });
  });
});

describe("fetchkit default client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("serializes JSON bodies and parses JSON responses", async () => {
    const calls: Request[] = [];

    globalThis.fetch = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      calls.push(request);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: HTTP_STATUS.OK,
      });
    }) as typeof fetch;

    const response: ClientResponse<{ ok: boolean }> = await fetchkit.post<{
      ok: boolean;
    }>("https://example.com/users", { name: "A" });

    expect(response.data).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.get("content-type")).toBe("application/json");
    await expect(calls[0]!.text()).resolves.toBe('{"name":"A"}');
  });

  it("applies explicit client defaults including the default timeout", () => {
    const client: HttpClient = createClient();

    expect(client.defaults.timeout).toBe(DEFAULT_TIMEOUT);
    expect(client.defaults.validateStatus).toBe(
      DEFAULT_CLIENT_DEFAULTS.validateStatus,
    );
    expect(client.defaults.transformRequest).toEqual([]);
    expect(client.defaults.transformResponse).toEqual([]);
  });

  it("applies request and response interceptors in registration order", async () => {
    const client = createClient();
    const events: string[] = [];
    let attempts = 0;

    globalThis.fetch = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      attempts += 1;
      events.push(request.headers.get("x-request-stage") ?? "missing");

      if (attempts === 1) {
        throw new Error("try again");
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    client.interceptors.request.use((config) => {
      events.push("request:1");
      return {
        ...config,
        headers: {
          ...(config.headers instanceof Headers
            ? Object.fromEntries(config.headers.entries())
            : config.headers),
          "x-request-stage": "one",
        },
      };
    });
    client.interceptors.request.use((config) => {
      events.push("request:2");
      return {
        ...config,
        retry: {
          attempts: 1,
          baseDelay: 0,
          jitter: false,
        },
      };
    });
    client.interceptors.response.use((response) => {
      events.push("response:1");
      response.data = { ...(response.data as object), fromInterceptor: true };
      return response;
    });
    client.interceptors.response.use((response) => {
      events.push("response:2");
      return response;
    });

    const response = await client.get<{
      ok: boolean;
      fromInterceptor: boolean;
    }>("https://example.com");

    expect(response.data).toEqual({ ok: true, fromInterceptor: true });
    expect(events).toEqual([
      "request:1",
      "request:2",
      "one",
      "request:1",
      "request:2",
      "one",
      "response:1",
      "response:2",
    ]);
  });

  it("retries retryable status codes and exposes retry callbacks", async () => {
    vi.useFakeTimers();

    const retryEvents: string[] = [];
    let attempts = 0;

    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      attempts += 1;

      if (attempts < 3) {
        return new Response("busy", {
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: HTTP_STATUS.OK,
      });
    }) as typeof fetch;

    const pending = fetchkit.get<{ ok: boolean }>("https://example.com/retry", {
      retry: {
        attempts: 2,
        baseDelay: 10,
        jitter: false,
        onRetry(context) {
          retryEvents.push(`${context.attempt}:${context.error.status}`);
        },
      },
    });

    await vi.advanceTimersByTimeAsync(30);

    await expect(pending).resolves.toMatchObject({
      data: { ok: true },
      status: HTTP_STATUS.OK,
    });
    expect(retryEvents).toEqual(["1:503", "2:503"]);
    expect(attempts).toBe(3);
  });

  it("does not retry unsafe methods unless explicitly enabled", async () => {
    let attempts = 0;

    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      attempts += 1;
      throw new Error("post failed");
    }) as typeof fetch;

    await expect(
      fetchkit.post(
        "https://example.com/post",
        { name: "Ada" },
        {
          retry: { attempts: 2, baseDelay: 0, jitter: false },
        },
      ),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_NETWORK,
    });
    expect(attempts).toBe(1);

    attempts = 0;
    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("post failed");
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: HTTP_STATUS.OK,
      });
    }) as typeof fetch;

    await expect(
      fetchkit.post<{ ok: boolean }>(
        "https://example.com/post",
        { name: "Ada" },
        {
          retry: {
            attempts: 1,
            baseDelay: 0,
            jitter: false,
            methods: ["POST"],
          },
        },
      ),
    ).resolves.toMatchObject({
      data: { ok: true },
      status: HTTP_STATUS.OK,
    });
    expect(attempts).toBe(2);
  });

  it("throws typed errors for validateStatus failures", async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response("bad request", {
          status: HTTP_STATUS.BAD_REQUEST,
          statusText: "Bad Request",
        }),
    );

    await expect(fetchkit.get("https://example.com")).rejects.toMatchObject({
      code: ERROR_CODES.ERR_BAD_REQUEST,
      status: HTTP_STATUS.BAD_REQUEST,
    });
  });

  it("supports caller supplied Request instances", async () => {
    const baseRequest = new Request("https://example.com/items", {
      headers: { Authorization: "Bearer token" },
      method: "POST",
    });

    globalThis.fetch = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.headers.get("authorization")).toBe("Bearer token");
      expect(request.headers.get("x-client")).toBe("fetchkit");
      return new Response("ok", { status: HTTP_STATUS.OK });
    }) as typeof fetch;

    const response = await fetchkit({
      headers: { "X-Client": "fetchkit" },
      request: baseRequest,
      responseType: "text",
    });

    expect(response.data).toBe("ok");
  });

  it("maps aborted requests to timeout errors when the internal timeout fires", async () => {
    vi.useFakeTimers();

    globalThis.fetch = vi.fn<typeof fetch>((input) => {
      const request = input as Request;

      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener(
          "abort",
          () =>
            reject(
              request.signal.reason ??
                new DOMException("Aborted", "AbortError"),
            ),
          { once: true },
        );
      });
    }) as typeof fetch;

    const pending = fetchkit.get("https://example.com/slow", { timeout: 25 });
    await Promise.all([
      expect(pending).rejects.toMatchObject({
        code: ERROR_CODES.ERR_TIMEOUT,
      }),
      vi.advanceTimersByTimeAsync(30),
    ]);
  });

  it("uses the default timeout when none is provided", async () => {
    vi.useFakeTimers();

    globalThis.fetch = vi.fn<typeof fetch>((input) => {
      const request = input as Request;

      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener(
          "abort",
          () =>
            reject(
              request.signal.reason ??
                new DOMException("Aborted", "AbortError"),
            ),
          { once: true },
        );
      });
    }) as typeof fetch;

    const pending = fetchkit.get("https://example.com/default-timeout");
    await Promise.all([
      expect(pending).rejects.toMatchObject({
        code: ERROR_CODES.ERR_TIMEOUT,
      }),
      vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT + 1),
    ]);
  });

  it("surfaces parse failures with response metadata", async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response("{", {
          headers: { "content-type": "application/json" },
          status: HTTP_STATUS.OK,
        }),
    ) as typeof fetch;

    await expect(
      fetchkit.get("https://example.com/bad-json"),
    ).rejects.toBeInstanceOf(HttpClientError);
    await expect(
      fetchkit.get("https://example.com/bad-json"),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_PARSE_RESPONSE,
      status: HTTP_STATUS.OK,
    });
  });
});
