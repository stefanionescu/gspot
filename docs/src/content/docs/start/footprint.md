---
title: What gspot adds
description: Find the generated files, installed tools, temporary copies, and caches of gspot, and reclaim their disk space.
---

gspot keeps settings and tool pins in Git. Installed programs, temporary check copies, and build caches stay outside
the tracked tree. Some tools and caches serve several repositories.

## Files to commit

Commit `gspot.toml`, `gspot.baseline.json` when `gspot baseline` wrote one, the generated config files and lockfiles in
`.gspot/`, and the generated files outside it. The
[Generated files table](/reference/generated-files/#what-gspot-writes) lists each kind and whether to commit it.
The gspot block of `.gitattributes` marks the generated paths outside `.gspot/` with `linguist-generated`.

After you change settings, commit the generated changes too. A new clone runs `gspot install` to recreate its tools.

## Installed tools and working files

| Location                           | What uses it                                                                           | How to clear it                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/node_modules/`             | The npm tools of the selected configurations.                                          | Delete this folder, then run `gspot install` before the next check.                                                                                  |
| `.gspot/.venv/`                    | The Python tools that gspot installs.                                                  | Delete this folder, then run `gspot install`. It is separate from the project's own `.venv/`.                                                        |
| `.gspot/vale/`                     | Vale packages and vocabulary files.                                                    | Delete this folder, then run `gspot install`.                                                                                                        |
| `.gspot-copies/`                   | Temporary copies for `gspot scan`, staged or committed checks, and isolated checks.    | gspot removes each copy when its run finishes and reclaims copies whose process has exited. After all checks stop, you can delete a leftover folder. |
| The system cache's `gspot/` folder | Swift build products, build logs, and cached sources, grouped by repository and scope. | Stop the checks of every affected repository, then delete the cache. Later checks rebuild it.                                                        |
| Global mise installs               | Tools pinned by `.gspot/mise.toml`.                                                    | Preview and prune unused versions as described below. Other repositories may use the same version.                                                   |
| uv's Python installs and cache     | The interpreter and downloaded packages used to create Python environments.            | Prune cached packages, or uninstall an unused interpreter as described below.                                                                        |

Delete only the installed-tool folders listed above to reinstall tools. Keep the other files in `.gspot/`, including
its manifests and lockfiles. See [Uninstall](/start/install/#uninstall-gspot) to remove gspot itself.

gspot keeps its system cache in `XDG_CACHE_HOME/gspot` when you set `XDG_CACHE_HOME`. Otherwise, it uses
`LOCALAPPDATA/gspot` on Windows, `~/Library/Caches/gspot` on macOS, and `~/.cache/gspot` on other systems. Check
copies live in the repository's `.gspot-copies/`, not in this cache.

## Measure disk use

The configurations share tools and their dependencies. Adding the sizes of their packages counts shared files
more than once. The installed size also depends on the operating system, package manager, selected level, and tool
versions. Swift build products depend on your project.

On macOS or Linux, run this at the repository root after `gspot install` to measure the generated files and locally
installed tools together:

```shell
du -sh .gspot
```

To compare configurations, measure a disposable Git repository after `gspot init --no-configurations` and
`gspot install`. Add one configuration with `gspot add <configuration>`, run `gspot install` again, and repeat the
measurement. The increase includes its required configurations and the npm and Python tools that it adds to `.gspot/`.
It leaves out global mise tools and the Python installs of uv, so a configuration that adds only mise tools can add
almost nothing to `.gspot/`; `mise where <tool>`, `uv python dir`, and `uv cache dir` show their locations.

## Reclaim shared disk space

After an upgrade or uninstall, preview unused mise versions, then remove them when the list holds only versions that no project needs:

```shell
mise prune --dry-run
mise prune
```

mise removes versions that no tracked config or running process selects. Other repositories can still need them;
review the preview before deleting anything. Reinstall a needed version with mise.

`uv cache prune` removes unreachable cache objects. It does not uninstall uv-managed Python versions:

```shell
uv cache prune
```

To remove an interpreter, inspect `uv python list --only-installed`, then run `uv python uninstall <version>` with
an exact version that no project needs. uv can reinstall it later. Pruning shared caches does not remove the tool
environments already installed in `.gspot/`.
