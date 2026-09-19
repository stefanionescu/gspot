---
title: "swift/swiftformat"
description: "Checks the layout of every Swift file against the shipped SwiftFormat rules."
---

Checks the layout of every Swift file against the shipped SwiftFormat rules.

## Why

One layout everywhere keeps a diff about the change and not about where a brace went.

## What to do

Run gspot check --fix.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Tool: swiftformat

Turn it off for a path with a reason: `gspot ignore swift/swiftformat --paths <glob> --reason "<why>"`.
