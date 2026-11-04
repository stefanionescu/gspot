---
title: Change settings
description: Change gspot.toml with commands, and learn which changes need a reason.
---

`gspot.toml` holds your configurations, level, settings, and ignores. gspot writes every generated file from it, so you
change `gspot.toml` instead of the tool configs. Each command on this page edits `gspot.toml` and writes the generated
files again. It keeps your comments and the order of your settings.

A change that weakens a check needs a reason, such as a raised limit or a removed configuration.
[Changes that weaken the checks](/use/ignore/#changes-that-weaken-the-checks) shows how gspot reviews them.

## See the current settings

```shell
gspot list
gspot list settings
gspot explain limits.max_file_lines
```

`gspot list` prints the selected configurations and the state of each check. `gspot list settings` prints every setting
and where its value comes from. `gspot explain <setting>` prints one setting, its default, and the command that changes
it. Add `--json` for complete values. The [settings reference](/reference/gspot-toml/) lists every key.

## Add or remove a configuration

A configuration holds the checks, tool configs, and rules for one language, framework, or topic. Select one, or drop
one, by name:

```shell
gspot add vitest
gspot remove nextjs --reason "The app no longer uses Next.js."
```

`gspot remove` saves the configuration and its reason under `removed_configurations`, so gspot stops suggesting it.
`gspot add nextjs` undoes the removal. gspot refuses to remove a configuration that another selected configuration
needs. It also refuses to add or remove the [configurations that it selects in every
repository](/reference/configurations/#always-selected); change the level or ignore a check instead. When the
configurations need new tools, run `gspot install`.

In the file, the selection reads:

```toml title="gspot.toml"
configurations = ["bash"]
level = "basic"
```

Framework lint rules follow your dependencies. For example, a NestJS project that uses `@nestjs/swagger` also gets the
Swagger lint rules.

## When files of a language appear or go

When files of a new language or framework appear, `gspot/detected-configurations` fails:

```text
gspot.toml:1  detected-configuration  No check reads bash (1 .sh file). Run gspot add bash, or gspot remove bash --reason "<why>".
```

Run the `gspot add` line, then `gspot install`. The check leaves out the configurations in `removed_configurations`.

When the files go, the checks of that configuration find no files and skip. The configuration, its settings, its
ignores, and its command checks stay in `gspot.toml`.

## Change a setting

| Command                           | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `gspot set <setting> <value...>`  | Writes your value in place of the default.                       |
| `gspot unset <setting>`           | Removes your value and its reason, so the default applies again. |
| `gspot unset <setting> <item...>` | Removes items from a list, or keys from a table.                 |

`gspot set` replaces a whole list, so give every item the list must hold. `dependencies.allowed_registries` starts
with `registry.npmjs.org` and `registry.yarnpkg.com`. To add a mirror, name all three:

```shell
gspot set dependencies.allowed_registries registry.npmjs.org registry.yarnpkg.com npm.example.com --reason "The company mirror of npm."
```

For a table, such as `spelling.allowed_words`, `gspot set` adds the keys you give and keeps the others.

A value that loosens a check needs `--reason`: a raised limit, a lower coverage minimum, or an item added to an allow
list. gspot refuses a reason on a value that loosens nothing. `gspot explain <setting>` says which change needs one.

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

To change a setting in one folder, add `--scope <path>`. See [Settings in a
scope](/configure/monorepos/#settings-in-a-scope).

## Edit records by hand

No command writes these record lists. Write them in `gspot.toml`, then run `gspot install`.

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

`gspot ignore` writes `[[ignore]]` records. `gspot set` writes the plugin lists `tools.eslint.plugins` and
`tools.stylelint.plugins` whole, as one inline TOML list. gspot checks a hand edit as it checks a command.

After a hand edit, preview the changes to the generated files, then write them and install the tools:

```shell
gspot check --only gspot/generated-files --verbose
gspot install
```

`gspot.toml` uses TOML 1.0, so keep each inline table on one line. [Editors](/use/editors/#validate-gspottoml) shows
how to validate the file as you type.

## Accept a banned name

At level `all`, the naming checks refuse vague words in names. The `roles` list refuses job labels such as `helper` and
`manager`, `defensive` refuses qualifiers such as `ensure` and `maybe`, and `marketing` refuses claims such as
`advanced` and `enhanced`. `naming.banned_words` adds words of your project.

For `export const helperCommand = 1;`, `naming/identifiers` reports:

```text
javascript variable "helperCommand": "helper" is banned (roles list).
```

Accept an exact name only when an external contract requires it. This record accepts that name in one file:

```toml title="gspot.toml"
[[naming.exception]]
paths = ["helper.js"]
categories = ["variables"]
allowed_names = ["helperCommand"]
reason = "An external API requires this exact name."
```

Other names in that file keep their checks.

## What settings cannot change

The level decides which rules run, and each gspot release pins the tool versions. So every repository at one level and
one gspot version runs the same checks.

- To run a rule of level `all`, set the level to `all`, then ignore the rules you do not want.
- Every finding fails its check. Only your own command checks choose their stage.
- A tool option with no setting stays as gspot writes it. To add rules, use an ESLint or Stylelint
  [plugin record](/configure/lint-rules/#plugins) or a [Semgrep rule file](/topics/security/#semgrep). To run another
  tool, add a [command check](/configure/command-checks/).
