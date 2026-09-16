# Working on the API

These rules apply to the `api/` subproject.

For cross-cutting TypeScript style, type placement, import/export, and runtime
boundary guidance, also follow `rules/TYPESCRIPT.md`. API-specific transport,
Zod, logging, async, HTTP, and testing rules stay in this file.

## Contents

- [Core API Philosophy](#core-api-philosophy)
- [API Architecture](#api-architecture)
- [Ownership Map](#ownership-map)
- [Module Boundaries](#module-boundaries)
- [Endpoint Structure](#endpoint-structure)
- [Entry Points](#entry-points)
- [HTTP Handler Rules](#http-handler-rules)
- [Contracts, Zod, and OpenAPI](#contracts-zod-and-openapi)
- [Request Validation](#request-validation)
- [Response Shapes](#response-shapes)
- [Domain Logic](#domain-logic)
- [Services and Cross-Module Communication](#services-and-cross-module-communication)
- [Data Access](#data-access)
- [Provider Integrations](#provider-integrations)
- [Configuration and Environment](#configuration-and-environment)
- [Security Boundaries](#security-boundaries)
- [Secrets](#secrets)
- [Errors](#errors)
- [Async and Promises](#async-and-promises)
- [Logging and Telemetry](#logging-and-telemetry)
- [Function Shape and Parameters](#function-shape-and-parameters)
- [Dependencies and Abstractions](#dependencies-and-abstractions)
- [Testing](#testing)
- [Testing Data and Infrastructure](#testing-data-and-infrastructure)
- [Network and Provider Testing](#network-and-provider-testing)
- [OpenAPI and Contract Testing](#openapi-and-contract-testing)
- [Vitest Mocking Patterns](#vitest-mocking-patterns)
- [Production Operations](#production-operations)
- [nginx and Runtime](#nginx-and-runtime)
- [Performance](#performance)

## Core API Philosophy

The API is a modular monolith. It should stay one deployable Node, Express, and
TypeScript service, with clear owners inside the service instead of distributed
microservice habits or generic MVC folders.

Domain ownership comes before technical folder categories. Express routes are
transport adapters, not business logic containers. Zod contracts are the runtime
boundary for public input. Platform integrations are isolated behind `platform/`.

Do not add speculative abstractions. Do not add defensive logic for impossible
states. Do not run tests, lint, formatting, security scans, or broad verification
commands unless the user asks for them.

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

## API Architecture

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

## Ownership Map

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

## Module Boundaries

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

## Endpoint Structure

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

## Entry Points

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
- Event-driven entry points should use unique event IDs or correlation IDs, not global queues shared blindly across tests or tenants.

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

## HTTP Handler Rules

Routes adapt HTTP to domain calls. They do not own validation policy, database
access, provider mechanics, prompts, caching, or business decisions.

```ts
// Bad: route owns validation, database access, provider behavior, and response policy.
router.post('/orders', async (req, res) => {
    const { accountId, itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        res.status(400).json({ error: 'Bad items' });
        return;
    }

    const account = await database.from('accounts').select('*').eq('id', accountId);
    const providerResponse = await fetch(env.PAYMENT_PROVIDER_URL, {
        method: 'POST',
        body: JSON.stringify({ account, itemIds }),
    });

    res.json(await providerResponse.json());
});
```

```ts
// Good: route is an HTTP adapter.
router.post(
    '/',
    validateRequest(submitOrderContract.request),
    asyncRoute(async (req, res) => {
        const request = req as AuthenticatedRequest;
        res.setHeader('Cache-Control', NO_STORE_CACHE_HEADER);

        const authenticated = requireAuthenticatedRequest(request, res);
        if (!authenticated) return;

        const validated = getValidatedRequest(authenticated.request);
        const trace = extractRequestTrace(authenticated.request, 'orders.submit');

        const result = await submitOrder(authenticated.userId, validated.body, trace);

        if (!result.success) {
            sendError(res, result.error.status, result.error.code, result.error.message, result.error.details);
            return;
        }

        sendOk(res, result.response);
    }),
);
```

Middleware rules:

- Middleware can validate, authenticate, rate-limit, attach context, and enforce ownership.
- Middleware cannot make feature decisions.
- Middleware cannot call the database for product behavior except through auth or ownership helpers designed for that boundary.
- Business permission checks belong in a module or ownership middleware, depending on whether the rule is transport-level or domain-level.
- Every async route or middleware must use `asyncRoute()` or explicitly catch
  and pass errors to `next(error)`.
- Do not rely on framework promise auto-forwarding unless the API standard is
  deliberately migrated to that behavior.

HTTP edge rules:

- Reject unsupported content types for body-bearing endpoints that only accept JSON.
- Keep JSON body limits route-specific when payload sizes differ by feature.
- Match large payload limits with reverse-proxy and provider limits.
- Remember that body parsing itself is work. Do not parse large JSON bodies on routes that do not need them.
- Put broad rate limits at nginx or the load balancer when available.
- Put app-specific rate limits in Express middleware.
- Put route-specific limits next to route assembly in `createApp()` or the endpoint owner.
- Enable `trust proxy` only when the deployment topology is known and load-balancer forwarding headers are trusted.
- Choose one compression owner. Prefer reverse-proxy compression for high-traffic production; avoid accidental double compression.
- Do not hide authorization backdoors behind headers, query params, or test-only middleware.

```ts
// Bad: every endpoint silently inherits an oversized JSON parser.
app.use(express.json({ limit: '50mb' }));

// Good: small default, with larger limits only where the endpoint owner needs them.
app.use(API_ROUTE_IMPORT_FILE, express.json({ limit: FILE_IMPORT_JSON_BODY_LIMIT }), importFileRouter);
app.use(express.json({ limit: DEFAULT_JSON_BODY_LIMIT }));
```

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

## Request Validation

Routes call `validateRequest(contract.request)`. After middleware, routes read
validated values with `getValidatedRequest()`.

Rules:

- Do not read from raw `req.body`, `req.query`, or `req.params` when validated data exists.
- Do not duplicate validation manually in handlers.
- Do not use type assertions to pretend raw input is valid.
- Validation errors use the structured error response envelope.
- Request validation happens before route business logic.

```ts
// Bad.
const limit = Number(req.query.limit);
if (Number.isNaN(limit)) {
    sendError(res, 400, errorCodes.INVALID_REQUEST, 'Invalid limit');
}

// Good.
const validated = getValidatedRequest(req);
const { limit } = validated.query;
```

## Response Shapes

Public responses use `sendOk()` and `sendError()`. Successful responses use
`{ "status": "ok", "data": ... }`. Errors use
`{ "status": "error", "code": "...", "message": "...", "details"?: ... }`.

Rules:

- Endpoint-specific response mapping stays with the endpoint or module owner.
- Follow [`NAMING.md`](NAMING.md) for API-facing response names and boundary
  field names.
- OpenAPI response schemas must match the actual envelope shape.
- Validate outbound payloads only when the endpoint is high-risk or has a history of drift.

```ts
function buildReportResponse(result: ReportSuccess): ReportHttpResponse {
    return {
        report: {
            id: result.report.id,
            status: result.report.status,
            downloadUrl: result.report.downloadUrl,
        },
        usage: result.usage,
    };
}
```

## Domain Logic

Modules receive explicit domain inputs, not Express objects. Domain code returns
typed results for expected business outcomes. It throws for exceptional
infrastructure failures only when there is no useful local recovery.

Rules:

- Follow [`NAMING.md`](NAMING.md) when translating storage or provider names
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

## Services and Cross-Module Communication

Cross-module calls should preserve ownership. If one module needs another
module's context, call a function owned by that module instead of reaching into
its storage, cache, or provider details.

Rules:

- Do not query another module's tables directly from the caller.
- Do not copy another module's logic into the caller.
- Cross-module functions need stable domain-shaped parameters. Follow
  [`NAMING.md`](NAMING.md) for function names.
- Keep the called module in command of its own invariants.

```ts
// Bad: reporting reaches into order storage details.
const order = await getOrderRowById(orderId);

// Good: orders module owns the active order concept.
const activeOrder = await resolveActiveOrder(orderId);
```

## Data Access

Database code belongs in `platform/db`. Query files read. Mutation files write.
Query and mutation functions should expose domain-useful return shapes where
possible.

Rules:

- Do not expose raw database response objects outside `platform/db`.
- Follow [`NAMING.md`](NAMING.md) for database wire-shape names.
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

## Provider Integrations

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

## Configuration and Environment

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
- Follow [`NAMING.md`](NAMING.md) for configuration names.
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
            code: 'project',
            path: ['SERVICE_API_KEY'],
            message: 'SERVICE_API_KEY is required when SERVICE_URL is configured',
        });
    }
}
```

## Security Boundaries

Security belongs at the boundary that can enforce it reliably: nginx or the
load balancer for edge traffic shape, Express middleware for transport policy,
Zod contracts for runtime input shape, modules for domain authorization, and
platform owners for provider, database, filesystem, and process access.

Rules:

- Use Helmet and security middleware unless an explicit security task changes
  that policy.
- Terminate TLS at nginx, the load balancer, or another explicit edge owner. Do not add ad hoc HTTPS setup inside Express unless the deployment architecture requires Node to terminate TLS.
- Preserve security headers such as HSTS, `X-Content-Type-Options`, frame policy, referrer policy, and CSP where relevant.
- Validate body, query, params, and content type before business logic.
- Treat authorization as product behavior when the rule depends on domain state.
- Treat ownership checks as transport middleware only when the rule is a reusable HTTP boundary.
- Use `crypto.timingSafeEqual()` for HMAC, webhook, or token comparisons where timing leaks matter.
- Use `crypto.randomBytes()` or `crypto.randomUUID()` for security-sensitive random values. Do not use `Math.random()` for tokens, nonces, secrets, or reset codes.
- Never use `eval()`, `new Function()`, string-based timers, or configured code generation.
- Never resolve filesystem paths directly from user input.
- Never build configured imports, module paths, shell commands, or child-process arguments from user input.
- Avoid `child_process` in request paths. When unavoidable, use fixed commands, argument arrays, least privilege, and no shell interpolation.
- Do not trust provider callbacks or webhooks without signature, token, or ownership verification.
- Do not redirect to user-supplied URLs unless the target is relative or explicitly allowlisted.
- Do not introduce cookie sessions unless this API becomes the session owner. If cookies are introduced, set `httpOnly`, `secure`, `sameSite`, explicit `maxAge`, and a non-default cookie name.
- Do not add local in-memory JWT revocation or blacklists. If this API owns token revocation, use short-lived access tokens and a shared external revocation store.
- Do not ship default credentials, example admin users, or development-only access paths.
- Do not pre-escape JSON payload fields. If this API emits HTML, escape output by HTML context at the rendering boundary.
- Do not add maintenance endpoints unless they are private, authenticated, and necessary.
- Prefer external observability over ad hoc debug endpoints.

```ts
// Bad: user input controls code execution.
const result = new Function('payload', scriptFromRequest)(req.body);

// Bad: user input controls local file access.
const contents = await readFile(`/tmp/${req.query.name}`, 'utf8');

// Good: validate a stable identifier, then let the owning platform code resolve storage.
const validated = getValidatedRequest(req);
const attachment = await loadUserAttachment(validated.params.attachment_id, authenticated.userId);
```

```ts
// Bad: open redirect.
res.redirect(String(req.query.next));

// Good: only relative or allowlisted targets are accepted.
res.redirect(resolveSafeRedirect(validated.query.next));
```

```ts
// Bad: timing-sensitive comparison uses regular equality.
if (signature === expectedSignature) {
    acceptWebhook();
}

// Good: platform verifier owns canonicalization and constant-time comparison.
if (verifyWebhookSignature({ signature, payload, secret })) {
    acceptWebhook();
}
```

## Secrets

Never log API keys, provider tokens, auth headers, bearer tokens, database
service-role keys, reporting tokens, raw user content, or full provider payloads.

Rules:

- Never put real secrets in OpenAPI examples.
- Never put real secrets in `.env.example`.
- If package publishing is ever introduced, use an explicit package file allowlist; ignored files can still leak through packaging defaults.
- Treat user media, transcripts, and user messages as sensitive.
- Scrub before logging or reporting.

```ts
// Bad.
logger.info({ headers: req.headers }, 'Incoming request');

// Good.
logger.info({ path: req.path, method: req.method, requestId }, 'Incoming request');
```

## Errors

Throw `Error` instances. Use HTTP-aware errors only at HTTP-aware boundaries, and
use platform-specific typed errors for platform failures.

Rules:

- Never throw strings.
- Never throw plain objects.
- Do not catch just to rethrow unchanged.
- Distinguish expected operational errors from programmer errors.
- Expected operational errors should become typed results or typed errors.
- Unknown programmer errors should be logged, reported, and returned as generic 500 responses.
- Do not convert internal errors to detailed client responses.
- Central error middleware owns final formatting.
- Error middleware should delegate logging, reporting, and crash policy to the
  reporting/runtime owner.
- Error middleware should not directly send emails, mutate recovery state, or decide process lifetime.
- Use `notFoundRoute` for 404.
- Route handlers may convert expected module failures to `sendError()`.
- Client-visible messages must be generic and must not leak table names, column
  names, stack traces, file paths, provider internals, or raw IDs.
- Startup failures should fail fast before the server accepts traffic.
- Fatal runtime errors should go through the runtime shutdown path so the
  orchestrator can restart the container.
- Process-level `unhandledRejection` and `uncaughtException` fallbacks are last-resort guards. In deployed environments, they must report, mark readiness false/draining, shut down, and let the orchestrator restart the process. Do not continue serving after an untrusted process-level failure.

```ts
// Bad.
throw 'Provider failed';

// Bad.
throw { status: 500, message: error.message };

// Good.
throw new Error('Provider request failed', { cause: error });
```

```ts
// Good expected business failure.
return {
    success: false,
    error: {
        status: HTTP_STATUS.CONFLICT,
        code: errorCodes.ORDER_ALREADY_SUBMITTED,
        message: 'Order already submitted',
    },
};
```

```ts
// Bad: expected domain conflict is thrown as an untyped infrastructure error.
throw new Error(`Order ${orderId} has already been submitted`);

// Good: expected domain conflict is returned in the module result.
return {
    success: false,
    error: {
        status: HTTP_STATUS.CONFLICT,
        code: errorCodes.ORDER_ALREADY_SUBMITTED,
        message: 'Order already submitted',
    },
};
```

```ts
// Bad: HTTP middleware owns operational policy.
app.use((err, req, res, next) => {
    logger.error(err);
    sendCriticalEmail(err);
    if (!err.isOperational) process.exit(1);
});

// Good: middleware forwards to the HTTP/runtime error owner.
app.use((err, req, res, next) => {
    void reportHttpError(err, req);
    sendUnhandledErrorResponse(res);
});
```

## Async and Promises

Async code must preserve correctness, debuggability, and bounded resource use.
Do not let promise behavior become implicit.

Rules:

- Mark functions `async` when they return promises from asynchronous work.
- Use `return await` inside `try` or error-boundary functions when it preserves useful stack traces.
- Await asynchronous work before returning from route handlers, middleware, startup, and shutdown paths.
- Do not pass `async` callbacks to synchronous iteration APIs when the caller expects completion.
- Use `Promise.all()` only for independent work that can safely run concurrently.
- Use platform concurrency utilities for large fan-out, provider calls, and
  batch work.
- Do not leave floating promises unless they are intentionally detached, logged, and supervised.
- Do not swallow promise rejections.
- Prefer `async`/`await` or promise chains over callback pyramids.
- Use `finally` for required cleanup after async work.

```ts
// Bad: forEach does not wait for async callbacks.
messages.forEach(async (message) => {
    await persistMessage(message);
});

// Good: the caller waits for all writes to finish.
await Promise.all(messages.map((message) => persistMessage(message)));
```

```ts
// Good: cleanup still runs when the provider call fails.
try {
    return await createProviderOperation(providerRequest);
} finally {
    releaseOperationLock(operationId);
}
```

```ts
// Good: preserve the provider failure stack and cause at the boundary.
export async function createProviderOperation(request: ProviderOperationRequest) {
    try {
        return await postProviderOperation(request);
    } catch (error) {
        throw new Error('Provider request failed', { cause: error });
    }
}
```

## Logging and Telemetry

Use the central logger from the telemetry boundary. Use structured item fields.
The message string describes the event. Object fields carry searchable metadata.
HTTP request/response logging belongs to `pino-http` middleware; feature code
logs product and provider events.

Rules:

- Do not use `console.log`.
- Application logs go to stdout or stderr through Pino.
- Do not write application logs directly to files, databases, or third-party transports from route/module code.
- Include request trace when available.
- Propagate stable request or correlation IDs to provider calls when supported.
- Keep event names stable and follow [`NAMING.md`](NAMING.md).
- Keep Pino logger configuration, redaction, serializers, timestamp/level formatting, and transports in the central telemetry/app assembly owner. Do not configure Pino from feature modules.
- Keep Pino's standard levels: `debug`, `info`, `warn`, `error`, and `fatal`. Do not add project levels unless the logging pipeline is deliberately redesigned.
- Use `debug` for noisy diagnostic details, `info` for normal lifecycle events, `warn` for degraded or retryable conditions, `error` for failed operations, and `fatal` only when the process or a major runtime owner is unusable.
- Put searchable values in the first item argument; keep the message string stable and human-readable.
- Do not put configured IDs, provider messages, user text, or serialized payloads into the log message string.
- Do not instantiate new Pino loggers in modules.
- Do not use `pino-pretty` in deployed environments.
- Do not add Pino transports, OpenTelemetry log forwarding, or observability-vendor wiring without an explicit observability task that defines service name, trace correlation, collector/exporter config, schema, redaction, and deployment ownership.
- Use the reporting owner for exception capture.
- Use the `err` field for `Error` objects so Pino serializes errors consistently.
- Do not log full `req`, `res`, headers, cookies, request bodies, response bodies, provider responses, or DB rows outside the dedicated HTTP logger/reporting owner.
- Do not log raw user media, transcripts, protocol payloads, tokens, headers, cookies, or full provider payloads.
- Redaction belongs in the central telemetry layer. When a new sensitive key can reach logs or reports, update logger redaction and telemetry scrubbing instead of relying on one-off call-site filtering.
- Request-path logs should include stable correlation fields when available: `requestId`, domain operation IDs, provider `requestId`, and `userId` only when it is safe and needed.
- Keep log item keys stable and follow [`NAMING.md`](NAMING.md). Renaming log fields is an observability contract change.
- Avoid large, deeply nested, or expensive-to-compute log fields. Summarize counts, IDs, statuses, provider names, and durations instead.
- Tests for telemetry should assert mandatory fields and redaction, not just that a logger was called.
- Important production signals include error rate, response latency, throughput, saturation, process restarts, provider failures, database failures, and circuit breaker state.

```ts
// Bad: configured message hides searchable fields.
logger.info(`Provider operation ${operationId} started for ${accountId}`);

// Good: stable message, structured fields.
logger.info({ operationId, accountId, requestId: trace.requestId }, 'Provider operation started');
```

```ts
// Bad: full provider response may contain sensitive or huge payloads.
logger.error({ response }, 'Provider operation failed');

// Good: summarize the failure and keep provider request ID.
logger.error(
    {
        err,
        provider: providerName,
        statusCode,
        requestId: providerRequestId,
    },
    'Provider operation failed',
);
```

```ts
logger.error(
    {
        err,
        statusCode: apiError.statusCode,
        path: req.path,
    },
    'Server error',
);
```

```ts
logger.info(
    {
        operationId,
        provider: providerName,
        durationMilliseconds,
        requestId: trace.requestId,
    },
    'Provider operation started',
);
```

## Function Shape and Parameters

API functions should expose domain inputs and API/module result contracts, not
transport or provider mechanics.

Rules:

- Use domain types for IDs where available.
- Do not pass raw Express request/response, provider, or database objects across
  layers.
- Return types must reflect the module or API result contract.

```ts
// Bad.
export async function submitOrder(req: AuthenticatedRequest) {}

// Good.
export async function submitOrder(request: SubmitOrderRequest, trace: RequestTrace): Promise<SubmitOrderResult> {}
```

## Dependencies and Abstractions

Rules:

- Use native Node and TypeScript APIs first.
- Use approved dependencies before adding new ones.
- Do not add lodash-style dependencies for array, item, or string helpers.
- Do not add DI containers.
- Do not add ORMs.
- Do not add another validation library.
- Do not add another logger.
- Do not add another HTTP framework.
- Do not run deprecated or vulnerable Express versions. Express upgrades are explicit dependency/runtime work, not drive-by changes.
- Do not extract shared libraries inside the monolith unless the code is genuinely shared across independent packages and the user asks.
- Keep exact dependency versions.
- Do not add a dependency for a one-line native API or a small local helper.

## Testing

Do not create or update tests unless the user asks. When tests are requested,
write tests that can fail for real bugs and prove user-visible behavior.

Rules when tests are requested:

- Prefer component-style API tests for meaningful backend behavior: start the API surface, use real middleware and routes, mock only boundaries that leave the process.
- Unit test pure domain functions when the behavior is algorithmic or has many input branches.
- Use narrow in-process HTTP tests with `createApp()` and `supertest` when lifecycle, ports, and process startup are irrelevant.
- Use a real HTTP client against a started server when startup, shutdown, readiness, middleware order, sockets, or container-like behavior matters.
- Configure real HTTP clients so non-2xx responses do not throw. The test should decide which status is acceptable.
- Use e2e tests only when runtime lifecycle, provider connection behavior, or deployment wiring matters.
- Real provider tests need explicit opt-in env vars and must not run as part of default suites.
- Use Arrange, Act, Assert.
- Do not mock the function under test.
- Mock provider, network, database, and filesystem boundaries.
- Prefer dependency injection over module mocks when dependencies are explicit.
- Use stable fake data.
- Do not use snapshots for unstable data.
- Clean mocks between tests.
- Do not add test-only auth backdoors, magic headers, or bypass routes.
- Do not assert only that collaborators were called. Assert the outcome and the externally visible side effects.
- Follow [`NAMING.md`](NAMING.md) for route test names; organize route tests by public story, endpoint, or behavior.
- Use nested `describe()` blocks when they make reports clearer: route, method, scenario, expectation.
- Do not commit `.only`, `.skip` placeholders, or todo tests unless the user explicitly asks for a known temporary marker.
- Restore any environment variable changed by a test.
- Cover expected errors and unknown internal errors when the change touches error handling.

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
  Follow [`NAMING.md`](NAMING.md) for test data names.
- Do not depend on previous tests.
- Do not depend on a globally empty database.
- Do not use count assertions that fail when unrelated data exists.
- Avoid global mutable fixtures.
- Avoid file-level mutable IDs that one test writes and another test reads.
- Separate metadata, context data, and the records being tested.
- Create unrelated records when the behavior must prove it does not overreach.
- Use unique queue names, event IDs, operation IDs, or correlation IDs for
  event-driven tests. Follow [`NAMING.md`](NAMING.md) for test identifier names.
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

## Production Operations

The API should behave like a stateless containerized service. Local process
state is allowed only when a platform runtime owner controls lifecycle,
invalidation, and readiness implications.

Dockerfile, image, compose, and container packaging rules live in
`rules/DOCKER.md`. Keep API runtime ownership here: health/readiness, startup,
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
- Run dependency and code security scans only when requested or in CI.
- Treat scanner findings as engineering input, not as automatic permission for broad dependency churn.

```ts
// Bad: mutable process state changes user-visible behavior without an owner.
const activeOrders = new Map<string, OrderState>();

// Good: runtime/cache owner defines key format, lifetime, and invalidation.
const activeOrder = await resolveActiveOrder(orderId);
```

## nginx and Runtime

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
- Shutdown should mark readiness false, stop accepting new HTTP work, wait briefly for in-flight requests, close provider/runtime resources, flush telemetry/cache, log the outcome, and then exit.
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
