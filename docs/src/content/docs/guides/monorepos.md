---
title: Monorepos
description: Give each project in a repository its own configurations and settings, in one policy file.
---

A scope is one project inside your repository. It has its own configurations and settings. `gspot init`
proposes a scope for each folder with a tracked project file, such as `package.json`,
`pyproject.toml`, or `Package.swift`. Check their paths and configurations in the plan before you accept.

## Declare scopes

This policy has a root with no configurations and two scopes:

```toml title="Two project scopes"
configurations = []

[scope.api]
configurations = ["typescript", "express", "vitest"]

[scope.api.limits]
function_lines = 80

[scope.api.reasons]
"limits.function_lines" = "The API parser is one state machine."

[scope.ios]
configurations = ["swift", "xcode"]
```

Use the project path as the key under `[scope]`. Nested tables belong to that project.
`[scope.api.limits]` changes the API limit only. Quote a key that contains slashes.

After you change the scopes, apply the policy, install the tools, and check one project:

```bash
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

When a tool needs its own configuration per scope, gspot writes it under
`.gspot/config/<path>/`.

## Settings in a scope

```bash
gspot set limits.function_lines 80 --scope api --reason "The parser is one state machine."
```

Root settings apply to every scope. A setting in a scope replaces the root value for that scope
and the scopes inside it. Authored paths are relative to the scope that declares them. Inherited paths keep their original scope.

A list setting adds up: a scope gets the values of its configurations, the root, and every scope that contains it, without repeats. A single-value setting takes the nearest value. If two selected configurations give
different defaults for the same setting, gspot names both configurations. To decide, set the value at the
root or in a scope.

## Files a scope reads

Checks that read project files look inside the scope only. A parent scope does not consume source files owned by a child scope.

## TypeScript app and Python API

Given an npm project under `apps/web` and a Python project under `services/api`, initialize with explicit scope choices:

```shell
gspot init --scope-configurations apps/web=typescript,nextjs services/api=python,fastapi
```

Review the detected root configurations, then accept the plan. To add a test configuration to the API later:

```shell
gspot add pytest --scope services/api
gspot install
gspot check services/api
```

If a project disappears, `apply` preserves authored scope policy and deactivates its absent stack. When the project returns, its saved settings apply again.

## A policy below the Git root

The nearest `gspot.toml` in the current folder or a parent folder is the policy. To use a policy in a subfolder
from anywhere, pass `-C`:

```bash
gspot -C api check
```

Paths you name on the command line are relative to the folder `-C` selects. When a file lands
in the wrong scope, check its path with `gspot explain` and fix the scope path.
