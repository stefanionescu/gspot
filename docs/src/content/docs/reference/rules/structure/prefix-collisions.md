---
title: "structure/prefix-collisions"
description: "Finds sibling files that share a name prefix, like asset-card, asset-list and asset-row in one folder."
---

Finds sibling files that share a name prefix, like asset-card, asset-list and asset-row in one folder.

## Why

Files that share a prefix are one concept split by suffix; they belong in a folder named after the prefix.

## What to do

Move the files into a folder named after the shared prefix, or allow the set with a reason.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/prefix-collisions --paths <glob> --reason "<why>"`.
