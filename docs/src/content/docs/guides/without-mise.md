---
title: Without mise
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
