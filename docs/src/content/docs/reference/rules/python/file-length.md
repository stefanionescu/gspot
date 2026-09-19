---
title: "python/file-length"
description: "Checks that no Python file has more code lines than the ceiling."
---

Checks that no Python file has more code lines than the ceiling.

## Why

A long module holds more than one job, and the second job is the one nobody finds.

## What to do

Split the module by the job, or raise limits.file_lines for python with a reason.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/file-length --paths <glob> --reason "<why>"`.
