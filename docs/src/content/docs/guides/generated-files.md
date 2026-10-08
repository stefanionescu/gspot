---
title: Generated files
description: Which files gspot writes, which to commit, and which to leave alone.
---

You customize gspot in `gspot.toml`. gspot writes its managed configuration from that policy; application configuration remains authored. After you change the policy,
run `gspot apply` to write them again.

## What gspot writes

| Path                                 | What it holds                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `.gspot/config/`                     | The configuration of every tool. A scope gets its own folder under it.                     |
| `.gspot/rules/`                      | The rules for coding agents.                                                               |
| `.gspot/package.json` and lockfile   | The npm tools gspot installs, at pinned versions.                                          |
| `.gspot/pyproject.toml` and lockfile | The Python tools gspot installs, at pinned versions.                                       |
| `.gspot/version`                     | The gspot version of the repository.                                                       |
| Pointer files                        | Configuration pointers at each applicable scope root and inside test folders.              |
| Managed blocks                       | Blocks in `.gitignore`, `.gitattributes`, and `AGENTS.md`. The rest of each file is yours. |
| `.gspot/hooks/`                      | The three Git hook scripts.                                                                |
| `.mise/conf.d/gspot-tools.toml`      | The mise pins, when mise is selected.                                                      |
| GitHub or GitLab workflow            | The selected CI job.                                                                       |
| `.swiftlint.yml` inside test folders | Swift test overrides, when applicable.                                                     |
| Keys in shared files                 | Install settings in files such as `bunfig.toml`. The other keys stay yours.                |

Pointers include `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`,
`.stylelintrc.json`, `.editorconfig`, `.semgrepignore`, `pyrightconfig.json`,
`.swiftlint.yml`, `.markdownlint-cli2.mjs`, and `ruff.toml`, depending on the selected
configurations. Each scope that uses a tool gets its pointer. Python service
scopes and Swift test folders can have pointers at these example paths:

```text title="Pointer file examples"
services/api/pyrightconfig.json
Tests/.swiftlint.yml
```

Most point to a configuration under `.gspot/config/`. For other tools, point your editor at the
configuration under `.gspot/config/`; gspot supplies that path when it runs them.

Do not edit a generated file. Change `gspot.toml`, then run `gspot apply`. If you do edit a
generated file, `apply` keeps your edit and names the file, so you can move the change into the
policy.

## What to commit

Commit `gspot.toml`, everything gspot writes under `.gspot/config/` and `.gspot/rules/`, the
applicable `.gspot/package.json` and its manager lockfile, `.gspot/pyproject.toml`, `.gspot/uv.lock`, `.gspot/version`, and `.gspot/hooks/`, the root files, and the managed blocks.
After a teammate clones the repository, `gspot install` installs the locked tools and the hooks.

The managed block in `.gitignore` keeps these out of Git: the installed tools (`.gspot/node_modules/` and `.gspot/.venv/`), Vale style packages when prose checks need them, and `.gspot/state/`.

## What to keep

`.gspot/state/` holds the record of what gspot wrote. Without it, gspot cannot tell your edits
from its own files. Do not delete the whole `.gspot/` folder to clean up.

A fresh clone has no local ownership record. gspot compares tracked generated files with the planned output before recording ownership; differing files remain conflicts. Run `gspot install` to prepare tools and hooks in the clone.
