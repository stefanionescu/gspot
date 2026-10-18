---
title: gspot.toml
description: Choose configurations and a level, and change settings in gspot.toml.
---

`gspot.toml` holds your configurations, level, settings, and ignores. Setting commands edit the file and apply each
change.

## See the current choices

```shell
gspot list
gspot list settings
```

Add `--json` for complete values and inherited settings. The [settings reference](/reference/gspot-toml/) lists accepted
values and defaults.

## Choose configurations

A configuration groups the checks, tool files, and rules for a language, framework, or concern. Select one, or drop a
language or framework, by name:

```shell
gspot add vitest
gspot remove nextjs
```

`gspot remove nextjs` writes `nextjs` into `removed_configurations`, so detection does not select it again;
`gspot add nextjs` reverses that. gspot does not remove a configuration that another selected configuration needs. When
the tools change, gspot prints a reminder to run `gspot install`.

gspot always selects most general configurations, such as `secrets`, `spelling`, and `security`, even when you write the
list yourself, and `gspot add` and `gspot remove` refuse them. To run fewer of their checks, change the level, or turn
one check off with an [ignore](/use/ignore/).

In the file, the selection reads:

```toml title="gspot.toml"
configurations = ["bash"]
level = "recommended"
```

Framework lint rules follow your dependencies. For example, a NestJS project that uses `@nestjs/swagger` also gets the
Swagger lint rules.

## The level

```shell
gspot set level all
```

[Levels](/start/concepts/#levels) define `recommended` and `all`. Neither enables experimental or preview lint rules.

## Change a setting

| Command                           | What it does                                                          |
| --------------------------------- | --------------------------------------------------------------------- |
| `gspot set <setting> <value>`     | Writes your value. On a list, it adds items to the shipped ones.      |
| `gspot unset <setting>`           | Removes your value and its reason, so the default takes effect again. |
| `gspot unset <setting> <item...>` | Removes list items that you wrote. The shipped items stay.            |

To change a setting in one folder only, see [Settings in a scope](/configure/monorepos/#settings-in-a-scope).

A value that loosens a check needs a reason beside it. This covers a raised limit, lowered coverage, and an item that
the shipped list lacks added to an allow-list, such as `allowed_words` or `dependencies.allowed_registries`:

```toml title="gspot.toml"
[limits]
function_lines = { value = 80, reason = "The parser is one state machine." }
```

## Edit the file by hand

gspot.toml uses TOML 1.0. Keep each inline table on one line. The
[JSON Schema](https://generativespotting.com/gspot.schema.json) describes every key. Editors apply it on their own once
SchemaStore lists gspot, so `gspot.toml` needs no `#:schema` comment. See [Editors](/use/editors/).

After an edit, preview the changes, then write them and install the tools:

```shell
gspot apply --dry-run
gspot apply
gspot install
```

## When files of a language appear or go

When files of a language or framework appear, select its configuration with `gspot add`, then run `gspot install`.

When the files go away, its checks become inactive. Its configurations, settings, ignores, and command checks stay in
gspot.toml. `gspot apply` writes generated files from your saved settings and does not change `configurations` or
`removed_configurations`.
