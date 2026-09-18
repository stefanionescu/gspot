---
title: "javascript/eslint"
description: "Runs ESLint with the shipped rule set over every JavaScript file."
---

Runs ESLint with the shipped rule set over every JavaScript file.

## Why

ESLint catches mistakes and slop the runtime accepts: unused code, unsafe patterns, functions that only forward.

## What to do

Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.

## Where it runs

- Preset: [the javascript preset](/reference/presets/javascript/)
- Stage: commit
- Tool: eslint

Turn it off for a path with a reason: `gspot ignore javascript/eslint --paths <glob> --reason "<why>"`.
