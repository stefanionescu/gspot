---
layer: library
preset: tanstack-query
title: TanStack Query
---

# TanStack Query

## Query ownership

Apply this guidance wherever the application uses TanStack Query, including without tRPC.
Dehydration serializes query cache state on the server; query hydration restores that state in the
browser. Use the same keys, inputs, and serialization at both ends.

Use framework server reads for data owned entirely by Server Components. Introduce a client query `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
cache when the interaction needs its refetching, pagination, optimistic updates, or shared browser
state. Keep each resource's ownership clear across server and client rendering.

- Use a request-scoped server QueryClient and a stable browser QueryClient. Never share a server
  QueryClient between requests. Initialization must survive suspension at the provider boundary.
  Reset or partition browser caches when identity or tenant changes. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

- Prefetch useful initial queries on the server and hydrate through the selected integration. Server
  and browser use identical query keys, inputs, and serialization. Verify hydrated content does not
  immediately refetch unintentionally.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Streaming pending queries requires the integration's supported dehydration behavior, not just
  passing a promise into arbitrary JSON.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

- Set freshness by resource. Global infinite `staleTime` plus disabled refetch triggers is allowed
  only with complete explicit invalidation. Retain useful rows during background refresh;
  distinguish initial load, next page, background fetch, empty result, and failure. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

- Cursor keys include sort/filter/resource/locale where relevant. The next cursor comes from the
  server. Use the integration's infinite-query ownership and `hasNextPage`/in-flight controls where
  appropriate. Do not maintain a competing cursor in a global store without a defined reason. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

- Optimistic writes cancel or account for competing fetches, reconcile temporary IDs, handle
  rollback races, and invalidate the affected queries. Query invalidation is not a substitute for
  server authorization. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

- Do not copy query data to a client store merely to access it in another component. For streaming
  editors/chat, document which owner accepts incremental updates, when the server snapshot
  reconciles, and how reset works. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

Review server prefetch and client mount together; test query isolation, authorization denial,
pagination, and mutation reconciliation at their real boundaries. The integration's official
documentation is linked in [References](#references).

## Hydration lifecycle

Server prefetch and browser consumption form one contract. Review them together. A server query that
uses one input/default while the browser uses another creates two cache entries and may repeat work
despite apparently successful hydration.

- Keep every server QueryClient inside its request. A prefetching Server Component can own a local
  client and dehydrate it at its boundary.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Alternatively, share a request-local client through React `cache` when the integration needs
  shared prefetch state. Each boundary dehydrates the client that actually received its prefetches.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Construct a stable browser instance that survives ordinary component rerenders and the provider's
  supported suspension behavior. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Prefetch only data that materially helps the upcoming screen. Do not prefetch an entire history
  merely because a virtual list can display a small part of it. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Make query inputs identical at prefetch and use, including default filters, cursor conventions,
  identity partitions, and locale-dependent values. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Use one compatible transformer/serialization path. Verify dates, bigint, maps, and other non-JSON
  values actually used by the app round-trip as intended. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Dehydrate only queries whose values may safely reach the browser. A server-only query client can
  hold results that are not appropriate for public serialization. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Handle failed prefetch deliberately: either surface it at the server boundary or let the browser
  query's documented retry/error flow take over. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Trace the actual route from prefetch through dehydration to the consuming component. Defining a
  hydration helper alone does not prefetch or hydrate a query. Confirm that the route invokes it
  with the same request-local QueryClient. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Check direct load and subsequent navigation separately. Avoid a stale-time workaround that hides
  an incorrect key, scope, or hydration boundary. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

Choose retry and freshness settings for each resource. Retry transient read failures within a limit; `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
handle access denials and rate limits according to their cause. Use infinite freshness only when
defined code invalidates every affected query after a change. Give resources separate settings when
they have different freshness requirements.

## Define query keys and fetch contracts

