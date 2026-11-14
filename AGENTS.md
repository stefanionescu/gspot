<!-- >>> gspot managed >>> -->

# Rules

Read `.gspot/rules/WORKING.md` and `.gspot/rules/WRITING.md` first.
Read a rule below when its sentence fits your task.
A rule marked `in <folder>/` applies only to files in that folder.
A more specific rule wins over a general one.

- `.gspot/rules/ACCESSIBILITY.md`: when you change a user interface.
- `.gspot/rules/ASTRO.md` in `docs/`: when you change Astro components, pages, or content collections.
- `.gspot/rules/BASH.md`: when you write or change a shell script.
- `.gspot/rules/CLI.md`: when you change a command-line program that the project ships.
- `.gspot/rules/CLOUDFLARE.md` in `docs/`: when code runs on Cloudflare Workers or Pages, or when you change a Wrangler file, `_headers`, or `_redirects`.
- `.gspot/rules/COMMENTS.md`: when you write or change a comment.
- `.gspot/rules/COMPONENTS.md`: when you change an Astro, Svelte, Vue, or React component.
- `.gspot/rules/CSS.md` in `docs/`: when you change a stylesheet or the style block of a component.
- `.gspot/rules/DEPENDENCIES.md`: before you add, upgrade, or remove a dependency.
- `.gspot/rules/DOCS.md`: when you write or change documentation.
- `.gspot/rules/ERRORS.md`: when you write code that raises, catches, or reports an error.
- `.gspot/rules/GENERATED.md`: when you change a generated file, or the code that writes one.
- `.gspot/rules/GIT.md`: before you commit, push, tag, or open a pull request.
- `.gspot/rules/GITHUB-ACTIONS.md`: when you change a GitHub Actions workflow or action.
- `.gspot/rules/HTML.md` in `docs/`: when you change HTML or an HTML template.
- `.gspot/rules/JAVASCRIPT.md`: when you change JavaScript or TypeScript code.
- `.gspot/rules/NAMING.md`: when you name a file, folder, type, function, or variable.
- `.gspot/rules/OPERATIONS.md`: when you write a deployment, publishing, or remote shell script.
- `.gspot/rules/PLANNING.md`: before you write a plan.
- `.gspot/rules/SAFETY.md`: when a shell script deletes files, downloads, uses `sudo`, starts background jobs, or parses JSON or YAML.
- `.gspot/rules/SECRETS.md`: when code reads, stores, or logs a secret.
- `.gspot/rules/SECURITY.md`: when code takes input from outside the program, or handles authentication, redirects, or downloads.
- `.gspot/rules/SETTINGS.md`: when you change how a program reads its settings or environment.
- `.gspot/rules/SITE.md` in `docs/`: when you change a site that a build turns into static HTML.
- `.gspot/rules/SUPPRESSIONS.md`: before you add a suppression comment or run `gspot ignore`.
- `.gspot/rules/TASKS.md`: when you change `mise` tasks, `package.json` scripts, a `Makefile`, or another task runner.
- `.gspot/rules/TESTING.md`: when you write or change a test.
- `.gspot/rules/TYPESCRIPT.md`: when you change TypeScript code.
- `.gspot/rules/ZOD.md` in `packages/cli/`, `tests/`: when you write or change a Zod schema.

## Commands

The rules write `gspot` for `mise exec -- gspot`.

Before you finish a change, stage it and run `gspot check --staged --only commit`. When you commit, fix what the hook reports.

Change a setting with `gspot set`, `unset`, or `unignore`. Write the other `[[...]]` records by hand, after the user agrees, then run `gspot install`.
When `gspot check` names a new configuration, ask the user, then run the `gspot add` line it prints and `gspot install`.
Run `gspot ignore` or `gspot remove` only after the user agrees, with a reason.
After you edit a package manifest or a tsconfig, run `gspot install`.

Do not edit the files that gspot writes. `gspot/generated-files` reports an edit. Change `gspot.toml`, then run `gspot install`.

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
- Each check that parses a tool's output has an integration test. The test runs the shipped check through
  `gspot check --only <check>` against the real tool and asserts the parsed findings.
- When that tool needs Docker or an account, a unit test feeds the check output recorded from the real tool.
- `tests/suites/e2e/` installs the packed packages into a fresh project.
- In unit check tests, choose the entrypoint for the assertion:
    - Use `runSandboxCheck` for one check's findings or error.
    - Use `planSandboxCheck` with `getBuiltInCheck` when files or the run cache change after the session opens.
    - Use `runCheckCode` for a command check whose plan the test changes.
    - Use `runChecks` with `buildRunOptions` for status, notes, skip causes, or cancellation.
    - Use `assertCheckSample` for a sample that fails and passes after its fix.
