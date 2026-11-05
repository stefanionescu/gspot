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

## Loading and failures

Put a loading boundary around the section that waits. Start independent work early without moving protected reads
before authorization.

Decide status, headers, cookies, redirects, and not-found behavior before streaming commits the response. Preserve
framework control-flow exceptions. Check direct load, client navigation, refresh, Back, and failed prefetch; those paths
may differ in state.

## Cache contracts

Check whether the project enables Cache Components before choosing APIs. Above a cached operation, state who may read
it, its key, lifetime, and invalidation path. Include identity, tenant, locale, filters, and permissions where they
affect results; session tokens stay out of keys.

Default private data to uncached until an isolation design exists. Never let a cached decision retain revoked access.
Clear private browser caches on logout. Invalidate after the write commits and before a terminating redirect; a failed
refresh must not retry it.

## Hydration and browser synchronization

Hydration attaches React behavior to the server-rendered HTML. Give the server and the first browser render matching
output. Browser storage, viewport dimensions, generated IDs, time zones, current time, and random values can make them
differ. Define when each value becomes available and how the UI updates after hydration. Fix the mismatch instead of
hiding warnings globally.

- Use deterministic initial props for server-rendered content. Read browser-only state after hydration or through a
  supported external-store pattern.
- Use stable entity identifiers for data identity and the supported React ID mechanism for relationships between
  controls and labels.
- Give date/time formatting the same initial locale, time zone, and reference time where relative output otherwise
  differs.
- Do not branch rendered markup on `typeof window` as a routine hydration fix. Server and first browser output agree on
  the visible tree.
- Theme initialization may need the documented early script of its library and a narrow hydration exception. Keep that
  exception local to the affected node.
- Do not mutate React-owned DOM to coordinate application state. Controlled state, refs, and third-party imperative APIs
  have explicit ownership boundaries.
- Treat a hydration warning as a bug until you identify its source and justify an exception. A development-only warning
  can reveal a production race.
