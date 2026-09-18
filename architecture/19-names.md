# Names

This document decides which names change and which meaning each word keeps (D-92). One word
carries one meaning in the code, the setting keys, the manifest keys, the flags, and the folders.
The rest of this folder already uses the names in the last column. The code, the presets, and the
manual follow in the hardening phase of [13-roadmap.md](13-roadmap.md). gspot has no release, so
a name changes in place and nothing keeps the old one. A row leaves this document in the commit
that applies it.

## Words with more than one meaning

| Id   | Word         | Meanings found                                                                                                                                                                                  | One meaning kept                                          | The others become                                                                                                                                             |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-1  | `emit`       | The folder `src/emit/`, which also holds `init`, `upgrade`, `uninstall`, takeover and carry. `commands/emit.ts`, which prints a command result. `emitAll` and `emitTarget`.                     | none                                                      | `src/generate/` with `generateAll` and `generateTarget`. `src/lifecycle/` for `init`, `upgrade`, `uninstall`, takeover and carry. `commands/print-result.ts`. |
| N-4  | `surface`    | `SettingsSurface`, the keys a selection exposes. `[runner] surface`, where tools and tasks are written.                                                                                         | the runner surface                                        | `SettingsCatalog`, `settingsCatalog()`                                                                                                                        |
| N-5  | `rules`      | The manifest key `rules` on a check, which names the check that reports its findings. The manifest table `[rules]`, which lists rule files. The policy table `[rules]`. A tool's `rules` table. | the policy table `[rules]` and a tool's own `rules` table | `reported_by` on a check. `[rule_files]` in a manifest.                                                                                                       |
| N-6  | `required`   | `requires`, the presets a preset needs. `[required]`, the inspections an extension must receive.                                                                                                | `requires`                                                | `[inspections]`                                                                                                                                               |
| N-14 | `coverage`   | `[coverage] strict`, which fails a file with no check. Test coverage.                                                                                                                           | test coverage                                             | `[inspection] strict`                                                                                                                                         |
| N-17 | `repository` | The preset kind. The repository.                                                                                                                                                                | the repository                                            | kind `concern`                                                                                                                                                |

## One idea under several names

| Id   | Idea                                   | Names found                                                                                                                                                         | One name                                                                                                                                                                                                                                                                                     |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-7  | A list of entries a gspot check skips  | `call_through_allowed`, `single_file_folder_allowed`, `allowed_default_fragments`, `trivial_exemptions`, `path_exceptions`, `architecture.allow`, `allowed_imports` | The key ends in `_allowed`: `structure.trivial_allowed`, `tools.docs.paths_allowed`, `tools.bash.default_fragments_allowed`, `architecture.edges_allowed`, `architecture.imports_allowed`. A tool's own option keeps the tool's word, such as `tools.knip.ignore` and `tools.typos.exclude`. |
| N-18 | A check that runs once over everything | `takes = "project"`, `whole = true`, and `if (input.scope !== '') return []` inside nine checks                                                                     | `runs = "per-file-list"`, `"per-scope"` or `"once"`                                                                                                                                                                                                                                          |
| N-3  | Where the logic of a command lives     | `policy/commands.ts`, `policy/set-command.ts`, `doctor/command.ts`, `emit/upgrade/command.ts`, `run/check.ts`, `emit/install.ts`                                    | `<area>/<verb>-command.ts`: `policy/ignore-command.ts`, `policy/add-command.ts`, `run/check-command.ts`, `lifecycle/init-command.ts`, `lifecycle/upgrade-command.ts`, `doctor/doctor-command.ts`                                                                                             |
| N-16 | The baseline folder                    | `.gspot/baseline/` beside `readBaselines`, `writeBaselines` and `--lower-baselines`                                                                                 | `.gspot/baselines/`                                                                                                                                                                                                                                                                          |

## Names that say the wrong thing

