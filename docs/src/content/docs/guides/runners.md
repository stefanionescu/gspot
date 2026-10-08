---
title: Runners
description: Run gspot through mise, npm, pnpm, Yarn, Bun, or PATH.
---

The `runner` setting determines how hooks and CI launch gspot. A runner choice does not add the CLI to your app dependencies. Install the CLI using the [installation guide](/guides/install/).

## mise

With `runner = "mise"`, gspot writes `.mise/conf.d/gspot-tools.toml` with the CLI pin on the npm backend (`npm:@gspothq/cli`) and required executable tools. It leaves your authored `mise.toml` unchanged. Hooks run `mise exec -- gspot`. gspot needs Node.js 24.2 or newer, or Bun 1.4.2 or newer, under every runner, including mise. Applicable tools still require their own runtimes.

Initialize a Python repository interactively and choose mise:

```shell
gspot init --configurations python
```

`gspot init --runner mise` selects mise without a runner prompt. mise is the default proposal when available. Explicit settings take precedence.

## npm, pnpm, Yarn, or Bun

Hooks use the selected manager to launch the locally installed CLI. Guides use `gspot` as shorthand for `npx gspot`, `pnpm exec gspot`, `yarn gspot`, or `bunx gspot`.

Applicable npm tools live in `.gspot/package.json`, separate from app dependencies. They use the package manager declared by your repository. If no JavaScript manager is declared, gspot uses npm even when Bun is on `PATH`.

Yarn Classic installs committed lockfiles with `--frozen-lockfile`. Yarn Berry uses `--immutable`. gspot selects the matching command from the declared Yarn version. Use the same distinction when installing your app dependencies after cloning. See [Join a repository](/guides/join/).

Applicable Python tools live in `.gspot/pyproject.toml`. uv installs them into `.gspot/.venv`. `apply` generates the required manifests. `init` and `install` prepare missing or outdated lockfiles without downloading tool packages during configuration generation.

## No runner

`gspot init --no-runner` omits the `runner` setting. Hooks call `gspot` on `PATH`, so install the pinned CLI globally. Executable tools need mise or a separate installation. `gspot doctor` prints install commands.

`hooks.enabled = false` disables hooks. An absent `[ci]` disables CI. `--no-hooks` and `--no-ci` select those choices during initialization. Apply prunes recorded hook files and prints `run gspot install`. Install unsets `core.hooksPath` when the path belongs to gspot and hooks are off.

## Private registries

gspot uses repository and environment registry settings for its npm, pnpm, Yarn, and Bun installs. uv reads Python indexes from `uv.toml` or `[tool.uv]` in `pyproject.toml`.

Keep credentials in environment variables or user configuration. Do not commit credentials in `gspot.toml` or lockfiles. Each teammate supplies their own credentials when running `install`.
