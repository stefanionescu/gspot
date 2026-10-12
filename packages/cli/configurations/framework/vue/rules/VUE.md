# Vue

These rules cover Vue 3 single-file components, reactivity, props and events, templates, and stores.

## Components

<!-- level: all -->

- Use `computed` for derived template values.
- Pass a prop or call an exposed method instead of changing state through a template ref.

## Props and events

- Require a prop when the component cannot operate without it. An optional prop can remain
  undefined when absence has defined behavior; supply a default only when that matches the contract.

### Event naming

<!-- level: all -->

Name an event for what happened, in the past tense or as a noun: `saved`, `update:modelValue`.

## Reactivity

- Use `ref` for a value and `reactive` for an object that keeps the same identity. Do not destructure a reactive object.
- Derive with `computed`.
- Use `watch` for an effect outside Vue: a request, a timer, storage. Do not use it to derive state.
- Clean up in `onUnmounted`, or in the cleanup callback of the watcher, whatever a component started.

## State and data

<!-- level: all -->

- Local state stays in the component. Shared state goes in a store, one store for each domain.
- A store exposes actions that say what happened. Components do not assign to store state.
- Fetch data in a composable or a store action, never inline in a template event.
- Name a composable `use` and its subject, such as `useCart`, and returns reactive values when callers need reactivity.

## Tests

- Test a composable as a function, with no component around it where it needs none.
