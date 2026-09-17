# `language:javascript`

JavaScript is not TypeScript without types. It has four concerns of its own,
and the reference repositories show every one of them unhandled: which runtime a
file targets, which module system a package uses, where the types live when the
syntax has none, and what a script that starts with a shebang owes the shell.

## Claims

```text
.js .jsx .mjs .cjs
package.json, eslint.config.{js,mjs,cjs}, knip.json, *.config.{js,cjs,mjs}
```

Every JavaScript file, including the ones repositories habitually forget: the
build pipeline, the server entry, serverless function directories, config files
at the root, and the scripts under `.mise/tasks/` and `quality/`.

## What the reference repositories have

| Repository | JavaScript files | Type checked | Module system | Runtime split |
| --- | ---: | --- | --- | --- |
| `yap-landing` | 114 | none; one file carries JSDoc types | no `"type": "module"`, 7 `.mjs` and `.cjs` beside `.js` | 40 Node, 8 browser, 10 shebang scripts, 56 pure modules; ESLint splits ESM and CommonJS globals by hand |
| `yap-swift-app` | 125 | none | `"type": "module"`, yet 7 `.mjs` among 118 `.js`, so the extension carries no information | Node scripts and two iOS build scripts with a separate 130-line ESLint policy |
| `comfyui-reactor-connector` | 57 | none; `tsconfig` includes `web/**/*.ts` only | mixed | browser extension and Node tooling in one tree |
| `slopshop` | 20 | none | `"type": "module"` | Node tooling |

316 JavaScript files across four repositories with strict TypeScript elsewhere,
and not one of them is type checked.

## Tools

| Kind | Tool | Notes |
| --- | --- | --- |
| types | `tsc --checkJs --strict` | The full TypeScript checker over `.js` files, taking types from JSDoc and inference. No build change, no syntax change. The preset renders the `tsconfig`. |
| types | `type-coverage` | A percentage of typed expressions, so untyped JSDoc is measured rather than invisible |
| style, structure, naming | ESLint, the same host as TypeScript | `unicorn`, `sonarjs`, `security`, `regexp`, `import-x`, `perfectionist`, `jsdoc`, `n`, `package-json`, `boundaries`, `eslint-comments`, and `@typescript-eslint/naming-convention`, which parses JavaScript |
| runtime, Node | `eslint-plugin-n` | API use against `engines.node`, `node:` protocol on builtins, hashbang and executable bit agreement, no `process.exit` outside an entry point |
| runtime, browser | `eslint-plugin-compat`, `eslint-plugin-no-unsanitized` | API use against `browserslist`; DOM sinks require a sanitizer |
| format | prettier | |
| dead, dependencies | knip | |
| structure | ast-grep, JavaScript grammar | The same rule files as TypeScript |
| prose | Vale, native grammar | |

## The four JavaScript concerns

### 1. Runtime

A JavaScript file targets Node, a browser, or both, and the correct rules differ:
Node files get `n` and Node globals; browser files get `compat`,
`no-unsanitized`, DOM globals, and a ban on `node:` imports; worker files get the Workers globals
from `platform:cloudflare` and a ban on both `node:` imports and `process`. Nothing in the file
says which it is, so the preset decides per glob and the consumer overrides:

```toml
[javascript.runtime]
"build/**"       = "node"
"server.js"      = "node"
"functions/**"   = "worker"      # Cloudflare Pages Functions run on the Workers runtime
"pages/**/*.js"  = "browser"
"web/scripts/**" = "browser"
```

Detection proposes the map: a shebang or a `node:` import means Node; a file a
tracked HTML page references, or a `document` or `window` access, means browser.
A file that matches nothing is `both`, which gets the intersection of the node
and browser rule sets and every global set denied. `worker` is never inferred; the platform
preset assigns it. `yap-landing` maintains this split by hand
in its ESLint config; the preset makes it one table.

### 2. Module system

One module system per package, declared. `package.json` carries
`"type": "module"` or `"type": "commonjs"`, every file uses that system, and the
extension is `.js`. `.mjs` and `.cjs` exist only where a tool forces the other
system on one file, and each such file is declared with the tool that forces it.

