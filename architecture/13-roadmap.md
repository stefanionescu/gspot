# Roadmap

This document decides the build order, the v1 cut, and what "done" means for each phase. Each
phase ends with one of the reference repositories passing under gspot with its own quality
folder deleted and no rule lost.

## Phase 0: the skeleton

| Deliverable | Done when |
| --- | --- |
| The binary builds for five targets with embedded assets | `gspot --version` runs from a release asset on macOS, Linux and Windows |
| Result cache | a second `check --staged` with no changes runs no tool |
| `gspot.toml` schema, load, merge, error messages | every message in [03-configuration.md](03-configuration.md) has a test |
| Tracked files, natures, scopes, staged files | the four reference repositories list correctly |
| Tool runner with file lists, concurrency, missing-tool handling | a planted repository with one missing tool fails with the hint |
| Reporter, run record, exit codes | output matches the shape in [02-cli.md](02-cli.md) |
| `init`, `check`, `sync`, `doctor`, `uninstall`, and the six writing commands | the fifteen-command surface parses; `init`, `check`, `sync`, `doctor`, `uninstall`, `ignore`, `set`, `allow`, `add`, `remove`, `declare` work |
| Hooks, staged mode, `.mise/conf.d/gspot.toml` | a planted repository commits through the hook |
| One preset: bash (ShellCheck, shfmt, `bash -n`) | `gspot init --yes && gspot check` passes on a repository with one script |

## Phase 1: JavaScript and TypeScript

| Deliverable | Done when |
| --- | --- |
| `eslint-plugin-gspot` with the 21 rules and their tests | the reference test cases pass |
| typescript, javascript, formatting, structure, naming, config-files, markdown, spelling, commits, docs presets | each has a planted repository |
| Naming engine with the TypeScript, JavaScript and shell extractors | parity with the reference extractors on the frozen sources |
| Structure engine: tree-sitter loading, ast-grep driver, directory analyses, shell analyses | every shell check in the ledger fires on its planted defect |
| Baselines | `init` on a repository with findings passes; a grown count fails |
| Integrity: generated drift, stale paths, allowlists, suppressions, manifest policy, lockfile, docs links, tsconfig options | each has a fixture |

Acceptance: the worktree harness on yap-landing shows every finding its JavaScript and shell
checks report under a gspot check, plus the additions; the repository itself is untouched.

## Phase 2: Python, SQL, containers

| Deliverable | Done when |
| --- | --- |
| python, pytest, fastapi presets with every tool and the 14 structure analyses | the ledger's Python section is green on a planted repository |
| Python naming extractor | parity on the frozen source |
| sql, postgres, supabase presets: sqlfluff, squawk, migration docs, edge lint, Semgrep rules | planted Supabase repository passes |
| docker, nginx presets | compose config and nginx `-t` run through the daemon |
| express preset | boundaries and HTTP rules |
| dependency ownership, typecheck membership, security-headers integrity checks | fixtures |

Acceptance: the worktree harness on yap-text-inference.

## Phase 3: the web

| Deliverable | Done when |
| --- | --- |
| css, html, static-site, cloudflare presets | HTML copy, script policy, dead CSS, links, headers fire on planted defects |
| nextjs preset with boundaries, server-only, client environment, route segments, next config, CSS usage, locales | planted Next.js repository passes |
| zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n, vitest presets | each installs its rule file and its ESLint rules |
| GitHub Actions emitter | the workflow runs green on a planted repository |

Acceptance: the worktree harness on slopshop and on yap-landing's site checks.

## Phase 4: Swift

| Deliverable | Done when |
| --- | --- |
| swift and xcode presets: SwiftLint two configs, SwiftFormat, Periphery, analyze after build, iOS Semgrep rules | the ledger's Swift section is green |
| Swift naming extractor and trivial-function analysis | parity on the frozen source |
| macOS job in the workflow | runs green |

Acceptance: the worktree harness on yap-swift-app across its three scopes. The repository is
read, never written; its own gate keeps running until its owners migrate it.

## Phase 5: prose, security, upgrade

| Deliverable | Done when |
| --- | --- |
| prose preset: Vale driver, `gspot` style, packages, vocabulary, stdin grammars, adjacent selectors | the 30 rules fire on planted defects |
| secrets, vulnerabilities, dependencies, licenses, duplication presets wired (Semgrep runs) | each at its stage on a planted repository |
| `upgrade --check` and `upgrade` | the report renders for a preset change between two versions |
| `explain`, `completion` | v1.1 |

## Phase 6: the corpus

| Deliverable | Done when |
| --- | --- |
| Repair pass over `rules/` | Vale clean, corruption rule clean, no cross-file links |
| Front matter and enforcement markers on every statement | `rules --check` passes; the unenforced count is recorded |
| Assembler and managed index block | the four reference repositories get their files and index |
| Corpus lint in gspot's gate | runs on every change |

Acceptance: each reference repository's `rules/` and its `CLAUDE.md` are replaced by the
assembled set, with no rule statement lost (a diff of normalised statements is empty except for
duplicates and the repaired words).

## Phase 7: the next repository shapes

Post-v1, one preset per phase-7 item, each with a planted repository and the acceptance harness
on a public repository of that shape, ordered by how often `init` reports the manifest with no
preset:

| Preset | Detects | Tools |
| --- | --- | --- |
| go | `go.mod` | gofmt, golangci-lint, govulncheck, the structure engine through tree-sitter-go |
| rust | `Cargo.toml` | rustfmt, clippy at deny, cargo-audit, cargo-deny |
| react | `vite.config.*` with `react` | the typescript preset plus `framework/react/REACT.md` and the React ESLint rules the nextjs preset already carries |
| react-native | Expo `app.json`, `react-native` | react plus the Expo lint config |
| django | `manage.py` | the python preset plus django-upgrade, the Django Ruff rules, model and migration checks |
| nestjs | `nest-cli.json` | the typescript preset plus module boundary rules |
| ruby | `Gemfile` | rubocop, bundler-audit |
| vue, svelte | `vue.config.*`, `svelte.config.*` | the framework ESLint plugins |

`init` on one of these today installs the language presets it can (typescript for a Vite React
repository) and reports the rest as unchecked.

## The v1 cut

Phases 0 through 4, plus the secrets, dependencies and licenses presets from phase 5. That is a
gspot that installs in a Python API, a Swift app, an Express and Supabase monorepo, a static
site and a Next.js app, replaces four quality folders, and passes on day one through baselines.
Prose, upgrade, the corpus and CodeQL follow in v1.1 and v1.2.

## Risks

| Risk | Mitigation |
| --- | --- |
| `bun build --compile` with embedded WASM grammars is unproven at this size | Phase 0 proves it before anything else is written |
| Windows: hooks under Git for Windows' sh, path separators in tool output, tools without Windows builds | Phase 0 runs the planted-repository suite on `windows-latest`; each later phase adds its tools to the matrix |
| Swift tree-sitter grammar quality | Phase 4 is last; parse errors are findings, so a weak grammar is loud |
| Xcode file listing and analyzer builds are slow | `push` stage only; the macOS CI job caches DerivedData |
| The corpus repair is editorial work | Phase 6 is independent of the gate; the gate ships without it |
| Two engines for JavaScript structure (ESLint plugin) and other languages (tree-sitter) drift | one ledger row per rule names both; a planted defect per rule per language |
