---
title: Reuse templates
description: Export portable policy and initialize another repository from it.
---

A template is an exported setup another repository can reuse. It carries authored configuration choices, settings, command checks, paths, ignores, declarations, and integrations.

## Export

```shell
gspot export team.gspot.template.toml
```

Export omits scopes and keeps every other authored policy entry, including empty tables. It copies authored values without adding defaults. Review path choices for the destination; commands that name local executables produce a warning.

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
language and framework choices; it still includes general checks. Later `apply` reconciles
repository changes and retains manual language and framework overrides.

Export can write outside the repository atomically. It refuses the policy file and managed output destinations. Use `gspot export team.gspot.template.toml --dry-run` to print the template without writing it.

## Initialize another repository

In a clean destination repository, preview and initialize from the template:

```shell title="Use a local team template"
gspot init --from ../team.gspot.template.toml --dry-run --yes
gspot init --from ../team.gspot.template.toml --yes
gspot doctor
gspot check
```

`init` validates the template and writes its policy into the destination's `gspot.toml`. It does not keep a live connection to the source. Editing the source template later leaves existing consumers unchanged.

Local paths, HTTPS URLs, and `github:owner/repository[/path][@ref]` are supported. A GitHub source without a path reads `gspot.template.toml`. Set `GITHUB_TOKEN` for a private GitHub source.

## Reconcile and export again

For example, export a TypeScript repository's portable conventions, initialize a Python repository with `selection = "detect"`, then run:

```shell
gspot apply --dry-run
gspot apply
gspot install
gspot export python.gspot.template.toml
```

`apply` updates automatically detected configurations when their evidence changes. It keeps
manual language and framework choices from the template. Saved stack-specific settings become
active if that stack returns. Review the second export before sharing it.
