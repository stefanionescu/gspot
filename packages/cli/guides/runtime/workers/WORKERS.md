---
layer: runtime
kit: cloudflare
title: Workers
---

# Workers

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Rules that hold because the code runs on a V8 isolate runtime such as Cloudflare Workers.

## Globals and APIs

- Web APIs such as `Request`, `Response`, `fetch`, `URL`, `crypto`, and `caches` are available.
- Node API availability depends on the compatibility date and flags. Check the configured
  runtime before using `node:` imports or `process.env`.
- Bindings can come from handler arguments, supported entrypoint properties, or `env` imported
  from `cloudflare:workers`. Keep binding-derived clients current when their configuration changes.
- Module-scope binding access does not permit request-only I/O outside a request context.

## Lifetime

- Isolates can be reused or discarded. Module state is neither durable storage nor a safe place
  for request-specific user data.
- Immutable configuration can be shared. Keep mutable request state isolated and persist durable
  state through the application's storage contract.
- Use the runtime's deferred-work mechanism for supported work after a response. Respect its
  lifetime limit; use a durable execution service when the operation requires stronger guarantees.

See Cloudflare's [Node process support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)
and [binding access](https://developers.cloudflare.com/workers/runtime-apis/bindings/).
