# Delete First

This step deletes what nothing uses, before any fix builds on it (D-134). Each deletion takes the
code, the flag or key, its test, and every mention in `architecture/` and in the manual, in one
commit. Nothing is renamed to a softer form, and no message is written for a thing that is gone.
An old key is an unknown key, and an old flag is an unknown flag.

K-204 closes before this step starts, so every deletion runs under a working CI (K-282). A
deletion whose replacement lives in a later fix file moves into that file: `apply --check` goes
with `integrity/generated-drift` (K-246), `apply --lower-baselines` with the baseline itself (K-290),
and `doctor --settings` with `gspot list` (K-62).

The order inside the step: the four presets first, because they are the largest cut. Then the
command surface, then the dead keys and fields, then the plugin rules, then the repository files.

`packages/cli/rules-lint` moves to `src/rules`.
[16-file-tree.md](../16-file-tree.md) holds the full table.

## D-129: commands and flags that leave

Closes D-129 to D-133.

**What is wrong.** Three commands answer a question another command answers: `why`, `declare`,
and `profile check`. Several flags are parsed and used by no test and no guide.

**Target.** The fifteen commands of [02-cli.md](../02-cli.md). This step deletes `why`,
`declare`, and `profile check`. Later steps remove `allow`, rename `profile save` to `export`,
and add `install` and `list` (D-156, D-160, D-161).

**Files.** Deleted: `commands/why.ts`, `commands/declare.ts`, `output/why.ts`,
`policy/declare-command.ts`, and their unit tests. `src/profile/` keeps `read.ts`, `save.ts`, and
`schema.ts`, and `command.ts` loses its `check` half. `doctor/newer-version.ts` moves to
`lifecycle/upgrade/newer-version.ts`, because `upgrade --dry-run` is the one caller left.

**Logic.** `explain` takes a path and prints what `why` printed (D-131). `gspot set generated <glob>` and
`gspot set vendored <glob>` append the entries `declare` wrote. `policy/allow-command.ts` keeps the list `typos`
and loses the other six. `doctor` calls no network, so `--offline` has no meaning.

`apply` loses `--check` and `--lower-baselines`. `ignore` and `set`
lose `--dry-run`, `add` and `remove` keep it (D-163), and `upgrade --check` becomes `upgrade --dry-run` (D-129).
`uninstall` loses `--keep-hooks`. `check --at` becomes `check --stage`, and `--keep-format` and
`--shipped-format` become `--format keep` and `--format shipped`.

**What goes.** The values `"none"` of `--ci`, `--hooks`, and
`--runner`, which become `--no-ci`, `--no-hooks`, and `--no-runner` (D-130). The 21 test files
that use a removed flag change in this commit (T-35).

**Tests.** The completion test reads the command list from the program and holds 16 names
(T-22). A unit test holds that `gspot why` exits 2 as an unknown command.

**Done when.** `gspot --help` matches the public command list in [02-cli.md](../02-cli.md), and none of the removed flags parses.

**Partial implementation, September 20, 2026.** `explain <path>` reports tracked file
classification, scope, claims, checks, baselines, and ignores. The `why` command and its
output module are removed. Command tests cover text and JSON output, a name shared by
a file and a preset, and unknown-command refusal. D-129 remains open for its other
commands and flags.

`profile check` is removed. `init --from --dry-run` validates a profile and prints its plan.
A planted test compares all repository file contents and modes before and after that dry run.
Invalid profiles fail before writes, and the removed subcommand is rejected.

`doctor` uses local state and has no `--offline` flag or registry version lookup. Its unit
test rejects registry access and verifies that local diagnostics still report the repository.
The remaining version lookup is owned by `lifecycle/upgrade/newer-version.ts`.

`ignore` and `set` reject `--dry-run` before entering their policy writers. A regression
compares repository contents and modes after each rejected invocation.

## D-100: the lint files at the root of this repository

Closes D-100 and K-47.

**What is wrong.** Twelve lint files sit at the root of gspot, and nine of them are whole copies
of a file under `.gspot/`. A JSON copy loses its mark, so `uninstall` cannot tell it is its own.

