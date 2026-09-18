---
title: "sql/file-length"
description: "Checks that no SQL file has more code lines than the ceiling."
---

Checks that no SQL file has more code lines than the ceiling.

## Why

A long SQL file holds more than one change, and one change is what a reviewer can hold.

## What to do

Split the file by the object it changes, or raise limits.sql.file_lines with a reason.

## Where it runs

- Preset: [the sql preset](/reference/presets/sql/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore sql/file-length --paths <glob> --reason "<why>"`.
