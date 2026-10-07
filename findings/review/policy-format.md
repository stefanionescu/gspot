# The gspot.toml Policy Format

29 unresolved review records remain.

A read-only review wrote these findings on October 6, 2026, against commit `3e1445a2d`. The Existing column names an older record that covers the same problem.

1. The file has no canonical layout.
    - Three serializers write it (init, every edit command, export), toml-patch picks a shape from whatever already exists, and nothing ever re-sorts.
    - That alone explains the dotted keys at the top, the root inline table at line 71, and new blocks landing at the end.
    - Hand edits appended at the end did the rest.
2. The writer fights the TOML formatter that gspot itself ships. It writes `{a = 1}` and, for a new list, `[ "x" ]`; the shipped taplo settings want `{ a = 1 }` and `["x"]`. This repository hides the conflict with `tools.taplo.formatting` (gspot.toml:71).
3. One job has many keys.
    - About 25 settings skip a check or ignore findings for some paths, and the planner implements two of them generically.
    - Three keys allow a name.
    - Ten keys set coverage.
    - Fold each job into one mechanism: `[[ignore]]` for ignored findings, `[naming.allowed]` plus `[[naming.overrides]]` for names, one `[reasons]` table for loosened settings.
4. About 60 of the roughly 200 keys duplicate another key's job, and about 30 serve one tool, one language, or one repository's house style. A minimal policy needs 12 keys. See "Unneeded keys."
5. Real defects:
    - An empty `[hooks]` table is the on/off switch, so `gspot set hooks.push_files --default` turns hooks off.
    - `tools.<tool>.verbatim` is accepted, reason-checked, and listed for every tool but read for six.
    - List items of 40+ settings are never validated.
    - `naming.fixed_keys` drops entries for a repeated file.
    - A misspelled `architecture.roles` key is silently ignored.
6. Reasons are optional by default (`require_reasons = false`), and this repository does not turn them on, so none of its ~100 reasons is validated.
7. Recommendation: stay on TOML.
    - Use one table per concern, maps where an entry has a natural key, and arrays only for ordered or keyless records.
    - One canonical emitter writes every change, and a check with `--fix` keeps hand edits in shape.
    - Appendix B is this repository's file in that format, machine-checked to hold every current setting.

## Findings

