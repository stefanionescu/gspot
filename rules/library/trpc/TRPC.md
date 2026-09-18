---
layer: library
preset: trpc
title: tRPC
---

# tRPC

## tRPC and TanStack query

- Use `@trpc/tanstack-react-query`. When replacing a classic integration, update providers,
  consumers, query keys, and hydration together and remove the classic client in the same change.
  Do not maintain both integrations or add a compatibility wrapper.

- Separate context/procedure initialization, root router composition, server caller/hydration,
  browser provider, and domain routers. Domain routers live with their features. The root router
  composes, and the HTTP adapter delegates. No giant router containing all database and UI logic.

- Create context per request. Resolve identity from a verified server session, never a
  browser-supplied user ID. Public, authenticated, and privileged procedures have explicit access
  contracts. Authentication middleware does not replace resource/tenant authorization.

- Keep context creation read-only when used during RSC rendering. Account creation, anonymous
  sign-in, cookie writes, or durable initialization belong in an authorized mutation/action/handler
  that can perform them. Do not sign in silently during route data reads.

- Validate procedure input, clamp pagination limits, and select output fields. Infer client
  input/output types from the router with type-only imports. Privileged router implementations
  remain server-only. Forward safe error codes and field validation data; restrict stacks and
  provider messages to server telemetry.

- Configure compatible transforms at both ends when values exceed JSON, including Date/Map when
  used. Do not apply two mismatched serialization layers or assume SuperJSON makes functions or
  secrets suitable client props.

## Organize feature server code

Keep a feature's server implementation beside the feature, wherever the project keeps features.
Separate transport, reads, writes, validation, and transformation when
those responsibilities exist. The module names let a reader find the owner of an operation
without inspecting a giant router.

| Owner              | Responsibility                                                                             | Keep out of it                                                   |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Procedures         | tRPC input/context, procedure access policy, calling the operation owner, transport errors | JSX, client stores, unrelated database operations                |
| Queries            | Bounded reads with explicit filters, ordering, and selected fields                         | Side effects, account creation, rendering                        |
| Mutations          | Authorized writes, transactions, idempotency, persistence invariants                       | Browser effects, form state, duplicate transport responses       |
| Validators         | Runtime schemas and contract-specific validation                                           | Provider initialization, hidden writes, client-only dependencies |
| Transformers       | Convert validated records into explicit domain/DTO shapes                                  | Database requests, global state, rendering side effects          |
| Router composition | Assemble the feature procedures into the application router                                | Reimplementing the feature's queries or write logic              |

- Pass the request-scoped database/provider client or verified context through the operation
  boundary. Do not create another client in each query helper.
- Make the data operation's access contract explicit. A query is either responsible for
  authorization or accepts a context whose authorization has already been established by its owning
  operation. Alternate callers must not bypass that contract by importing a lower-level query
  directly.
- Keep read and write paths distinguishable. A function named as a query never initializes a
  session or silently create data while being prefetched.
- Select the fields the operation needs. Keep pagination limits and tie-breaking order in the query
  rather than hoping the browser truncates an unbounded result.
- Transform responses once at the boundary that owns their shape. Do not repeat database-to-domain
  mapping in several components, procedures, and store effects.
- Keep pure transformers and browser-used validation schemas in a browser-safe contract module when
  needed by both sides. A shared input schema does not belong behind a server-only runtime import
  just because a procedure uses it.
- Keep functions together until a real responsibility merits another file. These names describe
  owners. Group related operations into cohesive modules within the feature.
- Refactor procedures that own SQL, authorization, transformation, paging, and transport formatting
  into the corresponding owners. Do not duplicate a query to avoid fixing the shared operation's
  contract.

The root tRPC router is an intentional composition point that imports feature procedures. The
browser imports its inferred router type, not its runtime implementation. Shared UI and general
utilities must not import feature procedures.

## Request context and protected procedures

Create request context by reading the verified identity, request-scoped clients, and metadata that
procedures need. Put account creation, message sending, paid provider jobs, and cookie changes in
explicit mutations or actions. Context creation can run during prefetching or repeat during
rendering, so it must remain read-only.

A protected procedure proves that a caller has an identity. A resource procedure must additionally
prove that this identity may read or change the named resource. Keep tenant/resource checks close
enough to the data access that an alternate caller cannot bypass them. Validate the caller's
selected tenant against the verified session rather than accepting a tenant header as authority.

Use consistent error categories. Return safe field information for validation failures. For access
denials, hide resource existence when revealing it exposes private information. Keep the cause
of an internal failure in server diagnostics. Send stable error codes for the UI to translate, and
keep database diagnostics and raw exception text on the server.

