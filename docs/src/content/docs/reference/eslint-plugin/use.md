---
title: Use the ESLint plugin
description: Install and configure the published plugin without the gspot CLI.
---

Lint rules for ESLint aimed at code that AI coding agents often write. They flag files and functions that only forward a call,
exports that only rename a value, and imports through index files. They also flag comments mixed into import
blocks and private environment variables read in client code.

The [gspot CLI](https://www.npmjs.com/package/@gspothq/cli) sets this plugin up for you. Install it yourself only
when you run ESLint without gspot.

## Install

You need Node.js 22.12 or newer and ESLint 9.38.0 or newer with a flat config file, such as
`eslint.config.mjs`.

| Package manager | Command                                                |
| --------------- | ------------------------------------------------------ |
| npm             | `npm install --save-dev @gspothq/eslint-plugin eslint` |
| pnpm            | `pnpm add --save-dev @gspothq/eslint-plugin eslint`    |
| Yarn            | `yarn add --dev @gspothq/eslint-plugin eslint`         |
| Bun             | `bun add --dev @gspothq/eslint-plugin eslint`          |

## Use

Add a plugin config to `eslint.config.mjs`. `recommended` turns on `gspot/no-client-env`; `all` turns on every
lint rule except `gspot/require-server-only`.

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.all];
```

A finding looks like this:

```text
src/orders.js
  15:14  error  getOrderTotal only renames orderTotal. Export the source value directly instead of an alias  gspot/no-alias-exports
```

## Rules

The [rule reference](/reference/eslint-plugin/) gives the options, defaults,
and examples of each lint rule.

Turn on `gspot/require-server-only` for the files that hold server code:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [{ files: ['src/server/**/*.js'], plugins: { gspot }, rules: { 'gspot/require-server-only': 'error' } }];
```

`gspot/import-boundaries` reads its folders relative to the working folder of ESLint. To use another root, set
`settings: { gspot: { root: import.meta.dirname } }`.

## TypeScript

Install `@typescript-eslint/parser` and TypeScript 4.8.4 or newer and older than 6.1.0, then select your
TypeScript files:

```javascript
import gspot from '@gspothq/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        ...gspot.configs.all,
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tsParser, parserOptions: { projectService: true } },
    },
];
```

`gspot/no-trivial-functions` uses the type information from `projectService` to skip a method that an
interface or a base class declares.
