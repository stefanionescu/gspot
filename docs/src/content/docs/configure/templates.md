---
title: Reuse templates
description: Export portable settings and set up another repository from them.
---

A template copies your gspot.toml, without scopes, for use in another repository.

## Export

```shell
gspot export gspot.template.toml
```

A template carries every setting and record that you wrote, including command checks and empty tables, but no defaults. In the destination, the `gspot/unmatched-patterns` check reports carried paths that match no tracked file or folder. Export warns about commands that name local executables.

A template carries the hooks, CI, and rules settings, but no hook scripts, lockfiles, or installed tools.
Export writes to any path except `gspot.toml` and generated files.

## Set up another repository

In the destination repository, read the plan and set up gspot from the template:

```shell
gspot init --from ../gspot.template.toml --dry-run
gspot init --from ../gspot.template.toml --yes
gspot install
gspot check
```

`init` validates the template and writes its settings into the `gspot.toml` of the destination. It records the template source and sha256 in one comment line:

```toml
# Copied from template ../gspot.template.toml, sha256 <SHA256>.
```

`<SHA256>` holds the digest of the copied template. Later edits to the template do not change repositories that used it.

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

Repository B gets the ignore and the configuration choices. Check the carried paths
against the files of repository B, and remove what it does not need.

[Export](/reference/commands/export/) and [init](/reference/commands/init/) list the accepted inputs.
