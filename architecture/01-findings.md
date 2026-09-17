# Findings From the Reference Repositories

The reference trees were read. Everything below is evidence, followed by the design rule it produces. The
design rules are the contract the rest of this folder keeps.

## The trees

| Repository           | Shape                                          | Languages                                       | Lint package                        | Rule corpus                                                   | Runner                            |
| -------------------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| `yap-swift-app`      | Monorepo: `api`, `supabase`, `ios`, `quality`  | TypeScript, Swift, SQL, Bash, Dockerfile, nginx | `quality/`, 159 files, 13,451 lines | `rules/`, 11 files, 13,940 lines                              | mise, 102 tasks                   |
| `slopshop`           | Single Next.js app plus `quality` workspace    | TypeScript, TSX, CSS, Bash                      | `quality/`, 79 files                | `rules/general/` plus `rules/nextjs/`, 15 files, 10,542 lines | mise, 28 tasks                    |
| `yap-text-inference` | Single Python service plus `quality` workspace | Python, Bash, Dockerfile                        | `quality/`, 139 files, Python       | `rules/`, 7 files, 13,721 lines                               | mise, 35 tasks                    |
| `yap-landing`        | Single static site, plus `quality` workspace   | JavaScript, HTML, CSS, Bash                     | `quality/`, 118 files               | `rules/`, 5 files, 3,337 lines                                | mise, 15 tasks                    |
| `megalinter`         | Aggregator, read for architecture only         | Python engine, 136 linters, 57 descriptors      | none                                | `.claude/rules/`, 6 files, plus 4 agent plugin targets        | Docker, GitHub Action, npm runner |
| `gspot`              | Empty git repository                           | none                                            | none                                | none                                                          | none                              |

**All four working repositories converge on the same shape without sharing code**: a `quality/`
workspace member, a `rules/` Markdown corpus, `mise` for tools and tasks, git hooks through
`core.hooksPath`, `bun` as the package manager, a `.qlty/` directory, and `typos`, `prettier`,
`markdownlint-cli2`, `shellcheck`, `shfmt`, `gitleaks` and `osv-scanner` at the same pinned
versions. Four independent arrivals at one architecture is the product.

They also converge on the same defects, which is what the design attacks. The clearest measure: the
eighteen structural rules exist in four separate implementations, the naming policy in three, and
`BASH.md` in four copies ranging from 2,143 to 2,559 lines.

## What to steal

| Asset                                               | Where it lives now                                                                                                                                             | Why it survives                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The eighteen structural rules                       | `yap-swift-app/quality/eslint/local/`, reimplemented in `slopshop/quality/shared/eslint/plugin/rules/` and again in `yap-text-inference/quality/python/rules/` | Three independent reimplementations of the same rule set is the strongest possible signal that no maintained tool ships it. See [12-structure-and-naming.md](12-structure-and-naming.md).                                                                                     |
| The naming policy                                   | `yap-swift-app/quality/naming/policy.json`, 290 lines, 94 banned terms, 5 language sections                                                                    | One data file replaces what would otherwise be four configuration formats with the banned list duplicated four times. Reduced to 825 lines of rules in `yap-text-inference`.                                                                                                  |
| The Vale plan                                       | `yap-swift-app/LINTING.md`, section "Prose linting with Vale"                                                                                                  | Every tool fact in it was verified against Vale 3.21.0, including the grammar-mapping tricks for shell and SQL. Adopted nearly whole. See [11-prose.md](11-prose.md).                                                                                                         |
| The rule corpus split                               | `slopshop/rules/general/` plus `slopshop/rules/nextjs/`                                                                                                        | The only one of the three that separates language rules from framework rules. Generalised into four layers.                                                                                                                                                                   |
| The per-library rule file                           | `slopshop/rules/nextjs/{DRIZZLE,TRPC,ZUSTAND,TANSTACKQUERY,ZOD,REACTHOOKFORM,INTERNATIONALIZATION}.md`                                                         | A rule file per library, selected by what the project depends on, is exactly the preset model applied to rules.                                                                                                                                                                 |
| The generated instruction table                     | `slopshop/CLAUDE.md`                                                                                                                                           | A table mapping area to rule file. Making that table generated, rather than hand-maintained, removes a whole class of drift.                                                                                                                                                  |
| The Python tool set                                 | `yap-text-inference/pyproject.toml`                                                                                                                            | Ruff with 58 selected families, basedpyright strict, `import-linter` with 9 contracts, deptry, vulture, interrogate at 100, pydoclint, bandit, pip-audit, pyproject-fmt, validate-pyproject. Mature, complete, and nothing bespoke needs to exist beside it except structure. |
| The `import-linter` contract model                  | `yap-text-inference/pyproject.toml`, `[[tool.importlinter.contracts]]`                                                                                         | Declarative forbidden-import contracts are the right shape for boundaries in every language. `eslint-plugin-boundaries` is the TypeScript equivalent already in use.                                                                                                          |
| Hook stage selection from staged paths              | `slopshop/quality/workspace/hooks/stage.mjs`                                                                                                                   | One dispatcher decides what runs from the staged set, instead of a hook script with a block per project.                                                                                                                                                                      |
| The allowlist entry shape                           | `yap-text-inference/quality/config/repository/functions.json`: `{path, names, reason}` per entry                                                               | Every exemption already carries a path, a symbol list and a written reason. That is the `structure.add.entry_points` setting in [06-settings.md](06-settings.md), arrived at independently, and it is the format the settings schema adopts.                                     |
| A baseline with stale-entry detection               | `yap-landing/quality/repository/complexity/run.sh` plus `.whitelizard`                                                                                         | The runner fails when a baseline entry names a path that no longer exists. A baseline and an orphan assertion in one hand-written script, in the smallest repository. Adopted as the baseline in [09-gates.md](09-gates.md).                                                  |
| Shell branch, nesting and mutable-assignment limits | `yap-text-inference/quality/config/shell.py`                                                                                                                   | Three limits for a language with no complexity tool, and the only place any reference repository measures Bash complexity. Reproduced by an ast-grep rule plus the shared counter.                                                                                            |

