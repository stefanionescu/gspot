# Findings

Review of `architecture/` (31 files, 760 KB) and the current implementation (`src/`, `config/`, `types/`, `presets/`, `tests/`), done 2026-09-17. `reference-rules/` was ignored as asked. Everything below was checked by reading the code and by running the tool on a scratch repository and on this repository. No subagents were used.

## 1. Verdict

**The architecture needs a rewrite, not a cleanup. The code needs to be mostly deleted.**

- The design is about ten times bigger than the product it describes, and it is the wrong shape in three load-bearing places (section 3). Refactoring the documents would leave those in place.
- The code is clean-looking, typed, and 285 tests pass, but it is a thin, half-wired rendering of that design. It cannot pass its own gate on any real repository, including this one. About a third of the schema it parses is read by nothing.
- Roughly 800 of the 6,900 source lines are worth keeping as material for a rebuild (section 9). The rest costs more to understand than to rewrite.

Short answers to the questions you asked:

| Question | Answer |
| --- | --- |
| Do the commands make sense against known CLIs? | The verbs are fine. There are too many of them (14) for what exists, and three of them (`config`, `explain`, `report`) print things nobody asked for. See section 6. |
| Does it integrate with any git and non-git repo? | Git only. A non-git directory exits 2. The docs promise a `.gitignore`-honouring walk that does not exist. Git repos work only if you accept a gate that always fails. |
| Sane logic, comments, outputs, text? | Logic: mostly sane in the small, wrong in the large. Comments: there are none (0 line comments, 1 block comment in `src/`). Outputs: misaligned, noisy, and in several places untrue (section 5). |
| Can a developer customise rules, banned terms? | Exceptions and limits, yes. Banned terms, no. The naming preset does not exist, so there is nothing to customise. 17 of the 22 `[limits]` settings are read by nothing. |
| macOS, Linux, Windows? | macOS and Linux. Windows will not work: bash hooks, `chmod`, `tar`/`unzip` via shell, `/`-split paths, `mise` tasks as bash scripts. |
| Bun by default? | No. Bun is the build and test tool. The runtime is Node (`#!/usr/bin/env node`, `engines.node >= 22`, `--target=node`). Tests use `Bun.file`, so they only run under bun. It is mixed, and should be one or the other. |
| Are tests filler? | Not filler, but they prove less than the count suggests. Section 7. |
| ISO 24495 in comments and prose? | No. The source has no prose. The architecture prose fails the standard's first principle (readers can find what they need). Section 8. |
| Bloated, over-engineered? | Yes. Section 3. |
| Stupid names? | Yes, systematically. The banned-word policy pushed the author into cute verbs and vague nouns. Section 5.4. |
| Nuke everything? | Nuke the architecture folder and replace it with one short document. Keep about 800 lines of code as parts. Rebuild around the smaller product in section 9. |

## 2. What the tool does today, observed

A scratch repository with one shell script, one SQL file, a README and a `package.json` with `express`:

```text
$ gspot init --yes
runner           none found          <- then proposes and writes mise.toml anyway
write  gspot.toml, .gspot/  "generated tool configuration and the coverage table"   <- no table is written
change mise.toml "add tool pins. Your own pins are untouched."   <- creates the file, writes 0 pins

$ gspot check
28 lines for 4 files. 18 structure checks print "ok 0 files".
structure/trivial-function FAIL     <- greet() { echo "hi $1"; } is "trivial"
structure/single-file-folder FAIL   <- scripts/ has one script
sh/shfmt FAIL                       <- shfmt defaults to tabs; [format] says 2 spaces and is never passed to shfmt
coverage  2 unchecked (README.md, package.json)  2 partial (every .sh and .sql is partial by definition)
exit 1
```

`gspot check` fails on every repository that has a README, forever, until presets for Markdown, JSON, TOML, YAML and every other extension exist. The SQL and Bash presets require seven inspections and supply two or three, so every file they claim is `partial` by construction. There is no way to pass.

More from the same session:

- `gspot init` in a terminal asks nothing. `@clack/prompts` is a dependency and is never imported. `confirm` is a parameter no caller passes, so the plan is always accepted. The document says "nothing is written until the final confirmation".
- `gspot check --since HEAD` produces an empty file list, then runs `shellcheck` with no arguments, which exits non-zero, which is reported as one finding.
- `gspot fix` reformats the script to tabs, contradicting the repository's `[format]` block. The fix converges, so the run passes. The single source of formatting truth is not connected to the formatter.
- `gspot uninstall` prints "changed .gitattributes (the managed block only)", "changed CLAUDE.md", "changed AGENTS.md" for files that do not exist, and leaves `mise.toml` and `.mise/tasks/gspot/` behind, which `init` wrote.
- `gspot doctor` exits 1 on any repository with a `.md` file.
- `gspot hooks install` writes `exec gspot check --stage pre-commit`. That needs `gspot` on `PATH`. Under `npx`, `bunx` or `mise exec` it is not.
- `gspot check --stage pre-commit` runs over the whole tree. The docs say staged files.
- Every `gspot check` first runs `measure()`, which invokes every tool once in listing mode over every file, and then invokes it again to check. Two sqlfluff runs per check. There is no cache, although the docs describe two.
- The repository does not lint itself. There is no `gspot.toml` at the root. "Self-lint is a release gate" is prose.

