---
layer: template
preset: none
title: API Architecture
---

# API Architecture

Project template. Copy into `rules/project/` when the repository is an Express API organized as a modular monolith with app, modules, platform, config, env and types owners. Edit it to match the project;
gspot never upgrades a project file.

## Core API philosophy

The API is a modular monolith: one deployable Node, Express, and
TypeScript service, with clear owners inside the service instead of distributed
microservice habits or generic MVC folders.

Domain ownership comes before technical folder categories. Express routes are
transport adapters, not business logic containers. Zod contracts are the runtime
boundary for public input. Platform integrations are isolated behind `platform/`.

Do not add speculative abstractions. Do not add defensive logic for impossible
states. Do not add verification steps beyond `gspot check --staged`.

```text
External client
  |
  v
Express middleware
  |
  v
Endpoint-local Zod contract
  |
  v
Thin route adapter
  |
  v
Domain module
  |
  v
Platform boundary
  |
  +--> database
  +--> provider APIs
  +--> external tools
  +--> runtime/cache/locks
```

Separation of concerns does not mean `controllers/`, `models/`, and `services/`.
In this API, separation means HTTP adapters, domain modules, platform
boundaries, configuration ownership, and generated public contracts each have
clear responsibilities.

## API architecture

Use these ownership boundaries:

| Boundary          | Owns                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| App assembly      | Express app creation, middleware wiring, and route registration.                |
| HTTP endpoints    | Request contracts, route adapters, response mapping, and OpenAPI registration.  |
| Domain modules    | Product behavior, business policy, and use-case orchestration.                  |
| Platform boundary | External systems, runtime state, cache, provider clients, telemetry, and locks. |
| Configuration     | Static constants, environment parsing, validation, and typed access.            |
| Public contracts  | Generated OpenAPI document assembly and shared public schemas.                  |
| Shared types      | Runtime-free type definitions with no side effects.                             |

## Ownership map

```text
                 types
                  ^
                  |
config/env ---> platform <--- modules
                  ^           ^
                  |           |
                app/http ------+
```

Allowed direction:

- `app/http` may call `modules`, `platform`, `config`, `env`, and `types`.
- `modules` may call `platform`, `config`, and `types`.
- `platform` may call `config`, `env`, and `types`.
- `config` and `env` must not call `app/http`, `modules`, or `platform`.
- `types` must not import runtime code.

Forbidden direction:

- `modules` must not import `app/http`.
- `platform` must not import `app/http`.
- `config` and `env` must not depend on runtime feature behavior.
- `types` must not import values with runtime side effects.

```ts
// Bad: module knows HTTP response helpers.
import { sendOk } from '@/app/http/responses.js';

export async function submitOrder() {
    return sendOk(...);
}

// Good: module returns a domain result.
export async function submitOrder(): Promise<SubmitOrderResult> {
    return { success: true, response };
}
```

```ts
// Bad: platform calls feature behavior.
import { recoverOrder } from '@/modules/orders/recover.js';

// Good: platform exposes primitive provider/runtime operations.
// The module decides when to call them.
export async function releaseProviderResource(providerResourceId: ProviderResourceId) {
    // Provider-specific release logic.
}
```

## Module boundaries

Feature behavior belongs in `modules/<feature>/`. Provider mechanics belong in
`platform/<provider>/`. Database shape belongs in `platform/db`. HTTP details
belong in `app/http`.

Rules:

- Shared code must be genuinely portable.
- Do not add root mega-barrels.
- Do not add wrapper files that forward one import or one call.
- Do not add catch-all utility folders for product logic.
- Do not group feature code by technical role when a domain owner exists.
- Add subfolders only when they clarify ownership relationships.
- Keep cache keys and invalidation with the owner of the cached data.

```text
Bad:
src/
  controllers/
  models/
  services/
  utils/
    submit-order.ts
    generate-report.ts
    database-query.ts

Good:
src/
  app/http/endpoints/orders/
  modules/orders/
  modules/reports/
  platform/db/
  platform/providers/
```

