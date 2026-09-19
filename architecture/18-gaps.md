# Open Gaps

This document lists where the repository differs from the specification in this folder, and the
order in which the gaps close. Each row names the evidence, so a reader can run the same command
and see the same result. Read on September 18, 2026. A row leaves this document in the commit
that closes it.

## What holds

- `gspot check --no-cache` runs 75 checks over this repository. `gspot.toml` holds no
  `[[ignore]]`, the source holds no inline suppression, and no baseline file exists.
- knip reports no unused file, no unused export, and no unused dependency.
- Bun is the only runtime and the only package manager. The manual uses Astro Starlight, which
  Bun runs.
- `packages/npm/platform/README.md` is the template that `publish.ts` copies into each platform
  package.
- `rules/templates/project/` holds architecture rule files that `--project-templates` copies
  once. `rules/templates/docs/` holds the document shapes that the docs rules name.

## What is not built

The deeper unit tests and the manual rewrite (G-10). The acceptance runs over yap-text-inference,
yap-landing, and slopshop end with no check in error; a run on a public repository of each
Phase 7 shape is owed.

gspot runs on yap-swift-app: branch `chore/gspot` of that repository holds the migration (D-97),
and [17-migration.md](17-migration.md) lists the defects it exposed. The defects of the engine that
the run exposed are fixed with a test. The defects of the install itself are not:
[20-adoption.md](20-adoption.md) lists them, and the Adoption phase of
[13-roadmap.md](13-roadmap.md) orders the work.

The first form of the hooks work is not in the tree. It is kept in the git stash named
`hooks-existing`. D-114 moves the hook line into the task the hook calls, the test of that work
did not pass, and uncommitted work blocks a push (K-70).

## Gaps

| Id   | Gap                                    | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-2  | Tests cover less than the roadmap said | 54 of the 73 check ids appear in no test file. Three of the 12 presets have a planted repository: bash, commits and config-files. No shell structure check has a planted defect. `tests/acceptance`, `tests/parity` and `tests/performance` are empty. `doctor/`, `emit/apply.ts`, `emit/carry.ts`, `run/plan.ts` and `run/execute.ts` have no unit test. |
| G-10 | The documentation is thin              | The README holds 24 lines. The manual holds six guides and 1,257 words, and none mentions profiles, customization, a check of your own, or how to pass a failing hook. The site is a default Starlight manual with no landing page. [21-documentation.md](21-documentation.md) holds what each one needs.                                                 |
| G-13 | Two conventions for constants          | `packages/cli` keeps constants in `config/`. `packages/eslint-plugin` keeps 47 constants beside the rules that use them. No decision records which one a package follows.                                                                                                                                                                                 |

## Defects that break an install

Each row was reproduced by running the command in the second column.

| Id  | Defect | Reproduction | Owner |
| --- | ------ | ------------ | ----- |

## Code gaps

| Id   | Gap                                                                                                                              | Owner                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| K-13 | `gspot allow gitleaks`, `osv` and `licenses` write keys of presets that do not ship, and the settings surface then refuses them. | `policy/allow-command.ts`                               |
| K-14 | 20 of 29 owner rows and 9 of 13 check rows in takeover name presets that do not ship. The code cannot run today.                 | `emit/takeover.ts`, `emit/carry.ts`                     |
| K-17 | The core names preset ids: `swift`, `prose`, `typescript` and `commits`.                                                         | `emit/targets.ts`, `emit/apply.ts`, `emit/init-plan.ts` |
| K-24 | The shared structure context carries `bashText`, `bashList` and `bashSetting`. Every code analysis is for shell.                 | `structure/engine.ts`                                   |
| K-28 | The ESLint template holds 411 lines of JavaScript, and its test holds 21.                                                        | `presets/javascript/eslint.config.js.tmpl`              |

The rows below come from the read of September 19, 2026, after the install in yap-swift-app.
[20-adoption.md](20-adoption.md) holds the design for the rows that name a section of it.

