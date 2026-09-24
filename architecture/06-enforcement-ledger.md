# Enforcement Ledger

This document decides where every rule and check from the four reference repositories lands in
gspot. Nothing in the source column is dropped. Where a maintained tool expresses a rule, the row
names the tool. A unit test reads every check name of this document and fails one that no manifest
holds (K-248).

Every landing has a level. A rule that finds a defect, a security problem, dead code, or
a banned name is `all`. A rule that enforces a layout, an order, a header, or one way to
write a thing that works is `all`. A reference repository that migrates sets `level = "all"`, so
it keeps every rule it had. A rule that names a function or a folder of one repository moves
into that repository, under `tools.semgrep.rules` or its own rule files (K-218).

Sources: `TI` = yap-text-inference, `SA` = yap-swift-app, `LA` = yap-landing, `SS` = slopshop.
Paths are relative to each repository's `quality/` folder unless they start with `.` or a
top-level name.

Stage: `commit` runs on staged files before a commit; `push` runs on the whole tree before a
push; `manual` runs on request.

## 1. Limits

One `[limits]` table. The shipped default is the strictest value any source uses. A repository changes a limit with `gspot set`.

| Limit                           | Default               | Sources                                                                                                         | Enforced by                                                                                                                        |
| ------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `file_lines`                    | 300                   | SA, LA, SS `config/limits`, TI `config/python/limits.py`                                                        | ESLint `max-lines`; Ruff `PLC0302`; SwiftLint `file_length`; structure engine code-line count for python and bash                  |
| `function_lines`                | 60                    | same                                                                                                            | ESLint `max-lines-per-function`; Ruff `PLR0915`; SwiftLint `function_body_length`; structure engine for python code lines and bash |
| `function_parameters`           | 7                     | SS `MAX_PARAMETERS`, TI ruff `max-args`, LA lizard `--arguments`                                                | ESLint `max-params`; Ruff `PLR0913`; SwiftLint `function_parameter_count`                                                          |
| `cognitive_complexity`          | 8                     | SA, LA, SS `COGNITIVE_COMPLEXITY_THRESHOLD`                                                                     | `sonarjs/cognitive-complexity` for every JavaScript and TypeScript file                                                            |
| `cyclomatic_complexity`         | 8                     | TI and the ComfyUI repositories `max-complexity` 8; LA lizard `--CCN` 8; SA swiftlint `cyclomatic_complexity` 8 | ESLint core `complexity`; Ruff `C901`; SwiftLint `cyclomatic_complexity`; the shell branch count                                   |
| `nested_blocks`                 | 3                     | TI ruff `PLR1702`                                                                                               | Ruff `PLR1702`; ESLint `max-depth` is the same number                                                                              |
| `positional_arguments`          | `function_parameters` | new, beside `function_parameters`                                                                               | Ruff `PLR0917`                                                                                                                     |
| `sql.function_lines`            | 60                    | new                                                                                                             | structure engine over `CREATE FUNCTION` bodies                                                                                     |
| `branches`                      | 8                     | TI `max-branches`                                                                                               | Ruff `PLR0912`                                                                                                                     |
| `returns`                       | 4                     | TI `max-returns`                                                                                                | Ruff `PLR0911`                                                                                                                     |
| `statements`                    | 30                    | TI `max-statements`                                                                                             | Ruff `PLR0915`; ESLint `max-statements`                                                                                            |
| `locals`                        | 10                    | TI `max-locals`                                                                                                 | Ruff `PLR0914`                                                                                                                     |
| `boolean_expressions`           | 4                     | TI `max-bool-expr`                                                                                              | Ruff `PLR0916`                                                                                                                     |
| `public_methods`                | 12                    | TI `max-public-methods`                                                                                         | Ruff `PLR0904`                                                                                                                     |
| `nested_callbacks`              | 3                     | SA, LA, SS `max-nested-callbacks`                                                                               | ESLint `max-nested-callbacks`                                                                                                      |
| `nesting`                       | type 1, function 2    | SA `.swiftlint.yml`                                                                                             | SwiftLint `nesting`                                                                                                                |
| `identical_functions`           | 3                     | SA, LA, SS `IDENTICAL_FUNCTIONS_THRESHOLD`                                                                      | `sonarjs/no-identical-functions`; structure engine for bash and swift                                                              |
| `barrel_reexports`              | 20                    | all three JS repos                                                                                              | `gspot/max-barrel-reexports`; structure engine for python `max_package_exports`                                                    |
| `prefix_collisions`             | 2                     | all four                                                                                                        | `structure/prefix-collisions`, for every language (K-187)                                                                          |
| `trivial_statements`            | 2                     | all four                                                                                                        | executable statement threshold in every supported function language                                                                |
| `line_length`                   | 120                   | SA prettier, TI ruff, SA swiftlint                                                                              | Prettier `printWidth`; Ruff `line-length`; SwiftLint `line_length`; shfmt through `.editorconfig`                                  |
| `bash.file_lines`               | 140                   | TI, SA (LA has 180)                                                                                             | structure engine                                                                                                                   |
| `bash.function_lines`           | 40                    | TI (SA and LA have 100, SS 60)                                                                                  | structure engine                                                                                                                   |
| `bash.function_branches`        | 8                     | TI `config/shell.py`                                                                                            | ast-grep count                                                                                                                     |
| `bash.function_nesting`         | 3                     | TI                                                                                                              | ast-grep count                                                                                                                     |
| `bash.mutable_assignments`      | 8                     | TI                                                                                                              | ast-grep count                                                                                                                     |
| `bash.duplicate_min_lines`      | 3                     | TI                                                                                                              | structure engine                                                                                                                   |
| `duplication.min_lines`         | 8                     | TI, LA jscpd                                                                                                    | jscpd                                                                                                                              |
| `duplication.min_tokens`        | 40                    | same                                                                                                            | jscpd                                                                                                                              |
| `duplication.threshold_percent` | 4                     | same                                                                                                            | jscpd                                                                                                                              |
| `swift.type_body_length`        | 300                   | SA                                                                                                              | SwiftLint                                                                                                                          |
| `swift.closure_body_length`     | 60                    | SA                                                                                                              | SwiftLint                                                                                                                          |
| `file_size_kb`                  | 1024                  | new                                                                                                             | `integrity/large-files`                                                                                                            |
| `install.min_release_age_days`  | 7                     | SS, SA `bunfig.toml` (604800 seconds)                                                                           | `dependencies/install-policy`                                                                                                      |
| `docs.sentence_words`           | 30                    | SA `LINTING.md`                                                                                                 | Vale `gspot.sentence-length`                                                                                                       |
| `docs.list_item_words`          | 45                    | same                                                                                                            | Vale `gspot.step-length`                                                                                                           |
| `docs.paragraph_sentences`      | 6                     | same                                                                                                            | Vale `gspot.paragraph-length`                                                                                                      |

Every limit is a setting with direction `ceiling`: raising it carries a reason.

A root key applies to every language that has a check for it. A key under a language table
(`[limits.python]`, `[limits.typescript]`, `[limits.javascript]`, `[limits.swift]`,
`[limits.bash]`, `[limits.sql]`) overrides it for that language only, so a Python module may be
allowed 400 lines while TypeScript stays at 300. The `bash.*`, `sql.*` and `swift.*` rows above
are keys that exist only under their language table, because no other language has the check.
The naming ceilings (characters and words per identifier) are not limits; they live under
`[naming.<language>]` and are listed in [08-naming-policy.md](08-naming-policy.md).

## 2. JavaScript and TypeScript structure

Nineteen port into `@gspot/eslint-plugin`, each with a new rule-tester suite. Seven land in a
pinned tool or in the structure engine, as the last column says. For the nineteen, the sources
ship no tests. Source files are the three `plugin/rules/`
folders (`SA eslint/local/`, `LA shared/eslint/plugin/rules/`, `SS shared/eslint/plugin/rules/`).

| Rule                                                                                                                                                                                                                                                              | Sources                                                                 | gspot                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no-trivial-functions                                                                                                                                                                                                                                              | SA, LA, SS                                                              | `gspot/no-trivial-functions`, which covers every function form (K-102)                                                                                                  |
| no-trivial-files                                                                                                                                                                                                                                                  | SA, SS                                                                  | `gspot/no-trivial-files`                                                                                                                                                |
| no-export-only-files / export-only-files                                                                                                                                                                                                                          | SA, LA, SS                                                              | `gspot/no-export-only-files`                                                                                                                                            |
| no-exported-alias-constants / no-alias-exports                                                                                                                                                                                                                    | SA, LA, SS                                                              | `gspot/no-exported-alias-constants`                                                                                                                                     |
| no-duplicate-barrel-exports / no-barrel-duplicates                                                                                                                                                                                                                | SA, LA, SS                                                              | `import-x/export` (K-188)                                                                                                                                               |
| no-reexports-outside-index / index-only-reexports                                                                                                                                                                                                                 | SA, LA, SS                                                              | `gspot/no-reexports` with `allowIndex` (K-188)                                                                                                                          |
| max-barrel-reexports                                                                                                                                                                                                                                              | SA, LA, SS                                                              | `gspot/max-barrel-reexports`                                                                                                                                            |
| no-index-imports                                                                                                                                                                                                                                                  | SA, LA, SS                                                              | `gspot/no-index-imports`                                                                                                                                                |
| no-single-file-folders / no-lone-files                                                                                                                                                                                                                            | SA, LA, SS                                                              | `structure/single-file-folder`, at the level `all` (K-187, K-91)                                                                                                        |
| no-prefix-collisions                                                                                                                                                                                                                                              | SA, LA, SS                                                              | `structure/prefix-collisions` (K-187)                                                                                                                                   |
| header-comments-before-imports / header-comment-order                                                                                                                                                                                                             | SA, LA, SS                                                              | `gspot/header-comments-before-imports`                                                                                                                                  |
| import-layout                                                                                                                                                                                                                                                     | SA, LA, SS                                                              | `gspot/import-layout`                                                                                                                                                   |
| import-path-style                                                                                                                                                                                                                                                 | SA, LA                                                                  | `gspot/import-path-style`                                                                                                                                               |
| newline-after-imports                                                                                                                                                                                                                                             | LA                                                                      | `import-x/newline-after-import` with `count: 1`                                                                                                                         |
| no-imports-after-statements                                                                                                                                                                                                                                       | LA                                                                      | `import-x/first`                                                                                                                                                        |
| no-cross-folder-imports                                                                                                                                                                                                                                           | SA, LA                                                                  | `gspot/no-cross-folder-imports`                                                                                                                                         |
| no-cross-project-imports                                                                                                                                                                                                                                          | SA                                                                      | `gspot/no-cross-project-imports`                                                                                                                                        |
| tests-directory-contents                                                                                                                                                                                                                                          | SA                                                                      | `gspot/tests-directory-contents`                                                                                                                                        |
| no-harness-barrel-imports                                                                                                                                                                                                                                         | SA                                                                      | `no-restricted-imports` over `tools.vitest.harness_directory` (K-188)                                                                                                   |
| registry-instance-only                                                                                                                                                                                                                                            | SA                                                                      | `gspot/registry-instance-only`                                                                                                                                          |
| require-server-only                                                                                                                                                                                                                                               | SS `boundary-plugin.mjs`                                                | `gspot/require-server-only` (nextjs configuration)                                                                                                                      |
| no-client-environment                                                                                                                                                                                                                                             | SS `boundary-plugin.mjs`                                                | `gspot/no-client-environment` (nextjs configuration)                                                                                                                    |
| `NO_REEXPORT_SYNTAX`: no `export ... from`, no re-export of local symbols, no `export *` in application source                                                                                                                                                    | SA `eslint/api/index.js`                                                | `gspot/no-reexports` with `[structure] reexports = "none"` (default for application scopes; `index-only` for libraries)                                                 |
| boundaries as an allow matrix: `boundaries/element-types` with `default: disallow` and one allow list per element                                                                                                                                                 | SA `eslint/api/index.js`, `eslint/supabase/index.js`                    | `boundaries/element-types` rendered from `[architecture] elements` and `allow`                                                                                          |
| type roots: type-only imports, no default export, no runtime value, function or class export, `export *` of types only                                                                                                                                            | SA both projects                                                        | `gspot/types-placement`, `[architecture] types_directory` (explicit opt-in)                                                                                             |
| type placement: owner-local types by default; an explicit types directory can enforce placement                                                                                                                                                                   | SA `config/eslint.js` `TYPE_PLACEMENT_RESTRICTED_SYNTAX`                | `gspot/types-placement`                                                                                                                                                 |
| source never imports tests or test-only types; integration, e2e, stress tests and support code never import runtime internals; config, env and types never import app, module, platform or OpenAPI owners (`no-restricted-imports` pattern groups per file class) | SA `api/policy.js`, `supabase/policy.js`, `api/overrides/boundaries.js` | `gspot/import-direction`, the four shipped rules from `[architecture] roles`, rendered as `no-restricted-imports` groups in the generated config so editors report them |
| `no-console` in source files                                                                                                                                                                                                                                      | SA `configurations/overrides/restrictions.js`                           | core `no-console` over the source file class                                                                                                                            |
| import path styles `js`, `ts`, `extensionless` per file class                                                                                                                                                                                                     | SA `api/overrides/naming.js`, `supabase/overrides/naming.js`            | `gspot/import-path-style` with `[tools.eslint] import_style`                                                                                                            |
| call-through allowlist keyed `file:function`                                                                                                                                                                                                                      | SA `eslint/api/index.js`                                                | `[structure] call_through_allowed` entries carry `file`, `name`, `reason`                                                                                               |
| Deno file class: `n/*` and `n/prefer-promises/*` off, Deno globals                                                                                                                                                                                                | SA `eslint/supabase/index.js`                                           | supabase configuration override for `functions/**`                                                                                                                      |
| plugin floor versions (`UNICORN_ESLINT_MIN` 9.38.0)                                                                                                                                                                                                               | SA, LA `version-policy.js`                                              | `doctor` floors in the configuration manifests                                                                                                                          |
| exports last, private declarations first                                                                                                                                                                                                                          | new                                                                     | `import-x/exports-last`, `gspot/private-before-public`                                                                                                                  |
| `process.env` only in the configuration owner                                                                                                                                                                                                                     | SS `no-client-environment` generalized                                  | `gspot/env-access-owner` with `[architecture] roles.env`                                                                                                                |

## 3. ESLint rule sets

Rendered into `.gspot/config/eslint.config.mjs` by the typescript and javascript configurations. Source:
`SA eslint/rulesets/*.js`, `LA site/eslint/index.js`, `SS shared/eslint/*.mjs`,
`SS config/lint/ecosystem.mjs`.

| Family                 | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Sources                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| core                   | `no-useless-constructor`, `no-useless-return`, `no-useless-call`, `no-useless-rename`, `max-nested-callbacks` 3, `padding-line-between-statements` (function and class), `lines-between-class-members`, `no-duplicate-imports`, `no-unused-vars` with `^_` patterns (`args: all` for scripts)                                                                                                                                                                                                                                                                                                                                                                                     | SA, LA, SS                                                   |
| `no-restricted-syntax` | no `enum`; owner-local types by default; a types directory only when explicitly configured; no double assertion; no `as any`; no `as never`; config-file syntax guards (no function, class, control flow in config directories)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | SA `config/eslint.js`, SS                                    |
| typescript-eslint      | `strictTypeChecked` plus `consistent-type-definitions: type`, `consistent-type-imports`, `consistent-type-exports` with inline specifiers, `switch-exhaustiveness-check` with default exhaustive, `prefer-readonly`, `require-array-sort-compare` ignoring strings, `no-explicit-any`, `no-non-null-assertion`, `no-floating-promises` without `ignoreVoid`, `no-unused-vars` with `^_`; beyond the reference set: `strict-boolean-expressions`, `explicit-module-boundary-types`, `no-unnecessary-condition`, `only-throw-error`, `prefer-optional-chain`, `no-magic-numbers` (ignoring enums, array indexes and default parameters), `ban-ts-comment` with a description format | SA, SS; the additions are gspot's                            |
| sonarjs                | `recommended` as the base, plus the 38 rules in `SA rulesets/sonar.js` where recommended leaves them off, `no-duplicate-in-composite` and `redundant-type-aliases` for TypeScript, `cognitive-complexity` at the limit, `no-identical-functions` at the limit                                                                                                                                                                                                                                                                                                                                                                                                                     | SA, LA, SS                                                   |
| unicorn                | `recommended` as the base with a listed exception set (rules off with reasons in the template: `prevent-abbreviations` replaced by the naming engine, `no-null` off, `filename-case` replaced by the naming engine), which contains the 16 rules `SA rulesets/unicorn.js` picked; `prefer-ternary` stays `only-single-line`; `expiring-todo-comments` on                                                                                                                                                                                                                                                                                                                          | SA, LA, SS; the base is gspot's                              |
| core additions         | `eqeqeq`, `no-param-reassign`, `prefer-const`, `max-depth` 3, `complexity` at the cyclomatic limit, `max-statements` at the statements limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | gspot's                                                      |
| security               | the 11 rules on in `SA rulesets/security.js`; `detect-object-injection`, `detect-non-literal-fs-filename` and `detect-non-literal-regexp` off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | SA, LA, SS                                                   |
| n                      | the 18 rules in `SA rulesets/node.js` with the runtime version read from `engines`; `no-process-exit` on for source, off for scripts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | SA, LA, SS                                                   |
| jsdoc                  | `require-jsdoc` public only for functions, arrows, expressions, methods; `require-description`, `require-param`, `require-param-description`, `require-param-name`, `require-returns`, `require-returns-description`, `check-param-names`, `check-tag-names`; type tags permitted in JavaScript for `checkJs`; `no-types` on in TypeScript                                                                                                                                                                                                                                                                                                                                        | SA, LA, SS; `no-types` from SA `LINTING.md`                  |
| regexp                 | the 19 rules in `SA rulesets/regexp.js`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | SA                                                           |
| import-x               | `first`, `newline-after-import` 1, `no-cycle` unbounded ignoring externals, `no-self-import`, `no-useless-path-segments` without `noUselessIndex`, `no-empty-named-blocks`, `no-duplicates`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | SA, SS                                                       |
| eslint-comments        | `require-description`; `linterOptions.reportUnusedDisableDirectives: error`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | SA, LA, SS                                                   |
| vitest                 | `no-focused-tests`, `no-disabled-tests`, `no-identical-title`, `no-standalone-expect`, `no-commented-out-tests` on; `expect-expect`, `valid-describe-callback`, `no-conditional-expect` at the level `all` (measured off in SA)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | SA                                                           |
| boundaries             | element types from `[architecture]` (route, feature, shared), feature must not import route, shared must not import feature or route, explicit allowed edges with reasons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | SS `eslint/architecture.mjs`, SA api, and supabase overrides |
| package-json           | `scripts-name-casing`; the `package.json` policy check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | SS, SA                                                       |
| zod                    | the 13 rules in `SS config/lint/ecosystem.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | SS                                                           |
| react and next         | `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`, `react/no-array-index-key`, `react/no-danger`, `@next/next/no-async-client-component`, `eslint-config-next` core-web-vitals and typescript                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | SS                                                           |
| restricted imports     | `next/image` in favor of the project picture component (a `[tools.eslint]` slot, off by default)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | SS                                                           |
| i18next                | `no-literal-string` for JSX text in localized apps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | SS dependency                                                |
| prettier               | `eslint-config-prettier` last                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | all                                                          |

Test-file overrides: `no-non-null-assertion` off in tests; jsdoc off in tests and tooling.

## 4. TypeScript compiler

| Option                                                                                                                                | Sources                       | gspot                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `strict`                                                                                                                              | all                           | `.gspot/config/tsconfig.check.json`; `typescript/tsconfig-options` asserts it |
| `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `forceConsistentCasingInFileNames`                    | SS `integrity/typescript.mjs` | same                                                                          |
| `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noPropertyAccessFromIndexSignature` | SA                            | same                                                                          |
| every file in a type-check project                                                                                                    | TI `integrity/typecheck.py`   | `typescript/typecheck-membership`                                             |
| `tsc --noEmit` at commit                                                                                                              | SA, SS                        | `typescript/tsc`                                                              |

## 5. Python

Source: `TI pyproject.toml`, `TI quality/python/`, `TI quality/repository/`.

