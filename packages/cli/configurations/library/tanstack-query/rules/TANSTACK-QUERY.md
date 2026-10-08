---
title: TanStack Query
---

# TanStack Query

## Ownership and hydration

Give each resource one data owner. The browser QueryClient is one stable instance that survives
rerenders and the provider's suspension. Reset or partition it when identity or tenant changes.

In a server-rendered app, create a server QueryClient per request. In a Next.js App Router project,
read data owned entirely by Server Components on the server. Introduce a browser query cache when
the interaction needs refetching, pagination, optimistic updates, or shared client state. A request's
prefetching Server Components can share the client through React `cache`.

Server prefetch and browser consumption are one contract, reviewed together. Prefetch only what
materially helps the upcoming screen. Inputs are identical at prefetch and use: default filters,
cursor conventions, identity partitions, and locale. One serialization path round-trips the dates,
bigints, and maps the app uses. Dehydrate only values that may reach the browser, because a
server-only client can hold private results. A failed prefetch surfaces at the server boundary or
falls through to the browser query's retry and error flow.

Keep prefetch, dehydration, and consumption connected through the same keys and scope. Never hide
a wrong key or boundary behind a stale-time workaround. Query data stays in its query cache rather
than being copied to a client store to reach another component.

## Keys and fetch contracts

A direct query key is a top-level array of JSON-serializable values holding every input that changes
the result. That means resource, filters, sorting, pagination, representation, locale, and identity
partition, normalized the same way by every consumer. Array order matters, object property order
does not, and credentials, functions, and provider clients stay out. Different response shapes get
distinct keys: a list preview is not a detail record, and an ordinary and an infinite query are
separate identities. When the project uses tRPC, take its keys from the installed integration's
generated factories rather than rebuilding them by hand.

Each key lives beside its fetch function in `queryOptions` or `infiniteQueryOptions`. When the
project uses tRPC, use its generated factory. Reuse the definition for prefetching, hooks, and cache
updates.

A component adds a
display selector without changing the cached contract. These helpers keep types and validate nothing
at runtime, so `fetch` responses are checked for failed status before parsing. A successful result
is never `undefined` but the contract's empty representation, and failures stay out of that
representation. See
[query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys),
[query options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options), and
[query functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions).

## Streaming pending queries

In a React server-rendered app, a `HydrationBoundary` wraps the components that consume its
prefetched queries. Several prefetch clients and boundaries are valid. A read whose result decides the response, access, or content is awaited. An
independent optional prefetch starts early without awaiting only when pending-query hydration is
configured. The dehydration predicate is then extended by `query.state.status === 'pending'` and
narrowed again for server-private values.

`useSuspenseQuery` under Suspense streams the server-created promise; `useQuery` owns its pending
UI, and a pending result consumed without suspension does not stream. The fallback with a missing or
failed prefetch is checked as well as the success path.

`dehydrate.serializeData` pairs with `hydrate.deserializeData` for non-JSON values, with the cached
value kept in its application shape rather than serialized twice. SuperJSON's `serialize` and
`deserialize` are assigned directly, keeping the whole payload including `meta`. No string API and
no forwarding wrapper is involved. When the project uses tRPC, its transport transformer does not
configure this boundary. In a Next.js App Router project, preserve Next.js control-flow errors
through server rendering. Configure `shouldRedactErrors` through the installed integration while
keeping raw internal errors out of serialized JSON.

Explicit prefetching serves where nested queries otherwise wait on one another. See
[advanced server rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).

## Error boundaries and suspense

A suspense query's loading boundary pairs with an error boundary whose reset is wired to
`QueryErrorResetBoundary` or `useQueryErrorResetBoundary` for that subtree. The query error then
resets before the failed render retries; resetting the visible UI alone reproduces the failure. An
initial failure without cached data reaches the boundary, while a failed background refetch can keep
stale data. The view decides whether to continue with a refresh error or throw once fetching stops,
using the installed hook's supported behavior.

