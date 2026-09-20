---
title: Monorepos and scopes
description: One gspot.toml for the whole repository, with a scope per package.
sidebar:
    order: 4
---

A scope is a folder with its own presets: an API in `api/`, an iOS app in `ios/`, a package under
`packages/`. `init` reads the workspaces of the package manager and proposes one scope per
package; `gspot.toml` holds them all.

```toml
[[scopes]]
path = "api"
presets = ["typescript", "express", "vitest"]

[[scopes]]
path = "ios"
presets = ["swift", "xcode"]
```

## What a scope changes

- The checks of its presets run over its files, with the generated configuration written under
  `.gspot/<path>/` when a tool needs one per scope.
- A file belongs to the nearest scope; a file outside every scope belongs to the root.
- `gspot check api` selects files and project checks under `api`. `gspot explain <file>` says which scope claims a file and
  why.

Use `./` to select a file whose name also identifies a check, preset, or setting.
For example, `gspot explain bash` explains the preset, and `gspot explain ./bash` explains the file.

## Settings per scope

A scope table overrides the root for its files:

```toml
[scopes.api.limits]
function_lines = 80
```

`gspot set --scope api limits.function_lines 80 --reason "..."` writes the same line.
