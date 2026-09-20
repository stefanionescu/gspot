# Takeover and Detection

Row 1 of the build order. `init` reads a repository before it proposes anything, and today it
reads too little: one Prettier form, one Python manifest form, and one line shape of an ESLint
config. It then proposes too much, from one file of a language. This step makes `init` read what
the repository holds, propose what that supports, and carry settings in both directions.

After this step the tables that say what a tool owns sit in the manifests (row 13 moves them).
This step changes what those tables say and how they are read.

## K-193: takeover drops what a repository turned on

Closes K-193 and K-41.

**What is wrong.** `disabledEslint` in `lifecycle/carry.ts:237` reads an old config line by line.
Any line shaped `name: 0,` becomes an `[[ignore]]`, whether a rules table holds it or not. A rule set to
`error`, its options, a plugin, and an override for some files vanish. An `off` for some files
becomes an ignore for all. `takeover.test.ts` expects `no-var` to vanish.

**Target.** Takeover carries a rule in both directions, with the paths it held for. A rule turned
off becomes an `[[ignore]]` with `rule` and `paths`. A rule turned on, with its options, becomes
an entry of `tools.<tool>.rules`, or a path-specific override when applicability differs. The plan lists, for each replaced file, every setting that was
not carried.

**Files.** `lifecycle/carry.ts`, new `lifecycle/carry-eslint.ts`, `output/plan-text.ts`,
`types/lifecycle.ts`.

**Logic.** A flat ESLint config is a module, so gspot loads it through ESLint itself.
Resolve the config for every governed file using the repository's installed ESLint. Group equal
configurations and preserve path-specific differences in `[[tools.eslint.overrides]]`.

Compare against proposed output for those same paths. An extension is not a configuration class.
Preserve enabled rules, options, disabled rules, and ignores.

Unsupported plugins, processors, dynamic selectors, or options keep the original file active.
A warning alone is not permission to delete it. New-file applicability and ordering follow
[03-configuration.md](../03-configuration.md). An `.eslintrc` file is read the same way. `disabledFromRulesTable` stays for
markdownlint and stylelint, whose files are plain JSON.

**What goes.** The line pattern of `disabledEslint`, and the test expectation that a rule
vanishes (T-35).

**Tests.** `takeover.test.ts` plants a config with `no-var: error`, a rule off for `tests/**`, and
a plugin gspot does not ship. It holds separate source, test, and package overrides; the unsupported plugin keeps its original configuration active and out of the deletion plan.

**Done when.** That case passes, and the plan of yap-swift-app lists no silent loss.

## K-182: one file proposes a whole language preset

Closes K-182, K-214, and K-247.

**What is wrong.** `proposalFor` in `presets/detect.ts:97` proposes a language from one file, and
`extensionEvidence` prints a count that decides nothing. A Swift app with one Python script gets
the python preset. The default `init` on a repository of seven files selected 17 presets and 108
checks, vitest among them with no vitest installed. A folder that is no git repository still gets
`commits` and the history checks, and `init` does not say so.

**Target.** A language with a project file is proposed from that file: `pyproject.toml`,
`package.json`, or `Package.swift`. A language with no project file (Bash, SQL, HTML, CSS) is
proposed from its files. A tool preset is proposed only where the repository holds that tool. The
plan lists what was found and not proposed, each with its `gspot add` line.

**Files.** `presets/detect.ts`, `lifecycle/selection.ts`, `lifecycle/init/plan.ts`,
`repository/scopes.ts`, and the manifests, whose `[detect]` gains `project_files`.

**Logic.** A preset that another preset recommends is selected only when its own `[detect]`
matches (D-80 stays for presets with no detection, such as naming). A manifest takes
`needs_git = true`, and `selection.ts` leaves such a preset out where `git rev-parse` fails. The
plan then opens with one line that says the folder is no git repository. A `workspaces` key of
`package.json` gives scopes with no lockfile present.

**What goes.** `extensionEvidence` as a reason to select.

**Tests.** Four planted cases: a Swift package with one `.py` file, a package with no vitest, a
folder with no `.git`, and a workspace with no lockfile.

**Done when.** The default `init` on the seven-file repository selects the presets of what it
holds, and the four cases pass.

## K-120: `init` reads one Prettier form

**What is wrong.** `formatDiffers` in `lifecycle/questions.ts:150` reads a Prettier file that ends
in `.json`. A YAML `.prettierrc`, a `prettier.config.js`, the `prettier` key of `package.json`, an
`.editorconfig`, and a Biome config are not read. A repository with tabs takes four spaces with
no question, and the next `check --fix` rewrites every file.

**Target.** `init` learns the format the repository has, and proposes it (D-126).

**Files.** New `lifecycle/init/format.ts`, from the format half of `questions.ts`. Consolidate read and parse outcomes under K-307 rather than keeping a suffix preflight and a second reader that swallows errors.

**Logic.** Use the Prettier `resolveConfig(file, { editorconfig: true })` API for every governed file.
No CLI print-config option exists. Preserve Prettier overrides and EditorConfig section
precedence in `[format]` and `[[format.overrides]]` as specified in
[03-configuration.md](../03-configuration.md). If Prettier is absent, parse the supported settings
from EditorConfig sections and Biome.

Unsupported properties, future-path selectors, or executable configuration remain active.
Do not replace them with a global approximation. The plan names retained files and why.

**What goes.** The `.json` suffix test.

**Tests.** `takeover.test.ts` plants each of the five forms with tabs, and holds
`indent_style = "tab"` in the written config.

