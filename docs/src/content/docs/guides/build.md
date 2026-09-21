---
title: Build gspot
description: Build local binaries, regenerate the Swift grammar, and prepare packages.
sidebar:
    order: 2
---

Run these commands from the repository root with Git and mise 2026.8.8 or later installed.
The repository pins Bun and Node through mise.

```shell
mise run repo:setup
mise run build
mise run build:plugin
```

The CLI build selects the host target. Binaries, `LICENSE.md`, and `NOTICE.md` go under
`dist/`. The plugin build writes its modules and declarations under
`packages/eslint-plugin/dist/` and stages `LICENSE.md` at the package root.
Plugin dependencies remain separate npm packages with their own licenses.
The plugin build runs independently of the CLI build.

## Run tests

```shell
mise run test
mise run test:integration
mise run test:acceptance
mise run test:coverage
```

`mise run test` runs CLI unit tests and plugin tests. Integration and acceptance tasks
select their existing test directories. Shared timeouts and other Bun settings belong in
`bunfig.toml`. Direct `bun test` uses broader discovery, including integration, acceptance,
and release files. Coverage measurement helps identify missing behavioral tests; it has no
fixed percentage gate.

`mise run test:release` enables the release opt-in for that task. Build the required artifacts
before running it. A skipped release suite is
not release acceptance. Candidate acceptance requires the unit, integration, acceptance,
and explicitly enabled release suites, with platform gaps recorded.

The docs build copies `gspot.schema.json` into its output for editor downloads. Regenerate
and validate that root schema with `mise run generate:schema` and
`mise run generate:schema -- --check`.

## Build every target

```shell
mise run build -- --target \
    bun-darwin-arm64 bun-darwin-x64-baseline \
    bun-linux-x64-baseline bun-linux-arm64 \
    bun-linux-x64-musl-baseline bun-linux-arm64-musl \
    bun-windows-x64-baseline
```

The target definitions in `packages/npm/gspot/targets.json` own the compiler targets, binary
names, npm identities, and libc selection. macOS builds run `codesign` when built on macOS.
Use macOS for signed macOS artifacts. Building another target does not execute it.

The build reads bundler metadata to collect the licenses of bundled dependencies. Pinned
upstream records under `LICENSES/` cover packages that omit a separate license file. `NOTICE.md` also records
the Swift grammar provenance and Bun runtime notices. Missing grammars, mismatched grammar
hashes, and unrecorded license notices fail the build.

## Regenerate the Swift grammar

The checked-in grammar is built from a pinned upstream commit. Its source, compiler versions,
and SHA-256 are recorded in `packages/cli/grammars/swift.json`. Its upstream license is
`packages/cli/grammars/swift.LICENSE`.

Start Docker, then use mise 2026.8.8 or newer to run the pinned tree-sitter CLI:

```shell
mise run build:grammar
mise run build:grammar -- --check
```

The script fetches the exact source commit into a temporary checkout. tree-sitter invokes
Emscripten in a container pinned by digest, with compilation network access disabled. The
second command rebuilds and compares the grammar, provenance, and license without changing
the checked-in outputs.

Use `--out <directory>` to preview the generated files elsewhere.

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

## Repository acceptance

Use mise 2026.8.8 or newer for the repository task definitions. The root declares this minimum
because its generated tool pins live in a native mise fragment.

Run the suites relevant to a change:

```shell
mise run check:types
mise run test:coverage
mise run test:integration
mise run test:acceptance
mise run docs:build
```

The `test:coverage` task includes coverage measurement. It has no blanket coverage threshold.
`mise run gspot:check` checks the repository; append `-- --stage manual` for the manual checks.
`mise run doctor` diagnoses the installed environment. Install matching locked tool
dependencies with `mise run repo:install-checks` before these checks.

The authored `ci.yml` owns repository checks. This checkout omits `[ci]` from `gspot.toml` so
apply does not create a second workflow. Generated GitHub and GitLab workflows remain available
to configured consumer repositories.

CI remains paused unless the owner sets the repository variable `GSPOT_CI_ENABLED` to `true`.
After re-enablement, ordinary pull requests, merge queues, and main pushes run affected checks.
A full dispatch or release checkpoint runs the Linux, macOS, and Windows acceptance matrix,
manual checks, and the documentation build. The release workflow waits for acceptance before
building distribution artifacts. Installed-package journeys use those artifacts before any
publication. No path filter suppresses the affected-check job for documentation-only changes.

Local execution on one operating system does not establish acceptance on the other platforms.
Cold and warm CI timings require actual runs after the owner re-enables CI.

## Released documentation and rollback

The site workflow builds from a published stable release tag. The CLI version must match that
tag. A documentation correction can name an exact descendant commit, but changes outside
`docs/`, `examples/`, the root README, and the site workflow are refused. Generated references
show the product version and link to their definitions at the recorded source commit.

The build records product version and source revision in `source.json`. It retains the complete
site artifact for 90 days. Pull-request artifacts are previews; they cannot enter the deployment
job. Local builds and preview checks do not establish that a public deployment succeeded.

Before enabling deployment, the repository owner must configure Pages for Actions, protect the
`github-pages` environment with a reviewer, and verify the provider URL and HTTPS. Confirm
ownership of `gspot.dev` before any DNS change. The build has read-only access; only the separate
protected deployment job receives Pages and identity-token write permissions. This follows
[GitHub's custom Pages workflow contract](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

CI and Pages remain gated separately by `GSPOT_CI_ENABLED` and `GSPOT_PAGES_ENABLED`. The current
work does not set either variable, configure the external environment, deploy, or change DNS.

For a content rollback after launch, identify the previous successful site run and retain its
artifact and `source.json`. Select **Run workflow** on the site workflow with its recorded
published tag as `release_tag`. Set `source_ref` to its recorded source commit if that build
included a documentation correction. The workflow verifies that source again, rebuilds with its
pinned runtime and frozen lock, and requests protected-environment approval before deployment.
This exact-source route also works after artifact retention expires. Do not roll back DNS for
an ordinary content defect. Verify the resulting page and recorded revision after deployment.

A live deployment and rollback have not been exercised while CI and external actions are paused.
