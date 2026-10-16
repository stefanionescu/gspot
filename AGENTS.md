<!-- >>> gspot managed >>> -->

# Rules

Level: `all`.

Read `.gspot/rules/general/engineering/agent/WORKING.md` and `.gspot/rules/general/prose/WRITING.md` first. Then read the rules for the files you change. A more specific rule wins over a general one.

Languages:

- `.gspot/rules/language/javascript/BUN.md`
- `.gspot/rules/language/javascript/COMPONENTS.md`
- `.gspot/rules/language/javascript/JAVASCRIPT.md`
- `.gspot/rules/language/javascript/NAMING.md`
- `.gspot/rules/language/javascript/NODE.md`
- `.gspot/rules/language/typescript/NAMING.md`
- `.gspot/rules/language/typescript/TYPESCRIPT.md`
- `.gspot/rules/language/css/CSS.md`
- `.gspot/rules/language/css/NAMING.md`
- `.gspot/rules/language/html/HTML.md`
- `.gspot/rules/language/html/NAMING.md`

Infrastructure:

- `.gspot/rules/infrastructure/github-actions/GITHUB-ACTIONS.md`

General:

- `.gspot/rules/general/commits/GIT.md`
- `.gspot/rules/general/dependencies/DEPENDENCIES.md`
- `.gspot/rules/general/docs/DOCS.md`
- `.gspot/rules/general/engineering/agent/PLANNING.md`
- `.gspot/rules/general/engineering/agent/SUPPRESSIONS.md`
- `.gspot/rules/general/engineering/agent/TALKING.md`
- `.gspot/rules/general/engineering/agent/TASKS.md`
- `.gspot/rules/general/engineering/code/ACCESSIBILITY.md`
- `.gspot/rules/general/engineering/code/CLI.md`
- `.gspot/rules/general/engineering/code/COMMENTS.md`
- `.gspot/rules/general/engineering/code/CONFIGURATION.md`
- `.gspot/rules/general/engineering/code/ERRORS.md`
- `.gspot/rules/general/engineering/code/HTTP.md`
- `.gspot/rules/general/engineering/code/LOGGING.md`
- `.gspot/rules/general/engineering/code/TESTING.md`
- `.gspot/rules/general/files/YAML.md`
- `.gspot/rules/general/gspot/GENERATED.md`
- `.gspot/rules/general/naming/NAMING.md`
- `.gspot/rules/general/secrets/SECRETS.md`
- `.gspot/rules/general/security/SECURITY.md`

Frameworks:

- `.gspot/rules/framework/astro/ASTRO.md`
- `.gspot/rules/framework/site/SITE.md`

Libraries:

- `.gspot/rules/library/zod/ZOD.md`

Platforms:

- `.gspot/rules/platform/cloudflare/CLOUDFLARE.md`

Run `mise exec -- gspot check --staged` before you commit. To change gspot.toml, use `mise exec -- gspot set`, `mise exec -- gspot unset`, `mise exec -- gspot ignore`, or `mise exec -- gspot unignore`. After you edit gspot.toml by hand, run `mise exec -- gspot apply`. Never edit files under `.gspot/`, or these generated files: `.editorconfig`, `.github/workflows/gspot.yml`, `.markdownlint-cli2.mjs`, `.prettierignore`, `.semgrepignore`, `bunfig.toml`, `docs/.stylelintrc.json`, `eslint.config.mjs`, `prettier.config.mjs`. Change `gspot.toml` and run `mise exec -- gspot apply` instead.

<!-- <<< gspot managed <<< -->

Do not use subagents or parallel agents unless asked in the conversation.

## Folders

