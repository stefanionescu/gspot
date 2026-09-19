# File Tree

This document holds the tree of the gspot repository once every row of [18-gaps.md](18-gaps.md)
is closed. The last section lists each path that moves or leaves on the way there. A fix file
under [fixes/](fixes/README.md) names its paths as they stand here.

Names follow the naming policy gspot ships: kebab-case files, no banned term, no folder with one
code file, and types under `types/`. The folder names `swift` and `python` are allowed by name
in the `gspot.toml` of this repository (D-128, D-135).

## Root

```text
gspot/
├── .changeset/                 config.json, README.md, one file for each pending change
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              unit tests, planted repositories, and gspot check on Linux, macOS, and Windows
│   │   ├── release.yml         five binaries, attestation, the GitHub release, npm publish, the site
│   │   └── gspot.yml           the gate of this repository, written by gspot
│   └── CODEOWNERS
├── .gspot/                     what gspot writes here, as in every repository (see below)
├── .mise/conf.d/gspot-tools.toml   tool pins and tasks, written by gspot (D-127)
├── architecture/               this folder
├── docs/                       the manual
├── examples/                   three small repositories a reader can run gspot in
├── packages/
│   ├── cli/                    the binary
│   ├── eslint-plugin/          @gspot/eslint-plugin
│   └── npm/                    the launcher and the platform package template
├── presets/                    one folder for each preset
├── rules/                      the rule files, by layer
├── tests/                      the suites that need a repository or a registry
├── AGENTS.md                   one managed block
├── CLAUDE.md                   one managed block
├── CHANGELOG.md                written by changesets
├── CONTRIBUTING.md
├── LICENSE.md
├── NOTICE.md                   the licenses of what the binary embeds
├── README.md
├── SECURITY.md
├── bunfig.toml
├── bun.lock
├── gspot.schema.json           generated, and the one tracked copy
├── gspot.toml                  the policy of this repository, with no [[ignore]] entry
├── mise.toml
├── package.json
└── tsconfig.json
```

The root holds no lint configuration file. Every tool reads its file under `.gspot/` through
`--config`, and a root file exists only where a tool has an include form (D-100).

## `packages/cli/`

```text
packages/cli/
├── package.json
├── tsconfig.json
├── build.ts                    compiles each target and embeds grammars, presets, rules, and the schema
├── publish.ts                  stamps the platform packages and publishes them at one version
├── schemas.ts                  writes gspot.schema.json, the schema of the report included
├── grammars/                   tree-sitter WASM, copied at build; swift.wasm is tracked with its source named in NOTICE.md
├── config/                     literal tables only
├── src/
├── types/
└── tests/
    ├── unit/                   mirrors src/
    └── snapshots/              one folder for each preset: every generated file of a fixed policy
```

### `config/`

Literal tables only: no function, no control flow, no import but types. No table names a preset,
a tool, or a check id, because a manifest holds those (K-38, K-39).

| File              | Holds                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `cases.ts`        | the case styles the naming engine knows                                      |
| `docs.ts`         | the README sections and heading shapes the docs checks read                  |
| `env-files.ts`    | the patterns of environment files and of their templates                     |
| `file-tags.ts`    | extension to tag, shebang to tag, and the binary rules                       |
| `grammars.ts`     | grammar file for each language tag                                           |
| `markers.ts`      | managed-block markers, the generated-file mark, and the inline ignore shapes |
| `paths.ts`        | every path gspot writes: the hooks folder, the mise file, the baseline file  |
| `patterns.ts`     | the regular expressions the engines share                                    |
| `reasons.ts`      | the reasons a loosening refuses                                              |
| `shell.ts`        | the word lists of the shell analyses                                         |
| `suppressions.ts` | the suppression comment forms of every language gspot reads                  |

### `src/`

