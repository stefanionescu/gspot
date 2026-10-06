# Repository Setup and Ceremony

5 unresolved review records remain. IDs and verification evidence are retained in the JSON checklist.

## Findings

| ID                     | Where                                                    | Problem                                                                                                                                                                                                                                                                                                                                  | Fix                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `areas/repository/025` | `scripts/acceptance.ts:10-38`                            | 29 lines limit the arguments to paths under `tests/acceptance`, `-t`, and `--shard`. Bun already rejects unknown options.                                                                                                                                                                                                                | Pass the arguments to `bun test` unchanged, with `./acceptance` as the default. About 10 lines remain.                                                                          |
| `areas/repository/039` | `package.json:16-49`                                     | One list holds three groups: workspace tools, test libraries (`ajv`, `testdirs`, `verdaccio`, `@typescript-eslint/rule-tester`), and lint packages that tests link into planted repositories (`tests/harness/cli/modules.ts:5`). `tests/package.json:4` says the planted packages live there. `@gspothq/eslint-plugin` is in both files. | Move the test libraries and planted packages to `tests/package.json`. Keep TypeScript, the type packages, and the install scanner at the root. Run the suites once to confirm.  |
| `areas/repository/040` | `package.json:11`                                        | Bun 1.4.2 is pinned four times: `packageManager`, `engines.bun` (read by `tests/harness/runtime.ts:4`), `mise.toml:20`, and `@types/bun`.                                                                                                                                                                                                | Delete `packageManager` if gspot still detects Bun from `bun.lock`.                                                                                                             |
| `areas/repository/043` | `.prettierrc.json`, `.gspot/config/prettier.json`        | The two files are identical. The check reads one, and editors read the other.                                                                                                                                                                                                                                                            | Point the check at `.prettierrc.json`, or make the root file a `prettier.config.mjs` that re-exports the generated file, as `eslint.config.mjs` does. This is a product change. |
| `areas/repository/057` | `packages/cli/kits/framework/nestjs/manifest.toml:38-48` | Two selectors forbid a controller to inject `Repository`, `DataSource`, `EntityManager`, `PrismaClient`, or `PrismaService`. That is a layering choice with a fixed list of ORM names, not a NestJS rule.                                                                                                                                | Owner decides: keep it in the kit, or leave layering to each project.                                                                                                           |

Architecture material from the original audit follows. Current repository decisions are recorded in [progress](../progress.json).

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
