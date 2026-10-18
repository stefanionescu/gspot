---
title: Migrate existing tools
description: Review the init plan and move the settings you need.
---

## Read the plan

`gspot init --dry-run` prints the plan and writes nothing. Read it before you accept. The plan has these parts:

| Part                                | What gspot does                                                                                                                                                      | What you do                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `write`                             | Writes `gspot.toml`, `.gspot/`, and the generated files.                                                                                                             | Commit them after `gspot install`.                                     |
| `delete`                            | Deletes the tool files that gspot replaces, such as `.eslintrc.json` and `ruff.toml`. Git keeps them: `git show HEAD:<path>`.                                        | Move the settings you need with `gspot set` and `gspot ignore`.        |
| `left in place`                     | Keeps tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml`, which no longer apply, and keeps CI files and existing lint jobs.                    | Delete each tool section after you move its settings.                  |
| `change`                            | Adds its sections to `.gitignore` and `.gitattributes`, sets keys in your own files, such as `.npmrc`, and names the lint tools that `.gspot/package.json` now pins. | Remove those tools from `devDependencies` when nothing else uses them. |
| `no longer runs; delete when ready` | Names folders of lint scripts, such as `lint/`.                                                                                                                      | Check that nothing uses them, then delete them.                        |

init copies the indent width, line width, and quote style from your Prettier JSON settings or `.editorconfig` into
`[format]`. It copies no other settings. A tool that gspot does not run can run as a
[command check](/configure/command-checks/). If Husky, Lefthook, or your own hooks folder runs your Git hooks, gspot
keeps it and prints three lines to add; see [Existing hook managers](/use/hooks/#existing-hook-managers).
