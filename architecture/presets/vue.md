# `vue`

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest. Recommends: typescript, css, vitest.

## Detects and claims

|        |                                     |
| ------ | ----------------------------------- |
| Detect | `vue` in dependencies, `.vue` files |
| Claims | `.vue`                              |

## Tools

As libraries: eslint-plugin-vue 10.11.0, vue-eslint-parser 10.4.1,
eslint-plugin-vuejs-accessibility 2.6.0, and eslint-plugin-testing-library 7.16.2.

As a command: vue-tsc 3.3.11.

## Generated configuration

Every shared rule of the javascript and typescript presets reads the files of this framework
too, with the same limits (D-137). A rule this preset turns off stands in its manifest with a
reason (D-138), and the page lists each one.

The preset claims `.vue`, so the list of code files of the ESLint config holds it. The config
gains the `flat/recommended` blocks of the Vue plugin and of the accessibility plugin, with every
rule that is on set to error. One more block over `.vue` files sets the parser, and hands it the
TypeScript parser for the script where typescript is selected. It adds: `vue/no-v-html`,
`vue/block-lang`, `vue/define-props-declaration`, `vue/define-emits-declaration`,
`vue/no-unused-refs`, `vue/require-typed-ref`, `vue/html-button-has-type`, and
`vue/no-template-target-blank`. At the `all` level: `vue/component-api-style` (script setup),
`vue/no-useless-v-bind`, and `vue/prefer-true-attribute-shorthand`.

Over test files, the `vue` set of the testing-library plugin. Prettier formats `.vue` by itself.
Where css is selected, stylelint reads the `<style>` block through `postcss-html`. The naming
engine reads the script block (D-140).

## Names

`[[naming.rules]]` of this preset: a component file is in PascalCase, and a composable starts
with `use`.

## Turned off

Nothing.

## Checks

| Id              | Stage  | Command                                                                     |
| --------------- | ------ | --------------------------------------------------------------------------- |
| `vue/typecheck` | commit | `vue-tsc --noEmit`; takes over `typescript/tsc` in the scope (`takes_over`) |

The ESLint rules run in the one ESLint check (D-137). `javascript/required-rules` holds
`vue/no-v-html`, `vue/require-v-for-key`, `vue/no-mutating-props`, and
`vue/no-use-v-if-with-v-for` for `.vue` files.

## Settings

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <id>`.

## Rule files

`framework/vue/VUE.md`.
