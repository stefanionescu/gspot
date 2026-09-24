# Slop and Drift

This document decides the enforcement gspot adds beyond the reference repositories: what
machine-written slop looks like, what repository drift looks like, and the mechanism that catches
each. Every row names a check of a configuration, a rule of a pinned tool, or a rule of the gspot plugin. Python, Swift, and SQL
list a shared idea under an id of their own, such as `python/trivial-function`.

## Slop

Slop is code, naming, or prose that adds nothing. A model reaches for it when asked to improve something it does not want to replace. It also reaches for it to guard against a failure it cannot name, or to explain code it did not read. The patterns are stable across languages, so the checks are too.

### Slop in names

The naming policy is the highest-signal slop detector, because slop announces itself in the
name. One term list serves identifiers, file names, and prose.

| Pattern                                                  | Example                                                        | Check                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| A comparative that means a second implementation exists  | `enhancedParser`, `parserV2`, `newClient`, `legacyAuth`        | `naming/identifiers` (marketing group, digits ban)          |
| A hedge that means the author does not know the contract | `ensureConfig`, `maybeUser`, `loadIfNeeded`, `tryConnect`      | `naming/identifiers` (defensive group)                      |
| A container with no owner                                | `utils`, `helpers`, `common`, `core`, `misc`, `shared`         | `naming/identifiers`, `structure/folder-names`              |
| A role word with no role                                 | `Manager`, `Handler`, `Service`, `Processor`, `Wrapper`        | `naming/identifiers` (roles group)                          |
| A conjunction, meaning two jobs                          | `validateAndSave`, `fetchOrCreate`                             | `naming/identifiers` (conjunctions group, whole-part match) |
| Test slop                                                | `testEdgeCases`, `underTest`                                   | `naming/identifiers` (test group)                           |
| A word repeated                                          | `userUserId`, `configConfig`                                   | `naming/identifiers` (duplicate-word ban)                   |
| A name too long to read                                  | five words, forty characters                                   | `naming/identifiers` (word and length ceilings)             |
| A file named like its sibling                            | `asset-card.ts`, `asset-list.ts`, `asset-row.ts` in one folder | `structure/prefix-collisions`, in every language            |

### Slop in structure

`limits.trivial_statements` defaults to 2 and accepts a positive integer. Increasing it tightens
enforcement. Report every implemented function at or below the threshold, including methods,
constructors, accessors, nested functions, anonymous functions, callbacks, and closures. Count
nested executable statements; exclude comments, blank lines, type-only declarations, and nested
function bodies. Inspect nested functions independently. Expression bodies count as one statement.
No caller-count, physical-line, forwarding, visibility, decorator, framework, or entrypoint exemption
applies. Both recommended and all enable trivial-function and trivial-file enforcement by default.
These rules are mandatory default policy, not opt-in abstraction preferences. Keep them at the
root and in every inherited scope, generated tool configuration, and standalone plugin level.
Required external APIs use narrow, reasoned suppressions. Findings never delete code or justify filler statements.

Use the existing ESLint, Tree-sitter, and PostgreSQL parsers for JavaScript/TypeScript, Python,
Swift, Bash, and SQL/PL/pgSQL. Files containing only forwarding, aliases, re-exports, or trivial
functions are findings; one substantial implementation or meaningful owned schema is sufficient.
The shared declared-parameter maximum is 7, with explicit per-language overrides. ESLint, Ruff,
SwiftLint, and SQL enforce it. Bash positional arguments are variadic, not declared parameters.

