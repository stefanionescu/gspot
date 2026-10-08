---
title: Remove gspot
description: Remove a configuration or remove gspot from a repository.
---

To remove one built-in configuration, run:

```shell
gspot remove nextjs
gspot apply --dry-run
```

Required configurations stay selected while another active configuration needs them. Removal records a visible `removed_configurations` choice, so later detection keeps Next.js removed. Use `gspot add nextjs` to restore it.

## Remove the repository setup

gspot provides no uninstall command. Review Git history to identify the setup files and managed blocks:

1. Restore the tool configuration you want from the commit before initialization.
2. Remove the managed gspot blocks from authored instruction files, `.gitignore`, and `.gitattributes`. Preserve authored content outside those blocks.
3. Remove generated pointers, gspot-only CI files, and `.mise/conf.d/gspot-tools.toml` if present.
4. If Git uses `.gspot/hooks`, run `git config --unset core.hooksPath`. If a hook manager owns the hooks, remove only its gspot integration lines.
5. Remove the CLI dependency using your package manager, then remove `gspot.toml` and `.gspot/` after reviewing them for authored files you need to keep.

Run your remaining checks and review the diff before committing. Restoring the setup commit restores the tracked configuration; run `gspot install` again to restore installed tools and hooks.
