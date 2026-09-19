# Presets

This document decides the unit of selection: its manifest, how it is detected, how presets
combine, and the catalog.

## What a preset is

A preset is a folder in the gspot distribution:

```text
presets/typescript/
  manifest.toml            everything the preset contributes
  eslint.config.js.tmpl    configuration templates
  tsconfig.base.json.tmpl
  knip.json.tmpl
  rules/                   ast-grep rule files, one directory per rule, one file per grammar
```

The agent rule files are not inside the preset folder: the corpus is one tree under `rules/`
and the manifest names its files there by path ([16-file-tree.md](16-file-tree.md)).

A preset contributes: files it claims, tools with versions, configuration it renders, checks it
runs, settings it exposes, and rule files it installs. It contributes nothing it does not declare.

## Kinds

Seven kinds. The kind names the folder under `presets/` in this documentation and a `kind` field in
the manifest. Preset ids are bare names; the kind is not part of the id.

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
id       = "typescript"
kind     = "language"
title    = "TypeScript"
requires = ["javascript", "structure"]
recommends = ["naming", "formatting", "spelling"]
conflicts = []

[detect]
extensions   = [".ts", ".tsx", ".mts", ".cts"]
filenames    = ["tsconfig.json"]
dependencies = ["typescript"]

[claims]
extensions = [".ts", ".tsx", ".mts", ".cts", ".d.ts"]
filenames  = ["tsconfig.json", "tsconfig.*.json"]

[[tools]]
name    = "typescript"
version = "5.9.3"
npm     = "typescript"

[[tools]]
name    = "eslint"
version = "9.38.0"
npm     = "eslint"
# every plugin the config imports is a tool too, so doctor can verify it

[[configs]]
template = "eslint.config.js.tmpl"
target   = ".gspot/eslint.config.js"
stub     = { path = "eslint.config.js", body = "export { default } from './.gspot/eslint.config.js';" }

[[configs]]
template = "tsconfig.base.json.tmpl"
target   = ".gspot/tsconfig.base.json"
stub     = { path = "tsconfig.json", merge = { extends = "./.gspot/tsconfig.base.json" } }

[[checks]]
id      = "typescript/tsc"
stage   = "commit"
runs    = "per-scope"               # per-file-list | per-scope | once
command = ["tsc", "--noEmit", "-p", "{stub:tsconfig.json}"]
summary = "Checks that every TypeScript file type-checks with the strict compiler options."
why     = "A file that does not type-check can crash at run time in a way the editor already knew about."
fix     = "Read the first error tsc prints and fix that file; later errors are often the same mistake."

[[checks]]
id      = "typescript/eslint"
stage   = "commit"
runs    = "per-file-list"
command = ["eslint", "--max-warnings", "0", "--no-warn-ignored", "--config", "{config:eslint}", "{files}"]
fix_command = ["eslint", "--fix", "--config", "{config:eslint}", "{files}"]
fix_order = "codemod"               # codemod | imports | manifest | format
summary = "Runs ESLint with the shipped rule set over every TypeScript file."
why     = "ESLint catches mistakes and slop the compiler accepts: unused code, unsafe casts, functions that only forward."
fix     = "Run gspot check --fix for the rules that fix themselves, then read each remaining line; gspot explain <rule> says what it means."

[[checks]]
id       = "typescript/knip"
stage    = "push"
runs     = "per-scope"
command  = ["knip", "--config", "{config:knip}"]
summary  = "Finds files, exports and dependencies nothing uses."
why      = "Dead code is read, maintained and shipped for nobody."
fix      = "Delete what knip names, or add a knip entry point if the file is loaded in a way knip cannot see."

# every tool gets `tools.<name>.extra` (verbatim passthrough with a reason) without declaring it
[[settings]]
name      = "tools.eslint.rules"
kind      = "table"
direction = "per-rule"              # options and rules turned on; `off` is refused (use an ignore)

[[settings]]
name      = "tools.typescript.paths"
kind      = "table"
direction = "neutral"

