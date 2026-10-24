# @gspothq/eslint-plugin

ESLint rules for code that AI coding agents often write.

The rules flag files that only forward to another module, functions of a few statements, and exports that only rename a
value. They flag imports through index files and relative imports that leave their folder. They also flag comments mixed
into import blocks and private environment variables read in client code.

The [gspot CLI](https://www.npmjs.com/package/@gspothq/cli) sets this plugin up for you. Install it yourself only
when you run ESLint without gspot.

## Install

You need Node.js 22.12 or newer and ESLint 9.38.0 or newer with a flat config file, such as `eslint.config.mjs`.

```shell
bun add --dev @gspothq/eslint-plugin eslint
```

## Use

Add a plugin config to `eslint.config.mjs`. `recommended` turns on `gspot/no-client-env`; `all` turns on every lint
rule except `gspot/require-server-only` and `gspot/no-magic-numbers`.

```javascript
import gspot from '@gspothq/eslint-plugin';

export default [gspot.configs.all];
```

The [rule reference](https://generativespotting.com/reference/eslint-plugin/) lists each rule with its options. It also
gives the install commands for npm, pnpm, and Yarn, the setup for TypeScript, and the setup for the two rules that no
config turns on.

## License

[Apache-2.0](https://github.com/stefanionescu/gspot/blob/main/LICENSE.md)
