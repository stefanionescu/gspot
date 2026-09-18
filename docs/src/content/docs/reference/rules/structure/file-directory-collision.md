---
title: "structure/file-directory-collision"
description: "Finds a file and a folder in the same place with the same stem, like turn.ts beside turn/."
---

Finds a file and a folder in the same place with the same stem, like turn.ts beside turn/.

## Why

An import of ./turn names both, and a reader cannot tell which one loads.

## What to do

Rename the file or the folder so their stems differ.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/file-directory-collision --paths <glob> --reason "<why>"`.
