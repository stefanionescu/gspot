---
title: "config-files/toml"
description: "Parses every TOML file with taplo; the schema check runs at push through v8r."
---

Parses every TOML file with taplo; the schema check runs at push through v8r.

## Why

A TOML file that does not parse stops the tool that reads it at the worst moment.

## What to do

Fix the line taplo names.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: taplo

Turn it off for a path with a reason: `gspot ignore config-files/toml --paths <glob> --reason "<why>"`.
