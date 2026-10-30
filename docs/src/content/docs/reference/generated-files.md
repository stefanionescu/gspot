---
title: Generated files
description: Which files gspot writes, which to commit, and which to leave alone.
---

Change `gspot.toml`, then run `gspot apply`; gspot writes every generated file from it.

## What gspot writes

| Path                                                                                                                   | What it holds                                                                                                                                                                                                                                               | Commit |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `gspot.toml`                                                                                                           | Your settings.                                                                                                                                                                                                                                              | Yes    |
| `.gspot/configurations/<group>/<configuration>/`                                                                       | The config files of each configuration, named after their tool. Each configuration with ESLint rules gets its own `eslint.mjs`, which the JavaScript configuration imports. A scope that needs other text gets `scopes/<scope path>/<file>` in that folder. | Yes    |
| `.gspot/configurations/<group>/<configuration>/rules/`                                                                 | The rules for coding agents.                                                                                                                                                                                                                                | Yes    |
| `.gspot/package.json` and its lockfile                                                                                 | The npm tools.                                                                                                                                                                                                                                              | Yes    |
| `.gspot/pyproject.toml` and `.gspot/uv.lock`                                                                           | The Python tools.                                                                                                                                                                                                                                           | Yes    |
| `.gspot/mise.toml` and its `mise.lock`                                                                                 | The programs that mise installs, and their locked versions.                                                                                                                                                                                                 | Yes    |
| `.gspot/hooks/`                                                                                                        | The Git hook scripts.                                                                                                                                                                                                                                       | Yes    |
| Link files, such as `eslint.config.mjs`, `ruff.toml`, `pyrightconfig.json`, and `.swiftlint.yml` in Swift test folders | Files that lead a tool or editor to its config file, at each scope root that needs one and inside test folders.                                                                                                                                             | Yes    |
| `.editorconfig` and `.prettierignore`                                                                                  | Editor settings and the files the formatter skips.                                                                                                                                                                                                          | Yes    |
| `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml`                                                                | The CI job.                                                                                                                                                                                                                                                 | Yes    |
| The managed blocks in `AGENTS.md` and `.gitattributes`                                                                 | The part between the gspot markers. The rest of each file stays yours.                                                                                                                                                                                      | Yes    |
| Keys in your own files, such as `install.security.scanner` in `bunfig.toml` and tool keys in `package.json`            | Install options. The other keys stay yours.                                                                                                                                                                                                                 | Yes    |
| `.gspot/node_modules/`, `.gspot/.venv/`, `.gspot/vale/`                                                                | Installed tools. The `.gitignore` in `.gspot/` keeps them out of Git.                                                                                                                                                                                       | No     |

The managed block of `AGENTS.md` lists your repository's generated files and the keys gspot sets. Run `gspot install` in each new clone.

The generated-file lists in `.prettierignore`, `.gitattributes`, and `AGENTS.md` include generated link files and the enabled CI workflow.

## Do not edit generated files

Do not edit a generated file. Each one sits in `.gspot/`, starts with a gspot header, or sits in a managed block between
the gspot markers. Files in `.gspot/` carry no header; the managed block of `.gitattributes` marks them generated.

`gspot apply` replaces those files from your settings, even files with
local edits or merge markers. Move any change you need into `gspot.toml` before you apply.

A file outside `.gspot/` that starts with the gspot header belongs to gspot only when gspot writes that path. Any other
file with the header stays yours, and `gspot apply` leaves it in place.

`gspot apply` names each file that it removes. The hooks of Git Large File Storage (LFS) exist only when a file of the
repository uses `filter=lfs`. When you turn off `dependencies.bun_scanner`, its key stays in `bunfig.toml` as yours,
and `gspot apply` says so. The ESLint settings of each configuration sit in its `eslint.mjs`, which the JavaScript configuration imports.

## Dependency bots

gspot updates the files in `.gspot/` when you upgrade gspot. Tell dependency bots to skip that folder;
for Renovate, set `"ignorePaths": [".gspot/**"]`.
