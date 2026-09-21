---
title: You got a finding, now what
description: Read it, explain it, fix it, or ignore it with a reason.
sidebar:
    order: 3
---

Every finding is one line: the file, the line, the check, the message, and a `help:` line that
says what to do.

```text
greet.sh:1  bash/syntax  syntax error near unexpected token `then'
    help: Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.
```

## Read it

`gspot explain <check>` prints what the check looks for, what goes wrong without it, and what to
do. For a rule inside a tool, `gspot explain <tool>/<rule>` prints the same and the exact
`gspot ignore` and `gspot set` lines that change it.

Run `gspot check --only typescript/eslint typescript/tsc` to select several checks.
List all check names after one `--only` flag.

Place paths before flags, or after `--`. Positional arguments select files or folders, as in
`gspot check src/app.ts docs`. Paths are relative to the working directory or the
directory selected with `-C`. A selected path can trigger a project-wide check;
that check still reports findings across the project.

## Fix it

`gspot check --fix` runs every fixer that can fix its own findings (formatters, import sorters,
codemods) and then the checks again. What it changed is in the working tree, not staged.

A missing tool or failed correction makes the command fail even if the checks pass afterward.
Read the fixer diagnostic and review any partial edits before running it again. A successful
correction counts as a change only when the selected files have different bytes.

For repository `[[check]]` entries, `help` supplies advice. To add an executable correction,
set `fix_command` to its argument list and `fix_order` to `codemod`, `imports`, `manifest`, or
`format`. Corrections run in that order. The executable can differ from the check command.

## Ignore it with a reason

```bash
gspot ignore typescript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print to the terminal on purpose."
```

An ignore without a reason is refused when `require_reasons` is enabled. Reports include ignore information; text output shows
the count, and `--verbose` expands the entries and matched counts. Remove the same scoped
exception with `gspot ignore typescript/eslint --rule no-console --paths "scripts/**" --remove`.

## Loosen a limit

```bash
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

When `require_reasons` is enabled, a loosening takes a reason; a tightening does not.

For a repository command that prints JSON, set `format = "json"` under `[check.output]`.
Use `items` to select its diagnostic array and `children` for nested arrays. Map the source
fields under `[check.output.fields]` to `file`, `line`, `column`, `rule`, and `message`.
Set `line_base = 0` when the tool counts lines and columns from zero.

## Machine-readable reports

`gspot check --json` prints the check report. A run also writes `.gspot/report.json` and
`.gspot/report.sarif`. It writes located findings to `.gspot/report.codequality.json` in
[GitLab Code Quality format](https://docs.gitlab.com/ci/testing/code_quality/). Findings without
file locations remain in JSON and SARIF. Repeated identical findings share a fingerprint.
Check results refer to their check through
`check`; `coverage` reports check coverage, not test coverage. The report has no repository
root field.

If a cache or report write fails, gspot prints the affected path and filesystem error on
stderr. The findings and exit code remain available. Message-hook checks preserve the
reports from the previous run.
