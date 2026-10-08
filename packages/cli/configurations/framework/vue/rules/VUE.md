---
title: Vue
---

# Vue

These rules cover Vue 3 single-file components, reactivity, props and events, templates, and stores.

## Components

<!-- level: all -->

- Keep a template declarative. Move an expression longer than one operator into a computed value.
- Do not reach into a child with a template ref to change its state. Pass a prop or call an exposed method.

## Props and events

- A prop is required when the component cannot operate without it. An optional prop can remain
  undefined when absence has defined behavior; supply a default only when that matches the contract.

### Event naming

<!-- level: all -->

Name an event for what happened, in the past tense or as a noun: `saved`, `update:modelValue`.

## Reactivity

- Use `ref` for a value and `reactive` for an object that is never replaced. Do not destructure a reactive object.
- Derive with `computed`. Do not copy a prop or a computed value into a `ref` and sync it by hand.
- A `watch` is for an effect outside Vue: a request, a timer, storage. It is not for deriving state.
- Clean up in `onUnmounted`, or in the cleanup callback of the watcher, whatever a component started.

## State and data

<!-- level: all -->

- Local state stays in the component. Shared state goes in a store, one store for each domain.
- A store exposes actions that say what happened. Components do not assign to store state.
- Fetch data in a composable or a store action, never inline in a template event.
- A composable is named `use` and its subject, such as `useCart`, and returns reactive values when callers need reactivity.

## Accessibility and tests

- Test a composable as a function, with no component around it where it needs none.
