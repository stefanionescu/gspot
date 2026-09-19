# Names

This document decides how gspot names things (D-92). One word carries one meaning in the code,
the setting names, the manifest keys, the flags, and the folders. The glossary in
[README.md](README.md) holds the words and their one meaning. A row below leaves this document
in the commit that applies it.

## Rules a name follows

- A name passes the shipped naming policy. The verbs group bans `generate` and `render`, so the
  folder that writes the generated files is `emit/`, and `emit` means that and nothing else. The
  containers group bans `catalog`, so the keys a selection exposes are the `ExposedSettings`.
- A function that returns a boolean starts with `is`, `has`, `did` or one of the other prefixes
  the lint rule `unicorn/consistent-boolean-name` lists. `didWrite` writes a file and reports
  whether it changed, and the name says both.
- Two files in one folder do not share their first word. When a command has a second file, both
  move into a folder named after the verb: `lifecycle/init/command.ts` beside
  `lifecycle/init/plan.ts`. A command with one file is `<area>/<verb>-command.ts`.
- A list of entries that a gspot check skips has a key that ends in `_allowed`. A tool's own
  option keeps the tool's word, such as `tools.knip.ignore` and `tools.typos.exclude`.
- Every key of `gspot.toml` and of a manifest is snake_case, and a measure of all 199 settings
  found no other case. The words differ where the case does not, so one idea keeps one word:

    | The idea                             | The one word         | Today also                                                                                                         | Becomes                                                                                            |
    | ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
    | entries a gspot check skips          | ends in `_allowed`   | `tools.html.copy_excluded`, `tools.site.sitemap_excluded`, `architecture.allow`, `tools.licenses.exceptions`       | `copy_allowed`, `sitemap_allowed`, `architecture.edges_allowed`, `tools.licenses.packages_allowed` |
    | a rule of a tool turned off          | `[[ignore]]`         | `prose.disabled`, a second way for Vale alone                                                                      | `gspot ignore prose/vale --rule <id>`; the key goes                                                |
    | one folder                           | ends in `_directory` | `tools.postgres.migrations_dir`, `tools.supabase.functions_dir`, `tools.vitest.harness_dir`                        | `migrations_directory`, `functions_directory`, `harness_directory`                                 |
    | a list of file globs                 | ends in `_files`     | `tools.express.route_glob`, `tools.express.test_glob`, `tools.trpc.server_paths`, `tools.supabase.admin_key_paths` | `route_files`, `test_files`, `server_files`, `admin_key_files`                                     |
    | the option of a tool, under its name | the tool's word      | `tools.knip.ignore`, `tools.typos.exclude`, `tools.linkinator.skip`, `tools.lychee.exclude_paths`                  | stays                                                                                              |

    A preset name, a check name, and a command flag are kebab-case. A field of the JSON output is
    camelCase, as JSON from a JavaScript tool is. A test reads every manifest and refuses a
    setting whose last word is outside this table.

- A check name is `<family>/<name>`, and [04-presets.md](04-presets.md) says what the family is.

- A word a person reads in `gspot.toml`, in help text, in output, or in a guide is a word a
  developer already knows, or a plain phrase. A word this project made up stays inside the code.
- A name that a library fixes keeps the form the library asks for. The style folder Vale loads
  is one.

## Still to apply

| Today                                                                          | Where a person meets it                           | Becomes                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `[runner] surface`, `--runner <surface>`, "runner surface"                     | `gspot.toml`, `init --help`, the guide on mise    | `[runner] tool`, the shape of `[hooks] tool`. The word leaves the code too, where it also means exposed settings   |
| run record, `.gspot/last.json`, `run-record.schema.json`                       | `.gspot/`, the manual, `check --json`             | report: `.gspot/report.json`, `report.schema.json`                                                                 |
| `layer:` in rule files, "the project rule layer"                               | every installed rule file, `--help` of 3 commands | the key is deleted, because the folder says it, and the value differs from the folder today. "your own rule files" |
| `[inspection] strict`, "inspection"                                            | every `gspot.toml`                                | `[coverage] strict`                                                                                                |
| `[[declare]]`, `produced_by`, `gspot declare`                                  | `gspot.toml`, the command list                    | `[[generated]]`, `[[vendored]]`, and `gspot set generated` (D-131)                                                 |
| policy                                                                         | 40 places in help, output and guides              | config, in text a person reads. The file stays `gspot.toml`                                                        |
| nature, concern, engine, takeover, exposed settings                            | `doctor` output, `why` output, two guides         | a plain phrase each: "kind of file", "applies to every language", "built-in check", "replacing your old setup"     |
| "Re-render", "idempotent"                                                      | `apply --help`, `upgrade --help`, the mise task   | "Write the generated files again. Safe to run twice."                                                              |
| `render`, `RenderedSet`, `isRenderedHere`, `synced`                            | the code, more than 100 places (K-54)             | `emit`, `EmittedSet`, `isEmittedHere`, `applied`                                                                   |
| `src/apple/`, `src/pyproject/`, `tests/repositories/pyproject/`                | the code                                          | `checks/swift/`, `checks/python/`, `tests/repositories/python/` (D-128, D-146)                                     |
| `packages/cli/rules-lint`, `#rules-lint/*`                                     | the code (K-61)                                   | `packages/cli/src/rules/`, `#cli/rules/*`                                                                          |
| `--at`, `upgrade --check`, `--ci none`, `--keep-format`, `--project-templates` | `--help` of four commands                         | `--stage`, `--dry-run`, `--no-ci`, `--format keep` ([02-cli.md](02-cli.md))                                        |
| `hooks.tool = "shared"`                                                        | the stash `hooks-existing`                        | `existing` (D-101)                                                                                                 |
| `repository-check.test.ts`, `scope-languages.test.ts`                          | `tests/repositories/`                             | `declared-check.test.ts`, `scope-presets.test.ts` (D-113)                                                          |

