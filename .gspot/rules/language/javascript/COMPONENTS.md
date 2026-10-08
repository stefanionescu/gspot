---
title: Components
---

# Components

These rules cover components in Astro, Svelte, Vue, and React.

## Props and tests

- Pass the fields a child reads. Avoid passing a whole store or parent object.
- Test a component through what the user sees and does, rather than its internal state.

## Component conventions

<!-- level: all -->

- One component has one job. Split a component when its markup holds two unrelated regions.
- Name a component in PascalCase and name the file the same.
