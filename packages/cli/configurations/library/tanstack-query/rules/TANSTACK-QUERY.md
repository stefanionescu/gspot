---
title: TanStack Query
---

# TanStack Query

Use the integration and release the project has. Query data stays in its cache; do not copy it
into a second store to share it with another component.

## Ownership and identity

Create a server QueryClient per request and keep the browser client stable across rerenders and
initial suspension. Clear or partition private state when identity or tenant changes. A late
response must not refill the next session's cache.

Include every result-changing input in the key. Give list previews, detail records, and infinite
pages different identities. When the project uses tRPC, use its generated options and key factories.
Keep prefetch and consumption on the same keys and serialization contract; dehydrate no private data.

See [server rendering and hydration](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).

## Writes and recovery

Apply a save result to the resource captured when the save started, not the current selection.
An optimistic rollback reverses only its own change; restoring a whole snapshot can erase a newer
success. Reconcile with the committed response, then invalidate affected lists and aggregates.
A committed write stays successful when its refresh fails.

Required cache updates belong to an owner that sees every completion, not a per-call callback
that can disappear on unmount. Retry a write only under an idempotency contract.

See [optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).

## Display and freshness

Distinguish first load, background refresh, and next-page loading. Keep useful data visible during
a refresh and expose its failure separately. A placeholder is display data, not a record ready
for editing. Reset placeholders and pagination when identity or filters change.

Choose freshness from the resource's risk. Never disable refetching globally to conceal duplicate
requests. Keep permission and account state out of static caches. Preserve both `pages` and
`pageParams` when changing an infinite query.

See [query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
and [infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries).
