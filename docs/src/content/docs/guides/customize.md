---
title: Configuration
description: Select configurations, adjust settings, and keep exceptions scoped and explained.
---

Run commands from the configured repository root with the [CLI available](/guides/install/).

Choose language and framework configurations, then change individual settings or record an exception.
A configuration selects checks and their required tools.

## Inspect the current choices

```bash
gspot list
gspot list settings
```

Use `gspot explain <check>` before changing its policy. The generated
[settings reference](/reference/settings/) gives accepted values and defaults.

## Select configurations and a level

A complete policy starts with a schema version and selected configurations:

```toml
version = 1
kits = ["bash"]
level = "recommended"
require_reasons = true
```

`recommended` includes correctness, security, accessibility, type safety, dependency health,
routine formatting, and explicitly declared project contracts. `all` adds stable vocabulary,
architecture, naming, documentation, declaration order, API style, and complexity conventions.
Trivial-file and trivial-function restrictions belong to `all`. Neither level enables
experimental or preview rules. Individual check
definitions state their selected level. Apply a manual edit with
`gspot apply`. To change the level through the CLI:

```bash
gspot set level all
```

The command writes and applies the setting. Run checks separately afterward.

## Record one exception

For a TypeScript repository that intentionally prints from scripts:

```bash
gspot ignore typescript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

The check must be a known shipped check or a declared repository check. The example disables one tool rule only for the
named paths. A whole-check exception omits `--rule`. With `require_reasons = true`, missing
reasons and unexplained weakening changes are refused.

Remove the matching exception after repairing its cause:

```bash
gspot ignore typescript/eslint --rule no-console --paths "scripts/**" --remove
```

Run the affected check again. Reports retain ignore information; verbose text expands entries
and matched counts. An exception is a policy choice, not a repaired defect.

## Change a limit

JavaScript and TypeScript size limits also apply to test files and test functions.

```bash
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

Use `--scope api` for a declared `api` scope. Use `--default` instead of a value to remove a
local override. Lists support `--replace` and `--remove`; consult the setting type before
changing one. Review `gspot.toml` and generated changes before sharing them.

## Configure a specific integration

- [Tests and coverage](/guides/testing/): Jest coverage and Swift test rules.
- [Dependency licenses](/guides/dependency-licenses/): installed packages and exact exceptions.
- [Security checks](/guides/security/): Swift rules and CodeQL analysis.
- [Scopes](/guides/scopes/): policy inheritance and project-local resources.

See [edit and retain repository files](/guides/generated-files/) for what to commit,
regenerate, and keep for restoration.

## Upgrade tool configuration

After upgrading gspot, preview changes with `gspot apply --dry-run`. Run `gspot apply`,
review the generated changes and locks, then run `gspot install` and `gspot check`.

The [settings reference](/reference/settings/) lists defaults at both levels. Explicit settings
remain effective at either level, including coverage floors, license allowances, and file-size limits.