## 3. Architecture findings

Ordered by how much they decide.

### A1. Coverage as the verdict makes the tool unadoptable

`02-model.md`, `05-coverage.md`, `09-gates.md`. Every tracked path must land in a passing status or the gate fails, and there is deliberately no setting to turn that off ("What is deliberately not easy"). With four presets shipped, that is a gate that fails on `README.md`. With forty presets it will fail on `.editorconfig`, `LICENSE`, `Makefile`, `.nvmrc`, `.env.example`, `CODEOWNERS`, `renovate.json` and every other file a repository accumulates, each needing a `[[declare]]` line with a reason.

The insight behind it is right: know which files nothing reads. The mechanism is wrong: that is a report, or an opt-in check with a default allowlist of well-known repository files, not the exit code of every hook. Section 9 keeps the report and drops the verdict.

### A2. "Claims are reported by the tool" (D-02) doubles cost and buys little

The design's central trick: run each tool in a listing mode, parse its output with a per-tool regex, and count the paths it names. Consequences in the code:

- Six listing mechanisms (`file-list`, `print-config`, `project-graph`, `check-mode`, `ignore-replay`, `declared`), each with a code path, a field set and a trust level.
- Every check runs its tool twice per `gspot check` (`src/coverage/measure.ts:75` then `src/run/execute.ts:40`).
- Per-tool output regexes (`ignored_regex`, `path_regex`) that break on a tool upgrade.
- A hand-written gitignore engine (`src/coverage/gitignore.ts`, 114 lines) to replay ignore files for tools that walk the tree themselves.

The problem it solves is `.sqlfluffignore` hiding 58 files. The simpler fix, which `05-coverage.md` itself states, is: gspot owns the file list, hands it to every tool explicitly, and never lets a tool consult its own ignore file. Then coverage is known without asking anyone, and "which check read this path" is a lookup in gspot's own table. Tools that cannot take a file list (tsc, knip, xcodebuild) are the exception and get one special case each.

### A3. The abstraction surface is built for the end state, and the end state is enormous

Counted from `types/manifest.ts` and the docs: 7 preset kinds, 16 inspections, 8 coverage statuses, 6 listing mechanisms, 4 implementation mechanisms, 5 setting directions, 3 operations, 3 runners, 4 CI providers, 5 stages, 3 requirement kinds, 3 invocation shapes, 4 fix stages, 6 tool providers, 3 skip predicates, 14 commands, 11 languages, 40-plus tools, 9 builtins, 24 structure checks.

What exists: 4 presets, 2 external tools, 1 runner, 0 CI emitters, 0 rule files installed. Every enumeration above has a parser, a validator with a two-paragraph error message, a type, and in most cases nothing that reads the value. `src/settings/check.ts` alone is 200 lines of manifest validation for fields like `mechanism`, `searched`, `justification`, `invocation_modes`, `takes`, whose only consumer is the validator.

The documents make this worse by treating every reference-repository defect as a requirement. `01-findings.md` is 70 KB of archaeology about four private repositories. The design should have extracted ten rules from it and thrown it away.

### A4. Half the product does not exist in the code, and the half that exists points at it

R1 and R7 say gspot is also "a repository of LLM rules" that installs `CLAUDE.md`, `AGENTS.md` and `rules/`. In the code:

- No assembler, no corpus loader, no `rules/` output. `Preset.rules` is parsed (`src/settings/preset.ts:209`) and never read.
- `[rules] install = true` is written into `gspot.toml` and never read.
- `gspot init` appends a block to `CLAUDE.md` saying "The rules for this repository live under `.gspot/rules/`", which is never created (`config/blocks.ts:6`).
- `reference-rules/merged/` (848 KB) is the intended corpus, is known corrupt (`HANDOFF.md` lists six global find-and-replace defects), and nothing reads it.

The naming policy, which `12-structure-and-naming.md` calls "the densest asset", has no preset, no emitter and no term list in the tree. `config/presets.ts` implies `repository:naming` for every language and `select()` silently skips it because it does not exist.

### A5. mise-first is the wrong default for "any repo"

