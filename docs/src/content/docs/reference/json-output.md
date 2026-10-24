---
title: JSON output
description: The fields of `gspot check --json` and the error object of every `--json` command.
---

Use `gspot check --json` to write one report to standard output. The process exit code matches `exitCode`.
Progress and error text stay on standard error. Run from any folder in the repository.

```shell
gspot check --json
```

## Report fields

| Field             | Meaning                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `version`         | The gspot version that made the report.                                                      |
| `stage`           | The selected stage: `commit`, `push`, `message`, `manual`, or `all` for the default run.     |
| `started`         | Start time as an ISO 8601 timestamp.                                                         |
| `duration`        | Elapsed run time in milliseconds.                                                            |
| `comparison`      | When present, the selected content (`working-tree`, `index`, or `commit`) and its reference. |
| `checks`          | The result of every planned check, skipped ones included, with their findings.               |
| `ignores`         | Ignores in effect, with their check, optional lint rule, paths, and names, and reason.       |
| `unstagedChanges` | Number of changed files left out when the run reads the staging area.                        |
| `partial`         | Whether the run selected only staged files, changed files, or named paths.                   |
| `failed`          | Check IDs that failed or stopped with an error, and the checks whose fixer failed.           |
| `exitCode`        | The process exit code. See [Exit codes](/reference/commands/#exit-codes).                    |

## Check results

Each `checks` item has `check`, `scope`, `status`, `fileCount`, `duration`, and `findings`.
It can also have `files`, `note`, `reproduce`, and `command`. A skipped result carries its `cause`. The status takes one of `passed`, `failed`, `missing`, `error`, or
`skipped`. `missing` and `error` make the run incomplete and produce exit code `2`.

Each finding has `check`, `file`, `message`, and `fixable`. Optional fields include `line`, `column`, `rule`, `help`,
and `name`, the definition that a `structure/trivial-functions` or `python/vulture` finding names. Source lines and columns start at `1`. A finding without a source location can have an empty `file`.

The `cause` of a skip takes one of `level`, `system`, `replaced`, `setting`, `condition`, `ignore`, or
`no-files`.

## Push report

`gspot check --hook pre-push --json` checks each pushed tree and prints one object:

| Field                  | Meaning                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `revisions`            | One item per distinct tree: `hash`, `refs`, `commits`, `shallow`, and `report`. |
| `skipped`              | Pushed refs that gspot did not check, with `ref`, `hash`, and `reason`.         |
| `exitCode`             | The process exit code.                                                          |
| `canceled.pendingRefs` | When a signal stopped the run, the refs that gspot did not check.               |

Each `report` holds the report fields above. `shallow` holds `true` when the pushed history reaches the
boundary of a shallow clone. Checks that read history then refuse to run.

## Command errors

Commands with `--json` report an error with `error` and `message`. `error` holds one of the codes below.
`message` describes the failure and the action to take.

| Code            | What failed                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| `arguments`     | Command arguments or flags.                                                             |
| `git`           | A Git operation.                                                                        |
| `copy`          | Copying the files of a check into a temporary folder.                                   |
| `writing`       | Writing `gspot.toml` or a generated file.                                               |
| `filesystem`    | A file of the repository: missing, not readable, not valid, or at a path gspot refuses. |
| `settings`      | A setting or the gspot.toml format.                                                     |
| `configuration` | A shipped configuration.                                                                |
| `install`       | Installing tools.                                                                       |
| `tool`          | Finding or running a tool.                                                              |
| `output`        | Reading a tool's output.                                                                |
| `pin`           | The repository's version pin.                                                           |
| `prompt`        | A question that asks you to accept a plan.                                              |
| `unexpected`    | An unexpected error; the message names it.                                              |
| `canceled`      | A signal stopped the command. The object also holds `exitCode`.                         |
