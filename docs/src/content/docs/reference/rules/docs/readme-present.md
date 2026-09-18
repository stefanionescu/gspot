---
title: "docs/readme-present"
description: "Checks that every scope has a README.md and the root has a LICENSE."
---

Checks that every scope has a README.md and the root has a LICENSE.

## Why

A scope with no README is a door with no sign.

## What to do

Write the README; the docs rule files say what goes in it.

## Where it runs

- Preset: [the docs preset](/reference/presets/docs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore docs/readme-present --paths <glob> --reason "<why>"`.
