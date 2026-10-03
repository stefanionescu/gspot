---
title: Monorepos
description: Give each project in a repository its own kits and settings, in one policy file.
---

A scope is one project inside your repository. It has its own kits and settings. `gspot init`
reads the workspaces your package manager declares and proposes a scope for each. Check their
paths and kits in the plan before you accept.

## Declare scopes

This policy has a root with no kits and two scopes:

```toml
kits = []

[[scope]]
path = "api"
kits = ["typescript", "express", "vitest"]

[scope.limits]
function_lines = 80

[[scope]]
path = "ios"
kits = ["swift", "xcode"]
```

Write `[[scope]]` once for each scope. A table such as `[scope.limits]` belongs to the scope
above it, so the limit in this example applies to `api` only.

After you change the scopes, apply the policy, install the tools, and check one project:

```bash
gspot apply
gspot install
gspot check api
```

## Which scope owns a file

The deepest scope that contains a file owns it. Files outside every scope belong to the root.
A whole-project check, such as a type check, can read other files of the same project when you
name one file.

To see the scope and the checks of a file, run `gspot explain` with the path. Start the path
with `./` when it also names a kit or a check: `gspot explain bash` explains the kit, and
`gspot explain ./bash` explains the file.

When a tool needs its own configuration per scope, gspot writes it under
`.gspot/config/<path>/`.

## Settings in a scope

```bash
gspot set limits.function_lines 80 --scope api --reason "The parser is one state machine."
```

Root settings apply to every scope. A setting in a scope replaces the root value for that scope
and the scopes inside it. Paths in scope settings are relative to the root of the policy.

A list setting adds up: a scope gets the values of its kits, the root, and every scope around
it, without repeats. A single-value setting takes the nearest value. If two selected kits give
different defaults for the same setting, gspot names both kits. To decide, set the value at the
root or in a scope.

## Files a scope reads

Each kit sets the defaults its tools need, such as the SQL dialect of the `postgres` kit, and a
scope can set its own value for any of them. Checks that read project files look inside the scope
only: Supabase reads `supabase/config.toml` in each scope, and the settings
`tools.supabase.functions_directory`, `tools.supabase.admin_key_files`, and the `directory` of
`tools.i18n.locales` are relative to the scope. Locale messages and site files in a child scope do
not count for the parent scope.

## A policy below the Git root

The nearest `gspot.toml` above the current folder is the policy. To use a policy in a subfolder
from anywhere, pass `-C`:

```bash
gspot -C api check
```

Paths you name on the command line are relative to the folder `-C` selects. When a file lands
in the wrong scope, check its path with `gspot explain` and fix the scope path.