| Rule                                                                                                                                                                                                                                                                                                                                            | Source                                                         | gspot                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruff select: A ANN ARG ASYNC B BLE C4 C90 COM D DTZ E EM ERA EXE F FA FBT FIX FLY FURB G ICN INP ISC LOG N PERF PGH PIE PL PT PTH PYI Q RET RSE RUF S SIM SLF SLOT T10 T20 TC TD TRY UP W YTT; ignore COM812 D203 D213; fix all; beyond the reference set `ANN401`, `PLR2004`, `FAST`, and `DOC` when it leaves preview                         | pyproject                                                      | rendered `ruff.toml`; `python/ruff`                                                                                                                                                                        |
| Ruff format: 120 columns, 4 spaces, double quotes, LF, docstring code                                                                                                                                                                                                                                                                           | pyproject                                                      | `python/ruff-format`                                                                                                                                                                                       |
| pyright strict, `extraPaths`; per-variant projects run under a uv extra and only on Linux                                                                                                                                                                                                                                                       | pyrightconfig, `config/typecheck/*.json`, `.mise/tasks/type/*` | `python/basedpyright` in `all` mode over the default project; each variant is a `[[check]]` the repository declares with `platform = "linux"`, which is a platform skip elsewhere; `reportPrivateUsage` on |
| import-linter contracts (forbidden)                                                                                                                                                                                                                                                                                                             | pyproject `[[tool.importlinter.contracts]]`                    | `python/import-linter`; contracts in `[architecture.contracts]`                                                                                                                                            |
| pydoclint with init docstrings                                                                                                                                                                                                                                                                                                                  | mise task                                                      | `python/pydoclint`, until Ruff `DOC` is stable                                                                                                                                                             |
| interrogate fail-under 100, nothing ignored                                                                                                                                                                                                                                                                                                     | pyproject                                                      | Ruff `D100` to `D107` with nothing ignored; interrogate is cut                                                                                                                                             |
| deptry with `known_first_party`, per-rule ignores                                                                                                                                                                                                                                                                                               | pyproject                                                      | `python/deptry`                                                                                                                                                                                            |
| vulture confidence 80                                                                                                                                                                                                                                                                                                                           | pyproject                                                      | `python/vulture`                                                                                                                                                                                           |
| bandit                                                                                                                                                                                                                                                                                                                                          | mise task                                                      | Ruff `S` family plus the Semgrep Python pack; bandit is cut                                                                                                                                                |
| pip-audit                                                                                                                                                                                                                                                                                                                                       | mise task                                                      | `dependencies/osv` over `uv.lock`; pip-audit is cut                                                                                                                                                        |
| validate-pyproject, pyproject-fmt                                                                                                                                                                                                                                                                                                               | lint/quality                                                   | `python/pyproject` validates the schema. No Python-specific formatting check ships.                                                                                                                        |
| jscpd python threshold 4, 8 lines, 40 tokens                                                                                                                                                                                                                                                                                                    | `config/duplication/python.json`                               | `duplication/jscpd`                                                                                                                                                                                        |
| module length in code lines, barrel `__init__` exempt                                                                                                                                                                                                                                                                                           | `python/rules/module_length.py`                                | structure engine `structure/file-length`                                                                                                                                                                   |
| function length in code lines                                                                                                                                                                                                                                                                                                                   | `function_length.py`                                           | `structure/function-length`                                                                                                                                                                                |
| `__all__` at bottom, nothing after it except the main guard                                                                                                                                                                                                                                                                                     | `all_at_bottom.py`                                             | `python/exports-at-bottom`                                                                                                                                                                                 |
| no singleton classes, `get_instance`, module `_INSTANCE` holders                                                                                                                                                                                                                                                                                | `runtime_singletons.py`                                        | `python/no-singletons`                                                                                                                                                                                     |
| no module-level `__getattr__`, `__dir__`, `__getattribute__`                                                                                                                                                                                                                                                                                    | `imports/deferred.py`                                          | `python/no-lazy-exports`                                                                                                                                                                                   |
| imports at top, one block, no imports after statements                                                                                                                                                                                                                                                                                          | `imports/layout.py`                                            | `python/ruff`                                                                                                                                                                                              |
| absolute imports within package roots, package owners, no dynamic import, no `sys.path` mutation, no compat paths                                                                                                                                                                                                                               | `imports/boundary.py`, `config/python/imports.json`            | `python/import-linter`                                                                                                                                                                                     |
| import cycles across runtime modules                                                                                                                                                                                                                                                                                                            | `imports/graph.py`, `imports/cycles.py`                        | `python/import-cycles`                                                                                                                                                                                     |
| `__all__` ceiling 20, no duplicate names, no alias constants, no export-only modules except `__init__.py`                                                                                                                                                                                                                                       | `imports/exports.py`, `config/python/packages.json`            | `python/package-exports`                                                                                                                                                                                   |
| prefix collisions among siblings, `test_` and `_` stems exempt                                                                                                                                                                                                                                                                                  | `prefix_collisions.py`                                         | `structure/prefix-collisions`                                                                                                                                                                              |
| single-module packages                                                                                                                                                                                                                                                                                                                          | `single_file_folders.py`                                       | `structure/single-file-folder`                                                                                                                                                                             |
| trivial functions: report every implemented function with at most `limits.trivial_statements` executable statements (default 2), independently of callers, decorators, framework names, visibility, or entrypoints; count nested statements, inspect nested functions independently, and require narrow reasoned suppressions for required APIs | Existing language parsers                                      | `python/trivial-function`, `swift/trivial-function`, `structure/trivial-function`, `sql/functions`, `gspot/no-trivial-functions`                                                                           |
| private names: `_` prefix for what `__all__` does not list; `reportPrivateUsage`                                                                                                                                                                                                                                                                | new, from the reference `__all__` rules                        | `structure/private-prefix`, basedpyright                                                                                                                                                                   |
| private declarations above public ones                                                                                                                                                                                                                                                                                                          | new                                                            | `structure/private-before-public`                                                                                                                                                                          |
| `os.environ` read only in the configuration owner                                                                                                                                                                                                                                                                                               | TI config boundary contracts                                   | `structure/env-access-owner`                                                                                                                                                                               |
| placeholder docstrings (`Handle` or `Provide` and nothing else)                                                                                                                                                                                                                                                                                 | `functions/python.py`                                          | `python/placeholder-docstring`                                                                                                                                                                             |
| suppression directives (`noqa`, `nosec`, `type: ignore`, `pyright: ignore`, `pragma: no cover`, `bearer:disable`) carry a reason; `nosemgrep` forbidden                                                                                                                                                                                         | `integrity/suppressions.py`                                    | `integrity/suppressions`                                                                                                                                                                                   |
| dependency ownership: `uv.lock` matches, no requirements files, no `pip install` outside the allowlist, export workflow                                                                                                                                                                                                                         | `repository/dependencies.py`                                   | `dependencies/ownership`                                                                                                                                                                                   |
| config modules import only from config roots and hold only declarations                                                                                                                                                                                                                                                                         | `integrity/config.py`                                          | `integrity/config-purity`                                                                                                                                                                                  |
| policy JSON files load under closed schemas                                                                                                                                                                                                                                                                                                     | `integrity/policies.py`                                        | gspot's own settings validation                                                                                                                                                                            |
| every folder allowlist entry resolves                                                                                                                                                                                                                                                                                                           | `integrity/folder.py`                                          | `integrity/allowlists-match`                                                                                                                                                                               |
| gitleaks baseline entries carry reviewed reasons                                                                                                                                                                                                                                                                                                | `integrity/gitleaks.py`                                        | `secrets/gitleaks-baseline`                                                                                                                                                                                |
| naming: python categories and cases, visitor method exemptions                                                                                                                                                                                                                                                                                  | `repository/naming/`                                           | naming engine                                                                                                                                                                                              |
| Semgrep: no `torch.jit.script`, no `torch.load`, no `LSTMCell`, no direct diskcache, no HF token literal, no obsolete markers                                                                                                                                                                                                                   | `config/security/semgrep/*.yml`                                | `security/semgrep` with `packages/cli/configurations/language/python/semgrep/python.yml`; the rules that name one project go to that project (K-248, K-218)                                                |
| ambiguous folder names banned (`common`, `core`, `helper(s)`, `util(s)`, `support`, language names)                                                                                                                                                                                                                                             | `config/repository/folders.py`                                 | `structure/folder-names`                                                                                                                                                                                   |

## 6. Shell

Source: `TI quality/shell/`, `SA quality/shell/`, `LA shared/shell/`, `SS shared/shell/`.

| Rule                                                                                                                                                                                                                                                     | Sources                                             | gspot                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| ShellCheck at `--severity=style --enable=all --check-sourced` with rcfile (`source-path=SCRIPTDIR`, `external-sources`)                                                                                                                                  | all                                                 | `bash/shellcheck`                                             |
| shfmt diff, indent and case indent from `.editorconfig`                                                                                                                                                                                                  | all                                                 | `bash/shfmt`                                                  |
| `bash -n`                                                                                                                                                                                                                                                | all                                                 | `bash/syntax`                                                 |
| function doc comment `# name: summary`; summary not vague (`handle`, `perform`, `execute`); doc sections when present                                                                                                                                    | TI `docs.py`, SA `docs.js`, SS                      | `structure/doc-comment` with `[tools.bash] doc_style`         |
| shellcheck disable carries a reason (`# reason:` or `lint:justify reason:`)                                                                                                                                                                              | all four                                            | `integrity/suppressions`                                      |
| duplicate function bodies, normalized, min lines                                                                                                                                                                                                         | TI, SA, LA                                          | `structure/duplicate-functions`                               |
| unused functions across the shell set; `main` and `run_step` exempt; markers `lint:allow-unused-function`                                                                                                                                                | TI, SA, LA                                          | `structure/unused-functions`                                  |
| dead positional parameters                                                                                                                                                                                                                               | SA `unused-functions.js`                            | `structure/dead-parameters`                                   |
| trivial functions (statement ceiling), narrow reasoned suppression                                                                                                                                                                                       | SA `functions/shell.js`, SS `trivial-functions.mjs` | `structure/trivial-function`                                  |
| file and function length                                                                                                                                                                                                                                 | all                                                 | `structure/file-length`, `structure/function-length`          |
| prefix collisions with a per-directory allowlist (`pre` in hook dirs)                                                                                                                                                                                    | TI, SA                                              | `structure/prefix-collisions`                                 |
| single-script folders with allowlist                                                                                                                                                                                                                     | SA `folder-shape.js`, TI                            | `structure/single-file-folder`                                |
| script policy: no inline `node -e`, no forwarding wrappers, no compat, or deprecated alias names                                                                                                                                                         | SA, SS `script-policy`                              | `structure/bash-script-policy`                                |
| runtime embeds: no inline Python, Node or generated-script heredocs                                                                                                                                                                                      | TI `embeds.py`                                      | `structure/bash-embeds`                                       |
| named and documented multi-line ssh blocks                                                                                                                                                                                                               | SA `ssh-blocks.js`, TI `heredocs.py`                | `structure/bash-ssh-blocks`                                   |
| `${VAR:-default}` only in config owners, allowed fragments                                                                                                                                                                                               | TI `config.py`, SA `defaults.js`                    | `structure/bash-config-defaults`                              |
| idempotent config guards, one per owner                                                                                                                                                                                                                  | TI `config_guards.py`                               | `structure/bash-config-guards`                                |
| source boundaries: `# Boundary:` header, source annotations, ownership                                                                                                                                                                                   | TI `architecture.py`                                | `structure/bash-boundaries`                                   |
| interpreter policy: `#!/usr/bin/env bash` or `#!/bin/bash`; line 2 is `#`; line 3 a concrete description; line 4 `# Runtime: Bash N.N+, macOS and Linux.`; Bash 4 features (`mapfile`, `declare -A`, case conversion, `coproc`, `wait -n`) named as such | TI `bash.py`                                        | `structure/bash-interpreter`                                  |
| script shape: computed directory constants use `CDPATH=`, `cd --`, `pwd -P` and a failure path; `main "$@"` last in executables; readonly top-level assignments; library files declarative at top level; executable bit matches the file's role          | TI `bash.py`                                        | `structure/bash-interpreter`                                  |
| beyond the reference set: `set -euo pipefail` and `shopt -s inherit_errexit` in every executable, `trap` cleanup for every temporary file                                                                                                                | new                                                 | `structure/bash-interpreter`                                  |
| vague script stems (`common`, `helper`, `utils`) and a file stem equal to a sibling directory                                                                                                                                                            | TI `naming/checks/shell.py`                         | naming containers group; `structure/file-directory-collision` |
| `_` prefix for functions no other file calls; `_` functions above the rest                                                                                                                                                                               | new                                                 | `structure/private-prefix`, `structure/private-before-public` |
| branches, nesting, mutable assignments per function                                                                                                                                                                                                      | TI `complexity.py`                                  | ast-grep counts                                               |
| safety: no `\|\| true`, no `pkill -f`, no `rm -rf` outside owners, unchecked `cd`, state-file sourcing, unowned cleanup, GPU sweeps                                                                                                                      | TI `safety.py`                                      | `structure/bash-safety` with `[tools.bash.safety] owners`     |
| shell naming categories                                                                                                                                                                                                                                  | all                                                 | naming engine                                                 |
| hooks Semgrep: no `curl \| sh`, no `eval`                                                                                                                                                                                                                | LA `site/semgrep/hooks.yml`                         | `security/semgrep`                                            |
| hook shape: three hook files exist, each calls the runner                                                                                                                                                                                                | SS `hooks/shell.mjs`                                | `integrity/task-policy`                                       |

## 7. Swift

Source: `SA ios/.swiftlint.yml`, `.swiftformat`, `.periphery.yml`, `quality/naming/extractors/swift.js`, `security/semgrep/rules/ios/`.

| Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                  | gspot                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| SwiftLint: the selected opt-in rules, 4 analyzer rules, limits, `missing_docs` on open and public, `unused_import` keep list; `identifier_name` and `type_name` off in favor of the naming engine; `no_magic_numbers`, `type_contents_order`, `file_types_order`, `no_empty_block` on at `all` without a baseline; beyond the reference set `explicit_acl`, `explicit_top_level_acl`, `private_over_fileprivate`, `file_name_no_space`, `file_header` | `swift/swiftlint`, `swift/swiftlint-analyze` (manual, needs build)                                     |
| `private` and `fileprivate` top-level declarations above the rest                                                                                                                                                                                                                                                                                                                                                                                     | new                                                                                                    | `structure/private-before-public` |
| `ProcessInfo.processInfo.environment` read only in the configuration owner                                                                                                                                                                                                                                                                                                                                                                            | new                                                                                                    | `structure/env-access-owner`      |
| SwiftFormat config: the enabled and disabled rule lists and options                                                                                                                                                                                                                                                                                                                                                                                   | `swift/swiftformat`                                                                                    |
| Periphery with the retain options                                                                                                                                                                                                                                                                                                                                                                                                                     | `swift/periphery` (push)                                                                               |
| `swiftlint lint --strict` at commit, analyze after `xcodebuild` at push                                                                                                                                                                                                                                                                                                                                                                               | stages                                                                                                 |
| Semgrep iOS: 14 rules (keychain accessibility, secrets in plist and UserDefaults, insecure HTTP, ATS exceptions, weak hashes, UIWebView, unsafe pointer casts, sensitive logging, script eval and unquoted vars, JavaScript in WKWebView, hardcoded keys and credential URLs)                                                                                                                                                                         | `security/semgrep` with `packages/cli/configurations/language/swift/semgrep/ios.yml` (K-248)           |
| naming: swift categories, `pascal-plus` file case, 40 characters, 5 words                                                                                                                                                                                                                                                                                                                                                                             | naming engine                                                                                          |
| trivial functions                                                                                                                                                                                                                                                                                                                                                                                                                                     | `structure/trivial-function`                                                                           |
| `///` doc comments over `/** */`                                                                                                                                                                                                                                                                                                                                                                                                                      | SwiftLint custom rule                                                                                  |
| snapshot test config lint                                                                                                                                                                                                                                                                                                                                                                                                                             | `swift/swiftlint` second config through `[tools.swiftlint.extra_configs]`                              |
| Swift tests, checked by nothing in the reference tree beyond five SwiftLint rules: disabled tests with reasons, sleeps, a snapshot recording mode left on, snapshot references without a test, coverage                                                                                                                                                                                                                                               | `xctest/disabled`, `xctest/no-sleep`, `xctest/recording`, `xctest/reference-images`, `xctest/coverage` |
| Xcode project files, checked by nothing in the reference tree: plist and entitlements (`plutil -lint`), xcconfig secrets, xcstrings completeness, asset catalogues, test plans, orphan sources, tracked symlinks, entitlement policy, ATS exceptions                                                                                                                                                                                                  | the xcode configuration, one check each                                                                |

## 8. SQL and Supabase

Source: `SA quality/sql/`, `SA .squawk.toml`, `SA supabase/`, `SA security/semgrep/rules/supabase.yml`, `SA naming/extractors/sql.js`.

| Rule                                                                                                                                                                                                                      | gspot                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| sqlfluff over every SQL file with `sql_file_exts` covering `.pgsql` and `.psql`, dialect from the database configuration                                                                                                  | `sql/sqlfluff`                                                    |
| squawk over migrations, `assume_in_transaction`, excluded rules, scoped to migrations after a baseline version                                                                                                            | `postgres/squawk`                                                 |
| migration filename `YYYYMMDDHHMMSS_snake_case.sql`                                                                                                                                                                        | naming engine `snake-migration`                                   |
| migration header: boxed separators, `-- Migration: <file>`, `-- Purpose:`; section headings boxed; entities under their section; entity labels with purpose and separators; trigger comments; generated statements marked | `postgres/migration-docs`                                         |
| trivial PL/pgSQL functions: a function whose body only calls one other function with its parameters, or has at most the trivial statement ceiling (`SA functions/sql.js`)                                                 | `sql/functions`                                                   |
| migration data check                                                                                                                                                                                                      | `[[check]]` carried at init                                       |
| migration immutability after a version                                                                                                                                                                                    | `postgres/migrations-frozen` with `[tools.squawk] frozen_through` |
| generated types match the database                                                                                                                                                                                        | `supabase/types-fresh`                                            |
| edge functions: Deno lint and format, no dynamic import, no eval, no wildcard CORS with credentials, JSON body validated                                                                                                  | `supabase/deno-lint`, `security/semgrep`                          |
| service-role key never in client code, no RLS bypass, no raw SQL interpolation, no RPC with user input, no secrets in console logs                                                                                        | `security/semgrep` (10 rules)                                     |
| SQL naming: schemas, tables, columns, functions, parameters, indexes, triggers, policies snake case; 55 characters, 7 words; `uuid_v7` identifier pattern                                                                 | naming engine                                                     |
| `supabase/config.toml` validates                                                                                                                                                                                          | `configs/schema`                                                  |
| `supabase gen types` freshness                                                                                                                                                                                            | `supabase/types-fresh`                                            |

## 9. Static site and Cloudflare

Source: `LA quality/site/`, `LA quality/config/`, `LA .stylelintrc.json`, `LA _headers`.

