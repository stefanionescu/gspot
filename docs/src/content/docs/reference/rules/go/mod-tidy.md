---
title: "go/mod-tidy"
description: "Checks that go mod tidy changes neither go.mod nor go.sum."
---

Checks that go mod tidy changes neither go.mod nor go.sum.

## Why

A module file that lists what nothing imports, or misses what something imports, builds differently on the next machine.

## What to do

Run go mod tidy in the module and commit both files.

## Where it runs

- Preset: [the go preset](/reference/presets/go/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore go/mod-tidy --paths <glob> --reason "<why>"`.
