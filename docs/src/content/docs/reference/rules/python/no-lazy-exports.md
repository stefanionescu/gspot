---
title: "python/no-lazy-exports"
description: "Refuses a module-level attribute hook that makes names appear at run time."
---

Refuses a module-level attribute hook that makes names appear at run time.

## Why

A name that appears only at run time hides from the type checker, the editor, and the reader.

## What to do

Import the names and list them.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/no-lazy-exports --paths <glob> --reason "<why>"`.
