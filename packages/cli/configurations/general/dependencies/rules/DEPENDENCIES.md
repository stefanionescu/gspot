# Dependencies

Read this rule before you add, upgrade, or remove a dependency.

## Adding one

- Do not add a dependency for a one-line native API, a small local helper, or an array, object, or
  string utility. Use the platform first, then what the repository already depends on.
- A new dependency needs a reason in the commit: what it does that the platform and existing
  dependencies do not.
- Prefer a package that does one thing, receives maintenance, publishes types, and has no install scripts.
- Each project uses one package manager and commits its lockfile. CI and Docker builds install
  from the lockfile without changing it such as `npm ci`, `uv sync --frozen`.

## Versions

- Pin exact versions in an application. A published library keeps ranges for its dependencies and peers.
- Pin the runtime version once for Node, Python, Bun, or the Swift toolchain. Every file that
  states it agrees.
- If the package manager refuses a release as too new, pick an older one or ask the user.
- Upgrade one dependency per commit with the reason. Never upgrade broadly to satisfy a scanner
  without reading what changed.
- Write each tool version once. Other files read that pin, or a check compares them with it.

## Policy

- Delete an override when the lockfile has no package it applies to, or when every package that requests it already
  accepts the fixed version.
- Keep third-party license notices in a tracked file, not in a string in code.
- Ask the user before you add a dependency whose license falls outside the allowed list.
- For a known advisory that has no fix, follow the suppression rules: ask the user, then record it with
  `gspot ignore` with the advisory ID, a reason, and an expiry date. Never ignore advisories in bulk.
- Declare vendored code and record its upstream version and license. Change it only by updating
  it from upstream.
- Remove dependencies when no runtime, build, tooling, or public peer dependency needs them.
  Before you remove a package that a check calls unused, search configuration and scripts for it.
