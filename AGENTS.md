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
- Run the integration file of a changed configuration before you push it.
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
- Keep CLI calls, and imports of the functions that the check registry names, out of `tests/suites/unit/cli/configurations/`.
  A test may import such a function when other product code imports it too. Exit codes, JSON output, and other CLI
  behavior belong to `tests/suites/unit/cli/commands/`.
- When a mise pin changes, fill its `checksums` in the manifest from
  `mise lock --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64`.
- End no file with an export list.
- Throw `GspotError` for what the user can fix. Throw a plain `Error` only for a broken invariant.
- Read and write files synchronously; run processes asynchronously.
- Write every type as a TypeScript `type` alias.
- Use the types that a package publishes when the code already depends on that package. Do not add a dependency for its
  types alone.
- Write a JavaScript module that gspot ships as a TypeScript source in the `files/` folder of its configuration,
  `packages/cli/src/configurations/<group>/<configuration>/files/`. The manifest names it as the `source` of its config
  file, and gspot transpiles it.
- Do not use subagents or parallel agents unless asked in the conversation.
- Keep the owner's descriptions word for word: the first sentence of `README.md`, and the `description` in
  `packages/cli/package.json`. The docs, `llms.txt`, `gspot --help`, and the GitHub repository description build their
  copies from these two sources.

## Folders

These folder rules apply to `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/` in this
repository.

### Values, types, and schemas

- `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/` keep fixed values in `config/`,
  TypeScript types in `types/`, and runtime schemas in `schemas/`, and a folder of code holds only code. Other files
  declare no module-level literal constants, types, or schemas. A value computed at import time stays with the
  behavior that uses it.
- Each of these folders holds one file per layer: `config/<layer>.ts`, `types/<layer>.ts`, and `schemas/<layer>.ts`.
- The CLI layers follow the folders under "Commands and layers." Layer `main` serves `main.ts`, `bin.ts`, and
  `reference.ts`.
- The layers of `tests/` follow the CLI layers of `tests/suites/unit/cli/`, and add `eslint-plugin`, `integration`,
  `e2e`, and `setup`. The ESLint plugin and the docs site form one layer each, with one file per topic.
- A value, type, or schema that several layers read sits in the file of the lowest layer that all of them may import.
  In `tests/`, that layer means `setup`. Values of one subject stay together, in the lowest layer that any of them
  needs.
- A tool's rule table that a settings schema reads sits in the `manifest.toml` of the configuration that owns the tool.
- A file splits only when it passes the file length limit. It then becomes a folder `<layer>/` with one file per
  topic, named for the topic, such as `packages/cli/src/config/configurations/naming.ts`. Take a subfolder of the
  layer or one subject as a topic.
- No file holds a single export, no file takes the name of its folder, and no folder holds one file. Merge a small
  topic into the closest topic file.
- When two values of one file need the same name, prefix each with its check, rule, or language, such as
  `SITE_RULES` and `TRANSLATION_RULES`.
- Infer each type that a schema describes from that schema: `z.infer<typeof schema>`, or `z.input` for the value
  before its defaults and transforms. `types/` may import the schema file of any layer. Write a type in plain
  TypeScript only when no schema describes it.
- When runtime code reads a list of allowed names, declare it as an `as const` array in `config/`, its type as
  `(typeof LIST)[number]` in `types/`, and its schema as `z.enum(LIST)` in `schemas/`. A list whose values each carry
  a description keeps its schema literals as the one list.
- When only types read a list of names, write it as a union type in `types/`, with no array.
- Ambient declarations, such as `packages/cli/src/types/global.d.ts`, sit in `types/` beside the layer files.
- The `[[import_rule]]` record of each CLI layer in `gspot.toml` also names its files in `config/`, `types/`, and
  `schemas/`, so `gspot check` reports a value that a layer reads from a layer above it.

### Configurations

- `packages/cli/src/configurations/<group>/<configuration>/` holds one configuration: `manifest.toml`, its rule files
  in `rules/`, the files that gspot ships in `files/`, its checks in `checks.ts`, and its generator.
