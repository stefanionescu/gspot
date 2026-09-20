---
title: "bash/zsh-syntax"
description: "Checks Zsh syntax with the Zsh interpreter."
---

Checks Zsh syntax with the Zsh interpreter.

## Why

Zsh syntax differs from Bash, so a Bash parser rejects valid Zsh programs.

## What to do

Fix the syntax at the line Zsh reports. Install zsh when the command is missing.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Tool: zsh

Turn it off for a path with a reason: `gspot ignore bash/zsh-syntax --paths <glob> --reason "<why>"`.
