---
title: "python/basedpyright"
description: "Type checks the project with basedpyright in its strictest mode."
---

Type checks the project with basedpyright in its strictest mode.

## Why

A type error found here is a crash that never reaches a user.

## What to do

Fix the type, or narrow it where the value arrives. Exclude a file that needs another dependency set under tools.basedpyright.exclude with a reason.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Tool: basedpyright

Turn it off for a path with a reason: `gspot ignore python/basedpyright --paths <glob> --reason "<why>"`.
