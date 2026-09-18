---
title: "naming/policy-schema"
description: "Checks that the naming settings in gspot.toml are valid and that every allowed name and path rule matches something."
---

Checks that the naming settings in gspot.toml are valid and that every allowed name and path rule matches something.

## Why

An allowed name that matches nothing is a leftover, and a path rule that matches nothing hides a typo.

## What to do

Remove the entry that matches nothing, or fix its name or path.

## Where it runs

- Preset: [the naming preset](/reference/presets/naming/)
- Stage: commit
- Engine: naming

Turn it off for a path with a reason: `gspot ignore naming/policy-schema --paths <glob> --reason "<why>"`.