`init` proposes `runner = "mise"` when no mise config exists and no `mise` binary was checked for, then writes `mise.toml` and `.mise/tasks/gspot/*` into a repository that never asked. A JavaScript repository expects `package.json` scripts and husky or lefthook. A Python repository expects `uv` and `pre-commit`. A Swift repository expects nothing. mise is the author's tool, not the ecosystem's. The bun and npm runners the docs promise are parsed as valid values and emit nothing (`src/commands/generate.ts:120`).

### A6. A private tool installer reimplements mise, aqua, ubi and proto

`src/toolchain/install.ts` and `lock.ts` (235 lines): download a URL template, verify SHA-256, `tar`/`unzip` through the shell, find the binary, `chmod`. No preset carries a URL, so it has never run against a real asset. Every runner the docs name (mise, npm, uv, pipx) already does this with a lockfile. gspot should pin versions and tell the package manager, not be one.

### A7. Everything is an error, and the adoption device is not wired

D-07 removes warnings and relies on baselines. `init` never writes a baseline. `generate` updates baselines only when a previous run exists (`src/commands/generate.ts:87`). So a repository with findings gets a failing gate on day one, which is the situation D-07 says it prevents. Either the baseline is written at `init`, or warnings come back. A tool with no warning level and no working baseline has no adoption path.

### A8. Git-only and POSIX-only, stated inconsistently

`17-lifecycle.md` promises a `.gitignore`-honouring walk without git; `src/coverage/tracked.ts:9` throws. `08-tasks-and-tools.md` says Windows through WSL only, `16-cli.md` says nothing. The code uses `#!/usr/bin/env bash` for hooks and tasks, `chmod 0o755`, string-splits on `/`, and shells out to `tar`. Pick "git required, POSIX required" and say it once, or do the work. Non-git is worth supporting because the answer is one `fs.readdir` walk plus the `ignore` package.

### A9. Scopes come from manifest directories, which is not what a monorepo is

`src/detect/propose.ts:74` makes a scope per directory holding a `package.json`, `pyproject.toml`, `Cargo.toml` and so on. A repository with a `tools/scripts/package.json` for one dev script gets a scope. pnpm `workspaces`, npm `workspaces`, `uv` workspaces, Cargo workspaces and Xcode workspaces, which are where monorepo structure is actually declared, are not read.

### A10. The design bans the words it needs

`03-repo-layout.md` bans `util`, `helper`, `common`, `shared`, `core`, `manager`, `data`, `info`, `object`, `base`, `load`, `fetch`, `render`, `generate`, `resolve`, `sync`, `and`, `or`, `with`, `when`, `once`. Then it names a command `generate`, a function `render`, a folder `shared` (`rules/shared/`), and a module `first-per-key.ts` at the source root because nothing may be called a utility. Section 5.4 shows what this did to the identifiers.

### A11. The documents contradict each other and themselves

Sampled, not exhaustive:

- `HANDOFF.md` says v0 commands are `init, generate, check, coverage, report, fix` and "nothing else". `16-cli.md` and `src/commands/tree.ts` have 14.
- `03-repo-layout.md` says "Why a monorepo of packages" and "One package. Nothing here is published separately" on the same page.
- `16-cli.md` names `listr2` as one of three libraries. It is not a dependency and nothing imports it.
- `04-presets.md` shows a manifest with `[[configs]] stub`, `stub_kind`, `[rules]`, `direction = "declared-per-rule"`; the loader refuses `stub`, ignores `[rules]`, and `direction` is read for two of five values.
- `21-roadmap.md` says phase 0 is SQL and Bash only and "no artefacts before the engine"; the tree has 60 ast-grep YAML files for five languages and no TypeScript preset.
- `05-coverage.md` JSON sample has `"partial": 0, "partial": 0`. `04-presets.md` has "The     hteen rules" and "Kind required inspections". `08` is titled "Runner, Tasks and Tool Tool installation". `11` has "is an setting" and "a installed step". `21` has "editing      00 lines". These are the marks of unreviewed generation.

## 4. Custom logic that libraries or existing tools already cover

