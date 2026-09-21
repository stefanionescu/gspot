---
title: Monorepos and scopes
description: Give nested projects their own presets and settings in one policy file.
---

Start from a repository with nested projects. Initialization reads supported package-manager
workspace declarations and proposes scopes. Review their paths and presets before accepting.

A complete example policy:

```toml
version = 1
presets = []

[[scope]]
path = "api"
presets = ["typescript", "express", "vitest"]

[scope.limits]
function_lines = 80

[[scope]]
path = "ios"
presets = ["swift", "xcode"]
```

Use the singular `[[scope]]` array table. The `[scope.limits]` table belongs to the preceding
scope, so the example changes the limit for `api`, not `ios`.

## Check a project

```bash
gspot apply
gspot check api
```

The deepest containing scope owns a file. Files outside nested scopes belong to the root.
A project-wide check triggered by a path can inspect other files in that project. Generated
configuration lives under `.gspot/<path>/` when the owning tool needs a separate scope file.

`gspot explain <file>` reports the scope and claims. Use `./` for a filename that also names a
preset or check: `gspot explain bash` explains the preset, while `gspot explain ./bash`
explains the file.

## Change a scoped setting

```bash
gspot set limits.function_lines 80 --scope api --reason "The parser is one state machine."
```

The command writes the scoped setting and applies policy. Root settings supply defaults;
more specific scope settings override them. Keep scope paths relative to the policy root.
PostgreSQL migration directories are also relative to their scope.

## Put policy below the Git root

Run from the directory containing that policy or select it explicitly:

```bash
gspot -C api check
```

The closest enclosing `gspot.toml` determines the policy root. Path selectors are relative to
the selected working directory. Inspect `gspot explain <file>` when a file is assigned to an
unexpected scope; do not add duplicate root-wide checks to compensate for a wrong scope path.
