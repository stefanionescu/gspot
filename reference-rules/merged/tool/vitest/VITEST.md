# Vitest

## Testing

Rules for API tests:

- Prefer component-style API tests for meaningful backend behavior: start the API surface, use real middleware and routes, mock only boundaries that leave the process.
- Unit test pure domain functions when the behavior is algorithmic or has many input branches.
- Use narrow in-process HTTP tests with the app factory and `supertest` when lifecycle, ports, and process startup are irrelevant.
- Use a real HTTP client against a started server when startup, shutdown, readiness, middleware order, sockets, or container-like behavior matters.
- Configure real HTTP clients so non-2xx responses do not throw. The test should decide which status is acceptable.
- Use e2e tests only when runtime lifecycle, provider connection behavior, or deployment wiring matters.
- Real provider tests need explicit opt-in env vars and must not run as part of default suites.
- Use nested `describe()` blocks when they make reports clearer: route, method, scenario, expectation.

When an API behavior changes, consider the five backend outcomes:

- HTTP response: status, envelope, headers, and body.
- Persisted state: rows created, updated, deleted, or deliberately unchanged.
- External calls: provider, webhook, email, storage, or database calls.
- Runtime side effects: locks, cache entries, queues, timers, readiness, and circuit state.
- Observability: required logs, traces, metrics, and exception reports.

```ts
describe('buildOrderContext', () => {
    it('builds context for a saved draft', () => {
        const request = makeExistingDraftRequest();

        const context = buildOrderContext(request);

        expect(context).toEqual(
            expect.objectContaining({
                mode: 'existing_draft',
                draftOrderId: request.draftOrderId,
            }),
        );
    });
});
```

```ts
describe('POST /orders', () => {
    it('rejects an empty item list', async () => {
        const app = createApp();

        const response = await request(app)
            .post(API_ROUTE_ORDERS)
            .send({ accountId: testAccountId, itemIds: [] });

        expect(response.status).toBe(400);
        expect(response.body).toEqual(
            expect.objectContaining({
                status: 'error',
                code: errorCodes.INVALID_REQUEST,
            }),
        );
    });
});
```

```ts
describe('POST /reports', () => {
    it('does not modify an unrelated report', async () => {
        const ownedReport = await createReportFixture({ userId });
        const unrelatedReport = await createReportFixture({ userId: otherUserId });

        await request(app)
            .post(API_ROUTE_REPORTS)
            .set(authHeader(userId))
            .send({ reportId: ownedReport.id, documentId: validDocumentId })
            .expect(200);

        await expectReportUnchanged(unrelatedReport.id);
    });
});
```

## Testing Data and Infrastructure

Tests must own the data they rely on. A test should be understandable and
repeatable without depending on execution order or a mystery seed state.

Rules when tests are requested:

- Create subject records inside the test or an explicit fixture helper.
- Use descriptive unique values for names, emails, IDs, and external references.
- Do not depend on previous tests.
- Do not depend on a globally empty database.
- Do not use count assertions that fail when unrelated data exists.
- Avoid global mutable fixtures.
- Avoid file-level mutable IDs that one test writes and another test reads.
- Separate metadata, context data, and the records being tested.
- Create unrelated records when the behavior must prove it does not overreach.
- Use unique queue names, event IDs, operation IDs, or correlation IDs for
  event-driven tests.
- Do not purge shared queues or shared tables as a substitute for isolated test data.
- Avoid fixed sleeps. Use bounded polling, fake timers, or a runtime signal that proves completion.
- Test databases may use tmpfs or relaxed durability only inside explicit test infrastructure. Never copy those settings into production compose.
- Clean up only through established test infrastructure; do not add ad hoc production cleanup code.

```ts
const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
const order = await createOrderFixture({
    name: `submit-order-owned-draft-${uniqueSuffix}`,
    userId,
});
```

```ts
// Bad: assumes a shared database starts empty.
expect(await countMessages()).toBe(1);

// Good: checks the record owned by this test.
await expectAuditEventCreatedForOrder(order.id, {
    type: 'order_submitted',
});
```

```ts
// Bad: order-dependent test state.
let createdOrderId: string;

it('creates an order', async () => {
    createdOrderId = await createOrder();
});

it('reads that order', async () => {
    await expectOrderExists(createdOrderId);
});

// Good: each test creates the subject it needs.
it('reads a created order', async () => {
    const order = await createOrderFixture({ userId });

    await expectOrderExists(order.id);
});
```