- Keep CLI calls out of `tests/suites/unit/cli/`, except in `commands/` and in the tests of `main.ts` and `bin.ts`. Exit
  codes, JSON output, and other CLI behavior belong to `tests/suites/unit/cli/commands/`.
- Keep imports of the functions that the check registry names out of `tests/suites/unit/cli/configurations/`. A test may
  import such a function when other product code imports it too.
- When a mise pin changes, fill its `checksums` in the manifest from
  `mise lock --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64`.
- End no file with an export list.
- Throw `GspotError` for what the user can fix. Throw a plain `Error` only for a broken invariant.
- In `packages/`, read and write files synchronously, except a large copy, and run processes asynchronously.
- gspot starts a program by its bare name only when `OUTSIDE_PROGRAMS` lists it, so the lookup skips folders inside the
  user's repository. It starts every other program from a path that an installer or `findProgram` returned.
- A pattern or a parser that reads a text file of the user's repository accepts CRLF line ends as well as LF.
- Use the types that a package publishes when the code already depends on that package. Do not add a dependency for its
  types alone.
- Write a JavaScript module that a generated config loads as a TypeScript source in the `files/` folder of its
  configuration. The manifest names it as the `source` of its config file, and gspot transpiles it.
- Write `the user's repository`, not `this repository` or `a repository`, whenever more than one repository fits the
  sentence.
- Write the `CHANGELOG.md` section of each release by hand. Each entry says what changed after the last release and what
  to do about it, and it cites its commits by hash.
- Keep the owner's descriptions word for word: the first sentence of `README.md`, and the `description` in
  `packages/cli/package.json`.
- List every content page of `docs/` in the sidebar.

## Folders

These rules apply to `packages/cli/src/`, `packages/eslint-plugin/src/`, `docs/src/`, and `tests/`. Here they override
six shipped rules:

- NAMING.md says "Prefer feature folders to top-level type buckets."
- ZOD.md says "Put a runtime schema with the feature that owns the contract."
- TESTING.md says "Put builders, fakes, servers, and database code in one folder beside the tests." Here they sit in
  `tests/setup/`, one subfolder per job.
- WORKING.md says "Keep one implementation of each concept, and one copy of each table of values, in the module that
  uses it." Here a fixed value sits in `config/`, also when one module reads it.
- COMMENTS.md says a comment explains why, and lists when to add one. Here a file in `config/` also labels its
  subjects.
- TESTING.md says that builder files "hold no assertions or test blocks." Here `assertCheckSample` in
  `tests/setup/cli/samples.ts` and `assertRefusalWithoutWrites` in `tests/setup/cli/commands.ts` assert. No other file
  in `tests/setup/` does.

### Values, types, and schemas

- Keep each fixed value, type, and runtime schema in `config/`, `types/`, or `schemas/`, also when one module reads
  it. A fixed value is data: a literal, or an array, object, `Set`, `Map`, `RegExp`, or string built from data.
- These stay with the behavior that uses them: a symbol, a function or a table of functions, a class instance such as an
  `Intl` formatter, and module state. A value that reads the environment, the platform, the clock, or a file stays there
  too.
- A subject is what its values describe: the input of one module or step, such as `init report`, or one concept that
  several modules read, such as `units`.
- In a file of `config/` with more than one subject, the values of each subject sit together under a label comment.
- The label names the subject in one to five words, such as `// init report`, and stands directly above the first
  value of its subject. A file with one subject has no label.
- No blank line stands between the values of a subject, or between a label and its first value. One blank line
  stands between two subjects.
- Order the subjects of a file by label, and the values of a subject by name, both alphabetically. A value that another
  value of the file reads comes before it. A subject that holds a value another subject reads comes before that
  subject.
- A label names its subject and gives no reason. A reason for one value stays in a comment directly above it.
- Each of those folders holds one file per layer, such as `config/<layer>.ts`:
    - The CLI layers follow the folders under "Commands and layers." Layer `main` serves `main.ts`, `bin.ts`, and
      `reference.ts`.
    - The layers of `tests/` follow the CLI layers of `tests/suites/unit/cli/`, and add `eslint-plugin`, `integration`,
      `e2e`, and `setup`.
    - The ESLint plugin and the docs site form one layer each, with one file per topic.
- A value that several layers read sits in the file of the highest layer that all of them may import, which in `tests/`
  means `setup`. Values of one subject stay together, in the lowest layer that any of them needs.
