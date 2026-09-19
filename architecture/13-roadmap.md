# Build Order

This document decides the build order, the v1 cut, and what "done" means for each phase. Each phase ends with a repository passing under gspot with no rule lost. This repository comes first, then yap-swift-app in a detached worktree, then the other reference repositories through
planted repositories of their shape (D-62). Phases 0, 1 and 6 are built. The order from here is the hardening phase, then 5, 2, 4, and 3
(D-82). The Swift application needs the security presets, SQL, Supabase, Docker, and nginx before
the Swift presets can close its acceptance run.

## Status

Updated with every commit, so this table says what is built. Done means the code exists, has
tests, and runs in the gate of this repository. [18-gaps.md](18-gaps.md) lists what falls short of that. Last update: 2026-09-19.

| Area                                  | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0                               | Code done, tests partial ([18-gaps.md](18-gaps.md), G-2). Policy, presets, repository model, runner, emit, hooks, doctor, the commands, the bash, structure, naming, formatting and spelling presets, the build, the npm launcher, planted tests.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ESLint plugin, typescript, javascript | Done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Naming engine                         | Done: bash, TypeScript, JavaScript, SQL, Swift, and Python extractors, paths, the policy schema check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Structure engine                      | Done for directories, shell, Python (twelve `python/*` checks, D-98), and Swift (five `swift/*` checks), with a planted defect for every check. SQL has `sql/block-comments` and `sql/file-length`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Prose engine                          | Done: Vale by path and by stdin grammar, source bans, vocabulary, the 30 rules rendered with the docs ceilings. The prose, markdown and docs presets exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Integrity                             | Done: `generated-drift`, `docs-headings`, `stale-paths`, `fences`, `readme-present`, `readme-shape`, `tsconfig-options`, `env-example`, `baselines-current`, `config-purity`, `suppressions`, `allowlists-match`, `task-policy`, `large-files`, `manifest-policy`, `lockfile-fresh`, `install-policy`, `lockfile-hosts`, `dependency-ownership`, `typecheck-membership`, `required-rules` (D-99), and the web checks `route-segments`, `next-config`, `dependency-alignment`, `locales`, `css-usage`, `security-headers`.                                                                                                                                                |
| Corpus (Phase 6)                      | Done: the corpus lives in `rules/`, the corpus lint runs in `apply --check`; the enforcement markers are gone (D-73).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Self-lint                             | Done: `gspot check` passes 135 checks with no `[[ignore]]` (D-27), with `secrets`, `security`, `dependencies`, `licenses`, and `duplication` selected. Kept green from here on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Phase 1                               | Done: every shipped check id is named in a planted test, and the acceptance harness runs a reference repository in a detached worktree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Hardening                             | Done: the first install, the names of D-92, one owner for each concept, batching and timeouts, the version source, profiles, `recommends`, rule files that stand alone, and the plugin that stands alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Phases 2 to 5, Phase 7                | Phase 2 done: `sql`, `postgres`, `supabase`, `docker`, `nginx`, `express`, `vitest`, `ansible`, `python`, `pytest`, `fastapi`. Phase 3 done: `css`, `html`, `static-site`, `cloudflare`, `nextjs`, `i18n`, `zod`, `trpc`, `tanstack-query`, `zustand`, `react-hook-form`, `drizzle`; the acceptance runs over yap-landing and slopshop are owed. Phase 4 done: `swift`, `xcode`, `xctest`. Phase 5 done. 48 presets ship. Phase 7 started: `go`, `rust`, `react`, `vue`, and `svelte` ship; `react-native`, `django`, `nestjs`, and `ruby` are owed. Owed across phases: the manual rewrite (G-10) and the deeper unit tests of apply, carry, plan, execute, and doctor. |

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