**Target.** The root holds no lint file. Each check passes `--config` with the path under
`.gspot/`. A root file exists only as a pointer, for a tool that has an include form.

**Files.** Deleted at the root: `.commitlintrc.json`, `.gitleaks.toml`,
`.markdownlint-cli2.jsonc`, `.prettierrc.json`, `.prettierignore`, `.semgrepignore`,
`.shellcheckrc`, `.taplo.toml`, `.v8rrc.yml`, `.yamllint.yml`, `osv-scanner.toml`, `typos.toml`,
and `eslint.config.mjs`. `emit/stubs.ts` becomes `emit/pointers.ts`. A tool with an include form
gets a pointer in place of its copy. Prettier and commitlint take a re-export, and the table of
K-269 in [23-scenarios.md](23-scenarios.md) holds every tool.

**Logic.** The manifest key `copy` leaves `presets/manifest-schema.ts`, and `emit/targets.ts`
loses the branch that writes a copy. `.editorconfig` stays at the root, because the formatting
preset writes the file itself there, with its mark, and editors read no other place.

**What goes.** Nine `copy = true` lines in seven manifests.

**Tests.** A planted install holds that the root gains no file but `gspot.toml`, the mise file,
`.editorconfig`, and the managed blocks.

**Done when.** `git ls-files` at the root of gspot names no lint configuration file.

## K-92: the subagents sentence

**What is wrong.** `rules/managed-block.ts` writes `SUBAGENTS`, a working habit of one owner,
into the `CLAUDE.md` of every repository.

**Target.** The managed block holds facts about the repository: the guides, the check command,
and how policy changes.

**Files.** `src/rules/managed-block.ts`.

**Logic.** The constant `SUBAGENTS` goes, and `closing` is `CHECKS_INSTALLED` or `RULES_ALONE`.

**What goes.** The sentence in `CLAUDE.md` and `AGENTS.md` of this repository, on the next
`gspot apply`. The owner keeps the habit in a file of their own, outside the managed block.

**Tests.** The unit test of the managed block holds the new closing line.

**Done when.** No file gspot writes holds the word subagents.

## K-97: `init --own` and `--project-templates`

**What is wrong.** Both flags are parsed into the options, and no code reads `own` or
`projectTemplates`. The copy of project templates that D-79 describes is not built.

**Target.** Neither flag exists. `rules/templates/project/` is deleted, and
`rules/templates/docs/` stays, because the docs preset installs it.

**Files.** `commands/init.ts`, `commands/apply.ts`, `types/lifecycle.ts`, `types/emit.ts`.
Deleted: `rules/templates/project/`. Git keeps the five files, and each moves into the repository
it describes during the migration of that repository ([09-rules.md](../09-rules.md)).

**Logic.** Two option lines and two fields go. No function changes.

**What goes.** D-79 shrinks to one line in the decision log, and the section on project templates
leaves [09-rules.md](../09-rules.md) and [02-cli.md](../02-cli.md).

**Tests.** None is needed beyond the completion test.

**Done when.** `gspot init --help` shows neither flag.

## K-99: keys and settings with no reader

Closes K-99 and K-100.

**What is wrong.** The config accepts `architecture.package_roots`, `route_directories`,
`shared_directories`, `feature_contracts`, `imports_allowed`, and `[editor] vscode`. Three
manifests declare `limits.line_length`, `limits.trivial_ast_nodes`, and
`tools.trufflehog.verified_only`. A developer who sets one gets no error and no effect.

**Target.** Each of the nine is an unknown key, refused at load with the nearest real key.

**Files.** `policy/schema.ts` (lines 88 to 92, and `editorSchema`), `policy/normalize.ts`,
`types/config.ts`, and the manifests of structure, formatting, and secrets.

**Logic.** The fields go from the strict objects, so zod refuses them. `normalize.ts` loses the
`editor` default and the `imports_allowed` default.

**What goes.** The `.vscode/*.json` managed entries in the header comment of
`emit/managed-blocks.ts`, and the rows of those keys in [03-configuration.md](../03-configuration.md)
and the nextjs preset page.

