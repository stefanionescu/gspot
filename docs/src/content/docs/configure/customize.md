---
title: Customize gspot
description: Each thing you can change in gspot, and the one command or setting that changes it.
---

`gspot.toml` holds every change you make to gspot, and each change has one command or setting. A change that makes a
check weaker needs a reason beside it. gspot writes the config files from `gspot.toml`, so you never edit a config file.

## Choose what runs

| You want to                                         | Do this                                                                            | Read                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Use a configuration                                 | `gspot add <configuration>`                                                        | [gspot.toml](/configure/gspot-toml/#choose-configurations)         |
| Stop using a configuration                          | `gspot remove <configuration> --reason "<why>"`                                    | [gspot.toml](/configure/gspot-toml/#choose-configurations)         |
| Run more or fewer checks                            | `gspot set level all` or `gspot set level recommended`                             | [Levels](/start/concepts/#levels)                                  |
| Give one folder its own configurations and settings | A `[[scope]]` record, then `--scope <path>` on `add`, `remove`, `set`, and `unset` | [Monorepos](/configure/monorepos/)                                 |
| Start from another repository's setup               | Copy its gspot.toml and the files its settings name, then run gspot apply          | [gspot.toml](/configure/gspot-toml/#start-from-another-repository) |

## Change what a check reports

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
| Accept a word that the spelling checks report             | `gspot set spelling.allowed_words <word> --reason "<why>"`                 | [Spelling and prose](/checks/prose/)        |
| Refuse a word in names                                    | `gspot set naming.banned_words <word>`                                     | [Settings](/reference/gspot-toml/#naming)   |
| Change coverage minimums, allowed licenses, or registries | `coverage`, `licenses`, and `dependencies` settings                        | [Settings](/reference/gspot-toml/)          |

## Add rules and checks of your own

| You want to                                               | Do this                                                    | Read                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Add a JavaScript or TypeScript lint rule                  | A plugin module and a `[[tools.eslint.plugins]]` record    | [Lint rule options](/configure/lint-rules/#your-own-eslint-rules) |
| Add a rule for any language                               | A Semgrep rule file in `tools.semgrep.rule_files`          | [Security](/checks/security/#semgrep)                             |
| Describe the layers of your code                          | `[[import_rule]]` records                                  | [Import rules](/configure/import-rules/)                          |
| Run a tool or script of your own, in the hooks and CI too | A `[[command_check]]` record                               | [Command checks](/configure/command-checks/)                      |
| Give coding agents rules of your own                      | Write them in `AGENTS.md`, outside the gspot managed block | [Coding agents](/use/coding-agents/)                              |
| Leave out a rule that gspot ships for agents              | `gspot set rules.exclude <path>`                           | [Coding agents](/use/coding-agents/)                              |

## Set up CI and hooks

| You want to                        | Do this                                                         | Read                               |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| Run a command before the CI checks | `gspot set ci.setup_command -- <command>`                       | [Continuous integration](/use/ci/) |
| Use your own pipeline              | `gspot set ci.enabled false`                                    | [Continuous integration](/use/ci/) |
| Turn the Git hooks on or off       | `gspot set hooks.enabled true` or `false`, then `gspot install` | [Git hooks](/use/hooks/)           |

## What gspot does not change

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
