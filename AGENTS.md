<!-- >>> gspot managed >>> -->

# Rules

Read these rules first:

- `.gspot/rules/WORKING.md`
- `.gspot/rules/WRITING.md`
- `.gspot/rules/TALKING.md`

Read a rule below when its sentence fits your task.
A rule marked `in <folder>/` applies only to files in that folder.
A more specific rule wins over a general one.

## Languages

- `.gspot/rules/BASH.md`: when you write or change a shell script.
- `.gspot/rules/BUN.md`: when code runs on Bun.
- `.gspot/rules/COMPONENTS.md`: when you change an Astro, Svelte, Vue, or React component.
- `.gspot/rules/CSS.md` in `docs/`: when you change a stylesheet or the style block of a component.
- `.gspot/rules/HTML.md` in `docs/`: when you change HTML or an HTML template.
- `.gspot/rules/JAVASCRIPT.md`: when you change JavaScript or TypeScript code.
- `.gspot/rules/NODE.md`: when code runs on Node.
- `.gspot/rules/OPERATIONS.md`: when you write a deployment, publishing, or remote shell script.
- `.gspot/rules/PLAYWRIGHT.md`: when you write or change a Playwright test.
- `.gspot/rules/SAFETY.md`: when a shell script deletes files, downloads, uses `sudo`, starts background jobs, or parses JSON or YAML.
- `.gspot/rules/TYPESCRIPT.md`: when you change TypeScript code.

## Frameworks

- `.gspot/rules/ASTRO.md` in `docs/`: when you change Astro components, pages, or content collections.
- `.gspot/rules/SITE.md` in `docs/`: when you change a site that a build turns into static HTML.

## Platforms

- `.gspot/rules/CLOUDFLARE.md` in `docs/`: when code runs on Cloudflare Workers or Pages, or when you change a Wrangler file, `_headers`, or `_redirects`.

## Infrastructure

- `.gspot/rules/GITHUB-ACTIONS.md`: when you change a GitHub Actions workflow or action.

## Libraries

- `.gspot/rules/ZOD.md` in `packages/cli/`, `tests/`: when you write or change a Zod schema.

## General

- `.gspot/rules/ACCESSIBILITY.md`: when you change a user interface.
- `.gspot/rules/CLI.md`: when you change a command-line program that the project ships.
- `.gspot/rules/COMMENTS.md`: when you write or change a comment.
- `.gspot/rules/DEPENDENCIES.md`: before you add, upgrade, or remove a dependency.
- `.gspot/rules/DOCS.md`: when you write or change documentation.
- `.gspot/rules/ERRORS.md`: when you write code that raises, catches, or reports an error.
- `.gspot/rules/GENERATED.md`: when you change a generated file, or the code that writes one.
- `.gspot/rules/GIT.md`: before you commit, push, tag, or open a pull request.
- `.gspot/rules/NAMING.md`: when you name a file, folder, type, function, or variable.
- `.gspot/rules/PLANNING.md`: before you write a plan.
- `.gspot/rules/SECRETS.md`: when code reads, stores, or logs a secret.
- `.gspot/rules/SECURITY.md`: when code handles input, authentication, redirects, or downloads.
- `.gspot/rules/SETTINGS.md`: when you change how a program reads its settings or environment.
- `.gspot/rules/SUPPRESSIONS.md`: before you add a suppression comment or run `gspot ignore`.
- `.gspot/rules/TASKS.md`: when you change `mise` tasks, `package.json` scripts, a `Makefile`, or another task runner.
- `.gspot/rules/TESTING.md`: when you write or change a test.
- `.gspot/rules/YAML.md`: when you change a `.yml` or `.yaml` file.

## Commands

The rules write `gspot` for `mise exec -- gspot`.

Commit, and fix what the hook reports. Before you push, run `gspot check --changed --stage push`.

To change `gspot.toml`, run `gspot set`, `unset`, or `unignore`.
When `gspot check` or `gspot doctor` names a new configuration, ask the user, then run the `gspot add` line it prints and `gspot install`.
Run `gspot ignore` or `gspot remove` only after the user agrees, with a reason.
After you edit `gspot.toml`, a package manifest, or a tsconfig, run `gspot install`.

## Generated files

`.gitattributes` marks each file that gspot writes `linguist-generated`, in the block between the gspot markers.
Do not edit these files. Change `gspot.toml`, then run `gspot install`.

gspot also sets one key in `bunfig.toml`: `install.security.scanner`.
You can edit the other keys of that file.

<!-- <<< gspot managed <<< -->

## This repository

- In a new clone, run `mise install`, `mise run setup`, and `mise exec -- gspot install`.
- Commit straight to `main`. Do not open branches or pull requests.
- Run the integration file of a changed configuration, when it has one, before you push it.
- A check runs at commit unless it builds, uses the network or Docker, runs tests, analyzes a whole program (tsc,
  knip, basedpyright, deptry, vulture, jscpd, Semgrep), or reads pushed commits. A few others also run at push, such as
  `dependencies/syncpack` and `secrets/environment-examples`.
- A check that runs a linter takes the linter's name. A check that runs a project command takes the name of what it
  checks.
- A unit test runs the source in process. It may run Git, `mkfifo`, the test programs in `tests/setup/programs/`, and
  the npm tools that `mise run setup` installs from the manifests into `node_modules/.test-tools/`, but makes no
  network call.
