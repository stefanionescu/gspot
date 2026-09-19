---
title: "pytest"
description: "pytest suites: the pytest style rules of Ruff over the tests, a test prefix the naming check knows, and a coverage floor at push."
---

pytest suites: the pytest style rules of Ruff over the tests, a test prefix the naming check knows, and a coverage floor at push.

Kind: tool. Requires: `python`.

## Tools

- pytest

## Checks

| Check                                                  | Stage | What it finds                                                                                              |
| ------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------- |
| [`pytest/coverage`](/reference/rules/pytest/coverage/) | push  | Runs the test suite with coverage, and fails when a test fails or the covered share falls under the floor. |

## Settings

- `tools.pytest.coverage`: The smallest share of lines the tests cover, out of 100.

## Rule files

- `general/code/TESTING.md`
