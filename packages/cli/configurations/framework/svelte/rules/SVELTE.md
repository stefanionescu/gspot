---
title: Svelte
---

# Svelte

These rules cover Svelte 5 components, runes, props and events, markup, and data loading in SvelteKit.

## Components

<!-- level: all -->

- Keep markup declarative. Move an expression longer than one operator into a `$derived` value.
- Do not reach into a child with `bind:this` to change its state. Pass a prop or a callback.

## Runes and reactivity

- Use `$state` for a value that changes and `$derived` for a value computed from others.
- Do not copy a prop or a derived value into `$state` and sync it by hand.
- An `$effect` is for work outside Svelte: a request, a timer, storage, the DOM. It is not for deriving state.
- An `$effect` that starts something returns a function that stops it.
- Keep derived expressions free of side effects. Do not mutate state while computing a derivation.
- A mutable `$derived` value can be temporarily overridden for optimistic UI in Svelte 5.25 and later.
  Reconcile it with the authoritative result and restore the prior value when the operation fails.
- Do not mix runes with `$:` statements or `export let` inside one component.
  Components using different supported modes can coexist during a migration.

## Props and events

- Declare props through `$props()` with a type. A prop with no sensible default is required.
- Never mutate a prop object. Call a callback prop, or use `$bindable` for a two-way value.

### Callback naming

<!-- level: all -->

Name a callback prop for what happened: `onsave`, `onclose`.

## Data loading and the server

- Load data in `load` functions, never in `onMount` for a page that can render on the server.
- Code under `$lib/server` and in `+page.server` files stays on the server. Do not import it from a component.
- Read a secret from `$env/static/private` or `$env/dynamic/private`, and only on the server.
- A form posts to a form action and works with JavaScript off. Enhance it, do not replace it.
- Validate what a `load` function or an action receives before it reaches a database or another service.

## Accessibility and tests

- Fix the compiler's accessibility warnings. Suppress one only with a reason.

## References

- [Derived state and temporary overrides](https://svelte.dev/docs/svelte/$derived).
- [Svelte 5 migration and component modes](https://svelte.dev/docs/svelte/v5-migration-guide).
