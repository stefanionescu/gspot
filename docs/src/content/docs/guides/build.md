---
title: Build gspot
description: Build local binaries, prepare the upstream Swift parser, and package releases.
sidebar:
    order: 2
---

Run these commands from the repository root with Git and mise 2026.8.8 or later installed.
Complete the [source installation](/guides/install/) first. The repository pins Bun and Node
through mise. Routine tasks do not install native check tools automatically.

```shell
mise run build
mise run build:plugin
```

The CLI build selects the host target. Binaries, `LICENSE.md`, and `NOTICE.md` go under
`dist/`. The plugin build writes its modules and declarations under
`packages/eslint-plugin/dist/`, including its copy of `LICENSE.md`.
Plugin dependencies remain separate npm packages with their own licenses.
The plugin build runs independently of the CLI build.

## Contributor hooks and configuration

Activate mise in your shell before invoking Git hooks, or run Git through `mise exec -- git`.
This checkout places its executable source launcher on mise PATH. Hooks and repository tasks
run the same source without a build or published binary. Confirm the resolution without
running checks:

```shell
mise exec -- which gspot
mise exec -- gspot --version
```

The first command prints this checkout's `.mise/gspot/gspot`. The second prints the source version.
If resolution fails, complete source setup and activate mise again. Keep hooks enabled.
The release-provider override in `mise.toml` applies only to this checkout. Consumer
repositories retain their generated pinned executable.

`mise.toml` owns development runtimes and repository settings. Authored tasks and the source-launcher PATH belong to
`.mise/conf.d/repo.toml`; gspot owns the generated tool pins. Edit policy in `gspot.toml`
and run `mise run apply` to regenerate managed configuration. Native tools discover
`typos.toml` by filename; the spelling configuration owns its content. The editor schema is generated
from the policy schema and copied into the published documentation during the site build.
Do not edit managed outputs to resolve drift. Change their source and regenerate them.

## Run tests

Run the suites relevant to your change from the repository root:

```shell
mise run check:types
mise run test
mise run docs:build
```

`test` runs the unit and integration suites using the development prerequisites and installed
workspace dependencies. Routine tasks explicitly exclude `tests/integration/tools`. Use `test:unit` or
`test:integration` to select one suite. Tasks that load plugin exports build the plugin first.

Unit tests cover focused production logic and ESLint RuleTester cases. Integration tests
combine production components with local fixtures and controlled external boundaries.
Tool integration executes installed tools. Source acceptance runs user journeys through the
source CLI. Release acceptance uses built binaries, installed packages, and standalone plugin
consumers. Shared test setup, preservation, and cleanup live under `tests/support`.

Native compatibility and source acceptance require their pinned external tools. Install those
tools with `mise install`, then run the explicit suites. Supabase type compatibility requires
Supabase CLI 2.72.7 and a running Docker daemon. Its isolated project removes its own containers
and volumes after execution. XCTest coverage requires macOS with full Xcode and command-line
tools selected by `xcode-select`. These suites can download dependencies:

```shell
mise run test:tools
mise run test:acceptance
```

The acceptance runner builds the plugin and serves it from an isolated local registry; tool
dependencies use the configured npm registry. Output streams while the suite runs.
The runner removes its registry after failure, timeout, or interruption. Select acceptance cases through that runner:

```shell
mise run test:acceptance -- ./acceptance/source/configurations/vite.test.ts
```

Use `mise run test:coverage` to run the unit and integration suites with coverage measurement.
Coverage measures in-process source execution. It excludes tests and support code,
generated configuration, built distributions, fixtures, and vendored assets. Reports are
written to `coverage/lcov.info`; subprocess and native execution provide separate evidence.
There is no fixed coverage-percentage gate. Jest supplies lint rules for `bun:test`; its native
coverage command does not run Bun tests. Direct `bun test` discovers the broader test tree,
including suites that require the acceptance runner or built release artifacts.

