---
layer: framework
preset: express
title: Express API
---

# Express API

## Core API philosophy

An Express API is a modular monolith: one deployable Node, Express, and TypeScript
service with clear owners inside the service instead of distributed microservice
habits or generic MVC folders.

Domain ownership comes before technical folder categories. Express routes are
transport adapters, not business logic containers. Zod contracts are the runtime
boundary for public input. Platform integrations are isolated behind `platform/`.

Do not add speculative abstractions. Do not add defensive logic for impossible `unenforced`
states.

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

## Request validation

Routes call `validateRequest(contract.request)`. After middleware, routes read
validated values with `getValidatedRequest()`.

Rules:

- Do not read from raw `req.body`, `req.query`, or `req.params` when validated data exists. `enforced-by: security/semgrep`
- Do not duplicate validation manually in handlers. `unenforced`
- Do not use type assertions to pretend raw input is valid. `enforced-by: security/semgrep`
- Validation errors use the structured error response envelope. `enforced-by: security/semgrep`
- Request validation happens before route business logic. `enforced-by: security/semgrep`

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

## Response shapes

Public responses use `sendOk()` and `sendError()`. Successful responses use
`{ "status": "ok", "data": ... }`. Errors use
`{ "status": "error", "code": "...", "message": "...", "details"?: ... }`.

Rules:

- Endpoint-specific response mapping stays with the endpoint or module owner. `unenforced`
- OpenAPI response schemas must match the actual envelope shape. `enforced-by: express/openapi-fresh`
- Validate outbound payloads only when the endpoint is high-risk or has a history of drift. `enforced-by: security/semgrep`

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

## Security boundaries

Security belongs at the boundary that can enforce it reliably. nginx or the load balancer owns edge
traffic shape. Express middleware owns transport policy. Zod contracts own runtime input shape.
Modules own domain authorization. Platform owners own provider, database, filesystem, and process
access.

Rules:

- Use Helmet and security middleware unless an explicit security task changes
  that policy. `enforced-by: security/semgrep`
- Terminate TLS at nginx, the load balancer, or another explicit edge owner. Do not add ad hoc HTTPS setup inside Express unless the deployment architecture requires Node to terminate TLS. `enforced-by: security/semgrep`
- Preserve security headers such as HSTS, `X-Content-Type-Options`, frame policy, referrer policy, and CSP where relevant. `enforced-by: security/semgrep`
- Validate body, query, params, and content type before business logic. `enforced-by: security/semgrep`
- Treat authorization as product behavior when the rule depends on domain state. `unenforced`
- Treat ownership checks as transport middleware only when the rule is a reusable HTTP boundary. `unenforced`
- Use `crypto.timingSafeEqual()` for HMAC, webhook, or token comparisons where timing leaks matter. `unenforced`
- Use `crypto.randomBytes()` or `crypto.randomUUID()` for security-sensitive random values. Do not use `Math.random()` for tokens, nonces, secrets, or reset codes. `enforced-by: security/semgrep`
- Never use `eval()`, `new Function()`, string-based timers, or dynamic code generation. `enforced-by: security/semgrep`
- Never resolve filesystem paths directly from user input. `enforced-by: security/semgrep`
- Never build dynamic imports, module paths, shell commands, or child-process arguments from user input. `enforced-by: security/semgrep`
- Avoid `child_process` in request paths. When unavoidable, use fixed commands, argument arrays, least privilege, and no shell interpolation. `enforced-by: security/semgrep`
- Do not trust provider callbacks or webhooks without signature, token, or ownership verification. `enforced-by: security/semgrep`
- Do not redirect to user-supplied URLs unless the target is relative or explicitly allowlisted. `enforced-by: security/semgrep`
- Do not introduce cookie sessions unless this API becomes the session owner. If cookies are introduced, set `httpOnly`, `secure`, `sameSite`, explicit `maxAge`, and a non-default cookie name. `enforced-by: security/semgrep`
- Do not add local in-memory JWT revocation or blacklists. If this API owns token revocation, use short-lived access tokens and a shared external revocation store. `enforced-by: security/semgrep`
- Do not ship default credentials, example admin users, or development-only access paths. `enforced-by: security/semgrep`
- Do not pre-escape JSON payload fields. If this API emits HTML, escape output by HTML context at the rendering boundary. `enforced-by: security/semgrep`
- Do not add maintenance endpoints unless they are private, authenticated, and necessary. `enforced-by: security/semgrep`
- Prefer external observability over ad hoc debug endpoints. `enforced-by: security/semgrep`

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

