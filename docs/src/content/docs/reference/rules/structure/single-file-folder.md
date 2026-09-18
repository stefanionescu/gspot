---
title: "structure/single-file-folder"
description: "Finds a folder that holds one code file and nothing else."
---

Finds a folder that holds one code file and nothing else.

## Why

A folder of one file adds a level to every path and promises siblings that never arrive.

## What to do

Move the file up beside its neighbors, or allow the folder with a reason under structure.single_file_folder_allowed.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/single-file-folder --paths <glob> --reason "<why>"`.
