---
title: "rust/cargo-deny"
description: "Checks the crate graph with cargo-deny: the licenses it may hold, the crates it bans, and the registries it may come from."
---

Checks the crate graph with cargo-deny: the licenses it may hold, the crates it bans, and the registries it may come from.

## Why

A license the product cannot ship under, or a crate from an unknown registry, arrives three levels down the graph.

## What to do

Replace the crate, or allow the license under tools.deny.licenses with a reason.

## Where it runs

- Preset: [the rust preset](/reference/presets/rust/)
- Stage: push
- Tool: cargo-deny
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore rust/cargo-deny --paths <glob> --reason "<why>"`.
