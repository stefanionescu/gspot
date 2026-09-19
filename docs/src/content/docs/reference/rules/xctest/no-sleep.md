---
title: "xctest/no-sleep"
description: "Refuses sleep calls in test files outside tools.xctest.sleep_allowed."
---

Refuses sleep calls in test files outside tools.xctest.sleep_allowed.

## Why

A sleep makes a test slow when it passes and flaky when the machine is slower than the number.

## What to do

Wait on an expectation or a confirmation, or poll a condition with a timeout.

## Where it runs

- Preset: [the xctest preset](/reference/presets/xctest/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xctest/no-sleep --paths <glob> --reason "<why>"`.
