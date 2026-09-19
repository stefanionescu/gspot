---
title: "swift/private-before-public"
description: "Checks that private and fileprivate top-level declarations sit above the ones other files see."
---

Checks that private and fileprivate top-level declarations sit above the ones other files see.

## Why

A file that opens with its own pieces and ends with what it offers reads in one direction.

## What to do

Move the file-local declarations above the first internal, public, or open one.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/private-before-public --paths <glob> --reason "<why>"`.
