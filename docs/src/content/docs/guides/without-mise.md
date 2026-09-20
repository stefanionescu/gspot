---
title: Without mise
description: The package-manager configuration gspot writes when mise is not the runner, and what it cannot do.
sidebar:
    order: 5
---

mise is recommended because it pins every tool from one file, whatever language the tool is
written in. When you decline it, `init` writes to the runner the repository has.

Set the runner in `gspot.toml` with `[runner]` and `tool = "mise"`, or select it with
`gspot init --runner <tool>`.

## With npm, bun, or pnpm

`init` pins the npm tools in `devDependencies` and adds `check`, `check:fix`, `apply` and
`prepare` scripts to `package.json`. Tools that are not npm packages (ShellCheck, typos, Vale)
are not pinned; `gspot doctor` prints the install command for each.

## With uv

`uv run gspot` works when gspot is a dev dependency through the npm wrapper, or when the binary is
on `PATH`. gspot writes no task to `pyproject.toml`.

## With no runner

`--runner none` writes no task-runner configuration. The hooks call the gspot binary by its absolute path, recorded
at `init`. Every tool is yours to install; `gspot doctor` lists what is missing.

## What you lose

A tool version that differs between two machines. mise pins every tool; the other runners pin
what their manager can install.
