---
title: gspot.toml
description: Choose configurations and a level, change settings, and record exceptions in gspot.toml.
---

`gspot.toml` holds every choice gspot follows: the configurations, the level, the settings, and the
exceptions. The commands on this page edit it for you and apply the change.

## See the current choices

```bash
gspot list
gspot list settings
```

`gspot list` shows the configurations and one row per check with its state in each scope that selects its configuration.
`gspot list settings` shows root values and the settings each scope changes, with their sources.
Long values are shortened. Add `--json` to read complete values and inherited settings.
The [settings reference](/reference/settings/)
lists every setting with its accepted values and defaults.

## Configurations and the level

A policy starts with the configurations it selects:

```toml
configurations = ["bash"]
level = "recommended"
```

A configuration groups checks, tool files, and agent rules for a language, framework,
or concern. General checks are selected automatically, including with a manually authored
configuration list. To make a manual language or framework choice, run `gspot add <configuration>` or
`gspot remove <configuration>`. Change which general checks run with the level or an ignore.

`apply` updates automatically detected language and framework selections when repository files or
dependencies change. It keeps manual language and framework additions and removals at the root
and in scopes, including choices from `init --configurations`, `--scope-configurations`, and
edits to authored configuration lists. A manual removal stays removed when its detection
source disappears and returns. Removed choices are visible in `removed_configurations`. These manual choices select configurations. `recommended`
and `all` are the levels.

The [level descriptions](/guides/overview/#levels) define `recommended` and `all`. Neither enables experimental or preview rules. To change the level:

```shell
gspot set level all
```

The level controls every applicable check. Security checks are selected automatically for supported source files. Duplication checks run at `all`. License checks are selected when a dependency manifest exists and wait for the project's allowed license list.

Framework syntax follows declared project dependencies. A NestJS project that declares
`@nestjs/swagger` receives Swagger lint contracts.

## Ignore one finding

This example lets scripts print to the terminal:

```bash
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results to the terminal."
```

The ignore turns off the rule `no-console` for the paths under `scripts/`. Leave out
`--rule` to turn off the whole check. gspot refuses an ignore
without a reason. Add `--until YYYY-MM-DD` for a temporary acceptance. It stops applying at 00:00 UTC on that date. The saved entry remains for review.

Dependency advisory exceptions use the same `[[ignore]]` table with `check = "dependencies/osv"` and the advisory ID in `rule`.

When the cause is gone, remove the ignore and run the check again:

```bash
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --remove
```

A report prints how many ignores applied. `--verbose` prints each ignore with its reason and the number of findings it matched.

## Change a limit

```bash
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

Loosening a limit needs a reason. Tightening one does not. The
JavaScript and TypeScript size limits apply to test files and test functions too.

At level `all`, gspot reports functions with 2 statements or fewer, in every language it
checks. To change the number for every language, or for one language:

```bash
gspot set limits.min_function_statements 1
gspot set limits.python.min_function_statements 4
```

Any whole number of 1 or more works. A higher number reports more functions.

More ways to write a setting:

- `--scope api` writes the setting in the scope `api`.
- `--default` removes your value, so the inherited or default value applies.
- For a list, `--replace` replaces the list authored at that scope, and `--remove` removes items from it. Inherited lists and shipped defaults still apply, except command argument lists, which replace inherited arguments intact.

Adding formatter exclusions, sitemap exclusions, registry
hosts, or accepted words needs a reason. Values stay in their concern tables. `[reasons]`
records reasons by setting name. List edits preserve the reason. Replacing an exception list
with an empty list tightens the policy and needs no reason.

Turning `docs.require_license`
off needs a reason. Turning it back on does not.

Lockfile downloads use `registry.npmjs.org` and `registry.yarnpkg.com` by default. Add another
reviewed host with `gspot set dependencies.registry_hosts <HOST> --reason "<WHY>"`.
Registry allowances apply to their project scope and its descendants. A sibling keeps its own
allowances. Every download must still use HTTPS.

## Edit the file by hand

You can edit `gspot.toml` directly. Afterwards, apply the change and install any new tools:

```bash
gspot apply
gspot install
```

`gspot apply --dry-run` shows the change first, including every rule that turns on or off.
Rule differences compare the proposed rules with the last successful apply. Edited generated
files also show a file diff, so you can see the authored change alongside the proposed output.

## Reconcile project changes

After adding or removing a configuration, run `gspot apply --dry-run`, then `gspot apply` and `gspot install`. `apply` adds applicable configurations and deactivates language and framework configurations whose evidence disappeared, while retaining manual language and framework overrides. It preserves settings, command checks, ignores, reasons, and authored scope policy for returning projects.

Shared-file configurations stay applicable while their inputs exist. An edited generated file is reported instead of overwritten. `doctor` reports stale setup. `check` uses saved choices.

See [Upgrade gspot](/guides/upgrade/) to install a new version and update the repository pin.

## Settings for one integration

- [Tests and coverage](/guides/testing/): Jest, Vitest, pytest, and Swift tests.
- [Dependency licenses](/guides/dependency-licenses/): allowed licenses and exceptions.
- [Security](/guides/security/): Semgrep, Swift security rules, and CodeQL.
- [Monorepos](/guides/monorepos/): settings for one scope in the repository.
