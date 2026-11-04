---
title: Monorepos
description: Give each scope its own configurations and settings in gspot.toml.
---

A scope holds the configurations and settings for one folder. `gspot init` plans a scope for each folder with a tracked
project file, such as `package.json`, `pyproject.toml`, or `Package.swift`. Check the path and configurations of each
scope in the plan before you accept it.

## Declare scopes

This `gspot.toml` has two scopes and no configurations at the root:

```toml
[[scope]]
path = "api"
configurations = ["typescript", "express", "vitest"]
limits.max_function_lines = { value = 80, reason = "The API parser is one state machine." }

[[scope]]
path = "ios"
configurations = ["swift", "xcode"]
```

Each `[[scope]]` names its folder in `path`. Its settings cover that folder only.

After you change the scopes, write the generated files, install the tools, and check one scope:

```shell
gspot install
gspot check api
```

To add a configuration that init did not find: `gspot add zod --scope api`.

`--scope` names a scope from the repository root, even when you run the command in a subfolder. `--scope .` selects
the root. `gspot check` and `--paths` read each path from your current folder.

## Which scope a file belongs to

A file belongs to the deepest scope that contains it. Files outside every scope belong to the root.

A whole-project check, such as a type check, can read other files of the same project when you name one file. Checks
that read project files look inside the scope only, and each child scope checks its own files.

To see the scope and the checks of a file, run `gspot explain` with the path. Start the path with `./` when it also
names a configuration or a check: `gspot explain bash` describes the configuration, and the `./` form describes the
file.

## Settings in a scope

Add `--scope <path>` to `gspot set`, `unset`, `add`, and `remove`:

```shell
gspot set test_files "e2e/**" --scope web
```

Root settings cover every scope. Paths in a root table start at the repository root, and paths in a `[[scope]]` table
start at that scope. The default paths of a configuration resolve inside the scope that selects it.

A scope inherits the settings of the root and of its parent scopes. The first value that you write replaces the
shipped default:

| Kind of setting                                                         | In a scope                                 |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| A list of values, such as `test_files`                                  | Adds to the parent lists, without repeats. |
| A table, such as `spelling.allowed_words`                               | Adds its keys.                             |
| A single value, a command such as `site.build_command`, or record lists | Replaces the parent value.                 |

The list defaults of several configurations add up. When two configurations of one scope give a single value
different defaults, the framework, platform, library, or database configuration wins. When neither is one of those,
gspot stops and names both. Set the value yourself to choose.

[Scope settings](/reference/gspot-toml/#scope) lists the keys and the values they accept.

## Turborepo and Nx

gspot handles the packages of a workspace through scopes, so run `gspot check` once at the root, not in the `lint`
script of each package. A run in each package repeats the work, skips the checks of the root scope, and lets the task
cache keep a pass after `gspot.toml` changes, because the files of a package do not include `gspot.toml` or `.gspot/`.

To keep gspot in the task graph of Turborepo, make it a
[root task](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), such as `//#lint`, and set
`"cache": false` on it. Or add `gspot.toml` and `.gspot/**` to `globalDependencies`; see the
[Turborepo configuration](https://turborepo.dev/docs/reference/configuration). In Nx, add them to the
[`sharedGlobals` named input](https://nx.dev/docs/reference/inputs).
