---
title: Generated files
description: Which files gspot writes, which to commit, and which to leave alone.
---

You edit one file, `gspot.toml`. gspot writes the rest from it. After you change the policy,
run `gspot apply` to write them again.

## What gspot writes

| Path                             | What it holds                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `.gspot/config/`                 | The configuration of every tool. A scope gets its own folder under it.                     |
| `.gspot/guides/`                 | The guides for coding agents.                                                              |
| `.gspot/package.json` and lock   | The npm tools gspot installs, at pinned versions.                                          |
| `.gspot/pyproject.toml` and lock | The Python tools gspot installs, at pinned versions.                                       |
| `.gspot/version`                 | The gspot version of the repository.                                                       |
| Files at the repository root     | Pointers for editors and tools that look for their configuration at the root.              |
| Managed blocks                   | Blocks in `.gitignore`, `.gitattributes`, and `AGENTS.md`. The rest of each file is yours. |
| Keys in shared files             | Install settings in files such as `bunfig.toml`. The other keys stay yours.                |

The root files are `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`,
`.stylelintrc.json`, `.editorconfig`, `.semgrepignore`, `pyrightconfig.json`, and
`.swiftlint.yml`, depending on your kits. Most point at the file under `.gspot/config/`. The
other tools get their configuration path from gspot. To use such a tool in your editor, point
the editor at the file under `.gspot/config/`.

Do not edit a generated file. Change `gspot.toml`, then run `gspot apply`. If you do edit a
generated file, `apply` keeps your edit and names the file, so you can move the change into the
policy.

## What to commit

Commit `gspot.toml`, everything gspot writes under `.gspot/config/` and `.gspot/guides/`, the
private manifests and locks at the root of `.gspot/`, the root files, and the managed blocks.
After a teammate clones the repository, `gspot install` installs the locked tools and the hooks.

The managed block in `.gitignore` keeps these out of Git: the installed tools, the downloaded
style packages, and `.gspot/state/`.

## What to keep

`.gspot/state/` holds the record of what gspot wrote. Without it, gspot cannot tell your edits
from its own files. Do not delete the whole `.gspot/` folder to clean up.
