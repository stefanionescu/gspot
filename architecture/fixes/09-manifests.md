# The Manifest Owns What the Preset Knows

Row 13 of the build order, and the largest change to the shape of the code. The CLI names
presets, tools, check ids, flags, and file names in its own tables, so a new preset means edits
in five files of `src/`. After this step a manifest holds everything the CLI knows about its
preset, and `src/` names none. The folders of `src/` change with it, and the last table of
[16-file-tree.md](../16-file-tree.md) lists every move.

One unit test closes the step. It reads every file of `packages/cli/src` and
`packages/cli/config` outside `checks/`, and fails on a preset id, a tool name, or a check id.

## K-79: one file registers 130 analyses under names of their own

**What is wrong.** `integrity/dispatch.ts` imports every language folder and maps 130 analysis
names to functions. The folders are named after presets and package managers: `apple`, `cargo`,
`golang`, `pyproject`, `web`. The name `integrity` holds the Swift build, the npm license scan,
and the README shape. An analysis name repeats its check id in another spelling, such as
`xctest-sleep` for `xctest/no-sleep`.

**Target.** D-146. A built-in check that is not structure, naming, or prose is one file under
`src/checks/`. The folder is the first part of its check id, and the file is the second. A
parser that several checks share sits in `src/readers/`.

**Files.** Every file under `src/apple`, `src/pyproject`, `src/web`, `src/sql`, `src/postgres`,
`src/supabase`, `src/express`, and `src/integrity` moves, as the table of the file tree says.
New: `src/checks/registry.ts`. The same move happens under `tests/unit/` and `types/`.

**Logic.** `registry.ts` is one map from a check id to a function with the signature
`(input: EngineInput) => Promise<Finding[]>`. `run/engines.ts` looks the id of the planned check
up in it. The manifest key `analysis` goes.

The family `integrity` keeps the checks over the
policy and the files gspot writes. The others take the family of their preset:
`integrity/docs-headings` becomes `docs/headings`, `integrity/lockfile-fresh` becomes
`dependencies/lockfile-fresh`, `integrity/env-files` becomes `secrets/env-files`, and
`integrity/locales` becomes `i18n/locales`. A file that held several checks splits, one check to
a file.

**What goes.** `integrity/dispatch.ts`, the key `analysis` in 130 manifest entries, and the four
folder names that told a reader nothing.

**Tests.** A unit test holds the keys of the registry equal to the ids of every manifest check
with `engine = "integrity"`. The planted tests change their expected ids in the same commit.

**Done when.** `ls packages/cli/src` prints the 17 folders of the file tree.

## K-39: takeover tables that name 29 tools

Closes K-39, K-14, K-107, and K-13.

**What is wrong.** `OWNER_PRESET` in `lifecycle/takeover.ts:18` maps 29 tools to presets.
`CHECK_BY_TOOL` in `config/carry.ts:4` maps 13 tools to check ids, and `policy/propose.ts` holds
nine tool tables. Twenty of the owner rows name presets that do not ship. `CarriedLists` has one
hand-written field for each of seven tools, so a new tool means edits in five files.
`gspot allow gitleaks`, `osv`, and `licenses` write keys of presets that may not be selected.

**Target.** A manifest says which old files its tools own, and what is carried from them.

**Files.** `presets/manifest-schema.ts`, every manifest with a tool that has a config file,
`lifecycle/takeover.ts`, `lifecycle/carry.ts`, `policy/propose.ts`, `types/lifecycle.ts`. Deleted:
`config/carry.ts`.

**Logic.** A tool in a manifest takes `[[tools.takeover]]` rows. A row has `file` (a name or a
glob), or `table` and `key` for a shared manifest, `shared`, and `carries`. `carries` names a
reader from a closed list: `ignore-paths`, `rules-table`, `words`, `advisories`, `licenses`,
and `eslint-config`. `CarriedLists` becomes a map from a tool name to its carried entries, and
the plan prints it by walking the map.

**What goes.** `OWNER_PRESET`, `CHECK_BY_TOOL`, the nine tables, the seven fields, and six of the
seven lists of `gspot allow` (D-131).

**Tests.** `takeover.test.ts` runs unchanged. A unit test holds that every takeover row names a
reader from the list.

