# Zustand

Read this rule when you change a Zustand store.

## Scope and initialize the store

- Create a store through a factory, with `createStore` from `zustand/vanilla` when a context provider owns the instance.
  Report an explicit error for a missing required provider.
- Keep one store instance in the provider for its mounted lifetime, and expose it through React context. Consumers call
  `useStore(store, selector)`. In a Next.js App Router project, declare this provider as a Client Component.
- Keep the provider component alone in its `.tsx` file, and the hooks that read the store in a `.ts` module, so Fast
  Refresh keeps state.
- Pass the intended store instance to an action called outside React; never use a hidden global one that bypasses
  request or provider scope.
- In a Next.js App Router project, Server Components read authorized server data rather than passing it between requests
  through the client store.
- Place the provider where the state lives: a shared layout keeps state across navigation, and a page or keyed resource
  provider resets it.
- New initial props do not reinitialize an existing store. Define a reconciliation action or remount at a changed
  resource boundary, keeping drafts when the interaction needs them.

## Select narrowly and keep results stable

- Components select the specific values and actions they read. Never subscribe a large layout or every list row to the
  whole store through a hook without a selector.
- Select a primitive, stored entity, or stable action directly when the consumer needs only that value. Wrap a selector
  that returns a tuple, array, or object of several values in `useShallow` from a supported entry point, such as
  `zustand/react/shallow`.
- In Zustand 5, a selector that allocates a new result on every read can cause an update loop. Keep fallback arrays,
  objects, and functions stable too, and never turn an absent action into a fresh empty callback.
- Use `zustand/traditional` and its peer dependency for custom equality; the standard `create` takes no equality
  argument.
- Subscribe rows by entity ID. The list component subscribes to ordering and paging instead of every record's content.
- Derive values through selectors or computations over authoritative state, never synchronized counts, array copies, or
  flags that diverge after a deletion, rollback, or reset.
- `getState()` reads an imperative snapshot without a subscription, so rendered values come from selectors. Release
  manual subscriptions with their owning component or service.

## Update without losing fields

- Use a functional `set` when the result depends on current state. Zustand merges the returned object at the top level
  only, so a nested update copies each changed ancestor and keeps the other siblings and references.
- Shallow comparison does not inspect nested values: replace a changed object, Map, Set, or array instead of mutating
  it. Copy an edited record inside a Map too, because a new Map holding the same mutated record leaves entity selectors
  on the old reference.
- Type an empty collection where the code builds it, such as `new Map<string, Entity>()`, without an assertion. New
  stores and resets create fresh collections.
- Use `replace: true` only for a complete replacement that keeps the store's shape, actions included. A reset changes
  the domain state and leaves a usable store.
- In a store that already uses Immer, change only the draft it receives. It configures Map and Set support where the
  installed Immer requires it and keeps non-draftable external objects out of drafts.
- Use one update method in one store, and add an immutable-update library only when it saves real complexity.

## Actions and slices

- Actions carry domain meaning, such as adding a record, switching a resource, or applying a confirmed save. They live
  beside their state and keep its validation and related field changes.
- Put changes that form one invariant in one `set` call. Two actions in sequence make two store transitions, and React
  render batching does not merge them.
- Slices organize one cohesive store, and each field and action lives in exactly one, so spreading them cannot silently
  overwrite names. Wrap the whole store in middleware, not each slice, and keep slice creator types compatible with it.

## Persisted state

- `persist` takes a unique storage name and a `partialize` allowlist of durable fields. Actions, request flags, live
  handles, access tokens, and credentials stay out.
- Maps, Sets, and other values that JSON loses get explicit serialization.
- Persist the current shape. When it changes, reset disposable cached state instead of migrating it, and move required
  user-authored records to the new shape. Missing, malformed, or unavailable storage yields the initial state.
- In a server-rendered app, keep browser restoration apart from the first snapshot. Use `skipHydration` and an explicit
  `rehydrate()` when automatic restoration changes it.
- Track hydration through the supported callbacks or subscriptions, not one read of `hasHydrated()`, and release the
  listeners when the component that added them unmounts.
- On sign-out and on identity or tenant changes, reset live private state and clear or partition its persisted copy.
  Clearing storage alone leaves the in-memory store unchanged.
- Never let a pending restoration reapply the data of the previous identity.

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
