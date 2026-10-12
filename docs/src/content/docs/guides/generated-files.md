---
title: Generated files
description: Which files gspot writes, which to commit, and which to leave alone.
---

You customize gspot in `gspot.toml`. gspot writes its generated files from `gspot.toml`. Your app's own settings stay yours. After you change the file,
run `gspot apply` to write them again.

## What gspot writes

| Path                                 | What it holds                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `.gspot/config/`                     | The tool files. A scope gets its own folder under it.                                      |
| `.gspot/rules/`                      | The rules.                                                                                 |
| `.gspot/package.json` and lockfile   | The npm tools gspot installs, at pinned versions.                                          |
| `.gspot/pyproject.toml` and lockfile | The Python tools gspot installs, at pinned versions.                                       |
| `.gspot/.yarnrc.yml`                 | Yarn settings for the npm tools, when the repository uses Yarn 2 or newer.                 |
| `.gspot/version`                     | The gspot version of the repository.                                                       |
| Pointer files                        | Tool file pointers at each scope root that needs one and inside test folders.              |
| Managed blocks                       | Blocks in `.gitignore`, `.gitattributes`, and `AGENTS.md`. The rest of each file is yours. |
| `.gspot/hooks/`                      | The three Git hook scripts.                                                                |
| `.gspot/mise.toml`                   | The program tools gspot installs with mise.                                                |
| GitHub or GitLab workflow            | The selected CI job.                                                                       |
| `.swiftlint.yml` inside test folders | Swift test overrides, when needed.                                                         |
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

Some tools have no pointer. gspot passes them their tool file when it runs them; give your editor the same path.

Do not edit a generated file. Change `gspot.toml`, then run `gspot apply`. If you edit a generated file, `gspot apply` keeps your edit and names the file. Move the change into `gspot.toml`, delete the edited file, and run `gspot apply`.

## What to commit

Commit `gspot.toml`, everything gspot writes under `.gspot/config/` and `.gspot/rules/`, the
needed `.gspot/package.json` and its manager lockfile, `.gspot/pyproject.toml`, `.gspot/uv.lock`, `.gspot/version`, `.gspot/mise.toml`, `.gspot/.yarnrc.yml`, and `.gspot/hooks/`, the pointers, and the managed blocks.
Commit the tool files and rules so editors and coding agents can use them immediately after a clone, before `gspot install` runs.
After a teammate clones the repository, `gspot install` installs the locked tools and the hooks.

The managed block in `.gitignore` keeps these out of Git: the installed tools in `.gspot/node_modules/` and `.gspot/.venv/`, `.gspot/vale/` when prose checks need it, and `.gspot/state/`.

## What to keep

`.gspot/state/` records which files gspot wrote, so it can tell them from your edits. Do not delete the `.gspot/` folder to clean up. In a fresh clone, gspot checks that each generated file matches its generated output; if one differs, gspot preserves the file. It reports the difference. Run `gspot install` to prepare tools and hooks in the clone.

gspot also generates the pointers and `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml` outside `.gspot/`.
Do not hand-edit them.

gspot updates the files in `.gspot/` when you upgrade gspot. Tell dependency bots to skip that folder,
for Renovate: `"ignorePaths": [".gspot/**"]`.
