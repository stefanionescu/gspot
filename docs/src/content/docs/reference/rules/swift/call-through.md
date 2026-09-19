---
title: "swift/call-through"
description: "Finds functions that pass their parameters straight to one other call."
---

Finds functions that pass their parameters straight to one other call.

## Why

A function that only forwards adds a name to learn and a jump to make, and says nothing new.

## What to do

Call the inner function where the outer one is called, and delete the outer one.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/call-through --paths <glob> --reason "<why>"`.
