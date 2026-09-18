---
title: "postgres/squawk"
description: "Reads every migration for the change that locks a table, rewrites it, or breaks the running application."
---

Reads every migration for the change that locks a table, rewrites it, or breaks the running application.

## Why

A migration that takes an exclusive lock on a large table stops the application for as long as it runs.

## What to do

Follow the help squawk prints for the rule. Turn one rule off with gspot ignore postgres/squawk --rule <name> --reason.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Tool: squawk

Turn it off for a path with a reason: `gspot ignore postgres/squawk --paths <glob> --reason "<why>"`.
