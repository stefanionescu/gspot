---
title: Fix findings
description: Read a finding, explain it, fix it, and read the report.
---

A check line names the check, status, and number of findings.
If a tool needs installation or a check has an error, the line states the reason.
For a nested scope, the line starts with its path. A finding line names the file, line and optional column,
lint rule, and message. The checkout example produces this report:

```text
javascript/eslint  failed  4 findings
  src/checkout.ts:4:8  @typescript-eslint/require-await  Async function 'pay' has no 'await' expression.
  src/checkout.ts:5:5  sonarjs/no-try-promise  Consider using 'await' for the promise inside this 'try' or replace it with 'Promise.prototype.catch(...)' usage.
  src/checkout.ts:6  unicorn/no-abusive-eslint-disable  Specify the rules you want to disable.
  src/checkout.ts:8:13  no-empty  Empty block statement.
  help: Run `gspot check --fix` for the rules that fix themselves, then read each remaining line; `gspot explain <rule>` links the rule documentation.
  run again: gspot check --only javascript/eslint --staged
```

- `javascript/eslint` names the check. `failed` gives its status. The root scope has no path prefix.
- The second report line names the file, line, and column. `@typescript-eslint/require-await` names the lint rule.
- `help:` gives the action. `run again:` gives the command that runs that check alone.

Fix the file, then run the check again.

## Explain a finding

`gspot explain` prints what a check looks for, why it matters, and what to do:

```shell
gspot explain bash/shellcheck
```

For a rule inside a tool, name the tool and the rule, such as
`gspot explain eslint/no-console`. ESLint plugin rules work as the report prints them, for example `gspot explain gspot/no-trivial-files` and `gspot explain @typescript-eslint/no-explicit-any`. The output links the rule's documentation, prints the `gspot ignore <check> --rule <rule> --reason "..."` command that ignores its findings, and names the `tools.<tool>.rules` setting that changes its options.

`gspot explain <setting>` prints the value of a setting, its default, and where the value comes
from in each scope. `gspot explain ./<path>` lists the checks that read a file and the ignores
that match it.

## Run some checks or some files

To run a few checks, list them after one `--only` flag:

```shell
gspot check --only javascript/eslint typescript/tsc
```

To check some files or folders, name them before the flags, or after `--`:

```shell
gspot check src/app.ts docs
```

Write paths relative to the current folder. A check that reads the whole project still reports findings across the project, even when you name one file.

To check files changed after the base of a branch:

```shell
gspot check --changed origin/main
```

`--changed` checks the files changed after your upstream branch, or the default branch without an upstream. `--changed <ref>` picks another branch, tag, or commit. `--staged` checks only staged files.

## Fix findings automatically

```shell
gspot check --fix
```

`--fix --dry-run` previews fixes in a copy without writing source files. `--dry-run` needs `--fix`.

`--fix` runs every fixer that can fix its own findings. Formatters and import sorters supply these fixes. Then it runs the checks again. The changes stay in your working tree, unstaged,
so review them before you commit. If a fixer cannot run or fails, the command fails, and the
message names the fixer.

To add a fixer for your own command, see [command checks](/configure/command-checks/#add-a-fix-command).

## The report

The report prints the `failed`, `missing`, and `error` check rows. Add `--verbose` to include the `passed` and
`skipped` rows, each command, and each ignore with its reason. Passed rows include the selected file count and
elapsed time. A skipped check did not run, so it did not pass.

The summary counts failed checks and their findings, checks with a missing tool or an error, passed checks, and skipped checks.
The `missing` status indicates a tool that needs installation; the summary asks you to run `gspot install`.
A `run again:` line follows a failed check or a check with an error.

If a check has status `missing` or `error`, or a fixer failed, gspot exits 2. The report ends with the elapsed time
and exit code. Scripts and CI can read every check result in one JSON object from `gspot check --json`.

See [Ignore a finding](/use/ignore/) when a rule does not apply, or [limits](/reference/gspot-toml/limits/) to change a limit.
