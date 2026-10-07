# Repository Setup and Ceremony

4 unresolved review records remain. IDs and verification evidence are retained in the JSON checklist.

## Findings

| ID                     | Where                                                    | Problem                                                                                                                                                                                                                                                                                                                                  | Fix                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `areas/repository/039` | `package.json:16-49`                                     | One list holds three groups: workspace tools, test libraries (`ajv`, `testdirs`, `verdaccio`, `@typescript-eslint/rule-tester`), and lint packages that tests link into planted repositories (`tests/harness/cli/modules.ts:5`). `tests/package.json:4` says the planted packages live there. `@gspothq/eslint-plugin` is in both files. | Move the test libraries and planted packages to `tests/package.json`. Keep TypeScript, the type packages, and the install scanner at the root. Run the suites once to confirm.  |
| `areas/repository/040` | `package.json:11`                                        | Bun 1.4.2 is pinned four times: `packageManager`, `engines.bun` (read by `tests/harness/runtime.ts:4`), `mise.toml:20`, and `@types/bun`.                                                                                                                                                                                                | Delete `packageManager` if gspot still detects Bun from `bun.lock`.                                                                                                             |
| `areas/repository/043` | `.prettierrc.json`, `.gspot/config/prettier.json`        | The two files are identical. The check reads one, and editors read the other.                                                                                                                                                                                                                                                            | Point the check at `.prettierrc.json`, or make the root file a `prettier.config.mjs` that re-exports the generated file, as `eslint.config.mjs` does. This is a product change. |
| `areas/repository/057` | `packages/cli/kits/framework/nestjs/manifest.toml:38-48` | Two selectors forbid a controller to inject `Repository`, `DataSource`, `EntityManager`, `PrismaClient`, or `PrismaService`. That is a layering choice with a fixed list of ORM names, not a NestJS rule.                                                                                                                                | Owner decides: keep it in the kit, or leave layering to each project.                                                                                                           |

Architecture material from the original audit follows. It is history: where it disagrees with a later decision or with the target trees in [the source layout review](../review/source-layout.md) and [the test layout review](../review/tests-layout.md), those win. Superseded here: `tests/runners/` does not apply; `scripts/` owns suite orchestration (decision of October 4, 2026). The package `tsconfig.json` files stay (owner-questions, settled D22). `database.yml` stays (settled `areas/repository.md` Q4). The release attaches no archives and the workflows use no GitHub environments (`review/owner-decisions/001`, `006`).

Names follow [the glossary](../review/glossary.md), which wins over every name below: a template that builds a tool file is an Eta source, and only the file `gspot export` writes is a template. Current repository decisions are recorded in [progress](../progress.json).

## Target layout

```text
Today
.
├── .editorconfig                 generated
├── .gitattributes
├── .github/workflows/
│   ├── ci.yml
│   ├── database.yml              by hand only, runs the whole tool suite
│   ├── docs.yml                  release trigger never fires, deploy gated off
│   ├── pins.yml                  by hand only, so never run
│   └── release.yml               `$/` reference, installs every tool
├── .gitignore
├── .gspot/
├── .mise/conf.d/
│   ├── gspot-tools.toml          written by gspot
│   └── test-tools.toml           written by scripts/test-tools.ts
├── .prettierignore               generated
├── .prettierrc.json              generated copy of .gspot/config/prettier.json
├── .semgrepignore                generated
├── AGENTS.md  CONTRIBUTING.md  LICENSE.md  README.md
├── bun.lock  bunfig.toml
├── docs/
├── eslint.config.mjs             generated pointer
├── gspot.toml
├── mise.toml                     17 tasks
├── package.json
├── packages/
│   ├── cli/                      scripts/{build,grammars,pins}.ts, tsconfig.json
│   └── eslint-plugin/            build.ts at the package root, tsconfig.json
├── scripts/
│   ├── acceptance.ts
│   ├── gspot
│   ├── package.ts
│   ├── plugin.ts
│   ├── swiftformat.ts
│   └── test-tools.ts
├── tests/
└── tsconfig.json

After
.
├── .editorconfig                 generated; template drops the repeated shell values
├── .gitattributes                unchanged
├── .github/workflows/
│   ├── ci.yml                    + check:pins step, no --skip-tools, setup steps written once
│   ├── database.yml              by hand only, runs one test (or deleted)
│   ├── docs.yml                  workflow_call + dispatch, no release trigger
│   └── release.yml               `./` reference, calls docs.yml, installs only Bun and Node
├── .gitignore                    drops *.local, two debug-log lines, .dist-* staging
├── .gspot/                       unchanged
├── .mise/conf.d/
│   └── gspot-tools.toml          gspot's file, alone in gspot's folder
├── .prettierignore  .prettierrc.json  .semgrepignore   generated
├── AGENTS.md  CONTRIBUTING.md  LICENSE.md  README.md
├── bun.lock  bunfig.toml
├── docs/
├── eslint.config.mjs
├── gspot.toml                    about 60 lines shorter; node_version and roles.runtime fixed
├── mise.test.toml                was .mise/conf.d/test-tools.toml, loaded with MISE_ENV=test (question)
├── mise.toml                     no gspot, apply, check:release tasks, no dev alias; install → install:checks
├── package.json                  workspace tools only; test inputs move to tests/package.json
├── packages/
│   ├── cli/                      scripts/{build,grammars}.ts; no tsconfig.json
│   └── eslint-plugin/            scripts/build.ts (moved); no tsconfig.json
├── scripts/
│   ├── gspot                     source CLI on the mise PATH for the hooks
│   ├── pins.ts                   moved from packages/cli/scripts/
│   └── test-tools.ts             writes mise.test.toml
├── tests/
│   └── runners/                  acceptance.ts, package.ts, plugin.ts moved from scripts/
└── tsconfig.json                 excludes packages/*/dist

Deleted: .github/workflows/pins.yml, scripts/swiftformat.ts (if SwiftFormat is declared macOS and Linux only)
```

