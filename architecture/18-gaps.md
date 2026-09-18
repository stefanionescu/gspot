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

gspot has never run on yap-swift-app. No `swift` preset and no `xcode` preset exist under
`presets/`. No Swift naming extractor exists. No acceptance harness exists. The 29 configuration
files and the `quality/` folder of that repository are untouched.

The working tree holds the first pieces only: `packages/cli/grammars/swift.wasm` and three tool pins in `mise.toml`. Those
two files fail `integrity/large-files` and `config-files/toml-format` until they are declared
and formatted.

## Gaps

| Id   | Gap                                           | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ---- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1  | git tracks 93 files under `node_modules`      | `.gitignore` holds `/node_modules/`, which matches the root folder only. `docs/node_modules`, `packages/cli/node_modules` and `packages/eslint-plugin/node_modules` are tracked.                                                                                                                                                                          |
| G-2  | Tests cover less than the roadmap said        | 54 of the 73 check ids appear in no test file. Three of the 12 presets have a planted repository: bash, commits and config-files. No shell structure check has a planted defect. `tests/acceptance`, `tests/parity` and `tests/performance` are empty. `doctor/`, `emit/apply.ts`, `emit/carry.ts`, `run/plan.ts` and `run/execute.ts` have no unit test. |
| G-3  | `schema/` is empty and the schema URL is dead | `build.ts` writes `schema/gspot.schema.json` during a build and nothing commits it. `docs/public/` does not serve it. Every `gspot.toml` opens with `#:schema https://gspot.dev/schema/gspot.schema.json`. Nothing writes `run-record.schema.json`.                                                                                                       |
| G-4  | The rule corpus depends on the lint stack     | 12 rule files tell the reader to run `gspot check`. 22 lines rely on "the gate". 36 tool names remain, led by ShellCheck with 10 and ESLint with 8. A repository that installs the rule files alone reads instructions for a tool it does not have.                                                                                                       |
| G-5  | A person cannot drop a core preset            | Every language preset holds `requires = ["structure", "naming", "formatting", "spelling"]`. `gspot init --without naming,structure` keeps both and prints no message.                                                                                                                                                                                     |
| G-6  | No install of the rule files alone            | `gspot init --presets ""` falls back to detection and prints no message. An install of the linting alone works through `--rules no`.                                                                                                                                                                                                                      |
| G-7  | The init plan does not name the selection     | `gspot init --dry-run` lists the files it writes. It lists no preset and no check.                                                                                                                                                                                                                                                                        |
| G-8  | No portable profile                           | A person cannot save a selection with its settings and apply it in another repository. No `extends` key, no `init --from` flag and no decision cover it.                                                                                                                                                                                                  |
| G-9  | `doctor` reports wrong states                 | It reports 15 installed npm libraries as `missing`, because the probe looks for a binary. It labels a binary file `secrets scan only` when no secrets preset is selected. It reports markdownlint-cli2 2.0.0 against a 0.23.2 pin as `newer` and passes.                                                                                                  |
| G-10 | The documentation is thin                     | The six guides hold 1,445 words. The root `README.md` holds 25 lines and omits the Example, Key capabilities and Troubleshooting sections of `rules/templates/docs/README.md`. `packages/eslint-plugin` is published and has no README. No contributing guide exists. `docs/readme-shape` passes all of it.                                               |
| G-11 | vale is pinned twice                          | `mise.toml` and `.config/mise/conf.d/gspot.toml` both pin it. `gspot doctor` reports it.                                                                                                                                                                                                                                                                  |
| G-12 | `.gitignore` is incomplete                    | `/dist/` appears twice. `coverage/`, `.env`, `.env.*` with `!.env.example`, and `.vscode/` are absent.                                                                                                                                                                                                                                                    |
| G-13 | Two conventions for constants                 | `packages/cli` keeps constants in `config/`. `packages/eslint-plugin` keeps 47 constants beside the rules that use them. No decision records which one a package follows.                                                                                                                                                                                 |

