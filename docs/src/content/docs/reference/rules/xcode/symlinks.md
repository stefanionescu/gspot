---
title: "xcode/symlinks"
description: "Reports every tracked symlink beside or under an Xcode project, with where it points."
---

Reports every tracked symlink beside or under an Xcode project, with where it points.

## Why

Xcode, git, and each lint tool follow a symlink their own way, so one file is checked twice or never.

## What to do

Replace the symlink with the folder it points at, or ignore the path with a reason.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xcode/symlinks --paths <glob> --reason "<why>"`.
