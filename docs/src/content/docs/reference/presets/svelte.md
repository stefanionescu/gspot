---
title: "Svelte"
description: "Svelte components: ESLint reads the markup and the script together, with every recommended rule of the Svelte plugin as an error."
---

Svelte components: ESLint reads the markup and the script together, with every recommended rule of the Svelte plugin as an error.

Kind: framework. Requires: `javascript`.

## Tools

- eslint-plugin-svelte 3.23.0
- svelte-eslint-parser 1.8.1

## Generated configuration

- `.gspot/eslint.config.mjs`

## Checks

| Check                                              | Stage  | What it finds                                                                                            |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| [`svelte/eslint`](/reference/rules/svelte/eslint/) | commit | Runs ESLint with the Svelte plugin over every .svelte file. It reads the markup and the script together. |

## Rule files

- `framework/svelte/SVELTE.md`
