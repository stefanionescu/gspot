---
title: "markdown/fences"
description: "Checks that every fenced code block with a language tag parses in that language."
---

Checks that every fenced code block with a language tag parses in that language.

## Why

A code block that does not parse is documentation that lies about the code.

## What to do

Fix the code in the block, or tag the block text when it is not code.

## Where it runs

- Preset: [the markdown preset](/reference/presets/markdown/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore markdown/fences --paths <glob> --reason "<why>"`.
