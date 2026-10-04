# gspot ESLint Plugin

ESLint rules for private environment reads in client code, duplicate barrel exports, trivial
files and functions, and the layout of imports and files. The
[gspot](https://github.com/stefanionescu/gspot) CLI sets this plugin up for you. You can also
use it on its own with Node.js 22 or newer and ESLint 9.38.0 or newer.

## Contents

- [Status](#status)
- [Install](#install)
- [Configure](#configure)
- [Example](#example-a-private-variable-in-client-code)
- [Rules that need options](#rules-that-need-options)
- [Check TypeScript](#check-typescript)
- [License](#license)

## Status

The plugin is not published on npm yet. Build it from the source checkout using [Contributing](https://github.com/stefanionescu/gspot/blob/main/CONTRIBUTING.md). The following installation applies after publication.

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

`recommended` turns on two rules as errors:

- `gspot/no-client-env`
- `gspot/no-duplicate-exports`

`gspot.configs.all` adds the rules for imports, layout, declaration order, trivial files, and
trivial functions. It also forbids re-exports. Select `require-server-only`, `max-barrel-reexports`,
`import-extensions`, and `instances-in-registry` yourself with the files and options they
need.

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

## Rules that need options

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

The rules about where code lives have no default folders, because the folders of a project are
its own. Without options they report nothing:

- `import-direction` takes `roles`: the globs of your types, tests, harness, config, env, and
  runtime files.
- `env-owner` takes `owners`: the files that may read `process.env` or `import.meta.env`.
- `no-helpers-beside-tests` takes `harness`: the folder the shared test helpers move to.
- `no-cross-scope-imports` takes `scopes`: the project folders that do not import each other.

These paths start at `settings.gspot.root`, or at the working directory of ESLint when you omit
the setting. To set the root explicitly, add this block to your configuration:

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

The [rule reference](https://gspot.dev/reference/plugin/) lists every
rule with its options and examples. The package ships ECMAScript and CommonJS modules with
TypeScript declarations, and `gspot.rules` holds each rule.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
