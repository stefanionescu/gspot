---
title: Change settings
description: The commands that change gspot.toml, the records you write by hand, and the changes that need a reason.
---

`gspot.toml` holds your configurations, your level, your settings, and your ignores, and gspot writes every generated
file from it. To change how a tool runs, change `gspot.toml`, not the config file of the tool. Each command on this page
edits `gspot.toml` and then writes the generated files again, and it keeps your comments and the order of your settings.

## See the current settings

```shell
gspot list
gspot list settings
gspot explain limits.max_file_lines
```

`gspot list` prints the configurations in use and the state of each check. `gspot list settings` prints each setting,
its value, when it needs a reason, and where the value comes from. `gspot explain <setting>` prints one setting, its
default, and the command that changes it. Add `--json` for the full values, and read the
[settings reference](/reference/gspot-toml/) for every key.

## Add or remove a configuration

Give the name of the configuration, and a reason when you remove it:

```shell
gspot add vitest
gspot remove nextjs --reason "The app does not use Next.js."
```

`gspot remove` saves the name and your reason under `removed_configurations`, so gspot stops suggesting that
configuration, and `gspot add nextjs` undoes the removal. gspot refuses to remove a configuration that another
configuration in use needs. You cannot add or remove a configuration that is always on, such as `spelling`, so ignore
its checks instead. The [configuration reference](/reference/configurations/) lists them. When the configurations need
new tools, run `gspot install`.

In `gspot.toml`, the configurations and the level look like this:

```toml title="gspot.toml"
configurations = ["bash"]
level = "basic"
```

## When files of a language appear or go

When you add files of a language or framework that no configuration in use covers, the check
`gspot/detected-configurations` fails and names the command to run:

```text
gspot.toml:1  detected-configuration  No check reads bash (1 .sh file). Run gspot add bash, or gspot remove bash --reason "<why>".
```

Run that `gspot add` command, then `gspot install`. The check does not suggest a configuration in
`removed_configurations`.

When you delete all the files of a configuration, its checks find no files, and gspot skips them. The configuration, its
settings, its ignores, and its command checks stay in `gspot.toml`.

## Change a setting

| Command                           | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `gspot set <setting> <value...>`  | Writes your value in place of the default.                       |
| `gspot unset <setting>`           | Removes your value and its reason, so the default applies again. |
| `gspot unset <setting> <item...>` | Removes items from a list, or keys from a table.                 |

`gspot set` replaces a whole list, so give every value that the list must hold. For example,
`dependencies.allowed_registries` holds `registry.npmjs.org` and `registry.yarnpkg.com` by default, so a mirror takes
all three hosts:

```shell
gspot set dependencies.allowed_registries registry.npmjs.org registry.yarnpkg.com npm.example.com --reason "The company mirror of npm."
```

A setting that holds a table takes one TOML inline table, and gspot adds its keys and keeps the others.
`spelling.allowed_words` takes its words and one `--reason` instead. To pass a value that starts with `-`, put `--`
before the values:

```shell
gspot set ci.setup_command -- bun install --frozen-lockfile
```

