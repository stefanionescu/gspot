---
title: "config-files/dotenv"
description: "Checks every tracked environment file: key format, duplicates, quoting, ordering, and trailing spaces."
---

Checks every tracked environment file: key format, duplicates, quoting, ordering, and trailing spaces.

## Why

A tracked environment file is a template other people copy; a malformed line there is copied into every machine.

## What to do

Run gspot check --fix, or fix the line dotenv-linter names.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: dotenv-linter

Turn it off for a path with a reason: `gspot ignore config-files/dotenv --paths <glob> --reason "<why>"`.