[inspections]
".ts" = ["format", "syntax", "style", "types", "structure", "naming", "prose", "spelling"]

[rule_files]
language = ["language/TYPESCRIPT.md", "language/naming/TYPESCRIPT.md"]
```

### Field rules

- `id` is a bare kebab-case name and matches the folder name.
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
  looks for a library at `node_modules/<npm name>/package.json`, in the root and in each scope,
  and reads its version there. A library is never spawned.
- `conflicts` names presets that cannot be selected together.
- `runs` says how a check receives files. `per-file-list` passes the claimed files of each scope.
  `per-scope` runs once in each scope with no file list. `once` runs one time over the whole
  repository, from the root. It replaces `takes`, `whole` and the scope guard inside a check.
- `reported_by` names the check whose run carries this check's findings, such as
  `markdown/prettier`, which `formatting/prettier` reports. The check shows as skipped with that
  note.
- `takes_over` names a check whose work this check does itself. In a scope that plans both,
  the named check is skipped with the note `<taker> runs it here` (D-99).
- `[inspections]` lists, for each extension, the inspection kinds a file of that extension must
  receive. `doctor` reports a file that misses one as partly checked.
- `[rule_files]` lists the corpus files the preset installs, by layer.
- `[required_rules]` lists, for a file ending, the ESLint rules that must be on for a file with
  that ending. `integrity/required-rules` reads it (D-99).
- A check id is `<family>/<name>`. The family is the engine or the tool family that produces the
  finding (`structure`, `naming`, `integrity`, `prose`, `security`, or the preset's own id), not
  always the preset. `gspot explain <check-id>` prints the preset that ships it.
- `detect` proposes the preset at `init` and in `doctor`. Detection never selects.
- `claims` decides which files the preset's checks receive. A `filenames` claim matches at any
  depth (`_headers` under `public/` is `_headers`); an `extensions` claim likewise. A file claimed by no selected preset is unchecked.
- `claims` may also name `tags`, computed the way the pre-commit `identify` library does from extension, shebang, executable bit, and content (`shell`, `python`, `node`, `executable`, `text`, `binary`). Hooks and task files with no extension are then claimed without a filename list.
- Every tool the checks or the generated configuration need is in `[[tools]]` with a version
  and the name under each ecosystem gspot knows (`npm`, `pypi`, `mise`, `brew`, `cargo`,
  `github`). `doctor` verifies presence and version.
- Every `[[configs]]` entry has a reader among the checks, or fails to load.
- Every check is in a stage. `commit` checks need nothing but the source. `push` checks need a
  build, a daemon, or the network. `manual` checks take minutes or need credentials.
- Every check carries `summary` (what it looks for, one sentence), `why` (what goes wrong
  without it) and `fix` (what to do), written for a person who does not code. The loader refuses an empty one.
- `explain`, the finding line and the generated page under `docs/rules/` print
  them; nothing else describes a check.
- `runs = "per-file-list"` receives the claimed file list as `{files}`. `runs = "per-scope"` runs once from the scope root and reports its own inputs. Its cache key and file count cover every
  tracked text file under the scope, child scopes included, because the tool reads the project
  rather than the claimed files.
- A check whose tool owns its baseline names `baseline_file`, `baseline_command` (run at `init` when the check has findings, instead of a count file) and `prune_command` (run by `apply --lower-baselines`). `{baseline}` expands to the file's path; `{suppressions}` expands to the flags that read it, and to nothing while the file does not exist.
- A check with `fix_command` names its `fix_order`. `fix` is the prose that tells a person what to do; `fix_command` is what `check --fix` runs.
- A check whose exit code does not reflect findings declares `count_regex`.
- `[inspections]` names, per extension, the inspection kinds a file needs to count as fully
  checked. `doctor` reports files that fall short. Kinds: `format`, `syntax`, `schema`, `style`,
  `types`, `structure`, `naming`, `prose`, `spelling`, `security`, `dependencies`,
  `duplication`, `links`, `freshness`.
- `[rules]` names the Markdown files by layer.

### Built-in checks

A check can name a gspot engine instead of a command:

```toml
[[checks]]
id      = "structure/call-through"
stage   = "commit"
engine  = "structure"
rules   = "rules/call-through"       # a directory of ast-grep YAML, one file per grammar
limit   = "limits.trivial_statements"
summary = "Finds a function that only passes its arguments on to one other function."
why     = "The extra name adds a hop to read and nothing to the program."
fix     = "Call the inner function directly and delete the wrapper, or give the wrapper real work."

