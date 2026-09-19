---
title: "python/ruff"
description: "Lints every Python file with the shipped Ruff families, the security family included."
---

Lints every Python file with the shipped Ruff families, the security family included.

## Why

Ruff holds the rules of a dozen older tools in one pass fast enough to run at every commit.

## What to do

Run gspot check --fix for the rules that fix themselves. Turn one rule off with gspot ignore python/ruff --rule <code> --reason, and add --paths to limit it.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Tool: ruff

Turn it off for a path with a reason: `gspot ignore python/ruff --paths <glob> --reason "<why>"`.
