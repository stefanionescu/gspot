---
title: Build and contribute
description: Build gspot and its ESLint plugin, run the tests, and prepare a release.
sidebar:
    order: 2
---

To change gspot itself, work in a source checkout. Run every command from the root of the
checkout, after the [source installation](/guides/install/). mise pins Bun and Node for the
checkout.

## Build

```shell
mise run build
mise run build:plugin
```

`build` writes the gspot executable for your system to `dist/`, with `LICENSE.md` and
`NOTICE.md`. `build:plugin` writes the ESLint plugin to `packages/eslint-plugin/dist/`, with its
own copy of `LICENSE.md`. The two builds do not depend on each other.

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
`mise run test:coverage` writes coverage to `coverage/lcov.info` and sets no floor.

## Build every system

```shell
mise run build -- --all
```

`packages/npm/targets.json` lists the targets, the executable names, and the npm packages. On
macOS, the build signs the macOS executables with `codesign`. The build collects the licenses of
the bundled packages and downloads the Bun and Swift notices. It checks every download against
its recorded SHA-256, and a mismatch fails the build.

## Prepare the Swift parser

```shell
mise run prepare:grammar
```

Setup and release builds download the Swift 0.7.3 WebAssembly parser, check its SHA-256, and
cache it in `packages/cli/.build/swift.wasm`. The test tasks prepare it for you. Run this task
before you run `bun test` directly. Release executables embed the parser.

## Test the packages

```shell
mise run test:release
```

This task builds every system and the plugin, and publishes the packages to a local registry.
Then it installs them into a new project and runs real findings and fixes through them. The
publisher checks every executable and license file, and runs `npm pack --dry-run` for every
package before it publishes any. Use the publisher only with `--dry-run` or a local registry
during development. Publishing to npm is a separate release step.

The README badge says **unreleased** until the `gspot` package is on npm. During the release,
confirm the package, then replace the badge with `https://img.shields.io/npm/v/gspot.svg`
linked to `https://www.npmjs.com/package/gspot`:

```shell
npm view gspot@0.1.0 name version repository --registry=https://registry.npmjs.org
```

## Checks of this repository

```shell
mise run repo:install-checks
mise run doctor
gspot check
gspot check --stage manual
```

The CI workflow runs these checks when the repository variable `GSPOT_CI_ENABLED` is `true`. It
checks the changed files on pull requests, merge queues, and pushes to `main`. A full run adds
the Linux, macOS, and Windows acceptance tests, the manual checks, and the documentation
build. The Linux job runs the Supabase database tests, and the macOS job runs the Xcode tests.

## Publish the documentation

The site workflow builds from a published release tag, when `GSPOT_PAGES_ENABLED` is `true`.
The gspot version must match the tag. The build records the version and the source revision in
`source.json`, and keeps the site artifact for 90 days. Only the deployment job may write to
Pages, and a reviewer on the `github-pages` environment approves it.

To roll the site back, open the site workflow, select **Run workflow**, and enter the published
tag as `release_tag`. When that build carried a documentation fix, also enter its source commit
as `source_ref`. The workflow checks that source again, rebuilds it, and waits for the approval
before it deploys. Check the page and its recorded revision afterwards.
