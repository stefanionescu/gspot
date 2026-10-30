---
title: gspot.toml
description: Each thing you can change in gspot, and the command or setting in gspot.toml that changes it.
---

`gspot.toml` holds your configurations, level, settings, and ignores, and each change has one command or setting. A
change that makes a check weaker needs a reason beside it. gspot writes the config files from `gspot.toml`, so you never
edit a config file. Setting commands edit the file and apply each change. The commands preserve existing comments and
the order of untouched settings and tables.

## What you can change

### Choose what runs

| You want to                                         | Do this                                                                            | Read                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Detect new configurations                           | `gspot add`, then `gspot install`                                                  | [Choose configurations](#choose-configurations)                 |
| Use a configuration                                 | `gspot add <configuration>`                                                        | [Choose configurations](#choose-configurations)                 |
| Stop using a configuration                          | `gspot remove <configuration> --reason "<why>"`                                    | [Choose configurations](#choose-configurations)                 |
| Give one folder its own configurations and settings | A `[[scope]]` record, then `--scope <path>` on `add`, `remove`, `set`, and `unset` | [Monorepos](/configure/monorepos/)                              |
| Start from another repository's setup               | `gspot init --from <path>/gspot.toml`                                              | [Start from another repository](#start-from-another-repository) |

### Change what a check reports

| You want to                                               | Do this                                                                    | Read                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| Turn a check or a lint rule off                           | `gspot ignore <check> [--rule <rule>] [--paths "<path>"] --reason "<why>"` | [Ignore findings](/use/ignore/)             |
| Turn it off until a date                                  | Add `--until YYYY-MM-DD`                                                   | [Ignore findings](/use/ignore/)             |
| Accept a function that a framework calls by name          | `gspot ignore <check> --names <name> --reason "<why>"`                     | [Ignore findings](/use/ignore/)             |
| Keep generated or vendored files out                      | Mark them `linguist-generated` or `linguist-vendored` in `.gitattributes`  | [Exclude files](/configure/files/)          |
| Keep your own files out of every check                    | `gspot ignore --paths "<path>" --reason "<why>"`                           | [Exclude files](/configure/files/)          |
| Change the options of a lint rule                         | `tools.<tool>.rules`, or `[[tools.eslint.override]]` for some paths        | [Lint rule options](/configure/lint-rules/) |
| Raise a size or complexity limit                          | `gspot set limits.<key> <value> --reason "<why>"`                          | [Settings](/reference/gspot-toml/#limits)   |
| Change indentation, line length, or quotes                | `[format]`, and `[[format.override]]` for some files                       | [Settings](/reference/gspot-toml/#format)   |
| Accept a word that the spelling checks report             | `gspot set spelling.allowed_words <word> --reason "<why>"`                 | [Spelling and prose](/topics/prose/)        |
| Refuse words in names                                     | `gspot set naming.banned_words <word>...`, with every word of the list     | [Settings](/reference/gspot-toml/#naming)   |
| Change coverage minimums, allowed licenses, or registries | `coverage`, `licenses`, and `dependencies` settings                        | [Settings](/reference/gspot-toml/)          |

### Add rules and checks of your own

| You want to                                               | Do this                                                           | Read                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Add a JavaScript or TypeScript lint rule                  | A plugin module and a `[[tools.eslint.plugins]]` record           | [Lint rule options](/configure/lint-rules/#your-own-eslint-rules) |
| Add a rule for any language                               | A Semgrep rule file in `tools.semgrep.rule_files`                 | [Security](/topics/security/#semgrep)                             |
| Describe the layers of your code                          | `[[import_rule]]` records                                         | [Import rules](/configure/import-rules/)                          |
| Run a tool or script of your own, in the hooks and CI too | A `[[command_check]]` record                                      | [Command checks](/configure/command-checks/)                      |
| Give coding agents rules of your own                      | Write them in `AGENTS.md`, outside the gspot managed block        | [Coding agents](/use/coding-agents/)                              |
| Leave out rules that gspot ships for agents               | `gspot set rules.exclude <path>...`, with every path to leave out | [Coding agents](/use/coding-agents/)                              |

### Set up CI and hooks

| You want to                        | Do this                                                         | Read                               |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| Run a command before the CI checks | `gspot set ci.setup_command -- <command>`                       | [Continuous integration](/use/ci/) |
| Use your own pipeline              | `gspot set ci.enabled false`                                    | [Continuous integration](/use/ci/) |
| Turn the Git hooks on or off       | `gspot set hooks.enabled true` or `false`, then `gspot install` | [Git hooks](/use/hooks/)           |

### What gspot does not change

gspot decides these, so every repository at one level and one gspot version runs the same checks the same way:

- **The rules that run.** The level picks them. To run a rule of level `all`, set the level to `all`, and ignore with a
  reason the rules you do not want.
- **The options of rules that a setting writes.** Size and complexity rules take their values from `limits`, and
  indentation rules from `[format]`. Change the setting.
- **Tool options that have no setting.** gspot writes each config file from `gspot.toml` only.
- **When a check runs, and whether it fails.** Every finding fails its check. Your own command checks choose their
  stage.
- **Tool versions.** Each gspot release pins them.
- **Rules for other tools of your own:** Vale styles and Stylelint plugins, for example. Write the rule for Semgrep, or run
  the tool as a command check.

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
gspot remove nextjs --reason "The app no longer uses Next.js."
```

`gspot remove` needs `--reason`. It writes `nextjs` into `removed_configurations` with that reason, so `gspot doctor`
does not suggest it again; `gspot add nextjs` reverses that. gspot does not remove a configuration that another
selected configuration needs. `removed_configurations` keeps one reason for each removed configuration, such as
`nextjs = "The app no longer uses Next.js."`. When the tools change, gspot prints a reminder to run `gspot install`.

Run `gspot add` without names to detect and select configurations from the current files and dependencies, then run
`gspot install`. It leaves configurations listed in `removed_configurations` out. Name a configuration explicitly to
select it again.

gspot always selects most general configurations, such as `secrets`, `spelling`, and `security`, even when you write the
list yourself, and `gspot add` and `gspot remove` refuse them. To run fewer of their checks, change the level, or turn
one check off with an [ignore](/use/ignore/).

In the file, the selection reads:

```toml title="gspot.toml"
configurations = ["bash"]
level = "basic"
```

Framework lint rules follow your dependencies. For example, a NestJS project that uses `@nestjs/swagger` also gets the
Swagger lint rules.

## Start from another repository

Start a repository from the setup of another one with the path of its `gspot.toml`:

```shell
gspot init --from ../api/gspot.toml --dry-run
gspot init --from ../api/gspot.toml
gspot install
```

init selects the configurations of that file and the ones it detects here. It copies the settings that fit any
repository: the level, limits and their reasons, naming, formatting, prose, coverage, and lint rule lists. It also
copies word lists and each ignore of a whole check or lint rule. init enables hooks and rules for the new repository;
it does not copy their switches from the template.

The plan lists under `left out` each setting that belongs to the other repository:

- Settings and records that name paths, such as `test_files` and `[[scope]]`.
- Settings and command checks that run code.
- Settings that describe that repository, such as `tools.eslint.import_extension`.
- `ci.enabled` and `ci.provider`, because CI stays off until you run `gspot set ci.enabled true`.
- Ignores with paths, names, or a date.

What init reads here wins over the file: the formatting of an existing Prettier, EditorConfig, or Ruff file.
`--level` wins over the level of the file.

init selects each configuration of the file even when this repository has none of its files yet, so its rules reach
your coding agent before the first file. Its checks report `no matching files` until the files exist. To drop one,
run `gspot remove <name> --reason "<why>"`.

init copies the file once. A later change to it does not reach this repository.

To share a setup with a team, keep its `gspot.toml` in a repository that everyone clones, and start each new
repository from it. To use one file without a clone, download it first, at a commit:

```shell
curl -fsSL -o ../team.toml https://raw.githubusercontent.com/acme/policies/<commit>/gspot.toml
gh api "repos/acme/policies/contents/gspot.toml?ref=<commit>" -H "Accept: application/vnd.github.raw" > ../team.toml
gspot init --from ../team.toml
```

Your own ESLint plugins, Semgrep rule files, and command checks stay behind with their files. To share ESLint rules,
publish them as an ESLint plugin package, install it, and name a module that re-exports it in
`[[tools.eslint.plugins]]`. Copy Semgrep rule files and command check scripts with their lines in `gspot.toml`.

## Change a setting

| Command                           | What it does                                                          |
| --------------------------------- | --------------------------------------------------------------------- |
| `gspot set <setting> <value>`     | Writes your value. Your first written value replaces the shipped one. |
| `gspot unset <setting>`           | Removes your value and its reason, so the default takes effect again. |
| `gspot unset <setting> <item...>` | Removes list items or table keys from your value.                     |

For a list, `gspot set` writes the values you give in place of the list, so give every value the list must hold. For a
table, it adds the keys you give and keeps the others.

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

Allow an exact name only when an external contract requires it. Every shipped banned naming list applies at level
`all`. The `roles` list rejects vague job labels such as `helper` and `manager`; `defensive` rejects qualifiers such as
`ensure` and `maybe`; `marketing` rejects claims such as `advanced` and `enhanced`. `naming.banned_words` adds project
words.

For `export const helperCommand = 1;`, `naming/identifiers` reports:

```text
javascript variable "helperCommand": "helper" is banned (roles list).
```

This complete example accepts that exact variable name in one file:

```toml title="gspot.toml"
configurations = ["javascript"]
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

The records that no command writes, `[[scope]]`, `[[command_check]]`, and `[[import_rule]]`, take a hand edit.
`gspot ignore` writes `[[ignore]]` records. `gspot set` writes any other list of tables, such as
`tools.eslint.plugins`, whole, as one inline TOML list. gspot checks a hand edit as it checks a command.

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