```text
src/
├── main.ts                     entry: runs the program and sets the exit code
├── program.ts                  the commander program and the one reader of global flags
├── commands/                   one file for each command
├── policy/                     gspot.toml: schema, read, merge, write
├── presets/                    manifests: schema, read, select, detect, claims
├── repository/                 what the tree holds: files, natures, tags, scopes, manifests
├── run/                        planning and running checks
├── emit/                       writing the files gspot owns
├── lifecycle/                  init, upgrade, and uninstall
├── structure/                  the structure engine
├── naming/                     the naming engine
├── prose/                      the prose engine
├── checks/                     every other built-in check, one file for each check id
├── readers/                    parsers the checks share
├── rules/                      the rule file assembler and the rules lint
├── profile/                    read, save, and the schema of a profile
├── doctor/                     what doctor prints
├── output/                     everything that reaches a terminal or a file
└── platform/                   what differs for each operating system
```

#### `commands/`

Fifteen command files: `init.ts`, `check.ts`, `apply.ts`, `baseline.ts`, `list.ts`, `explain.ts`,
`doctor.ts`, `ignore.ts`, `set.ts`, `add.ts`, `remove.ts`, `allow.ts`, `upgrade.ts`,
`uninstall.ts`, and `profile.ts`. `completion` registers itself from `output/completion.ts`. `print-result.ts` prints a result as text or JSON. A command file
registers its flags, calls one function from another folder, and prints. Global flags are read
once in `program.ts` (K-98).

#### `checks/` and `readers/`

A built-in check that is not structure, naming, or prose is one file under `checks/`. The folder
is the first part of its check id, and the file is the second part. `xctest/no-sleep` is
`checks/xctest/no-sleep.ts`. Each file exports one function that takes the engine input and
returns findings. `checks/registry.ts` maps a check id to its function, and a unit test holds
that map equal to the manifests. No manifest carries an `analysis` key (D-146).

```text
checks/
├── registry.ts
├── integrity/                  checks over the policy and the generated files
├── docs/                       README presence and shape, headings, fences, stale paths
├── dependencies/               lockfiles, install policy, manifest policy, tracked dependencies
├── licenses/
├── secrets/                    the gitleaks baseline, environment files
├── docker/  nginx/  ansible/
├── swift/  xcode/  xctest/
├── python/  fastapi/
├── sql/  postgres/  supabase/
├── express/  nextjs/  static-site/  html/  css/  i18n/
└── security/                   the CodeQL driver
```

`readers/` holds what several checks parse: the Xcode project, the Python project, the SQL
parser, the Postgres schema facts, package manifests, and locale files. A reader parses a scope
once for a run, and every check of that scope shares the result (K-148). A check receives the
files of its scope, and only a check with `runs = "once"` sees the whole repository (K-149).

#### The other folders

