---
title: "css/stylelint"
description: "Lints every stylesheet with the standard stylelint rules: unknown properties, overridden selectors, and invalid values."
---

Lints every stylesheet with the standard stylelint rules: unknown properties, overridden selectors, and invalid values.

## Why

A browser skips a declaration it cannot read without a word, so a typo in a property ships as a missing style.

## What to do

Run gspot check --fix for the rules that fix themselves. Turn one rule off with gspot ignore css/stylelint --rule <name> --reason.

## Where it runs

- Preset: [the css preset](/reference/presets/css/)
- Stage: commit
- Tool: stylelint

Turn it off for a path with a reason: `gspot ignore css/stylelint --paths <glob> --reason "<why>"`.
