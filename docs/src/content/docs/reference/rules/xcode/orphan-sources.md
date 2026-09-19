---
title: "xcode/orphan-sources"
description: "Compares the Swift files in the tree with the files the project names: a file in no target, and a target file that is gone."
---

Compares the Swift files in the tree with the files the project names: a file in no target, and a target file that is gone.

## Why

A Swift file in no target is never compiled, so it breaks without anyone seeing it.

## What to do

Add the file to a target or delete it, and remove the reference to a file that is gone.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xcode/orphan-sources --paths <glob> --reason "<why>"`.