Suspense hooks lack `enabled` and `placeholderData`, so the consumer renders when its inputs exist.
A key change that keeps revealed content runs in a transition
([suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)).

## Freshness, retention, and invalidation

Freshness comes from how long the user can safely see an old value; retention from how much inactive
data the app can keep. `staleTime` makes a result eligible for refetch triggers without polling.
`Infinity` means fresh until explicit invalidation, allowed only with a complete mutation and
external-change invalidation path. `'static'` also blocks invalidation-driven refetches and fits
only values fixed for the cache lifetime. `gcTime` bounds unused data, not freshness.

The mount, focus, and reconnect triggers are tuned per resource, never disabled globally to hide
duplicate requests. `refetchInterval` is a bounded polling schedule, stopped once the interaction
stops needing it. Revocable permissions and account state are never static reference data, and
identity state is invalidated or replaced when its contract changes. Retry covers transient read
failures within a limit; access denials and rate limits are handled by cause.

`invalidateQueries` marks matches stale and refetches active ones. It does not replace values
synchronously or refresh inactive matches, so `refetchType` sets a different policy and disabled or
static queries have their own documented refresh. Affected records, lists, and aggregates are found
through shared key factories or, when the project uses tRPC, its generated filters. Prefix matching serves a family,
`exact: true` one key, and predicates only what filters cannot express. Invalidation requests
freshness, cancellation stops an in-flight read, and removal discards an entry.

Structural sharing stays on for JSON-compatible results. A transformer that restores `Date`, `Map`,
or `Set` needs a plain-data contract or a resource-specific sharing function. Cache writes are immutable. See
[invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) and
[filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters).

## Scheduling, network mode, and placeholders

Independent reads start together. Ordinary hooks run side by side, but several `useSuspenseQuery`
calls in one component serialize, so independent reads use `useSuspenseQueries` or separate
consumers. A variable number of reads uses `useQueries` with typed options and a bound on count. A
dependent query waits for the value it needs rather than a placeholder identifier, and a child's
independent prefetch is not blocked behind its parent.

Browser reads go through an API request. When the project uses tRPC, a query can supply that read.
In a Next.js App Router project, keep Server Actions as mutation entry points rather than calling
one from `queryFn`.

A query function returns data or rejects, and never resolves
after swallowing a failure. Data status is distinct from fetch status: a disabled or paused query is
pending with no request running. Existing data stays visible when a background fetch fails, and a
separate refresh error appears when the task needs it. See
[parallel queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries).

`networkMode` follows real connectivity needs: `online` pauses network work offline, `always` suits
work such as local storage reads, and `offlineFirst` tries a service worker or HTTP cache once.
Paused work shows as waiting with retained content, paused retries continue after reconnect
independently of `refetchOnReconnect`, and a network mode is not durable storage
([network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)).

`initialData` is a complete valid cache value with its real freshness in `initialDataUpdatedAt`, and
hydration is preferred when the server supplies state. `placeholderData` is observer display data
that can report success, so `isPlaceholderData` is checked before treating it as the requested
record, and a preview is never cast into an editable record. Page navigation uses
`placeholderData: keepPreviousData` and disables forward paging until the new page settles.
Placeholders clear when identity or tenant changes, and infinite queries keep both `pages` and
`pageParams` in initial and placeholder values. See
[placeholder data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data).

`select` narrows a consumer's subscription to a subset or derived value without a duplicate store.
Selectors are pure and stable when the transformation is costly. They never validate, because an
`Error` returned from `select` is not a failed query. Callbacks depend on the specific data, status,
or function they use, not the hook result object, and automatic property tracking stays unless a
measured need justifies `notifyOnChangeProps`.

## Mutations and cache updates

Render mutation variables beside confirmed data when one view needs the pending change. Use an
optimistic cache update when several consumers need it. A complete response record goes through
`setQueryData` on its exact key. Invalidate affected list, count, and filter families when their
membership may have changed.

