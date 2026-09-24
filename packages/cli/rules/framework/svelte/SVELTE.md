---
layer: framework
configuration: svelte
title: Svelte
---

# Svelte

These rules cover Svelte 5 components, runes, props and events, markup, and data loading in SvelteKit.

## Components

- One component has one job. Split a component when its markup holds two unrelated regions.
- Name a component in PascalCase and name the file the same.
- Keep markup declarative. Move an expression longer than one operator into a `$derived` value.
- Do not reach into a child with `bind:this` to change its state. Pass a prop or a callback.

## Runes and reactivity

- Use `$state` for a value that changes and `$derived` for a value computed from others.
- Do not copy a prop or a derived value into `$state` and sync it by hand.
- An `$effect` is for work outside Svelte: a request, a timer, storage, the DOM. It is not for deriving state.
- An `$effect` that starts something returns a function that stops it.
- Do not assign to a `$derived` value, and do not reassign state inside a derivation.
- Do not mix runes with `$:` statements and `export let` in one codebase.

## Props and events

- Declare props through `$props()` with a type. A prop with no sensible default is required.
- Never mutate a prop object. Call a callback prop, or use `$bindable` for a two-way value.
- Name a callback prop for what happened: `onsave`, `onclose`.
- Do not pass a whole store or a whole parent object to a child that reads two fields.

## Markup

- Every `{#each}` block over a list that changes has a key that is stable and unique.
- Do not use `{@html}` with a string a user can influence. Sanitize it on the server, or render text.
- A link that opens a new tab carries `rel="noopener noreferrer"`.
- A `<button>` states its `type`.
- Do not wrap a plain string in a mustache: write `class="card"`, not `class={"card"}`.

## Data loading and the server

- Load data in `load` functions, never in `onMount` for a page that can render on the server.
- Code under `$lib/server` and in `+page.server` files stays on the server. Do not import it from a component.
- Read a secret from `$env/static/private` or `$env/dynamic/private`, and only on the server.
- A form posts to a form action and works with JavaScript off. Enhance it, do not replace it.
- Validate what a `load` function or an action receives before it reaches a database or another service.

## Accessibility and tests

- Fix the accessibility warnings of the compiler. Do not silence them with an ignore comment.
- Every input has a label, every image has `alt`, and every interactive element is reachable by keyboard.
- Test a component through what the user sees and does, not through its internal state.
