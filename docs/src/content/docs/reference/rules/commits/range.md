---
title: "commits/range"
description: "Checks every commit message about to be pushed, from the merge base with the upstream branch to HEAD."
---

Checks every commit message about to be pushed, from the merge base with the upstream branch to HEAD.

## Why

A message written past the hook (--no-verify, a rebase, a merge) still reaches the shared branch unless the push checks it.

## What to do

Reword the commits that fail with git rebase -i, or change the rule with gspot set tools.commitlint.rules.

## Where it runs

- Preset: [the commits preset](/reference/presets/commits/)
- Stage: push
- Tool: commitlint

Turn it off for a path with a reason: `gspot ignore commits/range --paths <glob> --reason "<why>"`.
