<!-- >>> gspot managed >>> -->

# Rules

Read these rules first:

- `.gspot/configurations/general/engineering/rules/WORKING.md`
- `.gspot/configurations/general/prose/rules/WRITING.md`
- `.gspot/configurations/general/engineering/rules/TALKING.md`

Read a rule below when its sentence fits your task.
A rule marked `in <folder>/` applies only to files in that folder.
A more specific rule wins over a general one.

## Languages

- `.gspot/configurations/language/javascript/rules/BUN.md`: when code runs on Bun.
- `.gspot/configurations/language/javascript/rules/COMPONENTS.md`: when you change an Astro, Svelte, Vue, or React component.
- `.gspot/configurations/language/javascript/rules/JAVASCRIPT.md`: when you change JavaScript or TypeScript code.
- `.gspot/configurations/language/javascript/rules/NODE.md`: when code runs on Node.
- `.gspot/configurations/language/typescript/rules/TYPESCRIPT.md`: when you change TypeScript code.
- `.gspot/configurations/language/bash/rules/BASH.md`: when you write or change a shell script.
- `.gspot/configurations/language/bash/rules/OPERATIONS.md`: when you write a deployment, publishing, or remote shell script.
- `.gspot/configurations/language/bash/rules/SAFETY.md`: when a shell script deletes files, downloads, uses `sudo`, starts background jobs, or parses JSON or YAML.
- `.gspot/configurations/language/css/rules/CSS.md` in `docs/`: when you change a stylesheet.
- `.gspot/configurations/language/html/rules/HTML.md` in `docs/`: when you change HTML or an HTML template.

## Infrastructure

- `.gspot/configurations/infrastructure/github-actions/rules/GITHUB-ACTIONS.md`: when you change a GitHub Actions workflow or action.

## General

- `.gspot/configurations/general/commits/rules/GIT.md`: before you commit, push, tag, or open a pull request.
- `.gspot/configurations/general/data-files/rules/YAML.md`: when you change a `.yml` or `.yaml` file.
- `.gspot/configurations/general/dependencies/rules/DEPENDENCIES.md`: before you add, upgrade, or remove a dependency.
- `.gspot/configurations/general/docs/rules/DOCS.md`: when you write or change documentation.
- `.gspot/configurations/general/engineering/rules/ACCESSIBILITY.md`: when you change a user interface.
- `.gspot/configurations/general/engineering/rules/CLI.md`: when you change a command-line program that the project ships.
- `.gspot/configurations/general/engineering/rules/COMMENTS.md`: when you write or change a comment.
- `.gspot/configurations/general/engineering/rules/ERRORS.md`: when you write code that raises, catches, or reports an error.
- `.gspot/configurations/general/engineering/rules/HTTP.md`: when you change an HTTP service.
- `.gspot/configurations/general/engineering/rules/LOGGING.md`: when you add or change logging.
- `.gspot/configurations/general/engineering/rules/PLANNING.md`: before you write a plan.
- `.gspot/configurations/general/engineering/rules/SETTINGS.md`: when you change how a program reads its settings or environment.
- `.gspot/configurations/general/engineering/rules/TASKS.md`: when you change `mise` tasks, `package.json` scripts, a `Makefile`, or another task runner.
- `.gspot/configurations/general/engineering/rules/TESTING.md`: when you write or change a test.
- `.gspot/configurations/general/gspot/rules/GENERATED.md`: when you change a generated file, or the code that writes one.
- `.gspot/configurations/general/gspot/rules/SUPPRESSIONS.md`: before you add a suppression comment or run `gspot ignore`.
- `.gspot/configurations/general/naming/rules/NAMING.md`: when you name a file, folder, type, function, or variable.
- `.gspot/configurations/general/secrets/rules/SECRETS.md`: when code reads, stores, or logs a secret.
- `.gspot/configurations/general/security/rules/SECURITY.md`: when code handles input, authentication, redirects, or downloads.

## Frameworks

- `.gspot/configurations/framework/astro/rules/ASTRO.md` in `docs/`: when you change Astro components, pages, or content collections.
- `.gspot/configurations/framework/site/rules/SITE.md` in `docs/`: when you change a site that a build turns into static HTML.

