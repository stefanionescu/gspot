---
title: "structure/bash-boundaries"
description: "Checks that scripts under the architecture roots declare their boundary and source what they call."
---

Checks that scripts under the architecture roots declare their boundary and source what they call.

## Why

A script that works only because another file was sourced first breaks when the order changes.

## What to do

Add a Boundary line to the header comment, annotate every source with # shellcheck source=, and source the file a function comes from.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/bash-boundaries --paths <glob> --reason "<why>"`.
