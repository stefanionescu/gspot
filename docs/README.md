# Documentation Site

The documentation site uses Astro Starlight.

## Setup

Run `mise tasks` from the repository root to list the tasks that set up, serve, build, and deploy the site.
Write guides in `src/content/docs/`. The code in `src/reference/` builds the command, configuration, check,
settings, and ESLint plugin reference pages from the implementation. `src/config/navigation.ts` holds the sidebar.

## Deployment

The release deploys the site to the `gspot-docs` Worker at `generativespotting.com`, with the Wrangler login of the
person who releases.

## Asset licenses

Keep the required notices with every distributed copy of the assets.

- Tool logos use Simple Icons 16.33.0, CC0-1.0. The owners hold the trademarks for these names and logos.
- [Semgrep license notice](public/licenses/semgrep.txt).
- [ShellCheck license notice](public/licenses/shellcheck.txt).
- [Turborepo license notice](public/licenses/turborepo.txt).
- The site self-hosts Geist Sans and Geist Mono from pinned Fontsource packages. The build keeps each font license
  under `licenses/` in the output.
