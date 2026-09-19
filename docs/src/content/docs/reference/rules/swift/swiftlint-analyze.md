---
title: "swift/swiftlint-analyze"
description: "Runs the SwiftLint analyzer rules over the compiler log of the build: unused imports, unused declarations, captured variables."
---

Runs the SwiftLint analyzer rules over the compiler log of the build: unused imports, unused declarations, captured variables.

## Why

These rules need the compiler's view of the code, which a file-by-file lint does not have.

## What to do

Remove what the rule names. Keep an import the analyzer misjudges under tools.swiftlint.keep_imports.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: push
- Tool: swiftlint
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/swiftlint-analyze --paths <glob> --reason "<why>"`.