## Libraries

- `.gspot/configurations/library/zod/rules/ZOD.md` in `docs/`, `packages/cli/`, `tests/`: when you write or change a Zod schema.

## Platforms

- `.gspot/configurations/platform/cloudflare/rules/CLOUDFLARE.md` in `docs/`: when code runs on Cloudflare Workers.

## Commands

The rules write `gspot` for `mise exec -- gspot`.

Before you commit, run `mise exec -- gspot check --staged`.

To change `gspot.toml`, run `mise exec -- gspot set`, `unset`, `add`, `remove`, `ignore`, or `unignore`.
After you edit `gspot.toml` by hand, run `mise exec -- gspot apply`.

## Generated files

Do not edit these files. Change `gspot.toml`, then run `mise exec -- gspot apply`.

- every file under `.gspot/`
- `.editorconfig`
- `.github/workflows/gspot.yml`
- `.markdownlint.jsonc`
- `.prettierignore`
- `docs/.stylelintrc.json`
- `eslint.config.mjs`
- `prettier.config.mjs`

gspot also sets one key in `bunfig.toml`: `install.security.scanner`.
You can edit the other keys of that file.

<!-- <<< gspot managed <<< -->

## This repository

- Commit straight to `main`. Do not open branches or pull requests.
- Name a tool check after its tool. Name a built-in check after what it checks.
- A unit test runs the source in process. It may run Git and the tools of `tests/node_modules`, but makes no network
  call.
- A test that installs tools, runs the packed packages, or contacts a registry belongs in `tests/suites/integration/`.
  `tests/suites/e2e/` installs the packed packages into a fresh project.
- In unit check tests, choose the entrypoint for the assertion:
    - Use `runSandboxCheck` for one check's findings or error.
    - Use `planSandboxCheck` with `findBuiltInCheck` when files or the read cache change after the session opens.
    - Use `runCheckCode` for a command check whose plan the test changes.
    - Use `runChecks` with `buildRunOptions` for status, notes, skip causes, or cancellation.
    - Use `runCheckSample` for a sample that fails and passes after its fix.
- Keep CLI calls and direct imports of check functions out of `tests/suites/unit/cli/checks/`. Exit codes, JSON output, and
  other CLI behavior belong to `tests/suites/unit/cli/commands/`.
- Give every exported function a doc comment, as the lint rules require. Write no other comments: names say what the
  code does.
- Export a declaration where you declare it. End no file with an export list.
- Write every type as a TypeScript `type` alias. Never write JSDoc type tags in a `.ts` file.
- Use the types that a package publishes when the code already depends on that package. Do not add a dependency for its
  types alone.
- Write a JavaScript module that gspot ships as a TypeScript source in `packages/cli/configurations/`. The manifest
  names it as the `source` of its config file, and gspot transpiles it.
- Do not use subagents or parallel agents unless asked in the conversation.
- Keep the owner's descriptions word for word: the first sentence of `README.md`, and the `description` in
  `packages/cli/package.json`. Their copies in the docs, `llms.txt`, and `gspot --help` match them.

## Folders

These folder rules apply to `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/` in this
repository.

- Each package keeps fixed values in `config/`, TypeScript types in `types/`, and runtime schemas in `schemas/`.
- Other files take their constants from `config/` and their types from `types/`. They declare no module-level
  literal constants or types. Declare schemas only in `schemas/`, including schemas used by one file.
  A value computed at import time stays with the behavior that uses it.
- Give each `config/`, `types/`, and `schemas/` file the path of the code that reads it. For example,
  `packages/cli/src/config/generation/ci.ts` holds the values of `packages/cli/src/generation/ci.ts`.
- Values that several files of one folder read go in the config file of that folder, named for their topic. Values
  that several top-level folders read go at the top of `config/`, named for their topic.
- Write each exported type in plain TypeScript. Do not export a `z.infer` type.
- Check the shape of each Zod object schema with `satisfies SchemaShape<T>`, and any other schema with
  `satisfies z.ZodType<T>`. Give each schema one check.
