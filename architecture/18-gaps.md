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

## Gaps

| Id   | Gap                                    | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-2  | Tests cover less than the roadmap said | 54 of the 73 check ids appear in no test file. Three of the 12 presets have a planted repository: bash, commits and config-files. No shell structure check has a planted defect. `tests/acceptance`, `tests/parity` and `tests/performance` are empty. `doctor/`, `emit/apply.ts`, `emit/carry.ts`, `run/plan.ts` and `run/execute.ts` have no unit test. |
| G-10 | The documentation is thin              | The six guides hold 1,445 words. The root `README.md` holds 25 lines and omits the Example, Key capabilities and Troubleshooting sections of `rules/templates/docs/README.md`. `packages/eslint-plugin` is published and has no README. No contributing guide exists. `docs/readme-shape` passes all of it.                                               |
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

| Id   | Gap                                                                                                                                                                                                                                                                 | Owner                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| K-36 | Takeover deletes `setup.cfg` and `tox.ini` when the `sql` preset is selected, because both sit in the sqlfluff path list. No guard reads the file for other sections (A-10).                                                                                        | `config/patterns.ts`, `lifecycle/takeover.ts`                                                                                   |
| K-37 | A root folder named `hooks` reads as a git hooks folder (A-3).                                                                                                                                                                                                      | `config/patterns.ts` (`HOOK_DIRECTORIES`)                                                                                       |
| K-38 | K-17 is wider than recorded. The core also names `nestjs` and seven tool file prefixes, `eslint` and `basedpyright` baseline files, ESLint flags behind `{suppressions}`, the ESLint crash banner, three check ids in `NEVER_CACHED`, and `xcode` in the init plan. | `structure/analyses/prefix-collisions.ts`, `run/baselines.ts`, `run/tool-runner.ts`, `run/execute.ts`, `lifecycle/init/plan.ts` |
| K-39 | K-14 is still open in three tables: `OWNER_PRESET` (29 tools), `CHECK_BY_TOOL` (13 tools) and the nine tool tables of `propose.ts`. A preset manifest owns none of it.                                                                                              | `lifecycle/takeover.ts`, `config/carry.ts`, `policy/propose.ts`                                                                 |
| K-40 | The init proposal holds values of one repository: `TYPES_DIRECTORIES` lists `api/types`, and the commit scopes always gain `root`, `hooks` and `deps`.                                                                                                              | `lifecycle/init/plan.ts`                                                                                                        |
| K-41 | Disabled ESLint rules are read line by line: any line of the old configuration shaped `name: 0,` becomes an `[[ignore]]` entry, whether or not it sits in a rules table.                                                                                            | `lifecycle/carry.ts` (`disabledEslint`)                                                                                         |
| K-42 | A fixer receives every file in one command line. A check splits its files under the argument limit of the platform (`fileBatches`), and `--fix` does not. A fixer that exits nonzero is not reported.                                                               | `run/fixers.ts`                                                                                                                 |
| K-43 | `generatedHash` hashes every file under `.gspot/` once for each planned check, and any change there clears every cached verdict (A-4). `fileHash` encodes a whole file as base64 before it hashes it.                                                               | `run/execute.ts`, `run/cache.ts`                                                                                                |
| K-44 | The cache has no limit and no eviction, and the Swift build folder sits inside it, inside the repository (A-4).                                                                                                                                                     | `run/cache.ts`, `apple/build.ts`                                                                                                |
| K-45 | Every run overwrites `last.json`, the `commit-msg` run included, and `apply --lower-baselines` reads it (A-7).                                                                                                                                                      | `run/record/write.ts`, `emit/lower-baselines.ts`                                                                                |
| K-46 | A baseline count that rises prints every finding of the rule (A-6).                                                                                                                                                                                                 | `run/baselines.ts` (`applyBaselines`)                                                                                           |
| K-47 | Nine stubs copy the whole generated file to the root, against the one-line rule of [03-configuration.md](03-configuration.md). A JSON stub carries no mark (A-1, A-2).                                                                                              | seven manifests, `emit/targets.ts` (`copyStubContent`)                                                                          |
| K-48 | Scopes come from npm, uv and Cargo workspaces only. A per-scope target lands in one of two places by the spelling of its path (A-11).                                                                                                                               | `repository/scopes.ts`, `run/scope-paths.ts`                                                                                    |
| K-49 | `prefixOf` splits at `-` and `.` only, so the prefix rule is blind in snake_case and PascalCase code. Non-source files count as peers. The plugin holds a second copy of the function (A-14).                                                                       | `structure/directories.ts`, `packages/eslint-plugin/src/files.ts`                                                               |
| K-50 | The naming policy holds no framework layer and names Next.js for every repository. Go, Rust and Ruby have no case table and no extractor, and no output says so (A-15).                                                                                             | `presets/naming/policy.json`, `naming/extract.ts`                                                                               |
| K-51 | Scope settings are written as inline tables hundreds of characters wide, because the TOML patcher refuses a document that mixes inline tables and sub-tables (A-8).                                                                                                 | `policy/propose.ts`, `policy/write.ts`                                                                                          |
| K-52 | `[inspection] strict = false` changes nothing in the Swift preset: 95 opt-in SwiftLint rules are on for every repository (A-13).                                                                                                                                    | `presets/swift/swiftlint.yml.tmpl`                                                                                              |
| K-53 | init opens three sessions and applies twice, and the first run has no way to leave out the push stage (A-4).                                                                                                                                                        | `lifecycle/init/command.ts`, `lifecycle/first-check.ts`                                                                         |
| K-54 | The word `render` stays in more than 100 places (`RenderedSet`, `isRenderedHere`, `renderedPaths`, "Re-render" in the mise task text), and `synced` in 15, although [19-names.md](19-names.md) says every rename is applied.                                        | `emit/`, `lifecycle/`, `types/emit.ts`                                                                                          |
| K-55 | The default hooks folder `.githooks` is written in two files of the uncommitted hooks work.                                                                                                                                                                         | `emit/targets.ts`, `lifecycle/uninstall-command.ts`                                                                             |
| K-56 | init never reads what a hook calls. In five reference repositories the hook is one `exec mise run ...` line, and the lint lives in the task (A-16).                                                                                                                 | `repository/existing-tooling.ts`, `lifecycle/questions.ts`                                                                      |
| K-57 | `applyAll` sets `core.hooksPath` on every apply, also where a tracked setup task sets it to another folder. A fresh clone has no hooks and no command says so (A-17).                                                                                               | `emit/apply-command.ts`, `doctor/report.ts`                                                                                     |
| K-58 | The runner surface writes five `gspot:*` tasks and ignores the `lint` and `format` names a repository has (A-18).                                                                                                                                                   | `emit/runner-surface.ts`                                                                                                        |
| K-59 | Takeover reads no table of `pyproject.toml` and no lint key of `package.json`. It names no lint-only dependency inside a manifest that holds other dependencies, and no workspace entry of a lint folder (A-19).                                                    | `config/patterns.ts`, `lifecycle/carry.ts`                                                                                      |
| K-60 | A failing hook run names no way out and no command that reproduces it (A-20).                                                                                                                                                                                       | `output/reporter.ts`                                                                                                            |
| K-61 | The folder `packages/cli/rules-lint` and the alias `#rules-lint/*` carry a longer name than they need. They become `packages/cli/rules` and `#rules/*`; the check id is already `rules/lint`.                                                                       | `packages/cli/package.json`, every import of the alias, `tests/unit/rules-lint/`                                                |