**Done when.** The five forms, per-folder overrides, two same-extension files with different settings, and unsupported EditorConfig sections preserve their behavior.

## K-126: dependencies from one Python form

**What is wrong.** `readManifests` in `repository/manifests.ts:150` reads `package.json`, a
PEP 621 `pyproject.toml`, and `Package.swift`. `requirements.txt`, Poetry tables, and `Pipfile`
give no dependency, so fastapi is never proposed there.

**Target.** A dependency is found in every manifest form a Python repository uses.

**Files.** `readers/python-project.ts`, `repository/manifests.ts`.

**Logic.** The reader adds `[tool.poetry.dependencies]`, `[tool.poetry.group.*.dependencies]`,
`requirements*.txt` by line, and `[packages]` of `Pipfile`. Names are compared after PEP 503
normalization.

**What goes.** Nothing.

**Tests.** Unit tests with one test repository for each form, each naming `FastAPI` in another spelling.

**Done when.** Each test repository proposes the fastapi preset.

## K-128: file tags for component files

**What is wrong.** `config/file-tags.ts` knows no `.vue` and no `.svelte` ending, although both
presets ship. Such a file gets the tag `text` and no check that selects by tag sees it.

**Target.** Both endings carry their own tag and the tag `source` (D-140).

**Files.** `config/file-tags.ts`.

**Logic.** Two table rows. `.kt` and `.java` stay unknown, because no preset reads them, and
detection names their language through `linguist-languages`.

**What goes.** Nothing.

**Tests.** A unit test of `repository/tags.ts` for both endings.

**Done when.** `naming/paths` reports a badly named `.vue` file in the planted repository.

## K-42: fixers get every file on one command line

Closes K-42 and K-158.

**What is wrong.** `didRunFixer` in `run/fixers.ts:28` passes every file at once, where a check
splits its list through `fileBatches`. A fixer that exits nonzero is not reported.
`static-site/built-markup` and `static-site/dead-selectors` do the same with pages.

**Target.** Every spawn of a tool with a file list goes through `fileBatches`, and a fixer that
fails is a line of the fix report.

**Files.** `run/fixers.ts`, `run/command-parts.ts`, `checks/static-site/built-markup.ts`,
`checks/static-site/dead-selectors.ts`.

**Logic.** `command-parts.ts` returns a list of commands for a file list, and the fixer, the
checks, and ast-grep all take their commands from it. Rename the executing function to `runFixer`; return a `FixResult` instead of mutating a caller-owned failure list. Its `plannedCheck` and `workingDirectory` parameters follow [19-names.md](../19-names.md). A successful invocation without byte changes is unchanged, not changed.

**What goes.** The second way to build a command, in `fixers.ts`.

**Tests.** A unit test with 20,000 long paths holds more than one command, and a planted fixer
that exits 3 holds its line in the report.

**Done when.** Both pass, and the result distinguishes changed, unchanged, skipped, and failed execution.

**Partial implementation, September 20, 2026.** `runFixer` returns a `FixResult` with changed,
unchanged, skipped, or failed status. Checks and fixers share command preparation, file
batching, and execution deadlines. The caller assembles `FixReport`, preserves partial
changes, and includes correction failures in the final verdict. Byte comparison distinguishes
empty-file deletion and invalid UTF-8 changes. Scratch cleanup covers execution, read, and
partial-copy failures.

**Local verification.** Twenty focused tests pass with 247 assertions. Shared side commands,
site checks, and ast-grep batching remain open under K-42/K-158. Windows execution is deferred.

## K-76: mise tasks that are files

Closes K-76 and K-78.

**What is wrong.** `miseTasks` in `integrity/stale-paths.ts:35` reads `[tasks]` tables of four
files (`MISE_FILES`). A task that is a file under `.mise/tasks/` reads as missing, so
`mise run lint` in a README is a finding. `hookFindings` in `integrity/task-policy.ts` checks the
hooks only when `hooks.tool = "gspot"`.

**Target.** One reader knows every task of a repository, and one check holds the gspot line of
the hooks for every hook form.

**Files.** New `readers/tasks.ts`, `checks/docs/stale-paths.ts`, `checks/integrity/task-policy.ts`,
`config/paths.ts`.

**Logic.** `readers/tasks.ts` returns the task names from mise tables, mise task files, and
`package.json` scripts, for a scope. `task-policy` finds the hook through
`emit/hook-managers.ts`, the same code that wrote the line, and fails when the line is gone.

**What goes.** `MISE_FILES`, `MISE_FILE`, and `HOOKS_DIRECTORY`, three copies of paths that
`config/paths.ts` holds once (K-77).

**Tests.** A planted README that names a file task holds no finding. A husky repository with the
gspot line removed holds one.

**Done when.** Both pass.

## K-237: packages that are no lint tools

**What is wrong.** `LINT_TOOL_PACKAGE_PREFIXES` in `config/patterns.ts:215` holds `supabase`,
`concurrently`, `globals`, and `husky`. A manifest with only those reads as lint-only, and the
plan offers it for deletion.

**Target.** A lint package is a package that a tool of a selected preset names.

**Files.** `lifecycle/takeover.ts`, `config/patterns.ts`.

**Logic.** The list is built from the `npm` and `pypi` names of every manifest tool, plus the
`replaces` names a manifest gives, such as `eslint-config-*` for the javascript preset.

**What goes.** `LINT_TOOL_PACKAGE_PREFIXES`.

**Tests.** `takeover.test.ts` plants a `package.json` with `husky` and `concurrently` alone, and
holds that the plan does not name it.

**Done when.** That case passes.
