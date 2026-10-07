---
title: Runners
description: Run gspot through mise, npm, pnpm, Yarn, Bun, or PATH.
---

The `run_with` setting determines how hooks and CI launch gspot. A runner choice does not add the CLI to your application dependencies. Install the CLI using the [installation guide](/guides/install/).

## mise

With `run_with = "mise"`, gspot writes `.mise/conf.d/gspot-tools.toml` with the CLI pin on the npm backend (`npm:@gspothq/cli`) and required executable tools. It leaves your authored `mise.toml` unchanged. Hooks run `mise exec -- gspot`. gspot needs Node.js 24.2 or newer, or Bun 1.4.2 or newer, under every runner, including mise. Applicable tools still require their own runtimes.

Initialize a Python repository interactively and choose mise:

```shell
gspot init --configurations python
```

mise is the default proposal when available. Explicit settings take precedence.

## npm, pnpm, Yarn, or Bun

Hooks use the selected manager to launch the locally installed CLI. Guides use `gspot` as shorthand for `npx gspot`, `pnpm exec gspot`, `yarn gspot`, or `bunx gspot`.

Applicable npm tools live in `.gspot/package.json`, separate from application dependencies. They use the package manager declared by your repository. If no JavaScript manager is declared, gspot uses npm even when Bun is on `PATH`.

Yarn Classic installs committed locks with `--frozen-lockfile`. Yarn Berry uses `--immutable`. gspot selects the matching command from the declared Yarn version. Use the same distinction when installing your application dependencies after cloning; see [Join a repository](/guides/join/).

Applicable Python tools live in `.gspot/pyproject.toml`; uv installs them into `.gspot/.venv`. `apply` generates the required manifests. `init` and `install` prepare missing or stale locks without downloading tool packages during configuration generation.

## No runner

`gspot init --no-task` leaves out `run_with`. Hooks call `gspot` on `PATH`, so install the pinned CLI globally. Native tools still need mise or a separate installation. `gspot doctor` prints acquisition commands.

A missing `[hooks]` or `[ci]` table disables that integration. `--no-hooks` and `--no-ci` leave those tables out during initialization.

## Private registries

gspot uses repository and environment registry settings for its npm, pnpm, Yarn, and Bun installs. uv reads Python indexes from `uv.toml` or `[tool.uv]` in `pyproject.toml`.

Keep credentials in environment variables or user configuration. Do not commit credentials in `gspot.toml` or locks. Each teammate supplies their own credentials when running `install`.
