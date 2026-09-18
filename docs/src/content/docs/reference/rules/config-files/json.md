---
title: "config-files/json"
description: "Parses and formats every JSON file through Prettier."
---

Parses and formats every JSON file through Prettier.

## Why

A JSON file that does not parse breaks the tool that reads it at the worst moment; one formatter keeps the diff about the values.

## What to do

Run gspot check --fix, or fix the syntax error Prettier names.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit

Turn it off for a path with a reason: `gspot ignore config-files/json --paths <glob> --reason "<why>"`.
