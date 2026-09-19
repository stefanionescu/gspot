---
title: "pytest/coverage"
description: "Runs the test suite with coverage, and fails when a test fails or the covered share falls under the floor."
---

Runs the test suite with coverage, and fails when a test fails or the covered share falls under the floor.

## Why

A floor keeps new code from arriving untested.

## What to do

Fix the failing test, or add tests for the code the report shows uncovered. Lower tools.pytest.coverage with a reason.

## Where it runs

- Preset: [the pytest preset](/reference/presets/pytest/)
- Stage: push
- Tool: pytest

Turn it off for a path with a reason: `gspot ignore pytest/coverage --paths <glob> --reason "<why>"`.
