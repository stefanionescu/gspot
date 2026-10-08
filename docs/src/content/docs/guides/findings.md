---
title: Fix findings
description: Read a finding, explain it, fix it, and read the report.
---

A finding names the file, the line, the check, and the message. The `help:` line under it
says what to do:

```text
root  bash/syntax  failed  1 file  0.0s
  greet.sh:1  bash/syntax  syntax error near unexpected token `then'
    help: Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.
```

Fix the file, then run the check again.

## Explain a finding

`gspot explain` prints what a check looks for, why it matters, and what to do:

```bash
gspot explain bash/syntax
```

For a rule inside a tool, name the tool and the rule, such as
`gspot explain eslint/no-console`. Namespaced ESLint rule IDs work as printed in the report, for example `gspot explain gspot/no-trivial-files` and `gspot explain @typescript-eslint/no-explicit-any`. The output links the rule documentation and shows available policy commands.

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

Paths are relative to the current folder, or to the folder you pass with `-C`. A check that
reads the whole project still reports findings across the project, even when you name one
file.

To check files changed after the base of a branch and skip a check for this run:

```shell
gspot check --changed --base origin/main
gspot check --skip security/semgrep
```

`--changed` is boolean; `--base` names the comparison reference. `--staged` selects staged files only.

## Fix findings automatically

```bash
gspot check --fix
```

`--fix --dry-run` previews fixes in a copy without writing source files. `--dry-run` requires `--fix`.

`--fix` runs every fixer that can correct its own findings, such as formatters, import sorters,
and codemods. Then it runs the checks again. The changes stay in your working tree, unstaged,
so review them before you commit. If a fixer is missing or fails, the command fails, and the
message names the fixer.

To add a fixer for your own command, see [command checks](/guides/command-checks/#add-a-correction-command).

## When a rule does not fit

- To turn a rule off for some paths, [record an ignore](/guides/policy/#ignore-one-finding)
  with a reason.
- To change a limit, such as the longest function, [change the setting](/guides/policy/#change-a-limit).

## The report

At the end of a run, gspot prints the failed, missing, errored, and skipped checks, then the
counts and the time. A skipped check did not run, so it does not count as passed. When a check
does not run to the end, the report says `incomplete` and the run exits 2. Scripts and CI can
read the same report as one JSON object from `gspot check --json`.
