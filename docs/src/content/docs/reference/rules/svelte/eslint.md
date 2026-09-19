---
title: "svelte/eslint"
description: "Runs ESLint with the Svelte plugin over every .svelte file. It reads the markup and the script together."
---

Runs ESLint with the Svelte plugin over every .svelte file. It reads the markup and the script together.

## Why

A component file is markup and code in one, and a plain JavaScript parser reads neither half of it.

## What to do

Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means.

## Where it runs

- Preset: [the svelte preset](/reference/presets/svelte/)
- Stage: commit
- Tool: eslint

Turn it off for a path with a reason: `gspot ignore svelte/eslint --paths <glob> --reason "<why>"`.
