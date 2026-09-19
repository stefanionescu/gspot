---
title: "go/gofmt"
description: "Checks that every Go file is formatted the way gofmt formats it."
---

Checks that every Go file is formatted the way gofmt formats it.

## Why

Every Go reader expects gofmt layout, and a diff of layout hides the diff that matters.

## What to do

Run gspot check --fix, which runs gofmt -w over the files.

## Where it runs

- Preset: [the go preset](/reference/presets/go/)
- Stage: commit
- Tool: gofmt

Turn it off for a path with a reason: `gspot ignore go/gofmt --paths <glob> --reason "<why>"`.
