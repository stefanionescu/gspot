---
title: "swift/periphery"
description: "Scans the built project for declarations nothing uses."
---

Scans the built project for declarations nothing uses.

## Why

Dead code is read, maintained, and migrated by people who cannot tell it is dead.

## What to do

Delete the declaration, or mark it with a periphery:ignore comment that says who uses it.

## Where it runs

- Preset: [the swift preset](/reference/presets/swift/)
- Stage: push
- Tool: periphery
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore swift/periphery --paths <glob> --reason "<why>"`.
