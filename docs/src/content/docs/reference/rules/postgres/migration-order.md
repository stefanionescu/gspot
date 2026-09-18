---
title: "postgres/migration-order"
description: "Checks that every migration has a version, that no two share one, and that a new migration sorts after the committed ones."
---

Checks that every migration has a version, that no two share one, and that a new migration sorts after the committed ones.

## Why

A migration that sorts before one already applied never runs on the databases that are ahead of it.

## What to do

Rename the new migration with a version later than the newest committed one.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore postgres/migration-order --paths <glob> --reason "<why>"`.
