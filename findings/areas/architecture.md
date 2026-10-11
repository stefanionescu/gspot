# Source architecture, imports, and the config/ and types/ folders

This area is the shipped code of the CLI (`packages/cli/src/`) and the ESLint plugin (`packages/eslint-plugin/src/`),
how their files import each other, and the `config/` and `types/` folders that every package keeps. Today no two files
import each other by value, but 125 files are named `public.ts` or `contracts.ts`, several folders mix unrelated jobs,
and `config/` and `types/` copy the source tree file by file. The target: every file is named for what it holds, the
folders follow the layout below and import one way, and `config/` and `types/` hold one file per topic under the import
rule and the type rule below.

## Findings

### ARC-002: `public.ts` and `contracts.ts` name 125 files and say nothing about them

- Where: 67 `public.ts` (65 in the CLI, 2 in the plugin) and 58 `contracts.ts` (all in the CLI) under
  `packages/cli/src/` and `packages/eslint-plugin/src/`
- Kind: rename
- Problem: The two names do not mark an interface or a private part. They exist only so that tests may import from
  them under the generated ESLint rule that lets tests import runtime values only from `public.*` and `contracts.*`
  files. A reader cannot tell from a path what a file holds. The two names hold 28,080 of the 47,037 source lines (60%), and 2,466 import lines end in one of them: a reader with many editor tabs open sees a row of `public.ts` tabs, quick-open for "public" lists 67 files, stack traces print `public.ts:205`, and review diffs show a column of identical names. The cost leaks out of the source: `docs/src/config/reference.ts:16-22` maps the `install` and `export` commands to `commands/contracts.ts`, and `AGENTS.md` names `lifecycle/ownership/state/contracts.ts`. Commit `9a3851a9a` renamed 106 files to these two names,
  added 19 more that merge older files, and deleted 116 files with clear names; that is all 125 files of these names
  today. Every value import from tests into shipped code (about 1,360 import lines) goes to these two names, apart
  from `config/` constants. In 32 folders `public.ts` imports `contracts.ts`, in 12 the reverse.
- Fix: Do after TML-001, which deletes the rule. Give each file the name of what it holds. "Rename table A" in `naming-source.md` gives the final files for each of them, and the `placement/` rows place every function,
  constant, and type. Most names are the names the files had before `9a3851a9a`; the 19 merged files split by
  content. The check folder `checks/tool/` becomes `checks/infrastructure/` and `checks/testing/` (CKO-005). The program file is `commands/program.ts`, and `src/main.ts` stays. The path in `AGENTS.md` becomes `packages/cli/src/ownership/log-schema.ts`.
- Size: large

### ARC-003: Three files lost the names that say what they hold

- Where: `packages/cli/src/checks/public.ts`, `packages/cli/src/execution/command/public.ts`,
  `packages/cli/src/policy/document/public.ts`
- Kind: rename
- Problem: Commit `9a3851a9a` turned three named files into `public.ts`: the built-in check table
  (`checks/built-in.ts`), the code that runs a command check (`execution/command/check.ts`), and the gspot.toml file
  code (`policy/file.ts`, which holds `readPolicyFile`, `writePolicyFile`, and `parseTomlText`). The code already
  calls these checks "built-in" (`BuiltInCheck`).
- Fix: `checks/public.ts` becomes `checks/built-in.ts` (not `checks/registry.ts`: "registry" means a package
  registry); `execution/command/public.ts` becomes `execution/command/check.ts`; `policy/document/public.ts` becomes
  `settings/file.ts` (the `policy/` folder becomes `settings/`, glossary). The check table itself is
  `CHECK_FUNCTIONS` (CKO-019).
- Size: small

### ARC-008: `config/` and `types/` copy the source tree file by file and import back into the code

- Where: `packages/cli/src/config/` (109 files, 2,782 lines), `packages/cli/src/types/` (116 files, 3,238 lines),
  `packages/eslint-plugin/src/config/` and `types/` (19 files, 163 lines); `gspot.toml:76-166` (module paths with
  `{,config/,types/}` prefixes, the roles `config` and `types`); the `AGENTS.md` paragraph on `types/` and `config/`
- Kind: move
- Problem: Each concept lives in three places: the code, its constants, and its types, one mirror file per source
  file. About 140 of the 225 CLI mirror files serve one top-level folder only; 71 have at most two exports and one
  importer; 120 have 15 lines or fewer; four plugin files hold one line each. The folders also break their own
  direction: 33 constants annotate themselves with a type from `types/` or a package, and 60 types are
  `z.infer<typeof schema>` of a schema that lives in the code. So `types/` imports back from `parsers/`, `config/`,
  `policy/`, and `lifecycle/` (48 type-only imports), which makes nine type-only file cycles (for example
  `config/platform/managed-blocks.ts` and `types/platform/managed-blocks.ts` import each other) and one type-only cycle
  of 12 top-level folders.
