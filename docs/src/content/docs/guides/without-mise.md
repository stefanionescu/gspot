---
title: Without mise
description: Private tool projects and task integration when mise is not the runner.
sidebar:
    order: 5
---

gspot keeps npm lint dependencies in `.gspot/package.json` and Python lint dependencies in
`.gspot/pyproject.toml`. These private projects exist under every runner, including when no
runner is selected. `gspot apply` resolves their locks in isolation. `gspot install` installs
those locked versions without changing the application dependencies.

The npm project uses the package manager declared by the repository. Without a declared
manager, gspot selects Bun when available, or npm. Python tools use uv and install into
`.gspot/.venv`.

## With npm, Bun, or pnpm

Select the task integration with `gspot init --runner npm`, `--runner bun`, or `--runner pnpm`.
The integration adds `check`, `check:fix`, and `apply` scripts to the repository package manifest.
Authored lifecycle scripts remain intact.

## With uv

`gspot init --runner uv` selects the private Python environment without adding tasks to
`pyproject.toml`. Run `gspot install` and then `gspot check` through the installed binary.

## With no runner

`gspot init --no-runner` omits task integration. Run `gspot install` to install the private
tool projects and any selected hook integration. Native tools without an npm or Python
package require separate installation. `gspot doctor` reports missing tools and installation
commands.

Omit `[runner]` to leave task-runner configuration unmanaged. An absent `[hooks]` or `[ci]`
table enables no integration. When a table is present, name its tool or provider explicitly.
Use `--no-runner`, `--no-hooks`, and `--no-ci` during initialization to omit those tables.
