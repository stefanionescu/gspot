---
title: "rust/rustfmt"
description: "Checks that every Rust file is formatted the way rustfmt formats it."
---

Checks that every Rust file is formatted the way rustfmt formats it.

## Why

One layout means a diff shows what changed, and nobody reviews spacing.

## What to do

Run gspot check --fix, which runs cargo fmt over the crate.

## Where it runs

- Preset: [the rust preset](/reference/presets/rust/)
- Stage: commit
- Tool: cargo

Turn it off for a path with a reason: `gspot ignore rust/rustfmt --paths <glob> --reason "<why>"`.
