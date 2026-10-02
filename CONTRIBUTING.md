# Contributing

You work on gspot in a source checkout with [mise](https://mise.jdx.dev). Every task below runs
on your machine. None of them needs a GitHub run.

## Setup

You need Git, a Bash shell, and mise 2026.8.8 or newer. mise pins Bun and Node for the checkout.
Run every command from the root of the checkout.

```sh
git clone https://github.com/stefanionescu/gspot.git
cd gspot
mise install
mise run repo:setup
```

`repo:setup` installs the locked dependencies and prepares the grammar files. It also builds
the ESLint plugin of the workspace and generates the content types the documentation build
reads. After you change the plugin, run `mise run build:plugin` before the repository
checks.

## Run gspot from source

In this checkout, `mise run gspot -- <command>` runs gspot from source, without a build. The
checkout's Git hooks reach the same source through `scripts/gspot`, and mise puts the `scripts`
folder on `PATH`. Activate mise in your shell before you commit, or run Git through `mise exec -- git`. To
check which gspot the hooks find:

```sh
mise exec -- which gspot
mise exec -- gspot --version
```

`mise.toml` holds the runtimes and the tasks of the checkout. gspot writes its tool pins to
`.mise/conf.d/gspot-tools.toml`.

## Build

```sh
mise run build
mise run build:plugin
```

`build` writes the `gspot` package to `packages/cli/dist/`: `gspot.js`, the command, and
`configuration.js`, which evaluates ESLint configuration in its own process. The package also
ships `packages/cli/kits/`, `packages/cli/rules/`, and `packages/cli/grammars/`.
`build:plugin` writes the ESLint plugin to `packages/eslint-plugin/dist/`. The two builds do
not depend on each other. To run the build under Node:

```sh
node packages/cli/dist/gspot.js --version
```

`mise run prepare:grammar` copies the tree-sitter grammar files into `packages/cli/grammars/`,
with their licenses. It also downloads the Swift 0.7.3 WebAssembly parser and checks its
SHA-256. The setup and test tasks run it for you. Run it before you run `bun test` directly.

## Verification

Run these tasks before a commit, in this order. Each task stops on its own failures.

Run them from the repository root, so mise selects the pinned runtimes. The tests check the Bun
version against `package.json` at startup. A plain `bun test` can pick an older Bun from your
`PATH`.

| Task                       | What it verifies                                                           |
| -------------------------- | -------------------------------------------------------------------------- |
| `mise run check:types`     | TypeScript in the workspace and in the documentation site.                 |
| `mise run test`            | The unit and integration tests, without native tools or the network.       |
| `mise run test:tools`      | The pinned tools, run over the generated configuration.                    |
| `mise run test:acceptance` | Planted repositories, checked end to end through a local registry.         |
| `mise run test:package`    | The two npm packages, built, published to a local registry, and installed. |
| `mise run gspot -- check`  | The checks of this repository, run from source.                            |

`test:unit` and `test:integration` run one half of `test`. The tool and acceptance suites need
their pinned tools from `mise install`, and they can download packages. The acceptance runner
builds the ESLint plugin and serves it from a local registry, which it removes when the run
ends. The Supabase tests need Supabase CLI 2.72.7 and a running Docker daemon. The XCTest
coverage tests need macOS with Xcode selected by `xcode-select`.

The full acceptance suite stops after 90 minutes. Each test also has its own time limit. To run
some of it, pass files or folders:

```sh
mise run test:acceptance -- acceptance/kits/language/css.test.ts acceptance/cli/hooks
```

Some tool installers download a binary from GitHub. Without a token, GitHub allows 60 requests
an hour, which a cold install can use up. Before an acceptance run, set `GITHUB_TOKEN` to a
token that can read public releases.

`test:package` builds `@gspothq/cli` and `@gspothq/eslint-plugin` and publishes both to a local
registry. Then it installs them into new projects and runs real findings and fixes under Node.

## Documentation

The documentation site uses Astro Starlight. Preview it with `mise run docs:dev`, and build it
with `mise run docs:build`, which also checks local links and fragments. The reference pages
come from the CLI help, the policy schema, the kit manifests, and the plugin rules, so change
those owners rather than a page.

The homepage and the README show one recorded example, stored in
`docs/src/components/home/example.json`. `tests/acceptance/cli/example.test.ts`
replays it and checks the recorded findings.

## Policy and generated files

`gspot.toml` is the policy of this repository. Change it with `gspot set`, `gspot ignore`,
`gspot add`, or `gspot remove`, then run `mise run apply` to write the files under `.gspot/`
again. Do not edit a generated file by hand. `gspot/drift` reports a generated
file that differs from the policy.

## Commits

Every commit message follows the conventional format: `type(scope): Subject`.

- The types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, and `chore`.
- The scopes are `cli`, `eslint-plugin`, `docs`, `root`, `hooks`, and `deps`.

The commit hook runs `gspot check --staged`, which reads only what you staged.

## CI results

CI runs on every pull request, merge group, and push to `main`, on Linux, macOS, and Windows. A
newer run of a pull request cancels the older one. To run it on a branch without a pull
request, start the `ci` workflow by hand. The jobs:

- `check`, on Linux: the type check, every commit and push check, the manual checks, and
  `doctor`.
- `docs`: the documentation tests and the site build.
- `package`: `mise run test:package`.
- `unit`, on Linux, macOS, and Windows: `mise run test`.
- `suite`: the tool and acceptance tests, in four shards on each system, split by file count.
  The macOS shards run the Xcode tests.

A failed job names its task. Run that task locally with the same arguments to reproduce the
failure. A failed shard of the suite runs the same files again with
`mise run test:acceptance -- --shard=<k>/<n>`, with the shard numbers of the job.

## Release

The release workflow runs the full CI, builds both packages, and runs `test:package`. Then it
publishes `@gspothq/eslint-plugin` and `@gspothq/cli` to npm, and creates a GitHub release with
notes. The Git tag must match the version in `packages/cli/package.json`.

The workflow publishes through npm trusted publishing: npm trades the OpenID Connect token of the
job for a publish token that lasts one run, and records provenance. No npm token is stored as a
secret. npm links a trusted publisher only to a package that exists, so the first version of
each package is published by hand:

1. Sign in with `npm login` as a member of the `gspothq` org.
2. Run `mise run build`. Then run `npm publish --access public` in `packages/eslint-plugin`,
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

The site workflow builds from a published release tag, when `PAGES_ENABLED` is `true`.
The gspot version must match the tag. The build records the version and the source revision in
`source.json`, and keeps the site artifact for 90 days. Only the deployment job may write to
Pages, and a reviewer on the `github-pages` environment approves it.

To roll the site back, open the site workflow, select **Run workflow**, and enter the published
tag as `release_tag`. When that build carried a documentation fix, also enter its source commit
as `source_ref`. The workflow checks that source again, rebuilds it, and waits for the approval
before it deploys. Check the page and its recorded revision afterwards.
