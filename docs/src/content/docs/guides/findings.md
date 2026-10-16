---
title: Fix findings
description: Read a finding, explain it, fix it, and read the report.
---

A finding names the file, the line, the check, and the message. The `help:` line under it
says what to do:

```text
root  bash/shellcheck  failed  1 file  0.0s
  greet.sh:1:1  SC1073  Couldn't parse this if expression. Fix to allow more checks.
    help: Fix the ShellCheck finding at the line it names.
```

Fix the file, then run the check again.

## Explain a finding

`gspot explain` prints what a check looks for, why it matters, and what to do:

```bash
gspot explain bash/shellcheck
```

For a rule inside a tool, name the tool and the rule, such as
`gspot explain eslint/no-console`. ESLint plugin rules work as the report prints them, for example `gspot explain gspot/no-trivial-files` and `gspot explain @typescript-eslint/no-explicit-any`. The output links the rule's documentation, prints the `gspot ignore <check> --rule <rule> --reason "..."` command that ignores its findings, and names the `tools.<tool>.rules` setting that changes its options.

`gspot explain <setting>` prints the value of a setting, its default, and where the value comes
from in each scope. `gspot explain ./<path>` lists the checks that read a file and the ignores
that match it.

## Run some checks or some files

To run a few checks, list them after one `--only` flag:

```bash
gspot check --only javascript/eslint typescript/tsc
```

To check some files or folders, name them before the flags, or after `--`:

```bash title="Check selected files"
gspot check src/app.ts docs
```

Write paths relative to the current folder. A check that reads the whole project still reports findings across the project, even when you name one file.

To check files changed after the base of a branch:

```shell
gspot check --base origin/main
```

`--changed` checks the files changed after your upstream branch, or the default branch without an upstream. `--base <branch>` picks another branch. `--staged` checks only staged files.

## Fix findings automatically

```bash
gspot check --fix
```

`--fix --dry-run` previews fixes in a copy without writing source files. `--dry-run` turns on `--fix`.

`--fix` runs every fixer that can fix its own findings. Formatters and import sorters supply these fixes. Then it runs the checks again. The changes stay in your working tree, unstaged,
so review them before you commit. If a fixer cannot run or fails, the command fails, and the
message names the fixer.

To add a fixer for your own command, see [command checks](/guides/command-checks/#add-a-fix-command).

## When a rule does not fit

- To turn a rule off for some paths, [record an ignore](/guides/exclude/#ignore-a-finding)
  with a reason.
- To change a limit, such as the longest function, [change the setting](/guides/gspot-toml/#change-a-limit).

## The report

The report prints one line per check with its status: `passed`, `failed`, `missing`, `error`, or `skipped`. The `missing` status indicates a tool that needs installation. Then the report prints the totals. A skipped check did not run, so it did not pass. If a check has status `missing` or `error`, or a fixer failed, the summary line ends in the word `incomplete` in parentheses and gspot exits 2. Scripts and CI can read the same report as one JSON object from `gspot check --json`.
