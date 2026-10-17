# Zustand

Read this rule when you change a Zustand store.

Zustand holds client state that several components share when local or form state cannot serve them.
Fetched server data stays in the query cache.

## Scope and initialize the store

- Create a store through a factory, with `createStore` from `zustand/vanilla` when a context
  provider owns the instance. Report an explicit error for a missing required provider.
- The provider keeps one instance for its mounted lifetime and exposes it through React context.
  Consumers call `useStore(store, selector)`. In a Next.js App Router project, declare this provider as a
  Client Component.
- In a server-rendered app, create request-dependent stores per request. Never share a store
  initialized with one user's identity across requests.
- An action called outside React uses the intended store instance, passed in, never a hidden
  global one that bypasses request or provider scope.
- In a server-rendered app, the provider takes an initial snapshot that matches the first browser
  render. Browser storage, random values, and current timestamps stay out of that snapshot.
- In a Next.js App Router project, Server Components read authorized server data rather than passing
  it between requests through the client store.
- Place the provider where the state lives: a shared layout keeps state across navigation, and a
  page or keyed resource provider resets it.
- New initial props do not reinitialize an existing store. Define a reconciliation action or
  remount at a changed resource boundary, keeping drafts when the interaction needs them.

## Select narrowly and keep results stable

- Components select the specific values and actions they read. A large layout or every list row
  never subscribes to the whole store through a hook without a selector.
- Select a primitive, stored entity, or stable action directly when the consumer needs only that value.
  A selector that returns a tuple, array, or object of several values uses `useShallow` from a
  supported entry point such as `zustand/react/shallow`.
- In Zustand 5, a selector that allocates a new result on every read can cause an update loop.
  Fallback arrays, objects, and functions stay stable too, and an absent action never becomes a
  fresh empty callback.
- Custom equality goes through `zustand/traditional` and its peer dependency; the standard `create`
  takes no equality argument.
- Subscribe rows by entity ID. The list component subscribes to ordering and paging instead of every
  record's content.
- Derive values through selectors or computations over authoritative state, never synchronized counts,
  array copies, or flags that diverge after a deletion, rollback, or reset.
- `getState()` reads an imperative snapshot without a subscription, so rendered values come from
  selectors. Release manual subscriptions with their owning component or service.

## Update without losing fields

- Use a functional `set` when the result depends on current state. Zustand merges the returned
  object at the top level only, so a nested update copies each changed ancestor and keeps the other
  siblings and references.
- Shallow comparison does not inspect nested values: replace a changed object, Map, Set, or array instead of mutating
  it. Copy an edited record inside a Map too, because a new Map holding the same mutated record
  leaves entity selectors on the old reference.
- Type an empty collection where the code builds it, such as `new Map<string, Entity>()`, without an
  assertion. New stores and resets create fresh collections.
- Use `replace: true` only for a complete replacement that keeps the store's shape, actions
  included. A reset changes the domain state and leaves a usable store.
- A store that already uses Immer changes only the draft it receives. It configures Map and Set
  support where the installed Immer requires it and keeps non-draftable external objects out of
  drafts.
- One store uses one update method, and an immutable-update library joins only when it saves real
  complexity.

## Actions and slices

- Actions carry domain meaning, such as adding a record, switching a resource, or applying a
  confirmed save. They live beside their state and keep its validation and related field changes.
- Changes that form one invariant go in one `set` call. Two actions in sequence make two store
  transitions, and React render batching does not merge them.
- Slices organize one cohesive store, and each field and action lives in exactly one, so spreading
  them cannot silently overwrite names. Middleware wraps the whole store, not each slice, and slice
  creator types stay compatible with it.
- Asynchronous actions keep request identity and cancellation explicit. A delayed action never
  updates the next resource after the reader moves on.

## Persisted state

- `persist` takes a unique storage name and a `partialize` allowlist of durable fields. Actions,
  request flags, live handles, access tokens, and credentials stay out.
- Maps, Sets, and other values that JSON loses get explicit serialization.
- Persist the current shape. When it changes, reset disposable cached state instead of migrating
  it, and move required user-authored records to the new shape. Missing, malformed, or
  unavailable storage yields the initial state.
- In a server-rendered app, browser restoration stays apart from the first snapshot. Use
  `skipHydration` and an explicit `rehydrate()` when automatic restoration changes it.
- Track hydration through the supported callbacks or subscriptions, not one read of
  `hasHydrated()`, and release the listeners when the component that added them unmounts.
- Sign-out and identity or tenant changes reset live private state and clear or partition its
  persisted copy. Clearing storage alone leaves the in-memory store unchanged.
- A pending restoration never reapplies the previous identity's data.

## Verification

Check independent provider instances, nested updates, resets, and malformed stored state. A delayed
update must not change another resource or restore a previous identity's private state.

## References

| Topic             | Primary source                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Next.js setup     | [Next.js guide](https://zustand.docs.pmnd.rs/learn/guides/nextjs)                                  |
| Immutable updates | [Immutable state](https://zustand.docs.pmnd.rs/learn/guides/immutable-state-and-merging)           |
| Maps and Sets     | [Maps and Sets](https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage)                     |
| Immer             | [Immer middleware](https://zustand.docs.pmnd.rs/reference/integrations/immer-middleware)           |
| Slices            | [Slices pattern](https://zustand.docs.pmnd.rs/learn/guides/slices-pattern)                         |
| Zustand 5         | [Migrating to v5](https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5)               |
| Persistence       | [Persisting store data](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data) |