## Errors

Throw `Error` instances. Use HTTP-aware errors only at HTTP-aware boundaries, and `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
use platform-specific typed errors for platform failures.

Rules:

- Never throw strings. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Never throw plain objects. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Do not catch just to rethrow unchanged. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Distinguish expected operational errors from programmer errors. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Expected operational errors become typed results or typed errors. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Unknown programmer errors are logged, reported, and returned as generic 500 responses. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Do not convert internal errors to detailed client responses. `unenforced`
- Central error middleware owns final formatting. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Error middleware delegates logging, reporting, and crash policy to the
  reporting/runtime owner. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Error middleware never sends emails, mutates recovery state, or decides process lifetime. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Use `notFoundRoute` for 404. `enforced-by: express/openapi-fresh`
- Route handlers may convert expected module failures to `sendError()`. `enforced-by: express/openapi-fresh`
- Client-visible messages must be generic and must not leak table names, column
  names, stack traces, file paths, provider internals, or raw IDs. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Startup failures fail fast before the server accepts traffic. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Fatal runtime errors go through the runtime shutdown path so the
  orchestrator can restart the container. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Process-level `unhandledRejection` and `uncaughtException` fallbacks are last-resort guards. In deployed environments, they must report, mark readiness false/draining, shut down, and let the orchestrator restart the process. Do not continue serving after an untrusted process-level failure. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`

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

## API naming

API names are public and operational contracts. They must distinguish API-facing
language, domain language, provider language, database language, and log
metadata.

### API response names

Rules:

- Response payload names use API-facing names intentionally. `enforced-by: naming/identifiers`
- Do not leak provider or database field names unless the public API contract is
  explicitly provider-shaped. `enforced-by: typescript/eslint zod/require-strict`
- Map provider/database shapes into response shapes at the endpoint or module
  owner. `enforced-by: naming/identifiers`
- Public envelope fields stay stable. `enforced-by: express/openapi-fresh`

Bad:

```ts
function buildSubmitOrderResponse(result: SubmitOrderSuccess) {
    return {
        providerOperationId: result.providerOperationId,
        providerStatus: result.providerStatus,
        row_created_at: result.createdAt,
    };
}
```

Good:

```ts
function buildSubmitOrderResponse(result: SubmitOrderSuccess): SubmitOrderHttpResponse {
    return {
        order: {
            id: result.orderId,
            status: result.status,
            confirmationExpiresAt: result.confirmationExpiresAt,
        },
        usage: result.usage,
    };
}
```

### API domain and data access names

Rules:

- Keep domain objects independent from storage or provider naming when shapes
  differ. `enforced-by: naming/identifiers`
- Cross-module functions use stable names and domain-shaped parameters. `unenforced`
- Application-owned database, cache, storage, SDK, and remote API retrieval
  functions use `get`. Multiplicity, pagination, and optionality belong in the
  noun and type, not in alternate verbs. `enforced-by: naming/identifiers`
- Application-owned database and storage mutation functions use `set`, `insert`, `update`, or
  `delete`. `set` replaces a supplied value, `insert` adds a row or item, `update` changes one, and
  `delete` destroys it. `enforced-by: naming/identifiers`
- Database row names stay inside the platform database boundary. `unenforced`
- Use `dbRow` only inside database boundary code when naming a database wire
  shape. `enforced-by: naming/identifiers`
- Do not concatenate SQL, RPC names, table names, column names, filters, or
  order clauses from user input. `enforced-by: naming/identifiers`

Bad:

```ts
export async function generateReport(req: AuthenticatedRequest) {
    return executeReportPipeline(req.body.documentId, req.user.id, req.headers);
}

const order = await getOrderRowById(orderId);
```

