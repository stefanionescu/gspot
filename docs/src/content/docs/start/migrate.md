---
title: Migrate existing tools
description: Review the init plan and move the settings you need.
---

## Read the plan

`gspot init --dry-run` prints the plan and writes nothing. Read it before you accept. The level decides which tools
run, and so which config files the plan replaces. To plan for level `all` from the start:

```shell
gspot init --dry-run --level all
```

The plan has these parts:

| Part                                | What gspot does                                                                                                                                                                                                       | What you do                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `write`                             | Writes `gspot.toml`, `.gspot/`, and the generated files.                                                                                                                                                              | Commit them after `gspot install`.                                               |
| `delete`                            | Deletes the config files that gspot replaces, such as `.eslintrc.json` and `ruff.toml`. Git keeps them: `git show HEAD:<path>`.                                                                                       | Move the settings you need with `gspot set` and `gspot ignore`.                  |
| `left in place`                     | Keeps tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml`, which no longer apply, and keeps CI files and existing lint jobs. Names `eslint-disable` comments for rules that gspot does not load. | Delete each tool section after you move its settings, and delete those comments. |
| `change`                            | Adds its managed blocks to `.gitignore` and `.gitattributes`, sets keys in your own files, such as the Stylelint fields of `package.json`, and names the lint tools that `.gspot/package.json` now pins.              | Remove those tools from `devDependencies` when nothing else uses them.           |
| `no longer runs; delete when ready` | Names folders of lint scripts, such as `lint/`.                                                                                                                                                                       | Check that nothing uses them, then delete them.                                  |

init copies the indent style, indent width, line width, quote style, semicolons, and trailing commas from your
Prettier settings or `.editorconfig` into `[format]`, and each Prettier `overrides` entry into a `[[format.override]]`
record. For Python, it copies the quote style of `[tool.ruff.format]`, of `ruff.toml`, or of
`skip-string-normalization` in `[tool.black]`. It copies no other settings. A tool that gspot does not run can run as a
[command check](/configure/command-checks/).

Without Prettier settings or `.editorconfig`, init writes no `[format]` table and the defaults apply: 4-space indent,
120 columns, semicolons, and trailing commas. In a project with another style, the first `gspot check` reports most
files under `format/prettier`, and `gspot check --fix` rewrites them. To keep your style, set it first, such as
`gspot set format.indent_width 2` and `gspot set format.semicolons false`.

## Old settings files after init

When you raise the level or add a configuration later, a tool that starts to run can find its old settings file.
`gspot/conflicting-config-files` reports such a file, such as `.commitlintrc.json` while commitlint runs. Delete it, and move
any rule you need into `gspot.toml`.

If Husky, Lefthook, or your own hooks folder runs your Git hooks, gspot keeps it and prints one line to add to each
hook; see [Existing hook managers](/use/hooks/#existing-hook-managers).
