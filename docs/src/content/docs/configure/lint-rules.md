---
title: Lint rule options
description: Change rule options while keeping the generated tool files reproducible.
---

Set tool rule options in `gspot.toml`, then let gspot write the tool file. To turn a rule off, use an
[ignore](/use/ignore/) with a reason.

## ESLint

For `export const matches = (value) => value == null;`, the `eqeqeq` rule can report:

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

The options belong to the rule. Do not put a severity such as `"off"` in this table.
Use `gspot explain eslint/eqeqeq` to read its options.

## Ruff

Ruff options use `tools.ruff.rules`. The table names follow Ruff rule groups.
Use `gspot explain python/ruff` to inspect the generated check.

## Stylelint

Stylelint options apply only to rules active at the selected level:

```toml
[tools.stylelint.rules]
color-hex-length = "long"
number-max-precision = 0
```

This requires long hexadecimal colors at both levels. The precision option applies at `all`, where the rule runs.
Severity stays `error`. Ignore a finding with `gspot ignore css/stylelint --rule <rule> --reason "<why>"`.
Project-specific WebKit properties can use the tool's own `ignoreProperties` option of `property-no-vendor-prefix`.
At-rule options use the tool options of `at-rule-no-unknown`:

```toml
[tools.stylelint.rules]
at-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]
```

Vue and Svelte own their component style parsers and syntax exemptions. Plain CSS receives
neither framework's exemptions. Tailwind directives and `theme()` require a declared
`tailwindcss` dependency in the nearest containing npm project. gspot installs the HTML parser package only when Stylelint reads component styles from a selected framework.

Value validation exempts declarations containing `theme()` or Vue's `v-bind()`. Other
declarations still receive value checks.
Vue variables inside `v-bind()` retain their case. CSS keywords still require lowercase.

## markdownlint

Markdown rule settings hold tool option tables, without an enable/disable value or a `default` key:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

This reports repeated headings throughout a document, rather than only under the same parent heading.
The selected level decides which rules run. Options cannot enable a rule outside that level.
Both levels check image alt text. Accept a specific finding with `gspot ignore markdown/markdownlint --rule <rule> --reason "<why>"`.

See [tool options](/reference/gspot-toml/tools/) for the accepted fields.

## Custom text components

If a component wraps React Native's `Text`, include its name in the rule's `skip` option:

```toml
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ThemedText"] }]
```

Option arrays omit the severity. The selected level decides which rules run, and options
apply only where that level enables the rule. This allows text inside `ThemedText`. The rule still reports bare text inside a `View`.
Set the option in the native project's scope when other projects use different components.
