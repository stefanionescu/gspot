# Vue

Read this rule when you change Vue components, composables, or stores.

## Props and events

- Require a prop when the component cannot operate without it. An optional prop can remain undefined when absence has
  defined behavior; supply a default only when that matches the contract.

### Event naming

<!-- level: all -->

Name an event for what happened, in the past tense or as a noun, such as `saved` or `update:modelValue`.

### Component conventions

<!-- level: all -->

- Write each component with `<script setup>`.
- Name each component with two or more words, such as `TodoItem.vue`.

## Reactivity

- Use `ref` for a value and `reactive` for an object that keeps the same identity. Do not destructure a reactive object.
- Derive with `computed`.
- Use `watch` for an effect outside Vue: a request, a timer, or storage. Do not use it to derive state.
- Stop whatever a component started in `onUnmounted` or in the cleanup callback of the watcher.

## State and data

<!-- level: all -->

- Local state stays in the component. Shared state goes in a store, one per domain.
- A store exposes actions named for their domain operation, such as `addItem`. Components do not assign to store state.
- Fetch data in a composable or a store action, never inline in a template event.
- Name a composable `use` and its subject, such as `useCart`. Return reactive values when callers need reactivity.

## Tests

- Test a composable as a function, with no component around it where it needs none.