| Folder        | Files                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `policy/`     | `schema.ts`, `local-schema.ts`, `read-policy.ts`, `normalize.ts`, `problems.ts`, `validate-policy.ts`, `merge.ts`, `settings.ts`, `audit.ts`, `loosening.ts`, `near.ts`, `propose.ts`, `write.ts`, `commit-policy.ts`, `messages.ts`, `json-schema.ts`, and one file for each edit command: `add`, `remove`, `set`, `ignore`, `allow`                                  |
| `presets/`    | `manifest-schema.ts`, `read-manifests.ts`, `select.ts`, `detect.ts`, `claims.ts`, `listing.ts`, `levels.ts`                                                                                                                                                                                                                                                            |
| `repository/` | `tracked.ts`, `tree.ts`, `natures.ts`, `tags.ts`, `scopes.ts`, `staged.ts`, `manifests.ts`, `existing-tooling.ts`                                                                                                                                                                                                                                                      |
| `run/`        | `session.ts`, `plan.ts`, `execute.ts`, `check-command.ts`, `tool-runner.ts`, `command-parts.ts`, `parse-output.ts`, `broken-tool.ts`, `engines.ts`, `concurrency.ts`, `file-batches.ts`, `cache.ts`, `baselines.ts`, `baseline-command.ts`, `ignores.ts`, `fixers.ts`, `reproduce.ts`, `version-pin.ts`, `progress.ts`, `scratch-copy.ts`, `pushed-tree.ts`, `report/` |
| `emit/`       | `templates.ts`, `apply-command.ts`, `targets.ts`, `pointers.ts`, `managed-blocks.ts`, `hooks.ts`, `hook-managers.ts`, `runner-tasks.ts`, `tool-packages.ts`, `workflow.ts`, `gitlab.ts`, `atomic-write.ts`, `json-format.ts`                                                                                                                                           |
| `lifecycle/`  | `init/command.ts`, `init/plan.ts`, `init/questions.ts`, `selection.ts`, `install-tools.ts`, `first-check.ts`, `takeover.ts`, `carry.ts`, `ignore-files.ts`, `upgrade/command.ts`, `upgrade/report.ts`, `uninstall-command.ts`                                                                                                                                          |
| `structure/`  | `engine.ts`, `parser.ts`, `ast-grep.ts`, `cross-file-index.ts`, `code-lines.ts`, `counts.ts`, `directories.ts`, and `analyses/`, one file for each check id, for every language the engine reads                                                                                                                                                                       |
| `naming/`     | `engine.ts`, `policy.ts`, `split.ts`, `cases.ts`, `match.ts`, `validate-name.ts`, `paths.ts`, `name-finding.ts`, `extract.ts`, `parsers.ts`, and `extractors/` with one file for each language                                                                                                                                                                         |
| `prose/`      | `engine.ts`, `vale.ts`, `grammars.ts`, `source-bans.ts`, `vocabulary.ts`                                                                                                                                                                                                                                                                                               |
| `rules/`      | `assemble.ts`, `managed-block.ts`, `front-matter.ts`, `lint.ts`, `examples.ts`, `terms.ts`, `lint-command.ts`                                                                                                                                                                                                                                                          |
| `doctor/`     | `command.ts`, `report.ts`, `coverage.ts`, `changes.ts`                                                                                                                                                                                                                                                                                                                 |
| `output/`     | `reporter.ts`, `messages.ts`, `plan-text.ts`, `detection.ts`, `json.ts`, `prompts.ts`, `explain.ts`, `list.ts`, `completion.ts`                                                                                                                                                                                                                                        |
| `platform/`   | `paths.ts`, `spawn.ts`, `executable-bit.ts`, `install-hints.ts`, `missing-tool.ts`, `tool-probe.ts`, `environment.ts`, `assets.ts`                                                                                                                                                                                                                                     |

`emit/atomic-write.ts` is the one function that writes a file: a temporary file in the same
folder, then a rename (K-257). `emit/tool-packages.ts` writes `.gspot/package.json` and installs
it (D-145). `emit/pointers.ts` writes the root pointers of D-100. `run/command-parts.ts` builds
the argument list of a tool from its manifest command (K-258).

### `types/`

One file for each folder of `src/` that has types, and `modules.d.ts`. Types that only tests use
sit under `tests/` (K-106).

## `packages/eslint-plugin/`

```text
packages/eslint-plugin/
├── package.json
├── tsconfig.json
├── build.ts
├── config/                     the constants of the rules, as the CLI keeps its own (G-13)
├── src/
│   ├── plugin.ts
│   ├── rule.ts
│   ├── options.ts
│   ├── files.ts
│   └── rules/                  one file for each rule
├── types/
└── tests/rules/                one test file for each rule
```

Nineteen rules: `no-call-through`, `no-trivial-files`, `no-export-only-files`,
`no-exported-alias-constants`, `no-reexports`, `max-barrel-reexports`, `no-index-imports`,
`header-comments-before-imports`, `import-layout`, `import-path-style`,
`no-cross-folder-imports`, `no-cross-project-imports`, `tests-directory-contents`,
`registry-instance-only`, `require-server-only`, `no-client-environment`,
`private-before-public`, `types-placement`, `env-access-owner`.