| Rule | Enforces |
| --- | --- |
| `js/module-type-declared` | `package.json` has a `type` field |
| `unicorn/prefer-module` | ESM syntax in an ESM package |
| `import-x/no-commonjs` or `import-x/no-import-module-exports` | No mixing, direction set by the declared type |
| `n/prefer-node-protocol` | `node:fs`, never `fs` |
| `js/one-extension` | `.mjs` and `.cjs` only with a declaration naming the tool that needs them |

`yap-swift-app` has seven `.mjs` files among 118 `.js` in a package already
declared `"type": "module"`, so the extension says nothing. `yap-landing` has no
`type` field at all and seven mixed extensions. Both end with one extension.

### 3. Types in JSDoc

With `--checkJs`, JSDoc is the type surface, so the JSDoc rules are the
**inverse** of the TypeScript preset's. TypeScript forbids types in JSDoc
because the syntax carries them; JavaScript requires them because nothing else
does.

| TypeScript preset | JavaScript preset |
| --- | --- |
| `jsdoc/no-types` | `jsdoc/require-param-type`, `jsdoc/require-returns-type`, `jsdoc/require-property-type` |
| | `jsdoc/check-types`, `jsdoc/no-undefined-types`, `jsdoc/valid-types` |
| `jsdoc/require-jsdoc` on exports | the same, and the JSDoc must carry the types |

The rendered `tsconfig`:

```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["**/*.js", "**/*.mjs", "**/*.cjs"]
}
```

`yap-landing` has 114 files and one with JSDoc types. Turning this on produces
real findings on day one, and every one of them is a type error that ships
today. They enter a baseline like any other backlog.

### 4. Scripts

A JavaScript file with a shebang is a program, and it owes the shell what a Bash
script owes it.

| Rule | Enforces |
| --- | --- |
| `n/hashbang` | A shebang and the executable bit agree, both present or both absent |
| `n/no-process-exit` | `process.exit` only in the entry file; everything else throws |
| `n/no-unpublished-import` | A script imports only what the package declares |
| `js/no-inline-in-tasks` | A mise task written in JavaScript is a file, never a `node -e` string; the Bash preset extracts those and hands them here |

`yap-landing` has ten shebang scripts. Nothing checks that they are executable.

## The rules layer

`rules/language/JAVASCRIPT.md` exists in one fork only, `yap-landing`, at 296
lines. It is the base. Its sections "Runtime Standard", "Modules, Imports, and
Exports", and "Comments and JSDoc" are exactly the four concerns above written
as prose, and they stay. "Static Site Boundaries" and "Templates and Browser
Assets" are the static-site framework's and move to `rules/repository/static-site/STATIC-SITE.md`.
Everything the file shares with `TYPESCRIPT.md` (values, objects, functions,
classes, null handling, errors and async) is stated once in the language layer
and not twice.

The structure rules are the TypeScript preset's, including `private-before-public`: non-exported
declarations above the first `export`, and in a CommonJS file above the `module.exports`
assignment.

## Required inspections

```text
.js .jsx .mjs .cjs   format syntax style types structure naming prose spelling
```

`types` is in the list. A JavaScript file with no type checking is `partial`,
which is the correct report for every one of the 316 files above.

## Full coverage

| Habit | Reference evidence | gspot |
| --- | --- | --- |
| Tooling JavaScript is not code | 125 files under `quality/`, `.mise/tasks/` and `ios/dev_scripts` in one repository, with a weaker policy or none | One preset, one policy. The 130-line separate ESLint policy for two iOS scripts becomes two globs in the runtime map. |
| Config files are not code | `eslint.config.js`, `*.config.cjs`, `madge.config.cjs` | Claimed. A config file is source. |
| Serverless function directories are the platform's business | `functions/` under Cloudflare Pages | Claimed, runtime `worker`, through `platform:cloudflare` |
| Scripts are not programs | ten shebang files, no executable-bit check | `n/hashbang` |
