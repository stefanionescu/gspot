---
title: Run checks
description: Run the checks, read a finding, explain it, fix it, and read the report.
---

`gspot check` runs the checks and prints each problem that they find. Each problem is a finding. Here is part of a
report with two failed checks:

```text
failed   docs/lychee  1 finding
  README.md:3:19  ERROR  file://docs/missing.md (at 3:19) | File not found. Check if file exists and path is correct
  help: Point the link at the file or heading that exists, or delete it. gspot explain docs/lychee
  rerun: gspot check --only docs/lychee

failed   format/prettier  3 findings
  src/math.ts  Not formatted the way Prettier formats it.
  src/total.ts  Not formatted the way Prettier formats it.
  tsconfig.json  Not formatted the way Prettier formats it.
  help: Run the fix: command that the report prints to format the file. gspot explain format/prettier
  fix: gspot check --fix --only format/prettier
  rerun: gspot check --only format/prettier
```

The first line of each failed check shows its status, its check ID, and the number of findings. When the check runs in
a [scope](/start/concepts/#scopes), the scope path comes before the ID. Each finding line shows the file, the line and
column, the lint rule, and the message. After the findings, a `help:` line says what to do and names the
`gspot explain` command for the check.

- `fix:` is a command that runs the fixers of that check. When it names files, it changes only those files.
- `rerun:` is a command that runs that check again, alone.

The report shows the first 200 findings of each check. Add `--verbose` to see every finding.

## Explain a finding

| Command                                                  | Prints                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `gspot explain bash/shellcheck`                          | What the check looks for, why it matters, and what to do.                             |
| `gspot explain javascript/eslint gspot/no-trivial-files` | Why the lint rule exists, how to fix its finding, an example, and a link to its docs. |
| `gspot explain limits.max_file_lines`                    | The value of a setting, its default, and where the value comes from.                  |
| `gspot explain ./<file>`                                 | The checks that read the file, and the ignores that match it.                         |

## Choose what to check

| Command                                               | Checks                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `gspot check`                                         | Every file, including changes that you did not commit.                |
| `gspot check --staged`                                | The files as you staged them, with the commit and push checks.        |
| `gspot check --staged --stage commit`                 | What the pre-commit hook runs: the commit checks on the staged files. |
| `gspot check --changed`                               | The files changed since your upstream branch or `origin/HEAD`.        |
| `gspot check --base origin/main`                      | The files changed since another branch, tag, or commit.               |
| `gspot check <file> <folder>`                         | The files and folders that you name, relative to the current folder.  |
| `gspot check --only javascript/eslint,typescript/tsc` | Only the checks that you name.                                        |
| `gspot check --skip jest/tests`                       | Every check except the ones that you name.                            |

`--base <ref>` takes a branch, tag, or commit. If the base is empty or all zeros, gspot checks every file and prints
why. It does the same when the clone lacks the full commit hash that you give. `--changed` compares with the upstream branch, `origin/HEAD`,
`origin/main`, or `origin/master`. When none of them exists, `--changed` stops and asks you to use `--base`.

Separate several check IDs with commas, or repeat the option. `--only a,b` and `--only a --only b` select the
same checks. A path after `--only` is a file to check, not another check. `--skip` takes checks in the same way.

`--only` can run a check that your [level](/start/concepts/#levels) turns off. gspot prints a note about it, and the
check still needs its tools and settings.

Some checks read the whole project, such as `typescript/tsc`. When you name paths, these checks still read every file,
but the report shows only their findings in those paths. In a run on staged or pushed files, the report shows all of
their findings.

Before you commit, run `gspot check --staged --stage commit`. Before you push, run `gspot check --changed --stage push`.
`--stage` runs only the checks of one [stage](/start/concepts/#stages). Without it, `gspot check` runs both the commit
and the push checks.

## Fix findings automatically

Run the formatters and the other fixers, then check again:

```shell
gspot check --fix
```

gspot does not stage the changes, so review them before you commit. To add a fixer to a command check of your own,
follow [Add a fix command](/configure/command-checks/#add-a-fix-command).

If a code file fails to parse after the fixers run, gspot restores the text that the file held before. It names the
file and exits with code 2.

## Statuses and exit codes

| Status     | Meaning                                                                                                               | Exit code     |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| `failed`   | The check reported findings.                                                                                          | 1             |
| `missing`  | The tool of the check is not installed. Run `gspot install`.                                                          | 2             |
| `error`    | The check stopped with an error. The report keeps the findings from before it stopped.                                | 2             |
| `canceled` | SIGHUP, Ctrl-C, or SIGTERM stopped the check.                                                                         | 129, 130, 143 |
| `passed`   | The check found nothing.                                                                                              | 0             |
| `skipped`  | The check did not run. The row names the cause, such as `skipped (level)`. With `--json`, the `cause` field holds it. | 0             |

The report shows the `failed`, `missing`, `error`, and `canceled` rows. Add `--verbose` to also see the `passed` and
`skipped` rows, each command, and each ignore with its reason. `gspot check --json` prints the whole report as one JSON
object, as [JSON output](/reference/json-output/#gspot-check) describes.

When you add files of a language that none of your configurations covers, the check `gspot/detected-configurations`
fails. It prints the `gspot add <name>` command that turns on the configuration for that language.
[When files of a language appear or go](/configure/gspot-toml/#when-files-of-a-language-appear-or-go) describes this
check.

When a lint rule does not fit your code, [ignore the finding](/use/ignore/) and give a reason.
