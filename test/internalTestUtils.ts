const originalFetchDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "fetch",
);

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

export function createFetchMock(
  handler: (request: Request) => Response | Promise<Response>,
): typeof fetch {
  return vi.fn<typeof fetch>(async (input, init) =>
    handler(toRequest(input, init)),
  );
}

export function restoreFetch(): void {
  Object.defineProperty(globalThis, "fetch", originalFetchDescriptor!);
}
