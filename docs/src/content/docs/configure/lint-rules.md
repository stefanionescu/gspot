---
title: Lint rule options
description: Set lint rule options in gspot.toml instead of the tool files.
---

Set lint rule options in `gspot.toml`; gspot writes them into the tool file. Options take effect only for lint rules
that the selected level turns on. To turn a lint rule off, use an [ignore](/use/ignore/) with a reason.

None of these settings turns a lint rule on or off, and none takes a severity; the level decides which rules run.

| Tool                  | Setting                                              | Takes                                 |
| --------------------- | ---------------------------------------------------- | ------------------------------------- |
| ESLint                | `tools.eslint.rules`                                 | An option array for each rule ID      |
| ESLint for some files | `[[tools.eslint.override]]` with `paths` and `rules` | The same, for the files of `paths`    |
| Stylelint             | `tools.stylelint.rules`                              | The options of each rule              |
| markdownlint          | `tools.markdownlint.rules`                           | An option table for each rule ID      |
| yamllint              | `tools.yamllint.rules`                               | The options of each rule              |
| commitlint            | `tools.commitlint.rules`, `types`, and `scopes`      | Rule options, and the accepted values |

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

This table holds options only; do not put a severity such as `"off"` in it.
`gspot explain eslint/eqeqeq` links the documentation of the lint rule, which lists its options, and prints the
commands that set its options or ignore it.

## Ruff

Ruff takes no lint rule options from `gspot.toml`. Its limits, such as `limits.cyclomatic_complexity` and
`limits.function_parameters`, come from [limits](/reference/gspot-toml/limits/), and `tools.ruff.docstring_convention`
sets the pydocstyle convention. To turn a Ruff lint rule off, ignore it by its code:
`gspot ignore python/ruff --rule <code> --reason "<why>"`.

## Stylelint

Stylelint options go in `tools.stylelint.rules`:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
number-max-precision = 0
```

This requires long hexadecimal colors at both levels. The precision option counts only at `all`, where that lint rule runs.
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

See [tool options](/reference/gspot-toml/tools/) for the accepted fields.
