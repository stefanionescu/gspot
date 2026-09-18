---
title: "typescript/eslint"
description: "Runs ESLint with the shipped rule set over every TypeScript file."
---

Runs ESLint with the shipped rule set over every TypeScript file.

## Why

ESLint catches mistakes and slop the compiler accepts: unused code, unsafe casts, functions that only forward.

## What to do

Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.

## Where it runs

- Preset: [the typescript preset](/reference/presets/typescript/)
- Stage: commit
- Tool: eslint

Turn it off for a path with a reason: `gspot ignore typescript/eslint --paths <glob> --reason "<why>"`.
