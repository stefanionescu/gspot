---
title: "integrity/typecheck-membership"
description: "Checks that every path the type check leaves out still matches a tracked file."
---

Checks that every path the type check leaves out still matches a tracked file.

## Why

An exclusion that outlives its file hides the next file that takes the name.

## What to do

Remove the entry from tools.basedpyright.exclude.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/typecheck-membership --paths <glob> --reason "<why>"`.
