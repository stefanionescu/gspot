---
title: "gspot init"
description: "Read this repository, propose a policy, and write it after a yes"
---

Read this repository, propose a policy, and write it after a yes.

```text
gspot init [options]
```

## Options

| Flag                        | Meaning                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `--yes`                     | Take every proposal without asking                                |
| `--from <profile>`          | Install from a profile: a path, an https URL or github:owner/repo |
| `--presets <presets...>`    | The root presets instead of the detected ones                     |
| `--without <presets...>`    | Presets to leave out of the proposal                              |
| `--scope <path=presets...>` | Scopes and their comma-separated presets                          |
| `--no-install`              | Skip the install step and print the command instead               |
| `--allow-dirty`             | Run although the working tree has uncommitted changes             |
| `--hooks <tool>`            | Where hooks go                                                    |
| `--ci <provider>`           | Write a CI workflow                                               |
| `--no-rules`                | Leave the agent rule files out                                    |
| `--keep-format`             | Keep your formatter settings                                      |
| `--shipped-format`          | Take the shipped formatter settings                               |
| `--runner <tool>`           | The task runner                                                   |
| `--dry-run`                 | Print the plan and write nothing                                  |