## `packages/npm/`

```text
packages/npm/
├── gspot/                      the launcher: package.json, gspot.js, README.md
└── platform/README.md          the README each platform package ships
```

Targets: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`.

## `presets/`

Forty-nine folders: the 48 presets that stay, and `jest` (D-141). They are `ansible`, `bash`,
`cloudflare`, `commits`, `config-files`, `css`, `dependencies`, `docker`, `docs`, `drizzle`,
`duplication`, `express`, `fastapi`, `formatting`, `html`, `i18n`, `javascript`, `jest`,
`licenses`, `markdown`, `naming`, `nestjs`, `nextjs`, `nginx`, `postgres`, `prose`, `pytest`,
`python`, `react`, `react-hook-form`, `react-native`, `secrets`, `security`, `spelling`, `sql`,
`static-site`, `structure`, `supabase`, `svelte`, `swift`, `tanstack-query`, `trpc`,
`typescript`, `vitest`, `vue`, `xcode`, `xctest`, `zod`, `zustand`.

Every folder holds `manifest.toml`, and the manifest carries all that the CLI knows about the
preset. That is detection, claims, tools with their version command, checks with their level,
settings, and rule files. It also names the old configuration files the preset takes over, and
what it carries from them. Beside the manifest sit its templates, named after the file they
write, and its rule packs.

```text
presets/<id>/
├── manifest.toml
├── <target-file>.tmpl          one for each file the preset writes
├── <target-file>.fragment.tmpl a section of a file another preset owns
├── rules/                      ast-grep rules, one folder for each rule, one file for each grammar
└── semgrep/                    Semgrep packs
```

`presets/prose/` also holds `styles/gspot/` and `vocabularies/gspot/`, the Vale style gspot
ships. `presets/naming/` holds `policy.json`.

## `rules/`

```text
rules/
├── general/        agent/  code/  prose/
├── language/       one file for each language, and bash/  python/  naming/
├── runtime/        browser/  bun/  deno/  node/  workers/
├── framework/      express/  fastapi/  nestjs/  nextjs/  react/  react-native/  svelte/  swiftui/  uikit/  vue/
├── library/        drizzle/  next-intl/  react-hook-form/  tanstack-query/  trpc/  zod/  zustand/
├── tool/           commitlint/  docker/  github-actions/  nginx/  playwright/  tailwind/  tasks/  vitest/  xcode/  xctest/
├── platform/       supabase/
├── database/       postgres/
├── shared/         http/  i18n/
├── repository/     static-site/
└── templates/docs/ the eight documentation templates
```

Every rule file is installed by one manifest (K-232). A guide holds the rules of its subject and
nothing about one product (K-231, K-260).

## `docs/`

```text
docs/
├── astro.config.ts
├── package.json
├── tsconfig.json
├── reference-pages.ts          writes the reference pages from the data of the binary
├── public/favicon.svg
└── src/content/docs/
    ├── index.md
    ├── guides/                 written by hand
    └── reference/              generated: commands/, presets/, rules/, settings.md, engines.md, decisions.md