## Status on October 6, 2026

A read-only verification checked every record against the code at commit `3e1445a2d`. "Partial" means part of the fix is done. The location column gives the current file, because many files moved after the record was written.

| ID                     | Status  | Current location and evidence                                                                                                                           | What remains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `areas/repository/039` | partial | Test libraries (testdirs, ajv, rule-tester) moved to tests/package.json                                                                                 | Move from the root `package.json:16-49` to `tests/package.json` the packages that only tests use: the ESLint packages that `tests/harness/platforms.ts:39-55` links into planted repositories (`eslint`, `@eslint/js`, `typescript-eslint`, `@typescript-eslint/parser`, `globals`, `eslint-config-prettier`, `eslint-import-resolver-typescript`, and the `eslint-plugin-*` and `@eslint-community/*` entries; this repository's own lint loads them from `.gspot/node_modules`), and `@clack/prompts`, `jsonc-parser`, and `yaml` (root copies of `packages/cli` dependencies that only tests import). Run `git grep -l <name> -- scripts packages docs` once for each moved name; if a root script imports it, keep it at the root. Delete `@gspothq/eslint-plugin` from the root `package.json`: the tests import it and declare it, while the root scripts only name its paths. Keep `semver`, `smol-toml`, `zod`, `prettier`, `typescript`, the type packages, and the install scanner at the root for `scripts/`. Do not keep `verdaccio` anywhere: `review/owner-decisions/005` deletes it and its overrides. |
| `areas/repository/040` | open    | package.json:10-13 packageManager and engines.bun, mise.toml:20, @types/bun all pin 1.4.2                                                               | Keep `packageManager` in `package.json`: gspot reads the exact declared version from it to pick the package manager (`packages/cli/src/tools/npm/installer.ts:45-67`). Delete `engines.bun` and make `tests/harness/preload.ts:6` read the Bun version from `packageManager`. `mise.toml:20` installs Bun and `@types/bun` is a type package, so `package.json` then pins Bun once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `areas/repository/043` | open    | .prettierrc.json and .gspot/config/prettier.json are byte-identical                                                                                     | Replace the root `.prettierrc.json` copy with a generated `prettier.config.mjs` pointer that imports `.gspot/config/prettier.json` and exports it, as the root `eslint.config.mjs` does for ESLint. The check and editors then read one file. Write the pointer only when a JavaScript configuration is selected (`areas/developer-experience/021`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `areas/repository/057` | open    | packages/cli/configurations/framework/nestjs/manifest.toml:37-46 still forbids Repository/DataSource/EntityManager/PrismaClient/PrismaService injection | Delete the two selectors at `packages/cli/configurations/framework/nestjs/manifest.toml:37-46` that forbid a controller to inject `Repository`, `DataSource`, `EntityManager`, `PrismaClient`, or `PrismaService`; layering belongs to each repository (answer to owner question Q9). Keep the React Native AsyncStorage rule. The `NESTJS.md` lines that restate the selectors are `review/configurations-plugin/057`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
