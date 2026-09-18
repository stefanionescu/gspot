---
title: "gspot init"
description: "Read this repository, propose a policy, and write it after a yes"
---

Read this repository, propose a policy, and write it after a yes.

```text
gspot init [options]
```

## Options

| Flag                  | Meaning                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `--yes`               | Take every proposal without asking                                                         |
| `--presets <ids>`     | The root presets, comma separated, instead of the detected ones                            |
| `--without <ids>`     | Presets to leave out of the proposal, comma separated                                      |
| `--scope <path=ids>`  | A scope and its presets; repeat for each scope                                             |
| `--own <tools>`       | The tools gspot takes over, comma separated; the default is every tool it has a preset for |
| `--no-install`        | Skip the install step and print the command instead                                        |
| `--allow-dirty`       | Run although the working tree has uncommitted changes                                      |
| `--hooks <tool>`      | Where hooks go                                                                             |
| `--ci <provider>`     | Write a CI workflow                                                                        |
| `--rules <choice>`    | Install the agent rule files                                                               |
| `--format <choice>`   | Keep your formatter settings, or take the shipped ones                                     |
| `--project-templates` | Copy the project templates that match into the project rule layer                          |
| `--runner <surface>`  | The task runner surface                                                                    |
| `--dry-run`           | Print the plan and write nothing                                                           |
