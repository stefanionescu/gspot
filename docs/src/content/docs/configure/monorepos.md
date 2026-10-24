---
title: Monorepos
description: Give each scope its own configurations and settings in gspot.toml.
---

A scope holds the configurations and settings for one folder. `gspot init`
plans a scope for each folder with a tracked project file, such as `package.json`,
`pyproject.toml`, or `Package.swift`. Check the path and configurations of each scope in the plan before you accept it.

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

Each `[[scope]]` names its folder in `path`. Its settings cover that folder only.

After you change the scopes, apply the settings, install the tools, and check one scope:

```shell
gspot apply
gspot install
gspot check api
```

To add a configuration that init did not find: `gspot add pytest --scope services/api`.

## Which scope a file belongs to

A file belongs to the deepest scope that contains it. Files outside every scope belong to the root.

A whole-project check, such as a type check, can read other files of the same project when you
name one file. Checks that read project files look inside the scope only, and each child scope checks its own files.

To see the scope and the checks of a file, run `gspot explain` with the path. Start the path
with `./` when it also names a configuration or a check: `gspot explain bash` describes the configuration, and
the `./` form describes the file.

## Settings in a scope

```shell
gspot set limits.function_lines 80 --scope api --reason "The parser is one state machine."
```

Root settings cover every scope. Write paths relative to the repository root. The default paths of a configuration resolve inside the scope that selects it.

The first written list replaces its shipped default. A scope list adds to the written lists of the root and its
parent scopes, without repeats. A single-value setting takes the nearest value.

If two selected configurations give
different defaults for the same setting, gspot names both. To pick one, set the value at the
root or in a scope.

[Scope settings](/reference/gspot-toml/#scope) lists the keys and the values they accept.
