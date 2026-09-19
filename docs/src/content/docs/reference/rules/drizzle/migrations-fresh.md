---
title: "drizzle/migrations-fresh"
description: "Asks drizzle-kit to write migrations, and fails when it writes one."
---

Asks drizzle-kit to write migrations, and fails when it writes one.

## Why

A schema change with no migration works on the machine that pushed the schema and nowhere else.

## What to do

Run drizzle-kit generate and commit the migration.

## Where it runs

- Preset: [the drizzle preset](/reference/presets/drizzle/)
- Stage: push
- Tool: drizzle-kit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore drizzle/migrations-fresh --paths <glob> --reason "<why>"`.