## Network and Provider Testing

Outbound network behavior must be isolated by default. Tests should fail when
the code tries to reach an unexpected external service.

Rules when tests are requested:

- Block unmocked external HTTP calls by default.
- Allow only the local API under test unless the suite explicitly opts into a real provider.
- Mock provider, webhook, storage, database, queue, and real-time transport boundaries at their platform owner.
- Assert important outgoing request shape: URL owner, method, headers that are safe to inspect, timeout, body shape, and trace metadata.
- Test provider timeout, slow response, one-time 5xx, retry/circuit behavior, malformed JSON, missing fields, and rejected promises when the module owns recovery.
- Prefer fake timers or explicit timeout controls over real network delays.
- Default mocks must be realistic enough to fail when required payload fields are missing.
- Do not assert on secrets or full sensitive payloads.
- Do not test provider SDK internals. Test this API's contract with the provider boundary.

```ts
expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining('/v1/provider/operations'),
    expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Request-ID': trace.requestId,
        }),
        signal: expect.any(AbortSignal),
    }),
);
```

```ts
it('maps a provider timeout to a retryable platform error', async () => {
    mockedCreateProviderOperation.mockRejectedValueOnce(new ProviderTimeoutError('Provider request timed out'));

    await expect(submitOrder(request, trace)).resolves.toEqual(
        expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                retryable: true,
            }),
        }),
    );
});
```

```ts
// Bad: mock accepts every payload and only proves a request happened.
mockProvider.post('/analyze').reply(200, { status: 'ok' });

// Good: mock verifies the outbound contract this API owns.
mockProvider
    .post('/analyze', (providerRequest) => {
        expect(providerRequest).toEqual(
            expect.objectContaining({
                documentId: documentId,
                operationId: operationId,
            }),
        );

        return true;
    })
    .reply(200, { status: 'ok' });
```

## Vitest Mocking Patterns

Use mocks to isolate boundaries and simulate external behavior. Do not use
mocks to prove private implementation details.

Mock taxonomy:

- Isolation mocks replace external systems such as provider HTTP, database, filesystem, timers, and queues.
- Simulation mocks model realistic states such as timeout, provider 429, stale lock, malformed payload, or empty query result.
- Implementation mocks replace code inside the behavior under test and are usually a smell.

Rules when tests are requested:

- Mock at the platform boundary whenever possible.
- Keep outcome-affecting mocks in the test arrange block.
- Reset or redefine common mocks in `beforeEach()`.
- Restore environment variables, globals, fake timers, and spies in cleanup.
- Avoid surprising global auto-mocks.
- Use `vi.mocked()` for typed mock access.
- Use partial mocks sparingly and only when a full boundary replacement would hide too much useful behavior.
- Do not mock the candidate under test.

Mock global fetch:

```ts
vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ready' }),
    } as Response),
);
```

Mock ordered provider calls:

```ts
const mockedProvider = vi.mocked(createVisionCompletion);

mockedProvider.mockResolvedValueOnce(firstProviderResponse).mockResolvedValueOnce(secondProviderResponse);
```

Typed mock:

```ts
const mockedCreateProviderOperation = vi.mocked(createProviderOperation);

mockedCreateProviderOperation.mockResolvedValue({
    providerOperationId,
    status,
});
```

Partial mock:

```ts
vi.mock('@/platform/providers/client.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/platform/providers/client.js')>();

    return {
        ...original,
        createProviderOperation: vi.fn(),
    };
});
```

Fake timers:

```ts
beforeAll(() => {
    vi.useFakeTimers();
});

afterAll(() => {
    vi.useRealTimers();
});

beforeEach(() => {
    vi.clearAllMocks();
});
```

Rejected promise:

```ts
await expect(createProviderOperation(request)).rejects.toThrow('Provider request failed');
```

Parameterized test:

```ts
it.each([
    ['missing account', { accountId: undefined }],
    ['empty item list', { itemIds: [] }],
])('rejects %s', (_name, body) => {
    expect(orderRequestSchema.safeParse(body).success).toBe(false);
});
```

Bad test:

```ts
// Bad: this mocks the candidate under test and proves nothing.
vi.mock('@/modules/orders/submit.js');
vi.mocked(submitOrder).mockResolvedValue(success);
expect(await submitOrder(input)).toBe(success);
```
