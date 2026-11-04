---
title: Run checks
description: Read a finding, explain it, fix it, and read the report.
---

`gspot check` runs the checks and prints the findings. This excerpt of a report shows two failed checks:

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

Each failed check prints its status, its check ID, and the number of findings. In a scope, the scope path comes before
the ID. Each finding prints its file, line and column, lint rule, and message. After the findings, a `help:` line says
what to do and names the `gspot explain` command for the check.

- `fix:` runs the fixers of that check. When it names files, it changes only those files.
- `rerun:` runs that check alone.

The report shows the first 200 findings of each check. Add `--verbose` to see every finding.

## Explain a finding

| Command                                                  | Prints                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `gspot explain bash/shellcheck`                          | What the check looks for, why it matters, and what to do.                            |
| `gspot explain javascript/eslint gspot/no-trivial-files` | Why the rule exists, how to fix its finding, an example, and its documentation link. |
| `gspot explain limits.max_file_lines`                    | The value of a setting, its default, and where the value comes from.                 |
| `gspot explain ./<file>`                                 | The checks that read a file and the ignores that match it.                           |

## Choose what to check

| Command                                               | Checks                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `gspot check`                                         | Every file, including work that you did not commit.               |
| `gspot check --staged`                                | The staged content, with the commit and push checks.              |
| `gspot check --staged --stage commit`                 | What the pre-commit hook runs: the commit checks on staged files. |
| `gspot check --changed`                               | The files changed since your upstream branch or `origin/HEAD`.    |
| `gspot check --base origin/main`                      | The files changed since another branch, tag, or commit.           |
| `gspot check <file> <folder>`                         | Some files and folders, relative to the current folder.           |
| `gspot check --only javascript/eslint,typescript/tsc` | Some checks.                                                      |
| `gspot check --skip jest/tests`                       | Every check except some.                                          |

`--base <ref>` must name a branch, tag, or commit. gspot checks every file and prints the reason for an empty base, an
all-zero base, or a full hash that the clone lacks. Without an upstream or `origin/HEAD`, `--changed` asks for `--base`.

Repeat `--only` or separate the checks with commas: `--only a,b` and `--only a --only b` select the same checks. A path
after `--only` names files to check, not another check. `--skip` takes its checks the same way.

`--only` can run a check outside your level. gspot notes that choice and still requires the tools and settings of the
check.

A check that reads the whole project, such as `typescript/tsc`, reads every file. With path arguments, the report keeps
its findings in those paths only. A staged or pushed run keeps every finding.

Before you commit, run `gspot check --staged --stage commit`. Before you push, run `gspot check --changed --stage push`.
The `--stage` flag selects only that stage; without it, `gspot check` runs the commit and push checks.

## Fix findings automatically

Run the formatters and the other fixers, then check again:

```shell
gspot check --fix
```

The changes stay in your working tree, unstaged, so review them before you commit. To add a fixer for your own command,
see [command checks](/configure/command-checks/#add-a-fix-command).

When a fix leaves a code file that fails to parse, gspot puts back the text that the file held before the fixers. It
names the file and exits with code 2.

## Statuses and exit codes

| Status     | Meaning                                                                                                    | Exit code |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| `failed`   | The check reported findings.                                                                               | 1         |
| `missing`  | The tool needs installation: run `gspot install`.                                                          | 2         |
| `error`    | The check stopped with an error; findings collected before it stopped remain in the report.                | 2         |
| `canceled` | Ctrl-C or SIGTERM stopped the check.                                                                       | 130, 143  |
| `passed`   | No findings.                                                                                               | 0         |
| `skipped`  | The check did not run. The row names the cause, such as `skipped (level)`; `--json` reports it in `cause`. | 0         |

The report shows the `failed`, `missing`, `error`, and `canceled` rows. Add `--verbose` for the `passed` and `skipped`
rows, each command, and each ignore with its reason. `gspot check --json` prints the whole report as one JSON object;
see [JSON output](/reference/json-output/#gspot-check).

When files of a language that no configuration covers appear, `gspot/detected-configurations` fails and prints a
`gspot add <name>` line. See
[When files of a language appear or go](/configure/gspot-toml/#when-files-of-a-language-appear-or-go).

When a lint rule does not fit your code, [ignore the finding](/use/ignore/).
