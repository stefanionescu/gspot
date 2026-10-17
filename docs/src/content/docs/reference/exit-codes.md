---
title: Exit codes and environment variables
description: Read command exit codes and the environment variables used by gspot.
---

| Exit code      | Meaning                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------- |
| `0`            | The command finished.                                                                        |
| `1`            | `check` reported findings, or `doctor` found a setup problem.                                |
| `2`            | The run did not finish: a missing tool, a failed fixer, an invalid report, or invalid input. |
| `130` or `143` | Ctrl-C or SIGTERM stopped `check` or `install`.                                              |

Each [command page](/reference/commands/) lists its own exit codes.

## Environment variables

| Variable       | Purpose                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | Lets gspot read a template from a private GitHub repository. mise also reads it for tool downloads from GitHub. |
| `NO_COLOR`     | Any nonempty value turns color off.                                                                             |

See [JSON output](/reference/json-report/) for report fields and error codes.
