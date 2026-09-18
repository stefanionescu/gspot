---
layer: shared
preset: express
title: HTTP
---

# HTTP

Rules that hold for any HTTP service, whatever framework serves it.

## Boundaries

- Validate body, query, path parameters, headers, and content type before any business logic runs. Validation happens once, at the edge, with a schema; handlers read the validated value and never the raw request.
- Reject unsupported content types on body-bearing endpoints.
- Bound every input: body size per route, string lengths, collection sizes, page sizes, nesting depth.
- Handlers adapt transport to domain calls. They do not own validation policy, database access, provider mechanics, caching, or business decisions.
- Middleware validates, authenticates, rate-limits, and attaches context. It does not make feature decisions.
- Authorization is checked where the data is read or changed, not only at a layout, a proxy, or a route guard.

## Responses

- One envelope for the whole service. Success and error shapes are stable and documented.
- Status codes are precise: 201 for creation, 204 with no body, 4xx for caller errors, 5xx only for failures the caller cannot fix.
- Client-visible error messages are generic and stable. They never carry table names, column names, stack traces, file paths, provider internals, or raw IDs.
- Do not return stack traces, validation internals, or raw upstream errors to clients.
- Map provider and database shapes into response shapes at the endpoint or module owner. Public field names are API names, not storage names.

## Security

- Terminate TLS at the edge owner. Preserve security headers: HSTS, `X-Content-Type-Options`, frame policy, referrer policy, CSP where relevant.
- Use constant-time comparison for HMAC, webhook, and token checks.
- Use cryptographic randomness for tokens, nonces, secrets, and reset codes. Never `Math.random()` or `random.random()`.
- Verify webhook signatures against the raw body before decoding. Handle replay with idempotency keys.
- Redirect only to relative or allowlisted targets.
- Never build file paths, shell commands, dynamic imports, SQL, or outbound URLs from request input. Check outbound fetch targets against allowed hosts and each redirect in a chain.
- Cookies, when the service owns sessions: `httpOnly`, `secure`, `sameSite`, explicit `maxAge`, a non-default name. Writes never happen on GET.
- No default credentials, example admin users, test-only auth backdoors, or maintenance endpoints without authentication.

## Naming on the wire

- JSON bodies and query parameters: `camelCase`.
- Headers: `X-Kebab-Case`.
- URL path segments: kebab-case plural nouns (`/order-items/{orderItemId}`).
- Environment variables: `UPPER_SNAKE_CASE`.
- Log event names: `lower_snake_case`.
- The boundary translates storage casing (`user_id`) to wire casing (`userId`); domain code never sees both.
- Response payload names are API-facing. Do not leak provider or database field names unless the contract is explicitly provider-shaped.

## Operations

- Every async handler propagates errors to the central error handler. No floating promises in request paths.
- Startup failures fail fast before the server accepts traffic.
- Shutdown: readiness false, stop accepting, drain in-flight work for a bounded time, close resources, exit.
- Health and readiness endpoints are cheap and do no provider calls.
- Rate limits: broad limits at the edge, app-specific limits in middleware, route-specific limits beside the route.
- One compression owner. Do not compress at both the proxy and the application.
- Body limits at the proxy equal the application's parser limits.
