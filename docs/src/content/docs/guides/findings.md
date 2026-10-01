---
title: Fix findings
description: Read a finding, explain it, fix it, and read the report.
sidebar:
    order: 3
---

A finding names the file, the line, the check, and the message. The `help:` line under it
says what to do:

```text
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
`gspot explain shellcheck/SC2086`. The output also gives the exact `gspot ignore` and
`gspot set` lines that change the rule.

`gspot explain <setting>` prints the value of a setting, its default, and where the value comes
from in each scope. `gspot explain ./<path>` lists the checks that read a file and the ignores
that match it.

## Run some checks or some files

To run a few checks, list them after one `--only` flag:

```bash
gspot check --only typescript/eslint typescript/tsc
```

To check some files or folders, name them before the flags, or after `--`:

```bash
gspot check src/app.ts docs
```

Paths are relative to the current folder, or to the folder you pass with `-C`. A check that
reads the whole project still reports findings across the project, even when you name one
file.

## Fix findings automatically

```bash
gspot check --fix
```

`--fix` runs every fixer that can correct its own findings, such as formatters, import sorters,
and codemods. Then it runs the checks again. The changes stay in your working tree, unstaged,
so review them before you commit. If a fixer is missing or fails, the command fails, and the
message names the fixer.

To add a fixer for your own command, see [custom checks](/guides/custom-checks/#add-a-correction-command).

## When a rule does not fit

- To turn a rule off for some paths, [record an ignore](/guides/customize/#record-one-exception)
  with a reason.
- To change a limit, such as the longest function, [change the setting](/guides/customize/#change-a-limit).

Reports list every ignore, so an ignored finding stays visible.

## The report

At the end of a run, gspot prints the failed, missing, errored, and skipped checks, then the
counts and the time. A skipped check did not run, so it does not count as passed. The report
labels an interrupted run `incomplete`. Scripts and CI can read the same report as one JSON
object from `gspot check --json`.

## Files no check reads

`gspot doctor` lists the source files that no enabled check reads, grouped by file ending and
scope. For each ending it shows which kinds of checks run on it: format, syntax, style, and
types. Binary, generated, and vendored files do not count.

To fail the run when any source file goes unchecked, set this in `gspot.toml`:

```toml
[coverage]
strict = true
```

If gspot cannot write a cache file, it prints the path and the error. The findings and the exit
code stay the same.
