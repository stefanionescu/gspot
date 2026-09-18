---
layer: library
preset: zustand
title: Zustand
---

# Zustand

## Manage shared state with Zustand

Use Zustand for client state shared across components when local or form state is insufficient. Keep `enforced-by: typescript/eslint no-restricted-syntax`
fetched server data in the query cache. If streaming or normalized state needs a separate store,
define which code updates that store and how it merges later server results.

- Select the specific values and actions a component reads. Do not subscribe a large layout or every
  list row to the entire store with an unselected store hook. `enforced-by: typescript/eslint no-restricted-syntax`
- Prefer a single primitive/entity selector. When a selector returns an object or array of several
  values, use the installed Zustand version's equality mechanism, such as `useShallow`. That avoids
  updates caused only by a newly allocated wrapper.
  `enforced-by: typescript/eslint no-restricted-syntax`
- Shallow comparison is not deep comparison. Keep nested object identity stable when it did not
  change; replace the changed object/map/array through the store's supported update mechanism when
  it did. Mutating a Map in place can prevent subscribers from seeing a real update. `enforced-by: typescript/eslint no-restricted-syntax`
- Subscribe a virtual row by stable entity ID when using normalized records. Subscribe the list
  owner to ordering/paging state, not every record's streaming text. A token update to the final row
  never rerenders all rows and the shell. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep derived values as selectors or computations when they can be calculated from authoritative
  state. Avoid separate synchronized counts, copies of arrays, and flags that can disagree after
  deletion, rollback, or reset. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep related state transitions with their feature owner, normally as actions beside the state.
  Group actions into a slice when it owns a real domain.
  `enforced-by: typescript/eslint no-restricted-syntax`
- External action functions use the intended store instance; they do not bypass request or provider
  scope through a hidden global store. `enforced-by: typescript/eslint no-restricted-syntax`
- Keep async request identity and cancellation explicit. A delayed store action must not update the
  next resource after the reader switches away. `enforced-by: typescript/eslint no-restricted-syntax`
- Reset private state on sign-out and identity/tenant changes. Persist only the fields that actually
  need persistence, with validation/versioning of stored values. Do not persist access tokens,
  transient request flags, or live handles. `enforced-by: typescript/eslint no-restricted-syntax`
- Create request-dependent stores per request on the server. A browser singleton does not justify a
  server singleton initialized with a user's identity. `enforced-by: typescript/eslint no-restricted-syntax`
- Do not store virtualizer handles or control state on global DOM nodes. Pass the controller through
  its local owner, props, or an appropriately scoped context. `enforced-by: typescript/eslint no-restricted-syntax`

For streaming state stored by entity ID, define each transition. Initialize from the server or query
result. Apply incoming chunks to the entity. Merge the confirmed saved result. Retain or restore the
draft after failure. Implement these transitions in the state update operations instead of
copying data between stores with competing effects.

### Scope and initialize the store

Create a store through a factory, using `createStore` from `zustand/vanilla` when a context provider
owns the instance. The Client Component provider creates one retained instance for its mounted
lifetime and exposes it through React context. Consumers subscribe with `useStore(store, selector)`.
Make a missing required provider an explicit error.

Pass a safe initial snapshot from server data into the provider. Use identical initial values for `enforced-by: typescript/eslint no-restricted-syntax`
the server-rendered client subtree and its first browser render. Avoid browser storage, random
values, and current timestamps changing that first snapshot. Server Components read authorized
server data; they do not read or write the client store to communicate between requests.

