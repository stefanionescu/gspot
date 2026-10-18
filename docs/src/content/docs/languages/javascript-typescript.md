---
title: JavaScript and TypeScript
description: Configure runtimes, TypeScript, Next.js, and React Native.
---

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

The environment reader checks and the limits on index files that re-export other files run at level `all`. The index limits run only when you allow re-exports. See the [ESLint plugin reference](/reference/eslint-plugin/) for the lint rule options.

## JavaScript runtimes

Each file gets one ESLint runtime. Ordinary modules use Node.js built-ins; `.cjs` and `.cts`
files also get CommonJS globals. React, Vue, and Svelte application sources use
browser globals. React Native sources use native globals. Build scripts keep Node.js.
Next.js sources keep Node.js by default because server components can use its APIs.

To give some files another runtime, add a `[[tools.eslint.override]]` record:

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

Write paths relative to the repository root. When records overlap, the later one counts.
Use an explicit `node` runtime for server code inside a browser or React Native project.

Runtime names follow the pinned [globals package](https://github.com/sindresorhus/globals); use `serviceworker` for
service workers, which have other APIs than Web Workers. Browser and native
files get no Node.js lint rules. React Native files keep the `process` and `require` globals, but get no other
Node.js globals, such as `Buffer` and `__dirname`. An unknown runtime name stops gspot before it writes tool files.

JavaScript checks extend your own `jsconfig.json`, or your `tsconfig.json` when no `jsconfig.json` exists. From a `tsconfig.json`, they keep the compiler options and declarations but select only JavaScript sources. Your own JSX setting stays; without one, the generated project uses `jsx: "preserve"`. A scope with neither file uses Bundler resolution when imports without extensions name JavaScript source files. Ambient types come from the source project, including your own type roots.

JavaScript and TypeScript checks use the TypeScript compiler of the project. Without one, gspot uses its pinned compiler from the tool project before any global compiler. Run `gspot install` to install the pinned compiler.

TypeScript source files or your own `tsconfig.json` select TypeScript checks; a TypeScript tool dependency or declaration files alone do not. When a scope has no `tsconfig.json` of your own, gspot writes a standalone compiler project for its source files and declarations. That project leaves out generator output, vendored files, and child scopes. Your own `tsconfig.json` keeps its compiler options and gets the strict ones that the selected level requires.

## Next.js

The Next.js configuration runs `nextjs/tsc` instead of `typescript/tsc`, at level `recommended` and stage `push`.
The check has Next.js write its types, then type-checks the app with the strict compiler options. The project must
provide Next.js 15.5 or later. The Next.js Semgrep rules run in `security/semgrep`.

## React Native

`gspot init` selects `react-native` and `expo` from their dependencies. The Expo configuration requires React
Native and adds Expo lint rules and `expo/expo-doctor`. A bare React Native project needs no Expo tool. A React web
project that depends on `react-dom` also gets the React DOM configuration and its DOM accessibility plugin.
Native sources keep the React hooks and component lint rules.

See [Lint rule options](/configure/lint-rules/) for custom React Native text components.
