---
title: React
---

# React

Rules that hold for any React application: Next.js, Vite, Expo, or a library. The framework file
adds routing, server components, and caching on top of these.

## Components

- A component renders props and state. Data fetching, business rules, and persistence live in
  hooks, server modules, or the query layer, never in the render body.
- Props have a type beside their component; a component never takes an untyped object.

### Component conventions

<!-- level: all -->

- Compose downward: a component imports children and shared primitives, never its parent, its
  section, or its route.
- Domain-neutral primitives (button, input, dialog, popover, tooltip) live in the shared UI owner
  and take values and callbacks. They never fetch or import a feature.
- Keep a component small enough that its JSX reads as one screen region. Extract by visual
  responsibility, not by line count.

- Keep one primary component per file and name it for what it renders.
- Declare the props type on the parameter rather than using `React.FC`.

## Hooks

- Every custom hook starts with `use` and owns one concern.
- Memoize (`useMemo`, `useCallback`, `memo`) when a measurement shows expensive work or a
  consumer needs a stable reference, not by default.

## Effects and state

- Keep renders pure. Effects synchronize external systems; handlers own user-triggered work. Derive
  ordinary values during render rather than synchronizing duplicate state with effects. Clean up
  timers, observers, subscriptions, animation frames, and requests.
- Use refs for mutable controller values and state for values displayed in the UI.

- Give each state value one owner: URL state for navigation, query cache for server snapshots, form/local
  state for editing, and client store for truly shared client state.

- Reset private state across identity and tenant changes; server stores are request-scoped.

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
- An optimistic update defines how to merge the confirmed result and undo a failed operation.
  Preserve later confirmed changes during rollback. Use operation IDs or versions when writes can
  overlap, and test two overlapping edits.
- A mutation's completion covers its required cache updates. Treat a committed write and a failed
  refresh as separate outcomes rather than retrying the write.

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
- Treat a hydration warning as a bug until its source and acceptable exception are identified. A
  development-only warning can reveal a production race.

## Lists and keys

- Keys are stable IDs, never indices.
- Virtualize a list only when it can grow without bound. Subscribe rows by entity ID so one
  row's update does not rerender the list.

## Forms and inputs

- An input is controlled or uncontrolled, never both. Choose per form and keep it.
- Validate input against the declared contract and expose its errors to the user. When a form
  library is selected, use its supported validation and state APIs.
- Submission goes through one owner that awaits the real save and reports pending state from it.

## Accessibility

- Interactive elements are native elements (`button`, `a`, `input`) or carry the matching role,
  keyboard handling, and focus management.
