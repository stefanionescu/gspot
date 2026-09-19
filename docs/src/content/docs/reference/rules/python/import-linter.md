---
title: "python/import-linter"
description: "Runs the import contracts of the project, when pyproject.toml holds any."
---

Runs the import contracts of the project, when pyproject.toml holds any.

## Why

A layer that imports the layer above it turns an architecture into a diagram nobody follows.

## What to do

Move the import to the side the contract allows, or change the contract with a reason in its name.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Tool: lint-imports
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/import-linter --paths <glob> --reason "<why>"`.
