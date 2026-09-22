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

Recommended checks private environment access in client modules and duplicate barrel exports.
Use `gspot.configs.all` to opt into naming, layout, ordering, and forwarding-function preferences.
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

The [plugin reference](https://gspot.dev/reference/plugin/no-trivial-functions/) describes each rule
and its options. Individual rules remain available through `gspot.rules`, including alternative
re-export and trivial-function policies that the bundled configurations do not enable together.

Licensed under Apache-2.0.
