# tRPC

Read this rule when you change tRPC procedures or their client.

Use the client integration the project has. Do not mix the classic client with the TanStack one. Check the installed
release before using a version-specific API.

## Request ownership

Give every procedure an input schema, even an empty one. Create context from verified identity for each request. Context
creation can run during prefetching, so do no writes in it. Authorize each operation in a batch on its own; a batch does
not create a transaction. Authentication proves identity, and authorization proves access to the named resource. Neither
a valid input nor a procedure named public proves permission.

Pass verified context to direct callers explicitly. Never store a session in a process-wide variable or cast a direct
caller into an HTTP request. When procedures share logic, call the same authorized domain operation rather than each
other.

See [authorization](https://trpc.io/docs/server/authorization) and
[server callers](https://trpc.io/docs/server/server-side-calls).

## Client state and transport

Use generated query options and keys. A mutation key identifies a write, not the queries to invalidate. Use the same
QueryClient and serialization contract for server rendering and browser consumption, and keep private results out of
dehydration. Give a rendered server total and the client-query rows one source of the data, or refresh them together.

For cookie-setting operations, use a transport that can finish headers before streaming. Configure serialization at both
ends and preserve transformer metadata. Bound batch sizes and expensive work. Let one layer own retries.

See [TanStack integration](https://trpc.io/docs/client/tanstack-react-query/setup) and
[links](https://trpc.io/docs/client/links).

## Cancellation and events

Forward cancellation to the code that does the work, and release listeners and streams. A disconnected client does not
prove that a write failed; recover its state by operation identity before retrying.

Reauthorize subscriptions after identity changes. Give resumable events stable identifiers, deduplicate replay, and
restore a fresh snapshot when retention has expired.

See [subscriptions](https://trpc.io/docs/server/subscriptions).
