# Build Order

This document decides the build order, the v1 cut, and what "done" means for each phase. Each phase ends with a repository passing under gspot with no rule lost. This repository comes first, then yap-swift-app in a detached worktree, then the other reference repositories through
planted repositories of their shape (D-62). Phases 0, 1 and 6 are built. The order from here is the hardening phase, then 5, 2, 4, and 3
(D-82). The Swift application needs the security presets, SQL, Supabase, Docker, and nginx before
the Swift presets can close its acceptance run.

## Status

Updated with every commit, so this table says what is built. Done means the code exists, has
tests, and runs in the gate of this repository. [18-gaps.md](18-gaps.md) lists what falls short of that. Last update: 2026-09-19.

| Area                                  | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0                               | Code done, tests partial ([18-gaps.md](18-gaps.md), G-2). Policy, presets, repository model, runner, emit, hooks, doctor, the commands, the bash, structure, naming, formatting and spelling presets, the build, the npm launcher, planted tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ESLint plugin, typescript, javascript | Done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Naming engine                         | Done: bash, TypeScript, JavaScript, SQL, Swift, and Python extractors, paths, the policy schema check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Structure engine                      | Done for directories, shell, Python (twelve `python/*` checks, D-98), and Swift (five `swift/*` checks), with a planted defect for every check. SQL has `sql/block-comments` and `sql/file-length`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Prose engine                          | Done: Vale by path and by stdin grammar, source bans, vocabulary, the 30 rules rendered with the docs ceilings. The prose, markdown and docs presets exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Integrity                             | Done: `generated-drift`, `docs-headings`, `stale-paths`, `fences`, `readme-present`, `readme-shape`, `tsconfig-options`, `env-example`, `baselines-current`, `config-purity`, `suppressions`, `allowlists-match`, `task-policy`, `large-files`, `manifest-policy`, `lockfile-fresh`, `install-policy`, `lockfile-hosts`, `dependency-ownership`, `typecheck-membership`, `required-rules` (D-99), and the web checks `route-segments`, `next-config`, `dependency-alignment`, `locales`, `css-usage`, `security-headers`.                                                                                                                                                                                                                                              |
| Corpus (Phase 6)                      | Done: the corpus lives in `rules/`, the corpus lint runs in `apply --check`; the enforcement markers are gone (D-73).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Self-lint                             | Done: `gspot check` passes 135 checks with no `[[ignore]]` (D-27), with `secrets`, `security`, `dependencies`, `licenses`, and `duplication` selected. Kept green from here on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Phase 1                               | Done: every shipped check id is named in a planted test, and the acceptance harness runs a reference repository in a detached worktree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Hardening                             | Done: the first install, the names of D-92, one owner for each concept, batching and timeouts, the version source, profiles, `recommends`, rule files that stand alone, and the plugin that stands alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Adoption                              | Not started. The install in yap-swift-app showed that a developer would not keep gspot installed ([20-adoption.md](20-adoption.md)). No new preset starts before this phase is done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Phases 2 to 5, Phase 7                | Phase 2 done: `sql`, `postgres`, `supabase`, `docker`, `nginx`, `express`, `vitest`, `ansible`, `python`, `pytest`, `fastapi`. Phase 3 done: `css`, `html`, `static-site`, `cloudflare`, `nextjs`, `i18n`, `zod`, `trpc`, `tanstack-query`, `zustand`, `react-hook-form`, `drizzle`; the acceptance runs over yap-landing and slopshop end with no check in error. Phase 4 done: `swift`, `xcode`, `xctest`. Phase 5 done. 52 presets ship. Phase 7 done: `go`, `rust`, `react`, `react-native`, `django`, `nestjs`, `ruby`, `vue`, and `svelte`, each with a planted repository. The acceptance run on a public repository of each shape is owed. Owed across phases: the manual rewrite (G-10) and the deeper unit tests of apply, carry, plan, execute, and doctor. |

## Phase 0: the skeleton

