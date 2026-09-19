---
title: "swift/env-access-owner"
description: "Checks that the process environment is read in one place."
---

Checks that the process environment is read in one place.

## Why

A variable read in many files has many defaults and many spellings, and nobody can list what the app needs.

## What to do

Read the environment in the file that architecture.roles.env names, and pass the values in.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/env-access-owner --paths <glob> --reason "<why>"`.
