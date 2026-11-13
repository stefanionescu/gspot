---
title: Run checks
---

This report from `gspot check` has two failed checks:

```text
failed   docs/lychee  1 finding
  README.md:3:5  ERROR  file://docs/missing.md (at 3:5) | File not found. Check if file exists and path is correct
  help: Point the link at the file or heading that exists, or delete it. A link that starts with / starts at the repository root. Details: gspot explain docs/lychee
  rerun: gspot check --only docs/lychee

failed   format/prettier  2 findings
  src/old.ts  Not formatted the way Prettier formats it.
  tsconfig.json  Not formatted the way Prettier formats it.
  help: Run the fix: command that the report prints to format the file. Details: gspot explain format/prettier
  fix: gspot check --fix --only format/prettier
  rerun: gspot check --only format/prettier
```

A check that runs in a [scope](/start/concepts/#scopes) prints the scope path before its ID. Each finding gives the file
and the message, and the line, column, and lint rule when the tool reports them. The report shows the first 200 findings
of each check, and `--verbose` shows them all.

`help:` says what to do and names the `gspot explain` command of the check, `fix:` runs the fixers of that check on the
files that it names, and `rerun:` runs that check again alone. When `gspot` is not on your `PATH`, a failed run also names
the command to write in its place, such as `npm exec --no -- gspot`.

## Explain a finding

`gspot explain` takes anything that a report names:

| Command                                  | Prints                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `gspot explain bash/shellcheck`          | What the check looks for, why it matters, and what to do.                          |
| `gspot explain javascript/eslint eqeqeq` | What the lint rule looks for, a link to its page, and the commands that change it. |
| `gspot explain limits.max_file_lines`    | The value of a setting, its default, and where the value comes from.               |
| `gspot explain ./<file>`                 | The checks that read the file, and the ignores that match it.                      |

## Choose what to check

Paths and `--staged` or `--base` choose the files, and `--only` and `--skip` choose the checks:

| Command                                               | Checks                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `gspot check`                                         | Every file, with the commit and push checks, including what you did not commit.   |
| `gspot check --staged`                                | The files as you staged them, with the commit and push checks.                    |
| `gspot check --staged --only commit`                  | What the pre-commit hook runs: the commit checks on the files as you staged them. |
| `gspot check --base origin/main`                      | What differs from a branch, tag, or commit: commits, edits, and new files.        |
| `gspot check --only push`                             | Every file, with the push checks of your level.                                   |
| `gspot check <file> <folder>`                         | The files and folders that you name, relative to the current folder.              |
| `gspot check --only javascript/eslint,typescript/tsc` | Only the checks that you name.                                                    |
| `gspot check --skip jest/tests`                       | Every check except the ones that you name.                                        |

To see the result of both hooks before you push, run `gspot check --base origin/HEAD`. A clone has `origin/HEAD`. In a
repository that added its remote later, run `git remote set-head origin --auto` first, or name the branch. Before the
first push to an empty remote, run `gspot check --only push`, because the remote has no `HEAD` yet.

`--only` and `--skip` take several check IDs: separate them with commas, or repeat the option. A path after `--only` is a
file to check, not another check. `--only` can also run a check that your [level](/start/concepts/#levels) turns off, with
a note, because the check still needs its tools and settings.

Some checks read the whole project, such as `typescript/tsc`. When you name paths, these checks still read every file,
but the report shows only their findings in those paths. In a run on staged or pushed files, the report shows all of
their findings.

## Fix findings automatically

This runs the formatters and the other fixers on the file, then checks it again:

```shell title="example"
gspot check --fix src/app.ts
```

Without a path, the fixers change every file, and in an existing repository each changed file then fails on its old lint
findings at the next commit. gspot does not stage the changes, so review them before you commit. If a code file fails to
parse after the fixers run, gspot restores the text that the file held before, names the file, and exits with code 2. To
add a fixer to a command check of your own, follow [Add a fix command](/configure/command-checks/#add-a-fix-command).

`gspot check --fix` also rewrites the generated files that `gspot/generated-files` reports as stale, before the fixers
run. A plain `gspot check` writes nothing. `gspot install` rewrites the generated files too, and it alone installs the
tools and writes the tool lockfiles under `.gspot/`.

## Statuses and exit codes

| Status     | Meaning                                                                                                               | Exit code     |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| `failed`   | The check reported findings.                                                                                          | 1             |
| `missing`  | The tool of the check is not installed. Run `gspot install`.                                                          | 2             |
| `error`    | The check stopped with an error. The report keeps the findings from before it stopped.                                | 2             |
| `canceled` | SIGHUP, Ctrl-C, or SIGTERM stopped the check.                                                                         | 129, 130, 143 |
| `passed`   | The check found nothing.                                                                                              | 0             |
| `skipped`  | The check did not run. The row names the cause, such as `skipped (level)`. With `--json`, the `cause` field holds it. | 0             |

The report shows the `failed`, `missing`, `error`, and `canceled` rows. `--verbose` adds the `passed` and `skipped`
rows, each command, and each ignore with its reason. `gspot check --json` prints the whole report as one JSON object, as
[JSON output](/reference/json-output/#gspot-check) describes.
