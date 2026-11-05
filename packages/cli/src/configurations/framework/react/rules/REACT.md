# React

Read this rule when you change React components, hooks, or state.

## Components

- A component renders props and state. Data fetching, business rules, and persistence live in hooks, server modules, or
  the query layer, never in the render body.
- Props have a type beside their component; a component never takes an untyped object.

### Component conventions

<!-- level: all -->

- Compose downward: a component imports children and shared primitives, never its parent, its section, or its route.
- Domain-neutral primitives such as button, input, dialog, popover, and tooltip live in one UI folder, such as
  `src/ui/`, and take values and callbacks. They never fetch or import a feature.
- Declare the props type on the parameter rather than using `React.FC`.

## Hooks

- Every custom hook starts with `use` and owns one concern.
- Memoize with `useMemo`, `useCallback`, or `memo` only when a measurement shows expensive work or a consumer needs a
  stable reference.

## Effects and state

- Keep renders pure. Effects synchronize external systems; handlers own user-triggered work. Derive ordinary values
  during render rather than synchronizing duplicate state with effects. Clean up timers, observers, subscriptions,
  animation frames, and requests.
- Use refs for mutable controller values and state for what the UI displays.
- Give each state value one place. Navigation goes in the URL, server snapshots in the query cache, edits in form or
  local state, and shared data in a client store.
- Reset private state across identity and tenant changes; give each request its own server stores.
- Do not show a cancellation as a confirmed success.

## Read states and writes

- Keep the first pending load, an empty result, and a failed request distinct. Show a stable fallback, an explanation of
  the empty result, or safe error and retry UI for the matching state.
- Keep existing content during a background refresh or a pending next page. A failed refresh does not erase a successful
  result. Revoked access removes stale private content.
- An optimistic update defines how to confirm or undo the operation.
- Show the result of a save apart from that of a refresh.

## URL state

- The URL owns filters, sorting, and other shareable navigation values. It carries a minimal, versioned representation,
  never credentials, private drafts, or the whole store.
- Validate parsed values, and handle missing or malformed input without assertions or an unchecked `JSON.parse`.
- Define the precedence among URL values, stored preferences, and defaults. When the URL owns a value, back and forward
  navigation reach the code that holds it.
- One synchronization path compares values before writing, so store-to-URL and URL-to-store updates never loop.
- Keep unrelated query parameters and fragments. Use the installed router or the History API to replace history for
  transient edits and to push an entry when back navigation restores the previous state.
- Read hash values only in the browser. Never use them to shape the server-rendered snapshot.

## Lists

- Virtualize a list only when it can grow without bound. Subscribe to the data each row needs.

## Forms and inputs

- Keep each input controlled or uncontrolled, never both. Choose per form and keep it.
- Validate input against the declared contract and expose its errors to the user. When the application has a form
  library, use its supported validation and state APIs.
- A form awaits the save and reports its result.
