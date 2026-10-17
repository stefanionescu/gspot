# @gspothq/eslint-plugin

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

| Rule                           | In          | What it finds                                                                     |
| ------------------------------ | ----------- | --------------------------------------------------------------------------------- |
| `gspot/no-client-env`          | recommended | Private environment reads in client modules.                                      |
| `gspot/no-comments-in-imports` | all         | Comments inside or right after the import block.                                  |
| `gspot/import-boundaries`      | all         | Relative imports that leave the nearest boundary folder.                          |
| `gspot/no-alias-exports`       | all         | Exported constants that only rename another value.                                |
| `gspot/no-index-imports`       | all         | Imports that name an index file instead of the module that declares the value.    |
| `gspot/no-trivial-files`       | all         | Files with only forwarding code, aliases, re-exports, or small functions.         |
| `gspot/no-trivial-functions`   | all         | Unexported named functions of two statements or fewer, used in one place at most. |
| `gspot/require-server-only`    | none        | Selected server modules that do not import `server-only` or declare `use server`. |

The [rule reference](https://generativespotting.com/reference/eslint-plugin/) gives the options, defaults,
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

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
