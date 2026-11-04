---
title: Tests and coverage
description: Run your tests before every push and fail when coverage drops under its minimum.
configurations: [jest, vitest, pytest]
---

gspot runs your test suite as a check at the push stage, and the check fails when coverage falls below its minimum.
Keep the test runner and its coverage package in your own project. For a test runner without a configuration, write a
[command check](/configure/command-checks/).

| Runner | gspot selects it when the project has                             | Check          | Coverage minimums                      |
| ------ | ----------------------------------------------------------------- | -------------- | -------------------------------------- |
| Jest   | a `jest` dependency or a `jest.config.*` file                     | `jest/tests`   | lines, branches, functions, statements |
| Vitest | a `vitest` dependency, `vitest.config.*`, or `vitest.workspace.*` | `vitest/tests` | lines, branches, functions, statements |
| pytest | a `pytest` dependency, `conftest.py`, or `pytest.ini`             | `pytest/tests` | lines                                  |
| Swift  | the `swift` configuration                                         | `swift/tests`  | lines, also per target                 |

Otherwise, run `gspot add <runner>`, such as `gspot add vitest`. Run one suite with `gspot check --only <check>`.

## Coverage minimums

At level `basic`, the minimums are 0. At level `all`, each one is 80. Set your own:

```shell
gspot set coverage.min_line_percent 90
```

The settings are `coverage.min_line_percent`, `coverage.min_branch_percent`, `coverage.min_function_percent`, and
`coverage.min_statement_percent`. A minimum that you set holds at both levels, and lowering one needs a reason. Add
`--scope <path>` to set it for one scope. [Swift](/languages/swift/#coverage) sets a minimum for one target.

## Jest

The check runs Jest in your working tree. Failed tests, missed coverage minimums, and a suite that cannot load report
findings, and `gspot check` exits with `1`. A missing report or a command that cannot run makes it exit with `2`.

The Jest configuration also reports `.only` tests, skipped tests, and broken test calls, at both levels. It reads the
test functions from `@jest/globals`.

## Vitest

Install Vitest and its coverage provider in your project. Vitest reads its own `vitest.config.ts`.

## pytest

Install pytest and pytest-cov in the `.venv` of your project. The check runs pytest with `--strict-markers` and
`--strict-config`, and skips a scope that holds no test file. The generated coverage settings leave out the files of
`test_files`, so tests do not raise the measured coverage. When the project has its own coverage settings, those decide
which files to leave out.

## Test files

`test_files` names the files that the test lint rules treat as tests, such as the Ruff rules for pytest. It does not
take files out of other checks. Your first list replaces the default patterns, so `gspot explain test_files` prints
them for you to copy. A scope adds its patterns to the list of its parent.
