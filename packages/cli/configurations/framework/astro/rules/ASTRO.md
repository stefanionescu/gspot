---
title: Astro
---

# Astro

These rules cover Astro components, islands, markup, routing, and the data a page loads.

## Components

<!-- level: all -->

- One component has one job. Split a component when its markup holds two unrelated regions.
- Name a component in PascalCase and name the file the same.
- Keep the frontmatter to data: read the props, load what the page needs, and compute values.
  Move a helper longer than a few lines into a module.

## Frontmatter and props

- Declare the props as `type Props = { … }` in the frontmatter and read them from `Astro.props`.
- The frontmatter runs on the server. A value reaches the browser only through the markup or the props of an island.

## Islands

- Ship HTML by default. Add a `client:` directive only to a component that needs the browser.
- Pick the most deferred directive that works: `client:visible` or `client:idle` before `client:load`.
- `client:only` names the framework of the component, such as `client:only="react"`.
- The props of an island are serialized, so pass it plain data. A function or a class instance does not survive the trip.

## Markup

- Load a local image through `astro:assets`.
- A `<script>` without attributes is bundled into a module. Keep `is:inline` for code that must run before the page renders.

## Routing and data

- A page under `src/pages/` names its route by its path. A dynamic route of a static site exports `getStaticPaths`.
- Load content through a content collection with a schema, so a missing field fails the build.
- Read a secret on the server only, from a variable without the `PUBLIC_` prefix. Every visitor sees a `PUBLIC_` variable.
- Validate what an endpoint or an action receives before it reaches a database or another service.

## Accessibility and tests

- Test the HTML a component renders, not the code inside it.

## References

- [Astro components](https://docs.astro.build/en/basics/astro-components/).
- [Client directives](https://docs.astro.build/en/reference/directives-reference/#client-directives).
- [Content collections](https://docs.astro.build/en/guides/content-collections/).
