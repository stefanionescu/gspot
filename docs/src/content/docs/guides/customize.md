---
title: The policy file
description: Choose kits and a level, change settings, and record exceptions in gspot.toml.
---

`gspot.toml` holds every choice gspot follows: the kits, the level, the settings, and the
exceptions. The commands on this page edit it for you and apply the change.

## See the current choices

```bash
gspot list
gspot list settings
```

`gspot list` shows the kits and the state of each check. `gspot list settings` shows each
setting, its value, and where the value comes from. The [settings reference](/reference/settings/)
lists every setting with its accepted values and defaults.

## Kits and the level

A policy starts with the kits it selects:

```toml
kits = ["bash"]
level = "recommended"
require_reasons = true
```

A kit is a bundle of checks, tool configuration, and agent rules for one language, framework,
or concern. To add or remove one, run `gspot add <kit>` or `gspot remove <kit>`.

The level decides which checks run:

- `recommended`, the default, runs the checks that find defects: correctness, security,
  accessibility, type safety, dependency health, formatting, and project contracts you declare.
- `all` adds the house style: vocabulary, architecture, naming, documentation, declaration
  order, API style, complexity, and trivial files and functions.

Neither level turns on experimental or preview rules. To change the level, run:

```bash
gspot set level all
```

## Record one exception

This example lets scripts print to the terminal:

```bash
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

The ignore turns off the lint rule `no-console` for the paths under `scripts/`. Leave out
`--rule` to turn off the whole check. With `require_reasons = true`, gspot refuses an ignore
without a reason.

When the cause is gone, remove the ignore and run the check again:

```bash
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --remove
```

Reports list every ignore, and `--verbose` prints each one with how many findings it matched.

## Change a limit

```bash
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

With `require_reasons = true`, loosening a limit needs a reason. Tightening one does not. The
JavaScript and TypeScript size limits apply to test files and test functions too.

At level `all`, gspot reports functions with 2 statements or fewer, in every language it
checks. To change the number for every language, or for one language:

```bash
gspot set limits.trivial_statements 1
gspot set limits.python.trivial_statements 4
```

Any whole number of 1 or more works. A higher number reports more functions.

More ways to write a setting:

- `--scope api` writes the setting in the scope `api`.
- `--default` removes your value, so the inherited or default value applies.
- For a list, `--replace` replaces the whole list, and `--remove` removes items from it.

## Edit the file by hand

You can edit `gspot.toml` directly. Afterwards, apply the change and install any new tools:

```bash
gspot apply
gspot install
```

`gspot apply --dry-run` shows the change first, including every rule that turns on or off.

## Upgrade gspot

`.gspot/version` pins the gspot version of the repository, and with mise,
`.mise/conf.d/gspot-tools.toml` pins it too. Another version refuses `gspot check`. After you
upgrade gspot, move the pin: preview and apply the new configuration, then install and check:

```bash
gspot apply --dry-run
gspot apply
gspot install
gspot check
```

Commit the changed configuration and locks, so your teammates get the same tools.

## Settings for one integration

- [Tests and coverage](/guides/testing/): Jest, Vitest, pytest, and Swift tests.
- [Dependency licenses](/guides/dependency-licenses/): allowed licenses and exceptions.
- [Security](/guides/security/): Semgrep, Swift security rules, and CodeQL.
- [Monorepos](/guides/scopes/): settings for one project in the repository.
