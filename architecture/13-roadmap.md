# Build Order

This document decides the build order, the v1 cut, and what "done" means for each phase. Phase acceptance requires verified check execution with no policy silently lost. This repository comes first, then the real yap-swift-app adoption branch under D-121, then other authorized reference repositories through
planted repositories of their shape (D-62). Phases 0, 1 and 6 are built. The order from here is the hardening phase, then 5, 2, 4, and 3
(D-82). The Swift application needs the security presets, SQL, Supabase, Docker, and nginx before
the Swift presets can close its acceptance run.

## Status

This table states what the code holds today: 48 presets and 26 plugin rules. The target is 49
presets and 19 rules, and [22-remaining.md](22-remaining.md) holds the way there.

Updated with every commit, so this table says what is built. Done means the code exists, has
tests, and runs in the gate of this repository. [18-gaps.md](18-gaps.md) lists what falls short of that. Last update: 2026-09-20.

| Area                                  | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0                               | Code done, tests partial ([18-gaps.md](18-gaps.md), G-2). Policy, presets, repository model, runner, emit, hooks, doctor, the commands, the bash, structure, naming, formatting and spelling presets, the build, the npm launcher, planted tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ESLint plugin, typescript, javascript | Done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Naming engine                         | Done: bash, TypeScript, JavaScript, SQL, Swift, and Python extractors, paths, the policy schema check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Structure engine                      | Done for directories, shell, Python (twelve `python/*` checks, D-98), and Swift (five `swift/*` checks), with a planted defect for every check. SQL has `sql/block-comments` and `sql/file-length`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Prose engine                          | Done: Vale by path and by stdin grammar, source bans, vocabulary, the 30 rules rendered with the docs ceilings. The prose, markdown and docs presets exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Integrity                             | Done: `generated-drift`, `docs-headings`, `stale-paths`, `fences`, `readme-present`, `readme-shape`, `tsconfig-options`, `env-example`, `config-purity`, `suppressions`, `allowlists-match`, `task-policy`, `large-files`, `manifest-policy`, `lockfile-fresh`, `install-policy`, `lockfile-hosts`, `dependency-ownership`, `typecheck-membership`, `required-rules` (D-99), and the web checks `route-segments`, `next-config`, `dependency-alignment`, `locales`, `css-usage`, `security-headers`.                                                                                                                                                                                                                                                                                           |
| Corpus (Phase 6)                      | Done: the corpus lives in `rules/`, the rules lint runs as the repository check `rules/lint`; the enforcement markers are gone (D-73).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Self-lint                             | Done: `gspot check` passes 135 checks with no `[[ignore]]` (D-27), with `secrets`, `security`, `dependencies`, `licenses`, and `duplication` selected. Kept green from here on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Phase 1                               | Done: every shipped check name is named in a planted test, and the acceptance harness runs a reference repository in a detached worktree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Hardening                             | Done: the first install, the names of D-92, one owner for each concept, batching and timeouts, the version source, profiles, `recommends`, rule files that stand alone, and the plugin that stands alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Adoption                              | Not started. The install in yap-swift-app showed that a developer would not keep gspot installed ([20-adoption.md](20-adoption.md)). No new preset starts before this phase is done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Phases 2 to 5, Phase 7                | Phase 2 done: `sql`, `postgres`, `supabase`, `docker`, `nginx`, `express`, `vitest`, `ansible`, `python`, `pytest`, `fastapi`. Phase 3 done: `css`, `html`, `static-site`, `cloudflare`, `nextjs`, `i18n`, `zod`, `trpc`, `tanstack-query`, `zustand`, `react-hook-form`, `drizzle`; the acceptance runs over yap-landing and slopshop end with no check in error. Phase 4 done: `swift`, `xcode`, `xctest`. Phase 5 done. 48 presets ship today, and `jest` makes 49. Phase 7 done: `react`, `react-native`, `nestjs`, `vue`, and `svelte`, all thinner than D-141 asks, each with a planted repository. The acceptance run on a public repository of each shape is owed. Owed across phases: the manual rewrite (G-10) and the deeper unit tests of apply, carry, plan, execute, and doctor. |

### CI repair

K-204 closed on September 20, 2026 at `faf350fa49cf87bcc5f8278954db06788bd00305`.
The checkout pin names a verified commit. The manifest-driven action-pin check uses
`pinact run --verify --check`; live verification rejects a nonexistent commit without
rewriting the workflow.

