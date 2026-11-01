---
title: Run checks
description: Read a finding, explain it, fix it, and read the report.
---

A failed check prints one line with `failed`, its check ID, and the number of findings. In a nested scope, the scope
path comes before the check ID. Under the line, each finding prints its file, line and column, lint rule, and message.

`help:` says what to do, and `rerun:` gives the command that runs that check alone. Without `--verbose`, the report
prints the first 200 findings of each check.

```text
failed   javascript/eslint  2 findings
  src/checkout.ts:4:8  @typescript-eslint/require-await  Async function 'pay' has no 'await' expression.
  src/checkout.ts:8:13  no-empty  Empty block statement.
  help: Run `gspot check --fix` for the rules that fix themselves, then read each remaining line; `gspot explain javascript/eslint <rule>` links the rule documentation.
  rerun: gspot check --only javascript/eslint --staged
```

Fix the file, then run the check again.

## Explain a finding

| Command                                                  | Prints                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `gspot explain bash/shellcheck`                          | What the check looks for, why it matters, and what to do.                            |
| `gspot explain javascript/eslint gspot/no-trivial-files` | Why the rule exists, how to fix its finding, an example, and its documentation link. |
| `gspot explain limits.max_file_lines`                    | The value of a setting, its default, and where the value comes from.                 |
| `gspot explain ./<file>`                                 | The checks that read a file and the ignores that match it.                           |

## Choose what to check

| Command                                               | Checks                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `gspot check`                                         | Every file, including work that you did not commit.               |
| `gspot check --staged`                                | The staged content, with the commit and push checks.              |
| `gspot check --staged --stage commit`                 | What the pre-commit hook runs: the commit checks on staged files. |
| `gspot check --changed`                               | The files changed since your upstream branch or `origin/HEAD`.    |
| `gspot check --base origin/main`                      | The files changed since another branch, tag, or commit.           |
| `gspot check <file> <folder>`                         | Some files and folders, relative to the current folder.           |
| `gspot check --only javascript/eslint,typescript/tsc` | Some checks.                                                      |

An explicit `--base <ref>` must name a branch, tag, or commit. gspot checks every file and prints the reason for
an empty base, an all-zero base, or a full hash that the clone lacks. Without an upstream or `origin/HEAD`, `--changed` asks for `--base`.

Repeat `--only` or separate the checks with commas: `--only a,b` and `--only a --only b` select the same checks. A path
after `--only` names files to check, not another check.

`--only` can run a check outside your configured level. gspot notes that choice and still requires the check's tools
and settings.

A check that reads the whole project, such as `typescript/tsc`, reads every file. With path arguments, the report keeps
its findings in those paths only. A staged or pushed run keeps every finding.

Before you commit, run `gspot check --staged --stage commit`. Before you push, run `gspot check --changed --stage push`.
The `--stage` flag selects only that stage; without it, `gspot check` runs the commit and push checks.

## Newly detected configurations

Every check run, including hooks and CI, detects configurations that your settings neither select nor remove. It
prints one warning before the summary, naming each configuration and the evidence from files or dependencies. Ask the user before selecting a new configuration, then run the `gspot add` line it prints and `gspot install`.
Run `gspot remove <name> --reason "<why>"` to decline one only after the user agrees. The warning does not change the exit code.

See [When files of a language appear or go](/configure/gspot-toml/#when-files-of-a-language-appear-or-go) to review
configuration changes with `gspot doctor`.

## Fix findings automatically

Run the formatters and the other fixers, then check again:

```shell
gspot check --fix
```

The changes stay in your working tree, unstaged, so review them before you commit. To add a fixer for your own command,
see [command checks](/configure/command-checks/#add-a-fix-command).

When a fix leaves a code file that fails to parse, gspot puts back the text that the file held before the fixers. It
names the file and exits with code 2.

## Statuses and exit codes

| Status    | Meaning                                                                                     | Exit code |
| --------- | ------------------------------------------------------------------------------------------- | --------- |
| `failed`  | The check reported findings.                                                                | 1         |
| `missing` | The tool needs installation: run `gspot install`.                                           | 2         |
| `error`   | The check stopped with an error; findings collected before it stopped remain in the report. | 2         |
| `passed`  | No findings.                                                                                | 0         |
| `off`     | The level or an ignore turns the check off. `--json` reports `skipped` with its `cause`.    | 0         |
| `skipped` | The check did not run; the line says why.                                                   | 0         |

The report shows `failed`, `missing`, and `error` rows. Add `--verbose` for the `passed`, `off`, and `skipped` rows, each
command, and each ignore with its reason. `gspot check --json` prints the whole report as one JSON object.

When a lint rule does not fit your code, [ignore the finding](/use/ignore/). To change a limit, see
[limits](/reference/gspot-toml/#limits).
