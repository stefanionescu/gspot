---
title: Monorepos
---

`gspot init` plans a [scope](/start/concepts/#scopes) for each folder with a tracked project file, such as `package.json`,
`pyproject.toml`, or `Package.swift`. Before you run init, read the path and the configurations of each scope in the plan
that `gspot scan` prints.

## Declare scopes

This `gspot.toml` has two scopes, each with settings that apply only to its folder, and no configurations in the root
folder:

```toml
[[scope]]
path = "api"
configurations = ["typescript", "express", "vitest"]
limits.max_function_lines = { value = 80, reason = "The API parser is one state machine." }

[[scope]]
path = "ios"
configurations = ["swift", "xcode"]
```

After you change the scopes, write the generated files, install the tools, and check one scope:

```shell
gspot install
gspot check api
```

To add a configuration that init did not find, run `gspot add zod --scope api`.

From any folder, `--scope` takes the path of the scope from the root folder of the repository. At the root, `--scope .`
names the root, and from a subfolder, gspot refuses a value that starts with `.`. `gspot check` and `--paths` read each
path from your current folder, and `gspot check` with no path checks the whole repository, from any folder.

## Which scope a file belongs to

A file belongs to the deepest scope that contains it, and a file outside every scope belongs to the root. Each scope runs
its own copy of a whole-project check, such as a type check, which reads its whole project even when you name one file.

To see the scope and the checks of a file, run `gspot explain` with its path. When the path is also the name of a
configuration or a check, start it with `./`, because `gspot explain bash` describes the configuration.

## Settings in a scope

Add `--scope <path>` to `gspot set`, `unset`, `add`, or `remove`:

```shell
gspot set test_files "e2e/**" --scope web
```

For a folder that holds a project file and has no `[[scope]]` yet, the command also adds the record. Settings at the
root apply to every scope. Paths in a root setting start at the root folder, and paths in a `[[scope]]` table start at
the folder of that scope. The default paths of a configuration start at the folder of the scope that uses it.

A scope takes the settings of the root and of the scopes that contain it. The first value that you write, in the root or
in a scope, replaces the default that gspot ships:

| Kind of setting                                                         | In a scope                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| A list of values, such as `test_files`                                  | Adds its values to the lists of the parents, without repeats. |
| A table, such as `spelling.allowed_words`                               | Adds its keys.                                                |
| A single value, a command such as `site.build_command`, or record lists | Replaces the value of the parent.                             |

When several configurations give defaults for one list, gspot joins the lists.
[Scope settings](/reference/gspot-toml/#scope) lists every setting.

## Monorepo task runners

gspot covers the packages of a workspace through scopes, so run `gspot check` once in the root folder, and not in the
`lint` script of each package. A run in each package repeats the work and skips the checks of the root. The task runner
also keeps a cached pass for a package after `gspot.toml` changes, because the files of a package do not include
`gspot.toml` or `.gspot/`.

To run gspot as a Turborepo task, make it a
[root task](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), such as `//#lint`, and set
`"cache": false` on it, or add `gspot.toml` and `.gspot/**` to `globalDependencies`, as the
[Turborepo configuration](https://turborepo.dev/docs/reference/configuration) shows. In Nx, add them to the
[`sharedGlobals` named input](https://nx.dev/docs/reference/inputs).
