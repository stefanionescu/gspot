# Assessment

An audit of what in this repository is still bloat, duplication, bespoke code, compatibility
weight, naming noise, exceptions that hide work, or documentation nobody reads. Every number was
measured on 2026-09-28 at the head of `fix/root-cause-lint-cleanup` with the commands in the
last section, so a reader can re-run them.

Each finding ends with a direction: **cut** (remove), **merge** (one implementation), **rename**,
or **decide** (a product decision comes first).

## The shape of the repository

| Area                         | Files | Lines  |
| ---------------------------- | ----- | ------ |
| `packages/cli/src`           | 479   | 47,940 |
| `packages/eslint-plugin/src` | 40    | 3,081  |
| `packages/cli/kits`          | 160   | 11,427 |
| `packages/cli/guides`        | 98    | 19,168 |
| `tests`                      | 568   | 55,856 |
| `architecture`               | 21    | 15,027 |
| `docs/src`                   | 51    | 3,811  |
| `gspot.toml`                 | 1     | 986    |

The tool ships 49 kits, 75 templates, 215 checks, 214 public settings, and 27 custom ESLint
rules. The check inventory lists 1,507 ESLint preset rules, 943 Ruff rules, and 188 SwiftLint
rules already enabled. Most of the bespoke code below sits beside a tool that already covers the
same ground.

## 1. Size and fragmentation

109 of the 479 source files are under 40 lines. `packages/cli/src/config/checks/` is 25 files
holding 995 lines of constants. `packages/cli/src/types/` is 42 files for 2,044 lines. The tree
exports 751 functions and declares about 2,500. **merge**: a file per concept, not per function.
One constants file per folder and one types file per folder.

`packages/cli/src/checks/dispatch.ts` is a hand-maintained registry with 65 import lines mapping
a check name to a function. A second registry sits in
`packages/cli/src/checks/structure/engine.ts` with 26 imports. **merge**: one registry, or each
check module registers itself under its manifest name.

Six orchestration files import more than 19 modules each:
`packages/cli/src/generation/outputs.ts` (25), `packages/cli/src/lifecycle/hooks/managers.ts`
(23), `packages/cli/src/generation/templates.ts` (23), `packages/cli/src/execution/engines.ts`
(23), `packages/cli/src/commands/init/prepare.ts` (22), and
`packages/cli/src/lifecycle/hooks/status.ts` (20). Each grew by accretion. **decide** whether
the folder split under each one earns its keep.

## 2. The same thing, several ways

### Process spawning

The product has `run`, `runBlocking`, and `runBinary` over execa in
`packages/cli/src/platform/spawn.ts`. The tests use three strategies. `Bun.spawnSync` appears in
42 files. The product `run` appears in 92. A private `runProcess` over `child_process` in
`tests/support/cli/command.ts` appears in 152, and this week it grew its own cmd.exe quoting.
**merge** the tests onto the product spawn.

### Path spelling

The source holds 37 inline `replaceAll('\\', '/')`, 98 `openRoot(...)` call sites for the
confined filesystem, 65 raw `JSON.parse`, and 65 `statSync`. **merge** into the owners that
exist, `packages/cli/src/platform/paths.ts` and `packages/cli/src/platform/root/`, so a caller
never spells a separator.

### Errors

Eleven `Error` subclasses exist: `PolicyError`, `ManifestError`, `SelectionError`,
`InstallationError`, `MissingToolError`, `ToolOutputError`, `SkippedCheckError`,
`VersionPinError`, `ProfileError`, `PromptError`, and `ExperimentalRuffError`. Beside them sit
425 bare `throw new Error(...)`. The message catalog `packages/cli/src/policy/messages.ts` (280
lines) is a third place messages live. **decide**: one error with an exit code and a message.

### Parsers and libraries

- Three TOML implementations: `smol-toml` in 26 files, `@decimalturn/toml-patch` in 7, the
  tree-sitter TOML grammar in 1. **merge** to one.
- Two JSON-with-comments parsers: `json5` in 4 files, `jsonc-parser` in 6. **merge** to one.
- Three glob and ignore libraries: `picomatch`, `globby`, `ignore`. **merge** to one.
- Two terminal output libraries: `picocolors`, `consola`. **merge** to one.

