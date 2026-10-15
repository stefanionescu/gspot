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
gspot selects its general configurations such as secrets and spelling by itself, even when you write the list yourself. Use `gspot add <configuration>` to select a configuration,
or `gspot remove <configuration>` to remove a language or framework configuration.

`gspot remove nextjs` writes `nextjs` into `removed_configurations`, so detection does not add it back; `gspot add nextjs` brings it back. gspot refuses to remove a configuration that another selected configuration needs. When the tools change, gspot prints a reminder to run `gspot install`.
You cannot remove a general configuration such as `secrets`. Change the level with `gspot set level`, or turn off one of its checks with an [ignore](/guides/exclude/#ignore-a-finding).

Framework lint rules follow your dependencies. For example, a NestJS project that uses `@nestjs/swagger` also gets the Swagger lint rules.

## The level

```shell
gspot set level all
```

[Levels](/guides/overview/#levels) define `recommended` and `all`.
Neither enables experimental or preview lint rules.

## Change a limit

```shell
gspot set limits.function_lines 80 --reason "The parser is one state machine."
gspot set limits.min_function_statements 1 --reason "Our event handlers are one line by design."
```

A change that loosens a check needs a reason. A change that tightens it does not.
gspot checks structure in TypeScript, JavaScript, Python, Swift, Bash, and SQL.
You can set one language's limit, for example `limits.python.min_function_statements`.

## Other ways to write a setting

- `--scope api` writes the setting in the scope `api`.
- `gspot unset <setting>` removes your value and its reason, so the default applies again.
- On a list, `gspot set` adds items and `gspot unset <setting> <item...>` removes them.
  To replace a whole list, run `gspot unset <setting>`, then `gspot set <setting> <items...>`.
- A scope's list adds to inherited lists. A command argument list replaces the inherited one as a whole.

A value that loosens a check needs a reason beside the value. This covers a raised limit, lowered coverage, and an item added to an allow-list, such as `allowed_words` or `dependencies.allowed_registries`, that the shipped list lacks:

```toml
[limits]
function_lines = { value = 80, reason = "The parser is one state machine." }
```

Lockfile downloads use `registry.npmjs.org` and `registry.yarnpkg.com` by default.
Add another reviewed host with `gspot set dependencies.allowed_registries <HOST> --reason "<WHY>"`.
Replace the placeholders with the host and your reason. Downloads must still use HTTPS. A host allowed in a scope applies to that folder and the folders inside it.

## Edit the file by hand

gspot.toml uses TOML 1.0. Keep each inline table on one line.
The editor schema uses your pinned version:

```toml
#:schema https://unpkg.com/@gspothq/cli@<version>/gspot.schema.json
```

Replace `<version>` with the version pinned in `package.json` or `mise.toml`.

After an edit, run `gspot apply` and `gspot install`. `gspot apply --dry-run` previews the changes.

## When files of a language appear or go

When files of a language or framework appear or go away, run `gspot apply`, then `gspot install`. `apply` adds a detected configuration when its files appear. When the files go away, its checks become inactive; its configurations, settings, ignores, and command checks stay in gspot.toml. It never undoes your own `gspot add` or `gspot remove`; those stay in `configurations` and `removed_configurations`.
