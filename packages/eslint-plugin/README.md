# @gspot/eslint-plugin

ESLint rules that detect private environment reads in client code, duplicate barrel exports,
and trivial files and functions in JavaScript and TypeScript. Additional rules check import
boundaries, declaration order, and file organization. The plugin runs without the gspot CLI.

**Unreleased:** build the plugin from a source checkout. Follow the
[source setup and executable example](https://github.com/stefanionescu/gspot/blob/main/docs/src/content/docs/guides/client-environment.md)
to install it in a disposable project. Local package builds do not establish npm availability.
The plugin requires ESLint 9.38.0 or newer.

## Configure ESLint

Add the recommended flat configuration to `eslint.config.mjs`:

```javascript
import gspot from '@gspot/eslint-plugin';

export default [gspot.configs.recommended];
```

`recommended` enables four rules at error severity:

- `gspot/no-client-environment`
- `gspot/no-duplicate-barrel-exports`
- `gspot/no-trivial-files`
- `gspot/no-trivial-functions`

Use `gspot.configs.all` in place of `recommended` to include import, layout, and ordering
checks. It includes every recommended rule. Neither configuration enables
`require-server-only`, `max-barrel-reexports`, or `no-reexports-outside-index`.
Select server files and alternative re-export policies explicitly.

## Correct a private environment read

This client module reads private configuration:

```javascript
"use client";
export const endpoint = process.env.PRIVATE_API_URL;
```

With plugin 0.1.0 and ESLint 9.39.5, `gspot/no-client-environment` reports the read at line 2,
column 25. Keep the private work on the server and let the client use a public route:

```javascript
"use client";
export const endpoint = "/api/search";
```

The corrected module produces no finding from this rule. The application still needs a server
implementation for `/api/search`. The
[walkthrough](https://github.com/stefanionescu/gspot/blob/main/docs/src/content/docs/guides/client-environment.md)
provides a configuration that runs only this rule, the commands, and the captured diagnostic.

## Select server modules

Apply `require-server-only` only to the files that contain server code:

```javascript
import gspot from '@gspot/eslint-plugin';

export default [{
    files: ['server/**/*.js'],
    plugins: { gspot },
    rules: { 'gspot/require-server-only': 'error' },
}];
```

The rule reports a selected module without `import 'server-only'`. Add that import to mark the
framework boundary. Neither bundled configuration selects server modules for you.

## Check TypeScript

Configure a TypeScript parser separately. The plugin does not install or select one.
With `@typescript-eslint/parser` installed, select your TypeScript files explicitly:

```javascript
import gspot from '@gspot/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [{
    ...gspot.configs.recommended,
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tsParser },
}];
```

See the [rule reference](https://gspot.dev/reference/plugin/no-client-environment/) for rule
options and examples. The package exports ECMAScript and CommonJS modules with TypeScript
declarations. Individual rules are available through `gspot.rules`.

Read the [documentation source](https://github.com/stefanionescu/gspot/tree/main/docs) for
setup and contribution instructions.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md).
