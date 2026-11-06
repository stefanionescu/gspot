---
title: Lint rules
description: Set the options of a lint rule in gspot.toml, and add rules from a plugin.
---

Set the options of lint rules in `gspot.toml`, and gspot writes them into the config file of each tool. The level
decides which rules run, so you set only options, not a severity such as `off` or `warn`. To turn a rule off,
[ignore it](/use/ignore/) with a reason. To add rules, use a [plugin record](#plugins), or add Ruff rule codes in
`tools.ruff.rules`.

| Tool                  | Setting                                              | Takes                              |
| --------------------- | ---------------------------------------------------- | ---------------------------------- |
| ESLint                | `tools.eslint.rules`                                 | An option array for each rule ID   |
| ESLint for some files | `[[tools.eslint.override]]` with `paths` and `rules` | The same, for the files of `paths` |
| Stylelint             | `tools.stylelint.rules`                              | The options of each rule           |
| markdownlint          | `tools.markdownlint.rules`                           | An option table for each rule ID   |
| Ruff                  | `tools.ruff.rules`                                   | Rule codes or prefixes to add      |
| commitlint            | `tools.commitlint.rules`                             | The options of each rule           |
| commitlint            | `commits.types` and `commits.scopes`                 | The accepted values                |

## ESLint

For `export const matches = (value) => value == null;`, the `eqeqeq` lint rule reports:

```text
Expected '===' and instead saw '=='.
```

These settings allow the comparison with `null`, and still require `===` everywhere else:

```toml
[tools.eslint.rules]
eqeqeq = ["always", { null = "ignore" }]
```

```shell
gspot set tools.eslint.rules '{ eqeqeq = ["always", { null = "ignore" }] }'
```

`gspot explain javascript/eslint eqeqeq` prints what the rule looks for, a link to its options, and the commands that
set its options or ignore it. Run `gspot install` first. Stylelint rules work the same way, such as
`gspot explain css/stylelint color-no-invalid-hex`. For a Ruff rule, `gspot explain python/ruff E501` prints its
summary, and `--verbose` adds its full explanation.

The table holds only options, for a rule that runs at your level. `gspot set` rejects a severity, such as
`eqeqeq = "off"`, and at level `basic`, a rule that runs only at level `all`. A rule that gspot runs at no level, such as
`id-length`, stops the next ESLint run, and `javascript/eslint` reports `error`. Each message says what to do instead.

## Settings that set rule options

gspot writes the options of some rules from other settings, and rejects these rules in the rule tables, so change the
setting instead:

| Rules                                                                                                                    | Setting                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `max-lines`, `max-lines-per-function`, `max-params`, `max-depth`, `max-statements`, `max-nested-callbacks`, `complexity` | The matching key of [limits](/reference/gspot-toml/#limits)                                                        |
| `gspot/no-trivial-functions`                                                                                             | `limits.trivial_function_statements`                                                                               |
| `gspot/no-trivial-files`                                                                                                 | `structure.reexports` and `limits.max_index_exports`                                                               |
| `gspot/no-identical-functions`                                                                                           | `structure.min_duplicate_lines`                                                                                    |
| `no-restricted-imports`                                                                                                  | `javascript.banned_imports`                                                                                        |
| `gspot/import-boundaries`                                                                                                | `javascript.import_boundaries`, see [Import rules](/configure/import-rules/#keep-relative-imports-inside-a-folder) |
| `n/file-extension-in-import`                                                                                             | `javascript.import_extension`                                                                                      |

## Plugins

A plugin adds lint rules that gspot does not ship, from a module in your repository or from an npm package at an exact
version. Each `[[tools.eslint.plugins]]` record names the rule prefix, the plugin, and the rules to turn on for the code
files of the scope of the record:

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

The module must be a `.js` or `.mjs` file that Git tracks, and the `name` cannot be the prefix of a plugin that gspot
loads itself. With this record, ESLint reports the findings of the rule as `local/no-legacy-api`.

For an npm package, set `package` and `version` in place of `path`:

```toml
[[tools.eslint.plugins]]
name = "acme"
package = "eslint-plugin-acme"
version = "1.2.3"
rules = { "no-legacy-api" = [] }
```

`gspot install` puts the package in `.gspot/node_modules`, next to the ESLint that gspot pins, so the plugin loads that
ESLint and not a package from your project. Run `gspot install` after you change a record.

`[[tools.stylelint.plugins]]` takes `path`, or `package` and `version`, and `rules`. It has no `name`, because a
Stylelint plugin names its own rules:

```toml
[[tools.stylelint.plugins]]
package = "stylelint-acme"
version = "1.2.3"
rules = { "acme/no-red" = true }
```

A record holds no severity, so gspot reports every rule of a record as an error, and a rule that only warned in your old
config fails the check.

## Ruff

`tools.ruff.rules` takes rule codes to add at any level, not rule options. The Ruff limits, such as
`limits.max_cyclomatic_complexity` and `limits.max_function_parameters`, come from
[limits](/reference/gspot-toml/#limits), and `python.docstring_convention` sets the pydocstyle convention. To turn a
Ruff rule off, ignore it by its code: `gspot ignore python/ruff --rule <code> --reason "<why>"`.

## Stylelint

These settings require the long form of hexadecimal colors, such as `#ffffff`, and allow the at-rule `@container`:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
at-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]
```

To allow a property with a `-webkit-` prefix, use the `ignoreProperties` option of `property-no-vendor-prefix`.

## markdownlint

Each entry takes a table of options, with no `true` or `false` value and no `default` key. With this option, MD024 reports
a repeated heading anywhere in a document, not only under the same parent heading:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

[Tool options](/reference/gspot-toml/#tools) lists the accepted fields.
