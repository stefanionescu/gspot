# @gspothq/eslint-plugin

ESLint rules for code that AI coding agents often write.

The rules flag files that only forward to another module, functions of a few statements, and exports that only rename a
value. They flag imports through index files and relative imports that leave their folder. They also flag comments mixed
into import blocks and private environment variables read in client code.

The [gspot CLI](https://www.npmjs.com/package/@gspothq/cli) sets this plugin up for you. Install it yourself only
when you run ESLint without gspot.

## Install

Use an ESLint flat config file, such as `eslint.config.mjs`. The [rule reference](https://generativespotting.com/reference/eslint-plugin/) lists the supported Node.js and ESLint versions.

| Package manager | Command                                                |
| --------------- | ------------------------------------------------------ |
| Bun             | `bun add --dev @gspothq/eslint-plugin eslint`          |
| npm             | `npm install --save-dev @gspothq/eslint-plugin eslint` |
| pnpm            | `pnpm add --save-dev @gspothq/eslint-plugin eslint`    |
| Yarn            | `yarn add --dev @gspothq/eslint-plugin eslint`         |

## Use

Add a plugin config to `eslint.config.mjs`. The [rule reference](https://generativespotting.com/reference/eslint-plugin/) lists which rules `recommended` and `all` enable.

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.all];
```

The [rule reference](https://generativespotting.com/reference/eslint-plugin/) lists each rule with its options.

Turn on `gspot/require-server-only` for the files that hold server code:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [{ files: ['src/server/**/*.js'], plugins: { gspot }, rules: { 'gspot/require-server-only': 'error' } }];
```

`gspot/import-boundaries` reads its folders relative to the working folder of ESLint. To use another root, set
`settings: { gspot: { root: import.meta.dirname } }`.

## TypeScript

Install `@typescript-eslint/parser` with the TypeScript version it supports, then select your TypeScript files:

```javascript
import gspot from '@gspothq/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        ...gspot.configs.all,
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tsParser },
    },
];
```

## Magic numbers

`gspot/no-magic-numbers` reports the numbers that `@typescript-eslint/no-magic-numbers` reports. It skips the
initializer of a module-level `const`, where an array of numbers counts as named. It takes the options of that rule
and needs `@typescript-eslint/eslint-plugin` installed:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [{ files: ['**/*.ts'], plugins: { gspot }, rules: { 'gspot/no-magic-numbers': ['error', { ignore: [0, 1] }] } }];
```

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
