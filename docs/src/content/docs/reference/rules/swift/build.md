---
title: "swift/build"
description: "Builds the package or the Xcode scheme, and keeps the compiler log for the analyzer."
---

Builds the package or the Xcode scheme, and keeps the compiler log for the analyzer.

## Why

Swift has no type check without a build, so the build is the type check.

## What to do

Fix the first compiler error; later ones are often the same mistake.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/build --paths <glob> --reason "<why>"`.