- Declare a list of allowed names as an `as const` array in `config/`, its type as `(typeof LIST)[number]` in
  `types/`, and its schema as `z.enum(LIST)`. A list whose values each carry a description keeps its schema literals
  as the one list.
- `packages/cli/src/checks/` has one file per configuration, `checks/<group>/<configuration>.ts`, under the group of
  its folder in `packages/cli/configurations/`.
- When the checks of a configuration pass the file length limit, they move to a folder `checks/<group>/<configuration>/`. That
  folder has one file per check, named after it, or per input that several checks read.
- Code that checks of several configurations share sits at the top of `checks/`. Code that belongs to one
  configuration stays in its folder when another configuration reuses it, such as the Postgres migrations reader that
  supabase reads.
- The code of one configuration sits at the same path in every tree. Its shipped files sit in
  `packages/cli/configurations/<group>/<configuration>/`, and its checks in `packages/cli/src/checks/<group>/`.
- The code that writes a config file sits in `packages/cli/src/generation/configurations/<group>/<configuration>/`,
  named for the file it writes. gspot writes that file to `.gspot/configurations/<group>/<configuration>/`.
- A folder of one code file merges into its parent folder. For example, the one generator of the `dependencies`
  configuration sits in `packages/cli/src/generation/configurations/general/dependencies.ts`.
- Code that several configurations share stays at the top of `checks/` or in `generation/config-files/`.
- `packages/cli/src/commands/` has one file per command, `commands/<command>.ts`. A command that needs more files gets
  a folder `commands/<command>/` with the entry file `<command>.ts`.
- `system/` holds the code every layer may import: access to files, processes, Git, the environment, and the terminal,
  and the pure text and value helpers that `parsers/` needs.
- A unit test file mirrors the source file it tests, with the same name. `tests/suites/unit/<package>/<path>.test.ts` tests
  `packages/<package>/src/<path>.ts`. A test of a whole source folder takes the folder name.
- When the tests of one source file or folder pass 300 lines, they become a folder of that name with one file per
  scenario.
- An integration test mirrors what it runs: `tests/suites/integration/checks/<group>/<configuration>.test.ts`,
  `commands/<command>.test.ts`, or `install/<module>.test.ts`. Past 300 lines, the tests of one configuration become a
  folder with one file per tool.
- `tests/config/` mirrors the tests. `tests/config/<path>.ts` holds the values of `tests/suites/<suite>/<path>.test.ts`, and the
  test files of one folder may share `tests/config/<folder>.ts`.
- `suites/` and `unit/cli/` drop out of a `tests/config/` path. Values that only the integration suites read live under
  `tests/config/integration/`.
- A value goes to `tests/config/` when two test files read it, when it forms a `test.each` table with expected results,
  or when it has more than five lines. RuleTester cases and the arguments of a command stay beside their call.
- `tests/suites/` holds the `unit/`, `integration/`, and `e2e/` suites. `tests/setup/` holds the code that tests share,
  in one subfolder per job.
- `tests/types/` holds the types that two or more test files share, and `tests/schemas/` the schemas that read tool
  output in tests.

## Dependency overrides

The root `package.json` overrides keep transitive packages on security fixes.

| Override                  | Version  | Advisory and reason                                                                                                                                                                               |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handlebars`              | `4.7.10` | [GHSA-xw65-4hp5-5hc7](https://github.com/advisories/GHSA-xw65-4hp5-5hc7) — Prevents JavaScript injection from precompiled templates; eslint-plugin-boundaries and @boundaries/elements pin 4.7.9. |
| `js-yaml@3`               | `4.3.2`  | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) — Removes the unpatched sprintf-js dependency chain that @istanbuljs/load-nyc-config receives through major 3.           |
| `postcss-selector-parser` | `7.1.6`  | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — Bounds flat-selector processing; PurgeCSS and postcss-nested request major 6.                                          |
| `sharp`                   | `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — Fixes the bundled librsvg vulnerability; Miniflare pins 0.35.4.                                                        |
| `undici@7`                | `7.29.1` | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) — Preserves TLS validation options in BalancedPool; Miniflare pins 7.29.0.                                               |
