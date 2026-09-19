---
title: "swift/swiftlint"
description: "Lints every Swift file with the shipped SwiftLint rule set, with every warning an error."
---

Lints every Swift file with the shipped SwiftLint rule set, with every warning an error.

## Why

A force unwrap, a retain cycle through a delegate, or a function nobody can hold in their head is cheapest to stop at the commit.

## What to do

Run gspot check --fix for the rules that fix themselves. Turn one rule off with gspot ignore swift/swiftlint --rule <id> --reason.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Tool: swiftlint

Turn it off for a path with a reason: `gspot ignore swift/swiftlint --paths <glob> --reason "<why>"`.
