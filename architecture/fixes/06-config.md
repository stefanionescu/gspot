# The Config Text and Scopes

Rows 8 and 9 of the build order. `gspot.toml` is a file a person reads and edits. Today `init`
writes lines hundreds of characters wide, refuses `src` where it wants `src/**`, and spells one
idea four ways across the settings. After this step the file reads like one a person wrote, one
word means one thing, and a folder with a project file is a scope.

Nothing here keeps an old spelling. A setting that is renamed is an unknown key under its old
name (D-134), and [19-names.md](../19-names.md) holds the table of renames.

## K-51: scope settings as inline tables

**What is wrong.** `policy/propose.ts` writes scope settings as inline tables, because
`policy/write.ts` refuses a document that mixes inline tables and sub-tables. The app policy has
lines of several hundred characters, and one gitleaks entry repeated for each path (A-8, A-9).

**Target.** The policy holds no line over 120 characters. A scope is `[[scope]]` with sub-tables
`[scope.limits]` and `[scope.tools.<name>]`. One `[[ignore]]` holds one reason and a list of
paths.

**Files.** `policy/propose.ts`, `policy/write.ts`, `policy/ignore-command.ts`.

**Logic.** `propose.ts` builds the document as sub-tables through `TomlDocument`. `write.ts`
appends to the sub-table when it exists and creates it when not. `ignore-command.ts` adds a path
to an entry with the same check, rule, and reason, and creates an entry only for a new reason.

**What goes.** The inline form in the writer. The reader takes any valid TOML, as it does today.

**Tests.** A unit test writes a scope setting into a document of each form and loads the result.
The proposal snapshot holds no line over 120 characters.

**Done when.** Both pass.

## K-88: `src` is refused where `src/**` is wanted

**What is wrong.** `isBareDirectory` in `policy/problems.ts:29` refuses a selector that names a
folder with no glob, and no command runs until it is fixed. `scopeProblems` (line 170) refuses a
scope inside a scope, so `packages/app` and `packages/app/native` cannot both be scopes.

**Target.** A selector that names a folder means everything under it. Scopes nest, and a file
belongs to the deepest scope that holds it.

**Files.** `policy/normalize.ts`, `policy/problems.ts`, `repository/scopes.ts`.

**Logic.** `normalize.ts` turns `src` and `src/` into `src/**` where the path is a folder of the
repository. `scopes.ts` sorts scopes by depth and assigns each file once.

**What goes.** `isBareDirectory` and its message.

**Tests.** Unit tests for the three spellings, and for a file under a nested scope.

**Done when.** Both pass.

## K-89: working words of the code reach a person

**What is wrong.** `layer` has a third meaning in `PolicyScopeLayer`. The words `slot`,
`surface`, `direction`, and `exposes` reach a person through the settings list and two messages.

**Target.** A message says setting, preset, scope, and default, the words of
[03-configuration.md](../03-configuration.md).

**Files.** `policy/merge.ts`, `policy/audit.ts`, `policy/messages.ts`, `output/list.ts`.

**Logic.** `PolicyScopeLayer` becomes `ScopeSettings`. The settings list prints three columns:
the key, its value, and where the value comes from. The message that says no selected preset `exposes` a key says that no
selected preset has the setting.

**What goes.** The four words in text a person reads. They stay where they are type names.

**Tests.** The message unit tests, and a test that no message function returns one of the words.

**Done when.** Both pass.

## K-116: a repository check cannot use the JSON format

**What is wrong.** `checkOutput` in `policy/schema.ts:145` lists `regex`, `grouped`,
`eslint-json`, `lines`, and `none`. The manifest schema also takes `json`.

**Target.** One output schema, used by manifests and by `[[check]]`.

**Files.** `presets/manifest-schema.ts`, `policy/schema.ts`.

**Logic.** `policy/schema.ts` imports the output schema of the manifest.

**What goes.** The second copy.

**Tests.** A config fixture with `format = "json"` loads.

**Done when.** That fixture loads.

**Complete, locally verified September 20, 2026.** Repository and preset checks use
one output schema, and `OutputFormat` is derived from it. A planted repository check uses
nested JSON output with field mappings and zero-based lines. It produces a finding with the
expected file, position, rule, and message. Published schemas are regenerated through their
owner. Broader output-parser validation remains with the first-fix requirements.

## K-215: one idea, many words in setting names

Closes K-215, K-224, and K-228.

**What is wrong.** A list a check skips ends in `_allowed`, `_excluded`, `allow`, or `exceptions`.
A folder is `_dir` or `_directory`, and a list of globs is `_glob`, `_paths`, or `_files`. A Vale
rule is turned off under `prose.disabled`, and every other rule through `[[ignore]]`. Two checks
have an off switch of their own, `tools.docs.readme_shape` and `tools.xcode.orphan_assets`. The name
`xcode/asset-catalogues` uses the British spelling.

Templates still name paths that D-127 moves, and the baseline folder that D-165 deletes.

**Target.** The table of D-144: a skipped list ends in `_allowed`, one folder in `_directory`, a
list of globs in `_files`. A rule of any tool is turned off through `[[ignore]]` alone.

**Files.** Twelve settings in the html, static-site, licenses, docs, xcode, and prose manifests,
`policy/schema.ts`, `presets/config-files/v8r.yml.tmpl`, `presets/formatting/prettierignore.tmpl`,
`presets/spelling/typos.toml.tmpl`, and the Semgrep pack of the bash preset.

**Logic.** Renames only, each in one commit with its readers, its tests, and its row of
[19-names.md](../19-names.md). The check becomes `xcode/asset-catalogs`. The Semgrep rule names of
the bash pack start with `gspot.bash.`. `docs/readme-present` asks for a license file at the
level `all` alone.

**What goes.** `prose.disabled`, the two off switches, and every old spelling.

**Tests.** A unit test over the manifests fails a setting name whose last part is outside the
table.

**Done when.** That test passes with no exception list.

## K-222: two tools set the YAML indent in opposite ways

**What is wrong.** `editorconfig.tmpl` fixes `[*.{yml,yaml}]` at 2. yamllint and Prettier take
`format.indent_width`, which is 4 by default. The editor writes what the gate refuses.

**Target.** One value, `format.indent_width`, for every tool that indents.

**Files.** `presets/formatting/editorconfig.tmpl`.

**Logic.** The YAML block leaves the template.

**What goes.** Four lines.

**Tests.** The snapshot of the formatting preset (T-36), and a unit test that reads the indent
each generated file sets and holds them equal.

**Done when.** That test passes.

## K-48: scopes from two workspace forms only

**What is wrong.** `repository/scopes.ts` reads npm and uv workspaces. The app has `api`,
`supabase`, and `ios`, and none is a workspace member. A per-scope file lands in one of two
places by the spelling of its path, in `run/scope-paths.ts` (A-11).

**Target.** `init` proposes a scope for every folder that holds a project file: `package.json`,
`pyproject.toml`, `Package.swift`, an Xcode project, or `supabase/config.toml` (D-108). Every
file of a scope sits under `.gspot/<scope>/`.

**Files.** `repository/scopes.ts`, `presets/manifest-schema.ts`, `emit/targets.ts`. The content of
`run/scope-paths.ts` moves into `repository/scopes.ts`.

**Logic.** The project file names come from `project_files` of the manifests (K-182), so the
scope reader names no preset. `scopeFile(scope, name)` is the one function that builds a path of
a scope file.

**What goes.** The second path form, and `run/scope-paths.ts`.

**Tests.** `init --yes` on a planted copy of the app layout proposes the three scopes with no
`--scope` flag.

**Done when.** That case passes.
