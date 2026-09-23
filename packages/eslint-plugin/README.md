# @gspot/eslint-plugin

ESLint rules for JavaScript and TypeScript. The plugin runs independently of the gspot CLI,
repository policy, hooks, and tool installation. It exports ECMAScript and CommonJS modules
and TypeScript declarations. ESLint 9.38.0 or newer is a peer dependency.

## Configure

In an installed consumer, add the recommended flat configuration to `eslint.config.mjs`:

```javascript
import gspot from '@gspot/eslint-plugin';

export default [gspot.configs.recommended];
```

Recommended includes private environment access, duplicate barrel exports, and structural rules
for trivial files and functions. These structural rules apply at both levels.
Use `gspot.configs.all` to add layout, ordering, and import rules.
All includes the recommended rules. Configure your TypeScript parser separately when checking
TypeScript files.

To select an individual rule, register the plugin and select the files it governs:

```javascript
import gspot from '@gspot/eslint-plugin';

export default [{
    files: ['server/**/*.js'],
    plugins: { gspot },
    rules: { 'gspot/require-server-only': 'error' },
}];
```

This rule reports a server module without `import 'server-only'`. Add that import to establish
the framework boundary. Apply it only to server modules: neither bundled configuration selects
it globally.

## Rules and options

The [client-environment walkthrough](https://github.com/stefanionescu/gspot/blob/main/docs/src/content/docs/guides/client-environment.md) demonstrates a private configuration finding and its correction. Individual rules remain available through `gspot.rules`, including alternative
re-export policies that require explicit selection.

Licensed under Apache-2.0.
