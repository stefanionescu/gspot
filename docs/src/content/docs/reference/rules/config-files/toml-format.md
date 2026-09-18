---
title: "config-files/toml-format"
description: "Checks that every TOML file is formatted the way taplo formats it with the shared settings."
---

Checks that every TOML file is formatted the way taplo formats it with the shared settings.

## Why

One formatter keeps a diff about the values, not the spacing.

## What to do

Run gspot check --fix.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: taplo

Turn it off for a path with a reason: `gspot ignore config-files/toml-format --paths <glob> --reason "<why>"`.