- Fix: Keep `config/` (fixed values) and `types/` (types and interfaces) in every package: the CLI, the ESLint
  plugin, `scripts/`, `docs/src/`, and `tests/`. Group the files by topic, not one per source file, as "Layout" below
  lists them (CLI: 111 `config/` files, 60 `types/` files). Follow the import rule below: `config/` imports only
  `config/`, so each value is written `as const` with no annotation and the code that uses it checks the type;
  `types/` imports only `config/` and `types/` (plus `import type` from a library), so every exported type is written
  by hand and each zod schema is checked against it by the type rule below. This removes all nine cycles and the
  folder cycle. In this repository's `gspot.toml`, state the rule with `[[architecture.module]]` records (decision
  35): one module per package for `config/` (`packages/cli/src/config/**`, `may_import = []`) and one for `types/`
  (may import that package's `config`); the area modules keep the layer order in "Layout" with their own folder only
  (no `config/` or `types/` paths, no `{,config/,types/}` prefixes) and may import `config` and `types`. The same two
  modules exist for the ESLint plugin, `scripts/`, `docs/src/`, and `tests/` (`tests/types` may also import the
  CLI's `types` and `config`). The roles `config` and `types` go (TML-001). Rewrite the `AGENTS.md` paragraph to this
  rule. The check covers imports between repository files; a package import inside `config/` is not caught by it.
  The shipped check `structure/config-logic` goes (CKG-010): gspot does not impose this layout on other projects.
- Size: large

### ARC-025: Three rules together force every leaf folder to two files

- Where: `packages/cli/src/checks/general/structure/lone-files.ts:15-35`, `.gspot/config/eslint.config.mjs`
  (`max-lines` 300), the generated rule that lets tests import only `public.*` and `contracts.*` files
- Kind: simplify
- Problem: A folder with one code file fails `structure/lone-file`, a file over 300 code lines fails `max-lines`, and
  tests may import only `public` and `contracts` files. The result is 33 folders that hold only `public.ts` and
  `contracts.ts`, and 44 of 110 source folders that hold exactly two files.
- Fix: With the test-import rule gone (TML-001), flatten each two-file folder whose halves are unrelated into its
  parent with plain names (see "Layout"). Do not split a file only to stay under `max-lines`; split it where the
  concepts part.
- Size: small

### ARC-026: 65 exports are used only inside their own file

- Where: 43 files under `packages/cli/src/` and `packages/eslint-plugin/src/`; the examples that no topic record
  covers: `checks/language/swift/public.ts` (`scopeBuildFolder`, `prepareBuildSources`), `commands/explain/public.ts`
  (`explainPath`), and 32 types in `types/`
- Kind: simplify
- Problem: The `export` keyword makes them look like an interface. Nothing outside the file imports them (no package,
  test, script, or docs file). knip does not report them because `.gspot/config/knip.json:120` sets
  `ignoreExportsUsedInFile: true`.
- Fix: Drop `export` from each. The topic records decide the exports of their areas, with renames and moves:
  CKG-038, EXG-047, LIF-042, PAR-048, PLG-005, PLR-031, and POL-051; the `placement/` rows of this record mark the rest. The generated `namingSettingSchemas` goes with the generated schemas (POL-001).
- Size: small

### ARC-028: Import-time work runs on every command

- Where: `packages/cli/src/policy/document/public.ts:77-90` (reads every manifest and the format defaults at module
  scope), `policy/settings/public.ts:104-128` (`rootDeclarations` and `nativeDeclarations` convert schemas to JSON
  Schema), `policy/paths.ts:8`, `generation/compilation/public.ts:62`; `src/public.ts:1-16` imports every command
- Kind: simplify
- Problem: `gspot --version` and `gspot --help` evaluate every module, which parses all manifests and converts schemas
  before the program reads its arguments.
- Fix: Move the module-scope work into the functions that need it, behind the run cache (`memo` in
  `system/file-reads.ts`). Measure the start time before and after.
- Size: small

### ARC-039: The folder cycles of the check table are harmless

- Where: `checks/public.ts` and `checks/*/`, `tools/public.ts` and `tools/{npm,python}/`, `generation/*` and
  `generation/{compilation,documents}/`, `policy/*` and `policy/{document,errors,settings}/`, `repository/*` and
  `repository/{discovery,paths}/`, `execution/*` and `execution/command/`, `configurations/*` and
  `configurations/errors/`, `lifecycle/merge` and `lifecycle/ownership` (under `packages/cli/src/`)
- Kind: simplify
- Problem: Eight second-level folder cycles come from a parent folder that holds both a table or entry file and a
  leaf file the children import. For example, 69 files under `checks/` import only `checks/finding.ts` from their
  parent, while `checks/public.ts` imports the children. No file-level value cycle stands behind them.
- Fix: No work beyond the renames: once the leaves are separate named files (`checks/finding.ts`, `tools/run.ts`,
  `execution/report.ts`) and `generation/documents/`, `policy/document/`, `repository/discovery/`,
  `repository/paths/`, `execution/command/arguments/`, and `configurations/errors/` are flattened ("Layout"), most of
  them disappear, and the rest are a table that imports its entries.
- Size: small

### LAY-001: One topic has two or three file names

- Where: `config/generation/{tool-files,tool-file-values,tool-file-sources}.ts`; `config/tools/install.ts` beside
  `config/install.ts`; `types/ownership/managed-keys.ts` beside `types/ownership.ts`;
  `types/settings/{declarations,values}.ts` (both meant to hold `SettingDeclaration`);
  `config/parsers/generated-header.ts` beside `config/generation/headers.ts`; `types/commands/install.ts` beside
  `types/install.ts` (under `packages/cli/src/`)
- Kind: merge
- Problem: The same topic gets different file names, so a reader cannot know which file holds a value, and one type
  could land in two files.
- Fix: One file per topic: `config/generation/tool-file-sources.ts`, `config/tools/diagnostics.ts`,
  `types/ownership.ts`, `types/settings/tables.ts` (holds `SettingDeclaration`), `config/generation/headers.ts` (the
  generated header for both the writer and the reader), and `types/install.ts`.
- Size: small

### LAY-002: One value sits in up to four files under up to three names

- Where: the 26 values in "One value, one place" below (for example `'.gitignore'` in four files, `'node_modules'`
  under three names, `'Package.swift'` under two names in three files)
- Kind: merge
- Problem: Each area names the values its own code uses, so one file name, folder name, or tool name gets several
  constants, and a change must be made in several places.
- Fix: Each value has one name, in the `config/` file of the area that owns the concept; the other files import it
  (`config/` may import `config/`). The table "One value, one place" gives each name and file.
- Size: medium

### LAY-003: Eight constant names hold two different values

- Where: `JSON_EXTENSIONS`, `PRETTIER_DEFAULTS`, `RULE_PLACEHOLDER`, `URL_SCHEME` and `URL_USER`,
  `XCODE_PROJECT_FILE`, `PRIVATE_PREFIX`, `REQUIREMENTS_FILE`, `REQUIREMENT_NAME`
- Kind: rename
- Problem: The same constant name means two things in two files. For example `RULE_PLACEHOLDER` is `'{rule}'` in the
  manifest placeholders and `'<rule>'` in the settings help texts.
- Fix: Give the second value its own name, as the table "Same name, two values" below says: `JSON_EDIT_EXTENSIONS`,
  `PRETTIER_FIXED_OPTIONS`, `RULE_TOKEN`, `REMOTE_URL_SCHEME` and `REMOTE_URL_USER`, `PBXPROJ_NAME`,
  `PYTHON_PRIVATE_PREFIX`, one `REQUIREMENTS_FILE`, and `PINNED_PACKAGE_NAME`.
- Size: small

### LAY-004: The setting table types pass 300 lines in one file

- Where: `placement/` rows P09:244-246 (`TableName`, `TableValues`, `TableSettings`), `settings/schema/tables.ts`
- Kind: move
- Problem: Every exported type is written by hand (the type rule). `TableValues` maps about 65 tables with about 215
  keys; one interface per table in one file is about 400 lines, over the limit.
- Fix: `types/settings/tables.ts` holds `SettingDeclaration`, `TableName` (`keyof TableValues`), `TableValues`,
  `TableSettings<T>`, and the interfaces of the root tables (`[limits]`, `[naming]`, `[format]`, `[architecture]`,
  `[ci]`, `[hooks]`, `[rules]`, and the root keys). The `[tools.<tool>]` interfaces go to a new
  `types/settings/tool-tables.ts`. The table of one configuration (for example `[licenses]`, `[postgres]`, `[swift]`)
  goes to that configuration's group file `types/checks/<group>.ts`, beside the check types that read it;
  `ProjectLicenses` uses the `[licenses]` interface of the same file, so the two types files do not import each other.
  `configurationTableSchemas` is checked against `TableValues` by the type rule. Each setting's default, its
  per-language defaults, and its level-`all` value sit in that setting's declaration, with the static values in
  `config/settings/` topic files.
- Size: medium

### LAY-005: Many check type files hold one or two types

- Where: `types/checks/<group>/<configuration>.ts` (16 files, 10 of them with one or two types); the `config/checks/`
  groups `database`, `testing`, and `library`
- Kind: merge
- Problem: The check types are few (about 70 in all). One file per configuration makes 16 small files, and a folder
  for a group with one file.
- Fix: One types file per configuration group: `types/checks/{database,framework,general,infrastructure,language,platform,testing}.ts`
  (`general.ts` is about 170 lines). The `config/` side keeps one file per configuration, because those files are
  large; only the one-file groups `database` and `testing` and the three small `library` files become
  `config/checks/{database,testing,library}.ts`.
- Size: small

### LAY-008: Three planned items contradict the install and parser decisions

- Where: `placement/` rows P03:184 (`GSPOT_MISE_TOOL`), P05:350 (`RunnerChoice`), P07:179-181 (the three Yarn
  schemas)
- Kind: delete
- Problem: gspot never pins itself in a mise file (INX-002), so `GSPOT_MISE_TOOL` has no user. The `runner` setting
  goes (INX-003), so `RunnerChoice` has none. `yarnSettings` stays (S05-012), and it reads the three Yarn schemas.
- Fix: Delete `GSPOT_MISE_TOOL` and `RunnerChoice`. The three Yarn schemas move to `tools/npm/yarn.ts`, beside `yarnSettings`, their one reader (PAR-073); `parsers/schema/` keeps no file for them.
- Size: small

### LAY-011: Two test data files pass 300 lines

- Where: `tests/config/bash.ts` (about 375 lines), `tests/config/python.ts` (about 330 lines) in the planned layout
- Kind: move
- Problem: All Bash test data and all Python test data would sit in one flat file each, and both files pass the limit.
  The largest item is the 144-line table of Bash check cases.
- Fix: Split each into a folder by topic: `tests/config/bash/checks.ts` (gspot's Bash check cases, about 250 lines) and
  `bash/tools.ts` (ShellCheck, Bats, syntax, loop sizes, and the sample scripts, about 115 lines);
  `tests/config/python/checks.ts` (about 210 lines) and `python/tool-project.ts` (the uv tool project, about 145
  lines).
- Size: small

### LAY-012: Many test data files hold one or two small items, or one topic under two names

- Where: the planned `tests/config/{eslint-overrides,install,program,runtimes,words,taplo,scopes,ownership,apply,checks,sarif}.ts`,
  `tests/config/eslint/{duplicate-rules,html-injection,suppressions,runtimes,required-rules}.ts`,
  `tests/config/settings/{comments,defaults,layout}.ts`, and
  `tests/types/{cancellation,docs,eslint,python,structure,typescript,install,check-samples}.ts`
- Kind: merge
- Problem: Giving each old source file its own data file makes ten files with one item and others with one or two
  tiny items; `check.ts` and `checks.ts` differ by one letter; `tests/config/lint-rules.ts` and `tests/config/eslint/`
  both claim "lint rules"; `check-samples.ts` uses the retired word "samples".
- Fix: Merge by topic, as "Layout" lists (`tests/config/` 108 files, `tests/types/` 9 files):
  `eslint-overrides.ts` and `eslint/runtimes.ts` into `eslint/overrides.ts`; `eslint/duplicate-rules.ts` and
  `eslint/required-rules.ts` into `eslint/lint-rules.ts`; `eslint/html-injection.ts` into `eslint/framework.ts`;
  `eslint/suppressions.ts` into `eslint/levels.ts`; `install.ts` into `tools.ts` (mise failures) and
  `integration.ts` (the local registry values); `apply.ts` into `generated-files.ts` and `tools.ts`; `ownership.ts`
  into `generated-files.ts`; `program.ts` into `terminal.ts`; `words.ts` and `taplo.ts` into `set.ts`; `scopes.ts`
  into `settings/scopes.ts`; `runtimes.ts` into `detect.ts` (its code-built row goes to `tests/setup/sandbox.ts`);
  `lint-rules.ts` into `rule-capture.ts`; `checks.ts` into `execution.ts`; `sarif.ts` into `security.ts`;
  `settings/{comments,defaults,layout}.ts` into `settings/file.ts`; `tests/types/cancellation.ts` into
  `tests/types/processes.ts`; `tests/types/{docs,eslint,python,structure,typescript}.ts` into
  `tests/types/tool-output.ts`; `tests/types/install.ts` into `tests/types/e2e.ts`; `tests/types/check-samples.ts`
  becomes `tests/types/checks.ts`. The remaining two-item files (`astro.ts`, `pytest.ts`, `vue.ts`, `comments.ts`,
  `terminal.ts`, `rule-capture.ts`, `eslint/lint-rules.ts`) each serve one configuration or one source module and have
  no topic neighbor.
- Size: small

### LAY-013: Three test constant names hold two different values

- Where: `GSPOT_TOML` (explain and set tests), `PROJECT_FILES` (two ESLint data sets), `TRIVIAL_FILES` (the
  structure tests and the entry-file tests)
- Kind: rename
- Problem: Two data files export the same name for different text, so a test that imports one by name can read the
  other.
- Fix: `EXPLAIN_SETTINGS` and `SET_SETTINGS`; `REQUIRED_RULE_FILES` and `TOOL_FILE_PROJECT`; `TRIVIAL_ENTRY_SOURCES`
  for the entry-file tests, while `TRIVIAL_FILES` of the structure tests keeps its name.
- Size: small

## Layout

The final source tree of the CLI, without `config/` and `types/` (listed after it). Paths are under
`packages/cli/src/`; `main.ts` stays as it is. Every file and every item in it is placed by the rows in `placement/`,
and `placement/target-tree.md` lists every file of the repository.

```text
packages/cli/src/
  main.ts  errors.ts  objects.ts  rules.ts  text.ts
  apply/                            stale.ts version-pin.ts write.ts
  checks/                           built-in.ts finding.ts stale-generated-files.ts
  checks/database/postgres/         access.ts foreign-keys.ts history.ts migrations.ts schema.ts
  checks/framework/                 expo.ts nextjs.ts svelte.ts version-pairs.ts
  checks/framework/site/            build.ts built-pages.ts linkinator-program.ts purgecss-program.ts source-files.ts
  checks/general/                   commits.ts docs.ts duplication.ts history.ts licenses.ts prose.ts repository.ts
                                    secrets.ts security.ts
  checks/general/dependencies/      bun-release-age.ts lockfile-hosts.ts package-json.ts stale-lockfile.ts
  checks/general/gspot/             generated-files.ts settings-format.ts suppressions.ts unused-entries.ts
  checks/general/naming/            bash.ts checks.ts declarations.ts identifiers.ts names.ts python.ts settings.ts
                                    sql.ts swift.ts typescript.ts
  checks/general/structure/         conventions.ts env-reads.ts file-folder-clashes.ts file-lines.ts lone-files.ts
                                    shared-prefixes.ts source-files.ts trivial-functions.ts
  checks/infrastructure/            ansible.ts docker.ts github-actions.ts nginx.ts
  checks/infrastructure/xcode/      project.ts resources.ts settings.ts
  checks/language/                  html.ts markdown.ts sql.ts
  checks/language/bash/             doc-comments.ts function-size.ts include-guards.ts inline-scripts.ts
                                    private-prefix.ts safety.ts script-layout.ts scripts.ts shellcheck.ts
                                    source-order.ts ssh-blocks.ts unread-arguments.ts unused-functions.ts
                                    variable-defaults.ts wrappers.ts
  checks/language/python/           deptry.ts exports.ts import-linter.ts modules.ts pip-installs.ts pydoclint.ts
  checks/language/swift/            build-folder.ts build.ts
  checks/language/typescript/       project.ts tsc.ts tsconfig.ts
  checks/library/                   drizzle.ts swift-snapshot-testing.ts translations.ts
  checks/platform/                  cloudflare.ts supabase.ts
  checks/testing/                   coverage.ts swift-tests.ts
  commands/                         add.ts apply.ts export.ts ignore.ts install.ts list.ts program.ts reconcile.ts
                                    remove.ts save-settings.ts session.ts set.ts unignore.ts unset.ts
  commands/check/                   command.ts push.ts tree.ts
  commands/doctor/                  command.ts suggestions.ts
  commands/explain/                 check.ts command.ts
  commands/init/                    command.ts detection.ts format.ts plan.ts replace.ts selection.ts settings-text.ts
                                    write.ts
  configurations/                   manifests.ts select.ts tool-pins.ts unknown-names.ts
  configurations/schema/            manifest.ts naming.ts parts.ts tool.ts
  execution/                        built-in.ts fixes.ts ignores.ts report.ts run.ts
  execution/command/                batches.ts check.ts output.ts placeholders.ts
  execution/copy/                   dependencies.ts revision.ts scratch.ts
  generation/                       bunfig.ts ci.ts files.ts formatting.ts fragments.ts headers.ts hooks.ts
                                    ignore-patterns.ts jsconfig.ts mise.ts npm.ts pointers.ts prose.ts python.ts
                                    redirects.ts rule-capture.ts tool-files.ts tsconfig.ts
  generation/eslint/                blocks.ts boundaries.ts configuration.ts files.ts presets.ts runtimes.ts
                                    serialize.ts
  generation/eslint/fragments/      astro.ts drizzle.ts expo.ts express.ts jest.ts nestjs.ts nextjs.ts react-dom.ts
                                    react-native.ts react.ts svelte.ts tanstack-query.ts testing-library.ts
                                    translations.ts typescript.ts vitest.ts vue.ts zod.ts zustand.ts
  generation/tool-file-sources/     basedpyright.ts commitlint.ts gixy.ts hadolint.ts html-validate.ts jscpd.ts
                                    knip.ts lychee.ts markdownlint.ts osv-scanner.ts periphery.ts purgecss.ts ruff.ts
                                    semgrep.ts shellcheck.ts spectral.ts sqlfluff.ts squawk.ts stylelint.ts
                                    swiftformat.ts swiftlint.ts taplo.ts trivy.ts typos.ts v8r.ts yamllint.ts
  install/                          hooks.ts install.ts vale.ts
  ownership/                        log-schema.ts log.ts managed-keys.ts plans.ts
  parsers/                          bash.ts comments.ts dependency-files.ts generated-header.ts git.ts html.ts json.ts
                                    lockfiles.ts mise.ts npm-client.ts python.ts shebang.ts swift.ts tool-project.ts
                                    tree-sitter.ts tsconfig.ts typescript.ts xcode.ts
  parsers/output/                   formats.ts json.ts knip.ts markdownlint.ts sarif.ts semgrep.ts text.ts
                                    trufflehog.ts typos.ts
  parsers/sql/                      lexer.ts migrations.ts postgres.ts
  parsers/toml/                     comments.ts document.ts
  planning/                         checks.ts files.ts needed-tools.ts skips.ts
  repository/                       aliases.ts dependency-files.ts detect.ts find-root.ts kind.ts read.ts scopes.ts
                                    select.ts selectors.ts tags.ts tooling.ts tracked.ts
  repository/revisions/             changes.ts objects.ts push.ts
  settings/                         comments.ts drop-defaults.ts edit.ts file.ts inherit.ts layout.ts normalize.ts
                                    paths.ts read.ts templates.ts view.ts
  settings/errors/                  keys.ts reasons.ts values.ts
  settings/schema/                  architecture.ts gspot-toml.ts parts.ts rules.ts tables.ts templates.ts tools.ts
  system/                           assets.ts environment.ts executables.ts file-reads.ts files.ts git.ts
                                    managed-blocks.ts paths.ts processes.ts
  system/safe-folder/               lock.ts names.ts open.ts reads.ts writes.ts
  terminal/                         check-report.ts print.ts
  tools/                            diagnostics.ts find.ts lockfiles.ts run.ts versions.ts
  tools/npm/                        lockfiles.ts project.ts yarn.ts
  tools/python/                     project.ts settings.ts
```

Imports go one way. Each area module may import only the modules before it in this order, which is today's layer
order with the new folder names: `system` (with the root files `errors.ts`, `objects.ts`, and `text.ts`), `parsers`,
`configurations`, `repository`, `settings`, `rules` (the file `rules.ts`), `planning`, `generation`, `tools`,
`ownership`, `install`, `apply` (the three parts of today's `lifecycle`, LIF-009), `execution`, `terminal`, `checks`,
`commands`, and `main.ts`. Every area module may also import `config` and `types`.

The ESLint plugin (`packages/eslint-plugin/src/`): `plugin.ts` (the entry), `create-rule.ts`, `paths.ts`,
`syntax.ts`, and one file per rule in `rules/` (`header-first.ts`, `import-boundaries.ts`, `no-alias-exports.ts`,
`no-client-env.ts`, `no-index-imports.ts`, `no-trivial-files.ts`, `no-trivial-functions.ts`,
`require-server-only.ts`), each with the code only it uses.

The repository scripts (`scripts/`): `build.ts`, `manifests.ts` (the manifest checks the build runs), and
`update-rule-lists.ts`.

The number after each `config/` and `types/` file below is how many items (constants or types) it receives.

### `packages/cli/src/config/` (111 files)

```text
config/
  apply.ts                     3   apply: Git conflict markers, diff context lines, paths apply keeps
  configurations.ts           41   configuration manifests: LEVELS, STAGES, GROUPS, GROUP_LABELS, manifest file and folders
                                   (CONFIGURATIONS_FOLDER = 'configurations'), placeholders, MAX_EXIT_CODE, name and extension
                                   patterns, tool builds, mise backends
  install.ts                   7   gspot install: hook path commands, hook marker, mise install steps, VALE_INSTALL_ARGUMENTS,
                                   tool project inputs
  ownership.ts                11   ownership log and writer lock: owned kinds, log file, version, JSON indent, key-edit formats
  planning.ts                  4   check planning: coverage dimensions and flags, flag value pattern, licenses configuration name
  rules.ts                     7   rules and the managed block: AGENTS.md, closings, heading, first reads, file pattern, all-level marker
  terminal.ts                 12   terminal output: report widths, statuses, colors, JSON indent, exit codes, signal exit codes
  text.ts                     11   generic text: line feed, quotes, newlines, suggestion and list limits, digest algorithm
  units.ts                     4   unit constants: ms per second, seconds per day, bytes per kB, 100 percent
  checks/
    database.ts                6   Postgres: constraint suffixes, public schema, down-migration suffix, configuration name
    library.ts                 6   Drizzle source patterns, swift-snapshot-testing recording modes and folder, translation file suffix
    testing.ts                14   swift-tests: sleep calls, skip-reason positions, coverage commands and bundle, target kinds
    framework/
      expo.ts                  5   Expo Doctor command and output lines
      nextjs.ts               15   Next.js: route and config names, build and typegen commands, failure summary, CI env
      site.ts                 26   site checks: build, pages, links, sitemap, svgo, PurgeCSS
      svelte.ts                5   svelte-check command, tsconfig flag, output patterns
      version-pairs.ts         2   the Next.js and React package pairs of the version-pairs check
    general/
      commits.ts               2   the commit-message read and its scratch file name
      dependencies.ts          7   lockfile URL patterns, Yarn Berry install, diagnostic line count
      docs.ts                 15   README and docs path rules, path tokens in prose, mise run
      duplication.ts           4   jscpd name, config and report files, arguments
      gspot.ts                 5   generated-file messages and help, reason-above pattern
      licenses.ts              5   license-checker and pip-licenses commands, SPDX words
      naming.ts               38   case names, word and digit patterns, category parents and labels, node sets per language
      prose.ts                 2   Vale arguments and its error-line pattern
      secrets.ts              12   Git diff and commit arguments, TruffleHog and gitleaks arguments, env read patterns
      security.ts              5   CodeQL and Semgrep arguments, the Semgrep rules key
      structure.ts            22   convention queries, comment markers, index stems, statement counting nodes, env reads
    infrastructure/
      ansible.ts               5   ansible.cfg, lint line pattern, skip list
      docker.ts               13   Docker: ignore entries, Trivy commands and report, Compose patterns, DOCKER_TOOL
      github-actions.ts        2   the self-repository marker and the YAML file pattern
      nginx.ts                27   nginx: config paths, certificate arguments, Docker test run, tokenizer
      xcode.ts                20   Xcode suffixes, asset catalogs, xcconfig and plist patterns
    language/
      bash.ts                 32   shebangs, strict mode, main, script layout patterns, safety tables, count limits
      html.ts                 10   script types, URL attributes, placeholder marks (the parse base is site.ts PLACEHOLDER_ORIGIN)
      markdown.ts              9   fence syntax check: parsers, ellipsis and placeholder patterns
      python.ts               20   pydoclint, deptry, lint-imports commands, docstring patterns, __init__.py, PYTHON_PRIVATE_PREFIX
      sql.ts                   2   parsed dialect and output parameter modes
      swift.ts                33   compiler patterns, build folders, swift and xcodebuild arguments, SwiftLint and Periphery commands
      typescript.ts           11   tsc commands and flags, build-info files, check IDs
    platform/
      cloudflare.ts           11   Wrangler fields and files, _headers and _redirects
      supabase.ts             14   supabase/config.toml, migration name, Deno commands, function entries, admin keys
  commands/
    doctor.ts                  5   doctor columns, sections, header bytes, state colors
    explain.ts                 1   the reason-needed texts (a table of five)
    help.ts                    1   COMMAND_HELP: every help text of the 14 commands (CLX-012), about 210 lines
    init.ts                   15   init plan columns and rows, preface, Prettier and EditorConfig reading, remote URL patterns
    list.ts                    3   list columns and list kinds
    set.ts                     3   value patterns of gspot set
  execution/
    command.ts                 5   command-line limits per OS, output tail
    copy.ts                   11   scratch copies: pause interval, extras, dependency files, folder prefixes, Git arguments
    run.ts                     6   check runs: status sets, fix passes, diff context, GSPOT_JOBS
  generation/
    ci.ts                     19   CI workflows: paths, cached paths, CI pins, timeout, GitHub and GitLab parts
    eslint.ts                 41   the ESLint file generator: rule IDs, boundary policies, selectors, file patterns, ESLINT_TOOL
    eslint-rules.ts           11   the core lint-rule tables and all-level selectors of the generated ESLint file (about 200 lines)
    eslint-fragments.ts       25   the lint rules and globs each configuration adds to the ESLint file
    file-edits.ts              6   key edits to bunfig.toml: BUNFIG_FILE, key paths, setting names
    files.ts                   5   generated files: the .gitattributes block and attribute patterns
    formatting.ts              4   Prettier and EditorConfig fixed parts
    headers.ts                 6   the generated header: comment style per extension, and the reader's match
    hooks.ts                   5   Git hooks: HOOK_ARGS, RUNNERS (keyed by RUNNER_NAMES), shebang, CHECK_HOOKS, commit-message path lines
    html.ts                    4   html-validate rules, extends, built-site overrides
    ignore-patterns.ts         2   ignore pattern rewriting: brace tokens, always-ignored folders
    prose.ts                  13   Vale: grammars, banned headings, ignores, formats, turned-off rules, styles
    python.ts                  3   Ruff ignores and isort, basedpyright options
    swift.ts                   9   SwiftLint, SwiftFormat, Periphery lists and options (about 245 lines)
    tool-file-sources.ts      37   static values of the typed tool file builders (commitlint, yamllint, taplo, v8r, hadolint,
                                   trivy, spectral, squawk, sqlfluff, shellcheck, markdownlint, stylelint, knip, jscpd,
                                   typos, semgrep, purgecss, Swift tools version, TOML emit format)
    tool-projects.ts           3   npm tool project: JSON indent, Yarn settings, next package
    typescript.ts              9   tsconfig and jsconfig options
  parsers/
    bash.ts                   10   Bash parsing words and node sets
    comments.ts                7   comment openers, closers, node types per format
    dependency-files.ts       23   package.json, pyproject.toml, Package.swift, npm clients, tool project names, requirement names
    git.ts                    11   Git listing regexes, hashes, .gitattributes lines
    json.ts                    2   JSON with comments: options and extension
    lockfiles.ts               4   the LOCKFILES table and lockfile names
    output.ts                 15   tool output patterns, Knip messages, default format, SARIF and Semgrep values
    python.ts                  3   Python module reading
    shebang.ts                 3   the #! line
    sql.ts                     7   migration freeze and the psql lexer
    swift.ts                  11   Swift grammar node names, SWIFT_EXTENSION, test markers
    toml.ts                    2   TOML value kinds and patch format
    tree-sitter.ts             2   language to grammar table, .tsx extension
    tsconfig.ts                4   TSCONFIG_FILE, JSCONFIG_FILE, TypeScript diagnostic codes
    xcode.ts                   4   project.pbxproj names, setting references, test product type
  repository/
    aliases.ts                 3   import alias reading
    hooks.ts                  10   other hook managers, hook folders, HOOKS_PATH_SETTING
    inventory.ts              40   file kinds and tags: FILE_KINDS, extension, file-name and shebang tags, Git attribute names,
                                   generated and vendored markers (about 215 lines)
    revisions.ts              29   Git arguments for staged, changed, and pushed revisions; entry modes, GIT_ENTRY_MODES
    scopes.ts                  4   the root scope and workspace files
    tooling.ts                20   the tooling survey: lint folders, agent files, CI files, mise files, MISE_TOML,
                                   RUNNER_NAMES = [...NPM_CLIENTS, 'mise'] as const
    tracked.ts                 7   the file listing: GITIGNORE_FILE, GITATTRIBUTES_FILE, GIT_FOLDER, NODE_MODULES, ls-files arguments
  settings/
    defaults.ts                3   detected defaults: Xcode destinations, commit scopes, build script
    file.ts                   13   the gspot.toml file: key order, TOML writer options, comment prefixes, schema URL prefix and
                                   schema file name
    schema.ts                 15   values the gspot.toml schema uses: bounds, test patterns, level summaries, help texts, examples,
                                   JSON_SCHEMA_DIALECT
    templates.ts               9   template download
    values.ts                 12   finding and checking values: key parts, group tables, TOOL_TIMEOUT_SETTING; the declaration
                                   unions SETTING_TYPES, PATH_ROLES, REASON_NEEDED
  system/
    assets.ts                  5   where gspot finds its own package files
    environment.ts             5   mise and cache environment names and folders
    git.ts                    23   Git environment, query arguments, "not a repository" code and message
    locations.ts              20   gspot's own paths in a repository (.gspot/..., gspot.toml, .gspot/mise.toml)
    managed-blocks.ts          2   managed block markers and styles
    modes.ts                  11   file and folder modes
    operating-systems.ts       1   operating system names and install commands (one table)
    paths.ts                  11   executable layouts, declaration extensions, glob syntax (ANY_FOLDER_PREFIX), TRAILING_SLASH
    processes.ts               9   exit codes and wait times, taskkill, PATHEXT
    safe-folder.ts             8   unsafe names, temporary and lock file names
  tools/
    diagnostics.ts             5   install failure output: reinstall hint, output limit, URL patterns, redaction mark
    find.ts                    6   finding tools: search folders, mise program and shims, usable states
    npm.ts                    27   npm tool project: arguments, setting prefixes, connection and credential keys, Yarn settings
    python.ts                 12   uv arguments, index settings, PYTHON_ENVIRONMENT_FOLDER, URL scheme, PINNED_PACKAGE_NAME, the locked
                                   requirement name pattern
    run.ts                     3   running a tool: environment, version flag, missing version
    vale.ts                    3   Vale packages and folders, VALE_TOOL
```

### `packages/cli/src/types/` (60 files)

```text
types/
  apply.ts                     3   write request, apply report, stale file
  configurations.ts           22   manifest, checks, tool declarations and pins, Level, Stage, selection walk (about 200 lines)
  errors.ts                    2   ErrorCode, Parsed
  install.ts                   7   install result and steps, install JSON, hook status, plan, context, Vale installation
  objects.ts                   1   Defined
  ownership.ts                19   ownership log, owned files and blocks, writer plans, managed keys, FileEdit, CapturedLintRules
  planning.ts                 11   Session, planned checks, plan entries and inputs, skips, stage filter
  rules.ts                     5   rule files and sources, rule sections, RulesSettings, ManagedBlockValues
  terminal.ts                  4   output options, columns, command result, failure JSON
  text.ts                      2   NumberedLine, TextPosition
  global.d.ts                  -   ambient declarations: RegExp.escape (PLR-050) and the two SPDX modules (no rows; PLR-050)
  checks/
    database.ts                8   Postgres migrations and schema state
    framework.ts               4   site build, Linkinator, PurgeCSS, web manifest
    general.ts                33   docs, gspot, licenses, naming, prose, structure check types
    infrastructure.ts          7   Compose files and services, nginx mounts and directive scan
    language.ts               14   Bash scripts, Markdown fences, Python docstrings, SQL sources, Swift builds
    platform.ts                4   Cloudflare _headers blocks, Supabase configuration, Deno lint report
    testing.ts                 1   the Swift coverage report
  commands/
    check.ts                   6   check options, run filters, staged files, push report, revision source
    doctor.ts                  3   doctor report and suggestions
    explain.ts                 6   explanations of checks, configurations, settings, paths
    export.ts                  2   export options and JSON
    init.ts                   16   init plan, inputs, detection, selection, answers, settings draft, CiChoice
    list.ts                    4   setting rows, extra rows, list JSON
    save-settings.ts           8   options and results of the commands that save gspot.toml
  execution/
    check.ts                  25   check runs: built-in checks, fixes, run state, report, CheckStatus, Finding
    command.ts                15   command checks: placeholders, invocations, prepared commands, output
    copy.ts                    6   scratch copies and dependency trees
  generation/
    ci.ts                      3   CI pins, pipeline, GitHub check step
    eslint.ts                 20   ESLint blocks, boundaries, file selectors, modules, presets, rule names file
    files.ts                  11   generated files and blocks, emit inputs, hook names, whole tool files, Swift version input
    formatting.ts              8   Prettier, EditorConfig, JSON layout
    fragments.ts               4   fragments and their selectors, TypeScript imports
    typescript.ts              2   jsconfig and tsconfig inputs
  parsers/
    bash.ts                    6   Bash script syntax
    comments.ts                2   source comments and comment readers
    dependency-files.ts       10   dependency files and maps, npm clients, PackageJson, Pyproject, Poetry settings
    editable-file.ts           2   KeyPath and the JSON and TOML editor
    git.ts                     4   .gitattributes rules, the blob stream, Git entries
    lockfiles.ts               2   lockfile rows and tool-project lockfile names
    output.ts                 14   tool output: OutputSpec, parsers, SARIF, Semgrep, Knip, markdownlint, typos
    python.ts                  4   Python modules and functions
    sql.ts                     7   SQL tokens, statements, files
    toml.ts                   18   TOML nodes, comments, edits
    tree-sitter.ts             8   grammars, parse cache, source inputs, HTML attributes
    tsconfig.ts                2   TypeScript configuration and project
    xcode.ts                   7   Xcode project entries, folders, sources, build settings
  repository/
    inventory.ts              18   the repository read: tracked files, file kinds and classification, tooling
    revisions.ts              10   revisions and push selection
    selection.ts               7   detection evidence, suggestions, configuration selection and lists, FileMatch
  settings/
    file.ts                   22   gspot.toml as written: WrittenSettings and its tables, layout, edits, errors, templates
    tables.ts                  4   SettingDeclaration, TableName, TableValues, TableSettings, and the root tables (LAY-004)
    tool-tables.ts             -   the [tools.<tool>] table types (new, no rows; LAY-004)
    values.ts                 21   final settings: Settings, SettingsFile, ScopeView, known settings, limits, defaults
  system/
    files.ts                   3   run read cache, memo key, scratch folder
    git.ts                     5   Git environment and options
    managed-blocks.ts          3   block span, style, context
    processes.ts               7   spawn options and results
    safe-folder.ts             5   SafeFolder, its state, file copies, path format
  tools/
    find.ts                    7   tool state and inspection, search, locate options, parsed tool version
    project.ts                10   npm and uv tool projects, lockfiles, Python settings, BunPackage, NpmToolProject
    run.ts                     3   run options, availability, execution failure
```

### `packages/eslint-plugin/src/` (9 files)

```text
config/
  comments.ts                  7   the import-comments rule: tool comment prefixes, blank-line patterns, distance
  environment.ts               2   environment hosts and allowed names (both environment rules)
  imports.ts                   4   internal and relative prefixes, mock methods, default boundary folders
  nextjs.ts                    4   NEXT_PUBLIC_ prefix, use client, use server, server-only
  paths.ts                     4   index file names, stdin names, trailing-slash and trailing-star patterns
  plugin.ts                    2   rule docs URL (/reference/eslint-plugin/{name}/), rule prefix (`gspot`)
  syntax.ts                   14   node-type lists, statement limits, selectors, shebang
types/
  rules.ts                     6   rule docs, rule context, the options of four rules
  syntax.ts                    5   function, import, statement and content-check node shapes
```

### `scripts/` (5 files)

```text
config/
  build.ts                     5   the two package builds: entry points, banner, executable name, dist folder, license file
  grammars.ts                  7   grammar packages, Swift grammar file and SWIFT_GRAMMAR_PIN, license file names, hash name
  rule-lists.ts               11   package and file names the rule-list update reads and writes
types/
  manifests.ts                 1   CheckContradiction, the build-time manifest check record
  rule-lists.ts                1   the Stylelint module shape the rule-list update reads
```

### `docs/src/` (7 files)

```text
config/
  example.json                 1   the recorded homepage and quickstart example
  home.ts                      1   FEATURES, the three homepage cards
  navigation.ts                1   SIDEBAR
  reference.ts                 7   labels, intro, folders, collection name (REFERENCE_COLLECTION_NAME) and IDs of the generated
                               reference pages
  site.ts                      6   site URL, repository URL, logo, social card, fonts
types/
  home.ts                      1   FeatureProps (today components.ts, DCX-004)
  reference.ts                 2   ReferencePage, SettingVariant
```

### `tests/config/` (108 files)

```text
tests/config/
  ansible.ts                4   Ansible playbooks and sandbox of the integration test
  astro.ts                  2   Astro pages of the integration test
  check.ts                  9   gspot check: fix feedback and refusals, push and argument refusals, verbosity, partial fixes
  ci.ts                     8   generated GitHub and GitLab pipelines, setup programs
  cloudflare.ts             8   Wrangler schema and files, redirects, path rules
  comments.ts               2   comment boundary cases of the comment reader (about 90 lines)
  commitlint.ts             5   commitlint project, files, and commit messages
  components.ts             3   a Vue component, a component tsconfig, an answer module
  configurations.ts         9   saved configuration choices, selection files, the configuration table
  dependencies.ts          11   release-age and lockfile-host cases, local npm and uv projects, lockfiles
  detect.ts                 4   detection cases: Python dependencies, Swift tests and targets, Prisma content
  docker.ts                13   Trivy reports, Compose sources and pairing, dockerignore and context cases, sandbox
  docs.ts                  14   docs task files, fence paths, link pages, README, guide, license samples
  e2e.ts                   10   the end-to-end tests: offline environment, quickstart commands, starting files, programs
  eslint-plugin.ts          3   the ESLint plugin tests: environment globals, import aliases, client env sample
  execution.ts             20   check runs: check records, run results, crashes, scratch failures, fixer outcomes, headers
  explain.ts                3   EXPLAIN_SETTINGS, reason values, neutral setting values
  expo.ts                   5   Expo Doctor results and reports
  express.ts                5   Express sources and scope findings of the Semgrep rules
  files.ts                  5   the files configuration (yamllint, taplo, v8r): sandbox, cases, YAML scope settings
  formatting.ts             9   EditorConfig and Prettier settings, reports, overrides
  generated-files.ts        7   generated files: the generator script and cases, headers, apply input, adopted files, ownership refusal
  git.ts                   17   Git blobs, entries, hooks, push content and commands, test config
  github-actions.ts         6   actionlint exits, called workflows, sandbox
  hooks.ts                  7   hook repositories and cases, hook program, fake mise install result
  html.ts                   6   active URLs, inert markup, autoplay pages and checks
  ignore-patterns.ts        5   Prettier and language ignore cases, path ignore and scope pattern cases
  ignore.ts                 4   gspot ignore and unignore cases
  init.ts                  14   init: CI preferences, configurations, SDK destinations, format files, plan cases, files
  integration.ts           12   the integration and e2e preload: exit codes, mise arguments, packing, the local npm registry
  javascript.ts            11   the JavaScript configuration: ESLint sandbox, jsconfig cases and choices, diagnostics
  jest.ts                   5   Jest sources, tests, project files, coverage settings
  knip.ts                   9   knip files, entries, packages, pointers, reports, arguments
  libraries.ts              3   the library group integration sandbox and cases, a loose zod schema
  licenses.ts              15   allowed packages, license settings, scanner failures and findings, license manifests
  manifests.ts              4   configuration manifest checks: version floors, replacements, file paths, tool projects
  markdown.ts               8   markdownlint reports, settings, files, fence cases, sandbox
  nestjs.ts                 3   NestJS sandbox, controller, cases
  nextjs.ts                17   Next.js routes, package.json, build files and failures, config cases, pages
  nginx.ts                  6   nginx configurations, directive cases, scope settings
  npm.ts                   20   npm clients, tool requirements, root dependencies, install failures, version files, sandbox files
  openapi.ts                3   OpenAPI document, sandbox, cases
  output.ts                 6   tool output formats, line findings, SARIF location cases
  planning.ts              14   project triggers, lockfile names, requirements, coverage limits, COVERAGE_ZERO_LIMITS, history
                            manifest (about 240 lines)
  postgres.ts               9   grants, RLS source, migrations folder, sandbox, squawk scope settings
  processes.ts              3   poll intervals and the test timeout
  prose.ts                 13   Vale alerts, install failures, packages, styles, vocabulary (about 240 lines)
  pytest.ts                 2   pytest sandbox and cases
  react.ts                 10   React and React Native packages, tsconfigs, components, version-pair cases
  replace.ts                4   replaced tool files: Stylelint lookup, knip files, pyproject tables
  repository.ts            22   tracked patterns, aliases, declarations, attributes, dependency files, scopes, shebangs (about 250 lines)
  rule-capture.ts           2   the captured lint rules: change cases and refusals
  rules.ts                  3   rule files: Drizzle drivers, rule configurations, runtime rule cases
  ruff.ts                   6   Ruff sources, format and version cases
  sandbox.ts                2   the sandbox's package.json and .gitignore
  secrets.ts               19   env readers and examples, secret files, gitleaks scopes, TruffleHog detectors, sample keys
  security.ts              17   CodeQL samples and SARIF reports, Semgrep platform sources and own rules
  select.ts                 6   file selection: migration and Jest paths, project choices
  semgrep.ts                4   Semgrep ignore cases, match and parse error
  sensitive-data.ts         3   sensitive files, findings, fixes
  serialization.ts          9   odd keys and values, Xcode project and scheme, registries, module targets
  set.ts                    9   gspot set: SET_SETTINGS, extra option scopes, loosened settings, words, Taplo option and reason
  site.ts                  27   built pages, web manifests, SVG, site builds, selectors, alt text, output cases (about 230 lines)
  spelling.ts               4   typos reports and exclusions
  sql.ts                    8   SQL dialects, child migrations, declarations, sandbox
  structure.ts             16   environment sources, lone files and prefixes, trivial functions and files, parameter limits
  stylelint.ts             12   stylesheets, Stylelint settings and scopes, Tailwind
  supabase.ts              11   storage policies, service keys, generated types, edge function, Docker version output
  suppressions.ts          11   compiler directives, suppression comments and reasons per tool
  svelte.ts                 5   svelte-check projects and output, sandbox, cases
  swift-tests.ts            5   XCTest coverage sources and scopes, parser sources
  swift.ts                 27   Swift project selection, builds, swift-snapshot-testing references, XCTest failures, formatting, packages (about 270 lines)
  system.ts                13   package assets, mise folders, managed block formats, file modes, links
  template.ts               4   template customizations, ignores, destinations, file
  terminal.ts               2   the check report and argument errors the terminal prints
  tool-files.ts             3   TOOL_FILE_PROJECT, plain tool files, the ESLint file
  tooling.ts                5   empty tooling, linked hook and rule folders, lefthook files
  tools.ts                  9   tool versions, registry passwords, leaked lockfiles, metadata failures, mise failures, installed tool folders
  translations.ts           3   Next.js translations repository and cases
  trpc.ts                   5   tRPC imports, types, modules, files, failures
  tsconfig.ts              12   tsconfig projects, references, standalone and ancestor projects
  typescript.ts            14   the TypeScript configuration: sandbox, cases, strict options, compiler sources, ports
  unused-entries.ts         3   unused entries and paths, file-folder clashes
  vitest.ts                 6   Vitest sources, package, sandbox, cases
  vue.ts                    2   Vue sandbox and cases
  xcode.ts                 11   Xcode asset settings, test plans, pbxproj samples, scope settings
  bash/
    checks.ts              10   gspot's Bash check cases: script layout, comments, unused functions, safety, cleanup, env reads (about 250 lines)
    tools.ts               14   ShellCheck, Bats, syntax, loop sizes, and the sample scripts they run on
  eslint/
    architecture.ts        13   module boundaries, role imports, environments
    engines.ts              6   engine scopes, packages, findings
    fragments.ts           10   per-configuration ESLint fragments: Jest, Zustand, TanStack Query, TypeScript, Vitest
    framework.ts            8   framework lint data: component files, i18n, React Native, raw HTML components
    jsdoc-types.ts          5   JSDoc type checking files, rules, findings
    levels.ts               5   lint rules that change with the level: coalescing, type exports, comment suppressions
    lint-rules.ts           4   duplicate lint rules, the required rules and their cases, the required-rules project files
    node-scripts.ts        10   Node scripts with and without extensions
    overrides.ts            4   [[tools.eslint.override]] settings, runtime cases
    selectors.ts            7   restricted selectors: store, SQL, procedures, injection, alias imports
    sorting.ts              3   sorting levels, rules, cases
    structure.ts           11   imports, re-exports, barrels, entries, trivial entry sources
  naming/
    settings.ts            12   naming settings, words, limits, languages, allowed names, overrides
    sources.ts             11   extractor sources and expected names, migration and numbered files
  python/
    checks.ts              22   the Python check data: docstrings, modules, exports, pyproject, sandboxes, pydoclint command
    tool-project.ts        19   the uv tool project: lock steps, lockfile plans, sandbox files, index credentials, uv.toml
  settings/
    errors.ts               3   key paths, refused rule options, unknown keys
    file.ts                 9   writing gspot.toml: layout, comments, dropped defaults, dated ignore, unrepresentable values
    schema.ts               4   the published schema cases, until dates, unsafe folders, the command check
    scopes.ts               3   settings with several scopes
```

### `tests/types/` (9 files)

```text
tests/types/
  checks.ts                6   check cases: sample, gspot call, outcome, fix, changes, original file (today check-samples.ts)
  ci.ts                    4   GitHub workflow, GitLab pipeline, steps
  e2e.ts                   5   packed sandbox, command options, the local npm registry and its packages (PackedPackage)
  npm.ts                   2   npm client sandbox, tool project files
  processes.ts             5   spawn outcome, stdin options, captured process and child, a paused Git process
  sandbox.ts               4   sandbox, sandbox plan, installed plan, sandbox settings
  secrets.ts               3   secret history and verifier, gitleaks history
  tool-files.ts            3   Ruff, knip, Stylelint tool file shapes
  tool-output.ts           5   tool findings the integration tests read: lint, Ruff, parameter, typecheck, link failures
```

### One value, one place

Each value has one name, in one `config/` file (LAY-002). Paths are under `packages/cli/src/`.

| Value                                                | Merged from                                                                                                                                                         | One name and file                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'.gitignore'`                                       | `generation/files.ts`, `repository/inventory.ts`, `repository/tracked.ts`, `system/locations.ts`                                                                    | `GITIGNORE_FILE` in `config/repository/tracked.ts`                                                                                                                                       |
| `'.gitattributes'`                                   | `GITATTRIBUTES_FILE` in `generation/files.ts`, `GIT_ATTRIBUTES_FILE` in `repository/inventory.ts`                                                                   | `GITATTRIBUTES_FILE` in `config/repository/tracked.ts`                                                                                                                                   |
| `'.git'`                                             | `checks/infrastructure/github-actions.ts`, `repository/tracked.ts`                                                                                                  | `GIT_FOLDER` in `config/repository/tracked.ts`                                                                                                                                           |
| `'node_modules'`                                     | `DEPENDENCY_FOLDER` (execution/copy, placement row P04:10), `NODE_MODULES` (licenses), `NODE_MODULES_SEGMENT` (parsers/tsconfig)                                    | `NODE_MODULES` in `config/repository/tracked.ts`                                                                                                                                         |
| `'core.hooksPath'`                                   | `install.ts`, `repository/hooks.ts`                                                                                                                                 | `HOOKS_PATH_SETTING` in `config/repository/hooks.ts`                                                                                                                                     |
| `'mise.toml'` (the user's file)                      | `system/locations.ts`                                                                                                                                               | `MISE_TOML` in `config/repository/tooling.ts`, beside `MISE_FILES`                                                                                                                       |
| `'.md'`, `'.sql'`, `'bash'`, `'swift-test'`, `'lfs'` | checks/general/docs, checks/database, checks/general/naming, checks/language/bash, parsers/swift, parsers/attributes, and inventory                                 | `MARKDOWN_EXTENSION`, `SQL_EXTENSION`, `DEFAULT_DIALECT`, `SWIFT_TEST_TAG`, `LFS_FILTER` in `config/repository/inventory.ts`                                                             |
| `'Dockerfile'`, `'.dockerfile'`                      | placement row P08:12 in checks/infrastructure/docker.ts; `DOCKERFILE_SUFFIX` in docker.ts                                                                           | `DOCKERFILE_NAME`, `DOCKERFILE_EXTENSION` in `config/repository/inventory.ts`                                                                                                            |
| `'package.json'`                                     | `parsers/packages.ts`, `repository/inventory.ts`                                                                                                                    | `PACKAGE_JSON` in `config/parsers/dependency-files.ts`                                                                                                                                   |
| `'pyproject.toml'`                                   | `PYPROJECT_TOML` and `PYPROJECT_FILE` (inventory)                                                                                                                   | `PYPROJECT_TOML` in `config/parsers/dependency-files.ts`                                                                                                                                 |
| `'Package.swift'`                                    | `PACKAGE_SWIFT`, `SWIFT_PACKAGE_FILE` in parsers/packages, parsers/swift, generation/tool-file-values                                                               | `PACKAGE_SWIFT` in `config/parsers/dependency-files.ts`                                                                                                                                  |
| `'project.pbxproj'`                                  | `PBXPROJ_NAME` (parsers/xcode), `XCODE_PROJECT_FILE` (generation/tool-file-values; the name already held `'.xcodeproj/project.pbxproj'`)                            | `PBXPROJ_NAME` in `config/parsers/xcode.ts`                                                                                                                                              |
| `'tsconfig.json'`, `'jsconfig.json'`                 | `TSCONFIG_FILE` (generation/typescript, repository/aliases), `TSCONFIG_JSON`, `JSCONFIG_JSON` (checks/language/typescript), `JSCONFIG_FILE` (generation/typescript) | `TSCONFIG_FILE`, `JSCONFIG_FILE` in `config/parsers/tsconfig.ts`                                                                                                                         |
| `'yarn.lock'`                                        | `checks/general/dependencies.ts`, `parsers/lockfiles.ts`                                                                                                            | `YARN_LOCKFILE` in `config/parsers/lockfiles.ts`                                                                                                                                         |
| `'.swift'`                                           | `SWIFT_SUFFIX` (checks/language/swift), `SWIFT_EXTENSION` (parsers/swift)                                                                                           | `SWIFT_EXTENSION` in `config/parsers/swift.ts`                                                                                                                                           |
| Git entry modes                                      | `GIT_ENTRY_MODES` in `parsers/git.ts`, the same strings as `ENTRY_MODES` in `repository/revisions.ts`                                                               | `GIT_ENTRY_MODES` in `config/repository/revisions.ts`                                                                                                                                    |
| `'.venv'`                                            | `PYTHON_ENVIRONMENT` (licenses), `PROJECT_VENV` (tool-file-sources), `PYTHON_ENVIRONMENT_FOLDER` (tools/find)                                                       | `PYTHON_ENVIRONMENT_FOLDER` in `config/tools/python.ts`                                                                                                                                  |
| `'vale'`                                             | `VALE` (checks/general/prose), `VALE_TOOL` (generation/prose, tools/vale)                                                                                           | `VALE_TOOL` in `config/tools/vale.ts`                                                                                                                                                    |
| `'docker'`                                           | `DOCKER_PROGRAM` (nginx), `DOCKER_TOOL` (execution/run)                                                                                                             | `DOCKER_TOOL` in `config/checks/infrastructure/docker.ts`                                                                                                                                |
| `'eslint'`                                           | `LINT_PROGRAM` (repository/tooling), `ESLINT_TOOL` (generation/eslint)                                                                                              | `ESLINT_TOOL` in `config/generation/eslint.ts`                                                                                                                                           |
| `'configurations'`                                   | `configurations.ts` (`'configurations/'`), `system/assets.ts`                                                                                                       | `CONFIGURATIONS_FOLDER = 'configurations'` in `config/configurations.ts`; the caller adds the slash                                                                                      |
| `'bunfig.toml'`                                      | `BUNFIG` (dependencies), `BUNFIG_FILE` (generation/file-edits)                                                                                                      | `BUNFIG_FILE` in `config/generation/file-edits.ts`                                                                                                                                       |
| `/\/$/u` (CLI)                                       | `checks/general/docs.ts`, `system/paths.ts`                                                                                                                         | `TRAILING_SLASH` in `config/system/paths.ts`                                                                                                                                             |
| the schema line                                      | `SCHEMA_LINE` (placement row P03:160, commands/init) repeats `SCHEMA_COMMENT_PREFIX`                                                                                | no constant: the gspot.toml writer builds the line from `SCHEMA_COMMENT_PREFIX`, `SCHEMA_URL_PREFIX`, the running version, and `SCHEMA_FILE` (all in `config/settings/file.ts`; CFR-001) |
| the group table                                      | `CONFIGURATION_LABELS` and `GROUP_LABELS`                                                                                                                           | `GROUPS` and `GROUP_LABELS` in `config/configurations.ts`                                                                                                                                |
| the runner list                                      | `RUNNERS` and `RUNNER_NAMES`                                                                                                                                        | `RUNNER_NAMES = [...NPM_CLIENTS, 'mise'] as const` in `config/repository/tooling.ts`; `RUNNERS` stays the hook command table in `config/generation/hooks.ts`, keyed by it                |
| `'**/'`                                              | `ANY_FOLDER_PREFIX` (system/paths), `ANY_FOLDER_GLOB` (parsers/git)                                                                                                 | `ANY_FOLDER_PREFIX` in `config/system/paths.ts`                                                                                                                                          |
| `'core.hooksPath'` in the hook path commands         | `SET_HOOKS_PATH`, `UNSET_HOOKS_PATH` (install)                                                                                                                      | both built from `HOOKS_PATH_SETTING`                                                                                                                                                     |

Lists with one owner: `LEVELS`, `STAGES`, `GROUPS` (`config/configurations.ts`); `FILE_KINDS`
(`config/repository/inventory.ts`); `CHECK_STATUSES` (`config/execution/run.ts`); `NPM_CLIENTS`
(`config/parsers/dependency-files.ts`); `RUNNER_NAMES` (`config/repository/tooling.ts`); `NAME_CATEGORIES`, which
keys `CATEGORY_LABELS` (`config/checks/general/naming.ts`); `OWNED_KINDS = ['tool_file', 'block', 'keys', 'settings', 'pin', 'hook', 'lock']` (`config/ownership.ts`, LIF-054); `BLOCK_STYLES` (`config/system/managed-blocks.ts`);
`INSTALLED_TOOL_FOLDERS` (`config/system/locations.ts`), keyed by the `as const` list `TOOL_FOLDER_KINDS`;
`SETTING_TYPES`, `PATH_ROLES`, and `REASON_NEEDED` (`config/settings/values.ts`).

### Same name, two values

| Name                     | Values                                                                                                             | Fix                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `JSON_EXTENSIONS`        | `config/generation/headers.ts`: `.json`, `.webmanifest`; `config/ownership.ts`: `.json`, `.jsonc`                  | ownership's is `JSON_EDIT_EXTENSIONS`                                                     |
| `PRETTIER_DEFAULTS`      | `config/commands/init.ts`: Prettier's own defaults; `config/generation/formatting.ts`: options gspot always writes | formatting's is `PRETTIER_FIXED_OPTIONS`                                                  |
| `RULE_PLACEHOLDER`       | `config/configurations.ts`: `'{rule}'`; `config/settings/schema.ts`: `'<rule>'`                                    | the settings one is `RULE_TOKEN`                                                          |
| `URL_SCHEME`, `URL_USER` | `config/commands/init.ts`: remote URL patterns; `config/tools/python.ts`: any URL scheme                           | init's are `REMOTE_URL_SCHEME`, `REMOTE_URL_USER`                                         |
| `XCODE_PROJECT_FILE`     | `'.xcodeproj/project.pbxproj'` (becomes `PBXPROJ`) and the new `'project.pbxproj'`                                 | the second is `PBXPROJ_NAME`                                                              |
| `PRIVATE_PREFIX`         | `config/checks/language/bash.ts` and `config/checks/language/python.ts`                                            | Python's is `PYTHON_PRIVATE_PREFIX`                                                       |
| `REQUIREMENTS_FILE`      | `config/checks/language/python.ts` and a second value for dependency files                                         | one value, `/(?:^\|\/)requirements[^/]*\.txt$/u`, in `config/parsers/dependency-files.ts` |
| `REQUIREMENT_NAME`       | `config/parsers/dependency-files.ts` and the uv pin pattern `/^[^=]+/u` in `config/tools/python.ts`                | the uv one is `PINNED_PACKAGE_NAME`                                                       |

## Type rule

Every exported type is written by hand in `types/`, and each zod schema is checked against it. `tsc` confirms the rule
on the repository's TypeScript 5.9.3, zod 4.6.2, and its strict options (`strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).

The helper sits in `packages/cli/src/types/objects.ts` beside `Defined` (`types/` may `import type { z } from 'zod'`):

```ts
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
export type SchemaShape<T, I = never> = {
    [K in keyof T]-?: z.ZodType<Required<T>[K], [I] extends [never] ? unknown : K extends keyof I ? Required<I>[K] : never> &
        (IsOptional<T, K> extends true ? { _zod: { optout: 'optional' } } : unknown) &
        ([I] extends [never] ? unknown : K extends keyof I ? (IsOptional<I, K> extends true ? { _zod: { optin: 'optional' | 'defaulted' } } : unknown) : unknown);
};
```

`Required<T>[K]` is needed: under `exactOptionalPropertyTypes`, `-?` keeps a written `| undefined` and drops the implied
one, so a type field `note?: string` is refused against `.optional()`, as the parse result would be. The two `_zod`
marks catch a field that is optional in the type but required or defaulted in the schema.

1. A hand-written type in `types/` describes what the schema returns (`z.output`): a field the schema marks
   `.optional()` is `name?: X | undefined`; a field with `.default()` or `.prefault()` is required; never `Partial<...>`
   over a checked type.
2. Every object literal of a schema, nested ones included, is written `z.object({ ... } satisfies SchemaShape<T>)`.
   This catches an extra field, a missing field, a wrong field type, and a wrong optional mark. An `.extend(...)`
   argument is checked with `SchemaShape<Omit<T, keyof Base>>`.
3. A schema that is not one object literal (union, discriminated union, record, enum, `.transform`, `.pipe`, `.omit`,
   `.pick`) ends with `satisfies z.ZodType<T>`; each object branch inside it still uses rule 2. Never the annotation
   `: z.ZodType<T>` (it hides `.extend`, `.omit`, `.pick`, and `.shape`), except on a recursive `z.lazy` schema, which
   cannot use `satisfies` (none is left after POL-001).
4. When code reads the input form (gspot.toml as written: `WrittenSettings`, `WrittenScope`, `TemplateTables`), the
   input type is the second argument: `SchemaShape<Output, Input>` and `z.ZodType<Output, Input>`.
5. An enum is an `as const` list in `config/`; the schema is `z.enum(LIST)` (never `z.enum(Object.keys(...))`, which
   returns `string`), the type is `(typeof LIST)[number]`, and a label table is keyed by the list.
6. An `as const` list used as a default is copied: `.default(() => [...LIST])`.
7. A table keyed by an enum whose keys may be missing (per-language limits and naming) is
   `z.partialRecord(z.enum(LIST), ...)`; `z.record` with an enum key requires every key at run time.
8. Not caught: a field type in the hand-written type that is wider than the schema (a union with an extra member).
   Rule 5 puts enum types and their schemas on one list, so the gap is left only for hand-written unions.

| Schema kind                                      | Form                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| object or strict object literal                  | `z.object({ ... } satisfies SchemaShape<T>)`                                                                              |
| nested object (a field, an array item)           | its own `satisfies SchemaShape<Inner>` (without it, an extra inner field passes)                                          |
| `.extend(...)` of a checked object               | `base.extend({ ... } satisfies SchemaShape<Omit<T, keyof Base>>)`                                                         |
| `.omit(...)` or `.pick(...)` of a checked object | `satisfies z.ZodType<Omit<T, K>>` (keys come from a checked shape)                                                        |
| union, discriminated union                       | `satisfies SchemaShape<...>` on each object branch, `satisfies z.ZodType<A \| B>` on the whole                            |
| record                                           | `satisfies z.ZodType<Record<K, V>>`; with an enum key that may be missing, `z.partialRecord` and `Partial<Record<K, V>>`  |
| enum                                             | `z.enum(LIST)`; the type is `(typeof LIST)[number]`                                                                       |
| field with `.transform` or `.pipe`               | rule 2 with the output type; add the input type (rule 4) only where code reads the input                                  |
| whole object with `.transform`                   | rule 2 on the object (its type may stay in the schema file, used only there), `satisfies z.ZodType<Output>` on the result |
| field with `.default` or `.prefault`             | required in the output type; optional `?: X \| undefined` in the input type (rule 4)                                      |
| recursive `z.lazy`                               | annotation `: z.ZodType<T>` (none left)                                                                                   |

`CheckStatus`, `CheckResult`, `Finding`, and `InstallerPin` become plain types with no schema (PAR-006).
`LinkinatorConstructor` is trimmed to `Promise<{ passed: boolean }>`. There is no `Runner` type: code that needs it
writes `(typeof RUNNER_NAMES)[number]` (INX-003). The group and naming-category enums read `GROUPS` and
`NAME_CATEGORIES`.

## Import rule

- `config/` imports only `config/`. A value that would need a type is written `as const`, and the code that uses it does
  the type check.
- `types/` imports only `config/` and `types/`, plus `import type` from a library (and, in `tests/types/`, from the
  CLI). An enum type is `(typeof LIST)[number]` of a `config/` list.
- Everything else imports constants from `config/` and types from `types/`. Values computed at import time stay in
  their module: zod schemas, memo keys, cache factories, and tables of functions.

These planned items break the rule today and take the fix in their row (ARC-008).

### Constants that import a type or a package

Each of these 33 placement rows annotates a value with a type from `types/` (or `picocolors/types`), or uses
`satisfies` for a type check. The fix is the same for each: write the value `as const` with no annotation, derive the
type in `types/` from the constant when a type is needed, and let the code that indexes the table do the completeness
check.

| Rows                             | Imported type                                                | Fix                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P01:211, P01:212                 | `Drift`                                                      | `as const`; `types/` derives the kind from `keyof typeof GENERATED_FILE_MESSAGES`                                                          |
| P01:246, P01:247, P01:252        | `CountedLanguage`, `EnvironmentKind`, `CommentStyle`         | `as const`; `CommentStyle` is deleted                                                                                                      |
| P02:240                          | `BashCountRule`                                              | deleted (CKO-001)                                                                                                                          |
| P03:147, P03:149                 | `SuggestionSection`, `ToolInspection`, `picocolors` `Colors` | drop the annotation and the `satisfies`                                                                                                    |
| P03:152, P03:153                 | `SettingDeclaration`, `CommandHelp`                          | `as const`; `CommandHelp` is deleted; the two users write `keyof typeof COMMAND_HELP` (no `CommandName` type, no `types/commands/help.ts`) |
| P03:181, P03:182, P09:27         | `Manifest`, `MiseBackend`                                    | `as const`; group values typed by `GROUPS`                                                                                                 |
| P03:210, P03:211, P04:12, P04:15 | `CheckStatus`                                                | typed by `CHECK_STATUSES` from `config/execution/run.ts`                                                                                   |
| P04:33, P04:36-38                | `EslintBoundaryPolicy`, `EslintDependencyNode`               | `as const`; the `types/` policy arrays become readonly                                                                                     |
| P04:57, P04:60, P04:61           | `Policy`, `HookRunner`, `ActionPin`, `ProseGrammar`          | drop `satisfies` and every annotation (`PROSE_GRAMMARS` is plain `as const`); the users index the tables                                   |
| P05:10, P05:27, P05:40, P05:41   | `OwnedKind`, `ToolProjectPackage`, `PackageInstaller`        | `as const`; keyed by `OWNED_KINDS` and `NPM_CLIENTS`                                                                                       |
| P06:37, P06:115                  | `BlockStyle`, `BlockMarkers`, `Verdict`                      | `as const`; `BlockMarkers` is deleted                                                                                                      |
| P08:38, P08:69                   | `FenceParser`, `OutputSpec`                                  | `as const`; `FenceParser` derives from the table                                                                                           |

`CASE_NAMES` (P01:81) is a literal list `as const` that keys `CASE_TESTS`, a table of functions that stays in code.
`FORWARDING_NODES` (P03:366) imports `FUNCTIONS` from the plugin's own `config/syntax.ts`, which is allowed.

### Types built from a schema

These 60 placement rows use `z.infer` or `z.output`: `P01:280, 290, 300; P03:242, 302, 326, 340; P04:315, 316, 394;
P05:334, 344, 382; P06:418, 419, 421; P07:61, 85; P08:374, 378-381, 387, 396, 398, 405-408, 414, 418-421, 426-429,
435, 436, 439-441, 444, 445, 467, 468, 470, 495, 496, 500; P09:245, 255, 264, 265, 269, 272, 274, 291`, plus P09:244
(`keyof typeof` a schema object). 50 more type items name one of these types and follow them. Each is written by
hand in its `types/` file, and its schema is checked by the type rule above. Enum types come from `config/` lists
(`Level`, `Stage`, `FileKind`, `CheckStatus`, the Git entry mode).

Allowed: `import type` from `web-tree-sitter`, `@pgsql/types`, `node:fs`, `execa`, `ignore`, `commander`,
`@typescript-eslint/utils`, and `@decimalturn/toml-patch` (`ReturnType<typeof parseDocument>` in `TomlBlock` and
`TomlSyntax`), and the docs type that imports the CLI's `SettingDeclaration`. Types that name a type deleted in the
same file (34 cases, for example `ScriptSyntax` and `QuotedArgument`) drop that field or member on purpose.

### Import rule for tests

- 98 `tests/config/` values annotate themselves with a type from `tests/types/` (mostly `FindingCase`,
  `InProcessScenario`, `InstalledScenario`, `CaseChanges`) or from the CLI (`CheckDeclaration`, `SpawnResult`,
  `RunReport`, `Pipeline`, `PrettierPlugin`, `Tooling`). Drop the annotation, write the value `as const`, and let the
  test that reads it check the type.
- Values that need code: the runtime detection rows (built from the CLI's `JAVASCRIPT_RUNTIMES`) stay a function,
  `runtimeDetectionRows()` in `tests/setup/sandbox.ts` (T8:334); the scenario at T7a:687 keeps its `prepare` step (it
  runs `gspot apply`) in the test. `REQUIRED_RULES` and its cases are a literal list in
  `tests/config/eslint/lint-rules.ts` (T2:175, 176), because the manifest tables they were read from are deleted.
  `BASH_REPOSITORY` is plain data with no `prepare` callback; each Bash check test marks `scripts/build.sh` executable
  itself.
- Values that read another package: `MISE_INSTALL_RESULT` (T4:382) and `MISE_FAILURES` (T7b:87) write a literal
  version for the fake `mise` version line instead of reading the CLI's `CLI_PINS`; `EXPO_DEPENDENCIES`,
  `REACT_NATIVE_DEPENDENCIES`, and `WEB_PACKAGES` (T8:146-148) stop reading `#tests/package.json`.
  `GENERATOR_CASES` (T1b:332), `NESTED_PYTHON_POLICY`, `APP_JEST`, `MOBILE_SETTINGS`, `ENTRY_SETTINGS` (T2:442, 498,
  511, 592), `SVELTE_PROJECTS`, and `DOCKERIGNORE_CASES` (T1b:405, 497) write their gspot.toml text; only test files
  call `settingsText`.
- `PackedPackage` is hand-written in `tests/types/e2e.ts` (it is `z.infer` of `packedPackagesSchema` today).
- Program text is not an import: scripts written as strings (`GIT_HOOK_SCRIPT`, `SITE_BUILD_SCRIPT`,
  `ASSET_READER_SCRIPT`, `MODULE_PROGRAM`, and others) may name `node:fs` or the plugin inside the string.
- `tests/setup/` keeps module-level values only when they are built at import time (`isWindows`, `isMacos`,
  `installedModules`, `testModules`, `packedEnvironment`, `CLI_MAIN`, the two mutable timeouts) or are zod schemas
  (`eslintConfigurationSchema`, `packedPackagesSchema`). The setup types are written in the one signature that uses
  them (T8 rows 404-465).
- A `tests/config/` table written `as const` with object rows is passed to `test.each` as `[...TABLE]`: Bun's
  object-row overload takes a mutable array (bun-types 1.4.2, `test.d.ts:573-575`).