### Duplicated checks and settings

Duplication is measured twice: `duplication/jscpd` (a tool) and
`structure/duplicate-functions` with `limits.identical_functions` (bespoke). **decide** one
owner and delete the other.

Seventeen settings are declared in more than one manifest: `limits.duplication.min_lines`,
`limits.duplication.min_tokens`, `limits.duplication.threshold_percent`, `tools.ruff.select`
(three times), `tools.ruff.test_files`, `tools.ruff.test_ignores`, `tools.xcode.project`,
`tools.xcode.scheme`, `tools.xcode.destination`, `tools.openapi.document`,
`tools.openapi.produced_by`, `tools.sqlfluff.dialect`, `tools.squawk.assume_in_transaction`,
`tools.stylelint.ignore_at_rules`, `tools.eslint.import_style`, `tools.eslint.script_languages`
(three times), and `structure.single_file_folder_allowed`. **merge**: one declaring kit each.

### Hook installation

`packages/cli/src/generation/hooks/` and `packages/cli/src/lifecycle/hooks/` are 1,357 lines of
TypeScript that emit POSIX shell for four hook tools. Each tool has its own dispatcher, result
file, and environment family (`GSPOT_HUSKY_*`, `GSPOT_LEFTHOOK_*`, `GSPOT_SIMPLE_*`,
`GSPOT_PRE_COMMIT_*`, 20 variable names in all). The installed `prepare-commit-msg` hook is 66
lines. **merge**: one dispatcher script with the tool name as data, one result protocol.

## 3. Bespoke code beside a tool that does the job

### Bash analysis

Eight `structure/bash-*` checks and `packages/cli/src/checks/structure/scripts/` (697 lines)
parse Bash with tree-sitter to enforce headers, strict mode, nesting, mutable assignments, and
boundaries. The bash kit already runs ShellCheck and shfmt. **decide** which findings ShellCheck
cannot produce; cut the rest.

### Naming

`packages/cli/src/checks/naming/` (727 lines) and its `extractors/` folder (416 lines) run a
case splitter, a vocabulary policy, and length limits over every language. ESLint, Ruff,
SwiftLint, and Stylelint each ship naming rules. **decide**: keep the cross-language vocabulary
bans (111 banned terms in the inventory), and hand case, length, and prefixes to each tool.

### Structure and integrity checks

The structure kit declares 27 `structure/*` checks and the integrity family 24 `integrity/*`
checks. `file-length`, `function-length`, `trivial-function`, `private-before-public`,
`doc-comment`, `unused-functions`, and `dead-parameters` reimplement `max-lines`,
`max-lines-per-function`, `no-unused-vars`, and JSDoc rules for the languages those tools cover.
**decide** per check.

### The generated ESLint configuration

`.gspot/config/eslint.config.mjs` is 3,219 lines rendered from a 511-line template. It carries a
runtime that rebuilds eslintrc `ConfigArray` and `IgnorePattern` objects for adopted
configurations. A generated configuration holds data and imports. **cut** the runtime.

### Python environment relocation

The virtualenv folder under `packages/cli/src/repository/revisions/` (584 lines) rewrote
console scripts and interpreter links when a snapshot was copied. A Windows launcher parser
rewrote PE headers. Both were deleted in phase 2. **decided**: run Python tools
against the snapshot
from their installed location instead of moving the environment.

### Existing-configuration adoption

The adoption folder under `packages/cli/src/policy/` (14 files, 1,444 lines) was deleted in
phase 1. It, `packages/cli/src/repository/configuration/` (8 files, 522 lines), and
`packages/cli/src/native/` (10 files, 1,237 lines) read a repository's existing linter
configuration and carry it into the
generated output. The readers cover ESLint, Ruff, Stylelint, Vale, SQLFluff, typos, markdownlint,
gitleaks, and Open Source Vulnerabilities (OSV) scanner files. This is the largest single feature
by weight, and it exists for repositories that already have linters. **decide** whether init
keeps existing configuration or reports it and replaces it.

### The confined filesystem

