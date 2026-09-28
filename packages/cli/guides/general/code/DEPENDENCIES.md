---
layer: code
configuration: rules
title: Dependencies
---

# Dependencies

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Adding one

- Do not add a dependency for a one-line native API, a small local helper, or an array, object, or
  string utility. Use the platform first, then what the repository already depends on.
- A new dependency needs a reason in the commit: what it does that the platform and existing
  dependencies do not.
- Prefer a package that does one thing, is maintained, publishes types, and has no install scripts.
- Use one package manager and committed lockfile per installation boundary. Install frozen inputs
  in CI and images. Nested projects retain their declared installation boundaries.

## Versions

- Pin exact versions. No `^`, `~`, ranges, `latest`, or unpinned git references.
- The runtime version (Node, Python, Bun, Swift toolchain) is pinned once and every file that
  states it agrees.
- Install a package only after the minimum release age the repository configures. Apply any
  explicitly approved exception through that policy.
- Upgrade one dependency per commit with the reason. Never upgrade broadly to satisfy a scanner
  without reading what changed.

## Policy

- A dependency's license is on the allowlist. A new license needs a decision, not a suppression.
- A known vulnerability without a fixed release carries an ignore entry with a reason and the
  advisory ID. No blanket ignore exists.
- Vendored code is declared as vendored, carries its upstream version and license, and is patched
  only by rebase.
- No compatibility shim around a dependency upgrade. Update every call site in the same change.
- Remove dependencies when no runtime, build, tooling, or public peer contract needs them.
  Verify entrypoints and configuration references before treating a missing source import as disuse.
