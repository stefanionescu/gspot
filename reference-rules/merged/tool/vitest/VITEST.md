---
layer: tool
preset: vitest
title: Vitest
---

# Vitest

## Testing

Rules for API tests:

- Prefer component-style API tests for meaningful backend behavior: start the API surface, use real middleware and routes, mock only boundaries that leave the process. `enforced-by: typescript/eslint`
- Unit test pure domain functions when the behavior is algorithmic or has many input branches. `enforced-by: typescript/eslint`
- Use narrow in-process HTTP tests with the app factory and `supertest` when lifecycle, ports, and process startup are irrelevant. `enforced-by: typescript/eslint`
- Use a real HTTP client against a started server when startup, shutdown, readiness, middleware order, sockets, or container-like behavior matters. `enforced-by: typescript/eslint`
- Configure real HTTP clients so non-2xx responses do not throw. The test decides which status is acceptable. `enforced-by: typescript/eslint`
- Use e2e tests only when runtime lifecycle, provider connection behavior, or deployment wiring matters. `enforced-by: typescript/eslint`
- Real provider tests need explicit opt-in env vars and must not run as part of default suites. `enforced-by: typescript/eslint`
- Use nested `describe()` blocks when they make reports clearer: route, method, scenario, expectation. `enforced-by: typescript/eslint`

When an API behavior changes, consider the five backend outcomes:

- HTTP response: status, envelope, headers, and body. `enforced-by: typescript/eslint`
- Persisted state: rows created, updated, deleted, or deliberately unchanged. `enforced-by: typescript/eslint`
- External calls: provider, webhook, email, storage, or database calls. `enforced-by: typescript/eslint`
- Runtime side effects: locks, cache entries, queues, timers, readiness, and circuit state. `enforced-by: typescript/eslint`
- Observability: required logs, traces, metrics, and exception reports. `enforced-by: typescript/eslint`

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

Tests own the data they rely on. Build subjects through builders under `tests/support/` with a
unique per-run suffix.

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

Block unmocked external HTTP by default (`vi.stubGlobal('fetch', ...)` or an interceptor that `enforced-by: typescript/eslint`
rejects unknown hosts). Assert the outbound contract this API owns.

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

Use mocks to isolate boundaries and simulate external behavior. Do not use `enforced-by: typescript/eslint`
mocks to prove private implementation details.

Mock taxonomy:

- Isolation mocks replace external systems such as provider HTTP, database, filesystem, timers, and queues. `enforced-by: typescript/eslint`
- Simulation mocks model realistic states such as timeout, provider 429, stale lock, malformed payload, or empty query result. `enforced-by: typescript/eslint`
- Implementation mocks replace code inside the behavior under test and are a smell. `enforced-by: typescript/eslint`

Rules:

- Mock at the platform boundary whenever possible. `enforced-by: typescript/eslint`
- Keep outcome-affecting mocks in the test arrange block. `enforced-by: typescript/eslint`
- Reset or redefine common mocks in `beforeEach()`. `enforced-by: typescript/eslint`
- Restore environment variables, globals, fake timers, and spies in cleanup. `enforced-by: typescript/eslint`
- Avoid surprising global auto-mocks. `enforced-by: typescript/eslint`
- Use `vi.mocked()` for typed mock access. `enforced-by: typescript/eslint`
- Use partial mocks sparingly and only when a full boundary replacement would hide too much useful behavior. `enforced-by: typescript/eslint`
- Do not mock the candidate under test. `enforced-by: typescript/eslint`

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
