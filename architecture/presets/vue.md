# `vue`

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

## Detects and claims

|        |                                     |
| ------ | ----------------------------------- |
| Detect | `vue` in dependencies, `.vue` files |
| Claims | `.vue`                              |

## Tools

eslint-plugin-vue 10.11.0 and vue-eslint-parser 10.4.1, as libraries.

## Generated configuration

The ESLint config gains the `flat/recommended` blocks of the Vue plugin, with every rule that is on set to error. The plugin
ships some as warnings, and the gate allows no warning. One more block over `.vue` files sets the parser and
hands it the TypeScript parser for the script where typescript is selected. It adds:
`vue/no-v-html`, `vue/component-api-style` (script setup), `vue/block-lang`, `vue/define-props-declaration`,
`vue/define-emits-declaration`, `vue/no-unused-refs`, `vue/no-useless-v-bind`,
`vue/prefer-true-attribute-shorthand`, `vue/require-typed-ref`, `vue/html-button-has-type`, and
`vue/no-template-target-blank`.

The rules of the javascript and typescript presets read `js` and `ts` files. They do not read the
script of a component file, because the component plugin owns that file.

## Checks

| Id           | Stage  | Command                                                                      |
| ------------ | ------ | ---------------------------------------------------------------------------- |
| `vue/eslint` | commit | the ESLint command of `typescript/eslint`, over `.vue` files, with its fixer |

The check shares `.gspot/baselines/eslint.json` with the other ESLint checks: ESLint keys the file
by path, and no two checks read one path. `integrity/required-rules` holds `vue/no-v-html`, `vue/require-v-for-key`, `vue/no-mutating-props`, and `vue/no-use-v-if-with-v-for` for `.vue`
files.

## Settings

None. A rule the repository decides against is `gspot ignore vue/eslint --rule <id>`.

## Rule files

`framework/vue/VUE.md`.
