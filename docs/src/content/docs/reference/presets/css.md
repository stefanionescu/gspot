---
title: "CSS"
description: "Stylesheets: stylelint with the standard rules, Prettier for layout, and CSS module classes that are both defined and used."
---

Stylesheets: stylelint with the standard rules, Prettier for layout, and CSS module classes that are both defined and used.

Kind: language. Requires: `formatting`.

## Tools

- stylelint 16.23.1
- stylelint-config-standard 39.0.0

## Generated configuration

- `.gspot/stylelint.json`

## Checks

| Check                                                          | Stage  | What it finds                                                                                                           |
| -------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| [`css/stylelint`](/reference/rules/css/stylelint/)             | commit | Lints every stylesheet with the standard stylelint rules: unknown properties, overridden selectors, and invalid values. |
| [`integrity/css-usage`](/reference/rules/integrity/css-usage/) | push   | For every CSS module, checks that the code uses each class it defines, and that each class the code reads is defined.   |

## Rule files

- `language/CSS.md`
- `language/naming/CSS.md`
