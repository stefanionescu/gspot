---
title: Next.js
---

# Next.js

Preserve the project's router, installed Next.js and React versions, runtime, and deployment
adapter. App Router guidance applies only to App Router routes.

## Server and client ownership

Keep privileged operations and credentials on the server. Send only authorized fields to the
browser. That includes query hydration and Server Component props. A hidden control, type, or filename
is not an access boundary. A client entry includes its imports in the client graph; keep it small
and compose server-rendered children into it.

Validate and authorize every mutation at its server entry. Routes, actions, and RPC procedures
share the same domain operation. Initial server reads do not HTTP-fetch the application's own
Route Handler. Rendering, GET requests, and prefetching perform no writes.

See [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).

## Loading and failures

Put a loading boundary around the section that waits. Keep useful content mounted during refresh,
and reset pending state when the selected resource changes. Start independent work early without
moving protected reads before authorization.

Decide status, headers, cookies, redirects, and not-found behavior before streaming commits the
response. Preserve framework control-flow exceptions. Check direct load, client navigation,
refresh, Back, and failed prefetch; those paths need not share the same state.

See [streaming](https://nextjs.org/docs/app/guides/streaming).

## Cache contracts

Identify whether Cache Components is enabled before choosing APIs. Above a cached operation,
state who may read it, its key, lifetime, and invalidation path. Include identity, tenant, locale,
filters, and permissions where they affect results; session tokens stay out of keys.

Default private data to uncached until an isolation design exists. Never let a cached decision
retain revoked access. Clear private browser caches on logout. Invalidate after the write commits
and before a terminating redirect; a failed refresh must not retry the committed write.
Next.js and a client query cache need separate reconciliation.

See [caching](https://nextjs.org/docs/app/getting-started/caching)
and [revalidation](https://nextjs.org/docs/app/getting-started/revalidating).
