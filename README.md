# fetchkit

[![CI and Release](https://github.com/betterpkg/fetchkit/actions/workflows/ci-release.yml/badge.svg)](https://github.com/betterpkg/fetchkit/actions/workflows/ci-release.yml)
[![npm version](https://img.shields.io/npm/v/%40betterpkg%2Ffetchkit?logo=npm&color=CB3837)](https://www.npmjs.com/package/@betterpkg/fetchkit)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-2EA043)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-7C3AED)](./package.json)

A lightweight, zero-dependency, axios-like HTTP client built on top of the Fetch API.

`fetchkit` keeps the ergonomics people want from a small, lightweight HTTP client while staying close to platform primitives like `fetch`, `Request`, `Response`, `Headers`, `AbortSignal`, and `URLSearchParams`.

## Why fetchkit

- Zero runtime dependencies
- Axios-style convenience with native fetch semantics
- ESM-first package with CJS output and bundled types
- Request and response interceptors
- Timeouts and native abort support
- Configurable retries with backoff and `Retry-After` support
- JSON serialization and response parsing out of the box
- Typed errors with stable error codes
- Small, lightweight, readable codebase meant for real production use

## Install

```bash
npm install @betterpkg/fetchkit
```

`fetchkit` targets modern runtimes with built-in `fetch` support:

- Modern browsers
- Node.js 18+ with global `fetch`
- Bun
- Deno
- Edge runtimes

## Quick Start

```ts
import fetchkit from "@betterpkg/fetchkit";

const response = await fetchkit.get<{
  users: Array<{ id: string; name: string }>;
}>("https://api.example.com/users", {
  params: { page: 1 },
  timeout: 10_000,
});

console.log(response.status);
console.log(response.data.users);
console.log(response.response.headers.get("content-type"));
```

## Create a Client

```ts
import fetchkit, { createClient } from "@betterpkg/fetchkit";

const api = fetchkit.create({
  baseURL: "https://api.example.com",
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});

const user = await api.get<{ id: string; name: string }>("/users/42");

const anotherApi = createClient({
  baseURL: "https://api.example.com",
});
```

## Common Patterns

### GET with params

```ts
const response = await fetchkit.get("/search", {
  baseURL: "https://api.example.com",
  params: {
    q: "client",
    page: 1,
    tags: ["http", "fetch"],
  },
});
```

### POST JSON

```ts
const response = await fetchkit.post(
  "https://api.example.com/users",
  {
    name: "Ada Lovelace",
  },
  {
    headers: {
      Authorization: "Bearer token",
    },
  },
);
```

### Use a native Request

```ts
const request = new Request("https://api.example.com/items", {
  method: "POST",
  headers: {
    Authorization: "Bearer token",
  },
});

const response = await fetchkit({
  request,
  headers: {
    "X-Trace-Id": "trace-123",
  },
  responseType: "text",
});
```

### Handle timeouts and cancellation

```ts
const controller = new AbortController();

const pending = fetchkit.get("https://api.example.com/slow", {
  timeout: 5_000,
  signal: controller.signal,
});

controller.abort();

await pending;
```

### Retry transient failures

```ts
const response = await fetchkit.get("https://api.example.com/users", {
  retry: {
    attempts: 3,
    baseDelay: 250,
    maxDelay: 2_000,
    onRetry({ attempt, delay, error }) {
      console.warn(`retry ${attempt} in ${delay}ms`, error.code, error.status);
    },
  },
});
```

## API Overview

### Default export

```ts
import fetchkit from "@betterpkg/fetchkit";

await fetchkit("/users");
await fetchkit.get("/users");
await fetchkit.post("/users", { name: "A" });
```

CommonJS consumers should read the default export explicitly:

```js
const { default: fetchkit, createClient } = require("@betterpkg/fetchkit");
```

### Named exports

```ts
import {
  type ClientResponse,
  DEFAULT_TIMEOUT,
  createClient,
  ERROR_CODES,
  HttpClientError,
  HTTP_STATUS,
  HTTP_STATUS_RANGE,
  isHttpClientError,
  type RetryConfig,
  type RetryContext,
} from "@betterpkg/fetchkit";
```

### Request methods

- `fetchkit(config)`
- `fetchkit(url, config?)`
- `fetchkit.request(input, config?)`
- `fetchkit.get(url, config?)`
- `fetchkit.delete(url, config?)`
- `fetchkit.head(url, config?)`
- `fetchkit.options(url, config?)`
- `fetchkit.post(url, data?, config?)`
- `fetchkit.put(url, data?, config?)`
- `fetchkit.patch(url, data?, config?)`
- `fetchkit.create(defaults?)`

## Request Config

`fetchkit` builds on `RequestInit` and adds a small set of client-focused options.

```ts
interface RequestConfig extends Omit<RequestInit, "body" | "headers" | "method" | "signal"> {
  baseURL?: string;
  data?: unknown;
  fetchOptions?: RequestInit;
  headers?: HeadersInit;
  method?: string;
  params?: URLSearchParams | Record<string, unknown>;
  retry?: number | RetryConfig;
  request?: Request;
  responseType?: "json" | "text" | "blob" | "arrayBuffer" | "stream" | "raw";
  signal?: AbortSignal | null;
  timeout?: number;
  transformRequest?: TransformRequest[];
  transformResponse?: TransformResponse[];
  url?: string | URL;
  validateStatus?: (status: number) => boolean;
  withCredentials?: boolean;
}

interface RetryConfig {
  attempts?: number;
  backoff?: "exponential" | "static";
  baseDelay?: number;
  jitter?: boolean;
  maxDelay?: number;
  methods?: string[];
  onRetry?: (context: RetryContext) => void | Promise<void>;
  retryAfter?: boolean;
  shouldRetry?: (context: RetryContext) => boolean | Promise<boolean>;
  statusCodes?: number[];
}
```

Notable behavior:

- Plain objects and arrays are serialized as JSON by default
- `Content-Type: application/json` is set only when fetchkit performs JSON serialization and no content type is already present
- Query params are merged with instance defaults
- Request timeout defaults to `30_000` ms and can be overridden per client or per request
- Retries are opt-in and target transient network failures plus `408`, `429`, `500`, `502`, `503`, and `504` for idempotent methods by default
- `validateStatus` defaults to accepting `2xx` responses
- Response parsing defaults to `json` for JSON content types and `text` otherwise

Default values exposed by the package:

- `DEFAULT_TIMEOUT === 30_000`

## Response Shape

Every successful request returns a normalized response object.

```ts
interface ClientResponse<T = unknown> {
  config: RequestConfig;
  data: T;
  headers: Headers;
  request: Request;
  response: Response;
  status: number;
  statusText: string;
}
```

The native `Response` is preserved so you can always drop down to the platform object when needed.

## Errors

`fetchkit` throws a single error type: `HttpClientError`.

```ts
import { ERROR_CODES, isHttpClientError } from "@betterpkg/fetchkit";

try {
  await fetchkit.get("https://api.example.com/users");
} catch (error) {
  if (isHttpClientError(error)) {
    console.error(error.code);
    console.error(error.status);
    console.error(error.request?.url);
  }
}
```

Available error codes:

- `ERR_INVALID_URL`
- `ERR_INVALID_CONFIG`
- `ERR_NETWORK`
- `ERR_TIMEOUT`
- `ERR_CANCELED`
- `ERR_BAD_REQUEST`
- `ERR_BAD_RESPONSE`
- `ERR_PARSE_RESPONSE`

## Interceptors

Request and response interceptors are available on every client instance.

```ts
const api = fetchkit.create({
  baseURL: "https://api.example.com",
});

api.interceptors.request.use((config) => {
  return {
    ...config,
    headers: {
      ...(config.headers instanceof Headers
        ? Object.fromEntries(config.headers.entries())
        : config.headers),
      Authorization: "Bearer token",
    },
  };
});

api.interceptors.response.use((response) => {
  console.log(response.status);
  return response;
});
```

## HTTP Status Constants

`fetchkit` exports named HTTP status constants and ranges so you do not need magic numbers in your application code.

```ts
import { HTTP_STATUS, HTTP_STATUS_RANGE } from "@betterpkg/fetchkit";

if (response.status === HTTP_STATUS.NO_CONTENT) {
  // nothing to parse
}

const ok =
  response.status >= HTTP_STATUS_RANGE.SUCCESS_MIN &&
  response.status < HTTP_STATUS_RANGE.SUCCESS_MAX_EXCLUSIVE;
```

## Design Notes

`fetchkit` is intentionally opinionated in a few places:

- Modern runtimes first
- No legacy adapter layer
- No runtime dependencies
- Native `Request` and `Response` stay accessible
- Minimal abstraction around fetch rather than trying to hide network semantics

## Development

```bash
npm install
npm run fmt
npm run fmt:check
npm run lint
npm run lint:fix
npm run check
npm test
npm run build
npm run release:check
```

## License

MIT
