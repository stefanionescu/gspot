---
title: Next.js
---

# Next.js

## Application rules

The project's declared router is preserved; App Router guidance applies to App Router routes.

### Before writing code

Check the manifest and lockfile for the installed Next.js and React versions, and identify the
router, runtime, deployment adapter, and cache model before changing rendering. Reuse the existing
components, schemas, queries, actions, design tokens, and state where they fit, and keep helpers
local until several callers need the same behavior.

### Structure and routing

The router folder holds routes and Next.js file names only. Use the project's `app/` or `pages/`
folder, optionally under `src/`. `(group)` folders organize routes without URL segments and can
still collide at one URL; `_private` folders exclude their contents from routing. Preserve framework
default exports and the bracket, parenthesis, and `@` folder names. Keep browser-safe schemas and
types apart from server implementations, with no barrel that mixes server and client runtime
exports.

Root layouts provide document elements. `error.tsx` is a Client Component that does not catch its
own segment's layout failure, and `global-error` must replace the document without the normal
providers. Use parallel and intercepted routes when navigation needs them. List direct load,
soft navigation, Back, refresh, and default slots for the user to check. Interception changes presentation,
not the URL contract.

### Reserved names

<!-- level: all -->

- Next.js reserved names are exempt from the stem checks and keep their framework spelling:
  `page`, `layout`, `loading`, `error`, `global-error`, `not-found`, `route`, `template`,
  `default`, `middleware`, `instrumentation`, `[param]`, `[...slug]`, `(group)`, `_private`,
  `@slot`.

### Ownership and layering

<!-- level: all -->

The router directory holds routing. Domain behavior, shared UI, and integrations live somewhere
deliberate, and a private underscore folder keeps non-route files inside a segment. Before adding a file, decide which route, feature, shared control, or platform integration
owns it. Move misplaced code when changing it and update its callers, and never collect unrelated
behavior in a `utils` folder.

Keep route-only code in a private `_` folder inside the segment, and domain operations with
their feature. An integration's credentials,
transport, and runtime selection stay at the integration owner, and domain code never constructs a
second client around an inconvenient API. A browser-safe input schema never imports the privileged
implementation it describes. Import the narrow module that owns a symbol, not a root barrel. When
two features need each other's internals, extract the shared operation until the cycle is gone.

A route file composes the feature. It does not hold the whole screen.

### Loading, failure, and streaming

The Suspense or query boundary wraps the section that waits, not work already awaited, with
skeletons beside their section carrying the important geometry. First load, background refresh, and
next-page loading stay distinct with usable content mounted. Retry scopes to the failed operation
with a recovery action, a translated message, and the original error in server diagnostics.
Route-level boundaries catch what escapes section recovery. Switching resources resets the section's
identity and pending state so an old request cannot populate the new selection.

Streaming reveals useful content while independent work completes, on initial load (HTML and the RSC
payload) and on client navigation (the payload alone). List both paths for the user to check. `loading.tsx`
covers the segment's page and descendants inside the layout, so an independently loading section in
a layout needs its own boundary. Move request-dependent reads into the component that needs them,
and pass `params`, `searchParams`, or a server-created promise down. Start independent work early
without moving protected reads ahead of authorization.

