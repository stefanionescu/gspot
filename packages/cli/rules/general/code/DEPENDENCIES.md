---
layer: code
configuration: rules
title: Dependencies
---

# Dependencies

## Adding one

- Do not add a dependency for a one-line native API, a small local helper, or an array, object, or
  string utility. Use the platform first, then what the repository already depends on.
- A new dependency needs a reason in the commit: what it does that the platform and existing
  dependencies do not.
- Prefer a package that does one thing, is maintained, publishes types, and has no install scripts.
- One package manager per repository. One lockfile, committed, and installed with the frozen flag
  in CI and images.

## Versions

- Pin exact versions. No `^`, `~`, ranges, `latest`, or unpinned git references.
- The runtime version (Node, Python, Bun, Swift toolchain) is pinned once and every file that
  states it agrees.
- A package is installed only after the minimum release age the repository configures. A version
  published today does not enter the lockfile today.
- Upgrade one dependency per commit with the reason. Never upgrade broadly to satisfy a scanner
  without reading what changed.

## Policy

- A dependency's license is on the allowlist. A new license needs a decision, not a suppression.
- A known vulnerability without a fixed release carries an ignore entry with a reason and the
  advisory ID. No blanket ignore exists.
- Vendored code is declared as vendored, carries its upstream version and license, and is patched
  only by rebase.
- No compatibility shim around a dependency upgrade. Update every call site in the same change.
- Remove a dependency the moment its last import goes. An unused dependency is a finding.