To change a setting for one folder only, add `--scope <path>`, as
[Settings in a scope](/configure/monorepos/#settings-in-a-scope) shows. When a change empties a setting that a check
needs, `gspot set` and `gspot unset` print `This turns off <check>.`, and the Git diff shows the change.

## Changes that need a reason

A value weaker than the shipped default needs `--reason`, such as a raised limit, a lower coverage minimum, or a new
entry in an allow list. A reason has two or more words. `gspot set` takes `--reason` on every key that holds one, and
the column `needs a reason when` of `gspot list settings` shows when it needs one:

```shell
gspot set limits.max_function_lines 80 --reason "The parser is one state machine."
```

```toml title="gspot.toml"
[limits]
max_function_lines = { value = 80, reason = "The parser is one state machine." }
```

`gspot unset` takes no reason, so to give one, run `gspot set <setting> <value> --reason "<why>"`.

The check `gspot/weakenings` runs before each push and in CI, and lists each change that makes the checks less strict:

- a new ignore, or an ignore that covers more
- a removed configuration
- a lower level
- a weaker setting, such as a raised limit
- the Git hooks or the rule files turned off

A change with a reason prints as a note, and a change without one fails the check. The check compares `gspot.toml` with
its version before your change: where the pushed commits start, the revision that `--base` names, or the last commit.
With the hooks off, only CI or a run by hand reports it.

`level`, `hooks.enabled`, and `rule_files` hold no reason, so `gspot set` refuses `--reason` on them. Give the reason
with an ignore of the matching rule of `gspot/weakenings`, which also covers later changes of that kind:

```shell
gspot ignore gspot/weakenings --rule level --reason "The team moves to level all after the release."
```

The rules are `level`, `hooks`, and `rule-files`. gspot rejects an ignore of the whole check, so that it keeps running.

## Edit records by hand

`gspot ignore` writes `[[ignore]]`, and `--scope` adds a `[[scope]]` for a folder that holds a project file. Write the
rest yourself, then run `gspot install`:

| Record                          | Holds                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `[[command_check]]`             | A command of your own, run as a check.                       |
| `[[import_rule]]`               | A layer of your code and the layers it may import.           |
| `[[format.override]]`           | Formatting for some files.                                   |
| `[[naming.exception]]`          | Names that the naming checks accept in some files.           |
| `[[tools.eslint.override]]`     | ESLint rule options or a runtime for some files.             |
| `[[tools.eslint.plugins]]`      | ESLint rules from a plugin.                                  |
| `[[tools.stylelint.plugins]]`   | Stylelint rules from a plugin.                               |
| `[[javascript.banned_imports]]` | An import to refuse, and what to import instead.             |
| `[[coverage.swift_target]]`     | The coverage minimum of one Swift target.                    |
| `[[licenses.allowed_package]]`  | One package version allowed under a license you reviewed.    |
| `[[data_files.schemas]]`        | A JSON Schema for data files that SchemaStore does not know. |

`gspot set` and `gspot unset` also take `javascript.banned_imports` and the two plugin lists, as one inline TOML list.

After a hand edit, preview the changes to the generated files, then write them and install the tools:

```shell
gspot check --only gspot/generated-files --verbose
gspot install
```

`gspot.toml` uses TOML 1.0, so keep each inline table on one line. [Editors](/use/editors/#validate-gspottoml) shows how
to validate the file as you type. A key that gspot cannot read stops every command that reads the file, `gspot explain`
and `gspot list settings` too, so fix the line by hand. The error names each bad key and what it accepts.

## Accept a banned name

At level `all`, the naming checks reject vague words in names. The `roles` list rejects job labels, such as `helper` and
`manager`. The `defensive` list rejects qualifiers, such as `ensure` and `maybe`, and the `marketing` list rejects
claims, such as `advanced` and `enhanced`. To ban more words in your project, add them to `naming.banned_words`.

For `export const helperCommand = 1;`, `naming/identifiers` reports:

```text
javascript variable "helperCommand": "helper" is banned (roles list).
```

Accept a name only when something outside your code requires that exact name, such as an external API. This record
accepts the name in one file, and the naming checks still check the other names in that file:

```toml title="gspot.toml"
[[naming.exception]]
paths = ["helper.js"]
categories = ["variables"]
allowed_names = ["helperCommand"]
reason = "An external API requires this exact name."
```

## What settings cannot change

The level decides which rules run, and each gspot release pins the tool versions, so a level means the same rules in
every repository that pins the same gspot version.

- To run a rule that only level `all` turns on, set the level to `all`, then ignore the rules that you do not want. Ruff
  is the one exception: `tools.ruff.rules` adds a rule at any level.
- You cannot make a rule warn instead of fail.
- You cannot move a shipped check to another stage. Only your own command checks set `stage`.
- A tool option that has no setting in `gspot.toml` stays as gspot writes it. To add rules, use an ESLint or Stylelint
  [plugin record](/configure/lint-rules/#plugins) or a [Semgrep rule file](/topics/security/#semgrep). To run another
  tool, add a [command check](/configure/command-checks/).
