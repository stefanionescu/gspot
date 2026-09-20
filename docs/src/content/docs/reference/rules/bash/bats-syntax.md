---
title: "bash/bats-syntax"
description: "Parses Bats test files while counting their test cases."
---

Parses Bats test files while counting their test cases.

## Why

Bats test declarations need the Bats parser before Bash can read them.

## What to do

Fix the syntax reported by Bats. Install bats-core when the command is missing.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Tool: bats

Turn it off for a path with a reason: `gspot ignore bash/bats-syntax --paths <glob> --reason "<why>"`.
