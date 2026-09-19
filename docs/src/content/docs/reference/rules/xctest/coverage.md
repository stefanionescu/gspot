---
title: "xctest/coverage"
description: "Runs the tests with coverage and holds each target named in tools.xctest.coverage to its floor."
---

Runs the tests with coverage and holds each target named in tools.xctest.coverage to its floor.

## Why

A floor keeps new code from arriving untested.

## What to do

Add tests for the target, or lower its floor with a reason.

## Where it runs

- Preset: [the xctest preset](/reference/presets/xctest/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xctest/coverage --paths <glob> --reason "<why>"`.
