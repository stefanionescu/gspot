---
title: "structure/shell-branches"
description: "Counts the branches in each shell function against the ceiling."
---

Counts the branches in each shell function against the ceiling.

## Why

A function with many branches is several functions with one name.

## What to do

Split the function by branch, or raise limits.bash.function_branches with a reason.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-branches --paths <glob> --reason "<why>"`.
