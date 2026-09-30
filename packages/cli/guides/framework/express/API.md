---
layer: framework
kit: express
title: Express API
---

# Express API

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Request and response contracts

- Validate body, query, route parameters, and content type before business operations.
- Use the validated values. A TypeScript assertion does not validate request data.
- Preserve the project's declared status codes, error envelope, and response schemas.
- Keep OpenAPI descriptions consistent with runtime responses.
- Map persistence and provider results into the public response deliberately. Exclude secrets
  and internal fields.
- Express does not require a particular schema library, response envelope, or deployment layout.
  Use the project's existing contracts instead of introducing competing conventions.

## Security

- Authenticate requests and authorize protected operations, including ownership checks that
  depend on domain state.
- Apply security headers and request-size limits appropriate to the deployment. Preserve the
  declared TLS termination and proxy-trust boundaries.
- Use cryptographic randomness for security tokens. Use constant-time verification where
  secret comparisons require it.
- Verify provider callbacks and webhooks before accepting their contents.
- Allow redirects only to validated destinations under the project's redirect policy.
- Do not execute request content as code or interpolate it into shell commands, database
  queries, module paths, or filesystem paths.
- Use parameterized database queries and validated identifiers. Keep storage path resolution
  inside the storage boundary.
- When subprocesses are required, use a fixed executable and validated argument arrays with
  no shell interpolation.
- Configure cookie security attributes, lifetime, and CSRF protection for the session contract.
- Keep token revocation consistent across service instances when the application owns it.
- Do not ship default credentials or development-only access paths.
- Escape HTML according to its rendering context. Do not pre-escape JSON field values.
- Protect maintenance and diagnostic endpoints with authentication and authorization.

## Errors and lifecycle

- Forward asynchronous failures to error middleware according to the supported Express version.
  Express 5 forwards rejected returned promises. Express 4 requires explicit forwarding.
- Error middleware keeps its four-argument signature, even when an argument is unused.
- If headers have already been sent, delegate to the next error handler instead of writing a
  second response.
- Distinguish expected domain failures from unexpected internal failures. Preserve useful causes
  in internal diagnostics and return safe client messages.
- Do not expose stack traces, credentials, internal paths, database details, or provider payloads
  through error responses.
- Use the declared not-found response after routes have had a chance to handle the request.
- Fail startup before accepting traffic when required kit is invalid.
- Stop accepting traffic and release owned resources during shutdown. Do not continue serving
  after a process-level failure leaves its state untrustworthy.

See Express [error handling](https://expressjs.com/en/guide/error-handling/) and
[production security guidance](https://expressjs.com/en/advanced/best-practice-security/).

## Logs and telemetry

- Keep secrets, cookies, authorization headers, personal content, and complete provider payloads
  out of logs.
- Preserve declared event and correlation-field names because consumers rely on them.
- Include safe request and operation identifiers when available.
- Serialize errors through the logger's supported error field so useful causes and stacks remain.
- Test redaction and required fields, rather than only asserting that a logger was called.

## Organization and naming

<!-- level: all -->

- Keep route adapters focused on HTTP behavior. Put domain operations and external integrations
  with their existing owners.
- Organize code by the behavior it owns. Do not require a monolith, microservices, or a specific
  directory layout solely because the application uses Express.
- Configure logging and environment access at their declared owners.
- Map external provider and database names into domain names at the boundary when their meanings differ.
- Name application-owned retrieval operations with `get` and the entity being retrieved.
- Use `set`, `insert`, `update`, or `delete` for mutations according to their effects.
- Keep response and event names stable. Follow the naming guides when introducing new names.
- Do not introduce speculative abstractions or fallback behavior for impossible internal states.
