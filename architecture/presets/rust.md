# `rust`

Kind: language. Requires: structure, formatting. Recommends: spelling, dependencies, security.

## Detects and claims

|        |                                                                               |
| ------ | ----------------------------------------------------------------------------- |
| Detect | `Cargo.toml`, `.rs` files                                                     |
| Claims | `.rs`, `Cargo.toml`, `Cargo.lock`, `clippy.toml`, `rustfmt.toml`, `deny.toml` |

## Tools

cargo, rustfmt, and Clippy from the host toolchain; cargo-audit 0.22.2 and cargo-deny 0.20.2 through
the mise `cargo:` backend. The repository owns its Rust toolchain, through `rust-toolchain.toml`.

## Generated configuration

- `.gspot/rustfmt.toml`: edition 2021, width 100, Unix newlines, the two shorthand options.
- `.gspot/clippy.toml`: cognitive complexity at 8, function lines at `limits.function_lines`, five
  arguments, and `unwrap`, `expect`, and `dbg!` allowed in tests. Clippy finds the file through
  `CLIPPY_CONF_DIR`, which the check sets.
- `.gspot/deny.toml`: eleven permissive licenses plus `tools.deny.licenses`, wildcard versions
  denied, and crates.io as the only registry. A crate with `publish = false` needs no license.

## Checks

| Id                 | Stage         | Command                                                                                      |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| `rust/rustfmt`     | commit        | `cargo fmt --all -- --check -l --config-path .gspot/rustfmt.toml`; the fixer drops `--check` |
| `rust/clippy`      | commit        | `cargo clippy --all-targets --message-format=json -- -D <lint>` for each denied lint         |
| `rust/cargo-audit` | push, network | `cargo audit --json`; one finding for each advisory, with the patched versions               |
| `rust/cargo-deny`  | push, network | `cargo deny --format json --config .gspot/deny.toml check licenses bans sources`             |

Clippy denies `warnings`, `missing_docs`, `clippy::all`, `clippy::pedantic`,
`clippy::cognitive_complexity`, and the restriction lints that keep a panic out of shipped code:
`unwrap_used`, `expect_used`, `panic`, `todo`, `unimplemented`, `dbg_macro`, and
`undocumented_unsafe_blocks`. The library and its tests both print a finding, and the check
reports it once. The rule of a finding is the lint, such as `clippy::unwrap_used`.

cargo-audit owns advisories, so cargo-deny runs its other three checks only.

## Settings

`tools.deny.licenses` (the SPDX id and the reason), `limits.function_lines` for rust.

## Rule files

`language/RUST.md`.
