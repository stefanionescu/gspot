---
title: "formatting/prettier"
description: "Checks that every file Prettier formats is already formatted that way."
---

Checks that every file Prettier formats is already formatted that way.

## Why

Formatting by hand differs by editor; one formatter keeps diffs about the change and not the spacing.

## What to do

Run gspot check --fix to format every file, or prettier --write on one file.

## Where it runs

- Preset: [the formatting preset](/reference/presets/formatting/)
- Stage: commit
- Tool: prettier

Turn it off for a path with a reason: `gspot ignore formatting/prettier --paths <glob> --reason "<why>"`.
