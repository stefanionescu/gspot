# gspot ESLint Plugin

ESLint rules for private environment reads in client code, duplicate barrel exports, trivial
files and functions, and the layout of imports and files. The
[gspot](https://github.com/stefanionescu/gspot) CLI sets this plugin up for you. You can also
use it on its own with ESLint 9.38.0 or newer.

## Install

```shell
npm install --save-dev @gspothq/eslint-plugin
```

## Configure

Add the recommended configuration to `eslint.config.mjs`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.recommended];
```

`recommended` turns on two rules as errors:

- `gspot/no-client-env`
- `gspot/no-duplicate-exports`

`gspot.configs.all` adds the rules for imports, layout, declaration order, trivial files, and
trivial functions. Neither configuration turns on `require-server-only` or
`max-barrel-reexports`. Both configurations hold stable rules only.

## Example: a private variable in client code

This client module reads a private environment variable:

```javascript
"use client";
export const endpoint = process.env.PRIVATE_API_URL;
```

`gspot/no-client-env` reports the read at line 2, column 25. Keep the private work on
the server, and let the client call a public route:

```javascript
"use client";
export const endpoint = "/api/search";
```

The corrected module has no finding. Your server still needs to answer `/api/search`.

## Select server modules

`require-server-only` needs to know which files hold server code, so select them yourself:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [{
    files: ['server/**/*.js'],
    plugins: { gspot },
    rules: { 'gspot/require-server-only': 'error' },
}];
```

The rule reports a selected module without `import 'server-only'`. Add that import at the top
of the module.

## Check TypeScript

The plugin brings no TypeScript parser. Install `@typescript-eslint/parser`, then select your
TypeScript files:

```javascript
import gspot from '@gspothq/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [{
    ...gspot.configs.recommended,
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tsParser },
}];
```

The [rule reference](https://gspot.dev/reference/plugin/no-client-env/) lists every
rule with its options and examples. The package ships ECMAScript and CommonJS modules with
TypeScript declarations, and `gspot.rules` holds each rule.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