For direct TanStack queries, use top-level array keys containing JSON-serializable values. Include
each input that changes the returned data: resource, filters, sorting, pagination, representation,
and relevant locale or identity partition. Use consistent input normalization across all consumers.
Object-property order does not distinguish keys, but array-element order does. Keep credentials,
functions, and provider clients out of keys.

Give different response shapes distinct keys. A list preview and an editable detail record are not `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
interchangeable cache values. Likewise, ordinary and infinite queries need separate identities. For
tRPC, use its generated factories and supported input contract instead of reconstructing their keys.
Follow
[query-key semantics](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

Keep each key beside the fetch function and shared options that define its result. Use `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
`queryOptions` or `infiniteQueryOptions` for direct queries and the corresponding tRPC factories for
procedures. Reuse those definitions for prefetching, hooks, and cache updates. A component can add a
display selector without changing the underlying cached record contract. These helpers preserve
types; they do not validate network responses at runtime. See
[query options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options).

Check unsuccessful HTTP responses before parsing them as successful data. `fetch` does not reject `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
merely because the server returned a 4xx or 5xx status. Validate the response at the appropriate
boundary and reject failed reads. A successful query result cannot be `undefined`; use the
contract's explicit empty representation, such as `null` or an empty collection. Keep failures out
of that empty representation so the user receives the correct retry or access state. See
[query functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions).

## Stream pending queries

Place HydrationBoundary around the components that consume its prefetched queries. Multiple server `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
prefetch clients and boundaries are valid. If several boundaries share a request-local QueryClient,
measure repeated serialization: each `dehydrate` call can include cached queries already sent by
another boundary. Select the relevant safe queries or use local prefetch clients when that reduces
payload size without breaking shared reads.

- Await a read when its result determines the response, access decision, or content that the current
  boundary needs before rendering. Start independent optional prefetches early without awaiting them
  only when pending-query hydration is configured. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- For supported TanStack releases, include pending queries alongside the default dehydration
  predicate: `defaultShouldDehydrateQuery(query) || query.state.status === 'pending'`. Restrict that
  set further when some cached values are private to the server. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Use `useSuspenseQuery` beneath Suspense when the consumer waits for the server-created
  promise and reveal its content through streaming. Use `useQuery` when the consumer owns its
  pending UI. A pending result consumed without suspension does not produce the same streamed
  content merely because its promise was dehydrated. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Keep a settled prefetch's fallback behavior explicit. An ordinary query can fetch in the browser
  when prefetching is absent; a suspense query can suspend during server rendering. Check the path
  with a missing or failed prefetch as well as the successful path. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Pair `dehydrate.serializeData` with `hydrate.deserializeData` for supported non-JSON values. Keep
  the cached value in its intended application shape. Do not manually serialize it in `queryFn` and
  serialize that result again at dehydration. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- When using SuperJSON for hydration, assign `superjson.serialize` and `superjson.deserialize`
  directly to the corresponding hooks. Keep the complete serialized payload, including any `meta`.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Do not use the string APIs for these object-payload hooks or add a forwarding wrapper. A tRPC
  transport transformer does not automatically configure this separate hydration boundary.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Preserve Next.js control-flow errors during server rendering. Configure `shouldRedactErrors`
  according to the installed Next.js integration; use its `false` setting only within the supported
  framework path that handles server error redaction. Keep raw internal errors out of independently
  serialized JSON and client-facing diagnostics. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Check the installed package's exports before using guide-specific APIs such as
  `environmentManager` or `queryClient.query`. Use the supported fetch/prefetch API for that
  release, with deliberate rejection handling. A suppressed promise rejection does not prove that
  required data loaded or that the route can safely continue. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

