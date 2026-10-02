---
title: tRPC
---

# tRPC

Router composition, request context, the TanStack-native client, procedures and validators,
server callers, transport, uploads, cancellation, subscriptions, and server actions. The
TypeScript and TanStack Query rules apply underneath. `tsc` reports the type-only imports,
and the ESLint plugin reports the query-key and hook rules. This guide holds the ownership
and authorization decisions no tool can see. Read the documentation for the installed
release.

## Structure

The integration is `@trpc/tanstack-react-query`. A classic integration is replaced in one
change that updates providers, consumers, keys, and hydration and removes the old client. It
is never kept beside the new one behind a compatibility wrapper. Context and procedure
initialization, root router composition, server caller and hydration, the browser provider,
and domain routers are separate modules. Domain routers live with their features, the root
router composes them, and the HTTP adapter delegates. No router holds all database and UI
logic.

The browser imports the inferred router type, never its runtime. Shared UI and general
modules never import feature procedures. Transforms are configured identically at both ends
when values exceed JSON, with no second mismatched serialization layer. SuperJSON never makes
a function or secret a valid client prop.

### Feature organization

<!-- level: all -->

A feature's server code sits beside the feature. It separates transport, reads, writes,
validation, and transformation where those responsibilities exist, so a reader finds the
owner of an operation without opening a giant router:

| Owner              | Responsibility                                                            | Keep out of it                                    |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------- |
| Procedures         | Input and context, access policy, calling the operation, transport errors | JSX, client stores, unrelated database operations |
| Queries            | Bounded reads with explicit filters, ordering, and selected fields        | Side effects, account creation, rendering         |
| Mutations          | Authorized writes, transactions, idempotency, persistence invariants      | Browser effects, form state, duplicate responses  |
| Validators         | Runtime schemas and contract-specific validation                          | Provider initialization, hidden writes            |
| Transformers       | Validated records into explicit domain or DTO shapes                      | Database requests, global state, rendering        |
| Router composition | Assembling feature procedures into the application router                 | Reimplementing the feature's queries or writes    |

### Data operation contracts

The request-scoped database or provider client passes through the operation boundary rather
than being created in each query helper. A query either authorizes or takes a context whose
owning operation already did. No alternate caller bypasses that by importing a lower-level
query. A function named as a query never initializes a session or creates data while being
prefetched. Queries select the fields they need and keep pagination limits and tie-breaking
order inside.

Responses are transformed once at the boundary that owns their shape. Pure transformers and
browser-used schemas live in a browser-safe contract module. Functions stay together until a
real responsibility merits another file.

## Request context and access

Context is created once per HTTP request, including a batch. It comes from the verified
server session and request-scoped clients, never from a browser-supplied user ID or a tenant
header taken as authority. Context creation can run during prefetching and repeat during
rendering, so it stays read-only. Account creation, anonymous sign-in, cookie writes, message
sending, and paid provider jobs belong in an authorized mutation or action.

A protected procedure proves identity. A resource procedure additionally proves that this
identity may read or change the named resource, checked close enough to the data access that
no caller skips it. A procedure's authorized resource is added through `opts.next({ ctx })`,
never by mutating the shared context. Each operation in a batch authorizes itself.

Errors use
`UNAUTHORIZED` for missing authentication and `FORBIDDEN` for a caller without permission.
They hide resource existence where revealing it leaks private information and return safe
field information for validation failures. Stacks and provider messages stay in server
telemetry behind stable codes the UI translates.

When HTTP and direct callers share procedures, the common context type is inferred from the
factory that supplies it. Transport-only fields are optional in an extended type or checked
by a separate procedure, and a direct caller never acquires a request through a cast.
Verified identity is passed to direct callers explicitly. Request-local React `cache` may
reuse context inside one render; a process-wide session variable may not. After a sign-in or
anonymous-account mutation, the identity comes from that operation's result or a fresh
verification. Dependent request and browser state is refreshed before private reads.

## TanStack-native client

