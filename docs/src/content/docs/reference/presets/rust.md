---
title: "Rust"
description: "Rust crates: rustfmt, Clippy with every finding an error, cargo-audit for advisories, and cargo-deny for licenses, bans, and sources."
---

Rust crates: rustfmt, Clippy with every finding an error, cargo-audit for advisories, and cargo-deny for licenses, bans, and sources.

Kind: language. Requires: `structure`, `formatting`.

## Tools

- cargo
- rustfmt
- cargo-clippy
- cargo-audit 0.22.2
- cargo-deny 0.20.2

## Generated configuration

- `.gspot/rustfmt.toml`
- `.gspot/clippy.toml`
- `.gspot/deny.toml`

## Checks

| Check                                                    | Stage  | What it finds                                                                                                              |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| [`rust/rustfmt`](/reference/rules/rust/rustfmt/)         | commit | Checks that every Rust file is formatted the way rustfmt formats it.                                                       |
| [`rust/clippy`](/reference/rules/rust/clippy/)           | commit | Builds the crate with Clippy, where every compiler warning and every Clippy finding is an error.                           |
| [`rust/cargo-audit`](/reference/rules/rust/cargo-audit/) | push   | Checks Cargo.lock against the RustSec advisory database.                                                                   |
| [`rust/cargo-deny`](/reference/rules/rust/cargo-deny/)   | push   | Checks the crate graph with cargo-deny: the licenses it may hold, the crates it bans, and the registries it may come from. |

## Settings

- `tools.deny.licenses`: Licenses the crate graph may hold beside the ones the preset allows: the SPDX id and the reason.

## Rule files

- `language/RUST.md`
