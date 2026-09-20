---
title: "structure/bash-nesting"
description: "Measures how deep control flow nests in each shell function against the ceiling."
---

Measures how deep control flow nests in each shell function against the ceiling.

## Why

Deep nesting is the shape of code nobody can hold in their head.

## What to do

Return early or split the inner block into a function, or raise limits.bash.function_nesting with a reason.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/bash-nesting --paths <glob> --reason "<why>"`.
