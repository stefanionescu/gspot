---
title: "structure/shell-config-defaults"
description: "Finds variable defaults of the form name:-value outside the configuration owners."
---

Finds variable defaults of the form name:-value outside the configuration owners.

## Why

A default set in three places is three settings with one name.

## What to do

Set the default in a configuration owner named under tools.bash.config_owners and read the variable everywhere else.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-config-defaults --paths <glob> --reason "<why>"`.
