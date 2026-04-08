import { HTTP_STATUS, type RequestConfig } from "../src/index";
import { composeAbortSignal } from "../src/runtime/abort";
import { serializeRequestBody } from "../src/runtime/body";
import { createNativeRequest } from "../src/runtime/request";
import { parseResponseBody } from "../src/runtime/response";

describe("composeAbortSignal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an inert result when no signal or timeout is provided", () => {
    const composed = composeAbortSignal();

    expect(composed.signal).toBeUndefined();
    expect(composed.wasTimeout()).toBe(false);
    composed.cleanup();
  });

  it("propagates already-aborted signals and timeout aborts", async () => {
    const abortedController = new AbortController();
    abortedController.abort("user-canceled");

    const aborted = composeAbortSignal(abortedController.signal);

    expect(aborted.signal?.aborted).toBe(true);
    expect(aborted.signal?.reason).toBe("user-canceled");
    expect(aborted.wasTimeout()).toBe(false);
    aborted.cleanup();

    vi.useFakeTimers();
    const timed = composeAbortSignal(undefined, 15);

    await vi.advanceTimersByTimeAsync(16);

    const timedSignal = timed.signal;
    const timedReason = timedSignal?.reason;

    expect(timedSignal?.aborted).toBe(true);
    expect(timedReason).toBeInstanceOf(DOMException);
    expect((timedReason as DOMException).name).toBe("TimeoutError");
    expect(timed.wasTimeout()).toBe(true);
    timed.cleanup();
  });

  it("removes listeners during cleanup for active signals", () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const composed = composeAbortSignal(controller.signal, 25);

    composed.cleanup();
    controller.abort();
    vi.advanceTimersByTime(30);

    expect(composed.signal?.aborted).toBe(false);
    expect(composed.wasTimeout()).toBe(false);
  });

  it("uses a default abort reason when the caller signal has none", () => {
    const signal = {
      aborted: true,
      addEventListener() {},
      reason: undefined,
      removeEventListener() {},
    } as unknown as AbortSignal;
    const composed = composeAbortSignal(signal);
    const composedReason = composed.signal?.reason;

    expect(composed.signal?.aborted).toBe(true);
    expect(composedReason).toBeInstanceOf(DOMException);
    expect((composedReason as DOMException).name).toBe("AbortError");
    composed.cleanup();
  });
});

describe("serializeRequestBody", () => {
  it("handles undefined, null, passthrough body types, and JSON serialization", () => {
    const formData = new FormData();
    formData.set("name", "fetchkit");
    const blob = new Blob(["blob"]);
    const searchParams = new URLSearchParams([["q", "fetchkit"]]);
    const arrayBuffer = new ArrayBuffer(8);
    const arrayBufferView = new Uint8Array([1, 2, 3]);
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(arrayBufferView);
        controller.close();
      },
    });
    const objectHeaders = new Headers();
    const arrayHeaders = new Headers({ "content-type": "text/plain" });

    expect(serializeRequestBody(undefined, new Headers())).toBeUndefined();
    expect(serializeRequestBody(null, new Headers())).toBeNull();
    expect(serializeRequestBody("text", new Headers())).toBe("text");
    expect(serializeRequestBody(searchParams, new Headers())).toBe(
      searchParams,
    );
    expect(serializeRequestBody(formData, new Headers())).toBe(formData);
    expect(serializeRequestBody(blob, new Headers())).toBe(blob);
    expect(serializeRequestBody(arrayBuffer, new Headers())).toBe(arrayBuffer);
    expect(serializeRequestBody(arrayBufferView, new Headers())).toBe(
      arrayBufferView,
    );
    expect(serializeRequestBody(readableStream, new Headers())).toBe(
      readableStream,
    );
    expect(serializeRequestBody(true, new Headers())).toBe(true);
    expect(serializeRequestBody({ ok: true }, objectHeaders)).toBe(
      '{"ok":true}',
    );
    expect(objectHeaders.get("content-type")).toBe("application/json");
    expect(serializeRequestBody(["a"], arrayHeaders)).toBe('["a"]');
    expect(arrayHeaders.get("content-type")).toBe("text/plain");
  });
});

