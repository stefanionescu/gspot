# Presets

This document decides the unit of selection: its manifest, how it is detected, how presets
combine, and the catalog.

## What a preset is

A preset is a folder in the gspot distribution:

```text
presets/typescript/
  manifest.toml            everything the preset contributes
  eslint.fragment.js.tmpl  configuration templates
  tsconfig.check.json.tmpl
  rules/                   ast-grep rule files, one directory per rule, one file per grammar
```

The agent rule files are not inside the preset folder: the corpus is one tree under `rules/`
and the manifest names its files there by path ([16-file-tree.md](16-file-tree.md)).

A preset contributes: files it claims, tools with versions, configuration it renders, checks it
runs, settings it exposes, and rule files it installs. It contributes nothing it does not declare.

## Kinds

Seven kinds. The kind names the folder under `presets/` in this documentation and a `kind` field in
the manifest. Preset names are bare names; the kind is not part of the name.

| Kind      | Selected by                                    | Claims files by                           | Examples                                                                                                                               |
| --------- | ---------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| language  | an extension in the tree                       | extension, filename, shebang              | typescript, python, swift, bash, sql, css, html, markdown                                                                              |
| framework | a dependency                                   | path convention the framework dictates    | nextjs, express, fastapi                                                                                                               |
| platform  | the platform's config file                     | the platform's layout                     | supabase, cloudflare                                                                                                                   |
| tool      | the tool's own file                            | the tool's files                          | docker, nginx, xcode, vitest, pytest                                                                                                   |
| library   | a dependency                                   | none; adds rules to the language's checks | zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n                                                                     |
| database  | a dialect or connection                        | migration and schema files                | postgres                                                                                                                               |
| concern   | the person, for a concern that spans languages | the whole tree                            | structure, naming, prose, secrets, security, dependencies, licenses, commits, duplication, formatting, docs, config-files, static-site |

## Manifest

```toml
[preset]
name         = "typescript"
kind       = "language"
title      = "TypeScript"
requires   = ["javascript", "structure"]
recommends = ["naming", "formatting", "spelling"]

[detect]
project_files = ["tsconfig.json"]      # a folder that holds one is a scope, and proposes the preset
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
template = "eslint.fragment.js.tmpl"   # exports config blocks and selectors; names no other preset
target   = ".gspot/eslint.config.mjs"
fragment = true

[[configs]]
template = "tsconfig.check.json.tmpl"  # extends the tsconfig.json of the repository
target   = ".gspot/tsconfig.check.json"

[[checks]]
name      = "typescript/tsc"
level   = "recommended"
stage   = "push"
runs    = "per-scope"                  # per-file-list | per-scope | once
summary = "Checks that every TypeScript file type-checks."
why     = "A file that does not type-check can crash at run time in a way the editor already knew about."
help     = "Read the first error tsc prints and fix that file. Later errors are often the same mistake."

[[checks]]
name          = "typescript/eslint"
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

[[naming.rules]]                       # a framework or language carries its own naming rules (D-112)
categories = ["types"]
case       = "PascalCase"

[coverage]
".ts" = ["format", "syntax", "style", "types"]

[rule_files]
language = ["language/TYPESCRIPT.md", "language/naming/TYPESCRIPT.md"]
```

A manifest holds every fact the CLI knows about its preset (D-150). The code names no preset, no
tool, and no check name outside `src/checks/`, and a unit test holds that.

### Field rules

- `name` is a bare kebab-case name and matches the folder name.
- `requires` pulls presets in, and a person cannot drop them. It holds what the preset cannot
  work without: `typescript` requires `javascript`, because its configuration is a fragment of
  the JavaScript one. A required preset that is missing fails to load.
- `recommends` names presets that `init` selects with this one and a person can drop (D-80).
  Every language preset recommends `naming`, `formatting` and `spelling`. `structure` stays
  required, because it owns the `limits.*` settings the language configurations read.
  `gspot remove naming`, `init --without naming` and a profile that leaves `naming` out all work.
- A check whose engine belongs to a dropped preset does not run. `doctor` lists the recommended
  presets that are not selected.
