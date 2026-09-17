---
layer: shared
preset: express
title: HTTP
---

# HTTP

Rules that hold for any HTTP service, whatever framework serves it.

## Boundaries

- Validate body, query, path parameters, headers, and content type before any business logic runs. Validation happens once, at the edge, with a schema; handlers read the validated value and never the raw request. `enforced-by: security/semgrep`
- Reject unsupported content types on body-bearing endpoints. `enforced-by: security/semgrep`
- Bound every input: body size per route, string lengths, collection sizes, page sizes, nesting depth. `enforced-by: security/semgrep`
- Handlers adapt transport to domain calls. They do not own validation policy, database access, provider mechanics, caching, or business decisions. `enforced-by: security/semgrep`
- Middleware validates, authenticates, rate-limits, and attaches context. It does not make feature decisions. `enforced-by: security/semgrep`
- Authorization is checked where the data is read or changed, not only at a layout, a proxy, or a route guard. `enforced-by: security/semgrep`

## Responses

- One envelope for the whole service. Success and error shapes are stable and documented. `enforced-by: express/openapi-fresh`
- Status codes are precise: 201 for creation, 204 with no body, 4xx for caller errors, 5xx only for failures the caller cannot fix. `enforced-by: express/openapi-fresh`
- Client-visible error messages are generic and stable. They never carry table names, column names, stack traces, file paths, provider internals, or raw IDs. `unenforced`
- Do not return stack traces, validation internals, or raw upstream errors to clients. `unenforced`
- Map provider and database shapes into response shapes at the endpoint or module owner. Public field names are API names, not storage names. `unenforced`

## Security

- Terminate TLS at the edge owner. Preserve security headers: HSTS, `X-Content-Type-Options`, frame policy, referrer policy, CSP where relevant. `enforced-by: security/semgrep`
- Use constant-time comparison for HMAC, webhook, and token checks. `unenforced`
- Use cryptographic randomness for tokens, nonces, secrets, and reset codes. Never `Math.random()` or `random.random()`. `enforced-by: security/semgrep`
- Verify webhook signatures against the raw body before decoding. Handle replay with idempotency keys. `enforced-by: security/semgrep`
- Redirect only to relative or allowlisted targets. `enforced-by: security/semgrep`
- Never build file paths, shell commands, dynamic imports, SQL, or outbound URLs from request input. Check outbound fetch targets against allowed hosts and each redirect in a chain. `enforced-by: security/semgrep`
- Cookies, when the service owns sessions: `httpOnly`, `secure`, `sameSite`, explicit `maxAge`, a non-default name. Writes never happen on GET. `enforced-by: security/semgrep`
- No default credentials, example admin users, test-only auth backdoors, or maintenance endpoints without authentication. `enforced-by: security/semgrep`

## Naming on the Wire

- JSON bodies and query parameters: `camelCase`. `enforced-by: naming/identifiers`
- Headers: `X-Kebab-Case`. `enforced-by: naming/identifiers`
- URL path segments: kebab-case plural nouns (`/order-items/{orderItemId}`). `enforced-by: naming/identifiers`
- Environment variables: `UPPER_SNAKE_CASE`. `enforced-by: naming/identifiers`
- Log event names: `lower_snake_case`. `enforced-by: naming/identifiers`
- The boundary translates storage casing (`user_id`) to wire casing (`userId`); domain code never sees both. `enforced-by: naming/identifiers`
- Response payload names are API-facing. Do not leak provider or database field names unless the contract is explicitly provider-shaped. `enforced-by: typescript/eslint zod/require-strict`

## Operations

- Every async handler propagates errors to the central error handler. No floating promises in request paths. `enforced-by: typescript/eslint @typescript-eslint/no-floating-promises`
- Startup failures fail fast before the server accepts traffic. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Shutdown: readiness false, stop accepting, drain in-flight work for a bounded time, close resources, exit. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Health and readiness endpoints are cheap and do no provider calls. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Rate limits: broad limits at the edge, app-specific limits in middleware, route-specific limits beside the route. `enforced-by: security/semgrep`
- One compression owner. Do not compress at both the proxy and the application. `enforced-by: security/semgrep`
- Body limits at the proxy equal the application's parser limits. `enforced-by: security/semgrep`