| Id   | Gap                                                                                                                                                                                                                                                                                                                                                                                   | Owner                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| K-36 | Takeover deletes `setup.cfg` and `tox.ini` when the `sql` preset is selected, because both sit in the sqlfluff path list. No guard reads the file for other sections (A-10).                                                                                                                                                                                                          | `config/patterns.ts`, `lifecycle/takeover.ts`                                                                                        |
| K-37 | A root folder named `hooks` reads as a git hooks folder (A-3).                                                                                                                                                                                                                                                                                                                        | `config/patterns.ts` (`HOOK_DIRECTORIES`)                                                                                            |
| K-38 | K-17 is wider than recorded. The core also names `nestjs` and seven tool file prefixes, `eslint` and `basedpyright` baseline files, ESLint flags behind `{suppressions}`, the ESLint crash banner, three check ids in `NEVER_CACHED`, and `xcode` in the init plan.                                                                                                                   | `structure/analyses/prefix-collisions.ts`, `run/baselines.ts`, `run/tool-runner.ts`, `run/execute.ts`, `lifecycle/init/plan.ts`      |
| K-39 | K-14 is still open in three tables: `OWNER_PRESET` (29 tools), `CHECK_BY_TOOL` (13 tools) and the nine tool tables of `propose.ts`. A preset manifest owns none of it.                                                                                                                                                                                                                | `lifecycle/takeover.ts`, `config/carry.ts`, `policy/propose.ts`                                                                      |
| K-40 | The init proposal holds values of one repository: `TYPES_DIRECTORIES` lists `api/types`, and the commit scopes always gain `root`, `hooks` and `deps`.                                                                                                                                                                                                                                | `lifecycle/init/plan.ts`                                                                                                             |
| K-41 | Disabled ESLint rules are read line by line: any line of the old configuration shaped `name: 0,` becomes an `[[ignore]]` entry, whether or not it sits in a rules table.                                                                                                                                                                                                              | `lifecycle/carry.ts` (`disabledEslint`)                                                                                              |
| K-42 | A fixer receives every file in one command line. A check splits its files under the argument limit of the platform (`fileBatches`), and `--fix` does not. A fixer that exits nonzero is not reported.                                                                                                                                                                                 | `run/fixers.ts`                                                                                                                      |
| K-43 | `generatedHash` hashes every file under `.gspot/` once for each planned check, and any change there clears every cached verdict (A-4). `fileHash` encodes a whole file as base64 before it hashes it.                                                                                                                                                                                 | `run/execute.ts`, `run/cache.ts`                                                                                                     |
| K-44 | The cache has no limit and no eviction, and the Swift build folder sits inside it, inside the repository (A-4).                                                                                                                                                                                                                                                                       | `run/cache.ts`, `apple/build.ts`                                                                                                     |
| K-45 | Every run overwrites `last.json`, the `commit-msg` run included, and `apply --lower-baselines` reads it (A-7).                                                                                                                                                                                                                                                                        | `run/record/write.ts`, `emit/lower-baselines.ts`                                                                                     |
| K-46 | A baseline count that rises prints every finding of the rule (A-6).                                                                                                                                                                                                                                                                                                                   | `run/baselines.ts` (`applyBaselines`)                                                                                                |
| K-47 | Nine stubs copy the whole generated file to the root, against the one-line rule of [03-configuration.md](03-configuration.md). A JSON stub carries no mark (A-1, A-2).                                                                                                                                                                                                                | seven manifests, `emit/targets.ts` (`copyStubContent`)                                                                               |
| K-48 | Scopes come from npm, uv and Cargo workspaces only. A per-scope target lands in one of two places by the spelling of its path (A-11).                                                                                                                                                                                                                                                 | `repository/scopes.ts`, `run/scope-paths.ts`                                                                                         |
| K-49 | `prefixOf` splits at `-` and `.` only, so the prefix rule is blind in snake_case and PascalCase code. Non-source files count as peers. The plugin holds a second copy of the function (A-14).                                                                                                                                                                                         | `structure/directories.ts`, `packages/eslint-plugin/src/files.ts`                                                                    |
| K-50 | The naming policy holds no framework layer and names Next.js for every repository. Go, Rust and Ruby have no case table and no extractor, and no output says so (A-15).                                                                                                                                                                                                               | `presets/naming/policy.json`, `naming/extract.ts`                                                                                    |
| K-51 | Scope settings are written as inline tables hundreds of characters wide, because the TOML patcher refuses a document that mixes inline tables and sub-tables (A-8).                                                                                                                                                                                                                   | `policy/propose.ts`, `policy/write.ts`                                                                                               |
| K-52 | `[inspection] strict = false` changes nothing in the Swift preset: 95 opt-in SwiftLint rules are on for every repository (A-13).                                                                                                                                                                                                                                                      | `presets/swift/swiftlint.yml.tmpl`                                                                                                   |
| K-53 | init opens three sessions and applies twice, and the first run has no way to leave out the push stage (A-4).                                                                                                                                                                                                                                                                          | `lifecycle/init/command.ts`, `lifecycle/first-check.ts`                                                                              |
| K-54 | The word `render` stays in more than 100 places (`RenderedSet`, `isRenderedHere`, `renderedPaths`, "Re-render" in the mise task text), and `synced` in 15, although [19-names.md](19-names.md) says every rename is applied.                                                                                                                                                          | `emit/`, `lifecycle/`, `types/emit.ts`                                                                                               |
| K-55 | The default hooks folder `.githooks` is written in two files of the uncommitted hooks work.                                                                                                                                                                                                                                                                                           | `emit/targets.ts`, `lifecycle/uninstall-command.ts`                                                                                  |
| K-56 | init never reads what a hook calls. In five reference repositories the hook is one `exec mise run ...` line, and the lint lives in the task (A-16).                                                                                                                                                                                                                                   | `repository/existing-tooling.ts`, `lifecycle/questions.ts`                                                                           |
| K-57 | `applyAll` sets `core.hooksPath` on every apply, also where a tracked setup task sets it to another folder. A fresh clone has no hooks and no command says so (A-17).                                                                                                                                                                                                                 | `emit/apply-command.ts`, `doctor/report.ts`                                                                                          |
| K-58 | The runner surface writes five `gspot:*` tasks and ignores the `lint` and `format` names a repository has (A-18).                                                                                                                                                                                                                                                                     | `emit/runner-surface.ts`                                                                                                             |
| K-59 | Takeover reads no table of `pyproject.toml` and no lint key of `package.json`. It names no lint-only dependency inside a manifest that holds other dependencies, and no workspace entry of a lint folder (A-19).                                                                                                                                                                      | `config/patterns.ts`, `lifecycle/carry.ts`                                                                                           |
| K-60 | A failing hook run names no way out and no command that reproduces it (A-20).                                                                                                                                                                                                                                                                                                         | `output/reporter.ts`                                                                                                                 |
| K-61 | The folder `packages/cli/rules-lint` and the alias `#rules-lint/*` carry a longer name than they need. They become `packages/cli/rules` and `#rules/*`; the check id is already `rules/lint`.                                                                                                                                                                                         | `packages/cli/package.json`, every import of the alias, `tests/unit/rules-lint/`                                                     |
| K-62 | No command lists the presets and checks that exist, are installed, or are off (A-21).                                                                                                                                                                                                                                                                                                 | `commands/`, `output/explain.ts`                                                                                                     |
| K-63 | No level exists below a whole preset, and `[inspection] strict` is read by almost nothing (A-22).                                                                                                                                                                                                                                                                                     | every manifest, `policy/schema.ts`                                                                                                   |
| K-64 | The selection question is one list of every proposed preset (A-23).                                                                                                                                                                                                                                                                                                                   | `lifecycle/questions.ts` (`askPresets`)                                                                                              |
| K-65 | The managed block of the agent files is a padded table: 21 KB in the app, where the file held 372 bytes before (A-25).                                                                                                                                                                                                                                                                | `rules/managed-block.ts`                                                                                                             |
| K-66 | Words this project made up reach a person: `surface`, `layer`, run record, `inspection`, `declare`, policy, nature, "Re-render", "idempotent". [19-names.md](19-names.md) lists each with where it appears.                                                                                                                                                                           | `policy/schema.ts`, `commands/`, `output/`, `doctor/`, the guides, every rule file                                                   |
| K-67 | `layer:` in a rule file does not match its folder: files under `rules/general/code/` say `layer: code`. One word holds two meanings.                                                                                                                                                                                                                                                  | `rules/**`, `rules/managed-block.ts`                                                                                                 |
| K-68 | Both JSON schemas are tracked twice, under `schema/` and `docs/public/schema/`, 170 KB.                                                                                                                                                                                                                                                                                               | `packages/cli/schemas.ts`                                                                                                            |
| K-69 | A `[[check]]` of the repository is cached on the files its `paths` name, and its command reads more. A failure outlives its cause: `schema/generated` failed from the cache and passed with `--no-cache`, and it blocked a push on September 19, 2026.                                                                                                                                | `run/execute.ts` (`keyFor`), `run/plan.ts` (`fromRepoCheck`)                                                                         |
| K-70 | The pre-push hook checks the working tree, not the commits being pushed. Uncommitted work in unrelated files refuses a push of clean commits.                                                                                                                                                                                                                                         | `emit/hooks.ts`, `run/check-command.ts`                                                                                              |
| K-71 | The cache of this repository held 7,901 entries (K-44).                                                                                                                                                                                                                                                                                                                               | `run/cache.ts`                                                                                                                       |
| K-72 | init writes nothing to `.gitattributes`, so generated files and baselines show as code in a pull request (A-26).                                                                                                                                                                                                                                                                      | `emit/targets.ts`                                                                                                                    |
| K-73 | The top level holds `prose/` and `schema/`, which belong to a preset and to the root, and lacks `examples/`, `CONTRIBUTING.md`, `CHANGELOG.md` and `SECURITY.md` ([12-repository-layout.md](12-repository-layout.md)).                                                                                                                                                                | the repository root                                                                                                                  |
| K-74 | The typescript preset puts `extends` into the `tsconfig.json` of the developer and requires ten compiler options, among them `erasableSyntaxOnly`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature`. That changes what their own `tsc` and their build accept, which is more than a lint finding.                                        | `presets/typescript/manifest.toml` (merge stub), `integrity/tsconfig-options.ts`                                                     |
| K-75 | Checks of taste fail a normal repository on the first run: every dependency pinned to an exact version, a `packageManager` field, a seven-day `minimumReleaseAge` in `bunfig.toml`, a README in every scope, a list of banned headings, a Contents list in a long README. They belong to the `strict` level (D-119).                                                                  | `integrity/manifest-policy.ts`, `install-policy.ts`, `readme/`, `docs-headings.ts`                                                   |
| K-76 | `integrity/stale-paths` knows mise tasks only from `[tasks]` tables in four files. A task that is a file under `.mise/tasks/`, which is every task of the five reference repositories, reads as missing, so `mise run lint` in a README is a finding.                                                                                                                                 | `integrity/stale-paths.ts` (`MISE_FILES`, `miseTasks`)                                                                               |
| K-77 | The path of the mise file is written in three files, and `.gspot/hooks` in two. A rename means three edits.                                                                                                                                                                                                                                                                           | `emit/runner-surface.ts`, `integrity/stale-paths.ts`, `integrity/task-policy.ts`                                                     |
| K-78 | `integrity/task-policy` checks the hooks only when `hooks.tool = "gspot"`. With husky, lefthook or the hooks of the repository, a deleted gspot line passes.                                                                                                                                                                                                                          | `integrity/task-policy.ts` (`hookFindings`)                                                                                          |
| K-79 | One file registers 130 analyses of every preset and imports every language folder, so the core knows each preset by name. "integrity" names no one thing: it holds the Swift build, the npm license scan and the README shape. An analysis name repeats its check id in another spelling (`xctest-sleep` for `xctest/no-sleep`).                                                      | `integrity/dispatch.ts`                                                                                                              |
| K-80 | The license check reads npm packages only. Python, Swift, Rust, Go and Ruby dependencies have no license check, and nothing says so.                                                                                                                                                                                                                                                  | `integrity/licenses.ts`                                                                                                              |
| K-81 | `gspot check` prints nothing until every check has finished, then one line for every check, passed ones included: 135 lines here and 255 in the app. A 45-minute run shows no progress. The summary holds no count of findings and no time.                                                                                                                                           | `output/reporter.ts` (`runText`), `run/execute.ts`                                                                                   |
| K-82 | `gspot doctor` prints `hooks  .gspot/hooks  installed` from the config. It never asks git whether the hooks run in this clone.                                                                                                                                                                                                                                                        | `doctor/report.ts` (`hooksLine`)                                                                                                     |
| K-83 | Every run ends with `unchecked  N files (gspot doctor)`, and the count is mostly images and other binary files, which no linter reads. 1,155 here.                                                                                                                                                                                                                                    | `run/execute.ts`, `doctor/coverage.ts`                                                                                               |
| K-84 | `doctor --settings` prints a `direction` column and a section called "not a slot". Check lines say `cache` for a passed check that did not run again.                                                                                                                                                                                                                                 | `doctor/command.ts`, `output/reporter.ts`                                                                                            |
| K-85 | The core holds version flags for four tools by name, although a manifest has `version_command` for that. The install hint falls back to `bun install` and `uv tool install` for a developer who uses neither.                                                                                                                                                                         | `platform/tool-probe.ts` (`VERSION_FLAGS`), `platform/install-hints.ts`                                                              |
| K-86 | The folder rule bans the folder names `bash`, `javascript`, `typescript`, `python` and `swift`. The rule forced this repository to name its own folders `pyproject/`, `apple/`, `golang/` and `cargo/`, which no reader expects. The list also lives in a file about shell scripts. The container words (`utils`, `helpers`, `core`, `shared`) are part of the banned terms and stay. | `config/shell.ts` (`BANNED_FOLDER_NAMES`), `structure/analyses/folder-names.ts`                                                      |
| K-87 | Three copies of one idea: the trivial-function, call-through and duplicate-function logic exists for shell, for Python and for Swift, each with its own constants `TRIVIAL_STATEMENTS = 2`, `TRIVIAL_LINES = 3` and `ONE_CALLER_COUNT = 2`. The file and function ceilings 300 and 60 are written in three folders.                                                                   | `structure/analyses/`, `pyproject/structure/functions.ts`, `apple/structure/bodies.ts`, `golang/lengths.ts`                          |
| K-88 | A config that names a folder as `src` and not `src/**` is refused, and no command runs until it is fixed. gspot can read both. Scopes cannot nest, so `packages/app` and `packages/app/native` cannot both be scopes.                                                                                                                                                                 | `policy/problems.ts` (`isBareDirectory`, `scopeProblems`)                                                                            |
| K-89 | `layer` has a third meaning in the code: `PolicyScopeLayer`. `slot`, `surface`, `direction` and `exposes` are the working words of the settings code and reach a person through `doctor --settings` and two error messages.                                                                                                                                                           | `policy/merge.ts`, `policy/audit.ts`, `policy/messages.ts`                                                                           |
| K-90 | `xctest/reference-images` reports 954 orphan references in the app, from a fixed depth of three folders under `__Snapshots__`. A count that high points at the layout rule, not at 954 dead images. It is checked against the real test files in the redo of the app.                                                                                                                 | `apple/xctest/references.ts`                                                                                                         |
| K-91 | Checks that enforce the house style of one owner run in a default install: a four-line header with `# Runtime: Bash 3.2+` and a `main "$@"` last line on every shell script, a boxed `-- Migration:` and `-- Purpose:` header on every Postgres migration, every TypeScript type under one folder, no folder with one file. They belong to the `strict` level (D-119).                | `structure/analyses/shell/interpreter.ts`, `postgres/migration-docs.ts`, plugin rules `types-placement` and `no-single-file-folders` |
| K-92 | The managed block writes the sentence "Do not use subagents or parallel agents unless asked in the conversation." into the `CLAUDE.md` of every repository. That is one owner's working preference, not a fact about the repository.                                                                                                                                                  | `rules/managed-block.ts` (`SUBAGENTS`)                                                                                               |
| K-93 | Defaults that assume one kind of project: a static site builds with `npm run build` into `dist`, assets live under `assets/`, a Swift build targets `generic/platform=iOS Simulator`. Each is a setting, and none is detected.                                                                                                                                                        | `web/site/build.ts`, `web/site/source-checks.ts`, `apple/plan.ts`                                                                    |
| K-94 | The set of path keys a profile may not hold is written twice.                                                                                                                                                                                                                                                                                                                         | `profile/read.ts`, `profile/save.ts` (`PATH_KEYS`)                                                                                   |

## Test gaps

Most planted tests are sound: they run the check on a clean repository, plant one defect, and
read the message. The rows below are where a test proves less than its name says, or where no
test exists.

| Id   | Gap                                                                                                                                                                                                                                                                                                       | Evidence                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| T-1  | No test installs with the mise runner. Every test passes `--runner none`. The mise file, the `mise exec -- gspot` hook line and `mise install` never run in a test, and that is the path the app took.                                                                                                    | `grep -l "'mise'" tests/repositories/*.ts` prints nothing    |
| T-2  | One test runs a default `init`, and it is skipped unless `GSPOT_ACCEPTANCE` is set. 30 test files pass `--without`, most of them to drop `naming`, `spelling` and `structure`, so no preset is tested with the set a person gets.                                                                         | `tests/repositories/reference.test.ts`                       |
| T-3  | Four test files use a scope. None holds two scopes with different languages, a nested scope, or a scope that is not a workspace member.                                                                                                                                                                   | `grep -l "'--scope'" tests/repositories/*.ts`                |
| T-4  | Seven tests run `init` through `run()` and never read its result. `install()` exists for this and 49 calls use it.                                                                                                                                                                                        | `structure.test.ts`, `repository-check.test.ts`              |
| T-5  | Expected text that the file path already holds: `'turn'` for `jobs/turn.sh`, `'helpers'` for `helpers/first.sh`. The test passes when the message is wrong.                                                                                                                                               | `tests/repositories/structure.test.ts`                       |
| T-6  | The prefix rule is planted with dash names only (K-49).                                                                                                                                                                                                                                                   | `tests/repositories/structure.test.ts`                       |
| T-7  | Takeover has one test. No test plants `setup.cfg`, a `hooks/` folder of source files, `.mise/tasks/`, or hooks that must keep running (K-36, K-37).                                                                                                                                                       | `tests/repositories/takeover.test.ts`                        |
| T-8  | `toolsPath` leaves out a tool that mise cannot find and says nothing. The test then fails on a `missing` status with a message about the check, not about the machine.                                                                                                                                    | `tests/harness/planted.ts`                                   |
| T-9  | The init command line is written out 60 times, and a `package.json` literal 18 times. Tool names, timeouts and fixture text sit at the top of each test file.                                                                                                                                             | `grep -c "'--no-install'" tests/repositories/*.test.ts`      |
| T-10 | `lifecycle/`, `doctor/`, `commands/`, `platform/`, `apple/`, `web/`, `pyproject/` and `supabase/` hold no unit test. The unit tests hold 2,197 lines for 24,650 lines of source.                                                                                                                          | `ls packages/cli/tests/unit`                                 |
| T-11 | Two test files have names that do not say what they test: `repository-check.test.ts` tests a `[[check]]` entry, and `scope-languages.test.ts` tests presets selected in a scope.                                                                                                                          | `tests/repositories/`                                        |
| T-12 | No test measures time. Nothing fails when `init` or a staged check gets slower.                                                                                                                                                                                                                           | `tests/performance` does not exist                           |
| T-13 | No test plants a hook that calls a task, a setup task that sets the hooks path, a fresh clone, a `[tool.ruff]` table, or an existing `lint` script.                                                                                                                                                       | `tests/repositories/takeover.test.ts`, `hooks.test.ts`       |
| T-14 | The guard test `every shipped check has a test` passes when the id of a check appears in quotes anywhere in any test file. A check named only in a `--skip` list or in an array counts as tested.                                                                                                         | `packages/cli/tests/unit/presets/every-check-tested.test.ts` |
| T-15 | Four plugin rules have three test cases or fewer, and two have no valid case at all: `require-server-only` (1), `header-comments-before-imports` (3), `private-before-public` (3, all invalid), `no-exported-alias-constants` (4, all invalid). A rule with no valid case can report everything and pass. | `packages/eslint-plugin/tests/rules/`                        |
| T-16 | 18 unit test files hold one expectation for each test. They prove one input each and no edge: `fences`, `codeql`, `readme-shape`, `migration-docs`, `vale`, `ignores`, the SQL parser and extractor, `broken-tool`, `json-schema`.                                                                        | `packages/cli/tests/unit/`                                   |

A person can turn the naming check off today with `gspot ignore naming/identifiers` and a reason,
and can turn one tool off with `tools.<name>.enabled = false` and a reason. G-5 is about the
preset: no command drops it, `init` offers no choice, and nothing carries the choice to another
repository.

## Presets that do not ship

Every preset with a file under [presets/](presets/README.md) ships: 52 of them, the nine Phase 7
presets among them.

## Order of work

1. Repository hygiene: G-1, G-11, G-12, the declaration of the Swift grammar and the format of
   `mise.toml`.
2. Release safety: one version source for the binary, the plugin and `publish.ts`. The release
   tests run in the release workflow. A test runs the compiled binary. Closes B-6, B-7 and K-29.
3. The schema: commit both schema files, add a `[[check]]` that fails when they differ from the
   reader, and serve them from the manual. Closes G-3.
4. One owner for each concept: K-1 to K-4, K-8 and K-14.
5. Scale: B-8 and K-5 to K-7.
6. The concerns of this repository leave the binary: K-18.
7. Selection, which closes G-5, G-6, G-7, K-12 and K-22:
    - `requires` splits into `requires` and `recommends`, and `typescript` requires `javascript`;
    - a language preset recommends `structure`, `naming`, `formatting` and `spelling`;
    - `--without` and `gspot remove` drop a recommended preset;
    - dropping a required preset fails and prints the chain;
    - `--presets none` installs the rule files alone;
    - the init plan prints the presets and the number of checks for each.
8. Profiles, which closes G-8 (D-79).
9. Corpus independence, which closes G-4, K-19 and K-20, and amends D-73 in
   [14-decisions.md](14-decisions.md):
    - the rule files say "the checks of the repository" and name no tool;
    - the managed block holds the `gspot check` sentence only when checks are installed;
    - `[rules]` gains a list of files or layers to leave out;
    - the corpus lint fails on `gspot` and on a tool name outside a code fence.
10. `doctor`, which closes G-9 and K-9:
    - probe an npm library through its `package.json` under `node_modules`;
    - label a binary file `not checked`;
    - fail on a version that differs from the pin.
11. Tests, which closes G-2, K-23 and K-28:
    - one planted repository for each shipped preset, with one planted defect for each check;
    - unit tests for each shell analysis, `apply`, `carry`, `plan`, `execute` and `doctor`;
    - planted cases for a changed working tree, a failed `init`, a wrong flag value and `uninstall`;
    - the acceptance harness on yap-landing;
    - `tests/parity` and `tests/performance` leave the tree until each holds a test.
12. Documentation, which closes G-10 and K-30:
    - the root README follows its template;
    - `packages/cli` and `packages/eslint-plugin` get a README each;
    - the manual gains guides for customization, profiles, presets, baselines, CI and uninstall;
    - each command gets a page with a worked example;
    - `docs/readme-shape` requires the sections the template names.
13. The security presets of Phase 5 come before Phase 4 in [13-roadmap.md](13-roadmap.md). The
    acceptance run on yap-swift-app needs them.

`bun test` stays the test framework. It needs no dependency, and the ESLint rule tester runs
under it.

## Where each gap is decided

The specification now holds a decision for every gap that needed one. The code follows it in the
hardening phase of [13-roadmap.md](13-roadmap.md).

| Gaps                    | Decision in [14-decisions.md](14-decisions.md) | Specified in                                                           |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| G-5, G-7, K-12, K-22    | D-80                                           | [04-presets.md](04-presets.md), [02-cli.md](02-cli.md)                 |
| G-4, G-6, K-19, K-20    | D-81                                           | [09-rules.md](09-rules.md)                                             |
| the order of the phases | D-82                                           | [13-roadmap.md](13-roadmap.md), [17-migration.md](17-migration.md)     |
| B-6, B-7, K-29          | D-84                                           | [12-repository-layout.md](12-repository-layout.md)                     |
| G-9, K-9                | D-87                                           | [04-presets.md](04-presets.md)                                         |
| B-8, K-5, K-6, K-7      | D-89                                           | [14-decisions.md](14-decisions.md)                                     |
| K-13, K-14, K-17        | D-91                                           | [14-decisions.md](14-decisions.md)                                     |
| publishing              | none needed                                    | [11-toolchain.md](11-toolchain.md)                                     |
| the Swift rule sets     | none needed                                    | [presets/swift.md](presets/swift.md), [presets/sql.md](presets/sql.md) |

The other rows need no decision. Each one is a defect against text this folder already holds:

- G-1 to G-3 and G-10 to G-13;
- K-1 to K-4, K-8, K-10, K-11, K-15 and K-16;
- K-23 to K-26, K-28 and K-30 to K-33.

K-35 is decided in D-93.

## What has been read

Read line by line:

- `lifecycle/` except `questions.ts` and `upgrade/`;
- `run/` except `engines.ts`, `file-batches.ts`, `json-output.ts`, `list-arguments.ts`, `parse-output.ts` and `ignores.ts`;
- `emit/targets.ts`, `hooks.ts`, `stubs.ts`, `runner-surface.ts`, `apply-command.ts` and `managed-blocks.ts`;
- `integrity/` except the two `docker/` files, `nginx/`, `gems.ts` and `ansible-lint.ts`;
- `platform/tool-probe.ts`, `spawn.ts`, `install-hints.ts` and `assets.ts`;
- `doctor/` except `settings.ts` and `newer-version.ts`;
- `output/reporter.ts`, `plan-text.ts` and `detection.ts`;
- `policy/messages.ts`, `propose.ts`, `write.ts`, `loosening.ts`, `audit.ts`, `problems.ts`, `merge.ts`, `read-policy.ts`, `set-command.ts`, `ignore-command.ts` and `add-command.ts`;
- `repository/scopes.ts` and `existing-tooling.ts`, `presets/detect.ts`;
- `structure/engine.ts`, `directories.ts`, `analyses/prefix-collisions.ts` and `folder-names.ts`;
- `config/patterns.ts`, `carry.ts`, `reasons.ts` and `markers.ts`;
- five test files, the test harness, and the guard test.

Read by outline (the header comment, every constant, every exported function), not line by line:

- `apple/`, `pyproject/`, `web/`, `sql/`, `postgres/`, `supabase/`, `cargo/`, `golang/`, `express/`;
- `profile/`, `prose/`, `rules/`, `presets/`, and the rest of `run/` and `emit/`.

Read by counts and titles only:

- the 27 rule tests of the plugin, the unit tests, and the other 48 repository tests.

Not read:

- `types/`, the rest of `config/`, `policy/settings.ts`, `schema.ts` and `normalize.ts`, `output/explain.ts` and `why.ts`;
- the 26 plugin rules except `no-prefix-collisions`;
- the templates of every preset, and the six guides beyond a word search.

The rows above are a floor. The folders read by outline hold more than their outline shows.