| Where | What it hand-rolls | Replace with |
| --- | --- | --- |
| `src/coverage/gitignore.ts` (114 lines) | gitignore pattern compiler on top of picomatch, plus `judge`/`decide` | `ignore` npm package (the one ESLint and Prettier use). Or drop the replay entirely per A2. |
| `src/coverage/ignore-replay.ts` | a second `judge` (`replay`) over multiple ignore files | same |
| `src/commands/mistake.ts` (36 lines) | Levenshtein distance for "did you mean" | commander `showSuggestionAfterError()` does this already |
| `src/commands/completion.ts` | hand-written bash, zsh, fish completions listing command names only | `omelette` or `tabtab`, or drop the command until flags complete too |
| `src/runner/mise.ts:103-139` | regex-edits `mise.toml` sections and reads `[tools]` with a line regex | write a whole file to `.mise/conf.d/gspot.toml`, which mise merges. No editing, no regex. |
| `src/toolchain/install.ts`, `lock.ts` | downloader, checksum, archive unpack, lockfile format | mise, or `npm`/`uv` pins. See A6. |
| `src/run/invoke.ts` (114 lines) | spawn wrapper with timeout, output cap, ENOENT detection | `execa` or `tinyexec`; `Bun.spawn` if bun is the runtime |
| `src/toolchain/presence.ts:35` | PATH walk to find a binary | `which` package, or `Bun.which` |
| `src/coverage/classify.ts:43` | binary sniff by NUL byte in first 8000 bytes | `isbinaryfile`, or `git diff --numstat` reporting `-` for binaries, which is git's own answer |
| `src/configuration/render.ts` | `{{ name \| raw }}` template language | fine at 55 lines, but `eta` or `mustache` if it grows a conditional |
| `src/run/report.ts:103` | SARIF document with no locations | `node-sarif-builder`, or nothing until findings carry positions |
| `src/detect/manifest.ts:94-118` | regex readers for `Package.swift`, `go.mod`, `Cargo.toml`, `Gemfile` | delete until a preset for those languages exists |
| `src/settings/toml.ts` (125 lines) | typed accessors over `smol-toml` output | `zod` or `valibot` schema on the parsed document: one schema, one error format, half the code in `check.ts`, `document.ts`, `preset.ts`, `declaration.ts` gone |
| `src/structure/*` on `@ast-grep/napi` (about 900 lines with builtins) | grammar registration, per-file parsing, ERROR-node walk, rule execution, counting | the `ast-grep` CLI (`sg scan --json -c sgconfig.yml`). It already has rule directories, `languageGlobs`, severity, `ignore` comments with a reason, a JSON reporter, and parse-error reporting. Then the napi binary, the dynamic grammar packages, the 7 MB `.node` file copied into `dist/`, and `trustedDependencies` all go away. |
| `src/structure/counter.ts` | ceiling counter over ast-grep matches | keep as a 40-line post-processor over `sg --json` output |
| `src/structure/reach.ts` | shell dead-function finder by regex over all files | keep, it is the one real analysis. 70 lines. |
| `src/structure/walk.ts` | single-file folder, prefix collision | keep, 65 lines |
| `src/coverage/attribute.ts` | `git check-attr` parsing | keep, 54 lines |
| `presets/repository/structure/rules/*/{javascript,tsx}.yml` | 22 files byte-identical to `typescript.yml` except the `language:` line | one file each with ast-grep `languageGlobs`, or generate at build time |

## 5. Code findings

### 5.1 Correctness

- `src/commands/init.ts:36` never prompts. `interactive` is computed in `src/gspot.ts:24` and passed to `missing()` only to decide whether to demand flags.
- `src/commands/check.ts:243` `--since` with no changed files hands tools an empty list; `src/run/execute.ts:163` then runs them with no arguments. Empty path list must short-circuit to "nothing to do".
- `src/commands/uninstall.ts:19` reports every managed file as changed whether it exists or not, and does not remove `mise.toml` pins or `.mise/tasks/gspot/`.
- `src/settings/proposal.ts:7` proposes `mise` unconditionally; `src/commands/generate.ts:119` then writes mise files unconditionally for that runner.
- `src/settings/proposal.ts:36` says `.gspot/` will hold "the coverage table"; nothing in `init` writes one.
- `presets/language/bash/manifest.toml:73` runs `shfmt --diff` with no `-i`, `-ci`, `-bn` flags, so `[format]` never reaches shfmt. `sqlfluff.cfg.tmpl` does read `format.*`, so the two formatters disagree by design.
- `presets/language/sql/manifest.toml:31` hard-codes `--dialect=ansi` in three places. The `[sql]` table the docs describe does not exist.
- `presets/repository/structure/rules/trivial-function/bash.yml` matches every one-command function. `greet() { echo "hi $1"; }` is a finding. So is every `main() { run "$@"; }`. The doc's definition ("forwards only, one caller") is not what the rule expresses.
- `src/structure/walk.ts:5` `single-file-folder` fires on `scripts/`, `bin/`, `.github/workflows/` with one file, `docs/`. Every repository has these.
- `src/coverage/status.ts:44` marks every `.sh` and `.sql` file `partial` because `[required]` in the manifests lists inspections (`naming`, `prose`, `spelling`, `structure` for SQL) that no shipped check provides.
- `src/commands/doctor.ts:47` exits 1 when any extension is unclaimed. Always true.
- `src/runner/hooks.ts:11` hook body is `exec gspot check`, resolved from `PATH`.
- `src/run/graph.ts:82` `waves()` keys nodes by `name` while `buildGraph()` keys by `name@scope`; two scopes with the same task name collapse into one wave entry and the second is dropped from `remaining` after the first is marked done. Untested because no test has two scopes.
- `src/commands/check.ts:172` runs every check in a wave under `Promise.all` with no concurrency limit. Forty tools over a monorepo will spawn forty processes at once.
- `src/commands/check.ts:250` re-reads every claimed file from disk to scan for suppressions on every run, after `measure()` already read the same files for binary sniffing and `parseEach()` read them again per builtin.
- `src/run/execute.ts:75` and the eight builtins each call `parseEach()` over the whole path list. One `gspot check` parses every source file with tree-sitter nine times.
- `src/coverage/measure.ts:79` and `:126` call `readIgnoreSources()` twice per check, re-reading the ignore files each time.
- `src/commands/explain.ts:9` explains check ids, not rules. `gspot explain no-unused-vars` says "not a check the current selection carries". `ruff rule` and `biome explain`, which it cites, explain rules.
- `src/commands/config.ts:29` matches a tool by substring of the generated path. `gspot config sh` matches `shellcheckrc`.
- `src/commands/upgrade.ts:17` with no `--against <path>` prints a paragraph. `--to` is interpolated into that paragraph. The upgrade command upgrades nothing.
- `src/run/report.ts:103` SARIF has `locations: []` on every result. No tool that consumes SARIF will show anything.
- `src/commands/report.ts` `describePresence(entry, 0)` in `doctor.ts:22` always prints "effect 0 path(s) lose an inspection".
- `package.json` `files` lists `ast-grep`, a directory that does not exist. `bin` points at `dist/gspot.js`, which loads presets from `../presets` relative to `dist`, fine, but also needs the 7 MB `.node` sidecar that `bun build` copies with a hashed name.

