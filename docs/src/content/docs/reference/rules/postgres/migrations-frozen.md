---
title: "postgres/migrations-frozen"
description: "Checks that no migration at or before tools.squawk.frozen_through differs from its committed text."
---

Checks that no migration at or before tools.squawk.frozen_through differs from its committed text.

## Why

A migration that ran never runs again, so an edit to it changes new databases only and the environments drift apart.

## What to do

Restore the file with git checkout, and write the change as a new migration.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore postgres/migrations-frozen --paths <glob> --reason "<why>"`.