UI-only optimism keeps submitted variables for recovery, reads pending submissions through
`useMutationState` by mutation key, and gives each submission a stable identity reconciled with
persisted IDs. Cache optimism cancels conflicting reads, snapshots, and returns rollback information
from `onMutate`. On failure it reverses only that operation's change, because restoring a whole
snapshot can erase a newer success. Overlapping changes use patches, versions, or serialized writes,
and settlement reconciles with the server. The record under update is identified by mutation
variables, not the selection at response time, and responses are written immutably.

Required cache updates live in shared mutation options or another owner that sees every completion.
Per-call `mutate` callbacks can be skipped after unmount or replaced by the next call, so they hold
only optional view behavior. `mutateAsync` serves a caller that needs the result and handles the
rejection; `mutation.reset()` clears read state and undoes no write. Mutations finish out of order,
so a resource-specific `scope.id` queues writes that need it, while independent resources stay
concurrent; the queue coordinates neither other browsers nor server transactions.

Mutation retries are enabled only for idempotent operations. Required invalidation promises are
returned or awaited so pending state covers the refresh; a resolved promise is not proof every
refetch succeeded. A committed write stays successful when its refresh fails. See
[optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates),
[mutation responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses),
[mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations), and
[invalidation from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations).

## Infinite queries and pagination

An infinite query is one cache entry with aligned `pages` and `pageParams`. Initial values,
placeholders, `select`, and every manual update preserve both through immutable transformations with
stable row IDs. Supply `initialPageParam` for the direct API. When the project uses tRPC, use its
integration's initial-cursor option.

Continuation comes from the server contract, with `null` or
`undefined` for exhaustion; a cursor of `0` is not exhausted. Automatic loading is guarded by
availability and `!isFetching`, because background refetches share the entry. `cancelRefetch`
coordinates repeated fetch calls and is not a parallel-page switch.

`maxPages` bounds retained history and the sequential refresh that rebuilds it. Previous-page
fetching is configured when users return to evicted pages. Removing the entry restarts pagination, so no global cursor points past held pages.

The infinite query owns fetched pages. Visible rows, loading state, and `hasNextPage` derive from
it, while scroll anchors and transient selection stay apart, and a virtualized list keeps no
duplicate page cache. The server's complete cursor, including tie-breakers, travels with the same
filters and ordering, and the sequence resets when scope changes. An empty final page still updates
exhaustion, duplicate next-page requests are guarded by in-flight state, and concurrent updates
merge by record identity.

Status derives from the query rather than flags copied into effects. Asynchronous handlers capture
their inputs so a stale closure cannot page the wrong resource.

A save captures its resource ID at start and applies its result to that resource, whatever is
selected when it resolves. It reconciles returned IDs, timestamps, positions, and versions without
duplicates. Propagate failure through a rejected promise or explicit result. Identity changes cancel or detach in-flight work and partition private state, so a late
response cannot refill the new session. Review duplicate sort values, an empty last page, navigation
during a pending save, a failed write, and a write followed by a failed refresh. See
[infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries).

## Persistence and cancellation

Persistent storage exists only for a defined offline or restoration need, with the persister including successful queries through the default predicate. Stored
private data and paused mutations are partitioned or cleared on identity change. The stored contract
is versioned and age-bounded, persistence lifetime is coordinated with `gcTime`, and state is
restored before dependent consumers render.

Resumable mutations register default mutation functions by key before `resumePausedMutations`,
resume only after restoration and identity verification, and discard work from an earlier identity.
See
[persistence](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).

The query-function `signal` is forwarded to `fetch` and every cancellable child request; without it,
an unmounted component's request still fills the cache. Manual cancellation restores the pre-fetch
state, which differs from removal. Cancellation is unsupported for the suspense hooks, so an
interaction that must stop a read takes a cancellable path, and operation identity is checked on
late completion either way. See
[cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
