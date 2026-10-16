---
title: Monorepos and scopes
description: Give each scope its own configurations and settings in gspot.toml.
---

A scope holds the configurations and settings for one folder. `gspot init`
proposes a scope for each folder with a tracked project file, such as `package.json`,
`pyproject.toml`, or `Package.swift`. Check their paths and configurations in the plan before you accept.

## Declare scopes

This `gspot.toml` has two scopes and no configurations at the root:

```toml
[[scope]]
path = "api"
configurations = ["typescript", "express", "vitest"]
limits.function_lines = { value = 80, reason = "The API parser is one state machine." }

[[scope]]
path = "ios"
configurations = ["swift", "xcode"]
```

Each `[[scope]]` names its folder in `path`. Its settings apply to that folder only.

After you change the scopes, apply the settings, install the tools, and check one scope:

```shell
gspot apply
gspot install
gspot check api
```

## Which scope owns a file

The deepest scope that contains a file owns it. Files outside every scope belong to the root.
A whole-project check, such as a type check, can read other files of the same project when you
name one file.

To see the scope and the checks of a file, run `gspot explain` with the path. Start the path
with `./` when it also names a configuration or a check: `gspot explain bash` explains the configuration, and
a path prefixed with `./` explains the file.

When a tool needs its own tool file per scope, gspot writes it under
`.gspot/config/<path>/`.

## Settings in a scope

```shell
gspot set limits.function_lines 80 --scope api --reason "The parser is one state machine."
```

Root settings apply to every scope. A setting in a scope replaces the root value for that scope
and the scopes inside it. Write paths relative to the repository root. The default paths of a configuration apply inside the scope that selects it.

A list setting adds up: a scope gets the values of its configurations, the root, and every scope that contains it, without repeats. A single-value setting takes the nearest value. If two selected configurations give
different defaults for the same setting, gspot names both configurations. To decide, set the value at the
root or in a scope.

## Files a scope reads

Checks that read project files look inside the scope only. Each child scope checks its own files.

## TypeScript app and Python API

Given an npm project under `apps/web` and a Python project under `services/api`, `gspot init` proposes one scope
for each. Check their configurations in the plan. To add a configuration that init did not detect:

```shell
gspot add pytest --scope services/api
gspot install
gspot check services/api
```

If a project's files go away, its checks become inactive. `gspot apply` keeps its configurations and settings in gspot.toml. The checks run again when the files come back.

## Settings below the Git root

gspot uses the nearest `gspot.toml` in the current folder or a folder above it.
To use the one in `api/`, run gspot from there: `cd api && gspot check`.

[Scope settings](/reference/gspot-toml/scope/) lists the accepted inputs.
