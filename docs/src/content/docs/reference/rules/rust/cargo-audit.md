---
title: "rust/cargo-audit"
description: "Checks Cargo.lock against the RustSec advisory database."
---

Checks Cargo.lock against the RustSec advisory database.

## Why

A crate with a known vulnerability is one the whole world can read the exploit for.

## What to do

Upgrade the crate to a patched version the finding names, with cargo update -p.

## Where it runs

- Preset: [the rust preset](/reference/presets/rust/)
- Stage: push
- Tool: cargo-audit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore rust/cargo-audit --paths <glob> --reason "<why>"`.
