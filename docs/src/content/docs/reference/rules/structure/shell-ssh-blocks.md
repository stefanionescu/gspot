---
title: "structure/shell-ssh-blocks"
description: "Checks that multi-line ssh blocks are named, documented, and inside a function."
---

Checks that multi-line ssh blocks are named, documented, and inside a function.

## Why

A remote command block with no name is the hardest thing in a script to test or reuse.

## What to do

Move the block into a named function and write "# name - what it does" above it.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-ssh-blocks --paths <glob> --reason "<why>"`.
