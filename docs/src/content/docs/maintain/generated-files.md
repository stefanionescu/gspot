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

Yarn options for the npm tools, when the repository uses Yarn 2 or newer.

</dd>

<dt>

`.gspot/version`

</dt>
<dd>

The gspot version of the repository.

</dd>

<dt>

Pointers

</dt>
<dd>

Files that lead a tool or editor to its tool file, at each scope root that needs one and inside test folders.

</dd>

<dt>

Sections between gspot markers

</dt>
<dd>

In `.gitignore`, `.gitattributes`, and `AGENTS.md`. The rest of each file stays yours.

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

Install options in files such as `bunfig.toml`. The other keys stay yours.

</dd>

</dl>

Pointers include `eslint.config.mjs`, `pyrightconfig.json`, and `ruff.toml`, depending on the selected
configurations. Each scope that uses a tool gets its pointer, for example:

```text
services/api/pyrightconfig.json
Tests/.swiftlint.yml
```

Some tools have no pointer. gspot passes their tool file when it runs them; give your editor the same path.

## What to commit

Commit `gspot.toml`, every file that [What gspot writes](#what-gspot-writes) lists, the pointers, `.editorconfig`, the CI
workflow, and each file with a section between gspot markers.
Editors and coding agents can then use the tool files and rules right after a clone, before `gspot install` runs.
Git does not keep the installed tools or the hooks, so run `gspot install` in each new clone.

The section between gspot markers in `.gitignore` keeps these out of Git: the installed tools in `.gspot/node_modules/` and `.gspot/.venv/`, `.gspot/vale/` when prose checks need it, and installation caches.

## Before you apply

Do not edit a generated file. Each one has a gspot header or sits in a section between gspot markers; gspot finds its
files by these markers and the generated text. `gspot apply` replaces those files from your settings, even files with
local edits or merge markers. Move any change you need into `gspot.toml` before you apply.

gspot updates the files in `.gspot/` when you upgrade gspot. Tell dependency bots to skip that folder;
for Renovate, set `"ignorePaths": [".gspot/**"]`.
