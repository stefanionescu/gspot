---
title: "structure/duplicate-functions"
description: "Finds shell functions with the same body in the same scope."
---

Finds shell functions with the same body in the same scope.

## Why

Two copies drift apart; the fix lands in one and the bug stays in the other.

## What to do

Keep one function and call it from both places.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/duplicate-functions --paths <glob> --reason "<why>"`.
