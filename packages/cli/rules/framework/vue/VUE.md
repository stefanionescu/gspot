---
layer: framework
configuration: vue
title: Vue
---

# Vue

These rules cover Vue 3 single-file components, reactivity, props and events, templates, and stores.

## Components

- Write components with `<script setup>`. Do not mix the Options API into a Composition API codebase.
- One component has one job. Split a component when its template holds two unrelated regions.
- Name a component with two words or more, in PascalCase, and name the file the same.
- Keep a template declarative. Move an expression longer than one operator into a computed value.
- Do not reach into a child with a template ref to change its state. Pass a prop or call an exposed method.

## Props and events

- Declare props and emits with types: `defineProps<Props>()` and `defineEmits<Emits>()`.
- Never mutate a prop. Emit an event, or use `defineModel` for a two-way value.
- A prop with no sensible default is required. An optional prop has a default.
- Name an event for what happened, in the past tense or as a noun: `saved`, `update:modelValue`.
- Do not pass a whole store or a whole parent object to a child that reads two fields.

## Reactivity

- Use `ref` for a value and `reactive` for an object that is never replaced. Do not destructure a reactive object.
- Derive with `computed`. Do not copy a prop or a computed value into a `ref` and sync it by hand.
- A `watch` is for an effect outside Vue: a request, a timer, storage. It is not for deriving state.
- Give `ref` a type when the initial value does not show it: `ref<User | null>(null)`.
- Clean up in `onUnmounted`, or in the cleanup callback of the watcher, whatever a component started.

## Templates

- Every `v-for` has a `:key` that is stable and unique. An index is not a key for a list that changes.
- Do not put `v-if` and `v-for` on one element. Filter in a computed value, or wrap with a template.
- Do not use `v-html` with a string a user can influence. Sanitize it on the server, or render text.
- A link that opens a new tab carries `rel="noopener noreferrer"`.
- A `<button>` states its `type`.
- Use the shorthand forms `:` and `@` everywhere, or nowhere.

## State and data

- Local state stays in the component. Shared state goes in a store, one store for each domain.
- A store exposes actions that say what happened. Components do not assign to store state.
- Fetch data in a composable or a store action, never inline in a template event.
- A composable is named `useThing`, returns refs, and cleans up what it starts.

## Accessibility and tests

- Every input has a label, every image has `alt`, and every interactive element is reachable by keyboard.
- Test a component through what the user sees and does, not through its internal refs.
- Test a composable as a function, with no component around it where it needs none.