| Pattern                                                                                | Check                                                                                                     |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A function that forwards its arguments to one call                                     | `gspot/no-trivial-functions`, `structure/trivial-function`                                                |
| A file that only re-exports                                                            | `gspot/no-export-only-files`, `python/package-exports`                                                    |
| A file that only calls imports                                                         | `gspot/no-trivial-files`                                                                                  |
| A constant that renames another                                                        | `gspot/no-exported-alias-constants`, `python/package-exports`                                             |
| A folder with one file                                                                 | `structure/single-file-folder`, at the level `all`                                                        |
| A barrel that grows without bound                                                      | `gspot/max-barrel-reexports`, `python/package-exports`                                                    |
| Two identical function bodies                                                          | `sonarjs/no-identical-functions`, the duplicate-functions idea in each language, jscpd                    |
| A singleton with a getter                                                              | `python/no-singletons`                                                                                    |
| A module with a lazy `__getattr__`                                                     | `python/no-lazy-exports`                                                                                  |
| A compatibility wrapper or forwarding script                                           | `structure/bash-script-policy`, the `compat` and `forward` name ban                                       |
| A re-export kept for a renamed symbol                                                  | `gspot/no-reexports` with `allowIndex`, knip `unused exports`                                             |
| Dead code                                                                              | knip, vulture, Periphery, `structure/unused-functions`, `sonarjs/no-dead-store`                           |
| A file or function past the size limit                                                 | `[limits]` through every language's tool                                                                  |
| Deep nesting and nested callbacks                                                      | `max-nested-callbacks`, `max-depth`, SwiftLint `nesting`, Ruff `PLR1702`, shell nesting count             |
| Cognitive complexity past the limit                                                    | `sonarjs/cognitive-complexity`, Ruff `C901`, SwiftLint                                                    |
| Public declarations scattered among private ones, so a reader cannot find the contract | `structure/private-before-public`, `import-x/exports-last`: private first, public last, in every language |
| A private function without the `_` that says so (Python, Bash)                         | `structure/private-prefix`, basedpyright `reportPrivateUsage`                                             |
| Types separated from their behavioral owner                                            | Keep types, constants, and schemas with their owner; no mandatory top-level types or config bucket.       |
| A test importing a runtime module's internals, or source importing test code           | `boundaries/element-types`                                                                                |
| Environment variables read from anywhere                                               | `gspot/env-access-owner`, `structure/env-access-owner`: one configuration owner                           |
| A re-export that exists to shorten an import path                                      | `gspot/no-reexports` with `[structure] reexports = "none"`                                                |

### Slop in defensive code

| Pattern                                                                              | Check                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A condition on a value the types say is never nullish                                | `@typescript-eslint/no-unnecessary-condition`, `no-unnecessary-type-assertion`, `no-unnecessary-boolean-literal-compare` (added to the TypeScript rule set)    |
| A `try` that only rethrows or swallows                                               | `sonarjs/no-useless-catch`, `no-empty` with no `allowEmptyCatch`, Ruff `TRY203`, `BLE001`, `S110`                                                              |
| `\|\| true` in shell, `\|\| {}` fallbacks                                            | `structure/bash-safety`, `no-restricted-syntax` selector for `LogicalExpression[operator="\|\|"][right.type="ObjectExpression"][right.properties.length=0]`    |
| A default for a value that always exists                                             | `structure/bash-config-defaults`; `@typescript-eslint/no-unnecessary-condition`                                                                                |
| Optional chaining on a non-optional                                                  | `@typescript-eslint/no-unnecessary-condition`                                                                                                                  |
| A retry with no bound                                                                | naming `with_retries` ban; `no-restricted-syntax` selector for `WhileStatement[test.value=true]` without a break count (stated in the rule file, not enforced) |
| `any`, `as any`, `as never`, `!`                                                     | `no-explicit-any`, the assertion selectors, `no-non-null-assertion`                                                                                            |
| `@ts-ignore`, `@ts-expect-error` without a reason, `eslint-disable` without a reason | `ban-ts-comment` with `descriptionFormat`, `eslint-comments/require-description`, `integrity/suppressions`                                                     |

### Slop in comments and prose