- Each package keeps its fixed values (constants, lists, tables of names, paths, file names, limits, URLs, and
  command arguments) in a `config/` folder, and its TypeScript types in a `types/` folder:
  `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, `scripts/`, and `tests/`.
- `config/` imports only from `config/` of the same package. `types/` imports only from `config/` and `types/` of
  the same package, and may use `import type` from a library when a type extends a library type. `tests/types/` may
  also `import type` from the CLI package; `tests/config/` imports only from `tests/config/`.
- Write every exported type by hand in `types/<area>/<topic>.ts`, in plain TypeScript. Check each zod schema
  against its type with `satisfies z.ZodType<T>`. No exported type uses `z.infer`.
- Keep a type in its own file when only that file uses it. Declare allowed names as an `as const` array in
  `config/`, its type as `(typeof LIST)[number]` in `types/`, and its schema as `z.enum(LIST)`.
- Every other file takes its constants from `config/` and its types from `types/`, and declares no module-level
  constants or exported types of its own. Zod schemas and values computed at import time stay in their own files.
- Group `config/` and `types/` by topic, one file per topic, such as
  `packages/cli/src/config/checks/language/bash.ts` or `packages/cli/src/types/settings/tables.ts`.
  Do not mirror the source tree. Split a file over 300 lines by topic.
- Apply these folder rules to this repository only. gspot does not ask other repositories to follow them.
- Tests: unit tests in `tests/unit/cli/` and `tests/unit/eslint-plugin/`, integration tests in `tests/integration/`,
  end-to-end tests in `tests/e2e/`, shared test code in `tests/setup/`, test constants and sample data in
  `tests/config/`, shared test types in `tests/types/`.
- The configurations gspot ships live in `packages/cli/configurations/`. The code that reads them lives in
  `packages/cli/src/configurations/`. The schema of `gspot.toml` lives in `packages/cli/src/settings/schema/`.

## Code

- Delete a function that only calls another function; call the other one directly. Keep a callback that an API
  needs, and a calculation that several callers share.
- Name a check that runs a tool after the tool, so readers know which lint rules and suppression comments apply.
  Name a built-in check after what it checks. Both start with the configuration name.

## Commits

- Commit straight to main. Do not open branches or pull requests.
- A commit message says what changed and why, in plain words. Do not list test counts, ledger counts, or byte counts.

## Owner decisions

Keep these final decisions. Never reverse one inside other work.

- 2026-10-11: By default, delete: a file, option, setting, flag, or test that does not earn its place goes.
- 2026-10-06: Fix the cause; never work around it. Use one setting for each concern: no special time limits,
  per-suite or per-operating-system budgets, environment switches, or options for one caller.
- 2026-10-06: gspot ships only as JavaScript on npm. Never add per-operating-system binaries, standalone archives,
  platform packages, or a release-archive pin.
- 2026-10-11: The CLI provides 14 commands, one job each: init, install, apply, check, add, remove, set, unset, ignore,
  unignore, list, explain, doctor, and export.
- 2026-10-06: Keep every shipped banned naming group complete; apply them at level `all`
  only.
- 2026-10-06: The rule `TALKING.md` ships in every installation: "When you talk, use ASD-STE100."
- 2026-10-06: The documentation site uses generativespotting.com and deploys to Cloudflare Workers.
- 2026-10-03: No scheduled CI.
- 2026-10-06: No GitHub environments. This overrides the environment requirement in `GITHUB-ACTIONS.md`.
- 2026-10-07: Use one name for each concept in the Names table below. Never give one thing two names or one name two
  meanings.
- 2026-10-07: This repository has no `CONTRIBUTING.md`. Repository rules that no check enforces live in this file.

## Names

| Concept                                   | Name                                         |
| ----------------------------------------- | -------------------------------------------- |
| Settings file and its values              | `gspot.toml`, settings                       |
| Selection of checks                       | configuration                                |
| One result from a check                   | finding                                      |
| One linter instruction                    | lint rule                                    |
| Markdown for coding agents                | rules                                        |
| Detail of checking                        | level: `recommended` or `all`                |
| When a check runs                         | stage: `commit`, `push`, `message`, `manual` |
| A user command run as a check             | command check                                |
| A `[[...]]` block                         | record, with a singular header               |
| A value that loosens a check              | `{ value = ..., reason = "..." }`            |
| Program installation                      | package manager or mise                      |
| The machine and operating system code     | system                                       |
| Files copied for a check                  | scratch copy                                 |
| The test suites                           | unit, integration, e2e                       |
| Code that prepares and runs tests         | test setup                                   |
| A temporary repository for a test         | sandbox                                      |
| Test values                               | test data, in `tests/config/` by topic       |
| Fixed values                              | `config/`                                    |
| TypeScript types                          | `types/`                                     |
| Generation and installation code          | apply, install, ownership                    |
| Record of files gspot writes              | ownership log                                |
| File content changes                      | file edit                                    |
| A check implemented by gspot              | built-in check                               |
| Package registries                        | registry                                     |
| The lint extension package                | ESLint plugin                                |
| Text written by the user                  | your own                                     |
| `.env.example`                            | env example                                  |
| Functions that read environment variables | environment readers                          |
| One run's state                           | run state                                    |
| A file's kind and its source              | file classification                          |
| Parsed source for convention checks       | convention source                            |
| A scope's naming values                   | naming settings                              |

Preserve official names of external tools, formats, and APIs. Use one name for each concept. A code name has the same meaning as its text name.

## Dependency overrides

The root `package.json` overrides keep transitive packages on security fixes. Keep each override
until its callers resolve a fixed version without it. Verify a forced major version with the
packages that use it before changing it.

| Override                  | Version  | Advisory and reason                                                                                                                                      |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handlebars`              | `4.7.10` | [GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7) — Prevents JavaScript injection from precompiled templates.                     |
| `js-yaml@3`               | `4.3.2`  | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — Bounds empty merge-source processing; Jest requests major 3.                  |
| `postcss-selector-parser` | `7.1.6`  | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — Bounds flat-selector processing; PurgeCSS and postcss-nested request major 6. |
| `sharp`                   | `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — Fixes the bundled librsvg vulnerability; Miniflare pins 0.35.4.               |
| `undici@7`                | `7.29.1` | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) — Preserves TLS validation options in BalancedPool.                             |