With Cache Components, inspect what can enter the prerendered shell: an async function is not
automatically request-specific, and `<Suspense>` does not make synchronous work dynamic. A Server
Component can pass a promise with a serializable value that a Client Component reads with `use()`
under Suspense. It is shared through a narrowly placed provider and never process-global state.
Rejected promises go to an error boundary or an explicit result value, never `use()` inside `try`.
Keep headings and likely largest-content elements early, reserve realistic space for resolved
content, and keep application code independent of payload markers and boundary IDs
([streaming](https://nextjs.org/docs/app/guides/streaming)).

Status, headers, and cookies are decided before the response commits. A redirect or not-found
decision completes before an enclosing boundary sends a fallback, because `notFound()` after an
ancestor `loading.tsx` has started the response keeps the original status. No private content is
sent while deciding. List metadata checks for browsers, DOM-capable crawlers, and HTML-limited
crawlers (`htmlLimitedBots`) for the user
([HTTP contract](https://nextjs.org/docs/app/guides/streaming#the-http-contract)).

| File or convention | Responsibility                                      | What to check                                                          |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `page`             | Public UI at a route                                | Parse route inputs; compose the feature; preserve metadata support     |
| `layout`           | Shared UI across descendant navigation              | Persistence is no substitute for fresh authorization                   |
| `template`         | A subtree that remounts with its framework identity | Use only when remount semantics are required                           |
| `loading`          | Segment-level pending UI                            | Its placement controls which content is replaced while waiting         |
| `error`            | Recoverable render failure below its boundary       | Client entry; useful reset; safe error presentation                    |
| `global-error`     | Root failure replacement                            | Supply document elements; depend on no failed provider                 |
| `not-found`        | Missing or undisclosed resource                     | Keep absence distinct from a generic crash                             |
| `route`            | HTTP endpoint using Request/Response                | No page at that segment; own method, validation, and response contract |
| `default`          | Parallel slot fallback                              | Verify refresh and direct navigation when a slot has no match          |

### Server and client boundaries

Pages and layouts stay Server Components. `'use client'` marks an interactive entry that needs
browser state, effects, or browser APIs, and every module it imports joins the client graph.
Credentials, database access, authorization, and privileged integrations live in server modules with
`import 'server-only'`. A filename, a public env prefix, a TypeScript type, or a hidden control is
not a security boundary. Only necessary React-serializable data crosses the boundary; full rows and
secrets never do. Plain callbacks cannot cross, Server Functions cross as references, and React
serializes `Date`, `Map`, and `Set` itself.

Compose server-rendered children into interactive wrappers from a Server Component rather than
importing server code into a client module, and place providers at their lowest useful common
ancestor.

A screen splits by reading data in the responsible server module and selecting the fields the user
may see and the browser needs. The behavior that needs handlers, browser APIs, or state is isolated
in a client entry with the server-rendered layout outside it. The minimum values, children, or
server references pass in.

Trace the entry's imports and list direct load, hydration, and client
navigation for the user to check. Server Functions use `'use server'` with validation and authorization, and
a client entry imports the action reference while the database module stays on the server. A
browser-only widget gets a small client wrapper, with SSR disabled only for a documented dependency,
never by making the page client-only. A singleton store is never initialized with one request's user
or locale on the server.

### Rendering and navigation

Initial data is fetched near its server owner, never through a Route Handler that HTTP-fetches the
same application. Independent reads start together, and permission-dependent work stays behind
authorization. `cookies`, `headers`, `params`, and `searchParams` are read asynchronously.
Navigation uses `next/link` and the App Router APIs, with locale-aware wrappers under locale
routing. Shareable filters, sort order, and pagination live in validated URL state, and no untrusted
URL reaches navigation or redirect.

Expected form failures are data, and redirect and not-found control flow is never swallowed in a
broad catch. Metadata, canonical URLs, social previews, robots, and sitemap follow the indexing
policy through the Metadata API, and robots rules protect no authenticated UI.

## Data access, writes, and caching

Read initial route data on the server. Route files, Route Handlers, and Server Actions call the
same authorized operations. Parallelize independent reads after authorization. Limit growing
collections with a stable sort and a capped page size, select the fields the first screen needs,
and avoid the N+1 pattern. Keep private fields out of query dehydration. No write happens during
rendering, GET requests, or prefetching.

### Cache policy

Above each cached function, write a comment: who may read it, its key, its lifetime, and what
invalidates it.

| Layer                      | Scope and responsibility                                               |
| -------------------------- | ---------------------------------------------------------------------- |
| React request memoization  | Reuse within a server render; not a durable shared cache               |
| Next data/UI cache         | Reuse across requests according to the configured model                |
| Prerendered route or shell | HTML/RSC availability and regeneration                                 |
| Router cache               | Client navigation reuse; refreshing is not universal data invalidation |
| Client query cache         | Browser server-state freshness and mutation reconciliation             |
| HTTP/CDN/service worker    | Response/storage policy outside the component tree                     |

Determine whether Cache Components is enabled before selecting APIs, and never mix recipes from the
two models. Without Cache Components, choose explicit `fetch` cache and revalidation options;
`React.cache` alone persists nothing across requests. Under Cache Components, cache only
deliberately reusable data or UI with `use cache`, assign its lifetime and tags, keep
request-dependent work behind Suspense, and read request values outside shared cached functions.

Private data stays private across every layer. Include identity, tenant, locale, filter, and
permission dimensions in the key. Default sensitive data to uncached until an isolation design
exists, keep session tokens out of keys and tags, and never let a cached decision retain revoked
access. Process memory is not shared across serverless instances. Clear private browser caches on
logout, and exercise isolation with two users, including mutations, logout, and revoked access.

Each `use cache` scope has a deliberate `cacheLife` (`stale`, `revalidate`, `expire`) and one
effective call per invocation. A duration is not a scheduled job, and a directive does not join the
static shell. A data-level cache serves a reusable read and a UI-level cache rendered output. Every
export is reviewed before file-scope `use cache`, writes stay outside, and arguments and captured
values join the identity. `connection()` marks per-request random or time-dependent output.
`use cache: remote` needs a supported handler and a measured need, and `use cache: private`
establishes no authorization
([Cache Components](https://nextjs.org/docs/app/getting-started/caching)).

| Required outcome                                              | Operation                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Serve stale content while tagged data refreshes               | `revalidateTag(tag, 'max')` in a server function or handler |
| Let the action's next read wait for its newly written data    | `updateTag(tag)` in a Server Action                         |
| Expire tagged data from a webhook where stale is unacceptable | `revalidateTag(tag, { expire: 0 })`                         |
| Invalidate a route's page or layout output                    | `revalidatePath(path, type)` with the intended scope        |

Attach `cacheTag` inside the scope that produces the result; a tag groups entries and is neither a
key nor an access check. `revalidateTag` marks entries for later reads with an explicit second
argument, `updateTag` belongs in Server Actions only, and `revalidatePath` needs the right `page` or
`layout` type and takes effect on a later visit. Invalidate shared tags when other routes depend on
the changed resource, after the commit but before any terminating redirect. An invalidation fired
before commit repopulates old values, and a failed invalidation after a committed write is reported
without retrying the write. Authenticate revalidation webhooks, derive targets from the verified
event, and reconcile the client query cache and any database cache separately
([revalidating](https://nextjs.org/docs/app/getting-started/revalidating)).

`generateStaticParams` names intended prerendered values. Prefetching stays read-only and
authorized because prefetched private data is already in the browser. Cover a cold cache and changes
to permissions, locale, query, and session in the affected tests.

The consumer picks the transport. A Server Component calls an authorized read directly, a browser
interaction uses an RPC mutation or a Server Action, and an external caller gets an HTTP contract.
All share the domain operation. A Route Handler or Server Action extracts input, validates it,
establishes context, calls the operation, and formats the response.
