---
title: Lint rules
description: Set lint rule options in gspot.toml, and add rules from a plugin.
---

Set lint rule options in `gspot.toml`; gspot writes them into the config file of each tool. The level decides which
rules run, and the options take no severity. To turn a rule off, [ignore it](/use/ignore/) with a reason. To add
rules, use a [plugin record](#plugins), or add Ruff rule codes in `tools.ruff.rules`.

You can set options only for a rule that runs at your level. `gspot set` refuses a rule of level `all`:

```text
n/no-process-exit runs only at level all. gspot sets options only for the rules that run at level basic.
```

For a rule that gspot runs at no level, the next ESLint run stops, and `javascript/eslint` reports `error`:

```text
gspot runs id-length at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.
```

| Tool                  | Setting                                              | Takes                                 |
| --------------------- | ---------------------------------------------------- | ------------------------------------- |
| ESLint                | `tools.eslint.rules`                                 | An option array for each rule ID      |
| ESLint for some files | `[[tools.eslint.override]]` with `paths` and `rules` | The same, for the files of `paths`    |
| Stylelint             | `tools.stylelint.rules`                              | The options of each rule              |
| markdownlint          | `tools.markdownlint.rules`                           | An option table for each rule ID      |
| Ruff                  | `tools.ruff.rules`                                   | Rule codes or prefixes to add         |
| commitlint            | `tools.commitlint.rules`, `types`, and `scopes`      | Rule options, and the accepted values |

## Settings that set rule options

gspot writes the options of some rules from a setting, and refuses them in these tables. Change the setting instead:

| Rules                                                                                                                    | Setting                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `max-lines`, `max-lines-per-function`, `max-params`, `max-depth`, `max-statements`, `max-nested-callbacks`, `complexity` | The matching key of [limits](/reference/gspot-toml/#limits)                                                        |
| `gspot/no-trivial-functions`                                                                                             | `limits.min_function_statements`                                                                                   |
| `gspot/no-trivial-files`                                                                                                 | `structure.reexports` and `limits.max_index_exports`                                                               |
| `gspot/no-identical-functions`                                                                                           | `structure.min_duplicate_lines`                                                                                    |
| `no-restricted-imports`                                                                                                  | `javascript.banned_imports`                                                                                        |
| `gspot/import-boundaries`                                                                                                | `javascript.import_boundaries`, see [Import rules](/configure/import-rules/#keep-relative-imports-inside-a-folder) |
| `n/file-extension-in-import`                                                                                             | `javascript.import_extension`                                                                                      |

## ESLint

For `export const matches = (value) => value == null;`, the `eqeqeq` lint rule can report:

```text
Expected '===' and instead saw '=='.
```

These settings accept the null comparison while requiring strict equality elsewhere:

```toml
configurations = ["javascript"]

[tools.eslint.rules]
eqeqeq = ["always", { null = "ignore" }]
```

```shell
gspot set tools.eslint.rules '{ eqeqeq = ["always", { null = "ignore" }] }'
```

The table holds options only. gspot refuses a severity, such as `eqeqeq = "off"`:

```text
This table holds options only, without a severity; the level decides which rules run. To ignore eqeqeq, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".
```

`gspot explain javascript/eslint eqeqeq` reads the rule from the ESLint that `gspot install` put in `.gspot/node_modules`. It
prints what the rule looks for, links its documentation, which lists its options, and prints the commands that set its
options or ignore it. Before `gspot install`, explain asks you to run it. Stylelint rules work the same way, such as
`gspot explain css/stylelint color-no-invalid-hex`.

For a Ruff rule, `gspot explain python/ruff E501` prints its summary. Add `--verbose` for its full explanation.

## Plugins

A plugin adds rules that gspot does not ship. Name it as a module in the repository, or as an npm package at an exact
version. Each `[[tools.eslint.plugins]]` record names the rule prefix, the plugin, and the rules to turn on as errors
for the code files of its scope:

```javascript title="tools/lint/plugin.mjs"
export default {
    rules: {
        'no-legacy-api': {
            meta: { type: 'problem', schema: [] },
            create(context) {
                return {
                    Identifier(node) {
                        if (node.name === 'legacyFetch') context.report({ node, message: 'Use the current API.' });
                    },
                };
            },
        },
    },
};
```

```toml
[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-legacy-api" = [] }
```

Name a tracked `.js` or `.mjs` file as the module. The name cannot take the prefix of a plugin that gspot loads.
ESLint then reports `local/no-legacy-api`.

For an npm package, set `package` and `version` in place of `path`:

```toml
[[tools.eslint.plugins]]
name = "acme"
package = "eslint-plugin-acme"
version = "1.2.3"
rules = { "no-legacy-api" = [] }
```

`gspot install` puts the package in `.gspot/node_modules`, beside the ESLint that gspot pins, so the plugin loads that
ESLint and no package of your repository. Run `gspot install` after you change a record.

`[[tools.stylelint.plugins]]` takes `path`, or `package` and `version`, and `rules`. It has no `name`, because a Stylelint
plugin names its own rules:

```toml
[[tools.stylelint.plugins]]
package = "stylelint-acme"
version = "1.2.3"
rules = { "acme/no-red" = true }
```

The table holds no severity, so gspot reports every rule of a record as an error. A rule that warned in your old config
now fails the check.

## Ruff

Ruff takes rule codes to add in `tools.ruff.rules`, not rule options. Its limits, such as
`limits.max_cyclomatic_complexity` and `limits.max_function_parameters`, come from
[limits](/reference/gspot-toml/#limits), and `python.docstring_convention` sets the pydocstyle convention. To turn a
Ruff lint rule off, ignore it by its code: `gspot ignore python/ruff --rule <code> --reason "<why>"`.

## Stylelint

Stylelint options go in `tools.stylelint.rules`:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
```

This requires long hexadecimal colors at both levels.
To allow a WebKit property that your project needs, use the `ignoreProperties` option of `property-no-vendor-prefix`.
To allow an at-rule, use the `ignoreAtRules` option of `at-rule-no-unknown`:

```toml
[tools.stylelint.rules]
at-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]
```

## markdownlint

Each markdownlint entry takes an option table, without an on or off value or a `default` key:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

This reports repeated headings throughout a document, not only under the same parent heading.

See [tool options](/reference/gspot-toml/#tools) for the accepted fields.
