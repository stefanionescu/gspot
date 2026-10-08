# gspot ESLint Plugin

ESLint rules for private environment reads in client code, trivial files and functions,
and the layout of imports and files. The
[gspot](https://github.com/stefanionescu/gspot) CLI sets this plugin up for you. You can also
use it on its own with Node.js 22 or newer and ESLint 9.38.0 or newer.

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

`gspot.configs.all` also turns on the rules selected at level `all`. The CLI supplies
project options where they apply.

## Example: a private variable in client code

Declare the runtime globals that your code uses. For this example, declare `process` in
`eslint.config.mjs`:

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.recommended, {
    languageOptions: { globals: { process: 'readonly' } },
}];
```

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

The [generated rule reference](https://generativespotting.com/reference/plugin/) lists each
rule's preset, options, defaults, and examples. It identifies rules that need project options
before they report findings.

Repository-relative paths start at `settings.gspot.root`, or at the working directory of
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
methods declared by an interface or base class. That rule is part of `gspot.configs.all`.

The [rule reference](https://generativespotting.com/reference/plugin/) lists every
rule with its options and examples. The package ships ECMAScript and CommonJS modules with
TypeScript declarations, and `gspot.rules` holds each rule.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