```ts
// Good shared utility: portable, no API domain knowledge.
export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

// Bad shared utility: owns product behavior.
export function calculateOrderDiscount(...) {
    // This belongs with the order module.
}
```

```ts
// Bad: imports describe a technical layer instead of ownership.
import { submitOrder } from '@/services/orders.js';
import { getItems } from '@/repositories/items.js';

// Good: imports reveal the owner of the behavior.
import { submitOrder } from '@/modules/orders/submit.js';
import { listOrderItems } from '@/platform/db/queries/order-items.js';
```

## Endpoint structure

Endpoint-owned HTTP files live together under the endpoint owner.

```text
endpoints/<endpoint>/
  contract.ts   # Zod request contract and operation metadata
  route.ts      # Express router and thin adapter
  openapi.ts    # OpenAPI registration and response schemas
  response.ts   # optional endpoint-specific HTTP response mapping
```

Rules:

- Do not create these files mechanically if the endpoint does not need them.
- `contract.ts` always comes before route behavior for new endpoints.
- `route.ts` stays thin.
- `openapi.ts` registers the public shape.
- `response.ts` exists only when response mapping is non-trivial.
- OpenAPI assembly happens through the public contract owner.

```text
route.ts
  validateRequest(contract.request)
  requireAuthenticatedRequest()
  getValidatedRequest()
  extractRequestTrace()
  call module function
  map result to sendOk/sendError
```

## Entry points

An entry point is any external trigger that asks this service to do work:
HTTP routes, webhooks, queue consumers, scheduled jobs, process startup hooks,
and runtime health probes.

```text
external trigger
  |
  v
entry-point adapter
  |
  +--> parse and validate input
  +--> authenticate or identify caller when relevant
  +--> attach request trace
  +--> call module/platform owner
  +--> map result to entry-point response
```

Rules:

- Keep every entry point thin.
- Entry points may adapt input and output, but must not own product decisions.
- Shared feature behavior belongs in `modules/`, not in an HTTP route reused by a queue or webhook.
- Runtime lifecycle behavior belongs in `platform/runtime/`, not in feature modules.
- Health and readiness probes must be cheap and must not perform product work.
- Do not add hidden test, admin, or auth-bypass entry points.
- Queue, cron, webhook, and startup entry points need the same validation, trace, ownership, and error handling discipline as HTTP routes.
- Event-driven entry points use unique event IDs or correlation IDs, not global queues shared blindly across tests or tenants.

```ts
// Bad: scheduled work imports an HTTP route to reuse behavior.
import { orderRouter } from '@/app/http/endpoints/orders/route.js';

// Good: both entry points call the domain owner.
await submitOrder(request, trace);
```

```ts
// Bad: message consumer owns product behavior and has no trace.
queue.on('message', async (message) => {
    await database.from('orders').delete().eq('userId', message.userId);
});

// Good: message consumer validates, traces, and calls the owner.
queue.on('message', async (message) => {
    const event = UserDeletedEventSchema.parse(message);
    const trace = buildQueueTrace(event.event_id, 'user.deleted');

    await deleteUserOwnedRuntimeState({ userId: event.userId, trace });
});
```

## Domain logic

Modules receive explicit domain inputs, not Express objects. Domain code returns
typed results for expected business outcomes. It throws for exceptional
infrastructure failures only when there is no useful local recovery.

Rules:

- Follow the naming rules when translating storage or provider names
  into domain objects.
- Co-locate subflows inside the owning module.
- Add subfolders only when they clarify relationships.
- Keep prompts, policies, and product decisions in the module that owns the feature.
- Do not pass raw request, provider, or database objects across layers.

```ts
// Bad.
export async function generateReport(req: AuthenticatedRequest) {
    return executeReportPipeline(req.body.documentId, req.user.id, req.headers);
}

// Good.
export async function generateReport(input: GenerateReportInput, trace: RequestTrace) {
    return executeReportPipeline(input, trace);
}
```

```ts
export type SubmitOrderResult =
    | { success: true; response: SubmitOrderResponse }
    | { success: false; error: SubmitOrderFailure };
```

