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

Ruff options use `tools.ruff.rules`. The table names follow Ruff rule groups.
Use `gspot explain python/ruff` to inspect the generated check.

## Stylelint

Stylelint options go in `tools.stylelint.rules`:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
number-max-precision = 0
```

This requires long hexadecimal colors at both levels. The precision option counts only at `all`, where that lint rule runs.
Severity stays `error`. Ignore a finding with `gspot ignore css/stylelint --rule <rule> --reason "<why>"`.
To allow a WebKit property that your project needs, use the `ignoreProperties` option of `property-no-vendor-prefix`.
To allow an at-rule, use the `ignoreAtRules` option of `at-rule-no-unknown`:

```toml
[tools.stylelint.rules]
at-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]
```

Vue and Svelte styles use the parser and exemptions of their framework; plain CSS gets neither. Tailwind directives
and `theme()` need a `tailwindcss` dependency in the nearest npm project. Value checks skip declarations with
`theme()` or `v-bind()`, and variables inside `v-bind()` keep their case.

## markdownlint

Each markdownlint entry takes an option table, without an on or off value or a `default` key:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

This reports repeated headings throughout a document, not only under the same parent heading.
Both levels check image alt text. Ignore a finding with `gspot ignore markdown/markdownlint --rule <rule> --reason "<why>"`.

See [tool options](/reference/gspot-toml/tools/) for the accepted fields.

## Custom text components

If a component wraps the React Native `Text`, add its name to the `skip` option of the lint rule:

```toml
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ThemedText"] }]
```

This allows text inside `ThemedText`. The lint rule still reports bare text inside a `View`.
When other projects use different components, set the option in the scope of the native project.
