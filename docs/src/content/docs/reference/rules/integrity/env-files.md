---
title: "integrity/env-files"
description: "Checks that git tracks no environment file except the templates."
---

Checks that git tracks no environment file except the templates.

## Why

An environment file holds the values of one machine, and most of them are secrets.

## What to do

Run git rm --cached <file>, add it to .gitignore, and keep a template such as .env.example with the keys and no values.

## Where it runs

- Preset: [the secrets preset](/reference/presets/secrets/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/env-files --paths <glob> --reason "<why>"`.
