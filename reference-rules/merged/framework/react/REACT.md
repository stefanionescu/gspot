---
layer: framework
preset: nextjs
title: React
---

# React

Rules that hold for any React application: Next.js, Vite, Expo, or a library. The framework file
adds routing, server components, and caching on top of these.

## Components

- A component renders props and state. Data fetching, business rules, and persistence live in
  hooks, server modules, or the query layer, never in the render body. `enforced-by: typescript/eslint react-hooks/rules-of-hooks`
- One component per file, named for what it renders. The file is kebab-case and exports one
  PascalCase component. `enforced-by: typescript/eslint gspot/types-placement`
- Props are a `type` alias in `types/`; a component never takes an untyped object. `enforced-by: typescript/eslint gspot/types-placement`
- Compose downward: a component imports children and shared primitives, never its parent, its
  section, or its route. `enforced-by: typescript/eslint boundaries/element-types`
- Domain-neutral primitives (button, input, dialog, popover, tooltip) live in the shared UI owner
  and take values and callbacks. They never fetch or import a feature. `enforced-by: typescript/eslint boundaries/element-types`
- Keep a component small enough that its JSX reads as one screen region. Extract by visual
  responsibility, not by line count. `unenforced`
- No `React.FC`; declare the props type on the parameter. `enforced-by: typescript/eslint gspot/types-placement`
- No `dangerouslySetInnerHTML` outside one reviewed rendering adapter with a sanitizer. `enforced-by: typescript/eslint react/no-danger`

## Hooks

- Hooks are called unconditionally at the top of the component or hook, never in loops,
  conditions, or after an early return. `enforced-by: typescript/eslint react-hooks/rules-of-hooks`
- Every custom hook starts with `use` and owns one concern. `enforced-by: typescript/eslint react-hooks/rules-of-hooks`
- Every dependency the effect or callback reads is in its dependency list. Fix the closure, do
  not disable the lint rule. `enforced-by: typescript/eslint react-hooks/rules-of-hooks`
- Memoize (`useMemo`, `useCallback`, `memo`) when a measurement shows expensive work or a
  consumer needs a stable reference, not by default. `enforced-by: typescript/eslint react-hooks/rules-of-hooks`

## Effects and state

- Keep renders pure. Effects synchronize external systems; handlers own user-triggered work. Derive
  ordinary values during render rather than synchronizing duplicate state with effects. Clean up
  timers, observers, subscriptions, animation frames, and requests. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Include every required hook dependency. Fix callbacks that retain outdated values in the component
  or hook that creates them. `enforced-by: typescript/eslint react-hooks/rules-of-hooks`
- Memoize when measurements show expensive work or a consumer needs a stable reference. Use refs for
  mutable controller values and state for values displayed in the UI.
  `enforced-by: typescript/eslint react-hooks/rules-of-hooks`
- Give each state value one owner: URL for navigation, query cache for server snapshots, form/local
  state for editing, and client store for truly shared client state.
  `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Streaming/normalized stores need explicit reconciliation. Reset private state across identity and
  tenant changes; server stores are request-scoped.
  `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Handle every promise by awaiting, returning, or explicitly catching failure. A `void` expression
  alone does not handle rejection. Retries need a retry-safe operation and bounded policy.
  Cancellation must not look like confirmed success. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`

## Hydration and browser synchronization

Hydration attaches React behavior to the server-rendered HTML. Give the server and the first browser
render matching output. Browser storage, viewport dimensions, generated IDs, time zones, current
time, and random values can make them differ. Define when each value becomes available and how the
UI updates after hydration. Fix the mismatch instead of hiding warnings globally.

- Use deterministic initial props for server-rendered content. Read browser-only state after
  hydration or through a supported external-store pattern. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Use stable entity identifiers for data identity and React's supported ID mechanism for
  relationships between controls and labels. `enforced-by: typescript/eslint react/no-array-index-key`
- Give date/time formatting the same initial locale, time zone, and reference time where relative output otherwise differs. `unenforced`
- Do not branch rendered markup on `typeof window` as a routine hydration fix. Server and first
  browser output agree on the visible tree. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Theme initialization may need the theme library's documented early script and a narrow hydration
  exception. Keep that exception local to the affected node. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Do not mutate React-owned DOM to coordinate application state. Controlled state, refs, and
  third-party imperative APIs have explicit ownership boundaries. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Treat a hydration warning as a bug until its source and acceptable exception are identified. A
  development-only warning can reveal a production race. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`

## Lists and keys

- Keys are stable entity identifiers, never array indices for lists that reorder, filter, or
  grow. `enforced-by: typescript/eslint react/no-array-index-key`
- Virtualize only a list the browser cannot hold: an infinite feed or a message history. The
  framework file names the virtualizer. Subscribe rows by entity ID so one row's update does not
  rerender the list. `enforced-by: typescript/eslint react/no-array-index-key`

## Forms and inputs

- An input is controlled or uncontrolled, never both. Choose per form and keep it. `unenforced`
- Validation runs through the form library's resolver and the shared schema; the component
  renders field errors from the form state. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`
- Submission goes through one owner that awaits the real save and reports pending state from it. `enforced-by: typescript/eslint react-hooks/exhaustive-deps`

## Accessibility

- Interactive elements are native elements (`button`, `a`, `input`) or carry the matching role,
  keyboard handling, and focus management. `enforced-by: typescript/eslint jsx-a11y/alt-text`
- Every input has a label; every icon-only control has an accessible name; every image has `alt`. `enforced-by: typescript/eslint jsx-a11y/alt-text`
- Focus moves deliberately on route change, dialog open, and dialog close. `enforced-by: typescript/eslint jsx-a11y/alt-text`
