---
title: "sql/syntax"
description: "Parses every SQL file with the parser Postgres itself uses, when the dialect is postgres or ansi."
---

Parses every SQL file with the parser Postgres itself uses, when the dialect is postgres or ansi.

## Why

A migration that does not parse fails at deploy, halfway through a release.

## What to do

Correct the statement at the line and column the message names.

## Where it runs

- Preset: [the sql preset](/reference/presets/sql/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore sql/syntax --paths <glob> --reason "<why>"`.
