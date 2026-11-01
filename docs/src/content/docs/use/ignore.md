---
title: Ignore Findings
description: Record an ignore with a reason, then inspect or remove it.
tableOfContents: false
---

```shell
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

Every ignore needs a reason. Leave out `--rule` to ignore the whole check, and add `--paths` to select files.
gspot resolves paths and globs passed to `--paths` from your current folder. It saves them relative to the repository
root in `gspot.toml`; `gspot unignore --paths` uses the same conversion. Repeat the flag for more paths:
`--paths "scripts/**" --paths "fixtures/**"`. A comma stays part of the path: `--paths "data,old.csv"` names one file.

Each path or glob must match a repository file. gspot refuses a value that names a check; give the check as the command's
positional argument. After deleting an ignored file, remove its whole ignore without `--paths`.

To leave paths out of every check, see [Exclude files](/configure/files/).

To ignore a dependency advisory, give its ID as the rule:

```text
gspot ignore dependencies/osv-scanner --rule <advisory-id> --reason "<why>"
```

For ESLint, Stylelint, Ruff, Markdownlint, and SwiftLint, `gspot ignore --rule` checks the installed rule catalog before
saving the ignore.
A check that does not report rule IDs refuses `--rule`.

To remove the ignore:

```shell
gspot unignore javascript/eslint --rule no-console --paths "scripts/**"
```

`gspot check --verbose` prints each ignore in effect and its reason.

To change a limit, see [limits](/reference/gspot-toml/#limits). Use an ignore only when you can state why the check does not fit that code.

## Keep the findings that predate gspot

An ignore records a permanent decision with a reason. A baseline holds old findings until you fix them:

```shell
gspot baseline
```

The command runs the commit and push checks on every file, and writes `gspot.baseline.json` beside `gspot.toml`. The
file holds a count per file, check, and lint rule. Commit it. `gspot check` then subtracts those counts, so a file fails
only when it gains a finding. `gspot check --verbose` and `gspot check --json` show how many findings it subtracted.

Findings of `secrets/*` checks stay out of the baseline, because a committed secret needs rotation. Findings of
`gspot/*` checks stay out too, because they describe the setup of gspot itself. `gspot baseline` stops and writes
nothing when a check cannot run.

After you fix an old finding, the check `gspot/baseline` fails, because the file counts a finding that the checks did
not find. Run this command and commit the file:

```shell
gspot baseline --prune
```

`--prune` lowers each count to what the checks still find, and adds nothing, so the file only shrinks. Only
`gspot baseline` without `--prune` adds counts. A run of some files or some checks judges only what it read, so a
full `gspot check` reports every stale count.
