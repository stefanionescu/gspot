---
title: "spelling/typos"
description: "Finds misspelled words in code, comments, and documentation."
---

Finds misspelled words in code, comments, and documentation.

## Why

A typo in an identifier spreads to every caller; in prose it costs the reader a second look.

## What to do

Fix the spelling, or allow the word with gspot allow typos <word> when it is a real name.

## Where it runs

- Preset: [the spelling preset](/reference/presets/spelling/)
- Stage: commit
- Tool: typos

Turn it off for a path with a reason: `gspot ignore spelling/typos --paths <glob> --reason "<why>"`.
