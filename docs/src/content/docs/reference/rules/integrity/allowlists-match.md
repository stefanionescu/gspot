---
title: "integrity/allowlists-match"
description: "Checks that every path pattern in gspot.toml matches at least one tracked file."
---

Checks that every path pattern in gspot.toml matches at least one tracked file.

## Why

An ignore, declaration or allowance that matches nothing is a leftover that misleads the next reader.

## What to do

Remove the entry, or fix its pattern.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/allowlists-match --paths <glob> --reason "<why>"`.