**Done when.** Adding a takeover row for a new tool needs no edit under `src/`.

## K-38: tool names, flags, and banners in the core

Closes K-38, K-17, K-85, K-113, K-177, and K-203.

**What is wrong.** The core names `swift`, `prose`, `typescript`, `commits`, `nestjs`, and
`xcode`. It holds seven tool file prefixes, the baseline file names of ESLint and basedpyright,
the ESLint flags behind `{suppressions}`, and the ESLint crash banner. `NEVER_CACHED` in
`run/execute.ts:21` holds three check ids.

`VERSION_FLAGS` in `platform/tool-probe.ts:14` holds
four tools, and `TOOL_RULE_SOURCES` in `output/explain.ts:26` holds five. A missing Vale says
`run mise install` whatever the runner is. The rules lint guards against product names with
fourteen words written by hand.

**Target.** Each of those is a key of the manifest that owns the tool or the check.

**Files.** `presets/manifest-schema.ts` and the manifests, `run/execute.ts`,
`run/command-parts.ts`, `run/broken-tool.ts`, `platform/tool-probe.ts`,
`platform/install-hints.ts`, `output/explain.ts`, `prose/vale.ts`, `src/rules/terms.ts`.

**Logic.** A check takes `cached = false`. A tool takes `version_command`, `baseline_file`,
`suppressions_flag`, `crash_pattern`, and `rule_page`, an address with `{rule}` in it. `explain`
prints that address for any tool.

A missing tool message comes from `install-hints.ts`, which already
words the advice for each runner, and its fallback is the runner the repository uses. The word
list of the rules lint is the set of tool and library names of every manifest, less the names
of the file's own preset.

**What goes.** `NEVER_CACHED`, `VERSION_FLAGS`, `TOOL_RULE_SOURCES`, the fourteen words, and every
comparison of a preset id under `src/`.

**Tests.** The unit test named at the top of this file.

**Done when.** That test passes with an empty exception list.

## K-197: one template holds the rules of seven presets

Closes K-197, K-223, K-199, and K-220.

**What is wrong.** `presets/javascript/eslint.config.js.tmpl` asks `has('zustand')`, and the same
for `react-hook-form`, `react-native`, `nestjs`, `drizzle`, and `trpc`. The cause is that
`no-restricted-syntax` is one rule, so a later block replaces an earlier one. The stylelint,
sqlfluff, vue, and svelte templates ask `has(...)` too. `ruff.toml.tmpl` repeats each default
beside the manifest that owns it. `knip.json.tmpl` names `build.ts`, `publish.ts`, and
`src/plugin.{ts,js}` for every project.

**Target.** The rules of a library live in its own preset (D-139). No template names another
preset, and no template holds a default.

**Files.** The javascript template and the fragments of the seven presets, `emit/templates.ts`,
`emit/targets.ts`, the four other templates, `presets/javascript/knip.json.tmpl`.

**Logic.** A fragment exports two things: config blocks, and a list of selectors with messages.
The template joins the selectors of every selected fragment into the one
`no-restricted-syntax` rule. `has()` leaves the template helpers, so no template can ask. A
setting a fragment needs from another preset is declared by both manifests under one name. The
knip entry list comes from the `entry_files` of each selected framework manifest, and this
repository keeps its own entries in `tools.knip.entry`.

**What goes.** `has()`, every default in a template, and three file names of this repository in
the knip template.

**Tests.** The snapshots, and a unit test that reads every template for `has(` and for a number
that a setting of the same name holds.

**Done when.** That test passes.

## K-105: the shape of the config is written twice

Closes K-105, K-183, and K-106.

**What is wrong.** `Policy` in `types/config.ts` repeats the zod schema of `policy/schema.ts` by
hand. The list of hook tools appears three times, the runners five times, and the CI providers
three times. The run record is a set of types and a zod schema written to match them. Five
types that only tests use sit in the types of the binary, and two doc comments describe a type
that is gone.

**Target.** A zod schema is the one owner of a shape, and the type is inferred from it.

**Files.** `policy/schema.ts`, `types/config.ts`, `run/record/schema.ts`, `types/record.ts`,
`types/run.ts`, `types/lifecycle.ts`, `commands/init.ts`, `tests/harness/`.

