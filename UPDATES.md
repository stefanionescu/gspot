# Updates

This file records an audit of the gspot repository, done on September 30, 2026. It lists what to delete, simplify,
rename, move, and replace with a library. Nothing here is fixed yet. The picture of the code is in
`architecture.png`.

The audit read `packages/cli`, `packages/eslint-plugin`, `tests`, and the repository root, and measured the import
graph of `packages/cli/src` with a script. The CLI source holds 409 files and 41,421 lines. The tests hold 506 files
and 46,920 lines.

## 1. Summary and order of work

The five biggest wins:

1. **Delete the `src/config` and `src/types` buckets.** 89% of the 663 constants in `packages/cli/src/config` and
   53% of the 402 types in `packages/cli/src/types` have exactly one user. Move each next to its user. The buckets
   exist because `gspot.toml` sets `types_directory` and `config_directory`, which contradicts the rule in
   `packages/cli/guides/general/code/NAMING-FILES.md`.
2. **Rename guides back to rules, everywhere,** and give every other meaning of "rules" its own name.
3. **Merge the 58 hand-written `openRoot` open and close blocks** into `using` and one `readText` helper, and merge
   the other duplicate helpers listed in section 7. This saves about 1,000 lines.
4. **Untangle the nine pairs of folders that import each other,** starting with `checks` and `execution`.
5. **Delete tests that check content instead of behavior,** and trim the slow acceptance tests that repeat faster
   ones. The slowest acceptance files take 4 to 8 minutes each.

Order of work, each stage one commit or a few:

| Stage | What                                                                | Size                    |
| ----- | ------------------------------------------------------------------- | ----------------------- |
| 1     | Fix the bugs in section 3                                           | small                   |
| 2     | Delete everything in section 5                                      | about 2,500 lines       |
| 3     | Rename: guides to rules, then the naming standard in section 8      | hundreds of files       |
| 4     | Move constants and types to their users; untangle the folder cycles | about 60 files moved    |
| 5     | Merge the duplicates in section 7                                   | about 1,000 lines saved |
| 6     | Replace hand-written code with libraries (section 6)                | about 800 lines saved   |
| 7     | Clean the tests (section 9) and the repository root (section 10)    | about 3,000 test lines  |

## 2. Answers to the questions asked

### Guides and rules

The installed Markdown for coding agents is called **rules** again. This is decided. Today one concept has three
names:

| Name   | Where                                                                                                                                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| guides | the folder `packages/cli/guides`, the policy table `[guides]`, the `--no-guides` flag, the manifest `[guides]` table, `.gspot/guides`                                                                                                                                                                    |
| agents | the source folder `packages/cli/src/agents`                                                                                                                                                                                                                                                              |
| rules  | `selectRuleFiles`, `assembleRules` and `RULES_PREFIX` in `packages/cli/src/agents/assemble.ts`; `lintRules` in `packages/cli/src/agents/lint.ts`; the types in `packages/cli/src/types/agents.ts`; the init option `rules` in `packages/cli/src/commands/init/command.ts:52`; `architecture/09-rules.md` |

Rename all of them to rules: the folder, the table, the flag, the installed folder under `.gspot`, the source folder, and the
identifiers. Then give the other meanings of "rules" their own names:

| Other meaning                 | Where                                                    | New name              |
| ----------------------------- | -------------------------------------------------------- | --------------------- |
| linter rule differences       | `packages/cli/src/lifecycle/rules`                       | `rule-diff`           |
| ast-grep rule files           | `packages/cli/kits/language/bash/rules`                  | `ast-grep`            |
| structure analysis table      | `RULES` in `packages/cli/src/config/checks/structure.ts` | `STRUCTURE_ANALYSES`  |
| naming patterns in the policy | `[[naming.rules]]`                                       | `[[naming.patterns]]` |

The documentation site also has a section called guides, for how-to pages. That name stays; it is not the agent
rules.

### `packages/cli/bin`

`packages/cli/bin/gspot` is two lines that run `packages/cli/src/main.ts` with Bun. Only this repository uses it:
`mise.toml` puts the folder on `PATH`, so the hooks of this repository run the source CLI. The published package
runs `packages/cli/dist/gspot.js` instead. The folder sits beside `dist` and looks like part of the package, and
it repeats the `gspot` task in `mise.toml`.

Action: move it out of the package, for example to a root `scripts/bin/gspot`, and point `mise.toml` at the new
place.

### `packages/cli/grammars`

It holds 9 tree-sitter WebAssembly files and their licenses. `packages/cli/scripts/inputs.ts` copies 8 of them out
of the `tree-sitter-*` devDependencies and downloads the Swift one. The published package needs them, because users
do not install devDependencies. `packages/cli/src/platform/assets.ts` reads them.

Action: in source mode, read the 8 files from `node_modules`, the way the web-tree-sitter runtime file is already
read. Copy them only in `packages/cli/scripts/build.ts`. Only the Swift file then needs a download cache.

### `packages/cli/dist` and the root `dist`

`packages/cli/dist` is the build output that npm publishes. It is ignored by Git and needed.

The root `dist` folder is different: 1.5 GB of the old per-system binaries, checksums, and npm stubs. The binary
release is gone from the build, and nothing writes that folder.

Action: delete the root `dist` folder and its line in `.gitignore`.

### Is kits the right name