- A test that installs tools, runs the packed packages, or contacts a registry belongs in `tests/suites/integration/`.
  It runs a real tool to prove what only the tool can show: a config it accepts, output gspot parses, or an install
  that works.
- `tests/suites/e2e/` installs the packed packages into a fresh project.
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
- In `packages/`, read and write files synchronously, except a large copy, and run processes asynchronously.
- Use the types that a package publishes when the code already depends on that package. Do not add a dependency for its
  types alone.
- Write a JavaScript module that a generated config loads as a TypeScript source in the `files/` folder of its
  configuration. The manifest names it as the `source` of its config file, and gspot transpiles it.
- Write `the user's repository`, not `this repository` or `a repository`, whenever more than one repository fits the
  sentence.
- Keep the owner's descriptions word for word: the first sentence of `README.md`, and the `description` in
  `packages/cli/package.json`.

## Folders

These rules apply to `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/`. Here they override
four shipped rules:

- NAMING.md says "Prefer feature folders to top-level type buckets."
- ZOD.md says "Put a runtime schema with the feature that owns the contract."
- TYPESCRIPT.md asks for a module-level constant per number.
- TESTING.md says "Put builders, fakes, servers, and database code in one folder beside the tests." Here they sit in
  `tests/setup/`, one subfolder per job.

### Values, types, and schemas

- Keep a fixed value, type, or runtime schema at the top of the module that reads it, as WORKING.md says. When two or
  more modules read it, keep it in `config/`, `types/`, or `schemas/`. A value computed at import time stays with the
  behavior that uses it.
- Move a value only when you change the code that reads it. Do not move values in a separate sweep.
- Each of those folders holds one file per layer, such as `config/<layer>.ts`:
    - The CLI layers follow the folders under "Commands and layers." Layer `main` serves `main.ts`, `bin.ts`, and
      `reference.ts`.
    - The layers of `tests/` follow the CLI layers of `tests/suites/unit/cli/`, and add `eslint-plugin`, `integration`,
      `e2e`, and `setup`.
    - The ESLint plugin and the docs site form one layer each, with one file per topic.
- A value that several layers read sits in the file of the lowest layer that all of them may import, which in `tests/`
  means `setup`. Values of one subject stay together, in the lowest layer that any of them needs.
- A tool's rule table that a settings schema reads sits in the `manifest.toml` of the configuration that owns the tool.
- A file splits only when it passes the file length limit. It then becomes a folder `<layer>/` with one file per topic,
  such as `packages/cli/src/config/configurations/naming.ts`. A topic is a subfolder of the layer or one subject.
- Merge a small topic into the closest topic file. No file in these folders holds a single export or takes the name of
  its folder.
- Infer each type that a schema describes from that schema: `z.infer<typeof schema>`, or `z.input` for the value before
  its defaults and transforms. `types/` may import the schema file of any layer. Write a type in plain TypeScript only
  when no schema describes it.
- When two or more modules read a list of allowed names, declare it as an `as const` array in `config/`, its type as
  `(typeof LIST)[number]` in `types/`, and its schema as `z.enum(LIST)` in `schemas/`. A list whose values each carry a
  description keeps its schema literals as the one list.
- When only types read a list of names, write it as a union type in `types/`, with no array.

### Configurations

- `packages/cli/src/configurations/<group>/<configuration>/` holds one configuration: `manifest.toml`, its rule files
  in `rules/`, the files that gspot ships in `files/`, its checks in `checks.ts`, and its generator.
- When the checks of a configuration pass the file length limit, `checks.ts` becomes a folder `checks/` with one file
  per check, named after it, or per input that several checks read.
- A configuration keeps its generators in `generate.ts`, or in one file for each file it writes, named for that file,
  such as `knip.ts` and `swiftlint.ts`.
- `files/` holds the files that gspot copies or transpiles into `.gspot/configurations/<group>/<configuration>/`. A
  TypeScript module in `files/` runs in the user's repository, so it imports only Node built-ins and, with
  `import type`, types.
- Code that several configurations share sits at the top of `configurations/`, such as `registry.ts`, `syntax.ts`, and
  `tsc/`. Code that belongs to one configuration stays in its folder when another configuration reuses it, such as the
  Postgres migrations reader that supabase reads.

### ESLint plugin

`packages/eslint-plugin/src/rules/<topic>/` holds one file per rule. A topic says what its rules check, and holds at
least two rules.

### Commands and layers

- `packages/cli/src/commands/` has one file per command, `commands/<command>.ts`. A command that needs more files gets
  a folder `commands/<command>/` with the entry file `<command>.ts`. The one other file is
  `packages/cli/src/commands/edits.ts`, which holds the `gspot.toml` edits that several commands share.
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

- A unit test file mirrors the source file it tests, with the same name. `tests/suites/unit/<package>/<path>.test.ts`
  tests `packages/<package>/src/<path>.ts`. A test of a whole source folder takes the folder name.
- When the tests of one source file or folder pass 300 lines, they become a folder of that name with one file per
  scenario.
- An integration test mirrors what it runs, such as
  `tests/suites/integration/configurations/<group>/<configuration>.test.ts`, `commands/<command>.test.ts`, or
  `installers/<module>.test.ts` for `packages/cli/src/tools/installers/<module>`. Past 300 lines, the tests of one
  configuration become a folder with one file per tool.
- File text that one test writes only to make a file exist, and that no assertion compares, stays at the call that
  writes it.
- RuleTester cases, command arguments, and sandbox file names stay beside their call.
