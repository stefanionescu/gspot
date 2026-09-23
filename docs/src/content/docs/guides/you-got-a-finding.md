---
title: You got a finding, now what
description: Read diagnostics, verify corrections, and inspect check reports.
sidebar:
    order: 3
---

Use the [source installation guide](/guides/install/) to prepare the CLI. Run the commands below
from the repository root unless a step names another directory.

A located finding identifies its file, line, check, and message. The `help:` line describes
the correction. Some tool failures have no file location:

```text
greet.sh:1  bash/syntax  syntax error near unexpected token `then'
    help: Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.
```

## Explain and select checks

`gspot explain <check>` prints what the check looks for, what goes wrong without it, and what to
do. For a rule inside a tool, `gspot explain <tool>/<rule>` prints the same and the exact
`gspot ignore` and `gspot set` lines that change it.

`gspot explain <setting>` shows the effective value, default, and source in every scope
that exposes the setting. Its change commands name the target scope. JSON output carries
these values in `scopes`. `gspot explain ./<path>` lists enabled checks for that file,
including repository commands, and recorded exceptions that match the path.

Run `gspot check --only typescript/eslint typescript/tsc` to select several checks.
List all check names after one `--only` flag.

Place paths before flags, or after `--`. Positional arguments select files or folders, as in
`gspot check src/app.ts docs`. Paths are relative to the working directory or the
directory selected with `-C`. A selected path can trigger a project-wide check;
that check still reports findings across the project.

## Apply automatic corrections

`gspot check --fix` runs every fixer that can fix its own findings (formatters, import sorters,
codemods) and then the checks again. What it changed is in the working tree, not staged.

A missing tool or failed correction makes the command fail even if the checks pass afterward.
Read the fixer diagnostic and review any partial edits before running it again. A successful
correction counts as a change only when the selected files have different bytes.

For repository commands, configure [custom check corrections](/guides/custom-checks/#add-a-correction-command).

## Ignore it with a reason

Follow [record one exception](/guides/customize/#record-one-exception) to disable a tool rule
for selected paths and later remove that exception. Keep the reason specific to the affected
code. Reports retain exceptions; an ignored finding is not a corrected defect.

## Loosen a limit

Follow [change a limit](/guides/customize/#change-a-limit) to adjust a setting and review the
resulting policy. When `require_reasons` is enabled, a loosening takes a reason; a tightening does not.

## Machine-readable reports

On a terminal, gspot prints a status line when each check finishes. A cached pass is
`unchanged`. Redirected output prints completion lines for failures and execution errors.
The final report lists failed, missing, errored, and skipped checks, followed by counts of
passed, failed, and skipped checks, findings, and elapsed seconds. Skipped checks do not count
as passes. An interrupted or otherwise incomplete run is labeled `incomplete`.

`gspot check --json` prints the check report. A run also writes `.gspot/report.json` and
`.gspot/report.sarif`. It writes located findings to `.gspot/report.codequality.json` in
[GitLab Code Quality format](https://docs.gitlab.com/ci/testing/code_quality/). Findings without
file locations remain in JSON and SARIF. Repeated identical findings share a fingerprint.
Check results refer to their check through
`check`; `coverage` reports check coverage, not test coverage. Project-wide input files count
only when the check claims them. The checked-file count uses paths confirmed by the analysis. For nginx, this includes the
configuration files listed in a successful native configuration dump.

`gspot doctor` reports the check kinds configured for each source file. It uses enabled
checks and their file claims, including path exceptions and repository commands. The unchecked
count includes supported source files without an enabled check. `check` and `doctor` use the
same calculation. Binary, generated, and vendored files do not enter this source coverage count.
Tool installation problems appear separately in the doctor report.

`gspot doctor` and `gspot list` group source endings by scope and configured check kinds:
format, syntax, style, and types. Files with the same ending but different coverage appear
on separate rows. An ending with none of these checks, including an unsupported ending,
appears with an explicit absence message. JSON output includes these rows under `coverage.endings`.

Set `[coverage] strict = true` to fail source checks when this unchecked count is nonzero.
The report records located policy findings under `coverage.findings`, including in SARIF
and GitLab reports. This policy applies to the repository configuration even when you select
a stage, path, or check. Message hooks do not enforce source coverage. `coverage.checked`
counts files analyzed during the run, so it and the configured unchecked count do not necessarily
sum to the repository file count.

If a cache or report write fails, gspot prints the affected path and filesystem error on
stderr. The findings and exit code remain available. Message-hook checks preserve the
reports from the previous run.
