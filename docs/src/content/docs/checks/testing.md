---
title: Tests and coverage
description: Run your tests before every push and fail when coverage drops under its minimum.
---

gspot runs your test suite as a check at the push stage, and the check fails when coverage falls below the limits you
set. Keep the test runner and its dependencies in your own project.

At level `recommended`, the coverage checks set no minimum. At level `all`, lines, branches, functions, and statements
need 80%. A limit you set holds at both levels. For a test runner without a configuration, write a [command
check](/configure/command-checks/).

## Jest

gspot selects `jest` when your project depends on `jest` or has a `jest.config.*` file; otherwise, run `gspot add jest`.
Then run the coverage check:

```shell
gspot check --only jest/coverage
```

The check runs Jest in your working tree. Failed tests and missed coverage limits exit with `1`. A suite that cannot
load, or a missing report, exits with `2`.

To require full function coverage:

```shell
gspot set coverage.functions 100
```

Add `--scope app` to set it for the scope `app` only. The [settings reference](/reference/gspot-toml/) lists every
coverage setting.

The Jest configuration reports `.only` tests, skipped tests, and broken test calls, at both levels. It reads test
functions from `@jest/globals`.

## Vitest

gspot selects `vitest` when your project depends on `vitest`; otherwise, run `gspot add vitest`. Install Vitest and its
coverage provider in your project. Then run:

```shell
gspot check --only vitest/coverage
```

Set the minimums under `coverage`: `lines`, `branches`, `functions`, and `statements`. Vitest reads its own
`vitest.config.ts`.

## Python with pytest

gspot selects `pytest` when your project depends on `pytest` or has `conftest.py` or `pytest.ini`; otherwise, run `gspot
add pytest`. Install pytest and pytest-cov in the `.venv` of your project. Then run:

```shell
gspot check --only pytest/coverage
```

`coverage.lines` sets the line coverage limit. The check runs pytest with `--strict-markers` and `--strict-config`.

## Swift

The [Swift](/languages/swift/#tests) page covers Swift tests and their coverage minimums.

## Test files

`test_files` names the files that test lint rules treat as tests, such as the Ruff rules for pytest. It does not take
files out of other checks. Its default covers the usual test folders and file names; the [settings
reference](/reference/gspot-toml/#test_files) lists them.

Your first written list replaces the default patterns. A scope adds its patterns to its written parent list:

```shell
gspot set test_files "e2e/**"
```
