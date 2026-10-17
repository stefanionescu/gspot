---
title: gspot.toml
description: Choose configurations and a level, and change settings in gspot.toml.
---

`gspot.toml` holds your configurations, level, settings, and ignores.
Setting commands edit the file and apply each change.

## See the current choices

```shell
gspot list
gspot list settings
```

Add `--json` for complete values and inherited settings.
The [gspot.toml reference](/reference/gspot-toml/) lists accepted values and defaults.

## Choose configurations

```toml
configurations = ["bash"]
level = "recommended"
```

A configuration groups checks, tool files, and rules for a language, framework, or concern.
gspot always selects the general configurations, such as `secrets` and `spelling`, even when you write the list yourself. Run `gspot add <configuration>` to select a configuration,
or `gspot remove <configuration>` to drop a language or framework.

`gspot remove nextjs` writes `nextjs` into `removed_configurations`, so detection does not select it again; `gspot add nextjs` reverses that. gspot does not remove a configuration that another selected configuration needs. When the tools change, gspot prints a reminder to run `gspot install`.
You cannot remove a general configuration. Change the level with `gspot set level`, or turn off one of its checks with an [ignore](/use/ignore/).

Framework lint rules follow your dependencies. For example, a NestJS project that uses `@nestjs/swagger` also gets the Swagger lint rules.

## The level

```shell
gspot set level all
```

[Levels](/start/concepts/#levels) define `recommended` and `all`.
Neither enables experimental or preview lint rules.

## Other ways to write a setting

- `--scope api` writes the setting in the scope `api`.
- `gspot unset <setting>` removes your value and its reason, so the default takes effect again.
- On a list, `gspot set` adds items and `gspot unset <setting> <item...>` removes them.
  To replace a whole list, run `gspot unset <setting>`, then `gspot set <setting> <items...>`.
- A scope's list adds to inherited lists. A command argument list replaces the inherited one as a whole.

A value that loosens a check needs a reason beside it. This covers a raised limit, lowered coverage, and an item added to an allow-list, such as `allowed_words` or `dependencies.allowed_registries`, that the shipped list lacks:

```toml
[limits]
function_lines = { value = 80, reason = "The parser is one state machine." }
```

## Edit the file by hand

gspot.toml uses TOML 1.0. Keep each inline table on one line.
The [JSON Schema](https://generativespotting.com/gspot.schema.json) describes every key. Editors apply it on their own
once SchemaStore lists gspot. Omit schema comments from `gspot.toml`.

After an edit, run `gspot apply` and `gspot install`. `gspot apply --dry-run` previews the changes.

## When files of a language appear or go

When files of a language or framework appear, use `gspot add` to select its configuration, then run `gspot install`. When the files go away, its checks become inactive. Its configurations, settings, ignores, and command checks stay in gspot.toml. `gspot apply` writes generated files from your saved settings and does not change `configurations` or `removed_configurations`.
