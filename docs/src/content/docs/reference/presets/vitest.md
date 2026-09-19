---
title: "Vitest"
description: "Vitest test files: the test rules of ESLint over them, and coverage thresholds at push."
---

Vitest test files: the test rules of ESLint over them, and coverage thresholds at push.

Kind: tool. Requires: `javascript`.

## Tools

- vitest 4.1.11
- @vitest/eslint-plugin 1.3.4
- @vitest/coverage-v8 4.1.11

## Checks

| Check                                                  | Stage | What it finds                                                                                                        |
| ------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------- |
| [`vitest/coverage`](/reference/rules/vitest/coverage/) | push  | Runs the test suite with coverage, and fails when lines, branches, functions, or statements fall under their floors. |

## Settings

- `tools.vitest.coverage_lines`: The smallest share of lines the tests cover, out of 100.
- `tools.vitest.coverage_branches`: The smallest share of branches the tests cover, out of 100.
- `tools.vitest.coverage_functions`: The smallest share of functions the tests cover, out of 100.
- `tools.vitest.coverage_statements`: The smallest share of statements the tests cover, out of 100.
- `tools.vitest.harness_dir`: The folder that holds test support code, which test files import and source files never do.

## Rule files

- `tool/vitest/VITEST.md`
- `general/code/TESTING.md`
