---
title: JavaScript and TypeScript
description: Configure runtimes, TypeScript, Next.js, and React Native.
---

Set up gspot with the [Quickstart](/start/quickstart/) before changing language settings.

gspot translates settings into lint rule options:

<dl>

<dt>

`architecture.roles.environment_readers`

</dt>
<dd>

Paths allowed to read environment variables by `n/no-process-env`, `no-restricted-properties`, and
`no-restricted-syntax`.

</dd>
<dt>

`tools.eslint.import_extension`

</dt>
<dd>

The import extension option of `n/file-extension-in-import`.

</dd>
<dt>

`limits.index_exports`

</dt>
<dd>

The `amountOfExportsToConsiderModuleAsBarrel` option of `barrel-files/avoid-barrel-files`.

</dd>
<dt>

`structure.reexports = "index-only"`

</dt>
<dd>

Index exemptions for ESLint re-export rules and `gspot/no-trivial-files`.

</dd>

</dl>

Environment-reader checks and limits on index files that re-export other files apply at level `all`. The index limits apply when you allow re-exports. See the [ESLint plugin reference](/reference/eslint-plugin/) for the rule options.

## JavaScript runtimes

ESLint gives each file one runtime. Ordinary modules use Node.js built-ins; `.cjs` and `.cts`
files also receive CommonJS globals. React, Vue, and Svelte application sources use
browser globals. React Native sources use native globals. Build scripts retain Node.js.
Next.js sources retain Node.js by default because server components can use its APIs.

Use `[[tools.eslint.override]]` to declare another runtime for a file selector:

```toml title="gspot.toml"
[[tools.eslint.override]]
paths = ["src/client/**"]
runtime = "browser"

[[tools.eslint.override]]
paths = ["src/workers/**"]
runtime = "worker"

[[tools.eslint.override]]
paths = ["src/serviceworker.js"]
runtime = "serviceworker"
```

Write paths relative to the repository root. Later records win when they overlap.
Use an explicit `node` runtime for server code inside a browser or React Native project.

Runtime names follow the pinned [globals package](https://github.com/sindresorhus/globals);
`serviceworker` names its serviceworker
set. Web Workers and service workers have different APIs. Browser and native files do not
receive Node.js rules. React Native retains the `process` and `require` globals its
runtime supports, and does not receive Node.js globals such as `Buffer` and `__dirname`.
gspot rejects unknown runtime names before writing tool files.

JavaScript checks inherit your own `jsconfig.json` first and `tsconfig.json` otherwise. The TypeScript fallback keeps compiler settings and declarations while selecting JavaScript sources for this check. Your own JSX setting remains in force; otherwise the generated project uses `jsx: "preserve"`. Scopes without either project file use Bundler resolution when an extensionless import style matches a JavaScript source file. Ambient types come from the source project, including your own custom roots.

For compiler selection, see the [TypeScript configuration](/reference/configurations/typescript/).

JavaScript and TypeScript checks use the project's TypeScript compiler when available. If the project has none, gspot prefers its pinned compiler in the tool project over a global compiler. Run `gspot install` to install that compiler. An interrupted tool-project installation reports an error; it does not block an available project compiler.

TypeScript source files or your own `tsconfig.json` select TypeScript checks. A TypeScript tool dependency or declaration files alone do not. When a scope has no configuration of your own, gspot generates a standalone compiler project for its source files and declarations. The project excludes generated files, vendored files, and child scopes. Your own configuration keeps its project settings and receives the strict options required by the selected level.

See the [JavaScript configuration](/reference/configurations/javascript/) for settings translated into ESLint plugin options.

## Next.js

Next.js builds run at `all` when the selected scope contains an `app/`, `src/app/`,
`pages/`, or `src/pages/` tree. The project must provide a supported Next.js executable
and the dependencies its build needs. `recommended` retains the Next.js type check.

## React Native

`gspot init` detects `react-native` from React Native dependencies and `expo` from Expo
dependencies. The Expo configuration requires React Native and adds Expo rules and
`expo/expo-doctor`. A bare React Native project does not require either Expo tool. React web
projects that depend on `react-dom` also select the React DOM configuration, which supplies
the DOM accessibility plugin. Native sources retain React's hooks and component rules.

See [Lint rule options](/configure/lint-rules/) for custom React Native text components.
