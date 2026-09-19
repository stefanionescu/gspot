# `typescript`

Kind: language. Requires: javascript, structure. Recommends: naming, formatting, spelling.

## Detects and claims

|                      |                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Detect               | `.ts`, `.tsx`, `.mts`, `.cts` in the tree; `tsconfig.json`; `typescript` in dependencies |
| Claims               | `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts`, `tsconfig.json`, `tsconfig.*.json`               |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling                         |

## Tools

`typescript`, `eslint`, `typescript-eslint`, `@gspot/eslint-plugin`, `eslint-plugin-sonarjs`, `eslint-plugin-unicorn`, `eslint-plugin-security`, `eslint-plugin-n`, `eslint-plugin-jsdoc`, `eslint-plugin-regexp`, `eslint-plugin-import-x`, `@eslint-community/eslint-plugin-eslint-comments`, `eslint-plugin-boundaries`, `eslint-plugin-package-json`, `eslint-config-prettier`, `knip`. Versions in the ledger.

## Generated configuration

| Target                       | Stub                                                                           | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/eslint.config.mjs`   | `eslint.config.mjs` re-export, only where the developer keeps no ESLint config | the flat config: ignores by nature; typescript-eslint `strictTypeChecked` over typed files; sonarjs and unicorn `recommended` bases with the listed exceptions; the rule sets from the ledger section 3 and the additions (`strict-boolean-expressions`, `explicit-module-boundary-types`, `no-unnecessary-condition`, `only-throw-error`, `prefer-optional-chain`, `no-magic-numbers`, `eqeqeq`, `no-param-reassign`, `prefer-const`, `max-depth` 3, `complexity`, `max-statements` and `max-classes-per-file` from `[limits]`, `no-console` in source); `@gspot/eslint-plugin` with limits from `[limits]`, `types-placement` from `[architecture] types_directory`, `import-direction` from `[architecture] roles`, `no-reexports` from `[structure] reexports`, `env-access-owner` from `roles.env`, `private-before-public`, `import-path-style` per file class from `[tools.eslint] import_style`; `import-x/exports-last`; `boundaries/element-types` from `[architecture] elements` and `allow`; test overrides; prettier last |
| `.gspot/tsconfig.check.json` | none; it extends the `tsconfig.json` of the repository                         | `strict` at `recommended`, and three more flags at `all` (D-148)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.gspot/knip.json`           | none                                                                           | entry points from the framework preset or `[tools.knip] entry`; project globs from claims                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Checks

| Id                            | Stage  | Command                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript/tsc`              | push   | `tsc --noEmit -p .gspot/tsconfig.check.json` for each scope, or `tsc -b --noEmit` where the config holds references (D-148, K-226)                                                                                                                                                                          |
| `typescript/eslint`           | commit | `eslint --max-warnings 0 --no-warn-ignored --config .gspot/eslint.config.mjs --suppressions-location .gspot/eslint-suppressions.json {files}`; fix: `--fix`, order codemod; the baseline is ESLint's own suppressions file, written with `--suppress-all` at `init` and pruned by `apply --lower-baselines` |
| `javascript/knip`             | push   | `knip --config .gspot/knip.json`, once over the whole tree; javascript owns the check and typescript requires javascript                                                                                                                                                                                    |
| `typescript/tsconfig-options` | commit | engine                                                                                                                                                                                                                                                                                                      |
| `javascript/required-rules`   | push   | `eslint --print-config` for one file per ending, compared with the `[required_rules]` of every selected manifest (D-99); shipped by `javascript`                                                                                                                                                            |

## The types directory

`[architecture] types_directory` (default `types`, proposed from what exists) turns on
`gspot/types-placement`:

- No `interface`. Every type alias, and every `as const` object that stands in for an enum,
  lives under the types directory.
- Files under it hold type-only imports, no default export, no runtime value, function, or class
  export; `export *` re-exports types only.
- Source files import from it with `import type`.
- `*.d.ts` files a framework generates are exempt by nature. Anything else goes through
  `[[ignore]]` with a reason.

## Import direction

Four rules from `[architecture] roles`, always on:

- types import only types;
- runtime never imports tests or support;
- tests and support import runtime only through element contracts or types;
- config and env never import runtime.

`[structure] reexports = "none"` (the default for
application scopes) refuses every re-export in source; `index-only` allows index barrels.

## Settings

| Setting                                               | Direction                                                              | Default                                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.eslint.rules`                                  | per-rule (options and rules turned on; off is a `gspot ignore --rule`) | the ledger set                                                                                                                                                        |
| `tools.eslint.import_style`                           | neutral                                                                | `js` for TypeScript compiled to ESM, `ts` for Deno, `extensionless` for bundled code; per file class. Aliases come from tsconfig `paths` and `package.json` `imports` |
| `tools.eslint.test_files`                             | neutral                                                                | `**/*.{test,spec}.{ts,tsx}`, `**/tests/**`                                                                                                                            |
| `tools.typescript.paths`                              | neutral                                                                | from the existing tsconfig at init                                                                                                                                    |
| `tools.knip.entry`                                    | neutral                                                                | from the framework preset                                                                                                                                             |
| `architecture.types_directory`                        | neutral                                                                | `types`                                                                                                                                                               |
| `architecture.elements`, `architecture.edges_allowed` | tightening                                                             | one element; the default roles                                                                                                                                        |
| `structure.reexports`                                 | tightening                                                             | `none`                                                                                                                                                                |
| `structure.call_through_allowed` (file, name, reason) | loosening                                                              | none                                                                                                                                                                  |

## Rule files

`language/TYPESCRIPT.md`, `language/naming/TYPESCRIPT.md`.

## Not covered here

Runtime-specific rules (Node, browser, workers) come from the runtime detected in
`package.json` and the framework preset. React rules come from nextjs.
