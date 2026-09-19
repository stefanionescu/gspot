---
title: "vitest/coverage"
description: "Runs the test suite with coverage, and fails when lines, branches, functions, or statements fall under their floors."
---

Runs the test suite with coverage, and fails when lines, branches, functions, or statements fall under their floors.

## Why

A floor keeps new code from arriving untested, which is when its behavior is cheapest to pin down.

## What to do

Add tests for the code the coverage report shows uncovered, or lower one floor under tools.vitest with a reason.

## Where it runs

- Preset: [the vitest preset](/reference/presets/vitest/)
- Stage: push
- Tool: vitest

Turn it off for a path with a reason: `gspot ignore vitest/coverage --paths <glob> --reason "<why>"`.
