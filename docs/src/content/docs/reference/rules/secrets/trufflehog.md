---
title: "secrets/trufflehog"
description: "Verifies candidate secrets in the pushed commits against the service that issued them."
---

Verifies candidate secrets in the pushed commits against the service that issued them.

## Why

A verified secret is live right now, which makes it the finding to act on first.

## What to do

Rotate the secret at its provider, then rewrite the commit that holds it.

## Where it runs

- Preset: [the secrets preset](/reference/presets/secrets/)
- Stage: push
- Tool: trufflehog

Turn it off for a path with a reason: `gspot ignore secrets/trufflehog --paths <glob> --reason "<why>"`.
