---
title: "rust/clippy"
description: "Builds the crate with Clippy, where every compiler warning and every Clippy finding is an error."
---

Builds the crate with Clippy, where every compiler warning and every Clippy finding is an error.

## Why

An unwrap, a needless clone, or a lossy cast compiles, and Clippy is the reviewer that never tires of them.

## What to do

Read the lint named in the finding; fix the code, or record a decision with gspot ignore rust/clippy --rule and a reason.

## Where it runs

- Preset: [the rust preset](/reference/presets/rust/)
- Stage: commit
- Tool: cargo-clippy
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore rust/clippy --paths <glob> --reason "<why>"`.
