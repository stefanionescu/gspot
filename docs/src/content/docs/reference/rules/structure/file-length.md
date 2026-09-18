---
title: "structure/file-length"
description: "Checks that no shell script has more code lines than the ceiling."
---

Checks that no shell script has more code lines than the ceiling.

## Why

A long script holds more than one job; split it by the job.

## What to do

Split the script, or raise limits.bash.file_lines with a reason.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/file-length --paths <glob> --reason "<why>"`.
