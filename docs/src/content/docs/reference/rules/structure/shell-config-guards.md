---
title: "structure/shell-config-guards"
description: "Checks that every configuration owner opens with one include guard nobody else uses."
---

Checks that every configuration owner opens with one include guard nobody else uses.

## Why

A configuration file sourced twice runs its side effects twice.

## What to do

Open the owner with [[-n ${_CFG_NAME_READY:-}]] && return 0 and then readonly \_CFG_NAME_READY=1.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-config-guards --paths <glob> --reason "<why>"`.
