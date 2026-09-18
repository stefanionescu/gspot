---
title: "config-files/actions"
description: "Checks every GitHub Actions workflow with actionlint: syntax, expressions, action inputs, and shell steps."
---

Checks every GitHub Actions workflow with actionlint: syntax, expressions, action inputs, and shell steps.

## Why

A workflow error surfaces on the first push after the change, in CI, where it costs a round trip.

## What to do

Fix the line actionlint names.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: actionlint

Turn it off for a path with a reason: `gspot ignore config-files/actions --paths <glob> --reason "<why>"`.
