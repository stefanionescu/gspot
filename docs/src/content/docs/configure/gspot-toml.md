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

A configuration groups the checks, config files, and rules for a language, framework, or concern. Select one, or drop a
language or framework, by name:

```shell
gspot add vitest
gspot remove nextjs
```

`gspot remove nextjs --reason "…"` writes `nextjs` into `removed_configurations` with your reason, so `gspot doctor`
does not suggest it again; `gspot add nextjs` reverses that. gspot does not remove a configuration that another selected configuration needs. When
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

## Start from another repository

Copy the `gspot.toml` of a repository whose setup you want, and the files that its settings name: ESLint plugin
modules, Semgrep rule files, and command check scripts. Delete the `[[scope]]` records of folders that this
repository does not have. Then run `gspot apply` and `gspot install`. `gspot doctor` lists the configurations that
this repository needs, and `gspot check` reports old tool settings files and paths that match nothing.

To share lint rules across repositories, publish them as an ESLint plugin package, install it, and name a module that
re-exports it in `[[tools.eslint.plugins]]`.

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
the shipped list lacks added to an allow-list, such as `dependencies.allowed_registries`. gspot refuses a reason on a
value that loosens nothing.

```shell
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

```toml title="gspot.toml"
[limits]
function_lines = { value = 80, reason = "The parser is one state machine." }
```

`spelling.allowed_words` holds one reason per word. A scope adds its words to the root words:

```shell
gspot set spelling.allowed_words Acmeflow --reason "Our product name."
```

```toml title="gspot.toml"
[spelling]
allowed_words = { Acmeflow = "Our product name.", AGENTS = "File name of the agent rules." }
```

To pass a value that starts with `-`, put `--` before the values:

```shell
gspot set ci.setup_command -- bun install --frozen-lockfile
```

## Accept a banned name

Allow an exact name only when an external contract requires it. Every shipped banned naming group applies at level
`all`. The `roles` group rejects vague job labels such as `helper` and `manager`; `defensive` rejects qualifiers such as
`ensure` and `maybe`; `marketing` rejects claims such as `advanced` and `enhanced`. `naming.banned_words` adds project
words.

For `export const helperCommand = 1;`, `naming/identifiers` reports:

```text
javascript variable "helperCommand": "helper" is banned (roles group).
```

This complete example accepts that exact variable name in one file:

```toml title="gspot.toml"
configurations = ["javascript", "naming"]
level = "all"

[[naming.override]]
paths = ["helper.js"]
categories = ["variables"]
allowed_names = ["helperCommand"]
reason = "An external API requires this exact name."
```

Write override records by hand, then run `gspot apply`. The override removes this `banned-word` finding; other names
keep their checks.

## Edit the file by hand

Records that no command writes, such as `[[scope]]`, `[[command_check]]`, `[[import_rule]]`, `[[naming.override]]`, and
`[[tools.eslint.plugins]]`, take a hand edit. gspot checks a hand edit as it checks a command.

gspot.toml uses TOML 1.0. Keep each inline table on one line. See [Editors](/use/editors/#validate-gspottoml) to
validate it.

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