## Test gaps

Most planted tests are sound: they run the check on a clean repository, plant one defect, and
read the message. The rows below are where a test proves less than its name says, or where no
test exists.

| Id   | Gap                                                                                                                                                                                                                               | Evidence                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| T-1  | No test installs with the mise runner. Every test passes `--runner none`. The mise file, the `mise exec -- gspot` hook line and `mise install` never run in a test, and that is the path the app took.                            | `grep -l "'mise'" tests/repositories/*.ts` prints nothing |
| T-2  | One test runs a default `init`, and it is skipped unless `GSPOT_ACCEPTANCE` is set. 30 test files pass `--without`, most of them to drop `naming`, `spelling` and `structure`, so no preset is tested with the set a person gets. | `tests/repositories/reference.test.ts`                    |
| T-3  | Four test files use a scope. None holds two scopes with different languages, a nested scope, or a scope that is not a workspace member.                                                                                           | `grep -l "'--scope'" tests/repositories/*.ts`             |
| T-4  | Seven tests run `init` through `run()` and never read its result. `install()` exists for this and 49 calls use it.                                                                                                                | `structure.test.ts`, `repository-check.test.ts`           |
| T-5  | Expected text that the file path already holds: `'turn'` for `jobs/turn.sh`, `'helpers'` for `helpers/first.sh`. The test passes when the message is wrong.                                                                       | `tests/repositories/structure.test.ts`                    |
| T-6  | The prefix rule is planted with dash names only (K-49).                                                                                                                                                                           | `tests/repositories/structure.test.ts`                    |
| T-7  | Takeover has one test. No test plants `setup.cfg`, a `hooks/` folder of source files, `.mise/tasks/`, or hooks that must keep running (K-36, K-37).                                                                               | `tests/repositories/takeover.test.ts`                     |
| T-8  | `toolsPath` leaves out a tool that mise cannot find and says nothing. The test then fails on a `missing` status with a message about the check, not about the machine.                                                            | `tests/harness/planted.ts`                                |
| T-9  | The init command line is written out 60 times, and a `package.json` literal 18 times. Tool names, timeouts and fixture text sit at the top of each test file.                                                                     | `grep -c "'--no-install'" tests/repositories/*.test.ts`   |
| T-10 | `lifecycle/`, `doctor/`, `commands/`, `platform/`, `apple/`, `web/`, `pyproject/` and `supabase/` hold no unit test. The unit tests hold 2,197 lines for 24,650 lines of source.                                                  | `ls packages/cli/tests/unit`                              |
| T-11 | Two test files have names that do not say what they test: `repository-check.test.ts` tests a `[[check]]` entry, and `scope-languages.test.ts` tests presets selected in a scope.                                                  | `tests/repositories/`                                     |
| T-12 | No test measures time. Nothing fails when `init` or a staged check gets slower.                                                                                                                                                   | `tests/performance` does not exist                        |
| T-13 | No test plants a hook that calls a task, a setup task that sets the hooks path, a fresh clone, a `[tool.ruff]` table, or an existing `lint` script.                                                                               | `tests/repositories/takeover.test.ts`, `hooks.test.ts`    |

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

