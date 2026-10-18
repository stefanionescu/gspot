---
title: Share settings
description: Export portable settings and set up another repository from them.
---

A template copies your gspot.toml, without scopes, for use in another repository.

## Export

```shell
gspot export gspot.template.toml
```

A template carries every setting and record that you wrote, including command checks and empty tables, but no defaults. In the destination, the `gspot/unmatched-patterns` check reports carried paths that match no tracked file or folder. Export warns when a command check runs a file of this repository directly, such as `./<script>`. It does not warn
when another program takes the file as an argument, as in `node <script>`. Copy those files to the other repository
yourself.

A template carries the `[hooks]`, `[ci]`, and `[rules]` settings that you wrote, but no hook scripts, lockfiles, or
installed tools. When a template leaves one out, `gspot init --from` turns the hooks off, turns CI off, and keeps the
rules on.
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

Then check the carried paths against the files of the new repository. `gspot/unmatched-patterns` reports each path that matches nothing.

[Export](/reference/commands/export/) and [init](/reference/commands/init/) list the accepted inputs.