Prefer explicit prefetching for routes where nested queries otherwise wait on one another. If `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
using `@tanstack/react-query-next-experimental`, configure ReactQueryStreamedHydration within the
provider and check both direct visits and client navigation. Removing explicit prefetching can
restore code-and-data waterfalls on later navigation. Follow the
[advanced server-rendering guide](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).

## Recover queries through error boundaries

Pair a suspense query's loading boundary with an error boundary that has a working retry path.
Connect the error boundary's reset handler to `QueryErrorResetBoundary` or
`useQueryErrorResetBoundary`, scoped to the affected subtree. Reset the query error state before
retrying the failed render; resetting the visible error UI alone can immediately reproduce the same
failure. Keep this reset wiring explicit when using a Next.js route error boundary.

For suspense queries, an initial failure without cached data reaches the error boundary. A failed
background refetch can leave stale data available instead. Decide whether that view can continue
with a refresh error or needs to throw the error after fetching stops. Use the installed hook's
supported behavior rather than assuming `throwOnError` is configurable on every suspense hook.

Suspense hooks do not offer ordinary-query `enabled` and `placeholderData` behavior. Render the
consumer when required inputs exist. For an update that retains revealed content, use a
transition around the query-key change where appropriate. Follow
[Suspense and error reset](https://tanstack.com/query/latest/docs/framework/react/guides/suspense).

## Set query freshness and retention

Choose freshness from how long the user can safely see an old value. Choose retention from how much `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
inactive data the app can afford to keep. These settings solve different problems:

| Setting                                                        | Behavior and choice                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staleTime`                                                    | How long a result stays fresh; expiry makes it eligible for refetch triggers, without starting a polling timer                                    |
| `staleTime: Infinity`                                          | Fresh until explicitly invalidated; provide a complete mutation and external-change invalidation path                                             |
| `staleTime: 'static'`                                          | For a supporting release, prevents invalidation-driven and automatic staleness-based refetches; use only for values fixed for that cache lifetime |
| `gcTime`                                                       | How long unused query data remains before garbage collection; does not set freshness or limit an active history                                   |
| `refetchOnMount`, `refetchOnWindowFocus`, `refetchOnReconnect` | Events that can refresh stale data; tune them for the resource instead of disabling them globally to hide duplicate requests                      |
| `refetchInterval`                                              | Independent polling schedule; bound its cost and stop it when the interaction stops needing polling                                               |

Do not classify revocable permissions or changing account state as static reference data. Browser `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
cache freshness never replaces server authorization. Invalidate or replace the relevant identity's
state when its contract changes.

For ordinary queries, `invalidateQueries` marks matching entries stale and normally refetches active
matches. It does not synchronously replace their values or refresh every inactive match. Use the
supported `refetchType` when a different active/inactive policy is needed. Disabled and static
queries need their own documented refresh path. Keep cached data visible during a background refresh
when it remains safe and useful.

Use generated tRPC filters or shared query-key factories to identify affected records, lists, and `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
aggregates. Choose prefix matching for a family and `exact: true` for one key. Add predicates only
when key and activity filters cannot express the target. Invalidation, cancellation, and removal
have different jobs: invalidation requests freshness, cancellation stops an in-flight read, and
removal discards an entry. Use the operation that matches the intended state transition.

Retain structural sharing for JSON-compatible results so unchanged parts keep their references. A
transformer that restores `Date`, `Map`, or `Set` does not make those objects JSON-compatible for
structural sharing. Profile expensive comparisons or repeated updates, then choose a compatible
plain-data contract or a resource-specific sharing function. Keep cache writes immutable.

Consult
[query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults),
[invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation),
and [filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters) for the
installed release.

## Schedule independent queries

Start independent reads together. Several ordinary query hooks can run side by side. Several
`useSuspenseQuery` calls in one component can instead serialize: the first suspension prevents later
hooks from starting. Use `useSuspenseQueries` or independently rendered consumers when the reads
have no dependency.

For a variable number of reads, use `useQueries` or the corresponding suspense API with an array of
options. Keep hooks out of loops and changing conditional branches. Build options through typed
`queryOptions` helpers or the tRPC factories so keys, inputs, fetch functions, and selections remain
consistent. Bound the number of queries; hundreds of parallel requests still create excessive work.

A dependent query waits for the identifier or value it actually needs. Do not invent placeholder
identifiers to trigger it sooner. On the server, avoid awaiting a parent prefetch before rendering a
child whose independent prefetch may already have started. Check request timing during client
navigation as well as direct load. See
[parallel queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries).

Use an API request or tRPC query for browser reads. Keep Server Actions out of `queryFn`; their `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
client invocation model is designed for actions and can serialize reads that Query expects to run
independently. Server Actions can remain mutation entry points. A query function returns its data or
rejects with an error; it does not silently resolve after catching a failed read. Represent an
intentional empty result in the response contract.

