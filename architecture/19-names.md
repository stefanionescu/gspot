# Names

This document decides how gspot names things (D-92). One word carries one meaning in the code,
the setting keys, the manifest keys, the flags, and the folders. The glossary in
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
- A check id is `<family>/<name>`, and [04-presets.md](04-presets.md) says what the family is.

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
| `[[declare]]`, `produced_by`, `gspot declare`                                  | `gspot.toml`, the command list                    | `[[generated]]` with `by`, `[[vendored]]`, and `gspot mark`                                                        |
| policy                                                                         | 40 places in help, output and guides              | config, in text a person reads. The file stays `gspot.toml`                                                        |
| nature, concern, engine, takeover, exposed settings                            | `doctor` output, `why` output, two guides         | a plain phrase each: "kind of file", "applies to every language", "built-in check", "replacing your old setup"     |
| "Re-render", "idempotent"                                                      | `apply --help`, `upgrade --help`, the mise task   | "Write the generated files again. Safe to run twice."                                                              |
| `render`, `RenderedSet`, `isRenderedHere`, `synced`                            | the code, more than 100 places (K-54)             | `emit`, `EmittedSet`, `isEmittedHere`, `applied`                                                                   |
| `packages/cli/rules-lint`, `#rules-lint/*`                                     | the code (K-61)                                   | `packages/cli/rules`, `#rules/*`                                                                                   |
| `--at`, `upgrade --check`, `--ci none`, `--keep-format`, `--project-templates` | `--help` of four commands                         | `--stage`, `--dry-run`, `--no-ci`, `--format keep` ([02-cli.md](02-cli.md))                                        |
| `hooks.tool = "shared"`                                                        | the uncommitted hooks work                        | `existing` (D-101)                                                                                                 |
| `repository-check.test.ts`, `scope-languages.test.ts`                          | `tests/repositories/`                             | `declared-check.test.ts`, `scope-presets.test.ts` (D-113)                                                          |

preset, check, finding, baseline, ignore, scope, stage and profile stay: other tools use them
the same way.

## Names that stay

Long constants such as `COMMENT_STYLE_BY_EXTENSION` say what they hold and pass the naming
policy. The plugin rule ids, such as `header-comments-before-imports`, follow the ESLint
convention of a full phrase. `engine.ts` exists once in each engine folder, because the folder
names the engine.