## What the September 19 read covered

Read line by line:

- `lifecycle/` except `questions.ts`, `upgrade/`, and the parts of `carry.ts` below the readers;
- `run/plan.ts`, `execute.ts`, `check-command.ts`, `cache.ts`, `baselines.ts`, `tool-runner.ts`,
  `fixers.ts`, `broken-tool.ts`, `session.ts`, `scope-paths.ts` and `record/write.ts`;
- `emit/targets.ts`, `hooks.ts`, `stubs.ts` and `runner-surface.ts`;
- `repository/scopes.ts`, `existing-tooling.ts`, and `presets/detect.ts`;
- `policy/propose.ts` and `write.ts`;
- `structure/engine.ts`, `directories.ts`, `analyses/prefix-collisions.ts`, and the plugin rule
  `no-prefix-collisions`;
- `naming/extract.ts`, `paths.ts`, and `presets/naming/policy.json`;
- `config/patterns.ts`, `carry.ts`, `reasons.ts`, `markers.ts`, and the head of `shell.ts`;
- `tests/harness/planted.ts`, and four test files in full: `structure`, `repository-check`,
  `scope-languages` and `hooks`;
- in yap-swift-app: `gspot.toml`, `gspot.local.toml`, every root stub, the hooks, the mise
  file, the list of baselines, `last.json`, and the head of `GSPOT-MIGRATION.md`.

Searched, not read:

- the other 48 test files, by their titles, their init flags and their skips;
- every preset manifest, for `stub`, `stage` and `naming` keys;
- all of `packages/cli/src`, for preset ids, tool names, suppressions, and environment reads.

Not read:

- `doctor/`, `integrity/`, `output/`, `platform/`, `profile/`, `prose/`, `rules/`, `apple/`,
  `pyproject/`, `web/`, `sql/`, `postgres/`, `supabase/`, `cargo/`, `golang/`, `express/`;
- the other 19 files of `policy/` and 8 of `run/`;
- `types/`, and `config/` beyond the files named above;
- `packages/eslint-plugin` beyond one rule, and its 27 rule tests;
- the unit tests under `packages/cli/tests/unit`;
- the templates of every preset.

The gap rows above are therefore a floor. A read of the folders in the last list comes before the
Adoption phase closes.

The comparison with other tools comes from their documented behavior, not from a fresh read of
their repositories.
