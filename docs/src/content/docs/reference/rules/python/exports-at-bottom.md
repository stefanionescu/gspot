---
title: "python/exports-at-bottom"
description: "Checks that the export list is the last statement of its module."
---

Checks that the export list is the last statement of its module.

## Why

A reader looks for the public surface in one place.

## What to do

Move the export list to the end of the module.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/exports-at-bottom --paths <glob> --reason "<why>"`.
