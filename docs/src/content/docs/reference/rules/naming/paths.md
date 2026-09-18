---
title: "naming/paths"
description: "Checks every file stem and folder name against the language's case rules and the banned terms."
---

Checks every file stem and folder name against the language's case rules and the banned terms.

## Why

A file named `enhanced-utils.ts` is a home for code nobody placed; the case rule keeps imports predictable.

## What to do

Rename the file or folder, or add a path rule under [[naming.rules]] with a reason.

## Where it runs

- Preset: [the naming preset](/reference/presets/naming/)
- Stage: commit
- Engine: naming

Turn it off for a path with a reason: `gspot ignore naming/paths --paths <glob> --reason "<why>"`.