| Pattern                                                                        | Check                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A comment that narrates history (`previously`, `refactored from`, `no longer`) | Vale `gspot.present-state`                                                                                                                             |
| A comment that promises the future (`will be added`, `TODO`)                   | Vale `gspot.future`; `unicorn/expiring-todo-comments`; Ruff `TD`, `FIX`; Vale `proselint.Annotations`                                                  |
| A hedge (`probably`, `should`, `may`, `if needed`)                             | Vale `gspot.modals`, `gspot.hedging`                                                                                                                   |
| A marketing word (`robust`, `seamless`, `simply`)                              | Vale `gspot.marketing`                                                                                                                                 |
| An idiom (`belt and suspenders`, `sanity check`)                               | Vale `gspot.idioms`                                                                                                                                    |
| A path in prose that goes stale                                                | Vale `gspot.file-paths`, `gspot.locations`; `docs/stale-paths`                                                                                         |
| A doc comment that restates the signature                                      | `jsdoc/no-types`, `jsdoc/require-description` with `descriptionStyle`; `python/placeholder-docstring` (a `Handle`, `Provide` or `Returns the` opening) |
| A vague shell summary (`performs`, `handles`)                                  | `structure/doc-comment` vague-word list                                                                                                                |
| Commented-out code                                                             | `sonarjs/no-commented-code`, Ruff `ERA001`                                                                                                             |
| A doc heading that describes the tree (`Project structure`)                    | Vale `gspot.heading-names`, `docs/headings`                                                                                                            |
| Decorative symbols and emoji                                                   | Vale `gspot.symbols`                                                                                                                                   |
| Em dashes and typographic dashes                                               | Vale `gspot.dashes`, shell doc style                                                                                                                   |

### Slop in tests

| Pattern                                                   | Check                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A test with no assertion                                  | `vitest/expect-expect`; Ruff `PT` family; SwiftLint `empty_xctest_method`                               |
| An assertion inside a condition                           | `vitest/no-conditional-expect`                                                                          |
| A focused or disabled test                                | `vitest/no-focused-tests`, `no-disabled-tests`; Ruff `PT`                                               |
| A test named after an edge case, a test repository folder | naming test-slop group                                                                                  |
| A non-test file beside tests                              | `gspot/tests-directory-contents`                                                                        |
| A snapshot-only test suite                                | `vitest/prefer-strict-equal` and a count of `toMatchSnapshot` through a `no-restricted-syntax` selector |
| Coverage below the threshold                              | `vitest/coverage`, `pytest/coverage` at push                                                            |

### Slop in dependencies and configuration

| Pattern                                                         | Check                                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A package added and never imported                              | knip, deptry                                                                                          |
| A version range instead of a pin                                | `dependencies/manifest-policy`                                                                        |
| A second lockfile                                               | `dependencies/manifest-policy`                                                                        |
| A package installed the day it was published                    | `dependencies/install-policy`: minimum release age of seven days in the package manager's own setting |
| No install-time security scanner where the manager supports one | `dependencies/install-policy`                                                                         |
| A binary committed outside LFS                                  | `integrity/large-files`                                                                               |
| A dependency vulnerable with no recorded reason                 | `dependencies/osv`, every ignore carries a reason                                                     |
| A license outside the allowlist                                 | `licenses/packages`                                                                                   |
| A config file with logic in it                                  | `integrity/config-purity`                                                                             |
| A scalar hoisted into a config folder for no reader             | not carried; the reference audit found the inverse check caused the hoisting                          |

## Drift

Drift is two things that are meant to agree and do not. Nobody notices drift by reading,
so every kind gets a check.

