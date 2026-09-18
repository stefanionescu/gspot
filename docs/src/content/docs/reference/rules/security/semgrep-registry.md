---
title: "security/semgrep-registry"
description: "Runs the public Semgrep registry packs named in tools.semgrep.registry, which the registry serves over the network."
---

Runs the public Semgrep registry packs named in tools.semgrep.registry, which the registry serves over the network.

## Why

The registry packs cover the common vulnerability classes, and their license keeps them out of this package.

## What to do

Change the code the way the message says, or turn the rule off for a path with gspot ignore security/semgrep-registry --rule <id> --reason.

## Where it runs

- Preset: [the security preset](/reference/presets/security/)
- Stage: manual
- Tool: semgrep

Turn it off for a path with a reason: `gspot ignore security/semgrep-registry --paths <glob> --reason "<why>"`.
