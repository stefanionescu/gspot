# Slop and Drift

This document decides the enforcement gspot adds beyond the reference repositories: what
machine-written slop looks like, what repository drift looks like, and the mechanism that catches
each. Every row names a check that exists in a preset.

## Slop

Slop is code, naming or prose that adds nothing. A model reaches for it when asked to improve
something it does not want to replace, to guard against a failure it cannot name, or to explain
code it did not read. The patterns are stable across languages, so the checks are too.

### Slop in names

The naming policy is the highest-signal slop detector, because slop announces itself in the
name. One term list serves identifiers, file names, and prose.

| Pattern | Example | Check |
| --- | --- | --- |
| A comparative that means a second implementation exists | `enhancedParser`, `parserV2`, `newClient`, `legacyAuth` | `naming/identifiers` (marketing group, digits ban) |
| A hedge that means the author does not know the contract | `ensureConfig`, `maybeUser`, `loadIfNeeded`, `tryConnect` | `naming/identifiers` (defensive group) |
| A container with no owner | `utils`, `helpers`, `common`, `core`, `misc`, `shared` | `naming/identifiers`, `structure/folder-names` |
| A role word with no role | `Manager`, `Handler`, `Service`, `Processor`, `Wrapper` | `naming/identifiers` (roles group) |
| A conjunction, meaning two jobs | `validateAndSave`, `fetchOrCreate` | `naming/identifiers` (conjunctions group, whole-part match) |
| Test slop | `testEdgeCases`, `fixtures/`, `underTest` | `naming/identifiers` (test group) |
| A word repeated | `userUserId`, `configConfig` | `naming/identifiers` (duplicate-word ban) |
| A name too long to read | five words, forty characters | `naming/identifiers` (word and length ceilings) |
| A file named like its sibling | `asset-card.ts`, `asset-list.ts`, `asset-row.ts` in one folder | `gspot/no-prefix-collisions`, `structure/prefix-collisions` |

### Slop in structure

| Pattern | Check |
| --- | --- |
| A function that forwards its arguments to one call | `gspot/no-call-through`, `structure/call-through` |
| A function with one or two statements that only wraps | `gspot/no-trivial-functions`, `structure/trivial-function` |
| A file that only re-exports | `gspot/no-export-only-files`, `structure/package-exports` |
| A file that only calls imports | `gspot/no-trivial-files` |
| A constant that renames another | `gspot/no-exported-alias-constants`, `structure/package-exports` |
| A folder with one file | `gspot/no-single-file-folders`, `structure/single-file-folder` |
| A barrel that grows without bound | `gspot/max-barrel-reexports`, `structure/package-exports` |
| Two identical function bodies | `sonarjs/no-identical-functions`, `structure/duplicate-functions`, jscpd |
| A singleton with a getter | `structure/no-singletons` |
| A module with a lazy `__getattr__` | `structure/no-lazy-exports` |
| A compatibility wrapper or forwarding script | `structure/shell-script-policy`, the `compat` and `forward` name ban |
| A re-export kept for a renamed symbol | `gspot/no-reexports-outside-index`, knip `unused exports` |
| Dead code | knip, vulture, Periphery, `structure/unused-functions`, `sonarjs/no-dead-store` |
| A file or function past the size limit | `[limits]` through every language's tool |
| Deep nesting and nested callbacks | `max-nested-callbacks`, `max-depth`, SwiftLint `nesting`, Ruff `PLR1702`, shell nesting count |
| Cognitive complexity past the limit | `sonarjs/cognitive-complexity`, Ruff `C901`, SwiftLint |
| Public declarations scattered among private ones, so a reader cannot find the contract | `structure/private-before-public`, `import-x/exports-last`: private first, public last, in every language |
| A private function without the `_` that says so (Python, Bash) | `structure/private-prefix`, basedpyright `reportPrivateUsage` |
| A type declared beside the value it describes, so the contract lives in forty files | `gspot/types-placement`: type aliases under the `types/` directory, type-only imports, no runtime exports there |
| A test importing a runtime module's internals, or source importing test code | `gspot/import-direction` |
| Environment variables read from anywhere | `gspot/env-access-owner`, `structure/env-access-owner`: one configuration owner |
| A re-export that exists to shorten an import path | `gspot/no-reexports` with `[structure] reexports = "none"` |