`packages/cli/src/platform/root/` (294 lines, 98 call sites) guards every write against links
and traversal. The guard is right. The 98 call sites are the cost of having no single owner for
repository writes. **merge** under the lifecycle owner.

## 4. Compatibility weight and dead paths

- eslintrc support in the native folder (215 lines, deleted in phase 1), with `FlatCompat`,
  `legacyIgnores`, and `legacyCriteria`, exists for ESLint 8 configurations. **cut** with the
  adoption decision above.
- A stale `rules` folder under `.gspot` still exists locally after the rename to `guides`.
  `gspot apply` leaves a retired install directory in place. **fix**: apply removes directories it stops installing.
- Seven `TODO` markers remain in `packages` and `tests`. **cut** each into a task or delete it.
- `detect-libc` and the seven native `tree-sitter-*` grammar packages serve the build script
  and the npm launcher, not the CLI. Keep them, declared where they are used.
- `gspot.toml` carries `[[check]]` entries, `[check.output]` tables, and
  `tools.docs.paths_allowed` blocks that exist only so this repository can lint its own
  architecture record. **cut** with the documentation decision in section 8.

## 5. Exceptions that hide work

### Suppressions

The code carries 264 `eslint-disable` directives across `packages` and `tests`, and 221 of them
are `gspot/no-trivial-functions`. The reasons cluster. 60 say the callers sit at the complexity or
length limit. 33 say a test fixture crosses the length limit. 11 say the function builds a
template.

That is the rule fighting the layout, not 221 justified exceptions. A suppression with a reason
is still a suppression.

**decide**: either the rule stops counting a template or fixture builder as trivial, or the
callers are split so the helper can be inlined.

Other directives: 30 `nosemgrep`, 13 `# noqa`, 8 `ts-nocheck`, 6 `@ts-expect-error`, 4
`@ts-ignore`, 6 `shellcheck disable`, 4 `swiftlint:disable`. Most sit in fixtures and templates.
**review** each; `ts-nocheck` has no place anywhere.

### The policy file

`gspot.toml` is 986 lines. The exceptions in it:

- 45 `[[tools.knip.ignore_dependencies]]` entries for packages the planted test repositories
  import. **cut**: one knip entry for the planted repositories.
- 25 `[[naming.rules]]` allowances for external keys such as `check_id`, `fail_fast`, and
  `rule_id`. **merge** into one `naming.external` list.
- 14 per-file typos tables with 17 `extend-words` lists for deliberate misspellings in tests.
  **cut**: one folder for misspelled fixtures that typos ignores.
- 13 `[[tools.codeql.false_positives]]`. **review** each against the code it excuses.
- 9 `[[tools.docs.paths_allowed]]` and 7 license allowances. **cut** with section 8.

### Generated output and lint

`.gspot/**` is excluded by the generated ESLint configuration, and no linter reads a `.tmpl`
file. The repository tracks 137 files under `.gspot/`, including 30 authored Vale style files
and the installed guides. Generated output is verified by `integrity/generated-drift` instead of
being linted. That split is right only when the templates themselves are linted as code.
**decide**: lint templates as the language they render, and stop tracking generated output that
a clone regenerates.

## 6. Naming

Vague words still carry weight in the source: `context` 405 uses, `item` 131, `manager` 86,
`flag` and `flags` 166, `util` 45, `data` 44, `wrapper` 16, `handler` 9. **rename** wherever the
word names nothing the type does not already say.

`configuration` appears 589 times. Most mean a tool's configuration file, which is correct.
`configurationScopes` was renamed this week; `commandConfigurations`, `hasConfiguration`,
`proposeConfiguration`, and `configurationRequest` deserve the same read.

The 214 public settings, 139 of them under `tools.*`, spell one meaning five ways: `allow`
(`tools.gitleaks.allow`), `ignore` (`tools.osv.ignore`, `tools.semgrep.ignore`,
`tools.knip.ignore`), `exclude` (`tools.lychee.exclude`, `tools.typos.exclude`), `skip`
(`tools.linkinator.skip`), and `*_allowed` (`tools.licenses.packages_allowed`,
`tools.html.copy_allowed`). **rename** to one verb per meaning.

