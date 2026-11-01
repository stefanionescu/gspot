# Svelte

Read this rule when you change Svelte components or SvelteKit routes.

## Runes and reactivity

- Use `$state` for a value that changes and `$derived` for one computed from others.
- Use `$effect` for work outside Svelte: a request, a timer, storage, or the DOM. Do not use it to derive state.
- An `$effect` that starts something returns a function that stops it.
- Keep derived expressions free of side effects. Do not mutate state while computing a derivation.
- Temporarily override a mutable `$derived` value for optimistic UI only in Svelte 5.25 and later. Reconcile it with the
  authoritative result and restore the prior value when the operation fails.
- Do not mix runes with `$:` statements or `export let` inside one component. Components using different supported modes
  can coexist during a migration.

## Props and events

- Declare props through `$props()` with a type. Require a prop when it has no sensible default.
- Never mutate a prop object. Call a callback prop, or use `$bindable` for a two-way value.

### Callback naming

<!-- level: all -->

Name a callback prop for what happened, such as `onsave` or `onclose`.

## Data loading and the server

- Load data in `load` functions, never in `onMount` for a page that can render on the server.
- Code under `$lib/server` and in `+page.server` files stays on the server. Do not import it from a component.
- Read a secret from `$env/static/private` or `$env/dynamic/private`, and only on the server.
- A form posts to a form action and works with JavaScript off. Enhance it; do not replace it.

## Accessibility

- Fix the compiler's accessibility warnings. Suppress one only with a reason.

## References

- [Derived state and temporary overrides](https://svelte.dev/docs/svelte/$derived).
- [Svelte 5 migration and component modes](https://svelte.dev/docs/svelte/v5-migration-guide).
