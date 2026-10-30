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

## Platforms

- `.gspot/configurations/platform/cloudflare/rules/CLOUDFLARE.md` in `docs/`: when code runs on Cloudflare Workers.

## Libraries

- `.gspot/configurations/library/zod/rules/ZOD.md` in `packages/cli/`, `tests/`: when you write or change a Zod schema.

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

- In a new clone, run `mise install`, `mise run setup`, and `mise exec -- gspot install`.

- Commit straight to `main`. Do not open branches or pull requests.
- A check that runs a linter takes the linter's name. A check that runs a project command takes the name of what it
  checks.
- A unit test runs the source in process. It may run Git, `mkfifo`, and the npm tools that `mise run setup` installs
  from the manifests into `node_modules/.test-tools/`, but makes no network call.
- A test that installs tools, runs the packed packages, or contacts a registry belongs in `tests/suites/integration/`.
  `tests/suites/e2e/` installs the packed packages into a fresh project.
- In unit check tests, choose the entrypoint for the assertion:
    - Use `runSandboxCheck` for one check's findings or error.
    - Use `planSandboxCheck` with `getBuiltInCheck` when files or the run cache change after the session opens.
    - Use `runCheckCode` for a command check whose plan the test changes.
    - Use `runChecks` with `buildRunOptions` for status, notes, skip causes, or cancellation.
    - Use `assertCheckSample` for a sample that fails and passes after its fix.
- Keep CLI calls, and imports of the functions that the check registry names, out of `tests/suites/unit/cli/checks/`.
  A test may import such a function when other product code imports it too. Exit codes, JSON output, and other CLI
  behavior belong to `tests/suites/unit/cli/commands/`.
- End no file with an export list.
- Throw `GspotError` for what the user can fix. Throw a plain `Error` only for a broken invariant.
- Read and write files synchronously; run processes asynchronously.
- Write every type as a TypeScript `type` alias.
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

### Values, types, and schemas

- Each package keeps fixed values in `config/`, TypeScript types in `types/`, and runtime schemas in `schemas/`.
- Other files take their constants from `config/` and their types from `types/`. They declare no module-level
  literal constants or types. Declare schemas only in `schemas/`, including schemas used by one file.
  A value computed at import time stays with the behavior that uses it.
- Each folder of code reads one file in `config/`, one in `types/`, and one in `schemas/`. That file takes the path
  of the folder, such as `packages/cli/src/config/runs/copy.ts` for the files in `packages/cli/src/runs/copy/`.
- When the folder of that path also holds files of subfolders, the file sits inside it under the folder name, such as
  `packages/cli/src/config/generation/generation.ts` for the files in `packages/cli/src/generation/`.
- The files at the top of a package read `packages/cli/src/config/main.ts`, or
  `packages/eslint-plugin/src/config/plugin.ts` in the ESLint plugin.
- A value that code in other folders also reads stays in the file of the folder it belongs to. The others import it.
- Values that several folders read and no folder owns go in a topic file, such as
  `packages/cli/src/config/files/names.ts`.
- When a folder's file passes the file length limit, move its largest topic to a file named for that topic, such as
  `packages/cli/src/schemas/settings/tables.ts`.
- When two files of one folder need values of the same kind, prefix each name with its check, rule, or language, such
  as `DOCS_RULES` and `GSPOT_RULES`.
- Infer each type that a schema describes from that schema: `z.infer<typeof schema>`, or `z.input` for the value
  before its defaults and transforms. The type stays in `types/` and imports the schema with `import type`. Write a
  type in plain TypeScript only when no schema describes it.
- When runtime code reads a list of allowed names, declare it as an `as const` array in `config/`, its type as
  `(typeof LIST)[number]` in `types/`, and its schema as `z.enum(LIST)`. A list whose values each carry a description
  keeps its schema literals as the one list.
- When only types read a list of names, write it as a union type in `types/`, with no array.

### Checks and generators

- `packages/cli/src/checks/` has one file per configuration, `checks/<group>/<configuration>.ts`, under the group of
  its folder in `packages/cli/configurations/`.
