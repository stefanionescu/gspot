---
title: "xcode/test-plan"
description: "Checks that every shared scheme that runs tests names a test plan, and that every test target is in a plan."
---

Checks that every shared scheme that runs tests names a test plan, and that every test target is in a plan.

## Why

A test target outside every plan never runs in CI, and its tests rot while they look present.

## What to do

Add the target to a test plan, and point the scheme at the plan.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xcode/test-plan --paths <glob> --reason "<why>"`.
