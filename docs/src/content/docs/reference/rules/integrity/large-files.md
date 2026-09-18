---
title: "integrity/large-files"
description: "Checks that every tracked file over the size limit is stored through LFS or declared with a reason."
---

Checks that every tracked file over the size limit is stored through LFS or declared with a reason.

## Why

A large file in plain git history stays in every clone for good.

## What to do

Track the file with git lfs, declare it with gspot declare <path> --reason, or raise limits.file_size_kb with a reason.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/large-files --paths <glob> --reason "<why>"`.
