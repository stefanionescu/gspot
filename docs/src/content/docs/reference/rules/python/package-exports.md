---
title: "python/package-exports"
description: "Checks that a package exports no more names than the ceiling."
---

Checks that a package exports no more names than the ceiling.

## Why

A package that exports everything has no surface, so every change to it is a breaking one.

## What to do

Split the package, or export fewer names.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/package-exports --paths <glob> --reason "<why>"`.
