---
title: Fix findings
description: Read a finding, explain it, fix it, and read the report.
---

A failed check prints one line with its check ID, `failed`, and the number of findings. In a nested scope, the line
starts with the scope path. Under it, each finding prints its file, line and column, lint rule, and message. `help:` says
what to do, and `run again:` gives the command that runs that check alone. Without `--verbose`, the report prints the
first 200 findings of each check.

```text
javascript/eslint  failed  2 findings
  src/checkout.ts:4:8  @typescript-eslint/require-await  Async function 'pay' has no 'await' expression.
  src/checkout.ts:8:13  no-empty  Empty block statement.
  help: Run `gspot check --fix` for the rules that fix themselves, then read each remaining line; `gspot explain <rule>` links the rule documentation.
  run again: gspot check --only javascript/eslint --staged
```

Fix the file, then run the check again.

## Explain a finding

| Command                                | Prints                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `gspot explain bash/shellcheck`        | What the check looks for, why it matters, and what to do.                                               |
| `gspot explain gspot/no-trivial-files` | A lint rule, as the report prints it, with a link to its documentation and the command that ignores it. |
| `gspot explain limits.file_lines`      | The value of a setting, its default, and where the value comes from.                                    |
| `gspot explain ./<file>`               | The checks that read a file and the ignores that match it.                                              |

## Run some checks or files

| Command                                               | Checks                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `gspot check`                                         | Every file, including work that you did not commit.                 |
| `gspot check --staged`                                | The staged content, with the commit and push checks.                |
| `gspot check --hook pre-commit`                       | What the pre-commit hook runs: the commit checks on staged files.   |
| `gspot check --changed`                               | The files changed since your upstream branch or the default branch. |
| `gspot check --changed origin/main`                   | The files changed since another branch, tag, or commit.             |
| `gspot check <file> <folder>`                         | Some files and folders, relative to the current folder.             |
| `gspot check --only javascript/eslint typescript/tsc` | Some checks.                                                        |

A check that reads the whole project, such as `typescript/tsc`, still reports findings in every file.

## Fix findings automatically

`gspot check --fix` runs the formatters and the other fixers, then checks again. The changes stay in your working
tree, unstaged, so review them before you commit. `gspot check --fix --dry-run` shows the changes without writing
them. To add a fixer for your own command, see [command checks](/configure/command-checks/#add-a-fix-command).

## The report

| Status    | Meaning                                           | Exit code |
| --------- | ------------------------------------------------- | --------- |
| `failed`  | The check reported findings.                      | 1         |
| `missing` | The tool needs installation: run `gspot install`. | 2         |
| `error`   | The check could not run; the line says why.       | 2         |
| `passed`  | No findings.                                      | 0         |
| `skipped` | The check did not run; the line says why.         | 0         |

The report shows `failed`, `missing`, and `error` rows. Add `--verbose` for the `passed` and `skipped` rows, each
command, and each ignore with its reason. `gspot check --json` prints the whole report as one JSON object.

When a lint rule does not fit your code, [ignore the finding](/use/ignore/). To change a limit, see
[limits](/reference/gspot-toml/limits/).
