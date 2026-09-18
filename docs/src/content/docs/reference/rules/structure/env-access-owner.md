---
title: "structure/env-access-owner"
description: "Checks that environment variables the owner declares are read elsewhere only through it."
---

Checks that environment variables the owner declares are read elsewhere only through it.

## Why

When any script reads the environment, nobody can list what the program needs to run; one owner can.

## What to do

Read the variable in the owner named under architecture.roles.env and pass the value in.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/env-access-owner --paths <glob> --reason "<why>"`.
