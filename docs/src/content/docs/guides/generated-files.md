---
title: Edit and retain repository files
description: Know which files to edit, commit, regenerate, and retain for recovery.
---

Edit `gspot.toml` to choose configurations, checks, and exceptions. Commands such as
`gspot set` and `gspot ignore` edit the same file. Keep exception reasons there;
`gspot explain` shows the policy behind a check.

## Regenerate configuration

Review and apply your choices from the configured repository root:

```bash
gspot apply --dry-run
gspot apply
gspot install
```

`apply` writes tool configuration under `.gspot/config/` and copies agent guides to
`.gspot/rules/`. Scoped configuration mirrors the scope path under `.gspot/config/`.
Some tools require a root file for discovery. gspot writes a pointer where the tool
supports one, or writes the native configuration file directly.

Do not edit generated files. To preserve existing authored settings, use the
[adoption workflow](/guides/existing-repository/). Shared configuration, including
`bunfig.toml`, retains fields outside the policy. Bun release-age settings stricter
than the policy remain in place.

## Commit reproducible inputs

Commit `gspot.toml`, generated configuration, copied agent rules, and version pins.
Also commit the private dependency manifests and lockfiles at `.gspot/`'s root.
After cloning, run `gspot install` to install those locked dependencies and hooks.

The generated ignore block excludes installed dependencies, downloaded style
packages, `.gspot/state/`, `.gspot/cache/`, and `.gspot/reports/`.

## Retain recovery state

`.gspot/state/` holds ownership records and original files needed for restoration.
It is private local state. Keep it until you no longer need to restore adopted
files. Do not delete the whole `.gspot/` directory as a cleanup step.

Reports under `.gspot/reports/` and caches under `.gspot/cache/` do not contain
restoration records. See [uninstall and recover](/guides/uninstall/) before removing
managed configuration. Uninstall preserves later edits and retains recovery data.
