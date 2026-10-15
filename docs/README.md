# gspot Documentation

The documentation site uses Astro Starlight.

## Setup

Run `mise run setup` from the repository root. Use `mise run serve:docs` to preview the site and
`mise run build:docs` to build it. Write the pages in `src/content/docs/` by hand. The code in `src/reference/` builds the reference pages
at build time from the CLI's commands, its configuration manifests, the gspot.toml schema, and the ESLint plugin
rules. Do not write reference pages by hand.

## Deployment

The mise install path selects a release 24 hours after you publish it.

The `docs` workflow builds the published stable release tag and keeps its site artifact for one day.
Download that run's `documentation-<run-id>` artifact into `docs/dist` in a checkout of the same release tag.
Use the authenticated Cloudflare account, then run this command from `docs/`:

```shell
bun run wrangler deploy
```

Wrangler deploys the artifact to the `gspot-docs` Worker at `generativespotting.com`.

## Asset licenses

Keep these notices with every distributed copy of the assets.

- The homepage layout adapts the
  [Turborepo homepage source](https://github.com/vercel/turborepo/tree/1dead3cc9d421e61327a13cb44a590e8e218793f/apps/docs/app/%5Blang%5D/%28home%29)
  to Astro components. Its [MIT notice](public/licenses/turborepo.txt) ships with the site.
- The site self-hosts Geist Sans and Geist Mono from the pinned Fontsource packages. The site
  build keeps each package license under `licenses/` in the output.
