---
title: JSON output
description: The JSON object that every gspot command prints under `--json`.
---

Add `--json` to any command to print one JSON object to standard output. Progress text stays on standard error. Run
from any folder in the repository.

```shell
gspot check --json
```

## Fields of every object

| Field      | Meaning                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| `version`  | The gspot version that ran, as a string.                                  |
| `exitCode` | The process exit code. See [Exit codes](/reference/commands/#exit-codes). |
| `notes`    | Text lines for you to read, such as the next command to run. Often empty. |

The other fields depend on the command. Each field keeps one type in every command: `written` always holds a list of
paths, and `summary` always holds a string.

## Command errors

When a command fails, its object also has `error` and `message`, and no command fields. `message` describes the failure
and the action to take. `error` holds one of these codes:

| Code            | What failed                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `arguments`     | Command arguments or flags.                                                       |
| `git`           | A Git operation.                                                                  |
| `copy`          | Copying the files of a check into a temporary folder.                             |
| `writing`       | Writing `gspot.toml` or a generated file.                                         |
| `filesystem`    | A repository file is missing, unreadable, or at a path gspot refuses.             |
| `parse`         | A file has invalid syntax or structure, including malformed TOML in `gspot.toml`. |
| `settings`      | A parsed setting has an invalid key, value, or combination.                       |
| `configuration` | A shipped configuration.                                                          |
| `install`       | Installing tools.                                                                 |
| `tool`          | Finding or running a tool.                                                        |
| `output`        | Reading a tool's output.                                                          |
| `runtime`       | The running Node.js or Bun version does not meet the package minimum.             |
| `prompt`        | A question that asks you to accept a plan.                                        |
| `unexpected`    | An unexpected error; the message names it.                                        |
| `canceled`      | A signal stopped the command. `exitCode` holds the signal's exit code.            |

## Generated files

`init`, `apply`, and the commands that change settings list the generated files by what happened to them. Each field
holds repository-relative paths.

| Field       | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| `written`   | Files that gspot created or replaced.                   |
| `updated`   | Files where gspot changed only its own block or keys.   |
| `removed`   | Files that gspot deleted because no setting needs them. |
| `unchanged` | Files that already matched `gspot.toml`.                |

## `gspot init`

`gspot init --json` needs `--yes`, because gspot cannot ask while it prints JSON. Its object has `root`, the repository folder; `plan`, the plan that `init` prints;
`settings`, the text of the new `gspot.toml`; and the [generated-file fields](#generated-files).

`plan` holds `level`, `configurations`, and the file lists `write`, `delete`, `keep`, `change`, and `lintFolders`. Each
item of `configurations` has `configuration`, `origin`, `checks`, and `checksOff`. Each file row has `path` and `note`. With `--from`, `plan`
also has `template`, with the template `file` and the `leftOut` settings.

## `gspot install`

`gspot install --json` returns `summary`, the lines that say what install did, and `steps`, the commands it ran, as
argument lists. `notes` holds what you still have to do, such as the lines to add to hooks that another tool manages.

## `gspot apply`

`gspot apply --json` returns the [generated-file fields](#generated-files). `notes` says, for example, when the tools
changed and `gspot install` must run.

`gspot apply --dry-run --json` writes nothing. It returns `dryRun: true` and `outdated`. Each `outdated` item has `path`, `kind`, and `diff` for a changed file. `kind` holds `changed`,
`missing`, or `stray`.

## `gspot check`

`gspot check --json` returns the report of the run. `exitCode` says whether the checks passed.

| Field             | Meaning                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `stage`           | The selected stage: `commit`, `push`, `message`, `manual`, or `all` for the default run.     |
| `started`         | Start time as an ISO 8601 timestamp.                                                         |
| `duration`        | Elapsed run time in milliseconds.                                                            |
| `comparison`      | When present, the selected content (`working-tree`, `index`, or `commit`) and its reference. |
| `checks`          | The result of every planned check, skipped ones included, with their findings.               |
| `ignores`         | Ignores in effect, with their check, optional lint rule, paths, and reason.                  |
| `unstagedChanges` | Number of changed files left out when the run reads the staging area.                        |
| `partial`         | Whether the run selected only staged files, changed files, or named paths.                   |
| `fixes`           | When fixes ran: changed files, files restored after broken fixes, and fixer errors.          |
| `failed`          | Check IDs that failed or stopped with an error, and the checks whose fixer failed.           |
| `notChecked`      | When present, detected configurations that `gspot.toml` neither selects nor removes.         |

Each `checks` item has `check`, `scope`, `status`, `fileCount`, `duration`, and `findings`. It can also have `files`,
`note`, `reproduce`, `command`, and, for a skipped check, `cause`. `status` holds `passed`, `failed`, `missing`,
`error`, or `skipped`. `missing` and `error` make the run incomplete, with exit code `2`. `cause` holds `system`,
`replaced`, `setting`, `condition`, `ignore`, or `no-files`.

Each finding has `check`, `file`, `message`, and `fixable`. It can also have `line`, `column`, `rule`, and `help`.
Lines and columns start at `1`. A finding without a source location can have an empty `file`.

Each `notChecked` item has `configuration` and `evidence`. Run `gspot add <name>` to select one, or
`gspot remove <name> --reason "<why>"` to decline one. The list does not change `exitCode`.

`gspot check --hook pre-push --json` checks each pushed tree. It returns `revisions`, one item per tree with `hash`,
`refs`, `commits`, `shallow`, and its `report`; `skipped`, the pushed refs that gspot did not check, with `ref`,
`hash`, and `reason`; and, when a signal stopped the run, `canceled.pendingRefs`.

## Commands that change settings

`add`, `remove`, `set`, `unset`, `ignore`, and `unignore` return `changed`, whether the command changed `gspot.toml`, and `summary`, one sentence about the
result. When the command applies the generated files, the object also has the
[generated-file fields](#generated-files). A command that has nothing to change returns before it applies files, and
omits them.

Do not infer generated-file changes from `changed`: a command that leaves `gspot.toml` unchanged can still repair stale
files.

## `gspot list`

`gspot list --json` and `gspot list configurations --json` return `selected` and `available`. Each `selected` item has
`name` and `checks`, and each check has `name`, `scope`, and `state`. Each `available` item has `name` and
`description`.

`gspot list settings --json` returns `settings`. Each item has `key`, `value`, `source`, `origin`, `reason_when`, and
`scope`, and `originScope` when a scope inherits the value from another scope.

## `gspot explain`

`gspot explain <subject> --json` returns `kind` and `subject`, and the facts that the text shows.

| `kind`          | Main fields                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- |
| `check`         | `check`, `configuration` or `command`, `stage`, `level`, `summary`, `why`, `help`, `rules`.  |
| `lint-rule`     | `tool`, `rule`, `check`, and `page`, the rule's documentation link or `null`.                |
| `configuration` | `name`, `group`, `title`, `description`, `requires`, `tools`, `checks`, `settings`, `rules`. |
| `setting`       | `key`, `description`, `type`, and `scopes`, each with `scope`, `default`, `value`, `source`. |
| `path`          | `path`, `scope`, `fileKind`, `tags`, `configurations`, `checks`, and `ignores`.              |

## `gspot doctor`

`gspot doctor --json` returns the state of the setup. `exitCode` holds `1` when a tool, environment, or hook needs
your action.

| Field            | Meaning                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `tools`          | Each tool with `name` and `state`, and `want`, `found`, `path`, and `help` when known. |
| `environments`   | Project environments that a check needs and that are missing.                          |
| `suggestions`    | Configurations to add, and files that no configuration checks.                         |
| `addCommands`    | The `gspot add` commands for the detected configurations.                              |
| `hooks`          | The state of the Git hooks, as text.                                                   |
| `ci`             | The state of the CI workflow, as text.                                                 |
| `ruleFiles`      | The number of rule files for coding agents.                                            |
| `submodules`     | Submodule paths, whose contents gspot does not read.                                   |