## Defects that break an install

Each row was reproduced by running the command in the second column.

| Id  | Defect                                    | Reproduction                                                                                                                                       | Owner                              |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| B-6 | The release tag does not reach the binary | `GSPOT_VERSION` is a literal in `run/version-pin.ts`. The plugin holds a second literal. `publish.ts` stamps the tag into the npm manifests only.  | `run/version-pin.ts`, `publish.ts` |
| B-7 | The release tests never run               | Both suites skip unless `GSPOT_RELEASE_TEST` is set. No workflow sets it.                                                                          | `tests/release`                    |
| B-8 | One command line holds every file         | `{files}` expands to the whole list with no batching. A scope with several thousand files, or Windows with its 32 KB limit, cannot start the tool. | `run/tool-runner.ts`, `expandPart` |

## Code gaps

| Id   | Gap                                                                                                                                                                                                                                                         | Owner                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| K-1  | The install step and the first baseline exist twice and differ. The upgrade copy does not skip a check that owns a `baseline_command`, so ESLint gets count baselines beside its suppressions file.                                                         | `emit/first-run.ts`, `emit/upgrade/command.ts`            |
| K-2  | Helpers exist more than once: the loosening test, the scope holder lookup, `compact`, `configurationName`, the table guard in four forms, and `GLOB_CHARS` with three character sets.                                                                       | `policy/`, `presets/read.ts`, `run/tool-runner.ts`        |
| K-3  | The format defaults live in the formatting manifest, in `FORMAT_DEFAULTS` and in `SHIPPED_TAB_WIDTH` with `SHIPPED_PRINT_WIDTH`.                                                                                                                            | `policy/merge.ts`, `emit/questions.ts`                    |
| K-4  | The names of the removable and the permanent naming groups are literals in three files, not data in `presets/naming/policy.json`.                                                                                                                           | `naming/engine.ts`, `naming/policy.ts`, `policy/audit.ts` |
| K-5  | No tool run has a timeout. Both blocking spawn paths and the Windows path ignore `timeoutMs`, so the version probe timeout does nothing.                                                                                                                    | `platform/spawn.ts`                                       |
| K-6  | A fixer's exit code is dropped, so a fixer that crashed counts as run.                                                                                                                                                                                      | `run/fixers.ts`                                           |
| K-7  | `check --fix --dry-run` copies `node_modules` and `.venv` into a temporary folder.                                                                                                                                                                          | `run/fixers.ts`, `scratchCopy`                            |
| K-8  | `run/` and `emit/` import the tool probe from `doctor/`. The probe belongs under `platform/`.                                                                                                                                                               | `doctor/probes.ts`                                        |
| K-9  | The probe treats every tool row as an executable under `node_modules/.bin`, reads the root `node_modules` only, and fixes the mise shim folder to one path. This is the cause of G-9.                                                                       | `doctor/probes.ts`                                        |
| K-10 | The list of known keys for an error message comes from zod internals (`def`, `shape`, `catchall`).                                                                                                                                                          | `policy/read.ts`, `shapeAt`                               |
| K-11 | `writtenLimit` decides whether a limit was written by a substring match on a display label.                                                                                                                                                                 | `policy/merge.ts`                                         |
| K-12 | `gspot remove naming` prints `removed` while `requires` selects it again. Removing a preset that is not listed prints the same.                                                                                                                             | `policy/commands.ts`                                      |
| K-13 | `gspot allow gitleaks`, `osv` and `licenses` write keys of presets that do not ship, and the settings surface then refuses them.                                                                                                                            | `policy/allow-command.ts`                                 |
| K-14 | 20 of 29 owner rows and 9 of 13 check rows in takeover name presets that do not ship. The code cannot run today.                                                                                                                                            | `emit/takeover.ts`, `emit/carry.ts`                       |
| K-15 | The carry readers drop a file that does not parse and print nothing. The ESLint reader works line by line, so a rule turned off for some files becomes an ignore for the repository.                                                                        | `emit/carry.ts`                                           |
| K-16 | `uninstall` leaves the devDependencies and scripts in `package.json`, the husky lines and the lefthook block.                                                                                                                                               | `emit/uninstall.ts`                                       |
| K-17 | The core names preset ids: `swift`, `prose`, `typescript` and `commits`.                                                                                                                                                                                    | `emit/targets.ts`, `emit/apply.ts`, `emit/init-plan.ts`   |
| K-18 | The shipped binary holds private project names and the residue list of a one-time corpus repair. `gspot apply --check` lints the embedded corpus in every repository. Both belong to a `[[check]]` of this repository.                                      | `config/statements.ts`, `emit/apply.ts`                   |
| K-19 | The managed block always ends with the `gspot check --staged` sentence, also with no hooks and no checks. Part of G-4.                                                                                                                                      | `rules/managed-block.ts`                                  |
| K-20 | The 25 general rule files, 25,875 words, install as one block. `rules.install` is a boolean, so a person cannot leave a file or a layer out.                                                                                                                | `rules/assemble.ts`                                       |
| K-21 | Presets load from embedded assets only. A person cannot add a preset. `[[check]]` is the one extension point, and it cannot name an output format.                                                                                                          | `presets/read.ts`, `policy/schema.ts`                     |
| K-22 | `init` asks about hooks, CI, rule files, the runner and the format. It asks nothing about presets or checks.                                                                                                                                                | `emit/questions.ts`                                       |
| K-23 | A shell reference is any identifier on a line that is not a comment, so a name inside a string counts as a call. Calls are matched by regular expression beside a parsed tree. No test covers these analyses.                                               | `structure/cross-file-index.ts`, `structure/analyses/`    |
| K-24 | The shared structure context carries `bashText`, `bashList` and `bashSetting`. Every code analysis is for shell.                                                                                                                                            | `structure/engine.ts`                                     |
| K-25 | Nine integrity checks return nothing outside the root scope and read the whole file set. The manifest key `whole = true` exists for the same purpose.                                                                                                       | `integrity/`                                              |
| K-26 | A dependency folder counts as vendored, so no check reports that git tracks one. G-1 went unseen for that reason.                                                                                                                                           | `repository/natures.ts`                                   |
| K-27 | The plugin exports 26 rules and no `configs`. It has its own glob matcher with no `!` and no character class, while the CLI uses picomatch over the same patterns.                                                                                          | `packages/eslint-plugin/src`                              |
| K-28 | The ESLint template holds 411 lines of JavaScript, and its test holds 21.                                                                                                                                                                                   | `presets/javascript/eslint.config.js.tmpl`                |
| K-29 | No coverage is measured. No test runs a compiled binary with the present assets.                                                                                                                                                                            | `bunfig.toml`, `.github/workflows/ci.yml`                 |
| K-30 | The root README lists 14 commands and leaves out `completion`. [02-cli.md](02-cli.md) counts sixteen with `profile` (D-79). The manual also holds a page for the hidden `complete` command.                                                                 | `README.md`, `docs/`                                      |
| K-31 | `coverage.partial` in the run record is always 0.                                                                                                                                                                                                           | `run/execute.ts`                                          |
| K-32 | The `docs/generated` check tells the reader to run `bun docs/generate.ts`. The script is `docs/reference-pages.ts`.                                                                                                                                         | `docs/reference-pages.ts`                                 |
| K-33 | The code reads `GSPOT_JOBS`, which [02-cli.md](02-cli.md) did not list, and no code reads `GSPOT_LOG`, which it listed. The specification now lists `GSPOT_BIN` and `GSPOT_JOBS`.                                                                           | `platform/environment.ts`                                 |
| K-34 | Six words carry more than one meaning, four ideas have several names, and ten names say the wrong thing. [19-names.md](19-names.md) holds each one with its one name (D-92).                                                                                | the whole tree                                            |
| K-35 | The enforcement ledger lands `ansible-lint` on `config-files/ansible-lint`, and no preset ships the check. The GitHub Actions rule file installs with the cloudflare preset only. Swift tests have no preset (D-93). The specification now holds all three. | `presets/config-files`, `presets/xctest`                  |

