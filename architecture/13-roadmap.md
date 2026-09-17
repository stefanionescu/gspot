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
| `init`, `check`, `sync`, `doctor`, `uninstall`, `why`, `explain`, `completion`, and the six writing commands | the fourteen-command surface parses and every command works; `explain` renders `summary`, `why` and `fix` for every check in the bash preset; `completion` output from `tab` completes every command in bash and zsh |
| The npm launcher and one platform package per target | `bunx gspot --version` works from a local registry on the three platforms with no network and `--ignore-scripts` |
| Version pin: `.gspot/version`, the runner pin, the mismatch refusal, `--version` | a binary of another version exits 2 on `check` with the two remedies |
| Hooks, staged mode, `.mise/conf.d/gspot.toml` | a planted repository commits through the hook |
| One preset: bash (ShellCheck, shfmt, `bash -n`) | `gspot init --yes && gspot check` passes on a repository with one script |
| Self-lint begins | gspot's own shell scripts and hooks pass under gspot with no ignores |

## Phase 1: JavaScript and TypeScript

| Deliverable | Done when |
| --- | --- |
| `eslint-plugin-gspot` with the 21 rules and their tests | the reference test cases pass |
| typescript, javascript, formatting, structure, naming, config-files, markdown, spelling, commits, docs presets | each has a planted repository |
| Naming engine with the TypeScript, JavaScript and shell extractors | parity with the reference extractors on the frozen sources |
| Structure engine: tree-sitter loading, ast-grep driver, directory analyses, shell analyses | every shell check in the ledger fires on its planted defect |
| Baselines | `init` on a repository with findings passes; a grown count fails; the ESLint baseline is the tool's own suppressions file and the editor honours it |
| Integrity: generated drift, stale paths, allowlists, suppressions, manifest policy, lockfile, docs links, tsconfig options | each has a fixture |
| `upgrade --check` and `upgrade`, including the install step and `--to` | the report renders between two planted preset versions; the pin moves both ways |
| Takeover: replace and carry exceptions (typos, gitleaks, osv, licenses, disabled rules as ignores) | a planted repository with the four files loses them and gains the entries |
| Full self-lint | gspot's TypeScript passes under gspot with no ignores; `docs/` and every check `summary` pass the prose engine |

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

Acceptance: the worktree harness on yap-text-inference, and on the two ComfyUI custom-node
repositories for the Python half of the fifth shape (a root `__init__.py`, `requirements.txt`
exported from `pyproject.toml` and declared with `produced_by`, dependency ranges because the
node is a library).

## Phase 3: the web

| Deliverable | Done when |
| --- | --- |
| css, html, static-site, cloudflare presets | HTML copy, script policy, dead CSS, links, headers fire on planted defects |
| nextjs preset with boundaries, server-only, client environment, route segments, next config, CSS usage, locales | planted Next.js repository passes |
| zod, drizzle, trpc, tanstack-query, zustand, react-hook-form, i18n, vitest presets | each installs its rule file and its ESLint rules |
| GitHub Actions emitter | the workflow runs green on a planted repository |

Acceptance: the worktree harness on slopshop, on yap-landing's site checks, and on the ComfyUI
repositories' `web/` half (browser JavaScript with no bundler, CSS and HTML beside Python, the
runtime chosen per file class).

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
| `check --watch` | v1.1 |

## Phase 6: the corpus

| Deliverable | Done when |
| --- | --- |
| Repair pass over `rules/` | Vale clean, corruption rule clean, no cross-file links |
| Front matter and enforcement markers on every statement | `sync --check` passes; the unenforced count is recorded |
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
site, a Next.js app and a ComfyUI custom node, replaces six quality folders, upgrades itself,
explains every finding, and passes on day one through baselines. Prose, the corpus and CodeQL
follow in v1.1 and v1.2.

The reference repositories are never modified. Every acceptance run happens in a detached
`git worktree` that is removed afterwards; migrating a repository to gspot is a separate,
deliberate change its owner makes.

## Risks

| Risk | Mitigation |
| --- | --- |
| `bun build --compile` with embedded WASM grammars is unproven at this size | Phase 0 proves it before anything else is written |
| Windows: hooks under Git for Windows' sh, path separators in tool output, tools without Windows builds | Phase 0 runs the planted-repository suite on `windows-latest`; each later phase adds its tools to the matrix |
| Swift tree-sitter grammar quality | Phase 4 is last; parse errors are findings, so a weak grammar is loud |
| Xcode file listing and analyzer builds are slow | `push` stage only; the macOS CI job caches DerivedData |
| The corpus repair is editorial work | Phase 6 is independent of the gate; the gate ships without it |
| Two engines for JavaScript structure (ESLint plugin) and other languages (tree-sitter) drift | one ledger row per rule names both; a planted defect per rule per language |
