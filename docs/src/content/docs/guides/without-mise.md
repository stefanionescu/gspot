---
title: Package managers
description: Private tool projects and task integration when mise is not the runner.
sidebar:
    order: 5
---

Run commands from the configured repository root with the [CLI available](/guides/install/).

gspot keeps npm lint dependencies in `.gspot/package.json` and Python lint dependencies in
`.gspot/pyproject.toml`. These private projects exist under every runner, including when no
runner is selected. `gspot apply` resolves their locks in isolation. `gspot install` installs
those locked versions without changing the application dependencies.

The npm project uses the package manager declared by the repository. Without a declared
manager, gspot selects Bun when available, or npm. Python tools use uv and install into
`.gspot/.venv`.

## With npm, Bun, pnpm, or Yarn

Select the task integration with `gspot init --runner npm`, `--runner bun`, `--runner pnpm`, or `--runner yarn`.
The integration adds available `gspot:check`, `gspot:fix`, `gspot:apply`, and `gspot:doctor` scripts.
Initialization proposes existing check and format task names in `[runner.tasks]`. Review the
listed replacements before accepting the plan. Authored lifecycle scripts remain intact.

To choose names explicitly, set the mapping and apply it:

```bash
gspot set runner.tasks '{"check":"lint","fix":"format"}'
```

Uninstall restores accepted task bodies when they remain unchanged and preserves later edits.

## With uv

Select the Python configuration with `gspot init --configurations python --no-runner`.
`gspot install` uses uv to install the private Python environment without adding tasks to
`pyproject.toml`. Run `gspot check` through the installed binary.

## With no runner

`gspot init --no-runner` omits task integration. Run `gspot install` to install the private
tool projects and any selected hook integration. Native tools without an npm or Python
package require separate installation. `gspot doctor` reports missing tools and installation
commands.

Omit `[runner]` to leave task-runner configuration unmanaged. An absent `[hooks]` or `[ci]`
table enables no integration. When a table is present, name its tool or provider explicitly.
Use `--no-runner`, `--no-hooks`, and `--no-ci` during initialization to omit those tables.

## Private registries

Configure npm-compatible registries and scoped authentication through the repository or user
`.npmrc`, or the package manager environment. gspot carries those connection settings into
its isolated npm, Bun, pnpm, and Yarn operations. Keep credential values in your environment
or private user configuration, not `gspot.toml` or committed lockfiles.

For Python tools, configure uv indexes in `uv.toml` or `[tool.uv]` in `pyproject.toml`.
uv resolves user configuration and environment precedence. gspot retains project index
settings while generating and installing the private Python lock.

Run `gspot apply` to resolve a policy change, then commit the generated manifests and locks.
Teammates use their own registry credentials with `gspot install`. Installation refuses a
mismatched lock; it does not silently resolve a replacement.