[[checks]]
id      = "naming/identifiers"
stage   = "commit"
engine  = "naming"

[[checks]]
id      = "integrity/stale-paths"
stage   = "commit"
engine  = "integrity"
analysis = "stale-paths"
```

Each built-in analysis is listed in [05-engines.md](05-engines.md) with what it searched before
being written.

## Selection

```text
selected = presets in gspot.toml
         + every preset they require, transitively

at init   = detected presets, or the profile's presets
         + every preset they recommend, minus --without and the cleared choices
         + every preset they require, transitively
```

Order is the order of first mention, dependencies first. Settings merge in that order. A circular
`requires` fails to load.

A scope's selection is the root selection plus the scope's own. A check runs once per scope
over that scope's files. Root-only presets (concern kind) run once over the whole tree.

## Detection

Signals, in the order `init` prints them:

| Signal                                                                                                                                | Proposes                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| extension present in the tree, matched against every language preset's `detect.extensions`                                            | that language                                                                                                                                                                                                         |
| shebang on an extensionless file (`bash`, `sh`, `zsh`, `python`, `node`)                                                              | bash or python or javascript                                                                                                                                                                                          |
| `next` in dependencies, `next.config.*`                                                                                               | nextjs                                                                                                                                                                                                                |
| `express` in dependencies                                                                                                             | express                                                                                                                                                                                                               |
| `fastapi` in dependencies                                                                                                             | fastapi                                                                                                                                                                                                               |
| `supabase/config.toml`                                                                                                                | supabase, postgres, sql                                                                                                                                                                                               |
| `wrangler.jsonc`, `wrangler.toml`, `functions/_middleware.js`, `_headers`                                                             | cloudflare                                                                                                                                                                                                            |
| `*.xcodeproj`, `Package.swift`                                                                                                        | swift; xcode for the project                                                                                                                                                                                          |
| `Dockerfile*`, `docker-compose*.yml`                                                                                                  | docker                                                                                                                                                                                                                |
| `nginx.conf`                                                                                                                          | nginx                                                                                                                                                                                                                 |
| `vitest` in dependencies                                                                                                              | vitest                                                                                                                                                                                                                |
| `pytest` in dependencies or `[tool.pytest]`                                                                                           | pytest                                                                                                                                                                                                                |
| `zod`, `drizzle-orm`, `@trpc/server`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `next-intl` or `i18next` in dependencies | the library preset                                                                                                                                                                                                    |
| `*.sql` files                                                                                                                         | sql; postgres when Postgres syntax appears                                                                                                                                                                            |
| `*.html` with no framework and a build script                                                                                         | html, static-site                                                                                                                                                                                                     |
| `.md` files                                                                                                                           | markdown                                                                                                                                                                                                              |
| `.json`, `.yaml`, `.toml` files                                                                                                       | config-files                                                                                                                                                                                                          |
| any repository                                                                                                                        | structure, naming, formatting, docs, secrets, dependencies, commits, spelling                                                                                                                                         |
| `go.mod`, `Cargo.toml`, `Gemfile`, `manage.py`                                                                                        | nothing yet; `init` prints "no preset for go; 212 files unchecked" and `doctor` lists them. The language name and the extension list come from GitHub Linguist's data (`linguist-languages`), not a table gspot keeps |

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
- Ship a tool without slots for the options a real repository sets on it. The `extra` table
  covers the gap until the slot exists; it is not a reason to leave the slot out.
- Ship a check no stage runs.
- Ship a rule file that links to another rule file.
