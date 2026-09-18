---
title: "structure/function-length"
description: "Checks that no shell function has more code lines than the ceiling."
---

Checks that no shell function has more code lines than the ceiling.

## Why

A long function does more than its name says.

## What to do

Split the function, or raise limits.bash.function_lines with a reason.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/function-length --paths <glob> --reason "<why>"`.