## What to kill

Each row is a defect read out of the tree. The design rule is binding.

### Coverage lies

| Evidence                                                                                                                                                                                                                                                      | Design rule                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/.sqlfluffignore:9` contains `sql/`, which in gitignore semantics also matches `tests/suites/sql/` and `src/remote/teardown/sql/`. sqlfluff lints 25 of 83 SQL files. The pre-commit command names three paths and two of them are silently ignored. | **Claims are reported by the tool, never asserted.** A preset states which files it claims by asking the tool which files it would process, and the coverage check compares that answer against the tracked file list. See [05-coverage.md](05-coverage.md). |
| Nine `.pgsql` helper files match no sqlfluff pattern because `sql_file_exts` is not overridden.                                                                                                                                                               | **Extension ownership is a total function.** Every extension present in the tree maps to exactly one owning preset, or to a declared status. An unmapped extension fails the coverage check.                                                          |
| `quality/security/codeql/api-false-positives.json` is never read, because `sarif-filter.sh:11` looks for `false-positives.json`.                                                                                                                              | **Every configuration file gspot writes is read back and asserted.** A config artifact with no reader fails the coverage check as an orphan.                                                                                                        |
| 39 Semgrep rules, a pinned binary, a runner, a retry wrapper and an environment file exist, and nothing invokes the binary.                                                                                                                                   | **A check exists only when a task runs it.** The task graph is the single source of what runs; a rule file reachable from no task is an orphan and fails.                                                                                           |
| `dotenv-linter` is configured through a qlty formatter driver, and the gate passes `--no-formatters`.                                                                                                                                                         | Same rule. Orphan detection covers plugin entries.                                                                                                                                                                                                  |
| `quality/functions/swift.js` is dead: `functions/index.js` returns an empty list for Swift.                                                                                                                                                                   | Same rule, applied to gspot's own tree by self-hosting. See [03-repo-layout.md](03-repo-layout.md).                                                                                                                                                 |

### Checks that pass without checking

| Evidence                                                                                                                                                                               | Design rule                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality/nginx/lint.js:75-78` and `quality/security/trivy/run.sh:33-40` print a warning and exit zero when the Docker daemon is down. Both did so during the audit run, in both hooks. | **Skipped is not passed.** Every check returns `ran`, `skipped(reason)` or `failed`. A `skipped` result fails the gate unless a exception with an owner covers it. See [09-gates.md](09-gates.md).                                                             |
| `qlty smells --all` reports 119 findings and exits zero, while `[smells] mode = "block"` is set.                                                                                       | **A gate is a gate only when its exit code is asserted.** Each check declares how failure is detected: exit code, parsed output, or finding count against a baseline. Checks whose exit code does not reflect findings get an output parser, not a comment. |
| `vitest/expect-expect` is off, so a test with no assertion passes.                                                                                                                     | **Adoption uses a baseline, not `off`.** A rule with a known backlog lands with a baseline count that can only decrease, and an expiry.                                                                                                                     |
| Coverage thresholds of 80 percent run only under `RUN_COVERAGE=1`, and there is no CI to set it.                                                                                       | **A threshold with no gate is a comment.** Thresholds belong to a task in the graph or they get deleted.                                                                                                                                                    |
| `lint:justify` accepts any token as a ticket: eight suppressions cite `linting-config`, twelve say `N/A`.                                                                              | **Suppression metadata is validated or removed.** A exception carries a reason, an owner and an expiry, all three validated. See [06-settings.md](06-settings.md).                                                                                             |

### Silent analysis failure

| Evidence                                                                                                                                                                                                                                                                                                               | Design rule                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tree-sitter-bash` emits an `ERROR` node on `"${hostname%%\]*}"` at `supabase/src/remote/lib/env/database.sh:47`. Neither `quality/shell/parsers.mjs` nor the naming extractor checks for error nodes, so four functions after that line vanish from three checks. `master` found them; the branch finds none of them. | **A parse error is a lint failure.** Every parser consumer rejects a tree containing an `ERROR` or `MISSING` node, names the file and byte offset, and exits nonzero. See [12-structure-and-naming.md](12-structure-and-naming.md). |
| The shell grammar rewrite found 1,336 names against 916 and corrected two wrongly merged function pairs, and lost one file.                                                                                                                                                                                            | **A parser swap is verified by superset diff.** Old and new extractors run over the tree, and the new record set must be a superset. Adopted as a release gate for the structure engine.                                            |

### Policy in the wrong place

| Evidence                                                                                                                                                                                                                                   | Design rule                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality/config/nginx.js` restates `nginx:1.29.3-alpine` from `api/docker-compose.yml:81` and `api:127.0.0.1` from `api/nginx.conf:64`.                                                                                                    | **A preset reads product facts from product files.** No preset file restates a value that a product file owns. Where a fact is needed, the preset parses the owning file.                |
| `YAP_TRIVY_IMAGE` and three siblings live in `api/scripts/config.sh`, read by `quality/security/trivy/container-settings.sh`.                                                                                                              | Same rule, inverted direction. Scanner parameters belong to the scanner preset.                                                                                                      |
| `NODE_VERSION` in `quality/config/repository.js` restates `engines.node` from five manifests, while `mise.toml` pins 22.13.1 and `.nvmrc` says 20.                                                                                         | **One source per fact, and the source is the conventional file.** The runtime version comes from the runner pin; `engines` is derived from it, and `.nvmrc` is emitted or deleted. |
| About sixty string constants such as `CODEQL_SWIFT_LANGUAGE='swift'` exist in `quality/config/security/*.sh` only to satisfy a check that forces scalar-only modules into `config/`. Three are declared twice, in shell and in JavaScript. | **No check forces code to move.** `checkStrayConfigFiles` is not ported. The forward rule (files under a config directory contain no logic) is ported.                             |
| `PACKAGE_JSON_LINT_MESSAGES` is a table of error strings in a config module.                                                                                                                                                               | Messages are not configuration. Diagnostics carry their text at the site.                                                                                                          |