preset, check, finding, ignore, scope, stage and profile stay: other tools use them
the same way.

## Check names that change family

A built-in check carries the family of the preset that ships it (D-146). The family `integrity`
keeps the checks over the config and the files gspot writes: `policy`, `generated-drift`,
`config-purity`, `suppressions`, `allowlists-match`, `task-policy`, and
`large-files`. Every other id moves, and the old id is an unknown id (D-134):

| Today                                                                             | Becomes                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `integrity/docs-headings`                                                         | `docs/headings`                                                                             |
| `integrity/stale-paths`                                                           | `docs/stale-paths`                                                                          |
| `integrity/lockfile-fresh`                                                        | `dependencies/lockfile-fresh`                                                               |
| `integrity/lockfile-hosts`                                                        | `dependencies/lockfile-hosts`                                                               |
| `integrity/manifest-policy`                                                       | `dependencies/manifest-policy`                                                              |
| `integrity/install-policy`                                                        | `dependencies/install-policy`                                                               |
| `integrity/tracked-dependencies`                                                  | `dependencies/tracked`                                                                      |
| `integrity/dependency-ownership`                                                  | `dependencies/ownership`                                                                    |
| `integrity/env-files`                                                             | `secrets/env-files`                                                                         |
| `integrity/gitleaks-baseline`                                                     | `secrets/gitleaks-baseline`                                                                 |
| `integrity/locales`                                                               | `i18n/locales`                                                                              |
| `integrity/css-usage`                                                             | `css/usage`                                                                                 |
| `integrity/typecheck-membership`                                                  | `typescript/typecheck-membership`                                                           |
| `integrity/tsconfig-options`                                                      | `typescript/tsconfig-options`                                                               |
| `integrity/required-rules`                                                        | `javascript/required-rules`                                                                 |
| `licenses/npm`                                                                    | `licenses/packages`                                                                         |
| `xcode/asset-catalogues`                                                          | `xcode/asset-catalogs`                                                                      |
| `structure/shell-interpreter`                                                     | `structure/shell-strict-mode`, `structure/shell-temp-trap`, `structure/shell-script-header` |
| `structure/trivial-function`, `python/trivial-function`, `swift/trivial-function` | the call-through check of each language                                                     |
| `vue/eslint`, `svelte/eslint`                                                     | `javascript/eslint`                                                                         |

Three more settings change with the same table: `tools.xcode.allowed_entitlements` becomes
`tools.xcode.entitlements_allowed`, `tools.licenses.allow` becomes `tools.licenses.licenses_allowed`,
and `tools.openapi.produced_by` becomes `tools.openapi.command`. The switches
`tools.docs.readme_shape` and `tools.xcode.orphan_assets` go, because `[[ignore]]` is the one way
to turn a check off (D-144).

## Names this repository allows itself

Every name of the rename table above was checked against the shipped banned terms, the reserved
terms, and the banned folder names. Three clash, and D-135 decides each one:

| Name                                                                                 | Clash                                           | Decision                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/cli/src/checks/swift/`, `.../checks/python/`, `tests/repositories/python/` | `swift` and `python` are banned folder names    | allowed in `gspot.toml`, as below.                                              |
| the level `core`                                                                     | `core` is a banned term of the containers group | the level is `recommended`, so no exception is needed                           |
| `tests/config/`                                                                      | `config` is a reserved term                     | none needed: a configuration folder is one of the uses the reserved term allows |

```toml
[[structure.folder_name_allowed]]
paths = ["packages/cli/src/checks/swift/**", "packages/cli/src/checks/python/**", "tests/repositories/python/**"]
reason = "Each folder holds the checks of one language, and the language is its name."
```

The exceptions the repository already holds are four `[[naming.rules]]` entries with
`exclude = true`. Each one keeps a spelling that another party fixes: the keys of a gitleaks
report, `packageManager` of `package.json`, the members Emscripten and libpg-query export, and
`shouldTranslate` of an Xcode string file. They stay.

Where the banned terms changed a name for the better, the name stays changed: `emit` for the
banned `render` and `generate`, `readPolicy` for the banned `load`, `ExposedSettings` for the
banned `catalog`. A library that fixes a word keeps it: `createFixture` of `fs-fixture`,
`__Snapshots__` of the snapshot library, `tmpdir` of Node.

## Names that stay

Long constants such as `COMMENT_STYLE_BY_EXTENSION` say what they hold and pass the naming
policy. The plugin rule names, such as `header-comments-before-imports`, follow the ESLint
convention of a full phrase. `engine.ts` exists once in each engine folder, because the folder
names the engine.