A person can turn the naming check off today with `gspot ignore naming/identifiers` and a reason,
and can turn one tool off with `tools.<name>.enabled = false` and a reason. G-5 is about the
preset: no command drops it, `init` offers no choice, and nothing carries the choice to another
repository.

## Presets that do not ship

[presets/README.md](presets/README.md) lists 42 presets, and 12 ship. No `secrets`,
`vulnerabilities`, `dependencies` or `licenses` preset ships.

A full replacement of the yap-swift-app gate needs 11 presets that do not ship: `swift`, `xcode`,
`sql`, `postgres`, `supabase`, `secrets`, `vulnerabilities`, `dependencies`, `licenses`, `docker`
and `nginx`. That repository holds 159 files under `quality/` and 102 mise task files. Its
TypeScript, shell and Markdown files can run under gspot in a detached worktree once the
acceptance harness exists.

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
| G-8                     | D-79                                           | [02-cli.md](02-cli.md), [03-configuration.md](03-configuration.md)     |
| G-5, G-7, K-12, K-22    | D-80                                           | [04-presets.md](04-presets.md), [02-cli.md](02-cli.md)                 |
| G-4, G-6, K-19, K-20    | D-81                                           | [09-rules.md](09-rules.md)                                             |
| the order of the phases | D-82                                           | [13-roadmap.md](13-roadmap.md), [17-migration.md](17-migration.md)     |
| B-6, B-7, K-29          | D-84                                           | [12-repository-layout.md](12-repository-layout.md)                     |
| K-18                    | D-86                                           | [09-rules.md](09-rules.md)                                             |
| G-9, K-9                | D-87                                           | [04-presets.md](04-presets.md)                                         |
| K-27                    | D-88                                           | [12-repository-layout.md](12-repository-layout.md)                     |
| B-8, K-5, K-6, K-7      | D-89                                           | [14-decisions.md](14-decisions.md)                                     |
| K-21                    | D-90                                           | [14-decisions.md](14-decisions.md)                                     |
| K-13, K-14, K-17        | D-91                                           | [14-decisions.md](14-decisions.md)                                     |
| publishing              | none needed                                    | [11-toolchain.md](11-toolchain.md)                                     |
| the Swift rule sets     | none needed                                    | [presets/swift.md](presets/swift.md), [presets/sql.md](presets/sql.md) |

The other rows need no decision. Each one is a defect against text this folder already holds:

- G-1 to G-3 and G-10 to G-13;
- K-1 to K-4, K-8, K-10, K-11, K-15 and K-16;
- K-23 to K-26, K-28 and K-30 to K-33.

K-34 is decided in D-92 and K-35 in D-93.

## Not read

These files were not read line by line:

- `output/`, except `completion.ts` and `prompts.ts`;
- `repository/manifests.ts`, `repository/existing-tooling.ts` and `repository/tags.ts`;
- `platform/paths.ts`, `platform/install-hints.ts` and `platform/executable-bit.ts`;
- most of `config/` and all of `types/`;
- 23 of the 26 ESLint rules and nine of the 23 structure analyses;
- `integrity/fences.ts`, `integrity/readme/`, `integrity/docs-headings.ts` and
  `integrity/tsconfig-options.ts`;
- the text of the rule corpus, the six guides of the manual, and documents 01 to 12 of this
  folder in full.

The comparison with other tools comes from their documented behavior, not from a fresh read of
their repositories.
