---
title: "structure/unused-functions"
description: "Finds shell functions no script in the scope calls."
---

Finds shell functions no script in the scope calls.

## Why

Dead code is read and maintained for nobody.

## What to do

Delete the function, or put `gspot-ignore structure/unused-functions -- reason` on the preceding comment line for a required hook entry point.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/unused-functions --paths <glob> --reason "<why>"`.