**Logic.** `types/config.ts` holds `export type Policy = z.infer<typeof policySchema>` with a
type-only import, which keeps the rule that types live under `types/`. The three lists are
`z.enum` values, and `commands/init.ts` reads its choices from `.options`.

**What goes.** About 300 lines of hand-written types, and `SpawnOutcome`, `Registry`,
`PlantedCase`, `AcceptanceRun`, and `ComponentShape`, which move to `tests/harness/types.ts`.

**Tests.** `tsc` is the test: a field added to a schema exists in its type.

**Done when.** A search for the runner names finds one list.

## K-55: constants written more than once

Closes K-55, K-77, K-124, K-131, K-165, K-94, and K-169.

**What is wrong.** The hooks folder name, the mise file path, `.gspot/hooks`, `HOOK_DIRECTORIES`,
and `JSON_INDENT` each stand in two or three files. The five release targets are written in
`build.ts`, `publish.ts`, and the `uname` cases of `emit/workflow.ts`, in three spellings.
`PATH_KEYS` is written in both profile files. The binary embeds `schema/`, and no code reads it.

**Target.** One constant for each, in `config/paths.ts` or beside its one owner.

**Files.** New `config/paths.ts`, new `config/targets.ts`, and each file that held a copy.

**Logic.** `targets.ts` holds five rows with `os`, `arch`, the Bun target, the npm package name,
and the `uname` pair. `PATH_KEYS` lives in `lifecycle/init/profile.ts`, the one profile file
left after D-131.

**What goes.** Eleven copies, and the embedded `schema/` folder.

**Tests.** None beyond the compiler.

**Done when.** A search for `.mise/conf.d` under `packages/` finds `config/paths.ts` alone.

## K-24: small duplicates inside the engines

Closes K-24, K-139, K-171, and K-190.

**What is wrong.** The structure context carries `bashText`, `bashList`, and `bashSetting`, and
every code analysis reads them. The five naming extractors each hold their own `add` function and
label table, and `grammarFor` is a chain of `if` statements. A line limit counts code lines in
Bash, SQL, and Python, and every line elsewhere, and the Python file repeats 300 and 60 as
constants. Five plugin rules write out the same four import listeners.

**Target.** One name, one function, and one count for each.

**Files.** `structure/engine.ts`, `naming/extract.ts`, `naming/extractors/*.ts`,
`naming/parsers.ts`, `config/grammars.ts`, `structure/code-lines.ts`,
`structure/analyses/file/length.ts`, `packages/eslint-plugin/src/files.ts`.

**Logic.** The context fields become `text`, `list`, and `setting`. `extract.ts` holds `add` and
the labels, and an extractor is a table of tree-sitter queries. `grammarFor` reads
`config/grammars.ts`. Every line limit gspot owns counts through `code-lines.ts`, and the summary
of `limits.file_lines` says that a tool of another language counts every line. `files.ts` gains
`importListeners(check)`.

**What goes.** Five `add` functions, the `if` chain, two constants, and sixteen listener copies.

**Tests.** The existing unit tests, which pass unchanged.

**Done when.** They pass.

## K-40: the init proposal holds values of one repository

**What is wrong.** `TYPES_DIRECTORIES` in `lifecycle/init/plan.ts:12` lists `api/types`.

**Target.** The types folder is proposed from what the repository holds: `types` or `src/types`
in the root or in a scope. The commit scopes are what `tools.commitlint.scopes` names.

**Files.** `lifecycle/init/plan.ts`, `presets/typescript/manifest.toml`.

**Logic.** The two folder names are the `detect` table of the setting `types_directory` in the
typescript manifest (K-93).

**What goes.** `TYPES_DIRECTORIES`, and the scopes `root`, `hooks`, and `deps`.

**Tests.** The proposal snapshot of a repository with `src/types`.

**Done when.** It passes.

## K-179: general rule files go into every repository

Closes K-179 and K-232.

**What is wrong.** `src/rules/assemble.ts` installs the three general folders by name, so a Swift
app receives `CLI.md`, `ACCESSIBILITY.md`, and six documentation guides. The docs preset lists
those six, and the list changes nothing. Six rule files are installed by no manifest, among them
`nextjs/SECURITY.md`, `SWIFTUI.md`, and `UIKIT.md`. A file that a manifest names and the folder
lacks is skipped with no message.