Kits named after products (`nextjs`, `drizzle`) sit beside kits named after roles (`files`,
`formatting`, `structure`, `integrity`, `naming`). The `general` kind is the bucket that holds
the second group. **decide** the taxonomy once and rename the kinds to match.

Twelve gspot-owned pointer files sit at the repository root: `.prettierrc.json`, `.shellcheckrc`,
`.taplo.toml`, `.yamllint.yml`, `.markdownlint-cli2.jsonc`, `.semgrepignore`, `.gitleaks.toml`,
`.commitlintrc.json`, `typos.toml`, `osv-scanner.toml`, `eslint.config.mjs`, and `.editorconfig`.
**decide**: a pointer only for a tool that cannot take a configuration path.

## 7. Tests

The tests are 55,856 lines for 47,940 lines of source. Acceptance alone is 14,447 lines in 114
files. `tests/inputs/` holds 39 files of fixture constants (1,680 lines) under a folder named
config. **rename**: the word `fixtures` is banned by the policy, so a data folder under `tests`
or a constants file beside each suite.

94 helper functions are declared inside test files, and 33 fixture builders carry
`no-trivial-functions` suppressions. `tests/support/` (59 files, 3,934 lines) already owns
`commitAll`, `gitOutput`, planted repositories, and launchers. **merge** into support.

Platform gates were added this week in about 20 files as `if (process.platform !== 'win32')` and
`if (toolShipsHere('x'))` in front of `test(`. **merge** into one `describe.if` idiom with one
helper that names the reason.

The Windows work added `keptMode`, `venvExecutable`, `plantLauncher`, and
`linkInstalledModules` to `tests/support/cli/platforms.ts`. They are right. The tests that use
them still spell the environment and package binary folders in places the helpers do not reach.

## 8. Documentation

`architecture/` is 15,027 lines. The acceptance record alone is 3,225 lines and the
remaining-work record is 1,075. Most of it is a decision log and a backlog, not
architecture. **cut**: keep the contracts a reader needs to change the code, and move the
history to git.

The guides ship 19,168 lines to every consumer. The largest are
`packages/cli/guides/general/prose/DOCS.md` (718), `packages/cli/guides/general/prose/DOCS-FORMAT.md`
(701), `packages/cli/guides/general/prose/WRITING.md` (698), `packages/cli/guides/language/BASH.md`
(680), `packages/cli/guides/library/drizzle/DRIZZLE.md` (661),
`packages/cli/guides/language/PYTHON.md` (640), and
`packages/cli/guides/framework/nextjs/NEXTJS.md` (628). An agent reads these before a task.
**cut** each to the rules a tool does not already enforce; a rule a linter reports needs no prose.

`README.md` (122 lines): the title goes (the user is removing it), and with it the "Unreleased"
paragraph, the tool logo strip, and the long "Check a JavaScript module" walk-through. Keep the
banner, one sentence, install, one short example, and links.

`AGENTS.md` is a 60-line reading list of 35 guide paths. **cut** to the five files an agent must
read; the guide lint finds the rest.

The docs site has 20 guide pages (2,005 lines). `docs/src/content/docs/guides/build.md` and
`docs/src/content/docs/guides/check-automation.md` are 224 lines each.
`docs/src/content/docs/guides/existing-repository.md` documents the adoption feature that section
3 questions. **cut** with that decision. `CONTRIBUTING.md` (63 lines) is fine.

## 9. Generation and the `.gspot` directory

33,916 files live under `.gspot/` locally (`node_modules` 150 MB, `.venv` 302 MB) beside the 137
tracked ones. The tracked set includes the 30 Vale style files, which are authored, and the
installed guides, which are copies of `packages/cli/guides`.

`gspot apply` regenerates 24 configuration targets under `.gspot/config/` and the four hooks;
`integrity/generated-drift` verifies them. The untested paths are the ones that render logic
rather than data: the ESLint runtime (section 3) and the four hook dispatchers (section 2).
**decide**: generated files hold data; logic lives in the plugin or the CLI, where it is linted
and tested.

### The mise layout

mise reads `mise.toml` and every file under `.mise/conf.d/` as one configuration, merged in file
order. gspot uses that convention to keep its generated tool pins out of the authored file.
Three files result:

- `mise.toml`, authored: runtimes and nine native tools pinned by hand, plus settings.
- `.mise/conf.d/gspot-tools.toml`, generated and read-only: 22 kit tool pins and three
  `gspot:*` tasks for an installed CLI.
- `.mise/conf.d/repo.toml`, authored: all 32 repository tasks and four source overrides of the
  generated tasks.

The repository tasks are centralized: no `package.json` has a `scripts` block, and CI calls
`mise run` alone. They landed in a file whose name says nothing, beside an authored `mise.toml`
that holds only tools. Four of the tasks are one-line wrappers over a script under
`packages/cli/scripts/` or `tests/support/`. Tool pins live in two authored places, `mise.toml`
and the kit manifests, and one generated place.

`.mise/gspot/gspot` is a 20-line Bash launcher that puts the source CLI on PATH through an
`[env]` entry. **cut** and **merge**:

- Move `.mise/conf.d/repo.toml` into `mise.toml` and delete it. One authored file.
- Drop the three `gspot:*` tasks from the generated file; `gspot check` is shorter than a
  task that runs it. The four source overrides go with them.
- One owner for tool pins: every kit tool in the generated file, or no mise pins from gspot at
  all and version checks only.
- The source launcher becomes a task, not a directory on PATH.

## 10. What holds up

Six parts hold up, and each does one thing the rest of the code can lean on:

- the policy schema (`packages/cli/src/policy/schema.ts`, 282 lines of zod)
- the kit manifest schema (`packages/cli/src/kits/schema.ts`, 287 lines)
- the check inventory as the single source of levels
- the plugin's import and placement rules
- the confined filesystem guard
- the four-platform CI matrix with its probe mode

## 11. The tests

Measured 2026-09-29 under `tests/`. Unit: 96 files, 228 tests, 6,219 lines. Integration: 245
files, 771 tests, 29,180 lines. Acceptance: 114 files, 247 tests, 14,447 lines. Support: 59
files, 3,934 lines. Constants under `tests/inputs/`: 39 files, 1,680 lines.

The 40 files the counts flagged were read in full; the rest is judged by the counts.

### What the counts got wrong, so nobody repeats it

- 874 of the lines that look like text assertions are the message idiom
  `expect(x.code, x.stdout + x.stderr).toBe(0)`. Real assertions on rendered text number 146,
  concentrated where text is the surface: `tests/acceptance/source/kits/bash/lifecycle.test.ts`
  (11), `tests/acceptance/source/cli/profile.test.ts` (10), `tests/acceptance/source/cli/explain.test.ts`
  (9). Those are fine.
- The 65 `.toBeUndefined()` assertions mean no parse error, or a removed file. They are the
  contract, not weak assertions.
- The eight tests that wait do so on marker files with deadlines, not on sleeps.

### The copied driver

63 test files repeat the same 30-line body. It plants files, installs the kit, runs the check,
and parses `.gspot/reports/report.json`. It asserts `status: 'fail'` with one finding, corrects
the file, and asserts `status: 'ok', findings: []`. 29 of them keep it under a local `CASES`
table and 38 call `runPlanted`, which does only the first half. `tests/acceptance/source/kits/platforms.test.ts`
and `supabase.test.ts` are the same file with different tables. **merge**: one
`plantedCases(fixture, cases)` owner in `tests/support/cli/planted.ts`; each kit file becomes its
table and its fixture.

### Fixtures spelled inline

- 151 distinct `gspot.toml` literals inline in test files; `version = 1\nkits = []\n` appears
  23 times, `kits = ["swift"]` 15, `kits = ["typescript"]` 9, `kits = ["bash"]` 9. **merge**
  into a `policy(kits, extra)` helper.
- The init argument list `init --yes --kits <kit> --no-runner --no-ci --no-guides --no-install`
  is spelled out 27 times in 17 files while `tests/inputs/acceptance/source/kits/init-arguments.ts`
  already exports 22 named argument lists. **merge**.
- 81 helper functions are declared inside test files, most named `plant`, `input`, or
  `expect<Thing>`. 33 fixture builders carry `no-trivial-functions` suppressions. **merge** the
  recurring shapes into `tests/support`.
