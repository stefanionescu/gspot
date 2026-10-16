---
title: Remove gspot
description: Remove gspot from a repository.
tableOfContents: false
---

To stop checking one language or framework instead, see [gspot.toml](/configure/gspot-toml/#choose-configurations).

gspot has no uninstall command. Keep a copy of the tool files and settings you want, then:

1. Restore earlier tool files from Git or a backup, or set up the tools you want to use.
2. Delete the gspot sections between gspot markers from `AGENTS.md`, your other instruction files, `.gitignore`, and
   `.gitattributes`. Keep your own text outside the blocks.
3. Delete the tool file entry points and the gspot CI file: `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml`.
4. If Git uses `.gspot/hooks`, run `git config --unset core.hooksPath`. If another hook manager runs your hooks,
   delete the gspot hook lines from them.
5. Remove gspot: `npm uninstall @gspothq/cli`, the remove command of your package manager, or
   `mise unuse npm:@gspothq/cli`. Then delete `gspot.toml` and `.gspot/`.

Run your other checks and review the diff. To undo, restore your saved files and run `gspot install`.
