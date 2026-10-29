---
title: Lint rule options
description: Set lint rule options in gspot.toml instead of the config files.
---

Set lint rule options in `gspot.toml`; gspot writes them into the config file. To turn a lint rule off, use an
[ignore](/use/ignore/) with a reason.

gspot refuses options for an ESLint or Stylelint rule that the selected level does not run. The refusal names the
case: a rule that runs only at level `all`, or a rule that gspot loads and runs at no level:

```text
n/no-process-exit runs only at level all. gspot sets options only for the rules that run at level basic.
gspot runs id-length at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.
```

None of these settings turns a lint rule on or off, and none takes a severity; the level decides which rules run.

| Tool                  | Setting                                              | Takes                                 |
| --------------------- | ---------------------------------------------------- | ------------------------------------- |
| ESLint                | `tools.eslint.rules`                                 | An option array for each rule ID      |
| ESLint for some files | `[[tools.eslint.override]]` with `paths` and `rules` | The same, for the files of `paths`    |
| Stylelint             | `tools.stylelint.rules`                              | The options of each rule              |
| markdownlint          | `tools.markdownlint.rules`                           | An option table for each rule ID      |
| yamllint              | `tools.yamllint.rules`                               | The options of each rule              |
| commitlint            | `tools.commitlint.rules`, `types`, and `scopes`      | Rule options, and the accepted values |

gspot writes the options of some rules from a setting, and refuses them in these tables. Change the setting instead:

| Rules                                                                                                                                                    | Setting                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `max-lines`, `max-lines-per-function`, `max-params`, `max-depth`, `max-statements`, `max-nested-callbacks`, `complexity`, `sonarjs/cognitive-complexity` | The matching key of [limits](/reference/gspot-toml/#limits)                                                        |
| `gspot/no-trivial-functions`                                                                                                                             | `limits.trivial_function_statements`                                                                               |
| `gspot/no-trivial-files`, `barrel-files/avoid-barrel-files`                                                                                              | `structure.reexports`                                                                                              |
| `sonarjs/no-identical-functions`                                                                                                                         | `duplication.min_lines`                                                                                            |
| `no-restricted-imports`                                                                                                                                  | `tools.eslint.restricted_imports`                                                                                  |
| `gspot/import-boundaries`                                                                                                                                | `javascript.import_boundaries`, see [Import rules](/configure/import-rules/#keep-relative-imports-inside-a-folder) |
| `n/file-extension-in-import`                                                                                                                             | `tools.eslint.import_extension`                                                                                    |

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
This table holds options only, without a severity; the level decides which rules run. To turn eqeqeq off, run gspot ignore javascript/eslint --rule eqeqeq --reason "<why>".
```

`gspot explain eslint/eqeqeq` links the documentation of the lint rule, which lists its options, and prints the
commands that set its options or ignore it.

## Your own ESLint rules

A plugin module in the repository adds your own rules. Each `[[tools.eslint.plugins]]` record names the rule prefix,
the module, and the rules to turn on as errors for the code files of its scope:

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

## Ruff

Ruff takes no lint rule options from `gspot.toml`. Its limits, such as `limits.cyclomatic_complexity` and
`limits.function_parameters`, come from [limits](/reference/gspot-toml/#limits), and `tools.ruff.docstring_convention`
sets the pydocstyle convention. To turn a Ruff lint rule off, ignore it by its code:
`gspot ignore python/ruff --rule <code> --reason "<why>"`.

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
