---
title: Package managers
description: How gspot installs its tools, and how to run it with npm, Bun, pnpm, Yarn, uv, or no task runner.
sidebar:
    order: 5
---

gspot keeps its tools in a private project, separate from your application:

- npm tools in `.gspot/package.json`
- Python tools in `.gspot/pyproject.toml`, installed with uv into `.gspot/.venv`

`gspot apply` writes the locks for these projects, and `gspot install` installs the locked
versions. Your own dependencies do not change. For the npm tools, gspot uses the package
manager your repository declares. Without one, it uses Bun when Bun is installed, and npm
otherwise.

## With npm, Bun, pnpm, or Yarn

`gspot init` asks which one to use. With `--yes`, or without a terminal, it takes the one your
repository already uses: mise when a mise file exists, otherwise the package manager of the
lockfile. The choices are `npm`, `bun`, `pnpm`, and `yarn`. gspot adds its launcher to your
`devDependencies` and changes nothing else: no scripts, and your own scripts stay. Run gspot
through the package manager, as in `npx gspot check` or `bunx gspot check`. The generated hooks
and CI job do the same.

## With uv

For a Python repository without a task runner, run:

```bash
gspot init --kits python --no-runner
```

`gspot install` installs the Python tools with uv and adds no tasks to `pyproject.toml`. Run
`gspot` directly, from a global npm install.

## With no task runner

`gspot init --no-runner` sets up no task runner. `gspot install` still installs the private tool
projects and the hooks you chose. Native tools without an npm or Python package, such as
ShellCheck, need a separate install. `gspot doctor` lists the missing tools with their install
commands.

In `gspot.toml`, a missing `runner` key or a missing `[hooks]` or `[ci]` table turns that
integration off. When present, each names its tool or provider. `--no-runner`, `--no-hooks`, and `--no-ci`
leave the tables out during init.

## Private registries

gspot passes the registry settings from your `.npmrc` or your package manager environment to
its own npm, Bun, pnpm, and Yarn runs. For the Python tools, uv reads the indexes from `uv.toml`
or `[tool.uv]` in `pyproject.toml`.

Keep credentials in your environment or your user configuration, never in `gspot.toml` or a
committed lock. Each teammate uses their own credentials with `gspot install`. After a policy
change, run `gspot apply` and commit the new manifests and locks. `install` refuses a lock that
does not match the manifest.
