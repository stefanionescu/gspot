---
title: Exit codes and environment variables
description: Read command exit codes and the environment variables used by gspot.
---

| Exit code      | Meaning                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `0`            | The command finished.                                                                                    |
| `1`            | `check` found findings, or `doctor` found a setup problem.                                               |
| `2`            | The run did not finish: a tool is missing, a fixer failed, a report is invalid, or the input is invalid. |
| `130` or `143` | `check` or `install` was stopped by Ctrl-C or SIGTERM.                                                   |

gspot keeps exit code `2` for failure and usage errors to preserve its established exit-code contract.
Each [command page](/reference/commands/) lists its own exit codes. `gspot doctor` exits `1` for a tool or hook that needs setup.

## Environment variables

| Variable       | Purpose                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | Lets gspot read a template from a private GitHub repository. mise also reads it for tool downloads from GitHub. |
| `NO_COLOR`     | Any nonempty value turns color off.                                                                             |

See [JSON output](/reference/json-report/) for report fields and error codes.