### Structural problems of the lint package itself

| Evidence                                                                                                                                                                                                                                                                                                                         | Design rule                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality/eslint/policy.mjs` lints the lint package with `eslint:recommended` plus six local rules: no sonarjs, no unicorn, no security, no jsdoc, no `max-lines`, no complexity limit, no `reportUnusedDisableDirectives`. The `qlty.toml` comment claiming otherwise is false for `quality/`.                                   | **gspot lints itself with the presets it ships.** Self-hosting is a release gate, not an aspiration.                                                 |
| `quality/` imports 17 npm packages and declares 2. Fifteen resolve through hoisting from the root and from three product manifests, each of which carries 10 to 12 lint plugins it never imports. `syncpack` exists largely to keep those copies equal, and every `knip.json` lists the same plugins under `ignoreDependencies`. | **The distribution declares every lint dependency once.** A consumer declares `gspot` and nothing else. No product manifest carries a lint plugin. |
| `api/eslint.config.js` and `supabase/eslint.config.js` are one-line re-exports of files under `quality/`, which is the exact file shape `local/no-trivial-files` bans everywhere else.                                                                                                                                           | **Stub configs are generated artifacts, marked as such, and exempt by construction.** See [07-config-generation.md](07-config-generation.md).      |
| `api/Dockerfile:14` copies `quality/package.json` because the lint package is a workspace member and `bun install` wants every manifest.                                                                                                                                                                                         | **The lint distribution is a dependency, not a workspace member.** A production build context never needs it.                                      |
| `--scope` parsing and prefix matching exist three times: `quality/shell/scope.js`, `quality/naming/policy.js`, `quality/functions/index.js`.                                                                                                                                                                                     | **Scope is one concept with one implementation.** The project map lives in `gspot.toml` and nowhere else.                                          |
| The project map is spread over `config/shell.js`, `config/sql.js`, `config/naming.js`, `config/repository.js` and `config/eslint.js`.                                                                                                                                                                                            | Same rule.                                                                                                                                         |
| Eight globs under `shared/`, `workspace/` and `projects/` in `config/eslint.js` point at folders that a refactor deleted; the exemptions they define never fire. `.prettierignore`, `.gitignore`, `ios/.swiftlint.yml`, two `knip.json` files and `README.md` all carry stale paths.                                             | **Every path in generated configuration is asserted to exist.** A glob matching nothing fails, unless declared as forward-looking.                 |
| `policy` names four different things across the tree: flat configs, constant tables, a loader, and rule wiring. Six `index.js`, six `run.sh`, three `environment.sh`. Seven `.mjs` among 114 `.js` in a `"type": "module"` package.                                                                                              | **Naming of gspot's own modules follows the naming preset it ships.** Enforced by self-hosting.                                                      |

### Bypass and gating

| Evidence                                                                                                                                                                                                               | Design rule                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sixteen `SKIP_*` environment variables disable individual steps; `SKIP_SECURITY_SCANS` disables four scanners at once; `--no-verify` disables everything. There is no CI, so the two hooks are the only gate anywhere. | **Skips are opt-in per repository and recorded.** Tracked configuration decides whether skips are allowed at all; every skip prints and lands in the run report. |
| Pre-commit lints a project only when a file under its prefix is staged, so editing `quality/eslint/api/*` never re-lints `api/` until push.                                                                            | **Scope invalidation follows policy inputs, not only sources.** A change to a policy file invalidates every scope that policy governs.                           |
| Squawk runs in pre-push only, so an unsafe migration is committed before it is checked.                                                                                                                                | **Stage follows from what a check requires, not from habit.** A check that needs no build runs at pre-commit.                                                        |
| `ios:lint` runs in no hook, although `swiftlint lint --strict` needs no build.                                                                                                                                         | Same rule.                                                                                                                                                       |
| markdownlint runs twice per push.                                                                                                                                                                                      | **The task graph is a graph.** A check runs once per takes, deduplicated by node identity.                                                                  |

### Product logic changed by a quality branch

Sixteen already-applied migrations gained `SET lock_timeout` and `SET statement_timeout` statements
to satisfy two Squawk rules, against the repository's own immutability rule. Five runtime
dependencies were bumped to clear scanner findings. One edge-function error type lost its literal
types during a type relocation.

**Design rule:** a check that cannot pass without editing immutable or runtime files declares that,
and gspot scopes it. Migration safety rules apply to migrations added after a recorded baseline
version, which Squawk supports through `--exclude-path`. Scanner findings that need a runtime bump
produce an exception with a reason, not an automatic edit.

### The blind spots, as a coverage target

`LINTING.md` lists eleven classes of file that no check touches. They are the acceptance test for
the coverage check:

1. iOS has no static analysis, no SAST and no dependency scan in any hook.
1. Four `.xcconfig`, four `.entitlements`, three `.xcstrings`, two `.plist`, one storyboard,
   `project.pbxproj`, the schemes and the test plan are checked by nothing. `pbxproj` is excluded
   from `typos`.
1. No TOML or YAML linter. Nine TOML files including `mise.toml` and `supabase/config.toml` get
   editorconfig and typos only. `api/deploy/*.yml` has no `ansible-lint` although `ansible-core` is
   pinned. `api/docker-compose.yml` is validated by nothing.
1. 129 shell files under `.mise/tasks/`, `.githooks/` and `quality/` get ShellCheck and shfmt but
   not the project rules: no doc-comment requirement, no unused-function detection, no file length,
   no disable justification.
1. 982 PNG, 112 JPG, 79 WAV and the other binaries are seen by secret scanners only. 28
   `Assets.xcassets/**/Contents.json` files are excluded from Prettier, qlty and typos.
1. `supabase/functions/config` and `functions/shared` are linted only transitively, and only in
   pre-push.
1. Prose rules are unenforced. The em dash ban has 64 violations in `LINTING.md` itself and 240 in
   one migration. lychee is offline, so no external link has ever been verified.
1. Coverage thresholds gate nothing.
1. Pre-commit skips a project when none of its files are staged.
1. Squawk is pre-push only.
1. The license check supports `ios` but pre-push calls only `api` and `supabase`; `quality/` and the
   root manifest are not selectable.

Every one of these is closed by a preset check or declared.

## What to reject

Not defects: **patterns that work as designed, pass their own gate, and are still the wrong thing to
do.** A defect is a bug; these are decisions.

### Do not report what nobody can fix

One principle covers four of the patterns below.

> **A check whose findings nobody may act on is noise.** It costs a run, it fills a report, it
> trains people to skim, and it cannot change the code.

A finding is actionable when the person reading it may edit the file it names. If the file is
regenerated, forbidden to edit, or not in the repository, the finding points at the wrong place. The
fix belongs at the source, and the check belongs there too.

Four file classes fail the test: build artifacts, generated files, frozen files and vendored code.
For each there is a real check to run instead, and it is never "lint it anyway".

### R-01 Linting build artifacts

**The pattern.** `yap-landing/.mise/tasks/lint/code` runs:

```text
bunx html-validate --config quality/config/html/templates.json "404.html" "pages/*/template.html"
bunx html-validate --config quality/config/html/generated.json  "dist/**/*.html"
```

The second line lints built output. `dist/` is not tracked: `git ls-files dist` returns nothing.

**The evidence that it is wrong is in its own config.** Compare the two files:

| Rule                          | source (`templates.json`) | artifact (`generated.json`) |
| ----------------------------- | ------------------------- | --------------------------- |
| `doctype-style`               | error, lowercase          | **off**                     |
| `element-required-attributes` | error                     | **off**                     |
| `no-inline-style`             | error                     | **off**                     |
| `no-raw-characters`           | error                     | **off**                     |
| `void-style`                  | error, selfclosing        | **off**                     |
| `no-autoplay`                 | off                       | off                         |
| `wcag/h37`                    | error                     | error                       |

Five rules are disabled so that the minified output passes. What remains is `wcag/h37`, which the
source check already enforces. **The artifact check is strictly weaker than the source check and can
find nothing the source check cannot.** It costs a build, a second configuration file and five
disabled rules, and its entire yield is zero.

**The general signal.** A check that needs rules disabled to pass is telling you it should not run.
The disabled list is the measurement of how badly the check fits its target.

**Why it happens.** It looks like more coverage. Two configs and two invocations read as
thoroughness. The coverage check makes the illusion visible, because `dist/` is not in the tracked
file list at all, so linting it adds numbers to a report that correspond to no tracked file.

**What gspot does instead.** Lint source. Assert invariants on output. These are different
kinds with different names, and the second one is not linting:

| Output invariant                                                                          | Tool                 | Why it is output-only                                 |
| ----------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| Bundle size within limit                                                                  | `size-limit`         | A property of bytes delivered, unmeasurable at source |
| Performance limit: Largest Contentful Paint, Cumulative Layout Shift, Total Blocking Time | `lighthouse-ci`      | Needs a rendered page                                 |
| Every link resolves                                                                       | `linkinator`         | Routing exists only after the build                   |
| No unused CSS                                                                             | `purgecss`           | Exact usage resolution needs built markup             |
| Build is reproducible                                                                     | two builds, compared | Definitionally output-only                            |
| No source map, no `.env` value, no debug flag in production output                        | preset check           | The leak happens during the build                     |
| Accessibility beyond static rules: contrast, focus order                                  | `pa11y`              | Needs a rendered page                                 |

Seven checks on output, none of them a linter, all of them reporting something the source cannot
show. `html-validate` is not on the list, because HTML conformance is a property of the template and
the data.

**What the preset ships.** One HTML required inspections, over source only. There is no artifact required inspections, because
there is no artifact rule set worth having.

### R-02 Formatting and style-checking generated files

**The pattern.** A tracked generated file is put through the normal lint path, usually with a long
exclusion list to stop the noise. `yap-swift-app` excludes `api/types/supabase.ts`,
`supabase/types/database.ts` and `supabase/types/deno.d.ts` from qlty, from Prettier and from
ESLint, and excludes 28 `Assets.xcassets/**/Contents.json` files from Prettier, qlty and `typos`.

**Why the exclusions are the right instinct and the wrong mechanism.** The instinct is correct:
there is nothing to say about the formatting of a file a generator writes. The mechanism is wrong,
because an exclusion in four tool configs is four places to go stale, and it reports nothing when
the generator changes.

**The principle.** A generated file has exactly one editable source: its generator. So a finding
about its content belongs to the generator, and the only useful assertions about the file itself are
these:

| Assertion                                                                     | Why                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Freshness.** Run the generator; the output matches the committed bytes.     | This is the only check that can fail for a real reason, and no reference repository performs it. A migration landing without a type regeneration passes everything today. |
| **Determinism.** Running the generator twice produces identical bytes.        | A generator with unstable output dirties the tree on every run and makes freshness unusable.                                                                              |
| **Secrets.**                                                                  | A generator that embeds a credential is a real incident, and this check needs no edit to the file to be worth running.                                                    |
| **Declared producer.** The `[[declare]]` entry names the task that writes it. | An orphan generated file is a file nobody can regenerate.                                                                                                                 |

**The required inspections.** A generated file carries three inspections and no others:

```text
generated   secrets freshness determinism
```

No `format`, no `style`, no `naming`, no `prose`, no `types`. If a generated file fails a type
check, the generator emits invalid code and the finding belongs to the generator's own test suite,
not to a lint run over its output.

### R-03 Style-checking frozen files

**The pattern.** `yap-swift-app` runs `sqlfluff` over all 25 applied migrations for style and
formatting, while its own rules declare applied migrations immutable.

**The contradiction.** A style finding on a file you are forbidden to edit is unactionable by
construction. The reference branch resolved the tension in the worst available direction: it
**edited sixteen applied migrations** to satisfy two Squawk rules, breaking immutability and leaving
the remote having executed different text from what a fresh environment will execute.

That is the rule against unfixable findings collecting its debt. An unactionable finding does not
stay ignored; it eventually gets "fixed", and the fix is worse than the finding.

**What gspot does.** A frozen file is declared frozen, with the baseline version that froze it, and
its required inspections is:

```text
frozen   secrets immutability
```

`immutability` asserts the bytes match the commit that froze them. Everything else is off, because
everything else would demand an edit.

New migrations get the full gate: format, style, naming, structure, prose and safety. The boundary
is a recorded version, and moving it is a visible commit.

**Consequence for the design.** [13-language-presets/sql.md](13-language-presets/sql.md) gives a frozen
migration `secrets` and `immutability` only. The tempting argument, that style and format "need no
edit to pass", is circular: they need no edit only if they already pass, and if they already pass
the check is theatre.

### R-04 Silencing a tool to accommodate a structure you chose

**The pattern.** Every `knip.json` in `yap-swift-app` lists the same lint plugins under
`ignoreDependencies`, so that knip stops reporting them as unused. They are genuinely unused by that
package: they are declared in three product manifests and imported only by `quality/`, which
declares 2 of the 17 packages it imports.

So the sequence is: choose a structure where dependencies are declared in the wrong package, watch
the tool correctly report it, then configure the tool to stop reporting it, in three files.

**The principle.** A tool reporting a true fact you find inconvenient is a tool working. The
configuration that silences it is a record of a structural decision nobody wanted to make.

**Related instances in the reference set.** `syncpack` exists largely to keep three copies of the
same plugin list equal. The stray-config check in `quality/integrity/architecture.js` forces any
scalar-only module into `config/`, which is what produced sixty hoisted string constants, three of
them declared twice. A rule that makes code move is a rule that generates work.

**What gspot does.** The distribution declares every lint dependency once, a consumer declares
`gspot` and nothing else, and no product manifest carries a lint plugin. There is nothing for knip
to report, so there is nothing to silence. `syncpack` keeps its real job (one version per dependency
across a workspace) and loses its make-work job. The stray-config check is not ported, and
01-findings.md already records that decision.

**The rule.** Before adding an entry to any tool's ignore list, establish that the tool is wrong. If
the tool is right, the structure is the defect.

### R-05 Giving a tool a glob that can escape the tracked set

**The pattern.** `yap-swift-app/.markdownlint-cli2.jsonc` carries a `globs` array with nine
negations, because the glob list does not read `.gitignore` and was matching untracked package
READMEs on disk. The negation list grows with every new untracked directory somebody happens to
have.

**The principle.** A check's input set is the tracked tree, always. A tool with its own glob
resolver will eventually see something git does not track, and the fix is never another negation.

**What gspot does.** The tracked file list is `git ls-files`, per [05-coverage.md](05-coverage.md),
and gspot passes tools an explicit file list rather than a glob wherever the tool supports one. The
`takes` field on each check, taken from MegaLinter's `cli_lint_mode`, records which tools
accept a list and which insist on scanning. For the ones that insist, file listing compares what the
tool processed against the tracked set, and a file outside the tracked set appearing in a tool's
output is a failure.

### R-06 Excluding tests from strictness

**The pattern.** `yap-swift-app/quality/eslint/api/policy.js` lists `config/**`, `src/**` and
`types/**` as type-aware linted and omits `tests/**`. The same repository includes tests for its
other project. `vitest/expect-expect` is off at 100 findings, so a test with no assertion passes.

**Why "exclude tests" and "treat tests identically" are both wrong.** Test code has different
failure modes, not fewer. A test file wants a longer body and literal values in fixtures. It also
wants things production code does not need: an assertion in every test, no skipped test committed,
no conditional assertion, no shared mutable state between cases.

**What gspot does.** A declared test required inspections, neither an exclusion nor a copy:

| Rule                       | Production | Test                                     | Reason                                                                         |
| -------------------------- | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `types`                    | on         | **on**                                   | The omission in the reference set is the defect this required inspections exists to prevent |
| `file_lines`               | 300        | 500                                      | A table-driven test file is legitimately long                                  |
| `function_lines`           | 60         | 100                                      | An arrange-act-assert body is longer                                           |
| `magic numbers`            | on         | **off**                                  | Fixture values are the point of the test                                       |
| `naming` banned terms      | on         | on, minus `test-slop` handled separately | `fixture` is banned in production and the `test-slop` group governs tests      |
| `assertion required`       | none       | **on**                                   | `vitest/expect-expect`, Ruff `PT`                                              |
| `no skipped test`          | none       | **on**                                   | `no-only-tests`, `vitest/no-disabled-tests`                                    |
| `no conditional assertion` | none       | **on**                                   | `vitest/no-conditional-expect`                                                 |
| `duplication`              | on         | relaxed threshold                        | Similar test bodies are often clearer than a shared helper                     |
| `doc comment required`     | on         | off                                      | The test name is the documentation                                             |

Ten rows. Four are stricter for tests than for production, three are looser, and three are the same.
That is what a required inspections looks like, and "excluded" is what a missing required inspections looks like.

### R-07 Enforcement by convention that a tool could enforce

**The pattern.** `ios/.swiftlint.yml:91` carries the comment "enforced by
`quality/workspace/naming`", pointing at a directory a refactor deleted. `rules/GENERAL.md` states a
coverage threshold of 80 percent that runs only under an environment variable nothing sets.
`README.md` describes a `quality/` layout two refactors old.

**The principle.** A comment asserting that something else enforces a rule is the weakest possible
enforcement, because nothing checks the comment. This is the same class as the unwired Semgrep rules
and the unread false-positive file, and it is more dangerous, because it reads as diligence.

**What gspot does.** Every rule statement carries an `enforced-by` annotation naming a check id,
cross-checked against the check registry, or the annotation `unenforced`. `gspot report --rules`
prints the unenforced count per file. A comment claiming enforcement without a check id fails the
rules lint.

### R-08 Product configuration inside the lint package

Already covered in 01-findings.md as a defect. It belongs here too, because it was a deliberate
choice driven by a rule: the stray-config check forced scalar-only modules into `config/`, so
`nginx/policy.js` became `config/nginx.js` and the nginx image tag ended up duplicated from
`docker-compose.yml`.

**The pattern worth naming** is broader than the instance: **a structural rule that makes code move
will move code somewhere wrong.** The forward rule (a config directory holds no logic) is safe. The
inverse rule (a scalar-only module belongs in the config directory) is not, and gspot ships the
first and not the second.

## What the reference repositories get right and nobody enforces

The inverse of this document. Rules that every reference repository states or implies, that none of
them enforces, and that gspot enforces. These are the gaps that exist for no reason rather than for
a reason.

| Rule                                          | Stated where                            | Enforced by nobody because                        | gspot                                                               |
| --------------------------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| Generated files match their generator         | implied by committing them              | no tool does it; it needs the generator run       | freshness check, `[[declare]]`                                      |
| A build is reproducible                       | implied by shipping it                  | nobody compares two builds                        | `site/build-reproducible`                                           |
| Plain JavaScript is type checked              | implied by strict TypeScript elsewhere  | `yap-landing` has no `tsconfig` at all            | `tsc --checkJs --strict`                                            |
| DOM writes are sanitised                      | implied by a security rule set          | `eslint-plugin-security` does not cover the sinks | `eslint-plugin-no-unsanitized`                                      |
| Declared browser support holds                | `browserslist` is declared              | nothing reads it                                  | `eslint-plugin-compat`, `stylelint-no-unsupported-browser-features` |
| A site sends a Content Security Policy        | four other security headers are sent    | `_headers` has no CSP entry                       | header policy check                                                 |
| Configuration files are valid                 | nine TOML files pin the whole toolchain | no TOML or YAML linter installed                  | `taplo`, `yamllint`, `v8r`                                          |
| The Xcode project references real files       | implied by it building                  | nothing reads `project.pbxproj`                   | project validation, orphan-source diff                              |
| Swift dependencies have no advisories         | implied by scanning others              | `osv-scanner` has no `Package.resolved` extractor | preset extractor plus OSV query                                       |
| Coverage meets its threshold                  | stated as 80 percent                    | behind an unset environment variable              | a check in the task graph                                           |
| Suppressions stay few                         | counted by hand in a branch audit       | nothing counts them                               | suppression limit                                                   |
| Every tracked file is checked                 | implied by the whole effort             | nothing computes it                               | the coverage check                                                  |
| Prose obeys the writing rules                 | 4,088 lines of style guide              | no prose linter installed                         | Vale, the `gspot` style                                |
| Shell files are executable and have a shebang | implied by running them                 | nothing checks                                    | `bash-exec`                                                         |
| Workflow actions are pinned                   | none                                    | no repository has CI                              | `zizmor`                                                            |
| A branch is created only on request           | nowhere                                 | it is an agent behaviour, not a file property     | `rules/general/GIT.md`, marked `unenforced`                         |

Sixteen rules. Two are unenforceable by nature and marked so. Fourteen have a tool, and the tool is
not installed.

## The test for adopting a reference pattern

Before adopting anything from a reference repository, three questions:

1. **Can the person reading a finding edit the file it names?** If not, the check belongs at the
   source of that file.
1. **Does making the check pass require disabling rules?** The disabled list measures how badly the
   check fits. Five of seven is not a fit.
1. **Is this configuration silencing a tool that is telling the truth?** If so, the structure is the
   defect and the configuration is the symptom.

Four repositories built by careful people fail question 1 in four places, question 2 in one place,
and question 3 in three places. Working is not the same as right.

The same three questions apply to gspot's own additions, which is why
[03-repo-layout.md](03-repo-layout.md) ends with a four-step review question rather than a list of
good intentions.

## What `yap-landing` teaches

The simple case, and the one that sets the floor for how little gspot can demand. A single static
site: vanilla JavaScript, HTML, CSS, Bash, no framework, no TypeScript, 15 mise tasks.

- **The shape survives contact with a small project.** One `quality/` folder, one `rules/`
  directory, the same hooks, the same tool pins. A design that only works on a monorepo would have
  shown a seam here and does not.
- **`NAMING.md` at 365 lines against 2,574 proves the corpus is additive.** The landing site's
  naming rules are the monorepo's general rules plus JavaScript and Bash. Nothing is contradicted;
  the language sections are simply absent. That is the strongest evidence for the layer model in
  [10-rules.md](10-rules.md).
- **Its banned-term list has 12 entries against 94**, and three of the twelve (`helpers`,
  `ifNeeded`, `misc`) are absent from the monorepo's list. The union is the shipped list; no single
  repository had it all.
- **Four tools no other repository uses**: `html-validate` for real HTML validation, `linkinator`
  for crawling a built site, `purgecss` for unused CSS against built output, and `svgo` for SVG
  normalisation. All four are adopted, and they are why `language:html` and `repository:static-site`
  exist as presets.
- **It has the best baseline mechanism in the reference set, and it is Lizard.**
  `quality/repository/complexity/run.sh` runs Lizard against a `.whitelizard` baseline, and
  `validate_false_positive_paths` **fails when a baseline entry names a path that no longer
  exists**. That is a baseline with stale-entry detection, built by hand, in the smallest
  repository. It independently arrives at both the baseline in [09-gates.md](09-gates.md) and the
  orphan assertion in [07-config-generation.md](07-config-generation.md), and it is the single
  strongest piece of evidence that both designs are right.
- **`madge` is declared and unused**, where `import-x/no-cycle` already covers cycles. One
  dependency, not a pattern.
- **`purgecss` and `linkinator` are already wired**, through thin wrappers
  (`quality/site/css/dead.js` imports `PurgeCSS` directly; `quality/config/links.js` sets
  `LINKS_TOOL = 'linkinator'`). Both are the right tools, wrapped in code that gspot replaces with
  configuration.
- **Semgrep is wired here.** Two invocations, one for shell and one for the site. The monorepo's 40
  unwired Semgrep rules are a monorepo defect, not a shared one, and the smallest repository got
  this right.
- **Static-site-specific checks that generalise**: `quality/site/html/policy.js`,
  `quality/config/html/generated.json`, `quality/site/css/dead.js` and
  `quality/site/links/check.mjs`. HTML policy, generated-file declaration, dead CSS and link
  checking are all preset-level concerns, and three of the four have off-the-shelf tools that the
  repository wrote around.

## What `megalinter` teaches

Read for architecture rather than for rules. Its descriptor model is the right shape and improves
the preset manifest in five ways. Its gating model is the opposite of what is wanted here.

### The descriptor model, and what it teaches

A MegaLinter descriptor is a YAML file per language or format, with a `linters` list. Each linter
entry declares fields that map almost one to one onto the `[[checks]]` block in
[04-presets.md](04-presets.md). Five of its fields are better than what the preset manifest had, and are
adopted.

| MegaLinter field                                                                                   | What it solves                                                                                                                                                                          | Adopted as                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `cli_lint_mode`: `file`, `file-list`, `project`                                                | Whether a tool takes one path, a path list, or the whole tree. This determines both the takes shape and the file listing strategy, and the preset manifest had no field for it.             | `check.takes`                                                                                                               |
| `supported_cli_lint_modes`                                                                         | Some tools support several, and the fast mode differs from the accurate mode                                                                                                            | `check.invocation_modes`                                                                                                         |
| `cli_lint_errors_count`: `regex_count`, `total_lines`, `regex_number` plus `cli_lint_errors_regex` | How to count findings when the exit code is useless. This is exactly the `fails_on = "output"` case, and MegaLinter makes it a first-class declaration with a regex.                 | `check.fails_on.count_regex`                                                                                                         |
| `common_linter_errors`: a list of `{identifier, regex, message}`                                   | When the **linter itself** fails (config parse error, plugin load failure, parser crash), match its output and print the remediation. MegaLinter ships three of these for pylint alone. | `check.tool_errors`                                                                                                            |
| `cli_config_arg_name`                                                                              | The flag that passes the config explicitly, per tool                                                                                                                                    | Already required by [07-config-generation.md](07-config-generation.md); now declared per check rather than hand-written per task |

`common_linter_errors` is the single best idea in the repository. A gate that fails because pylint
could not parse its own config is indistinguishable, at the terminal, from a gate that fails because
the code is bad. MegaLinter turns the first case into a message naming the fix. gspot adopts it, and
extends it to the class of failure that matters most here: a file listing that returns an empty set because
the tool ignored everything.

Other structural ideas taken:

- **`descriptor_flavors`.** MegaLinter bundles descriptors into flavors (`cupcake`, `python`,
  `formatters`) so a consumer pulls one image instead of all 136 linters. That is the preset-selection
  problem solved for a Docker distribution, and it confirms that selection granularity belongs at
  the language level rather than the tool level.
- **`linter_speed`.** A 1-to-5 rating per linter. gspot's `requires` field is the same idea with fewer
  values and a purpose: stage assignment.
- **Multi-agent rules targets.** MegaLinter ships `.claude/rules/`, `.claude/skills/`,
  `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/plugins/`,
  `gemini-extension.json` and `com.github.copilot/agents/`. That is the real target list for
  [10-rules.md](10-rules.md), and it settles D-36: the emitter needs more than two outputs
  eventually, and the document model has to come first.
- **Distribution surfaces.** Docker image, npm runner, GitHub Action, and a `pre-commit` hook
  definition. gspot needs the npm package and the binary; the Action is what the GitHub Actions emitter
  emits; a `pre-commit` hook definition is a cheap addition for repositories already on that
  framework.
- **`PRE_COMMANDS` and `POST_COMMANDS`** with a `cwd` and a `continue_if_failed` flag. A generic
  hook for a consumer's own steps, which is a lighter answer to the consumer checks in D-40, and
  worth having alongside them.

### The gating model, rejected

MegaLinter's own `.mega-linter.yml` is the argument against its gating model, and it is worth
quoting the shape:

```yaml
DISABLE:                  6 entries        # whole languages off
DISABLE_LINTERS:          6 entries        # individual linters off
DISABLE_ERRORS_LINTERS:   5 entries        # run, report, never fail
FILTER_REGEX_EXCLUDE:     1 regex, 9 paths # whole directories, silently
<LINTER>_FILTER_REGEX_EXCLUDE: 10 entries  # per-linter path exclusions
PRINT_ALL_FILES: false
```

Five mechanisms for removing coverage, seventeen exclusion entries, and:

- **No reason, owner or expiry on any entry.** Four of the seventeen carry a prose comment
  explaining why, which is better than the reference repositories manage, and thirteen do not.
- **`DISABLE_ERRORS_LINTERS` is a warning layer.** Five linters run and cannot fail, including
  `PYTHON_BANDIT` and `REPOSITORY_SEMGREP`. Decision D-07 rejects warning layers outright, and this
  is what one looks like in practice: the two security scanners are the ones that cannot fail.
- **`FILTER_REGEX_EXCLUDE` is the `.sqlfluffignore` hazard with a bigger reach.** One regex removes
  nine directory trees from every linter at once, and nothing reports how many files that was.
- **No coverage accounting anywhere.** `PRINT_ALL_FILES` prints the file list; it does not attribute
  files to linters, does not report which files no linter claimed, and cannot, because MegaLinter
  does not ask its linters which files they processed. This is the gap gspot exists to fill, and
  finding that a 136-linter aggregator with 27 million pulls does not close it is the strongest
  available evidence that the coverage check is the product.

Also rejected:

| MegaLinter choice                             | Why not here                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker-first execution**                    | A 4 GB image per flavor, and a pre-commit hook that shells into a container. The reference repositories run tools natively through mise in milliseconds. Docker is right for a CI aggregator and wrong for a git hook. |
| **A Python engine**                           | MegaLinter is Python because it started in a Python-friendly CI context. gspot's structural engine needs one AST layer shared with an ESLint plugin, which forces JavaScript.                                          |
| **`APPLY_FIXES: all` by default**             | A gate that rewrites the tree on every run hides what it changed. `gspot fix` is a separate command with a convergence assertion.                                                                                      |
| **67 languages**                              | Breadth over depth. gspot covers its languages completely, including the structural and naming rules that no aggregator ships, and adds a tenth only when a reference repository needs it.                            |
| **`ENABLE`/`DISABLE` as the selection model** | Two mutually exclusive mechanisms where setting one inverts the default for everything. The preset model has one direction.                                                                                              |

### Tools discovered from the 136

The descriptor list is a well-maintained tool coverage, and it surfaced the tools worth adopting
that no reference repository uses. They are carried into [20-tooling.md](20-tooling.md).

Most valuable: **ls-lint** (file and directory naming, one config, every language), **v8r** (JSON
and YAML schema validation resolved automatically from SchemaStore), **zizmor** (GitHub Actions
security), **spectral** (OpenAPI), **protolint**, **dustilock** (dependency confusion), **syft**
(SBOM), **kingfisher** and **secretlint** (secret scanning), **djlint** and **htmlhint** (HTML),
**editorconfig-checker** and **dotenv-linter** (already known from qlty, confirmed as first-class
here).

`ls-lint` deserves a note: it is a single fast binary with a `.ls-lint.yml` declaring case rules and
regexes per glob, per extension and per directory, with its own ignore list. It replaces file and
directory naming code in every language at once, and it is the clearest single win from reading this
repository. See [12-structure-and-naming.md](12-structure-and-naming.md).

### Verdict

Follow MegaLinter's **descriptor model**, its **failure-message discipline**, its **takes-mode
taxonomy** and its **tool coverage**. Reject its **gating model**, its **exclusion mechanisms**, its
**Docker-first execution** and its **breadth-over-depth** scope.

The two products are complementary rather than competing: a repository could run MegaLinter in CI
for breadth across languages gspot does not cover, and gspot as the gate for the languages it does.
Whether that is worth the double configuration is Q-13 in [19-decisions.md](19-decisions.md).

## What `slopshop` teaches

`slopshop` is the messy attempt, and the mess is informative.

- **The good part is the rule split.** `rules/general/` against `rules/nextjs/` is the only
  two-layer corpus in the three repositories, and it maps onto presets directly.
- **The bad part is the configuration sprawl.** `quality/config/` has five sibling groups
  (`application`, `hooks`, `lint`, `tooling`, `workspace`) and twelve integrity checks specific to
  one application: `css-usage.mjs`, `locales.mjs`, `translation-usage.mjs`,
  `next-configuration.mjs`, `application-files.mjs`. These are project facts wearing the clothes of
  lint policy. They belong in a the project layer local check directory, not in a distribution.
- **`CLEANUP.md` is 1,056 lines of findings that lint could have caught.** Sections 9, 10, 19, 21,
  25 and 26 (names, comments, over-engineering, callback vocabulary, defensive code, tiny files) are
  the structure engine and the naming policy applied to a codebase that had neither at the start.
  That is the argument for installing gspot at project creation rather than at cleanup time.
- **ESLint 10 and `typescript-eslint` 8.69 against ESLint 9.38 and 8.29 in `yap-swift-app`.** Two
  repositories, the same plugin set, two major versions apart. The distribution owns one matrix.

## What `yap-text-inference` teaches

- **The mature Python tools are enough for everything except structure.** Ruff with 58 families plus
  basedpyright strict plus `import-linter` covers what four of the five bespoke ESLint rule families
  cover in TypeScript.
- **The slop is the same slop.** `quality/config/security/*/environment.sh` hoists constants out of
  their only caller, exactly as in `yap-swift-app`. `quality/lib/` has seven files named
  `diagnostics`, `files`, `json_config`, `languages`, `output`, `process`, `source`, which is a
  utility bucket by another name.
- **Three typecheck configurations exist because the project has four mutually exclusive dependency
  extras** (`local`, `vllm`, `trt`, `llmcompressor`) with ten declared conflicts.
  `pyrightconfig.json` excludes ten source files outright. This is a real problem that a
  distribution must model: a Python project with variant dependency sets needs a per-variant type
  gate, and the files excluded from every variant are uncovered.
- **`jscpd` for duplication, driven from two JSON configs.** Duplication detection is
  language-agnostic and belongs in a `repository:` preset.
