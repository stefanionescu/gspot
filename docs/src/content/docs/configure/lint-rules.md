---
title: Lint rules
description: Set lint rule options in gspot.toml, and add rules from a plugin.
---

Set the options of lint rules in `gspot.toml`, and gspot writes them into the config file of each tool. The level
decides which rules run, so you set only options, not a severity such as `off` or `warn`. To turn a rule off,
[ignore it](/use/ignore/) with a reason. To add rules, use a [plugin record](#plugins), or add Ruff rule codes in
`tools.ruff.rules`.

You can set options only for a rule that runs at your level. At level `basic`, `gspot set` rejects a rule that runs
only at level `all`:

```text
n/no-process-exit runs only at level all. gspot sets options only for the rules that run at level basic.
```

If you set options for a rule that gspot does not run at any level, the next ESLint run stops, and `javascript/eslint`
reports `error`:

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

gspot writes the options of some rules from other settings, and rejects these rules in the rule tables. Change the
setting instead:

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

These settings allow the comparison with `null`, and still require `===` everywhere else:

```toml
configurations = ["javascript"]

[tools.eslint.rules]
eqeqeq = ["always", { null = "ignore" }]
```

```shell
gspot set tools.eslint.rules '{ eqeqeq = ["always", { null = "ignore" }] }'
```

The table holds only options. gspot rejects a severity, such as `eqeqeq = "off"`:

```text
This table holds options only, without a severity; the level decides which rules run. To ignore eqeqeq, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".
```

`gspot explain javascript/eslint eqeqeq` reads the rule from the ESLint that `gspot install` put in
`.gspot/node_modules`. It prints what the rule looks for and a link to its documentation, which lists its options. It
also prints the commands that set its options or ignore it. Before you run `gspot install`, `gspot explain` asks you to
run it. Stylelint rules work the same way, such as `gspot explain css/stylelint color-no-invalid-hex`.

For a Ruff rule, `gspot explain python/ruff E501` prints its summary. Add `--verbose` for its full explanation.

## Plugins

A plugin adds lint rules that gspot does not ship. The plugin can be a module in your repository, or an npm package at
an exact version. Each `[[tools.eslint.plugins]]` record names the rule prefix, the plugin, and the rules to turn on.
gspot turns those rules on as errors for the code files of the scope of the record:

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

The module must be a `.js` or `.mjs` file that Git tracks. The `name` cannot be the prefix of a plugin that gspot loads
itself. With this record, ESLint reports the findings of the rule as `local/no-legacy-api`.

For an npm package, set `package` and `version` in place of `path`:

```toml
[[tools.eslint.plugins]]
name = "acme"
package = "eslint-plugin-acme"
version = "1.2.3"
rules = { "no-legacy-api" = [] }
```

`gspot install` puts the package in `.gspot/node_modules`, next to the ESLint that gspot pins. The plugin then loads
that ESLint, not a package from your project. Run `gspot install` after you change a record.

`[[tools.stylelint.plugins]]` takes `path`, or `package` and `version`, and `rules`. It has no `name`, because a Stylelint
plugin names its own rules:

```toml
[[tools.stylelint.plugins]]
package = "stylelint-acme"
version = "1.2.3"
rules = { "acme/no-red" = true }
```

A record holds no severity, so gspot reports every rule of a record as an error. A rule that only warned in your old
config fails the check under gspot.

## Ruff

For Ruff, `tools.ruff.rules` takes rule codes to add, not rule options. The Ruff limits, such as
`limits.max_cyclomatic_complexity` and `limits.max_function_parameters`, come from
[limits](/reference/gspot-toml/#limits). `python.docstring_convention` sets the pydocstyle convention. To turn a Ruff
rule off, ignore it by its code: `gspot ignore python/ruff --rule <code> --reason "<why>"`.

## Stylelint

Stylelint options go in `tools.stylelint.rules`:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
```

This setting requires the long form of hexadecimal colors, such as `#ffffff`, at both levels. To allow a property with
a `-webkit-` prefix that your project needs, use the `ignoreProperties` option of `property-no-vendor-prefix`. To allow
an at-rule, use the `ignoreAtRules` option of `at-rule-no-unknown`:

```toml
[tools.stylelint.rules]
at-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]
```

## markdownlint

Each markdownlint entry takes a table of options. It takes no `true` or `false` value, and no `default` key:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

With this option, MD024 reports a repeated heading anywhere in a document, not only under the same parent heading.

[Tool options](/reference/gspot-toml/#tools) lists the accepted fields.
