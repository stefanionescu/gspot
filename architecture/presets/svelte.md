# `svelte`

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest. Recommends: typescript, css, vitest.

## Detects and claims

|        |                                           |
| ------ | ----------------------------------------- |
| Detect | `svelte` in dependencies, `.svelte` files |
| Claims | `.svelte`                                 |

## Tools

As libraries: eslint-plugin-svelte 3.23.0, svelte-eslint-parser 1.8.1, prettier-plugin-svelte
4.1.1, and eslint-plugin-testing-library 7.16.2.

As a command: svelte-check 4.7.6.

## Generated configuration

Every shared rule of the javascript and typescript presets reads the files of this framework
too, with the same limits (D-137). A rule this preset turns off stands in its manifest with a
reason (D-138), and the page lists each one.

The preset claims `.svelte`, `.svelte.js` and `.svelte.ts`, so the list of code files of the
ESLint config holds them. The config gains the `recommended` blocks of the Svelte plugin, with
every rule that is on set to error. One more block sets the parser, and hands it the TypeScript
parser for the script where typescript is selected. It adds: `svelte/no-at-html-tags`,
`svelte/require-each-key`, `svelte/no-target-blank`, `svelte/button-has-type`,
`svelte/no-reactive-reassign`, and `svelte/block-lang`. At the `all` level:
`svelte/no-useless-mustaches` and `svelte/prefer-const`.

Over test files, the `svelte` set of the testing-library plugin. Prettier formats `.svelte`
through `prettier-plugin-svelte`. Where css is selected, stylelint reads the `<style>` block
through `postcss-html`. The naming engine reads the script block (D-140). The plugin needs the
`svelte` package itself, which the repository owns.

## Names

`[[naming.rules]]` of this preset: a component file is in PascalCase, and the route files of
SvelteKit keep their names (`+page.svelte`, `+layout.ts`, `+server.ts`, `+error.svelte`).

## Turned off

| Rule                           | Why                                                           |
| ------------------------------ | ------------------------------------------------------------- |
| `structure/single-file-folder` | SvelteKit finds a route file by its name, one for each folder |

## Checks

| Id             | Stage  | Command                                                                                                                                 |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte/check` | commit | `svelte-check --fail-on-warnings`; takes over `typescript/tsc` in the scope, and reports the accessibility warnings of the compiler too |

The ESLint rules run in the one ESLint check (D-137). `integrity/required-rules` holds
`svelte/no-at-html-tags`, `svelte/require-each-key`, and `svelte/no-target-blank`.

## Settings

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <id>`.

## Rule files

`framework/svelte/SVELTE.md`.
