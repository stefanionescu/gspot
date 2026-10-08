---
title: tRPC
---

# tRPC

Use the client integration the project has. Do not mix the classic and TanStack-native clients.
Check the installed release before using a version-specific API.

## Request ownership

Create context from verified identity for each request. Context creation can run during prefetching,
so it performs no writes. Each operation in a batch authorizes itself; a batch is not a transaction.
Authentication proves identity, and resource authorization proves access to the named resource.
Neither a valid input nor a procedure named public proves permission.

Direct callers receive verified context explicitly. Never store a session in a process-wide
variable or cast a direct caller into an HTTP request. Procedures that share logic call the same
authorized domain operation rather than calling each other.

See [authorization](https://trpc.io/docs/server/authorization)
and [server callers](https://trpc.io/docs/server/server-side-calls).

## Client state and transport

Use generated query options and keys. A mutation key identifies a write, not the queries to
invalidate. Server rendering and browser consumption use the same QueryClient and serialization
contract; private results stay out of dehydration. A rendered server total and client-query rows
need one data owner or coordinated refresh.

Cookie-setting operations use a transport that can finish headers before streaming. Configure
serialization at both ends and preserve transformer metadata. Bound batch sizes and expensive
work. One layer owns retries, and a write is retried only under an idempotency contract.

See [TanStack integration](https://trpc.io/docs/client/tanstack-react-query/setup)
and [links](https://trpc.io/docs/client/links).

## Cancellation and events

Forward cancellation to the work owner and release listeners and streams. A disconnected client
does not prove that a write failed; recover its state by operation identity before retrying.
Late responses must not update another resource or session.

Subscriptions reauthorize after identity changes. Resumable events use stable identifiers,
deduplicate replay, and restore a fresh snapshot when retention has expired.

See [subscriptions](https://trpc.io/docs/server/subscriptions).