- `[[tools]]` rows take `kind = "binary"` (the default) or `kind = "library"` (D-87). `doctor`
  looks for a library under `.gspot/node_modules/<npm name>/` and reads its version there
  (D-145). A library is never spawned.
- `runs` says how a check receives files. `per-file-list` passes the claimed files of each scope.
  `per-scope` runs once in each scope with no file list. `once` runs one time over the whole
  repository, from the root. It replaces `takes`, `whole` and the scope guard inside a check.
- `reported_by` names the check whose run carries this check's findings, such as
  `markdown/prettier`, which `formatting/prettier` reports. The check shows as skipped with that
  note.
- `takes_over` names a check whose work this check does itself. In a scope that plans both,
  the named check is skipped with the note `<taker> runs it here` (D-99).
- `[coverage]` lists, for each extension, the check kinds a file of that extension must
  receive. `doctor` reports a file that misses one as partly checked.
- `[rule_files]` lists the corpus files the preset installs, by layer.
- `[required_rules]` lists, for a file ending, the ESLint rules that must be on for a file with
  that ending. `javascript/required-rules` reads it (D-99).
- A check name is `<family>/<name>`. The family is the engine or the tool family that produces the
  finding (`structure`, `naming`, `integrity`, `prose`, `security`, or the preset's own name), not
  always the preset. `gspot explain <check>` prints the preset that ships it.
- `detect` proposes the preset at `init` and in `doctor`. Detection never selects.
- `claims` decides which files the preset's checks receive. A `filenames` claim matches at any
  depth (`_headers` under `public/` is `_headers`); an `extensions` claim likewise. A file claimed by no selected preset is unchecked.
- `claims` may also name `tags`, computed the way the pre-commit `identify` library does from extension, shebang, executable bit, and content (`shell`, `python`, `node`, `executable`, `text`, `binary`). Hooks and task files with no extension are then claimed without a filename list.
- Every tool the checks or the generated configuration need is in `[[tools]]` with a version
  and the name under each ecosystem gspot knows (`npm`, `pypi`, `mise`, `brew`, `cargo`,
  `github`). `doctor` verifies presence and version.
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
- A check carries `level`, `recommended` or `all`, and a check with no level fails to load (D-119).
- A check takes `waits_for`, the setting it needs. With the setting unset the check prints
  `skipped` and names it.
- A check takes `cached = false` when its verdict depends on more than its files.
- A check takes `env`, a table of environment values for its tool. Values expand scalar command
  placeholders such as `{config:name}` before execution.
- A tool takes `version_command`, `rule_page`, `suppression`, `crash_pattern`, and
  `[[tools.takeover]]` rows. A takeover row names a `file`, or a `key` or `table` of a shared
  manifest with `shared = true`, and what it `carries`.
- An installer name is a string, or a table with `name` and `version` for an installer that
  numbers by itself.
- A setting takes `detect`, a small table `init` reads to fill it from the repository.
- `[[rules_off]]` lists the shared rules a framework turns off, each with a reason (D-138).
- A `[rule_files]` entry may carry `when`, a detection table, so a file installs where its
  subject is found (D-154).
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
name      = "structure/call-through"
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
after its name: `docs/stale-paths` is `checks/docs/stale-paths.ts` (D-146). The check name is the lookup key, and
no manifest names an analysis. Each built-in check is listed in [05-engines.md](05-engines.md) with what it searched before
being written.

## Selection

```text
selected = presets in gspot.toml
         + every preset they require, transitively

at init   = proposed presets, or the presets of the profile
         + every preset they recommend whose own detection matches, or that has no detection
         + every preset they require, transitively
         - what --without names and what the person cleared
```

Order is the order of first mention, dependencies first. Settings merge in that order. A circular
`requires` fails to load.

A scope's selection is the root selection plus the scope's own. A check runs once per scope
over that scope's files. Root-only presets (concern kind) run once over the whole tree.

## Detection

A language with a project file is proposed from that file, as a scope is (D-108). A language with
no project file is proposed from its files. A tool, framework, or library preset is proposed
only where the repository holds the thing. The plan lists what was found and not proposed, each
with its `gspot add` line. A preset whose checks all need git is not proposed in a folder that
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
| `zod`, `drizzle-orm`, `@trpc/server`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `next-intl` or `i18next` in dependencies | the library preset                                                                            |
| `*.sql` files                                                                                                                         | sql; postgres where a migrations folder, `pg`, or Supabase is found                           |
| `*.html` files; `index.html`, `_headers`, or a web manifest at the root                                                               | html; static-site                                                                             |
| `.md` files                                                                                                                           | markdown                                                                                      |
| `.json`, `.yaml`, `.toml` files                                                                                                       | config-files                                                                                  |
| any repository                                                                                                                        | structure, naming, formatting, spelling, secrets; commits, security, and licenses are offered |
| a language gspot has no preset for, named through `linguist-languages`                                                                | nothing; the plan names the language and its file count                                       |

Detection reads manifests and file names. It never reads code to guess a framework.

## One rule set, every framework

A framework changes which plugins run. It does not change the rules of the language under it
(D-137, D-138, D-141).

- Every shared rule reads every code file: `js`, `ts`, `jsx`, `tsx`, and the component endings
  a framework preset claims (`.vue`, `.svelte`, `.svelte.ts`).
- A limit is the same number in every framework: lines for each file, lines for each function,
  parameters, depth, statements, and complexity. No preset may change one.
- A framework turns a shared rule off only in its manifest, with a reason. A test compares the
  final ESLint config of a component file with that of a plain `ts` file, and fails on a
  difference that is not on the list.
- A framework preset holds every linter written for the framework. That is the recommended set
  of each plugin, an accessibility plugin, the type checker that reads its files, and the test
  rules of its runner.

| Framework    | Lint                                                                                                    | Accessibility                                 | Type check            | Tests                           | Turned off, and why                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| react        | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`                       | `eslint-plugin-jsx-a11y`                      | `tsc`                 | vitest or jest, testing-library | nothing                                                                             |
| nextjs       | react, `@next/eslint-plugin-next`, six checks of its own                                                | from react                                    | `tsc` with the plugin | from react                      | the one-file-folder rule, for route files the framework finds by name               |
| react-native | react, `@react-native/eslint-plugin`, `eslint-plugin-react-native`, `eslint-plugin-expo`, `expo-doctor` | none yet: the plugin ends at ESLint 8 (D-142) | `tsc`                 | jest, testing-library           | `jsx-a11y`, which reads DOM elements that React Native does not have                |
| nestjs       | `@darraghor/eslint-plugin-nestjs-typed`                                                                 | none: a server                                | `tsc` with decorators | jest                            | `no-extraneous-class` for a decorated class; `class-methods-use-this`, for handlers |
| vue          | `eslint-plugin-vue`                                                                                     | `eslint-plugin-vuejs-accessibility`           | `vue-tsc`             | vitest, testing-library         | nothing                                                                             |
| svelte       | `eslint-plugin-svelte`                                                                                  | `svelte-check`                                | `svelte-check`        | vitest, testing-library         | the one-file-folder rule, for SvelteKit route files                                 |

## Catalog

The full table with claims, tools and checks is [presets/README.md](presets/README.md). The v1 set is every preset the four reference repositories need. That covers a Python API, a Swift
app, an Express API, a Supabase project, a static site on Cloudflare, and a Next.js app.

## What a preset never does

- Hard-code a directory layout. A framework preset claims only the paths the framework itself
  dictates (`app/`, `supabase/migrations/`, `functions/`).
- Read a product value into its own configuration. A check that needs the nginx image tag reads
  the compose file at run time.
- Ship a tool without the options a real repository sets on it. The `extra` table covers the
  gap, and is no reason to leave an option out.
- Name another preset in a template, or hold a default that a manifest owns (D-139).
- Name a function, a folder, or a library of one repository in a rule pack, a default, or a rule
  file.
- Write into a file of the developer outside a managed block.
- Ship a check no stage runs.
- Ship a rule file that links to another rule file.