| ID                         | Where                                                                                                                                                                                                                                                                       | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Kind     | Existing                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- |
| `review/policy-format/002` | packages/cli/src/config/parsers/toml.ts:35                                                                                                                                                                                                                                  | Edits write inline tables as `{a = 1}` (`bracketSpacing: false`). The shipped taplo settings (configurations/general/files/taplo.toml.tmpl:3-11) keep taplo's default `compact_inline_tables = false`, which formats `{ a = 1 }`; tests/tools/configurations/general/files.test.ts:94 pins that output. In a consumer repository, every `gspot set` that writes an inline table leaves gspot.toml failing `files/taplo-format`. This repository hides it with gspot.toml:71.                                                                                                                                                   | Write inline tables as `{ a = 1 }`, taplo's default (`bracketSpacing: true` in `config/parsers/toml.ts:35`). Delete `tools.taplo.formatting` at gspot.toml:71 and its reason, then run taplo format once over the tracked TOML so this repository follows the shipped settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | bug      |                                    |
| `review/policy-format/003` | packages/cli/src/parsers/toml/layout.ts:22-25,133-143                                                                                                                                                                                                                       | The 120-character limit (config/parsers/toml.ts:32) is not applied to inline tables. `isTooWide` measures each table inside an array, not the line, and `wrapArray` wraps arrays only. Replayed: two `gspot set tools.typos.words` calls produce a 220-character `tools.typos = {words = [...]}` line. gspot.toml:71 (144 characters) is writer output.                                                                                                                                                                                                                                                                        | `emitPolicy` (`review/policy-format/007`) never writes a root inline table: every table outside native tool options gets a `[table]` header, as rule 1 of the target format says. The width surgery in `parsers/toml/layout.ts` goes with `review/policy-format/006`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | bug      |                                    |
| `review/policy-format/005` | gspot.toml:544,661,889,996 (also 177/923, 374/875, 611/885, 607/954, 143/914, 564/991)                                                                                                                                                                                      | Seven tables are split across the file. toml-patch inserts a new element after the last sibling (replayed), so the split comes from hand edits appended at the end (for example commit 4ce293ae8), and nothing restores order. toml-patch's own `updateOrder` refuses non-contiguous tables and dotted-key parents (replayed: "its entries are not contiguous").                                                                                                                                                                                                                                                               | Re-emit the whole policy in canonical order on every write (`review/policy-format/007`, 'The writer'). Add a check `gspot/policy-layout` to the always-selected `gspot` configuration, beside `gspot/policy` and `gspot/drift` (`areas/kits/142` keeps that configuration as the home of gspot's own checks). It reports a gspot.toml that differs from `emitPolicy(text, parse(text))` and rewrites it with `--fix`, as `cargo sort --check` does for Cargo.toml. Run `gspot check --fix --only gspot/policy-layout` once to regroup this repository's gspot.toml.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | bug      |                                    |
| `review/policy-format/006` | packages/cli/src/parsers/toml/layout.ts:49-116; packages/cli/src/parsers/toml/patch.ts:7-76                                                                                                                                                                                 | About 230 lines of text surgery run after toml-patch: wide inline arrays are rewritten as `[[x]]` blocks at the end of their section, and the first table's comments are moved back. toml-patch already moves comments with their entries ("Comment Ownership" in its README) and reorders (`updateOrder`).                                                                                                                                                                                                                                                                                                                    | Once the emitter exists, delete `expandLongTables`, `buildBlocks`, `sectionEdits`, and the comment mover, and the tests that pin them (tests/cli/parsers/toml/layout.test.ts:42-80).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | library  |                                    |
| `review/policy-format/007` | packages/cli/src/commands/init/policy-text.ts:68-72; packages/cli/src/policy/edit.ts:48-61; packages/cli/src/policy/templates.ts:129                                                                                                                                        | Three serializers write one format: init (smol-toml, a regex, then wrapping), edits (toml-patch, a smol-toml seed, then wrapping), export (smol-toml only, so `[ "x" ]` and no wrapping). Two TOML libraries write one file.                                                                                                                                                                                                                                                                                                                                                                                                   | Write one `emitPolicy(previousText, policy)` in `policy/file.ts` (`review/code-commands/007`), as 'The writer' describes. Init, set, ignore, add, remove, apply, and export all call it, so an exported template has the same layout as gspot.toml and passes `files/taplo-format`. Delete the init regex (`commands/init/policy-text.ts:68-72`), the edit seed (`policy/edit.ts:52-56`), and the plain smol-toml `stringify` in `policy/templates.ts:129`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | merge    |                                    |
| `review/policy-format/008` | packages/cli/src/policy/edit.ts:81-98; packages/cli/src/commands/init/policy-text.ts:51-55; packages/cli/src/generation/hooks.ts:65; packages/cli/src/lifecycle/hooks-path.ts:44                                                                                            | Hooks are on while `[hooks]` exists, even empty (gspot.toml:99). `gspot set hooks.push_files --default` deletes the key, `deleteKey` then deletes the emptied table, and Git hooks turn off. `gspot set hooks.push_files all`, which docs/src/content/docs/guides/hooks.md:51 recommends, turns hooks on in a repository that chose `--no-hooks`. No command turns hooks on or off on purpose.                                                                                                                                                                                                                                 | Add `hooks.enabled` (boolean, default `false`), as `agent_rules.enabled` works (`parsers/schema/agent-rules.ts:6-9`). Init writes it from the hooks answer. `generation/hooks.ts:65`, `lifecycle/hooks-path.ts:44,84`, and `policy/edit.ts:92-97` read `hooks.enabled`; no code reads a table's presence as a switch. Change this repository's empty `[hooks]` (gspot.toml:99) to `enabled = true`. Update `docs/src/content/docs/guides/hooks.md:6,51` and `docs/src/content/docs/guides/runners.md:34`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | bug      | main/086 (related)                 |
| `review/policy-format/009` | packages/cli/src/policy/schema/tools.ts:16-18,148; packages/cli/configurations/language/python/manifest.toml:19-22,42-44                                                                                                                                                    | `tools.<tool>.verbatim` is accepted for every tool, needs a reason, is listed by `gspot list settings` (commands/list.ts:23-28), and is policed for refused options. Only six writers read it: ESLint (generation/eslint/configuration.ts:167-173), Prettier (generation/templates.ts:72), EditorConfig, typos (only its `type` key), ShellCheck, and knip. `[tools.ruff.verbatim]` and `[tools.basedpyright.verbatim]` have refused-option rules, yet ruff.toml.tmpl and basedpyrightconfig.json.tmpl never read them. Four tools (commitlint, yamllint, lychee, markdownlint) refuse `verbatim` outright (tools.ts:106-130). | Accept `verbatim` only for the tools whose writer reads it: ESLint, Prettier, EditorConfig, typos, ShellCheck, knip, and taplo, whose Eta source starts reading `tools.taplo.verbatim` in place of `tools.taplo.formatting`. Say so in the schema description. Refuse `verbatim` for every other tool, and delete the refused-option rules for `ruff` and `basedpyright` (`policy/schema/tools.ts:16-18,148`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | bug      |                                    |
| `review/policy-format/010` | packages/cli/src/parsers/schema/settings.ts:41; docs/src/content/reference/schema.ts:26,48                                                                                                                                                                                  | Every list a manifest declares is `z.array(z.unknown())`. Item shapes are never validated, and the published schema says `items: {}`. `[[docs.exclude]] path = "x"` (singular) passes. Consumers cast instead (`as PathAllowance[]` at checks/general/docs.ts:155 and checks/language/python/basedpyright.ts:14; `as AcceptedResult[]` at checks/general/security/codeql.ts:108). Editors cannot complete or flag these entries.                                                                                                                                                                                               | Fold the path lists that ignore findings into `[[ignore]]` (`review/policy-format/013` to `017`). For each list setting that stays, declare its item type in the manifest `[[setting]]` (a new `items` field: `string`, `path`, or a table of typed fields), and build the zod item schema from it in `parsers/schema/settings.ts:41`. The published schema then shows the item shape, and checks drop their casts (`areas/checks/012`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | bug      |                                    |
| `review/policy-format/011` | packages/cli/src/parsers/schema/naming.ts:21,45; packages/cli/configurations/general/naming/manifest.toml:71-75                                                                                                                                                             | `naming.fixed_keys` is the third way to allow a name, next to `naming.allowed` and `[[naming.paths]]` with `names` and `skip = true` (the shipped policy.json uses that form three times). The name lies: it allows any identifier in the file (checks/general/naming/problems.ts:29-32), not property keys. This repository uses it for a file name (`404`, gspot.toml:229-232) and for functions (`_malloc`).                                                                                                                                                                                                                | Delete it. Move each entry to a `[[naming.overrides]]` record (today `[[naming.paths]]`) with `paths` and an `allowed` list of the names (review/glossary/010).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | merge    |                                    |
| `review/policy-format/013` | packages/cli/src/execution/planning/files.ts:52-63; packages/cli/src/execution/planning/skips.ts:122-142                                                                                                                                                                    | The planner implements "drop these files from a check" twice: `[[ignore]]` paths by check ID, and `tools.<tool>.exclude` by tool name for every check that runs that tool. So `tools.lychee.exclude` silently covers both `docs/lychee` and `docs/lychee-external`. Checks also read their own lists (checks/general/docs.ts:155, checks/language/sql.ts:145,183, checks/language/python/basedpyright.ts:14).                                                                                                                                                                                                                  | Make `[[ignore]]` with `paths` the only per-check path skip (answer Q5). Delete the `tools.<tool>.exclude` settings of typos, jscpd, lychee, semgrep, knip, basedpyright, and sqlfluff, `withoutExcluded` (`execution/planning/files.ts:52-63`), the tool-name skips in `execution/planning/skips.ts:122-142`, and the list reads in `checks/language/sql.ts:145,183` and `checks/language/python/basedpyright.ts:14`. The generator writes each check's path-only `[[ignore]]` records into the tool's native exclude (typos `extend-exclude`, jscpd `ignore`, `.semgrepignore`, knip `ignore`, basedpyright `exclude`), so editors still see them. Move this repository's entries to `[[ignore]]` records, one per check (`tools.lychee.exclude` becomes `review/policy-exceptions/037`). `tools.prettier.exclude` is `review/policy-format/014`, and `docs.exclude` is `review/policy-format/015`.                                                                                                                                                     | merge    | areas/kits/099, main/129, main/085 |
| `review/policy-format/014` | packages/cli/configurations/general/format/prettierignore.tmpl:8; packages/cli/src/execution/planning/skips.ts:70-71; packages/cli/src/execution/planning/files.ts:56-60                                                                                                    | `tools.<tool>.exclude` has two item shapes under one name: Prettier takes ignore-line strings, every other tool takes `{paths, reason}` tables.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Prettier's lines become `[[ignore]] check = "format/prettier"` entries; the generator writes `.prettierignore` from them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | simplify |                                    |
| `review/policy-format/015` | packages/cli/src/checks/general/docs.ts:64,155-163                                                                                                                                                                                                                          | `docs.exclude` does two jobs: it skips Markdown files, and it accepts every mentioned path token that matches. The second entry here (gspot.toml:105-138) is 30 tokens such as `bash` and `./orders.js`, not files to skip. The first job is also done a second way in the same file (gspot.toml:670-673).                                                                                                                                                                                                                                                                                                                     | Delete `docs.exclude`. Skipped files go to `[[ignore]] check = "docs/stale-paths"` with `paths`. Mentioned example paths need no list: `docs/stale-paths` skips fenced code blocks that carry a `title=` attribute (review/docs-site/046).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | merge    | areas/kits/099 (first job only)    |
| `review/policy-format/016` | packages/cli/src/checks/general/security/codeql.ts:90-95,108; packages/cli/src/types/checks/general/security.ts:1                                                                                                                                                           | `tools.codeql.ignore` re-implements rule-plus-paths acceptance. packages/cli/src/execution/run.ts:184-188 already filters every check's findings by `[[ignore]]` check, rule, and paths. This repository carries five such entries (gspot.toml:844-873).                                                                                                                                                                                                                                                                                                                                                                       | Delete the setting, the filter, and `AcceptedResult`. Move the entries to `[[ignore]]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | delete   | areas/kits/100                     |
| `review/policy-format/017` | packages/cli/src/policy/schema/policy.ts:41,49-55; packages/cli/src/checks/general/structure/folder-names.ts:16-18                                                                                                                                                          | `structure.lone_files_allowed`, `prefix_collisions_allowed`, and `folder_names_allowed` are per-check path skips under their own names. Each finding already names a file under the folder (lone-files.ts:35, folder-names.ts:34, prefix-collisions.ts:78), and the path matcher expands a literal folder to everything under it (repository/selectors.ts `expandedPaths`). `[[ignore]]` therefore does the same job. `folder_names_allowed` reads the root table only, while `lone_files_allowed` reads the merged scope view.                                                                                                | Delete `structure.lone_files_allowed`, `structure.prefix_collisions_allowed`, and `structure.folder_names_allowed` (`policy/schema/policy.ts:41,49-55`) and their reads in the three structure checks; `[[ignore]]` with `paths` does the same job, because each finding names a file under the folder. In this repository, the 23 `folder_names_allowed` paths go when language names leave `BANNED_FOLDERS` (`areas/checks/060`), and the mirror-folder `lone_files_allowed` entries go when the one-file mirror folders are flattened (`review/policy-exceptions/013`, `review/tests-layout/019` to `021`). Move the rest to `[[ignore]]` records: `structure/lone-files` for `docs/src/pages/schema`, and `structure/prefix-collisions` for `docs/src/content.config.ts` (`review/policy-exceptions/009`), the markdown and docker configuration folders (`review/policy-exceptions/010` deletes the html one), and the ESLint plugin rule files. The `mise.toml` and `mise.test.toml` entry goes with `mise.test.toml` (review/repository-root/045). | merge    |                                    |
| `review/policy-format/018` | packages/cli/src/policy/schema/policy.ts:26-39; gspot.toml:374-501,875-883                                                                                                                                                                                                  | Every module is named twice, once in `[[architecture.modules]]` and once as `from` in `[[architecture.imports_allowed]]`. The `tool-output` row sits 400 lines away at the end. A row's `reason` is accepted but never read (generation/eslint/configuration.ts:95-98 reads `from` and `to`) and never checked (policy/problems/reasons.ts:135-142). The `reason` after a blank line at gspot.toml:470-471 belongs to the `tools` row: TOML ignores blank lines. `imports_allowed` with `from`/`to` reads backwards.                                                                                                           | One `[[architecture.modules]]` record per module: `name`, `paths`, `may_import`, `reason`. Delete `[[architecture.imports_allowed]]` and move each edge into the `may_import` list of its source module. Validate a module's `reason` like every other reason (`review/policy-format/021`). Keep the array form (rule 3 of the target format).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | merge    | areas/kits/094 (renames only)      |
| `review/policy-format/019` | docs/src/content/docs/guides/monorepos.md:29-30; docs/src/content/docs/guides/repository-checks.md:34-42; packages/cli/src/policy/edit.ts:152-160                                                                                                                           | `[[scope]]` and `[[check]]` are arrays, so a sub-table such as `[scope.limits]` or `[check.output]` silently attaches to the last entry above it. The docs have to warn about this. Both have a unique key: the path and the name.                                                                                                                                                                                                                                                                                                                                                                                             | Replace the `[[scope]]` and `[[check]]` arrays with maps keyed by path and by name, `[scope."<path>"]` and `[check."<name>"]`, in the schema (`policy/schema/policy.ts`), in `emitPolicy`, init, and export. A sub-table then names its owner: `[scope."api".limits]`. Delete the `[[scope]]` handling at `policy/edit.ts:152-160`. Rewrite the examples in `docs/src/content/docs/guides/monorepos.md:29-30` and `docs/src/content/docs/guides/repository-checks.md:34-42`, and delete their warnings about sub-tables.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | simplify |                                    |
| `review/policy-format/020` | packages/cli/src/policy/schema/fields.ts:10-25; packages/cli/src/policy/schema/configurations.ts:9,33-48                                                                                                                                                                    | Every setting accepts `T` or `{value = T, reason = "..."}`. For a table setting the wrapper is ambiguous: a native option named `value` or `reason` cannot be written. The JSON schema doubles every leaf (docs/src/content/reference/schema.ts:26,48), and the wrapper produced gspot.toml:71.                                                                                                                                                                                                                                                                                                                                | Delete the `{value, reason}` wrapper: `reasoned()` in `policy/schema/fields.ts:10-25` and its uses in `policy/schema/configurations.ts:9,33-48`. Values stay plain. Add a `[reasons]` table keyed by setting name (`"tools.taplo.verbatim" = "..."`); a scope's reasons go in `[scope."<path>".reasons]`. Validation requires a reason in `[reasons]` for each loosened setting and refuses a `[reasons]` key for a setting the policy does not write. `gspot set --reason` (`commands/set.ts:78-85`) writes the reason into `[reasons]`. The JSON schema then lists each leaf once (`docs/src/content/reference/schema.ts:26,48`).                                                                                                                                                                                                                                                                                                                                                                                                                       | simplify |                                    |
| `review/policy-format/021` | packages/cli/src/policy/schema/policy.ts:200-203; packages/cli/src/commands/init/policy-text.ts:13-21; packages/cli/src/policy/schema/policy.ts:91                                                                                                                          | Reasons are optional by default: `require_reasons` is false, init never writes it, and this repository does not set it. None of the ~100 reasons in gspot.toml is validated (two-word minimum, placeholders). The guide's first example sets it to true (docs/src/content/docs/guides/policy.md:29).                                                                                                                                                                                                                                                                                                                           | Delete `require_reasons`. Always require a reason on every ignore and every loosened setting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | decision |                                    |
| `review/policy-format/022` | packages/cli/src/policy/schema/policy.ts:33                                                                                                                                                                                                                                 | `architecture.roles` accepts any key (`.catchall`). Only `tests`, `types`, `config`, `test_support`, `runtime`, and `env` are read (generation/eslint/configuration.ts:38-50, config/eslint.ts:29, checks/general/structure/config-logic.ts:92, checks/language/bash/env-owner.ts:15). A misspelled role such as `runtimes` does nothing and raises nothing.                                                                                                                                                                                                                                                                   | Make `architecture.roles` a strict object (`policy/schema/policy.ts:33`): accept the six roles read today (`tests`, `types`, `config`, `test_harness`, which is `test_support` today, `runtime`, `env`) and the roles that selected configurations declare (Path-role lists: `scripts`, `stores`). Refuse any other key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | bug      |                                    |
| `review/policy-format/023` | docs/src/content/docs/guides/monorepos.md:60; docs/src/content/docs/guides/policy.md:160                                                                                                                                                                                    | Paths in a scope have two bases: relative to the repository root, except for settings whose description says scope-relative (`tools.eslint.runtimes`; `architecture.modules` per generation/eslint/configuration.ts:83). The reader has to look up each key.                                                                                                                                                                                                                                                                                                                                                                   | Make every path written inside `[scope."x"]` relative to `x`. In `normalizeScopeTables` (`policy/normalize.ts:158`), prefix each path setting of a scope table with the scope path (a setting whose manifest item type is `path`, `review/policy-format/010`), so every reader gets repository-relative paths. Delete the scope-relative special cases in the readers: `tools.eslint.runtimes`, `architecture.modules` (`generation/eslint/configuration.ts:83`), and `architecture.roles.test_support` (`policy/settings/entries.ts:293-302`). Rewrite this repository's scope paths in gspot.toml to the new base. State the one rule in `docs/src/content/docs/guides/monorepos.md:60` and `docs/src/content/docs/guides/policy.md:160`.                                                                                                                                                                                                                                                                                                               | decision |                                    |
| `review/policy-format/024` | packages/cli/configurations/general/security/manifest.toml:107,114,121; packages/cli/configurations/tool/vitest/manifest.toml:48,55; packages/cli/configurations/general/secrets/manifest.toml:168,175                                                                      | The partial move from `tools.<x>` to `<configuration>.<x>` left one tool under two roots: `semgrep.rule_files` next to `tools.semgrep.*`, and `vitest.config_file` next to `tools.vitest.coverage.*`. The `secrets` configuration owns an `env.*` root.                                                                                                                                                                                                                                                                                                                                                                        | Give each tool one root: `[tools.<tool>]` holds a tool's native options, and `[<configuration>]` holds gspot's own rules, never both for one tool. Move `semgrep.rule_files` to `tools.semgrep.rule_files` (`configurations/general/security/manifest.toml:107,114,121`). Delete `vitest.config_file` (`configurations/tool/vitest/manifest.toml:48,55`); Vitest's own config lookup decides. Move `env.templates` (renamed `secrets.env_examples`, review/glossary/023) and `env.reader_functions` under `[secrets]` (`configurations/general/secrets/manifest.toml:168,175`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | simplify | areas/kits/085                     |
| `review/policy-format/026` | gspot.toml:626-659; packages/cli/src/policy/schema/tools.ts:98-101                                                                                                                                                                                                          | Seven `[[licenses.exceptions]]` blocks are keyed by a unique `package@version`. `licenseSettingsSchema` extends the tool table, so `[licenses]` accepts `verbatim` and any key at parse time, and the published schema advertises `licenses.verbatim`; the setting check rejects it later.                                                                                                                                                                                                                                                                                                                                     | `[licenses.exceptions."<package@version>"]` with `license` and `reason`. Make the licenses schema a strict object of `allowed` and `exceptions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | simplify |                                    |
| `review/policy-format/027` | gspot.toml:564-575,991-995                                                                                                                                                                                                                                                  | `[[tools.knip.ignore_dependencies]]` entries are keyed by a unique package pattern, yet are written as a list in two places.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `[tools.knip.ignore_dependencies]` map: pattern = reason, or a sub-table with `workspace` and `reason`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | simplify |                                    |
| `review/policy-format/028` | packages/cli/src/policy/schema/policy.ts:92-95                                                                                                                                                                                                                              | `until` must be a quoted string. smol-toml reads a native TOML date (`until = 2026-10-17`, the form osv-scanner documents for `ignoreUntil`) as a Date object, which `z.iso.date()` refuses.                                                                                                                                                                                                                                                                                                                                                                                                                                   | Accept TOML local dates and write them unquoted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | bug      |                                    |
| `review/policy-format/029` | packages/cli/src/policy/schema/policy.ts:205-208; packages/cli/src/generation/eslint/configuration.ts:38-41; gspot.toml:504-510                                                                                                                                             | Two keys name test files: root `tests` (linters relax rules) and `architecture.roles.tests` (import direction). The role has no fallback to `tests`, so a repository writes both.                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rename root `tests` to `test_files`; let `roles.tests` default to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | simplify |                                    |
| `review/policy-format/030` | packages/cli/src/commands/init/policy-text.ts:58-62; packages/cli/src/parsers/schema/agent-rules.ts:10                                                                                                                                                                      | Init writes `folder = ".gspot/rules"`, which is the schema default. Every new policy starts with a line that changes nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Write only values that differ from the default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | simplify |                                    |
| `review/policy-format/031` | packages/cli/src/policy/schema/policy.ts:41-55; packages/cli/src/parsers/schema/naming.ts:26-45; packages/cli/src/parsers/schema/settings.ts:12; packages/cli/configurations/general/docs/manifest.toml (`docs.license`); packages/cli/src/parsers/schema/agent-rules.ts:11 | Unclear names: `naming.paths` is named after its selector, and its `skip` says nothing about what is skipped; `naming.groups_off` uses "off" for "dropped"; `run_with` is a verb phrase; `docs.license` reads like a license ID; `agent_rules.project_folder` uses "project", which means a package with a project file elsewhere.                                                                                                                                                                                                                                                                                             | Rename `[[naming.paths]]` to `[[naming.overrides]]` and replace its `names` plus `skip = true` with one `allowed` list (review/glossary/010), in gspot.toml, the shipped `naming/policy.json`, and the manifest `[[naming.paths]]` blocks. Rename `run_with` to `runner`, `docs.license` to `docs.require_license`, and `agent_rules.project_folder` to `agent_rules.own_rules_folder`. Delete `naming.groups_off` instead of renaming it: no group is removable (`review/owner-decisions/003`). Appendix A lists every key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | rename   |                                    |
| `review/policy-format/032` | docs/src/config/reference.ts:73,80; docs/src/content/docs/guides/hooks.md:6                                                                                                                                                                                                 | The reference example for `[hooks]` shows only `push_files`; nothing in it says the table's presence turns hooks on. The reference writes `{ allow = ["warn"] }`, while `gspot set` writes `{allow = ["warn"]}`.                                                                                                                                                                                                                                                                                                                                                                                                               | After `review/policy-format/008` and `review/policy-format/002` land, rebuild the examples in `docs/src/config/reference.ts:73,80` from the text `emitPolicy` emits: the `[hooks]` example shows `enabled = true` and `push_files`, and inline tables are written `{ allow = ["warn"] }`. Say in `docs/src/content/docs/guides/hooks.md:6` that `hooks.enabled` turns hooks on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | docs     |                                    |
| `review/policy-format/033` | gspot.toml:577; gspot.toml:142-143,625-626,668-669,921-922                                                                                                                                                                                                                  | `# The shipped agent rules are this repository's product.` sits above `[[structure.folder_names_allowed]]` and describes nothing below it. Blank lines vary: none before lines 143 and 626, two at 668-669 and 921-922.                                                                                                                                                                                                                                                                                                                                                                                                        | Delete the comment. The emitter writes exactly one blank line before every header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | delete   |                                    |

## TOML in plain words, and why gspot.toml uses each form

**`[table]`** is a header that opens a named section. Every `key = value` line below it belongs to that section until the next header. gspot.toml has 8: `[hooks]`, `[architecture.roles]`, `[tools.eslint]`, `[tools.eslint.rules]`, `[tools.commitlint]`, `[tools.knip]`, `[prose]`, `[tools.codeql]`.

**`[[array of tables]]`** adds one more record to a list each time the header appears. The lines below fill that record. gspot.toml has 104 such headers across 17 lists. They exist because the schema stores most things as lists of records (`z.array(z.object(...))`), and `[[x]]` is TOML's way to write a list of records across several lines. A record has no name, so two records cannot be told apart except by position.

**Dotted keys** such as `licenses.allowed = [...]` are the same as `[licenses]` followed by `allowed = [...]`. gspot.toml has four at the top (lines 28, 29, 43, 71). They come from the writer. When a table exists only because a deeper header created it (`[[licenses.exceptions]]` creates `licenses`), toml-patch writes a new key of that table as a root dotted key. The review replayed this for `naming.banned`, `licenses.allowed`, and `tools.taplo`.

**Inline tables** such as `{files = [...]}` write a whole table between braces. In TOML 1.0 they must stay on one line, except inside an array value. gspot.toml has three: line 71 (written by `gspot set --reason`, which wraps the value as `{value, reason}`), line 521 (`import_extensions`), and line 532 (native ESLint options).

### What `fixed_keys` means

The manifest says "Property keys a protocol or format fixes, exempt in one named file." In practice it is a list of names, of any kind, that the naming check accepts in one exact file: `[[naming.fixed_keys]] file = "x.ts" names = ["C"]`. It is a narrower copy of `[[naming.paths]] paths = ["x.ts"] names = ["C"] skip = true`.

## Who writes gspot.toml, and why entries land where they do

The writers:

- `gspot init`: `proposeText` (`commands/init/policy-text.ts:105-112`) builds an object and serializes it with smol-toml `stringify`. A regex removes the spaces smol-toml puts inside arrays (`:69`), then `wrapLongArrays` wraps long arrays. It writes `[hooks]` as an empty table when hooks are chosen (`:51-52`).
- `gspot set`, `ignore`, `add`, `remove`, and `apply`: all go through `proposePolicy` (`policy/edit.ts:48-61`).
    - It parses with smol-toml and runs the mutation.
    - It appends any brand-new top-level list to the end of the text with smol-toml `stringify` (`:52-56`).
    - It patches the text with toml-patch (`patchToml`, `parsers/toml/patch.ts:43-76`, format `{inlineTableStart: 2, bracketSpacing: false, trailingComma: false}`).
    - Then it runs `wrapLongArrays`, which also turns a too-wide inline list of tables into `[[x]]` blocks at the end of its section (`parsers/toml/layout.ts:96-116`).
- `gspot export`: `exportTemplate` (`policy/templates.ts:101-130`) serializes with smol-toml `stringify` only.
- `gspot set --reason` on a non-list wraps the value as `{value, reason}` (`commands/set.ts:78-85`).
- `gspot ignore` merges into an existing entry with the same check, rule, reason, and until (`commands/ignore.ts:26-40`).

Why entries land where they do. The review replayed each case with toml-patch 3.0.5 and the repository's own `patchToml` and `wrapLongArrays` (scripts under the scratchpad `exp/` folder):

| Case                                                         | What happens                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| First `[[ignore]]` (or `[[check]]`, `[[generated]]`)         | Appended to the end of the file, with `paths = [ "x" ]` spacing.                                                    |
| Another `[[ignore]]` when some exist                         | Inserted after the last existing `[[ignore]]`. If that one is at the end, the new one is too.                       |
| A key under a table that exists only through a deeper header | Written as a root dotted key (`naming.banned`, `licenses.allowed`, `tools.taplo`).                                  |
| A key under a table that does not exist                      | A new `[table]` at the end of the file (`[dependencies]`, `[naming]`).                                              |
| A reason added to an existing record                         | Placed directly under the record's last key. The blank line before `reason` at gspot.toml:470-471 is a hand edit.   |
| A wide inline list of tables                                 | Rewritten as `[[x]]` blocks at the end of its section. A wide inline table with no list inside is left on one line. |
| Reordering                                                   | Never done. toml-patch's `updateOrder` refuses tables whose entries are not contiguous.                             |

Most of the scattering in this repository comes from hand edits appended at the end. For example, commit 4ce293ae8 added `[[ignore]]`, `[[naming.fixed_keys]]`, `[[naming.allowed]]`, `[[structure.lone_files_allowed]]`, the `tool-output` import row, and a knip entry at the bottom. The writer has no canonical order and no check, so nothing pulls them back.

The empty `[hooks]` at line 99 is init's way to say "hooks on" (`policy-text.ts:51-52`). `tools.taplo = {formatting = {value = {...}, reason = "..."}}` at line 71 is `gspot set tools.taplo.formatting '{"compact_inline_tables":true}' --reason "..."`: set wraps the value with its reason, and toml-patch writes it as a root dotted inline table because `tools` exists only through `[tools.eslint]`.

## One mechanism per job

### (a) Skip a check or a rule for some paths, or ignore findings

| Mechanism                                                                                                                                                                                                                | Read by                                               | Job                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------- |
| root `exclude`                                                                                                                                                                                                           | inventory                                             | Never read these paths                |
| `[[generated]]`, `[[vendored]]`                                                                                                                                                                                          | inventory                                             | Not authored source                   |
| `[[ignore]]` with `paths`                                                                                                                                                                                                | planner (skips.ts:122), finding filter (run.ts:184)   | Skip a check for paths                |
| `[[ignore]]` with `rule`                                                                                                                                                                                                 | finding filter, ESLint blocks, `rulesOff`             | Ignore one rule                       |
| `tools.<tool>.exclude` for typos, jscpd, lychee, semgrep, knip, basedpyright, sqlfluff                                                                                                                                   | planner by tool name (files.ts:54), templates, checks | Skip a tool for paths                 |
| `tools.prettier.exclude`                                                                                                                                                                                                 | `.prettierignore`                                     | Same, as ignore lines                 |
| `docs.exclude`                                                                                                                                                                                                           | docs/stale-paths                                      | Skip files, and allow mentioned paths |
| `structure.lone_files_allowed`, `prefix_collisions_allowed`, `folder_names_allowed`                                                                                                                                      | three structure checks                                | Skip a check for folders              |
| `tools.codeql.ignore`                                                                                                                                                                                                    | CodeQL check                                          | Ignore a rule for paths               |
| `tools.trivy.ignore`                                                                                                                                                                                                     | `.trivyignore`                                        | Ignore an ID                          |
| `tools.gitleaks.allowed`, `tools.gitleaks.baseline_reasons`                                                                                                                                                              | gitleaks                                              | Ignore values or fingerprints         |
| `dependencies.ranges_allowed`, `drizzle.raw_sql_allowed`, `html.literals_allowed`, `tools.xctest.sleep_allowed`, `tools.pip.installs_allowed`, `supabase.admin_key_files`, `bash.safety_owners`, `bash.defaults_allowed` | one check each                                        | Let these paths break one rule        |
| `tools.ruff.rules_off_in_tests`                                                                                                                                                                                          | ruff template                                         | Rules off in test files               |
| `[[naming.paths]]` with `skip = true`                                                                                                                                                                                    | naming checks                                         | Allow names in paths                  |
| `[[check]] ignore_file`                                                                                                                                                                                                  | planner (skips.ts:65-77)                              | A native ignore file for one check    |

That is about 25 ways. Proposal: **inventory** stays `exclude`, `[[generated]]`, `[[vendored]]`. **Every ignore** is one `[[ignore]]` record: `check`, optional `rule`, optional `paths`, `reason`, optional `until`. The generator writes path-only ignores into each tool's native exclude so editors agree. The finding filter that already exists (`run.ts:184-188`) does the rest.

### (b) Allow a name or a word

`naming.allowed`, `naming.fixed_keys`, `[[naming.paths]]` with `names` and `skip`, `naming.groups_off`, `tools.typos.words`, `prose.vocabulary`, `structure.python.singletons_allowed`, `tools.purgecss.safelist`, `tools.knip.ignore_dependencies`, `tools.swiftlint.keep_imports`, `bash.entry_functions`: 11 keys. Proposal: identifiers use `[naming.allowed]` (name = reason, everywhere) and `[[naming.overrides]]` (an `allowed` list of names for some paths, review/glossary/010). Words in text use one root `[words]` map that feeds typos and Vale (review/glossary/011). Names a native tool needs in its own file stay under that tool as a map keyed by name (`[tools.knip.ignore_dependencies]`, `[tools.purgecss.safelist]`).

### (c) Configure a native tool

Today: declared `tools.<tool>.<key>` settings; `tools.<tool>.rules` for five tools; `tools.eslint.overrides` and `format.overrides`; `tools.<tool>.verbatim` (read for six tools); `tools.taplo.formatting` and `tools.editorconfig.verbatim` as declared settings that repeat the `verbatim` job; `[format]` and `[limits]` fanned out to many tools; the `{value, reason}` wrapper. Proposal: `[tools.<tool>]` holds the options gspot declares, `rules` holds rule options, `[[tools.<tool>.overrides]]` holds path-selected options, and `verbatim` holds the rest, only for tools whose writer reads it. Cross-tool choices stay in `[format]` and `[limits]`. Reasons for loosened settings go in `[reasons]`.

## How established tools shape the same kind of file

| Tool                              | Shape                                                                                                                                   | Source                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ruff                              | `[lint.per-file-ignores]` map: glob = list of rules; brace globs group paths; `exclude` and `extend-exclude` lists.                     | <https://docs.astral.sh/ruff/settings/#lint_per-file-ignores>                   |
| Biome                             | `overrides`: an ordered array of `{includes, linter, formatter}`; rules as `linter.rules.<group>.<rule>` = level or `{level, options}`. | <https://biomejs.dev/reference/configuration/>                                  |
| ESLint flat config                | An ordered array of `{files, ignores, rules}`; `globalIgnores`.                                                                         | <https://eslint.org/docs/latest/use/configure/configuration-files>              |
| golangci-lint                     | `linters.exclusions.rules`: a list of `{path, linters, text}`; `exclusions.paths`. No reason field.                                     | <https://golangci-lint.run/docs/linters/false-positives/>                       |
| typos                             | `[default.extend-words]` map: word = correction; `[files] extend-exclude` list; `[type.<name>]` tables.                                 | <https://github.com/crate-ci/typos/blob/master/docs/reference.md>               |
| lychee                            | `exclude` (URL regex list) and `exclude_path` (path regex list).                                                                        | <https://lychee.cli.rs/guides/config/>                                          |
| markdownlint                      | One map: rule name = `false` or option table.                                                                                           | <https://github.com/DavidAnson/markdownlint>                                    |
| SwiftLint                         | `disabled_rules`, `opt_in_rules`, `included`, `excluded` lists; one key per rule; nested files per folder.                              | <https://realm.github.io/SwiftLint/>                                            |
| Cargo `[lints]`                   | `[lints.<tool>]` map: lint = level, or `{level, priority}`.                                                                             | <https://doc.rust-lang.org/cargo/reference/manifest.html#the-lints-section>     |
| cargo-deny                        | `[advisories] ignore = ["ID", { id = "ID", reason = "..." }]`; optional `expiry`.                                                       | <https://embarkstudios.github.io/cargo-deny/checks/advisories/cfg.html>         |
| osv-scanner                       | `[[IgnoredVulns]]` with `id`, `ignoreUntil` (a native TOML date), `reason`.                                                             | <https://google.github.io/osv-scanner/configuration/>                           |
| mise                              | One table per concern: `[tools]` map (tool = version or table), `[env]`, `[tasks.<name>]`.                                              | <https://mise.jdx.dev/configuration.html>                                       |
| Trunk (a meta-linter, like gspot) | One `lint.ignore` list of `{linters, paths}` for every linter; reasons go in `trunk-ignore(...): reason` comments.                      | <https://docs.trunk.io/code-quality/overview/linters/ignoring-issues-and-files> |
| MegaLinter                        | Flat per-linter variables such as `JAVASCRIPT_ES_FILTER_REGEX_EXCLUDE`, `DISABLE_LINTERS`.                                              | <https://megalinter.io/latest/config-file/>                                     |
| pre-commit                        | Top-level `exclude` regex, `repos` list, per-hook `exclude`.                                                                            | <https://pre-commit.com/>                                                       |
| Deno                              | One object per tool: `lint.{include, exclude, rules.{tags, include, exclude}}`, `fmt.{...}`, top-level `exclude`.                       | <https://docs.deno.com/runtime/reference/deno_json/>                            |
| Renovate                          | `packageRules`: an ordered array of matchers plus settings; `ignorePaths`.                                                              | <https://docs.renovatebot.com/configuration-options/>                           |
| Taplo formatter                   | Defaults: `compact_inline_tables = false`, `reorder_keys = false`.                                                                      | <https://taplo.tamasfe.dev/configuration/formatter-options.html>                |
| TOML                              | 1.0: inline tables on one line; out-of-order tables "discouraged". 1.1: multi-line inline tables with trailing commas.                  | <https://toml.io/en/v1.0.0>, <https://toml.io/en/v1.1.0>                        |
| cargo-sort                        | A check with a fix that keeps Cargo.toml in canonical order.                                                                            | <https://github.com/orhun/cargo-sort>                                           |

The common patterns:

1. One table per tool or concern, with its header written once (mise, Deno, Cargo, typos, Ruff).
2. A map when entries have a natural key: rules (Cargo, markdownlint, Biome), globs to rules (Ruff), words (typos), tools (mise).
3. An array of records only when order matters (ESLint, Biome, Renovate) or entries have several fields and no natural key (golangci-lint, Trunk, osv-scanner).
4. Reasons appear only in security ignore lists (cargo-deny, osv-scanner), as a field beside the ID. Linters put reasons in inline suppression comments.
5. Expiry is a native date (osv-scanner `ignoreUntil`) or a duration (cargo-deny `expiry`).
6. A meta-linter that drives many tools keeps one ignore list for all of them (Trunk `lint.ignore`). MegaLinter's per-linter variables are the flag sprawl to avoid.

In summary, the `[[...]]` blocks in gspot.toml are right for keyless ignore records, as in osv-scanner and Trunk. They are wrong for words, packages, modules, scopes, and checks, which all have natural keys. Having 17 different lists for one job is not something production tools do.

## The target format

Rules:

1. **One table per concern, header written once.** No dotted keys at the top. No root inline tables.
2. **A map when entries have a natural key.** The value is the reason string, or, when the entry has more than a reason, a sub-table: `[licenses.exceptions."axe-core@4.13.0"]` with `license` and `reason`. Inline tables appear only inside native tool options.
3. **An array of records only when order matters or no key exists:** `[[ignore]]`, `[[generated]]`, `[[vendored]]`, `[[architecture.modules]]`, `[[naming.overrides]]`, `[[format.overrides]]`, `[[tools.<tool>.overrides]]`.
4. **One ignore list.** Every ignore is an `[[ignore]]` record (`check`, `rule`, `paths`, `reason`, `until`), sorted by check, rule, and first path, at the end of the file. One record per reason: adding a path to an existing ignore adds a line to `paths`, not a header.
5. **Reasons are always required.** Ignore records carry `reason`. A loosened setting has its reason in `[reasons]`, keyed by the setting name. `until` is a native TOML date.
6. **Maps instead of arrays where the key is unique:** `[scope."<path>"]`, `[check."<name>"]`, `[naming.allowed]`, `[naming.reserved]`, `[licenses.exceptions]`, `[words]`, `[tools.knip.ignore_dependencies]`, `[tools.purgecss.safelist]`, `[tools.v8r.schemas]`.
7. **Switches are booleans:** `hooks.enabled`, `agent_rules.enabled`; CI is on when `ci.provider` is set.
8. **`[tools.<tool>]` stays,** for that tool's native options only.
9. **Paths inside `[scope."x"]` are relative to `x`.**

Canonical order: root keys (`level`, `configurations`, `removed_configurations`, `runner`, `test_files`, `exclude`, `tool_timeout_seconds`); `[scope."…"]` by path; `[hooks]`, `[ci]`, `[agent_rules]`; `[format]`, `[limits]`, `[naming]`, `[architecture]`, `[structure]`, `[dependencies]`, `[docs]`, `[licenses]`, `[prose]`, `[words]`, other configuration tables by name; `[tools.<tool>]` by tool; `[reasons]`; `[[generated]]`, `[[vendored]]`; `[check."…"]` by name; `[[ignore]]`. Inside a table, plain keys come first, then sub-tables by key. Map keys are sorted. Lists keep the order they were written in.

### The writer

- One `emitPolicy(previousText, policy)` in `policy/`, used by init, set, ignore, add, remove, apply, and export. It builds the canonical object (sorted maps, sorted `[[ignore]]`, merged identical ignores, defaults left out) and patches the previous text with toml-patch `{updateOrder: true, bracketSpacing: true, trailingComma: false}`. toml-patch then moves comments with their entries.
- When the previous text is not contiguous (a hand edit), the first write re-emits the whole file. It carries each comment block to the key or header it sat above. After that, `updateOrder` works.
- A `gspot` check that reports when gspot.toml differs from `emitPolicy(text, parse(text))`, fixed by `--fix`.
- Delete: the seed step (`edit.ts:52-56`), the init regex (`policy-text.ts:69`), `expandLongTables`, `buildBlocks`, `sectionEdits`, the comment mover in patch.ts, and smol-toml `stringify` in every writer.
- Spacing matches taplo's defaults, so `files/taplo-format` never reports a file gspot just wrote.

### TOML, YAML, or JSONC

Stay on TOML.

- The problems above come from the schema and the writer, not from TOML.
- Ruff, Cargo, mise, typos, lychee, osv-scanner, cargo-deny, uv, and taplo all use TOML for this kind of file.
- Every gspot manifest is TOML, and the `#:schema` line already gives editors completion.
- YAML adds implicit typing and indentation errors to a file people edit by hand. JSONC has no native date and is noisier for maps of reasons.
- smol-toml 1.9 and toml-patch 3.0.5 already read TOML 1.1. The multi-line inline tables of TOML 1.1 let an `[[ignore]]` record become one map entry.
- Taplo 0.10, which gspot pins and the common VS Code TOML extension uses, rejects the 1.1 syntax. For that reason, design for TOML 1.0 now; revisit when the editor tooling accepts 1.1.

The review considered `[ignore."<check>"]` maps keyed by path or rule, as the brief suggested. They collide in this repository's own data. One rule needs two reasons for two files (`js/incomplete-sanitization`, `gspot.javascript.no-dynamic-require`), two advisories have no path, and groups of up to 24 paths share one reason. The way around that is four header levels or a repeated reason per path. One sorted `[[ignore]]` list is simpler, and it matches osv-scanner and Trunk.

## Unneeded keys

The policy accepts about 200 keys: 175 declared by configuration manifests and about 25 in the schema itself. Appendix A marks each key:

- **minimal**: every policy may need it.
- **fact**: describes the repository when detection cannot find it.
- **choice**: a shared policy choice with a shipped default.
- **dup**: duplicates another key's job.
- **special**: exists for one tool, one language, one runtime, or one repository's house style.

### What a minimal policy needs

Twelve keys: `level`, `configurations`, `runner`, `[scope."<path>"] configurations` (monorepos only), `hooks.enabled`, `ci.provider`, `agent_rules.enabled`, `exclude`, `[[generated]]`, `[[vendored]]`, `[[ignore]]`, and `[reasons]`. Everything else has a shipped default, so a repository writes it only to state a fact gspot cannot detect or to change a shared choice. Appendix C shows what init writes in that shape.

### Duplicates: delete, and fold into the named key (about 60)

| Keys                                                                                                                                                                                                                                                       | Folds into                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `require_reasons`                                                                                                                                                                                                                                          | Always on                                                                                                                                                                                                                                                              |
| `tools.typos.exclude`, `tools.jscpd.exclude`, `tools.lychee.exclude`, `tools.semgrep.exclude`, `tools.knip.exclude`, `tools.basedpyright.exclude`, `tools.sqlfluff.exclude`, `tools.prettier.exclude`, `docs.exclude` (first job), `[[check]] ignore_file` | `[[ignore]]` with `paths`                                                                                                                                                                                                                                              |
| `structure.lone_files_allowed`, `structure.prefix_collisions_allowed`, `structure.folder_names_allowed`                                                                                                                                                    | `[[ignore]]` for the structure check                                                                                                                                                                                                                                   |
| `tools.codeql.ignore`, `tools.trivy.ignore`, `tools.gitleaks.allowed`, `tools.gitleaks.baseline_reasons`                                                                                                                                                   | `[[ignore]]` with `rule` (areas/kits/100, 101)                                                                                                                                                                                                                         |
| `dependencies.ranges_allowed`, `drizzle.raw_sql_allowed`, `html.literals_allowed`, `tools.xctest.sleep_allowed`, `tools.pip.installs_allowed`, `supabase.admin_key_files`, `bash.safety_owners`, `bash.defaults_allowed`, `tools.ruff.rules_off_in_tests`  | `[[ignore]]` with `rule` and `paths`. Each of these checks must report the offending file; change any check that does not before you move its entries                                                                                                                  |
| `structure.python.singletons_allowed`                                                                                                                                                                                                                      | `[[ignore]]` with `paths` (answer Q5; `areas/kits/095` now deletes the setting)                                                                                                                                                                                        |
| `naming.fixed_keys`                                                                                                                                                                                                                                        | `[[naming.overrides]]` with an `allowed` list                                                                                                                                                                                                                          |
| `naming.swift.max_chars`, `naming.swift.max_words`, `naming.sql.max_chars`, `naming.sql.max_words`                                                                                                                                                         | The generic `naming.<language>.*` form; delete their separate declarations                                                                                                                                                                                             |
| `architecture.imports_allowed`                                                                                                                                                                                                                             | `may_import` on each module                                                                                                                                                                                                                                            |
| `architecture.roles.tests` (as a second list)                                                                                                                                                                                                              | Defaults to root `tests` (`test_files`)                                                                                                                                                                                                                                |
| `bash.config_owners`                                                                                                                                                                                                                                       | `architecture.roles.env`, which checks/language/bash/env-owner.ts:15 already reads for the same rule                                                                                                                                                                   |
| `trpc.server_files`                                                                                                                                                                                                                                        | A `server` module in `architecture.modules`; its own summary says an explicit element wins                                                                                                                                                                             |
| `prose.vocabulary` and `tools.typos.words`                                                                                                                                                                                                                 | One root `[words]` map (review/glossary/011)                                                                                                                                                                                                                           |
| `tools.lychee.exclude_urls` and `tools.linkinator.exclude_urls`                                                                                                                                                                                            | One `links.allowed_urls` list, read by both checkers (`areas/kits/122`)                                                                                                                                                                                                |
| `tools.jest.coverage.{lines,branches,functions,statements}`, `tools.vitest.coverage.{lines,branches,functions,statements}`, `tools.pytest.coverage.lines`, `tools.xctest.coverage`                                                                         | One `[coverage]` table (areas/kits/104)                                                                                                                                                                                                                                |
| `limits.positional_arguments`                                                                                                                                                                                                                              | `limits.python.function_parameters`; its own summary says it defaults to `function_parameters`                                                                                                                                                                         |
| `limits.identical_function_lines` and `limits.duplication.min_lines`                                                                                                                                                                                       | One duplication threshold (areas/checks/032)                                                                                                                                                                                                                           |
| `limits.bash.{file_lines,function_lines,branches,nesting,identical_function_lines}`, `limits.swift.identical_function_lines`, `limits.sql.file_lines`                                                                                                      | Keep the setting form `limits.<language>.<name>`, which works for any limit; delete their separate declarations and keep only per-language defaults (areas/kits/114). The two `identical_function_lines` keys go with the duplicate-function checks (areas/checks/032) |
| `tools.taplo.formatting`, `tools.editorconfig.verbatim` (declared as settings)                                                                                                                                                                             | `tools.<tool>.verbatim`                                                                                                                                                                                                                                                |
| `{value, reason}` on any setting                                                                                                                                                                                                                           | `[reasons]`                                                                                                                                                                                                                                                            |
| `docs.exclude` (second job). No key replaces it, not even `docs.example_paths`: `docs/stale-paths` skips fenced code blocks that carry a `title=` attribute (`review/docs-site/046`, `review/policy-format/015`)                                           | No list: mentioned example paths need none, because `docs/stale-paths` skips fenced code blocks that carry a `title=` attribute (review/policy-format/015)                                                                                                             |

### Special cases: delete, or detect instead of asking (about 30)

| Keys                                                                                                       | The single case                                                                                                                                                                                               | Proposal                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash.boundary_roots`, `bash.doc_style`, `bash.platforms`, `bash.remote_functions`, `bash.entry_functions` | One repository's Bash house style: a `# Boundary:` header, colon or dash doc comments, a fourth header line, a `run_ssh` wrapper                                                                              | Ship one fixed style: hard-code each key's shipped default in the Bash checks, and delete the five keys (areas/kits/127, areas/kits/128)                                                                                                                                        |
| `postgres.docs`, `postgres.doc_sections`                                                                   | One documented migration layout. Only `postgres.docs` goes: `postgres/migration-docs` runs at level `all` (`review/verification/002`), and `postgres.doc_sections` stays as a choice with its shipped default | Delete                                                                                                                                                                                                                                                                          |
| `tools.swiftlint.keep_imports` (default `CoreGraphics`)                                                    | One codebase's import                                                                                                                                                                                         | Keep the key with the default `[]` (`areas/kits/060`)                                                                                                                                                                                                                           |
| `limits.docs.headings_before_contents`                                                                     | One README style                                                                                                                                                                                              | Hard-code the shipped default in the docs check, and delete the key                                                                                                                                                                                                             |
| `limits.site.kilobytes`                                                                                    | The only list under `[limits]`                                                                                                                                                                                | Move to `site.max_kilobytes`                                                                                                                                                                                                                                                    |
| `dependencies.min_release_age_days`, `dependencies.scanner`                                                | Bun only                                                                                                                                                                                                      | Keep them under `[dependencies]`; their summaries say they apply to Bun (`areas/kits/096` is closed as fixed with this layout)                                                                                                                                                  |
| `cloudflare.types_interface`                                                                               | OpenNext's `CloudflareEnv`                                                                                                                                                                                    | Detect OpenNext                                                                                                                                                                                                                                                                 |
| `tools.next.build_flags`                                                                                   | An app that does not build with Turbopack                                                                                                                                                                     | Move to `nextjs.build_flags` (`areas/kits/085`)                                                                                                                                                                                                                                 |
| `tools.eslint.component_languages`                                                                         | `<script lang>` in Vue and Svelte                                                                                                                                                                             | Rename to `component_script_lang`, owned by the vue and svelte configurations (`areas/kits/138`)                                                                                                                                                                                |
| `tools.eslint.node_version`                                                                                | Overriding package `engines`                                                                                                                                                                                  | Delete; package `engines` gives the Node version (review/policy-exceptions/006 deletes this repository's override)                                                                                                                                                              |
| `tools.jest.globals_module`                                                                                | `bun:test` in Jest-style tests                                                                                                                                                                                | Delete; the jest configuration serves Jest only (`slices/kits-frameworks-tools/049`)                                                                                                                                                                                            |
| `tools.ruff.docstring_convention`                                                                          | A fallback when the project config has none                                                                                                                                                                   | Keep reading the project config only                                                                                                                                                                                                                                            |
| `tools.swiftformat.swift_version`                                                                          | A Swift version                                                                                                                                                                                               | Init detects it from `swift-tools-version` in `Package.swift` (`areas/kits/064`)                                                                                                                                                                                                |
| `tools.xctest.reference_layout`                                                                            | One snapshot library's folder layout                                                                                                                                                                          | Move it with the snapshot checks into a library configuration that the `swift-snapshot-testing` dependency selects (`areas/kits/074`)                                                                                                                                           |
| `tools.svgo.min_saving_percent`                                                                            | One tuning number                                                                                                                                                                                             | Fix the threshold                                                                                                                                                                                                                                                               |
| `vitest.config_file`                                                                                       | A config file Vitest cannot find                                                                                                                                                                              | Delete; Vitest's own lookup decides                                                                                                                                                                                                                                             |
| `[[check]] finding_count_pattern`, `crash_pattern`, `exit_codes`, `needs`, `platforms`                     | One command check's quirks                                                                                                                                                                                    | Keep `command`, `paths`, `stage`, `output`, `fix`, `help`, `summary`, and the prerequisites `needs` and `platforms`; the name becomes the map key. Move `exit_codes`, `finding_count_pattern`, and `crash_pattern` into `output`. Delete `ignore_file` (`[[ignore]]` covers it) |

### Path-role lists: one map instead of many keys

`tools.eslint.script_files`, `zustand.store_files`, and `bash.config_owners` each answer one question: which files play role X. They become roles in `[architecture.roles]` (role = globs): `scripts`, `stores`, and the existing `env`. Each configuration declares the roles it reads and their defaults, and `architecture.roles` accepts only declared roles (`review/policy-format/022`). Root `tests` stays a root key, renamed `test_files`, and `roles.tests` defaults to it (`review/policy-format/029`). `trpc.server_files` becomes a `server` module in `[[architecture.modules]]`. `bash.safety_owners` and `supabase.admin_key_files` are path lists that ignore findings, and they become `[[ignore]]` records.

## Appendix A: every key the policy accepts

Marks: **min** (minimal), **fact**, **choice**, **dup**, **special**. Where a row below says exception, read ignore (review/glossary/009); the names in [the glossary](glossary.md) win over this table.

Open records override these rows:

- `tools.eslint.component_languages` becomes `component_script_lang`, owned by the vue and svelte configurations (`areas/kits/138`).
- `tools.jest.globals_module` is deleted (`slices/kits-frameworks-tools/049`).
- `tools.swiftlint.keep_imports` stays with the default `[]` (`areas/kits/060`).
- `tools.swiftformat.swift_version` stays, and init detects it (`areas/kits/064`).
- Only `postgres.docs` is deleted (`review/verification/002`).
- `site.build` becomes the argument list `site.build_command` (`areas/kits/134`).
- `tools.openapi.document` and `tools.openapi.generate` become `openapi.document` and the argument list `openapi.generate_command` (`areas/kits/085`, `areas/kits/134`).
- `tools.xcode.entitlements_allowed` becomes `xcode.entitlements_allowed` (`areas/kits/085`), and `tools.xcode.{project, scheme, destination}` become `swift.xcode_project`, `swift.xcode_scheme`, and `swift.xcode_destination` (`slices/kits-frameworks-tools/059`).
- `docs.example_paths` is not added (`review/docs-site/046`).

| Key                                                                                                                                                                                                                                      | Shape today                                                                                                                                                                         | What it does                                                                                           | Name clear?                                                                                                        | Proposed                                                                                                               | Mark                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `level`                                                                                                                                                                                                                                  | `recommended` or `all`                                                                                                                                                              | Which checks and rules run                                                                             | Yes                                                                                                                | Keep                                                                                                                   | min                                                                             |
| `configurations`                                                                                                                                                                                                                         | string list                                                                                                                                                                         | Configurations selected at the root                                                                    | Yes, long                                                                                                          | Keep                                                                                                                   | min                                                                             |
| `require_reasons`                                                                                                                                                                                                                        | boolean, default false                                                                                                                                                              | Turns reason validation on                                                                             | Yes                                                                                                                | Delete; always on                                                                                                      | dup                                                                             |
| `run_with`                                                                                                                                                                                                                               | `mise`, `npm`, `bun`, `pnpm`, `yarn`                                                                                                                                                | Runner that installs and runs gspot                                                                    | No, a verb phrase                                                                                                  | `runner`                                                                                                               | min                                                                             |
| `tests`                                                                                                                                                                                                                                  | glob list                                                                                                                                                                           | Test files where linters relax rules                                                                   | Bare noun                                                                                                          | `test_files`                                                                                                           | fact                                                                            |
| `exclude`                                                                                                                                                                                                                                | glob list                                                                                                                                                                           | Paths never read                                                                                       | Yes                                                                                                                | Keep                                                                                                                   | min                                                                             |
| `generated`                                                                                                                                                                                                                              | `[[generated]]`: `paths`, `generator`, `reason`                                                                                                                                     | Generated files left out of source checks                                                              | Yes                                                                                                                | Keep (keyless records)                                                                                                 | min                                                                             |
| `vendored`                                                                                                                                                                                                                               | `[[vendored]]`: `paths`, `reason`                                                                                                                                                   | Upstream copies left out of source checks                                                              | Yes                                                                                                                | Keep                                                                                                                   | min                                                                             |
| `tool_timeout_seconds`                                                                                                                                                                                                                   | number or `{value, reason}`                                                                                                                                                         | Longest single tool run                                                                                | Yes                                                                                                                | Keep; plain number                                                                                                     | choice                                                                          |
| `scope`                                                                                                                                                                                                                                  | `[[scope]]`: `path`, `configurations`, `tests`, any per-scope table                                                                                                                 | Projects inside the repository                                                                         | Yes, wrong shape                                                                                                   | `[scope."<path>"]`                                                                                                     | min                                                                             |
| `check`                                                                                                                                                                                                                                  | `[[check]]`: `name`, `command`, `paths`, `stage`, `ignore_file`, `help`, `fix`, `exit_codes`, `finding_count_pattern`, `crash_pattern`, `needs`, `platforms`, `summary`, `output.*` | The repository's own commands                                                                          | Yes, wrong shape                                                                                                   | `[check."<name>"]`; drop the special fields                                                                            | choice; `ignore_file` dup; patterns, `needs`, `platforms`, `exit_codes` special |
| `ignore`                                                                                                                                                                                                                                 | `[[ignore]]`: `check`, `rule`, `paths`, `reason`, `until`                                                                                                                           | Ignores findings                                                                                       | Yes                                                                                                                | Keep; the only ignore list; native `until` date                                                                        | min                                                                             |
| `[hooks]` presence                                                                                                                                                                                                                       | empty table                                                                                                                                                                         | Turns Git hooks on                                                                                     | No: an empty table is a switch                                                                                     | `hooks.enabled`                                                                                                        | min                                                                             |
| `hooks.push_files`                                                                                                                                                                                                                       | `changed` or `all`                                                                                                                                                                  | What pre-push checks                                                                                   | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `ci.provider`                                                                                                                                                                                                                            | `github` or `gitlab`                                                                                                                                                                | Turns the CI workflow on                                                                               | Yes                                                                                                                | Keep                                                                                                                   | min                                                                             |
| `ci.platforms`, `ci.files`                                                                                                                                                                                                               | list; `changed` or `all`                                                                                                                                                            | CI matrix and file set                                                                                 | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `agent_rules.enabled`                                                                                                                                                                                                                    | boolean                                                                                                                                                                             | Install agent rules                                                                                    | Yes                                                                                                                | Keep                                                                                                                   | min                                                                             |
| `agent_rules.folder`, `agent_rules.exclude`, `agent_rules.instruction_files`                                                                                                                                                             | path; list; list                                                                                                                                                                    | Where rules go, which to skip, extra instruction files                                                 | Yes                                                                                                                | Keep; init stops writing the default `folder`                                                                          | choice                                                                          |
| `agent_rules.project_folder`                                                                                                                                                                                                             | path                                                                                                                                                                                | The repository's own rules folder                                                                      | No: "project" means scope elsewhere                                                                                | `own_rules_folder`                                                                                                     | choice                                                                          |
| `limits.{barrel_reexports, branches, callback_nesting, cognitive_complexity, cyclomatic_complexity, file_kb, file_lines, function_lines, function_parameters, min_function_statements, nesting, prefix_collisions, returns, statements}` | number or `{value, reason}`                                                                                                                                                         | Ceilings and floors                                                                                    | Yes                                                                                                                | Keep; reasons in `[reasons]`                                                                                           | choice                                                                          |
| `limits.identical_function_lines`                                                                                                                                                                                                        | number                                                                                                                                                                              | Identical function bodies                                                                              | Unclear next to `limits.duplication.min_lines`                                                                     | Merge (areas/checks/032)                                                                                               | dup                                                                             |
| `limits.positional_arguments`                                                                                                                                                                                                            | number                                                                                                                                                                              | Python positional arguments                                                                            | Yes                                                                                                                | Delete; `limits.python.function_parameters`                                                                            | dup                                                                             |
| `limits.bash.{file_lines, function_lines, branches, nesting, identical_function_lines}`, `limits.swift.identical_function_lines`, `limits.sql.file_lines`                                                                                | number                                                                                                                                                                              | Per-language values of generic limits                                                                  | Yes                                                                                                                | Keep the key form; delete the separate declarations; the `identical_function_lines` keys go with areas/checks/032      | dup                                                                             |
| `limits.bash.assignments`, `limits.swift.closure_lines`, `limits.swift.type_lines`, `limits.python.package_exports`                                                                                                                      | number                                                                                                                                                                              | One-language limits                                                                                    | Yes                                                                                                                | Keep                                                                                                                   | special (one language, legitimate)                                              |
| `limits.docs.{list_item_words, paragraph_sentences, sentence_words}`                                                                                                                                                                     | number                                                                                                                                                                              | Prose limits                                                                                           | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `limits.docs.headings_before_contents`                                                                                                                                                                                                   | number                                                                                                                                                                              | README contents rule                                                                                   | Unclear                                                                                                            | Delete; hard-code the default                                                                                          | special                                                                         |
| `limits.duplication.{min_lines, min_tokens, percent}`                                                                                                                                                                                    | number                                                                                                                                                                              | jscpd thresholds                                                                                       | Yes                                                                                                                | Keep `min_tokens` and `percent`; merge `min_lines`                                                                     | choice                                                                          |
| `limits.site.kilobytes`                                                                                                                                                                                                                  | list of `{paths, kilobytes}`                                                                                                                                                        | Built page weight ceilings                                                                             | No: the only list under `[limits]`                                                                                 | `site.max_kilobytes`                                                                                                   | special                                                                         |
| `naming.banned`                                                                                                                                                                                                                          | string list                                                                                                                                                                         | Extra banned words                                                                                     | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `naming.allowed`                                                                                                                                                                                                                         | `[[naming.allowed]]`: `name`, `reason`                                                                                                                                              | Names allowed everywhere                                                                               | Yes, wrong shape                                                                                                   | `[naming.allowed]` map: name = reason                                                                                  | choice                                                                          |
| `naming.fixed_keys`                                                                                                                                                                                                                      | `[[...]]`: `file`, `names`, `reason`                                                                                                                                                | Names allowed in one file                                                                              | No: allows any identifier                                                                                          | Delete; `[[naming.overrides]]`                                                                                         | dup                                                                             |
| `naming.reserved`                                                                                                                                                                                                                        | `[[...]]`: `term`, `uses`                                                                                                                                                           | Terms limited to categories                                                                            | Yes                                                                                                                | `[naming.reserved]` map: term = categories                                                                             | choice                                                                          |
| `naming.groups_off`                                                                                                                                                                                                                      | `[[...]]`: `group`, `reason`                                                                                                                                                        | Drops a shipped term group                                                                             | No, "off" is vague                                                                                                 | Delete; no group is removable (`review/owner-decisions/003`)                                                           | choice                                                                          |
| `naming.paths`                                                                                                                                                                                                                           | `[[...]]`: `paths`, `languages`, `categories`, `names`, `ignored_prefix`, `allow_digits`, `allow_repeated_words`, `skip`, `case`, `reason`                                          | Ordered naming settings for paths                                                                      | No: named after its selector; `skip` says nothing                                                                  | `[[naming.overrides]]`; `names` plus `skip` become one `allowed` list (review/glossary/010)                            | choice                                                                          |
| `naming.max_chars`, `naming.max_words`, `naming.case`, `naming.<language>.*`, `naming.<language>.<category>.*`                                                                                                                           | number, number, list                                                                                                                                                                | Identifier ceilings and case                                                                           | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `naming.swift.{max_chars,max_words}`, `naming.sql.{max_chars,max_words}`                                                                                                                                                                 | number                                                                                                                                                                              | Per-language naming ceilings                                                                           | Yes                                                                                                                | Keep the key form; delete the per-language declarations                                                                | dup (declarations)                                                              |
| `architecture.modules`                                                                                                                                                                                                                   | `[[...]]`: `name`, `paths`                                                                                                                                                          | Named code parts                                                                                       | Yes                                                                                                                | Keep array; add `may_import`, `reason`                                                                                 | fact                                                                            |
| `architecture.imports_allowed`                                                                                                                                                                                                           | `[[...]]`: `from`, `to`, `reason`                                                                                                                                                   | Which module may import which                                                                          | No, reads backwards                                                                                                | Delete; `may_import`                                                                                                   | dup                                                                             |
| `architecture.roles`                                                                                                                                                                                                                     | table: role = globs; any key accepted                                                                                                                                               | Paths per role                                                                                         | Yes, open keys                                                                                                     | Keep; strict: the six roles read today plus the roles selected configurations declare (`review/policy-format/022`)     | fact                                                                            |
| `architecture.roles.test_support`                                                                                                                                                                                                        | path                                                                                                                                                                                | Test harness folder; review/glossary/015 renames the role `test_harness`                               | Yes; the only scope-relative role                                                                                  | Keep                                                                                                                   | fact                                                                            |
| `structure.reexports`                                                                                                                                                                                                                    | `none` or `index-only`                                                                                                                                                              | Re-export policy                                                                                       | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `structure.lone_files_allowed`, `structure.prefix_collisions_allowed`, `structure.folder_names_allowed`                                                                                                                                  | `[[...]]`: `paths`, `reason`                                                                                                                                                        | Per-check folder skips                                                                                 | Long; hides that it is an ignore                                                                                   | Delete; `[[ignore]]`                                                                                                   | dup                                                                             |
| `structure.python.singletons_allowed`                                                                                                                                                                                                    | list of `{names, paths, reason}`                                                                                                                                                    | Import-time objects allowed                                                                            | Python under structure                                                                                             | `[[ignore]]`                                                                                                           | dup                                                                             |
| `format.{indent_style, indent_width, print_width, line_ending, final_newline, quotes, trailing_commas, semicolons}`                                                                                                                      | scalars                                                                                                                                                                             | Shared formatting                                                                                      | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `format.overrides`                                                                                                                                                                                                                       | `[[...]]`: `paths` plus format fields                                                                                                                                               | Ordered path overrides                                                                                 | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `dependencies.min_release_age_days`, `dependencies.scanner`                                                                                                                                                                              | number; string                                                                                                                                                                      | Bun release age; Bun security scanner                                                                  | `scanner` is vague                                                                                                 | Keep under `[dependencies]` (areas/kits/096 is closed)                                                                 | special                                                                         |
| `dependencies.registry_hosts`                                                                                                                                                                                                            | list                                                                                                                                                                                | Allowed lockfile hosts                                                                                 | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `dependencies.ranges_allowed`                                                                                                                                                                                                            | list of `{paths, reason}`                                                                                                                                                           | Manifests allowed version ranges                                                                       | Hides an exception                                                                                                 | `[[ignore]]`                                                                                                           | dup                                                                             |
| `licenses.allowed`                                                                                                                                                                                                                       | list                                                                                                                                                                                | Allowed SPDX IDs                                                                                       | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `licenses.exceptions`                                                                                                                                                                                                                    | `[[...]]`: `package`, `license`, `reason`                                                                                                                                           | One package accepted                                                                                   | Yes, wrong shape                                                                                                   | `[licenses.exceptions."<package@version>"]`                                                                            | choice                                                                          |
| `docs.exclude`                                                                                                                                                                                                                           | `[[...]]`: `paths`, `reason`                                                                                                                                                        | Skips files and allows mentioned paths                                                                 | No: two jobs                                                                                                       | `[[ignore]]`; mentioned paths need no list (review/policy-format/015)                                                  | dup                                                                             |
| `docs.banned_headings`                                                                                                                                                                                                                   | list                                                                                                                                                                                | Extra banned headings                                                                                  | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `docs.license`                                                                                                                                                                                                                           | boolean                                                                                                                                                                             | Requires a LICENSE file                                                                                | No                                                                                                                 | `docs.require_license`                                                                                                 | choice                                                                          |
| `prose.vocabulary`                                                                                                                                                                                                                       | list                                                                                                                                                                                | Words Vale accepts                                                                                     | Yes                                                                                                                | Merge into the root `[words]` map (review/glossary/011)                                                                | dup                                                                             |
| `bash.{boundary_roots, doc_style, platforms, remote_functions, entry_functions}`                                                                                                                                                         | lists and strings                                                                                                                                                                   | Bash house rules                                                                                       | `platforms` is vague                                                                                               | Delete `doc_style` (`areas/kits/127`); rename `boundary_roots` to `boundary_folders` (`areas/kits/128`); keep the rest | special                                                                         |
| `bash.config_owners`                                                                                                                                                                                                                     | list                                                                                                                                                                                | Scripts that read environment defaults                                                                 | Yes                                                                                                                | `architecture.roles.env`                                                                                               | dup                                                                             |
| `bash.safety_owners`, `bash.defaults_allowed`                                                                                                                                                                                            | list                                                                                                                                                                                | Scripts allowed to break one rule                                                                      | Hides an exception                                                                                                 | `[[ignore]]`                                                                                                           | dup                                                                             |
| `cloudflare.types_file`                                                                                                                                                                                                                  | path                                                                                                                                                                                | Worker types file                                                                                      | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `cloudflare.types_interface`                                                                                                                                                                                                             | string                                                                                                                                                                              | `Env` or OpenNext's `CloudflareEnv`                                                                    | Yes                                                                                                                | Detect                                                                                                                 | special                                                                         |
| `drizzle.raw_sql_allowed`                                                                                                                                                                                                                | list of `{paths, reason}`                                                                                                                                                           | Raw SQL allowed                                                                                        | Hides an exception                                                                                                 | `[[ignore]]`                                                                                                           | dup                                                                             |
| `env.templates`, `env.reader_functions`                                                                                                                                                                                                  | lists                                                                                                                                                                               | Example environment files and readers; review/glossary/023 names the moved list `secrets.env_examples` | Root differs from the `secrets` owner                                                                              | `[secrets]`                                                                                                            | fact                                                                            |
| `html.templates`                                                                                                                                                                                                                         | list                                                                                                                                                                                | HTML template files                                                                                    | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `html.literals_allowed`                                                                                                                                                                                                                  | list of `{paths, reason}`                                                                                                                                                           | Literal text allowed                                                                                   | Hides an exception                                                                                                 | `[[ignore]]`                                                                                                           | dup                                                                             |
| `i18n.locales`                                                                                                                                                                                                                           | table                                                                                                                                                                               | Locale folder and base locale                                                                          | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `postgres.{client_schemas, migrations_folder, frozen_through}`                                                                                                                                                                           | list; path; string                                                                                                                                                                  | Database facts                                                                                         | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `postgres.docs`, `postgres.doc_sections`                                                                                                                                                                                                 | boolean; list                                                                                                                                                                       | Documented migration layout                                                                            | `docs` is vague. Delete only `postgres.docs` (`review/verification/002`); keep `postgres.doc_sections` as a choice | Delete                                                                                                                 | special                                                                         |
| `semgrep.rule_files`                                                                                                                                                                                                                     | list                                                                                                                                                                                | Extra Semgrep rules                                                                                    | Split from `tools.semgrep`                                                                                         | `tools.semgrep.rule_files`                                                                                             | fact                                                                            |
| `site.{build, output}` (`output` becomes `build_folder`, review/glossary/013)                                                                                                                                                            | strings                                                                                                                                                                             | Site build                                                                                             | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `site.sitemap_exclude`                                                                                                                                                                                                                   | list                                                                                                                                                                                | Pages left out of the sitemap                                                                          | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `supabase.{functions_folder, types_file}`                                                                                                                                                                                                | paths                                                                                                                                                                               | Supabase facts                                                                                         | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `supabase.admin_key_files`                                                                                                                                                                                                               | list                                                                                                                                                                                | Files allowed to name admin keys                                                                       | Hides an exception                                                                                                 | `[[ignore]]`                                                                                                           | dup                                                                             |
| `trpc.server_files`                                                                                                                                                                                                                      | list                                                                                                                                                                                | Server files when no module says so                                                                    | Yes                                                                                                                | A `server` module                                                                                                      | dup                                                                             |
| `vitest.config_file`                                                                                                                                                                                                                     | path                                                                                                                                                                                | A config Vitest cannot find                                                                            | Split from `tools.vitest`                                                                                          | Delete                                                                                                                 | special                                                                         |
| `zustand.store_files`                                                                                                                                                                                                                    | list                                                                                                                                                                                | Files allowed to create stores                                                                         | Yes                                                                                                                | A role in `architecture.roles`                                                                                         | fact                                                                            |
| `tools.<tool>.verbatim`                                                                                                                                                                                                                  | table plus `reason`                                                                                                                                                                 | Native options gspot has no setting for                                                                | Yes                                                                                                                | Keep only where a writer reads it                                                                                      | choice                                                                          |
| `tools.editorconfig.verbatim`, `tools.taplo.formatting`                                                                                                                                                                                  | tables                                                                                                                                                                              | Native options declared as settings                                                                    | Repeats `verbatim`                                                                                                 | Delete; `verbatim`                                                                                                     | dup                                                                             |
| `tools.basedpyright.exclude`, `tools.jscpd.exclude`, `tools.knip.exclude`, `tools.lychee.exclude`, `tools.semgrep.exclude`, `tools.sqlfluff.exclude`, `tools.typos.exclude`                                                              | list of `{paths, reason}`                                                                                                                                                           | Skip paths for every check of that tool                                                                | "exclude" hides an ignore                                                                                          | `[[ignore]]`                                                                                                           | dup                                                                             |
| `tools.prettier.exclude`                                                                                                                                                                                                                 | list of strings                                                                                                                                                                     | `.prettierignore` lines                                                                                | Same name, other shape                                                                                             | `[[ignore]]`                                                                                                           | dup                                                                             |
| `tools.codeql.languages`, `tools.codeql.suite`                                                                                                                                                                                           | list; string                                                                                                                                                                        | CodeQL scan                                                                                            | Yes                                                                                                                | Keep                                                                                                                   | fact; choice                                                                    |
| `tools.codeql.ignore`                                                                                                                                                                                                                    | list of `{rule, paths, reason}`                                                                                                                                                     | Accepted results                                                                                       | Yes                                                                                                                | `[[ignore]]`                                                                                                           | dup                                                                             |
| `tools.commitlint.{types, scopes, rules}`                                                                                                                                                                                                | list; list; map                                                                                                                                                                     | Commit conventions                                                                                     | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.eslint.{import_extensions, restricted_imports, rules, overrides, runtimes}`                                                                                                                                                       | map; list; map; records; map                                                                                                                                                        | ESLint options                                                                                         | Yes                                                                                                                | Keep                                                                                                                   | choice; `runtimes` fact                                                         |
| `tools.eslint.script_files`                                                                                                                                                                                                              | list                                                                                                                                                                                | Files that may print and exit                                                                          | Yes                                                                                                                | A role                                                                                                                 | fact                                                                            |
| `tools.eslint.component_languages`                                                                                                                                                                                                       | list                                                                                                                                                                                | Component script languages                                                                             | Yes                                                                                                                | Detect                                                                                                                 | special                                                                         |
| `tools.eslint.node_version`                                                                                                                                                                                                              | string                                                                                                                                                                              | Overrides package `engines`                                                                            | Yes                                                                                                                | Delete (review/policy-exceptions/006)                                                                                  | special                                                                         |
| `tools.gitleaks.allowed`, `tools.gitleaks.baseline_reasons`                                                                                                                                                                              | lists                                                                                                                                                                               | Accepted secrets                                                                                       | Yes                                                                                                                | `[[ignore]]` (areas/kits/100, 101)                                                                                     | dup                                                                             |
| `tools.hadolint.trusted_registries`                                                                                                                                                                                                      | list                                                                                                                                                                                | Allowed base image registries                                                                          | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.jest.coverage.{lines,branches,functions,statements}`, `tools.vitest.coverage.{lines,branches,functions,statements}`, `tools.pytest.coverage.lines`, `tools.xctest.coverage`                                                       | numbers; list                                                                                                                                                                       | Coverage floors                                                                                        | Yes                                                                                                                | One `[coverage]` table (areas/kits/104)                                                                                | dup                                                                             |
| `tools.jest.globals_module`                                                                                                                                                                                                              | string                                                                                                                                                                              | Test globals module                                                                                    | Yes                                                                                                                | Detect                                                                                                                 | special                                                                         |
| `tools.knip.entry`                                                                                                                                                                                                                       | list                                                                                                                                                                                | Extra knip entry points                                                                                | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `tools.knip.ignore_dependencies`                                                                                                                                                                                                         | list of `{name, workspace, reason}`                                                                                                                                                 | Dependencies knip may not flag                                                                         | Yes                                                                                                                | Map keyed by name                                                                                                      | choice                                                                          |
| `tools.lychee.exclude_urls`, `tools.linkinator.exclude_urls`                                                                                                                                                                             | lists                                                                                                                                                                               | URLs the link checks skip                                                                              | Yes                                                                                                                | `links.allowed_urls` (`areas/kits/122`)                                                                                | dup                                                                             |
| `tools.markdownlint.rules`, `tools.stylelint.rules`, `tools.yamllint.rules`                                                                                                                                                              | maps                                                                                                                                                                                | Native rule options                                                                                    | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.next.build_flags`                                                                                                                                                                                                                 | list                                                                                                                                                                                | `next build` flags                                                                                     | Yes                                                                                                                | `nextjs.build_flags` (`areas/kits/085`)                                                                                | special                                                                         |
| `tools.nginx.image`                                                                                                                                                                                                                      | string                                                                                                                                                                              | nginx test image                                                                                       | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `tools.openapi.document`, `tools.openapi.generate`                                                                                                                                                                                       | strings                                                                                                                                                                             | OpenAPI document and generator                                                                         | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `tools.pip.installs_allowed`, `tools.xctest.sleep_allowed`                                                                                                                                                                               | list of `{paths, reason}`                                                                                                                                                           | Paths allowed to break one rule                                                                        | Hides an exception                                                                                                 | `[[ignore]]`                                                                                                           | dup                                                                             |
| `tools.purgecss.safelist`                                                                                                                                                                                                                | list of `{names, reason}`                                                                                                                                                           | Classes added at run time                                                                              | Yes                                                                                                                | Map keyed by class                                                                                                     | choice                                                                          |
| `tools.ruff.docstring_convention`                                                                                                                                                                                                        | string                                                                                                                                                                              | Docstring style fallback                                                                               | Yes                                                                                                                | Read project config only                                                                                               | special                                                                         |
| `tools.ruff.rules_off_in_tests`                                                                                                                                                                                                          | list                                                                                                                                                                                | Ruff rules off in tests                                                                                | Yes                                                                                                                | `[[ignore]]` with `test_files` paths                                                                                   | dup                                                                             |
| `tools.semgrep.registry`                                                                                                                                                                                                                 | list                                                                                                                                                                                | Registry packs                                                                                         | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.sqlfluff.dialect`, `tools.squawk.assume_in_transaction`                                                                                                                                                                           | string; boolean                                                                                                                                                                     | Database facts                                                                                         | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `tools.svgo.min_saving_percent`                                                                                                                                                                                                          | number                                                                                                                                                                              | SVG saving threshold                                                                                   | Yes                                                                                                                | Fix the value                                                                                                          | special                                                                         |
| `tools.swiftformat.swift_version`                                                                                                                                                                                                        | string                                                                                                                                                                              | Swift version                                                                                          | Yes                                                                                                                | Detect                                                                                                                 | special                                                                         |
| `tools.swiftlint.keep_imports`                                                                                                                                                                                                           | list                                                                                                                                                                                | Imports the analyzer keeps                                                                             | Yes                                                                                                                | Delete                                                                                                                 | special                                                                         |
| `tools.trivy.ignore`                                                                                                                                                                                                                     | list of `{id, reason}`                                                                                                                                                              | Accepted IDs                                                                                           | Yes                                                                                                                | `[[ignore]]`                                                                                                           | dup                                                                             |
| `tools.trivy.severity`                                                                                                                                                                                                                   | string                                                                                                                                                                              | Severities reported                                                                                    | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.typos.locale`                                                                                                                                                                                                                     | string                                                                                                                                                                              | English variant                                                                                        | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.typos.words`                                                                                                                                                                                                                      | list of strings or `{word, reason}`                                                                                                                                                 | Accepted words                                                                                         | Yes, wrong shape                                                                                                   | One root `[words]` map with `prose.vocabulary` (review/glossary/011)                                                   | choice                                                                          |
| `tools.v8r.schemas`                                                                                                                                                                                                                      | list of `{pattern, schema}`                                                                                                                                                         | Extra JSON schemas                                                                                     | Yes                                                                                                                | Map: pattern = URL                                                                                                     | fact                                                                            |
| `tools.xcode.{destination, project, scheme}`                                                                                                                                                                                             | strings                                                                                                                                                                             | Xcode build facts                                                                                      | Yes                                                                                                                | Keep                                                                                                                   | fact                                                                            |
| `tools.xcode.entitlements_allowed`                                                                                                                                                                                                       | list                                                                                                                                                                                | Allowed entitlements                                                                                   | Yes                                                                                                                | Keep                                                                                                                   | choice                                                                          |
| `tools.xctest.reference_layout`                                                                                                                                                                                                          | string                                                                                                                                                                              | Snapshot path layout                                                                                   | Yes                                                                                                                | Delete; the snapshot library's own `__Snapshots__` layout decides (`areas/kits/074`)                                   | special                                                                         |
| `{value, reason}` wrapper (any setting)                                                                                                                                                                                                  | inline table                                                                                                                                                                        | Value with a reason                                                                                    | `value` is a filler word                                                                                           | `[reasons]`                                                                                                            | dup                                                                             |
| `[reasons]` (new)                                                                                                                                                                                                                        | map: setting = reason                                                                                                                                                               | Reasons for loosened settings                                                                          | Yes                                                                                                                | Add                                                                                                                    | min                                                                             |
| `docs.example_paths` (withdrawn, not added: review/policy-format/015)                                                                                                                                                                    | list                                                                                                                                                                                | Paths the docs name on purpose that are not tracked                                                    | Yes                                                                                                                | Add                                                                                                                    | choice                                                                          |

## Appendix B: this repository's gspot.toml in the proposed format

Generated from the current file by `scripts/rewrite.py` in the scratchpad, and checked by `scripts/verify.py`. The check found every setting of the current file in the new file, and no problems. Those settings are all 32 path entries, 16 modules with their imports and reasons, 15 fixed-key records, 7 license exceptions, 4 knip entries, 5 words, and 4 scopes. They also include roles, the ESLint, knip, CodeQL, and commitlint options, and the 156 `prose.vocabulary` words.

The file parses with Python's TOML 1.0 reader. It is 908 lines (today: 1,006). It has 31 `[table]` headers, 48 `[[ignore]]` and `[[architecture.modules]]` headers, 15 `[[naming.overrides]]` headers, and no root dotted keys or root inline tables (today: 8, 104, and 4).

Semantic notes:

- `[[ignore]]` paths for the structure checks match the files those checks report, which sit under the allowed folders.
- The `docs/stale-paths` ignore does not accept mentioned path tokens that match `packages/cli/configurations/*/*/rules/**`. That was the second job of `docs.exclude`, and nothing here needs it.
- `tools.lychee.exclude` becomes two records, because it covered two checks.
- Entries marked `# drop:` stay until the change they name lands.
- This appendix keeps every current entry to show the format; it is not the target content. Records change or delete entries in it:
    - `review/policy-exceptions/003` to `006`, `009`, `010`, `013`, `018`, `023`, `024`, `026` to `031`, `033`, `035` to `037`, `040` to `044`, `046`, `047`, and `051` (`038`, `039`, and `045` are closed into `review/tests-layout/018` and `review/code-execution/020`)
    - `review/policy-format/015` (no `docs.example_paths` list)
    - `review/glossary/011` (one root `[words]` map for `prose.vocabulary` and `tools.typos.words`)
    - `review/source-layout/001` and `008` (every module imports one way, in the proposed module order, and the `tool-output` module goes)
    - `review/tests-layout/003` (the `tests` scope keeps no configurations, and the `jest/coverage`, `vitest/coverage`, and `nextjs/tsc` ignores go), `019` to `021`
    - `areas/checks/060` (the `structure/folder-names` ignore goes)
    - `review/configurations-plugin/001`
    - `review/owner-decisions/003` (restored banned terms)
    - `review/repository-root/010`

    Apply those records, and the schema URL of `review/owner-decisions/004`, when you write the new gspot.toml.

```toml
#:schema https://generativespotting.com/schema/gspot.schema.json

# Run gspot apply after changing policy. Use gspot explain <name> to inspect a setting.

level = "all"
configurations = [
    "spelling",
    "typescript",
    "prose",
    "commits",
    "actions",
    "naming",
    "docs",
    "secrets",
    "dependencies",
    "licenses",
    "duplication",
    "security",
    "engineering",
    "files",
    "markdown",
    "format",
    "gspot",
    "structure",
    "javascript",
]
runner = "mise"

[scope."docs"]
configurations = ["css", "astro", "javascript", "zod", "cloudflare"]

[scope."packages/cli"]
configurations = ["javascript", "zod"]

[scope."packages/eslint-plugin"]
configurations = ["javascript"]

[scope."tests"]
configurations = ["astro", "javascript", "jest", "nestjs", "nextjs", "react", "svelte", "vitest", "react-dom"]

[hooks]
enabled = true

[naming]
banned = [
    "catalog",
    "catalogue",
    "corpus",
    "render",
    "sync",
    "synchronize",
    "materialize",
    "coerce",
    "scoped",
    "bind",
    "load",
    "loaded",
    "loader",
    "loaders",
    "loading",
    "fetch",
    "resolve",
    "resolving",
    "resolution",
    "probe",
    "probes",
    "probed",
    "probing",
    "fixture",
    "fixtures",
    "shell",
]

[naming.allowed]
HelpersBesideTestsOptions = "This type describes the options of the published ESLint rule no-helpers-beside-tests."
no-helpers-beside-tests = "This filename identifies the published ESLint rule no-helpers-beside-tests."
"no-helpers-beside-tests.test" = "This test filename identifies its published ESLint rule no-helpers-beside-tests."
noHelpersBesideTests = "This binding owns the published ESLint rule no-helpers-beside-tests."

# Names allowed in some files, one record per file and reason. These were [[naming.fixed_keys]].

[[naming.overrides]]
paths = ["docs/src/content/docs/404.md"]
allowed = ["404"]
reason = "Starlight routes the HTTP 404 page by this filename."

[[naming.overrides]]
paths = ["packages/cli/src/checks/language/sql.ts"]
allowed = ["FunctionParameter"]
reason = "The libpg-query AST tag for a function parameter."

[[naming.overrides]]
paths = ["packages/cli/src/parsers/schema/xcode.ts"]
allowed = ["shouldTranslate"]
reason = "Xcode string files spell this key."

[[naming.overrides]]
paths = ["packages/cli/src/types/checks/language/sql.ts"]
allowed = ["DefElem", "List", "String", "FunctionParameter"]
reason = "libpg-query AST tags spell these keys."

[[naming.overrides]]
paths = ["packages/cli/src/types/commands/program.ts"]
allowed = ["C"]
reason = "Commander names the value of the -C flag after its letter, which Git uses for the same flag."

[[naming.overrides]]
paths = ["packages/cli/src/types/parsers/sql.ts"]
allowed = [
    "lengthBytesUTF8",
    "stringToUTF8",
    "UTF8ToString",
    "_malloc",
    "_free",
    "_wasm_parse_query_raw",
    "_wasm_parse_plpgsql",
    "_wasm_free_string",
    "_wasm_free_parse_result",
    "stmt_location",
    "stmt_len",
]
reason = "Emscripten and libpg-query export these members."

# rename with the keys: may_import replaces imports_allowed, runner replaces run_with, require_reasons goes.
[[naming.overrides]]
paths = ["packages/cli/src/types/policy/settings.ts"]
allowed = ["imports_allowed", "tool_timeout_seconds", "run_with", "require_reasons"]
reason = "Public gspot.toml keys, and the keys of the naming policy gspot ships."

[[naming.overrides]]
paths = ["packages/cli/src/types/repository/revisions.ts", "packages/cli/src/types/commands/check.ts"]
allowed = ["object"]
reason = "The pre-push JSON report names Git object identities with this key."

[[naming.overrides]]
paths = ["tests/cli/commands/ci.test.ts"]
allowed = ["with"]
reason = "The GitHub Actions inputs key."

[[naming.overrides]]
paths = ["tests/cli/generation/formatting.test.ts"]
allowed = ["MD007"]
reason = "The markdownlint rule name."

[[naming.overrides]]
paths = ["tests/cli/generation/selection.test.ts"]
allowed = ["allowed", "exceptions"]
reason = "The license scanner policy keys."

[[naming.overrides]]
paths = ["tests/tools/generation/parameter-limits.test.ts"]
allowed = ["rule_id"]
reason = "The SwiftLint JSON diagnostic key."

[[naming.overrides]]
paths = ["tests/types/generation/configuration-files.ts"]
allowed = ["MD007", "customSyntax"]
reason = "Markdownlint names its indentation rule MD007. Stylelint names its parser option customSyntax. These native configuration keys retain their exact API spelling."

[[naming.overrides]]
paths = ["tests/types/generation/workflow.ts"]
allowed = ["with"]
reason = "GitHub Actions uses with as the key for action inputs."

[[naming.overrides]]
paths = ["tests/types/tools/generation/parameter-limits.ts"]
allowed = ["rule_id"]
reason = "SwiftLint JSON diagnostics identify the native rule using rule_id."

# A CLI module imports itself and the modules in its may_import list. Its config and types files belong to the same module.
# The order is kept as written: tool-output's paths sit inside the paths of parsers.

[[architecture.modules]]
name = "main"
paths = ["packages/cli/src/main.ts"]
may_import = ["main", "commands", "platform"]

[[architecture.modules]]
name = "commands"
paths = ["packages/cli/src/commands/**", "packages/cli/src/config/commands/**", "packages/cli/src/types/commands/**"]
may_import = [
    "commands",
    "checks",
    "output",
    "execution",
    "lifecycle",
    "generation",
    "tools",
    "policy",
    "rules",
    "configurations",
    "repository",
    "parsers",
    "platform",
]

[[architecture.modules]]
name = "checks"
paths = ["packages/cli/src/checks/**", "packages/cli/src/config/checks/**", "packages/cli/src/types/checks/**"]
may_import = [
    "checks",
    "execution",
    "lifecycle",
    "generation",
    "tools",
    "policy",
    "configurations",
    "repository",
    "parsers",
    "platform",
]

[[architecture.modules]]
name = "output"
paths = ["packages/cli/src/output/**", "packages/cli/src/config/output.ts", "packages/cli/src/types/output.ts"]
may_import = ["output", "execution", "platform"]

[[architecture.modules]]
name = "execution"
paths = ["packages/cli/src/execution/**", "packages/cli/src/config/execution/**", "packages/cli/src/types/execution/**"]
may_import = [
    "tool-output",
    "execution",
    "lifecycle",
    "generation",
    "tools",
    "policy",
    "configurations",
    "repository",
    "parsers",
    "platform",
]

[[architecture.modules]]
name = "lifecycle"
paths = ["packages/cli/src/lifecycle/**", "packages/cli/src/config/lifecycle/**", "packages/cli/src/types/lifecycle/**"]
may_import = [
    "parsers",
    "execution",
    "lifecycle",
    "generation",
    "tools",
    "policy",
    "configurations",
    "repository",
    "platform",
]

[[architecture.modules]]
name = "generation"
paths = [
    "packages/cli/src/generation/**",
    "packages/cli/src/config/generation/**",
    "packages/cli/src/types/generation/**",
]
may_import = [
    "parsers",
    "execution",
    "generation",
    "tools",
    "policy",
    "rules",
    "configurations",
    "repository",
    "platform",
]

[[architecture.modules]]
name = "tools"
paths = ["packages/cli/src/tools/**", "packages/cli/src/config/tools/**", "packages/cli/src/types/tools/**"]
may_import = ["parsers", "execution", "generation", "tools", "policy", "configurations", "repository", "platform"]
reason = "Tool installation prepares generated lock files and consumes the generated-file contract owned by generation."

[[architecture.modules]]
name = "policy"
paths = ["packages/cli/src/policy/**", "packages/cli/src/config/policy/**", "packages/cli/src/types/policy/**"]
may_import = ["parsers", "policy", "rules", "configurations", "repository", "platform"]

[[architecture.modules]]
name = "rules"
paths = ["packages/cli/src/rules/**", "packages/cli/src/config/rules.ts", "packages/cli/src/types/rules.ts"]
may_import = ["rules", "parsers", "configurations", "repository", "platform"]
reason = "Agent instruction settings derive from their parser schema, so rules consume the validated contract without duplicating it."

[[architecture.modules]]
name = "configurations"
paths = [
    "packages/cli/src/configurations/**",
    "packages/cli/src/parsers/configurations.ts",
    "packages/cli/src/parsers/schema/configurations/**",
    "packages/cli/src/config/configurations.ts",
    "packages/cli/src/types/configurations.ts",
]
may_import = ["parsers", "configurations", "repository", "platform"]

[[architecture.modules]]
name = "repository"
paths = [
    "packages/cli/src/repository/**",
    "packages/cli/src/config/repository/**",
    "packages/cli/src/types/repository/**",
]
may_import = ["repository", "parsers", "platform"]

[[architecture.modules]]
name = "tool-output"
paths = ["packages/cli/src/parsers/output/**"]
may_import = ["tool-output", "parsers", "execution", "repository", "platform"]

[[architecture.modules]]
name = "parsers"
paths = ["packages/cli/src/parsers/**", "packages/cli/src/config/parsers/**", "packages/cli/src/types/parsers/**"]
may_import = ["parsers", "configurations", "platform"]
reason = "Tool-output parsing consumes validated configuration declarations to interpret native versions without copying the tool metadata contract."

[[architecture.modules]]
name = "platform"
paths = ["packages/cli/src/platform/**", "packages/cli/src/config/platform/**", "packages/cli/src/types/platform/**"]
may_import = ["platform"]

# The ESLint plugin is one more module, which neither imports the CLI nor is imported by it.
[[architecture.modules]]
name = "plugin"
paths = ["packages/eslint-plugin/src/**"]
may_import = ["plugin"]

[architecture.roles]
config = ["packages/*/src/config/**", "tests/config/**", "scripts/config/**", "docs/src/config/**"]
env = ["packages/cli/src/platform/environment.ts", "tests/harness/environment.ts"]
runtime = ["src/**", "packages/*/src/**"]
test_harness = "tests/harness"
tests = ["tests/cli/**", "tests/plugin/**", "tests/tools/**", "tests/packages/**", "**/*.test.*"]
types = ["packages/*/src/types/**", "tests/types/**", "scripts/types/**", "docs/src/types/**"]

[dependencies]
scanner = "@socketsecurity/bun-security-scanner"

[licenses]
allowed = [
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "0BSD",
    "CC0-1.0",
    "CC-BY-3.0",
    "CC-BY-4.0",
    "Unlicense",
    "BlueOak-1.0.0",
    "Python-2.0",
]

[licenses.exceptions."@csstools/selector-specificity@5.0.0"]
license = "MIT-0"
reason = "The CSS tooling dependency uses the MIT No Attribution license; its installed package retains the license text."

[licenses.exceptions."@fontsource-variable/geist-mono@5.3.0"]
license = "OFL-1.1"
reason = "The documentation distributes this unmodified font and copies its license into the built site under licenses/geist-mono.txt."

[licenses.exceptions."@fontsource-variable/geist@5.3.0"]
license = "OFL-1.1"
reason = "The documentation distributes this unmodified font and copies its license into the built site under licenses/geist.txt."

[licenses.exceptions."axe-core@4.13.0"]
license = "MPL-2.0"
reason = "The JSX accessibility lint plugin requires this unmodified development dependency. Its installed LICENSE identifies MPL-2.0; it is not included in the gspot package."

[licenses.exceptions."eslint-plugin-sonarjs@4.2.0"]
license = "LGPL-3.0-only"
reason = "A lint plugin that runs at development time and is linked dynamically; nothing of it ships in the gspot package."

[licenses.exceptions."lightningcss@1.33.0"]
license = "MPL-2.0"
reason = "A build dependency of the manual site; the license binds changes to its own files, and none are made."

[licenses.exceptions."truncate-utf8-bytes@1.0.2"]
license = "WTFPL"
reason = "A permissive license with no conditions; it arrives through a test tool and ships in nothing."

[prose]
vocabulary = [
    "ABC",
    "ACME",
    "AES",
    "ANN",
    "ANSI",
    "AOT",
    "ARG",
    "ARIA",
    "ASCII",
    "ASD",
    "AST",
    "ATS",
    "AWQ",
    "BASH",
    "BCP",
    "BEM",
    "BOM",
    "BSD",
    "BSL",
    "CDN",
    "CDPATH",
    "CJS",
    "CORS",
    "CPU",
    "CRLF",
    "CRUD",
    "CSP",
    "CSRF",
    "CSV",
    "CTE",
    "CUDA",
    "DDL",
    "DEBUG",
    "DELETE",
    "DNS",
    "DOM",
    "DTO",
    "ENV",
    "EOF",
    "EOL",
    "ERR",
    "ESM",
    "(?-i:\\bEXIT\\b)",
    "FAST",
    "GET",
    "GIF",
    "GNU",
    "GPU",
    "GRDB",
    "GUID",
    "HEAD",
    "HMAC",
    "HOME",
    "HSTS",
    "HTTPS",
    "Husky",
    "ICU",
    "IDE",
    "IFS",
    "IME",
    "INI",
    "INT",
    "ISC",
    "ISO",
    "JIT",
    "JPEG",
    "JSONB",
    "JSONC",
    "JSONL",
    "JSPB",
    "JSX",
    "JWT",
    "Lefthook",
    "LFS",
    "LLM",
    "LTS",
    "MARK",
    "MIME",
    "MIT",
    "MVC",
    "MVP",
    "MVVM",
    "NAME",
    "NOTE",
    "NPM",
    "NUL",
    "NVIDIA",
    "OCSP",
    "OIDC",
    "ORM",
    "OTP",
    "OWASP",
    "PATCH",
    "PATH",
    "PEP",
    "PID",
    "PII",
    "PLR",
    "PNG",
    "POSIX",
    "POST",
    "PUT",
    "PWA",
    "PWD",
    "PYPI",
    "RAM",
    "README",
    "RETURN",
    "RFC",
    "RGB",
    "RLS",
    "RPC",
    "RSA",
    "RSC",
    "RTL",
    "(?-i:\\bRUN\\b)",
    "SAST",
    "SCSS",
    "SDK",
    "SEO",
    "SGID",
    "SHA",
    "(?-i:\\bSHELL\\b)",
    "SIM",
    "SPDX",
    "SSE",
    "SSH",
    "SSR",
    "SSRF",
    "STDERR",
    "STDIN",
    "STDOUT",
    "SUID",
    "SVG",
    "SWC",
    "TCA",
    "TCP",
    "TERM",
    "TIP",
    "TLS",
    "TODO",
    "TRT",
    "TRY",
    "TSX",
    "TTY",
    "Turborepo",
    "UDP",
    "UTC",
    "UTF",
    "UUID",
    "VIP",
    "VIPER",
    "WASM",
    "WCAG",
    "WSL",
    "XML",
]

[tools.codeql]
languages = ["javascript-typescript", "actions"]

[tools.commitlint]
scopes = ["cli", "eslint-plugin", "docs", "root", "hooks", "deps"]

[tools.eslint]
node_version = ">=24.2.0"
script_files = ["scripts/**", "packages/*/scripts/**", "docs/src/content/reference/**"]

[tools.eslint.import_extensions]
"**/*" = "ts"

[tools.eslint.rules]
"gspot/instances-in-registry" = [
    { files = [
        "**/registry.ts",
        "**/registry.tsx",
        "**/registry.js",
        "packages/*/src/config/**",
        "tests/config/**",
        "packages/cli/src/generation/templates.ts",
    ] },
]

[tools.knip]
entry = [
    "packages/eslint-plugin/src/plugin.ts",
    "packages/cli/src/tools/eslint/worker.ts",
    "docs/src/content/reference/collection.ts",
    "docs/src/route-metadata.ts",
]

[tools.knip.ignore_dependencies]
"^@fontsource-variable/" = "The site imports the fonts from docs/src/theme.css, outside the TypeScript import graph."
"^tree-sitter-" = "The build copies the grammar WASM files from these packages by path; nothing imports them."

[tools.knip.ignore_dependencies."^.+$"]
workspace = "tests"
reason = "Every package the tests workspace lists is installed into a test repository, which knip cannot see."

[tools.knip.ignore_dependencies.satteri]
workspace = "docs"
reason = "Astro prerender externalizes this native Markdown loader in astro.config.ts. A direct dependency keeps Bun's package lookup at the installed loader origin; the site build verifies native resolution."

# drop: the canonical writer writes { a = 1 }, taplo's default, so this override has no job left.
[tools.taplo.formatting]
compact_inline_tables = true

[tools.typos.words]
IIFEs = "ESLint's max-lines-per-function option and the unicorn rule description spell the plural so."
LICENCE = "The British license filename is required by repository license regression cases."
axe = "The axe-core accessibility package name."
capitalisation = "SQLFluff names its rule group capitalisation; the SQL template and its tests quote it."
udid = "Apple's device identifier API name."

[reasons]
# drop: goes with [tools.taplo.formatting].
"tools.taplo.formatting" = "This repository keeps its authored compact inline TOML tables."

# Every ignore, sorted by check, rule, and first path.

[[ignore]]
check = "actions/zizmor"
rule = "self-repository"
paths = [".github/workflows/ci.yml", ".github/workflows/release.yml"]
reason = "The repository diagram requires the supported ./ reference form. These jobs check out the repository before calling their own actions; the dedicated $/ spelling is a preference rather than a missing security contract here."

[[ignore]]
check = "dependencies/osv"
rule = "GHSA-ch52-4w7c-c8xp"
until = 2026-10-17
reason = "http-cache-semantics 4.2.0 is the newest release, and no release fixes it. Astro and the npm fetch client use it in the development tools; the static docs build shares no cached response between users."

[[ignore]]
check = "dependencies/osv"
rule = "GHSA-vfj7-8cjw-p6xm"
until = 2026-10-17
reason = "braces 3.0.3 is the newest release, and no release fixes it. micromatch pulls it into the development tools of this workspace, which expand only the patterns this repository writes."

# was tools.lychee.exclude
[[ignore]]
check = "docs/lychee"
paths = ["docs/src/content/docs/**"]
reason = "The site links are root-relative and resolve once Starlight builds it; its build validates them."

# was tools.lychee.exclude
[[ignore]]
check = "docs/lychee-external"
paths = ["docs/src/content/docs/**"]
reason = "The site links are root-relative and resolve once Starlight builds it; its build validates them."

[[ignore]]
check = "docs/stale-paths"
paths = ["FINDINGS.md", "findings/**"]
reason = "FINDINGS.md and findings/ record an audit, and they name files and folders the cleanup deletes and moves."

# was docs.exclude
[[ignore]]
check = "docs/stale-paths"
paths = ["packages/cli/configurations/*/*/rules/**"]
reason = "Shipped agent rules describe consumer projects. Their file paths are examples for those projects."

# was tools.jscpd.exclude
[[ignore]]
check = "duplication/jscpd"
paths = ["findings/implementation/**"]
reason = "These audit ledgers reproduce the original findings and their verification records. Repeated record fields preserve the required audit evidence rather than executable behavior."

[[ignore]]
check = "javascript/eslint"
rule = "package-json/require-exports"
paths = ["packages/cli/package.json"]
reason = "The gspot package exposes a command through bin and has no importable module API. Remove this exception if the package gains a module API."

[[ignore]]
check = "jest/coverage"
paths = ["tests/**"]
reason = "The suite uses bun:test. Jest is installed only to exercise the supported Jest adapter and plugin in test repositories."

[[ignore]]
check = "nextjs/tsc"
paths = ["tests/**"]
reason = "The test workspace installs Next.js for test application tests; its own sources contain no Next.js app or pages. The TypeScript check owns these sources."

[[ignore]]
check = "security/codeql"
rule = "js/bad-code-sanitization"
paths = ["packages/cli/src/generation/fragments.ts"]
reason = "JSON.stringify emits whole literals into a standalone ESLint module, never into an HTML script element."

[[ignore]]
check = "security/codeql"
rule = "js/file-system-race"
paths = [
    "tests/cli/commands/agents.test.ts",
    "tests/cli/checks/framework/nextjs/build.test.ts",
    "tests/cli/checks/language/swift/build/isolation.test.ts",
    "tests/tools/npm/project.test.ts",
    "tests/harness/preservation.ts",
]
reason = "Each test owns its temporary tree and is the only writer; the stat and the read it compares are the assertion."

[[ignore]]
check = "security/codeql"
rule = "js/http-to-file-access"
paths = ["packages/cli/scripts/grammars.ts"]
reason = "Every downloaded byte is checked against the pinned SHA-256 digest before the cache file is written."

[[ignore]]
check = "security/codeql"
rule = "js/incomplete-sanitization"
paths = ["packages/cli/src/checks/tool/actions.ts"]
reason = "Only the leading self-repository marker is translated; later dollar signs are path characters and must stay."

[[ignore]]
check = "security/codeql"
rule = "js/incomplete-sanitization"
paths = ["packages/cli/src/repository/revisions/push.ts"]
reason = "git check-ref-format validates every refspec first and permits at most one wildcard, so one replacement is complete."

[[ignore]]
check = "security/semgrep"
rule = "gspot.javascript.no-dynamic-require"
paths = ["packages/cli/src/tools/eslint/worker.ts"]
reason = "These configuration evaluators intentionally execute repository-selected modules and installed tool APIs in the configuration subprocess. Static imports select the CLI dependencies instead of the repository dependencies and cannot preserve executable configuration. Other security rules remain active for these exact files."

[[ignore]]
check = "security/semgrep"
rule = "gspot.javascript.no-dynamic-require"
paths = ["scripts/eslint-presets.ts"]
reason = "This explicit maintenance command imports the selected installed preset exports after validating each package name and exact manifest pin. Loading those local tool exports is its required behavior, not an application import of untrusted code."

# was tools.typos.exclude
[[ignore]]
check = "spelling/typos"
paths = ["findings/implementation/areas/repository.json"]
reason = "This audit ledger quotes the British spellings of proposed command names from the original review."

# was tools.typos.exclude
[[ignore]]
check = "spelling/typos"
paths = ["packages/cli/configurations/general/prose/styles/gspot/us-english.yml"]
reason = "The Vale substitution list names the British spellings it corrects."

# was tools.typos.exclude
[[ignore]]
check = "spelling/typos"
paths = [
    "tests/config/harness/spelling.ts",
    "tests/config/cli/execution/parse-output/formats.ts",
    "tests/config/cli/generation/eslint/runtimes.ts",
]
reason = "The spelling tests use deliberate misspellings; every other test file stays checked."

# was structure.folder_names_allowed
[[ignore]]
check = "structure/folder-names"
paths = [
    "tests/tools/configurations/language/bash",
    "tests/tools/configurations/language/swift",
    "tests/cli/checks/language/python",
    "tests/cli/checks/language/swift",
    "tests/cli/checks/language/bash",
    "tests/cli/checks/language/javascript",
    "tests/config/cli/checks/language/bash",
    "tests/config/cli/checks/language/swift",
    "tests/config/cli/checks/language/python",
    "tests/config/tools/configurations/language/bash",
    "tests/config/tools/configurations/language/typescript",
    "tests/config/tools/configurations/language/swift",
    "packages/cli/src/checks/language/bash",
    "packages/cli/src/checks/language/javascript",
    "packages/cli/src/checks/language/python",
    "packages/cli/src/parsers/python",
    "packages/cli/src/parsers/schema/python",
    "packages/cli/src/tools/python",
    "tests/cli/parsers/python",
    "tests/cli/tools/python",
    "tests/config/cli/tools/python",
    "tests/config/samples/python",
    "packages/cli/src/checks/language/swift",
]
reason = "Each directory belongs to a named language configuration or its tests. The TypeScript files implement or test that configuration."

# was structure.lone_files_allowed
[[ignore]]
check = "structure/lone-files"
paths = ["docs/src/pages/schema"]
reason = "Astro maps this directory to the published /schema/gspot.schema.json endpoint; moving the route changes the public schema URL."

# was structure.lone_files_allowed
[[ignore]]
check = "structure/lone-files"
paths = [
    "packages/cli/src/config/checks/database",
    "packages/cli/src/types/checks/database",
    "packages/cli/src/types/checks/library",
]
reason = "The database and library namespaces match the behavioral check owners. Repository policy keeps each owner's static constants and declarations in config and types even when that category currently has one file."

# was structure.lone_files_allowed
[[ignore]]
check = "structure/lone-files"
paths = [
    "tests/cli/checks/general/security",
    "tests/cli/docs",
    "tests/cli/parsers/naming",
    "tests/cli/policy/settings",
    "tests/config/cli/checks/general/security",
    "tests/config/cli/checks/language/bash",
    "tests/config/cli/checks/tool/xcode",
    "tests/config/cli/docs",
    "tests/config/cli/parsers/toml",
    "tests/config/cli/parsers/tool",
    "tests/config/cli/tools/python",
    "tests/config/tools/configurations/language/bash",
    "tests/types/cli/checks/framework",
    "tests/types/cli/checks/general",
    "tests/types/cli/checks/library",
    "tests/types/cli/docs",
    "tests/types/cli/execution",
    "tests/types/cli/generation",
    "tests/types/cli/tools",
    "tests/types/plugin/rules",
    "tests/types/tools/checks/supabase",
    "tests/types/tools/configurations/general",
    "tests/types/tools/generation",
    "tests/types/tools/lifecycle",
]
reason = "These suite namespaces follow their behavioral source owners. The docs tests stay under cli/docs, and each matching config or types namespace owns its suite data. Their placement follows the repository ownership contract even when an owner needs one file."

# was structure.prefix_collisions_allowed
[[ignore]]
check = "structure/prefix-collisions"
paths = ["docs/src"]
reason = "Astro fixes the name of the content configuration file beside the content folder."

# was structure.prefix_collisions_allowed
[[ignore]]
check = "structure/prefix-collisions"
paths = ["mise.toml", "mise.test.toml"]
reason = "Mise discovers the base file and its test environment overlay by these exact filenames."

# was structure.prefix_collisions_allowed
[[ignore]]
check = "structure/prefix-collisions"
paths = [
    "packages/cli/configurations/language/html",
    "packages/cli/configurations/language/markdown",
    "packages/cli/configurations/tool/docker",
]
reason = "A configuration template takes the name of the file it writes, and a tool names its own configuration files."

# was structure.prefix_collisions_allowed
[[ignore]]
check = "structure/prefix-collisions"
paths = ["packages/eslint-plugin/src/rules/**", "tests/plugin/rules/**", "tests/config/plugin/rules/**"]
reason = "ESLint rule ids are the file names, and the ids share their first word by convention."

[[ignore]]
check = "typescript/tsc"
paths = ["tests/**"]
reason = "The root compiler includes tests/**/*.ts. Running a second compiler for the tests scope would duplicate the same target."

[[ignore]]
check = "typescript/tsconfig"
paths = ["tests/**"]
reason = "The root tsconfig.json owns every test source and its required compiler options. The root check verifies that configuration."

[[ignore]]
check = "vitest/coverage"
paths = ["tests/**"]
reason = "The suite uses bun:test. Vitest is installed only to exercise its adapter and plugin in test repositories."

# drop: orphan comment from gspot.toml:577; it described nothing below it.
# The shipped agent rules are this repository's product.
```

## Appendix C: what init writes today and in the proposed format

Today (replayed `proposeText` for a TypeScript monorepo with two projects, hooks on, GitHub CI, mise, agent rules on; the configuration list is shortened):

```toml
#:schema https://gspot.dev/schema/gspot.schema.json

# The policy of this repository under gspot. Every setting has a command that writes it:
# gspot set, ignore, add, remove. Run gspot explain <anything> for what it means.

level = "recommended"
configurations = ["typescript", "javascript", "commits", "docs"]
run_with = "mise"

[[scope]]
path = "apps/web"
configurations = ["react", "react-dom", "nextjs"]

[[scope]]
path = "services/api"
configurations = ["nestjs"]

[tools.commitlint]
scopes = ["web", "api", "root", "hooks", "deps"]

[hooks]
[ci]
provider = "github"

[agent_rules]
folder = ".gspot/rules"
enabled = true
```

After `gspot ignore` twice, `gspot set tools.typos.words` twice, `gspot set naming.allowed`, `gspot set naming.banned`, and `gspot set tools.taplo.formatting --reason`, today's writer appends (replayed):

```toml
run_with = "mise"
tools.typos = {words = [{word = "udid", reason = "Apple's device identifier API name, used by the device manager."}, {word = "axe", reason = "The axe-core accessibility package name."}]}
tools.taplo = {formatting = {value = {compact_inline_tables = true}, reason = "This repository keeps its authored compact inline TOML tables."}}
...
[[ignore]]
check = "javascript/eslint"
rule = "no-console"
paths = [ "scripts/**" ]
reason = "Scripts print their results to the terminal."

[[ignore]]
check = "naming/paths"
paths = ["vendor/**"]
reason = "These upstream paths must match the published package."

[naming]
allowed = [
    {name = "noHelpersBesideTests", reason = "This binding owns the published ESLint rule no-helpers-beside-tests."},
]
banned = ["sync", "load"]
```

The same policy and edits in the proposed format:

```toml
#:schema https://generativespotting.com/schema/gspot.schema.json

level = "recommended"
configurations = ["typescript", "javascript", "commits", "docs"]
runner = "mise"

[scope."apps/web"]
configurations = ["react", "react-dom", "nextjs"]

[scope."services/api"]
configurations = ["nestjs"]

[hooks]
enabled = true

[ci]
provider = "github"

[agent_rules]
enabled = true

[naming]
banned = ["sync", "load"]

[naming.allowed]
noHelpersBesideTests = "This binding owns the published ESLint rule no-helpers-beside-tests."

[words]
axe = "The axe-core accessibility package name."
udid = "Apple's device identifier API name, used by the device manager."

[tools.commitlint]
scopes = ["web", "api", "root", "hooks", "deps"]

[tools.taplo.verbatim]
compact_inline_tables = true

[reasons]
"tools.taplo.verbatim" = "This repository keeps its authored compact inline TOML tables."

[[ignore]]
check = "javascript/eslint"
rule = "no-console"
paths = ["scripts/**"]
reason = "Scripts print their results to the terminal."

[[ignore]]
check = "naming/paths"
paths = ["vendor/**"]
reason = "These upstream paths must match the published package."
```

## Not read

- Every file in `packages/cli/src/policy/**`, `packages/cli/src/parsers/schema/**`, `packages/cli/src/config/policy/**`, `packages/cli/src/types/policy/**`, and `packages/cli/src/parsers/toml/**` was read in full.
- The writers were read in full: `commands/init/policy-text.ts`, `write.ts`, `plan.ts`, `commands/set.ts`, `ignore.ts`, `configurations.ts`, `export.ts`, `policy-edit.ts`.
- `docs/src/content/reference/schema.ts`, `policy.ts`, `page.ts`, and `docs/src/pages/schema/gspot.schema.json.ts` were read in full too.
- Read in part:
    - `commands/init/command.ts` (lines 1 to 60)
    - `lifecycle/reconcile.ts` (the writer path only)
    - `commands/apply.ts` (the policy write only)
    - `docs/src/content/reference/collection.ts` (grep only)
    - docs guides: `monorepos.md` (lines 1 to 65), `hooks.md` (1 to 60), `dependency-licenses.md` (15 to 45), `repository-checks.md` (grep only); `policy.md` and `exclude.md` in full
- The 56 configuration manifests were read through a script that lists every `[[setting]]`, plus targeted reads of the spelling, docs, naming, structure, files, format, security, python, and vitest manifests. Their check, tool, and config sections were not reviewed.
- Not read:
    - the ESLint plugin
    - the rest of `packages/cli/src` outside the files cited above
    - tests other than `tests/cli/policy/edit.test.ts`, `tests/cli/parsers/toml/layout.test.ts` (lines 1 to 80), and `tests/tools/configurations/general/files.test.ts` (lines 85 to 250)
