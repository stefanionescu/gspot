# Cloudflare

Read this rule when code runs on Cloudflare Workers or Pages, or when you change a Wrangler file, `_headers`, or
`_redirects`.

## Global variables

- Web APIs such as `Request`, `Response`, `fetch`, `URL`, `crypto`, and `caches` work in this runtime.
- Node API availability depends on the compatibility date and flags. Check the configured runtime before using `node:`
  imports or `process.env`.
- Bindings can come from handler arguments, supported entrypoint properties, or `env` imported from
  `cloudflare:workers`. Build a client from `env` inside the request.
- Code at module scope can read a binding from `env`, but it cannot do I/O with it, such as a KV read. Do I/O inside a
  request handler.

## Lifetime

- The runtime can reuse or discard isolates. Module state offers neither durable storage nor a safe place for
  request-specific user data.
- Share immutable configuration. Keep mutable request state isolated, and persist durable data through the application's
  storage contract.
- Use `ctx.waitUntil()` for work after the response. Use a Queue or Workflow for work that must finish.

## Repository

- Keep `.wrangler/` and `.dev.vars*` out of Git.
- Deploy through a task. When CI deploys, its job runs the same task.
- Write `_headers` as blocks of a path line and indented `Name: value` lines. Give the `/*` block
  `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and `X-Frame-Options: DENY` or `SAMEORIGIN`, or a
  `Content-Security-Policy` with `frame-ancestors`.
- Write each `_redirects` rule as a source that starts with `/` or `https://`, a destination, and an optional status of
  200, 301, 302, 303, 307, or 308, with no `!`.
- After you change a binding in the Wrangler file, run `wrangler types`, and commit the file that
  `cloudflare.types_file` names.

See the Cloudflare [Node process support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/) and
[binding access](https://developers.cloudflare.com/workers/runtime-apis/bindings/).