- `tests/inputs/` is 39 files of fixture strings under a folder named config. **rename**: the
  policy bans `fixtures`, so a data folder under `tests`, or a constants file beside each suite.

### The same adapter contract, once per adapter

The mocked-spawn tests in `tests/integration/cli/checks/` are good tests. They drive an adapter
with fabricated tool output and assert isolation, cleanup, refusal, and parsing. What repeats is
the failure table. `jest-execution.test.ts` lists 12 failure modes, `copied-blocks.test.ts` 6,
`lockfile-fresh.test.ts` 6, `licenses.test.ts` 5 plus 4, and `site-build.test.ts` 3 reports
times 4 inputs. Each carries its own copy of the same contract: reject fatal, absent, and
malformed output, remove the temporary directory, accept a corrected report.

**merge** into one adapter-contract test driven by a table of adapters. Per-adapter tests keep
only the branches that adapter has. `drizzle-migrations.test.ts` then repeats its own adapter
test through the CLI; **cut** the CLI copy.

### Layers that overlap

- Nine of the mocked checks are also exercised for real in acceptance: `nextjs/build` (3
  files), `svelte/check` (2), `security/codeql` (2), `swift/build` (2), `jest/coverage`,
  `static-site/build`, `duplication/jscpd`, `licenses/packages`, `integrity/lockfile-fresh`.
  Both layers earn their keep only where the acceptance case asserts the tool's real output.
  **cut** the acceptance case that repeats the adapter test's outcome.
- `tests/acceptance/release/` (9 files, 1,182 lines) runs check journeys through the built
  binary and installed packages.
- Its `languages.test.ts` (278 lines, 4 tests) and `tools.test.ts` (254 lines, 5 tests) repeat
  kit journeys the source acceptance already runs. **cut** them to one test per tool family
  that proves the installed binary runs.
- Keep `binary`, `launcher`, `packages`, `pins`, `plugin`, and `lifecycle` under
  `tests/acceptance/release/`; they test what only a release has.
- `tests/integration/tools/generation/` holds tests that run the guide examples through the
  generated configuration (`bash`, `typescript`, `docker`) beside tests of generation itself.
  They are not duplicates of the acceptance kits, but the folder name says they are. **rename**
  the guide-example tests into a folder named for the guides.
- 52 `['recommended', 'all']` parametrizations in 31 files. **review**: keep the pair only
  where the `all` run expects a finding the `recommended` run lacks.

### Slow by construction

- The full source acceptance takes about 90 minutes on a CI runner. 22 tests declare `90_000`
  and 51 declare three to six times the planted timeout.
- 283 planted cases mean 283 installs through the registry. `tests/support/cli/nextjs.ts`
  shows the alternative: one installed fixture, cases as edits on it. **merge** every kit onto
  that pattern.
- Up to 48 `console.log` calls sit in test bodies. **cut**.

### Gaps: real logic without a direct test

254 of 477 source files are imported by no test; they run only through the CLI. For pure logic
that leaves edge cases untested. The deterministic coverage run reports under 10% of lines for
these, and no native or acceptance case reaches the rest:

- `packages/cli/src/checks/python/imports.ts` (4%) and `exports.ts` (6%): the import-comment
  and export-order analyses.
- `packages/cli/src/checks/structure/scripts/` (`interpreter` 5%, `boundaries` 6%, `policy` 8%,
  `configuration` 9%, `ssh-blocks` 9%, `sources` 10%): the Bash analyzer, driven end to end by
  `tests/support/cli/bash-cases.ts` alone.
- `packages/cli/src/generation/workflow.ts` (6%, 289 lines): CI workflow generation.
- `packages/cli/src/lifecycle/hooks/native-hooks.ts` (5%, 249 lines) and
  `packages/cli/src/generation/hooks/lefthook.ts` (10%): the dispatcher scripts whose Windows
  defects cost three probe rounds this week. No test renders a script and runs `sh -n` on it.
