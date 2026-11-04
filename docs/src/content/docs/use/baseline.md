---
title: Baseline existing findings
description: Accept the findings in your code today, so that the checks fail only on new ones.
---

A baseline is a file that counts the findings in your code today. After you record one, the checks fail only on new
findings: a check fails when a file has more findings than the baseline counts. Use a baseline when you add gspot to an
existing codebase. An [ignore](/use/ignore/) turns off a check or a lint rule for good. A baseline accepts
old findings only until you fix them.

## Record a baseline

First run `gspot check --fix`, so that the fixers fix what they can. Then record the baseline:

```shell
gspot baseline
```

`gspot baseline` runs the commit and push checks on every file. It writes `gspot.baseline.json` in the folder of
`gspot.toml`. The file holds a count of findings for each file, check, and lint rule. Commit it.

These findings stay out of the baseline and keep failing:

- the findings of `secrets/*` checks, because you must replace a secret that someone committed
- the findings of `gspot/*` checks, because they report problems in the setup of gspot itself
- the findings that `gspot check --fix` can fix

When a check cannot run, `gspot baseline` stops and writes nothing.

`gspot check --verbose` and `gspot check --json` show how many findings the baseline removed from the report.

## Shrink the baseline

After you fix an old finding, the check `gspot/baseline` fails. It fails because `gspot.baseline.json` counts a finding
that the run did not find:

```text
failed   gspot/baseline  1 finding
  src/checkout.ts  stale-baseline  gspot.baseline.json counts 1 finding of javascript/eslint prefer-const that the run did not find.
```

Lower the counts to match, then commit `gspot.baseline.json`:

```shell
gspot baseline --prune
```

`--prune` only lowers counts. When a check cannot run, such as a check that needs the network while you are offline,
its counts stay, and the command names the check. A run on some files or some checks judges only what it read. To find
every count that is too high, run `gspot check` on every file.

`gspot baseline` without `--prune` can also raise counts. The check
[`gspot/weakenings`](/use/ignore/#changes-that-weaken-the-checks) reports a baseline count that goes up.

## Accept the findings of new checks

When `gspot set level` or `gspot add` turns on new checks in a repository that has a baseline, the command lists the
new checks. It also prints a command that adds only their findings to the baseline, such as:

```shell
gspot baseline --only prose/vale,structure/jscpd
```

`--only` runs only the named checks, and leaves the counts of the other checks as they are. `gspot baseline` without
`--only` also accepts the new findings of every other check.