`packages/cli/kits` holds 51 manifests. Each one says how to detect a technology, which tools to pin, which files to
generate, which checks to run, and which agent rules to install. Other names considered:

| Name     | For                                  | Against                                               |
| -------- | ------------------------------------ | ----------------------------------------------------- |
| kits     | short, used in every command and doc | says little about what is inside                      |
| presets  | common in linters                    | a preset is usually one config, not tools plus checks |
| packs    | short                                | vague as well                                         |
| stacks   | matches "your stack"                 | several kits make one stack                           |
| profiles | none                                 | taken: `gspot export` already writes profiles         |

Recommendation: keep kits. The old synonym "configuration" still survives in messages and comments, for example
`packages/cli/src/kits/manifests.ts:63` ("The configuration name is already registered"). Replace it with kit
everywhere.

### Script names

| Script                                | Does                                                                     | Action                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `packages/cli/scripts/inputs.ts`      | prepares the grammar files; the task is already called `prepare:grammar` | rename to `grammars.ts`; delete its commander setup, which only rejects arguments                               |
| `packages/cli/scripts/test-tools.ts`  | writes `.mise/conf.d/test-tools.toml`, the mise pins of every kit tool   | rename to `kit-tool-pins.ts`, and move `testToolsText` from `packages/cli/src/generation/tools/mise.ts` into it |
| `packages/cli/scripts/guides-lint.ts` | lints the agent rules                                                    | rename to `rules-lint.ts` with the rename above; it prints the wrong prefix today (section 3)                   |
| `packages/cli/scripts/build.ts`       | builds the package                                                       | keep; `EXECUTABLE_MODE` repeats `EXECUTABLE_FILE`                                                               |

### Config files with no blank lines

Confirmed: 17 of the 32 files in `packages/cli/src/config` have one blank line, after the header, and none between
groups. `packages/cli/src/config/generation.ts` runs from extension sets to GitHub Action pins to the Node version in
one block. All 32 headers share one sentence ("The literal values X reads: names, patterns, limits, and tables."),
and several name domains that do not exist.

The formatting is the small problem. The folder itself is the large one: 588 of its 663 exports have exactly one
importer. Action: move each constant into the module that uses it. Keep three small shared modules for what is
really shared: file modes, the `.gspot` paths, and exit codes. Delete `types_directory` and `config_directory` from
`gspot.toml` first, or the buckets come back.

### `packages/cli/src/execution/broken-tool.ts`

It decides whether a tool that exited with an error crashed or found something, classifies failures to start a
process, and shortens tool output for error messages. It also handles TruffleHog output as a special case. The
decision is needed; the file is not a clean unit.

Actions:

- Merge it into `packages/cli/src/execution/tool/findings.ts`, its main user.
- Move the TruffleHog branch into `packages/cli/src/checks/secrets/verified.ts`, which already builds the TruffleHog
  command. The same format has special cases in `packages/cli/src/execution/tool/runner.ts:67` and
  `packages/cli/src/execution/output/parse.ts:157` as well; fold them into the same place.
- Drop `export` from `isCrash` and `isToolBroken`.

### Why `.gspot` exists in this repository

gspot runs on its own repository. The tracked part is the generated configuration (`.gspot/config`, 82 files), the
installed agent rules (`.gspot/guides`, 43 files), the hooks, the tool manifests and locks, and the version pin. The
ignored part is the installed tools, the cache, the reports, the state, and the downloaded Vale styles.

One product problem shows here: 21 files under `.gspot/config/docs`, `.gspot/config/packages/cli` and
`.gspot/config/packages/eslint-plugin` are identical to the root ones. They come from scopes with `kits = []`. A
scope with no kits of its own does not need its own copies.

### Why `.ansible` exists

It holds three empty folders from September 27, 2026. ansible-lint creates them in its working folder.
`tests/integration/tools/flags.test.ts:56` runs every tool with `--help` in the repository root, ansible-lint
included, and that is the likely source. This repository does not use the ansible kit.

Action: delete `.ansible`, and run that test in a temporary folder.

## 3. Bugs found during the audit