Good:

```ts
export async function generateReport(input: GenerateReportInput, trace: RequestTrace) {
    return executeReportPipeline(input, trace);
}

const activeOrder = await getActiveOrder(orderId);
```

### API configuration and environment names

Rules:

- Environment variable names are external deployment contracts and use
  `UPPER_SNAKE_CASE`. `enforced-by: typescript/eslint zod/require-strict`
- Config module values use concrete domain names. `enforced-by: typescript/eslint gspot/env-access-owner`
- Do not add a hierarchy or generic config owner for one value. `enforced-by: typescript/eslint gspot/env-access-owner`
- Do not read environment values outside the environment owner. `enforced-by: typescript/eslint gspot/env-access-owner`

Bad:

```ts
export const config = {
    value: process.env.TOKEN,
};
```

Good:

```ts
export const providerConfig = {
    apiKey: providerApiKey,
    requestTimeoutMilliseconds,
};
```

### Logs and telemetry names

Rules:

- Event names and log object keys are operational contracts. `enforced-by: typescript/eslint zod/require-strict`
- Keep event names stable. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep log object keys stable. `enforced-by: typescript/eslint no-restricted-syntax`
- Renaming log fields is an observability contract change. `enforced-by: typescript/eslint zod/require-strict`
- Put searchable values in structured fields, not dynamic message strings. `enforced-by: typescript/eslint no-restricted-syntax`
- Use stable names for request IDs, correlation IDs, provider request IDs,
  operation IDs, resource IDs, and safe user IDs. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not put provider messages, user text, serialized payloads, or raw IDs into
  event names. `enforced-by: typescript/eslint no-restricted-syntax`

Bad:

```ts
logger.info(`operation ${operationId} for ${userEmail} failed with ${providerMessage}`);
```

Good:

```ts
logger.info(
    {
        requestId,
        operationId,
        resourceId,
        providerName,
        failureCode,
    },
    'Provider operation failed',
);
```

## Logging

Use the central logger from the telemetry boundary. HTTP request and response logging belongs to `unenforced`
`pino-http` middleware; feature code logs product and provider events.

Rules:

- Application logs go to stdout or stderr through Pino. `enforced-by: typescript/eslint no-console`
- Keep Pino logger configuration, redaction, serializers, timestamp and level formatting, and transports in the central telemetry or app assembly owner. Do not configure Pino from feature modules. `enforced-by: typescript/eslint no-console`
- Keep Pino's standard levels: `debug`, `info`, `warn`, `error`, and `fatal`. `enforced-by: typescript/eslint no-console`
- Put searchable values in the first object argument; keep the message string stable. `unenforced`
- Do not instantiate new Pino loggers in modules. `enforced-by: typescript/eslint no-console`
- Do not use `pino-pretty` in deployed environments. `enforced-by: typescript/eslint no-console`
- Do not add Pino transports, OpenTelemetry log forwarding, or observability-vendor wiring without
  an explicit observability task. That task defines the service name, trace correlation, collector
  and exporter configuration, schema, redaction, and deployment ownership.
  `enforced-by: typescript/eslint no-console`
- Use the reporting owner for exception capture. `enforced-by: typescript/eslint no-console`
- Use the `err` field for `Error` objects so Pino serializes errors consistently. `enforced-by: typescript/eslint no-console`
- Do not log full `req`, `res`, headers, cookies, request bodies, response bodies, provider responses, or DB rows outside the dedicated HTTP logger or reporting owner. `enforced-by: security/semgrep`
- Request-path logs include stable correlation fields when available: `requestId`, domain operation IDs, provider `requestId`, and `userId` only when it is safe and needed. `enforced-by: typescript/eslint no-console`

```ts
// Bad: a dynamic message hides searchable fields.
logger.info(`Provider operation ${operationId} started for ${accountId}`);

// Good: stable message, structured fields.
logger.info({ operationId, accountId, requestId: trace.requestId }, 'Provider operation started');
```

```ts
// Bad: full provider response may contain sensitive or huge payloads.
logger.error({ response }, 'Provider operation failed');

// Good: summarize the failure and keep the provider request ID.
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