describe("createNativeRequest and parseResponseBody", () => {
  it("creates requests from config and existing Request instances", async () => {
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    const built = createNativeRequest(
      {
        baseURL: "https://api.example.com/v1/",
        cache: "no-store",
        headers: { Accept: "application/json" },
        integrity: "sha256-test",
        keepalive: true,
        method: "post",
        mode: "cors",
        params: { page: 1 },
        redirect: "follow",
        referrer: "https://referrer.example.com/",
        referrerPolicy: "origin",
        url: "/users",
        withCredentials: true,
      },
      '{"name":"Ada"}',
    );

    expect(built.request.method).toBe("POST");
    expect(built.request.url).toBe("https://api.example.com/users?page=1");
    expect(built.request.credentials).toBe("include");
    expect(built.request.cache).toBe("no-store");
    expect(built.request.mode).toBe("cors");
    expect(built.request.redirect).toBe("follow");
    expect(built.headers.get("accept")).toBe("application/json");
    await expect(built.request.text()).resolves.toBe('{"name":"Ada"}');
    built.cleanup();

    const existing = createNativeRequest(
      {
        headers: { "x-request": "1" },
        method: "head",
        request: new Request("https://example.com/items", {
          headers: { Authorization: "Bearer token" },
          method: "POST",
        }),
        withCredentials: false,
      },
      "ignored",
    );

    expect(existing.request.url).toBe("https://example.com/items");
    expect(existing.request.method).toBe("HEAD");
    expect(existing.request.credentials).toBe("omit");
    expect(existing.request.headers.get("authorization")).toBe("Bearer token");
    expect(existing.request.headers.get("x-request")).toBe("1");
    await expect(existing.request.text()).resolves.toBe("");
    existing.cleanup();

    const fromFetchOptions = createNativeRequest(
      {
        credentials: "include",
        fetchOptions: {
          cache: "reload",
          credentials: "same-origin",
        },
        url: "https://example.com/fetch-options",
        withCredentials: true,
      },
      "ignored",
    );

    expect(fromFetchOptions.request.cache).toBe("reload");
    expect(fromFetchOptions.request.credentials).toBe("include");
    await expect(fromFetchOptions.request.text()).resolves.toBe("");
    fromFetchOptions.cleanup();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    const streamingRequest = createNativeRequest(
      {
        method: "post",
        url: "https://example.com/stream-upload",
      },
      stream,
    );

    expect(
      (streamingRequest.request as Request & { duplex?: string }).duplex,
    ).toBe("half");
    streamingRequest.cleanup();

    const presetDuplexRequest = createNativeRequest(
      {
        fetchOptions: {
          duplex: "half",
        } as RequestInit,
        method: "post",
        url: "https://example.com/stream-upload-preset",
      },
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
    );

    expect(
      (presetDuplexRequest.request as Request & { duplex?: string }).duplex,
    ).toBe("half");
    presetDuplexRequest.cleanup();

    const withStreamBody = createNativeRequest(
      {
        method: "post",
        url: "https://example.com/stream-body",
      },
      streamBody,
    );

    expect(
      (withStreamBody.request as Request & { duplex?: string }).duplex,
    ).toBe("half");
    withStreamBody.cleanup();
  });

  it("parses all supported response body modes", async () => {
    const config: RequestConfig = { url: "https://example.com" };
    const rawResponse = new Response("raw", { status: HTTP_STATUS.OK });
    const streamResponse = new Response("stream", { status: HTTP_STATUS.OK });

    expect(
      await parseResponseBody(rawResponse, { ...config, responseType: "raw" }),
    ).toBe(rawResponse);
    expect(
      await parseResponseBody(streamResponse, {
        ...config,
        responseType: "stream",
      }),
    ).toBe(streamResponse.body);
    await expect(
      parseResponseBody(new Response("hello"), {
        ...config,
        responseType: "text",
      }),
    ).resolves.toBe("hello");
    await expect(
      parseResponseBody(new Response("hello"), config),
    ).resolves.toBe("hello");
    await expect(
      parseResponseBody(new Response(null, { status: HTTP_STATUS.OK }), config),
    ).resolves.toBe("");

    const blob = await parseResponseBody<Blob>(new Response("blob"), {
      ...config,
      responseType: "blob",
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe("blob");

    const arrayBuffer = await parseResponseBody<ArrayBuffer>(
      new Response("buffer"),
      {
        ...config,
        responseType: "arrayBuffer",
      },
    );
    expect(new TextDecoder().decode(arrayBuffer)).toBe("buffer");

    await expect(
      parseResponseBody(
        new Response(null, {
          headers: {
            "content-length": "0",
            "content-type": "application/json",
          },
          status: HTTP_STATUS.NO_CONTENT,
        }),
        { ...config, responseType: "json" },
      ),
    ).resolves.toBeNull();
    await expect(
      parseResponseBody(
        new Response("", {
          headers: { "content-type": "application/json" },
          status: HTTP_STATUS.OK,
        }),
        config,
      ),
    ).resolves.toBeNull();
    await expect(
      parseResponseBody(new Response("fallback"), {
        ...config,
        responseType: "fallback" as never,
      }),
    ).resolves.toBe("fallback");
  });
});
