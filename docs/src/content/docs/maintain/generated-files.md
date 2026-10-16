---
title: Generated files
description: Which files gspot writes, which to commit, and which to leave alone.
---

Change `gspot.toml`, then run `gspot apply`; gspot writes every generated file from it.

## What gspot writes

<dl>

<dt>

`.gspot/config/`

</dt>
<dd>

The tool files, grouped by tool. Scopes share identical files.

</dd>

<dt>

`.gspot/rules/`

</dt>
<dd>

The rules.

</dd>

<dt>

`.gspot/package.json` and lockfile

</dt>
<dd>

The npm tools gspot installs, at pinned versions.

</dd>

<dt>

`.gspot/pyproject.toml` and lockfile

</dt>
<dd>

The Python tools gspot installs, at pinned versions.

</dd>

<dt>

`.gspot/.yarnrc.yml`

</dt>
<dd>

Yarn settings for the npm tools, when the repository uses Yarn 2 or newer.

</dd>

<dt>

`.gspot/version`

</dt>
<dd>

The gspot version of the repository.

</dd>

<dt>

Tool file entry points

</dt>
<dd>

Tool file entry points at each scope root that needs one and inside test folders.

</dd>

<dt>

Sections between gspot markers

</dt>
<dd>

Blocks in `.gitignore`, `.gitattributes`, and `AGENTS.md`. You own the rest of each file.

</dd>

<dt>

`.gspot/hooks/`

</dt>
<dd>

The three Git hook scripts.

</dd>

<dt>

`.gspot/mise.toml`

</dt>
<dd>

The program tools gspot installs with mise.

</dd>

<dt>

GitHub or GitLab workflow

</dt>
<dd>

The selected CI job.

</dd>

<dt>

`.swiftlint.yml` inside test folders

</dt>
<dd>

Swift test overrides, when needed.

</dd>

<dt>

Keys in shared files

</dt>
<dd>

Install settings in files such as `bunfig.toml`. The other keys stay yours.

</dd>

</dl>

Tool file entry points include `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`,
`.stylelintrc.json`, `.editorconfig`, `.semgrepignore`, `pyrightconfig.json`,
`.swiftlint.yml`, `.markdownlint-cli2.mjs`, and `ruff.toml`, depending on the selected
configurations. Each scope that uses a tool gets its tool file entry point. Python service
scopes and Swift test folders can have tool file entry points at these example paths:

```text
services/api/pyrightconfig.json
Tests/.swiftlint.yml
```

Some tools have no tool file entry point. gspot passes them their tool file when it runs them; give your editor the same path.

Do not edit a generated file. Change `gspot.toml`, then run `gspot apply`. It replaces owned files from your settings. Files with local edits or merge markers also receive the generated content. Move any change you need into `gspot.toml` before you apply.

## What to commit

Commit `gspot.toml`, everything gspot writes under `.gspot/config/` and `.gspot/rules/`, the
needed `.gspot/package.json` and its manager lockfile, `.gspot/pyproject.toml`, `.gspot/uv.lock`, `.gspot/version`, `.gspot/mise.toml`, `.gspot/.yarnrc.yml`, and `.gspot/hooks/`, the tool file entry points, and the sections between gspot markers.
Commit the tool files and rules so editors and coding agents can use them immediately after a clone, before `gspot install` runs.
After a teammate clones the repository, `gspot install` installs the locked tools and the hooks.

The section between gspot markers in `.gitignore` keeps these out of Git: the installed tools in `.gspot/node_modules/` and `.gspot/.venv/`, `.gspot/vale/` when prose checks need it, and installation caches.

## Before you apply

Generated files have a gspot header or appear in the sections between gspot markers. gspot uses these markers and
the generated text to identify its files. `gspot apply` replaces those files from your settings.
Review local edits and move any change you need into `gspot.toml` before you apply.

gspot also generates the tool file entry points and `.github/workflows/gspot.yml` or `.gitlab/ci/gspot.yml` outside `.gspot/`.
Do not hand-edit them.

gspot updates the files in `.gspot/` when you upgrade gspot. Tell dependency bots to skip that folder,
for Renovate: `"ignorePaths": [".gspot/**"]`.
