---
title: Reuse templates
description: Export portable policy and initialize another repository from it.
---

A template is an exported setup another repository can reuse. It carries configuration choices, the level, settings, and integration choices.

## Export

```shell
gspot export team.gspot.template.toml
```

The export reports every omitted item. It omits scopes, custom executable checks, installed dependencies, and the `generated`, `vendored`, and `exclude` lists. Entries that name repository paths also stay behind. Explicitly authored empty tables remain, because an empty integration table can enable that integration.

A template carries hooks, CI, agent-rule, and runner settings, but no generated hook scripts, locks, or installed tools. A template without `[hooks]` sets up no hooks.

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

## Initialize another repository

In a clean destination repository, preview and initialize from the template:

```shell
gspot init --from ../team.gspot.template.toml --dry-run --yes
gspot init --from ../team.gspot.template.toml --yes
gspot doctor
gspot check
```

`init` validates the template and writes its policy into the destination's `gspot.toml`. It does not keep a live connection to the source. Editing the source template later leaves existing consumers unchanged.

Local paths, HTTPS URLs, and `github:owner/repository[/path][@ref]` are supported. A GitHub source without a path reads `gspot.template.toml`.

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
active if that stack returns. Review the second export's omission report before sharing it.
