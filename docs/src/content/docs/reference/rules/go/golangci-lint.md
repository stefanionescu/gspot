---
title: "go/golangci-lint"
description: "Runs golangci-lint with the linters the preset turns on, the type check of go vet among them."
---

Runs golangci-lint with the linters the preset turns on, the type check of go vet among them.

## Why

An unchecked error, a shadowed variable, or a lost context is a bug the compiler accepts.

## What to do

Read the linter named in the finding; fix the code, or record a decision with gspot ignore go/golangci-lint --rule and a reason.

## Where it runs

- Preset: [the go preset](/reference/presets/go/)
- Stage: commit
- Tool: golangci-lint

Turn it off for a path with a reason: `gspot ignore go/golangci-lint --paths <glob> --reason "<why>"`.
