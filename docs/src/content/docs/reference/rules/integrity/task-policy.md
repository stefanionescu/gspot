---
title: "integrity/task-policy"
description: "Checks that the runner surface holds every task gspot writes and that the installed hooks exist, call gspot and are pointed at by core.hooksPath."
---

Checks that the runner surface holds every task gspot writes and that the installed hooks exist, call gspot and are pointed at by core.hooksPath.

## Why

A missing task or a hook nobody points at means the gate runs only when someone remembers to.

## What to do

Run gspot apply; it rewrites the tasks and the hooks and sets core.hooksPath.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/task-policy --paths <glob> --reason "<why>"`.