- [Linux job 106016149568](https://github.com/stefanionescu/gspot/actions/runs/35487384035/job/106016149568)
  passes 450 tests with four skipped in 993.75 seconds.
- [macOS job 106016149579](https://github.com/stefanionescu/gspot/actions/runs/35487384035/job/106016149579)
  passes 451 tests with three skipped in 887.57 seconds. The planted configuration cases
  require findings status, so a crash message containing a filename cannot satisfy them.
- Both jobs build the native executable and pass 136 self-checks.
  [The gspot workflow](https://github.com/stefanionescu/gspot/actions/runs/35487384007)
  also passes normal and manual checks for that revision.

This closes the initial Linux and macOS CI gate only. Windows acceptance remains open under K-263.
Function coverage is 40.66% and line coverage is 51.94%, below the final 80% floor.
Required release tests remain skipped, and the CodeQL configuration selects no languages.
The complete implementation gate and Yap handoff remain open.

The later [macOS job 106024677219](https://github.com/stefanionescu/gspot/actions/runs/35490574212/job/106024677219)
records an intermittent Taplo failure: the formatter returns no parsed finding, and its
visible stderr contains only informational lines. The cause remains unconfirmed.
Crash reports retain the exit code and the first 20 lines of each output stream.
A planted crash test checks that stdout diagnostics survive nonempty stderr. The strict
formatter finding assertion remains in place.

[macOS job 106027893754](https://github.com/stefanionescu/gspot/actions/runs/35491796100/job/106027893754)
confirms exit 1 with no formatting diagnostic in either stream. The formatter command
requests diff output, which [Taplo 0.10.0 flushes](https://github.com/tamasfe/taplo/blob/0.10.0/crates/taplo-cli/src/commands/format.rs)
before returning. The parser accepts a diff header or the existing formatting log entry.
Identical regex findings are emitted once when both streams describe the same defect.
A regression covers diff-only, log-only, and combined output against a real file.

The [Windows job 106025469643](https://github.com/stefanionescu/gspot/actions/runs/35490879911/job/106025469643)
exposes CRLF output rejected by the ShellCheck and XML regular expressions. The shared
parser normalizes those line endings before matching and converts native finding paths
and the repository root to the report path format. Regression cases cover both tools,
grouped diagnostics, and paths with spaces and Unicode.

The HTML validator is pinned at 11.6.1, the upstream release that fixes absolute Windows
configuration paths. [The upstream changelog](https://html-validate.org/changelog/index.html)
records that fix. The previous version joined the fixture directory to an already absolute
configuration path in the Windows HTML tests. Both HTML and static-site planted suites
pass locally with the upgraded tool: two tests and 46 assertions. Windows confirmation
remains part of K-263.

### Preset deletion

D-136 removes the Go, Rust, Ruby, and Django presets, leaving 48 manifests.
The focused verification passes 20 unit tests and four Python/FastAPI integration tests.
TypeScript checking and the native macOS `arm64` build pass. The generated entry excludes
all four preset directories and the Go grammar, including stale grammar files from an earlier build.
All 273 reference pages match their generated content, and `apply --check` reports no drift.

At `fbfb142f032d4712eacef69526038d5fe5485358`,
[Linux](https://github.com/stefanionescu/gspot/actions/runs/35489701634/job/106022412676)
passes 443 tests with four skipped, and
[macOS](https://github.com/stefanionescu/gspot/actions/runs/35489701634/job/106022412843)
passes 444 tests with three skipped. Both native builds and all 136 self-checks pass.
The gspot workflow also passes for that revision. Windows setup reaches the plugin build,
where K-306 supplies the next repair.

Cargo remains an external installer for retained tools such as Taplo and Typos.
Generic lockfile classification also remains. Neither provides a Rust preset.
The seven tool pins for the deleted presets and their Go runtime pin are removed.
SwiftLint installation is restricted to Linux and macOS. Windows acceptance remains K-263.

## Phase 0: the skeleton

| Deliverable                                                                      | Done when                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The binary builds for seven targets with embedded assets                         | `gspot --version` runs from a release asset on macOS, Linux, and Windows                                                                                                                  |
| Result cache                                                                     | a second `check --staged` with no changes runs no check; each tool still answers `--version` for the cache key                                                                            |
| `gspot.toml` schema, load, merge, error messages                                 | every message in [03-configuration.md](03-configuration.md) has a test                                                                                                                    |
| Tracked files, natures, scopes, staged files                                     | the four reference repositories list correctly                                                                                                                                            |
| Tool runner with file lists, concurrency, missing-tool handling                  | a planted repository with one missing tool fails with the hint                                                                                                                            |
| Reporter, the report, exit codes                                                 | output matches the shape in [02-cli.md](02-cli.md)                                                                                                                                        |
| the sixteen commands of [02-cli.md](02-cli.md)                                   | every command parses and works; `explain` renders `summary`, `why`, and `help` for every check in the bash preset; `completion` output from `tab` completes every command in bash and zsh |
| The npm launcher and one platform package per target                             | `bunx gspot --version` works from a local registry on the three platforms with no network and `--ignore-scripts`                                                                          |
| Version pin: `.gspot/version`, the runner pin, the mismatch refusal, `--version` | a binary of another version exits 2 on `check` with the two remedies                                                                                                                      |
| Hooks, staged mode, `.mise/conf.d/gspot-tools.toml` (D-127)                      | a planted repository commits through the hook                                                                                                                                             |
| One preset: bash (ShellCheck, shfmt, `bash -n`)                                  | `gspot init --yes && gspot check` passes on a repository with one script                                                                                                                  |
| Self-lint begins                                                                 | gspot's own shell scripts and hooks pass under gspot with no ignores                                                                                                                      |

## Phase 1: JavaScript and TypeScript

| Deliverable                                                                                                                | Done when                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@gspot/eslint-plugin` with the 26 rules and a rule-tester suite each (D-64)                                               | every suite passes; findings over a planted scope match the reference plugin's                                 |
| typescript, javascript, formatting, structure, naming, config-files, markdown, spelling, commits, docs presets             | each has a planted repository                                                                                  |
| Naming engine with the TypeScript, JavaScript, and shell extractors                                                        | parity with the reference extractors on the frozen sources                                                     |
| Structure engine: tree-sitter loading, ast-grep driver, directory analyses, shell analyses                                 | every shell check in the ledger fires on its planted defect                                                    |
| Baselines                                                                                                                  | deleted by D-165                                                                                               |
| Integrity: generated drift, stale paths, allowlists, suppressions, manifest policy, lockfile, docs links, tsconfig options | each has a fixture                                                                                             |
| `upgrade --check` and `upgrade`, including the install step and `--to`                                                     | the report renders between two planted preset versions; the pin moves both ways                                |
| Takeover: replace and carry exceptions (typos, gitleaks, osv, licenses, disabled rules as ignores)                         | a planted repository with the four files loses them and gains the entries                                      |
| Full self-lint                                                                                                             | gspot's TypeScript passes under gspot with no ignores; `docs/` and every check `summary` pass the prose engine |

Acceptance: the worktree harness on yap-landing shows every finding its JavaScript and shell
checks report under a gspot check, plus the additions; the repository itself is untouched.

## Hardening: before any new preset

Every row closes rows of [18-gaps.md](18-gaps.md). No preset of a later phase starts before this
table is done, because each new preset inherits the same defects and the same missing tests.

| Deliverable                                                                                               | Done when                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository hygiene (G-1, G-11, G-12)                                                                      | `git ls-files` lists no `node_modules` path; one vale pin                                                                                   |
| Release safety (B-6, B-7, D-84)                                                                           | a tag that differs from the version fails the workflow; `tests/release` and the compiled-binary test run in it                              |
| The schema files (G-3)                                                                                    | both files are tracked, a check fails on drift, the manual serves them                                                                      |
| One owner for each concept (K-1 to K-4, K-8, K-14, D-91)                                                  | one install step, one copy of each helper and default; no row names a preset that does not ship                                             |
| Scale (B-8, K-5 to K-7, D-89)                                                                             | a planted scope of 5,000 files checks; a tool that hangs ends as an `error` result                                                          |
| The binary carries nothing of this repository (K-18, D-86)                                                | `gspot check` in a planted repository runs no rules lint                                                                                    |
| Selection: `recommends`, `--no-checks`, the selection question, the plan names presets (G-5 to G-7, D-80) | `init --without naming` installs no naming check; `init --presets none` writes rule files only                                              |
| Profiles (G-8, D-79)                                                                                      | `profile save` in one planted repository and `init --from` in another give the same `gspot.toml` tables; a bad key exits 2 before any write |
| Rule files stand alone (G-4, K-19, K-20, D-81)                                                            | the corpus lint finds no `gspot` and no tool name; `[rules] exclude` leaves a file out                                                      |
| `doctor` (G-9, K-9, D-87)                                                                                 | no installed library reads `missing`; a version off the pin fails                                                                           |
| The plugin stands alone (K-27, D-88)                                                                      | a planted repository with the plugin and one line of configuration reports a finding                                                        |
| `[[check]]` takes `output` (K-21, D-90)                                                                   | a planted `[[check]]` with a `regex` format reports file and line                                                                           |
| Tests (G-2, K-23, K-28, K-29)                                                                             | every shipped check name is named in a test that plants its defect; coverage prints in CI                                                   |
| Documentation (G-10, K-30)                                                                                | the root README follows its template; every command page has a worked example; guides for customization and profiles exist                  |

Acceptance: the worktree harness runs `init --yes` and `check` on yap-landing and on the
TypeScript, shell and Markdown files of yap-swift-app, and both repositories stay untouched.

## Adoption: before any new preset

Every row closes a section of [20-adoption.md](20-adoption.md) and rows of
[18-gaps.md](18-gaps.md). The order is the order in which a developer meets the defects, with the
two defects that destroy files first.

### Delete first

D-134 decides that a thing is built properly or deleted, with no step between. Everything below
is deleted in one early pass, before a fix builds on it. Each deletion takes the code, the flag or
key, its test, and every mention in this folder and in the manual.

| Delete                                                                                                                                                                                                                 | Where it lives                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `init --own`, which no code reads (K-97)                                                                                                                                                                               | `commands/init.ts`, `types/lifecycle.ts`                                                  |
| `--project-templates` on `init` and `apply`, and the project templates of the specification                                                                                                                            | `commands/`, `types/emit.ts`, `09-rules.md`, `02-cli.md`                                  |
| `[editor] vscode`, accepted and never built (K-99)                                                                                                                                                                     | `policy/schema.ts`, `normalize.ts`, `03-configuration.md`                                 |
| `architecture.package_roots`, `route_directories`, `shared_directories`, `feature_contracts`, `imports_allowed` (K-99)                                                                                                 | `policy/schema.ts`, `normalize.ts`                                                        |
| `limits.line_length`, `limits.trivial_ast_nodes`, `tools.trufflehog.verified_only` (K-100)                                                                                                                             | three manifests                                                                           |
| `gspot why`, `gspot declare`, `gspot profile check`, and six of the seven lists of `gspot allow`                                                                                                                       | `commands/`, `policy/`, `output/why.ts`                                                   |
| `doctor --offline`, `uninstall --keep-hooks`, `--dry-run` on the six edit commands, `apply --check`                                                                                                                    | `commands/`                                                                               |
| `no-trivial-functions` and its `maxStatements` option; `no-call-through` stays (K-102)                                                                                                                                 | `packages/eslint-plugin/src/rules/`                                                       |
| the plugin rules `no-single-file-folders` and `no-prefix-collisions`, which the structure engine owns (K-187)                                                                                                          | `packages/eslint-plugin/src/rules/`, the ESLint template                                  |
| five plugin rules a pinned tool already covers: `import-direction`, `no-harness-barrel-imports`, `no-reexports-outside-index`, `no-duplicate-barrel-exports`, and the `interface` message of `types-placement` (K-188) | `packages/eslint-plugin/src/rules/`, the ESLint template                                  |
| the manifest keys `executable` and `ubi`, and the pin of `pyproject-fmt` (K-180, K-195)                                                                                                                                | `presets/manifest-schema.ts`, three files of `emit/` and `platform/`, the python manifest |
| the Vale half of the rules lint and the second `vale.ini` (S-10)                                                                                                                                                       | `packages/cli/rules-lint/`, `prose/vale.ini`                                              |
| the sentence about subagents in the managed block (K-92)                                                                                                                                                               | `rules/managed-block.ts`                                                                  |
| the nine `copy = true` stubs (K-47)                                                                                                                                                                                    | seven manifests, `emit/targets.ts`                                                        |

The first seven fixes are small, and each gets a planted test:

1. Takeover keeps `setup.cfg` and `tox.ini` (K-36).
2. A folder named `hooks` is no hooks folder (K-37).
3. A run of the `message` stage writes no record (K-45, D-105).
4. `packages/cli/rules-lint` moves into `src/rules/` (K-61).
5. The nine `copy = true` stubs leave their manifests (K-47, D-100).
6. gspot never replaces a `package.json` script the developer has (K-109).
7. No check deletes or rewrites a file of the developer: `drizzle/migrations-fresh` runs in a copy, and `express/openapi-fresh` puts back the text it read (K-156, K-159).

| Order | Deliverable                                                                                                                                                                                                | Done when                                                                                                                                                                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Takeover deletes nothing it does not own (K-36, K-37, K-41, D-109)                                                                                                                                         | a planted repository with `setup.cfg`, `tox.ini` and a `hooks/` folder of source files keeps all three; the plan lists `.mise/tasks/` files that call an owned tool                                                                                                                                           |
| 2     | gspot goes where the hook points, explicit `gspot install` installs the hooks, and existing command names keep working (A-3, A-16 to A-18, K-56 to K-58, D-101, D-114 to D-116)                            | init on yap-landing proposes one changed line in `.mise/tasks/hook/pre-commit`, leaves `core.hooksPath` at `.githooks`, and `bun run lint` runs `gspot check`; a fresh clone that ran `gspot install` commits through gspot                                                                                   |
| 2b    | Tables in shared manifests, and the way out of a failing hook (A-19, A-20, K-59, K-60, D-117)                                                                                                              | init on yap-text-inference carries the `[tool.ruff]` ignores, edits no line of `pyproject.toml`, and lists the table under "remove by hand"; a failing hook ends with the two commands                                                                                                                        |
| 3     | Slow checks in the manual stage, the push stage by affected scope, init without checks (A-4, K-43, K-53, D-102)                                                                                            | init on the app ends in under five minutes; a push that touches `api/` starts no Swift check; a scoped setting change invalidates only affected check caches                                                                                                                                                  |
| 4     | The format commit and the end of the local skip (A-5, D-173)                                                                                                                                               | a planted repository with one unformatted file commits after init on a second clone with no local file; a skip of a check whose tool is present exits 2                                                                                                                                                       |
| 5     | Root pointers and marks (A-1, A-2, K-47, D-100)                                                                                                                                                            | init on the app writes no copy at the root; every file gspot wrote is named by `gspot doctor`                                                                                                                                                                                                                 |
| 6     | The baseline is deleted, and `init` runs no check (A-6, K-290, D-165)                                                                                                                                      | `init` on the app ends when the tools are installed; `.gspot/` holds no count file; `gspot check` reports what it finds today                                                                                                                                                                                 |
| 7     | The message run writes no record; the build folder leaves the repository (A-7, K-44, K-45, D-105)                                                                                                          | a message-stage run writes no check report or baseline; `.gspot/cache/` in the app holds under 50 MB                                                                                                                                                                                                          |
| 8     | The policy text (A-8, A-9, K-51, D-106)                                                                                                                                                                    | the app policy holds no line over 120 characters, and one gitleaks entry for each reason; one file in the repository is named `gspot.toml`                                                                                                                                                                    |
| 9     | Scopes from project files, one place for scope files (A-11, K-48, D-108)                                                                                                                                   | `init --yes` on the app proposes `api`, `supabase` and `ios` with no `--scope` flag                                                                                                                                                                                                                           |
| 11    | Strict rules off by default (A-13, K-52, D-110)                                                                                                                                                            | init on the app with `strict = false` holds no `explicit_acl` finding                                                                                                                                                                                                                                         |
| 12    | The prefix rule, the framework naming layer, and one rule set for every framework (A-14, A-15, K-49, K-50, K-207 to K-213, D-111, D-112, D-137 to D-142)                                                   | planted snake_case and PascalCase siblings are findings; `UserCard.tsx` passes under `react`; the shared policy names no framework; the config of a `.vue`, a `.svelte` and a `.tsx` file differs from that of a `.ts` file by the listed rules alone, in a planted repository for each of the six frameworks |
| 13    | The core names no preset and no tool (K-38, K-39, K-40)                                                                                                                                                    | `grep` for a preset name or a tool name in `packages/cli/src` outside a preset folder finds nothing                                                                                                                                                                                                           |
| 14    | Tests (T-1 to T-13, D-113)                                                                                                                                                                                 | a planted install with defaults, the mise runner and two scopes passes; `tests/config/` holds the shared values; the read of the folders listed as not read in 18-gaps.md is done                                                                                                                             |
| 15    | After the complete implementation gate, replace the old local app branch and install the packaged candidate through the local registry (D-121, D-158)                                                      | the table that opens 20-adoption.md is measured again beside the first numbers; the branch holds no `gspot.local.toml`, and its report comes from a run with no local skip                                                                                                                                    |
| 16    | Seeing the menu, levels, and the three init questions (A-21 to A-23, K-62 to K-64, D-118 to D-120)                                                                                                         | `gspot list` prints every check of the app with its state; `init` on the app at the `recommended` level holds under 2,000 findings                                                                                                                                                                            |
| 17    | The agent block as a plain list (A-25, K-65)                                                                                                                                                               | `CLAUDE.md` in the app holds under 3 KB                                                                                                                                                                                                                                                                       |
| 18    | Plain words where a person reads them, and the renames of 19-names.md (K-66, K-67, K-54, K-61)                                                                                                             | a fresh `gspot.toml` holds no `surface` and no `inspection`; `grep -ri surface` over help text, output and guides finds nothing; an old key is an unknown key, with no alias and no message of its own                                                                                                        |
| 19    | The cache key of a declared check, and a push that checks what is pushed (K-69, K-70)                                                                                                                      | a `[[check]]` names the inputs it reads, or is never cached; a push of clean commits passes with unrelated uncommitted work in the tree                                                                                                                                                                       |
| 20    | The top level of this repository (K-68, K-73)                                                                                                                                                              | one schema file at the root, `prose/` inside its preset, `examples/` installed by a planted test, the community files present                                                                                                                                                                                 |
| 21    | What runs where, `--changed`, and the progress lines (K-81, D-122 to D-125)                                                                                                                                | a push in the app that touches `api/` ends in under a minute; a full run prints a line as each check ends and a summary with times                                                                                                                                                                            |
| 22    | The `recommended` level holds no house style and changes no build (K-74, K-75, K-91, K-92, D-126)                                                                                                          | init on a fresh Next.js project at `recommended` leaves `tsconfig.json` untouched and holds no finding about pinned versions, headers, or README shape                                                                                                                                                        |
| 23    | This repository names its folders after languages, by its own exception, and keeps one copy of the structure logic (K-86, K-87, D-128, D-135)                                                              | `src/swift/` and `src/python/` exist here, `gspot.toml` holds one `folder_name_allowed` entry for them, and `gspot check` passes with no `[[ignore]]`                                                                                                                                                         |
| 23b   | The command surface and GitLab (K-95, K-96, D-129 to D-133)                                                                                                                                                | `gspot --help` lists the commands of 02-cli.md; every flag in `--help` appears in a test and in a guide; init in a repository with `.gitlab-ci.yml` writes `.gitlab/ci/gspot.yml` and edits no other CI file                                                                                                  |
| 24    | gspot checks itself again after the renames, with no ignore entry, and closes the places where it does not check itself (S-1 to S-18, K-166), and installs for itself the tools of the table in 18-gaps.md | `gspot check` passes here and `gspot.toml` holds no `[[ignore]]`; a check writes every template of every preset and parses the result; a hook runs the tests and holds a coverage floor; a broken path in `architecture/` is a finding                                                                        |

The table holds no row 10. It was the trial form of D-107, which the owner cut. A-12 of
[20-adoption.md](20-adoption.md) has no row either: it closes with the first release of the
binary and the plugin.

### Where each step is written out

Each step has one file under [fixes/](fixes/README.md), with a section for each row it closes.
A section holds what is wrong, the target, the files, the logic, what goes, the tests, and when
it is done. [16-file-tree.md](16-file-tree.md) holds the tree the steps lead to, and
[22-remaining.md](22-remaining.md) is the index of every row by fix file.

### Where every other row lands

Every row of [18-gaps.md](18-gaps.md) belongs to one row of work. The table above names the rows
it closes. This table places the rest, so no finding is only a finding. A row of work is done
when every gap it names has left 18-gaps.md.

| Work                                                        | Gaps it closes                                                                                                                                                                              | Goes with row                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Delete what nothing uses                                    | K-104, K-111, K-115, K-119, K-129, K-146, K-180, K-195, K-205, K-240, K-259, K-282, K-290                                                                                                   | Delete first                                         |
| Defects that give a wrong answer, fixed first               | K-108, K-114, K-134, K-140, K-147, K-157, K-172, K-178, K-181, K-186, K-189, K-192, K-206, K-226, K-229, K-234, K-238, K-241, K-246, K-250, K-251, K-252, K-253, K-254, K-257, K-258, K-261 | first fixes                                          |
| Takeover and detection read what a repository really holds  | K-42, K-57, K-76, K-78, K-120, K-126, K-128, K-158, K-182, K-193, K-214, K-237, K-247                                                                                                       | 1 and 2                                              |
| Speed                                                       | K-71, K-125, K-127, K-138, K-143, K-148, K-162, K-176, K-196                                                                                                                                | 3 and 21                                             |
| What `check` and `doctor` print                             | K-82, K-83, K-84, K-117, K-122, K-130, K-132, K-185, K-243                                                                                                                                  | 21                                                   |
| The `recommended` level holds defects, and `all` adds taste | K-63, K-93, K-101, K-112, K-123, K-135, K-141, K-142, K-151, K-152, K-161, K-167, K-174, K-175, K-198, K-200, K-201, K-218, K-219, K-221, K-227, K-230                                      | 11 and 22                                            |
| Framework naming                                            | K-133, K-136, K-137                                                                                                                                                                         | 12                                                   |
| Lint tools are tools, and every linter that exists is held  | K-217, K-233, K-236, K-239, K-248, K-249, K-256, K-264, K-265, K-266, K-267, K-268, K-269, K-270, K-283                                                                                     | 12                                                   |
| The same rule in every language                             | K-235                                                                                                                                                                                       | 23                                                   |
| The core names no preset and no tool                        | K-13, K-17, K-24, K-79, K-80, K-85, K-107, K-113, K-139, K-179, K-197, K-203, K-220, K-223, K-231, K-232, K-14, K-242, K-255, K-260, K-262                                                  | 13                                                   |
| One owner for each idea                                     | G-13, K-55, K-77, K-94, K-98, K-105, K-106, K-110, K-124, K-131, K-165, K-169, K-171, K-177, K-183, K-187, K-188, K-190, K-199                                                              | 13                                                   |
| The config and its words                                    | K-88, K-89, K-116, K-215, K-222, K-224, K-225, K-228                                                                                                                                        | 8 and 18                                             |
| Checks that assume one layout                               | K-90, K-144, K-149, K-150, K-153, K-154, K-155, K-160, K-163, K-184, K-191                                                                                                                  | 15                                                   |
| What a repository gets from init                            | K-72, K-118                                                                                                                                                                                 | 5                                                    |
| Release                                                     | K-121, K-145, K-164, K-244, K-245, K-263, K-280, K-281                                                                                                                                      | before launch                                        |
| The README, the manual, and the site                        | G-10, K-202, S-19                                                                                                                                                                           | implementation before handoff; app evidence after 15 |
| Every place a developer comes from                          | K-271, K-272, K-273, K-274, K-275, K-276, K-277, K-278, K-279, K-284, K-285, K-287, K-288, K-289, K-291, K-292, K-293, K-294, K-295, K-296, K-297                                           | 23b                                                  |
| Tests                                                       | T-2 to T-12, T-14 to T-18, T-19 to T-23, T-24 to T-26, T-27 to T-36, G-2, K-28                                                                                                              | 14                                                   |

The order is fixed by D-121 and the gate in [22-remaining.md](22-remaining.md). Complete gspot
implementation, all tests, self-lint, documentation implementation, and local package validation
before deleting the old app branch. Require green CI for the same candidate revision.

Then replace the old local branch with `chore/gspot-adoption`, install from the local registry,
and measure the real app. No app push or other real-repository install is authorized. Finish
app-derived examples after that run; website implementation does not wait for those measurements.
Public release and deployment remain later gates. Any gspot defect found in adoption requires a
fix and renewed verification, not merely an open gap row.

## Phase 2: Python, SQL, containers

| Deliverable                                                                                 | Done when                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| python, pytest, fastapi presets with every tool, and the 14 structure analyses              | the ledger's Python section is green on a planted repository |
| Python naming extractor                                                                     | parity on the frozen source                                  |
| sql, postgres, supabase presets: sqlfluff, squawk, migration docs, edge lint, Semgrep rules | planted Supabase repository passes                           |
| docker, nginx presets                                                                       | compose config and nginx `-t` run through the daemon         |
| express preset                                                                              | boundaries and HTTP rules                                    |
| dependency ownership, typecheck membership, security-headers integrity checks               | fixtures                                                     |

Acceptance: the worktree harness on yap-text-inference, and on the two ComfyUI custom-node
repositories for the Python half of the fifth shape. That shape has a root `__init__.py`, a `requirements.txt` exported from `pyproject.toml` and declared with `produced_by`, and dependency ranges because the node is a library.

## Phase 3: the web

| Deliverable                                                                                                     | Done when                                                                  |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| css, html, static-site, cloudflare presets                                                                      | HTML copy, script policy, dead CSS, links, headers fire on planted defects |
| nextjs preset with boundaries, server-only, client environment, route segments, next config, CSS usage, locales | planted Next.js repository passes                                          |
| zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n, vitest presets                              | each installs its rule file and its ESLint rules                           |
| GitHub Actions emitter                                                                                          | the workflow runs green on a planted repository                            |

Acceptance: the worktree harness on slopshop, on the yap-landing site checks, and on the `web/` half of the ComfyUI repositories. That half is browser JavaScript with no bundler, CSS and HTML beside Python, and the runtime chosen per file class.

## Phase 4: Swift

| Deliverable                                                                                                            | Done when                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| swift, xcode and xctest presets: SwiftLint two configs, SwiftFormat, Periphery, analyze after build, iOS Semgrep rules | the ledger's Swift section is green; the rendered `.gspot/swiftlint.yml` and `.gspot/swiftformat` hold the rule sets listed in [presets/swift.md](presets/swift.md) |
| Swift naming extractor and trivial-function analysis                                                                   | parity on the frozen source                                                                                                                                         |
| macOS job in the workflow                                                                                              | runs green                                                                                                                                                          |

Phase 4 starts after Phases 5 and 2, which ship the security, SQL, Supabase, Docker, and nginx
presets this acceptance run needs.

Acceptance: the worktree harness on yap-swift-app across its three scopes, with the numbers in
[17-migration.md](17-migration.md) as the pass condition. Every check in `quality/` maps to a gspot check, the 29 configuration files are replaced or carried, and the 35 lint tasks and the 15 duplicate pins are listed. The acceptance run reads the repository and never writes it. The migration the owner asked for
(D-97) is a separate deliverable, on a branch of its own.

## Phase 5: prose, security, upgrade

| Deliverable                                                                                        | Done when                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| prose preset: Vale driver, `gspot` style, packages, vocabulary, stdin grammars, adjacent selectors | the 30 rules fire on planted defects      |
| secrets, security, dependencies, licenses, duplication presets wired (Semgrep runs)                | each at its stage on a planted repository |

## Phase 6: the corpus

| Deliverable                                         | Done when                                                 |
| --------------------------------------------------- | --------------------------------------------------------- |
| Repair pass over `rules/`                           | Vale clean, corruption rule clean, no cross-file links    |
| Front matter on every file, no tool named in a rule | `rules/lint` passes                                       |
| Assembler and managed index block                   | the four reference repositories get their files and index |
| Corpus lint in gspot's gate                         | runs on every change                                      |

Acceptance: each reference repository's `rules/` and its `CLAUDE.md` are replaced by the
assembled set, with no rule statement lost. A diff of normalized statements is empty except for duplicates and the repaired words.

## Phase 7: the next repository shapes

Post-v1, one preset per phase-7 item, each with a planted repository and the acceptance harness on a public repository of that shape. The order is how often `init` reports the manifest with no preset:

| Preset       | Detects                           | Tools                                                                                                              |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| react        | `vite.config.*` with `react`      | the typescript preset plus `framework/react/REACT.md` and the React ESLint rules the nextjs preset already carries |
| react-native | Expo `app.json`, `react-native`   | react plus the Expo lint config                                                                                    |
| nestjs       | `nest-cli.json`                   | the typescript preset plus module boundary rules                                                                   |
| vue, svelte  | `vue.config.*`, `svelte.config.*` | the framework ESLint plugins                                                                                       |

`init` on one of these today installs the language presets it can (typescript for a Vite React
repository) and reports the rest as unchecked.

## The v1 cut

Phases 0 through 6 and the hardening phase, whole (D-61, D-82). v1 ships when every preset, the prose engine, the corpus
assembler, CodeQL at its `manual` stage and the upgrade path pass on the planted repositories and
the six acceptance shapes. That is a gspot that installs in a Python API, a Swift app, an
Express and Supabase monorepo, a static site, a Next.js app and a ComfyUI custom node. It replaces six quality folders, installs the agent rule files, upgrades itself, explains every finding, and
installs on day one and runs no check (D-165). Only the Homebrew tap and Phase 7 follow
v1.

The reference repositories are never modified by an acceptance run. Every acceptance run happens
in a detached `git worktree` that is removed afterwards. Migrating a repository is a separate,
deliberate change its owner asks for.

The owner asked for one: yap-swift-app (D-97). That migration is a deliverable of this build. It
removes the old lint setup, installs gspot, lints the whole repository, and reports what it
found, and it fixes nothing in the application code.
[17-migration.md](17-migration.md) lists what it delivers.

## Risks

| Risk                                                                                                   | Mitigation                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `bun build --compile` with embedded WASM grammars is unproven at this size                             | Phase 0 proves it before anything else is written                                                            |
| Windows: hooks under Git for Windows' sh, path separators in tool output, tools without Windows builds | Phase 0 runs the planted-repository suite on `windows-latest`; each later phase adds its tools to the matrix |
| Swift tree-sitter grammar quality                                                                      | Phase 4 is last; parse errors are findings, so a weak grammar is loud                                        |
| Xcode file listing and analyzer builds are slow                                                        | `push` stage only; the macOS CI job caches DerivedData                                                       |
| The corpus repair is editorial work                                                                    | Phase 6 is independent of the gate; the gate ships without it                                                |
| Two engines for JavaScript structure (ESLint plugin) and other languages (tree-sitter) drift           | one ledger row per rule names both; a planted defect per rule per language                                   |

The review fixes [24-contracts.md](fixes/24-contracts.md) are dependencies of this order: path
boundaries and recovery precede destructive lifecycle work; contract and default-level tests
precede adoption. Site deployment follows a published release and the manual, with domain access
as an explicit external prerequisite (K-302).
