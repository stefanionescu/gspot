# CSS Configuration

## Stylesheet rule options

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
