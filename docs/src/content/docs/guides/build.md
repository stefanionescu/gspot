---
title: Build and contribute
description: Build gspot and its ESLint plugin, run the tests, and prepare a release.
sidebar:
    order: 2
---

To change gspot itself, work in a source checkout. You need Git, a Bash shell, and
[mise](https://mise.jdx.dev) 2026.8.8 or newer. mise pins Bun and Node for the checkout. Run
every command from the root of the checkout.

```shell
git clone https://github.com/stefanionescu/gspot.git
cd gspot
mise install
mise run repo:setup
```

## Build

```shell
mise run build
mise run build:plugin
```

`build` writes the `gspot` package to `packages/cli/dist/`: `gspot.js`, the command, and
`configuration.js`, which evaluates ESLint configuration in its own process. The package also
ships `packages/cli/kits/`, `packages/cli/guides/`, and `packages/cli/grammars/`.
`build:plugin` writes the ESLint plugin to `packages/eslint-plugin/dist/`. The two builds do
not depend on each other.

To run the build under Node:

```shell
node packages/cli/dist/gspot.js --version
```

## Run gspot from source

In this checkout, `mise run gspot -- <command>` runs gspot from source, without a build. The
checkout's Git hooks reach the same source through `packages/cli/bin`, which mise puts on
`PATH`. Activate mise in your shell before you commit, or run Git through `mise exec -- git`. To
check which gspot the hooks find:

```shell
mise exec -- which gspot
mise exec -- gspot --version
```

`mise.toml` holds the runtimes and the tasks of the checkout. gspot writes its tool pins to
`.mise/conf.d/gspot-tools.toml`. Change the policy in `gspot.toml`, then run `mise run apply`.
When a generated file drifts, fix its source. Then generate it again.

## Run the tests

```shell
mise run check:types
mise run test
mise run docs:build
```

`test` runs the unit and integration suites. `test:unit` and `test:integration` run one of them.
The native and acceptance suites need their pinned tools, from `mise install`, and can download
packages:

```shell
mise run test:tools
mise run test:acceptance
mise run test:acceptance -- ./acceptance/source/kits/vite.test.ts
```

The acceptance runner builds the ESLint plugin and serves it from a local registry, which it
removes when the run ends. The Supabase tests need Supabase CLI 2.72.7 and a running Docker
daemon. The XCTest coverage tests need macOS with Xcode selected by `xcode-select`.

## Prepare the grammars

```shell
mise run prepare:grammar
```

The task copies the tree-sitter grammar files into `packages/cli/grammars/`, with their
licenses. It also downloads the Swift 0.7.3 WebAssembly parser and checks its SHA-256. The
setup and test tasks run it for you. Run it before you run `bun test` directly.

## Test the packages

```shell
mise run test:package
```

This task builds `@gspothq/cli` and `@gspothq/eslint-plugin`, and publishes both to a local registry.
Then it installs them into new projects and runs real findings and fixes under Node.

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

```shell
npm view @gspothq/cli@0.1.0 name version repository --registry=https://registry.npmjs.org
```

## Checks of this repository

```shell
mise run repo:install-checks
mise run doctor
gspot check
gspot check --stage manual
```

The CI workflow runs on every pull request, merge group, and push to `main`, and the release
workflow calls it before it publishes. A newer run of a pull request cancels the older one. The
jobs:

- `check`, on Linux: the type check, every commit and push check except the tests, the manual
  checks, and `doctor`. It uploads the reports, and outside pull requests it sends the SARIF to
  code scanning.
- `docs`: the documentation tests and the site build.
- `package`: `mise run test:package`.
- `unit`, on Linux, macOS, and Windows: `mise run test`.
- `suite`: the tool and acceptance tests, in four shards on each system, split by file count.
  The macOS shards run the Xcode tests.

## Publish the documentation

The site workflow builds from a published release tag, when `GSPOT_PAGES_ENABLED` is `true`.
The gspot version must match the tag. The build records the version and the source revision in
`source.json`, and keeps the site artifact for 90 days. Only the deployment job may write to
Pages, and a reviewer on the `github-pages` environment approves it.

To roll the site back, open the site workflow, select **Run workflow**, and enter the published
tag as `release_tag`. When that build carried a documentation fix, also enter its source commit
as `source_ref`. The workflow checks that source again, rebuilds it, and waits for the approval
before it deploys. Check the page and its recorded revision afterwards.
