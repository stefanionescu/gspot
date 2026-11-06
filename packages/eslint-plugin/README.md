# @gspothq/eslint-plugin

ESLint rules for code that AI coding agents often write.

The plugin reports:

- Files that only forward to another module, functions of a few statements, and exports that only rename a value.
- Relative imports that leave a boundary folder.
- Logic bugs in comparisons, loops, returns, and regular expressions.
- Mistakes in tests and assertions for Jest, Vitest, Bun, Mocha, Jasmine, chai, Playwright, and Cypress.
- Wrong or outdated use of React, Vue, lodash, jQuery, and Axios.
- Accessibility problems in JSX tables and `<object>` elements.
- Security problems in web servers, cookies, cryptography, and cloud stacks.

The [gspot CLI](https://www.npmjs.com/package/@gspothq/cli) sets up this plugin. Install the plugin yourself only when
you run ESLint without gspot.

## Install

| Package manager | Command                                                |
| --------------- | ------------------------------------------------------ |
| Bun             | `bun add --dev @gspothq/eslint-plugin eslint`          |
| npm             | `npm install --save-dev @gspothq/eslint-plugin eslint` |
| pnpm            | `pnpm add --save-dev @gspothq/eslint-plugin eslint`    |
| Yarn            | `yarn add --dev @gspothq/eslint-plugin eslint`         |

## Use

Add the `recommended` or `all` config to `eslint.config.mjs`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.all];
```

## TypeScript

Install `@typescript-eslint/parser` with the TypeScript version it supports, then select your TypeScript files.
`projectService` gives the rules that read types their type information:

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

## Rule reference

[Rule reference](https://generativespotting.com/reference/eslint-plugin/)

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
