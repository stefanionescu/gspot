---
layer: runtime
configuration: cloudflare
title: Workers
---

# Workers

Rules that hold because the code runs on a V8 isolate runtime such as Cloudflare Workers.

## Globals and APIs

- The web platform APIs are available: `Request`, `Response`, `fetch`, `URL`, `crypto`, `caches`.
- `process` is not available, and neither are the Node built-ins unless a compatibility flag is on.
  A `node:` import without that flag fails at deploy time, not at lint time, so the rule is
  enforced here.
- Bindings arrive through the request context, not through module-level state. A module-level
  value is shared across requests in the same isolate and must not hold anything request-specific.

## Lifetime

- An isolate is reused across requests and discarded without warning. Do not keep state in a
  module-level variable that later requests read.
- Work that must outlive the response uses the runtime's deferred-work mechanism, not a floating
  promise.
