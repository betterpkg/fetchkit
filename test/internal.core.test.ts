import { HTTP_STATUS, HttpClientError, type RequestConfig } from "../src/index";
import { buildURL } from "../src/core/buildURL";
import { InterceptorManager } from "../src/core/interceptorManager";
import { mergeConfig } from "../src/core/mergeConfig";
import { normalizeRequestInput } from "../src/core/request";
import {
  applyRequestTransforms,
  applyResponseTransforms,
} from "../src/core/transform";
import { deepMerge } from "../src/utils/deepMerge";

describe("buildURL edge cases", () => {
  it("throws a typed error when no URL input is available", () => {
    expect(() => buildURL({})).toThrowError(HttpClientError);
    expect(() => buildURL({})).toThrowError(/Missing request URL/);
  });

  it("preserves absolute URLs, hashes, and serializes supported param values", () => {
    expect(
      buildURL({
        baseURL: "https://api.example.com/base/",
        params: {
          at: new Date("2024-01-01T00:00:00.000Z"),
          empty: null,
          missing: undefined,
        },
        url: "https://service.example.com/items?keep=1#details",
      }),
    ).toBe(
      "https://service.example.com/items?keep=1&at=2024-01-01T00%3A00%3A00.000Z#details",
    );
  });

  it("supports request URLs and URLSearchParams inputs", () => {
    expect(
      buildURL({
        params: new URLSearchParams([
          ["page", "1"],
          ["page", "2"],
        ]),
        request: new Request("https://example.com/from-request"),
      }),
    ).toBe("https://example.com/from-request?page=1&page=2");

    expect(
      buildURL({
        params: { page: 1 },
        url: new URL("https://example.com/from-url-object"),
      }),
    ).toBe("https://example.com/from-url-object?page=1");
    expect(
      buildURL({
        params: { empty: null, missing: undefined },
        url: "https://example.com/without-query#hash",
      }),
    ).toBe("https://example.com/without-query#hash");
  });

  it("rejects object query param values", () => {
    expect(() =>
      buildURL({
        params: { nested: { bad: true } as unknown as never },
        url: "https://example.com/search",
      }),
    ).toThrowError(TypeError);
  });
});

describe("mergeConfig and deepMerge", () => {
  it("clones default URLSearchParams and deep merges fetch options", () => {
    const defaultsParams = new URLSearchParams([["page", "1"]]);
    const controller = new AbortController();
    const merged = mergeConfig(
      {
        fetchOptions: {
          headers: { "x-default": "1" },
        } as RequestInit,
        params: defaultsParams,
        signal: controller.signal,
      },
      {
        fetchOptions: {
          cache: "no-store",
          headers: { "x-request": "2" },
        } as RequestInit,
      },
    );

    expect(merged.params).toBeInstanceOf(URLSearchParams);
    expect(merged.params).not.toBe(defaultsParams);
    expect(merged.signal).toBe(controller.signal);
    expect(merged.fetchOptions).toEqual({
      cache: "no-store",
      headers: { "x-default": "1", "x-request": "2" },
    });
  });

  it("merges URLSearchParams and prefers request params for mixed param shapes", () => {
    const mergedSearchParams = mergeConfig(
      {
        params: new URLSearchParams([["page", "1"]]),
      },
      {
        params: new URLSearchParams([["page", "2"]]),
      },
    );

    expect([
      ...(mergedSearchParams.params as URLSearchParams).entries(),
    ]).toEqual([
      ["page", "1"],
      ["page", "2"],
    ]);

    const mixedParams = mergeConfig(
      {
        params: new URLSearchParams([["page", "1"]]),
      },
      {
        params: { q: "fetchkit" },
        signal: null,
      },
    );

    expect(mixedParams.params).toEqual({ q: "fetchkit" });
    expect(mixedParams.signal).toBeNull();

    const clonedPlainParams = mergeConfig(
      {
        params: { page: 1 },
      },
      {},
    );

    expect(clonedPlainParams.params).toEqual({ page: 1 });
    expect(clonedPlainParams.params).not.toBeUndefined();

    const defaultsOnlyFetchOptions = mergeConfig(
      {
        fetchOptions: {
          headers: { accept: "application/json" },
        } as RequestInit,
      },
      {},
    );

    expect(defaultsOnlyFetchOptions.fetchOptions).toEqual({
      headers: { accept: "application/json" },
    });

    const requestOnlyFetchOptions = mergeConfig(
      {},
      {
        fetchOptions: {
          headers: { "x-request": "1" },
        } as RequestInit,
      },
    );

    expect(requestOnlyFetchOptions.fetchOptions).toEqual({
      headers: { "x-request": "1" },
    });

    const mergedRetry = mergeConfig(
      {
        retry: {
          attempts: 2,
          baseDelay: 50,
          methods: ["GET"],
        },
      },
      {
        retry: {
          jitter: false,
          statusCodes: [429],
        },
      },
    );

    expect(mergedRetry.retry).toEqual({
      attempts: 2,
      baseDelay: 50,
      jitter: false,
      methods: ["GET"],
      statusCodes: [429],
    });
  });

  it("deeply merges nested objects and clones arrays", () => {
    const merged = deepMerge<{
      nested: Record<string, boolean>;
      values: string[];
    }>(
      undefined,
      {
        nested: { left: true },
        values: ["a"],
      },
      {
        nested: { right: true },
        values: ["b"],
      },
    );

    expect(merged).toEqual({
      nested: { left: true, right: true },
      values: ["b"],
    });
    expect(merged.values).not.toBeUndefined();
    expect(merged.values).not.toBe(["b"] as string[]);
  });
});