## Services and cross-module communication

Cross-module calls preserve ownership. If one module needs another
module's context, call a function owned by that module instead of reaching into
its storage, cache, or provider details.

Rules:

- Do not query another module's tables directly from the caller.
- Do not copy another module's logic into the caller.
- Cross-module functions need stable domain-shaped parameters. Follow
  the naming rules for function names.
- Keep the called module in command of its own invariants.

```ts
// Bad: reporting reaches into order storage details.
const order = await getOrderRowById(orderId);

// Good: orders module owns the active order concept.
const activeOrder = await resolveActiveOrder(orderId);
```

## Data access

Database code belongs in `platform/db`. Query files read. Mutation files write.
Query and mutation functions expose domain-useful return shapes.

Rules:

- Do not expose raw database response objects outside `platform/db`.
- Follow the naming rules for database wire-shape names.
- Convert database errors to `DatabaseError` or typed database errors.
- Keep SQL and table details out of client-visible error messages.
- Validate values before they reach database calls.
- Do not build SQL, RPC names, table names, column names, filters, or order clauses by concatenating user input.
- Keep any raw SQL or database RPC usage behind fixed platform functions with typed parameters.
- Do not add an ORM.
- Do not add repository classes over the platform query/mutation boundary.
- Do not add a database-switch abstraction.

```ts
// Bad: module handles database response mechanics.
const { data, error } = await database.from('order_items').select('*');
if (error) throw error;

// Good: platform owns database mechanics.
const items = await listOrderItems(orderId);
```

## Provider integrations

Provider APIs, webhooks, storage services, real-time transports, and cache
mechanics belong in `platform/`. Modules build domain or provider intent.
Platform code performs transport mechanics.

Rules:

- Use `providerRequest` and `providerResponse` for provider wire shapes.
- Provider payload builders belong in `platform` when they encode provider wire format.
- Module prompt and policy construction stays in `modules`.
- Provider errors are normalized before crossing into `app/http`.
- Use platform timeout, circuit breaker, retry, lock, and concurrency utilities.
- Do not hand-roll retry loops.
- Avoid real provider calls in tests unless explicit opt-in env vars are set.

```ts
// Bad: module hardcodes provider URL and headers.
await fetch(env.PROVIDER_API_URL, {
    headers: { Authorization: `Bearer ${env.PROVIDER_API_KEY}` },
    body: JSON.stringify(payload),
});

// Good: module calls provider boundary.
const result = await createProviderOperation(request, trace);
```

## Configuration and environment

`process.env` is allowed only in `env/`. Other code imports typed env values
from `env/` or constants from `config/`.

Every new env var needs:

- Schema entry.
- Default or required validation.
- Typed access.
- Safe `.env.example` value if relevant.
- Deployment/runtime wiring only when runtime needs it.

Rules:

- Use `z.preprocess()` for env strings.
- Use grouped config modules for constants.
- Follow the naming rules for configuration names.
- Do not add a hierarchy for one value.
- Do not read env in route, module, or platform code directly.

```ts
export const optionalStringFromEnv = z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    return value;
}, z.string().optional());
```

```ts
function validateProviderConfig(value: Record<string, unknown>, ctx: z.RefinementCtx): void {
    const hasUrl = typeof value.SERVICE_URL === 'string' && value.SERVICE_URL.length > 0;
    const hasKey = typeof value.SERVICE_API_KEY === 'string' && value.SERVICE_API_KEY.length > 0;

    if (hasUrl && !hasKey) {
        ctx.addIssue({
            code: 'custom',
            path: ['SERVICE_API_KEY'],
            message: 'SERVICE_API_KEY is required when SERVICE_URL is configured',
        });
    }
}
```

## Production operations

The API behaves like a stateless containerized service. Local process
state is allowed only when a platform runtime owner controls lifecycle,
invalidation, and readiness implications.

Dockerfile, image, compose, and container packaging rules live in
the Docker rules. Keep API runtime ownership here: health/readiness, startup,
shutdown, environment validation, signal handling, nginx edge behavior, and
runtime state ownership.

