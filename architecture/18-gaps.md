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

The Phase 7 presets, the deeper unit tests, and the manual rewrite
(G-10). The acceptance runs over yap-text-inference, yap-landing, and slopshop are owed.

gspot runs on yap-swift-app: branch `chore/gspot` of that repository holds the migration (D-97),
and [17-migration.md](17-migration.md) lists the defects it exposed. Each one is fixed with a test.

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

A person can turn the naming check off today with `gspot ignore naming/identifiers` and a reason,
and can turn one tool off with `tools.<name>.enabled = false` and a reason. G-5 is about the
preset: no command drops it, `init` offers no choice, and nothing carries the choice to another
repository.

## Presets that do not ship

Every preset with a file under [presets/](presets/README.md) ships: 45 of them. Seven Phase 7
presets have no file there yet: `react`, `react-native`, `django`, `nestjs`, `ruby`,
`vue`, and `svelte`.

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