An HTTP request creates one context, including when it contains a batch of procedures. Keep shared
identity and request metadata stable throughout that batch. Add a procedure's authorized resource
through `opts.next({ ctx: ... })`; do not mutate shared context with the last selected tenant or
resource. A batch shares context, but its operations still need their own authorization checks.

When HTTP and direct server callers share procedures, separate request-independent dependencies from
request-derived identity only where this makes their contracts clearer. Infer the common context
type from the factory that actually supplies those common fields. Represent transport-only fields as
optional in a compatible extended type, or expose them through a separate procedure that checks
their presence. A direct caller does not acquire an HTTP request merely through a type cast.

Pass verified identity to direct server callers explicitly. Request-local React `cache` can reuse
context during one Server Component render; a process-wide session variable cannot. After an
explicit sign-in or anonymous-account mutation, use the identity returned by the successful auth
operation or verify it again. An earlier lookup that returned no user remains empty. Refresh the
request and browser state that depended on the previous identity before reading private data.

## Configure the TanStack-native client

Create the browser integration with `createTRPCContext<AppRouter>()` from
`@trpc/tanstack-react-query`. Import `AppRouter` as a type. The returned `TRPCProvider`, `useTRPC`,
and `useTRPCClient` belong to this integration; keep them separate from the server's request-context
factory. Import query and mutation hooks from `@tanstack/react-query`.

Reuse the application's QueryClient and QueryClientProvider. Pass that same client to TRPCProvider,
alongside a stable tRPC transport client. Two independent query clients split cache updates
from the components that need them. Keep browser singleton initialization out of server request
state, and ensure initial suspension cannot discard the active browser cache.

Use the generated interfaces for each operation:

| Task                                              | Interface                                                |
| ------------------------------------------------- | -------------------------------------------------------- |
| Read with `useQuery` or `useSuspenseQuery`        | `trpc.feature.read.queryOptions(input)`                  |
| Write with `useMutation`                          | `trpc.feature.write.mutationOptions()`                   |
| Identify writes for mutation defaults or activity | `trpc.feature.write.mutationKey()`                       |
| Read cursor pages with `useInfiniteQuery`         | `trpc.feature.list.infiniteQueryOptions(input, options)` |
| Address a regular query's cached value            | `trpc.feature.read.queryKey(input)`                      |
| Address an infinite query's cached pages          | `trpc.feature.list.infiniteQueryKey(input)`              |
| Invalidate matching query entries                 | Generated `queryFilter` or `infiniteQueryFilter`         |
| Invalidate a feature's query entries              | Generated `pathFilter` at that router path               |

Keep keys generated from the same integration and input contract as their consumers. A regular query
value and an infinite query's pages have different shapes. Use the matching key factory when
reading, updating, or cancelling either cache entry. Configure distinct supported key prefixes when
multiple API roots share a QueryClient and otherwise produce the same keys.

For conditional reads, use the hook's supported disabling mechanism. Use `skipToken` with supported
ordinary queries; for a suspense query that needs a missing identifier, render its consumer only
once the identifier exists. A non-null assertion does not make an absent input valid.

Use `enabled` for a query that becomes ready when its inputs exist. Disabled queries opt out of
normal automatic refetching; invalidation is not a substitute for enabling the consumer. A skipped
query has no active query function, so `refetch()` cannot run it while `skipToken` applies. For a
manual trigger, provide a valid function, and supported enablement policy. Put changed search inputs
in query state and its key; `refetch` does not accept replacement query variables. See
[disabling and lazy queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries).

