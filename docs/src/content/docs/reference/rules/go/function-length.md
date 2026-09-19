---
title: "go/function-length"
description: "Checks that no Go function or method has more lines than the ceiling."
---

Checks that no Go function or method has more lines than the ceiling.

## Why

A function longer than a screen hides its branches, and a reviewer approves what they did not read.

## What to do

Move a step into a function of its own, or raise limits.function_lines for go with a reason.

## Where it runs

- Preset: [the go preset](/reference/presets/go/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore go/function-length --paths <glob> --reason "<why>"`.
