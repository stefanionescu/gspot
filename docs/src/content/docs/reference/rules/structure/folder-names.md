---
title: "structure/folder-names"
description: "Finds a folder named after a container word like common, core, helpers or utils, or after a language."
---

Finds a folder named after a container word like common, core, helpers or utils, or after a language.

## Why

A folder with no owner collects everything nobody wanted to place, and grows until nobody reads it.

## What to do

Name the folder after what it holds, or allow it with a reason under structure.folder_name_allowed.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/folder-names --paths <glob> --reason "<why>"`.
