---
title: Generated files
description: Which files gspot writes, which to commit, and which to leave alone.
---

Change `gspot.toml`, then run `gspot apply`; gspot writes every generated file from it.

## What gspot writes

| Path                                                                                                                 | What it holds                                                                                                                                                                                                 | Commit |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `gspot.toml`                                                                                                         | Your settings.                                                                                                                                                                                                | Yes    |
| `.gspot/configurations/<group>/<configuration>/`                                                                     | The tool files of each configuration, named after their tool, such as `.gspot/configurations/language/javascript/eslint.mjs`. A scope that needs other text gets `scopes/<scope path>/<file>` in that folder. | Yes    |
| `.gspot/configurations/<group>/<configuration>/rules/`                                                               | The rules for coding agents.                                                                                                                                                                                  | Yes    |
| `.gspot/package.json` and its lockfile                                                                               | The npm tools.                                                                                                                                                                                                | Yes    |
| `.gspot/pyproject.toml` and `.gspot/uv.lock`                                                                         | The Python tools.                                                                                                                                                                                             | Yes    |
| `.gspot/mise.toml`                                                                                                   | The programs that mise installs.                                                                                                                                                                              | Yes    |
| `.gspot/.yarnrc.yml`                                                                                                 | Yarn options, with Yarn 2 or newer.                                                                                                                                                                           | Yes    |
| `.gspot/hooks/`                                                                                                      | The Git hook scripts.                                                                                                                                                                                         | Yes    |
| `.gspot/version`                                                                                                     | The pinned gspot version.                                                                                                                                                                                     | Yes    |
| Pointers, such as `eslint.config.mjs`, `ruff.toml`, `pyrightconfig.json`, and `.swiftlint.yml` in Swift test folders | Files that lead a tool or editor to its tool file, at each scope root that needs one and inside test folders.                                                                                                 | Yes    |
| `.editorconfig` and `.prettierignore`                                                                                | Editor settings and the files the formatter skips.                                                                                                                                                            | Yes    |
| `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml`                                                              | The CI job.                                                                                                                                                                                                   | Yes    |
| The managed blocks in `AGENTS.md`, `.gitignore`, and `.gitattributes`                                                | The part between the gspot markers. The rest of each file stays yours.                                                                                                                                        | Yes    |
| Keys in your own files, such as `install.security.scanner` in `bunfig.toml` and tool keys in `package.json`          | Install options. The other keys stay yours.                                                                                                                                                                   | Yes    |
| `.gspot/node_modules/`, `.gspot/.venv/`, `.gspot/vale/`, `.gspot/state/`, `.gspot/.yarnrc-install.yml`               | Installed tools, run state, and install settings. `.gitignore` keeps them out of Git.                                                                                                                         | No     |

The managed block of `AGENTS.md` lists your repository's generated files and the keys gspot sets. Run `gspot install` in each new clone.

## Do not edit generated files

Do not edit a generated file. Each one sits in `.gspot/`, starts with a gspot header, or sits in a managed block between
the gspot markers. JSON files carry no header; the managed block of `.gitattributes` marks them generated.

`gspot apply` replaces those files from your settings, even files with
local edits or merge markers. Move any change you need into `gspot.toml` before you apply.

## Dependency bots

gspot updates the files in `.gspot/` when you upgrade gspot. Tell dependency bots to skip that folder;
for Renovate, set `"ignorePaths": [".gspot/**"]`.
