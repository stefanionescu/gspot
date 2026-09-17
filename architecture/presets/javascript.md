# javascript

Kind: language. Requires: structure, naming, formatting, spelling.

## Detects and claims

| | |
| --- | --- |
| Detect | `.js`, `.jsx`, `.mjs`, `.cjs` in the tree; a `node` shebang |
| Claims | `.js`, `.jsx`, `.mjs`, `.cjs`, extensionless files with a `node` shebang |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling |

## Tools

eslint and the plugin set from typescript minus typescript-eslint; typescript for `--checkJs`;
knip.

## Generated configuration

| Target | Stub | Holds |
| --- | --- | --- |
| `.gspot/eslint.config.js` | `eslint.config.js` | shared with typescript when both are selected; globals per runtime (node, browser, worker, commonjs) chosen by file class; `sourceType` per extension; the same structural, direction and placement rules; `no-unused-vars` with `args: all` for scripts |
| `.gspot/jsconfig.json` | `jsconfig.json` | `checkJs`, `strict`, `noEmit`; type checking of plain JavaScript through JSDoc |

The types directory rule applies to JavaScript as JSDoc: `@typedef` and `@callback` only in
files under `[architecture] types_directory`.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `javascript/eslint` | commit | as typescript; cognitive complexity through `sonarjs/cognitive-complexity` and cyclomatic through core `complexity`, `max-statements` and `max-classes-per-file` from `[limits]`; cycles through `import-x/no-cycle`, CommonJS included |
| `javascript/checkjs` | commit | `tsc -p .gspot/jsconfig.json` |
| `javascript/knip` | push | knip |

## Settings

`tools.eslint.*` as typescript; `tools.eslint.globals` per file class.

## Rule files

`language/JAVASCRIPT.md`, `language/naming/JAVASCRIPT.md`, plus the runtime file detected:
`runtime/node/NODE.md`, `runtime/bun/BUN.md`, `runtime/deno/DENO.md`, `runtime/browser/BROWSER.md`, `runtime/workers/WORKERS.md`.

## Not covered here

Type checking of untyped JavaScript is `checkJs` with JSDoc; no reference repository did it and
it enters with a baseline. Lizard and madge are not used: sonarjs and import-x do their jobs in
the editor.