Place the provider where the state lives. A shared layout can preserve state across `enforced-by: typescript/eslint no-restricted-syntax`
navigation; a page or keyed resource provider can reset it. New initialization props do not
automatically reinitialize an existing store. Define an explicit reconciliation action or remount at
a changed resource boundary, while preserving drafts when the interaction requires them. Cancel or
detach old asynchronous work before it can update a replacement resource. See
[Next.js store setup](https://zustand.docs.pmnd.rs/learn/guides/nextjs).

### Update state without losing fields

Use functional `set` updates when the result depends on current state. Zustand merges the returned `enforced-by: typescript/eslint no-restricted-syntax`
object into the top level only. For a nested change, copy each changed ancestor and retain its
unmodified siblings. Keep unchanged references stable so unrelated selectors can avoid updates.

Use `replace: true` only for a complete replacement that preserves the store's required shape, `enforced-by: typescript/eslint no-restricted-syntax`
including actions stored in it. A partial reset with replacement can remove those actions. Define
reset as a domain transition that restores the intended data and leaves a usable store. Create fresh
collection instances for new stores and resets. See
[immutable updates and merging](https://zustand.docs.pmnd.rs/learn/guides/immutable-state-and-merging).

For ordinary Map and Set updates, copy the collection before changing it. Create a new Map for an
entry update or deletion and a new Set for membership changes. Copy an edited record inside a Map as
well; a new collection containing the same mutated record can still leave an entity selector with
the old reference. Type empty collections at their construction boundary, such as
`new Map<string, Entity>()` or `new Set<string>()`, without an assertion that hides an incompatible
value. Follow [Map and Set updates](https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage).

When the store already uses Immer, change only the provided draft and follow its supported object
and collection rules. Configure collection support before using draft Map/Set mutations where the
installed Immer release requires it. Keep non-draftable external objects out of draft mutation
paths. Choose one consistent update method for the store; add an immutable-update dependency only
when its complexity savings justify it. See
[Immer integration](https://zustand.docs.pmnd.rs/reference/integrations/immer-middleware).

### Compose actions and slices

Give actions domain meaning: adding a record, switching a resource, or applying a confirmed save. `enforced-by: typescript/eslint no-restricted-syntax`
Keep the validation and related field changes in that action. When an operation changes several
fields that form one invariant, return all changes in one `set` call. Calling two actions in
sequence produces two store transitions; React render batching does not make them one atomic store
update.

Use slices to organize one cohesive store. Give each field and action one owner so spreading slices `enforced-by: typescript/eslint no-restricted-syntax`
together cannot silently overwrite another slice's names. Compose middleware around the completed
store, rather than wrapping every slice separately. Keep slice creator types compatible with that
middleware composition. See [slices](https://zustand.docs.pmnd.rs/learn/guides/slices-pattern).

Call an action outside React through the correct store instance, or through an external function
that receives that instance. Reading `getState()` is an imperative snapshot, not a React
subscription. Use selectors for rendered values. Release manual subscriptions with the owning
component or service. Keep related state changes in the action that owns them. Do not add batching support for React versions before 18.

### Keep selector results stable

Select a primitive, stored entity, or stable action directly when that is all the consumer needs. `enforced-by: typescript/eslint no-restricted-syntax`
For computed tuples, arrays, or objects whose members remain shallowly equal, wrap the selector with
`useShallow` from a supported entry point such as `zustand/react/shallow`. Shallow equality compares
members; it does not repair in-place changes to nested objects.

In Zustand v5, allocating a new selector result on every read can cause an update loop, not merely
extra rendering. Keep fallback arrays, objects, and functions stable too. Do not return a newly
created empty callback whenever a stored action is absent.

Use the equality API supported by the installed version. Zustand v5's standard `create` does not `enforced-by: typescript/eslint no-restricted-syntax`
accept the older custom-equality argument. Use `useShallow` for shallow comparison, or the
appropriate `zustand/traditional` API and its required peer dependency when custom equality is
justified. See
[selector and equality migration](https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5).

### Hydrate persisted store state

Use `persist` with a unique storage name and a `partialize` allowlist of durable fields. Keep `enforced-by: typescript/eslint no-restricted-syntax`
actions, request flags, controllers, and credentials out of persisted data. Use explicit
serialization for Maps, Sets, and other values that ordinary JSON does not preserve.

Persist the current store shape. Reset disposable cached state when its shape changes instead of `enforced-by: typescript/eslint no-restricted-syntax`
adding versioned migrations or merge paths for older shapes. Keep user-authored data separate from disposable
cache state; move required records directly to the current shape. Handle missing, malformed, or
unavailable storage with the store's initial state.

Keep browser restoration separate from the initial server-compatible snapshot. Use `skipHydration` `enforced-by: typescript/eslint no-restricted-syntax`
and explicit `rehydrate()` where automatic restoration changes the first browser render. Track
hydration completion through supported callbacks or subscriptions; reading `hasHydrated()` once is
not a reactive subscription. Release hydration listeners when their owner unmounts.

On sign-out or identity changes, reset live private state and clear or partition its persisted copy.
Prevent a pending restoration from reapplying the previous identity's data. Clearing storage alone
does not reset the current in-memory store. Follow
[persisted-state hydration](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data).

### Synchronize store state with the URL

Let the URL own shareable navigation values, such as filters and sorting. Persist only a selected, `enforced-by: typescript/eslint no-restricted-syntax`
versioned representation; keep credentials, private drafts, and the full store out of shareable
URLs. Validate parsed values and handle missing or malformed input without assertions or unchecked
`JSON.parse` results.

Define precedence between URL values, stored preferences, and defaults. When the URL owns a value, `enforced-by: typescript/eslint no-restricted-syntax`
read back/forward navigation into the state owner. Use one synchronization path and compare values
before writing so store-to-URL and URL-to-store updates do not form a loop.

Preserve unrelated query parameters and fragments when updating a URL. Choose history replacement
for transient edits and a new history entry when back navigation restores the previous state.
Use the installed Next.js router's supported navigation or History API integration. Hash values are
browser-only inputs and cannot determine the initial server-rendered snapshot. Follow the
[URL-state guide](https://zustand.docs.pmnd.rs/learn/guides/connect-to-state-with-url-hash).

Check independent provider instances, route changes, nested updates, resets, and malformed stored or `enforced-by: typescript/eslint no-restricted-syntax`
URL state. For streaming collections, verify that an update reaches its entity's subscribers without
rerendering every row or changing another resource's state.
