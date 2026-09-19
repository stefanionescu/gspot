---
title: "swift/duplicate-functions"
description: "Finds functions whose bodies match line for line."
---

Finds functions whose bodies match line for line.

## Why

Two copies of one body drift apart, and a fix made in one never reaches the other.

## What to do

Keep one of the functions and call it from both places.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/duplicate-functions --paths <glob> --reason "<why>"`.
