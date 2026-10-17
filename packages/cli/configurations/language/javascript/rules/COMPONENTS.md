# Components

Read this rule when you change an Astro, Svelte, Vue, or React component.

## Props and tests

- Keep markup declarative. Move an expression longer than one operator into a derived value.
- Do not reach into a child to change its state.
- Do not copy a prop into local state and sync it by hand.
- Pass the fields a child reads. Avoid passing a whole store or parent object.
- Test a component through what the application shows and how the user acts, not its internal state.

## Component conventions

<!-- level: all -->

- One component has one job. Split a component when its markup holds two unrelated regions.
- Name a component in PascalCase and its file to match.