| Where                                                                                                                                                                                 | Problem                                                                                                                                                                                                             | Action                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/cli/src/config/agents.ts:30`                                                                                                                                                | `RULES_ALONE` tells users to change `[rules]` in `gspot.toml`; the table is `[guides]` today                                                                                                                        | correct after the rename to rules                                |
| `packages/cli/guides/templates/docs`                                                                                                                                                  | 8 files ship in the package but are never installed; `packages/cli/guides/general/prose/DOCS-REVIEW.md:178` tells agents they exist                                                                                 | delete the folder, the sentence, and the template layer handling |
| `packages/cli/scripts/guides-lint.ts:14`                                                                                                                                              | prints `rules/` before each file, but the folder is `guides`                                                                                                                                                        | fix with the rename                                              |
| `packages/cli/src/platform/assets.ts:58`, `packages/cli/scripts/build.ts:15`                                                                                                          | tell users to run `mise run prepare:grammar`, a task that exists only in this repository                                                                                                                            | say the package is broken and should be reinstalled              |
| `packages/cli/package.json`                                                                                                                                                           | `prettier` is a runtime dependency; nothing in `packages/cli/src` loads it                                                                                                                                          | remove it                                                        |
| `mise.toml` (`guides:lint`)                                                                                                                                                           | runs `bash`, `docker`, `fastapi`, `ruff` and `typescript` test files under `tests/integration/tools/generation`; the example tests moved to `tests/integration/tools/guides`, and the TypeScript file there is gone | point the task at `tests/integration/tools/guides`               |
| `gspot.toml` (`guides/lint` check)                                                                                                                                                    | its paths list the old test folder and miss `tests/integration/tools/guides`                                                                                                                                        | fix the paths                                                    |
| `gspot.toml` (`naming.contract_properties`)                                                                                                                                           | two entries name a deleted hook test and a `fail_fast` property that no longer exists                                                                                                                               | delete both                                                      |
| `gspot.toml` (`tools.typos` words)                                                                                                                                                    | `virtua` and `referers` appear in no tracked source                                                                                                                                                                 | delete both                                                      |
| `tests/support/package/run.ts:43`                                                                                                                                                     | `process.removeListener` receives new arrow functions, so no listener is removed                                                                                                                                    | keep the handlers in variables and remove those                  |
| `tests/timings/windows.json`                                                                                                                                                          | a copy of `tests/timings/linux.json`; Bun reports Windows paths with backslashes, so no key matches, and it holds a deleted file                                                                                    | regenerate from a Windows run                                    |
| `packages/cli/src/checks/structure/directories.ts:22`, `packages/cli/src/checks/structure/single-file-folder.ts:33`                                                                   | test only `.d.ts`, missing `.d.mts` and `.d.cts`                                                                                                                                                                    | use the shared declaration extension list                        |
| `packages/cli/src/commands/ignore.ts:51`, `packages/cli/src/generation/eslint/blocks.ts:133`, `packages/cli/src/policy/write.ts:187`, `packages/cli/src/policy/setting-surface.ts:14` | compare values with `JSON.stringify`, which depends on key order                                                                                                                                                    | use `isDeepStrictEqual`, as the rest of the code does            |
| `packages/cli/src/execution/fixers.ts:215`                                                                                                                                            | diff headers use platform paths, so Windows gets backslashes                                                                                                                                                        | use forward slashes, like `packages/cli/src/lifecycle/drift.ts`  |
| `packages/cli/src/commands/ignore.ts:33`                                                                                                                                              | builds TOML by hand and puts `check` and `rule` in without escaping                                                                                                                                                 | use the TOML library                                             |
| `packages/cli/src/config/kits.ts:65`                                                                                                                                                  | a comment reads "length-guidenames", left by a bulk rename                                                                                                                                                          | fix the word                                                     |
| `packages/cli/src/output/report.ts:61` and `packages/cli/src/config/output.ts:3`                                                                                                      | `report.json` is written with indent 4, JSON on standard output with indent 2                                                                                                                                       | use one indent                                                   |

## 4. Architecture

### Layers today

The folders of `packages/cli/src`, from the top down. The numbers are files and lines.

| Layer         | Folders                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| entry         | `main.ts`; `commands` (38, 4,357)                                                                                                       |
| orchestration | `execution` (23, 3,470), `generation` (21, 2,179), `lifecycle` (23, 2,569), `policy` (27, 3,224), `kits` (11, 1,333), `agents` (6, 565) |
| domain        | `checks` (147, 12,352), `tools` (15, 1,993), `repository` (21, 2,809), `native` (4, 237)                                                |
| services      | `parsers` (5, 624), `output` (4, 474)                                                                                                   |
| base          | `platform` (12, 1,218), `config` (32, 2,191), `types` (19, 1,822)                                                                       |

What holds up well: no file imports itself through a chain of value imports, and the base layer (`platform`,
`config`, `types`, `parsers`) imports nothing above it.

### Folders that import each other

Nine pairs. Each needs one direction removed.

| Pair                     | Edges                                                                                                                                                                      | Fix                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| checks and execution     | 50 imports from checks into execution; 17 back, mostly `packages/cli/src/execution/engines.ts` importing single checks and 84 users of `packages/cli/src/checks/result.ts` | move the finding model out of `checks`; one analysis registry (below) |
| checks and policy        | `packages/cli/src/policy/tools.ts` imports the Jest schema; `packages/cli/src/policy/audit.ts` imports the naming policy                                                   | move both schemas into `policy`                                       |
| kits and policy          | `packages/cli/src/policy/schema.ts` imports kit schemas; `packages/cli/src/kits/select.ts` and `packages/cli/src/kits/manifests.ts` import policy helpers                  | move the shared schemas and `similar.ts` below both                   |
| kits and repository      | `packages/cli/src/repository/existing-tooling.ts` imports `packages/cli/src/kits/manifests.ts`                                                                             | move existing-tooling detection into `kits` or `commands/init`        |
| lifecycle and tools      | `packages/cli/src/tools/installation.ts` runs `installHooks`; `packages/cli/src/lifecycle/drift.ts` calls the lock drift of tools                                          | move the `gspot install` steps to `commands`; pass lock drift in      |
| lifecycle and repository | `packages/cli/src/repository/revisions/dependencies.ts` imports the ownership owner                                                                                        | pass the installation state in                                        |
| repository and tools     | `packages/cli/src/repository/revisions/dependencies.ts` imports `packages/cli/src/tools/vale.ts`                                                                           | move Vale package copying to `tools`                                  |
| generation and lifecycle | `packages/cli/src/generation/outputs.ts` imports managed blocks; `packages/cli/src/lifecycle/hooks.ts` imports the hook generator                                          | move `managed-blocks.ts` below both                                   |
| agents and policy        | `packages/cli/src/policy/validate.ts` imports `packages/cli/src/agents/assemble.ts`, which imports `packages/cli/src/policy/similar.ts`                                    | move `similar.ts` to `platform`                                       |

Two more cycles run through type-only imports: `packages/cli/src/types` imports `z.infer` schemas from 16
implementation modules. Moving types next to their schemas removes both.

### Three ways to dispatch an analysis

1. A check with an engine goes through `packages/cli/src/checks/dispatch.ts`, which spreads 16 per-family
   `analyses.ts` files. Some are 7 lines, such as `packages/cli/src/checks/express/analyses.ts`.
2. The prose engine is an inline switch in `packages/cli/src/execution/engines.ts`.
3. An analysis with no engine uses a second map in the same file.

The manifest key `analysis` means different things depending on whether `engine` is set. Action: one registry keyed
by analysis name; delete the 16 `analyses.ts` files and both maps.

### Other layer problems

- `packages/cli/src/execution/engines.ts` wires the generated-drift analysis by hand and pulls in `generation` and
  `lifecycle`. Move it into its check.
- `packages/cli/src/checks/xcode/project/checks.ts` needs only two git readers, but imports
  `packages/cli/src/repository/revisions/contents.ts`, whose `useRevision` drags in revisions, Vale, tool lookup, and
  all of `policy`. The longest import chain from `main.ts` is 27 steps because of it. Split `contents.ts` into git
  object reading and revision snapshots.
- `packages/cli/src/repository/tracked.ts` has 71 importers, 52 of which only want `readSource`. Move `readSource`
  and the read cache into their own module.
- `packages/cli/src/platform/arguments.ts` mixes shell quoting with commander helpers used only by `commands`. Move
  the helpers to `commands`.
- `packages/cli/src/repository/hooks.ts` holds only the policy `[hooks]` schema, and `packages/cli/src/policy/runner.ts`
  only the runner schema. Merge both into `packages/cli/src/policy/schema.ts`.
- `packages/cli/src/native` is the ESLint configuration process: `process.ts` is the child, `configuration.ts` the
  launcher. Rename the folder `eslint-process` with `child.ts` and `launch.ts`.

### Large files and repeated names

Files near the 300-line limit that hold several jobs: `packages/cli/src/types/checks.ts` (378 lines, 93 types for
about 40 checks), `packages/cli/src/execution/tool/runner.ts`, `packages/cli/src/repository/tracked.ts`,
`packages/cli/src/policy/settings.ts`, `packages/cli/src/config/checks/structure.ts` (Bash, Swift, and Python tables
mixed).

Repeated file names: `kits.ts` 4 times, `tools.ts` 4, `policy.ts` 6, `hooks.ts` 3, `report.ts` 3, `coverage.ts` 3,
`log.ts` 2. Repeated export names with different meanings: `directoryOf`, `kindOf`, `isOwned`, `styleFiles`,
`readProject`, `reportSchema`, `kitSection`, `tableAt`, `LOCKS`, `DIRECTIVE`.

## 5. Delete

### Code that ships but only this repository uses

| What                                                                                          | Lines | Action                         |
| --------------------------------------------------------------------------------------------- | ----- | ------------------------------ |
| `packages/cli/src/agents/lint.ts`, `examples.ts`, `metadata.ts`                               | 318   | move to `packages/cli/scripts` |
| 14 constants in `packages/cli/src/config/agents.ts`, including lists of other projects' names | ~60   | move with the linter           |
| `testToolsText` in `packages/cli/src/generation/tools/mise.ts`                                | 11    | move into the script           |
| `packages/cli/src/kits/manifest-problems.ts`: validates the 51 shipped manifests on every run | 266   | run it in a test instead       |
| `packages/cli/src/execution/report.ts`: zod schemas that never parse anything                 | 54    | replace with plain types       |

### Exports

- 36 exports are used only inside their own file; drop `export`. Knip misses them because of
  `ignoreExportsUsedInFile` in `.gspot/config/knip.json`. Examples: 4 in `packages/cli/src/checks/cloudflare.ts`,
  4 in `packages/cli/src/checks/sql.ts`, 6 in `packages/cli/src/policy/normalize.ts`.
- 49 exports are used only by tests. `setEnvironmentVariable` in `packages/cli/src/platform/environment.ts` and
  `appendEntry` in `packages/cli/src/policy/write.ts` are called nowhere at all; delete them.
- `readOwnership` in `packages/cli/src/lifecycle/ownership/owner.ts` takes a second parameter nobody passes.

### Migration code and support for old formats

gspot has no release yet, so nothing old needs support.

| What                                                                                                                                   | Action                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `packages/cli/src/lifecycle/ownership/log.ts:183`: drops retired records of an older gspot on every open (added on September 30, 2026) | delete                                |
| `LIFECYCLE_PRIVATE_PATH` in `packages/cli/src/config/platform.ts`: still matches the old state locations                               | match `.gspot/state` only             |
| npm lockfile version 1 in `packages/cli/src/repository/locked-packages.ts`                                                             | delete                                |
| pnpm version 5 and 6 keys in the same file                                                                                             | support version 9 only                |
| binary `bun.lockb` in `packages/cli/src/config/repository/repository.ts` and 4 other files                                             | delete unless old Bun setups matter   |
| `CACHE_FORMAT = 5` in `packages/cli/src/config/execution/execution.ts`                                                                 | reset to 1                            |
| the policy version gate in `packages/cli/src/policy/read.ts` and the schema                                                            | use `z.literal(1)` in the schema only |
| the CommonJS build of `packages/eslint-plugin` (`plugin.cjs`) for a plugin that needs ESLint 9.38 or newer                             | ship ESM only                         |
| ticket numbers such as K-48, K-93, K-274 in comments, for example `packages/cli/src/kits/schema.ts:164`                                | delete; they point nowhere            |

### Suppressions

122 of the 127 `eslint-disable` comments are `gspot/no-trivial-functions`, spread over 75 files. Many wrap a single
call, and 12 give test usage as the reason for a production wrapper. Inline them, starting with `languageKits` and
`sourceKits` in `packages/cli/src/kits/select.ts`, `internalLinks` and `externalLinks` in
`packages/cli/src/checks/static-site/output-checks.ts`, `seconds`, `fileCount` and `scopeName` in
`packages/cli/src/output/reporter.ts`, and `toolCheck` in `packages/cli/src/execution/engines.ts`.

### Files and folders

| What                                                                            | Action                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| root `dist` (1.5 GB)                                                            | delete, with its `.gitignore` line                                  |
| `.ansible`, `.ruff_cache`                                                       | delete; see section 2 for the cause of `.ansible`                   |
| 18 empty folders under `tests` that Git does not track                          | delete                                                              |
| `architecture/levels/inventory.csv` (1 MB) and `architecture/levels/native.csv` | delete: nothing reads them, and 31 rows disagree with the manifests |
| the second test preload in `bunfig.toml`, which `tests/bunfig.toml` repeats     | delete one                                                          |
| the empty, untracked folder lifecycle under `packages/cli/src/config`           | delete                                                              |

## 6. Replace with libraries

| Hand-written code                                                                                           | Lines | Library                                                      | Already a dependency | Saves        |
| ----------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------ | -------------------- | ------------ |
| glob walker, `globPaths` in `packages/cli/src/platform/paths.ts`                                            | ~110  | `tinyglobby` (built on picomatch)                            | no                   | ~100         |
| TOML layout after editing, `packages/cli/src/policy/toml`                                                   | 254   | Taplo formatter (`@taplo/lib`)                               | no                   | ~230         |
| JSON layout copied from Prettier, `packages/cli/src/generation/json-format.ts`                              | 70    | Prettier `format` with the JSON parser                       | yes                  | ~65          |
| libpg-query memory read by pointer offsets, `packages/cli/src/parsers/sql/parser.ts`                        | ~70   | the library functions `parse` and `parsePlPgSQL`             | yes                  | ~40          |
| front matter parser, `packages/cli/src/agents/metadata.ts`                                                  | ~20   | `yaml`                                                       | yes                  | ~8           |
| fence and list detection by line, `packages/cli/src/agents/lint.ts`                                         | ~50   | mdast, as `packages/cli/src/checks/docs/fences.ts` does      | yes                  | ~50          |
| GitHub workflow built from strings, `packages/cli/src/generation/workflow.ts`                               | ~150  | `yaml` documents, as the GitLab file in the same module does | yes                  | ~20          |
| TOML built from strings, `packages/cli/src/generation/tools/mise.ts`, `packages/cli/src/commands/ignore.ts` | ~40   | the TOML library                                             | yes                  | ~25          |
| Levenshtein distance, `packages/cli/src/policy/similar.ts`                                                  | ~18   | `fastest-levenshtein`                                        | indirect             | ~18          |
| `.gitattributes` parser, `packages/cli/src/repository/kind.ts`; its matching differs from Git               | ~30   | `git check-attr`                                             | not needed           | ~25          |
| pbxproj reader, `packages/cli/src/checks/xcode/project/reader.ts`                                           | 262   | `@bacons/xcode` (needs a trial)                              | no                   | ~200         |
| binary file detection and extension list                                                                    | ~45   | `isbinaryfile`, `binary-extensions`                          | no                   | ~40          |
| cache home and CI detection, `packages/cli/src/platform/environment.ts`                                     | ~15   | `env-paths`, `std-env`                                       | indirect             | ~12          |
| typed commander flags, `packages/cli/src/platform/arguments.ts`                                             | ~40   | `@commander-js/extra-typings`                                | no                   | ~35          |
| `packages/cli/src/platform/code-points.ts`                                                                  | 12    | `Array.from`                                                 | built in             | 12           |
| member and string helpers in `packages/eslint-plugin/src/environment.ts` and `files.ts`                     | ~10   | `ASTUtils` from `@typescript-eslint/utils`                   | yes                  | ~10          |
| smol-toml and toml-patch side by side                                                                       | n/a   | toml-patch alone (it also parses and prints)                 | yes                  | 1 dependency |

Kept on purpose: SARIF (node-sarif-builder), ignore files (`ignore`), licenses (spdx), versions (semver), diffs
(`diff`), workspaces (manypkg), the nginx tokenizer, and the process supervision in
`packages/cli/src/platform/spawn.ts`.

A product decision, not a cleanup: the length sorting of imports and exports in `packages/eslint-plugin` (about 250
lines) matches `eslint-plugin-perfectionist` with `type: 'line-length'`.

## 7. Merge duplicates

| What                                  | Copies                       | Where (examples)                                                                                                                                         | Merge into                                          |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| open a root, try, close               | 58                           | across `packages/cli/src`; 6 one-off reads never close, such as `packages/cli/src/lifecycle/version-pin.ts:16`                                           | `Symbol.dispose` on `Root`, `using`, and `readText` |
| check that bytes are UTF-8            | 13                           | `packages/cli/src/repository/manifests.ts:13`, `packages/cli/src/checks/python/project.ts:44`                                                            | `isUtf8` from `node:buffer` in one helper           |
| parse JSON with comments              | 5                            | `packages/cli/src/repository/jsonc.ts`, `packages/cli/src/generation/pointers.ts`, `packages/cli/src/checks/cloudflare.ts`                               | `packages/cli/src/repository/jsonc.ts`              |
| pick a parser by file extension       | 4                            | `packages/cli/src/repository/configuration-section.ts`, `packages/cli/src/lifecycle/configuration/document.ts`                                           | one table                                           |
| get a value by dotted path            | 6                            | `packages/cli/src/execution/output/json.ts:5`, `packages/cli/src/policy/read.ts:84`, `packages/cli/src/policy/write.ts:28`                               | one helper                                          |
| is it a plain object                  | 7                            | `packages/cli/src/policy/normalize.ts:17`, `packages/cli/src/policy/write.ts:10`, `packages/cli/src/generation/json-format.ts:10`                        | one helper                                          |
| forward-slash paths                   | 8                            | `toPosix` in `packages/cli/src/platform/paths.ts` and inline `split(sep).join('/')` in 7 files                                                           | `toPosix`                                           |
| last path segment                     | ~25                          | `baseName` in `packages/cli/src/platform/paths.ts` and inline `lastIndexOf('/')`                                                                         | `posix.basename`                                    |
| path inside a root                    | 7                            | `packages/cli/src/platform/filesystem.ts:26`, `packages/cli/src/execution/result-cache.ts:16`                                                            | one helper                                          |
| path inside a scope                   | ~20                          | `isInScope` in `packages/cli/src/repository/paths.ts` exists; `packages/cli/src/execution/planning/files.ts` writes it out 4 times                       | `isInScope`                                         |
| directory walkers                     | 8                            | `packages/cli/src/tools/vale.ts`, `packages/cli/src/checks/swift/cache.ts`, `packages/cli/src/repository/tracked.ts`                                     | one walker; keep the link-safe ones                 |
| upward search for a file              | 4                            | `packages/cli/src/repository/tracked.ts`, `packages/cli/src/platform/assets.ts`, `packages/cli/src/tools/locate.ts`                                      | `empathic` or one helper                            |
| run git                               | ~10                          | `packages/cli/src/repository/revisions/git-queries.ts`, `packages/cli/src/repository/revisions/contents.ts`, `packages/cli/src/repository/git-config.ts` | one git module, with one timeout                    |
| `run` and `runBinary`                 | 2                            | `packages/cli/src/platform/spawn.ts`                                                                                                                     | one function with an encoding option                |
| sha256 hex                            | 12                           | `packages/cli/src/execution/cache.ts`, `packages/cli/src/lifecycle/ownership/log.ts`                                                                     | one helper                                          |
| per-run cache of promises             | 10                           | `packages/cli/src/parsers/tree-sitter.ts:9`, `packages/cli/src/checks/postgres/history.ts:7`                                                             | one helper                                          |
| temporary folder and cleanup          | 17                           | `mkdtempSync` followed by removal in a `finally`                                                                                                         | one disposable helper                               |
| offset to line number                 | ~10                          | `packages/cli/src/parsers/sql/statements.ts:47`, `packages/cli/src/parsers/comments.ts`                                                                  | one helper                                          |
| comment alone on its line             | 5 + 4                        | `packages/cli/src/parsers/comments.ts` and the plugin rules                                                                                              | one helper per package                              |
| trivial and duplicate function checks | 3 languages                  | `packages/cli/src/checks/python/functions.ts`, `packages/cli/src/checks/swift/bodies.ts`, `packages/cli/src/checks/bash/duplicate-functions.ts`          | one generic check per rule                          |
| lockfile name tables                  | ~9                           | `packages/cli/src/config/repository/repository.ts`, `packages/cli/src/config/tools/packages.ts`, `packages/cli/src/repository/locked-packages.ts`        | one table                                           |
| extension to language tables          | 4                            | `packages/cli/src/config/repository/repository.ts`, `packages/cli/src/config/checks/repository.ts`; `linguist-languages` is a dependency                 | `linguist-languages`                                |
| what counts as a test file            | 4                            | `packages/cli/src/config/generation.ts`, `packages/eslint-plugin/src/config/import-direction.ts`, `packages/cli/src/config/checks/naming.ts`             | one definition; today they disagree                 |
| exit code 2                           | 6 names                      | `ERROR_EXIT`, `CANCELED_EXIT`, `INVALID_INPUT_EXIT`, `INCOMPLETE_INSTALL_EXIT`, `UNREADABLE_EXIT`, `UNABLE_EXIT`                                         | one constant                                        |
| the `.gspot` folder name              | ~86 literals and 3 constants | `GSPOT_FOLDER`, `GSPOT_DIRECTORY`, `MANAGED_PREFIX`                                                                                                      | one constant                                        |
| other repeated numbers                | pairs                        | 1000, 1024, 100, the file modes 0o755 and 0o644, the newline byte                                                                                        | one constant each                                   |
| installation state writes             | 2                            | `packages/cli/src/lifecycle/ownership/owner.ts:26` and `packages/cli/src/lifecycle/ownership/installs.ts`                                                | `installs.ts`                                       |

## 8. Naming

### The standard

`packages/cli/guides/general/code/NAMING.md` already sets it: `get` for retrieval, `parse` for text to structure,
`build` or `make` to construct, `assert` to stop on failure, and `is`, `has`, `can` for predicates. The code does
otherwise: 33 functions start with `read`, 51 end in `Of` (`extensionOf`, `kindOf`), and 34 end in `For`
(`cacheKeyFor`, `toolFor`). Either rename the code to the guide or change the guide. Pick one before stage 3.

Wrong verbs today: `readProject` in `packages/cli/src/checks/xcode/project/reader.ts` parses text; `readOption` in
`packages/cli/src/lifecycle/rules/vale.ts` and `readDirective` in `packages/cli/src/lifecycle/rules/shellcheck.ts`
parse strings. `parseJson` in `packages/cli/src/execution/output/json.ts` turns tool output into findings.

### One concept, several names

| Concept                    | Names today                                                                                    | Standard                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| a folder                   | folder (38 identifiers), directory (60)                                                        | directory                                                               |
| a list of paths            | `files` for the root handle (107), for tracked files (27), for strings (7); `paths` (43)       | `paths` for strings, `trackedFiles`, and a distinct name for the handle |
| installations              | `installations` (in progress) beside `installs` (finished) in the ownership log                | `pendingInstallations` and `installed`                                  |
| cache functions            | `cacheKey` and `cacheKeyFor`, `readCached` and `cachedResult`, `writeCached` and `storeResult` | one verb pair                                                           |
| private before public rule | `private-before-public`, `private-below-public`, `private-below-shared`                        | `private-before-public`                                                 |
| a kit                      | kit, configuration                                                                             | kit                                                                     |
| agent rules                | guides, agents, rules                                                                          | rules (section 2)                                                       |

### Misleading names

| Name                                                                           | Is really                        | Rename                                           |
| ------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------ |
| `buildFolder` in `packages/cli/src/platform/paths.ts`                          | the Swift cache folder           | `swiftCacheDirectory`                            |
| `afterWrite` in `packages/cli/src/platform/root/writes.ts`                     | an atomic write                  | `writeAtomically`                                |
| `privateTarget`, `mutationTarget` in `packages/cli/src/platform/safe-paths.ts` | validators                       | `assertPrivateTarget`, `assertMutationTarget`    |
| `head` in `packages/cli/src/repository/tracked.ts`                             | the first bytes of a file        | `readPrefix`                                     |
| `packages/cli/src/native`                                                      | the ESLint configuration process | `eslint-process`                                 |
| `packages/cli/src/lifecycle/log.ts`                                            | the ownership log schema         | move into `packages/cli/src/lifecycle/ownership` |
| `o` for options in 10 command functions                                        | options                          | `options`                                        |

Also: 12 files repeat their folder name (a file named after its folder inside `packages/cli/src/config` and `packages/cli/src/types`, and `packages/cli/src/checks/openapi/openapi.ts`), several
files inside `checks` are named `checks.ts`, and abbreviations such as `dir`, `rel`, `sub` and `fn` remain.

## 9. Tests

### Tests of content or layout, not behavior

| Test                                                                   | What it asserts                                                                                          | Action                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `tests/integration/repository/test-tools.test.ts`                      | a generated file equals its generator output                                                             | delete; declare the file generated so drift checking covers it                |
| `tests/integration/docs/example.test.ts`                               | the README and quick start contain strings from the example                                              | delete; `tests/acceptance/source/cli/example.test.ts` replays the example     |
| `tests/unit/plugin/configuration.test.ts:18`                           | the plugin README contains the example text                                                              | delete these lines                                                            |
| `tests/integration/docs/reference.test.ts`                             | exact strings of reference pages built from the real kits, and a title for every command, check and rule | use synthetic manifests, as two of its tests do; keep one sample of each kind |
| `tests/unit/cli/agents/examples.test.ts`                               | the code fences in the shipped rules use allowed languages                                               | move into the rules linter                                                    |
| `tests/integration/cli/generation/guides.test.ts:42`                   | headings in 14 real guides at each level                                                                 | keep one guide; the filter has a unit test                                    |
| `tests/integration/cli/generation/level-contract.test.ts:15` and `:34` | a constant lacks a key; kit default numbers                                                              | delete those lines                                                            |
| `tests/unit/cli/checks/naming/validate-name.test.ts:126`               | loops over the whole shipped term list                                                                   | test one term                                                                 |
| `tests/unit/cli/policy/messages.test.ts`                               | the wording of every message builder                                                                     | delete, with its ignore in `gspot.toml`                                       |
| `tests/integration/cli/completion.test.ts:25`                          | completion lists every command and flag, which commander builds                                          | keep one command and one flag                                                 |
| `tests/integration/tools/flags.test.ts:119` and `:132`                 | every manifest flag appears in the tool's help text (55 seconds)                                         | check tool names when manifests load; decide on the help match                |
| `tests/acceptance/package/pins.test.ts:53`                             | every pin exists on its registry, one network call each                                                  | move to a scheduled job                                                       |
| `tests/integration/docs/examples.test.ts`                              | TOML blocks in the docs parse                                                                            | move to a docs check                                                          |
| `tests/integration/repository/acceptance.test.ts`                      | the acceptance test harness                                                                              | delete unless the harness breaks                                              |

### Slow tests that repeat faster ones

| Test                                                               | Time   | Repeats                                                             | Action                                                     |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `tests/acceptance/source/kits/static-site.test.ts`                 | 494 s  | `tests/integration/cli/checks/site-build.test.ts`                   | keep one end-to-end case                                   |
| `tests/acceptance/source/kits/codeql.test.ts`                      | 278 s  | its level matrix: the level does not change CodeQL                  | drop the `all` level                                       |
| `tests/acceptance/source/kits/nextjs/selection.test.ts`            | 271 s  | `tests/integration/cli/generation/framework-rules.test.ts`          | delete the repeated cases                                  |
| `tests/acceptance/source/kits/components.test.ts`                  | 188 s  | one planted defect per third-party rule                             | one case per framework                                     |
| `tests/acceptance/source/kits/react.test.ts`                       | 172 s  | the same, for React                                                 | one case                                                   |
| `tests/acceptance/source/kits/python/docstrings.test.ts`           | 105 s  | `tests/unit/cli/checks/python/docstrings.test.ts`                   | keep one case                                              |
| `tests/acceptance/source/cli/lifecycle/performance.test.ts`        | varies | wall-clock limits on shared CI runners                              | move to a manual benchmark                                 |
| `tests/acceptance/source/cli/uninstall.test.ts`                    | short  | `tests/acceptance/source/cli/lifecycle/uninstall.test.ts`           | merge                                                      |
| `tests/unit/cli/kits/sections.test.ts`                             | short  | `tests/unit/cli/lifecycle/rule-diff.test.ts`; the name is wrong too | merge                                                      |
| the two `parameter-limits.test.ts` files under `tests/integration` | short  | each other                                                          | merge into the tools one                                   |
| `.gspot/version` written by apply and init                         | short  | asserted in 5 places                                                | keep `tests/integration/cli/lifecycle/version-pin.test.ts` |

Same-named pairs under `tests/integration/cli` and `tests/integration/tools` (licenses, lockfile freshness,
Supabase, Vale, suppressions) test a stub and the real tool. They are not duplicates, but the names confuse.

### Test support

- `tests/inputs` copies the folder tree of the tests, and most of its exports have one user. Put single-use values
  back into their test and shared fixtures into a fixtures folder under `tests/support`.
- Init arguments are written four ways: `initArgs` in `tests/support/cli/init.ts`, `QUIET_INIT` in
  `tests/inputs/cli.ts`, 7 constants in `tests/inputs/acceptance/source/kits/init-arguments.ts`, and 19 inline
  arrays. Keep `initArgs`.
- Timeouts live in 8 files. Put them in one.
- The repository root is computed 12 times with `fileURLToPath`, although `tests/support/package/packages.ts`
  exports it. Put it in one place.
- `run` in `tests/support/cli/command.ts` (111 users) clashes with `run` in the CLI (65 users), so tests rename it
  four different ways. Rename the test one `runGspot`.
- Scripts live in `tests/support`: `tests/support/acceptance.ts`, `tests/support/package/run.ts`,
  `tests/support/registry/workspace-command.ts`, `tests/support/cli/swiftformat.ts`. Move them to a scripts folder.
- 5 test files sit at the top of `tests/unit/cli` while matching folders exist, for example
  `tests/unit/cli/sql-parser.test.ts`.
- `tests/types` exists because `types_directory` forces it; it goes with the change in section 2.

## 10. Repository root, tasks, and scripts

| What                                     | Problem                                                                                                                                                                   | Action                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `AGENTS.md` and `CLAUDE.md`              | identical; gspot writes its block into both                                                                                                                               | keep one, if every agent in use reads `AGENTS.md` |
| `.mise/conf.d/test-tools.toml`           | repeats 22 of the 23 pins of `.mise/conf.d/gspot-tools.toml`                                                                                                              | list only the extra pins                          |
| `architecture`                           | three documents pass the 300-line limit their README sets; numbering skips 06 and 07; the CSVs are not the source they claim                                              | trim, renumber, delete the CSVs                   |
| `gspot.toml`                             | two `paths_allowed` entries with the same reason; an orphan comment; an empty `[tools.osv]` table far from its entries; the `tests/unit` check runs integration tests too | merge and tidy                                    |
| `test:bash-example` task                 | runs one file that `test:tools` runs                                                                                                                                      | delete                                            |
| `test:unit` and `test:integration` tasks | exact halves of `test`                                                                                                                                                    | keep either the halves or the whole               |
| `repo:setup` and `prepare:grammar` tasks | both run the grammar script                                                                                                                                               | make one depend on the other                      |
| `repo:tools` task                        | three names for one thing: the task, `test-tools.ts`, `test-tools.toml`                                                                                                   | one name                                          |
| `repo:install-checks` task               | installs tools, and its script lives in test support                                                                                                                      | rename `repo:install-tools` and move the script   |
| `ci:swiftformat` task                    | a CI setup step whose script lives in `tests/support`                                                                                                                     | move to `.github`                                 |
| `site:*`, `docs:*` and `release:*` tasks | three prefixes for site and release work                                                                                                                                  | one prefix                                        |
