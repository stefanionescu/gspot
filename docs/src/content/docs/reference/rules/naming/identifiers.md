---
title: "naming/identifiers"
description: "Checks every identifier against the naming policy: banned terms, case, length, and word count."
---

Checks every identifier against the naming policy: banned terms, case, length, and word count.

## Why

Slop announces itself in the name: `enhancedHandler`, `ensureConfigIfNeeded` and `utils` are the sign of code that adds nothing.

## What to do

Rename after what the thing is or does. Allow one exact name with gspot allow naming <name> --reason, or adjust a ceiling with gspot set naming.<language>.max_words.

## Where it runs

- Preset: [the naming preset](/reference/presets/naming/)
- Stage: commit
- Engine: naming

Turn it off for a path with a reason: `gspot ignore naming/identifiers --paths <glob> --reason "<why>"`.
