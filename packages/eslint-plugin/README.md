# gspot ESLint Plugin

ESLint rules for private environment reads in client code, trivial files and functions,
and the layout of imports and files. The
[gspot](https://github.com/stefanionescu/gspot) CLI sets this plugin up for you. You can also
use it on its own with Node.js 22.12 or newer and ESLint 9.38.0 or newer.

## Contents

- [Install](#install)
- [Configure](#configure)
- [Example](#example-a-private-variable-in-client-code)
- [Rule reference](#rule-reference)
- [Check TypeScript](#check-typescript)
- [License](#license)

## Install

```shell
npm install --save-dev --save-exact @gspothq/eslint-plugin
```

## Configure

Add the recommended configuration to `eslint.config.mjs`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.recommended];
```

`recommended` turns on `gspot/no-client-env` as an error.

`gspot.configs.all` also turns on the house-style rules: header-first, import-boundaries,
no-alias-exports, no-index-imports, no-trivial-files and no-trivial-functions.

## Example: a private variable in client code

The rule detects direct environment reads without declared globals. Declare runtime globals
only to detect aliases such as `const host = process`.

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

## Rule reference

The [generated rule reference](https://generativespotting.com/reference/eslint-plugin/) lists each
rule's level, options, defaults, and examples.

`import-boundaries` reads folder paths from the repository root. Paths start at `settings.gspot.root`, or at the working directory of
ESLint when you omit the setting:

```javascript
{
    settings: { gspot: { root: process.cwd() } },
}
```

## Check TypeScript

The plugin brings no TypeScript parser. Install `@typescript-eslint/parser`, then select your
TypeScript files:

```javascript
import gspot from '@gspothq/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [{
    ...gspot.configs.all,
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
        parser: tsParser,
        parserOptions: { projectService: true },
    },
}];
```

`projectService` provides the type information that `no-trivial-functions` needs to exempt
methods declared by an interface or base class. `gspot.configs.all` includes that rule.

The package ships ECMAScript modules with
TypeScript declarations, and `gspot.rules` holds each rule.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
