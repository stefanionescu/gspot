# Configurations

This document decides the unit of selection: its manifest, how it is detected, how configurations
combine, and the available configurations.

## Policy ownership

Shared language policies cover Swift, JavaScript, TypeScript, Python, and their supported
frameworks. `from_languages` includes source claims contributed by framework configurations, such
as Vue and Svelte components. Selecting a framework must not drop language rules. See
[shared enforcement](05-engines.md#shared-enforcement-across-languages-and-frameworks).

Configurations own shipped tools, versions, templates, default rule policy, styles, and vocabulary.
CLI code owns operational loading, validation, parsing, and execution. Recommended and all
use one metadata owner across planning, generated templates, plugin exports, and documentation.
Optional preferences retain their specified level. Trivial-function and trivial-file rules
remain enabled at every level. Remove a duplicate implementation
only after the replacement proves the intended policy through generated configuration.

Validate external-tool and built-in check definitions as distinct forms. Descriptive coverage
and delegated ownership do not create additional executed checks. Multistep preparation belongs
in ordinary code, not a manifest workflow language. The execution contract lives in
[05-engines.md](05-engines.md#execution-ownership).

## What a configuration is

A configuration bundles its manifest and assets under its name. Resolve templates and rule
assets from the manifest's actual directory. Agent rule guides remain separate and are selected
by the manifest; no source/test directory inventory is implied.

A configuration contributes: files it claims, tools with versions, configuration it renders, checks it
runs, settings it exposes, and rule files it installs. It contributes nothing it does not declare.

## Kinds

`policy` is the kind for configurations whose checks span languages. It is part of
manifest validation, grouped discovery, and selection, not a public synonym for a check.
The kind does not require unrelated implementation or test directories to mirror this taxonomy.

Each configuration lives at `configurations/<kind>/<name>/` and declares its kind in its manifest.
The kind groups both selection and source ownership. Move each manifest with its templates and assets.
Configuration names are bare names; the kind is not part of the public name. Discovery reads each
manifest's actual directory and resolves its assets there. No category registry, old-path
aliases, or forwarding files duplicate that ownership.

The public `configs` configuration lives at `packages/cli/configurations/policy/configs/` and is titled Configuration
Files. It covers JSON, YAML, TOML, workflows, environment files, XML, and related formats.
Its templates configure the tools that inspect those files; the configuration is not a generic
owner for every configuration's configuration assets.

| Kind      | Selected by                                    | Claims files by                           | Examples                                                                                                                          |
| --------- | ---------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| language  | an extension in the tree                       | extension, filename, shebang              | typescript, python, swift, bash, sql, css, html, markdown                                                                         |
| framework | a dependency                                   | path convention the framework dictates    | nextjs, express, fastapi                                                                                                          |
| platform  | the platform's config file                     | the platform's layout                     | supabase, cloudflare                                                                                                              |
| tool      | the tool's own file                            | the tool's files                          | docker, nginx, xcode, vitest, pytest                                                                                              |
| library   | a dependency                                   | none; adds rules to the language's checks | zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n                                                                |
| database  | a dialect or connection                        | migration and schema files                | postgres                                                                                                                          |
| policy    | the person, for a concern that spans languages | the whole tree                            | structure, naming, prose, secrets, security, dependencies, licenses, commits, duplication, formatting, docs, configs, static-site |

## Manifest

```toml
[configuration]
name         = "typescript"
kind       = "language"
title      = "TypeScript"
requires   = ["javascript", "structure"]
recommends = ["naming", "formatting", "spelling"]

[detect]
project_files = ["tsconfig.json"]      # a folder that holds one is a scope, and proposes the configuration
extensions    = [".ts", ".tsx", ".mts", ".cts"]
dependencies  = ["typescript"]

[claims]
extensions = [".ts", ".tsx", ".mts", ".cts", ".d.ts"]
filenames  = ["tsconfig.json", "tsconfig.*.json"]

[[tools]]
name            = "typescript-eslint"
kind            = "library"
version         = "8.46.2"
npm             = "typescript-eslint"
rule_page       = "https://typescript-eslint.io/rules/{rule}"
suppression     = { marker = "eslint-disable", reason = " -- " }

# The old files this tool owns, and what is carried from them.
[[tools.takeover]]
file    = "eslint.config.*"
carries = "eslint-config"

[[tools.takeover]]
file    = "package.json"
key     = "eslintConfig"
shared  = true                         # read and carried, never deleted or edited
carries = "eslint-config"

[[configs]]
template = "eslint.fragment.js.tmpl"   # exports config blocks and selectors; names no other configuration
target   = ".gspot/config/eslint.config.mjs"
fragment = true

[[configs]]
template = "tsconfig.check.json.tmpl"  # extends the tsconfig.json of the repository
target   = ".gspot/config/tsconfig.check.json"

[[checks]]
name      = "typescript/tsc"
example = "Assigning a string to a number-typed variable reports a type error. Supply the intended number and rerun."
level   = "recommended"
stage   = "push"
runs    = "per-scope"                  # per-file-list | per-scope | once
summary = "Checks that every TypeScript file type-checks."
why     = "A file that does not type-check can crash at run time in a way the editor already knew about."
help     = "Read the first error tsc prints and fix that file. Later errors are often the same mistake."

[[checks]]
name          = "typescript/eslint"
example = "An unused local declaration reports the configured unused-variable rule. Remove it and rerun."
level       = "recommended"
stage       = "commit"
runs        = "per-file-list"
command     = ["eslint", "--max-warnings", "0", "--no-warn-ignored", "--config", "{config:eslint}", "{files}"]
fix_command = ["eslint", "--fix", "--config", "{config:eslint}", "{files}"]
fix_order   = "codemod"                # codemod | imports | manifest | format
summary     = "Runs ESLint with the shipped rule set over every TypeScript file."
why         = "ESLint catches mistakes the compiler accepts: unused code, unsafe casts, functions that only forward."
help         = "Run gspot check --fix for the rules that fix themselves, then read each line that is left."

[[settings]]
name      = "tools.eslint.rules"
kind      = "table"
direction = "per-rule"                 # options and rules turned on; off is an [[ignore]]

[[settings]]
name      = "architecture.types_directory"
kind      = "string"
direction = "neutral"
default   = ""
detect    = { folders = ["types", "src/types"] }   # init fills it from what the repository holds

[[naming.rules]]                       # a framework or language carries its own naming rules
categories = ["types"]
case       = "PascalCase"

[coverage]
".ts" = ["format", "syntax", "style", "types"]

[rule_files]
language = ["language/TYPESCRIPT.md", "language/naming/TYPESCRIPT.md"]
```

A manifest holds every fact the CLI knows about its configuration. The code names no configuration, no
tool, and no check name outside `src/checks/`, and a unit test holds that.

### Field rules

- `name` is a bare kebab-case name and matches the folder name.
- `requires` pulls configurations in, and a person cannot drop them. It holds what the configuration cannot
  work without: `typescript` requires `javascript`, because its configuration is a fragment of
  the JavaScript one. A required configuration that is missing fails to load.
- `recommends` names configurations that `init` selects with this one and a person can drop.
  Every language configuration recommends `naming`, `formatting` and `spelling`. `structure` stays
  required, because it owns the `limits.*` settings the language configurations read.
  `gspot remove naming`, `init --without naming` and a profile that leaves `naming` out all work.
- A check whose engine belongs to a dropped configuration does not run. `doctor` lists the recommended
  configurations that are not selected.
- `[[tools]]` rows take `kind = "binary"` (the default) or `kind = "library"`. `doctor`
  looks for a library under `.gspot/node_modules/<npm name>/` and reads its version there
  . A library is never spawned.
- `runs` says how a check receives files. `per-file-list` passes the claimed files of each scope.
  `per-scope` runs once in each scope with no file list. `once` runs one time over the whole
  repository, from the root. It replaces `takes`, `whole` and the scope guard inside a check.
- `reported_by` names the check whose run carries this check's findings, such as
  `markdown/prettier`, which `formatting/prettier` reports. The check shows as skipped with that
  note.
- `takes_over` names a check whose work this check does itself. In a scope that plans both,
  the named check is skipped with the note `<taker> runs it here`.
- `[coverage]` lists, for each extension, the check kinds a file of that extension must
  receive. `doctor` reports a file that misses one as partly checked.
- `[rule_files]` lists the corpus files the configuration installs, by layer.
- `[required_rules]` lists, for a file ending, the ESLint rules that must be on for a file with
  that ending. `javascript/required-rules` reads it.
- A check name is `<family>/<name>`. The family is the engine or the tool family that produces the
  finding (`structure`, `naming`, `integrity`, `prose`, `security`, or the configuration's own name), not
  always the configuration. `gspot explain <check>` prints the configuration that ships it.
- `detect` proposes the configuration at `init` and in `doctor`. Detection never selects.
- `claims` decides which files the configuration's checks receive. A `filenames` claim matches at any
  depth (`_headers` under `public/` is `_headers`); an `extensions` claim likewise. A file claimed by no selected configuration is unchecked.
- `claims` may also name `tags`, computed the way the pre-commit `identify` library does from extension, shebang, executable bit, and content (`shell`, `python`, `node`, `executable`, `text`, `binary`). Hooks and task files with no extension are then claimed without a filename list.
- Every tool the checks or the generated configuration need is in `[[tools]]` with a version
  and the name under each ecosystem gspot knows (`npm`, `pypi`, `mise`, `brew`, `cargo`,
  `github`). `doctor` verifies presence and version.
- CodeQL tool `query_packs` maps native extractor names to exact query-pack versions
  paired with the CLI release. The adapter resolves language names through native metadata
  and uses these pins for query downloads.
- Every `[[configs]]` entry has a reader among the checks, or fails to load.
- Every check is in a stage. [10-hooks-ci-runners.md](10-hooks-ci-runners.md) says what puts a
  check at `commit`, `push`, or `manual`.
- Every check carries `summary` (what it looks for, one sentence), `why` (what goes wrong
  without it) and `help` (what to do), written for a person who does not code. The loader refuses an empty one.
- `explain`, the finding line and the generated page under `docs/rules/` print
  them; nothing else describes a check.
- `runs = "per-file-list"` receives the claimed file list as `{files}`. `runs = "per-scope"` runs once from the scope root and reports its own inputs. Its cache key and file count cover every
  tracked text file under the scope, child scopes included, because the tool reads the project
  rather than the claimed files.
- A check carries `level`, `recommended` or `all`, and a check with no level fails to load.
- A check takes `waits_for`, the setting it needs. With the setting unset the check prints
  `skipped` and names it.
- A check takes `needs`, the configuration whose generated files it reads. Where the scope does
  not select it, the check is skipped with that note.
- A check takes `cached = false` when its verdict depends on more than its files.
- A check takes `env`, a table of environment values for its tool. Values expand scalar command
  placeholders such as `{config:name}` before execution.
- A tool takes `version_command`, `rule_page`, `suppression`, `crash_pattern`, and
  `[[tools.takeover]]` rows. A takeover row names a `file`, or a `key` or `table` of a shared
  manifest with `shared = true`, and what it `carries`.
- `crash_pattern` is the output that means the tool fell over, for every check that runs it. A
  repository command declares its own under `tool_errors`. `rule_page` is where the tool
  documents one rule, with `{rule}` where the name goes; `explain` prints it for any tool.
- A library tool that is a Prettier plugin declares `prettier = { entry, overrides }`: the file
  Prettier loads from the private installation, and the overrides its files need. The
  formatting generator emits both; no template names a plugin.
- A fragment config takes `code_files`, the file globs its framework adds to the code and
  type-checked file sets. A fragment that adds only selectors needs no `template`.
- A fragment config takes `[[configs.selectors]]` rows, each a `selector` with its `message`.
  A row with `files` applies in those files on top of the general rows. A row with `allowed`
  names the loosening setting whose paths it leaves alone.
- The base template joins the selector rows of every selected fragment into the one
  `no-restricted-syntax` rule per file set.
- A manifest takes `entry_files`, the files a dead-code scan starts from in the code it knows,
  relative to the scope. The knip configuration joins them with `tools.knip.entry`.
- A setting takes `role`, the architecture role of the folder it names, such as `harness` for
  a test runner's support folder. A template asks for the folders of a role, never for the
  setting by name.
- A setting two configurations need is declared by both under one name with the same kind,
  direction, and summary. A list merges the defaults. A framework or platform default replaces
  a scalar one.
- Through such a shared setting a fragment learns what another configuration knows, without
  asking whether it is selected.
- Tool `env` supplies literal environment settings to version probes and commands. Check
  `env` overrides tool settings and supports command placeholders.
- An installer name is a string, or a table with `name` and `version` for an installer that
  numbers by itself.
- A setting takes `detect`, a small table `init` reads to fill it from the repository.
- `[detect] project_files` names the files that mark a project: a file name, a folder name such
  as `*.xcodeproj`, or a short path such as `supabase/config.toml`. `init` proposes the
  configuration from such a file and a scope for the folder that holds it.
- `[[rules_off]]` lists the shared rules a framework turns off, each with a reason.
- A `[rule_files]` entry may carry `when`, a detection table, so a file installs where its
  subject is found.
- A manifest that repeats the check name of another manifest fails to load.
- A check with `fix_command` names its `fix_order`. Repository-defined checks use those same fields. `help` is the prose that tells a person what to do; `fix_command` is what `check --fix` runs.
- A check whose exit code does not reflect findings declares `count_regex`.
- `[coverage]` names, per extension, the check kinds a file needs to count as fully
  checked. `doctor` reports files that fall short. Kinds: `format`, `syntax`, `schema`, `style`,
  `types`, `structure`, `naming`, `prose`, `spelling`, `security`, `dependencies`,
  `duplication`, `links`, `freshness`.
- `[rules]` names the Markdown files by layer.

### Built-in checks

A check can name a gspot engine instead of a command:

```toml
[[checks]]
name      = "structure/trivial-function"
stage   = "commit"
engine  = "structure"
rules   = "rules/call-through"       # a directory of ast-grep YAML, one file per grammar
limit   = "limits.trivial_statements"
summary = "Finds a function that only passes its arguments on to one other function."
why     = "The extra name adds a hop to read and nothing to the program."
help     = "Call the inner function directly and delete the wrapper, or give the wrapper real work."

[[checks]]
name      = "naming/identifiers"
stage   = "commit"
engine  = "naming"

[[checks]]
name      = "docs/stale-paths"
stage   = "commit"
engine  = "builtin"
```

A built-in check that is not structure, naming, or prose is one file under `src/checks/`, named
after its name: `docs/stale-paths` is `checks/docs/stale-paths.ts`. The check name is the lookup key, and
no manifest names an analysis. Each built-in check is listed in [05-engines.md](05-engines.md) with what it searched before
being written.

## Selection

```text
selected = configurations in gspot.toml
         + every configuration they require, transitively

at init   = proposed configurations, or the configurations of the profile
         + every configuration they recommend whose own detection matches, or that has no detection
         + every configuration they require, transitively
         - what --without names and what the person cleared
```

Order is the order of first mention, dependencies first. Settings merge in that order. A circular
`requires` fails to load.

A scope's selection is the root selection plus the scope's own. A check runs once per scope
over that scope's files. Root-only configurations (policy kind) run once over the whole tree.

## Detection

A language with a project file is proposed from that file, as a scope is. A language with
no project file is proposed from its files. A tool, framework, or library configuration is proposed
only where the repository holds the thing. The plan lists what was found and not proposed, each
with its `gspot add` line. A configuration whose checks all need git is not proposed in a folder that
is no git repository.

Signals, in the order `init` prints them:

| Signal                                                                                                                                | Proposes                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| a project file: `package.json` with `typescript`, `pyproject.toml`, `requirements*.txt`, `Pipfile`, `Package.swift`                   | that language, and a scope for its folder                                                     |
| files of a language with no project file: Bash, SQL, HTML, CSS, Markdown                                                              | that language                                                                                 |
| shebang on an extensionless file (`bash`, `sh`, `zsh`, `python`, `node`)                                                              | bash or python or javascript                                                                  |
| `next` in dependencies, `next.config.*`                                                                                               | nextjs                                                                                        |
| `express` in dependencies                                                                                                             | express                                                                                       |
| `fastapi` in dependencies                                                                                                             | fastapi                                                                                       |
| `supabase/config.toml`                                                                                                                | supabase, postgres, sql                                                                       |
| `wrangler.jsonc`, `wrangler.toml`, `functions/_middleware.js`, `_headers`                                                             | cloudflare                                                                                    |
| `*.xcodeproj`, `Package.swift`                                                                                                        | swift; xcode for the project                                                                  |
| `Dockerfile*`, `docker-compose*.yml`                                                                                                  | docker                                                                                        |
| `nginx.conf`                                                                                                                          | nginx                                                                                         |
| `vitest` in dependencies                                                                                                              | vitest                                                                                        |
| `pytest` in dependencies or `[tool.pytest]`                                                                                           | pytest                                                                                        |
| `zod`, `drizzle-orm`, `@trpc/server`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `next-intl` or `i18next` in dependencies | the library configuration                                                                     |
| `*.sql` files                                                                                                                         | sql; postgres where a migrations folder, `pg`, or Supabase is found                           |
| `*.html` files; `index.html`, `_headers`, or a web manifest at the root                                                               | html; static-site                                                                             |
| `.md` files                                                                                                                           | markdown                                                                                      |
| `.json`, `.yaml`, `.toml` files                                                                                                       | configs                                                                                       |
| any repository                                                                                                                        | structure, naming, formatting, spelling, secrets; commits, security, and licenses are offered |
| a language gspot has no configuration for, named through `linguist-languages`                                                         | nothing; the plan names the language and its file count                                       |

Detection reads manifests and file names. It never reads code to guess a framework.

## One rule set, every framework

A framework changes which plugins run. It does not change the rules of the language under it
.

- Every shared rule reads every code file: `js`, `ts`, `jsx`, `tsx`, and the component endings
  a framework configuration claims (`.vue`, `.svelte`, `.svelte.ts`).
- A limit is the same number in every framework: lines for each file, lines for each function,
  parameters, depth, statements, and complexity. No configuration may change one.
- A framework turns a shared rule off only in its manifest, with a reason. A test compares the
  final ESLint config of a component file with that of a plain `ts` file, and fails on a
  difference that is not on the list.
- A framework configuration holds every linter written for the framework. That is the recommended set
  of each plugin, an accessibility plugin, the type checker that reads its files, and the test
  rules of its runner.

| Framework    | Lint                                                                                                    | Accessibility                         | Type check            | Tests                           | Turned off, and why                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| react        | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`                       | `eslint-plugin-jsx-a11y`              | `tsc`                 | vitest or jest, testing-library | nothing                                                                             |
| nextjs       | react, `@next/eslint-plugin-next`, six checks of its own                                                | from react                            | `tsc` with the plugin | from react                      | the one-file-folder rule, for route files the framework finds by name               |
| react-native | react, `@react-native/eslint-plugin`, `eslint-plugin-react-native`, `eslint-plugin-expo`, `expo-doctor` | none yet: the plugin ends at ESLint 8 | `tsc`                 | jest, testing-library           | `jsx-a11y`, which reads DOM elements that React Native does not have                |
| nestjs       | `@darraghor/eslint-plugin-nestjs-typed`                                                                 | none: a server                        | `tsc` with decorators | jest                            | `no-extraneous-class` for a decorated class; `class-methods-use-this`, for handlers |
| vue          | `eslint-plugin-vue`                                                                                     | `eslint-plugin-vuejs-accessibility`   | `vue-tsc`             | vitest, testing-library         | nothing                                                                             |
| svelte       | `eslint-plugin-svelte`                                                                                  | `svelte-check`                        | `svelte-check`        | vitest, testing-library         | the one-file-folder rule, for SvelteKit route files                                 |

## Available configurations

The [enforcement ledger](06-enforcement-ledger.md#configuration-enforcement-contracts) preserves
the detection, settings, and checks of each agreed configuration. The v1 set is every configuration the four reference repositories need. That covers a Python API, a Swift
app, an Express API, a Supabase project, a static site on Cloudflare, and a Next.js app.

## What a configuration never does

- Hard-code a directory layout. A framework configuration claims only the paths the framework itself
  dictates (`app/`, `supabase/migrations/`, `functions/`).
- Read a product value into its own configuration. A check that needs the nginx image tag reads
  the compose file at run time.
- Ship a tool without the options a real repository sets on it. The `extra` table covers the
  gap, and is no reason to leave an option out.
- Name another configuration in a template, or hold a default that a manifest owns.
- Name a function, a folder, or a library of one repository in a rule pack, a default, or a rule
  file.
- Write into a file of the developer outside a managed block.
- Ship a check no stage runs.
- Ship a rule file that links to another rule file.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-301

Banned terms run only at all; generate and service are allowed. Recommended includes defect checks and the mandatory trivial-function and trivial-file policy.
Other naming, placement, and abstraction preferences belong to all.

Use the naming policy with the corrected structural contract in [07-slop-drift.md](07-slop-drift.md). Trivial functions and trivial files run by default at recommended and all, including nested
scopes and standalone plugins; required APIs need narrow, reasoned suppressions.

Fresh generated apps and established multi-package projects; valid service/generate names; public API wrappers and framework adapters. For every recommended finding, verify the defect or mandatory structural policy it reports.
Review parser and scope false positives without weakening the statement threshold or adding
blanket callback, framework, or entrypoint exemptions. Snapshot messages only after that review.

### Acceptance K-198

`level = "recommended"` or `level = "all"` at the top of `gspot.toml`. A check carries
`level` in its manifest, and a check above the level of the repository is not planned. A template
renders by level: `recommended` writes the recommended set of each tool, defect checks,
and mandatory trivial-function and trivial-file enforcement; `all` adds the remaining policy.

Every check declares its level. Planning, template emission, standalone plugin configurations,
and references consume the same level policy. Verify the resulting selection at both levels;
no dedicated level module or duplicate rule registry is required.

For ESLint the first list is `recommended` of typescript-eslint, and the
second adds `strictTypeChecked`, sonarjs, unicorn, and jsdoc. For ruff the first list is `E`,
`F`, `B`, `S`, `ASYNC`, `UP`, and `PL` errors, with `preview` off. For SwiftLint the first list
is the default rules and the opt-in rules that find a defect. basedpyright runs at `standard`,
ShellCheck with its default set, and hadolint fails at `warning`.

Generated-configuration cases exercise both levels through their consumers (T-36). Manifest
validation rejects a check without its required level or nonempty example.

### Acceptance K-101

Preserve every public plugin rule and option. Derive `configs.recommended` and `configs.all` from rule metadata. Both configurations enable trivial-function and trivial-file enforcement by default.
Other placement and abstraction preferences require all or explicit opt-in. Verify standalone and generated configurations with invalid and corrected inputs.

### Acceptance K-135

At `recommended` the bash configuration runs the checks that find a defect. They are strict
mode, a `mktemp` with no trap, a failure discarded by an or-true, and `cd` with no failure path.
They are also a recursive remove, a broad `pkill`, unread arguments, duplicate functions, and
unused functions. The header,
order, underscore, owner, and doc-section rules are `all`.

Three check names replace one: `structure/bash-strict-mode`, `structure/bash-temp-trap`
(both `recommended`), and `structure/bash-script-header` (`all`).

A planted script in ordinary style, with `${PORT:-8080}` and no function comments,
passes at `recommended` and fails at `all`.

### Acceptance K-152

`recommended` holds import-cycle defects. File and function length, placeholder prose, the seven conventions, pydoclint, and vulture are `all`. Report all functions at or below the executable statement threshold (K-301). The ownership check is
planned where the scope holds `uv.lock`, `poetry.lock`, or `pdm.lock`.

The ownership check takes `waits_for` a lockfile through `[detect] project_files` of
its manifest. pydoclint reads its style from `[tool.pydoclint]` or
`[tool.ruff.lint.pydocstyle]` of the project, and passes no `--style` where neither exists. The
pytest manifest names `pytest-cov` as a tool.

A planted pip project with `requirements.txt` and NumPy docstrings passes.

### Acceptance K-174

`html/scripts`, `sql/block-comments`, and the README contents rule are `all`. The
postgres configuration ships `client_schemas = []`, and the supabase configuration sets `["public"]`. The
commits configuration is proposed and not selected, as security and licenses are, and its scopes are
what `tools.commitlint.scopes` names.

One README contents rule stays: a README over six sections has a list of its sections
near the top, under any heading. The banned heading list loses `Table of contents`.

The default planted install holds no commit message check. A Postgres project with no
Supabase holds no row level security finding.

### Acceptance K-175

`recommended` runs only demonstrated defect rules of the `gspot` style, excluding banned terms and house-style judgments. `all` runs the complete style, which is what `WRITING.md` tells an
agent. `all` adds the packages. The off list and the vocabulary are data of the prose configuration.

`vale.ini.tmpl` lists `BasedOnStyles = gspot` at `recommended` with every term-ban and house-style rule disabled by level. At `all` it enables those rules and adds the
packages and the off list, which the manifest holds as a setting with its reasons. `apply`
downloads a Vale package only at `all`, so a `recommended` install needs no network.

Exercise the emitted prose configuration at both levels. A planted install at `recommended`
runs with the network off; native package downloads stay in explicit suites.

### Acceptance K-201

gspot writes no option that changes emit or resolution. The type check runs
through a generated file that extends the `tsconfig.json` of the repository and adds flags that
only add errors, as [04-configurations.md](04-configurations.md) builds it (K-74).

The generated file holds `strict` at `recommended`, and four more flags at `all`. `javascript/checkjs`
reads the `jsconfig.json` of the repository for resolution.

A planted Vite app with `Bundler` resolution passes `typescript/tsc`, and its
`tsconfig.json` is unchanged.

### Acceptance K-218

A shipped pack names the API of its framework and nothing else.

A rule that names a function of one repository moves into that repository, under
`tools.semgrep.rules`, in its migration. The supabase rule reports `createClient` with the
service role key outside `tools.supabase.admin_files`, which is a fact a fix can change.

Each planted repository holds a plain handler that reads `request.json()` through its
own validator, with no finding.

### Acceptance K-93

`init` detects each value, and asks where it cannot.

A setting in a manifest takes `detect`, a small table: a `package.json` script name, a
key of a config file, or an `xcodebuild -list` field. The build command is the `build` script
where one exists. The output folder is `outDir` of the Vite or Astro config. The destination
comes from the platforms of the package or the SDK of the project.

A planted macOS package proposes a macOS destination.

### Acceptance K-99

Each of the nine is an unknown key, refused at load with the nearest real key.

The fields go from the strict objects, so zod refuses them. `normalize.ts` loses the
`editor` default and the `imports_allowed` default.

Verify that retained settings affect their owning behavior (K-100).
Do not add cases for deleted keys or infer coverage from reader names in source text.

### Acceptance K-104

A field exists when something sets it and something reads it.

`findingLines` loses its `docsBase` parameter. The SARIF writer uses a path relative
to the repository, as the findings already do.

The JSON shape test holds the record without `root`.

### Acceptance K-119

An unknown engine name is refused when the manifest is read.

The manifest schema holds the engine names as an enum. Shared comment openers belong to
`run/ignores.ts`.

A manifest test repository with `engine = "nope"` fails to load.

### Acceptance K-180

`--runner` takes `mise`, `npm`, `pnpm`, `yarn`, and `bun`. The Python tools install
under `.gspot/` with uv, as the Python toolchain contract specifies ([06-enforcement-ledger.md](06-enforcement-ledger.md), K-266).

gspot pins itself in the mise file as `"github:stefanionescu/gspot"`, not through
`ubi`, in `emit/runner-tasks.ts` and in installation diagnostics. Detection in
`existing-tooling.ts` still reads `uv.lock`, because the scope reader needs it.

`init --runner uv` exits 2 and lists the five runners.

### Acceptance K-79

Checks belong to the domain they inspect. Shared parsers and platform
operations live outside configuration definitions. Infrastructure must not import configuration definitions for basic work.

Actual planned checks execute once and report intended defects at their
locations. Valid inputs pass; invalid manifest combinations fail at loading. Registry metadata
validation complements these cases but cannot replace them.

### Acceptance K-39

A manifest says which old files its tools own, and what is carried from them.

A tool in a manifest takes `[[tools.takeover]]` rows. A row has `file` (a name or a
glob), or `table` and `key` for a shared manifest, `shared`, and `carries`. `carries` names a
reader from a closed list: `ignore-paths`, `rules-table`, `words`, `advisories`, `licenses`,
and `eslint-config`. Disabled-rule importers also declare `check`, naming the executable
check that receives carried rule exceptions. The check must run the declared tool.
`CarriedLists` becomes a map from a tool name to its carried entries, and
the plan prints it by walking the map.

`takeover.test.ts` runs unchanged. A unit test holds that every takeover row names a
reader from the list.

### Acceptance K-38

Each of those is a key of the manifest that owns the tool or the check.

A check takes `cached = false`. A tool takes `version_command`, `crash_pattern`, and `rule_page`, an address with `{rule}` in it. `explain`
prints that address for any tool.

A missing tool message comes from `install-hints.ts`, which already
words the advice for each runner, and its fallback is the runner the repository uses. The word
list of the rules lint is the set of tool and library names of every manifest, less the names
of the file's own configuration.

Exercise tool selection, version probing, crash classification, install advice, and
rule explanation using the owning manifest data.

### Acceptance K-197

The rules of a library live in its own configuration. No template names another
configuration, and no template holds a default.

A fragment exports two things: config blocks, and a list of selectors with messages.
The template joins the selectors of every selected fragment into the one
`no-restricted-syntax` rule. `has()` leaves the template helpers, so no template can ask. A
setting a fragment needs from another configuration is declared by both manifests under one name. The
knip entry list comes from the `entry_files` of each selected framework manifest, and this
repository keeps its own entries in `tools.knip.entry`.

Render selected configuration combinations and execute their pinned consumers. Verify
that merged selectors retain each intended library defect and that changed settings reach
the actual rule. Assert valid and corrected cases too.

### Acceptance K-105

Validated schemas own parsed configuration types, choices, defaults, diagnostics, and reference data. Keep a distinct normalized type only for a real transformation. Verify accepted and rejected documents and that each setting reaches its consuming behavior.

### Acceptance K-40

The types folder is proposed from what the repository holds: `types` or `src/types`
in the root or in a scope. The commit scopes are what `tools.commitlint.scopes` names.

The two folder names are the `detect` table of the setting `types_directory` in the
typescript manifest (K-93).

The proposal snapshot of a repository with `src/types`.

### Acceptance K-255

The i18n configuration alone ships `i18n/locales` and its one setting. The nextjs configuration
recommends i18n where `next-intl` is a dependency.

A manifest that repeats the check name of another manifest fails to load.

A manifest test repository with a repeated name fails.

### Acceptance K-74

gspot never edits a `tsconfig.json`. `typescript/tsc` type-checks through a generated
`.gspot/config/tsconfig.check.json` that extends the file of the repository and adds flags that only add
errors.

At `recommended` the generated file adds `strict` only. At
`all` it adds `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `exactOptionalPropertyTypes`.
Where the file of the repository holds `references`, the check builds them as they are (K-226).
`typescript/tsconfig-options` moves to `all`, and reads the options of the repository without
asking for an `extends`.

A planted Vite app holds an unchanged `tsconfig.json` after `init`, and a finding for a
strict error.

### Acceptance K-75

Each is `all`. The README check of `recommended` asks for one README at the root.

`level = "all"` on `dependencies/manifest-policy`, `dependencies/install-policy`, the
scope rule of `docs/readme-present`, the banned list of `docs/headings`,
`structure/bash-script-header`, `structure/single-file-folder`, and `gspot/types-placement`.
`dependencies/lockfile-fresh` and `dependencies/lockfile-hosts` stay `recommended`, because they
find a defect.

The generated projects of [12-repository-layout.md](12-repository-layout.md) hold none of these findings at
`recommended`.

### Acceptance K-181

The loader passes the parsed config on whole.

`toConfiguration` returns the zod output, and the type is inferred from the schema.

A planted Cloudflare repository without the security configuration holds no
`.gspot/config/semgrep/workers.yml`.

### Acceptance K-182

A language with a project file is proposed from that file: `pyproject.toml`,
`package.json`, or `Package.swift`. A language with no project file (Bash, SQL, HTML, CSS) is
proposed from its files. A tool configuration is proposed only where the repository holds that tool. The
plan lists what was found and not proposed, each with its `gspot add` line.

A configuration that another configuration recommends is selected only when its own `[detect]`
matches (configurations without detection, such as naming, remain explicitly selectable). A manifest takes
`needs_git = true`, and `selection.ts` leaves such a configuration out where `git rev-parse` fails. The
plan then opens with one line that says the folder is no git repository. A `workspaces` key of
`package.json` gives scopes with no lockfile present.

Four planted cases: a Swift package with one `.py` file, a package with no vitest, a
folder with no `.git`, and a workspace with no lockfile.

## Names across the public contract

Use `name` for a definition's own name. Use the entity word for a reference to that
definition: `check`, `configuration`, or `rule`. A finding's `check` field holds a check name;
it is not a second definition. Do not rename it to a generic `name` field. A setting name is
its dotted configuration address.

| Meaning                                  | Definition or serialized field                               | Local variable or parameter                               |
| ---------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Check definition                         | `CheckSpec.name`                                             | `check`                                                   |
| Check name                               | `Finding.check`, `CheckResult.check`, `IgnoreEntry.check`    | `checkName`, plural `checkNames`                          |
| Planned execution of a check             | `PlannedCheck`                                               | `plannedCheck`                                            |
| Configuration definition                 | `manifest.configuration.name`                                | `configuration`; `manifest` for the complete manifest     |
| Configuration name                       | `configuration` when referenced; `configurations` for a list | `configurationName`, plural `configurationNames`          |
| Tool rule name                           | `rule` on a finding or ignore                                | `ruleName`, plural `ruleNames`                            |
| Setting definition and its name          | `SettingSpec.name`                                           | `setting` for the definition, `settingName` for its name  |
| Scope definition and its path            | `scope.path`; `scope` in a serialized result                 | `scope` for the object, `scopePath` for the relative path |
| Tracked file and its path                | `file.path`; `file` in a finding                             | `file` for the object, `filePath` for the path            |
| Config root, Git root, process directory | Preserve the relevant external schema field                  | `configRoot`, `gitRoot`, `workingDirectory`               |

A named domain definition does not acquire `id` or `key` as an alias. A map key is still a
key. External contracts keep their required fields, such as SARIF `ruleId`, SPDX identifiers,
Git object IDs, and process APIs' `cwd`.

Gap and decision labels remain stable.
Schema fields keep their specified snake_case; TypeScript variables use camelCase.
A parsed object can retain its schema field names without an unnecessary translation layer.
Rename all producers, consumers, imports, schemas, and generated references in the owning
implementation change. Do not leave alias fields or forwarding exports behind.

`generate` and `service` are permitted terms. Banned-term checks run at `all` only.
Existing source names such as `emit` need no reverse rename.
