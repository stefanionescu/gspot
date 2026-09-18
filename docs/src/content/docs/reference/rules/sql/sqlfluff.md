---
title: "sql/sqlfluff"
description: "Lints every SQL file for layout, capitalization, aliasing, and ambiguous references, in the dialect the database preset names."
---

Lints every SQL file for layout, capitalization, aliasing, and ambiguous references, in the dialect the database preset names.

## Why

SQL that reads one way in every file lets a reviewer look at what the statement does.

## What to do

Run gspot check --fix. Turn one rule off with gspot ignore sql/sqlfluff --rule <code> --reason.

## Where it runs

- Preset: [the sql preset](/reference/presets/sql/)
- Stage: commit
- Tool: sqlfluff

Turn it off for a path with a reason: `gspot ignore sql/sqlfluff --paths <glob> --reason "<why>"`.