```

The site copies `gspot.schema.json` from the root at build (K-68).

## `.gspot/` in a repository

```text
.gspot/
├── version                     the pin, one line
├── <tool-file>                 one generated configuration for each tool
├── package.json                the npm lint tools gspot pins, written by gspot (D-145)
├── bun.lock                    or the lockfile of the package manager the repository uses
├── node_modules/               untracked
├── baseline.json               every held count, sorted, one path on a line (D-104)
├── hooks/                      pre-commit, pre-push, commit-msg, where no hook manager exists (D-101, D-114)
├── rules/                      the installed rule files
├── semgrep/                    the selected packs
├── vale/                       the style and vocabulary of the prose preset
├── cache/                      untracked
├── report.json                   untracked
└── report.sarif                  untracked
```

gspot writes four things outside `.gspot/`: `gspot.toml`, the mise file, the managed blocks, and
a root pointer for a tool with an include form. It writes nothing into `package.json` but the
`gspot` launcher and the tasks the developer accepted (D-116, D-147).

## `tests/`

```text
tests/
├── harness/                    planted.ts, registry.ts, worktree.ts, verdaccio.yaml, and the test-only types
├── config/                     the init command lines, fixture text, tool lists, and timeouts tests share (D-113)
├── repositories/
│   ├── <preset>.test.ts        init as a developer runs it, then check: exit code, check lines, findings
│   ├── fixtures/xcode/         a project that Xcode wrote, which the xcode tests plant (T-34)
│   └── generated/              one project for each generator, committed as the generator wrote it (T-33)
└── release/                    binary, publish, and install tests, the registry test of every pin, and the timing test
```

Unit tests sit under `packages/cli/tests/unit/` and `packages/eslint-plugin/tests/rules/`.
Snapshots sit under `packages/cli/tests/snapshots/<preset>/` (T-36).

## What is not in the tree

- No `scripts/` folder. Build steps are `build.ts`, `schemas.ts`, and `docs/reference-pages.ts`.
- No `src/index.ts` and no barrel.
- No folder of `src/` named after one product or one package manager.
- No reader, alias, or message for an older `gspot.toml`, flag, or file layout (D-134).

## What moves

Each path of today, and where it ends. A path not listed stays.

| Today                                                                                               | Target                                                                        | Row                 |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| `presets/go`, `presets/rust`, `presets/django`, `presets/ruby`                                      | deleted, with their rule files and preset pages                               | D-136               |
| `src/golang/`, `src/cargo/`, `src/pyproject/django/`, `types/cargo.ts`, `types/bundler.ts`          | deleted                                                                       | D-136               |
| `src/apple/structure/`, `src/pyproject/structure/`                                                  | `src/structure/analyses/`, one file for each check id                         | K-79, K-235         |
| `src/apple/build.ts`, `plan.ts`                                                                     | `src/checks/swift/`                                                           | K-79                |
| `src/apple/xcode/project.ts`, `files.ts`                                                            | `src/readers/xcode-project.ts`                                                | K-148, K-149        |
| `src/apple/xcode/`, `src/apple/xctest/`, the rest                                                   | `src/checks/xcode/`, `src/checks/xctest/`                                     | K-79                |
| `src/pyproject/project.ts`                                                                          | `src/readers/python-project.ts`                                               | K-79                |
| `src/pyproject/blocking-calls.ts`                                                                   | `src/checks/fastapi/no-blocking-io-in-async.ts`                               | K-79                |
| `src/sql/parser.ts`, `statements.ts`, `tree.ts`                                                     | `src/readers/sql/`                                                            | K-79                |
| `src/sql/checks.ts`                                                                                 | `src/checks/sql/`, one file for each check id                                 | K-79                |
| `src/postgres/schema/facts.ts`, `history.ts`                                                        | `src/readers/postgres-schema.ts`                                              | K-79                |
| `src/postgres/`, `src/supabase/`, `src/express/`, the rest                                          | `src/checks/postgres/`, `src/checks/supabase/`, `src/checks/express/`         | K-79                |
| `src/web/`                                                                                          | `src/checks/nextjs/`, `static-site/`, `html/`, `css/`, `i18n/`, `cloudflare/` | K-79, K-255         |
| `src/integrity/dispatch.ts`                                                                         | `src/checks/registry.ts`                                                      | K-79                |
| `src/integrity/`, the rest                                                                          | `src/checks/`, by the first part of each check id                             | K-79                |
| `src/profile/command.ts`, the `check` half                                                          | deleted; `init --from <profile> --dry-run` validates a profile                | D-131               |
| `commands/why.ts`, `commands/declare.ts`, `output/why.ts`, `policy/declare-command.ts`              | deleted                                                                       | D-131               |
| `commands/flags.ts`                                                                                 | `program.ts`                                                                  | K-98                |
| `doctor/settings.ts`, `doctor/newer-version.ts`                                                     | `output/list.ts`, `lifecycle/upgrade/newer-version.ts`                        | D-131               |
| `emit/stubs.ts`                                                                                     | `emit/pointers.ts`                                                            | D-100, K-47         |
| `emit/kept-pins.ts`, the devDependencies half of `emit/runner-surface.ts`                           | `emit/tool-packages.ts`                                                       | D-145, K-217        |
| `emit/runner-surface.ts`, the rest                                                                  | `emit/runner-tasks.ts`                                                        | D-116, D-127        |
| `emit/lefthook.ts`                                                                                  | `emit/hook-managers.ts`, for husky and lefthook                               | D-101, D-114        |
| `emit/drift.ts`                                                                                     | `checks/integrity/generated-drift.ts`; `apply --check` is deleted             | D-129, K-246        |
| `emit/first-baseline.ts`, `lower-baselines.ts`, `prune-baselines.ts`                                | `run/baseline-command.ts` and `run/baselines.ts`                              | D-104, D-132        |
| `run/list-arguments.ts`, the argument half of `run/tool-runner.ts`                                  | `run/command-parts.ts`                                                        | K-258               |
| `run/json-output.ts`, `run/scope-paths.ts`                                                          | `output/json.ts`, `repository/scopes.ts`                                      | K-79                |
| `lifecycle/questions.ts`                                                                            | `lifecycle/init/questions.ts`                                                 | D-120               |
| `lifecycle/xcode-proposal.ts`, `lifecycle/unreadable.ts`                                            | keys of the xcode manifest, and `repository/natures.ts`                       | K-38                |
| `config/carry.ts`, `OWNER_PRESET`, `CHECK_BY_TOOL`, the tables of `policy/propose.ts`               | `[takeover]` and `[carry]` tables of each manifest                            | K-14, K-39          |
| `config/integrity.ts`, `postgres.ts`, `supabase.ts`, `prose.ts`                                     | `config/suppressions.ts`, and settings of the three manifests                 | K-38                |
| `packages/cli/rules-lint/`                                                                          | `src/rules/`; the Vale half is deleted                                        | S-10                |
| `packages/cli/build/entry.ts`                                                                       | `packages/cli/build.ts`                                                       | K-73                |
| `prose/styles/`, `prose/vocabularies/`                                                              | `presets/prose/`; `prose/vale.ini` is deleted                                 | K-73, S-10          |
| `schema/`, `docs/public/schema/`                                                                    | `gspot.schema.json` at the root; the schema of the report is part of it       | K-68                |
| the twelve lint files at the root, `eslint.config.mjs` included                                     | deleted; each tool reads `.gspot/`                                            | D-100               |
| `.config/mise/conf.d/gspot.toml`                                                                    | `.mise/conf.d/gspot-tools.toml`                                               | D-127               |
| `.gspot/baseline/`, one file for each rule                                                          | `.gspot/baseline.json`                                                        | D-104               |
| seven rules of `packages/eslint-plugin/src/rules/`                                                  | deleted, with their tests                                                     | K-102, K-187, K-188 |
| constants beside the plugin rules                                                                   | `packages/eslint-plugin/config/`                                              | G-13                |
| `tests/repositories/golang.test.ts`, `cargo.test.ts`, `bundler.test.ts`, `pyproject/django.test.ts` | deleted                                                                       | D-136               |
| `rules/language/GO.md`, `RUST.md`, `RUBY.md`, `rules/framework/django/`, `rules/templates/project/` | deleted                                                                       | D-136, K-97         |