**Target.** A rule file installs because a selected manifest lists it. The general files that
every repository needs are listed by the structure preset, which every selection holds.

**Files.** `src/rules/assemble.ts`, the manifests of structure, docs, nextjs, swift, css, and
vitest, `src/rules/lint.ts`.

**Logic.** A `[rule_files]` entry takes `when`, a detection table like `[detect]`: the swift
preset lists `SWIFTUI.md` when a Swift file imports `SwiftUI`, and `UIKIT.md` the same way. The
css preset lists `TAILWIND.md` when `tailwindcss` is a dependency. The vitest preset lists
`PLAYWRIGHT.md` when `@playwright/test` is one. `BUN.md` is listed by the javascript preset when
a `bun.lock` exists. The assembler fails on a listed file that the folder lacks.

**What goes.** The three folder names in `assemble.ts`.

**Tests.** The rules lint fails a rule file no manifest lists. The Swift planted install holds no
`ACCESSIBILITY.md`.

**Done when.** Both pass.

## K-231: guides that are the notes of one product

Closes K-231, K-260, K-242, and K-262.

**What is wrong.** The three Express files are the architecture document of one API, with its
helpers by name. `JAVASCRIPT.md` is the guide of one static site, and `VITEST.md` is a guide to
testing one Express API. Nine more guides carry one chat application: `nextjs/SECURITY.md`, the
Zustand, TanStack Query, React Hook Form, tRPC, and Drizzle guides, `DOCKER.md`, the two fastapi
files, and `I18N.md`. The general files hold habits of the owner: the full diff in every plan,
ASD-STE100, no subagents, Bun as the package manager, no tests unless requested.

`DRIZZLE.md`
forbids dual reads and phased releases for a schema change. Six list items of `DOCKER.md` stop in
the middle of a sentence.

**Target.** A language, framework, library, or tool file says what holds for every project of
that kind. A general file holds what holds for every repository.

**Files.** The 20 rule files these four rows name, and `src/rules/terms.ts`.

**Logic.** A passage about one product moves into the repository it came from, during its
migration, as a rule file of that repository under `[rules] extra`. A habit of the owner moves
into the profile of the owner. A sentence that is wrong for most projects, such as the Drizzle
cutover rule, is deleted. The rules lint refuses the word `quality/` and the names of the
reference repositories.

**What goes.** About a third of the text of the 20 files.

**Tests.** `rules/lint` with the word list of K-38, which is built from the manifests.

**Done when.** It passes, and no rule file names a helper function of a reference repository.

## K-255: one check id shipped by two presets

**What is wrong.** `integrity/locales` ships from the i18n preset with
`tools.i18n.translations` and from the nextjs preset with `tools.next.translations`.
`web/locales.ts:36` reads the nextjs key first, so a repository that sets both gets one of them
with no word.

**Target.** The i18n preset alone ships `i18n/locales` and its one setting. The nextjs preset
recommends i18n where `next-intl` is a dependency.

**Files.** `presets/i18n/manifest.toml`, `presets/nextjs/manifest.toml`, `checks/i18n/locales.ts`,
`readers/locale-files.ts`.

**Logic.** A manifest that repeats the check id of another manifest fails to load.

**What goes.** `tools.next.translations`.

**Tests.** A manifest fixture with a repeated id fails.

**Done when.** That fixture fails, and the Next.js planted repository passes with i18n selected.

## G-13: two conventions for constants

**What is wrong.** `packages/cli` keeps constants in `config/`, and `packages/eslint-plugin` keeps
47 constants beside the rules that use them. No decision says which a package follows.

**Target.** Both packages keep literal tables in a `config/` folder, and
`integrity/config-purity` guards both.

**Files.** New `packages/eslint-plugin/config/`, the rule files, and the `gspot.toml` of this
repository, whose `config` role gains the second folder.

**Logic.** Moves only. A constant of one algorithm stays inline (D-22).

**What goes.** Nothing.

**Tests.** `integrity/config-purity` over the new folder.

**Done when.** It passes.
