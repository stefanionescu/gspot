---
title: CSS
description: Configure Stylelint for CSS, Vue, Svelte, and Tailwind.
---

Stylelint checks styles, with options from `gspot.toml`. To change the options of a lint rule, see
[Lint rule options](/configure/lint-rules/#stylelint).

## Component styles

The Vue and Svelte configurations hold their own style parsers and syntax exemptions; plain CSS gets neither.
Tailwind directives and `theme()` need a `tailwindcss` dependency in the nearest npm project. gspot installs the HTML parser package only when Stylelint reads component styles from a selected framework.

Value checks skip declarations that contain `theme()` or the Vue `v-bind()`. Variables inside `v-bind()` keep
their case, but CSS keywords need lowercase letters.