Distinguish data status from fetch status. A query without data can be pending while disabled or
paused, with no request running. Use fetching state for network activity and the initial-loading
state for an active first fetch. Keep existing data visible when a background fetch fails, with a
separate refresh error when the task needs it.

## Handle offline query work

Choose `networkMode` from the operation's real connectivity needs:

| Mode           | Appropriate behavior                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `online`       | Network-dependent queries and mutations pause when connectivity is unavailable                                      |
| `always`       | Work that can run without a network, such as local storage reads; retries also run without waiting for connectivity |
| `offlineFirst` | Try once against a service worker or HTTP cache, then pause retries if network access is needed                     |

Show paused work as waiting for connectivity, with retained content where available. Paused retries
can continue after reconnect even when `refetchOnReconnect` is disabled; continuation is separate
from starting a new background refetch. Keep identity and resource ownership valid when work
resumes.

A network mode does not provide durable offline storage. Use the persistence rules when queued work
needs to survive reload. Verify actual disconnected requests as well as the query manager's
simulated offline state. See
[network modes](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).

## Use initial and placeholder data

Use `initialData` for a complete valid value that can populate the query cache. Preserve its actual `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
freshness through `initialDataUpdatedAt` when the value came from an earlier fetch. Prefer hydration
when server prefetching already supplies query state and timestamps.

Use `placeholderData` for temporary display while the real query loads. It is observer display data, `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
not a replacement cached result. A placeholder can make the result report success, so inspect
`isPlaceholderData` before treating it as the requested record or page. Keep partial previews within
their honest display contract; do not cast a preview into a complete editable record.

For page-by-page navigation, use `placeholderData: keepPreviousData` or the supported equivalent to
retain useful rows while the next page loads. Disable forward paging until the new page establishes
whether another page exists. Mark the displayed rows as belonging to the previous result where that
matters to the task. Keep placeholders within the same authorized resource scope; clear them when
identity or tenant changes.

For infinite queries, initial and placeholder values preserve both `pages` and `pageParams`. Follow
[placeholder data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data)
and
[paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries).

## Select query data for each consumer

Use `select` when a component needs a subset or derived value from a cached result. This narrows the `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
consumer's subscription without creating a duplicate store or changing the shared cached value. Keep
selectors pure. Validate fetched data in `queryFn` or its response parser; returning an Error object
from `select` does not turn the fetch into a failed query.

Use a stable selector reference when a costly transformation otherwise reruns on every render. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
Extract a dependency-free selector, or use a callback with its actual dependencies. Keep simple
selectors readable and optimize from measured work.

Read the result properties the component needs. Object rest destructuring reads the remaining `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
properties and defeats tracked-property optimization. The complete hook result object is not referentially stable. Depend on the specific data, status, or
function a callback needs, not on that result object in an effect dependency list. Keep automatic property tracking unless a
measured requirement justifies explicit `notifyOnChangeProps` configuration. See
[render optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations).

## Update query caches after mutations

Choose the smallest state change that makes the operation visible in all required places:

| Need                                                          | Approach                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| One view needs a pending row or edit                          | Render mutation variables beside confirmed query data    |
| Several consumers need the same pending change                | Apply an optimistic cache update with a defined rollback |
| The response contains the complete authoritative record       | Write it to the exact query key with `setQueryData`      |
| Lists, counts, or filters may have changed beyond that record | Invalidate the affected query families                   |

For UI-only optimism, retain submitted variables for failure recovery. Use `useMutationState` with
an operation's mutation key when another component needs pending submissions. Handle its array of
matches because several writes can be active. Assign stable per-submission identity so pending rows
remain distinct and reconcile with persisted IDs.

