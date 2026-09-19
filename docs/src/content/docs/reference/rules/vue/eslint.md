---
title: "vue/eslint"
description: "Runs ESLint with the Vue plugin over every .vue file. It reads the markup and the script together."
---

Runs ESLint with the Vue plugin over every .vue file. It reads the markup and the script together.

## Why

A component file is markup and code in one, and a plain JavaScript parser reads neither half of it.

## What to do

Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.

## Where it runs

- Preset: [the vue preset](/reference/presets/vue/)
- Stage: commit
- Tool: eslint

Turn it off for a path with a reason: `gspot ignore vue/eslint --paths <glob> --reason "<why>"`.