describe("request normalization and interceptors", () => {
  it("normalizes string, URL, and config object inputs", () => {
    const url = new URL("https://example.com/url");

    expect(
      normalizeRequestInput("https://example.com", { method: "post" }),
    ).toEqual({
      method: "post",
      url: "https://example.com",
    });
    expect(normalizeRequestInput(url, { method: "get" })).toEqual({
      method: "get",
      url,
    });
    expect(normalizeRequestInput({ method: "patch", url: "/users" })).toEqual({
      method: "patch",
      url: "/users",
    });
  });

  it("supports interceptor registration, ejection, iteration, and clearing", () => {
    const manager = new InterceptorManager<number>();
    const observed: string[] = [];
    const firstId = manager.use((value) => value + 1);
    const secondId = manager.use(undefined, () => 0);

    manager.eject(firstId);
    manager.forEach((handler) => {
      observed.push(handler.fulfilled ? "fulfilled" : "rejected");
    });
    manager.clear();
    manager.forEach(() => {
      observed.push("unexpected");
    });

    expect(firstId).toBe(0);
    expect(secondId).toBe(1);
    expect(observed).toEqual(["rejected"]);
  });
});

describe("transform helpers", () => {
  it("applies request and response transforms sequentially", async () => {
    const requestHeaders = new Headers();
    const requestConfig: RequestConfig = { method: "post", url: "/items" };
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: HTTP_STATUS.OK,
    });

    const transformedRequest = await applyRequestTransforms(
      { ok: true },
      requestHeaders,
      requestConfig,
      [
        async (data, headers) => {
          headers.set("x-stage", "1");
          return { ...(data as Record<string, boolean>), stage: 1 };
        },
        (data) => ({ ...(data as Record<string, unknown>), stage: 2 }),
      ],
    );

    const transformedResponse = await applyResponseTransforms(
      { ok: true },
      response,
      requestConfig,
      [
        async (data) => ({ ...(data as Record<string, boolean>), stage: 1 }),
        (data) => ({ ...(data as Record<string, unknown>), stage: 2 }),
      ],
    );

    expect(
      await applyRequestTransforms(undefined, new Headers(), requestConfig),
    ).toBeUndefined();
    expect(requestHeaders.get("x-stage")).toBe("1");
    expect(transformedRequest).toEqual({ ok: true, stage: 2 });
    expect(transformedResponse).toEqual({ ok: true, stage: 2 });
  });
});