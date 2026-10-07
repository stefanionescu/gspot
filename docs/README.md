# gspot Documentation

The documentation site uses Astro Starlight.

## Setup

Run `mise run setup` from the repository root. Use `mise run dev` to preview the site and
`mise run build:docs` to build it. Reference pages come from the CLI contracts in
`docs/src/content/reference/`.

## Asset licenses

Keep these notices with every distributed copy of the assets.

- The homepage layout adapts the
  [Turborepo homepage source](https://github.com/vercel/turborepo/tree/1dead3cc9d421e61327a13cb44a590e8e218793f/apps/docs/app/%5Blang%5D/%28home%29)
  to Astro components. Its [MIT notice](public/licenses/turborepo.txt) ships with the site.
- The site self-hosts Geist Sans and Geist Mono from the pinned Fontsource packages. The site
  build keeps each package license under `licenses/` in the output.