`createTRPCContext<AppRouter>()` with a type-only `AppRouter` import gives `TRPCProvider`,
`useTRPC`, and `useTRPCClient`, kept apart from the server's context factory. Query and
mutation hooks come from `@tanstack/react-query`. The application's one QueryClient is passed
to `TRPCProvider` with a stable transport client. Browser singleton initialization stays out
of server request state, and initial suspension cannot discard the browser cache.

Every operation uses its generated interface: `queryOptions`, `mutationOptions`,
`mutationKey`, `infiniteQueryOptions`, `queryKey`, `infiniteQueryKey`, `queryFilter`,
`infiniteQueryFilter`, and `pathFilter`. A regular value and infinite pages have different
shapes, so the matching key factory addresses each. Distinct key prefixes separate several
API roots on one client. A `mutationKey` tracks writes; it identifies nothing to invalidate.
Link context is transport metadata, and values that change results belong in the cache input.

A conditional read uses `skipToken` for an ordinary query, or renders the suspense consumer
only once its identifier exists; a non-null assertion does not make an absent input valid. A
disabled query opts out of automatic refetching, and invalidation does not enable it.
`refetch()` cannot run a skipped query, and changed search inputs go in the key rather than
into `refetch`. `getNextPageParam` matches the server's `nextCursor` and exhaustion value,
and the initial cursor comes from the integration's option.

## Procedures and validators

The tRPC root is initialized once with context, metadata, transformer, and error formatting.
It exports router helpers and named base procedures. Authenticated and privileged procedures
derive from them, narrowing context through middleware instead of asserting a nullable user.
Input parsing precedes middleware that reads it. It validates identifiers, allowed values,
lengths, page sizes, and operation constraints; a browser validator improves feedback and
replaces nothing.

Chained `.input()` parsers merge object results with later values winning, so composed
schemas need clear field owners. A checked tenant field is never redefined by a
later transform.

Queries carry no durable side effects; writes are mutations with transactions and idempotency
in the shared operation. Middleware returns `opts.next()` with its typed extensions. It
inspects `result.ok` for diagnostics, because a failure can arrive as a value. Reusable
partial procedures use `.concat()`, composed in dependency order, and deprecated standalone
middleware is migrated when touched. `.output()` enforces a runtime contract where one is
needed, on safe fields selected first, with a failure treated as an internal error. Inferred
return types validate nothing and strip no private field.

Resolver options are inferred from the builder only when a helper needs the whole contract.
Domain operations take an authorized resource and validated values. One validation library
owns shared contracts, schema and inferred type stay together, and stable codes are
translated at the UI.

## Server callers and hydration

Server code that needs the router's validation and middleware uses an in-process caller from
`createCallerFactory` with the verified context. For RSC it uses the server-only
`createTRPCOptionsProxy` with the router, context factory, and request-local QueryClient. A
remote API needs the transport client. Prefetches use the generated options and dehydrate the
same QueryClient into the consuming `HydrationBoundary`. Pending-query serialization is
aligned to the integration, and secrets stay out of browser-bound state.

A procedure that needs another's logic shares the domain operation rather than a nested
caller, keeping the authorization contract. Values that change after hydration have one
owner. A total rendered on the server and rows rendered by a client query drift after
invalidation, so both come from the same query or the server refreshes after the mutation.
The Next.js cache and the QueryClient are separate stores with separate invalidation.

## Transport

The router mounts through the adapter for the runtime, `fetchRequestHandler` in an App Router
Route Handler with the methods it supports. The client link URL matches. Node.js or Edge
follows the capabilities of the auth provider and database driver. The browser uses a
same-origin relative endpoint when the API is co-hosted. Server URLs come from deployment
configuration, only needed headers are forwarded, and a source header proves nothing.

Batching limits, `httpBatchLink` URL length and items plus the adapter's server limits, follow
real payload constraints. The server bounds input, response size, expensive work, and rate,
so a batch cannot multiply cost. A batch shares headers and context and is not a transaction.
Several changes that form one operation need one authorized transactional mutation, and each
procedure's error is handled on its own.