### Slop in defensive code

| Pattern | Check |
| --- | --- |
| A condition on a value the types say is never nullish | `@typescript-eslint/no-unnecessary-condition`, `no-unnecessary-type-assertion`, `no-unnecessary-boolean-literal-compare` (added to the TypeScript rule set) |
| A `try` that only rethrows or swallows | `sonarjs/no-useless-catch`, `no-empty` with no `allowEmptyCatch`, Ruff `TRY203`, `BLE001`, `S110` |
| `|| true` in shell, `|| {}` fallbacks | `structure/shell-safety`, `no-restricted-syntax` selector for `LogicalExpression[operator="||"][right.type="ObjectExpression"][right.properties.length=0]` |
| A default for a value that always exists | `structure/shell-config-defaults`; `@typescript-eslint/no-unnecessary-condition` |
| Optional chaining on a non-optional | `@typescript-eslint/no-unnecessary-condition` |
| A retry with no bound | naming `with_retries` ban; `no-restricted-syntax` selector for `WhileStatement[test.value=true]` without a break count (unenforced, stated in the rule file) |
| `any`, `as any`, `as never`, `!` | `no-explicit-any`, the assertion selectors, `no-non-null-assertion` |
| `@ts-ignore`, `@ts-expect-error` without a reason, `eslint-disable` without a reason | `ban-ts-comment` with `descriptionFormat`, `eslint-comments/require-description`, `integrity/suppressions` |

### Slop in comments and prose

| Pattern | Check |
| --- | --- |
| A comment that narrates history (`previously`, `refactored from`, `no longer`) | Vale `gspot.present-state` |
| A comment that promises the future (`will be added`, `TODO`) | Vale `gspot.future`; `unicorn/expiring-todo-comments`; Ruff `TD`, `FIX`; Vale `proselint.Annotations` |
| A hedge (`probably`, `should`, `may`, `if needed`) | Vale `gspot.modals`, `gspot.hedging` |
| A marketing word (`robust`, `seamless`, `simply`) | Vale `gspot.marketing` |
| An idiom (`belt and suspenders`, `sanity check`) | Vale `gspot.idioms` |
| A path in prose that goes stale | Vale `gspot.file-paths`, `gspot.locations`; `integrity/stale-paths` |
| A doc comment that restates the signature | `jsdoc/no-types`, `jsdoc/require-description` with `descriptionStyle`; `structure/placeholder-docstring` (`Handle `, `Provide `, `Returns the`) |
| A vague shell summary (`performs`, `handles`) | `structure/doc-comment` vague-word list |
| Commented-out code | `sonarjs/no-commented-code`, Ruff `ERA001` |
| A doc heading that describes the tree (`Project structure`) | Vale `gspot.heading-names`, `integrity/docs-headings` |
| Decorative symbols and emoji | Vale `gspot.symbols` |
| Em dashes and typographic dashes | Vale `gspot.dashes`, shell doc style |

### Slop in tests

| Pattern | Check |
| --- | --- |
| A test with no assertion | `vitest/expect-expect`; Ruff `PT` family; SwiftLint `empty_xctest_method` |
| An assertion inside a condition | `vitest/no-conditional-expect` |
| A focused or disabled test | `vitest/no-focused-tests`, `no-disabled-tests`; Ruff `PT` |
| A test named after an edge case, a fixture folder | naming test-slop group |
| Non-test support code beside tests | `gspot/no-support-in-dirs` |
| A snapshot-only test suite | `vitest/prefer-strict-equal` and a baseline on `toMatchSnapshot` count through a `no-restricted-syntax` selector |
| Coverage below the threshold | `vitest/coverage`, `pytest/coverage` at push |

### Slop in dependencies and configuration

