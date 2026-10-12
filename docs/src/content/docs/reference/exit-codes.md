---
title: Exit codes and environment variables
description: The meaning of the exit codes of gspot, and the environment variables it reads.
---

| Exit code      | Meaning                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `0`            | The command completed. Every check that ran passed; skipped checks remain listed.                        |
| `1`            | Findings remain.                                                                                         |
| `2`            | The run did not finish: a tool is missing, a fixer failed, a report is invalid, or the input is invalid. |
| `130` or `143` | `gspot check` was stopped by Ctrl-C or SIGTERM.                                                          |

Each [command page](/reference/commands/) lists its own exit codes.

| Variable       | Purpose                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GSPOT_JOBS`   | A whole number, 1 or more, that limits how many checks run at once. Any other value uses every processor core.                           |
| `GITHUB_TOKEN` | Lets gspot read a template from a private GitHub repository, and lets tool installs download from GitHub without hitting the rate limit. |
| `NO_COLOR`     | Any non-empty value turns color off.                                                                                                     |

For examples, see [Troubleshooting](/guides/troubleshooting/#a-check-runs-slowly).

## JSON errors

Commands with `--json` report a failure with the fields `error` and `message`. `error` contains the code below. `message` describes the failure and the action to take.

| Code           | What failed                                 |
| -------------- | ------------------------------------------- |
| `arguments`    | Command arguments or flags.                 |
| `git`          | A Git operation.                            |
| `files`        | Preparing files for a check.                |
| `writing`      | Saving gspot.toml.                          |
| `filesystem`   | Reading or accessing a file.                |
| `settings`     | A setting or the gspot.toml format.         |
| `manifest`     | A shipped configuration manifest.           |
| `installation` | Installing tools.                           |
| `tool`         | Finding or running a tool.                  |
| `output`       | Reading a tool's output.                    |
| `skip`         | A check lacks required files or conditions. |
| `pin`          | The repository's version pin.               |
| `template`     | Reading or using a template.                |
| `prompt`       | Asking for a plan to be accepted.           |