### 5.2 Parsed and never read

- `Check.invocationModes` (`invocation_modes`)
- `Check.mechanism`, `searched`, `justification`: read only by the validator that demands them
- `Check.takes = 'one-file'` is honoured; `'file-list'` and `'project'` are the same code path minus the tail
- `Preset.rules`, `Preset.shared`, `Preset.supplies` (read, but the concept exists only to let `repository:structure` claim extensions without `[required]`)
- `SettingSlot.direction`: `'declared-per-rule'`, `'tightening'`, `'neutral'` are never distinguished
- `[gate] ci`, `[rules] install`, `runner = "bun" | "npm"`
- 17 of 22 `limits.*` settings in `presets/repository/structure/manifest.toml` (`cognitive_complexity`, `cyclomatic_complexity`, `branches`, `returns`, `statements`, `locals`, `boolean_expressions`, `nesting`, `public_methods`, `trivial_statements`, `trivial_nodes`, `function_parameters`, `file_lines`, `function_lines`, ...): no check measures against them. `gspot config` prints them as if they did.
- `ToolRequirement.url`, `Provider` values other than `download`, `host`
- `CheckStatus 'cached'`, `Stage 'ci'`, `Stage 'release'`
- `COVERAGE_DELTA_SAMPLE`, `SHELL_CALL_PATTERN` (used once, could be inline)
- `types/coverage.ts` `TrackedLink.inside`: computed, stored, never consulted

### 5.3 Duplicated logic

- `gitignore.ts` `judge()` and `ignore-replay.ts` `replay()` are the same algorithm over one file and many files.
- `src/settings/policy.ts` has five functions (`configArgsOf`, `ruleSetsOf`, `checksOf`, `sweepOf`, `inspectionsByCheck`) that each loop `presets × checks` to build one map. `toolsOf`/`gatesOf` in `presence.ts` are two more. One indexed `Policy` would replace all seven.
- `src/commands/check.ts:102` re-renders every generated file to detect drift on every check, and `generate.ts:43` does the same thing with one extra assertion.
- `src/commands/generate.ts:87` and `check.ts:115` carry the same `baselineRefusedFor` error text twice.
- `src/settings/declaration.ts:88` `covers()` and `check.ts:204` `allowed()` both decide whether an exception applies to a path, with different field logic.
- `src/structure/call-through.ts:51` `nameIn()` and `reach.ts:67` `declaresItself()` both re-derive function shape from text after the tree already parsed it.
- `first-per-key.ts` is `uniqBy`. It sits at the source root because no folder may be called `util`.

### 5.4 Names

The naming policy produced the opposite of clarity. Types and functions that describe nothing:

| Name | Where | What it is |
| --- | --- | --- |
| `Surroundings` | `types/commands.ts:9` | the CLI context (cwd, presets path, version, a writer) |
| `Lines` | `types/commands.ts:19` | a command result |
| `Answer` | `types/run.ts:14` | a process exit result |
| `Skip` | `types/run.ts:27` | a skip reason |
| `Nature` | `types/coverage.ts:40` | file classification |
| `Anchor` | `src/coverage/status.ts:50` | three fields of a status being built |
| `Suppressible` | `types/settings.ts:29` | the target of an exception |
| `Loosening`, `DeadEntry` | `types/settings.ts` | a setting override with a reason; a no-op override |
| `takes` | manifest field | how the tool accepts its inputs |
| `supplies` | manifest field | "claims files it does not own" |
| `inspects` | manifest field | categories |
| `sweepOf(policy)` | `src/settings/policy.ts:85` | build the inputs for `measure()` |
| `measure()` | `src/coverage/measure.ts` | compute coverage |
| `handed()`, `reported()`, `asserted()`, `perCandidate()` | `src/coverage/listing.ts` | the four listing strategies |
| `narrow()`, `wanted()`, `kept()`, `allowed()`, `turnedOff()` | `src/commands/check.ts`, `execute.ts` | filters |
| `howToMove()` | `src/commands/upgrade.ts:36` | the message printed when upgrade cannot upgrade |
| `planFrom()`, `proposeAnswers()`, `readRepository()` | `src/settings/proposal.ts`, `reading.ts` | init's three phases, living under `settings/` |
| `mistake.ts`, `tree.ts` | `src/commands/` | unknown-command message; the commander program |
| `optional(key, value)` | `src/settings/optional.ts` | conditionally spread one property. Called 40 times because `exactOptionalPropertyTypes` is on. |
| `at`, `where`, `what`, `found`, `mine`, `theirs`, `ours`, `here`, `there` | throughout | local variables |

The error strings are worse: they argue. `src/settings/check.ts:26` "Both are reviewed at every release; that is what stops a fifth quality folder growing." `src/settings/document.ts:50` "an automatic migration is how a loosening entry survives a rename without anybody reading it again." A user who mistyped a field gets a paragraph of the author's philosophy. Error text should say what is wrong and what to type.

### 5.5 Output

- Columns are padded to 20 and check ids are 33 characters, so the table is jagged from the sixth line on.
- Checks that read zero files still print a line. On a 4-file repository that is 18 lines of `ok 0 files 0.0s`.
- `exceptions   0` prints on every run. `why` lines restate the table above them. `reproduce:` names only the first failure.
- Tool output is shown only through `report --failed`, not in `check`. The docs promise verbatim tool output on failure.
- `report --failed` shows shfmt's diff correctly. That is the one output that reads well.

## 6. The command surface against CLIs people use

What `trunk check`, `qlty check`, `pre-commit run`, `lefthook run`, `treefmt`, `biome check`, `ruff check` and `mise` have in common: one verb runs everything, `--fix` is a flag on it, `--staged`/`--all-files` selects the input, `init` writes config, and there is at most one diagnostic command. None has `coverage`, `report`, `config`, `explain`, `upgrade`, `install`, `hooks` and `completion` as separate top-level verbs at version 0.1.

| Current | Keep? | Why |
| --- | --- | --- |
| `init` | yes | fine, once it asks |
| `check` | yes | add `--fix`, `--staged`, `--all`, `--json`. Drop `--inspects`, `--unchecked`. |
| `fix` | fold into `check --fix` | every listed peer does this |
| `generate` | rename `sync` | "generate" is on the banned list the project ships. `mise`, `cargo`, `swift package` all use "sync/update/resolve" for this |
| `generate --check` | `check` does it | drift is one more check, not a mode |
| `coverage` | fold into `doctor` or `check --json` | it is a report |
| `report` | drop | `check --json` and a `.gspot/last.json` cover it |
| `config` | drop, or `doctor --settings` | lists 28 numbers that mostly do nothing |
| `explain <rule>` | drop until it explains rules | it explains check ids |
| `doctor` | yes | the one diagnostic command |
| `install` | drop | delegate to the runner |
| `upgrade` | later | today it prints a paragraph |
| `uninstall` | yes | good idea, fix the lies |
| `hooks install/uninstall` | fold into `init --hooks` and `sync` | |
| `completion` | later | commander does not ship one; a stub that completes verbs only is not worth a command |
| (missing) `rules` | add | install and refresh the agent rule files. This is half the product. |

## 7. Tests

285 tests, 64 files, 3.9 seconds, all pass. What they are:

- **Real and valuable**: `integration/coverage/gitignore-replay.test.ts` runs `git check-ignore` against the replay on eight idioms. `integration/structure/languages.test.ts` proves one rule across five grammars. `integration/commands/init.test.ts` plants a repo and checks the written files. `unit/settings/preset/invariants.test.ts` checks the loader refuses bad manifests.
- **Depend on host tools nobody declared**: `coverage.test.ts` and `init.test.ts` invoke `sqlfluff`, `shellcheck`, `shfmt` from `PATH`. On a machine without them the suite fails. Some individual assertions would still pass for the wrong reason, because "tool missing" and "file ignored" both produce `unchecked` (`coverage.test.ts:24`). No CI config, no tool pin, no skip.
- **Assert the shape of a message, not a behaviour**: about a third match a regex against an error string the test author also wrote.
- **Not tested at all**: `src/commands/tree.ts` (the CLI itself; no test parses argv), `src/gspot.ts` exit codes, `fix`, `doctor`, `explain`, `config`, `report`, `install`, `hooks` command, `upgrade`, `uninstall`, `check --since`, `check --stage`, `check --scope`, two-scope graphs (which would find the `waves()` bug), any repository with more than five files, any output snapshot, Windows paths.
- **Count inflation**: many `it()` blocks assert one field of the same fixture. The 285 is closer to 90 behaviours.

Not bullshit. Also not proof that the tool works, because the tool does not work end to end and no test tries that.

## 8. Prose, comments, ISO 24495

- `src/` has no comments. That is a choice the architecture makes ("a comment is for what the code cannot say") and then does not follow, because the code says nothing about why `measure()` runs before checks or why `supplies` exists. A reader needs the 760 KB to understand 7 KB.
- The architecture text is not plain language. Sentences are short, active and present tense, which is the ASD-STE100 half. The ISO 24495-1 half is missing: a reader cannot find what they need (31 files, no index beyond a handoff that says "read this first" and then describes defects), cannot use it (there is no "to add a preset, do X" anywhere), and cannot evaluate it (numbers and claims about reference repositories that `HANDOFF.md` admits were wrong "in every document that cited them").
- Every paragraph argues from a reference-repository defect. That is evidence for a decision log, not a specification. A new contributor does not need to know that `yap-swift-app` has 102 mise tasks.
- Leftover damage from generation: doubled words in titles, "The     hteen", "editing      00 lines", "is an setting", duplicated JSON keys, a table row inserted in the middle of a paragraph (`10-rules.md`, "Rules are blocks").

## 9. What to do

### 9.1 Nuke

- `architecture/` as a whole. Replace with one `DESIGN.md` of at most ten pages: what gspot is, the config file, the preset format, how a check runs, how rules install, what is out of scope. Keep `19-decisions.md` trimmed to the decisions that survive (D-03 track generated config, D-24 no tool-side ignore files, D-30 do not report what nobody can fix, D-43 policy is edited by hand, the exception-needs-a-reason rule).
- `src/coverage/listing.ts`, `ignore-replay.ts`, `gitignore.ts`, `candidate.ts`, `measure.ts`, `status.ts`, `table.ts` (A1, A2).
- `src/toolchain/*` (A6).
- `src/runner/mise.ts` (A5); hooks stay, rewritten to call through the runner.
- `src/settings/check.ts`, `preset.ts`, `document.ts`, `declaration.ts`, `toml.ts`, `merge.ts`: replace with one zod schema per file and a 60-line merge.
- `src/commands/config.ts`, `explain.ts`, `report.ts`, `upgrade.ts`, `install.ts`, `completion.ts`, `mistake.ts`.
- `src/structure/engine.ts`, `grammar.ts`, `rules.ts` if the ast-grep CLI replaces napi (recommended; verify `sg scan --json` output first).
- 44 of the 60 YAML rule files (the `javascript.yml`/`tsx.yml` copies, plus `barrel-ceiling`, `reexports-in-index-only`, `private-before-public` whose semantics are wrong or trivially noisy).
- `dist/`, `bun.lock` if Node is chosen, or `engines.node` and the Node shebang if Bun is chosen.

### 9.2 Keep as parts

| Keep | Lines | Note |
| --- | --- | --- |
| `src/coverage/tracked.ts` | 87 | `git ls-files --stage -z` parsing, symlink and submodule handling. Add a non-git walk. |
| `src/coverage/attribute.ts` | 54 | `git check-attr` for generated/vendored/binary |
| `src/configuration/marked.ts` | 47 | marker blocks in `.gitignore`, `CLAUDE.md` |
| `src/configuration/render.ts` | 55 | template plus provenance header |
| `src/configuration/drift.ts` | 49 | hand-edit detection |
| `src/structure/walk.ts`, `reach.ts`, `counter.ts` | 235 | the three real analyses |
| `src/run/suppression.ts` + `config/suppressions.ts` | 53 | suppression census |
| `src/detect/extension.ts`, `interpreter.ts` | 65 | extension and shebang |
| `src/detect/manifest.ts` | 60 of 162 | the `package.json` and `pyproject.toml` readers only |
| `src/settings/selector.ts` | 57 | the bare-directory refusal message is good |
| The ast-grep rule files for `trivial-function`, `trivial-file`, `export-only-file`, `exported-alias-constants`, `duplicate-barrel-exports`, `header-comments-before-imports`, `doc-comment-required`, `disable-justification`, the three shell ceilings | 16 files | dedupe with `languageGlobs`, fix the shell trivial-function false positive |
| `tests/support/repository.ts`, `integration/coverage/gitignore-replay.test.ts` pattern | | plant-a-repo harness and "agree with the real tool" test shape |
| Ideas: exception requires a reason; loosening printed in every run; generated files tracked with a header; `report --failed` prints a reproduce line; `uninstall` inverts `init` | | |