| Id   | Name                                                  | What it does                                                         | Name                                                        |
| ---- | ----------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| N-2  | `emit/install.ts`                                     | holds `initCommand`                                                  | `lifecycle/init-command.ts`                                 |
| N-2  | `emit/first-run.ts`                                   | installs the tools, runs the first check, writes the first baselines | `lifecycle/install-tools.ts` and `lifecycle/first-check.ts` |
| N-9  | `check --stage <stage>`                               | one letter from `--staged`, with another meaning                     | `check --at commit\|push\|manual\|message`                  |
| N-10 | `apply --baseline`                                    | lowers every baseline to the last run                                | `apply --lower-baselines`                                   |
| N-11 | `init --rules yes\|no`, `init --format keep\|shipped` | two flag styles beside `--no-install`                                | `--no-rules`, `--keep-format`, `--shipped-format`           |
| N-12 | `didWrite`                                            | writes a file and returns whether it changed                         | `writeIfChanged`                                            |
| N-12 | `didRunFixer`                                         | runs a fixer                                                         | `runFixer`                                                  |
| N-12 | `usesLefthook`                                        | returns the text of `lefthook.yml` with the gspot commands set       | `lefthookText`                                              |
| N-12 | `usesFor`                                             | returns the categories a reserved use covers                         | `categoriesFor`                                             |
| N-8  | the preset `vulnerabilities`                          | ships checks whose ids start with `security/`                        | the preset `security`                                       |

## Types that name nothing

| Id   | Type                      | Holds                                                                    | Name                                              |
| ---- | ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| N-13 | `Raw`                     | a parsed TOML table                                                      | `TomlTable`                                       |
| N-13 | `Compact`, declared twice | an object type with its undefined entries dropped                        | `Defined`, declared once                          |
| N-13 | `Prepared`                | the argv, the directory and the commands of one check                    | `PreparedCommand`                                 |
| N-13 | `Filtering`, `Filtered`   | the inputs and the verdicts of the ignore and baseline filter            | `FilterInputs`, `FilterVerdicts`                  |
| N-13 | `PlainValue`              | a written value with its reason                                          | `WrittenValue`                                    |
| N-13 | `Outcome`, `Result`       | what a spawn returned, what a command prints                             | `SpawnOutcome`, and `CommandResult`, which exists |
| N-13 | `ToolRun`                 | the findings and the failed flag gathered over the commands of one check | `ToolRunState`                                    |

## File names found twice

23 base names exist in two folders, which makes a file hard to open by name. These change:

| Today                                                            | Name                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `run/plan.ts`, `output/plan.ts`, `emit/init-plan.ts`             | `run/check-plan.ts`, `output/plan-text.ts`, `lifecycle/init-plan.ts`               |
| `policy/read.ts`, `presets/read.ts`                              | `policy/read-policy.ts`, `presets/read-manifests.ts`                               |
| `doctor/report.ts`, `naming/report.ts`, `emit/upgrade/report.ts` | `doctor/doctor-report.ts`, `naming/name-finding.ts`, `lifecycle/upgrade-report.ts` |
| `policy/validate.ts`, `naming/validate.ts`                       | `policy/validate-policy.ts`, `naming/validate-name.ts`                             |
| `commands/<verb>.ts` beside `<area>/<verb>.ts`                   | the command file keeps `commands/<verb>.ts`, and the logic file follows N-3        |

`engine.ts` once in each engine folder stays, because the folder names the engine. A file under
`config/` and a file under `types/` share a base name with their source folder on purpose.

## Names that stay

Long constants such as `COMMENT_STYLE_BY_EXTENSION` and `LINT_TOOL_PACKAGE_PREFIXES` say what
they hold and pass the naming policy. The plugin rule ids, such as
`header-comments-before-imports`, follow the ESLint convention of a full phrase. Check ids keep
the form `<family>/<name>`, and [04-presets.md](04-presets.md) states what the family is.
