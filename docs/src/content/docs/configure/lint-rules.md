---
title: Lint rule options
description: Set lint rule options in gspot.toml instead of the tool files.
---

Set lint rule options in `gspot.toml`; gspot writes them into the tool file. Options take effect only for lint rules
that the selected level turns on. To turn a lint rule off, use an [ignore](/use/ignore/) with a reason.

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
Run `gspot explain eslint/eqeqeq` to read the options of the lint rule.

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

## Custom text components

If a component wraps the React Native `Text`, add its name to the `skip` option of the lint rule:

```toml
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ThemedText"] }]
```

This allows text inside `ThemedText`. The lint rule still reports bare text inside a `View`.
When other projects use different components, set the option in the scope of the native project.
