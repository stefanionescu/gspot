---
title: Monorepos
description: Give each scope its own configurations and settings in gspot.toml.
---

A monorepo is one repository that holds several projects. In gspot, each project folder can be a scope: a folder with
its own configurations and settings. `gspot init` plans a scope for each folder with a tracked project file, such as
`package.json`, `pyproject.toml`, or `Package.swift`. Before you run init, check the path and the configurations of each
scope in the plan that `gspot scan` prints.

## Declare scopes

This `gspot.toml` has two scopes and no configurations in the root folder:

```toml
[[scope]]
path = "api"
configurations = ["typescript", "express", "vitest"]
limits.max_function_lines = { value = 80, reason = "The API parser is one state machine." }

[[scope]]
path = "ios"
configurations = ["swift", "xcode"]
```

Each `[[scope]]` names its folder in `path`. Its settings apply only to that folder.

After you change the scopes, write the generated files, install the tools, and check one scope:

```shell
gspot install
gspot check api
```

To add a configuration that init did not find, run `gspot add zod --scope api`.

`--scope` takes the path of the scope from the root folder of the repository, even when you run the command in a
subfolder. `--scope .` names the root. `gspot check` and `--paths` read each path from your current folder.

## Which scope a file belongs to

A file belongs to the deepest scope that contains it. A file outside every scope belongs to the root.

A check that reads a whole project, such as a type check, can read other files of that project when you name one file.
Such checks read only the files inside the scope, and each nested scope checks its own files.

To see the scope and the checks of a file, run `gspot explain` with its path. When the path is also the name of a
configuration or a check, start it with `./`. For example, `gspot explain bash` describes the configuration, and the
`./` form describes the file.

## Settings in a scope

Add `--scope <path>` to `gspot set`, `unset`, `add`, and `remove`:

```shell
gspot set test_files "e2e/**" --scope web
```

Settings at the root apply to every scope. Paths in a root setting start at the root folder, and paths in a
`[[scope]]` table start at the folder of that scope. The default paths of a configuration start at the folder of the
scope that uses the configuration.

A scope takes the settings of the root and of the scopes that contain it. The first value that you write, in the root
or in a scope, replaces the default that gspot ships:

| Kind of setting                                                         | In a scope                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| A list of values, such as `test_files`                                  | Adds its values to the lists of the parents, without repeats. |
| A table, such as `spelling.allowed_words`                               | Adds its keys.                                                |
| A single value, a command such as `site.build_command`, or record lists | Replaces the value of the parent.                             |

When several configurations give defaults for one list, gspot joins the lists. When two configurations of one scope
give different defaults for a single value, the configuration of a framework, platform, library, or database wins.
When neither configuration is of one of those kinds, gspot stops and names both. Set the value yourself to choose.

[Scope settings](/reference/gspot-toml/#scope) lists the settings and the values that they accept.

## Monorepo task runners

gspot covers the packages of a workspace through scopes, so run `gspot check` once in the root folder. Do not run it in
the `lint` script of each package. A run in each package repeats the work, and skips the checks of the root. The
task runner also keeps a cached pass for a package after `gspot.toml` changes, because the files of a package do not
include `gspot.toml` or `.gspot/`.

To run gspot as a Turborepo task, make it a
[root task](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), such as `//#lint`, and set
`"cache": false` on it. Or add `gspot.toml` and `.gspot/**` to `globalDependencies`, as the
[Turborepo configuration](https://turborepo.dev/docs/reference/configuration) shows. In Nx, add them to the
[`sharedGlobals` named input](https://nx.dev/docs/reference/inputs).
