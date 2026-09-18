---
title: "postgres/explicit-grants"
description: "Refuses a grant of every privilege in a migration."
---

Refuses a grant of every privilege in a migration.

## Why

Granting everything includes truncating the table, adding triggers, and every privilege a later Postgres adds, which nobody meant to give.

## What to do

Name the privileges the role needs, such as `SELECT` alone.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore postgres/explicit-grants --paths <glob> --reason "<why>"`.
