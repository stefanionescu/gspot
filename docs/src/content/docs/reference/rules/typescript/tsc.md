---
title: "typescript/tsc"
description: "Checks that every TypeScript file type-checks with the strict compiler options."
---

Checks that every TypeScript file type-checks with the strict compiler options.

## Why

A file that does not type-check can crash at run time in a way the editor already knew about.

## What to do

Read the first error tsc prints and fix that file; later errors are often the same mistake.

## Where it runs

- Preset: [the typescript preset](/reference/presets/typescript/)
- Stage: commit
- Tool: tsc

Turn it off for a path with a reason: `gspot ignore typescript/tsc --paths <glob> --reason "<why>"`.
