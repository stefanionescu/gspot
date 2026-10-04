---
title: Dependencies
---

# Dependencies

## Adding one

- Do not add a dependency for a one-line native API, a small local helper, or an array, object, or
  string utility. Use the platform first, then what the repository already depends on.
- A new dependency needs a reason in the commit: what it does that the platform and existing
  dependencies do not.
- Prefer a package that does one thing, is maintained, publishes types, and has no install scripts.
- Each project uses one package manager and commits its lockfile. CI and Docker builds install
  from the lockfile without changing it (`npm ci`, `uv sync --frozen`).

## Versions

- Pin exact versions in an application. A published library keeps ranges for its dependencies and peers.
- The runtime version (Node, Python, Bun, Swift toolchain) is pinned once and every file that
  states it agrees.
- If the package manager refuses a release as too new, pick an older one or ask the user.
- Upgrade one dependency per commit with the reason. Never upgrade broadly to satisfy a scanner
  without reading what changed.

## Policy

- Ask the user before you add a dependency whose license is not on the allowed list.
- Record a known advisory that has no fix in `[[ignore]]`, with the check, advisory ID, reason,
  and expiry. Never ignore advisories in bulk.
- Declare vendored code and record its upstream version and license. Change it only by updating
  it from upstream.
- Remove dependencies when no runtime, build, tooling, or public peer contract needs them.
  Before you remove a package that a check calls unused, search configuration and scripts for it.
