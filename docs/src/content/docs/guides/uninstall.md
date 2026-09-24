---
title: Remove gspot and recover original files
description: Preview removal, preserve later edits, and restore recorded originals.
---

Use the [source installation guide](/guides/install/) to prepare the CLI. Run the commands below
from the repository root unless a step names another directory.

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
remain. It also keeps `gspot.toml`, exported profiles, the project rule layer, and local recovery material.

## Resolve a retained edit

Uninstall reports the retained destination and its original recovery path when a backup exists.
Compare those files before resolving the conflict. JSON output lists these pairs under `originals`.
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

## How preservation works

![Configuration preservation and recovery](/brand/diagrams/recovery.svg)

Before writing configuration, gspot observes existing bytes and permissions. Apply records
the changes it owns. If a managed output has been edited, the conflict preserves those edits.
Uninstall restores recorded originals where ownership still matches. Resolve reported conflicts
before retrying; do not delete edited configuration to silence a conflict.
