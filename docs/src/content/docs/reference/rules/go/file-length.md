---
title: "go/file-length"
description: "Checks that no Go file has more code lines than the ceiling."
---

Checks that no Go file has more code lines than the ceiling.

## Why

A long file holds more than one job, and the second job is the one nobody finds.

## What to do

Split the file by the job, or raise limits.file_lines for go with a reason.

## Where it runs

- Preset: [the go preset](/reference/presets/go/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore go/file-length --paths <glob> --reason "<why>"`.
