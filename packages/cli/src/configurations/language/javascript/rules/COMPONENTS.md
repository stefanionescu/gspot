# Components

Read this rule when you change an Astro, Svelte, Vue, or React component.

## Props

- Keep markup declarative. Move an expression longer than one operator into a derived value.
- Do not change a child's state through a React ref, a Svelte `bind:this`, or a Vue template ref. Pass a prop or a
  callback.
- Do not copy a prop into local state and sync it by hand.
- Pass the fields a child reads. Avoid passing a whole store or parent object.

## Component conventions

<!-- level: all -->

- Split a component when its markup holds two unrelated regions.
- Name a component in PascalCase and its file to match.
