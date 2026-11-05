# Astro

Read this rule when you change Astro components, pages, or content collections.

## Components

<!-- level: all -->

- Keep the frontmatter to data: read the props, load what the page needs, and compute values. Move a helper of more than
  `{setting:limits.min_function_statements}` statements into a module.

## Frontmatter and props

- Declare the props as `type Props = { … }` in the frontmatter and read them from `Astro.props`.
- The frontmatter runs on the server. A value reaches the browser only through the markup or the props of an island.

## Islands

- Ship HTML by default. Add a `client:` directive only to a component that needs the browser.
- Pick the most deferred directive that works: `client:visible` or `client:idle` before `client:load`.
- `client:only` names the framework of the component, such as `client:only="react"`.
- Astro serializes island props, so pass plain data. A function or a class instance does not survive serialization.

## Markup

- Load a local image through `astro:assets`.
- Astro bundles a `<script>` without attributes into a module. Keep `is:inline` for code that must run before the page
  renders.

## Routing and data

- A page under `src/pages/` names its route by its path. A dynamic route of a static site exports `getStaticPaths`.
- Load content through a content collection with a schema, so a missing field fails the build.
- Read a secret on the server only, from a variable without the `PUBLIC_` prefix. Every visitor can read a `PUBLIC_`
  variable.
