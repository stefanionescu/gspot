---
title: Monorepos and scopes
description: Give nested projects their own configurations and settings in one policy file.
---

Use the [source installation guide](/guides/install/) to prepare the CLI. Run the commands below
from the repository root unless a step names another directory.

Start from a repository with nested projects. Initialization reads supported package-manager
workspace declarations and proposes scopes. Review their paths and configurations before accepting.

A complete example policy:

```toml
version = 1
configurations = []

[[scope]]
path = "api"
configurations = ["typescript", "express", "vitest"]

[scope.limits]
function_lines = 80

[[scope]]
path = "ios"
configurations = ["swift", "xcode"]
```

Use the singular `[[scope]]` array table. The `[scope.limits]` table belongs to the preceding
scope, so the example changes the limit for `api`, not `ios`.

## Check a project

```bash
gspot apply
gspot install
gspot check api
```

The deepest containing scope owns a file. Files outside nested scopes belong to the root.
A project-wide check triggered by a path can inspect other files in that project. Generated
configuration lives under `.gspot/<path>/` when the owning tool needs a separate scope file.

`gspot explain <file>` reports the scope and claims. Use `./` for a filename that also names a
configuration or check: `gspot explain bash` explains the configuration, while `gspot explain ./bash`
explains the file.

## Change a scoped setting

```bash
gspot set limits.function_lines 80 --scope api --reason "The parser is one state machine."
```

The command writes the scoped setting and applies policy. Root settings supply defaults;
more specific scope settings override them. Keep scope paths relative to the policy root.
PostgreSQL migration directories are also relative to their scope.
The PostgreSQL configuration supplies the `postgres` SQLFluff dialect. Set `tools.sqlfluff.dialect`
at the root or in a scope to select another dialect. Each scope receives its effective dialect
in its generated SQLFluff configuration, including inherited scope values.
Use the tool's lowercase dialect label, such as `postgres`, `sqlite`, or `duckdb`.
Supabase also defaults `tools.squawk.assume_in_transaction` to `true`. Set it to `false` at the
root or in a scope when that migration runner does not wrap statements in transactions.

Ruff also receives a configuration for each scope. A `pytest` scope enables pytest style rules
at the `recommended` level and allows assertions in its test files. Those allowances do not
apply to sibling projects that do not select `pytest`. Scoped Python limits remain local to
their project.

Spelling configuration and editor copies also follow scope settings. A scope can select its own
locale and append allowed words and excluded paths without changing sibling projects.
Set `tools.typos.locale` to `en`, `en-us`, `en-gb`, `en-ca`, or `en-au`.
The policy file also recognizes the scoped dictionary words it declares.
Paths in `tools.typos.exclude` remain relative to the policy root, including inside scope tables.
Editor configuration translates those patterns to its directory. CLI checks and fixes use only
the generated configuration, so an unowned nested typos file cannot add word allowances.

List settings append values from configurations, the root table, and containing scopes, and remove
repeated values. Scalar settings replace the preceding value. If selected configurations provide
conflicting scalar defaults, the error names both configurations. Set that key in the root table to
settle the conflict for all scopes, or in a containing scope table for that scope and its
descendants.

## Check project resources

Supabase configuration checks read `supabase/config.toml` within each policy scope.
`tools.supabase.functions_directory`, `tools.supabase.admin_key_files`, and
`tools.i18n.translations.directory` are relative to that scope. Locale messages, static-site
headers, and asset references in a child scope do not satisfy checks in its parent scope.
Project-wide checks receive the files owned by their scope, including configuration and binary resources.
Coverage counts only the source kinds declared by each check.
The dead-asset check includes binary files.

With `static-site`, `static-site/svg-optimized` reports SVG savings over 10% at `recommended`
and any byte reduction at `all`. It reads the selected SVG files without rewriting them.
Use `gspot check --only static-site/svg-optimized --fix` to apply optimization through the
isolated fixer workflow. An optimizer execution or parse failure returns status 2.

## Put policy below the Git root

Run from the directory containing that policy or select it explicitly:

```bash
gspot -C api check
```

The closest enclosing `gspot.toml` determines the policy root. Path selectors are relative to
the selected working directory. Inspect `gspot explain <file>` when a file is assigned to an
unexpected scope; do not add duplicate root-wide checks to compensate for a wrong scope path.
