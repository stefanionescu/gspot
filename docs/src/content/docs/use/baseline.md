---
title: Baseline existing findings
description: Accept the findings in your code today, so that the checks fail only on new ones.
---

A baseline counts the findings in your code today. After you record one, a check fails only when a file gains a
finding. Use it when you add gspot to an existing codebase. An [ignore](/use/ignore/) records a decision for good; a
baseline holds old findings until you fix them.

## Record a baseline

Run `gspot check --fix` first, so that the fixers fix what they can. Then:

```shell
gspot baseline
```

`gspot baseline` runs the commit and push checks on every file. It writes `gspot.baseline.json` beside `gspot.toml`,
with a count for each file, check, and lint rule. Commit the file.

These findings stay out of the baseline and keep failing:

- the findings of `secrets/*` checks, because a committed secret needs rotation
- the findings of `gspot/*` checks, because they report the setup of gspot itself
- the findings that `gspot check --fix` fixes

When a check cannot run, `gspot baseline` stops and writes nothing.

`gspot check --verbose` and `gspot check --json` show how many findings the baseline subtracted.

## Shrink the baseline

After you fix an old finding, `gspot/baseline` fails, because the file counts a finding that the checks no longer find:

```text
failed   gspot/baseline  1 finding
  src/checkout.ts  stale-baseline  gspot.baseline.json counts 1 finding of javascript/eslint prefer-const that the run did not find.
```

Lower the counts, then commit the file:

```shell
gspot baseline --prune
```

`--prune` only lowers counts. A check that cannot run, such as a network check offline, keeps its counts, and the
command names it. A run of some files or some checks judges only what it read, so a full `gspot check` finds every
stale count.

`gspot baseline` without `--prune` can raise counts, and [`gspot/weakenings`](/use/ignore/#changes-that-weaken-the-checks)
reports a baseline that gains a count.

## Accept the findings of new checks

When `gspot set level` or `gspot add` turns on checks in a repository with a baseline, the command names those checks
and the command that accepts their findings alone, such as:

```shell
gspot baseline --only prose/vale,structure/jscpd
```

`--only` runs only the named checks and keeps the counts of the other checks. A plain `gspot baseline` also accepts
the new findings of every other check.
