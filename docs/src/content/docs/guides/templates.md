---
title: Reuse templates
description: Export portable policy and initialize another repository from it.
---

A template is an exported setup another repository can reuse. It carries authored configuration choices, settings, command checks, paths, ignores, declarations, and integrations.

## Export

```shell
gspot export team.template.toml
```

A template carries every `gspot.toml` entry except scopes, including command checks. Empty authored tables stay in the export. It copies authored values without adding defaults. The destination's `gspot/unmatched-paths` check reports carried paths that match no tracked file or folder. Review path choices for the destination; commands that name local executables produce a warning.

A template carries hooks, CI, agent-rule, and runner settings, but no generated hook scripts, lockfiles, or installed tools. `hooks.enabled` controls hook setup.

Export writes these template fields:

```toml
template = "team"
selection = "exact"
configurations = ["typescript", "markdown"]
```

`exact` keeps the template's language and framework choices during initialization. Change
`selection` to `detect` to add project configurations detected in the destination. Both
selections include automatic general checks at the chosen level. An empty exact list omits
language and framework choices; it still includes general checks. Template configurations stay selected even when no files match them. Use `gspot remove`
to drop a language or framework choice.

Export can write outside the repository atomically. It refuses the policy file and managed output destinations. Use `gspot export team.template.toml --dry-run` to print the template without writing it.

## Initialize another repository

In a clean destination repository, preview and initialize from the template:

```shell title="Use a local team template"
gspot init --from ../team.template.toml --dry-run --yes
gspot init --from ../team.template.toml --yes
gspot doctor
gspot check
```

`init` validates the template and writes its policy into the destination's `gspot.toml`. It records the template name and sha256 in one comment line, rather than a `template` key:

```toml
# Copied from template team, sha256 <SHA256>.
```

`<SHA256>` is the digest of the copied template. Init does not keep a live connection to the source. Editing the source template later leaves existing consumers unchanged.

Local paths, HTTPS URLs, and `github:owner/repository[/path][@ref]` are supported. A GitHub source without a path reads `gspot.template.toml`. Set `GITHUB_TOKEN` for a private GitHub source.

## Customize and reuse

In repository A, record an accepted ESLint finding and export its policy:

```shell title="Repository A"
gspot ignore javascript/eslint --rule no-console --paths 'scripts/**' --reason 'These scripts print command output.'
gspot export team.template.toml
```

Copy `team.template.toml` to a clean repository B, then initialize it:

```shell title="Repository B"
gspot init --from team.template.toml --yes
```

The copied policy keeps the reviewed ignore and configuration choices. Check carried paths
against repository B's files and remove choices that repository B does not need.