| Pattern | Check |
| --- | --- |
| A package added and never imported | knip, deptry |
| A version range instead of a pin | `integrity/manifest-policy` |
| A second lockfile | `integrity/manifest-policy` |
| A package installed the day it was published | `integrity/install-policy`: minimum release age of seven days in the package manager's own setting |
| No install-time security scanner where the manager supports one | `integrity/install-policy` |
| A binary committed outside LFS | `integrity/large-files` |
| A dependency vulnerable with no recorded reason | `dependencies/osv`, every ignore carries a reason |
| A license outside the allowlist | `licenses/npm`, `licenses/pip` |
| A config file with logic in it | `integrity/config-purity` |
| A scalar hoisted into a config folder for no reader | not carried; the reference audit found the inverse check caused the hoisting |

## Drift

Drift is two things that are meant to agree and no longer do. Nobody notices drift by reading,
so every kind gets a check.

| Kind | Agreement | Check | Stage |
| --- | --- | --- | --- |
| Generated configuration | `.gspot/*` equals its render from `gspot.toml` | `integrity/generated-drift` (`sync --check`) | commit |
| Stubs | the conventional-path stub still points at `.gspot/` | `integrity/generated-drift` | commit |
| Tool rule set | the resolved config of every owned tool still enables every rule the preset requires (`eslint --print-config`, `ruff check --show-settings`) | `integrity/required-rules` | push |
| Tool versions | installed versions match the pins | `doctor`; `check` fails on a missing or outdated tool | commit |
| Runtime pins | `engines.node`, `.nvmrc`, `.node-version`, `mise` node pin, `requires-python`, `.python-version` agree | `integrity/manifest-policy` | commit |
| Lockfile | manifest and lockfile agree (`--frozen-lockfile --dry-run`, `uv lock --check`) | `integrity/lockfile-fresh` | commit when a manifest or lockfile is staged; push always |
| Workspace versions | one version per dependency across packages; paired packages aligned | `integrity/dependency-alignment` | push |
| Generated source files | running `produced_by` changes nothing (`supabase gen types`, OpenAPI export, build output) | `integrity/generated-fresh` | push |
| Build reproducibility | building twice gives identical output | `static-site/build-reproducible` | push |
| Documentation paths | every path in Markdown, comments and config lists exists | `integrity/stale-paths` | commit |
| Documentation links | every relative link and anchor resolves; external links resolve at manual | `integrity/docs-links`, `static-site/links-external` | commit, manual |
| Allowlists and ignores | every entry matches at least one tracked file | `integrity/allowlists-resolve` | commit |
| Baselines | every baseline names a rule that exists; no count rose | `integrity/baselines-current`, the baseline verdict | commit |
| Rule files | the installed rule files equal the assembled render; every statement's `enforced-by` names a check that exists | `sync --check` | push |
| Agent index | the managed block in `CLAUDE.md` and `AGENTS.md` matches the installed files | `sync --check` | commit |
| Hooks | the three hook files exist and call gspot; `core.hooksPath` points at them | `integrity/task-policy` | commit |
| Runner tasks | the required tasks exist in the runner surface | `integrity/task-policy` | commit |
| Locale catalogs | every locale has every key the base locale has; every key is used | `integrity/locales` | push |
| CSS modules | every class defined is used and every class used is defined | `integrity/css-usage` | push |
| Type-check membership | every governed file belongs to a type-check project | `integrity/typecheck-membership` | commit |
| Coverage of the tree | files no preset claims are listed; strict mode fails on them | `doctor`; `coverage/unchecked` | push |
| Suppression census | the count per form never rises without a baseline update | `integrity/suppressions` | commit |
| Install policy | the package manager's release-age and scanner settings still hold; the installed tree equals the lockfile | `integrity/install-policy` | commit when a manifest or lockfile is staged; push |
| Shell headers | every executable script's header still names its runtime and description | `structure/shell-interpreter` | commit |
| Security allowlists | every gitleaks baseline fingerprint, osv ignore, Semgrep rule ignore and CodeQL false positive carries a reason and names a path that exists | `integrity/gitleaks-baseline`, `integrity/allowlists-resolve` | commit |

## How a new pattern enters

A pattern joins this document when a reviewer finds an instance in a real repository that no
existing check caught. The entry names the instance class, the mechanism, and the preset. If a
maintained tool ships the rule, the mechanism is configuration. If not, the preset manifest
records the tools searched before original code was written.