- A tool's rule table that a settings schema reads sits in the `manifest.toml` of the configuration that owns the tool.
- A file splits only when it passes the file length limit. It then becomes a folder `<layer>/` with one file per topic,
  such as `packages/cli/src/config/configurations/naming.ts`. A topic is a subfolder of the layer or one subject.
- In `config/configurations/` and `types/configurations/`, the values or types of one configuration sit in the file of
  that configuration, such as `postgres.ts`. A configuration with fewer than about ten keeps them in the file of its
  group.
- A value or type that several configurations read sits in the group file, such as `framework.ts`, or in `shared.ts`.
- Merge a topic of fewer than about ten values or types into the closest topic file. No file in these folders holds a
  single export or takes the name of its folder.
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
- `files/` holds the files that gspot copies or transpiles into `.gspot/configurations/<configuration>/`. A
  TypeScript module in `files/` runs in the user's repository, so it imports only Node built-ins and, with
  `import type`, types.
- Code that several configurations share sits at the top of `configurations/`, such as `registry.ts`, `syntax.ts`, and
  `tsc/`. Code that belongs to one configuration stays in its folder when another configuration reuses it, such as the
  Postgres migrations reader that supabase reads.
- Join the builder tables of the configurations with a function that refuses a repeated key, not with object spread.
- A check that runs per file selects its files with `files` in its manifest record, and its code does not filter
  `planned.files` again. A record leaves out a field that equals the value its reader falls back to.
- Write each `manifest.toml` in one form: keys of a record in name order, inline tables for `files`, `output`, `when`,
  and `suppression`, `[rules]` as inline entries, each `eslint` record beside `[eslint]`, and one blank line between
  records.
- A configuration declares a static ESLint block as an entry of `PLUGIN_RULE_BLOCKS`. It writes a block builder in its
  own `generate.ts` only when the block reads settings, dependencies, the scope path, or another selection.

### ESLint plugin

`packages/eslint-plugin/src/rules/<topic>/` holds one file per rule. A topic says what its rules check, and holds at
least two rules.

Before you add a rule, read the rules that the configurations turn on at the same level. Add no rule that one of them
already reports. When a shipped fixer rewrites code that a rule reports, the rule also reports the rewritten form.

`language/` holds helpers about JavaScript and TypeScript code and the files around it. `libraries/` holds helpers that
know the API of one library or framework, and `language/` imports nothing from it. A value or type of one rule topic
sits in that topic's file of `config/` or `types/`, also when another topic reads it. One that no topic owns sits in the
`plugin.ts` file of that folder.

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
- Inside a layer, code sits in the subfolder of its subject, such as `engine/plan/` and `engine/run/`,
  `repository/setup/`, or `tools/installers/`.
- A file holds one subject: what every importer comes to it for. When importers come for different exports, split the
  file.
- A parser of a file format or of a project file sits in `parsers/`, also when one check reads it.
- Name a file or folder with plain words that say what it holds.
- The layers of `packages/cli/src/` run from the base up: `system/`, `parsers/`, `manifests/`, `repository/`,
  `settings/`, `tools/`, `engine/`, `configurations/`, `generation/`, `commands/`, then `main.ts`, `bin.ts`, and
  `reference.ts`.
- A layer imports only itself and the layers before it, its values, types, and schemas included.
- The `[[import_rule]]` records in `gspot.toml` list the layers in this order, and `gspot check` reports an import
  that breaks it.

### Tests

- A unit test file mirrors the source file it tests, with the same name. `tests/suites/unit/<package>/<path>.test.ts`
  tests `packages/<package>/src/<path>.ts`. A test of a whole source folder takes the folder name.
- When the mirror path leaves a test folder whose only entry is one folder, leave that folder out of the path. An
  example is `checks/` for a configuration with no other unit test.
- The tests of one source file or folder become a folder of that name, with one file per scenario, only when they pass
  300 lines.
- An integration test mirrors what it runs, such as
  `tests/suites/integration/configurations/<group>/<configuration>.test.ts`, `commands/<command>.test.ts`, or
  `installers/<module>.test.ts` for `packages/cli/src/tools/installers/<module>`. Past 300 lines, the tests of one
  configuration become a folder with one file per tool.
- File text that one test writes only to make a file exist, and that no assertion compares, stays at the call that
  writes it. File text that an assertion depends on is a fixed value in `tests/config/`.
- A sandbox file name stays with the text of its file. A sample in `tests/config/` holds its file names, its file texts,
  and the results that its test expects.
- RuleTester cases and command arguments stay beside their call.
