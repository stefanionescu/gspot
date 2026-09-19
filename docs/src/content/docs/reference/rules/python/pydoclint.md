---
title: "python/pydoclint"
description: "Checks that every docstring names the arguments, the return, and the exceptions its function really has."
---

Checks that every docstring names the arguments, the return, and the exceptions its function really has.

## Why

A docstring that disagrees with the signature is worse than none, because people trust it.

## What to do

Bring the docstring in line with the signature.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Tool: pydoclint

Turn it off for a path with a reason: `gspot ignore python/pydoclint --paths <glob> --reason "<why>"`.
