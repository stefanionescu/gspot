---
title: "xctest/disabled"
description: "Checks that every skipped or disabled test gives a reason beside it."
---

Checks that every skipped or disabled test gives a reason beside it.

## Why

A test turned off with no reason stays off, because nobody knows when it is safe to turn on.

## What to do

Say why the test is off and what turns it back on, or delete the test.

## Where it runs

- Preset: [the xctest preset](/reference/presets/xctest/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xctest/disabled --paths <glob> --reason "<why>"`.