**Tests.** The schema test gains one invalid fixture for a removed key. A unit test holds that
every declared setting has a reader, by walking the manifests (K-100).

**Done when.** `gspot set architecture.package_roots x` exits 2 and names no such setting.

## K-102: seven plugin rules

Closes K-102, K-187, and K-188.

**What is wrong.** `no-trivial-functions` repeats `no-call-through`, and its option changes
nothing. `no-single-file-folders` and `no-prefix-collisions` repeat two structure checks. Five
rules repeat a pinned tool: `import-direction`, `no-harness-barrel-imports`,
`no-reexports-outside-index`, `no-duplicate-barrel-exports`, and the `interface` message of
`types-placement`. One fact is two findings under two names, with two allow lists.

**Target.** The plugin holds 19 rules, and one fact has one finding.

**Files.** Deleted under `packages/eslint-plugin/src/rules/` and `tests/rules/`: the six rule
files and their six tests. `types-placement.ts` loses its `interface` message.
`presets/javascript/eslint.config.js.tmpl` and `presets/typescript/eslint.fragment.js.tmpl`
change.

**Logic.** `no-call-through` covers declarations, expressions, arrows, and methods, and keeps its
allow list. The template writes `boundaries/element-types` for direction, `no-restricted-imports`
for the harness folder, `no-reexports` with `allowIndex`, and `import-x/export` for duplicates.

**What goes.** The setting `limits.trivial_statements` for TypeScript, and the option
`maxStatements`. The rule names leave `plugin.ts` and `configs.recommended`.

**Tests.** The cases of each deleted rule move into a planted TypeScript repository, where the
rule of the tool must report them.

**Done when.** A lone file in a folder is one finding, `structure/single-file-folder`.

## K-104: fields nothing reads

Closes K-104 and K-129.

**What is wrong.** `Session.problems` is always empty (`run/session.ts:29`). `PlanOptions.fix`
has no reader. No preset uses the manifest key `conflicts`, which has a message and a code path
in `presets/select.ts`. `docsBase` is never set, `ExistingTool.owned` is always `false`, and
`RunRecord.root` writes an absolute path of one machine into `last.json` and the SARIF upload.

**Target.** A field exists when something sets it and something reads it.

**Files.** `run/session.ts`, `run/plan.ts`, `presets/manifest-schema.ts`, `presets/select.ts`,
`output/reporter.ts`, `repository/existing-tooling.ts`, `run/record/schema.ts`, and their types.

**Logic.** `findingLines` loses its `docsBase` parameter. The SARIF writer uses a path relative
to the repository, as the findings already do.

**What goes.** The conflict message of `policy/messages.ts`, and the run record schema loses
`root`, so `schemas.ts` writes the schema again.

**Tests.** The JSON shape test holds the record without `root`.

**Done when.** `knip` reports no unused type member in `types/`.

## K-111: three ways to silence a finding become one

Closes K-111 and K-115.

**What is wrong.** `lint:justify` and five `lint:allow-...` comments still work, beside
`gspot-ignore`. `[[ignore]]` also takes a `finding` key that matches message text, which no
command writes and no guide names.

**Target.** A finding is silenced by `[[ignore]]` with `check`, `rule`, `paths`, and `reason`, or
by one `gspot-ignore` comment with a reason. Nothing else.

**Files.** `config/shell.ts` (`MARKERS`), `config/markers.ts`, `config/integrity.ts`,
`policy/schema.ts`, `run/ignores.ts`.

**Logic.** `ignores.ts` loses the two lines that read `entry.finding`. The shell analyses read
`gspot-ignore` through the one reader every engine uses.

**What goes.** Six marker strings, and the `lint-justify` form of the suppression table.

**Tests.** A planted shell script with `lint:allow-unused-function` reports the function.

**Done when.** A search of `packages/cli` for `lint:` finds nothing.

## K-119: a branch for an engine that is not built

**What is wrong.** `run/engines.ts:56` returns a skip with the note that the engine is not in
this build, and every engine a manifest names is built. `UNPARSED_LIMIT` is written in
`parse-output.ts` and `json-output.ts`, and the comment openers in three files.

