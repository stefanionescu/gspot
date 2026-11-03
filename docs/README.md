# Documentation site

The documentation site uses Astro Starlight.

## Setup

`mise run setup` installs the packages and writes the site types. `mise run docs:serve` serves the site and rebuilds
a page when you save a file. `mise run docs:build` builds it into `docs/dist`.
Write guides in `src/content/docs/`. The code in `src/reference/` builds the command, configuration, check,
settings, and ESLint plugin reference pages from the implementation. `src/config/site.ts` holds the sidebar.

## Deployment

Run `mise run docs:deploy` to build and deploy the site to the `gspot-docs` Worker at `generativespotting.com`, with
your Wrangler login. This task publishes documentation without publishing npm packages. The release workflow also
deploys the site, with the `CLOUDFLARE_API_TOKEN` secret, when `mise run release` pushes a CLI tag.

## Asset licenses

Keep the required notices with every distributed copy of the assets.

- Tool logos come from Simple Icons 16.33.0 under CC0-1.0, except the marks of Gitleaks, ShellCheck, TypeScript, and
  the Open Source Vulnerabilities (OSV) scanner. The owners hold the trademarks for these names and logos.
- The Gitleaks logo, from `gitleaks.io`: [Gitleaks license notice](public/licenses/gitleaks.txt).
- The OSV-Scanner icon, from its repository: [OSV-Scanner license notice](public/licenses/osv-scanner.txt).
- The ShellCheck icon: [ShellCheck license notice](public/licenses/shellcheck.txt).
- The TypeScript mark, from the TypeScript branding page: [TypeScript brand terms](public/licenses/typescript.txt).
- The home page layout adapts the Turborepo homepage: [Turborepo license notice](public/licenses/turborepo.txt).
- The site self-hosts Geist Sans and Geist Mono from pinned Fontsource packages. The build keeps each font license
  under `licenses/` in the output.
