---
title: CSS
description: Configure Stylelint for CSS, Vue, Svelte, and Tailwind.
---

Stylelint checks styles and writes its tool options from `gspot.toml`. Use [Lint rule options](/configure/lint-rules/#stylelint)
to change a rule's options.

## Component styles

Vue and Svelte own their component style parsers and syntax exemptions. Plain CSS receives
neither framework's exemptions. Tailwind directives and `theme()` require a declared
`tailwindcss` dependency in the nearest containing npm project. gspot installs the HTML parser package only when Stylelint reads component styles from a selected framework.

Value validation exempts declarations containing `theme()` or Vue's `v-bind()`. Other
declarations still receive value checks.
Vue variables inside `v-bind()` retain their case. CSS keywords still require lowercase.