Rules:

- Do not store user uploads, sessions, or durable state on local disk.
- Do not add module-level mutable request state.
- Do not add ad hoc in-memory caches without a runtime or platform owner and an invalidation rule.
- Keep `NODE_ENV=production` in production runtime.
- Do not add PM2, Node cluster, or a second process supervisor around the API runtime.
- Let the orchestrator restart failed processes and scale replicas.
- Coordinate API memory ceilings with deployment limits when memory ceilings matter.
- Expose only lightweight health and readiness probes.
- Do not add private maintenance endpoints when an external operational tool can do the job.
- Do not add blanket Express or reverse-proxy response caching for authenticated routes. Cache only owner-specific values with explicit keys, TTLs, invalidation, and privacy rules.
- Treat scanner findings as engineering input, not as automatic permission for broad dependency churn.

```ts
// Bad: mutable process state changes user-visible behavior without an owner.
const activeOrders = new Map<string, OrderState>();

// Good: runtime/cache owner defines key format, lifetime, and invalidation.
const activeOrder = await resolveActiveOrder(orderId);
```

## nginx and runtime

nginx handles edge concerns, not application behavior. Compose owns local and
deployment wiring. Keep health and readiness probe behavior lightweight.

Rules:

- Runtime startup belongs in the runtime platform owner.
- Readiness belongs in the runtime state owner.
- Process signal handling belongs in runtime startup and shutdown code.
- Do not add runtime state into modules.
- Do not make modules depend on process lifecycle.
- Keep app assembly synchronous.
- nginx may enforce TLS termination, compression, request size, timeouts, and broad rate limits.
- nginx must not encode product permissions or feature-specific business behavior.
- Health probes must not perform expensive provider, database, or external-service calls.
- Shutdown marks readiness false, stop accepting new HTTP work, wait briefly for in-flight requests, close provider/runtime resources, flush telemetry/cache, log the outcome, and then exit.
- Stop accepting HTTP before closing long-lived provider, WebSocket, database, or cache resources unless a specific runtime owner documents a safer sequence.
- Shutdown paths must be idempotent for repeated `SIGTERM`, `SIGINT`, process-level fatal errors, and startup failures.
- Keep-alive behavior and shutdown grace periods must match deployment/orchestrator settings.

```text
container starts
  -> process entry point
  -> env validation
  -> telemetry initialization
  -> platform runtime startup
  -> app assembly
  -> readiness state
  -> HTTP server accepts traffic
```

## Performance

Node is best for I/O-heavy work. Keep request paths asynchronous and bounded.

Rules:

- Do not block request paths with CPU-heavy synchronous work.
- Avoid sync filesystem in handlers and modules.
- Avoid complex regex over large user-controlled strings.
- Avoid large synchronous JSON parsing or stringification beyond configured body/response limits.
- Avoid synchronous crypto, compression, image, or audio transforms in request paths.
- Avoid large in-memory transforms in HTTP handlers.
- Avoid unbounded `Promise.all()` over user-sized arrays.
- Break long work into bounded chunks, worker/runtime-owned jobs, or external services.
- Use queues or external services for expensive CPU, image, or audio work when needed.
- Optimize provider and database boundaries before local algorithm tweaks.
- Use platform circuit breaker, timeout, lock, and concurrency utilities.
- Cache only when the owner can define invalidation.
- Do not cache whole authenticated API responses by default. User-specific and provider/stateful responses need explicit privacy and invalidation rules.
- Do not add cache-aside logic in routes.
- Do not optimize before there is a measured problem.

```ts
// Bad: route performs expensive synchronous transformation.
const analyzed = expensiveImageTransform(req.body.image);

// Good: module delegates expensive/provider work behind the right boundary.
const analyzed = await runExternalAnalysis(request, trace);
```

```ts
// Bad: endpoint creates an unrelated cache key.
const key = `order:${req.body.orderId}`;

// Good: owner module or platform owns key format and invalidation.
const activeOrder = await resolveActiveOrder(orderId);
```
