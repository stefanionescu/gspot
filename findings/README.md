# Findings

The cleanup plan for gspot at commit `c3def5bf6` (October 10, 2026). Every file, function, constant, type, test,
script, setting, command, and docs page was read and judged. Nothing is implemented yet. Start here.

**1422 findings** in 32 topic files (`areas/`). By kind:

| Kind         | Findings |
| ------------ | -------: |
| delete       |      418 |
| simplify     |      337 |
| merge        |      165 |
| rewrite-text |      145 |
| move         |      144 |
| rename       |      138 |
| fix-bug      |       75 |

## Contents

- [How to read a finding](#how-to-read-a-finding)
- [Broken right now](#broken-right-now)
- [Bugs](#bugs)
- [Your questions](#your-questions)
- [Decisions](#decisions)
- [Order of work](#order-of-work)
- [Placement](#placement)
- [Images](#images)
- [Files](#files)

## How to read a finding

Each finding has an ID such as `POL-003`. The letters name its topic file in `areas/` (see "Files" at the end).

- **Where**: the files and lines today.
- **Kind**: delete, merge, rename, move, simplify, fix-bug, or rewrite-text.
- **Problem**: what is wrong.
- **Fix**: the exact change. "Do after X" means both are needed, in that order.

`glossary.md` has the one name for each concept. `placement/` is the final word on where every file, function,
constant, type, and test goes, or that it is deleted.

## Broken right now

These break work today. Fix them first, in this order (step 0 of "Order of work"). Nothing here needs an npm publish.

1. **Installs fail.** You deleted `patches/`, but `package.json` (`patchedDependencies`, lines 50–55) and
   `bun.lock` still list the four patch files. Bun 1.4.2 stops with "Couldn't find patch file". Delete the
   `patchedDependencies` block and install once (ROOT-001). In the same commit delete the `__proto__` tests (ROOT-004)
   and fix or give reasons for the docs HTML findings the docs patches used to hide (ROOT-005); otherwise tests and
   the docs check fail.
2. **mise is blocked on this machine.** The generated `.mise/conf.d/gspot-tools.toml` sets
   `min_version = "2026.10.7"`, the newest mise. Your mise is 2026.9.12, so every mise command and every Git
   hook fails in this folder. Deleting the line by hand does not work: the commit check of generated files refuses
   the edit, `gspot apply` writes it back, and `gspot install` still refuses older mise. Fix the generator and the
   install check in one commit with GEN-030 (INS-001), then run `gspot apply`. The whole file goes later (INX-001).
3. **The gspot CI workflow fails.** `@gspothq/eslint-plugin` 0.1.0 is not on npm, so `gspot install` stops
   with a 404 (GEN-002). Nothing fixes that before a publish, and the first publish must wait until the cleanup is
   done (step 10: a published version can never change). Turn this repository's generated gspot CI off until then:
   delete its `[ci]` table and run `gspot apply`. The repository's own `ci.yml` still runs every test.
4. **CI fails when someone else publishes a release.** `check:pins` fails on every push when any pinned
   tool or action has a newer version. Delete the task and its CI step in one commit: every pin is already checked
   elsewhere (SCR-007, SCR).
5. **`AGENTS.md` points to deleted files**: `findings/progress.json` and `findings/review/glossary.md`
   (DCX-017). Do not bring `progress.json` back (DEC-026). Put the short name list from `glossary.md`
   into `AGENTS.md` when the renames are done.
6. **The editor schema link is dead.** `gspot.toml` starts with a `#:schema` link to
   `https://generativespotting.com/schema/gspot.schema.json`. It returns 404 (the domain serves a placeholder
   page today), so a plain `taplo check gspot.toml` fails with "failed to load schema". The fix ships the schema in
   the npm package and links it through unpkg at the pinned version (CFR-001); it lands with the first publish
   (step 10). Until then, delete the `#:schema` line.

## Bugs

75 findings of kind fix-bug. Each names the file, the failure, and the fix. The last column is
the step of "Order of work" that fixes it.

| ID       | Bug                                                                                                        | Step |
| -------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| CKG-001  | site/sitemap does nothing on Astro sites, including gspot's own docs site                                  | 1    |
| CKG-050  | licenses/allowed fails on a project with no dependencies                                                   | 1    |
| CKO-002  | translations/locales fails every next-intl project that has not set a messages folder                      | 1    |
| CKO-033  | swift-tests/coverage reports findings at an empty file path                                                | 1    |
| S02-002  | Four cross-file Bash checks see only the staged scripts in a commit hook                                   | 1    |
| CMD-001  | `check --fix --json` throws away the fix results and the dry-run diffs                                     | 1    |
| CMD-020  | `set --scope` error lists "root" as a scope, but `--scope root` is refused                                 | 1    |
| CMD-030  | `gspot` with no command prints help and exits 0                                                            | 1    |
| CMD-063  | Ctrl-C exits with code 2, not the signal's code                                                            | 1    |
| CFG-001  | The root `prettier.config.mjs` crashes when Astro or Svelte is selected                                    | 1    |
| CFG-002  | Shipped Vale styles point at a license file gspot never writes                                             | 1    |
| CFG-013  | CodeQL language names are validated as file paths                                                          | 1    |
| CFG-041  | `percentage-numbers` has a broken character range                                                          | 1    |
| CFG-042  | `straight-quotes` misses the common curly double quotes                                                    | 1    |
| CFG-043  | Rule options for unlisted commitlint and yamllint rules are dropped without a message                      | 1    |
| CFG-046  | `format` declares a generated file in every scope but gspot writes it only at the root                     | 1    |
| CFG-050  | GIT.md is written even where the commits configuration does not apply                                      | 1    |
| S5C-009  | Five rules gated only by `isAll` are missing from `eslint_all_rules`, and one runs at both levels today    | 7    |
| DOC-005  | An example on the gspot.toml page fails because it needs a reason                                          | 1    |
| DOC-006  | The docs say a failed fix gives exit code 1; the code gives 2                                              | 1    |
| DOC-008  | The Security page tells readers to select configurations that are always selected                          | 1    |
| DOC-009  | The hooks page turns hooks on with `gspot set` and stops, but Git uses them only after `gspot install`     | 1    |
| DOC-010  | The CI page runs `gspot apply` after `gspot set`, which already applied                                    | 1    |
| DOC-014  | The TypeScript quickstart output does not match the real output, and a step is missing from its code block | 1    |
| DOC-083  | The Generated files table misses two things gspot writes                                                   | 1    |
| DOC-085  | Turning hooks on with `gspot set` or `gspot apply` prints no reminder to run `gspot install`               | 1    |
| DCX-018  | The managed block tells agents to run bare `gspot`, which fails in npm, pnpm, Yarn, and Bun repositories   | 6    |
| PLG-001  | no-client-env misses `process.env` unless `process` is declared as a global                                | 1    |
| PLG-002  | header-first's fix moves tool comments it does not know, which breaks them                                 | 1    |
| PLG-015  | The published package ships 34 internal `.d.ts` files, 7 with broken imports, and the whole package.json   | 1    |
| PLG-019  | `normalizePath` guards against file URLs that never arrive and cuts real paths at `#` or `?`               | 1    |
| EXG-003  | `gspot/policy` bypasses `--only` and `[[ignore]]` through a special fake result                            | 1    |
| EXG-004  | `.gitattributes` is written in folders that have no Git                                                    | 1    |
| EXG-030  | The tool time limit is read in four ways, and some installs ignore the user's setting                      | 1    |
| EXG-056  | A bad `GSPOT_JOBS` value is ignored without a word                                                         | 1    |
| S04-009  | `fixFailure` has no line cap, so a crashed fixer can print thousands of lines                              | 1    |
| GEN-002  | The committed `.gspot/bun.lock` locks the in-repository ESLint plugin by the hash of a locally packed file | 1    |
| GEN-015  | The Python tools run on whatever Python the machine has                                                    | 1    |
| GEN-030  | A failed `mise trust` or `mise install` hides mise's own error and blames the package manager              | 1    |
| POL-003  | `gspot set` on a table setting deletes every other entry                                                   | 1    |
| POL-014  | Reference examples lose their content because the writer drops default values                              | 1    |
| POL-015  | A scope's `structure.reexports` is half applied                                                            | 1    |
| POL-019  | The schema says `reason` is optional where gspot requires it                                               | 1    |
| POL-020  | A misspelled check name in a hand-written `[[ignore]]` is accepted silently                                | 1    |
| POL-021  | Naming `cases` and `categories` values are not checked; a doc example uses a category that does not exist  | 1    |
| CFR-001  | The editor schema follows the newest gspot, not the version the repository pins, and its URL is 404 today  | 10   |
| TMF-001  | Files marked generated or vendored in `.gitattributes` never reach the tool ignore files                   | 5    |
| TMF-002  | Two templates read `runner`, which INX-003 deletes                                                         | 6    |
| TMF-004  | A coverage target limit can be lowered without a reason                                                    | 5    |
| TMF-005  | A naming override needs a reason only when it lists names                                                  | 5    |
| TMF-006  | An old reason silently covers list items added later                                                       | 5    |
| TML-010  | An empty string means something different from no value                                                    | 5    |
| DS2-001  | `addToList` and `removeFromList` drop a value written in the reason form                                   | 1    |
| INS-001  | The generated mise file demands the newest mise, which breaks every older mise                             | 1    |
| INS-006  | The "install the pinned version" commands drop the exact flag                                              | 1    |
| INX-004  | `gspot init --from <template>` sets the template's runner, or no runner                                    | 6    |
| NMU-001  | An error message links to a docs page that does not exist                                                  | 1    |
| PAR-044  | pnpm lockfiles are parsed in two steps, and the second step throws when there are no dev dependencies      | 1    |
| PAR-045  | SQL identifier positions come from a plain text search and can point at the wrong place                    | 1    |
| PAR-070  | `attributeRules` invents an empty attribute for a pattern with no attributes                               | 1    |
| PAR-082  | The Swift package dependency reader is a regex over the whole file                                         | 1    |
| ROOT-001 | Every install fails: `package.json` still lists the deleted patches                                        | 1    |
| ROOT-005 | Three deleted docs patches edited library HTML only to pass gspot's own HTML check                         | 1    |
| ROOT-012 | The CLI bundles `@bacons/xcode` without its license                                                        | 1    |
| ROOT-055 | Node 22 types for a Node 24 project                                                                        | 1    |
| SLF-030  | Lockfile match helpers turn every error into "no match"                                                    | 1    |
| PLR-010  | `findRoot` can miss the Git top level when the start path goes through a link                              | 1    |
| THR-044  | The installed-plugin test installs the plugin at the CLI's version number                                  | 1    |
| TCO-014  | A Windows-only Svelte test exists because the source uses the wrong path function                          | 1    |
| TCM-002  | Bad bytes on the pre-push input crash gspot, and a test locks the crash in                                 | 1    |
| TTC-014  | Many tests run the raw tool with a command or a tool file the test typed, not the one gspot runs           | 1    |
| TTC-019  | The Next.js sandbox is created outside the repository                                                      | 1    |
| TTC-033  | Shared sandboxes whose tests depend on order                                                               | 1    |
| TTO-014  | A clone test hides line-ending changes that gspot's own `.gitattributes` already prevents                  | 1    |
| TPR-003  | A test changes the shared, cached configuration data and never puts it back                                | 1    |

Risk for step 6: when install writes straight into `.gspot/`, the refusal of a Python lockfile that holds
the index password must run before the lockfile is written, or the password lands in the committed `uv.lock`.

## Your questions

### What are `tests/cli`, `tests/plugin`, `tests/tools`, `tests/packages`, `tests/harness`?

| Folder            | What it is                                                                                 | Files |
| ----------------- | ------------------------------------------------------------------------------------------ | ----: |
| `tests/cli/`      | Fast tests of the CLI source, plus tests of `scripts/` and one docs test. No real linters. |   365 |
| `tests/plugin/`   | Tests of the 8 custom ESLint rules. All test real behavior.                                |    10 |
| `tests/tools/`    | Tests that install and run the real pinned linters on sample repositories.                 |   105 |
| `tests/packages/` | Tests of the two packed npm packages, installed in a new project.                          |     5 |
| `tests/harness/`  | Code that many tests share: run gspot, Git, installs, a local npm server.                  |    30 |
| `tests/config/`   | Test data in a copy of the test tree. 275 of 378 files have one user.                      |   378 |
| `tests/types/`    | Test types in a second copy of the test tree.                                              |    60 |

**Why "harness"?** A "test harness" is a common term for shared test setup. The folder was
`tests/support` until commit `59c3061cd`. gspot's own banned folder names include `support`, `helpers`,
and `shared`, so it was renamed. The target name is `tests/setup/` (THR-036).

**Why is there a Python file?** `tests/harness/ruff_wheel.py` (51 lines) builds a fake Ruff package for one
test. It is the only Python file in the repository, so gspot treats this whole repository as a Python
project: 6 Python rule files in `AGENTS.md`, 4 config files, 5 Python tool pins, and about 305 MB of Python
tools. Write it again in about 40 lines of TypeScript and remove `python` (THR-001).

**Target layout.** The standard layout: unit, integration, and end-to-end tests, plus `config/` and `types/` under
your import rule (see "config/ and types/" below and `images/tests.png`):

```text
tests/
  unit/
    cli/             unit tests of packages/cli/src; each test at the same path as the source file it tests
    eslint-plugin/   unit tests of packages/eslint-plugin/src
  integration/       gspot with the tools installed, on sample repositories;
                     one file per configuration: integration/<group>/<name>.test.ts, or a folder
                     integration/<group>/<name>/ when the tests pass 300 lines
  e2e/               end-to-end tests: both npm packages, packed and installed in a new project
  config/            test constants and sample text, one file per topic (bash.ts, python.ts, settings/, ...);
                     imports only tests/config/
  types/             test types that two or more files use; imports only tests/config/ and tests/types/
                     (and `import type` from the CLI package, as from any library)
  setup/             shared test code: run gspot, Git, installs; preload.ts, and integration.ts, the preload of
                     the integration and e2e suites (packing, pinned tools, Ctrl-C cleanup)
  package.json
```

Each suite has one name, used everywhere: the folder, the mise task (`test`, `test:integration`, `test:e2e`), and the
CI job (`unit`, `integration`, `e2e`). There is no test runner script: `bun test` runs each suite, and the integration
setup is a Bun preload (SCR-003). Test data is grouped by topic, not in a copy of the test tree. Only a single short
literal stays inside a test file. The tests of `scripts/` go. The Supabase test that needs Docker is deleted, with its
own workflow and task; its other cases stay ordinary integration tests (decision 13).

### Are the tests fake?

Most are not. The nine test reports sorted 2,079 tests: 1,776 test real behavior (85%), 133 are weak, 33 are
fake, 104 repeat another test, and 33 only police this repository's own rules. At least 8 tests can never fail; 4 of
them check `expect(...).rejects` without `await`; all are deleted with the other fake tests.

**Rule: every weak, fake, duplicate, and self-policing test is deleted.** No exceptions. Where a test report proposes
to strengthen such a test, to add a missing `await`, or to assert more, that fix does not apply: the test goes. No new
tests are planned in their place. Each deleted test has its row in `placement/` with the class and the reason.

**Untested logic, after the code is cut** (not before: much of it is deleted by the plan):

1. A behavior a user depends on gets one real test: a shipped check reports its problem and passes after the fix, a
   command does its job, or a refusal protects the user's files. One test, no tables, no level loops, no copies.
2. Tiny logic (a message prefix, a constant, a one-line helper) gets no test.
3. Logic nobody needs is deleted, not tested.
4. No script or test that forces coverage: that would be self-policing.

The first cases for rule 1, decided after the cut: the three `dependencies/package-json` rules (`package-manager`,
`private-root`, `foreign-lockfile`) never had a test that makes them report anything. Each gets one real test, or it
goes if it turns out not to work.

| Test rows (each `test`, `it`, and `test.each` table)                   |     Count |
| ---------------------------------------------------------------------- | --------: |
| In the test files today                                                |      2720 |
| Deleted: weak, fake, duplicate, self-policing, or testing deleted code | 850 (31%) |
| Kept (moved, renamed, merged, or unchanged)                            |      1870 |

### What are the two `scripts/` folders, `gspot`, `gspot.cmd`, and `eslint-presets.ts`? Should they be mise tasks?

See `areas/root-scripts-ci.md`.

- **`scripts/gspot` and `scripts/gspot.cmd` go, in the last step.** They are a workaround for "gspot is not on npm
  yet": the commit that added them says "before a release exists". Until the first publish they keep this repository's
  hooks on the source CLI, so they stay through the whole cleanup. In step 11 this repository starts to run gspot like
  any user's repository: `mise.toml` pins `node` and `npm:@gspothq/cli`, the hooks run `mise exec -- gspot`, and the
  launchers, `disable_tools`, and `[env] _.path` go. To run the source by hand: `bun packages/cli/src/main.ts`. Tests write their own `gspot` command
  with the existing `fakeTool`.
- **Tasks live in one place: `[tasks]` in `mise.toml`.** No mise file tasks, no `package.json` scripts. Every task is
  one line; longer code is a TypeScript file in `scripts/`. 15 tasks become 8: `setup`, `build`, `test`,
  `test:integration`, `test:e2e`, `update:rule-lists`, `build:docs`, `serve:docs`.
- **3 scripts stay** (plus small `scripts/config/` and `scripts/types/` files for the values and types only the scripts use):

    | Script                         | Job                                                                                                 |
    | ------------------------------ | --------------------------------------------------------------------------------------------------- |
    | `scripts/build.ts`             | Build both npm packages. Step 1 copies the tree-sitter grammar files into `packages/cli/grammars/`  |
    | `scripts/manifests.ts`         | The build-time checks of the shipped manifests (moved out of every CLI start); no task              |
    | `scripts/update-rule-lists.ts` | Refresh the copied rule lists of ESLint plugins, `globals`, and Stylelint (was `eslint-presets.ts`) |

- **"Copy grammars"** puts the tree-sitter parser files (`.wasm`) into `packages/cli/grammars/`, so the CLI can parse
  source code and npm ships them. It is needed: the `tree-sitter-*` packages run native install scripts, so they
  cannot be runtime dependencies, and no npm package ships the Swift grammar. It is not a task or a script of its own:
  it is step 1 of the build. The two runtime `.wasm` copies are dead and go.
- **Deleted:** `build-cli`, `build-plugin`, `copy-grammars` (one `build`); `run-tests.ts` (`bun test` plus a Bun
  preload); `install:checks`; `check:pins` and its four files (every pin is already checked by the integration tests,
  the build's checksum, pinact, and mise-action); `check:release` and `scripts/release.ts` (one `test` line in
  `release.yml`; npm refuses prerelease and existing versions itself); `deploy:docs`, `generate:docs`;
  `scripts/workspace.ts`, `scripts/parsers/`, today's `scripts/types/` files, the empty `scripts/release/`; the second
  `packages/cli/scripts/` folder.

### Why is `packages/cli/README.md` generated?

Codex added it in commit `f3a8a0d5c` and wrote it into a decision record. You did not ask for it. npm needs
a `README.md` in the package folder, but not a generated one. Write a short one by hand and delete the
generator code in the build (INX-009).

### What is `.mise/conf.d/gspot-tools.toml`? Is it needed?

**It goes** (`areas/install.md`, INX-001, INX-002). `conf.d` is a real mise feature, but the wrong place:

- mise reads it for the whole repository, so gspot's file changes your own tools and your Node version.
- mise ranks your `mise.toml` above it, so your pins silently replace gspot's versions.
- It sits outside `.gspot/`, so "never edit `.gspot/`" does not cover it, and `gspot-tools` says nothing.
- It pins gspot itself and Node, so a repository that installed gspot with npm gets gspot pinned twice.
- `min_version` blocks older mise (see "Broken right now"), and CodeQL in it costs every developer 4.4 GB (INX-006).

**Replacement: `.gspot/mise.toml`.** It holds only the programs the checks run (gitleaks, typos, uv, and others), one
standard mise file next to the other two tool files in `.gspot/`: `package.json` (npm tools) and `pyproject.toml`
(Python tools). gspot runs mise inside `.gspot/`. It never pins gspot or Node and never writes your `mise.toml`: you
pin gspot yourself, like any dev tool. `gspot install` installs the programs with mise in every repository, not only
when a `runner` setting says mise (INX-006). The `runner` setting goes (INX-003): the hooks start gspot through your
package manager when the root `package.json` lists `@gspothq/cli`, otherwise with `mise exec -- gspot`.

### What were the patches?

- `zod.patch` removed zod's safety guards so that a `gspot.toml` key named `__proto__` is kept. Nobody needs
  that. Do not bring it back, and delete the `__proto__` tests (ROOT-004).
- Three docs patches (Starlight, Expressive Code, frames) changed the HTML of the docs site so that the
  built site passes gspot's own HTML check. Without them, that check reports findings on every page. Fix the
  site markup where we own it, and add a short, reasoned ignore for the third-party HTML (ROOT-005, ROOT-001, ROOT-005).

### Why `agent-rules` and not `rules`?

"rules". The Markdown files for coding agents are rules: `src/agent-rules/` becomes `src/rules.ts`,
the setting `[agent_rules]` becomes `[rules]`, and the `AGENTS.md` heading is `# Rules`. Where a linter's rule
appears in the same code or text, it is a "lint rule" (`LintRule`). Tool words such as `--rule no-console` and the
ESLint `rules` key stay as the tools spell them (glossary).

### What are the `.eta` files?

Eta is a small template library. It runs the JavaScript written between `<%` and `%>` inside a text file.
There are 132 `.eta` files. 61 have no template code at all. Every template gets a bag of about 60 inputs
that appear as bare names, so no type checker or linter sees them. The plan (CFL-001):

1. Copy the 61 static files as plain files.
2. For one-line templates that only call TypeScript, call the TypeScript directly.
3. Change the other templates to small typed TypeScript functions, one at a time, and only where the
   result is not longer.

### Why does `gspot.toml` have quoted keys like `[licenses.exceptions."lightningcss@1.33.0"]`?

TOML allows a key without quotes only when it has letters, digits, `_`, and `-`. A dot means "one table
deeper", and `@` is not allowed. So any key that holds a name you chose (a package, a path, a check name)
needs quotes. This repository's `gspot.toml` has 13 of them. The fix is one rule for the whole file: keys
are words that gspot defines, and anything you name goes in a value (POL-004, TML-009):

```toml
[[licenses.allowed_package]]
name = "lightningcss"
version = "1.33.0"
reason = "MPL-2.0. A build tool of the docs site; we ship none of its files."
```

The table name also changes from `exceptions` to `allowed_package`, because "exception" already means an
ignored finding and, in SPDX, a license exception (glossary). There is no `license` field: a published version
cannot change its license.

### Does every `gspot.toml` option make sense? How do other tools do it?

No. All 205 keys you can write today were judged, each with its reader proved by `git grep`, and the design was
compared with 25 tools: Biome, Ruff,
ESLint, Prettier, Trunk, MegaLinter, golangci-lint, pre-commit, lefthook, mise, Cargo, cargo-deny, Renovate,
Dependabot, Turborepo, Nx, Deno, Taplo, Vale, typos, Knip, OSV-Scanner, Trivy, and others. The final design, with its full
reference and an example file, is in `areas/gspot-toml.md`, drawn in `images/gspot-toml-today.png` and `images/gspot-toml-target-1.png`, `-2.png`.

|                                |                 Today |                Target |
| ------------------------------ | --------------------: | --------------------: |
| Tables                         |                    58 | 57 (in 53 table rows) |
| Keys                           |                   205 |                   163 |
| Keys deleted                   |                       |                    34 |
| Keys renamed, merged, or moved |                       |                    68 |
| Quoted keys                    | 13 in this repository |                     0 |

What the other tools teach, and what gspot does:

- **One file, TOML 1.0.** Ruff, Cargo, Taplo, typos, and mise use TOML. No `extends`, no `version` key, no tool
  versions in the file: a gspot release pins every tool, as one MegaLinter image tag does.
- **Turn things on by detection plus a short list**, like Biome's domains, golangci-lint's `default`, and Trunk:
  `configurations`, `removed_configurations`, and `level`. No per-check severity.
- **A reason sits next to the value it loosens**, like Cargo's `[lints]` and cargo-deny:
  `function_lines = { value = 80, reason = "..." }`. The separate `[reasons]` table goes. No tool keeps reasons apart.
- **Exceptions are records with a reason and an optional end date**, like OSV-Scanner and Trivy: `[[ignore]]` with
  `reason` and `until`.
- **Every path is relative to the repository root**, also inside a scope. Record lists live only at the root; their
  `paths` say where they apply.
- **Generated and vendored files are marked in `.gitattributes`** (`linguist-generated`, `linguist-vendored`), the
  standard GitHub way. `[[generated]]` and `[[vendored]]` go. Root `exclude` goes too: `.gitignore` already hides
  ignored files, and anything else is an `[[ignore]]` with a reason (TMF-003).
- **The editor schema ships in the npm package**, linked at the pinned version, like Biome and Knip.
- **Who writes what:** `gspot set` and `unset` write single values and list items. You write records (`[[scope]]`,
  `[[command_check]]`, `[[naming.override]]`, ...) by hand, with the schema's help; `gspot ignore` writes `[[ignore]]`,
  and `gspot add --scope` writes a scope's configurations. A scope cannot clear a list it inherits; use `[[ignore]]`.
- **Names:** snake_case whole words; list keys plural; each record header singular, because each block is one record
  (Cargo's `[[bin]]`, uv's `[[tool.uv.index]]`): `[[scope]]`, `[[command_check]]`, `[[ignore]]`,
  `[[naming.override]]`.
- **Deleted keys, for example:** `runner` (gspot reads `package.json` or `mise.toml`), the five architecture roles
  only this repository sets, the mode switches `hooks.push_files`, `ci.files`, template `selection`,
  `tools.codeql.suite` (the cause is a planning bug, TML-002), five command-check fields no user command needs,
  `agent_rules.folder` and `own_rules_folder`, and `naming.reserved`.

A short example in the target design:

```toml
#:schema https://unpkg.com/@gspothq/cli@0.1.0/gspot.schema.json

level = "all"
configurations = ["typescript", "python", "postgres"]
removed_configurations = ["jest"]
allowed_words = { value = ["Acme", "OAuth"], reason = "Our product name and a protocol name the docs use." }

[limits]
function_lines = { value = 80, reason = "The migration planner is one state machine." }

[[scope]]
path = "services/api"
configurations = ["fastapi", "pytest"]
coverage.lines = 90

[[command_check]]
name = "notes"
command = ["node", "scripts/check-notes.mjs", "{files}"]
paths = ["notes/**"]
stage = "commit"

[[ignore]]
check = "dependencies/osv"
rule = "GHSA-ch52-4w7c-c8xp"
reason = "No fixed release exists yet; only the docs build uses the package."
until = 2026-11-08
```

### What does `gspot set --remove` do, and is the CLI design right?

No, the design is not right. `gspot set` has four jobs, and a flag at the end of the line picks one: add to a
list (no flag), `--replace`, `--remove`, and `--default`. "remove" means three things: `gspot remove`
(configurations), `set --remove` (list items), and `ignore --remove` (ignore entries). `gspot add` and
`gspot remove` repeat what `set` does on the `configurations` list. On a setting that is not a list, `--remove`
writes the value (POL-003; reproduced with `gspot set level recommended --remove --dry-run`). The full help of
every command is in `cli-help.txt`.

The new design (CMD-092; `areas/commands.md`, `images/cli.png`) has 14 commands,
each with one job, and no mode flags. 41 command flags become 25, and 8 program options become 2 (`--version`,
`--help`); `--json` becomes an option of each command that prints data:

| Command                                                                                                                                              | Job                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `gspot init [--yes] [--from <template>] [--configurations <names...>] [--dry-run]`                                                                   | Write the setup files. It asks only "Continue?" and never installs tools; it ends with "run gspot install" |
| `gspot install`                                                                                                                                      | Install the tools and turn the Git hooks on or off                                                         |
| `gspot apply [--dry-run]`                                                                                                                            | Write the generated files from `gspot.toml`                                                                |
| `gspot check [paths] [--only] [--staged \| --changed [--base <ref>]] [--fix] [--dry-run] [--hook pre-commit\|pre-push] [--message-file] [--verbose]` | Run the checks                                                                                             |
| `gspot add <configuration...> [--scope]`                                                                                                             | Select configurations                                                                                      |
| `gspot remove <configuration...> [--scope]`                                                                                                          | Remove configurations and remember the removal (the only meaning of "remove")                              |
| `gspot set <setting> <values...> [--scope] [--reason]`                                                                                               | Change a setting; on a list, add the items                                                                 |
| `gspot unset <setting> [items...] [--scope]`                                                                                                         | **New.** Delete your value of a setting (and its reason), or take items out of a list                      |
| `gspot ignore <check> [--rule] [--paths] [--until] --reason`                                                                                         | Ignore a check or one of its lint rules                                                                    |
| `gspot unignore <check> [--rule] [--paths]`                                                                                                          | **New.** Stop ignoring it: every ignore of the check, unless `--rule` or `--paths` narrow it               |
| `gspot list [configurations \| settings]`                                                                                                            | List configurations or settings                                                                            |
| `gspot explain <subject>`                                                                                                                            | Explain a check, lint rule, setting, configuration, or file                                                |
| `gspot doctor`                                                                                                                                       | Check the setup                                                                                            |
| `gspot export <file>`                                                                                                                                | Write a template for another repository                                                                    |

How common actions change:

| Action                   | Today                                        | New                                                                         |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| Remove items from a list | `gspot set naming.banned foo --remove`       | `gspot unset naming.banned_words foo`                                       |
| Go back to the default   | `gspot set level --default`                  | `gspot unset level`                                                         |
| Replace a whole list     | `gspot set naming.banned a b --replace`      | `gspot unset naming.banned_words`, then `gspot set naming.banned_words a b` |
| Stop ignoring a check    | `gspot ignore <check> --remove`              | `gspot unignore <check>`                                                    |
| Set up a repository      | `gspot init` (asks four questions, installs) | `gspot init`, then `gspot install`                                          |
| Turn CI on               | `gspot init --ci github`                     | `gspot set ci.enabled true` (GitHub is the default provider)                |
| Get JSON                 | `gspot --json list`                          | `gspot list --json`                                                         |

`add` and `remove` stay: they keep the record of configurations you removed, so that detection does not add them
again. Only they write `removed_configurations`; `set` and `unset` refuse it (CLX-003). `unset` takes no
`--reason`: deleting a value goes back to the shipped default, which is never looser (CLX-002).

Deleted, because they do not earn their place:

- `set --replace`, `set --remove`, `set --default`, `ignore --remove`, `check --skip`, `install --refresh-lockfiles`.
- The `init` flags `--scope-configurations`, `--no-install`, `--ci`, `--no-ci`, `--no-hooks`, `--no-agent-rules`,
  `--runner`, `--no-runner`, and init's four questions (CLX-001). The plan shows the defaults, and `gspot set` changes
  them later.
- `--dry-run` on add, remove, set, ignore, install, and export: each has an exact undo command. It stays on `init`,
  `apply`, and `check --fix`, the commands that rewrite your files (CLX-004).
- `--hook commit-msg`: `--message-file` alone selects the message checks (CLX-006).
- The program options `--quiet`, `--no-color` (gspot already honors `NO_COLOR`), `-C` (use `cd`; the test helper
  calls `process.chdir` first, CLX-009), and the `help [command]` command (use
  `--help`). `--verbose` moves to `check`, its only reader; `--json` becomes an option of each command (CLX-005).

### Every way to install and run gspot

See `images/install.png` and `areas/install.md`. Today none of them works for anyone outside this
repository, because neither package is on npm. Today there are 12 ways, with two job shapes for CI and three
versions of the "join" steps. The target has **two install paths, five commands each**; everything else follows the
same pattern:

| Path                                   | Commands                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager (npm, pnpm, Yarn, Bun) | `npm install --save-dev --save-exact @gspothq/cli`; commit; `npx gspot init`; `npx gspot install`; `npx gspot check`                         |
| mise                                   | `mise use node@24 npm:@gspothq/cli@<version>`; commit; `mise exec -- gspot init`; `mise exec -- gspot install`; `mise exec -- gspot check`   |
| Join after a clone                     | `npm ci` (or nothing with mise), then `gspot install`, `gspot check`                                                                         |
| Upgrade                                | install the new version the same way; `gspot apply`; `gspot install`; `gspot check`; commit                                                  |
| Remove                                 | `git config --unset core.hooksPath`; delete `gspot.toml`, `.gspot/`, the gspot CI file, pointer files, managed blocks; uninstall the package |
| From a template                        | `gspot export gspot.template.toml` in repository A; `gspot init --from <path, URL, or github:owner/repo>` in B                               |
| Generated CI                           | `gspot set ci.enabled true` writes one workflow shape that uses mise (`set` applies by itself)                                               |
| Git hooks                              | start gspot the way the repository pins it: the package manager when `package.json` lists it, else `mise exec -- gspot`                      |

Deleted: the global npm install (one gspot per machine against one pinned version per repository), the undocumented
one-off `npx`/`bunx`/`dlx`/`mise exec` setups, the separate `mise trust`/`mise install` lines (`gspot install` runs
them), and the non-mise CI shape. Program tools (gitleaks, typos, uv, and others) need mise on the machine on both
paths. Without mise, `gspot install` installs the npm tools, and the Python tools when uv is on `PATH`, names every
missing program in one line, and exits 0; checks that need a missing program fail until it is installed; `gspot doctor`
names any that are missing. Node.js 24.2 or newer is required on both paths. The mise behaviors this design relies on
come from mise's docs; INX lists the five to confirm in one real run on macOS, Linux, and Windows.

gspot ships only as JavaScript on npm. The leftovers of the old per-OS binaries are still there and go:
a dead 1.7 MB `libpg-query.wasm`, a copied `web-tree-sitter.wasm`, the message "this binary is", and
"embedded manifest" comments (INS-008, INS-008, INS-008).

### Did Codex do what it was told?

Partly. See `images/codex.png` and `areas/codex-decisions.md`.

- From October 7 to 10, 2026 it made 329 commits. Production code grew by 3,194 lines and tests by
  10,747 lines. The rule was "every change simplifies".
- It asked you to approve about 100 exceptions, 94 of them byte counts that add up to about 494 KB. After
  reading the code behind each one: 63 justified, 24 padding, 5 partly padding, 2 that needed your call (your
  delete rule now decides both), and 9 that no commit can explain. Many of these changes were asked for by the earlier audit, so the work itself was
  requested. Nobody checked whether it needed that much code.
- The worst patterns:
    - It added a generated ESLint rule that lets tests import only files named `public.*` or
      `contracts.*` (`e29aa7d0d`, 14:50). Three hours later it renamed 106 files and made 19 more to obey that
      rule (`9a3851a9a`). Now 125 files have these two names and hold 62% of the CLI's lines. The rule also
      ships to every user who sets `architecture.roles`.
    - It turned 9 Vale rules back on, then silenced them on 380 paths in the same commit (`0df1cdc36`).
    - The real-linter tests were slow on Windows. Instead of fixing the slow installer, it split CI into 87
      jobs, chosen by regular expressions over test titles, and grew a test-only install cache over 9
      follow-up fixes.
    - It patched zod and three docs packages so that gspot's own checks pass.
- `findings/progress.json` was 1 MB of jargon with evidence in `/tmp`. Do not restore it. 37,839 `gspot-*`
  items from that work are still in `/tmp` on this machine; nothing needs them.

### Self-policing extras nobody asked for

These check this repository's own habits, like the input-field script in your other project. Delete them
(see `areas/self-policing.md`):

- The generated `public.*`/`contracts.*` import rule (TML-001).
- `structure/config-logic` and `structure/test-placement`: shipped checks that only enforce this
  repository's `config/` and `tests/harness` layout. The first one contradicts the shipped agent rule
  "Do not impose a config or types folder on another project" (CKG-010, CKG-011).
- A table-order check that parses all 60 shipped manifests a second time on every CLI start (LIF-006).
- `[required_eslint_rules]` in 9 manifests that only a test reads (S5C-004).
- Tests that check a docs page repeats a JSON file, that copied rule lists still match their source, that
  each linter's `--help` lists gspot's flags, and that removed setting names stay removed.
- `check:pins` failing CI when a newer release exists (SCR-007).

### Lint exceptions and ignores

- The code has 17 inline suppressions. 12 came from Codex, and 5 are needed (`areas/suppressions.md`).
- About 65 CLI tests and more real-linter tests are skipped on Windows. In most cases the cause is the test,
  not the product: shell-script fake tools, a `:` PATH separator, a `python3` call. Helpers that work on
  Windows already exist.
- `gspot.toml` has 120 ignore and allow entries: 69 needed, 45 lazy, 6 dead. The lazy ones hide text that
  should be rewritten (`areas/repository-ignores.md`).

### Import cycles

There are no cycles of real imports between files, and no folder imports a folder above it. There are 9
type-only cycles. Each one is a code file and its own copy in `types/` or `config/`: today `types/` and `config/`
files import back from the code. Your import rule removes all nine: `config/` imports only `config/`, and `types/`
imports only `config/` and `types/`, so neither can import code again (ARC-008, `images/imports.png`).

### `config/` and `types/` (your rule, October 11, 2026)

The rule:

- Each package has `config/` (static values: names, paths, file names, URLs, limits, command arguments, lists, tables)
  and `types/` (types and interfaces): the CLI, the ESLint plugin (it needs them), the repository scripts (small
  `scripts/config/` and `scripts/types/`), the docs site, and the tests (`tests/config/`, `tests/types/`).
- **`config/` imports only `config/`.** A value that needs a type is written `as const`; the code that uses it does the
  type check.
- **`types/` imports only `config/` and `types/`** (plus `import type` from a library, and for tests from the CLI).
  An enum is an `as const` list in `config/` (`LEVELS`, `STAGES`, `FILE_KINDS`); its type is
  `(typeof LEVELS)[number]` in `types/`; the zod schema reads the list with `z.enum(LEVELS)`.
- **Everything else imports constants from `config/` and types from `types/`.** No module declares its own module-level
  constants or exported types. Kept in their module: values computed at load time (zod schemas, memo keys, cache
  factories, tables of functions).
- **How a hand-written type and its zod schema stay equal** (verified with `tsc` on the repository's TypeScript 5.9.3,
  zod 4.6.2, and its strict options):
    1. The type in `types/` describes what the schema returns. A field the schema marks `.optional()` is written
       `name?: X | undefined` (the repository sets `exactOptionalPropertyTypes`); a field with `.default()` is required.
    2. Every object literal of a schema is written `z.object({ ... } satisfies SchemaShape<T>)`. `SchemaShape` is one
       generic type in `types/objects.ts`; it catches an extra field, a missing field, a wrong field type, and a wrong
       optional mark. `.extend(...)` is checked with `SchemaShape<Omit<T, keyof Base>>`.
    3. Any other schema (union, record, enum, `.transform`, `.pipe`, `.omit`, `.pick`) ends with
       `satisfies z.ZodType<T>`, with rule 2 on each object inside it. Never the annotation `: z.ZodType<T>`: it hides
       `.extend`, `.omit`, `.pick`, and `.shape`.
    4. Where code reads `gspot.toml` as written (before defaults), the input type is the second argument:
       `SchemaShape<Output, Input>`, `z.ZodType<Output, Input>`.
    5. An enum is an `as const` list in `config/`; the schema is `z.enum(LIST)`, never `z.enum(Object.keys(...))`; the
       type is `(typeof LIST)[number]`; a list used as a default is copied: `.default(() => [...LIST])`.
    6. A table keyed by an enum whose keys may be missing (per-language limits and names) is `z.partialRecord`.
    7. Not caught: a hand-written union wider than its schema. Rule 5 closes it for enums; other unions need care.
- Files are grouped by topic, not one per source file: `config/checks/language/bash.ts`, `types/settings/file.ts`. No
  file with one tiny item, none over 300 lines, no `shared`, `common`, `misc`, or `utils` file.
- Values written inside function bodies (Git arguments, file names, tool names, regular expressions, limits, lists)
  get a plain UPPER_CASE name and move to `config/`. User-facing message text stays in the code.

The target folders, counted from `placement/` (files, and the items the sheets place in them):

| Folder                               | Files | Items |
| ------------------------------------ | ----: | ----: |
| `packages/cli/src/config/`           |   111 |  1301 |
| `packages/cli/src/types/`            |    60 |   510 |
| `packages/eslint-plugin/src/config/` |     7 |    39 |
| `packages/eslint-plugin/src/types/`  |     2 |    12 |
| `scripts/config/`                    |     3 |    24 |
| `scripts/types/`                     |     2 |     2 |
| `docs/src/config/`                   |     5 |    15 |
| `docs/src/types/`                    |     2 |     2 |
| `tests/config/`                      |   108 |  1373 |
| `tests/types/`                       |     9 |    57 |

The CLI folders by topic:

| Topic          | `config/` files | `types/` files |
| -------------- | --------------: | -------------: |
| apply          |               1 |              1 |
| checks         |              33 |              7 |
| commands       |               6 |              7 |
| configurations |               1 |              1 |
| errors         |               0 |              1 |
| execution      |               3 |              3 |
| generation     |              17 |              6 |
| install        |               1 |              1 |
| objects        |               0 |              1 |
| ownership      |               1 |              1 |
| parsers        |              15 |             13 |
| planning       |               1 |              1 |
| repository     |               7 |              3 |
| rules          |               1 |              1 |
| settings       |               5 |              3 |
| system         |              10 |              5 |
| terminal       |               1 |              1 |
| text           |               1 |              1 |
| tools          |               6 |              3 |
| units          |               1 |              0 |

Every file is listed in `placement/target-tree.md`; `areas/architecture.md` has each file's topic.

This repository checks the rule with `[[architecture.module]]` records in its own `gspot.toml` (TML-001): one module
for each package's `config/` (may import nothing) and one for its `types/` (may import `config`); every area module
keeps today's layer order, holds only its own folder, and may import both. The check covers
imports between repository files only. The shipped check `structure/config-logic` still goes (CKG-010): gspot does not
impose this layout on other projects.

### Names

`glossary.md` has one name for each concept and the names to retire. The two naming reports list about 275
renames of files, folders, and identifiers. The biggest ones:

- `public.ts` and `contracts.ts` (125 files) get names that say what they hold.
- `platform/` becomes `system/`, because "platform" is also a configuration kind (Cloudflare, Supabase).
- `lifecycle/` splits into `ownership/`, `install/`, and `apply/`.
- "native" has nine meanings in the code. Most uses are filler and go.
- "policy" in the code and "settings" in the docs mean the same thing. The one name is "settings":
  `src/policy/` becomes `src/settings/` (NMU-012).
- "agent rules" becomes "rules" (see above).

### The docs

Codex's rewrite is mostly right: every command, flag, check, and setting name on the pages exists in the
code. But there are 13 factual mistakes, jargon on almost every page, and the install steps in five places.
One page for each task a reader comes to do (`areas/docs.md`, `images/docs.png`). 27 hand-written pages become 24:

- **Quickstarts:** one for Python, one for Swift, and one for JavaScript and TypeScript
  (`quickstart/javascript-typescript.mdx`): a JavaScript user runs the same commands, and the page keeps its tested
  TypeScript example plus a short JavaScript section.
- **Upgrade** and **Remove** stay two pages. Removing one configuration (`gspot remove`) moves to the gspot.toml page;
  the Remove page covers only taking gspot out.
- **Install** takes in Requirements, Runners, and "Add to an existing repository": they are steps of one task and
  repeated each other. **Join a repository** stays its own page: after a clone you run `gspot install`, never `init`.
- `policy.md` becomes `gspot-toml.md`; `exclude.md` keeps its file name (the shipped naming list bans "and" in file
  names) and its title becomes "Exclude files and ignore findings"; `reference/runtime.md`
  becomes `reference/exit-codes.md`.
- **Every page teaches only the 14-command CLI.** Ten pages still show deleted flags (`--ci`, `--runner`, `--skip`,
  `-C`, `set --replace/--remove/--default`, `ignore --remove`); `DCX-001` lists every line and its replacement.
  After `init`, every page says `gspot install`.
- **Site code:** delete `Header.astro` (a copy of Starlight's), `Search.astro` (its screen-reader name reads
  "SearchCtrlK"), two repeated meta tags, and the three homepage pictures of text with empty alt text; load the
  homepage CSS only on the homepage; the docs `config/` and `types/` stay under your rule.
- `AGENTS.md`: the hand-written part contradicts your folder rule and the 14-command CLI; DCX-017 has the full
  replacement text.

## Decisions

Every decision is made. `areas/` and `placement/` follow them.

### Command line

1. 14 commands, one job each: `init`, `install`, `apply`, `check`, `add`, `remove`, `set`, `unset`, `ignore`,
   `unignore`, `list`, `explain`, `doctor`, `export`. No mode flags (CMD-092).
2. `init` asks only "Continue?" and never installs. `--dry-run` exists only on `init`, `apply`, and `check --fix`.
   `--json` is an option of each command that prints data. The program options are `--version` and `--help`.
3. `set` writes single values, list items, and table entries, never a `[[...]]` record. `unset` deletes a value (the
   default comes back, so it takes no `--reason`). `add` and `remove` select configurations and are the only writers
   of `removed_configurations`.
4. CI is turned on with `gspot set ci.enabled true`. A failed fixer exits 2; after Ctrl-C gspot exits 130 or 143.

### Install

1. Two install paths: a package-manager dev dependency, or a mise pin. gspot never pins itself or Node.
2. The program tools are pinned in `.gspot/mise.toml` and need mise on both paths. Without mise, `gspot install`
   installs what it can, names the missing programs, and exits 0. There is no `.mise/conf.d/` file and no `runner`
   setting.
3. One start command for the Git hooks and the `AGENTS.md` block: the package manager when the root `package.json`
   lists `@gspothq/cli`, otherwise `mise exec -- gspot`.
4. Packages install straight into `.gspot/`: no staging, swap, recovery, or "installing" state; if an install fails,
   run `gspot install` again. The npm and Yarn credential helpers write `${GSPOT_...}` references, never a token.
5. Python is pinned and uv installs it (GEN-015). The generated `.gspot/` files stay committed (GEN-022). gspot never
   touches `CLAUDE.md` (DOC-011).

### This repository

1. `scripts/gspot` and `scripts/gspot.cmd` stay until the last step of the order of work; then this repository runs
   the published gspot like any user's repository. Tasks live only in `mise.toml` (8); 3 scripts; no test runner
   script (`bun test` and a Bun preload). `gspot doctor` does not run in CI.
2. CI: 10 jobs, no shards, after the test-speed fixes; other CI changes go with the task changes. No scheduled CI.
   Eight of the 15 dependency overrides go now (RTX-001).

### gspot.toml

1. The target is in `areas/gspot-toml.md`: 163 keys; a reason sits next to the value it loosens; no quoted keys;
   record headers singular, list keys plural; every path relative to the repository root; record lists only at the
   root. No `[reasons]`, `[[generated]]`, `[[vendored]]`, root `exclude`, `runner`, or `docs.require_license`.
   Generated and vendored files are marked in `.gitattributes`. The editor schema ships in the npm package.
2. "settings", not "policy". Each setting is declared once, in TypeScript, with its defaults.

### Code layout and names

1. `config/` and `types/` in every package, under the import rule and the type rule in the section above.
2. Delete the generated `public.*`/`contracts.*` import rule first; then give every file a name that says what it
   holds (`placement/target-tree.md`).
3. `platform/` becomes `system/` (the machine); generic code (`errors.ts`, `objects.ts`, `text.ts`, `units.ts`)
   moves to `src/`; `lifecycle/` splits into `ownership/`, `install/`, `apply/`; `policy/` becomes `settings/`.
   "rules", not "agent rules"; naming rules are `NamingSettings`.
4. The `.eta` templates go: plain files, and typed TypeScript builders where code is needed.

### Configurations

1. React DOM stays its own configuration. The six copied Vale styles go, the three upstream rules turn off, and the
   380 path entries go (IGN-002). The Vale style `banned-headings` stays, written by the Vale builder from the shipped
   list and the root setting `docs.banned_headings`; the TypeScript check `docs/headings` goes.
2. The check `example` text stays: the docs check pages read it.

### Tests

1. The layout above: `unit/`, `integration/`, `e2e/`, `config/`, `types/`, `setup/`. Test data goes to
   `tests/config/<topic>.ts`. A test file over 300 lines splits into a folder named after its source file.
2. Every weak, fake, duplicate, and self-policing test is deleted. No new tests are planned now; the untested-logic
   rule decides after the cut. No test-only install cache.
3. The Supabase test that needs Docker is deleted; its other cases stay ordinary integration tests.

### Docs

1. 24 pages: separate quickstarts for Python, Swift, and JavaScript and TypeScript; separate Upgrade, Remove, and
   Join pages. Every page teaches only the final CLI, the final `gspot.toml`, and the two install paths.

## Order of work

Each step leaves the repository working: tests pass, CI calls only tasks and scripts that exist, and the hooks run the
source CLI through the launchers until the last step.

0. **Unbreak** (no publish): the six items in "Broken right now", in that order.
1. **Bugs** whose code stays and whose fix needs no later step. A bug in code that the plan deletes is fixed by the
   deletion; the bug table names the step of each bug.
2. **Delete**: self-policing code and tests, dead code, binary leftovers, lazy ignores and suppressions.
3. **Names and `config/`/`types/`**: delete the import rule, restore file names, move folders, then apply the
   `config/` and `types/` rule and move inline values. One top-level folder per commit.
4. **Tests, tasks, and CI together**: the new `tests/` layout, the Bun preload, the 8 mise tasks, and the workflows in
   the same commits, so CI never calls a deleted task or script. The shards stay until step 9. `install:checks` and
   the part of `scripts/plugin.ts` that packs the ESLint plugin stay until step 11: until the first publish they are
   the only way to install the plugin here.
5. **gspot.toml and the CLI**: the target `gspot.toml`, settings declared in TypeScript, the 14-command CLI. This
   repository's own `gspot.toml` moves to the new shape in the same commit as the reader.
6. **Install design**: `.gspot/mise.toml`, no `runner`, one start command for hooks and `AGENTS.md`, the credential
   helpers. This repository's `mise.toml` pins `node = "24.20.0"` in the same commit that deletes the `conf.d` file.
   The launchers stay.
7. **Templates**: `.eta` files to plain files and TypeScript.
8. **Docs**: the 24-page plan and the jargon rewrite.
9. **Test speed, then CI**: the test-speed fixes (TTC-001, TTC-002, TTO-002, LIF-001), then 10 jobs instead of 95:
   `unit`, `integration`, and `e2e` once for each operating system, plus the docs build. No shards (RTX-003).
10. **First publish**: the build writes `packages/cli/gspot.schema.json` into the package (CFR-001); the license and
    plugin-type fixes are in (ROOT-012, PLG-015); publish `@gspothq/cli` and `@gspothq/eslint-plugin` 0.1.0 by hand;
    relock `.gspot/bun.lock` against npm; turn this repository's gspot CI back on (`gspot set ci.enabled true`). A
    published version can never change, so nothing ships before this step.
11. **Run this repository on the release**: pin `npm:@gspothq/cli@0.1.0` in `mise.toml`; delete the launchers,
    `disable_tools`, `[env] _.path`, `install:checks`, and the rest of `scripts/plugin.ts`; `gspot apply`; commit. Push steps 10 and 11 together, so the first run of the
    generated job already uses the release.

**Verify with one real run** (reading cannot settle these): the mise behaviors INX lists (a config in a subfolder,
`mise install` and `mise bin-paths` with named tools, prune, trust of inline options); Bun preload stacking; that each
Bun test group of step 4 runs only its own tests while the shards remain; one release run; the JavaScript section of the
JavaScript-and-TypeScript quickstart.

## Placement

`placement/README.md` lists where every file, function, constant, type, and test goes, or that it is deleted: one
row for each of the 9,313 items, in 19 pages, plus `placement/target-tree.md` with every file of the target layout.

## Images

| Image                                      | What it shows                                                      |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `images/repository.png`                    | The top level of the repository, today and the target              |
| `images/source.png`                        | `packages/cli/src`, today and the target                           |
| `images/imports.png`                       | Which folder imports which, and the 9 type-only cycles             |
| `images/tests.png`                         | `tests/`, today and the target, with the test counts               |
| `images/install.png`                       | Every way to install and run gspot today, and the two target paths |
| `images/docs.png`                          | The 27 docs pages and the 24-page target                           |
| `images/cli.png`                           | Every command and flag today, and the 14-command target            |
| `images/gspot-toml-today.png`              | Every `gspot.toml` table and key today, with its verdict           |
| `images/gspot-toml-target-1.png`, `-2.png` | The target `gspot.toml`: every table and key, and an example file  |
| `images/codex.png`                         | What changed while Codex worked alone                              |

## Files

| File                                        | IDs                                         | What it covers                                                                                       | Findings |
| ------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------: |
| `areas/architecture.md`                     | ARC, LAY                                    | Source architecture, imports, and the config/ and types/ folders                                     |       16 |
| `areas/checks-general.md`                   | CKG, S01                                    | General checks                                                                                       |       60 |
| `areas/checks-other.md`                     | CKO, S02                                    | Language, database, framework, library, platform, infrastructure, and testing checks                 |       45 |
| `areas/codex-decisions.md`                  | DEC                                         | What Codex did                                                                                       |       12 |
| `areas/commands.md`                         | CLX, CMD, DS1, S03                          | The command line                                                                                     |       86 |
| `areas/configurations-general.md`           | CFG                                         | Shipped general configurations                                                                       |       40 |
| `areas/configurations-languages.md`         | CFL, S5C                                    | Shipped language, framework, library, infrastructure, platform, testing, and database configurations |       60 |
| `areas/docs.md`                             | DCP, DCX, DOC                               | The documentation site, READMEs, and AGENTS.md                                                       |       92 |
| `areas/eslint-plugin.md`                    | DEC, PLG, S03                               | The ESLint plugin                                                                                    |       44 |
| `areas/execution-generation.md`             | EXG, S04                                    | Running checks and writing generated files                                                           |       70 |
| `areas/gspot-output.md`                     | GEN                                         | The files gspot writes into this repository                                                          |       19 |
| `areas/gspot-toml.md`                       | CFR, DS2, POL, S09, TMF, TML                | gspot.toml: the settings file and its code                                                           |       89 |
| `areas/install-apply-tools.md`              | LIF, S05                                    | Install, apply, ownership, planning, tools, and rules                                                |       60 |
| `areas/install.md`                          | INS, INX                                    | Installing and running gspot                                                                         |       26 |
| `areas/naming-source.md`                    | NMS                                         | Names in the code                                                                                    |       10 |
| `areas/naming-user-facing.md`               | NMU                                         | Names users see                                                                                      |       32 |
| `areas/parsers.md`                          | PAR, S07, S08                               | Parsers and the manifest schema                                                                      |       80 |
| `areas/repository-ignores.md`               | IGN                                         | This repository's ignore and allow entries                                                           |       15 |
| `areas/root-scripts-ci.md`                  | ROOT, RTX, SCR                              | Repository root, scripts, mise tasks, and CI                                                         |       46 |
| `areas/self-policing.md`                    | SLF                                         | Self-policing and defensive code                                                                     |        2 |
| `areas/suppressions.md`                     | SUP                                         | Inline suppressions and test skips                                                                   |        4 |
| `areas/system-repository.md`                | PLR, S06                                    | The machine (system) and the repository                                                              |       51 |
| `areas/test-layout.md`                      | DT3, ST4, ST5, TCO, TGN, THR, TPP, TPR, TTC | The tests/ layout and shared test code                                                               |       53 |
| `areas/tests-checks-general.md`             | ST1, TCG                                    | Unit tests of the general checks                                                                     |       59 |
| `areas/tests-checks-other.md`               | DT1, ST1, TCO                               | Unit tests of the other checks                                                                       |       44 |
| `areas/tests-commands.md`                   | DT1, ST2, TCM                               | Unit tests of commands, configurations, and rules                                                    |       43 |
| `areas/tests-execution-install.md`          | ST3, TEL                                    | Unit tests of execution, install, apply, and ownership                                               |       44 |
| `areas/tests-generation.md`                 | DT1, ST2, TGN                               | Unit tests of file generation                                                                        |       58 |
| `areas/tests-integration-configurations.md` | ST5, TTC                                    | Integration tests of the configurations                                                              |       32 |
| `areas/tests-integration-other.md`          | ST5, TTO                                    | Other integration tests                                                                              |       38 |
| `areas/tests-parsers-settings.md`           | ST3, TPP                                    | Unit tests of parsers and settings                                                                   |       43 |
| `areas/tests-system-repository.md`          | ST4, TPR                                    | Unit tests of planning, system, repository, and tools                                                |       49 |
| `glossary.md`                               |                                             | One name for each concept                                                                            |          |
| `cli-help.txt`                              |                                             | The full help of every command today                                                                 |          |
| `placement/`                                |                                             | Where every file, function, constant, type, and test goes                                            |          |
| `images/`                                   |                                             | The images listed above                                                                              |          |
