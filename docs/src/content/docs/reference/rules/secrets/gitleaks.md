---
title: "secrets/gitleaks"
description: "Scans every commit about to be pushed for keys, tokens, and passwords."
---

Scans every commit about to be pushed for keys, tokens, and passwords.

## Why

A commit made past the hook still reaches the shared branch unless the push checks it.

## What to do

Rewrite the commit that holds the value and rotate the secret; a pushed secret is a leaked secret.

## Where it runs

- Preset: [the secrets preset](/reference/presets/secrets/)
- Stage: push
- Tool: gitleaks

Turn it off for a path with a reason: `gspot ignore secrets/gitleaks --paths <glob> --reason "<why>"`.
