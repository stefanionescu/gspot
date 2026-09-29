---
title: Build and contribute
description: Build local binaries, prepare the upstream Swift parser, and package releases.
sidebar:
    order: 2
---

Run these commands from the repository root with Git and mise 2026.8.8 or later installed.
Complete the [source installation](/guides/install/) first. The repository pins Bun and Node
through mise.

```shell
mise run build
mise run build:plugin
```

The CLI build selects the host target. Binaries, `LICENSE.md`, and `NOTICE.md` go under
`dist/`. The plugin build writes its modules and declarations under
`packages/eslint-plugin/dist/`, with its copy of `LICENSE.md`, and runs independently of the
CLI build.

## Hooks and configuration

Activate mise in your shell before invoking Git hooks, or run Git through `mise exec -- git`.
This checkout puts its source launcher on the mise PATH, so hooks and repository tasks run
the source without a build. Confirm the resolution:

```shell
mise exec -- which gspot
mise exec -- gspot --version
```

`mise.toml` owns the development runtimes and the authored tasks; gspot writes the generated
tool pins to `.mise/conf.d/gspot-tools.toml`. Edit policy in `gspot.toml` and run
`mise run apply` to regenerate managed configuration. Never edit a managed output to resolve
drift: change its source and regenerate it.

## Run tests

```shell
mise run check:types
mise run test
mise run docs:build
```

`test` runs the unit and integration suites with the development prerequisites and installed
workspace dependencies; `test:unit` and `test:integration` select one suite. Native
compatibility and source acceptance need their pinned external tools, installed with
`mise install`, and can download dependencies:

```shell
mise run test:tools
mise run test:acceptance
mise run test:acceptance -- ./acceptance/source/kits/vite.test.ts
```

The acceptance runner builds the plugin and serves it from an isolated local registry that it
removes after failure, timeout, or interruption. Supabase type compatibility needs Supabase
CLI 2.72.7 and a running Docker daemon. XCTest coverage needs macOS with full Xcode selected
by `xcode-select`. `mise run test:coverage` measures in-process source execution into
`coverage/lcov.info`, with no percentage gate.

## Build every target

```shell
mise run build -- --all
```

`packages/npm/targets.json` owns the compiler targets, binary names, npm identities, and libc
selection. macOS builds run `codesign` when built on macOS. The build collects the licenses of
bundled dependencies, downloads Bun and Swift notices from pinned sources, and verifies every
downloaded and cached byte against its recorded SHA-256. A failed download, a mismatched
checksum, or an unrecorded notice version fails the build.

## Prepare the Swift parser

```shell
mise run prepare:grammar
```

Setup and release builds download the upstream Swift 0.7.3 WebAssembly parser, verify its
SHA-256, and cache it under ignored `packages/cli/.build/swift.wasm`. Test tasks prepare the
grammar; run this task before invoking `bun test` directly. Release binaries embed the verified
parser.

## Validate packages locally

```shell
mise run test:release
```

After building every target and the plugin, these journeys publish to an isolated local
registry, install the packages into a fresh consumer, and exercise real findings and
corrections. The publisher checks every required binary and license file, then runs
`npm pack --dry-run` for every package before publishing any. Public publication is a separate
release operation; never use the publisher without `--dry-run` or an explicitly selected local
registry during local validation.

Keep the root README badge labeled **unreleased** until the intended `gspot` version is on the
public npm registry. Verify it during the release procedure, then replace the static image with
`https://img.shields.io/npm/v/gspot.svg` pointing at `https://www.npmjs.com/package/gspot`:

```shell
npm view gspot@0.1.0 name version repository --registry=https://registry.npmjs.org
```

## Repository checks

```shell
mise run repo:install-checks
mise run doctor
gspot check
gspot check --stage manual
```

The authored CI workflow owns repository automation, gated by `GSPOT_CI_ENABLED`. When
enabled, affected checks run for pull requests, merge queues, and main pushes. A full
dispatch runs the Linux, macOS, and Windows acceptance matrix, the manual checks, and the
documentation build. The Linux job owns the Docker-backed Supabase database journeys, and the
Xcode journeys run on macOS.

## Released documentation and rollback

The site workflow builds from a published stable release tag, gated separately by
`GSPOT_PAGES_ENABLED`; the CLI version must match that tag. The build records the product
version and source revision in `source.json` and retains the site artifact for 90 days. Only
the protected deployment job receives Pages and identity-token write permissions, behind a
reviewer on the `github-pages` environment.

To roll content back, select **Run workflow** on the site workflow with the recorded published
tag as `release_tag`, and the recorded source commit as `source_ref` when that build carried a
documentation correction. The workflow verifies that source again, rebuilds with its pinned
runtime and frozen lock, and asks for the environment approval before deploying. Verify the
resulting page and recorded revision afterwards.
