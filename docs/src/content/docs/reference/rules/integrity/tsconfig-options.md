---
title: "integrity/tsconfig-options"
description: "Checks that every tsconfig still turns on the strict options the preset requires."
---

Checks that every tsconfig still turns on the strict options the preset requires.

## Why

One tsconfig that drops strict lets untyped code back in for that whole scope.

## What to do

Keep extends pointing at `.gspot/tsconfig.base.json` and do not override the strict options; run gspot apply to restore the stub.

## Where it runs

- Preset: [the typescript preset](/reference/presets/typescript/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/tsconfig-options --paths <glob> --reason "<why>"`.