Run [installed-package verification](#validate-packages-locally) separately from source tests.
The publisher prepares packages in disposable directories. Run source acceptance and release
verification sequentially so each suite owns its registry and tool installation workload.

The documentation build generates the editor schema from the runtime policy schema and
publishes it at `/schema/gspot.schema.json`.
See the [documentation conventions](https://github.com/stefanionescu/gspot/blob/main/docs/README.md)
for example, reference, and link validation.

## Build every target

```shell
mise run build -- --target \
    bun-darwin-arm64 bun-darwin-x64-baseline \
    bun-linux-x64-baseline bun-linux-arm64 \
    bun-linux-x64-musl-baseline bun-linux-arm64-musl \
    bun-windows-x64-baseline
```

The target definitions in `packages/npm/targets.json` own the compiler targets, binary
names, npm identities, and libc selection. macOS builds run `codesign` when built on macOS.
Use macOS for signed macOS artifacts. Building another target does not execute it.

The build reads bundler metadata to collect the licenses of bundled dependencies. Pinned
sources supply licenses for packages that omit a separate license file. The build downloads
Bun and Swift notices from pinned sources and verifies all downloaded and cached bytes against
recorded SHA-256 values. Notice inputs are cached in ignored build output. `NOTICE.md` retains
upstream attribution. Failed downloads, mismatched checksums, and unrecorded notice versions
fail the build.

## Prepare the Swift parser

Source checkout setup and release builds download the upstream Swift 0.7.3 WebAssembly parser.
The input preparation script records its release URL and SHA-256. Preparation verifies cached
bytes and rejects a failed download or checksum mismatch. The cache lives in ignored
`packages/cli/.build/swift.wasm`; no compiler or Docker is required for this preparation.

```shell
mise run prepare:grammar
```

Test tasks prepare the grammar automatically. Before invoking Bun tests directly, run repository
setup or the preparation task. Source checks report a missing cache without downloading it.
Release binaries embed the verified parser and require no parser download at runtime.
Builds fetch the pinned Swift license and include its attribution in the release notices.

## Validate packages locally

After building every target and the plugin, run the installed-product journeys:

```shell
mise run test:release
```

These journeys publish only to an isolated local registry. They install the packages into a
fresh consumer, exercise real findings and corrections, and verify packaged assets and
cancellation. They require the pinned tools used by those journeys.

The publisher checks every required binary and license file before preparing packages, then
runs `npm pack --dry-run` for every package before publishing any package. Public publication
is a separate release operation. Do not use the publisher without `--dry-run` or an explicitly
selected local registry during local validation.

### Activate the npm badge after publication

Keep the root README badge labeled **unreleased** until the intended `gspot` package version
is available in the public npm registry. During the authorized release procedure, verify it:

```shell
npm view gspot@0.1.0 name version repository --registry=https://registry.npmjs.org
```

Require the intended name, version, and repository. Only then replace the static npm image
with `https://img.shields.io/npm/v/gspot.svg` and its destination with
`https://www.npmjs.com/package/gspot`. Update the installation guide for that verified release
at the same time. Do not add download counts, a coverage percentage, or a CI status badge.
This verification command does not publish a package or activate CI.

## Repository acceptance

Install locked check dependencies with `mise run repo:install-checks`. Use `mise run doctor`
to diagnose the environment. Run repository checks with `mise run gspot:check`; append
`-- --stage manual` to include manual-stage checks. These checks are separate from the tests.

The authored CI workflow owns repository automation. This checkout omits `[ci]` from
`gspot.toml`, so apply does not generate a second workflow. Repository CI is paused behind
`GSPOT_CI_ENABLED`; local test results do not imply a CI run.

When enabled, affected checks run for pull requests, merge queues, and main pushes.
A full dispatch or release checkpoint runs the Linux, macOS, and Windows acceptance matrix,
manual checks, and documentation build. The release workflow validates installed packages
before publication. Local execution and cross-compilation do not establish native acceptance
on other platforms.

## Released documentation and rollback

The site workflow builds from a published stable release tag. The CLI version must match that
tag. A documentation correction can name an exact descendant commit, but changes outside
`docs/`, the root README, and the site workflow are refused. Generated references
show the product version and link to their definitions at the recorded source commit.

The build records product version and source revision in `source.json`. It retains the complete
site artifact for 90 days. Pull-request artifacts are previews; they cannot enter the deployment
job. Local builds and preview checks do not establish that a public deployment succeeded.

Before enabling deployment, the repository owner must configure Pages for Actions, protect the
`github-pages` environment with a reviewer, and verify the provider URL and HTTPS. Confirm
ownership of `gspot.dev` before any DNS change. The build has read-only access; only the separate
protected deployment job receives Pages and identity-token write permissions. This follows
[GitHub's custom Pages workflow contract](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

CI and Pages are gated separately by `GSPOT_CI_ENABLED` and `GSPOT_PAGES_ENABLED`. Enabling
repository checks does not authorize a site deployment.

For a content rollback after launch, identify the previous successful site run and retain its
artifact and `source.json`. Select **Run workflow** on the site workflow with its recorded
published tag as `release_tag`. Set `source_ref` to its recorded source commit if that build
included a documentation correction. The workflow verifies that source again, rebuilds with its
pinned runtime and frozen lock, and requests protected-environment approval before deployment.
This exact-source route also works after artifact retention expires. Do not roll back DNS for
an ordinary content defect. Verify the resulting page and recorded revision after deployment.

Verify the deployed version and a rollback before treating the release procedure as operational.
