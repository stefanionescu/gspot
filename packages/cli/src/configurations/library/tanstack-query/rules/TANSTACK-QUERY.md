# TanStack Query

Read this rule when you change TanStack Query queries, mutations, or cache keys.

Use the integration and release the project has. Keep query data in its cache; do not copy it into a second store to
share it with another component.

## Ownership and identity

Create a server QueryClient per request and keep the browser client stable across rerenders and initial suspension.
Clear or partition private state when identity or tenant changes.

Include every result-changing input in the key. Give list previews, detail records, and infinite pages different
identities. When the project has tRPC, use its generated options and key factories. Keep prefetch and consumption on the
same keys and serialization contract; dehydrate no private data.

See [server rendering and hydration](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).

## Writes and recovery

Roll back only the change of an optimistic update; restoring a whole snapshot can erase a newer success. Reconcile with
the committed response, then invalidate affected lists and aggregates. Keep a committed write successful when its
refresh fails.

Put a required cache update in code that receives every completion, not in a per-call callback that can disappear on
unmount.

See [optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).

## Display and freshness

Distinguish first load, background refresh, and next-page loading. Keep useful data visible during a refresh and expose
its failure separately. Use a placeholder for display data, never as a record ready for editing. Reset placeholders and
pagination when identity or filters change.

Choose freshness from the resource's risk. Never disable refetching globally to hide duplicate requests. Keep permission
and account state out of static caches. Preserve both `pages` and `pageParams` when changing an infinite query.

See [query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) and
[infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries).
