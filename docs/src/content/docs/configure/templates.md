---
title: Reuse templates
description: Export portable settings and set up another repository from them.
---

A template copies your gspot.toml, without scopes, for use in another repository.

## Export

```shell
gspot export gspot.template.toml
```

A template carries every `gspot.toml` entry except scopes, including command checks. Empty tables you wrote stay in the export. It copies only what you wrote, not the defaults. The destination's `gspot/unmatched-patterns` check reports carried paths that match no tracked file or folder. Review path choices for the destination. Commands that name local executables produce a warning.

A template carries the hooks, CI, and rules settings, but no hook scripts, lockfiles, or installed tools.
Export can write anywhere, but not over `gspot.toml` or a file gspot generates.

## Set up another repository

In the destination repository, read the plan and set up gspot from the template:

```shell
gspot init --from ../gspot.template.toml --dry-run
gspot init --from ../gspot.template.toml --yes
gspot install
gspot check
```

`init` validates the template and writes its settings into the destination's `gspot.toml`. It records the template source and sha256 in one comment line, rather than a `template` key:

```toml
# Copied from template ../gspot.template.toml, sha256 <SHA256>.
```

`<SHA256>` contains the digest of the copied template. Init does not keep a live connection to the source. Later edits to the template do not change repositories that used it.

Use local paths, HTTPS URLs, or `github:owner/repository[/path][@ref]`. A GitHub source without a path reads `gspot.template.toml`. Set `GITHUB_TOKEN` for a private GitHub source.

## Customize and reuse

In repository A, ignore an ESLint finding and export its settings:

```shell
gspot ignore javascript/eslint --rule no-console --paths 'scripts/**' --reason 'These scripts print command output.'
gspot export gspot.template.toml
```

Copy `gspot.template.toml` to repository B, then set up gspot:

```shell
gspot init --from gspot.template.toml --yes
gspot install
gspot check
```

The copied settings keep the reviewed ignore and configuration choices. Check carried paths
against repository B's files and remove choices that repository B does not need.

[Export](/reference/commands/export/) and [init](/reference/commands/init/) lists the accepted inputs.
