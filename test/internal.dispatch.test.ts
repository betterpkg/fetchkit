import {
  ERROR_CODES,
  HTTP_STATUS,
  HttpClientError,
  createClient,
} from "../src/index";
import { dispatchRequest } from "../src/core/dispatch";
import { createFetchMock, restoreFetch } from "./internalTestUtils";

describe("dispatchRequest and createClient", () => {
  afterEach(() => {
    restoreFetch();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes non-Request fetch inputs in the shared mock helper", async () => {
    const seenUrls: string[] = [];
    const fetchMock = createFetchMock(async (request) => {
      expect(request).toBeInstanceOf(Request);
      seenUrls.push(request.url);

      return new Response("ok", { status: HTTP_STATUS.OK });
    });

    await fetchMock("https://example.com/helper");

    const input = new Request("https://example.com/helper-request");
    await fetchMock(input);

    expect(seenUrls).toEqual([
      "https://example.com/helper",
      "https://example.com/helper-request",
    ]);
  });

  it("throws when global fetch is unavailable", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    await expect(
      dispatchRequest({ responseType: "text", url: "https://example.com" }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_INVALID_CONFIG,
    });
  });

  it("maps network failures, caller aborts, and HttpClientErrors correctly", async () => {
    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      throw new Error("network down");
    });

    await expect(
      dispatchRequest({ responseType: "text", url: "https://example.com" }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_NETWORK,
    });

    globalThis.fetch = vi.fn<typeof fetch>((input) => {
      const request = input as Request;

      if (request.signal.aborted) {
        return Promise.reject(
          request.signal.reason ?? new DOMException("Aborted", "AbortError"),
        );
      }

      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const controller = new AbortController();
    controller.abort();
    const pending = dispatchRequest({
      signal: controller.signal,
      timeout: 50,
      url: "https://example.com/cancel",
    });

    await expect(pending).rejects.toMatchObject({
      code: ERROR_CODES.ERR_CANCELED,
    });

    const existingError = new HttpClientError("existing", {
      code: ERROR_CODES.ERR_BAD_RESPONSE,
    });
    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      throw existingError;
    });

    await expect(
      dispatchRequest({ responseType: "text", url: "https://example.com" }),
    ).rejects.toBe(existingError);
  });

  it("handles bad statuses, response transform failures, and helper methods", async () => {
    globalThis.fetch = createFetchMock(
      async () =>
        new Response("server error", {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          statusText: "Internal Server Error",
        }),
    );

    await expect(
      dispatchRequest({ responseType: "text", url: "https://example.com" }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_BAD_RESPONSE,
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    });

    globalThis.fetch = createFetchMock(
      async () =>
        new Response("ok", {
          status: HTTP_STATUS.OK,
        }),
    );

    await expect(
      dispatchRequest({
        responseType: "text",
        transformResponse: [
          () => {
            throw new Error("transform failed");
          },
        ],
        url: "https://example.com/transform",
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_BAD_RESPONSE,
      status: HTTP_STATUS.OK,
    });

    globalThis.fetch = createFetchMock(
      async () =>
        new Response("{", {
          headers: { "content-type": "application/json" },
          status: HTTP_STATUS.OK,
        }),
    );

    await expect(
      dispatchRequest({ url: "https://example.com/parse-error" }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.ERR_PARSE_RESPONSE,
      status: HTTP_STATUS.OK,
    });

    globalThis.fetch = createFetchMock(
      async () =>
        new Response("accepted", {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        }),
    );

    await expect(
      dispatchRequest({
        responseType: "text",
        url: "https://example.com/custom-validate",
        validateStatus: () => true,
      }),
    ).resolves.toMatchObject({
      data: "accepted",
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    });

    const client = createClient({
      baseURL: "https://api.example.com",
      headers: { "x-default": "1" },
      params: new URLSearchParams([["page", "1"]]),
    });
    const derived = client.create({ headers: { "x-child": "1" } });
    const derivedHeaders = new Headers(derived.defaults.headers);
    derivedHeaders.set("x-mutated", "yes");
    derived.defaults.headers = derivedHeaders;

    expect(new Headers(client.defaults.headers).get("x-mutated")).toBeNull();

    globalThis.fetch = createFetchMock(
      async (request) =>
        new Response(
          JSON.stringify({
            method: request.method,
            url: request.url,
          }),
          {
            headers: { "content-type": "application/json" },
            status: HTTP_STATUS.OK,
          },
        ),
    );

    await expect(client.request("/request")).resolves.toMatchObject({
      data: {
        method: "GET",
        url: "https://api.example.com/request?page=1",
      },
    });
    await expect(client.delete("/delete")).resolves.toMatchObject({
      data: { method: "DELETE" },
    });
    await expect(
      client.get(new URL("https://api.example.com/get")),
    ).resolves.toMatchObject({
      data: { method: "GET" },
    });
    await expect(client.head("/head")).resolves.toMatchObject({
      data: { method: "HEAD" },
    });
    await expect(client.options("/options")).resolves.toMatchObject({
      data: { method: "OPTIONS" },
    });
    await expect(client.patch("/patch", { ok: true })).resolves.toMatchObject({
      data: { method: "PATCH" },
    });
    await expect(client.post("/post", { ok: true })).resolves.toMatchObject({
      data: { method: "POST" },
    });
    await expect(client.put("/put", { ok: true })).resolves.toMatchObject({
      data: { method: "PUT" },
    });

    const objectDefaults = { params: { page: 1 } };
    const objectClient = createClient(objectDefaults);
    const fetchOptionsDefaults = { cache: "reload" } as RequestInit;
    const fetchOptionsClient = createClient({
      fetchOptions: fetchOptionsDefaults,
    });
    const emptyHeadersClient = createClient();
    const derivedWithoutHeaders = emptyHeadersClient.create();

    expect(objectClient.defaults.params).toEqual({ page: 1 });
    expect(objectClient.defaults.params).not.toBe(objectDefaults.params);
    expect(fetchOptionsClient.defaults.fetchOptions).toEqual(
      fetchOptionsDefaults,
    );
    expect(fetchOptionsClient.defaults.fetchOptions).not.toBe(
      fetchOptionsDefaults,
    );
    expect(derivedWithoutHeaders.defaults.headers).toBeInstanceOf(Headers);

    const retryDefaults = {
      attempts: 2,
      methods: ["GET"],
    };
    const retryClient = createClient({ retry: retryDefaults });
    const derivedRetryClient = retryClient.create();

    expect(derivedRetryClient.defaults.retry).toEqual(retryDefaults);
    expect(derivedRetryClient.defaults.retry).not.toBe(retryDefaults);
    expect(
      (derivedRetryClient.defaults.retry as { methods: string[] }).methods,
    ).not.toBe(retryDefaults.methods);
  });

  it("cancels while waiting to retry", async () => {
    vi.useFakeTimers();

    globalThis.fetch = createFetchMock(
      async () =>
        new Response("busy", {
          headers: { "retry-after": "1" },
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        }),
    );

    const client = createClient();
    const controller = new AbortController();
    const pending = client.get("https://example.com/retry-cancel", {
      retry: {
        attempts: 1,
        jitter: false,
      },
      signal: controller.signal,
      responseType: "text",
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: ERROR_CODES.ERR_CANCELED,
    });
  });

  it("routes request interceptor failures through response rejection handlers", async () => {
    const client = createClient();

    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      throw new Error("fetch should not be called");
    });

    client.interceptors.request.use(() => {
      throw new Error("bad request config");
    });
    client.interceptors.response.use(undefined, () => ({
      config: { responseType: "text", url: "https://example.com/recovered" },
      data: "recovered",
      headers: new Headers(),
      request: new Request("https://example.com/recovered"),
      response: new Response("recovered", { status: HTTP_STATUS.OK }),
      status: HTTP_STATUS.OK,
      statusText: "OK",
    }));

    await expect(
      client.get<string>("https://example.com/request-interceptor-failure", {
        responseType: "text",
      }),
    ).resolves.toMatchObject({
      data: "recovered",
      status: HTTP_STATUS.OK,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
