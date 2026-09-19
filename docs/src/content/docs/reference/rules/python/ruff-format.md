---
title: "python/ruff-format"
description: "Checks the layout of every Python file against the Ruff formatter."
---

Checks the layout of every Python file against the Ruff formatter.

## Why

One layout everywhere keeps a diff about the change.

## What to do

Run gspot check --fix.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Tool: ruff

Turn it off for a path with a reason: `gspot ignore python/ruff-format --paths <glob> --reason "<why>"`.
