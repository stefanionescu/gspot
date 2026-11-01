---
title: Migrate existing tools
description: Review what init preserves, replaces, and leaves for you to migrate.
---

## Read the plan

`gspot init` prints its plan and writes without asking. Commit your current config files before running it.
The level decides which tools run and which config files init replaces. To start at level `all`:

```shell
gspot init --level all
```

To select configurations explicitly, use `gspot init --configurations typescript,react`. Repeat `--configurations`
to add more names, such as `--configurations vitest`. See [Choose configurations](/configure/gspot-toml/#choose-configurations).

The plan has these parts:

| Part                                           | What gspot does                                                                                                                                                                        | What you do                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `write`                                        | Writes `gspot.toml`, `.gspot/`, and the generated files.                                                                                                                               | Commit them after `gspot install`.                                     |
| `delete`                                       | Deletes the config files that gspot replaces, such as `.eslintrc.json` and `ruff.toml`. Git keeps them: `git show HEAD:<path>`.                                                        | Move the settings you need with `gspot set` and `gspot ignore`.        |
| `keep`                                         | Keeps tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml`, which no longer apply, and keeps CI files and existing lint jobs.                                      | Delete each tool section after you move its settings.                  |
| `change`                                       | Adds its managed block to `.gitattributes`, sets keys in your own files, such as the Stylelint fields of `package.json`, and names the lint tools that `.gspot/package.json` now pins. | Remove those tools from `devDependencies` when nothing else uses them. |
| `lint folders; delete when nothing calls them` | Names folders of lint scripts, such as `lint/`, for you to review; it does not change or stop them.                                                                                    | Check that nothing uses them, then delete them.                        |

## Settings that init reads

init reads static Prettier options from supported JSON, YAML, or TOML files, the `prettier` key of `package.json`,
and `.editorconfig`. It copies the indent style, indent width, line width, quote style, semicolons, and trailing
commas into `[format]`, and each Prettier `overrides` entry into a `[[format.override]]` record.

For a repository that has code, unspecified widths and quotes follow the defaults of Prettier: 2 spaces, 80 columns,
and double quotes. Python files follow the defaults of Ruff, through a `[[format.override]]` record: 4 spaces, 88
columns, and double quotes. Swift and SQL files keep the defaults of their formatters in the same way. Only a
repository without code gets the defaults of gspot: 4 spaces, 120 columns, and single quotes. Review the first
`gspot check` before using `--fix`.

For Python, init reads the quote style from `[tool.ruff.format]` in `pyproject.toml`, or from `[format]` in a Ruff
settings file. It does not execute a JavaScript Prettier configuration. The plan names config files that need your
review; read their committed versions with `git show HEAD:<path>`.

Other lint options, disabled rules, and ignore patterns need an explicit migration. Use
[lint-rule settings](/configure/lint-rules/) and [ignores](/use/ignore/) before deleting the old tool's settings.
A tool that gspot does not run can remain a [command check](/configure/command-checks/).

## Start from another gspot repository

`gspot init --from <settings-file>`, with the `gspot.toml` of another repository, copies settings that apply across repositories and selects the
configurations named there. The plan lists settings it leaves out because they name the old repository's files or
folders. It detects the new repository's scopes and files again. Review the resulting `gspot.toml` before installing
tools; this option does not import arbitrary ESLint, Ruff, or other tool configuration files.

## Old settings files after init

When you raise the level or add a configuration later, a tool that starts to run can find its old settings file.
`gspot/conflicting-configs` reports such a file, such as `.commitlintrc.json` while commitlint runs. Delete it, and move
any rule you need into `gspot.toml`.

If Husky, Lefthook, or your own hooks folder runs your Git hooks, gspot keeps it and prints one line to add to each
hook; see [Existing hook managers](/use/hooks/#existing-hook-managers).