| Deliverable                                                                                                   | Done when                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The binary builds for five targets with embedded assets                                                       | `gspot --version` runs from a release asset on macOS, Linux, and Windows                                                                                                                                            |
| Result cache                                                                                                  | a second `check --staged` with no changes runs no check; each tool still answers `--version` for the cache key                                                                                                      |
| `gspot.toml` schema, load, merge, error messages                                                              | every message in [03-configuration.md](03-configuration.md) has a test                                                                                                                                              |
| Tracked files, natures, scopes, staged files                                                                  | the four reference repositories list correctly                                                                                                                                                                      |
| Tool runner with file lists, concurrency, missing-tool handling                                               | a planted repository with one missing tool fails with the hint                                                                                                                                                      |
| Reporter, run record, exit codes                                                                              | output matches the shape in [02-cli.md](02-cli.md)                                                                                                                                                                  |
| `init`, `check`, `apply`, `doctor`, `uninstall`, `why`, `explain`, `completion`, and the six writing commands | the fifteen-command surface parses and every command works; `explain` renders `summary`, `why` and `fix` for every check in the bash preset; `completion` output from `tab` completes every command in bash and zsh |
| The npm launcher and one platform package per target                                                          | `bunx gspot --version` works from a local registry on the three platforms with no network and `--ignore-scripts`                                                                                                    |
| Version pin: `.gspot/version`, the runner pin, the mismatch refusal, `--version`                              | a binary of another version exits 2 on `check` with the two remedies                                                                                                                                                |
| Hooks, staged mode, `.config/mise/conf.d/gspot.toml`                                                          | a planted repository commits through the hook                                                                                                                                                                       |
| One preset: bash (ShellCheck, shfmt, `bash -n`)                                                               | `gspot init --yes && gspot check` passes on a repository with one script                                                                                                                                            |
| Self-lint begins                                                                                              | gspot's own shell scripts and hooks pass under gspot with no ignores                                                                                                                                                |

## Phase 1: JavaScript and TypeScript