For cache optimism, cancel conflicting reads, snapshot the relevant state, and return rollback
information from `onMutate`. On failure, reverse only that operation's change. Restoring an entire
old snapshot can erase a newer successful mutation. Use operation-specific patches, versions, or
serialized writes when changes overlap. After settlement, reconcile with server state through the
relevant update or invalidation. See
[optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).

Use mutation variables to identify the record being updated, rather than the current selection when `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
the response arrives. Write authoritative responses immutably. Copy changed objects, arrays, and
maps; never mutate a value obtained from `getQueryData` in place. Keep exact-record updates separate
from list membership, ordering, and aggregate changes that still require reconciliation. See
[mutation responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses).

Place required cache updates in the shared mutation options or another operation owner that handles `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
every completion. Per-call `mutate` callbacks can be skipped after unmount, and consecutive calls
replace the observer for those callbacks. Reserve them for optional view-specific behavior. Use
`mutateAsync` when the caller needs an awaitable success or failure, and handle its rejection.
`mutation.reset()` resets observed mutation state; it does not undo a committed write.

Expect mutations to finish out of submission order. Use a resource-specific `scope.id` when
supported and when those writes need a client-side queue. Keep independent resources concurrent. The
queue does not coordinate other browsers or replace server transactions and version checks.

Paused work is handled distinctly from active network work. Mutations have a separate retry policy from
queries; enable mutation retries only for an idempotent operation. See
[mutation lifecycles](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).

Return or await required invalidation promises so the mutation's pending state covers the intended `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
refresh. A resolved invalidation promise alone is not proof that every refetch succeeded. When fresh
data is required, use the installed API's error propagation option or inspect query error state.
Keep a committed write successful even if its later refresh fails, and retry the refresh separately.
Check the
[QueryClient API](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient)
for refetch filters and failure propagation.

## Keep infinite query pages consistent

Treat one infinite query as one cache entry containing aligned `pages` and `pageParams` arrays. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
Preserve that structure in initial values, placeholder values, `select`, and every manual update.
When reversing or trimming pages, perform the corresponding operation on page parameters. Use
immutable transformations, and keep stable record IDs for rendered rows.

- Supply `initialPageParam` when using TanStack's direct infinite-query API. For tRPC factories,
  configure the installed integration's initial-cursor option and let it form the query options. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Derive continuation from the server contract. Return `null` or `undefined` from page-parameter
  callbacks when that direction is exhausted. A valid cursor of `0` is not an exhausted page. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Guard automatic loading with availability and `!isFetching`, not only `!isFetchingNextPage`.
  Background refetches share the same cache entry and can conflict with a next-page request. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Treat `cancelRefetch` as coordination of repeated fetch calls. With `false`, a call during an
  existing fetch does not start another independent fetch. With the default `true`, repeated calls
  can replace in-flight work. Do not use either setting as a parallel-page-fetch switch. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Use `maxPages` when long sessions can retain excessive history or make refreshes expensive.
  Refetching an infinite query rebuilds retained pages sequentially from its first retained page.
  Bound both the retained data and the work needed to refresh it. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Configure previous-page fetching when the user needs to return to pages evicted from the start.
  Keep the virtualizer's stable visible anchor when the retained window changes. Evicting data and
  unmounting DOM rows are separate operations. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- When removing a cache entry, expect pagination to restart from its initial page. Do not keep a
  global cursor pointing beyond pages that the query does not hold. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

Check background refresh during a scroll-triggered load, page eviction followed by reverse loading, `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
and duplicate records after a concurrent write. Consult
[infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
and the
[infinite-query API](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useInfiniteQuery).

## Persist query state deliberately

Add persistent query storage only for a defined offline or restoration need. Keep storage `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
serialization separate from RSC streaming: a promise that React can stream is not suitable for
browser storage. Configure the persister to include successful queries with the supported default
dehydration predicate, even when the server hydration path also includes pending queries.