**Target.** An unknown engine name is refused when the manifest is read.

**Files.** `run/engines.ts`, `presets/manifest-schema.ts`, `config/markers.ts`,
`run/parse-output.ts`. `run/json-output.ts` moves into `output/json.ts`.

**Logic.** The manifest schema holds the engine names as an enum. `UNPARSED_LIMIT` and the
comment openers live once, in `config/markers.ts`.

**What goes.** The skip branch and its note.

**Tests.** A manifest fixture with `engine = "nope"` fails to load.

**Done when.** The note text exists nowhere in the source.

## K-146: the word corpus

**What is wrong.** The naming policy gspot ships bans the word, and 24 places of the source still
hold it, in comments and in names under `src/rules/` and `config/`.

**Target.** The source says rule files, as every document does (K-54).

**Files.** `src/rules/assemble.ts`, `src/rules/managed-block.ts`, `config/docs.ts`, and the types
they use.

**Logic.** Renames only.

**What goes.** The 24 uses.

**Tests.** `naming/identifiers` passes on gspot with no exception for the word.

**Done when.** A search of `packages/` for `corpus` finds nothing.

## K-180: manifest keys, a pin, and a runner that do nothing

Closes K-180, K-195, and K-240.

**What is wrong.** The config key `executable` and the installer `ubi` have readers and no
manifest that uses them. The python preset pins `pyproject-fmt`, which no check and no fixer
runs. The runner `uv` is accepted, its hint says `uv sync --group gspot`, and no code writes that
group.

**Target.** `--runner` takes `mise`, `npm`, `pnpm`, `yarn`, and `bun`. The Python tools install
under `.gspot/` with uv, as D-157 decides ([08-frameworks.md](08-frameworks.md), K-266).

**Files.** `presets/manifest-schema.ts`, `presets/read-manifests.ts` (`INSTALLER_KEYS`),
`emit/targets.ts:106`, `emit/apply-command.ts:31`, `platform/install-hints.ts`,
`policy/schema.ts` (`runnerSchema`), `commands/init.ts:80`, `lifecycle/questions.ts:28`,
`lifecycle/install-tools.ts:16`, and `presets/python/manifest.toml:70`.

**Logic.** gspot pins itself in the mise file as `"github:stefanionescu/gspot"`, not through
`ubi`, in `emit/runner-tasks.ts` and in the hint of `upgrade/command.ts:15`. Detection in
`existing-tooling.ts` still reads `uv.lock`, because the scope reader needs it.

**What goes.** The installer list written twice, which becomes one constant.

**Tests.** `init --runner uv` exits 2 and lists the five runners.

**Done when.** No manifest key of the schema is unused by all 48 manifests, held by a unit test.

## K-205: generated pages that git tracks

**What is wrong.** 293 of the 309 tracked files under `docs/` are pages that
`docs/reference-pages.ts` writes. Every edit of a manifest or a decision has to write and commit
them again, and the check `docs/generated` exists only to catch a forgotten run.

**Target.** The docs build writes the pages first. Git ignores
`docs/src/content/docs/reference/`.

**Files.** `docs/package.json` (the build script), `.gitignore`, `gspot.toml` (the
`docs/generated` check goes), and `docs/reference-pages.ts` loses `--check`.

**Logic.** `build` runs `bun reference-pages.ts && astro build`. Keep this generator; K-303 and K-304 in [25-simplification.md](25-simplification.md) define safe output ownership and complete public reference content. Remove the public decision-log mirror rather than copying target design into release documentation.

**What goes.** 293 tracked files, the `[[check]]` entry, and the step of the contribution guide
that says to run the script after a decision changes.

**Tests.** The docs job of CI builds the site from a clean checkout.

**Done when.** Git tracks no generated reference pages, a clean build produces the complete public reference, and authored guides survive generation. A total file-count ceiling is not a correctness test.

## K-259: leftovers in `.gitignore`

**What is wrong.** The file ignores `/packages/cli/scratch/`, a folder that is gone. A
`.pytest_cache/` folder sits at the root, left by a test that ran pytest there. The managed block
sits in the middle of the file.

