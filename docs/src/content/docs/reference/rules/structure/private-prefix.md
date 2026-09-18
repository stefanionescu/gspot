---
title: "structure/private-prefix"
description: "Checks that a shell function no other file calls starts with an underscore, and that an underscore function is not called from outside."
---

Checks that a shell function no other file calls starts with an underscore, and that an underscore function is not called from outside.

## Why

The underscore tells a reader what the file publishes without reading every caller.

## What to do

Rename the function with a leading underscore, or drop the underscore when another file calls it.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/private-prefix --paths <glob> --reason "<why>"`.
