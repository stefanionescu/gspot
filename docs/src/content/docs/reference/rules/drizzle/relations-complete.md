---
title: "drizzle/relations-complete"
description: "Checks that every table with a reference has a relations entry."
---

Checks that every table with a reference has a relations entry.

## Why

The query builder joins through relations, so a reference without one works in SQL and is missing in code.

## What to do

Add a relations call for the table.

## Where it runs

- Preset: [the drizzle preset](/reference/presets/drizzle/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore drizzle/relations-complete --paths <glob> --reason "<why>"`.
