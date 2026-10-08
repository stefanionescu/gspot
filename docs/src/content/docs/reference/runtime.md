---
title: Exit codes and environment variables
description: Interpret command results and configure execution from the environment.
---

| Exit code | Meaning                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `0`       | The command completed. For check, every check that ran passed; skipped checks remain listed.                              |
| `1`       | Findings remain, or a correction failed. Doctor also reports setup problems with a nonzero status.                        |
| `2`       | Invalid input or an incomplete operation, including missing tools, invalid output, cancellation, or an execution failure. |

Each [command reference](/reference/commands/) gives its exact exit contract.

| Variable       | Purpose                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GSPOT_JOBS`   | Positive integer limiting concurrent checks. By default, execution uses the available processor count.                  |
| `GITHUB_TOKEN` | Credentials for supported GitHub release downloads. Keep it in the environment and out of committed policy and reports. |

To limit concurrent checks in a POSIX shell:

```shell
GSPOT_JOBS=2 gspot check
```

In PowerShell, set `$env:GSPOT_JOBS = "2"` before running the command.