### 9.3 Rebuild around this

**Product in one sentence.** gspot reads a small `gspot.toml`, renders configuration for existing linters into `.gspot/`, runs them over git-tracked files with an explicit file list, adds an ast-grep rule pack for LLM slop, and installs agent rule files. Coverage is a report in `doctor`.

**Runtime.** Choose one. Bun with `bun build --compile` gives a single binary, which solves the Python-only and Swift-only repository problem the docs defer to a later phase, and gives `Bun.spawn`, `Bun.file`, `Bun.which`. Confirm the ast-grep CLI route first so no native addon needs embedding. If Node, delete `Bun.*` from tests and `types: ["bun"]` from tsconfig.

**Config, whole thing:**

```toml
presets = ["typescript", "bash", "sql"]      # kinds are a folder, not a prefix

[limits]                                     # only keys a check reads
file_lines = 300
function_lines = 60

[naming]
banned_terms = ["helper", "wrapper"]         # appended to the shipped list
allowed_terms = ["data"]                     # with reason in a comment; printed at run

[tools.shellcheck]                           # raw passthrough into the template
disable = ["SC2312"]

[[ignore]]
check  = "structure/single-file-folder"
paths  = ["scripts/**"]
reason = "one launcher script"

[hooks]
manager = "lefthook"                         # lefthook | husky | git | none
```

**Preset manifest, whole thing:**

```toml
id = "bash"
extensions = [".sh", ".bash"]
interpreters = ["bash", "sh"]

[[tools]]
name = "shellcheck"
version = "0.11.0"
install = { mise = "shellcheck", brew = "shellcheck", npm = "shellcheck" }

[[configs]]
template = "shellcheckrc.tmpl"
target = "shellcheckrc"

[[checks]]
id = "sh/shellcheck"
run = ["shellcheck", "--rcfile", "{config:shellcheckrc}", "{files}"]
fix = false

[[checks]]
id = "sh/shfmt"
run = ["shfmt", "-i", "{format.indent_width}", "--diff", "{files}"]
fix = ["shfmt", "-i", "{format.indent_width}", "--write", "{files}"]

[rules]
files = ["BASH.md"]
```

Nine fields per check, not twenty-two. A check either takes `{files}` or it does not. Findings count is the exit code unless `count_regex` is given.

**Run loop.** `git ls-files` → filter by preset extensions and `[[ignore]]` → group per check → spawn with a concurrency limit → collect exit codes and output → print one line per check that ran, tool output verbatim under failures → write `.gspot/last.json` → exit 0 or 1. `--staged` uses `git diff --cached --name-only`. `--fix` runs fixers then checks. About 400 lines.

**Coverage.** `gspot doctor` prints extensions with no preset, files nothing reads, and tools missing from `PATH`. It exits 0. A `[coverage] strict = true` setting turns unread files into a failing check for teams that want it.

**Rules.** `presets/<name>/rules/*.md` ship in the package. `gspot rules` (also run by `init` and `sync`) copies the files for the selected presets into `.gspot/rules/`, writes an index, and appends a marker block to `CLAUDE.md` and `AGENTS.md` that says where they are. The corpus needs a human editorial pass before it ships; the code around it is 80 lines.

**Hooks.** Write a `lefthook.yml` or `.husky/` calling `bunx gspot check --staged`, or a plain hook that resolves the binary through the runner. Never `exec gspot`.

**Structure rules.** `sgconfig.yml` pointing at `presets/*/rules/`, run through `sg scan --json`, post-processed for ceilings by the kept counter. Directory rules and shell reachability stay in TypeScript.

**Tests.** One planted repository per preset with real tools pinned through mise in CI, asserting the exit code and the check lines. Snapshot the rendered configs. Keep the gitignore-agreement test only if a replay survives, which under this design it does not.

Estimated size: 1,500 to 2,000 lines of TypeScript, 4 preset folders, one design document. That is a v0 a person can run in a repository nobody here has seen and get a gate that passes on day one, which `HANDOFF.md` names as the definition of done and the current tree cannot reach.
