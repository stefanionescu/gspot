# Kits

This document decides the unit of selection: its manifest, how it is detected, how kits
combine, and the available kits.

## What a kit is

A kit bundles its manifest and assets under `packages/cli/kits/<kind>/<name>/`. It contributes
the files it owns, tools with versions, configuration it renders, checks it runs, settings it
exposes, and guides it installs. It contributes nothing it does not declare. Kits own shipped
tools, versions, templates, default rule policy, styles, and vocabulary; the CLI code owns
loading, validation, parsing, and execution, and names no kit, tool, or check outside
`src/checks/`. A unit test holds that.

Shared language policies cover Swift, JavaScript, TypeScript, Python, and their supported
frameworks. Selecting a framework never drops language rules; see
[shared enforcement](05-engines.md#shared-enforcement-across-languages-and-frameworks).
Trivial-function and trivial-file rules stay enabled at every level.

## Kinds

Kit names are bare names; the kind is not part of the public name. Discovery reads each
manifest's directory and resolves its assets there. `general` is the kind for kits whose
checks span languages.

| Kind      | Selected by                                    | Owners files by                           | Examples                                                                                                                        |
| --------- | ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| language  | an extension in the tree                       | extension, filename, shebang              | typescript, python, swift, bash, sql, css, html, markdown                                                                       |
| framework | a dependency                                   | path convention the framework dictates    | nextjs, express, fastapi, nestjs, react, react-native, vue, svelte                                                              |
| platform  | the platform's config file                     | the platform's layout                     | supabase, cloudflare                                                                                                            |
| tool      | the tool's own file                            | the tool's files                          | docker, nginx, xcode, xctest, vitest, pytest                                                                                    |
| library   | a dependency                                   | none; adds rules to the language's checks | zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n                                                              |
| database  | a dialect or connection                        | migration and schema files                | postgres                                                                                                                        |
| general   | the person, for a concern that spans languages | the whole tree                            | structure, naming, prose, secrets, security, dependencies, licenses, commits, duplication, formatting, docs, files, static-site |

## Manifest

```toml
[kit]
name       = "typescript"
kind       = "language"
title      = "TypeScript"
requires   = ["javascript", "structure"]
recommends = ["naming", "formatting", "spelling"]

[detect]
project_files = ["tsconfig.json"]      # a folder that holds one is a scope, and proposes the kit
extensions    = [".ts", ".tsx", ".mts", ".cts"]
dependencies  = ["typescript"]

[owners]
extensions = [".ts", ".tsx", ".mts", ".cts", ".d.ts"]
filenames  = ["tsconfig.json", "tsconfig.*.json"]

[[tools]]
name        = "typescript-eslint"
kind        = "library"
version     = "8.46.2"
npm         = "typescript-eslint"
rule_page   = "https://typescript-eslint.io/rules/{rule}"
suppression = { marker = "eslint-disable", reason = " -- " }

# The old files this tool owns: init replaces them and keeps the original for uninstall.
[[tools.replace]]
file = "eslint.config.*"

[[configs]]
template = "eslint.fragment.js.tmpl"   # exports config blocks and selectors; names no other kit
target   = ".gspot/config/eslint.config.mjs"
fragment = true

[[checks]]
name    = "typescript/tsc"
example = "Assigning a string to a number-typed variable reports a type error. Supply the intended number and rerun."
level   = "recommended"
stage   = "push"
runs    = "per-scope"                  # per-file-list | per-scope | once
summary = "Checks that every TypeScript file type-checks."
why     = "A file that does not type-check can crash at run time in a way the editor already knew about."
help    = "Read the first error tsc prints and fix that file. Later errors are often the same mistake."

[[checks]]
name        = "typescript/eslint"
level       = "recommended"
stage       = "commit"
runs        = "per-file-list"
command     = ["eslint", "--max-warnings", "0", "--no-warn-ignored", "--config", "{config:eslint}", "{files}"]
fix_command = ["eslint", "--fix", "--config", "{config:eslint}", "{files}"]
fix_order   = "codemod"                # codemod | imports | manifest | format
summary     = "Runs ESLint with the shipped rule set over every TypeScript file."
why         = "ESLint catches mistakes the compiler accepts: unused code, unsafe casts, functions that only forward."
help        = "Run gspot check --fix for the rules that fix themselves, then read each line that is left."

[[settings]]
name      = "tools.eslint.rules"
kind      = "table"
direction = "per-rule"                 # options and rules turned on; off is an [[ignore]]

[defaults]                             # a default for a setting another kit declares
"tools.sqlfluff.dialect" = "postgres"

[coverage]
".ts" = ["format", "syntax", "style", "types"]

[guides]
language = ["packages/cli/guides/language/TYPESCRIPT.md", "packages/cli/guides/language/naming/TYPESCRIPT.md"]
```

### Field rules

- `name` is a bare kebab-case name and matches the folder name. A manifest that repeats the
  check name of another manifest fails to load.
- `requires` pulls kits in, and a person cannot drop them. A required kit that is missing
  fails to load. `recommends` names kits that `init` selects with this one and a person can
  drop. Every language kit recommends `naming`, `formatting` and `spelling`. `structure` stays
  required because it owns the `limits.*` settings.
- A check whose engine belongs to a dropped kit does not run, and `doctor` lists the
  recommended kits that are not selected.
- `detect` proposes the kit at `init` and in `doctor`; detection never selects.
- `owners` decides which files the kit's checks receive: `extensions`, `filenames` at any
  depth, and `tags` computed the way the pre-commit `identify` library does from extension,
  shebang, executable bit, and content. A file owned by no selected kit is unchecked.
- `[[tools]]` rows take `kind = "binary"` (the default) or `kind = "library"`. A tool has a
  `version`, or a `floor` when the repository brings the tool, and the name under each
  ecosystem gspot knows (`npm`, `pypi`, `mise`, `brew`, `cargo`, `github`). A library is never
  spawned; `doctor` reads its version under `.gspot/node_modules/<npm name>/`.
- A tool also takes `version_command`, `rule_page` (with `{rule}` where the name goes),
  `suppression`, `crash_pattern` (the output that means the tool fell over), and `env`. Its
  `[[tools.replace]]` rows name a `file` init replaces, or a `key` or `table` of a shared
  manifest with `shared = true`, which is named in the plan and never edited.
- A library tool that is a Prettier plugin declares `prettier = { entry, overrides }`; the
  formatting generator emits both, and no template names a plugin.
- Every `[[configs]]` entry has a reader among the checks, or fails to load. A config takes
  `pointer` for a file at the conventional root path that directs an editor to the generated
  configuration.
- A fragment config takes `code_files`, the globs its framework adds to the code and
  type-checked file sets. It takes `[[configs.selectors]]` rows, each a `selector` with its
  `message`, that the base template joins into the one `no-restricted-syntax` rule per file
  set.
- A check name is `<family>/<name>`. The family is the engine or the tool family that produces
  the finding, not always the kit.
- Every check carries `level`, `stage`, `summary`, `why`, `help`, and `example`, written for a
  person who does not code, and the loader refuses an empty one. `explain`, the finding line,
  and the generated reference print them.
- `runs` says how a check receives files. `per-file-list` passes the owned files of each scope
  as `{files}`. `per-scope` runs once in each scope, and its cache key covers every tracked
  text file under the scope. `once` runs one time from the root.
- `reported_by` names the check whose run carries this check's findings. `replaces` names a
  check whose work this check does itself; in a scope that plans both, the named check is
  skipped with the note `<taker> runs it here`.
- A check takes `waits_for`, the setting it needs; with it unset the check prints `skipped`
  and names it. It takes `needs`, the kit whose generated files it reads. It takes `env`, a
  table of environment values that expand `{config:name}`.
- A check takes `needs_git`. A kit takes it when every check reads Git, and `init` leaves that
  kit out of a folder with no `.git`. A check takes `requires_tools`, the tools its command
  starts under another name, such as the bash that runs Bats. Each must pass its floor.
- A command check is cached unless it takes `cached = false`; an analysis is not cached unless
  it takes `cached = true`. A check with `fix_command` names its `fix_order`. A check whose
  exit code does not reflect findings declares `count_regex`.
- A setting is declared once. Two kits that need one setting share the declaration of its
  owner, and a framework or platform kit sets its value under `[defaults]`.
- A setting takes `role`, the architecture role of the folder it names; a template asks for
  the folders of a role, never for the setting by name. A setting takes `detect`, a table
  `init` fills from the repository: `dependency`, `dependencies`, `folders`, or
  `folder_values`.
- `[coverage]` names, per extension, the check kinds a file needs to count as fully checked:
  `format`, `syntax`, `schema`, `style`, `types`, `structure`, `naming`, `prose`, `spelling`,
  `security`, `dependencies`, `duplication`, `links`, `freshness`. `doctor` reports files that
  fall short.
- `[guides]` names the Markdown files by layer; an entry may carry `when`, a detection table.
- `[[rules_off]]` lists the shared rules a framework turns off, each with a reason.
  `[required_rules]` lists, per file ending, the ESLint rules that must be on, and
  `integrity/required-rules` reads it. `entry_files` names the files a dead-code scan starts
  from.

### Built-in checks

A check can name a gspot engine instead of a command:

```toml
[[checks]]
name    = "structure/trivial-function"
stage   = "commit"
engine  = "structure"
rules   = "rules/call-through"       # a directory of ast-grep YAML, one file per grammar
limit   = "limits.trivial_statements"
summary = "Finds a function that only passes its arguments on to one other function."
why     = "The extra name adds a hop to read and nothing to the program."
help    = "Call the inner function directly and delete the wrapper, or give the wrapper real work."

[[checks]]
name    = "integrity/stale-paths"
stage   = "commit"
engine  = "integrity"
analysis = "stale-paths"
```

Each check family exports one analyses registry from `packages/cli/src/checks/<family>/`,
keyed by the `analysis` name, and `packages/cli/src/checks/dispatch.ts` spreads them. Each built-in check is
listed in [05-engines.md](05-engines.md) with what it searched before being written.

## Selection

```text
selected = kits in gspot.toml
         + every kit they require, transitively

at init   = proposed kits, or the kits of the profile
         + every kit they recommend whose own detection matches, or that has no detection
         + every kit they require, transitively
         - what --without names and what the person cleared
```

Order is the order of first mention, dependencies first. Settings merge in that order. A circular
`requires` fails to load. A scope's selection is the root selection plus the scope's own. A
check runs once per scope over that scope's files. General kits run once over the whole tree.

## Detection

A language with a project file is proposed from that file, as a scope is. A language with
no project file is proposed from its files. A tool, framework, or library kit is proposed
only where the repository holds the thing. The plan lists what was found and not proposed, each
with its `gspot add` line. Detection reads manifests and file names; it never reads code to
guess a framework.

| Signal                                                                                                                                | Proposes                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| a project file: `package.json` with `typescript`, `pyproject.toml`, `requirements*.txt`, `Pipfile`, `Package.swift`                   | that language, and a scope for its folder                                                     |
| files of a language with no project file: Bash, SQL, HTML, CSS, Markdown                                                              | that language                                                                                 |
| shebang on an extensionless file (`bash`, `sh`, `zsh`, `python`, `node`)                                                              | bash or python or javascript                                                                  |
| `next` in dependencies, `next.config.*`                                                                                               | nextjs                                                                                        |
| `express`, `fastapi`, `@nestjs/core` in dependencies                                                                                  | that framework                                                                                |
| `supabase/config.toml`                                                                                                                | supabase, postgres, sql                                                                       |
| `wrangler.jsonc`, `wrangler.toml`, `functions/_middleware.js`, `_headers`                                                             | cloudflare                                                                                    |
| `*.xcodeproj`, `Package.swift`                                                                                                        | swift; xcode for the project                                                                  |
| `Dockerfile*`, `docker-compose*.yml`; `nginx.conf`                                                                                    | docker; nginx                                                                                 |
| `vitest` in dependencies; `pytest` in dependencies or `[tool.pytest]`                                                                 | vitest; pytest                                                                                |
| `zod`, `drizzle-orm`, `@trpc/server`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `next-intl` or `i18next` in dependencies | the library kit                                                                               |
| `*.sql` files                                                                                                                         | sql; postgres where a migrations folder, `pg`, or Supabase is found                           |
| `*.html` files; `index.html`, `_headers`, or a web manifest at the root                                                               | html; static-site                                                                             |
| `.md` files; `.json`, `.yaml`, `.toml` files                                                                                          | markdown; files                                                                               |
| any repository                                                                                                                        | structure, naming, formatting, spelling, secrets; commits, security, and licenses are offered |
| a language gspot has no kit for, named through `linguist-languages`                                                                   | nothing; the plan names the language and its file count                                       |

## One rule set, every framework

A framework changes which plugins run. It does not change the rules of the language under it.
Every shared rule reads every code file, including the component endings a framework kit owns
(`.vue`, `.svelte`, `.svelte.ts`). A limit is the same number in every framework.

A framework
turns a shared rule off only in its manifest, with a reason. A test compares the final ESLint
config of a component file with that of a plain `ts` file. A framework kit holds every linter
written for the framework. That is the recommended set of each plugin, an accessibility
plugin, the type checker that reads its files, and the test rules of its runner.

| Framework    | Lint                                                                                                    | Accessibility                         | Type check            | Tests                           | Turned off, and why                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| react        | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`                       | `eslint-plugin-jsx-a11y`              | `tsc`                 | vitest or jest, testing-library | nothing                                                                             |
| nextjs       | react, `@next/eslint-plugin-next`, six checks of its own                                                | from react                            | `tsc` with the plugin | from react                      | the one-file-folder rule, for route files the framework finds by name               |
| react-native | react, `@react-native/eslint-plugin`, `eslint-plugin-react-native`, `eslint-plugin-expo`, `expo-doctor` | none yet: the plugin ends at ESLint 8 | `tsc`                 | jest, testing-library           | `jsx-a11y`, which reads DOM elements that React Native does not have                |
| nestjs       | `@darraghor/eslint-plugin-nestjs-typed`                                                                 | none: a server                        | `tsc` with decorators | jest                            | `no-extraneous-class` for a decorated class; `class-methods-use-this`, for handlers |
| vue          | `eslint-plugin-vue`                                                                                     | `eslint-plugin-vuejs-accessibility`   | `vue-tsc`             | vitest, testing-library         | nothing                                                                             |
| svelte       | `eslint-plugin-svelte`                                                                                  | `svelte-check`                        | `svelte-check`        | vitest, testing-library         | the one-file-folder rule, for SvelteKit route files                                 |

## Available kits

The set is every kit under `packages/cli/kits/`, and `gspot list` prints it. It covers a Python
API, a Swift app, an Express or Nest API, a Supabase project, a static site on Cloudflare, and
a Next.js, React, Vue, or Svelte app. `levels/inventory.csv` and `levels/native.csv` hold
every rule with its level.

## What a kit never does

- Hard-code a directory layout. A framework kit owns only the paths the framework itself
  dictates (`app/`, `supabase/migrations/`, `functions/`).
- Read a product value into its own configuration. A check that needs the nginx image tag reads
  the compose file at run time.
- Ship a tool without the options a real repository sets on it. The `extra` table covers the
  gap, and is no reason to leave an option out.
- Name another kit in a template, or hold a default that another manifest owns outside
  `[defaults]`.
- Name a function, a folder, or a library of one repository in a rule pack, a default, or a
  guide.
- Write into a file of the developer outside a managed block.
- Ship a check no stage runs, or a guide that links to another guide.

## Names across the public contract

Use `name` for a definition's own name. Use the entity word for a reference to that
definition: `check`, `kit`, or `rule`. A finding's `check` field holds a check name; it is not
a second definition. A setting name is its dotted kit address.

| Meaning                                  | Definition or serialized field                            | Local variable or parameter                               |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Check definition                         | `CheckSpec.name`                                          | `check`                                                   |
| Check name                               | `Finding.check`, `CheckResult.check`, `IgnoreEntry.check` | `checkName`, plural `checkNames`                          |
| Planned execution of a check             | `PlannedCheck`                                            | `plannedCheck`                                            |
| Kit definition                           | `manifest.kit.name`                                       | `kit`; `manifest` for the complete manifest               |
| Kit name                                 | `kit` when referenced; `kits` for a list                  | `kitName`, plural `kitNames`                              |
| Tool rule name                           | `rule` on a finding or ignore                             | `ruleName`, plural `ruleNames`                            |
| Setting definition and its name          | `SettingSpec.name`                                        | `setting` for the definition, `settingName` for its name  |
| Scope definition and its path            | `scope.path`; `scope` in a serialized result              | `scope` for the object, `scopePath` for the relative path |
| Tracked file and its path                | `file.path`; `file` in a finding                          | `file` for the object, `filePath` for the path            |
| Config root, Git root, process directory | Preserve the relevant external schema field               | `configRoot`, `gitRoot`, `workingDirectory`               |

A named domain definition does not acquire `id` or `key` as an alias. External contracts keep
their required fields, such as SARIF `ruleId`, SPDX identifiers, Git object IDs, and process
APIs' `cwd`. Schema fields keep their snake_case; TypeScript variables use camelCase, and a
parsed object can retain its schema field names without a translation layer.
