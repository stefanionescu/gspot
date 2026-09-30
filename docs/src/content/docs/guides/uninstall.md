---
title: Uninstall
description: Remove what gspot wrote and restore the files it replaced.
---

`gspot uninstall` removes what gspot wrote and puts back the files it replaced.

## Remove gspot

1. From the repository root, preview the removal:

    ```bash
    gspot uninstall --dry-run
    ```

    The preview lists the files gspot removes, the originals it restores, and the files it
    keeps for you to review. It changes nothing.

2. Remove gspot:

    ```bash
    gspot uninstall --yes
    ```

Uninstall restores an original when its place is empty, or still holds exactly what gspot
wrote. It deletes the installed tools, the cache, the reports, the downloaded style packages, and
the ignore block, then `.gspot/` itself once nothing of yours is left in it. It keeps
`gspot.toml`, exported profiles, and your own guides folder.

## A file you edited

When you edited a file after gspot wrote it, uninstall keeps your version. It prints the path
and, when one exists, the path of the saved original, so you can compare them. `--json` lists
these pairs under `originals`. Decide which changes to keep before you replace anything.

While such a file has an original, uninstall keeps the recovery data under `.gspot/state/`. Keep
it until you resolve every conflict. It holds the exact bytes and permissions of each file gspot
replaced.

## A fresh clone

The record of what gspot wrote lives only on the machine where it ran, under `.gspot/state/`. A
fresh clone has none, so uninstall leaves the files in place there. On that clone, `gspot apply`
starts a new record.

## Outside the repository

Uninstall changes only files in the repository. Hook manager settings you added, CI jobs, tools
installed on your system, and settings on your Git host stay as they are.

## How gspot keeps the originals

![Configuration preservation and recovery](/brand/diagrams/recovery.svg)

Before gspot writes a file, it records the bytes and permissions of what was there. When you
edit a file gspot wrote, gspot keeps your edit. Uninstall restores an original only while the
file still holds what gspot wrote.
