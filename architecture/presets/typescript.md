# `typescript`

Kind: language. Requires: javascript, structure, naming, formatting, spelling.

## Detects and claims

|                      |                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Detect               | `.ts`, `.tsx`, `.mts`, `.cts` in the tree; `tsconfig.json`; `typescript` in dependencies |
| Claims               | `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts`, `tsconfig.json`, `tsconfig.*.json`               |
| Required inspections | format, syntax, style, types, structure, naming, prose, spelling                         |

## Tools

`typescript`, `eslint`, `typescript-eslint`, `@gspot/eslint-plugin`, `eslint-plugin-sonarjs`, `eslint-plugin-unicorn`, `eslint-plugin-security`, `eslint-plugin-n`, `eslint-plugin-jsdoc`, `eslint-plugin-regexp`, `eslint-plugin-import-x`, `@eslint-community/eslint-plugin-eslint-comments`, `eslint-plugin-boundaries`, `eslint-plugin-package-json`, `eslint-config-prettier`, `knip`. Versions in the ledger.

## Generated configuration

| Target                      | Stub                            | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/eslint.config.js`   | `eslint.config.js` re-export    | the flat config: ignores by nature; typescript-eslint `strictTypeChecked` over typed files; sonarjs and unicorn `recommended` bases with the listed exceptions; the rule sets from the ledger section 3 and the additions (`strict-boolean-expressions`, `explicit-module-boundary-types`, `no-unnecessary-condition`, `only-throw-error`, `prefer-optional-chain`, `no-magic-numbers`, `eqeqeq`, `no-param-reassign`, `prefer-const`, `max-depth` 3, `complexity`, `max-statements` and `max-classes-per-file` from `[limits]`, `no-console` in source); `@gspot/eslint-plugin` with limits from `[limits]`, `types-placement` from `[architecture] types_directory`, `import-direction` from `[architecture] roles`, `no-reexports` from `[structure] reexports`, `env-access-owner` from `roles.env`, `private-before-public`, `import-path-style` per file class from `[tools.eslint] import_style`; `import-x/exports-last`; `boundaries/element-types` from `[architecture] elements` and `allow`; test overrides; prettier last |
| `.gspot/tsconfig.base.json` | `tsconfig.json` gains `extends` | strict plus the eight guard options; `paths` from `[tools.typescript] paths`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.gspot/knip.json`          | none                            | entry points from the framework preset or `[tools.knip] entry`; project globs from claims                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Checks

| Id                           | Stage  | Command                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript/tsc`             | commit | `tsc --noEmit -p <stub tsconfig>` per scope                                                                                                                                                                                                                                                             |
| `typescript/eslint`          | commit | `eslint --max-warnings 0 --no-warn-ignored --config .gspot/eslint.config.js --suppressions-location .gspot/baselines/eslint.json {files}`; fix: `--fix`, order codemod; the baseline is ESLint's own suppressions file, written with `--suppress-all` at `init` and pruned by `apply --lower-baselines` |
| `javascript/knip`            | push   | `knip --config .gspot/knip.json`, once over the whole tree; javascript owns the check and typescript requires javascript                                                                                                                                                                                |
| `integrity/tsconfig-options` | commit | engine                                                                                                                                                                                                                                                                                                  |
| `integrity/required-rules`   | push   | `eslint --print-config` per file class, compared with the preset's rule list                                                                                                                                                                                                                            |

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

| Setting                                                             | Direction                                                              | Default                                                                                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.eslint.rules`                                                | per-rule (options and rules turned on; off is a `gspot ignore --rule`) | the ledger set                                                                                                                                                        |
| `tools.eslint.import_style`                                         | neutral                                                                | `js` for TypeScript compiled to ESM, `ts` for Deno, `extensionless` for bundled code; per file class. Aliases come from tsconfig `paths` and `package.json` `imports` |
| `tools.eslint.test_files`                                           | neutral                                                                | `**/*.{test,spec}.{ts,tsx}`, `**/tests/**`                                                                                                                            |
| `tools.typescript.paths`                                            | neutral                                                                | from the existing tsconfig at init                                                                                                                                    |
| `tools.knip.entry`                                                  | neutral                                                                | from the framework preset                                                                                                                                             |
| `architecture.types_directory`                                      | neutral                                                                | `types`                                                                                                                                                               |
| `architecture.elements`, `architecture.allow`, `architecture.roles` | tightening                                                             | one element; the default roles                                                                                                                                        |
| `structure.reexports`                                               | tightening                                                             | `none`                                                                                                                                                                |
| `structure.call_through_allowed` (file, name, reason)               | loosening                                                              | none                                                                                                                                                                  |

## Rule files

`language/TYPESCRIPT.md`, `language/naming/TYPESCRIPT.md`.

## Not covered here

Runtime-specific rules (Node, browser, workers) come from the runtime detected in
`package.json` and the framework preset. React rules come from nextjs.
