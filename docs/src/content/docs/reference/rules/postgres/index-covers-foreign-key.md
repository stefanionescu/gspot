---
title: "postgres/index-covers-foreign-key"
description: "Checks that an index, a primary key, or a unique key leads with every foreign key column."
---

Checks that an index, a primary key, or a unique key leads with every foreign key column.

## Why

Deleting a parent row scans the whole child table when the foreign key has no index.

## What to do

Create an index that starts with the foreign key column.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore postgres/index-covers-foreign-key --paths <glob> --reason "<why>"`.
