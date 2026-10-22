# Next.js

Read this rule when you change a Next.js application.

Preserve the project's router, installed Next.js and React versions, runtime, and deployment adapter. App Router
guidance applies only to App Router routes.

## Server and client ownership

Keep privileged operations and credentials on the server. Send only authorized fields to the browser; that covers query
hydration and Server Component props too. A hidden control, type, or filename does not restrict access. A client
boundary pulls its imports into the browser bundle; keep it small and compose server-rendered children into it.

Privileged modules import `server-only`, so a Client Component import fails the build. The `env` option of `next.config`
inlines its values into the JavaScript bundle. Never put a secret there, and revoke one that shipped.

Validate and authorize every mutation at its server entry point. Routes, actions, and RPC procedures share one domain
operation. Do not HTTP-fetch the application's own Route Handler for an initial server read. Rendering, `GET` requests,
and prefetching perform no writes.

See [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).

## Loading and failures

Put a loading boundary around the section that waits. Keep useful content mounted during refresh, and reset pending
state when the user switches resources. Start independent work early without moving protected reads before
authorization.

Decide status, headers, cookies, redirects, and not-found behavior before streaming commits the response. Preserve
framework control-flow exceptions. Check direct load, client navigation, refresh, Back, and failed prefetch; those paths
may differ in state.

See [streaming](https://nextjs.org/docs/app/guides/streaming).

## Cache contracts

Check whether the project enables Cache Components before choosing APIs. Above a cached operation, state who may read
it, its key, lifetime, and invalidation path. Include identity, tenant, locale, filters, and permissions where they
affect results; session tokens stay out of keys.

Default private data to uncached until an isolation design exists. Never let a cached decision retain revoked access.
Clear private browser caches on logout. Invalidate after the write commits and before a terminating redirect; a failed
refresh must not retry it.

See [caching](https://nextjs.org/docs/app/getting-started/caching) and
[revalidation](https://nextjs.org/docs/app/getting-started/revalidating).
