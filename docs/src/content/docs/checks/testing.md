---
title: Tests and coverage
description: Run Jest, Vitest, and pytest with coverage limits.
---

gspot runs your test suite as a check at the push stage and fails it when coverage falls below
the coverage limits you set. Keep the test runner and its dependencies in your own project.

At level `recommended`, the coverage checks set no minimum. At level `all`, lines, branches,
functions, and statements need 80%. A limit you set applies at both levels. For a test runner without a configuration, write a [command check](/configure/command-checks/).

## Coverage with `jest`

Run `gspot add jest`, then run the coverage check:

```shell
gspot check --only jest/coverage
```

The check runs Jest in your working tree. Failed tests and missed coverage limits exit with `1`. A suite that cannot
load, or a missing report, exits with `2`.

To require full function coverage:

```shell
gspot set coverage.functions 100
```

Add `--scope app` to set it for the scope `app` only. The
[settings reference](/reference/gspot-toml/) lists every coverage setting.

The Jest configuration reports `.only` tests, skipped tests, and broken test calls, at both levels.
It reads test functions from `@jest/globals` and runs Jest for coverage.

## Vitest

Run `gspot add vitest`, with Vitest and its coverage provider installed in your project. Then
run:

```shell
gspot check --only vitest/coverage
```

Set the minimums under `coverage`: `lines`, `branches`, `functions`, and
`statements`. Vitest finds its own `vitest.config.ts` as usual.

## Python

Run `gspot add pytest`, and install pytest and pytest-cov in your project's `.venv`. Then run:

```shell
gspot check --only pytest/coverage
```

`coverage.lines` sets the line coverage limit. The check runs pytest with strict markers
and strict configuration. The Ruff rules for pytest apply to your test files, and your
app code keeps its own rules.
