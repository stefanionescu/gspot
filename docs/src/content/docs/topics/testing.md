---
title: Tests and coverage
description: Run your tests before every push and fail when coverage drops under its minimum.
configurations: [jest, vitest, pytest]
---

gspot runs your tests as a check before each push. The check fails when a test fails, or when the coverage falls below
its minimum. Install the test runner in your own project. For a test runner that gspot has no configuration for, write a
[command check](/configure/command-checks/).

| Runner | gspot turns it on when the project has                            | Check          | Coverage minimums                      | Install in your project                                    |
| ------ | ----------------------------------------------------------------- | -------------- | -------------------------------------- | ---------------------------------------------------------- |
| Jest   | a `jest` dependency or a `jest.config.*` file                     | `jest/tests`   | lines, branches, functions, statements | `jest`                                                     |
| Vitest | a `vitest` dependency, `vitest.config.*`, or `vitest.workspace.*` | `vitest/tests` | lines, branches, functions, statements | `vitest`, plus `@vitest/coverage-v8` for a minimum above 0 |
| pytest | a `pytest` dependency, `conftest.py`, or `pytest.ini`             | `pytest/tests` | lines                                  | `pytest`, plus `pytest-cov` for a minimum above 0          |
| Swift  | the `swift` configuration                                         | `swift/tests`  | lines, also per target                 | the Swift toolchain                                        |

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

At both levels, the `jest` configuration also reports tests marked `.only`, skipped tests, and broken test calls. These
rules also work when a file imports `test` and `expect` from `@jest/globals`.

## Vitest

At both levels, the `vitest` configuration also reports tests marked `.only` and skipped tests.

## pytest

Install pytest in the `.venv` of your project. An unregistered marker or an unknown pytest setting fails the check, and
the check skips a scope without test files. The coverage settings that gspot writes leave out the files of
[`test_files`](#test-files), so the tests themselves do not raise the measured coverage. When the project has its own
coverage settings, they decide which files to leave out.

## Test files

`test_files` lists the patterns of the files that the test lint rules treat as tests, such as the Ruff rules for pytest.
It does not take these files out of other checks. Setting `test_files` replaces the default patterns, so to keep the
defaults, copy them from the output of `gspot explain test_files` into your list. A scope adds its patterns to the list
of its parent.
