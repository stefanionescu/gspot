---
title: "markdown/prettier"
description: "Checks that every Markdown file is formatted the way Prettier formats it."
---

Checks that every Markdown file is formatted the way Prettier formats it.

## Why

One formatter keeps a diff about the words, not the table padding.

## What to do

Run gspot check --fix, or prettier --write on the file.

## Where it runs

- Preset: [the markdown preset](/reference/presets/markdown/)
- Stage: commit

Turn it off for a path with a reason: `gspot ignore markdown/prettier --paths <glob> --reason "<why>"`.