- `packages/cli/src/checks/locales.ts` (5%), `packages/cli/src/checks/nextjs/source.ts` (7%),
  `packages/cli/src/checks/static-site/source-checks.ts` (7%),
  `packages/cli/src/checks/secrets/history.ts` (6%), `packages/cli/src/checks/nginx/config-test.ts`
  (9%), `packages/cli/src/checks/commit-messages.ts` (10%),
  `packages/cli/src/commands/check/push.ts` (9%), `packages/cli/src/commands/check/content.ts`
  (10%).
- Three checks are named by no test: `cloudflare/env-types-fresh`, `fastapi/openapi-fresh`,
  `fastapi/openapi-lint`. `drizzle/migrations-fresh` exists only behind a mocked spawn.
- Plugin rules: `require-server-only` has two valid and one invalid case. The rules changed
  this week, `no-trivial-functions`, `export-layout`, and `no-import-comments`, have 9, 6, and 7
  invalid cases. Each exemption removed from the trivial-function rule needs one case that
  reports.

**add**, in this order:

- a unit test with planted input and exact findings for each analyzer above
- a render-and-`sh -n` test for every generated hook script
- one plugin case per removed exemption
- one acceptance case each for the three unnamed checks

### What holds up

Six parts hold up, and each asserts exact findings, lines, bytes, or exit codes:

- the plugin `RuleTester` suites (27 files with valid and invalid tables)
- the parser unit suites, such as `tests/unit/cli/sql-parser.test.ts`
- the settings surface tests
- the manifest schema tests
- the mocked adapter tests for isolation and cleanup
- the planted scaffold itself

## First cuts, in order

1. Decide adoption: keep existing configuration, or report and replace. Everything in
   the adoption folder, `packages/cli/src/repository/configuration/`, the eslintrc reader,
   and the ESLint runtime follows from it. Decided: report and replace (phase 1).
2. One spawn implementation for product and tests.
3. One hook dispatcher script with the tool as data.
4. One TOML parser, one JSON-with-comments parser, one glob library, one output library.
5. Retire the `structure/*` and `naming/*` checks a language tool already enforces; keep the
   cross-language vocabulary bans.
6. Make the trivial-function rule stop flagging template and fixture builders, then delete the
   221 suppressions that only say so.
7. Collapse `gspot.toml`: one knip entry for planted repositories, one folder for misspelled
   fixtures, one external-names list.
8. Fold one-function files and per-concept type files into their owners.
9. Cut `architecture/` to contracts, the guides to rules tools do not enforce, and the README to
   a banner, a sentence, install, and one example.
10. Move logic out of generated files and lint the templates as code.
11. One planted-case driver in test support; every kit file becomes a table and a fixture.
12. One installed fixture per kit, with cases as edits, so acceptance stops at 283 installs.
13. One adapter-contract test over a table of adapters; per-adapter files keep only their own
    branches.
14. Unit tests for the Bash and Python analyzers, the workflow generator, and the hook scripts
    (rendered and checked with `sh -n`).

## How the numbers were taken

```sh
find <dir> -type f | wc -l; find <dir> -type f -exec cat {} + | wc -l
find packages/cli/src -name '*.ts' -exec wc -l {} + | awk '$1<40' | wc -l
grep -rhoE "eslint-disable(-next-line)? [^ ]+" packages tests --include='*.ts' | sort | uniq -c
grep -rhoE "no-trivial-functions -- reason: .{0,60}" packages tests --include='*.ts' | sort | uniq -c
grep -rh -A2 '^\[\[settings\]\]' packages/cli/kits --include=manifest.toml | grep '^name' | sort | uniq -d
grep -rh '^\[\[checks\]\]' packages/cli/kits --include=manifest.toml | wc -l
grep -c '^import' packages/cli/src/checks/dispatch.ts
grep -rE "replaceAll\('\\\\\\\\', '/'\)|openRoot\(|throw new Error\(" packages/cli/src --include='*.ts' | wc -l
grep -rlE "Bun\.spawnSync|from '#tests/support/cli/command.ts'|from '#cli/platform/spawn.ts'" tests | wc -l
grep -n '^\[' gspot.toml | sed -E 's/^[0-9]+://' | sort | uniq -c | sort -rn
git ls-files .gspot | wc -l; find .gspot -type f | wc -l
```