| Response contract                                              | Terminating link       |
| -------------------------------------------------------------- | ---------------------- |
| Individual request or non-JSON upload                          | `httpLink`             |
| Buffered batch, including procedures that set response cookies | `httpBatchLink`        |
| Batch whose results arrive as each operation finishes          | `httpBatchStreamLink`  |
| Server-Sent Events subscription                                | `httpSubscriptionLink` |
| Subscription through a supported WebSocket server              | `wsLink`               |

`splitLink` branches distinct needs, each ending in its terminating link with consistent
authentication and telemetry. A streaming batch finishes header decisions before the response
starts, so cookie-setting procedures take a non-streaming branch. A successful initial status
proves nothing about later results. The server transformer and every terminating link share
one data contract. SuperJSON is used directly at those boundaries: `serialize` with
`deserialize` keeping `json` and `meta` together, and `stringify` with `parse`, never mixed.
`parse<T>()` supplies a type without validation.

Changing credentials are read in the per-request header callback. Cross-origin cookies pair
fetch credentials with allowed origins and keep CSRF protection. HTTP response caching is
enabled only for explicitly public reads whose whole batch is safe for every recipient; a
procedure named `public` is not evidence. See [links](https://trpc.io/docs/client/links) and
[caching](https://trpc.io/docs/server/caching).

## Uploads, cancellation, and retries

FormData and binary inputs travel through `httpLink`, routed by `splitLink` with
`isNonJsonSerializable` when ordinary calls batch. The raw upload is preserved, and the
response is decoded by the matching transformer. The adapter parses its own body, so nothing
drains `request.json()` or `request.formData()` first. Individual fields and file limits are
validated. A byte stream uses `octetInputParser` with bounded consumption and a released
reader, and storage ownership and content checks stay in the authorized operation.

Cancellation reaches the owner of the work. An `AbortSignal` passes through imperative call
options, hooks use the integration's configured behavior with the signal verified to reach
the transport, and the server's signal is forwarded upstream. A disconnected browser and a
cancelled write differ, because the write may have committed. State is recovered by
identifier before any retry, and late responses cannot update another resource. One layer
owns retries; adding `retryLink` beside TanStack retries multiplies attempts. Retries are
bounded, delayed by failure kind, stopped on invalid input and access denial, and applied to
a mutation only under a server idempotency contract.

## Subscriptions and server actions

Continuing server events use subscriptions: SSE where suitable, and WebSockets where the
deployment supports them. They are consumed through `subscriptionOptions` and
`useSubscription` from the tRPC integration. Events update or invalidate the chosen owner;
the latest event is not a collection. SSE uses same-origin cookies or the EventSource
credentials option, with a compatible implementation when custom headers are required.
Subscriptions re-establish and reauthorize on identity or resource change within the
deployment's duration and keepalive limits.

Producers are async generators that pass `opts.signal` to listeners and release resources in
`finally`. Resumable delivery emits `tracked(eventId, payload)` and validates the reconnect
cursor. It registers live delivery before reading backlog, deduplicates by event identity,
and rebuilds from a fresh snapshot when replay retention has expired. Yielded payloads are
validated when an output contract applies, and reconnecting is distinguished from a terminal
error. See [subscriptions](https://trpc.io/docs/server/subscriptions).

The mutation entry point follows the interaction. `useMutation` serves cache updates and
query-driven pending UI, and a Server Action serves an action-backed form with Next.js
revalidation. Both call the same authorized domain operation. The Server Actions integration
lives in one dedicated server module, because its `experimental_caller` APIs are
version-specific. It builds verified context in action middleware, because the HTTP adapter's
`createContext` is bypassed, and it validates and authorizes like an HTTP procedure.

Actions are exported from a `use server` boundary. A form that works before JavaScript
connects a FormData action through its `action` attribute. After a committed write the action
performs Next.js revalidation and client-query reconciliation, because neither cache
invalidates the other. Redirects stay outside error handling that swallows control flow. See
[server actions](https://trpc.io/docs/client/nextjs/server-actions).
