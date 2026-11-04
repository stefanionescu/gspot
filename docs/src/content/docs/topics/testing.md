---
title: Tests and coverage
description: Run your tests before every push and fail when coverage drops under its minimum.
configurations: [jest, vitest, pytest]
---

gspot runs your tests as a check before each push. The check fails when a test fails, or when the coverage falls below
its minimum. Install the test runner and its coverage package in your own project. For a test runner that gspot has no
configuration for, write a [command check](/configure/command-checks/).

| Runner | gspot turns it on when the project has                            | Check          | Coverage minimums                      |
| ------ | ----------------------------------------------------------------- | -------------- | -------------------------------------- |
| Jest   | a `jest` dependency or a `jest.config.*` file                     | `jest/tests`   | lines, branches, functions, statements |
| Vitest | a `vitest` dependency, `vitest.config.*`, or `vitest.workspace.*` | `vitest/tests` | lines, branches, functions, statements |
| pytest | a `pytest` dependency, `conftest.py`, or `pytest.ini`             | `pytest/tests` | lines                                  |
| Swift  | the `swift` configuration                                         | `swift/tests`  | lines, also per target                 |

When gspot does not detect your runner, run `gspot add <runner>`, such as `gspot add vitest`. To run one test suite, run
`gspot check --only <check>`.

## Coverage minimums

At level `basic`, the minimums are 0. At level `all`, each one is 80. To set your own:

```shell
gspot set coverage.min_line_percent 90
```

The settings are `coverage.min_line_percent`, `coverage.min_branch_percent`, `coverage.min_function_percent`, and
`coverage.min_statement_percent`. A minimum that you set applies at both levels, and lowering one needs a reason. To set
a minimum for one scope, add `--scope <path>`. [Swift](/languages/swift/#coverage) shows how to set a minimum for one
Swift target.

## Jest

The check runs Jest in your working tree. A failed test, a missed coverage minimum, or a test suite that cannot load
gives a finding, and `gspot check` exits with `1`. When the coverage report is missing, or the command cannot run,
`gspot check` exits with `2`.

At both levels, the `jest` configuration also reports tests marked `.only`, skipped tests, and broken test calls. It
also finds these test functions when a file imports them from `@jest/globals`.

## Vitest

Install Vitest and its coverage provider in your project. Vitest reads its own `vitest.config.ts`.

## pytest

Install pytest and pytest-cov in the `.venv` of your project. The check runs pytest with `--strict-markers` and
`--strict-config`, and skips a scope that has no test file. The coverage settings that gspot writes leave out the files
of `test_files`, so the tests themselves do not raise the measured coverage. When the project has its own coverage
settings, they decide which files to leave out.

## Test files

`test_files` lists the patterns of the files that the test lint rules treat as tests, such as the Ruff rules for
pytest. It does not take these files out of other checks. The first list that you set replaces the default patterns.
To keep the defaults, copy them from the output of `gspot explain test_files` into your list. A scope adds its patterns
to the list of its parent.