- When the checks of a configuration pass the file length limit, they move to a folder
  `checks/<group>/<configuration>/`. That folder has one file per check, named after it, or per input that several
  checks read.
- Code that several configurations share sits in `checks/cross-configuration/` or `generation/config-files/`.
- Code that belongs to one configuration stays in its folder when another configuration reuses it, such as the
  Postgres migrations reader that supabase reads.
- The code of one configuration sits at `<group>/<configuration>` in every tree: its shipped files in
  `packages/cli/configurations/`, its checks, its generators, and its tests. One code file sits at
  `<group>/<configuration>.ts`, and more files make the folder `<group>/<configuration>/`.
- The code that writes a config file sits in `packages/cli/src/generation/configurations/<group>/<configuration>/`,
  named for the file it writes. gspot writes that file to `.gspot/configurations/<group>/<configuration>/`.

### Commands and layers

- `packages/cli/src/commands/` has one file per command, `commands/<command>.ts`. A command that needs more files gets
  a folder `commands/<command>/` with the entry file `<command>.ts`.
- A command's folder holds the code that only that command uses. Code on the subject of another layer, such as Git
  revisions, copies, settings text, or the terminal, stays in that layer even when one command calls it.
- Code that a second command or a check also uses sits in the folder of the thing it handles, such as `installers/` or
  `generation/`. No folder outside `commands/` takes a command's name.
- `system/` holds the code every layer may import: access to files, processes, Git, the environment, and the terminal,
  and the pure text and value helpers that `parsers/` needs.
- The layers of `packages/cli/src/` run from the base up: `system/`, `parsers/`, `manifests/`, `repository/`,
  `settings/`, `planning/`, `executables/`, `installers/`, `generation/`, `runs/`, `checks/`, `commands/`, then
  `main.ts` and `bin.ts`.
- A layer imports only the layers before it. Every layer may import `config/` and `types/`, and the `schemas/` files
  of a layer belong to that layer. `types/` imports the schemas of any layer, to infer types from them.
- The `[[import_rule]]` records in `gspot.toml` list the layers in this order, and `gspot check` reports an import
  that breaks it.

### Tests

- `tests/suites/` holds the `unit/`, `integration/`, and `e2e/` suites. `tests/setup/` holds the code that tests share,
  in one subfolder per job; a job of one file, such as `matchers.ts`, sits at the top of `tests/setup/`.
- A unit test file mirrors the source file it tests, with the same name. `tests/suites/unit/<package>/<path>.test.ts`
  tests `packages/<package>/src/<path>.ts`. A test of a whole source folder takes the folder name.
- When the tests of one source file or folder pass 300 lines, they become a folder of that name with one file per
  scenario.
- An integration test mirrors what it runs: `tests/suites/integration/checks/<group>/<configuration>.test.ts`,
  `commands/<command>.test.ts`, or `installers/<module>.test.ts`. Past 300 lines, the tests of one configuration become
  a folder with one file per tool.
- `tests/suites/integration/ci.test.ts` tests `packages/cli/src/generation/ci.ts`.
- `tests/config/` holds the values of each folder of tests, by the rules of `config/`. The values of the tests in
  `tests/suites/unit/cli/<folder>/` sit at `tests/config/<folder>`.
- The values of the other suites sit under `tests/config/integration/`, `tests/config/eslint-plugin/`, and
  `tests/config/setup/`. The values of the e2e suite sit in `tests/config/e2e.ts`.
- A value goes to `tests/config/` when two tests share it. A value that one test reads stays in that test, even when
  it reads it twice. File text that only makes a file exist, and that no assertion compares, stays at each call that
  writes it.
- RuleTester cases, command arguments, and sandbox file names stay beside their call.
- `tests/types/` holds the types of the tests, and `tests/schemas/` the schemas that read tool output in tests. Each
  stays one flat folder of topic files.

## Dependency overrides

The root `package.json` overrides keep transitive packages on security fixes.

| Override   | Version  | Advisory and reason                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `undici@7` | `7.30.1` | [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472), [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) — Bounds EventSource memory and content-encoding handling, and checks Subresource Integrity for algorithm names in any case; Miniflare pins 7.29.1. |
