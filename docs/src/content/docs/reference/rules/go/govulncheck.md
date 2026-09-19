---
title: "go/govulncheck"
description: "Runs govulncheck, which reports a known vulnerability only where the code calls the vulnerable function."
---

Runs govulncheck, which reports a known vulnerability only where the code calls the vulnerable function.

## Why

A vulnerable function the program calls is reachable by whoever controls its input.

## What to do

Upgrade the module to the fixed version the finding names, then run go mod tidy.

## Where it runs

- Preset: [the go preset](/reference/presets/go/)
- Stage: push
- Tool: govulncheck
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore go/govulncheck --paths <glob> --reason "<why>"`.
