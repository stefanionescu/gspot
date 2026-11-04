---
title: Change settings
description: Change gspot.toml with commands, and learn which changes need a reason.
---

`gspot.toml` holds your configurations, your level, your settings, and your ignores. gspot writes every generated file
from it. To change how a tool runs, change `gspot.toml`, not the config file of the tool. Each command on this page
edits `gspot.toml` and then writes the generated files again. The commands keep your comments and the order of your
settings.

A raised limit, a removed configuration, and any other change that makes a check less strict need a reason.
[Changes that weaken the checks](/use/ignore/#changes-that-weaken-the-checks) shows how gspot finds such changes.

## See the current settings

```shell
gspot list
gspot list settings
gspot explain limits.max_file_lines
```

`gspot list` prints the configurations in use and the state of each check. `gspot list settings` prints every setting
and where its value comes from. `gspot explain <setting>` prints one setting, its default, and the command that changes
it. Add `--json` for the full values. The [settings reference](/reference/gspot-toml/) lists every key.

## Add or remove a configuration

A configuration holds the checks, the tool configs, and the rules for coding agents of one language, framework, or
topic. To turn one on or off, give its name:

```shell
gspot add vitest
gspot remove nextjs --reason "The app no longer uses Next.js."
```

`gspot remove` saves the configuration name and your reason under `removed_configurations`, so gspot stops suggesting
that configuration. `gspot add nextjs` undoes the removal. gspot refuses to remove a configuration that another
configuration in use needs. It also refuses to add or remove the [configurations that are on in every
repository](/reference/configurations/#always-selected). For those, change the level, or ignore a check instead. When
the configurations need new tools, run `gspot install`.

In `gspot.toml`, the configurations and the level look like this:

```toml title="gspot.toml"
configurations = ["bash"]
level = "basic"
```

Some lint rules of a framework turn on only when your project has a matching dependency. For example, a NestJS project
that uses `@nestjs/swagger` also gets the Swagger lint rules.

## When files of a language appear or go

When you add files of a language or framework that no configuration in use covers, the check
`gspot/detected-configurations` fails:

```text
gspot.toml:1  detected-configuration  No check reads bash (1 .sh file). Run gspot add bash, or gspot remove bash --reason "<why>".
```

Run the `gspot add` command that it prints, then `gspot install`. The check does not suggest the configurations in
`removed_configurations`.

When you delete all the files of a configuration, its checks find no files, and gspot skips them. The configuration,
its settings, its ignores, and its command checks stay in `gspot.toml`.

## Change a setting

| Command                           | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `gspot set <setting> <value...>`  | Writes your value in place of the default.                       |
| `gspot unset <setting>`           | Removes your value and its reason, so the default applies again. |
| `gspot unset <setting> <item...>` | Removes items from a list, or keys from a table.                 |

`gspot set` replaces a whole list, so give every value that the list must hold. For example,
`dependencies.allowed_registries` holds `registry.npmjs.org` and `registry.yarnpkg.com` by default. To add a mirror,
name all three hosts:

```shell
gspot set dependencies.allowed_registries registry.npmjs.org registry.yarnpkg.com npm.example.com --reason "The company mirror of npm."
```

For a table, such as `spelling.allowed_words`, `gspot set` adds the keys that you give and keeps the others.

A value that makes a check less strict needs `--reason`. Such values include a raised limit, a lower coverage minimum,
and a new entry in an allow list. gspot rejects a reason on a value that makes no check less strict.
`gspot explain <setting>` says which changes need a reason.

```shell
gspot set limits.max_function_lines 80 --reason "The parser is one state machine."
```

```toml title="gspot.toml"
[limits]
max_function_lines = { value = 80, reason = "The parser is one state machine." }
```

To pass a value that starts with `-`, put `--` before the values:

```shell
gspot set ci.setup_command -- bun install --frozen-lockfile
```

To change a setting for one folder only, add `--scope <path>`, as [Settings in a
scope](/configure/monorepos/#settings-in-a-scope) shows.

## Edit records by hand

No command writes these records. Write them in `gspot.toml` yourself, then run `gspot install`.

| Record                         | Holds                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| `[[scope]]`                    | The configurations and settings of one folder.               |
| `[[command_check]]`            | A command of your own, run as a check.                       |
| `[[import_rule]]`              | A layer of your code and the layers it may import.           |
| `[[format.override]]`          | Formatting for some files.                                   |
| `[[naming.exception]]`         | Names that the naming checks accept in some files.           |
| `[[tools.eslint.override]]`    | ESLint rule options or a runtime for some files.             |
| `[[coverage.swift_target]]`    | The coverage minimum of one Swift target.                    |
| `[[licenses.allowed_package]]` | One package version allowed under a license you reviewed.    |
| `[[data_files.schemas]]`       | A JSON Schema for data files that SchemaStore does not know. |

`gspot ignore` writes the `[[ignore]]` records. `gspot set` writes the plugin lists `tools.eslint.plugins` and
`tools.stylelint.plugins` as one inline TOML list, and replaces the whole list. gspot checks a hand edit in the same way
as a change that a command makes.

After a hand edit, preview the changes to the generated files. Then write them and install the tools:

```shell
gspot check --only gspot/generated-files --verbose
gspot install
```

`gspot.toml` uses TOML 1.0, so keep each inline table on one line. [Editors](/use/editors/#validate-gspottoml) shows
how to validate the file as you type.

## Accept a banned name

At level `all`, the naming checks reject vague words in names. The `roles` list rejects job labels, such as `helper`
and `manager`. The `defensive` list rejects qualifiers, such as `ensure` and `maybe`. The `marketing` list rejects
claims, such as `advanced` and `enhanced`. To ban more words in your project, add them to `naming.banned_words`.

For `export const helperCommand = 1;`, `naming/identifiers` reports:

```text
javascript variable "helperCommand": "helper" is banned (roles list).
```

Accept a name only when something outside your code requires that exact name, such as an external API. This record
accepts the name in one file:

```toml title="gspot.toml"
[[naming.exception]]
paths = ["helper.js"]
categories = ["variables"]
allowed_names = ["helperCommand"]
reason = "An external API requires this exact name."
```

The naming checks still check the other names in that file.

## What settings cannot change

The level decides which rules run, and each gspot release pins the tool versions. As a result, every repository with
the same level and the same gspot version runs the same checks.

- To run a rule that only level `all` turns on, set the level to `all`, then ignore the rules that you do not want.
- Every finding fails its check. Only your own command checks choose their stage.
- A tool option that has no setting in `gspot.toml` stays as gspot writes it. To add rules, use an ESLint or Stylelint
  [plugin record](/configure/lint-rules/#plugins) or a [Semgrep rule file](/topics/security/#semgrep). To run another
  tool, add a [command check](/configure/command-checks/).
