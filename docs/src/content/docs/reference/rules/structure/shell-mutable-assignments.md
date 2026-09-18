---
title: "structure/shell-mutable-assignments"
description: "Counts the variable assignments in each shell function against the ceiling."
---

Counts the variable assignments in each shell function against the ceiling.

## Why

A function that reassigns many variables is tracking state a reader cannot follow.

## What to do

Split the function, or raise limits.bash.mutable_assignments with a reason.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-mutable-assignments --paths <glob> --reason "<why>"`.
