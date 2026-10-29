# Documentation Site

The documentation site uses Astro Starlight.

## Setup

`mise run setup` installs the packages and writes the site types. `mise run docs:serve` serves the site and rebuilds
a page when you save a file. `mise run docs:build` builds it into `docs/dist`.
Write guides in `src/content/docs/`. The code in `src/reference/` builds the command, configuration, check,
settings, and ESLint plugin reference pages from the implementation. `src/config/navigation.ts` holds the sidebar.

## Deployment

Run `mise run docs:deploy` to build and deploy the site to the `gspot-docs` Worker at `generativespotting.com`, with
your Wrangler login. This task publishes documentation without publishing npm packages. The release task also deploys
the site.

A Cloudflare rule on the zone serves `<path>index.md` when a request accepts `text/markdown`. `public/_headers` sends
`Vary: Accept` for it. Keep the rule when you move the site.

## Asset licenses

Keep the required notices with every distributed copy of the assets.

- Tool logos, except Semgrep and ShellCheck, come from Simple Icons 16.33.0 under CC0-1.0. The owners hold the trademarks
  for these names and logos.
- The Semgrep logo: [Semgrep license notice](public/licenses/semgrep.txt).
- The ShellCheck icon: [ShellCheck license notice](public/licenses/shellcheck.txt).
- The home page layout adapts the Turborepo homepage: [Turborepo license notice](public/licenses/turborepo.txt).
- The site self-hosts Geist Sans and Geist Mono from pinned Fontsource packages. The build keeps each font license
  under `licenses/` in the output.
