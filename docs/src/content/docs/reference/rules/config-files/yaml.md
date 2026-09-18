---
title: "config-files/yaml"
description: "Parses every YAML file and checks its indentation, keys, and values with yamllint."
---

Parses every YAML file and checks its indentation, keys, and values with yamllint.

## Why

A YAML file that parses to the wrong shape fails silently: a duplicated key wins, a stray tab changes the nesting.

## What to do

Fix the line yamllint names, or set the rule's options with gspot set tools.yamllint.rules.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: yamllint

Turn it off for a path with a reason: `gspot ignore config-files/yaml --paths <glob> --reason "<why>"`.
