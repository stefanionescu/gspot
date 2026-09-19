---
title: "python/import-cycles"
description: "Finds first-party modules that import each other in a circle."
---

Finds first-party modules that import each other in a circle.

## Why

A circle imports in one order and fails in another, and the order changes with an unrelated edit.

## What to do

Move what both sides need into a third module.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/import-cycles --paths <glob> --reason "<why>"`.