Keep `getNextPageParam` consistent with the server's `nextCursor` and exhaustion value. Define the
initial cursor through the installed integration's supported option. Use a generated `mutationKey`
for operation defaults or activity tracking; it does not identify a query result to invalidate.
Client link context is transport metadata, not the server's verified request context. Values that
change query results belong in the cache input or its explicit partition. See the
[native integration interfaces](https://trpc.io/docs/client/tanstack-react-query/usage).

## Compose procedures and validators

Initialize the application's tRPC root once. Configure context, metadata, transformers, and error
formatting there. Export router helpers and named base procedures so feature modules use the same
contracts. Keep the runtime root router available to server adapters and callers; expose its
inferred type to browser code.

- Derive authenticated and privileged procedures from the relevant base procedure. Narrow verified
  context through middleware instead of asserting that a nullable user exists. Use `UNAUTHORIZED`
  for missing authentication and `FORBIDDEN` for an authenticated caller without permission, subject
  to the resource-existence policy.
- Put input parsing before middleware that reads that input. Validate identifiers, allowed values,
  string lengths, page sizes, and operation-specific constraints at the procedure boundary. A
  browser form validator improves feedback but does not replace server validation.
- Compose object input schemas only when their fields have a clear owner. Chained `.input()` parsers
  merge object results, and later values can overwrite earlier properties.

- Keep authorization identifiers consistent across parsing and access checks. Do not redefine a
  checked tenant field with a later transformation that changes which tenant the resolver receives.

- Keep queries free of durable side effects. Use mutations for writes, and enforce transactions and
  idempotency in the shared operation when a retry or repeated submission can duplicate work.
- Return the result of `opts.next()` from middleware that permits execution. Preserve its typed
  context extensions. For timing and diagnostics, inspect `result.ok`; a failed procedure can arrive as a returned value rather than a thrown exception. Log stable procedure paths, request IDs, durations,
  and safe error categories.
- Use `.concat()` when building a reusable partial procedure with explicit context, input, and
  metadata requirements. Within an application, start with its shared base procedures. Compose
  middleware in the order its context dependencies require. Refactor deprecated standalone
  middleware to the supported composition API when updating that code.
- Define `.output()` where a runtime response contract needs enforcement, such as a provider result
  or a public DTO. Select safe output fields before validation and choose the schema's handling of
  extra fields deliberately.
- Inferred return types alone neither validate external data nor remove private fields. Treat
  output-validation failure as an internal failure, with diagnostics on the server, and a safe client
  response.
- Infer extracted resolver options from the relevant procedure builder when the helper actually
  needs the whole tRPC contract. Give domain operations narrower explicit arguments when they only
  need an authorized resource and validated values. Avoid spreading transport dependencies through
  every database function.

Use one established validation library for shared contracts. Keep the runtime schema and its
inferred type together. Translate stable validation codes at the UI boundary instead of embedding one locale's messages
into every procedure.

## Call procedures on the server

Use an in-process caller when server code needs the router's validation and middleware. Construct it
with the request's verified context through `createCallerFactory`. For the TanStack-native RSC
integration, use its server-only `createTRPCOptionsProxy` setup with the router, context factory,
and request-local QueryClient. A remote API instead needs the configured transport client.

Prefetch with the generated options and dehydrate that same QueryClient into the consuming
HydrationBoundary. Keep pending-query dehydration and serialization aligned with the installed
integration. Start independent useful reads early, then let the intended Suspense boundaries reveal
them. Keep secrets and privileged results out of browser-bound query state.

Share lower-level domain operations when one procedure needs another procedure's business logic.
Calling through a nested caller repeats transport-level parsing and middleware and can obscure which
access check owns the operation. Preserve the shared operation's authorization contract when
extracting it.

Choose one owner for values that can change after hydration. If a Server Component renders a total
and a client query renders the corresponding rows, client invalidation alone can leave the server
rendered total stale. Render dependent values from the same client query, or arrange the necessary
server refresh after the mutation. Treat the Next.js cache and QueryClient cache as separate stores
with separate invalidation paths.

## Configure HTTP transport and batching

Mount the router through the adapter for the actual runtime. In the App Router, connect
`fetchRequestHandler` to the Route Handler with the correct endpoint, router, and context factory,
and expose the supported HTTP methods. Match the client link URL to that endpoint. Choose Node.js or
Edge from the capabilities of the auth provider, database driver, and other server dependencies.

Use a same-origin relative endpoint in the browser when the API is hosted with the app. Resolve
server transport URLs from trusted deployment configuration. Forward only the headers needed by the
remote API. A telemetry header such as `x-trpc-source` identifies a caller's stated source; it does
not prove identity or grant access.

Configure batching for actual payload and infrastructure limits. `httpBatchLink` can limit URL
length and items per batch; use the installed adapter's server-side limits as well. Client limits
cannot constrain a hostile caller. Bound procedure input, response size, and expensive work at the
server. Apply rate limits to procedure work so batching cannot multiply costly operations unchecked.

A batch shares request headers and context. Separate operations that need different credentials or
request-wide tenant headers. When tenant IDs are procedure inputs, authorize each input separately.
A batch is not a database transaction and does not guarantee all-or-nothing writes. Use one
authorized transactional mutation when several changes form one business operation. Handle each
procedure's error even when another operation in the batch succeeds.

Choose the terminating link, which sends the operation, from the response contract:

| Response contract                                              | Link choice            |
| -------------------------------------------------------------- | ---------------------- |
| Individual request or non-JSON upload                          | `httpLink`             |
| Buffered batch, including procedures that set response cookies | `httpBatchLink`        |
| Batch whose results arrive as each operation finishes          | `httpBatchStreamLink`  |
| Server-Sent Events subscription                                | `httpSubscriptionLink` |
| Subscription through a supported WebSocket server              | `wsLink`               |

Use `splitLink` for distinct transport needs. End every branch with its appropriate terminating
link. Keep shared authentication and telemetry behavior consistent across branches. Link context
stays within the client link chain unless code explicitly sends it; server authorization cannot rely
on an unsent client-context field. See [client links](https://trpc.io/docs/client/links).

For a streaming batch, finish header decisions before the response starts. Procedures that set or
refresh cookies need a non-streaming branch or a separate suitable endpoint. Streaming
`responseMeta` cannot inspect completed response data to decide headers. Check that the deployed
adapter and proxy forward results progressively. A successful initial HTTP status does not prove
that every later procedure result succeeded. Follow the
[streaming batch contract](https://trpc.io/docs/client/links/httpBatchStreamLink).

Configure the server transformer and each terminating client link for the same data contract. In
tRPC v11, the transport link owns the client transformer configuration. Hydration serialization is a
separate boundary; verify both paths with the actual non-JSON values used by the app. See
[data transformers](https://trpc.io/docs/server/data-transformers).

When the transport needs SuperJSON, use it directly as the server and client-link transformer.
Configure it at those boundaries; do not add a serialization wrapper or manually encode procedure
results that the transformer already handles.

- For a JSON-compatible payload, pair `superjson.serialize(value)` with
  `superjson.deserialize(payload)`. Keep the returned `json` and any `meta` together; dropping
  metadata loses the information needed to restore richer types.
- For a string payload, pair `superjson.stringify(value)` with `superjson.parse(text)`.
  Do not interchange these APIs with the object-payload pair.
- `superjson.parse<T>()` supplies a TypeScript type, not runtime validation. Validate external
  input with the operation's schema; deserialization does not establish trust or authorization.

See the [SuperJSON API](https://github.com/ravionhq/superjson#api).

Read changing credentials in the supported per-request header callback instead of capturing an old
token when constructing the client. For cross-origin cookie requests, configure fetch credentials
and the server's allowed origins together. Preserve the mutation's CSRF protection. Apply the
[header lifecycle](https://trpc.io/docs/client/headers) and
[cross-origin cookie setup](https://trpc.io/docs/client/cors) to every relevant transport branch.

Treat HTTP response caching as a separate policy from TanStack freshness. Enable shared caching only
for explicitly public reads whose complete response is safe for every recipient of that cache key.
Evaluate every procedure in a batch. Keep responses containing private data, mutations, errors, or
session-cookie changes out of shared caches.

A procedure name containing `public` is not evidence
that its output is safe to cache. Check the selected adapter's `responseMeta` timing before making
cache decisions from procedure results. See [response caching](https://trpc.io/docs/server/caching).

## Handle uploads and non-JSON input

Send supported FormData and binary inputs through `httpLink`. When ordinary calls use a batch link,
route non-JSON input with `splitLink` and `isNonJsonSerializable`. Preserve the raw upload input
when configuring its transformer, while decoding the response with the server's matching
transformer.

Let the tRPC adapter consume and parse its request body. Do not call `request.json()`,
`request.formData()`, or otherwise drain the body before delegating the same request to the adapter.
Validate individual form fields and file limits; checking only that the input is a FormData object
does not validate its contents.

Use the supported binary parser, such as `octetInputParser`, when the procedure accepts a raw byte
stream. Bound consumed bytes and release the reader when processing ends or fails. Keep storage
ownership and file-content checks in the authorized operation, consistent with the application's
upload policy. See [tRPC content types](https://trpc.io/docs/server/non-json-content-types).

## Control cancellation and retries

Make cancellation reach the operation that owns the work. For imperative tRPC calls, pass an
`AbortSignal` through the call options. For query hooks, configure the installed integration's
cancellation behavior and verify that its signal reaches the selected transport. In the classic
integration, inspect `abortOnUnmount`; unmounting alone is not a universal cancellation guarantee.
See [imperative cancellation](https://trpc.io/docs/client/vanilla/aborting-procedure-calls) and
[classic query cancellation](https://trpc.io/docs/client/react/aborting-procedure-calls).

Forward the server's available abort signal to cancellable upstream work. Treat a disconnected
browser and a cancelled database write as different outcomes. A write may already have committed
when the client stops waiting. Recover its state through the operation's identifier before deciding
whether to retry, and keep late responses from updating a different resource.

Choose one retry owner for an operation. TanStack Query already provides retry controls; adding
`retryLink` can multiply attempts when both layers retry. Bound retries and delay them according to
the failure. Stop retrying invalid input and access denials. Retry a mutation only when the server's
idempotency contract makes repeated attempts safe. See
[retry link guidance](https://trpc.io/docs/client/links/retryLink).

## Manage tRPC subscriptions

Use subscriptions for continuing server events. Prefer SSE where suitable; use WebSockets when the
deployment supports the needed transport.

In the native integration, build `subscriptionOptions` and consume them with `useSubscription` from
`@trpc/tanstack-react-query`. TanStack Query does not supply this subscription hook. Use events to
update or invalidate the chosen query/store owner; the subscription's latest event is not a complete
collection. See [subscription consumption](https://trpc.io/docs/client/tanstack-react-query/usage).

Route subscriptions to `httpSubscriptionLink` or `wsLink` through the appropriate branch. For SSE,
use same-origin cookies or the supported EventSource credentials configuration. Native browser
EventSource does not offer arbitrary request-header configuration like fetch. Use a compatible
implementation when custom headers are required.

Re-establish the subscription when identity or
resource changes, and verify authorization on the new connection. Check connection-duration limits
and keepalive settings for the deployment. See
[HTTP subscriptions](https://trpc.io/docs/client/links/httpSubscriptionLink).

- Implement subscription producers as supported async generators. Pass `opts.signal` to listeners
  and cancellable waits, and release timers and external resources in `finally`.
- For resumable delivery, emit `tracked(eventId, payload)` and validate the reconnect cursor. Replay
  authorized events after that cursor. Register live delivery before reading backlog, or use a
  durable event source that closes that race. Deduplicate overlap by stable event identity.
- Choose an event cursor with deterministic ordering. If replay retention has expired, rebuild from
  a fresh authorized snapshot instead of silently omitting events.
- Validate yielded payloads when enforcing an output contract. Checking that an async iterator
  exists does not validate the values it produces.
- Distinguish reconnecting from a terminal error. Follow the installed transport's retry behavior,
  and stop or reauthorize when access expires. Recover the collection after a gap before presenting
  it as current.

Verify disconnect cleanup, replay, and identity changes against the
[producer and recovery contract](https://trpc.io/docs/server/subscriptions).

## Use tRPC-backed server actions

Choose the mutation entry point from the interaction. TanStack `useMutation` fits client cache
updates, optimistic state, and query-driven pending or failure UI. A Server Action fits an
action-backed form and Next.js revalidation. Both can call the same authorized domain operation.

When using tRPC's Server Actions integration, check the installed release's `experimental_caller`
and `experimental_nextAppDirCaller` APIs. Keep this integration in a dedicated server module so its
version-specific setup has one owner. Build verified context in action middleware: these calls
bypass the HTTP adapter and its `createContext` callback. Apply input validation and resource
authorization just as for an HTTP procedure.

Export callable actions from the appropriate `use server` boundary. For a form that works before
JavaScript loads, connect a compatible FormData action through the form's `action` attribute and
validate its entries on the server. An `onSubmit` handler that prevents the default submission and
calls an action programmatically depends on JavaScript.

Give actions stable typed metadata for tracing. After a committed write, perform the required
Next.js revalidation and any client-query reconciliation. Refreshing one cache does not invalidate
the other. Keep redirects outside error handling that swallows Next.js control flow.

## References

Use documentation matching the installed release and enabled features.

| Topic                                     | Primary source                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| tRPC classic RSC setup                    | [tRPC React Server Components](https://trpc.io/docs/client/react/server-components)                               |
| tRPC TanStack integration                 | [tRPC TanStack Query setup](https://trpc.io/docs/client/tanstack-react-query/setup)                               |
| tRPC native query and mutation interfaces | [TanStack integration usage](https://trpc.io/docs/client/tanstack-react-query/usage)                              |
| tRPC native RSC hydration                 | [TanStack integration with Server Components](https://trpc.io/docs/client/tanstack-react-query/server-components) |
| tRPC request context                      | [Context](https://trpc.io/docs/server/context)                                                                    |
| tRPC validation and response contracts    | [Input and output validators](https://trpc.io/docs/server/validators)                                             |
| tRPC middleware composition               | [Middlewares](https://trpc.io/docs/server/middlewares)                                                            |
| In-process procedure calls                | [Server-side calls](https://trpc.io/docs/server/server-side-calls)                                                |
| tRPC HTTP batching                        | [httpBatchLink](https://trpc.io/docs/client/links/httpBatchLink)                                                  |
| tRPC-backed actions                       | [Server Actions](https://trpc.io/docs/client/nextjs/server-actions)                                               |
