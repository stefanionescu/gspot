---
title: Tests and coverage
configurations: [jest, vitest, pytest]
---

gspot runs your tests as a check before each push, and the check fails when a test fails, or when the coverage falls below
its minimum. For a test runner that gspot has no configuration for, write a [command check](/configure/command-checks/).

| Runner | Check          | Coverage minimums                      | Install in your project                                    |
| ------ | -------------- | -------------------------------------- | ---------------------------------------------------------- |
| Jest   | `jest/tests`   | lines, branches, functions, statements | `jest`                                                     |
| Vitest | `vitest/tests` | lines, branches, functions, statements | `vitest`, plus `@vitest/coverage-v8` for a minimum above 0 |
| pytest | `pytest/tests` | lines                                  | `pytest`, plus `pytest-cov` for a minimum above 0          |
| Swift  | `swift/tests`  | lines, also per target                 | the Swift toolchain                                        |

When gspot does not detect your runner, run `gspot add <runner>`, such as `gspot add vitest`.

## Coverage minimums

At level `basic`, the minimums are 0. At level `all`, each one is 80. To set your own:

```shell
gspot set coverage.min_line_percent 90
```

The settings are `coverage.min_line_percent`, `coverage.min_branch_percent`, `coverage.min_function_percent`, and
`coverage.min_statement_percent`. A minimum that you set applies at both levels, and lowering one needs a reason. To set
a minimum for one scope, add `--scope <path>`. [Swift](/languages/swift/#coverage) shows how to set a minimum for one
Swift target.

## Lint rules for tests

The `jest` and `vitest` configurations also report tests marked `.only` and skipped tests at both levels, and `jest`
reports broken test calls, also when a file imports `test` and `expect` from `@jest/globals`.

## pytest

Install pytest in the `.venv` of your project. An unregistered marker or an unknown pytest setting fails the check, and
the check skips a scope without test files. The coverage settings that gspot writes leave out the files of
[`test_files`](#test-files), and your own coverage settings take their place when the project has them.

## Test files

`test_files` lists the patterns of the files that the test lint rules treat as tests, such as the Ruff rules for pytest.
It does not take these files out of other checks. Setting `test_files` replaces the default patterns, so to keep the
defaults, copy them from the output of `gspot explain test_files` into your list. A scope adds its patterns to the list
of its parent.