| Kind                    | Agreement                                                                                                                                           | Check                                                     | Stage                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Generated configuration | `.gspot/*` equals its render from `gspot.toml`                                                                                                      | `integrity/generated-drift` (in `gspot check`)            | commit                                                    |
| Root pointers           | each root pointer still points at `.gspot/`                                                                                                         | `integrity/generated-drift`                               | commit                                                    |
| Tool rule set           | the resolved config of every owned tool still enables every rule the configuration requires (`eslint --print-config`, `ruff check --show-settings`) | `javascript/required-rules`                               | push                                                      |
| Tool versions           | installed versions match the pins                                                                                                                   | `doctor`; `check` fails on a missing or outdated tool     | commit                                                    |
| Runtime pins            | `engines.node`, `.nvmrc`, `.node-version`, `mise` node pin, `requires-python`, `.python-version` agree                                              | `dependencies/manifest-policy`                            | commit                                                    |
| Lockfile                | manifest and lockfile agree (`--frozen-lockfile --dry-run`, `uv lock --check`)                                                                      | `dependencies/lockfile-fresh`                             | commit when a manifest or lockfile is staged; push always |
| Workspace versions      | one version per dependency across packages; paired packages aligned                                                                                 | `dependencies/syncpack`                                   | push                                                      |
| Build reproducibility   | building twice gives identical output                                                                                                               | `static-site/build-reproducible`                          | push                                                      |
| Documentation paths     | every path in Markdown, comments, and config lists exists                                                                                           | `docs/stale-paths`                                        | commit                                                    |
| Documentation links     | every relative link and anchor resolves; external links resolve at manual                                                                           | `docs/links`, `docs/links-external`                       | commit, manual                                            |
| Allowlists and ignores  | every entry matches at least one tracked file                                                                                                       | `integrity/allowlists-match`                              | commit                                                    |
| Rule files              | the installed rule files equal the assembled render                                                                                                 | `integrity/generated-drift`                               | push                                                      |
| Agent index             | the managed block in `CLAUDE.md` and `AGENTS.md` matches the installed files                                                                        | `integrity/generated-drift`                               | commit                                                    |
| Hooks                   | the gspot line is in the hook or its task, for every hook form                                                                                      | `integrity/task-policy`                                   | commit                                                    |
| Runner tasks            | the task names of `[runner] tasks` exist and call gspot                                                                                             | `integrity/task-policy`                                   | commit                                                    |
| Locale catalogs         | every locale has every key the base locale has; every key is used                                                                                   | `i18n/locales`                                            | push                                                      |
| CSS modules             | every class defined is used and every class used is defined                                                                                         | `css/usage`                                               | push                                                      |
| Type-check membership   | every governed file belongs to a type-check project                                                                                                 | `typescript/typecheck-membership`                         | commit                                                    |
| Coverage of the tree    | files no configuration claims are listed; strict mode fails on them                                                                                 | `doctor`; `[coverage] strict`                             | push                                                      |
| Suppression census      | a suppression comment names its rule, and carries a reason where `require_reasons` is on                                                            | `integrity/suppressions`                                  | commit                                                    |
| Install policy          | the package manager's release-age and scanner settings still hold; the installed tree equals the lockfile                                           | `dependencies/install-policy`                             | commit when a manifest or lockfile is staged; push        |
| Shell headers           | every executable script's header still names its runtime and description                                                                            | `structure/bash-script-header`                            | commit                                                    |
| Security allowlists     | every gitleaks baseline fingerprint, osv ignore, Semgrep rule ignore and CodeQL false positive carries a reason and names a path that exists        | `secrets/gitleaks-baseline`, `integrity/allowlists-match` | commit                                                    |

## How a new pattern enters

A pattern joins this document when a reviewer finds an instance in a real repository that no
existing check caught. The entry names the instance class, the mechanism, and the configuration. If a
maintained tool ships the rule, the mechanism is configuration. If not, the configuration manifest
records the tools searched before original code was written.

## Behavioral test assertions

Exact exit codes, diagnostic locations, preserved bytes, and contractual defaults are valid
assertions. Do not retain tests that require silent parse failure, missing-report success, or
mandatory-rule exemptions. Example verification must fail when no selected example or expected
diagnostic remains. Distinct native, installed, recovery, cancellation, and platform tests retain
their separate contracts even when setup resembles another suite.
