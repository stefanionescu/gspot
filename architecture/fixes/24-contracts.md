# Cross-Cutting Contracts

These fixes close the architecture review of September 20, 2026. They supplement the existing
owner fixes, rather than replacing their acceptance tests. Apply safety and contract work before
new takeover or destructive lifecycle behavior. Website deployment follows the manual and release.

## K-298: Managed paths can escape their root

**What is wrong.** `policy/problems.ts` accepts parent scope paths and `rules/assemble.ts` uses the configured rules directory in output paths. Atomic writes do not confine their target.

**Target.** Confine reads, outputs, and deletions under the boundary contract in [03-configuration.md](../03-configuration.md).

**Files.** `policy/problems.ts`, `repository/scopes.ts`, `rules/assemble.ts`, and `emit/targets.ts`.
Also update lifecycle writers and removers.

**Logic.** Use one path validator for lexical and canonical boundaries, validate existing ancestors, reject output symlinks and Windows escape forms, and revalidate immediately before mutations. Git-resolved hooks have a separately validated boundary.

**What goes.** Independent path joins that authorize writes by accident.

**Tests.** Scope `..`, rules `../outside-rules`, absolute paths, Universal Naming Convention (UNC)
paths, drive-relative paths, both separators, symlinked parents, symlink replacement, case
variants, and a config below the Git root. Assert no external file is changed.

**Done when.** All lifecycle operations reject escapes before any external write or deletion.

## K-299: Recovery and uninstall disagree about ownership

**What is wrong.** `lifecycle/takeover.ts` deletes replaced files relying on Git; `lifecycle/uninstall-command.ts` recursively removes `.gspot/`, defeating K-118 preservation.

**Target.** Use the recovery and ownership rules of [03-configuration.md](../03-configuration.md) for init, apply, remove, upgrade, and uninstall.

**Files.** `lifecycle/takeover.ts`, `lifecycle/uninstall-command.ts`, `emit/apply-command.ts`, and
`emit/runner-tasks.ts`. Also update shared lifecycle recovery and ownership modules.

**Logic.** Save original bytes and mode before replacement, record installed hashes, serialize writers, resume interrupted operations, and restore only absent or unchanged destinations. Preserve unowned files, subsequent developer edits, and local recovery. Keep ignore entries while recovery remains.

**What goes.** Git-only recovery and recursive deletion of the managed root.

**Tests.** No Git, unborn Git, untracked config, dirty takeover, second replacement, full disk before backup, interrupted replacement, edited tasks, fresh clone with no original backup, unmarked and modified marked files under `.gspot/`.

**Done when.** Every destructive lifecycle step has recoverable originals or refuses to proceed, and uninstall preserves developer-owned content.

## K-300: Target documents give incompatible instructions

**What is wrong.** The earlier targets disagreed on init checks, apply flags, lifecycle scripts, names, upgrade writes, lock ownership, levels, and manual builds.

**Target.** Use one canonical owner per contract, listed in [README.md](../README.md), and update its consumers in the same implementation change.

**Files.** Architecture decisions and fixes; CLI help, schema, manifests, generated reference pages, and their tests when implemented.

**Logic.** Implement the amended D-83, D-115, D-156, D-159, D-163, D-167, D-168, and D-174 through D-176. Keep `apply --dry-run`; use name for domain identity, preserve mandated third-party fields; no lifecycle/setup injection. Planned examples are validated against the new implementation when that step lands.

**What goes.** Contradictory target prose, obsolete aliases, and count-only coverage claims.

**Tests.** Test init without checks, dry-run with no writes or installs, local hook chains,
and migrations before target validation. Test immutable install, manifest/report names, and
manual-stage build/test behavior. Scan docs for stale target claims without deleting historical evidence.

**Done when.** Help, schema, generated docs, decisions, and fix acceptance tests agree on the implemented behavior.

**Partial implementation.** Check selection accepts space-separated check names after one `--only` flag and
positional files or folders. Project checks retain all inputs after a selected path triggers
them. The `-C` directory controls relative path selection. Callers and generated command
references use the same contract; the positional check-name form is removed.
Other command-surface and lifecycle contracts remain open.

## K-301: Recommended adoption findings need usefulness tests

**What is wrong.** Banned terms and abstraction preferences were presented as defect-only checks. A fixed finding count does not establish that findings help a developer.

**Target.** Banned terms run only at all; generate and service are allowed. Recommended means a demonstrated defect rather than a preferred naming or abstraction style.

**Files.** `presets/naming/`, naming manifests and term sources, shared structure checks, prose rule sources, generated reference tests, and reference-project fixtures.

**Logic.** Apply [08-naming-policy.md](../08-naming-policy.md) and [19-names.md](../19-names.md). Review call-through and trivial-wrapper rules: an API boundary is valid even when short. Move judgment-only rules to all, including call-through, duplicate-function, length, case, digit, and layout preferences. Retain a recommended rule only with a demonstrable correctness condition. Remove generate and service from every shipped banned/reserved source and generated copy, without forcing emit back to generate.

**What goes.** Banned-term defaults at recommended, the two removed bans, and usefulness inferred solely from snapshot counts.

**Tests.** Fresh generated apps and established multi-package projects; valid service/generate names; public API wrappers and framework adapters. For every recommended finding, record why it is a defect and review false positives. Snapshot messages only after that review.

**Done when.** Representative adoption runs have no unexplained house-style findings at recommended.

## K-302: The website has source but no deployment contract

**What is wrong.** `docs/package.json` and `docs/astro.config.ts` already define the Astro/Starlight site for gspot.dev; the checkout has no site deployment workflow.

**Target.** Keep one site in docs and implement [21-documentation.md](../21-documentation.md).
Include version alignment and rollback.

**Files.** `docs/`, planned `.github/workflows/site.yml`, contributor deployment guide, repository Pages settings, and domain DNS.

**Logic.** Build release-aligned references, provide unprivileged PR build artifacts, deploy through the protected Pages environment, and verify ownership, HTTPS, and domain cutover. External account and DNS changes require the owner's access.

**What goes.** The assumption that a successful build proves a public deployment, and the need for a separate site repository.

**Tests.** Clean frozen-lock build, internal links, accessible landing controls, no PR deploy permissions, released-version labels, provider URL, custom-domain HTTPS, and rollback to the preceding artifact.

**Done when.** The released site is reachable at gspot.dev and its deployment and rollback have been exercised.
