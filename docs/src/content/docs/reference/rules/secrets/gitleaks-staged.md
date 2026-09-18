---
title: "secrets/gitleaks-staged"
description: "Scans the staged change for keys, tokens, and passwords before the commit exists."
---

Scans the staged change for keys, tokens, and passwords before the commit exists.

## Why

A secret that reaches a commit stays in history after the line is deleted, and every clone holds it.

## What to do

Remove the value and load it from the environment. When the value is public by design, allow it with gspot allow gitleaks <path> --reason.

## Where it runs

- Preset: [the secrets preset](/reference/presets/secrets/)
- Stage: commit
- Tool: gitleaks

Turn it off for a path with a reason: `gspot ignore secrets/gitleaks-staged --paths <glob> --reason "<why>"`.
