---
title: HTTP
---

# HTTP

Rules for any HTTP service, whatever framework serves it, on top of the security, error, and
logging rules.

## Boundaries

- Validate the body, query, path parameters, headers, and content type once, at the edge, with a
  schema. Handlers read the validated value, never the raw request.
- Reject unsupported content types on endpoints that take a body. Limit the body size per route,
  and keep the proxy's body limit equal to the application parser's.
- Handlers adapt transport to domain calls. They own no validation policy, database access,
  provider mechanics, caching, or business decision.
- Middleware validates, authenticates, rate-limits, and attaches context, and makes no feature
  decision.

## Responses

- The service documents one success shape and one error shape and keeps both stable.
- Status codes are precise: 201 for creation, 204 with no body, 4xx for caller errors, and 5xx
  only for failures the caller cannot fix.
- The endpoint or module owner maps provider and database shapes into response shapes. Response
  field names are API names, not storage names, unless the contract is explicitly provider-shaped.
- Escape HTML for its rendering context, and never pre-escape JSON field values.

## Sessions and transport

- Terminate TLS at the edge owner, and trust forwarding headers only from that edge.
- A cookie session needs CSRF protection on every state-changing request.
- When the service owns tokens, a revocation reaches every instance.

## Wire names

<!-- level: all -->

- URL path segments are kebab-case plural nouns, such as `/order-items/{orderItemId}`.
- Existing protocol header names stay as they are, and a new header carries no `X-` prefix, as
  [RFC 6648](https://www.rfc-editor.org/rfc/rfc6648) recommends.

## Operations

- Every asynchronous handler passes its errors to the central error handler, and no promise floats
  in a request path.
- Startup fails before the server accepts traffic. Shutdown sets readiness to false, stops
  accepting, drains in-flight work for a bounded time, closes resources, and exits.
- A process whose state a failure left untrustworthy exits instead of serving.
- Health and readiness endpoints are cheap and call no provider.
- Broad rate limits sit at the edge, application limits in middleware, and route limits beside
  the route.
- Either the proxy or the application compresses responses, not both. Under heavy traffic, the
  reverse proxy owns compression.