Select which data may survive a reload. Partition or clear stored private data and paused mutations `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
on identity changes. Version the stored contract and bound its age. Coordinate persistence lifetime
with `gcTime` so intended offline data is not discarded immediately after restoration. Restore state
before rendering dependent consumers or resuming queued work.

If mutations can resume after reload, register their default mutation functions by mutation key
before calling `resumePausedMutations`. Storage preserves state, not executable functions. Resume
only after restoration and identity verification, and retain the operation's idempotency key.
Discard or explicitly resolve work that belongs to an earlier identity. Follow
[query persistence](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
and the mutation lifecycle rules above.

## Reconcile paginated and streamed state

Let an infinite query own fetched pages when the interaction is ordinary cursor pagination. Derive `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
visible rows, loading states, and `hasNextPage` from that owner. Keep scroll anchors and transient
selection separate from server data. A virtualized list does not need its own duplicate page cache.

- Use the complete cursor returned by the server, including tie-breaker IDs. Do not reconstruct it
  from the last row's timestamp or rank alone. Send the same filters and ordering with subsequent
  pages, and reset the page sequence when that scope changes. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Derive the next page from the response contract. An empty final page still updates exhaustion
  state. Guard duplicate next-page requests using the query's in-flight state, and merge by stable
  record identity when concurrent updates can overlap page boundaries. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Derive ordinary status from the query instead of copying success, loading, and error flags into
  effects. Delayed indicators need cleanup. Asynchronous handlers need current inputs or an explicit
  captured operation scope; stale closures can request pages for the wrong resource. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- When streamed content needs a separate store, define the transition between server snapshots,
  incremental local updates, and persisted records. Reconcile later refetches as well as the first
  successful result. A permanent `dataProcessed` flag can leave later snapshots unapplied. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Capture the resource ID when a save starts. Keep that ID with the operation through its success or
  failure, even if the user switches conversations or tenants while it runs. Apply results to that
  resource rather than whichever resource is selected when the promise resolves. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Reconcile the mutation's returned canonical IDs, timestamps, positions, and versions. Replace or
  merge temporary records without creating duplicates or discarding newer local changes. A
  successful database write does not update local state merely because `mutateAsync` resolved. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Preserve required invalidation and reconciliation when adding per-call callbacks. Await the
  relevant invalidation work when the UI promises fresh data before ending its pending state.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- If a refresh fails after a committed write, retain the write's success and offer a refresh retry;
  repeating the mutation can duplicate it.
  `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Propagate save failures through a rejected promise or an explicit result that every caller
  handles. An error callback followed by an ordinary successful return can make a failed save look
  complete. Retain recoverable draft content and distinguish retrying persistence from starting a
  new operation. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
- Cancel or detach old in-flight work and clear or partition private query and store state when
  identity changes. Verify that a late response from the previous identity cannot refill the new
  session's visible state. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

Review these flows with duplicate sort values, an empty last page, navigation during a pending save,
a failed write, and a successful write followed by failed refresh. Check that direct load and client
navigation produce the same authorized records and that dates or maps preserve the application's
chosen serialization contract.

## Cancel queries

For ordinary TanStack queries, forward the query-function context's `signal` to fetch and any
cancellable child requests. Leaving a component does not guarantee that its unused request stops;
without signal consumption, the result can still populate the cache. Manual cancellation normally
restores the state from before that fetch, which differs from removing cached data.

Check the installed hook's cancellation limits. TanStack documents cancellation as unsupported for `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`
`useSuspenseQuery`, `useSuspenseQueries`, and `useSuspenseInfiniteQuery`. When stopping a read is
required by the interaction, choose a supported cancellable path. Keep operation identity checks for
late completions even when cancellation is attempted. See
[query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).

## References

Use documentation matching the installed release and enabled features. `enforced-by: typescript/eslint @tanstack/query/exhaustive-deps`

| Topic                           | Primary source                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Mutation completion and refresh | [TanStack mutation invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) |
