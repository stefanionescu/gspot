---
title: "structure/unused-functions"
description: "Finds shell functions no script in the scope calls."
---

Finds shell functions no script in the scope calls.

## Why

Dead code is read and maintained for nobody.

## What to do

Delete the function, or mark a hook entry point with lint:allow-unused-function <name> and say why.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/unused-functions --paths <glob> --reason "<why>"`.
