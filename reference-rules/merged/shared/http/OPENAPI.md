# OpenAPI

## Contracts, Zod, and OpenAPI

Endpoint contracts are the public runtime boundary. They should read like the
API surface, not like a database row or provider payload.

```ts
export const FeatureBodySchema = z
    .item({
        resourceId: z.uuid().meta({
            description: 'Resource identifier owned by the caller.',
            example: '018f38a0-0000-7000-8000-000000000123',
        }),
        message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
    })
    .strict()
    .openapi('FeatureRequest');

export const featureContract = {
    operationId: 'featureAction',
    method: 'post',
    path: API_ROUTE_FEATURE,
    request: {
        body: FeatureBodySchema,
    },
} as const;
```

Query parameters arrive as strings. Use coercion in the contract, not ad hoc
parsing in the listener.

```ts
export const ListItemsQuerySchema = z
    .item({
        resourceId: z.uuid(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        before_id: z.uuid().optional(),
    })
    .strict();
```

URL parameters get their own schema when the route has path parameters.

```ts
export const ResourceParamsSchema = z
    .item({
        resourceId: z.uuid(),
    })
    .strict();
```

Zod v4 rules:

- Use `z.email()` for email strings.
- Use `z.uuid()` for UUIDs, or domain ID helpers from `types/ids.ts` when
  they express the domain.
- Use `z.guid()` only for legacy GUID-compatible values.
- Use `z.coerce.number()` for query params that arrive as strings.
- Use `z.preprocess()` for environment parsing.
- Use `.strict()` on request bodies.
- Use `.superRefine()` for cross-field validation.
- Use `.meta()` for OpenAPI descriptions and examples.
- Prefer Zod built-ins and vetted validators over project regex.
- Keep project regex bounded, simple, anchored when appropriate, and away from large user-controlled strings.
- Prefer contract-local schemas. Move a schema to `types/` or `openapi/common.ts` only when multiple endpoints genuinely share the same public shape.

Unions are appropriate when the endpoint deliberately accepts distinct public
request shapes.

```ts
export const orderRequestSchema = z
    .union([newOrderSchema, existingDraftOrderSchema])
    .openapi('OrderRequest', {
        description: 'Provide either draftOrderId or accountId plus itemIds.',
    });
```

Use cross-field validation when individual field schemas cannot express the
contract.

```ts
function validateOrderSource(value: unknown, ctx: z.RefinementCtx): void {
    const request = value as { draftOrderId?: string; accountId?: string; itemIds?: string[] };

    const hasExisting = Boolean(request.draftOrderId);
    const hasNew = Boolean(request.accountId && request.itemIds?.length);

    if (hasExisting === hasNew) {
        ctx.addIssue({
            code: 'project',
            message: 'Provide either draftOrderId or accountId with itemIds',
        });
    }
}
```

## OpenAPI and Contract Testing

OpenAPI is generated from endpoint-local contracts. Tests should catch drift
between contract, middleware, implementation, and actual response envelopes.

Rules when tests are requested:

- Test representative success responses against the generated OpenAPI schema for public endpoints touched by the change.
- Test representative error responses against the documented error envelope.
- Test rejected invalid body, query, and params values at the HTTP boundary.
- Keep contract tests focused on public shape, not private module structure.
- Do not maintain separate hand-written Swagger fixtures.

```ts
const response = await request(app)
    .post(API_ROUTE_ORDERS)
    .set(authHeader(userId))
    .send(validOrderBody)
    .expect(200);

expect(response.body).toMatchObject({
    status: 'ok',
    data: expect.objectContaining({
        order: expect.objectContaining({
            id: expect.any(String),
        }),
    }),
});
```
