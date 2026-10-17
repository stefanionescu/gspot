---
title: JSON output
description: Read check reports and command errors as JSON.
---

Use `gspot check --json` to write one report to standard output. The process exit code matches `exitCode`.
Progress and error text stay on standard error. Run from any folder in the repository.

```shell
gspot check --json
```

## Report fields

| Field             | Meaning                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `version`         | The gspot version that made the report.                                                       |
| `stage`           | The selected stage, or the default combined selection.                                        |
| `started`         | Start time as an ISO 8601 timestamp.                                                          |
| `duration`        | Elapsed run time in milliseconds.                                                             |
| `comparison`      | When present, the selected content (`working-tree`, `index`, or `commit`) and its reference.  |
| `checks`          | Results for checks that ran, including their findings.                                        |
| `ignores`         | Ignores in effect, with their check, optional lint rule and paths, reason, and matched count. |
| `skips`           | Checks that did not run and the cause. A skipped check did not pass.                          |
| `unstagedChanges` | Number of changed files left out when the run reads the staging area.                         |
| `partial`         | Whether the run selected only staged files, changed files, or named paths.                    |
| `failed`          | Check IDs that failed, including checks whose fixer failed.                                   |
| `exitCode`        | The process exit code. See [Exit codes](/reference/exit-codes/).                              |

## Check results

Each `checks` item has `check`, `scope`, `status`, `fileCount`, `duration`, and `findings`.
It can also have `files`, `note`, `reproduce`, and `command`. The status takes one of `passed`, `failed`, `missing`, `error`, or
`skipped`. `missing` and `error` make the run incomplete and produce exit code `2`.

Each finding has `check`, `file`, `message`, and `fixable`. Optional fields include `line`, `column`, `rule`, and
`help`. Source lines and columns start at `1`. A finding without a source location can have an empty `file`.

## Command errors

Commands with `--json` report an error with `error` and `message`. `error` holds one of the codes below.
`message` describes the failure and the action to take.

| Code           | What failed                                |
| -------------- | ------------------------------------------ |
| `arguments`    | Command arguments or flags.                |
| `git`          | A Git operation.                           |
| `files`        | Preparing files for a check.               |
| `writing`      | Saving gspot.toml.                         |
| `filesystem`   | Reading or accessing a file.               |
| `settings`     | A setting or the gspot.toml format.        |
| `manifest`     | A shipped configuration manifest.          |
| `installation` | Installing tools.                          |
| `tool`         | Finding or running a tool.                 |
| `output`       | Reading a tool's output.                   |
| `pin`          | The repository's version pin.              |
| `template`     | Reading or using a template.               |
| `prompt`       | Asking for a plan to be accepted.          |
| `failure`      | An unexpected error; the message names it. |
| `canceled`     | A signal stopped the command.              |
