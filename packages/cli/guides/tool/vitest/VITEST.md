---
layer: tool
kit: vitest
title: Vitest
---

# Vitest

API test shape, test data, network and provider mocking, and mocking patterns. The Vitest
ESLint plugin reports a focused or skipped test, a test without an assertion, a conditional
expect, an unawaited async assertion, and an identical title. The general testing rules
apply underneath. This guide holds the decisions those rules cannot see.

## API tests

Meaningful backend behavior gets component-style tests: start the API surface, run real
middleware and routes, and mock only the boundaries that leave the process. Pure domain
functions with algorithmic behavior or many branches get unit tests. The project's in-process
HTTP test interface serves when lifecycle, ports, and startup are irrelevant, without a second
request library. A real HTTP client against a started server serves when startup, shutdown,
readiness, middleware order, sockets, or container-like behavior matters. That client is
configured so a non-2xx response does not throw, and the test decides which status is
acceptable.

End-to-end tests cover runtime lifecycle, provider connections, and deployment
wiring only. Real provider tests need explicit opt-in environment variables outside the
default suites.

A changed API behavior is checked against five outcomes:

- The HTTP response: status, envelope, headers, and body.
- Persisted state: rows created, updated, deleted, or deliberately unchanged.
- External calls: provider, webhook, email, storage, and database.
- Runtime side effects: locks, cache entries, queues, timers, readiness, and circuit state.
- Observability: logs, traces, metrics, and exception reports.

```ts
describe('POST /reports', () => {
    it('does not modify an unrelated report', async () => {
        const ownedReport = await createReport({ userId });
        const unrelatedReport = await createReport({ userId: otherUserId });

        await request(app)
            .post(API_ROUTE_REPORTS)
            .set(authHeader(userId))
            .send({ reportId: ownedReport.id, documentId: validDocumentId })
            .expect(200);

        await expectReportUnchanged(unrelatedReport.id);
    });
});
```

## Test data

Tests own the data they rely on, built through builders under the test-support directory
with a unique per-run suffix such as `${Date.now()}-${crypto.randomUUID()}`. An assertion
checks the record this test owns, never a count that assumes a shared database starts empty.
Each test creates its own subject instead of reading state a previous test left behind:

```ts
// Bad: assumes a shared database starts empty.
expect(await countMessages()).toBe(1);

// Good: checks the record owned by this test.
await expectAuditEventCreatedForOrder(order.id, { type: 'order_submitted' });
```

## Network and providers

Unmocked external HTTP is blocked by default, through `vi.stubGlobal('fetch', ...)` or an
interceptor that rejects unknown hosts. The test asserts the outbound contract this API owns:
the path, method, headers, and signal it sends, and the payload the provider receives. A
mock that accepts every payload and replies success only proves a request happened. Provider
failure states are simulated and mapped: a timeout becomes a retryable platform error, and the
test asserts that mapping.

```ts
mockProvider
    .post('/analyze', (providerRequest) => {
        expect(providerRequest).toEqual(
            expect.objectContaining({ documentId, operationId }),
        );
        return true;
    })
    .reply(200, { status: 'ok' });
```

## Mocking

Mocks isolate boundaries and simulate external behavior; they never prove private
implementation details. Isolation mocks replace external systems (provider HTTP, database,
filesystem, timers, queues). Simulation mocks model realistic states (timeout, provider 429,
stale lock, malformed payload, empty result). An implementation mock that replaces code inside
the behavior under test is a smell, and mocking the candidate under test proves nothing.

Mocks sit at the platform boundary, outcome-affecting mocks live in the arrange block, and
common mocks reset in `beforeEach()`. Environment variables, globals, fake timers, and spies
are restored in cleanup. Global auto-mocks are avoided, `vi.mocked()` gives typed access, and a
partial mock exists only where a full boundary replacement hides useful behavior.

```ts
vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(Response.json({ status: 'ready' }))),
);

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const mockedProvider = vi.mocked(createVisionCompletion);
mockedProvider.mockResolvedValueOnce(firstProviderResponse).mockResolvedValueOnce(secondProviderResponse);

vi.mock('@/platform/providers/client.js', async (importOriginal) => ({
    ...(await importOriginal()),
    createProviderOperation: vi.fn(),
}));

await expect(createProviderOperation(request)).rejects.toThrow('Provider request failed');

it.each([
    ['missing account', { accountId: undefined }],
    ['empty item list', { itemIds: [] }],
])('rejects %s', (_name, body) => {
    expect(orderRequestSchema.safeParse(body).success).toBe(false);
});
```

Stubbed globals are restored after each test or through the `unstubGlobals` option; see
[global mocking](https://vitest.dev/guide/mocking/globals).

## Organization

<!-- level: all -->

Test names describe the behavior, and related cases are grouped where that makes reports
easier to read. Shared setup lives under the declared test-support directory. `describe()`
nesting stops where it separates no distinct behavior.