| Rule                                                                                                                                                                                                       | gspot                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| html-validate over templates (recommended plus doctype lowercase, required attributes, no inline style, no raw characters, self-closing voids, `wcag/h37`) and over built output (recommended, `wcag/h37`) | `html/html-validate`, `static-site/html-validate-built`                                                                                          |
| HTML copy: no hard-coded user-facing text in templates; placeholders only; attribute and value tags covered                                                                                                | `html/copy`                                                                                                                                      |
| HTML script policy: no executable inline scripts except `ld+json`, no inline handlers, no `javascript:` URLs, no `document.write`                                                                          | `html/scripts`                                                                                                                                   |
| PurgeCSS dead selectors with a safelist                                                                                                                                                                    | `css/dead-selectors`                                                                                                                             |
| stylelint standard with the site overrides                                                                                                                                                                 | `css/stylelint`                                                                                                                                  |
| jscpd for JS and CSS                                                                                                                                                                                       | `duplication/jscpd`                                                                                                                              |
| madge circular imports                                                                                                                                                                                     | `import-x/no-cycle`, which resolves CommonJS too; madge is cut                                                                                   |
| linkinator internal crawl at push, external at manual with status overrides and skip patterns                                                                                                              | `static-site/links-internal`, `docs/links-external`                                                                                              |
| Lizard complexity for plain JavaScript, with the `.whitelizard` baseline                                                                                                                                   | `sonarjs/cognitive-complexity` over every JavaScript file ESLint sees; the `.whitelizard` file is not carried; Lizard is cut                     |
| Semgrep landing rules (10)                                                                                                                                                                                 | `security/semgrep` with the cloudflare pack for the rules that name the platform; the six that name functions of the site go to the site (K-218) |
| `_headers` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, cache rules for HTML                                                                                                       | `integrity/security-headers` (static-site; a framework app's headers live in its configuration and its rule file)                                |
| knip with entry points                                                                                                                                                                                     | `javascript/knip`                                                                                                                                |
| SVG normalization                                                                                                                                                                                          | `assets/svgo`                                                                                                                                    |
| build reproducibility (build twice, compare)                                                                                                                                                               | `static-site/build-reproducible`                                                                                                                 |

## 10. Next.js and its libraries

Source: `SS quality/`.

| Rule                                                                                                                                                                                            | gspot                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `eslint-config-next` vitals and typescript, `@eslint/compat` on ESLint 10                                                                                                                       | `typescript/eslint` under nextjs                                                                                                |
| boundaries: route, feature, shared from `[architecture]`; feature not to route; shared not to feature or route; allowed edges with reasons                                                      | `boundaries/dependencies`                                                                                                       |
| server files carry `import 'server-only'`; client files read only public env                                                                                                                    | `gspot/require-server-only`, `gspot/no-client-environment`                                                                      |
| a segment holds `page` or `route`, not both                                                                                                                                                     | `integrity/route-segments`                                                                                                      |
| `next.config.*` holds no secret in `env` and no `ignoreDuringBuilds` or `ignoreBuildErrors`                                                                                                     | `integrity/next-config`                                                                                                         |
| CSS modules: every class used, every used class defined                                                                                                                                         | `css/usage`                                                                                                                     |
| locales: ICU parse, no empty message, keys without dots, every locale complete against the base, every message used (through the type checker)                                                  | `i18n/locales`                                                                                                                  |
| required rules present in the resolved ESLint config                                                                                                                                            | `javascript/required-rules`                                                                                                     |
| pinned `packageManager`, root lockfile present, no foreign lockfiles, next aligned with eslint-config-next, react with react-dom                                                                | `dependencies/manifest-policy`; syncpack version groups for the pairs                                                           |
| root packages private; engines aligned across workspace packages; installed versions equal the lockfile; peers satisfied; `bunfig.toml` keeps `minimumReleaseAge` 604800 and the Socket scanner | `dependencies/manifest-policy`, `dependencies/install-policy`                                                                   |
| manifests sorted, four-space indentation                                                                                                                                                        | `package-json/order-properties` through eslint-plugin-package-json with `[tools.package-json] indent`; sort-package-json is cut |
| docs: every Markdown link and anchor resolves                                                                                                                                                   | lychee `--offline --include-fragments`                                                                                          |
| task policy: required runner tasks exist, no runtime-named folders, no stale paths                                                                                                              | `integrity/task-policy`                                                                                                         |
| zod rules (13), react-hook-form, tanstack-query, zustand, drizzle, trpc rule files                                                                                                              | library configurations                                                                                                          |
| framework entry files retain mandatory structural rules                                                                                                                                         | nextjs configuration overrides                                                                                                  |

## 11. Repository-wide

| Rule                                                                                                                                                                                                                                                                    | Sources                                              | gspot                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| typos with extend-words carrying reasons, excludes by nature                                                                                                                                                                                                            | all                                                  | `spelling/typos`                                                                                                               |
| Prettier with the shared options, `embeddedLanguageFormatting: off`                                                                                                                                                                                                     | all                                                  | `formatting/prettier`                                                                                                          |
| `.editorconfig` derived from `[format]`                                                                                                                                                                                                                                 | SA                                                   | `formatting/editorconfig-checker`                                                                                              |
| editorconfig-checker                                                                                                                                                                                                                                                    | SA qlty                                              | `formatting/editorconfig-checker`                                                                                              |
| markdownlint with MD007 from the indent setting, MD013 off, MD024 siblings, MD033 off, MD041, MD046 fenced, MD048 backtick, MD049 underscore, MD050 asterisk                                                                                                            | all                                                  | `markdown/markdownlint`                                                                                                        |
| commitlint with the conventional rules written in, type enum, scope enum from `[tools.commitlint] scopes` or the scope paths, no start-, pascal- or upper-case subject, header 72, body line 72 (the corpus limits)                                                     | all                                                  | `commits/commitlint` (commit-msg hook)                                                                                         |
| gitleaks with `useDefault`, reviewed allowlists, reviewed baseline                                                                                                                                                                                                      | all                                                  | `secrets/gitleaks`                                                                                                             |
| trufflehog                                                                                                                                                                                                                                                              | SA qlty                                              | `secrets/trufflehog` (push)                                                                                                    |
| osv-scanner over lockfiles with ignored vulnerabilities carrying reasons                                                                                                                                                                                                | all                                                  | `dependencies/osv` (push)                                                                                                      |
| trivy config and image                                                                                                                                                                                                                                                  | SA                                                   | `docker/trivy-config` (push, docker)                                                                                           |
| bearer with skip paths and ignore file                                                                                                                                                                                                                                  | SA, LA, TI                                           | Semgrep carries the same pattern classes; bearer is cut and its ignore entries map to Semgrep rule ignores                     |
| semgrep with the configuration rule packs and vendored OWASP, python, bash, secrets sets                                                                                                                                                                                | all (never wired in SA; wired here)                  | `security/semgrep` (push); the vendored bandit set is cut because Ruff `S` is the port                                         |
| CodeQL per language with scan configs, false-positive filter, path integrity                                                                                                                                                                                            | all                                                  | `security/codeql` (manual)                                                                                                     |
| hadolint                                                                                                                                                                                                                                                                | SA, TI                                               | `docker/hadolint`                                                                                                              |
| `docker compose config`                                                                                                                                                                                                                                                 | none ran it; the audit named it                      | `docker/compose-config`                                                                                                        |
| ansible-lint over playbooks                                                                                                                                                                                                                                             | SA pinned `ansible-core`, ran nothing                | `ansible/lint` when a playbook or `ansible.cfg` exists                                                                         |
| nginx `-t` through the compose service                                                                                                                                                                                                                                  | SA `nginx/lint.js`                                   | `nginx/config-test` (push, docker)                                                                                             |
| dotenv-linter                                                                                                                                                                                                                                                           | SA qlty (never ran)                                  | `configs/dotenv`                                                                                                               |
| license allowlist with exact-version exceptions; every lockfile through `osv-scanner`; TI exceptions record the accepted license and a reason                                                                                                                           | all                                                  | `licenses/packages`, `licenses/packages` (push); every exception carries `license` and fails when the reported license differs |
| syncpack one version per dependency across the workspace                                                                                                                                                                                                                | SA                                                   | `dependencies/syncpack` with a rendered config that also holds the paired-package groups                                       |
| lychee offline over Markdown                                                                                                                                                                                                                                            | SA                                                   | `docs/links` (lychee, `--include-fragments`)                                                                                   |
| package.json: exact versions no ranges, sorted, no scripts under mise, engines match runtime pin, bun version matches mise pin; root scripts limited to approved wrappers, `bun run` references exist, no section-marker scripts, package scripts never wrap `mise run` | SA `packages/*.js`, LA `package-json/scripts.js`, SS | `dependencies/manifest-policy` with `[tools.package-json] scripts` and `allowed_scripts`                                       |
| tracked files over a size limit outside LFS                                                                                                                                                                                                                             | new                                                  | `integrity/large-files`                                                                                                        |
| frozen lockfile verify (`bun install --frozen-lockfile --dry-run`, `uv lock --check`)                                                                                                                                                                                   | all                                                  | `dependencies/lockfile-fresh`                                                                                                  |
| production env guard, no `.env*` staged except templates                                                                                                                                                                                                                | all                                                  | `secrets/env-files`                                                                                                            |
| git-lfs pre-push when installed                                                                                                                                                                                                                                         | LA, TI                                               | hook body                                                                                                                      |
| stale paths: no text in the tree names a deleted folder                                                                                                                                                                                                                 | SA, LA `stale-paths.js`                              | `docs/stale-paths`                                                                                                             |
| folder allowlists resolve                                                                                                                                                                                                                                               | SA, LA, TI                                           | `integrity/allowlists-match`                                                                                                   |
| config purity: config files hold literals only                                                                                                                                                                                                                          | SA `integrity/architecture.js`, LA, TI               | `integrity/config-purity` (forward check only; the inverse check that forced scalars into config folders is not carried)       |
| suppression census: `eslint-disable`, `@ts-expect-error`, `@ts-ignore`, `lint:justify`, `nosemgrep`, `shellcheck disable`, `swiftlint:disable`, `noqa`, `nosec`, `type: ignore` counted, each with a reason                                                             | SA `LINTING.md`, TI                                  | `integrity/suppressions`                                                                                                       |
| minimum plugin versions (unicorn needs ESLint 9.38)                                                                                                                                                                                                                     | SA, LA `version-policy.js`                           | `doctor` version checks                                                                                                        |
| CodeQL false-positive file names an existing path                                                                                                                                                                                                                       | SA, LA                                               | `integrity/allowlists-match`                                                                                                   |
| Semgrep suppression census                                                                                                                                                                                                                                              | SA `integrity/semgrep-suppressions.js`               | `integrity/suppressions`                                                                                                       |
| `.gitattributes` binary and generated markers respected                                                                                                                                                                                                                 | SA                                                   | file natures                                                                                                                   |
| coverage thresholds gate (80 percent)                                                                                                                                                                                                                                   | SA, ran only under a variable                        | `vitest/coverage`, `pytest/coverage` (push) with `[tools.vitest] coverage`                                                     |

## 12. Prose

Source: `SA LINTING.md`, section "Prose linting with Vale." Nothing in it ran; all of it lands.

| Rule                                                                                                                                                                                                                                                                                                                                                                                                      | gspot                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `gspot.dashes`, `present-state`, `modals`, `hedging`, `marketing`, `idioms`, `since`, `self-reference`, `file-paths`, `locations`, `defaults`, `future`, `version-range`, `interface-verbs`, `us-english`, `possessives`, `headings`, `title`, `heading-names`, `sentence-length`, `step-length`, `paragraph-length`, `acronyms`, `link-text`, `alt-text`, `placeholders`, `dates`, `currency`, `symbols` | the `gspot` Vale style, every rule an error             |
| Google, Microsoft, write-good, proselint, alex, RedHat packages with the disabled-rule list                                                                                                                                                                                                                                                                                                               | `.gspot/config/vale.ini`                                |
| Harper grammar with spelling rules off                                                                                                                                                                                                                                                                                                                                                                    | last, own step                                          |
| vocabulary accept list                                                                                                                                                                                                                                                                                                                                                                                    | `[prose] vocabulary`                                    |
| shell and SQL comments through stdin grammars; no `/* */` in SQL; no in-text Vale directives in Markdown                                                                                                                                                                                                                                                                                                  | prose engine                                            |
| error messages start uppercase; client messages carry no interpolated identifiers; log messages are stable                                                                                                                                                                                                                                                                                                | ESLint `no-restricted-syntax` selectors; Ruff `EM`, `G` |
| `jsdoc/no-types`; Swift `///`                                                                                                                                                                                                                                                                                                                                                                             | ESLint, SwiftLint custom rule                           |
| shell function headers `# name: summary`; `lint:justify reason: X` without dashes                                                                                                                                                                                                                                                                                                                         | bash doc style default                                  |

## 13. Agent rule corpus

The 49 files of `rules/` land as the corpus, per layer, in
[09-rules.md](09-rules.md). `CLAUDE.md` and `AGENTS.md` gain a managed block that
indexes them by area, in the table style slopshop uses.

## Reference tool versions

The versions the four repositories pin today, taken as the initial configuration pins:

| Tool                       | Version                                                                                                                    | Tool                                                                                            | Version                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| bun                        | 1.3.11                                                                                                                     | node                                                                                            | 22.13.1 (24.20.0 in slopshop)                                                   |
| python                     | 3.12                                                                                                                       | uv                                                                                              | latest                                                                          |
| eslint                     | 9.38.0 (10.9.1 in slopshop)                                                                                                | typescript                                                                                      | 5.9.3                                                                           |
| typescript-eslint          | 8.29.0 (8.69.0)                                                                                                            | prettier                                                                                        | 3.8.1                                                                           |
| knip                       | 5.85.0 (6.34.0)                                                                                                            | markdownlint-cli2                                                                               | 0.22.1 (0.23.2)                                                                 |
| commitlint                 | 20.4.3 (21.2.2)                                                                                                            | eslint-plugin-sonarjs                                                                           | 3.0.0 (4.2.0)                                                                   |
| eslint-plugin-unicorn      | 63.0.0 (74.0.0)                                                                                                            | eslint-plugin-jsdoc                                                                             | 50.8.0 (64.3.4)                                                                 |
| eslint-plugin-n            | 17.24.0 (18.3.0)                                                                                                           | eslint-plugin-security                                                                          | 4.0.0                                                                           |
| eslint-plugin-regexp       | 2.10.0                                                                                                                     | eslint-plugin-import-x                                                                          | 4.17.1                                                                          |
| eslint-plugin-boundaries   | 5.0.0 (7.2.0)                                                                                                              | eslint-plugin-zod                                                                               | 4.12.0                                                                          |
| eslint-plugin-package-json | 1.5.0 (1.8.0)                                                                                                              | @vitest/eslint-plugin                                                                           | 1.3.24                                                                          |
| stylelint                  | 17.4.0                                                                                                                     | stylelint-config-standard                                                                       | 40.0.0                                                                          |
| html-validate              | 10.4.0                                                                                                                     | linkinator                                                                                      | 7.6.1                                                                           |
| purgecss                   | 8.0.0                                                                                                                      | jscpd                                                                                           | 4.0.8 (5.0.9)                                                                   |
| svgo                       | 4.0.1                                                                                                                      | license-checker-rseidelsohn                                                                     | 5.0.1                                                                           |
| syncpack                   | 15.3.3                                                                                                                     | squawk-cli                                                                                      | 2.64.0                                                                          |
| supabase                   | 2.72.7                                                                                                                     | deno                                                                                            | 2.6.6                                                                           |
| shellcheck                 | 0.11.0                                                                                                                     | shfmt                                                                                           | 3.12.0                                                                          |
| typos                      | 1.43.5                                                                                                                     | gitleaks                                                                                        | 8.30.0                                                                          |
| osv-scanner                | 2.3.3                                                                                                                      | trivy                                                                                           | 0.70.0                                                                          |
| semgrep                    | 1.152.0                                                                                                                    | codeql                                                                                          | 2.24.3                                                                          |
| hadolint                   | 2.14.0                                                                                                                     | lychee                                                                                          | 0.24.2                                                                          |
| vale                       | 3.21.0                                                                                                                     | swiftlint                                                                                       | 0.63.2                                                                          |
| swiftformat                | 0.61.1                                                                                                                     | periphery                                                                                       | 3.6.0                                                                           |
| sqlfluff                   | 4.0.0                                                                                                                      | ansible-core                                                                                    | 2.19.4                                                                          |
| ast-grep                   | the latest stable release on the day the configuration is written, recorded in the manifest, moved only by a gspot release | ruff, basedpyright, deptry, vulture, pydoclint, import-linter, pip-licenses, validate-pyproject | the same rule, starting from the versions the reference `uv.lock` files resolve |

Where two repositories pin different versions, the configuration takes the newer one and the ledger records the older as the floor `doctor` accepts. Some tools the reference repositories pinned are not used. [11-toolchain.md](11-toolchain.md) lists them (lizard, madge, sort-package-json, bearer, bandit, pip-audit, interrogate, pyright) with the tool that does their job.

## Configuration enforcement contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.
The configuration entries retain agreed enforcement, settings, and detection, including unimplemented
capabilities. They are target contracts, not a generated inventory of the current manifests.
The level owner in [configurations](04-configurations.md) governs every rule below: house-style, naming, layout,
and optional abstraction preferences remain available at `all`. Trivial-function and trivial-file
enforcement is mandatory at both levels, as defined in [slop in structure](07-slop-drift.md#slop-in-structure).
Stage selection follows [hooks and execution](10-hooks-ci-runners.md#stages): build, analyzer,
coverage, daemon, and network prerequisites must use their specified push/manual boundaries.
Tool versions come from validated manifests; historical comparison versions are not a second pin.
Root pointers use the configuration contract, not copies of generated tool configuration.

### Acceptance K-149

A check that runs for a scope or a file list receives those files in its input. Only
a check with `runs = "once"` can reach the whole repository.

`EngineInput` holds `files` and `scopeRoot`, and loses `session`. A check with
`runs = "once"` also gets `repositoryFiles`. The supabase reader finds `supabase/config.toml`
under `scopeRoot`. `static-site/svg-optimized` reports a saving over 10 percent at `recommended`,
and any saving at `all`.

A planted repository with two Swift scopes holds each finding under its own scope. A
planted Supabase project under `apps/backend/` is found.

### Acceptance K-144

Sources are compared by path. The snapshot layout is a setting with the default of
the snapshot library. A test file is found by what it imports.

The project reader resolves each file reference through its group path. The setting
`tools.xctest.reference_layout` is a pattern with `{file}` and `{test}`, by default
`__Snapshots__/{file}/{test}.*`. `swift-tests.ts` calls a file a test file when it imports
`XCTest` or `Testing`, or holds `@Test` or `@Suite`. The reason of a skipped test is the text
argument of `XCTSkip` or `.disabled`, and an empty one is the finding. `xcode/test-plan` moves to
`all`.

Planted cases for two files of one name, a Swift Testing file outside `Tests`, and a
skip with an empty reason.

### Acceptance K-153

A module is named from the package roots the project declares.

The reader takes roots from `[tool.setuptools.packages.find] where`,
`[tool.hatch.build.targets.wheel] packages`, a `src/` folder, and then the scope root.

`python.test.ts` plants a cycle under `src/` in a scope.

### Acceptance K-154

The build writes into a folder of the cache, and the tree is unchanged.

The check copies the scope through `scratchCopy`, less the ignored files, and builds
there. The command is the `build` script run through the package manager `nypm` detects. A
command from a setting is parsed with shell quoting rules, by one function in
`run/tool-runner.ts`.

A planted site that tracks `dist` holds a clean `git status` after
`gspot check --stage push`.

### Acceptance K-160

`sql/syntax` runs where the dialect is `postgres`. `init` proposes the dialect from
what it finds.

The setting `tools.sql.dialect` takes a `detect` table (K-93): a `supabase/` folder or
`pg` in the dependencies gives `postgres`, `mysql2` gives `mysql`, and `better-sqlite3` gives
`sqlite`. The check declares `waits_for` that setting with the value `postgres`.

A planted MySQL file with a backtick name holds no finding.

### Acceptance K-184

The check accepts the places Docker reads.

Three candidates: the folder of the Dockerfile, `<name>.dockerignore` beside it, and
the scope root.

A planted `docker/Dockerfile` with the ignore file at the root holds no finding.

### Acceptance K-191

A default names no folder. A rule with nothing passed reports nothing.

The template passes `tools.eslint.env_files`, `tools.vitest.harness_directory`, and
`tools.next.server_files`, each with an empty default and a `detect` table where a convention of
the framework exists.

Each rule test gains a case with no option, which expects no report.

### Acceptance K-211

Implement the agreed React, Next.js, React Native, NestJS, Vue, and Svelte integrations recorded in the enforcement ledger. Preserve the planned Jest configuration and testing-library integrations even where no manifest exists. Test focused-test failures under Jest and Vitest. This is a bounded integration commitment, not an instruction to add every available linter.

### Acceptance K-50

A framework configuration carries its naming rules as `[[naming.rules]]` in its manifest
. The engine knows no framework.

`policy.ts` merges the rules of the selected manifests after the shared policy. The
react rule accepts PascalCase for a function that returns JSX and for its file. The `handle`
prefix is a rule of react, express, and nestjs. The Next.js route file names move to the nextjs
manifest.

The react planted test installs with naming and holds no finding for `UserCard.tsx`.
An Express planted handler named `handleLogin` holds none.

### Acceptance K-49

The prefix of a file name is its first word, in any case style.

`prefixOf` calls `splitName` of `naming/split.ts` and takes the first part. Peers are
files whose nature is `source`.

Unit tests for `user_card.py`, `UserCard.swift`, and `user-card.ts` beside a README.

### Acceptance K-137

The extractor skips a binding whose value is `await import(...)`, and nothing else.

`isImportBinding` tests that the awaited node is a call whose function is `import`.

A unit test with both forms.

### Acceptance K-233

The css configuration claims `.css` alone. Detection names Sass as a language gspot has no
configuration for.

Two endings leave the claim.

The css planted repository holds a `.scss` file with a mixin and no finding.

### Acceptance K-236

One check, `licenses/packages`, runs `osv-scanner` with its license flag over every
lockfile of the scope. The supabase configuration gains `supabase/db-lint` at the `manual` stage.

The allowed list stays `tools.licenses.allowed`, and the scanner takes it as
`--licenses=<list>`. `supabase/db-lint` declares `requires = "database"`, as
`supabase/types-fresh` does.

A planted uv project with a package under `GPL-3.0-only` fails, and an npm one passes on MIT.

### Acceptance K-248

Preserve every agreed enforcement requirement in the ledger, including Python structure, PL/pgSQL trivial functions, Swift doc comments, non-npm licenses, and Swift test overrides. A missing manifest is open work, not permission to delete the capability. Do not enforce arbitrary rule totals.

### Acceptance K-249

A pin is never below the version a reference repository runs.

The registry test of K-206 reads the floors from a table in `tests/acceptance/release/` and fails
a pin below one.

That test.

### Acceptance K-256

The xctest configuration writes a nested SwiftLint file over the folders it claims, with the
three rules off.

SwiftLint reads a `.swiftlint.yml` in a subfolder as a nested config. The manifest
writes one pointer file into each claimed test folder, with `parent_config` set to the file under
`.gspot/`, using the supported tool include mechanism.

A planted test file with a force unwrap holds no finding, and a source file holds one.

### Acceptance K-87

Preserve each intended policy while removing proven duplication. Share parsing,
traversal, comparison, or reporting operations only where actual callers use the same contract.
Keep Bash, Python, Swift, SQL, and TypeScript semantics explicit. TypeScript keeps its editor
integration through ESLint. Language check identifiers retain their policy and exception
scope.

Recommended and all follow the level owner. Trivial-function and trivial-file rules run at both levels.

Run representative invalid and valid language cases through the actual owner.
Use generated config for tool replacements and assert the check, diagnostic, file, and location.
Exercise language-specific distinctions, exemptions, anonymous functions, and corrected input.
A table saying a language supports an idea is descriptive metadata, not evidence of enforcement.

### Acceptance K-254

`bash/syntax` reads `.sh`, `.bash`, and files with a Bash shebang. `bash/zsh-syntax`
runs `zsh -n` over `.zsh` files, and `bash/bats-syntax` runs `bats --count` over `.bats` files.

Three checks with three claims. `zsh` and `bats` are host tools, so an absent one
reports `missing` with its install hint. ShellCheck and shfmt keep skipping `.zsh`, which the
manifest already says.

`tests/acceptance/source/configurations/bash/syntax.test.ts` exercises valid and broken syntax in each dialect.

### Acceptance K-258

`{file}` is replaced where it stands, in any position.

`plainPart` returns a marker object for `{file}`, and `perFileCommands` maps each
built command by replacing the marker. The manifest command gains `--no-env-resolution`.

A unit test builds a command with `{file}` first, in the middle, and last. The docker
planted repository holds a Compose file with `env_file`, a good one, and one with a bad key
(T-28).

### Acceptance K-134

The option is required where the header declares Bash 4.4 and up. It is a finding of
`bash-interpreter` where the header declares an older Bash.

`BASH_FOUR_FEATURES` gains the option. `STRICT_MODE` holds `set -euo pipefail` alone,
and a second constant holds what Bash 4.4 adds.

Two planted scripts, one for each header, each valid under its own rule.

### Acceptance K-172

A route counts as tested when a test file of the same scope imports it.

The check asks the import index of the scope, which the structure engine builds, for
the importers of the route file, and keeps those the test claim matches.

`express.test.ts` plants `users.ts` and a test that names `users` in a comment, and
holds the finding.

### Acceptance K-178

The SQL reader knows block comments once, and every SQL check gets the line of the
statement.

The reader takes statement positions from `libpg-query`, which already skips both
comment forms, and drops its own scan.

A unit test with a block comment above `DROP TABLE` holds the line of `DROP`.

### Acceptance K-186

Trivial-file and trivial-function rules apply at both levels and in every scope, including
entry files declared through `tools.knip.entry`. Knip alone uses that setting for entry selection.
The plugin exposes no entry-file exemption. Root and nested entry files must report the same
structural defects as other source files. Preserve distinct plugin and native Vite coverage.

### Acceptance K-189

The rule reports an import whose target leaves the top-level folder of the importer.

The rule resolves the import against the file, takes the first segment under the
source root for both paths, and compares. The message names the alias only where one exists.
The rule option `scope` names source roots; without it, each top-level repository directory is a source root.

Valid: `features/cart/a.ts` imports `../cart/b`. Invalid: it imports `../user/b`.

### Acceptance K-192

A name the repository cannot change is exempt from every name check.

`nameProblems` returns early for a name in `naming.contract_properties`,
`naming.external`, or `naming.allowed`.

The unit test holds no finding for `Content-Type`.

### Acceptance K-226

The check builds the references where the file holds any.

The check reads `tsconfig.json` through `jsonc-parser`. With references it runs
`tsc -b --noEmit`, and without it runs `tsc --noEmit -p`.

A planted repository with two referenced projects and a type error holds the finding.

### Acceptance K-234

Each manifest declares the suppression comment of its tool, and the check reads every
comment style.

A tool in a manifest takes `suppression = { marker, reason }`. The check takes the
comment styles from `run/ignores.ts` and the markers from the selected manifests.

Planted files in SQL, CSS, HTML, and Markdown, each with a bare suppression.

### Acceptance K-250

`spdx-expression-parse`, `spdx-satisfies`, `mdast-util-from-markdown`, and `postcss`
are dependencies and do their job.

The license check calls `spdx-satisfies`. The docs checks walk the mdast tree.

Unit tests for the mixed expression and for a fenced `#` line.

### Acceptance K-251

Every flag of every manifest exists in the pinned tool.

The fixer drops the flag. The v8r check sets `V8R_CONFIG_FILE` through a new manifest
key `env`, which `tool-runner.ts` passes to the spawn.

The contract test runs `<tool> --help` for each pinned tool and holds each flag.

### Configuration swift

Kind: language. Requires: formatting. Recommends: structure, naming, spelling.

Detects and claims:

|                         |                                                                  |
| ----------------------- | ---------------------------------------------------------------- |
| Detect                  | `.swift` in the tree; `Package.swift`; `*.xcodeproj`             |
| Claims                  | `.swift`, `Package.swift`, `Package.resolved`                    |
| Required check coverage | format, syntax, style, types, structure, naming, prose, spelling |

Tools:

swiftlint, swiftformat, periphery, xcodebuild (host), swift (host).

Generated configuration:

| Target                        | Stub                                  | Holds                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/swiftlint.yml` | `.swiftlint.yml` with `parent_config` | the selected opt-in rules, 4 analyzer rules, limits from `[limits]`, `identifier_name` and `type_name` off, `missing_docs` on open and public, `explicit_acl`, `explicit_top_level_acl`, `private_over_fileprivate`, `file_name_no_space`, custom rules for `///` and banned-term regexes as a second line of defense |
| `.gspot/config/swiftformat`   | `.swiftformat`                        | the enabled and disabled rule lists, options from `[format]`                                                                                                                                                                                                                                                          |
| `.gspot/config/periphery.yml` | none                                  | project, schemes, retain options                                                                                                                                                                                                                                                                                      |

Checks:

| Id                                                    | Stage       | Command                                                                                                                 |
| ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `swift/swiftlint`                                     | commit      | `swiftlint lint --strict --quiet --config .gspot/config/swiftlint.yml --reporter json {files}`                          |
| `swift/swiftformat`                                   | commit      | `swiftformat --lint --config .gspot/config/swiftformat {files}`; fix order format                                       |
| `swift/build`                                         | push, build | `xcodebuild build-for-testing` or `swift build`, incremental compiler state retained; analysis has separate clean state |
| `swift/swiftlint-analyze`                             | push, build | `swiftlint analyze --strict --compiler-log-path <log>`                                                                  |
| `swift/periphery`                                     | push, build | `periphery scan --config .gspot/config/periphery.yml --strict`                                                          |
| `swift/trivial-function`, `swift/duplicate-functions` | commit      | analyses on the Swift grammar                                                                                           |
| `swift/private-before-public`                         | commit      | `private` and `fileprivate` top-level declarations above `internal`, `public` and `open` ones                           |
| `swift/env-access-owner`                              | commit      | `ProcessInfo.processInfo.environment` read only in the configuration owner                                              |

Every check here is a platform skip on Linux and Windows.

The five SwiftLint rules the reference repository measured and left off (`no_magic_numbers`,
`type_contents_order`, `file_types_order`, `no_empty_block`) are on
and are part of the level `all`.

Shipped rule sets:

The configuration renders these lists. They are the measured set of the reference repository, so the
acceptance run compares like with like. A person turns one rule off with
`gspot ignore swift/swiftlint --rule <rule>` and a reason.

SwiftLint opt-in rules:

```text
missing_docs explicit_init fatal_error_message first_where last_where empty_count empty_string
contains_over_first_not_nil contains_over_filter_count contains_over_filter_is_empty
contains_over_range_nil_comparison direct_return empty_collection_literal
flatmap_over_map_reduce untyped_error_in_catch accessibility_label_for_image
accessibility_trait_for_button private_swiftui_state prefer_self_in_static_references
closure_body_length closure_spacing array_init sorted_first_last collection_alignment
enum_case_associated_values_count switch_case_on_newline vertical_whitespace_between_cases
multiline_arguments multiline_arguments_brackets multiline_function_chains
multiline_literal_brackets multiline_parameters multiline_parameters_brackets number_separator
vertical_parameter_alignment_on_call vertical_whitespace_closing_braces
vertical_whitespace_opening_braces async_without_await convenience_type fallthrough
force_unwrapping function_default_parameter_at_end implicitly_unwrapped_optional
joined_default_parameter legacy_multiple legacy_random literal_expression_end_indentation
lower_acl_than_parent operator_usage_whitespace overridden_super_call
prefer_zero_over_explicit_init private_action private_outlet prohibited_super_call
raw_value_for_camel_cased_codable_enum reduce_into redundant_nil_coalescing
redundant_type_annotation static_operator toggle_bool trailing_closure unavailable_function
unneeded_parentheses_in_closure_argument unowned_variable_capture yoda_condition
balanced_xctest_lifecycle empty_xctest_method final_test_case test_case_accessibility
xct_specific_matcher unhandled_throwing_task discarded_notification_center_observer
identical_operands return_value_from_void_function weak_delegate superfluous_else
pattern_matching_keywords optional_enum_case_matching shorthand_optional_binding self_binding
prefer_key_path implicit_return redundant_self local_doc_comment period_spacing
prefer_self_type_over_type_of_self unneeded_override
```

SwiftLint opt-in rules added beyond the reference set, at the level `all`:

```text
no_magic_numbers type_contents_order file_types_order no_empty_block
explicit_acl explicit_top_level_acl private_over_fileprivate file_name_no_space
```

SwiftLint analyzer rules, run by `swift/swiftlint-analyze`:

```text
capture_variable typesafe_array_init unused_import unused_declaration
```

SwiftLint disabled rules. `identifier_name` and `type_name` are off because the naming
engine owns names. `trailing_whitespace`, `opening_brace` and `statement_position` are off because
SwiftFormat owns layout:

```text
trailing_whitespace opening_brace statement_position todo identifier_name type_name
discouraged_optional_collection discouraged_optional_boolean notification_center_detachment
large_tuple
```

SwiftLint options. Each number comes from `[limits]` and `[limits.swift]`, and warning equals error:

| Rule                    | Setting                            | Shipped                       | Options                                                            |
| ----------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `line_length`           | `format.print_width`               | 120                           | `ignores_comments`, `ignores_urls`, `ignores_interpolated_strings` |
| `file_length`           | `limits.file_lines`                | 300                           | `ignore_comment_only_lines`                                        |
| `type_body_length`      | `limits.swift.type_body_length`    | 300                           |                                                                    |
| `function_body_length`  | `limits.function_lines`            | 60                            |                                                                    |
| `closure_body_length`   | `limits.swift.closure_body_length` | 60                            |                                                                    |
| `cyclomatic_complexity` | `limits.cyclomatic_complexity`     | 8                             | `ignores_case_statements`                                          |
| `nesting`               | `limits.nesting`                   | type 1, function 2            |                                                                    |
| `missing_docs`          | none                               | error for `open` and `public` | `excludes_extensions`, `excludes_inherited_types`                  |
| `unused_import`         | `tools.swiftlint.keep_imports`     | `CoreGraphics`                |                                                                    |

`included` and `excluded` are not rendered: gspot passes the file list. The shipped exclusions
are file natures: `Pods`, `DerivedData`, `build`, `.build` and `Generated` folders are vendored
or generated, and `*.generated.swift` is generated.

SwiftFormat options. `--indent`, `--maxwidth` and `--linebreaks` come from `[format]`.
`--swiftversion` comes from `tools.swiftformat.swift_version`, and `init` reads the proposal from
`Package.swift` or the project's `SWIFT_VERSION`:

```text
--indent 4
--indentcase false
--ifdef indent
--maxwidth 120
--wraparguments before-first
--wrapparameters before-first
--wrapcollections before-first
--wrapreturntype preserve
--wrapconditions preserve
--closingparen same-line
--nospaceoperators ...,..<
--operatorfunc spaced
--ranges spaced
--allman false
--elseposition same-line
--guardelse next-line
--emptybraces no-space
--trimwhitespace always
--linebreaks lf
--importgrouping length,alpha
--self init-only
--swiftversion 5.9
```

SwiftFormat rules enabled, 50:

```text
blankLineAfterImports blankLinesAroundMark blankLinesAtEndOfScope blankLinesAtStartOfScope
blankLinesBetweenScopes consecutiveBlankLines consecutiveSpaces duplicateImports elseOnSameLine
emptyBraces hoistPatternLet leadingDelimiters linebreakAtEndOfFile linebreaks modifierOrder
redundantBackticks redundantBreak redundantClosure redundantExtensionACL redundantFileprivate
redundantGet redundantInit redundantLet redundantLetError redundantNilInit redundantObjc
redundantParens redundantPattern redundantRawValues redundantReturn redundantVoidReturnType
semicolons sortImports spaceAroundBraces spaceAroundBrackets spaceAroundComments
spaceAroundGenerics spaceAroundOperators spaceAroundParens spaceInsideBraces
spaceInsideBrackets spaceInsideComments spaceInsideGenerics spaceInsideParens strongOutlets
strongifiedSelf todos trailingSpace typeSugar void
```

SwiftFormat rules disabled. `redundantSelf` is off because `--self init-only` and the
SwiftLint rule `redundant_self` own it. The wrap rules are off because a formatter that rewraps
every argument list makes diffs nobody reads:

```text
redundantSelf trailingCommas wrapMultilineStatementBraces sortSwitchCases wrapEnumCases
unusedArguments acronyms organizeDeclarations sortDeclarations markTypes trailingClosures wrap
wrapArguments wrapAttributes initCoderUnavailable blankLinesBetweenImports numberFormatting
```

Periphery: `retain_public`, `retain_objc_accessible`, `retain_assign_only_properties`,
`retain_unused_protocol_func_params`, `retain_swift_ui_previews` and `retain_codable_properties`
are true. `project` and `schemes` come from `tools.xcode.project` and `tools.xcode.scheme`, and
`init` proposes the first shared scheme `xcodebuild -list` prints.

A scope with no Xcode project builds as a Swift package, into persistent incremental state under the managed build cache. An incremental build logs only the files that changed, and the analyzer
pairs each file with its compiler call from that log. The package manager hands the compiler its
sources in a response file, which the analyzer does not open, so gspot writes the file names into
the log. The log also names files the way SwiftLint does under `/tmp` and `/var` on macOS. An
analyzer finding carries the id of its SwiftLint rule, such as `unused_import`.

The structure checks read the Swift grammar: `swift/trivial-function`,
`swift/duplicate-functions`, `swift/private-before-public`, and `swift/env-access-owner`.
The [shared structural contract](07-slop-drift.md#slop-in-structure) owns statement counting,
trivial files, declared-parameter limits, and level selection. Attributes and `override` do not
exempt functions from the trivial-function rule. Required APIs need narrow, reasoned suppressions.

Settings:

`tools.swiftlint.keep_imports`, `tools.swiftformat.swift_version` (a rule turned off is `gspot ignore swift/swiftlint --rule <rule>`, rendered into `disabled_rules`), `tools.swiftformat.options`,
`tools.periphery.retain`, `tools.xcodebuild.scheme`, `tools.xcodebuild.destination`.

Rule files:

`language/SWIFT.md`, `language/naming/SWIFT.md`; `framework/swiftui/SWIFTUI.md` and
`framework/uikit/UIKIT.md` when the corresponding import appears in the sources.

Not covered here:

Package dependency scanning: osv-scanner has no `Package.resolved` extractor. The dependencies
configuration reports the gap.

### Configuration markdown

Kind: language. Requires: formatting. Recommends: docs, spelling.

Detects and claims:

|                         |                                       |
| ----------------------- | ------------------------------------- |
| Detect                  | `.md`, `.mdx` in the tree             |
| Claims                  | `.md`, `.mdx`                         |
| Required check coverage | format, style, links, prose, spelling |

Tools:

markdownlint-cli2, prettier, lychee.

Generated configuration:

| Target                             | Stub                                                                     | Holds                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gspot/config/markdownlint.jsonc` | `.markdownlint-cli2.jsonc` with `config.extends` and `globs` from claims | `default: true`; MD007 indent from `[format] indent_width`; MD013 off; MD024 siblings only; MD033 off; MD041 on; MD046 fenced; MD048 backtick; MD049 underscore; MD050 asterisk; MD060 off |
| `.gspot/config/lychee.toml`        | none                                                                     | through docs: `offline`, `include_fragments`; an online profile for the manual run                                                                                                         |

Checks:

| Id                      | Stage  | Command                                                                                                                                                                     |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markdown/markdownlint` | commit | `markdownlint-cli2 --no-globs --config .gspot/config/markdownlint.jsonc {files}` (the stub's globs are for editors; the check lints the file list alone); fix, order format |
| `markdown/prettier`     | commit | through formatting                                                                                                                                                          |
| `docs/links`            | commit | lychee offline with fragments, through docs                                                                                                                                 |
| `docs/headings`         | commit | banned headings absent                                                                                                                                                      |
| `markdown/fences`       | commit | every fenced block with a language tag parses; TypeScript, Python, Bash, SQL, TOML, JSON and YAML fences are extracted and handed to their language's syntax check          |
| `prose/vale`            | commit | through prose                                                                                                                                                               |

Settings:

`tools.markdownlint.rules` (per-rule options; off is a `gspot ignore --rule`), `tools.lychee.exclude` (reason).

Rule files:

`general/prose/DOCS.md` and its siblings (installed by docs), `general/prose/WRITING.md`.

### Configuration i18n

Kind: library. Requires: javascript.

Detects:

`next-intl`, `i18next`, `react-intl` or `@formatjs/intl` in dependencies.

Generated configuration:

The ESLint config gains `eslint-plugin-i18next` `no-literal-string` over JSX text and the
attributes `alt`, `aria-label`, `placeholder`, `title`.

Checks:

| Id                  | Stage  | Command                                                                                                                                                                                                                                     |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript/eslint` | commit | with `i18next/no-literal-string`                                                                                                                                                                                                            |
| `i18n/locales`      | push   | every catalog parses as ICU MessageFormat; no empty message; keys contain no dots; every locale has every key the base locale has and no extra; every key is used (through the type checker for next-intl, through a string scan otherwise) |

Settings:

`tools.i18n.translations` (the folder, the base locale, and the format)
(the package whose translator call is traced, default detected).

Rule files:

`shared/i18n/I18N.md`; `library/next-intl/NEXTINTL.md` when `next-intl` is a dependency.

### Configuration react-native

Kind: framework. Requires: react. Recommends: typescript, jest.

Detects and claims:

|        |                                                                             |
| ------ | --------------------------------------------------------------------------- |
| Detect | `react-native` or `expo` in dependencies                                    |
| Claims | `app.json`, `app.config.js`, `app.config.ts`, `metro.config.js`, `eas.json` |

Tools:

As libraries: @react-native/eslint-plugin 0.87.1, eslint-plugin-react-native 5.0.0, and
eslint-plugin-expo 1.1.0.

As a command: expo-doctor 1.20.4, where `expo` is a dependency.

eslint-plugin-react-native-a11y is left out: its range ends at ESLint 8. eslint-config-expo
is left out, because it brings its own copies of the React and TypeScript rules, which the react
and typescript configurations own.

Generated configuration:

Every shared rule of the javascript and typescript configurations reads the files of this framework
too, with the same limits. A rule this configuration turns off stands in its manifest with a
reason, and the page lists each one.

The ESLint config gains, over every code file:

- `@react-native/platform-colors` and `@react-native/no-deep-imports`;
- `react-native/no-unused-styles`, `react-native/no-raw-text`, `react-native/no-single-element-style-arrays`,
  and `react-native/split-platform-components`. At the `all` level: `react-native/no-inline-styles`
  and `react-native/no-color-literals`;
- the four rules of the Expo plugin: `expo/no-env-var-destructuring`, `expo/no-dynamic-env-var`,
  `expo/use-dom-exports`, and `expo/prefer-box-shadow`. The bundler replaces
  `process.env.EXPO_PUBLIC_NAME` where the text is written out in full.

The fragment exports four selectors, which the template joins into `no-restricted-syntax`
:

- an import of a `Touchable` component;
- a `FlatList` or a `SectionList` with no `keyExtractor`;
- a `map` call rendered inside a `ScrollView`;
- `AsyncStorage.setItem` with a key that names a secret.
  The
  fifth selector of the first form, an object inside a `style` prop, is the rule
  `react-native/no-inline-styles` now.

Names:

`[[naming.rules]]` of this configuration: the file stem ends before a platform suffix (`.ios`,
`.android`, `.native`, `.web`), so `Button.ios.tsx` and `Button.android.tsx` are one name.

Turned off:

| Rule                  | Why                                                             |
| --------------------- | --------------------------------------------------------------- |
| every `jsx-a11y` rule | they read DOM elements, and a React Native view tree holds none |

Checks:

| Id                         | Stage | Command                                                         |
| -------------------------- | ----- | --------------------------------------------------------------- |
| `react-native/expo-doctor` | push  | `expo-doctor`, in a scope that depends on `expo`; needs network |

The ESLint rules run in `typescript/eslint` or `javascript/eslint`. `javascript/required-rules`
holds the two environment rules for `jsx` and `tsx` files.

Settings:

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <rule>`.

Rule files:

`framework/react-native/REACT-NATIVE.md`.

### Configuration postgres

Kind: database. Requires: sql.

Detects and claims:

|                         |                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | Postgres syntax in any `.sql` file; a Postgres connection string in configuration; supabase                                                                     |
| Claims                  | `.sql` files under a migrations directory (`[tools.postgres] migrations_directory`, default detected from `supabase/migrations`, `migrations`, `db/migrations`) |
| Architecture it assumes | none. Postgres, not any product on it.                                                                                                                          |

Tools:

squawk, sqlfluff with dialect `postgres`, `libpg-query` inside gspot.

Generated configuration:

| Target                       | Holds                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/squawk.toml`  | `assume_in_transaction` from `[tools.squawk]`, `excluded_rules` rendered from the `[[ignore]]` entries for `postgres/squawk`, `--exclude-path` for migrations at or before `frozen_through` |
| `.gspot/config/sqlfluff.cfg` | `dialect = postgres`                                                                                                                                                                        |

Checks:

| Id                                      | Stage  | Command                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres/squawk`                       | commit | `squawk --config .gspot/config/squawk.toml {migrations after frozen_through}`                                                                                                                                                                                    |
| `postgres/migrations-frozen`            | commit | a migration at or before `frozen_through` differs from its committed bytes at that version: fail                                                                                                                                                                 |
| `postgres/migration-order`              | commit | timestamps ascend; no two migrations share a timestamp                                                                                                                                                                                                           |
| `postgres/migration-docs`               | commit | boxed header with `-- Migration: <file>` and `-- Purpose:`; section headings boxed; `CREATE SCHEMA`, `TABLE`, `INDEX`, `FUNCTION`, `TRIGGER`, `EXTENSION` under their section; entity labels with purpose and separators; `-- Row Level Security` capitalization |
| `postgres/rls-present`                  | commit | every `CREATE TABLE` in a schema exposed to clients has `ENABLE ROW LEVEL SECURITY` and at least one policy in the same or a later migration                                                                                                                     |
| `postgres/explicit-grants`              | commit | no `GRANT ALL`; grants name columns or a role the repository declares                                                                                                                                                                                            |
| `postgres/security-definer-search-path` | commit | every `SECURITY DEFINER` function sets `search_path`                                                                                                                                                                                                             |
| `postgres/index-covers-foreign-key`     | commit | every foreign key column has an index                                                                                                                                                                                                                            |
| `naming/identifiers`                    | commit | the SQL categories                                                                                                                                                                                                                                               |

Settings:

`tools.squawk.assume_in_transaction` (default `true` under supabase), `tools.squawk.frozen_through` (`none`, `all`, or a version), `tools.postgres.migrations_directory`,
`tools.postgres.client_schemas` (default empty; Supabase sets `public`), `tools.postgres.migration_docs` (default
`false`; the documented layout is a house style a repository opts into), and
`tools.postgres.doc_sections` (the section name list).

Rule files:

`database/postgres/POSTGRES.md`.

### Configuration python

Kind: language. Requires: formatting. Recommends: structure, naming, spelling, dependencies.

Detects and claims:

|                         |                                                                              |
| ----------------------- | ---------------------------------------------------------------------------- |
| Detect                  | `.py` in the tree; `pyproject.toml`; `requirements*.txt`; a `python` shebang |
| Claims                  | `.py`, `.pyi`, `pyproject.toml`, extensionless files with a `python` shebang |
| Required check coverage | format, syntax, style, types, structure, naming, prose, spelling             |

Tools:

ruff, basedpyright, import-linter, pydoclint, deptry, vulture, validate-pyproject,
uv. Install managed Python tools into `.gspot/.venv` from the recorded uv lock. gspot writes nothing into `pyproject.toml`. bandit, pip-audit and interrogate are not used: Ruff `S`, osv-scanner and Ruff
`D1` do their jobs.

Generated configuration:

| Target                                  | Stub                              | Holds                                                                                                                                                                                                                                           |
| --------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/ruff.toml`               | none; the check passes `--config` | the selected families including `S` and `ANN401`, `PLR2004`, `PLR1702`, `PLR0917`, `FAST`; the ignores; the limits (`C901` at `cyclomatic_complexity`, `PLR0915` at `statements`, `PLR1702` at `nested_blocks`); format options from `[format]` |
| `.gspot/config/basedpyrightconfig.json` | `pyrightconfig.json`              | `typeCheckingMode: all`, `reportPrivateUsage`, `extraPaths`, includes from claims                                                                                                                                                               |

import-linter, deptry, and vulture each read a generated file under `.gspot/`, which the check passes
by flag. A table of `pyproject.toml` is read and carried at `init`, and left in place.

Checks:

| Id                                                                                                                                                             | Stage  | Command                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `python/ruff`                                                                                                                                                  | commit | `ruff check --config .gspot/config/ruff.toml {files}`; fix order codemod                                                              |
| `python/ruff-format`                                                                                                                                           | commit | `ruff format --check`; fix order format                                                                                               |
| `python/basedpyright`                                                                                                                                          | commit | `basedpyright --outputjson`, run in the scope, which holds the `pyrightconfig.json` stub                                              |
| `python/import-linter`                                                                                                                                         | commit | `lint-imports`                                                                                                                        |
| `python/pydoclint`                                                                                                                                             | commit | `pydoclint --allow-init-docstring true {files}` until Ruff `DOC` leaves preview                                                       |
| `python/deptry`                                                                                                                                                | push   | `deptry <source roots>`                                                                                                               |
| `python/vulture`                                                                                                                                               | push   | `vulture <roots> --min-confidence 80`                                                                                                 |
| `python/pyproject`                                                                                                                                             | commit | `validate-pyproject pyproject.toml`                                                                                                   |
| `python/file-length`, `python/function-length`                                                                                                                 | commit | code lines against `limits.file_lines` and `limits.function_lines`                                                                    |
| `python/trivial-function`                                                                                                                                      | commit | every implemented function with at most limits.trivial_statements executable statements; only explicit narrow suppressions apply      |
| `python/private-prefix`                                                                                                                                        | commit | `_` for every top-level name `__all__` does not list; no `_` name in `__all__`; `_` for methods called from no other module           |
| `python/private-before-public`                                                                                                                                 | commit | `_` names above public names; `__all__` last                                                                                          |
| `python/exports-at-bottom`, `python/no-singletons`, `python/no-lazy-exports`, `python/package-exports`, `python/import-cycles`, `python/placeholder-docstring` | commit | engine, on the embedded Python grammar; `import-layout` is Ruff `E402` and `PLC0415`, and `import-boundary` is `python/import-linter` |
| `typescript/typecheck-membership`, `dependency-ownership`, `lockfile-fresh` (`uv lock --check`)                                                                | commit | engine                                                                                                                                |
| `dependencies/osv` over `uv.lock`                                                                                                                              | push   | through dependencies                                                                                                                  |

basedpyright takes the folder of its configuration as the project root. The generated
configuration sits under `.gspot/`, so the scope holds a root pointer, `pyrightconfig.json`, with
one key: `extends`. It is generated and read-only, unlike the
`tsconfig.json` stub, because a repository has nothing of its own to keep in it. Takeover replaces
an old `pyrightconfig.json` and carries its `exclude` paths into `tools.basedpyright.exclude`, without
dot folders and the folders the configuration leaves out by itself.

Settings:

| Setting                                                                                                                       | Direction  | Default                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.ruff.select`, `tools.ruff.options` (per-rule options; a rule turned off is a `gspot ignore python/ruff --rule <code>`) | per-rule   | the ledger set                                                                                                                                                                                                                                                                    |
| per-file rule exemptions                                                                                                      | loosening  | none; written as `[[ignore]]` entries with `rule` and `paths`, rendered into `per-file-ignores`                                                                                                                                                                                   |
| `tools.basedpyright.exclude` (carries a reason)                                                                               | loosening  | none. A repository that must type-check some files under another dependency set excludes them here and adds a `[[check]]` (`command = ["uv", "run", "--extra", "trt", "basedpyright", "-p", "typecheck/trt.json"]`, `platform = "linux"`); gspot has no slot for that, on purpose |
| deptry rules turned off                                                                                                       | loosening  | none; `gspot ignore python/deptry --rule DEP002 --reason`                                                                                                                                                                                                                         |
| `tools.vulture.ignore_names`                                                                                                  | loosening  | none                                                                                                                                                                                                                                                                              |
| `architecture.contracts`                                                                                                      | tightening | none                                                                                                                                                                                                                                                                              |
| `architecture.roles.env`                                                                                                      | neutral    | the module that reads `os.environ`; detected as the one that reads it most at init                                                                                                                                                                                                |
| `structure.python.max_package_exports`                                                                                        | ceiling    | 20                                                                                                                                                                                                                                                                                |

Rule files:

`language/PYTHON.md`, `language/python/TYPING.md`, `language/python/DESIGN.md`, `language/python/FLOW.md`,
`language/python/PACKAGING.md`, `language/naming/PYTHON.md`.

Not covered here:

Notebook linting. Ruff runs over `.ipynb` when the repository has them, through a `[tools.ruff]`
slot; no other check reads notebooks.

### Configuration structure

Kind: policy. Requires: nothing. Required by every language configuration, because it owns the `limits.*`
settings their configurations read. It runs the structural rules no standard linter ships.

Claims:

Every file a language configuration claims. The engine dispatches by grammar.

Checks:

Share proven common operations while preserving language semantics. No universal
analysis table or framework is required. The
manifest of each language lists the idea under an id of its own, so an ignore holds
one language. `structure/trivial-function` reads shell, and the same idea is
`python/trivial-function`, `swift/trivial-function`, and `sql/functions`. TypeScript and JavaScript
keep their ESLint rules, such as `gspot/no-trivial-functions`, so an editor shows them.

| Idea                                    | Level       | Bash | Python | Swift | TypeScript | SQL |
| --------------------------------------- | ----------- | ---- | ------ | ----- | ---------- | --- |
| File and function length                | all         | yes  | yes    | yes   | yes        | yes |
| Call-through                            | all         | yes  | yes    | yes   | yes        | yes |
| Duplicate functions                     | all         | yes  | yes    | yes   | yes        | no  |
| Unused functions, dead parameters       | recommended | yes  | yes    | yes   | yes        | no  |
| Import cycles                           | recommended | no   | yes    | no    | yes        | no  |
| Environment owner                       | all         | yes  | yes    | yes   | yes        | no  |
| Import layout and boundaries            | all         | no   | yes    | no    | yes        | no  |
| Export-only files, alias constants      | all         | no   | yes    | no    | yes        | no  |
| Private before public, doc comment form | all         | yes  | yes    | yes   | yes        | no  |

Facts about folders hold for every language, and the structure engine alone reports them:
`structure/single-file-folder` (level `all`), `structure/prefix-collisions`,
`structure/file-directory-collision`, and `structure/folder-names`.

The configuration also ships the checks over the config and the files gspot writes:
`integrity/policy`, `integrity/generated-drift`, `integrity/config-purity`, `integrity/suppressions`, `integrity/allowlists-match`,
`integrity/task-policy`, and `integrity/large-files`.

Settings:

Every `[limits]` key in the ledger, at the root or under a language table (`limits.python.file_lines`); `structure.reexports` (`none`, `index-only`);
`structure.single_file_folder_allowed`
(paths, reason); `structure.prefix_collision_allowed` (paths, reason); `structure.call_through_allowed`
(file, name, reason); `structure.folder_name_allowed` (paths, reason); `architecture.types_directory`;
`architecture.roles`. Allowance validation follows `require_reasons`; verbose output includes supplied reasons.

Rule files:

- `general/agent/WORKING.md` carries the intent each rule enforces.
- `general/code/NAMING.md` "Files and Directories" states the folder, stem, and collision rules.
- `general/code/CONFIGURATION.md` states the environment owner rule.
- Each language file states its private-first, private-prefix, types, and re-export rules.

### Configuration svelte

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

Detects and claims:

|        |                                           |
| ------ | ----------------------------------------- |
| Detect | `svelte` in dependencies, `.svelte` files |
| Claims | `.svelte`                                 |

Tools:

As libraries: eslint-plugin-svelte 3.23.0, svelte-eslint-parser 1.8.1, prettier-plugin-svelte
4.1.1, and eslint-plugin-testing-library 7.16.2.

As a command: svelte-check 4.7.6.

Generated configuration:

Every shared rule of the javascript and typescript configurations reads the files of this framework
too, with the same limits. A rule this configuration turns off stands in its manifest with a
reason, and the page lists each one.

The configuration claims `.svelte`, `.svelte.js` and `.svelte.ts`, so the list of code files of the
ESLint config holds them. The config gains the `recommended` blocks of the Svelte plugin, with
every rule that is on set to error. One more block sets the parser, and hands it the TypeScript
parser for the script where typescript is selected. It adds: `svelte/no-at-html-tags`,
`svelte/require-each-key`, `svelte/no-target-blank`, `svelte/button-has-type`,
`svelte/no-reactive-reassign`, and `svelte/block-lang`. At the `all` level:
`svelte/no-useless-mustaches` and `svelte/prefer-const`.

Over test files, the `svelte` set of the testing-library plugin. Prettier formats `.svelte`
through `prettier-plugin-svelte`. Where css is selected, stylelint reads the `<style>` block
through `postcss-html`. The naming engine reads the script block. The plugin needs the
`svelte` package itself, which the repository owns.

Names:

`[[naming.rules]]` of this configuration: a component file is in PascalCase, and the route files of
SvelteKit keep their names (`+page.svelte`, `+layout.ts`, `+server.ts`, `+error.svelte`).

Turned off:

| Rule                           | Why                                                           |
| ------------------------------ | ------------------------------------------------------------- |
| `structure/single-file-folder` | SvelteKit finds a route file by its name, one for each folder |

Checks:

| Id             | Stage  | Command                                                                                                                                 |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte/check` | commit | `svelte-check --fail-on-warnings`; takes over `typescript/tsc` in the scope, and reports the accessibility warnings of the compiler too |

The ESLint rules run in the one ESLint check. `javascript/required-rules` holds
`svelte/no-at-html-tags`, `svelte/require-each-key`, and `svelte/no-target-blank`.

Settings:

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <rule>`.

Rule files:

`framework/svelte/SVELTE.md`.

### Configuration zustand

Kind: library. Requires: javascript.

Detects:

`zustand` in dependencies.

Generated configuration:

The ESLint config gains `no-restricted-syntax` selectors: a store is created once per module and
exported as a hook; no store creation inside a component; selectors passed to the hook.

Checks:

`typescript/eslint` with the selectors; `gspot/registry-instance-only` treats store files as
registries when `[tools.zustand] store_files` names them.

Settings:

`tools.zustand.store_files` (default `**/store.ts`, `**/stores/*.ts`).

Rule files:

`library/zustand/ZUSTAND.md`.

### Configuration css

Kind: language. Requires: formatting. Recommends: spelling.

Detects and claims:

|                         |                                                     |
| ----------------------- | --------------------------------------------------- |
| Detect                  | `.css`, `.scss`, `.pcss`, `.module.css` in the tree |
| Claims                  | the same                                            |
| Required check coverage | format, syntax, style, spelling                     |

Tools:

stylelint, stylelint-config-standard, prettier, purgecss (through static-site), postcss and
postcss-modules (inside gspot, for CSS module usage).

Generated configuration:

| Target                         | Stub                               | Holds                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gspot/config/stylelint.json` | `.stylelintrc.json` with `extends` | `stylelint-config-standard`, `no-descending-specificity`, `at-rule-no-unknown`, `function-no-unknown`, `import-notation: string`, `at-rule-prelude-no-invalid`, `property-no-vendor-prefix` with the two ignored properties; the reference repositories' disabled rules stay disabled with their reasons in the template |

Checks:

`formatting/prettier` formats CSS files, so this configuration has no format check of its own.

| Id                   | Stage  | Command                                                                        |
| -------------------- | ------ | ------------------------------------------------------------------------------ |
| `css/stylelint`      | commit | `stylelint --config .gspot/config/stylelint.json {files}`; fix, order codemod  |
| `css/usage`          | push   | CSS modules: every class defined is used, every class used is defined (nextjs) |
| `css/dead-selectors` | push   | PurgeCSS over the built output with a safelist (static-site)                   |

Settings:

`tools.stylelint.rules` (per-rule options; off is a `gspot ignore --rule`), `tools.purgecss.safelist` (reason), `tools.purgecss.content`.

Rule files:

`language/CSS.md`, `language/naming/CSS.md`; `tool/tailwind/TAILWIND.md` when Tailwind is a dependency.

### Configuration prose

Kind: policy. Requires: markdown. Runs Vale over every comment and every documentation file.

Claims:

Comments in `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.swift` (Vale native); `.sh`, `.bash`, hook
and task files (stdin as `.rb`); `.sql`, `.pgsql`, `.psql` (stdin as `.lua`); `.py` (stdin as
`.rb`, heredoc lines excluded by gspot); every `.md`.

Tools:

vale, with the pinned packages: Google, Microsoft, write-good, proselint, alex, RedHat, Harper.

Generated configuration:

| Target                                                           | Holds                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/vale.ini`                                         | `StylesPath`, `MinAlertLevel = suggestion`, the packages, `BasedOnStyles`, `SkippedScopes` with tables added, `BlockIgnores` for front matter, `TokenIgnores` for URLs, tool directives (`eslint-disable`, `@ts-expect-error`, `swiftlint:`, `shellcheck`, `nosemgrep`, `MARK: -`, JSDoc tags), spelling rules off (typos owns spelling), the disabled-rule list with its reasons in comments                                   |
| `.gspot/config/vale/styles/gspot/*.yml`                          | the 30 rules: `dashes`, `present-state`, `modals`, `hedging`, `marketing`, `idioms`, `since`, `self-reference`, `file-paths`, `locations`, `defaults`, `future`, `version-range`, `interface-verbs`, `us-english`, `possessives`, `headings`, `title`, `heading-names`, `sentence-length`, `step-length`, `paragraph-length`, `acronyms`, `link-text`, `alt-text`, `placeholders`, `dates`, `currency`, `symbols`, `corruption` |
| `.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt` | the tool and product names from `[prose] vocabulary`                                                                                                                                                                                                                                                                                                                                                                            |

Style packages are fetched by `vale apply` at setup into an ignored directory. Only the gspot
style and vocabulary are tracked.

Checks:

| Id                  | Stage  | Command                                                                                                                                                                                                                                                   |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prose/vale`        | commit | `vale --config .gspot/config/vale.ini --output=line --no-exit {files}` per grammar; any alert fails                                                                                                                                                       |
| `prose/source-bans` | commit | no `<!-- vale` directive in Markdown; no `/* */` in SQL                                                                                                                                                                                                   |
| `prose/messages`    | commit | the three ESLint selectors: error messages start uppercase, client messages (a `message` or `error` field in an object passed to `.json()` or `.send()`) carry no interpolated identifiers, log calls use a stable message; Ruff `EM101`, `EM102`, `G004` |
| `prose/doc-tags`    | commit | `jsdoc/no-types` in TypeScript; SwiftLint custom rule `///` over `/** */`                                                                                                                                                                                 |

Settings:

`prose.vocabulary` (accept list) and `limits.docs.*`. A Vale rule is turned off through `gspot ignore prose/vale --rule <rule>`, as every rule is.

Rule files:

`general/prose/WRITING.md`, `general/code/COMMENTS.md`, `general/prose/DOCS.md` and its five siblings.

Rollout:

The prose checks read the files a change touches, so a repository with a backlog of old text is
not blocked by it.
disabled upstream rules and the reason for each is in the template.

### Configuration xctest

Kind: tool. Requires: swift. macOS only. Every check here passes as a platform skip elsewhere.
Covers XCTest, Swift Testing and snapshot tests.

Detects and claims:

|        |                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| Detect | a `.swift` file with `import XCTest` or `import Testing`; a `*.xctestplan`; a test target in `Package.swift` |
| Claims | `.swift` files under a folder named `Tests` or ending in `Tests`, `__Snapshots__/**`, and `*.xctestplan`     |

Tools:

swiftlint (from swift), xcodebuild (host). No tool of its own.

Generated configuration:

`.gspot/config/swiftlint.yml` gains, over the claimed files, the five test rules of the swift configuration
(`balanced_xctest_lifecycle`, `empty_xctest_method`, `final_test_case`, `test_case_accessibility`,
`xct_specific_matcher`) and turns `force_unwrapping`, `missing_docs` and `no_magic_numbers` off
there. The configuration writes a nested SwiftLint file into each test folder it claims, with `parent_config`
set to the file under `.gspot/` (K-256).

Checks:

| Id                        | Stage       | Command                                                                                                                                                                                                       |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xctest/disabled`         | commit      | engine: `XCTSkip`, `.disabled(`, `@available(*, unavailable)` on a test, and a `skippedTests` entry in a test plan each carry a reason on the same line or the line above; report findings without a baseline |
| `xctest/no-sleep`         | commit      | engine: no `sleep(`, `usleep(`, `Thread.sleep` or `Task.sleep` in a claimed file outside `[tools.xctest] sleep_allowed`                                                                                       |
| `xctest/recording`        | commit      | engine: no `isRecording = true`, `record: true`, `record: .all` or `withSnapshotTesting(record:` set to a recording mode in a tracked file                                                                    |
| `xctest/reference-images` | commit      | engine: every file under `__Snapshots__/<TestClass>/` names a test class that exists; every reference image is tracked, under LFS when it passes `limits.file_size_kb`                                        |
| `xctest/coverage`         | push, build | `xcodebuild test -enableCodeCoverage YES`, then `xcrun xccov view --report --json`; line coverage at or above `[tools.xctest] coverage` for each target it names                                              |
| `xcode/test-plan`         | commit      | from the xcode configuration                                                                                                                                                                                  |

Settings:

`tools.xctest.coverage` (target, percent; no target named means the check does not run),
`tools.xctest.sleep_allowed` (paths, reason), `tools.xctest.reference_directories` (default
`__Snapshots__`).

Rule files:

`tool/xctest/XCTEST.md`, `general/code/TESTING.md`.

### Configuration secrets

Kind: policy. Requires: nothing. Selected by default in every repository.

Claims:

The whole tree, including binaries, and vendored files.

Tools:

gitleaks, trufflehog.

Generated configuration:

| Target                                                         | Holds                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/gitleaks.toml`                                  | `[extend] useDefault = true`; allowlists from `[tools.gitleaks] allow` (paths, regexes, reason); baseline path |
| `.gitleaks-baseline.json`, at the root, owned by the developer | reviewed historical findings, each with a reason in `[tools.gitleaks] baseline_reasons`                        |

Checks:

| Id                          | Stage  | Command                                                                                                                                                             |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secrets/gitleaks-staged`   | commit | `gitleaks git --staged --config .gspot/config/gitleaks.toml --redact`                                                                                               |
| `secrets/gitleaks`          | push   | `gitleaks git --config .gspot/config/gitleaks.toml --baseline-path .gitleaks-baseline.json --redact` over the pushed range                                          |
| `secrets/trufflehog`        | push   | `trufflehog git file://. --since-commit <base> --results=verified --fail`                                                                                           |
| `secrets/env-files`         | commit | no environment file staged except templates. The shipped pattern list is `.env*` and Wrangler's `.dev.vars*`; a configuration adds a pattern as data, never as code |
| `secrets/gitleaks-baseline` | commit | every baseline fingerprint has a reason and names a path that existed                                                                                               |
| `configs/dotenv`            | commit | tracked `.env*` files hold keys only                                                                                                                                |

Settings:

`tools.gitleaks.allow` (description, paths, regexes, reason), `tools.gitleaks.baseline_reasons`
(fingerprint, reason), `tools.trufflehog.verified_only` (default true).

Rule files:

`general/code/SECRETS.md`, `general/code/SECURITY.md`.

### Configuration pytest

Kind: tool. Requires: python.

Detects and claims:

|        |                                                                |
| ------ | -------------------------------------------------------------- |
| Detect | `pytest` in dependencies or dependency groups; `[tool.pytest]` |
| Claims | `tests/**/*.py`, `test_*.py`, `*_test.py`, `conftest.py`       |

Tools:

pytest, pytest-cov.

Generated configuration:

`.gspot/config/ruff.toml` keeps the `PT` family on and adds test-file overrides: `S101` (assert) off in
gspot writes nothing into `pyproject.toml`. The coverage check passes its options by flag.
with `testpaths` from claims and `addopts = "-q --strict-markers --strict-config"`.

Checks:

| Id                           | Stage  | Command                                                                                          |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `python/ruff`                | commit | with `PT001` to `PT027` on                                                                       |
| `pytest/coverage`            | push   | `pytest --cov --cov-fail-under=<threshold>`                                                      |
| `structure/trivial-function` | commit | setup callbacks are reported by default; required external APIs use narrow reasoned suppressions |
| `naming/identifiers`         | commit | `test_` is a structural prefix for test functions; test-data directories need descriptive names  |

Settings:

`tools.pytest.coverage` (default 80), `tools.pytest.testpaths`.

Rule files:

`general/code/TESTING.md`; the Tests section of `language/PYTHON.md`.

### Configuration static-site

Kind: policy. Requires: html, css, javascript. For a site built to a directory and served
as files: the checks that only make sense over built output.

Detects and claims:

|        |                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect | `.html` files with no framework dependency and a build script in `package.json`                                                                         |
| Claims | the build output directory (`[tools.site] output`, default `dist`) as generated; `assets/**` as binary; `sitemap.xml`, `robots.txt`, `site.webmanifest` |

Tools:

html-validate, purgecss, linkinator, svgo. linkinator serves the output folder itself. Cycle
and complexity checks come from the javascript configuration (import-x, sonarjs); madge and Lizard are
not used.

Checks:

| Id                                | Stage           | Command                                                                                                                                                                                                                                                                               |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static-site/build`               | push, build     | the build script from `[tools.site] build`                                                                                                                                                                                                                                            |
| `static-site/build-reproducible`  | push, build     | build twice into two directories; the trees are identical                                                                                                                                                                                                                             |
| `static-site/html-validate-built` | push, build     | html-validate over `<output>/**/*.html` with the built config                                                                                                                                                                                                                         |
| `css/dead-selectors`              | push, build     | PurgeCSS over the built output and the template sources with `[tools.purgecss] safelist`                                                                                                                                                                                              |
| `static-site/links-internal`      | push, build     | serve the output, `linkinator --recurse --check-css --check-fragments` over the seed routes; mailto, tel, and sms skipped                                                                                                                                                             |
| `static-site/links-external`      | manual, network | the same with external links, `[tools.linkinator] status_overrides` and `skip`                                                                                                                                                                                                        |
| `static-site/dead-assets`         | push            | every file under `assets/**` is referenced from a template, a stylesheet, or a script                                                                                                                                                                                                 |
| `static-site/svg`                 | commit          | svgo over each file to standard output; a smaller result is a finding, because svgo has no check mode                                                                                                                                                                                 |
| `static-site/size`                | push, build     | the compressed weight of the output paths each entry of `[tools.site] size_limits` names; built in, so no size-limit package and no second configuration                                                                                                                              |
| `static-site/sitemap`             | push, build     | every route in the sitemap is in the output; every HTML page is in the sitemap unless excluded                                                                                                                                                                                        |
| `static-site/webmanifest`         | commit          | validates against the schema                                                                                                                                                                                                                                                          |
| `integrity/security-headers`      | commit          | `_headers` sets `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`; HTML paths carry a revalidating `Cache-Control`; hashed assets are immutable. Here because a site of files has no other place to set headers; a framework app sets them in its configuration |

Settings:

`tools.site.required_headers` (name, value pattern), `tools.site.html_paths`, `tools.site.output`, `tools.site.build`, `tools.site.serve`, `tools.site.seed_routes`,
`tools.site.size_limits`, `tools.purgecss.safelist` (reason), `tools.linkinator.skip` (pattern,
reason), `tools.linkinator.status_overrides`.

Rule files:

`repository/static-site/STATIC-SITE.md`, `runtime/browser/BROWSER.md`.

### Configuration nginx

Kind: tool. Requires: nothing.

Detects and claims:

|                         |                                                        |
| ----------------------- | ------------------------------------------------------ |
| Detect                  | `nginx.conf`, `*.conf` under a directory named `nginx` |
| Claims                  | the same                                               |
| Required check coverage | syntax, security                                       |

Tools:

gixy, docker (host) for `nginx -t`.

Checks:

| Id                  | Stage        | Command                                                                                   |
| ------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `nginx/gixy`        | commit       | `gixy --format json <file>` (the `gixy-ng` package; the original reads no current Python) |
| `nginx/config-test` | push, docker | `docker run --rm` of `tools.nginx.image` with the file mounted, then `nginx -t`           |

The check reads each `nginx.conf`. Every `ssl_certificate` and `ssl_certificate_key` path gets a
throwaway self-signed pair mounted at that path. The pair lives in a temporary directory that the check removes. Every upstream and `proxy_pass` host name resolves to `127.0.0.1` through `--add-host`.
Nothing comes from a Compose file, so a repository with no Compose file runs the same test.

Settings:

`tools.nginx.image` (default `nginx:stable-alpine`); a gixy check turned off is `gspot ignore nginx/gixy --rule <check> --reason`.

Rule files:

`tool/nginx/NGINX.md`.

### Configuration vue

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

Detects and claims:

|        |                                     |
| ------ | ----------------------------------- |
| Detect | `vue` in dependencies, `.vue` files |
| Claims | `.vue`                              |

Tools:

As libraries: eslint-plugin-vue 10.11.0, vue-eslint-parser 10.4.1,
eslint-plugin-vuejs-accessibility 2.6.0, and eslint-plugin-testing-library 7.16.2.

As a command: vue-tsc 3.3.11.

Generated configuration:

Every shared rule of the javascript and typescript configurations reads the files of this framework
too, with the same limits. A rule this configuration turns off stands in its manifest with a
reason, and the page lists each one.

The configuration claims `.vue`, so the list of code files of the ESLint config holds it. The config
gains the `flat/recommended` blocks of the Vue plugin and of the accessibility plugin, with every
rule that is on set to error. One more block over `.vue` files sets the parser, and hands it the
TypeScript parser for the script where typescript is selected. It adds: `vue/no-v-html`,
`vue/block-lang`, `vue/define-props-declaration`, `vue/define-emits-declaration`,
`vue/no-unused-refs`, `vue/require-typed-ref`, `vue/html-button-has-type`, and
`vue/no-template-target-blank`. At the `all` level: `vue/component-api-style` (script setup),
`vue/no-useless-v-bind`, and `vue/prefer-true-attribute-shorthand`.

Over test files, the `vue` set of the testing-library plugin. Prettier formats `.vue` by itself.
Where css is selected, stylelint reads the `<style>` block through `postcss-html`. The naming
engine reads the script block.

Names:

`[[naming.rules]]` of this configuration: a component file is in PascalCase, and a composable starts
with `use`.

Turned off:

Nothing.

Checks:

| Id              | Stage  | Command                                                                     |
| --------------- | ------ | --------------------------------------------------------------------------- |
| `vue/typecheck` | commit | `vue-tsc --noEmit`; takes over `typescript/tsc` in the scope (`takes_over`) |

The ESLint rules run in the one ESLint check. `javascript/required-rules` holds
`vue/no-v-html`, `vue/require-v-for-key`, `vue/no-mutating-props`, and
`vue/no-use-v-if-with-v-for` for `.vue` files.

Settings:

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <rule>`.

Rule files:

`framework/vue/VUE.md`.

### Configuration nextjs

Kind: framework. Requires: typescript, react. Recommends: css, configs.

Detects and claims:

|                         |                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detect                  | `next` in dependencies; `next.config.{js,mjs,ts}`                                                                                                                        |
| Claims                  | `app/**`, `pages/**`, `src/app/**`, `src/pages/**`, `middleware.{js,ts}`, `proxy.{js,ts}`, `next.config.*`, `next-env.d.ts` (generated), `public/**` (binary and static) |
| Architecture it assumes | the App Router layout, because `create-next-app` produces it; nothing else                                                                                               |

Tools:

eslint-config-next, @eslint/compat, eslint-plugin-react-hooks (through next), eslint-plugin-i18next,
@formatjs/icu-messageformat-parser (inside gspot), postcss-modules (inside gspot).

Generated configuration:

The typescript flat config gains, in order:

- the `core-web-vitals` set of `@next/eslint-plugin-next`, on ESLint 9;
- the `[architecture]` boundaries (route, feature, shared);
- `gspot/require-server-only` over server files and `gspot/no-client-environment` over every file;
- the React rules come from the `react` configuration, which this one requires; `@next/next/no-async-client-component`;
- the rules under "Turned off" below, rendered from the manifest.

Server files: `**/server/**`, `**/*.server.*`, `features/*/server/**`, `lib/**/server.*`, and any
file with `'use server'`. Client files: any file with `'use client'`.

Turned off:

| Rule                                                                         | Files                                                                                                                              | Why                                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `structure/single-file-folder`, `gspot/no-export-only-files`, `no-reexports` | `page`, `layout`, `template`, `default`, `loading`, `error`, `not-found`, `global-error`, `route`, `middleware`, and `proxy` files | the framework finds these files by name, so a folder holds one and the file holds one export |

Every shared rule and every limit holds in a Next.js app as it does anywhere else.

Checks:

| Id                               | Stage       | Command                                                                                                                                 |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript/eslint`              | commit      | with the additions above                                                                                                                |
| `nextjs/typecheck`               | commit      | `next typegen` under `CI=1`, then `tsc --noEmit`; takes over `typescript/tsc` in its scope                                              |
| `nextjs/build`                   | push, build | `next build` when `[tools.next] build_in_gate = true`                                                                                   |
| `integrity/route-segments`       | commit      | no segment holds both `page` and `route`                                                                                                |
| `integrity/next-config`          | commit      | `next.config.*` parsed as syntax: no secret in `env`, no `eslint.ignoreDuringBuilds`, no `typescript.ignoreBuildErrors`                 |
| `css/usage`                      | push        | every CSS module class used and defined                                                                                                 |
| `i18n/locales`                   | push        | ICU parse, no empty message, keys without dots, every locale complete against the base, every message key used through the type checker |
| `javascript/required-rules`      | push        | the required rule list still resolves per file class                                                                                    |
| `integrity/dependency-alignment` | commit      | `next` and `eslint-config-next` on one version; `react` and `react-dom` on one version                                                  |
| `dependencies/manifest-policy`   | commit      | pinned `packageManager`, one lockfile, sorted manifests                                                                                 |

Settings:

| Setting                                            | Default                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `tools.i18n.translations` (directory, base locale) | detected from next-intl configuration                               |
| `tools.next.build_in_gate`                         | false                                                               |
| `tools.next.build_flags`                           | `[]`; `["--webpack"]` for an app that does not build with Turbopack |
| `tools.eslint.restricted_imports` (name, message)  | none; the reference picture-component rule is one entry             |

Rule files:

`framework/nextjs/NEXTJS.md`, `framework/nextjs/SECURITY.md`, `runtime/node/NODE.md`,
`runtime/browser/BROWSER.md`; `runtime/workers/WORKERS.md` through cloudflare when `@opennextjs/cloudflare` is
present; `library/next-intl/NEXTINTL.md` when `next-intl` is a dependency.

### Configuration configs

Kind: policy. Requires: formatting. Recommends: spelling. Claims every data and configuration file no
language owns, so `.toml`, `.yaml` and `.json` files stop being spell-checked only.

Detects and claims:

|                         |                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | any repository                                                                                                                                                                                                                                                                                          |
| Claims                  | `.json`, `.jsonc`, `.json5`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.properties`, `.env`, `.env.*` (tracked ones only), `.plist`, `.entitlements`, `.xcconfig`, `.xcstrings`, `.xml`, `.storyboard`, `.xib`, `.webmanifest`, `.nvmrc`, `.node-version`, `.python-version`, `_headers`, `_redirects` |
| Required check coverage | format, syntax, schema where a schema is known, style, spelling                                                                                                                                                                                                                                         |

Tools:

taplo, yamllint, v8r, actionlint, zizmor, dotenv-linter, plutil (host, macOS),
xmllint (host).
Prettier comes from the formatting configuration.

Generated configuration:

| Target                       | Holds                                                                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/taplo.toml`   | schema loading off (v8r owns schemas, at push); indent and column width from `[format]`; arrays never expanded or collapsed, no padding inside brackets or inline tables, the style the `gspot.toml` writer emits; `[tools.taplo] rules` on top |
| `.gspot/config/yamllint.yml` | `extends: default`, line length and document start off, `truthy` not on keys (the `on:` of a workflow), one space allowed inside braces and brackets (the Prettier style), indent from `[format]`                                               |
| `.gspot/config/v8r.yml`      | errors for files with no known schema ignored; a custom catalog with the mise schema and every `[tools.v8r] schemas` entry on top of SchemaStore                                                                                                |

Each has a stub at the conventional path (`.taplo.toml`, `.yamllint.yml`, `.v8rrc.yml`) so editors
and bare tool runs find it.

Checks:

| Id                         | Stage         | Command                                                                                                                                          |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `configs/json`             | commit        | Prettier parses and formats JSON, JSONC and JSON5; the findings come from `formatting/prettier`                                                  |
| `configs/toml`             | commit        | `taplo check --no-schema {files}`: syntax alone, offline                                                                                         |
| `configs/toml-format`      | commit        | `taplo fmt --check {files}`; fix, order format                                                                                                   |
| `configs/yaml`             | commit        | `yamllint -c .gspot/config/yamllint.yml -f parsable -s {files}`                                                                                  |
| `configs/schema`           | push, network | `v8r --ignore-errors {files}` over JSON, YAML and TOML: `package.json`, `tsconfig.json`, workflows, mise and the rest of the SchemaStore catalog |
| `configs/actions`          | commit        | `actionlint {files}` over `.github/workflows/*`                                                                                                  |
| `configs/actions-security` | commit        | `zizmor --offline --format github {files}` over `.github/workflows/*`                                                                            |
| `configs/dotenv`           | commit        | `dotenv-linter check {files}` over tracked environment files (`.env*`, `.dev.vars*`); fix, order format                                          |
| `configs/env-example`      | push          | engine: every key the code reads through `process.env`, `os.environ` or the declared accessor appears in a template                              |
| `configs/plist`            | commit, macOS | `plutil -lint {files}` over `.plist` and `.entitlements`                                                                                         |
| `configs/xml`              | commit        | `xmllint --noout {files}` over `.xml`, `.storyboard` and `.xib`                                                                                  |

`configs/env-example` searches the whole scope for reads and compares them with the
templates in the scope; a scope with no template has nothing to compare and no finding.
`.xcstrings` files are claimed here and checked by the xcode configuration.

Settings:

`tools.yamllint.rules`, `tools.taplo.rules`, `tools.v8r.schemas` (entries with a `pattern` and a
`schema` URL), `tools.dotenv.templates` (default `.env.example`, `.env.template`, `.env.sample`,
`.dev.vars.example`), `tools.dotenv.accessor` (the function name that reads environment
variables, on top of `process.env` and `os.environ`).

Rule files:

`general/code/CONFIGURATION.md`, `language/YAML.md`, `tool/tasks/TASKS.md`;
`tool/github-actions/GITHUB-ACTIONS.md` when `.github/workflows/` holds a workflow.

Ansible playbooks have their own configuration, `ansible`, so a repository with no playbook installs no
ansible-lint. It detects `ansible.cfg` and runs `ansible/lint` in every folder that holds one.

### Configuration dependencies

Kind: policy. Requires: nothing. Dependency health: advisories, unused, duplicated,
skewed, foreign lockfiles, ownership, install policy.

Claims:

Every manifest and lockfile: `package.json`, `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`,
`yarn.lock`, `bunfig.toml`, `.npmrc`, `pnpm-workspace.yaml`, `pyproject.toml`, `uv.lock`,
`requirements*.txt`, `Package.swift`, `Package.resolved`, `Cargo.toml`, `Cargo.lock`, `go.mod`,
`go.sum`, `Gemfile.lock`.

Tools:

osv-scanner, knip, deptry, syncpack, eslint-plugin-package-json.

Generated configuration:

| Target                                 | Holds                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/osv-scanner.toml`       | `[[IgnoredVulns]]` from `[tools.osv] ignore` with id, reason, and a date to re-review                                                                                                                                           |
| `.gspot/config/syncpack.json`          | one exact version per dependency across the workspace; a version group per aligned pair from `[tools.dependencies] aligned` (defaults: `next` with `eslint-config-next`, `react` with `react-dom`, `@types/react` with `react`) |
| the package manager's install settings | `bunfig.toml` `[install] minimumReleaseAge`, `[install.security] scanner`; `.npmrc` `min-release-age`; `pnpm-workspace.yaml` `minimumReleaseAge`; gspot reads them and never writes them, and the check is at the level `all`   |

Checks:

| Id                                 | Stage                                                              | Command                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dependencies/osv`                 | push, network                                                      | `osv-scanner --config .gspot/config/osv-scanner.toml --lockfile <each>`; Python advisories come from `uv.lock` here                                                                                                                                                                                                                        |
| `dependencies/syncpack`            | push                                                               | `syncpack lint --config .gspot/config/syncpack.json`                                                                                                                                                                                                                                                                                       |
| `dependencies/lockfile-hosts`      | commit                                                             | every URL in a text lockfile is HTTPS and on `tools.dependencies.registry_hosts`; built in, because lockfile-lint reads no `bun.lock`                                                                                                                                                                                                      |
| `dependencies/lockfile-fresh`      | commit when a manifest or lockfile is staged; push                 | `bun install --frozen-lockfile --dry-run` (or npm, pnpm, yarn equivalents), `uv lock --check`                                                                                                                                                                                                                                              |
| `dependencies/manifest-policy`     | commit                                                             | exact versions (no `^`, `~`, ranges); keys ordered by `package-json/order-properties`; one `packageManager`, equal across workspace packages; root packages private; no foreign lockfiles; `engines` agree with `.nvmrc`, `.node-version` and the mise pin; scripts policy from `[tools.package-json] scripts` (`any`, `wrappers`, `none`) |
| `dependencies/install-policy`      | commit when a manifest, lockfile or install config is staged; push | minimum release age at or above `[tools.install] min_release_age_days`; the security scanner declared where the manager supports one; the installed tree equals the lockfile version for version; every peer dependency satisfied                                                                                                          |
| `dependencies/ownership`           | commit                                                             | Python: `pyproject.toml` owns every dependency; no `requirements*.txt` unless a `[[generated]]` entry names it, which the check then leaves alone; no `pip install` outside `[tools.dependencies] pip_install_allowed`                                                                                                                     |
| `integrity/large-files`            | commit                                                             | a tracked file over `[limits] file_size_kb` (default 1024) is under LFS or declared                                                                                                                                                                                                                                                        |
| `javascript/knip`, `python/deptry` | push                                                               | unused dependencies and exports                                                                                                                                                                                                                                                                                                            |

The exact-version rule belongs to `package.json` and its workspace packages only. Python dependencies keep their ranges in `pyproject.toml`. A Python package installed into someone else's environment (a plugin, a ComfyUI custom node, a library) must declare ranges. The pins live in `uv.lock`, and `dependencies/lockfile-fresh` is the check that they hold.

Settings:

`tools.osv.ignore` (id, reason, review_by), `tools.dependencies.aligned` (pairs), `tools.dependencies.pip_install_allowed`
(paths), `tools.package-json.scripts`, `tools.package-json.allowed_scripts`, `tools.package-json.indent`,
`tools.install.min_release_age_days` (default 7), `tools.install.security_scanner`,
`tools.dependencies.registry_hosts`, `limits.file_size_kb`.

Rule files:

`general/code/DEPENDENCIES.md`.

### Configuration trpc

Kind: library. Requires: javascript.

Detects:

`@trpc/server` in dependencies.

Generated configuration:

The ESLint config gains `no-restricted-syntax` selectors: every procedure has an `.input()`
schema before `.query`, `.mutation` or `.subscription`; no `any` in a procedure output.

Checks:

| Id                       | Stage  | Command                                                                                         |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| `typescript/eslint`      | commit | with the selectors                                                                              |
| `trpc/router-boundaries` | commit | routers live in the server element of `[architecture]`; the client imports only the router type |

Settings:

`architecture.elements` defines the server element. Without that element,
`tools.trpc.server_files` supplies server file globs (default `**/server/**`).
The check resolves module imports within each scope, permits type-only imports,
and reports value imports, re-exports, `require`, and literal dynamic imports.

Rule files:

`library/trpc/TRPC.md`, `shared/http/HTTP.md`.

### Configuration express

Kind: framework. Requires: javascript. Recommends: security, vitest.

Detects and claims:

|                         |                                                                             |
| ----------------------- | --------------------------------------------------------------------------- |
| Detect                  | `express` in dependencies                                                   |
| Claims                  | nothing by path; adds rules to the scope's JavaScript checks                |
| Architecture it assumes | none. Routers, handlers and middleware live wherever the project puts them. |

Tools:

spectral (for an OpenAPI document when one exists), the Semgrep API rule pack.

Generated configuration:

The scope's ESLint config gains `n/no-process-exit`, `security/*`, and three `no-restricted-syntax` selectors from the prose plan. The selectors say that error messages start uppercase, client messages carry no interpolated identifiers, and log calls take a stable message and a fields object. Boundaries from `[architecture]` when the scope declares elements.

`.gspot/config/spectral.yaml` extends `spectral:oas` when an OpenAPI file is declared.

Checks:

| Id                              | Stage  | Command                                                                                                                                       |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `security/semgrep` express pack | push   | raw query interpolation, `res.send` of raw input, unvalidated redirect, and auth routes with no rate limit; the Node rules ship in `security` |
| `express/openapi-lint`          | commit | `spectral lint --ruleset .gspot/config/spectral.yaml <document>` when `[tools.openapi] document` is set                                       |
| `express/openapi-fresh`         | push   | the generator in `[tools.openapi] command` leaves the document unchanged                                                                      |
| `express/routes-tested`         | push   | every route file has a test file that names it (through `[tools.express] route_files` and `test_files`)                                       |

Settings:

`tools.openapi.document`, `tools.openapi.command`, `tools.express.route_files`,
`tools.express.test_files`, `architecture.*` as nextjs.

Rule files:

`framework/express/EXPRESS.md`, `framework/express/API.md`, `framework/express/OPENAPI.md`,
`shared/http/HTTP.md`, `runtime/node/NODE.md`.

### Configuration sql

Kind: language. Requires: formatting. Recommends: naming, structure, spelling.

Detects and claims:

|                         |                                                           |
| ----------------------- | --------------------------------------------------------- |
| Detect                  | `.sql`, `.pgsql`, `.psql` in the tree                     |
| Claims                  | `.sql`, `.pgsql`, `.psql`                                 |
| Required check coverage | format, syntax, style, structure, naming, prose, spelling |

Tools:

sqlfluff; `libpg-query` (WASM, inside gspot) for parsing and naming extraction.

Generated configuration:

| Target                       | Stub                                                                        | Holds                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/sqlfluff.cfg` | no root file: sqlfluff has no include form, and the check passes `--config` | `sql_file_exts` covering all three extensions, dialect from the database configuration (`ansi` alone), line length and indent from `[format]`, `capitalization` and `references` rules aligned with the naming policy |

sqlfluff never reads a `.sqlfluffignore`; gspot passes the file list.

Shipped sqlfluff settings:

| Key                                    | Value                                  |
| -------------------------------------- | -------------------------------------- |
| `templater`                            | `raw`                                  |
| `max_line_length`                      | `format.print_width`, shipped 120      |
| `large_file_skip_byte_limit`           | 0                                      |
| `indent_unit`, `tab_space_size`        | from `[format]`, shipped `space` and 4 |
| `capitalisation.keywords`, `.literals` | `upper`                                |
| `capitalisation.functions`, `.types`   | `upper` (extended policy)              |
| `capitalisation.identifiers`           | `lower` (extended policy)              |
| `exclude_rules`                        | none shipped                           |

The reference repository excludes `RF02`, `RF04`, `RF05`, `RF06`, `AM04`, `LT02`, `LT05` and
`LT12`. Takeover carries each one as an `[[ignore]]` entry for `sql/sqlfluff` with the comment
above it as the reason, so the exclusions stay visible and reviewable, and no repository inherits
them.

Checks:

| Id                   | Stage  | Command                                                                                                      |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `sql/sqlfluff`       | commit | `sqlfluff lint --config .gspot/config/sqlfluff.cfg --nofail=false {files}`; fix `sqlfluff fix`, order format |
| `sql/syntax`         | commit | `libpg-query` parse when the dialect is `postgres`; a parse error is a finding                               |
| `sql/file-length`    | commit | code lines against `limits.sql.file_lines` (default 400)                                                     |
| `naming/identifiers` | commit | schemas, tables, columns, functions, parameters, indexes, triggers, policies                                 |
| `sql/block-comments` | commit | `/* */` refused so the prose engine reads every comment                                                      |

Settings:

`tools.sqlfluff.dialect` (set by the database configuration), `tools.sqlfluff.rules` (per-rule options; a rule turned off
is `gspot ignore sql/sqlfluff --rule <code>`, rendered into `exclude_rules`).

Rule files:

`language/SQL.md`, `language/naming/SQL.md`.

Not covered here:

Migration safety, documentation layout, and immutability belong to postgres. Row-level security
and grants belong to supabase.

### Configuration licenses

Kind: policy. Requires: nothing. Offered when a manifest exists; selected only on acceptance.

Claims:

The installed dependency tree per ecosystem.

Tools:

license-checker-rseidelsohn (npm), pip-licenses (Python).

Generated configuration:

`.gspot/config/licenses.json`: the allowlist and exact-version exceptions.

Shipped allowlist: `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `0BSD`, `CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `Unlicense`, `BlueOak-1.0.0`, `Python-2.0`.

Checks:

| Id                           | Stage  | Command                                                                                                                                                                                   |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `licenses/packages`          | push   | validated ecosystem license scanners over each scope; compare reported licenses with the allowlist and exact-version exceptions; absent dependencies or zero packages scanned cannot pass |
| `integrity/allowlists-match` | commit | every exception names `name@exact.version` that the lockfile holds                                                                                                                        |

An exception passes only when the package reports the license the exception names. A package whose
reported license differs from its exception fails with both licenses in the message, so a license
change at the same version is never accepted silently.

Settings:

`tools.licenses.licenses_allowed` holds license ids, and an added id needs no reason.
`tools.licenses.packages_allowed` holds packages, each with `package`, `license`, and `reason`.
`gspot set` writes both.

```toml
[tools.licenses]
licenses_allowed = ["MPL-2.0"]

[[tools.licenses.packages_allowed]]
package = "colorama@0.4.6"
license = "BSD"
reason  = "Installed metadata reports the permissive BSD license in its short form."
```

Rule files:

None.

### Configuration javascript

Kind: language. Requires: structure. Recommends: naming, formatting, spelling.

Detects and claims:

|                         |                                                                          |
| ----------------------- | ------------------------------------------------------------------------ |
| Detect                  | `.js`, `.jsx`, `.mjs`, `.cjs` in the tree; a `node` shebang              |
| Claims                  | `.js`, `.jsx`, `.mjs`, `.cjs`, extensionless files with a `node` shebang |
| Required check coverage | format, syntax, style, types, structure, naming, prose, spelling         |

Tools:

eslint and the plugin set from typescript minus typescript-eslint; typescript for `--checkJs`;
knip.

Generated configuration:

| Target                            | Stub                                                                           | Holds                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/eslint.config.mjs` | `eslint.config.mjs` re-export, only where the developer keeps no ESLint config | shared with typescript when both are selected; globals per runtime (node, browser, worker, commonjs) chosen by file class; `sourceType` per extension; the same structural, direction and placement rules; `no-unused-vars` with `args: all` for scripts |
| `.gspot/config/jsconfig.json`     | `jsconfig.json`                                                                | `checkJs`, `strict`, `noEmit`; type checking of plain JavaScript through JSDoc                                                                                                                                                                           |

At `all`, the optional types directory rule applies to JavaScript as JSDoc: `@typedef` and `@callback` only in
files under `[architecture] types_directory`.

Checks:

| Id                   | Stage  | Command                                                                                                                                                                                                      |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `javascript/eslint`  | commit | as typescript; cognitive complexity through `sonarjs/cognitive-complexity` and cyclomatic through core `complexity`, `max-statements` from `[limits]`; cycles through `import-x/no-cycle`, CommonJS included |
| `javascript/checkjs` | commit | `tsc -p .gspot/config/jsconfig.json`                                                                                                                                                                         |
| `javascript/knip`    | push   | knip                                                                                                                                                                                                         |

Settings:

`tools.eslint.*` as typescript; `tools.eslint.globals` per file class. A file's runtime comes from what references it, never from a folder name. It is `worker` when a platform configuration claims it, and `browser` when a tracked HTML file references it through `<script src>` (URL paths resolved against the repository root and the declared output directory). Otherwise, it is `node`.

`sourceType`
follows the Node resolution: the nearest `package.json` `type`, then `.mjs` and `.cjs`.
The rendered knip ignore list carries `.gspot/config/commitlint.config.cjs` when the commits configuration is selected, because commitlint loads that file by path and knip cannot see it. Import aliases are what the runtime resolves: `package.json` `imports` and tsconfig `paths`.
`gspot set tools.eslint.globals "<glob>" browser` overrides one file class, and `gspot explain
<file>` prints the runtime a file got and why.

Rule files:

`language/JAVASCRIPT.md`, `language/naming/JAVASCRIPT.md`, plus the runtime file detected:
`runtime/node/NODE.md`, `runtime/bun/BUN.md`, `runtime/deno/DENO.md`, `runtime/browser/BROWSER.md`, `runtime/workers/WORKERS.md`.

Not covered here:

Type checking of untyped JavaScript is `checkJs` with JSDoc; no reference repository did it and
it is part of the level `all`. Lizard and madge are not used: sonarjs and import-x do their jobs in
the editor.

### Configuration zod

Kind: library. Requires: javascript.

Detects:

`zod` in dependencies.

Generated configuration:

The ESLint config gains `eslint-plugin-zod` with these rules: `no-any-schema`,
`no-coerce-boolean`, `no-empty-custom-schema`, `no-native-enum`, `no-promise-schema`,
`no-throw-in-refine`, `no-number-schema-with-finite`, `prefer-top-level-string-formats`,
`prefer-strict-object`, `prefer-loose-object`, `prefer-meta`, `prefer-meta-last`,
`require-brand-type-parameter`.

Checks:

`typescript/eslint` with the rules above. No separate check.

Settings:

`tools.eslint.rules` for the `zod/*` family.

Rule files:

`library/zod/ZOD.md`.

### Configuration xcode

Kind: tool. Requires: configs. Recommends: swift. macOS only; every check here passes as a platform skip
elsewhere.

Detects and claims:

|                         |                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | `*.xcodeproj`, `*.xcworkspace`                                                                                                                                                               |
| Claims                  | `project.pbxproj`, `*.xcscheme`, `*.xctestplan`, `*.xcconfig`, `*.entitlements`, `Info.plist` and other `.plist`, `*.xcstrings`, `*.storyboard`, `*.xib`, `Assets.xcassets/**/Contents.json` |
| Architecture it assumes | none. Does not assume MVVM.                                                                                                                                                                  |

Tools:

xcodebuild, plutil, xcstringstool (host); xcodegen optional.

Checks:

| Id                          | Stage  | Command                                                                                                                                                  |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xcode/plist`               | commit | `plutil -lint` over every plist and entitlements file                                                                                                    |
| `xcode/xcconfig`            | commit | key = value lines; no secret values (gitleaks allowlist for public client identifiers with reasons)                                                      |
| `xcode/xcstrings`           | commit | `xcstringstool` validates; translation completeness per locale against the base                                                                          |
| `xcode/asset-catalogs`      | commit | `Contents.json` validates against the catalogue schema; every image set has an image; no orphan asset referenced by no Swift source (at the level `all`) |
| `xcode/test-plan`           | commit | every scheme has a test plan; every test target is in a plan                                                                                             |
| `xcode/orphan-sources`      | commit | the symmetric difference between Swift files in the tree and files in any target: in the tree and no target fails; in a target and not the tree fails    |
| `xcode/symlinks`            | commit | a tracked symlink inside the project is reported with its target                                                                                         |
| `xcode/entitlements-policy` | commit | entitlements limited to `[tools.xcode] entitlements_allowed`                                                                                             |
| `xcode/ats`                 | commit | no `NSAllowsArbitraryLoads` without an `[[ignore]]` reason                                                                                               |

Settings:

`tools.xcode.project`, `tools.xcode.scheme`, `tools.xcode.destination`, `tools.xcode.entitlements_allowed`. The orphan asset rule has no switch of its own: it is part of
the level `all`, and `gspot ignore` turns it off.

Rule files:

`tool/xcode/XCODE.md`.

### Configuration commits

Kind: policy. Requires: nothing. Offered at `init` and not selected. The security and licenses configurations work the same way.

Tools:

commitlint. The conventional rule set is written into the rendered configuration, so
`@commitlint/config-conventional` is not installed and the configuration works wherever the
commitlint binary runs.

Generated configuration:

`.gspot/config/commitlint.config.cjs` with a `.commitlintrc.json` stub that extends it. The rules:

- `type-enum` from `[tools.commitlint] types` (default: `feat`, `fix`, `refactor`, `perf`,
  `docs`, `test`, `build`, `ci`, `chore`, the corpus list); `type-case` lower; `type-empty`
  never.
- `scope-enum` from `[tools.commitlint] scopes`; when the setting is empty, the last segment of
  every scope path plus `root`, `hooks` and `deps`, and no enum at all when the repository has
  no scopes. `scope-empty: never` when an enum exists; `scope-case` kebab.
- `subject-empty` never; `subject-full-stop` never; `subject-case` never start, pascal or
  upper case, so `Add the page` and `add the page` both pass and `Add The Page` does not.
- `header-max-length` 72 and `body-max-line-length` 72, the corpus limits; `body-leading-blank`
  and `footer-leading-blank` always.
- `[tools.commitlint] rules` options render as written; `gspot ignore commits/commitlint --rule
<name>` renders the rule at level 0.

Checks:

| Id                   | Stage   | Command                                                                                 |
| -------------------- | ------- | --------------------------------------------------------------------------------------- |
| `commits/commitlint` | message | `commitlint --config .gspot/config/commitlint.config.cjs --edit <message file>`         |
| `commits/range`      | push    | `commitlint --config .gspot/config/commitlint.config.cjs --from <merge base> --to HEAD` |

The merge base is the one with the upstream branch, or the root commit when the branch has no
upstream. Neither check is cached: the message and the range change without any file changing.

Settings:

`tools.commitlint.types`, `tools.commitlint.scopes`, `tools.commitlint.rules` (per-rule options;
off is a `gspot ignore --rule`).

Rule files:

`general/agent/GIT.md`, `tool/commitlint/COMMITLINT.md`.

### Configuration react-hook-form

Kind: library. Requires: javascript.

Detects:

`react-hook-form` in dependencies.

Generated configuration:

The ESLint config gains `no-restricted-syntax` selectors: `useForm` carries a `resolver`, and
`handleSubmit` wraps every submit handler. A selector cannot see that one element holds both a
`register` spread and a `value`, so that rule lives in the rule file only.

Checks:

`typescript/eslint` with the selectors.

Settings:

None.

Rule files:

`library/react-hook-form/REACTHOOKFORM.md`.

### Configuration supabase

Kind: platform. Requires: postgres. Recommends: typescript, configs, security.

Detects and claims:

|                         |                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detect                  | `supabase/config.toml`                                                                                                                           |
| Claims                  | `supabase/migrations/**`, `supabase/functions/**`, `supabase/config.toml`, `supabase/seed.sql`, the generated types file the repository declares |
| Architecture it assumes | the Supabase CLI layout, because the CLI dictates it                                                                                             |

Tools:

supabase (CLI), deno, the Semgrep Supabase rule pack.

Generated configuration:

| Target                             | Holds                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| ESLint override for `functions/**` | Deno globals; `n/*` and `n/prefer-promises/*` off; `import_style = "ts"` |
| `.gspot/config/sqlfluff.cfg`       | dialect `postgres` (through postgres)                                    |
| `.gspot/config/v8r.yml`            | the `config.toml` schema                                                 |

Checks:

| Id                               | Stage        | Command                                                                                                                                                                                                         |
| -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/config`                | commit       | `config.toml` validates against the CLI schema                                                                                                                                                                  |
| `supabase/deno-lint`             | commit       | `deno lint --config .gspot/deno.json <function>` per function                                                                                                                                                   |
| `supabase/deno-check`            | commit       | `deno check` per function entry                                                                                                                                                                                 |
| `supabase/migration-names`       | commit       | naming engine `snake-migration`                                                                                                                                                                                 |
| `supabase/types-fresh`           | push         | `supabase gen types` matches the declared file (`tools.supabase.types_file`)                                                                                                                                    |
| `supabase/storage-policies`      | commit       | every bucket in `config.toml` has an RLS policy in a migration                                                                                                                                                  |
| `supabase/admin-key-containment` | commit       | ast-grep: the service-role key name appears only in server files and never in `functions/**` client bundles                                                                                                     |
| `security/semgrep` supabase pack | push         | raw SQL interpolation, RPC with user input, service-role key in client code, RLS bypass, wildcard CORS with credentials, unvalidated JSON body, dynamic import, `eval`, secrets in logs, hard-coded service key |
| `postgres/*`                     | see postgres | migration safety, docs, immutability                                                                                                                                                                            |

Prettier formats the edge functions with the rest of the TypeScript, so no `deno fmt` check
ships. Each function keeps its own `deno.json`, because its import map lives there and Deno
has no way to extend another file.

Settings:

`tools.supabase.types_file`, `tools.supabase.functions_directory` (default `supabase/functions`),
`tools.supabase.admin_key_files`.

Rule files:

`platform/supabase/SUPABASE.md`, `database/postgres/POSTGRES.md`, `runtime/deno/DENO.md`.
Project-specific deployment conventions belong to the repository.

### Configuration drizzle

Kind: library. Requires: javascript.

Detects:

`drizzle-orm` in dependencies; `drizzle.config.*`.

Generated configuration:

The ESLint config gains `eslint-plugin-drizzle` (`enforce-delete-with-where`,
`enforce-update-with-where`) and a `no-restricted-syntax` selector that refuses `sql` template
literals outside `[tools.drizzle] raw_sql_allowed`.

Checks:

| Id                           | Stage  | Command                                                                                |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `typescript/eslint`          | commit | with the rules above                                                                   |
| `drizzle/migrations-fresh`   | push   | `drizzle-kit generate` produces no new migration (the schema and the migrations agree) |
| `drizzle/relations-complete` | commit | ast-grep: every `references()` has a matching `relations()` entry                      |

Settings:

`tools.drizzle.config`, `tools.drizzle.raw_sql_allowed` (paths, reason).

Rule files:

`library/drizzle/DRIZZLE.md`.

### Configuration jest

Kind: tool. Requires: typescript or javascript.

NestJS and React Native test with Jest by default, so this configuration ships beside `vitest`.
A repository selects the one its tests run with.

Detects and claims:

|        |                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------- |
| Detect | `jest` in dependencies, or a `jest.config.*` file                                                 |
| Claims | test files: `**/*.{test,spec}.{ts,tsx,js,jsx}`, `**/tests/**`, `**/__tests__/**`, `jest.config.*` |

Tools:

eslint-plugin-jest 29.16.6, as a library. The repository owns Jest and its version, as it owns
Vitest under the vitest configuration.

Generated configuration:

The ESLint config gains, over test files, the same test rules the vitest configuration holds, under the
`jest` prefix: `no-focused-tests`, `no-disabled-tests`, `no-identical-title`,
`no-standalone-expect`, `no-commented-out-tests`, `expect-expect`, `valid-describe-callback`,
`no-conditional-expect`, `valid-expect`, and `prefer-strict-equal`. The relaxations for test files
are the ones the javascript template holds for every runner, and no other.

The plugin reads another runner through its `globalPackage` setting. This repository sets it to
`bun:test`, which turns the same test rules on for its own tests (S-8).

Checks:

| Id                  | Stage  | Command                                                                                                            |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `typescript/eslint` | commit | with the test overrides                                                                                            |
| `jest/coverage`     | push   | `jest --coverage` with thresholds from `[tools.jest]` (default 80 lines, branches, functions, and statements each) |

Settings:

`tools.jest.coverage_lines`, `coverage_branches`, `coverage_functions`, and `coverage_statements`
(default 80 each), and `tools.jest.harness_directory` (default `tests/support`).

Rule files:

`general/code/TESTING.md`.

### Configuration react

Kind: framework. Requires: javascript. Recommends: typescript, css, vitest.

Detects:

`react` in dependencies. A Vite app, a library of components, and a Next.js app all select it;
`nextjs` requires it, so the two share one copy of the React rules.

Tools:

As libraries, each with ESLint 9 in its range:

- eslint-plugin-react 7.37.5 and eslint-plugin-react-hooks 7.1.1;
- eslint-plugin-jsx-a11y 6.10.2 and eslint-plugin-react-refresh 0.5.7;
- eslint-plugin-testing-library 7.16.2.

Generated configuration:

Every shared rule of the javascript and typescript configurations reads the files of this framework
too, with the same limits. A rule this configuration turns off stands in its manifest with a
reason, and the page lists each one.

The ESLint config gains one block over `js`, `jsx`, `ts`, and `tsx` files:

- the `recommended` and `jsx-runtime` sets of the React plugin, with the React version set to
  `detect`;
- every rule of the `recommended-latest` set of the hooks plugin, as an error. The set holds the
  rules of hooks, `exhaustive-deps`, and the React Compiler rules. The plugin ships two of them
  as warnings, and the gate allows no warning;
- the `recommended` set of `jsx-a11y`, which is the enforcement of the accessibility guide;
- `react-refresh/only-export-components`, so a file of components keeps its state on a reload;
- `react/no-array-index-key`, `react/no-danger`, `react/no-unstable-nested-components`,
  `react/jsx-no-constructed-context-values`, and `react/no-object-type-as-default-prop`.

Over test files, the `react` set of the testing-library plugin. At the `all` level:
`react/self-closing-comp`.

Names:

`[[naming.rules]]` of this configuration:

- a function that returns JSX is in PascalCase, and a hook starts with `use`;
- a callback may start with `handle`;
- a file that holds one component may carry its name.

Turned off:

Nothing.

Checks:

`typescript/eslint` or `javascript/eslint` with the rules above. No separate check.
`javascript/required-rules` holds `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`,
`react/jsx-key`, and `react/no-danger` for `jsx` and `tsx` files.

Settings:

None. A rule the repository decides against is `gspot ignore typescript/eslint --rule <rule>`.

Rule files:

`framework/react/REACT.md`.

### Configuration ansible

Kind: tool. Requires: configs.

Detects and claims:

|        |                                        |
| ------ | -------------------------------------- |
| Detect | `ansible.cfg` at any depth             |
| Claims | `ansible.cfg`; YAML stays with configs |

Tools:

ansible-lint. It has no Windows build, so the check is a platform skip there.

Checks:

| Id             | Stage  | Command                                                                                                 |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `ansible/lint` | commit | `ansible-lint --offline -f pep8` in every folder that holds an `ansible.cfg`; findings carry the folder |

A rule turned off is `gspot ignore ansible/lint --rule <rule> --reason`, passed as `--skip-list`.

Why a configuration:

The check lived in configs in an earlier draft. A configuration installs its tools, so every
repository with a YAML file installed ansible-lint. Detection by `ansible.cfg` installs it only
where a playbook exists.

### Configuration spelling

Kind: policy. Requires: nothing. Recommended by every language configuration.

Claims:

Every text file. Binaries, lockfiles, generated files and vendored files are excluded by nature.

Tools:

typos.

Generated configuration:

`.gspot/config/typos.toml` with a `typos.toml` stub: `[files] extend-exclude` from natures and
`[tools.typos] exclude`; `[default.extend-words]` from `[tools.typos] words`, each with its
reason as a comment.

Checks:

| Id               | Stage  | Command                                                                                |
| ---------------- | ------ | -------------------------------------------------------------------------------------- |
| `spelling/typos` | commit | `typos --config .gspot/config/typos.toml {files}`; fix `--write-changes`, order format |

Settings:

`tools.typos.words` (word; reason optional, the word is the reason), `tools.typos.exclude`
(paths, reason), `tools.typos.locale` (default `en-us`, matching the American English rule of the prose engine). `gspot set tools.typos.words <word>` and `gspot set tools.typos.exclude <glob> --reason` write the first
two.

Rule files:

None.

### Configuration tanstack-query

Kind: library. Requires: javascript.

Detects:

`@tanstack/react-query` in dependencies.

Generated configuration:

The ESLint config gains `@tanstack/eslint-plugin-query`: `exhaustive-deps`, `no-rest-destructuring`,
`stable-query-client`, `no-unstable-deps`, `infinite-query-property-order`.

Checks:

`typescript/eslint` with the rules above.

Settings:

`tools.eslint.rules` for the `@tanstack/query/*` family.

Rule files:

`library/tanstack-query/TANSTACKQUERY.md`.

### Configuration cloudflare

Kind: platform. Requires: javascript. Recommends: security, configs.

Detects and claims:

|                         |                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | `wrangler.jsonc`, `wrangler.toml`, `functions/_middleware.js`, `functions/_worker.js`, `_headers`, `_redirects`, `@opennextjs/cloudflare` in dependencies |
| Claims                  | `wrangler.*`, `functions/**`, `_headers`, `_redirects`, `cloudflare-env.d.ts` (generated), `.open-next/**` (build output, untracked)                      |
| Architecture it assumes | Pages Functions under `functions/` and the two underscore files, because Cloudflare reads them there                                                      |

Tools:

wrangler, zizmor is not relevant; the Semgrep landing pack for workers.

Generated configuration:

The files this configuration claims get the `worker` runtime (the rule in [javascript.md](#configuration-javascript)), so the scope's ESLint config gains worker globals (`Response`, `Request`, `fetch`, `caches`) for
`functions/**` and `_worker.*`.

Checks:

| Id                              | Stage  | Command                                                                                                                  |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `cloudflare/wrangler-config`    | commit | `wrangler.*` validates against the published schema                                                                      |
| `cloudflare/headers-syntax`     | commit | `_headers` parses: a path line followed by indented header lines                                                         |
| `cloudflare/redirects-syntax`   | commit | `_redirects` parses: source, destination, optional status                                                                |
| `cloudflare/env-types-fresh`    | push   | `wrangler types` leaves `cloudflare-env.d.ts` unchanged, when the file is tracked; an ignored one is skipped and printed |
| `security/semgrep` workers pack | push   | no wildcard CORS origin, no unvalidated `request.json()`, no DOM HTML sinks, no user-controlled fetch                    |

Settings:

none of its own. The security-header check belongs to static-site. A framework app sets
its page headers in its own configuration, which gspot does not parse for values; the framework's
rule file states them.

Rule files:

`runtime/workers/WORKERS.md`. The configs configuration installs the GitHub Actions rule file.

### Configuration docs

Kind: policy. Requires: nothing. Documentation integrity: links, anchors, headings,
stale paths, and the agent files.

Claims:

Every `.md` file, `CLAUDE.md`, `AGENTS.md`, the rules directory, `README.md` at every scope.

Tools:

lychee; the integrity engine.

Generated configuration:

`.gspot/config/lychee.toml`: `offline = true`, `include_fragments = true`, `no_progress = true`,
excludes from `[tools.lychee] exclude` with reasons; a second profile for the online run.

Checks:

| Id                    | Stage           | Command                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/links`          | commit          | `lychee --config .gspot/config/lychee.toml --offline --include-fragments {files}`: every relative link resolves to a tracked file and every `#anchor` to a heading or an HTML id                                                                                                                                                                                        |
| `docs/links-external` | manual, network | `lychee --no-offline` with the online profile                                                                                                                                                                                                                                                                                                                           |
| `docs/headings`       | commit          | no heading from the banned list (`Table of contents`, `Project structure`, `Repository layout`, `Directory structure`, `File map`, `Codebase map`)                                                                                                                                                                                                                      |
| `docs/stale-paths`    | commit          | every path-shaped token in Markdown and comments (a token counts when its first segment is a tracked top-level entry or it ends in a file extension) names a tracked file, and every `mise run <task>`, `bun run <script>` or `npm run <script>` names a task or script that exists, unless it is in a code fence tagged `text` or matches `[tools.docs] paths_allowed` |
| `docs/readme-present` | commit          | every scope has a `README.md`; the root has a `LICENSE`                                                                                                                                                                                                                                                                                                                 |
| `docs/readme-shape`   | commit          | every `README.md` has one H1 (fenced code does not count), an opening paragraph before the first H2, a Contents list when it has more than six H2 headings, and no banned heading; the root README and each scope's README also have a section whose heading contains `install`, `setup`, `start` or `requirements`; content beyond this shape stays in the rule files  |

Settings:

`tools.docs.paths_allowed` (patterns, reason), `tools.docs.banned_headings` (add), `tools.lychee.exclude`
(url patterns, reason), `tools.docs.require_license` (default true).

The shape check is the whole of README enforcement. What a README says is the rule file's job
(`general/prose/DOCS-CONTENT.md`, `templates/docs/README.md` and `templates/docs/ADVANCED.md`,
which follow the short-README-plus-ADVANCED shape); gspot does not grade content.

Rule files:

`general/prose/DOCS.md`, `general/prose/DOCS-FORMAT.md`, `general/prose/DOCS-CONTENT.md`,
`general/prose/DOCS-MEDIA.md`, `general/prose/DOCS-SURFACES.md`, `general/prose/DOCS-REVIEW.md`,
`general/prose/WRITING.md`, `general/code/COMMENTS.md`; the templates under `templates/docs/`.

### Configuration docker

Kind: tool. Requires: configs. Recommends: spelling.

Detects and claims:

|                         |                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Detect                  | `Dockerfile*`, `*.dockerfile`, `docker-compose*.yml`, `compose*.yml`, `.dockerignore` |
| Claims                  | the same                                                                              |
| Required check coverage | syntax, style, security, spelling                                                     |

Tools:

hadolint, trivy, docker (host).

Generated configuration:

| Target                        | Stub             | Holds                                                                                                                   |
| ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/hadolint.yaml` | `.hadolint.yaml` | `failure-threshold: style`, `ignored:` rendered from the `[[ignore]]` entries for `docker/hadolint`, trusted registries |
| `.gspot/config/trivy.yaml`    | none             | severities, ignore file path, timeout                                                                                   |

Checks:

| Id                      | Stage                   | Command                                                                                                    |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docker/hadolint`       | commit                  | `hadolint --config .gspot/config/hadolint.yaml {files}` (ShellCheck runs over `RUN` lines inside hadolint) |
| `docker/compose-config` | push, docker            | `docker compose -f <file> config --quiet` per compose file (parses without a daemon)                       |
| `docker/dockerignore`   | commit                  | `.dockerignore` exists beside every Dockerfile and excludes `.git`, `node_modules`, `.env`                 |
| `docker/trivy-config`   | push                    | `trivy config --config .gspot/config/trivy.yaml <dir>`                                                     |
| `docker/trivy-image`    | manual, docker, network | `trivy image` over images the compose file names, with `[tools.trivy] ignore` (id, reason)                 |
| `structure/bash-embeds` | commit                  | no inline Python or Node heredocs in `RUN` lines                                                           |

Settings:

`tools.hadolint.trusted_registries`, `tools.trivy.severity`
(default `HIGH,CRITICAL`), `tools.trivy.ignore` (id, reason), `tools.trivy.timeout`.

Rule files:

`tool/docker/DOCKER.md`. Project-specific CUDA conventions belong to the repository.

Not covered here:

The compose file itself is a configs YAML with the Compose schema.

### Configuration nestjs

Kind: framework. Requires: typescript. Recommends: jest, security, dependencies.

Detects and claims:

|        |                                                 |
| ------ | ----------------------------------------------- |
| Detect | `@nestjs/core` in dependencies, `nest-cli.json` |
| Claims | `nest-cli.json`                                 |

What the framework needs from the other configurations:

NestJS injects by the types of constructor parameters. That takes decorators with emitted
metadata and parameter properties, and the strict base of the typescript configuration refuses both.
A scope that selects nestjs gets a `tsconfig` file of this configuration, which extends the shared base
and sets `experimentalDecorators` and `emitDecoratorMetadata`. The shared base names no
framework.
`typescript/tsconfig-options` requires the first pair and drops the second pair in that scope.
`@typescript-eslint/consistent-type-imports` stays on: it leaves a file with decorators alone when
both decorator options are on.

The Nest generator names a file for its feature and its kind: `cats.controller.ts` beside
`cats.service.ts`. `[[naming.rules]]` of this configuration say so for the sixteen kinds the generator
writes and for `.spec` files, and `structure/prefix-collisions` reads those rules.

The acceptance bar is a planted module, controller, and service written the Nest way. They pass
every commit check.

Tools:

As a library: @darraghor/eslint-plugin-nestjs-typed 7.5.5, which runs on the pinned ESLint 9.

Generated configuration:

Every shared rule of the javascript and typescript configurations reads the files of this framework
too, with the same limits. A rule this configuration turns off stands in its manifest with a
reason, and the page lists each one.

- the `flatRecommended` set of the nestjs-typed plugin. It finds a provider that no module
  provides, a route parameter that matches no decorator, and a DTO field with no validation
  decorator. It also holds the Swagger decorators to the types;
- the fragment exports its selectors. Over every code file: no `forwardRef`, and no
  `@Res()` without `passthrough`. Over `*.controller.ts`: no constructor parameter typed as a
  repository, a data source, an entity manager, or a Prisma client, and no `@InjectRepository`,
  `@InjectModel`, or `@InjectDataSource`.

Turned off:

| Rule                                                                   | Why                                           |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| `@typescript-eslint/no-extraneous-class`, for a class with a decorator | a module is a decorated class with no members |
| `class-methods-use-this`                                               | Nest calls a handler as a method              |

Checks:

`typescript/eslint` with the rules above, and `typescript/tsconfig-options` with the decorator
options. No separate check.

Settings:

`tools.nestjs.swagger`, a boolean that `init` proposes from the `@nestjs/swagger` dependency.
Where it is false, the config adds the `flatNoSwagger` set of the plugin, which turns the
Swagger rules off.

Rule files:

`framework/nestjs/NESTJS.md`.

### Configuration formatting

Kind: policy. Requires: nothing. Recommended by every language configuration. One `[format]` block that every formatter
reads, so indentation cannot disagree between Prettier, shfmt, Ruff, and markdownlint.

Settings:

```toml
[format]
indent_style  = "space"
indent_width  = 4
print_width   = 120
line_ending   = "lf"
newline_at_end = true
quotes        = "single"        # prettier and ruff; swift keeps double
trailing_comma = "all"
semicolons    = true
```

Defaults are the values three of four reference repositories share. They are the one policy `init` does not impose. When an existing formatter configuration (Prettier, `.editorconfig`, Ruff format, SwiftFormat) differs from them, `init` asks whether to keep the repository's values or take the shipped ones. `--yes` keeps them. Either answer is written to `[format]`
and is one `gspot set format.indent_width 4` away from the other. The reason is stated once:
formatting has no strictest value, and reformatting every file is the most disruptive thing `init` can do unasked.

Generated configuration:

| Target                               | Stub                                                                                                   | Derived                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.editorconfig`                      | none; gspot owns the whole file at its conventional path, with the header                              | `end_of_line`, `insert_final_newline`, `charset`, `trim_trailing_whitespace`, indent per extension, `switch_case_indent` for shell; `[tools.editorconfig.extra]` for a section gspot does not render |
| `.gspot/config/prettier.json`        | `.prettierrc.json` (the whole document is the path)                                                    | `tabWidth`, `printWidth`, `singleQuote`, `trailingComma`, `semi`, `arrowParens: always`, `embeddedLanguageFormatting: off`                                                                           |
| `.prettierignore`                    | none; gspot owns the whole file at the root, with the header, for editors (the gate passes file lists) | by nature: generated, vendored, binary, lockfiles                                                                                                                                                    |
| shfmt flags                          | in the bash check command                                                                              | `-i <width> -ci -s`                                                                                                                                                                                  |
| ruff format section                  | in `.gspot/config/ruff.toml`                                                                           | `indent-width`, `quote-style`, `line-ending`                                                                                                                                                         |
| markdownlint MD007                   | in `.gspot/config/markdownlint.jsonc`                                                                  | `indent`                                                                                                                                                                                             |
| SwiftFormat `--indent`, `--maxwidth` | in `.gspot/config/swiftformat`                                                                         |                                                                                                                                                                                                      |
| taplo, yamllint indent               | in their configs                                                                                       |                                                                                                                                                                                                      |

Checks:

| Id                                | Stage  | Command                                                                                      |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `formatting/prettier`             | commit | `prettier --check --config .gspot/config/prettier.json {files}`; fix `--write`, order format |
| `formatting/editorconfig-checker` | commit | `editorconfig-checker {files}`                                                               |

Tools:

prettier, editorconfig-checker.

Rule files:

None. Formatting decisions are the tools' and are not restated in prose.

### Configuration fastapi

Kind: framework. Requires: python. Recommends: security, pytest.

Detects and claims:

|                         |                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect                  | `fastapi` in `pyproject.toml` dependencies                                                                                                   |
| Claims                  | nothing by path                                                                                                                              |
| Architecture it assumes | `APIRouter` composition, `Depends` injection, Pydantic models at the boundary, lifespan handlers: what the framework's own tutorial produces |

Tools:

spectral, the Semgrep Python and API packs; Ruff `ASYNC` and `FAST` families.

Generated configuration:

`.gspot/config/ruff.toml` gains `FAST` (FastAPI rules) and keeps `ASYNC`. The import-linter contracts
gain `[architecture.contracts]` entries the repository declares.

Checks:

| Id                                | Stage  | Command                                                                   |
| --------------------------------- | ------ | ------------------------------------------------------------------------- |
| `python/ruff`                     | commit | with `FAST001`, `FAST002`, `FAST003`                                      |
| `fastapi/openapi-fresh`           | push   | the exported OpenAPI document matches the app (`[tools.openapi] command`) |
| `fastapi/openapi-lint`            | commit | `spectral lint`                                                           |
| `security/semgrep`                | push   | the Python pack plus the API pack                                         |
| `fastapi/no-blocking-io-in-async` | commit | ast-grep: `time.sleep`, `requests.*`, `open()` inside `async def`         |

Settings:

`tools.openapi.document`, `tools.openapi.command`, `architecture.contracts`.

Rule files:

`framework/fastapi/FASTAPI.md`, `framework/fastapi/RUNTIME.md`, `shared/http/HTTP.md`.

### Configuration naming

Kind: policy. Requires: nothing. Recommended by every language configuration. Runs the naming engine over every language
with the shipped policy in [../08-naming-policy.md](08-naming-policy.md).

Banned terms and reserved-word restrictions are level `all`. The shipped policy permits
`generate` and `service`. Case, length, digit, ordering, and layout preferences also run at `all`. Only demonstrated external-contract defects qualify for recommended naming checks.

Claims:

Every file a language configuration claims, plus every directory name, and file name in the tree
outside build output and vendored paths.

Checks:

| Id                                                               | Stage  | Over                                                                                                                              |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `naming/identifiers`                                             | commit | every category the language extractor yields                                                                                      |
| `naming/paths`                                                   | commit | file stems and directory names against the language's file and directory cases; the migration file pattern; Next.js segment rules |
| `naming/policy-schema`                                           | commit | `[naming]` and `[[naming.rules]]` validate; every `allowed` entry and every path rule matches something                           |
| `structure/private-prefix`, `structure/file-directory-collision` | commit | run with the naming engine's index; see structure                                                                                 |

A finding reads:

```text
api/src/turn/enhancedHandler.ts:1:1  naming/identifiers  file "enhancedHandler": "enhanced" is banned (marketing group); "handler" is banned (roles group); file case is kebab.
```

Settings:

`naming.banned_terms` (`gspot set naming.banned_terms <term>...`), `naming.allowed` (name, reason;
`gspot set naming.allowed <name> --reason`), `naming.external` (`gspot set naming.external <name>`),
`naming.reserved`, `naming.remove_groups` (group, reason), `naming.contract_properties`,
`[[naming.rules]]`; per language and per category: `naming.<language>.max_chars`,
`naming.<language>.max_words`, `naming.<language>.<category>.case`, `.max_chars`, `.max_words`
(`gspot set naming.python.parameters.max_words 3`). Defaults are the table in
[../08-naming-policy.md](08-naming-policy.md).

Rule files:

`general/code/NAMING.md`, `general/code/NAMING-FILES.md` and each language's `naming/<LANGUAGE>.md`.

### Configuration typescript

Kind: language. Requires: javascript, structure. Recommends: naming, formatting, spelling.

Detects and claims:

|                         |                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Detect                  | `.ts`, `.tsx`, `.mts`, `.cts` in the tree; `tsconfig.json`; `typescript` in dependencies |
| Claims                  | `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts`, `tsconfig.json`, `tsconfig.*.json`               |
| Required check coverage | format, syntax, style, types, structure, naming, prose, spelling                         |

Tools:

`typescript`, `eslint`, `typescript-eslint`, `@gspot/eslint-plugin`, `eslint-plugin-sonarjs`, `eslint-plugin-unicorn`, `eslint-plugin-security`, `eslint-plugin-n`, `eslint-plugin-jsdoc`, `eslint-plugin-regexp`, `eslint-plugin-import-x`, `@eslint-community/eslint-plugin-eslint-comments`, `eslint-plugin-boundaries`, `eslint-plugin-package-json`, `eslint-config-prettier`, `knip`. Versions in the ledger.

Generated configuration:

| Target                              | Stub                                                                           | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/eslint.config.mjs`   | `eslint.config.mjs` re-export, only where the developer keeps no ESLint config | the flat config: ignores by nature; typescript-eslint `strictTypeChecked` over typed files; sonarjs and unicorn `recommended` bases with the listed exceptions; the rule sets from the ledger section 3 and the additions (`strict-boolean-expressions`, `explicit-module-boundary-types`, `no-unnecessary-condition`, `only-throw-error`, `prefer-optional-chain`, `no-magic-numbers`, `eqeqeq`, `no-param-reassign`, `prefer-const`, `max-depth` 3, `complexity`, `max-statements` from `[limits]`, `no-console` in source); `@gspot/eslint-plugin` with limits from `[limits]`, `types-placement` from `[architecture] types_directory`, `import-direction` from `[architecture] roles`, `no-reexports` from `[structure] reexports`, `env-access-owner` from `roles.env`, `private-before-public`, `import-path-style` per file class from `[tools.eslint] import_style`; `import-x/exports-last`; `boundaries/element-types` from `[architecture] elements` and `allow`; test overrides; prettier last |
| `.gspot/config/tsconfig.check.json` | none; it extends the `tsconfig.json` of the repository                         | `strict` at `recommended`, and four more flags at `all`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `.gspot/config/knip.json`           | none                                                                           | entry points from the framework configuration or `[tools.knip] entry`; project globs from claims                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Checks:

| Id                            | Stage  | Command                                                                                                                                                                   |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript/tsc`              | push   | `tsc --noEmit -p .gspot/config/tsconfig.check.json` for each scope, or `tsc -b --noEmit` where the config holds references (K-226)                                        |
| `typescript/eslint`           | commit | `eslint --max-warnings 0 --no-warn-ignored --config .gspot/config/eslint.config.mjs {files}`; fix: `--fix`, order codemod                                                 |
| `javascript/knip`             | push   | `knip --config .gspot/config/knip.json`, once over the whole tree; javascript owns the check and typescript requires javascript                                           |
| `typescript/tsconfig-options` | commit | engine                                                                                                                                                                    |
| `javascript/required-rules`   | push   | ESLint-resolved configuration for every governed file, grouped by equal results, compared with the `[required_rules]` of every selected manifest; shipped by `javascript` |

The types directory:

`gspot/types-placement` runs only when `[architecture] types_directory` explicitly names a
directory, at either enforcement level. Types otherwise stay beside their behavioral owners.
An existing `types/` directory does not opt a repository into the rule. Within an explicitly
selected directory, type-only imports and exports describe the contract without runtime behavior.

Import direction:

At `all`, four rules read `[architecture] roles`:

- types import only types;
- runtime never imports tests or support;
- tests and support import runtime only through element contracts or types;
- config and env never import runtime.

`[structure] reexports = "none"` (the default for
application scopes) refuses every re-export in source; `index-only` allows index barrels.

Settings:

| Setting                                               | Direction                                                              | Default                                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.eslint.rules`                                  | per-rule (options and rules turned on; off is a `gspot ignore --rule`) | the ledger set                                                                                                                                                        |
| `tools.eslint.import_style`                           | neutral                                                                | `js` for TypeScript compiled to ESM, `ts` for Deno, `extensionless` for bundled code; per file class. Aliases come from tsconfig `paths` and `package.json` `imports` |
| `tools.eslint.test_files`                             | neutral                                                                | `**/*.{test,spec}.{ts,tsx}`, `**/tests/**`                                                                                                                            |
| `tools.typescript.paths`                              | neutral                                                                | from the existing tsconfig at init                                                                                                                                    |
| `tools.knip.entry`                                    | neutral                                                                | from the framework configuration                                                                                                                                      |
| `architecture.types_directory`                        | neutral                                                                | `types`                                                                                                                                                               |
| `architecture.elements`, `architecture.edges_allowed` | tightening                                                             | one element; the default roles                                                                                                                                        |
| `structure.reexports`                                 | tightening                                                             | `none`                                                                                                                                                                |
| `structure.call_through_allowed` (file, name, reason) | loosening                                                              | none                                                                                                                                                                  |

Rule files:

`language/TYPESCRIPT.md`, `language/naming/TYPESCRIPT.md`.

Not covered here:

Runtime-specific rules (Node, browser, workers) come from the runtime detected in
`package.json` and the framework configuration. React rules come from the react configuration.

### Configuration bash

Kind: language. Requires: structure. Recommends: naming, formatting, spelling.

Detects and claims:

|                         |                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Detect                  | `.sh`, `.bash`, `.zsh`, `.bats` in the tree; shell shebangs                                                |
| Claims                  | `.sh`, `.bash`, `.zsh`, `.bats`, extensionless files with a shell shebang, including hooks, and task files |
| Required check coverage | format, syntax, style, structure, naming, prose, spelling                                                  |

Tools:

ShellCheck, shfmt, and the host commands Bash, Zsh, and Bats. The development
test repository uses Bats 1.14.0. Windows execution remains deferred during the CI pause.

Generated configuration:

| Target                        | Stub                                    | Holds                                                                                                                                                       |
| ----------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/shellcheckrc`  | `.shellcheckrc`                         | `shell=bash`, `source-path=SCRIPTDIR`, `external-sources=true`, `enable=all`, `disable=` lines rendered from the `[[ignore]]` entries for `bash/shellcheck` |
| `.editorconfig` shell section | through formatting, which owns the file | indent width and `switch_case_indent` from `[format]`                                                                                                       |

Checks:

| Id                                                                              | Stage  | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash/syntax`                                                                   | commit | `bash -n <file>` per file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `bash/zsh-syntax`                                                               | commit | `zsh -n <file>` for Zsh files and launchers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `bash/bats-syntax`                                                              | commit | `bats --count <file>` for Bats test files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `bash/shellcheck`                                                               | commit | `shellcheck --rcfile .gspot/config/shellcheckrc --severity=style --check-sourced {files}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `bash/shfmt`                                                                    | commit | `shfmt -d -i <indent> -ci -s {files}`; fix `-w`, order format                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `structure/bash-interpreter`                                                    | commit | shebang is `#!/usr/bin/env bash` or `#!/bin/bash`; line 2 is `#`; line 3 is a concrete description; line 4 is `# Runtime: Bash N.N+, macOS and Linux.` (or `Linux`); `set -euo pipefail` and `shopt -s inherit_errexit` before the first command in an executable; Bash 4 features named in the header; computed directory constants use `CDPATH=`, `cd --`, `pwd -P` and a failure path; `main "$@"` last in an executable; top-level assignments `readonly`; a library (sourced) file is declarative at top level and not executable; an executable file has the bit set through git; every `mktemp` has a `trap` that removes it |
| `structure/doc-comment`                                                         | commit | function header `# name: summary`, no vague summary words (`handle`, `perform`, `execute`, `do`), doc sections when present                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `structure/duplicate-functions`                                                 | commit | normalized bodies, min lines from `[limits.bash]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `structure/unused-functions`, `dead-parameters`                                 | commit | reachability across every claimed file; reasoned `gspot-ignore` comments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `structure/private-prefix`                                                      | commit | a function called from no other file starts with `_`; `main` and hook entry points exempt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `structure/private-before-public`                                               | commit | `_` functions above the rest; `main` last                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `structure/trivial-function`                                                    | commit | executable statement threshold; every implemented function; reasoned narrow `gspot-ignore` comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `structure/file-length`, `function-length`                                      | commit | `[limits.bash]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `structure/prefix-collisions`, `file-directory-collision`, `single-file-folder` | commit | with the hook-directory `pre` allowance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `structure/bash-script-policy`                                                  | commit | no inline `node -e`, no forwarding wrappers over four lines, no compat, or deprecated alias names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `structure/bash-embeds`                                                         | commit | no inline Python, Node or generated-script heredocs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `structure/bash-ssh-blocks`                                                     | commit | multi-line ssh heredocs named and documented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `structure/bash-config-defaults`                                                | commit | `${VAR:-x}` only in `[tools.bash] config_owners`; allowed fragments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `structure/bash-config-guards`                                                  | commit | one idempotent guard per config owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `structure/bash-boundaries`                                                     | commit | `# Boundary:` header and source annotations in `[tools.bash] architecture_roots`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `structure/env-access-owner`                                                    | commit | environment variables declared in the owner are read elsewhere only through it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `structure/bash-branches`, `bash-nesting`, `bash-mutable-assignments`           | commit | ast-grep counts against `[limits.bash]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `structure/bash-safety`                                                         | commit | no `\|\| true`, no `pkill -f`, no `rm -rf` outside `[tools.bash.safety] owners`, checked `cd`, no state-file sourcing, no unowned cleanup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `security/semgrep` hook rules                                                   | push   | no `curl \| sh`, no `eval`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Settings:

`tools.bash.doc_style` (`colon` default), `tools.bash.config_owners`,
`tools.bash.architecture_roots`, `tools.bash.safety.owners`, `tools.bash.allowed_default_fragments`,
`tools.bash.runtime_header` (default `macOS and Linux`), `limits.bash.*`.

Rule files:

`language/BASH.md`, `language/bash/LANGUAGE.md`, `language/bash/SAFETY.md`, `language/bash/OPERATIONS.md`,
`language/naming/BASH.md`.

Not covered here:

Zsh-specific lint and formatting remain outside this configuration. Zsh syntax uses
`zsh -n`; Bash syntax uses `bash -n`; Bats syntax uses `bats --count`. ShellCheck
and shfmt claim Bash and Bats files. Broader dialect-aware structure analysis
remains open.

### Configuration security

Kind: policy. Requires: nothing. Static analysis for security patterns, per language. One SAST tool.

Claims:

Every file a language configuration claims.

Tools:

semgrep (or opengrep; same rule format), codeql.

Bearer is not used: Semgrep hosts the repository's own rules and the vendored packs in one
format, and the reference repositories used none of Bearer's data-flow classification. Bearer
ignore entries carried at init become Semgrep rule ignores.

Generated configuration:

| Target                         | Holds                                                                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/semgrep/`       | one pack per selected configuration: `node.yml` (9 rules) and `secrets.yml` (1) from this configuration; `express.yml`, `supabase.yml` and `swift.yml` from theirs; `[tools.semgrep] rules` adds repository files |
| `.semgrepignore`               | build output, dependencies, lockfiles, and the paths in `tools.semgrep.ignore`                                                                                                                                    |
| `.gspot/codeql/<language>.yml` | query suites per language; false positives with reasons and paths that exist                                                                                                                                      |

Checks:

| Id                          | Stage  | Command                                                                                         |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `security/semgrep`          | push   | `semgrep scan --config .gspot/config/semgrep --error --metrics off --vim {files}`               |
| `security/semgrep-registry` | manual | the registry packs of `tools.semgrep.registry`; needs the network                               |
| `security/codeql`           | manual | database create per language, analyze with the suite, SARIF filtered by the false-positive list |
| `integrity/suppressions`    | commit | `nosemgrep` carries a reason; the census does not grow                                          |

Semgrep ran in none of the reference repositories despite forty rules and a pinned binary. Here
it is a `push` check from day one.

Settings:

`tools.semgrep.rules`, `tools.semgrep.registry`, `tools.semgrep.ignore` (paths; a rule turned off is `gspot ignore security/semgrep --rule <rule>`), `tools.codeql.languages`,
`tools.codeql.suite`, `tools.codeql.false_positives` (rule, path, reason).

Rule files:

`general/code/SECURITY.md`, `general/code/SECRETS.md`; the security sections of each framework file.

### Configuration html

Kind: language. Requires: formatting. Recommends: spelling.

Detects and claims:

|                         |                                                                    |
| ----------------------- | ------------------------------------------------------------------ |
| Detect                  | `.html`, `.htm` in the tree outside build output                   |
| Claims                  | `.html`, `.htm`; inline `<script>` bodies are handed to javascript |
| Required check coverage | format, syntax, style, structure, spelling                         |

Tools:

html-validate, prettier; tree-sitter html inside gspot.

Generated configuration:

| Target                                       | Stub                 | Holds                                                                                                                                                                                    |
| -------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/config/html-validate-templates.json` | `.htmlvalidate.json` | `html-validate:recommended`, `doctype-style: lowercase`, `element-required-attributes`, `no-inline-style`, `no-raw-characters`, `void-style: selfclosing`, `wcag/h37`; `no-autoplay` off |
| `.gspot/config/html-validate-built.json`     | none                 | recommended with the template-only rules off; `wcag/h37` on; used by static-site over built output                                                                                       |

Checks:

| Id                   | Stage  | Command                                                                                                                                                                                                                                    |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `html/html-validate` | commit | `html-validate --config .gspot/config/html-validate-templates.json {files}`                                                                                                                                                                |
| `html/copy`          | commit | no hard-coded user-facing text in template files: text nodes, `alt`, `aria-label`, `aria-description`, `placeholder`, `title`, and button, input and option values are placeholders only; `[tools.html] copy_allowed` names the exceptions |
| `html/scripts`       | commit | no executable inline script except `application/ld+json`, no `on*` handlers, no `javascript:` URLs, no `document.write`                                                                                                                    |

`html/scripts` refuses executable inline script, so no inline script body is left for ESLint to
read, and the earlier row for it is gone. `html/copy` runs only over `tools.html.template_files`.

Settings:

`tools.html-validate.rules` (per-rule options; off is a `gspot ignore --rule`), `tools.html.template_files`, `tools.html.copy_allowed`
(paths with reasons), `tools.html.inline_script_types`.

Rule files:

`language/HTML.md`, `language/naming/HTML.md`, `repository/static-site/STATIC-SITE.md`.

### Configuration duplication

Kind: policy. Requires: nothing. Copy-paste detection across every language.

Tools:

jscpd.

Generated configuration:

`.gspot/config/jscpd.json`: `mode: strict`, `minLines` 8, `minTokens` 40, `threshold` 4 percent,
formats from the selected languages, ignore by nature, reporters `console` and `json`.

Checks:

| Id                  | Stage | Command                                                               |
| ------------------- | ----- | --------------------------------------------------------------------- |
| `duplication/jscpd` | push  | `jscpd --config .gspot/config/jscpd.json {files}` per language format |

Function-level duplicates are caught earlier by `sonarjs/no-identical-functions` and
`structure/duplicate-functions`; jscpd catches the rest.

Settings:

`limits.duplication.min_lines`, `min_tokens`, `threshold_percent`; `tools.jscpd.ignore` (paths, reason).

Rule files:

`general/agent/WORKING.md` (the duplication section).

### Configuration vitest

Kind: tool. Requires: javascript.

Detects and claims:

|        |                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------- |
| Detect | `vitest` in dependencies                                                                        |
| Claims | test files: `**/*.{test,spec}.{ts,tsx,js}`, `**/tests/**`, `**/__tests__/**`, `vitest.config.*` |

Tools:

@vitest/eslint-plugin. The repository owns its coverage provider, istanbul or v8, as it owns
Vitest: the configuration lists neither as a tool, so `doctor` never calls one missing.

Versions:

The repository owns the version of its test framework. The configuration pins neither `vitest` nor
`@vitest/coverage-v8`, and its floor is Vitest 2. The same holds for the Supabase CLI
in the supabase configuration. A pin never lowers an exact version a `package.json` already holds.

`tools.vitest.coverage_file` names the Vitest configuration the coverage run reads, relative to the
scope, for a repository that keeps it where Vitest does not look. It is empty by default.

Generated configuration:

The ESLint config gains, over test files: `vitest/no-focused-tests` (not fixable),
`no-disabled-tests`, `no-identical-title`, `no-standalone-expect`, `no-commented-out-tests`,
`expect-expect`, `valid-describe-callback`, `no-conditional-expect`, `valid-expect`,
`prefer-strict-equal`; `@typescript-eslint/no-non-null-assertion` off; jsdoc off; a
`no-restricted-syntax` selector that reports a test file made of `toMatchSnapshot` calls alone.

The three rules the reference repository measured and left off are part of the level `all`.

Checks:

| Id                                                                  | Stage  | Command                                                                                                                    |
| ------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `typescript/eslint`                                                 | commit | with the test overrides                                                                                                    |
| `vitest/coverage`                                                   | push   | `vitest run --coverage` with thresholds from `[tools.vitest] coverage` (default 80 lines, branches, functions, statements) |
| `gspot/tests-directory-contents`, `gspot/no-harness-barrel-imports` | commit | test support lives in the declared support directory                                                                       |

Settings:

`tools.vitest.coverage_lines`, `coverage_branches`, `coverage_functions` and
`coverage_statements` (default 80 each), and `tools.vitest.harness_directory` (default `tests/support`).
The command reads them through `{setting:<name>}` parts.

Rule files:

`tool/vitest/VITEST.md`, `general/code/TESTING.md`; `tool/playwright/PLAYWRIGHT.md` when Playwright is a
dependency.
