# `svelte`

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

## Detects and claims

|        |                                           |
| ------ | ----------------------------------------- |
| Detect | `svelte` in dependencies, `.svelte` files |
| Claims | `.svelte`                                 |

## Tools

eslint-plugin-svelte 3.23.0 and svelte-eslint-parser 1.8.1, as libraries.

## Generated configuration

The ESLint config gains the `recommended` blocks of the Svelte plugin, with every rule that is on set to error. The plugin
ships some as warnings, and the gate allows no warning. One more block over `.svelte` files sets the parser and
hands it the TypeScript parser for the script where typescript is selected. It adds:
`svelte/no-at-html-tags`, `svelte/require-each-key`, `svelte/no-target-blank`, `svelte/button-has-type`,
`svelte/no-reactive-reassign`, `svelte/no-useless-mustaches`, `svelte/prefer-const`, and
`svelte/block-lang`.

The block also reads `.svelte.js` and `.svelte.ts` modules, which hold runes. The plugin needs the
`svelte` package itself, which the repository owns.

## Checks

| Id              | Stage  | Command                                                                         |
| --------------- | ------ | ------------------------------------------------------------------------------- |
| `svelte/eslint` | commit | the ESLint command of `typescript/eslint`, over `.svelte` files, with its fixer |

The check shares `.gspot/baselines/eslint.json` with the other ESLint checks: ESLint keys the file
by path, and no two checks read one path. `integrity/required-rules` holds `svelte/no-at-html-tags`, `svelte/require-each-key`, and `svelte/no-target-blank` for `.svelte`
files.

## Settings

None. A rule the repository decides against is `gspot ignore svelte/eslint --rule <id>`.

## Rule files

`framework/svelte/SVELTE.md`.
