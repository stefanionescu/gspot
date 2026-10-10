---
title: Remove gspot
description: Remove a configuration or remove gspot from a repository.
---

Preview the removal of a language or framework configuration, then apply it:

```shell
gspot remove nextjs --dry-run
gspot remove nextjs
```

Removal writes the name into `removed_configurations` in `gspot.toml`, so it survives later detection. Use `gspot add nextjs` to restore it. Remove a configuration that requires another before removing its dependency. Otherwise, removal is refused. General configurations follow repository inputs and the selected level.

`remove` installs nothing. When the required tools change, it tells you to run `gspot install`.

## Remove the repository setup

gspot provides no uninstall command. Review Git history to identify the setup files and managed blocks:

1. Restore the tool files you want from the commit before initialization.
2. Remove the managed gspot blocks from authored instruction files, `.gitignore`, and `.gitattributes`. Preserve authored content outside those blocks.
3. Remove generated pointers, gspot-only CI files, and `.mise/conf.d/gspot-tools.toml` if present.
4. If Git uses `.gspot/hooks`, run `git config --unset core.hooksPath`. If a hook manager owns the hooks, remove only its gspot integration lines.
5. Remove the CLI dependency using your package manager, then remove `gspot.toml` and `.gspot/` after reviewing them for authored files you need to keep.

Run your remaining checks and review the diff before committing. Restoring the setup commit restores the tracked files. Run `gspot install` again to restore installed tools and hooks.
