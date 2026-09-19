---
title: "integrity/next-config"
description: "Checks that the framework configuration turns no build check off and puts no secret into the client environment."
---

Checks that the framework configuration turns no build check off and puts no secret into the client environment.

## Why

A build that ignores lint and type errors ships them, and a key under env is readable by every visitor.

## What to do

Remove the switch, and read the secret on the server.

## Where it runs

- Preset: [the nextjs preset](/reference/presets/nextjs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/next-config --paths <glob> --reason "<why>"`.
