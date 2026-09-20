---
title: "TypeScript"
description: "The strict compiler, ESLint with typescript-eslint and the gspot structural rules over every TypeScript file, and knip for dead code."
---

The strict compiler, ESLint with typescript-eslint and the gspot structural rules over every TypeScript file, and knip for dead code.

Kind: language. Requires: `javascript`, `structure`.

## Tools

- tsc 5.9.3
- typescript-eslint 8.70.0
- eslint-import-resolver-typescript 4.4.5

## Generated configuration

- `.gspot/eslint.config.mjs`
- `.gspot/tsconfig.base.json`

## Checks

| Check                                                                        | Stage  | What it finds                                                                     |
| ---------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| [`typescript/tsc`](/reference/rules/typescript/tsc/)                         | commit | Checks that every TypeScript file type-checks with the strict compiler options.   |
| [`typescript/eslint`](/reference/rules/typescript/eslint/)                   | commit | Runs ESLint with the shipped rule set over every TypeScript file.                 |
| [`integrity/tsconfig-options`](/reference/rules/integrity/tsconfig-options/) | commit | Checks that every tsconfig still turns on the strict options the preset requires. |

## Settings

- `tools.typescript.types`: The type packages every tsconfig loads, like bun, or node.
- `tools.typescript.paths`: The path aliases every tsconfig gets, in tsconfig paths form; read from the existing tsconfig at init.

## Rule files

- `language/TYPESCRIPT.md`
- `language/naming/TYPESCRIPT.md`
