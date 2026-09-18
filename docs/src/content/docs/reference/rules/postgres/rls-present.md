---
title: "postgres/rls-present"
description: "Checks that every table in a client schema enables row level security and has a policy in some migration."
---

Checks that every table in a client schema enables row level security and has a policy in some migration.

## Why

A table in an exposed schema with no row security is readable and writable by every client that holds the public key.

## What to do

Enable row level security on the table, and add its policies in the same or a later migration.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore postgres/rls-present --paths <glob> --reason "<why>"`.
