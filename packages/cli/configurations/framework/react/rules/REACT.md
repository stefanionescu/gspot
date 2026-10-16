# React

Read this rule when you change React components, hooks, or state.

## Components

- A component renders props and state. Data fetching, business rules, and persistence live in
  hooks, server modules, or the query layer, never in the render body.
- Props have a type beside their component; a component never takes an untyped object.

### Component conventions

<!-- level: all -->

- Compose downward: a component imports children and shared primitives, never its parent, its
  section, or its route.
- Domain-neutral primitives such as button, input, dialog, popover, and tooltip live in the shared UI folder
  and take values and callbacks. They never fetch or import a feature.
- Keep a component small enough that its JSX reads as one screen region. Extract by visual
  responsibility, not by line count.

- Keep one primary component per file and name it for what it renders.
- Declare the props type on the parameter rather than using `React.FC`.

## Hooks

- Every custom hook starts with `use` and owns one concern.
- Memoize with `useMemo`, `useCallback`, or `memo` only when a measurement shows expensive work or a consumer
  needs a stable reference.

## Effects and state

- Keep renders pure. Effects synchronize external systems; handlers own user-triggered work. Derive
  ordinary values during render rather than synchronizing duplicate state with effects. Clean up
  timers, observers, subscriptions, animation frames, and requests.
- Use refs for mutable controller values and state for values displayed in the UI.

- Give each state value one place: URL state for navigation, query cache for server snapshots, form/local
  state for editing, and client store for truly shared client state.

- Reset private state across identity and tenant changes; give each request its own server stores.

- Handle every promise by awaiting, returning, or explicitly catching failure. A `void` expression
  alone does not handle rejection. Retries need a retry-safe operation and bounded policy.
  Cancellation must not look like confirmed success.

## Read states and writes

- Keep the first pending request, an empty result, and a failed request distinct. Show a stable
  fallback, an explanation of the empty result, or safe error and retry UI for the matching state.
- Keep existing content during a background refresh or a pending next page. A failed refresh does
  not erase a successful result. Revoked access removes stale private content.
- Capture the resource identity when work starts. A superseded request must not overwrite the
  currently selected resource.
- An optimistic update defines how to confirm or undo the operation.
- Present the result of a save separately from the result of a refresh.

## URL state

- The URL owns filters, sorting, and other shareable navigation values. It carries a selected,
  versioned representation, never credentials, private drafts, or the whole store.
- Validate parsed values, and handle missing or malformed input without assertions or an unchecked
  `JSON.parse`.
- Define the precedence among URL values, stored preferences, and defaults. When the URL owns a
  value, back and forward navigation reach the code that holds that value.
- One synchronization path compares values before writing, so store-to-URL and URL-to-store updates
  never loop.
- Keep unrelated query parameters and fragments. Use the installed router or the History API to replace history for transient edits and to push an entry when back navigation restores the previous state.
- Read hash values only in the browser. Never use them to shape the server-rendered snapshot.

## Hydration and browser synchronization

Hydration attaches React behavior to the server-rendered HTML. Give the server and the first browser
render matching output. Browser storage, viewport dimensions, generated IDs, time zones, current
time, and random values can make them differ. Define when each value becomes available and how the
UI updates after hydration. Fix the mismatch instead of hiding warnings globally.

- Use deterministic initial props for server-rendered content. Read browser-only state after
  hydration or through a supported external-store pattern.
- Use stable entity identifiers for data identity and the supported React ID mechanism for
  relationships between controls and labels.
- Give date/time formatting the same initial locale, time zone, and reference time where relative output otherwise differs.
- Do not branch rendered markup on `typeof window` as a routine hydration fix. Server and first
  browser output agree on the visible tree.
- Theme initialization may need the theme library's documented early script and a narrow hydration
  exception. Keep that exception local to the affected node.
- Do not mutate React-owned DOM to coordinate application state. Controlled state, refs, and
  third-party imperative APIs have explicit ownership boundaries.
- Treat a hydration warning as a bug until you identify its source and justify an exception. A
  development-only warning can reveal a production race.

## Lists and keys

- Use stable IDs for keys, never indices.
- Virtualize a list only when it can grow without bound. Subscribe to the data each row needs.

## Forms and inputs

- Keep each input controlled or uncontrolled, never both. Choose per form and keep it.
- Validate input against the declared contract and expose its errors to the user. When the application uses a form
  library, use its supported validation and state APIs.
- A form awaits the save and reports its result.
