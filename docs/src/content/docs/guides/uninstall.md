---
title: Remove gspot and recover original files
description: Preview removal, preserve later edits, and restore recorded originals.
---

Run removal from the configured repository root. Inspect the plan before applying it:

```bash
gspot uninstall --dry-run
```

The preview is read-only. It lists recorded removals, restorations, and content that needs
review. To accept the plan without an interactive question:

```bash
gspot uninstall --yes
```

Uninstall uses the local ownership record. It restores an original when the destination is
absent or still matches the installed bytes and permissions. Later edits and unowned files
remain. It also keeps `gspot.toml`, the project rule layer, and local recovery material.

## Resolve a retained edit

Read the reported destination and compare it with the original saved under `.gspot/recovery/`.
Choose which authored changes to retain before replacing anything. A modified hook dispatcher
also needs review; uninstall does not assume that the current hook belongs entirely to gspot.
Do not remove recovery material while a restoration conflict remains.

Interrupted operations are recovered through the same ownership record before restoration.
If recovery refuses a conflict, preserve both the destination and recovery data while resolving
it. Running uninstall again cannot authorize deletion of an unrelated file.

## A clone has different recovery history

Recovery data is local. A fresh clone does not acquire ownership records merely because Git
tracks generated configuration. Files without those records remain during removal. Applying
configuration in that clone records any adopted existing bytes and permissions as originals.
Do not infer ownership from a generated header or filename.

## Remove integrations separately when required

Review retained hook-manager and pipeline configuration after removal. External repository
settings, installed global executables, and tools provisioned by another package manager are
outside file restoration. Uninstall is not a request to disable remote checks or delete accounts.
