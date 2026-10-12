# Components

These rules cover components in Astro, Svelte, Vue, and React.

## Props and tests

- Keep markup declarative. Move an expression longer than one operator into a derived value.
- Do not reach into a child to change its state.
- Do not copy a prop into local state and keep the copy updated by hand.
- Pass the fields a child reads. Avoid passing a whole store or parent object.
- Test a component through what the application shows to the user and how the user acts, rather than its internal state.

## Component conventions

<!-- level: all -->

- One component has one job. Split a component when its markup holds two unrelated regions.
- Name a component in PascalCase and name the file the same.
