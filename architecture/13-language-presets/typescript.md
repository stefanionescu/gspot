# `language:typescript`

`language:typescript` requires `language:javascript`, which owns everything a
JavaScript file needs and is in [javascript.md](javascript.md). This document
holds only what TypeScript adds.

## Claims

```text
language:typescript   .ts .tsx .mts .cts .d.ts
                      tsconfig.json, tsconfig.*.json
```

## Tools

| Kind               | Tool                                                                     | Notes                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| format                   | Prettier                                                                 | The one formatter. `embeddedLanguageFormatting: "off"`, from the reference config.                                                     |
| syntax, types            | tsc                                                                      | `--noEmit`, and `--listFiles` as file listing                                                                                             |
| style, structure, naming | ESLint 9 flat config with `typescript-eslint`                            | The rule set below                                                                                                                     |
| schema                   | v8r against SchemaStore for `tsconfig.json`, `package.json` | Catches `eslint.entry: ["eslint-config.js"]`, a real typo in two `knip.json` files in the reference tree                               |
| deps                     | knip, syncpack, `bun audit` or `npm audit`, osv-scanner                  | knip for unused files, exports and dependencies; syncpack for version skew across a workspace                                          |
| license                  | `license-checker-rseidelsohn`                                            | The reference set uses both `license-checker` 25.0.1 (unmaintained) and `license-checker-rseidelsohn` 5.0.1. The maintained fork wins. |
| dead                     | knip                                                                     |                                                                                                                                        |
| prose                    | Vale, native grammar                                                     |                                                                                                                                        |
| sast                     | Semgrep                                                                  |                                                                                                                                        |
| duplication              | jscpd                                                                    |                                                                                                                                        |

## The ESLint rule set

Assembled from the reference set's rulesets, which are the fullest of the three repositories.
Grouped, with what each group owns:

| Group      | Plugin                                            | Owns                                                                                                    |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| base       | `@eslint/js` recommended                          | Language errors                                                                                         |
| TypeScript | `typescript-eslint` strict-type-checked           | Type-aware correctness                                                                                  |
| imports    | `eslint-plugin-import-x`                          | Cycles, resolution, `first`, `newline-after-import` with `count: 1`. Ordering belongs to perfectionist. |
| unicorn    | `eslint-plugin-unicorn`                           | Modern idiom                                                                                            |
| sonar      | `eslint-plugin-sonarjs`                           | Cognitive complexity at 8, duplicate branches                                                           |
| security   | `eslint-plugin-security`                          | Injection patterns                                                                                      |
| node       | `eslint-plugin-n`                                 | Engine compatibility, read from `engines`                                                               |
| jsdoc      | `eslint-plugin-jsdoc`                             | Doc comment shape, `no-types`                                                                           |
| regexp     | `eslint-plugin-regexp`                            | 19 rules                                                                                                |
| comments   | `@eslint-community/eslint-plugin-eslint-comments` | `require-description` on every disable                                                                  |
| tests      | `@`@vitest/eslint-plugin`-plugin`                 | Including `expect-expect`, on with a baseline                                                           |
| JSON       | `@eslint/json`                                    | JSON linting inside ESLint                                                                              |
| manifests  | `eslint-plugin-package-json`                      | Manifest ordering and validity                                                                          |
| boundaries | `eslint-plugin-boundaries`                        | Emitted from the structure contracts                                                                    |
| structure  | ast-grep                                          | Structural rules run outside ESLint, one engine for every language                                                           |
| Prettier   | `eslint-config-prettier`                          | Last, disables the stylistic overlap                                                                    |

Compiler options the preset turns on, taken from the reference set's five added guards plus the
defaults: `strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`.

Type-aware rules on: `switch-exhaustiveness-check`, `prefer-readonly`, `require-array-sort-compare`,
`consistent-type-exports`.

Landing in the baseline rather than off, with baselines measured at install:
`strict-boolean-expressions`, `explicit-module-boundary-types`, `vitest/expect-expect`,
`vitest/valid-describe-callback`, `vitest/no-conditional-expect`. The reference set measured all
five and left them off, at 100, 25 and 14 findings for the last three.

Rules the reference set defines locally that are dropped in favour of the plugin:
`no-imports-after-statements` is `import-x/first`, and `newline-after-imports` is
`import-x/newline-after-import` with `count: 1`.

`reportUnusedDisableDirectives: "error"` everywhere, no exception, including on the distribution's
own code.

## Order within a module

One structure rule from the shared engine, `private-before-public`: every non-exported top-level
declaration sits above the first `export`. TypeScript hoists function declarations, so the order
carries no runtime meaning; it is fixed so a reader meets the helpers before the code that uses
them, and it is the same order the Python and Bash presets require. `yap-swift-app` follows it by
habit and checks nothing; the rule is one ast-grep file.

## Version matrix

The reference repositories are two major versions apart on the same plugins: ESLint 9.38 with
`typescript-eslint` 8.29 in one, ESLint 10.9 with `typescript-eslint` 8.69 in the other. The preset
pins one matrix per gspot release, and a repository on a different major is told to upgrade or to
stay on an older gspot. There is no per-consumer matrix, because supporting two ESLint majors
doubles the config surface for no gain.

## Required inspections

```text
.ts .tsx .mts .cts   format syntax style types structure naming prose spelling
.d.ts                format syntax types spelling
.js .jsx .mjs .cjs   format syntax style types structure naming prose spelling
tsconfig*.json       format syntax schema spelling
package.json         format syntax schema spelling style      (via eslint-plugin-package-json)
```

## Totality

Four habitual exclusions, and what gspot does instead.

| Habit                                        | Reference evidence                                                                                                                | gspot                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests are not type-aware linted              | `quality/eslint/api/policy.js` lists `config/**`, `src/**` and `types/**` and omits `tests/**`, while Supabase includes its tests | `tests/**` is in the typechecked set. A repository that cannot afford it declares it in `[exceptions]` with an expiry.                                                     |
| Generated types are excluded from everything | `api/types/supabase.ts`, `supabase/types/database.ts`, `supabase/types/deno.d.ts` excluded from qlty, Prettier and ESLint         | `[[declare]]` with `produced_by`, and a freshness check that regenerates and diffs. Excluded from `style` and `naming`, kept in `syntax`, `types`, `format` and `secrets`. |
| Config files at the root are unlinted        | `eslint.config.js`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`                                                     | Claimed. A root config file is source.                                                                                                                                     |
| Scripts directories are unlinted             | `ios/dev_scripts`, `ios/build_scripts` get a separate 130-line ESLint policy for two files                                        | One preset, one config, with `languageOptions` selected by file glob rather than a second policy file                                                                        |

The last row is worth stating plainly: the reference repository maintains a separate ESLint policy,
runner and plugin re-export, 130 lines in total, for two JavaScript files in an iOS scripts
directory. Under gspot those two files are `.js` and the `language:javascript` preset claims them,
with CommonJS globals selected by glob.
