---
title: "python/call-through"
description: "Finds functions that pass their parameters straight to one other call."
---

Finds functions that pass their parameters straight to one other call.

## Why

A function that only forwards adds a name to learn and nothing to read.

## What to do

Call the other function directly, and delete this one.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/call-through --paths <glob> --reason "<why>"`.
