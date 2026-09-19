---
title: "Vue"
description: "Vue single-file components: ESLint reads the template and the script together, with every recommended rule of the Vue plugin as an error."
---

Vue single-file components: ESLint reads the template and the script together, with every recommended rule of the Vue plugin as an error.

Kind: framework. Requires: `javascript`.

## Tools

- eslint-plugin-vue 10.11.0
- vue-eslint-parser 10.4.1

## Generated configuration

- `.gspot/eslint.config.mjs`

## Checks

| Check                                        | Stage  | What it finds                                                                                      |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| [`vue/eslint`](/reference/rules/vue/eslint/) | commit | Runs ESLint with the Vue plugin over every .vue file. It reads the markup and the script together. |

## Rule files

- `framework/vue/VUE.md`