| Deliverable                                                                                                                | Done when                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@gspot/eslint-plugin` with the 26 rules and a rule-tester suite each (D-64)                                               | every suite passes; findings over a planted scope match the reference plugin's                                                                     |
| typescript, javascript, formatting, structure, naming, config-files, markdown, spelling, commits, docs presets             | each has a planted repository                                                                                                                      |
| Naming engine with the TypeScript, JavaScript, and shell extractors                                                        | parity with the reference extractors on the frozen sources                                                                                         |
| Structure engine: tree-sitter loading, ast-grep driver, directory analyses, shell analyses                                 | every shell check in the ledger fires on its planted defect                                                                                        |
| Baselines                                                                                                                  | `init` on a repository with findings passes; a grown count fails; the ESLint baseline is the tool's own suppressions file and the editor honors it |
| Integrity: generated drift, stale paths, allowlists, suppressions, manifest policy, lockfile, docs links, tsconfig options | each has a fixture                                                                                                                                 |
| `upgrade --check` and `upgrade`, including the install step and `--to`                                                     | the report renders between two planted preset versions; the pin moves both ways                                                                    |
| Takeover: replace and carry exceptions (typos, gitleaks, osv, licenses, disabled rules as ignores)                         | a planted repository with the four files loses them and gains the entries                                                                          |
| Full self-lint                                                                                                             | gspot's TypeScript passes under gspot with no ignores; `docs/` and every check `summary` pass the prose engine                                     |

Acceptance: the worktree harness on yap-landing shows every finding its JavaScript and shell
checks report under a gspot check, plus the additions; the repository itself is untouched.

## Hardening: before any new preset

Every row closes rows of [18-gaps.md](18-gaps.md). No preset of a later phase starts before this
table is done, because each new preset inherits the same defects and the same missing tests.

| Deliverable                                                                                                  | Done when                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository hygiene (G-1, G-11, G-12)                                                                         | `git ls-files` lists no `node_modules` path; one vale pin                                                                                   |
| Release safety (B-6, B-7, D-84)                                                                              | a tag that differs from the version fails the workflow; `tests/release` and the compiled-binary test run in it                              |
| The schema files (G-3)                                                                                       | both files are tracked, a check fails on drift, the manual serves them                                                                      |
| One owner for each concept (K-1 to K-4, K-8, K-14, D-91)                                                     | one install step, one first-baseline step, one copy of each helper and default; no row names a preset that does not ship                    |
| Scale (B-8, K-5 to K-7, D-89)                                                                                | a planted scope of 5,000 files checks; a tool that hangs ends as an `error` result                                                          |
| The binary carries nothing of this repository (K-18, D-86)                                                   | `apply --check` in a planted repository runs no corpus lint                                                                                 |
| Selection: `recommends`, `--presets none`, the selection question, the plan names presets (G-5 to G-7, D-80) | `init --without naming` installs no naming check; `init --presets none` writes rule files only                                              |
| Profiles (G-8, D-79)                                                                                         | `profile save` in one planted repository and `init --from` in another give the same `gspot.toml` tables; a bad key exits 2 before any write |
| Rule files stand alone (G-4, K-19, K-20, D-81)                                                               | the corpus lint finds no `gspot` and no tool name; `[rules] exclude` leaves a file out                                                      |
| `doctor` (G-9, K-9, D-87)                                                                                    | no installed library reads `missing`; a version off the pin fails                                                                           |
| The plugin stands alone (K-27, D-88)                                                                         | a planted repository with the plugin and one line of configuration reports a finding                                                        |
| `[[check]]` takes `output` (K-21, D-90)                                                                      | a planted `[[check]]` with a `regex` format reports file and line                                                                           |
| Tests (G-2, K-23, K-28, K-29)                                                                                | every shipped check id is named in a test that plants its defect; coverage prints in CI                                                     |
| Documentation (G-10, K-30)                                                                                   | the root README follows its template; every command page has a worked example; guides for customization and profiles exist                  |

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

| Delete                                                                                                                 | Where it lives                                            |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `init --own`, which no code reads (K-97)                                                                               | `commands/init.ts`, `types/lifecycle.ts`                  |
| `--project-templates` on `init` and `apply`, and the project templates of the specification                            | `commands/`, `types/emit.ts`, `09-rules.md`, `02-cli.md`  |
| `[editor] vscode`, accepted and never built (K-99)                                                                     | `policy/schema.ts`, `normalize.ts`, `03-configuration.md` |
| `architecture.package_roots`, `route_directories`, `shared_directories`, `feature_contracts`, `imports_allowed` (K-99) | `policy/schema.ts`, `normalize.ts`                        |
| `limits.line_length`, `limits.trivial_ast_nodes`, `tools.trufflehog.verified_only` (K-100)                             | three manifests                                           |
| `gspot why`, `gspot declare`, `gspot profile check`, and six of the seven lists of `gspot allow`                       | `commands/`, `policy/`, `output/why.ts`                   |
| `doctor --offline`, `uninstall --keep-hooks`, `--dry-run` on the six edit commands, `apply --check`                    | `commands/`                                               |
| one of `no-call-through` and `no-trivial-functions` (K-102)                                                            | `packages/eslint-plugin/src/rules/`                       |
| the sentence about subagents in the managed block (K-92)                                                               | `rules/managed-block.ts`                                  |
| the nine `copy = true` stubs (K-47)                                                                                    | seven manifests, `emit/targets.ts`                        |

The first seven fixes are small, and each gets a planted test:

1. Takeover keeps `setup.cfg` and `tox.ini` (K-36).
2. A folder named `hooks` is no hooks folder (K-37).
3. A run of the `message` stage writes no record (K-45, D-105).
4. `rules-lint` becomes `rules` (K-61).
5. The nine `copy = true` stubs leave their manifests (K-47, D-100).
6. gspot never replaces a `package.json` script the developer has (K-109).
7. No check deletes or rewrites a file of the developer: `drizzle/migrations-fresh` runs in a copy, and `express/openapi-fresh` puts back the text it read (K-156, K-159).

| Order | Deliverable                                                                                                                                                            | Done when                                                                                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Takeover deletes nothing it does not own (K-36, K-37, K-41, D-109)                                                                                                     | a planted repository with `setup.cfg`, `tox.ini` and a `hooks/` folder of source files keeps all three; the plan lists `.mise/tasks/` files that call an owned tool                                                             |
| 2     | gspot goes where the hook points, the setup entry installs the hooks, and existing command names keep working (A-3, A-16 to A-18, K-56 to K-58, D-101, D-114 to D-116) | init on yap-landing proposes one changed line in `.mise/tasks/hook/pre-commit`, leaves `core.hooksPath` at `.githooks`, and `bun run lint` runs `gspot check`; a fresh clone that ran only the setup task commits through gspot |
| 2b    | Tables in shared manifests, and the way out of a failing hook (A-19, A-20, K-59, K-60, D-117)                                                                          | init on yap-text-inference carries the `[tool.ruff]` ignores, edits no line of `pyproject.toml`, and lists the table under "remove by hand"; a failing hook ends with the two commands                                          |
| 3     | Slow checks in the manual stage, the push stage by changed scope, init over the commit stage (A-4, K-43, K-53, D-102)                                                  | init on the app ends in under five minutes; a push that touches `api/` starts no Swift check; a lowered baseline leaves the cached verdict of an unrelated check in place                                                       |
| 4     | The format commit and the end of the local skip (A-5, D-103)                                                                                                           | a planted repository with one unformatted file commits after init on a second clone with no local file; a skip of a check whose tool is present exits 2                                                                         |
| 5     | Root pointers and marks (A-1, A-2, K-47, D-100)                                                                                                                        | init on the app writes no copy at the root; every file gspot wrote is named by `gspot doctor`                                                                                                                                   |
| 6     | One baseline file and a rise that prints what rose (A-6, K-46, D-104)                                                                                                  | two planted branches that each add a finding under one rule merge with a line conflict or none; one new finding under a held rule prints one finding                                                                            |
| 7     | The message run writes no record; the build folder leaves the repository (A-7, K-44, K-45, D-105)                                                                      | a commit between `check` and `apply --lower-baselines` changes nothing; `.gspot/cache/` in the app holds under 50 MB                                                                                                            |
| 8     | The policy text (A-8, A-9, K-51, D-106)                                                                                                                                | the app policy holds no line over 120 characters, and one gitleaks entry for each reason; one file in the repository is named `gspot.toml`                                                                                      |
| 9     | Scopes from project files, one place for scope files (A-11, K-48, D-108)                                                                                               | `init --yes` on the app proposes `api`, `supabase` and `ios` with no `--scope` flag                                                                                                                                             |
| 11    | Strict rules off by default (A-13, K-52, D-110)                                                                                                                        | init on the app with `strict = false` holds no `explicit_acl` finding                                                                                                                                                           |
| 12    | The prefix rule and the framework naming layer (A-14, A-15, K-49, K-50, D-111, D-112)                                                                                  | planted snake_case and PascalCase siblings are findings; `UserCard.tsx` passes under `react`; the shared policy names no framework                                                                                              |
| 13    | The core names no preset and no tool (K-38, K-39, K-40)                                                                                                                | `grep` for a preset id or a tool name in `packages/cli/src` outside a preset folder finds nothing                                                                                                                               |
| 14    | Tests (T-1 to T-13, D-113)                                                                                                                                             | a planted install with defaults, the mise runner and two scopes passes; `tests/config/` holds the shared values; the read of the folders listed as not read in 18-gaps.md is done                                               |
| 15    | The app branch is deleted and the install is redone from the source tree (D-121)                                                                                       | the table that opens 20-adoption.md is measured again beside the first numbers; the branch holds no `gspot.local.toml`, and its report comes from a run with no local skip                                                      |
| 16    | Seeing the menu, levels, and the three init questions (A-21 to A-23, K-62 to K-64, D-118 to D-120)                                                                     | `gspot list` prints every check of the app with its state; `init` on the app at the `recommended` level holds under 2,000 findings                                                                                              |
| 17    | The agent block as a plain list (A-25, K-65)                                                                                                                           | `CLAUDE.md` in the app holds under 3 KB                                                                                                                                                                                         |
| 18    | Plain words where a person reads them, and the renames of 19-names.md (K-66, K-67, K-54, K-61)                                                                         | a fresh `gspot.toml` holds no `surface` and no `inspection`; `grep -ri surface` over help text, output and guides finds nothing; an old key is an unknown key, with no alias and no message of its own                          |
| 19    | The cache key of a declared check, and a push that checks what is pushed (K-69, K-70)                                                                                  | a `[[check]]` names the inputs it reads, or is never cached; a push of clean commits passes with unrelated uncommitted work in the tree                                                                                         |
| 20    | The top level of this repository (K-68, K-73)                                                                                                                          | one schema file at the root, `prose/` inside its preset, `examples/` installed by a planted test, the community files present                                                                                                   |
| 21    | What runs where, `--changed`, the estimate and the progress lines (K-81, D-122 to D-125)                                                                               | a push in the app that touches `api/` ends in under a minute; a full run prints a line as each check ends and a summary with times                                                                                              |
| 22    | The `recommended` level holds no house style and changes no build (K-74, K-75, K-91, K-92, D-126)                                                                      | init on a fresh Next.js project at `recommended` leaves `tsconfig.json` untouched and holds no finding about pinned versions, headers, or README shape                                                                          |
| 23    | This repository names its folders after languages, by its own exception, and keeps one copy of the structure logic (K-86, K-87, D-128, D-135)                          | `src/swift/` and `src/python/` exist here, `gspot.toml` holds one `folder_name_allowed` entry for them, and `gspot check` passes with no `[[ignore]]`                                                                           |
| 23b   | The command surface and GitLab (K-95, K-96, D-129 to D-133)                                                                                                            | `gspot --help` lists the commands of 02-cli.md; every flag in `--help` appears in a test and in a guide; init in a repository with `.gitlab-ci.yml` writes `.gitlab/ci/gspot.yml` and edits no other CI file                    |
| 24    | gspot checks itself again after the renames, with no ignore entry                                                                                                      | `gspot check` passes here, `gspot.toml` holds no `[[ignore]]`, every template of every preset is written and parsed by a check, and a hook runs the tests                                                                       |

### Where every other row lands

Every row of [18-gaps.md](18-gaps.md) belongs to one row of work. The table above names the rows
it closes. This table places the rest, so no finding is only a finding. A row of work is done
when every gap it names has left 18-gaps.md.

| Work                                                        | Gaps it closes                                                            | Goes with row |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ------------- |
| Delete what nothing uses                                    | K-104, K-111, K-115, K-119, K-129, K-146                                  | Delete first  |
| Defects that give a wrong answer, fixed first               | K-103, K-108, K-114, K-134, K-140, K-147, K-157                           | first fixes   |
| Takeover and detection read what a repository really holds  | K-42, K-57, K-76, K-78, K-120, K-126, K-128, K-158                        | 1 and 2       |
| Speed                                                       | K-71, K-125, K-127, K-138, K-143, K-148, K-162                            | 3 and 21      |
| What `check` and `doctor` print                             | K-82, K-83, K-84, K-117, K-122, K-130, K-132                              | 21            |
| The `recommended` level holds defects, and `all` adds taste | K-63, K-93, K-101, K-112, K-123, K-135, K-141, K-142, K-151, K-152, K-161 | 11 and 22     |
| Framework naming                                            | K-133, K-136, K-137                                                       | 12            |
| The core names no preset and no tool                        | K-13, K-17, K-24, K-79, K-80, K-85, K-107, K-113, K-139                   | 13            |
| One owner for each idea                                     | G-13, K-55, K-77, K-94, K-98, K-105, K-106, K-110, K-124, K-131, K-165    | 13            |
| The config and its words                                    | K-88, K-89, K-116                                                         | 8 and 18      |
| Checks that assume one layout                               | K-90, K-144, K-149, K-150, K-153, K-154, K-155, K-160, K-163              | 15            |
| What a repository gets from init                            | K-72, K-118                                                               | 5             |
| Release                                                     | K-121, K-145, K-164                                                       | before launch |
| Tests                                                       | T-2 to T-12, T-14 to T-18                                                 | 14            |

The Adoption phase is measured against yap-swift-app alone (D-121). yap-text-inference,
yap-landing, slopshop, and the two ComfyUI nodes follow it, one at a time, each against its sheet
in [17-migration.md](17-migration.md). The README, the manual, and the site come after the redo
of the app, because they show real output ([21-documentation.md](21-documentation.md)).

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
[17-migration.md](17-migration.md) as the pass condition. Every check in `quality/` maps to a gspot check, the 29 configuration files are replaced or carried, and the 35 lint tasks and the 15 duplicate pins are listed. The repository is read, never written; its own gate keeps running
until its owners migrate it.

## Phase 5: prose, security, upgrade

| Deliverable                                                                                        | Done when                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| prose preset: Vale driver, `gspot` style, packages, vocabulary, stdin grammars, adjacent selectors | the 30 rules fire on planted defects      |
| secrets, security, dependencies, licenses, duplication presets wired (Semgrep runs)                | each at its stage on a planted repository |
| `check --watch`                                                                                    | v1.1                                      |

## Phase 6: the corpus

| Deliverable                                         | Done when                                                 |
| --------------------------------------------------- | --------------------------------------------------------- |
| Repair pass over `rules/`                           | Vale clean, corruption rule clean, no cross-file links    |
| Front matter on every file, no tool named in a rule | `apply --check` passes                                    |
| Assembler and managed index block                   | the four reference repositories get their files and index |
| Corpus lint in gspot's gate                         | runs on every change                                      |

Acceptance: each reference repository's `rules/` and its `CLAUDE.md` are replaced by the
assembled set, with no rule statement lost. A diff of normalized statements is empty except for duplicates and the repaired words.

## Phase 7: the next repository shapes

Post-v1, one preset per phase-7 item, each with a planted repository and the acceptance harness on a public repository of that shape. The order is how often `init` reports the manifest with no preset:

| Preset       | Detects                           | Tools                                                                                                              |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| go           | `go.mod`                          | gofmt, golangci-lint, govulncheck, the structure engine through tree-sitter-go                                     |
| rust         | `Cargo.toml`                      | rustfmt, clippy at deny, cargo-audit, cargo-deny                                                                   |
| react        | `vite.config.*` with `react`      | the typescript preset plus `framework/react/REACT.md` and the React ESLint rules the nextjs preset already carries |
| react-native | Expo `app.json`, `react-native`   | react plus the Expo lint config                                                                                    |
| django       | `manage.py`                       | the python preset plus django-upgrade, the Django Ruff rules, model, and migration checks                          |
| nestjs       | `nest-cli.json`                   | the typescript preset plus module boundary rules                                                                   |
| ruby         | `Gemfile`                         | rubocop, bundler-audit                                                                                             |
| vue, svelte  | `vue.config.*`, `svelte.config.*` | the framework ESLint plugins                                                                                       |

`init` on one of these today installs the language presets it can (typescript for a Vite React
repository) and reports the rest as unchecked.

## The v1 cut

Phases 0 through 6 and the hardening phase, whole (D-61, D-82). v1 ships when every preset, the prose engine, the corpus
assembler, CodeQL at its `manual` stage and the upgrade path pass on the planted repositories and
the six acceptance shapes. That is a gspot that installs in a Python API, a Swift app, an
Express and Supabase monorepo, a static site, a Next.js app and a ComfyUI custom node. It replaces six quality folders, installs the agent rule files, upgrades itself, explains every finding, and
passes on day one through baselines. Only `check --watch`, the Homebrew tap, and Phase 7 follow
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
