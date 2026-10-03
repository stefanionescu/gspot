---
title: Zustand
---

# Zustand

Zustand holds client state that several components share when local or form state is not enough.
Fetched server data stays in the query cache. A separate store for streaming or normalized state
names the code that updates it and how later server results merge into it.

## Scope and initialize the store

- Create a store through a factory, with `createStore` from `zustand/vanilla` when a context
  provider owns the instance. A missing required provider is an explicit error.
- The provider, a Client Component, keeps one instance for its mounted lifetime and exposes it
  through React context. Consumers call `useStore(store, selector)`.
- Create request-dependent stores per request on the server. A browser singleton never justifies a
  server singleton initialized with a user's identity.
- An action called outside React uses the intended store instance, passed in, never a hidden
  global store that bypasses request or provider scope.
- The provider takes a safe initial snapshot from server data, identical for the server-rendered
  subtree and its first browser render: no browser storage, random values, or current timestamps.
- Server Components read authorized server data and never use the client store to pass data
  between requests.
- Place the provider where the state lives: a shared layout keeps state across navigation, and a
  page or keyed resource provider resets it.
- New initialization props do not reinitialize an existing store. Define a reconciliation action or
  remount at a changed resource boundary, keeping drafts when the interaction needs them.
- Virtualizer handles and control state never sit on global DOM nodes. Pass the controller through
  its local owner, props, or a scoped context.

## Select narrowly and keep results stable

- Components select the specific values and actions they read. A large layout or every list row
  never subscribes to the whole store through an unselected hook.
- Select a primitive, stored entity, or stable action directly when that is all the consumer needs.
  A selector that returns a tuple, array, or object of several values uses `useShallow` from a
  supported entry point such as `zustand/react/shallow`.
- In Zustand 5, a selector that allocates a new result on every read can cause an update loop.
  Fallback arrays, objects, and functions stay stable too, and an absent action never becomes a
  fresh empty callback.
- Custom equality goes through `zustand/traditional` and its peer dependency; the standard `create`
  takes no equality argument.
- A virtual row subscribes by stable entity ID, and the list owner subscribes to ordering and paging,
  not each record's streaming text. A token update to the last row rerenders neither the other rows
  nor the shell.
- Derived values are selectors or computations over authoritative state, never synchronized counts,
  array copies, or flags that disagree after a deletion, rollback, or reset.
- `getState()` is an imperative snapshot, not a subscription, so rendered values come from
  selectors. Release manual subscriptions with their owning component or service.

## Update without losing fields

- Use a functional `set` when the result depends on current state. Zustand merges the returned
  object at the top level only, so a nested change copies each changed ancestor and keeps unchanged
  siblings and references.
- Shallow comparison is not deep: replace a changed object, Map, Set, or array instead of mutating
  it. An edited record inside a Map is copied too, because a new Map holding the same mutated record
  leaves entity selectors on the old reference.
- Type an empty collection where it is built, such as `new Map<string, Entity>()`, without an
  assertion. New stores and resets create fresh collections.
- `replace: true` is only for a complete replacement that keeps the store's shape, actions
  included. A reset is a domain transition that leaves a usable store.
- A store that already uses Immer changes only the provided draft. It configures Map and Set
  support where the installed Immer requires it and keeps non-draftable external objects out of
  drafts.
- One store uses one update method, and an immutable-update library joins only when it saves real
  complexity.

## Actions and slices

- Actions carry domain meaning, such as adding a record, switching a resource, or applying a
  confirmed save. They live beside their state and keep its validation and related field changes.
- Changes that form one invariant go in one `set` call. Two actions in sequence make two store
  transitions, and React's render batching does not merge them.
- Slices organize one cohesive store, with one owner for each field and action, so spreading slices
  cannot silently overwrite names. Middleware wraps the completed store, not each slice, and slice
  creator types stay compatible with it.
- Asynchronous actions keep request identity and cancellation explicit. A delayed action never
  updates the next resource after the reader moves on.
- Streaming state stored by entity ID defines each transition in the store's update operations,
  never in competing effects that copy data between stores.

Those transitions initialize from the server or query result, apply chunks to the entity, merge
the confirmed save, and keep or restore the draft after a failure.

## Persisted state

- `persist` takes a unique storage name and a `partialize` allowlist of durable fields. Actions,
  request flags, live handles, access tokens, and credentials stay out.
- Maps, Sets, and other values that JSON loses get explicit serialization.
- Persist the current shape. When it changes, reset disposable cached state instead of migrating old
  shapes, and move required user-authored records to the current shape. Missing, malformed, or
  unavailable storage yields the initial state.
- Browser restoration stays apart from the server-compatible first snapshot. Use `skipHydration`
  and an explicit `rehydrate()` when automatic restoration changes the first render.
- Track hydration through the supported callbacks or subscriptions, not one read of
  `hasHydrated()`, and release the listeners when their owner unmounts.
- Sign-out and identity or tenant changes reset live private state and clear or partition its
  persisted copy. Clearing storage alone leaves the in-memory store as it was.
- A pending restoration never reapplies the previous identity's data.

## URL state

- The URL owns filters, sorting, and other shareable navigation values. It carries a selected,
  versioned representation, never credentials, private drafts, or the whole store.
- Validate parsed values, and handle missing or malformed input without assertions or an unchecked
  `JSON.parse`.
- Define the precedence among URL values, stored preferences, and defaults. When the URL owns a
  value, back and forward navigation reach the state owner.
- One synchronization path compares values before writing, so store-to-URL and URL-to-store updates
  never loop.
- Keep unrelated query parameters and fragments. Use the installed router or the History API to replace history for transient edits and to push an entry when back navigation restores the previous state.
- Hash values are browser-only and never shape the server-rendered snapshot.

## Verification

Check independent provider instances, route changes, nested updates, resets, and malformed stored or
URL state. For streaming collections, an update reaches its entity's subscribers without rerendering
every row or changing another resource's state.

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
| URL state         | [URL hash state](https://zustand.docs.pmnd.rs/learn/guides/connect-to-state-with-url-hash)         |