**Target.** Hand entries first, then the managed block, and no entry for a path that does not
exist.

**Files.** `.gitignore`, and the planted test that runs pytest, `tests/repositories/fastapi.test.ts`
or `pyproject/tools.test.ts`, whichever leaves the cache.

**Logic.** The harness runs a tool with the planted folder as its working directory, never the
root of gspot.

**What goes.** The scratch entry and the stray cache folder.

**Tests.** After the full suite, `git status --ignored` names no `.pytest_cache` at the root.

**Done when.** The managed block is the last thing in `.gitignore`.

## S-10: the Vale half of the rules lint

**What is wrong.** `rules-lint/command.ts` passes when Vale is absent and when Vale fails. It runs
Vale once for each file with a second `vale.ini` under `prose/`, and `prose/vale` already reads
every Markdown file of `rules/`.

**Target.** The rules lint reads front matter, links, size, layer, and fences. Prose is one
check, `prose/vale`, for every text of the repository.

**Files.** `packages/cli/rules-lint/` moves to `src/rules/` as `lint.ts`, `front-matter.ts`,
`terms.ts`, and `lint-command.ts`. Deleted: `valeFindings` in `lint.ts`, and `prose/vale.ini`.

**Logic.** The `[[check]]` entry `rules/lint` of `gspot.toml` points at the new path and drops
the words about prose from its summary.

**What goes.** The second Vale run, and about a minute of every commit that touches `rules/`.

**Tests.** A rule file with a broken link fails `rules/lint`, and one with a long sentence fails
`prose/vale` only.

**Done when.** `vale` is spawned from one file, `src/prose/vale.ts`.

## K-282: the order works against itself

**What is wrong.** The index deleted first and fixed CI second, so the largest deletion ran with
no working CI. It deleted three flags before the commands that replace them exist.

**Target.** K-204 alone comes first. A thing is deleted in the commit that builds what replaces
it, or in this step when nothing replaces it.

**Files.** [22-remaining.md](../22-remaining.md), and the three sections this file points at.

**Logic.** None in the code.

**What goes.** Nothing.

**Tests.** After each commit of this step, the run on GitHub is green.

**Done when.** The order of the index says so.

## K-290: the baseline and the first check

**What is wrong.** `init`, `add`, `upgrade`, and a level change each run checks and write counts,
one file for each rule. A rise in a count fails a run, and a command lowers the counts. The first
install in yap-swift-app took 35 minutes and wrote 112 files that nobody reads. The owner decided
on 2026-09-19 that gspot manages the tools and the developer decides when to lint (D-165).

**Target.** Installing gspot runs no check, and nothing records old findings. `gspot check`
reports what it finds today. An old repository adopts gspot through the files a change touches,
the level `recommended`, `gspot ignore`, and `git commit --no-verify`.

**Files.** Deleted: `run/baselines.ts`, `lifecycle/first-check.ts`, `emit/first-baseline.ts`,
`emit/lower-baselines.ts`, `emit/prune-baselines.ts`, `integrity/baselines-current.ts`, their
unit tests, and `.gspot/baselines/` of this repository. Changed: `run/execute.ts`,
`output/reporter.ts`, `policy/add-command.ts`, `lifecycle/upgrade/command.ts`,
`presets/manifest-schema.ts`, and the manifests of javascript, typescript, and python.

**Logic.** `execute.ts` loses the baseline step between the findings and the verdict, so a
finding that is not ignored fails its check. The manifest keys `baseline_file`,
`baseline_command`, and `prune_command` go. ESLint loses `{suppressions}`, and basedpyright loses
`--baselinefile`. The CI job checks what a change touches, and `[ci] run = "all"` makes it
check everything.

**What goes.** `apply --lower-baselines`, `apply --baseline`, `NEVER_BASELINED`, the baseline
lines of the reporter, the init plan line about baselines, and the widening step of D-143.

**Tests.** The planted installs hold that `init` starts no tool but the installers. A planted
repository with an old finding in an untouched file commits a change to another file.

**Done when.** A search of `packages/` for `baseline` finds only the file gitleaks keeps.