- When the checks of a configuration pass the file length limit, `checks.ts` becomes a folder `checks/` with one file
  per check, named after it, or per input that several checks read.
- A configuration with one generator names it `generate.ts`. A configuration that generates several files names each
  generator for the file it writes, such as `knip.ts` and `swiftlint.ts`.
- `files/` holds the files that gspot copies or transpiles into `.gspot/configurations/<group>/<configuration>/`. A
  TypeScript module in `files/` runs in the user's repository, so it imports only types, with `import type`.
- Code that several configurations share sits at the top of `configurations/`, such as `registry.ts`, `syntax.ts`, and
  `tsc/`. Code that belongs to one configuration stays in its folder when another configuration reuses it, such as the
  Postgres migrations reader that supabase reads.
- `packages/cli/src/configurations/registry.ts` joins the check and config file names of the manifests to their code.
  The engine gets the check code through `RunOptions.selectCheckCode`, and a check reads the generated files through
  `CheckSession.generation`, so neither layer imports a layer above it.
- The npm package ships `manifest.toml`, `rules/`, and `files/` of each configuration from their paths under
  `packages/cli/src/configurations/`, where the runtime reads them.

### Commands and layers

- `packages/cli/src/commands/` has one file per command, `commands/<command>.ts`. A command that needs more files gets
  a folder `commands/<command>/` with the entry file `<command>.ts`.
- A command's folder holds the code that only that command uses. Code on the subject of another layer, such as Git
  revisions, copies, settings text, or the terminal, stays in that layer even when one command calls it.
- Code that a second command or a check also uses sits in the folder of the thing it handles, such as
  `tools/installers/` or `generation/`. No folder outside `commands/` takes a command's name.
- `system/` holds the code every layer may import: access to files, processes, the environment, and the terminal, and
  the pure text and value helpers that `parsers/` needs. Git sits in `repository/git/`.
- The layers of `packages/cli/src/` run from the base up: `system/`, `parsers/`, `manifests/`, `repository/`,
  `settings/`, `tools/`, `engine/`, `configurations/`, `generation/`, `commands/`, then `main.ts`, `bin.ts`, and
  `reference.ts`.
- A layer imports only itself and the layers before it, its values, types, and schemas included.
- The `[[import_rule]]` records in `gspot.toml` list the layers in this order, and `gspot check` reports an import
  that breaks it.

### Tests

- `tests/suites/` holds the `unit/`, `integration/`, and `e2e/` suites. `tests/setup/` holds the code that tests share,
  in one subfolder per job; a job of one file, such as `matchers.ts`, sits at the top of `tests/setup/`.
- A unit test file mirrors the source file it tests, with the same name. `tests/suites/unit/<package>/<path>.test.ts`
  tests `packages/<package>/src/<path>.ts`. A test of a whole source folder takes the folder name.
- When the tests of one source file or folder pass 300 lines, they become a folder of that name with one file per
  scenario.
- An integration test mirrors what it runs: `tests/suites/integration/configurations/<group>/<configuration>.test.ts`,
  `commands/<command>.test.ts`, or `installers/<module>.test.ts` for `packages/cli/src/tools/installers/<module>`. Past
  300 lines, the tests of one configuration become a folder with one file per tool.
- `tests/suites/integration/ci.test.ts` tests `packages/cli/src/generation/ci.ts`.
- `tests/config/`, `tests/types/`, and `tests/schemas/` follow "Values, types, and schemas." The values of the tests in
  `tests/suites/unit/cli/engine/` sit in `tests/config/engine/`, and those of the e2e suite in `tests/config/e2e.ts`.
- `tests/config/setup/` holds the values of `tests/setup/` and the values that tests of several layers read.
- A value goes to `tests/config/` when two tests share it. A value that one test reads stays in that test, even when
  it reads it twice. File text that only makes a file exist, and that no assertion compares, stays at each call that
  writes it.
- RuleTester cases, command arguments, and sandbox file names stay beside their call.
- `tests/schemas/` holds the schemas that read tool output in tests.
