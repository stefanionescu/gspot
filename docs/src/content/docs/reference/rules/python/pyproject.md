---
title: "python/pyproject"
description: "Validates every pyproject.toml against the packaging schemas."
---

Validates every pyproject.toml against the packaging schemas.

## Why

A key the build backend does not know is ignored without a word.

## What to do

Correct the key the message names.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Tool: validate-pyproject

Turn it off for a path with a reason: `gspot ignore python/pyproject --paths <glob> --reason "<why>"`.
