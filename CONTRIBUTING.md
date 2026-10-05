# Contributing

You work on gspot in a source checkout with [mise](https://mise.jdx.dev). Every task below runs
on your machine.

## Setup

You need Git, a Bash shell, and mise 2026.8.8 or newer. mise pins Bun and Node for the checkout.
Run every command from the root of the checkout.

```sh
git clone https://github.com/stefanionescu/gspot.git
cd gspot
mise install
mise run setup
```

`setup` installs the locked dependencies and prepares the parser assets. It also builds
the ESLint plugin of the workspace and generates the content types the documentation build
reads. After you change the plugin, run `mise run build:plugin` before the repository
checks.

## Run gspot from source

In this checkout, `mise exec -- gspot <command>` runs gspot from source, without a build. The
checkout's Git hooks reach the same source through `scripts/gspot`, and mise puts the `scripts`
folder on `PATH`. Activate mise in your shell before you commit, or run Git through `mise exec -- git`. To
check which gspot the hooks find:

```sh
mise exec -- which gspot
mise exec -- gspot --version
```

`mise.toml` holds the runtimes and the tasks of the checkout. gspot writes its tool pins to
`.mise/conf.d/gspot-tools.toml`.

`mise.test.toml` pins the remaining tools for testing every supported configuration. It omits tools
already pinned in `.mise/conf.d/gspot-tools.toml`. The calculation compares tool names. A different version or option does not create a second pin.

`mise run pin:test-tools` generates it from configuration
manifests and the adapter-test versions in `scripts/config/test-tools.ts`. CI verifies that the
committed file matches that calculation. `mise run check:pins` verifies that declared
releases exist, that ESLint plugins accept the pinned ESLint version, and that shipped presets match their declared pins.

After changing an ESLint preset or its package pin, run `mise run pin:eslint-presets` with the
required pinned packages already installed in `.gspot`. The task captures the preset data in
each owning configuration. Normal CLI builds and `check:pins` validate that data without
installing tools or refreshing it.

The maintenance commands live directly under `scripts/`. `scripts/registry/` owns the disposable
registries used by source and package tests. `scripts/gspot` and `scripts/gspot.cmd` launch
the source CLI for development hooks on Unix and Windows.

The authored root `tsconfig.json` selects workspace sources and declares their import aliases
and module resolution. gspot generates `.gspot/config/tsconfig.json`, which extends that file
and applies the selected checking flags. Those flags belong to the generated configuration;
the workspace layout remains authored.

## Build

```sh
mise run build:cli
mise run build:plugin
```

`build:cli` writes the `@gspothq/cli` package to `packages/cli/dist/`: `gspot.js`, the command, and
`worker.js`, which resolves active ESLint rules for coverage in its own process. The package also
ships `packages/cli/configurations/`, including its agent rules, and `packages/cli/grammars/`.
`build:plugin` writes the ESLint plugin to `packages/eslint-plugin/dist/`. The two builds do
not depend on each other. To run the build under Node:

```sh
node packages/cli/dist/gspot.js --version
```

`setup` copies the installed parser grammars and runtime WebAssembly files into
`packages/cli/grammars/`, with their licenses. It also downloads the pinned Swift 0.7.3 parser
and verifies its SHA-256. Source commands and packaged builds read these prepared assets.
The build does not download or generate grammars.

## Dependency overrides

The root `package.json` pins these indirect dependencies to releases with security fixes.
Their parent packages still permit or require affected versions. `bun.lock` records the
resolved versions; the overrides also protect the next lock resolution.

| Override                                                        | Why it remains                                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brace-expansion@1` → `1.1.21`, `@2` → `2.1.7`, `@5` → `5.0.12` | The minimatch branches still permit older releases affected by the [brace-expansion CPU exhaustion advisory](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr). |
| `fast-uri@3` → `3.1.8`                                          | Ajv permits releases before the fix for [inconsistent host normalization](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj).                                    |
| `ip-address` → `10.7.1`                                         | Socks permits releases before the fix for [address-family comparison](https://github.com/advisories/GHSA-j6r3-76f7-8jcv).                                        |
| `js-yaml@5` → `5.4.1`                                           | Verdaccio's configuration package requires `5.2.2`, before the fix for [CPU exhaustion during YAML merges](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm).   |
| `lodash` → `4.18.1`                                             | Lowdb permits older Lodash 4 releases affected by [code injection through template imports](https://github.com/advisories/GHSA-r5fr-rjxr-66jc).                  |
| `minimatch@9` → `9.0.9`                                         | Import-x and the Jest glob dependencies permit releases before the fix for [excessive glob backtracking](https://github.com/advisories/GHSA-7r86-cg39-jmmj).     |
| `qs` → `6.16.0`                                                 | Express and the Cypress request package permit or require releases affected by the [array-limit bypass](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx).      |
| `undici@7` → `7.29.1`                                           | Miniflare requires `7.29.0`, before the fix for [unreleased retry response bodies](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x).                           |

Review an override when you upgrade its parent dependencies. Remove it when every parent
requires a version that fixes the linked advisory. Resolve the lock without that override,
then run `mise exec -- gspot check --only dependencies/osv` and the affected tests. Keep the
override if resolution restores an affected version or changes behavior the tests require.

## Source ownership

Keep constants in each package's `src/config/` and types in `src/types/`, grouped by their
behavioral owner. Test data and contracts belong in `tests/config/` and `tests/types/`.
Automation uses `scripts/config/` and `scripts/types/`. These requirements apply to the gspot
checkout. Repositories that use gspot choose their own folder layout.

Keep format parsers in `packages/cli/src/parsers/` and policy schemas in
`packages/cli/src/policy/schema/`. Built-in setup assets belong in
`packages/cli/configurations/`, including the Markdown rules installed for coding agents.

`packages/cli/configurations/language/javascript/eslint-all-rules.json` lists the ESLint
rules reserved for `all`. The generator reads each gspot rule's level from the plugin's
metadata. Experimental rules stay disabled. The adjacent `eslint-rule-names.json` records
the core rule names in the pinned ESLint release, so `gspot explain` recognizes raw core
rule IDs without loading ESLint. The explicit preset producer refreshes this catalog and
the shipped preset snapshots. Normal builds validate their pins without installing tools.

The adjacent `runtime-names.json` records the names available in the pinned `globals`
package. `packages/cli/src/policy/schema/tools.ts` validates runtime names against that data. Policy validation reads
that shipped data without installing ESLint tools; its CLI test rejects drift when the
pin changes. The data schemas live in `packages/cli/src/parsers/schema/eslint.ts`.

## Verification

Run these tasks before a commit, in this order. Fix the failures of each task before running the next one.

The tests check the Bun version against `package.json` at startup. A plain `bun test` can pick an older Bun from your
`PATH`.

| Task                       | What it verifies                                                           |
| -------------------------- | -------------------------------------------------------------------------- |
| `mise run check:types`     | TypeScript in the workspace and in the documentation site.                 |
| `mise run test`            | CLI and plugin behavior, without native tools or the network.              |
| `mise run test:tools`      | Native tools and sample repositories, through a local registry.            |
| `mise run test:package`    | The two npm packages, built, published to a local registry, and installed. |
| `mise exec -- gspot check` | The checks of this repository, run from source.                            |

Tests use workspace dependencies and do not require installing this checkout's checks.
Run `mise run setup` to prepare dependencies, parsers, and the plugin. Each native fixture
installs its own private tool projects through the public commands.

The tool suite needs the full set of tools declared in `mise.test.toml`.
Install them with `MISE_ENV=test mise install`. This suite can download packages. The tool runner serves the plugin built by `setup` from a local
registry, which it removes when the run ends. Rebuild the plugin after changing its source.

The Supabase tests need Supabase CLI 2.72.7
and a running Docker daemon. The XCTest coverage tests need macOS with Xcode selected by
`xcode-select`.

The full tool suite stops after 90 minutes. The test runner gives CLI and plugin tests a 60-second budget. Tool and package tests have a 900-second budget. Subprocess deadlines use the remaining test budget. To run
some of it, put files or folders after a second `--`:

```sh
mise run test:tools -- -- ./tools/configurations/language/css.test.ts ./tools/commands/commit-hook.test.ts
```

The runners forward Bun options before the second `--`. Options alone select the whole named suite.
For example, select one tool test and filter its test names:

```sh
mise run test:tools -- --test-name-pattern 'native' -- ./tools/checks/lockfile-fresh.test.ts
```

Use the same separator for package tests:

```sh
mise run test:package -- --test-name-pattern 'installed plugin' -- ./packages/plugin.test.ts
```

Some tool installers download a binary from GitHub. Without a token, GitHub allows 60 requests
an hour, which a cold install can use up. Before a tool run, set `GITHUB_TOKEN` to a
token that can read public releases.

`test:package` builds `@gspothq/cli` and uses the plugin built by `setup`. It publishes both to a local
registry, installs them into new projects, and runs real findings and fixes under Node.

## Tests

The tests live in `tests`, one folder per suite, from the fastest to the slowest:

- `cli` tests CLI modules and commands over temporary repositories.
- `plugin` tests ESLint rules and configuration.
- `tools` runs native tools and the source CLI over sample repositories through a local registry.
- `packages` installs the built packages and runs them under Node.

Organize each suite by the behavior it verifies. Keep test registration and assertions in test owners. Shared support has explicit owners:

- `harness`: reusable repository and command support, the Bun preload, and shared assertions in `tests/harness/expectations.ts`.
- `config`: static values and sample sources, including `config/samples`.
- `types`: shared test contracts.

Put each scenario in the cheapest suite that can prove its behavior. CLI and plugin tests use no native tools. Tool tests use source code, and package tests use the built release.

## Documentation

The documentation site uses Astro Starlight. Preview it with `mise run dev`, and build it
with `mise run build:docs`, which also checks local links and fragments. The reference pages
come from the CLI help, the policy schema, the configuration manifests, and the plugin rules, so change
those owners rather than a page.

The docs package declares its native Markdown processor, `satteri`, directly. The prerender environment keeps that loader external, so it resolves its platform binary from the installed package instead of from a generated Vite chunk.

The homepage and the README show one recorded example, stored in
`docs/src/config/example.json`. `tests/tools/commands/example.test.ts`
writes the recorded policy and source into a temporary repository, then checks the recorded findings. It does not replay every interactive setup step or prove all console output in the tutorial.

## Policy and generated files

`gspot.toml` is the policy of this repository. Change it with `gspot set`, `gspot ignore`,
`gspot add`, or `gspot remove`, then run `mise exec -- gspot apply` to write the files under `.gspot/`
again. Do not edit a generated file by hand. `gspot/drift` reports a generated
file that differs from the policy.

## Commits

Every commit message follows the conventional format: `type(scope): Subject`.

- The types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, and `chore`.
- The scopes are `cli`, `eslint-plugin`, `docs`, `root`, `hooks`, and `deps`.

The commit hook runs `gspot check --hook pre-commit`, which runs commit-stage checks over staged files.

## CI results

CI runs on every pull request and push to `main`. The check, docs, and npm package jobs run on Linux.
CLI, plugin, and tool tests run on Linux, macOS, and Windows. Standalone archive tests run on each supported release platform.

A newer run of a pull request cancels the older one. To run it on a branch without a pull request,
start the `ci` workflow by hand. `.github/workflows/ci.yml` names the task each job runs: run that
task locally with the same arguments to reproduce a failure. A failed shard reruns its files with
`mise run test:tools -- --shard=<k>/<n>`, with the shard numbers of the job.

## Release

The release workflow validates the version and requires successful main-branch CI for the exact release commit. CI verifies the npm packages and standalone archives for Linux x64/arm64, macOS x64/arm64, and Windows x64. The reviewed `release` environment approves publication of those artifacts. The release validates archive checksums, publishes the ESLint plugin before the CLI, and attaches the archives and combined checksums to the GitHub release.

The Git tag must match the version in `packages/cli/package.json`. Configure environment protection and trusted publishing before running the release workflow. Publishing and deployment require explicit maintainer authorization.

The workflow publishes through npm trusted publishing: npm trades the OpenID Connect token of the
job for a publish token that lasts one run, and records provenance. No npm token is stored as a
secret. npm links a trusted publisher only to a package that exists, so the first version of
each package is published by hand:

1. Sign in with `npm login` as a member of the `gspothq` org.
2. Run `mise run build:cli` and `mise run build:plugin`. Then run `npm publish --access public` in `packages/eslint-plugin`,
   and again in `packages/cli`.
3. On npmjs.com, open the settings of each package and add a trusted publisher: GitHub Actions,
   the repository `stefanionescu/gspot`, the workflow `release.yml`, and the environment
   `release`.

The README badge says **unreleased** until `@gspothq/cli` is on npm. After the first release,
confirm the package, then replace the badge with `https://img.shields.io/npm/v/@gspothq/cli.svg`
linked to `https://www.npmjs.com/package/@gspothq/cli`:

```sh
npm view @gspothq/cli@0.1.0 name version repository --registry=https://registry.npmjs.org
```

## Publish the documentation

The release calls the reusable docs workflow after publishing. It verifies the stable release,
builds its static site, and deploys the reviewed artifact to Cloudflare Workers at `gspot.dev`.
`docs/wrangler.jsonc` owns the domain and static asset settings. See
[Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) for the hosting model.

Configure the `documentation` GitHub environment with a required reviewer. Add
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as environment secrets. The token must allow
Worker deployments and custom domain configuration for the account that owns `gspot.dev`.
Only the deployment step receives these credentials.

To roll the site back, open the docs workflow, select **Run workflow**, and enter an earlier
published tag as `release_tag`. The workflow builds that tag and waits for the approval before
it deploys.
