---
title: Vitest
---

# Vitest

The general testing rules apply to Vitest tests. This file holds what is specific to Vitest and to
API tests run with it.

## API tests

Test meaningful backend behavior through the API surface: start it, run the real middleware and
routes, and mock only the boundaries that leave the process. Use the in-process HTTP test interface
of the project when startup and ports do not matter, and a real client against a started server
when they do. That client does not throw on a non-2xx status, so the test decides which status is
right.

Check a changed API behavior against what it touches: the response, the persisted state, the
external calls, the runtime side effects, and the logs. A test checks the record it created, never
a count that assumes an empty database.

## Network and providers

Block unmocked external HTTP, through `vi.stubGlobal('fetch', ...)` or an interceptor that
rejects unknown hosts. Assert the outbound contract the API owns: the path, method, headers, and
payload the provider receives. Simulate provider failures, such as a timeout or a 429, and assert
how the API maps them.

## Mocking

Mock at the platform boundary, in the arrange block, and give typed access through `vi.mocked()`.
Avoid global auto-mocks, and use a partial mock only where replacing the whole boundary hides
useful behavior. Restore what a test changes:

```ts
beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

vi.mock('@/platform/providers/client.js', async (importOriginal) => ({
    ...(await importOriginal()),
    createProviderOperation: vi.fn(),
}));
```

Use `it.each` for one behavior across several inputs, and stop `describe()` nesting where it
separates no distinct behavior.
