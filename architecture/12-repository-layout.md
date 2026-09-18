# The gspot Repository

This document decides the gspot repository: packages, folders, tests, and how gspot lints
itself.

## The tree

```text
gspot/
├── .changeset/  .github/  .gspot/  .mise/    changesets, CI and release workflows, gspot's own generated files, mise pins
├── architecture/               this folder
├── docs/                       the manual, a Starlight site with generated reference pages
├── packages/
│   ├── cli/                    the binary: src/, types/, grammars/, tests/
│   ├── eslint-plugin/          @gspot/eslint-plugin
│   └── npm/                    the launcher package and the platform package template
├── presets/                    one folder per preset: manifest.toml, templates, ast-grep rules, semgrep packs
├── prose/                      the gspot Vale style and vocabularies
├── rules/                      the agent rule corpus, by layer
├── schema/                     gspot.schema.json, run-record.schema.json
├── tests/                      planted repositories, acceptance, parity, performance, release
├── gspot.toml  mise.toml  package.json  bunfig.toml  tsconfig.json
└── AGENTS.md  CLAUDE.md  CHANGELOG.md  LICENSE.md  README.md
```

Every folder and file, with what each holds, is in [16-file-tree.md](16-file-tree.md). A file
goes where that document says or the document changes in the same commit.

Two published artifacts: the binary (GitHub Releases, one asset per platform) and
`@gspot/eslint-plugin` (npm). Presets, rules, and prose ship inside the binary. On npm the binary ships the way Biome and ast-grep ship theirs. One package per platform (`@gspot/cli-darwin-arm64`, `@gspot/cli-linux-x64` and the rest) holds the executable, gated by the `os` and `cpu` fields. A thin `gspot` package lists them as `optionalDependencies`, and its `bin` launcher runs the one that installed. Nothing downloads at install time and no
install script runs, so `npx`, `--ignore-scripts`, proxies, and offline mirrors all work.

## Folder rules

- A folder has more than one file or does not exist.
- `commands/` holds no logic. Each command is a function elsewhere that a test calls with no
  terminal.
- `integrity/` has one file per check, named after the check id.
- `structure/analyses/` has one file per original analysis, each with the tools searched in a
  header comment and in the preset manifest.
- No folder is named `util`, `helper`, `common`, `shared`, `core`, `lib` or `misc`. The naming
  policy gspot ships refuses them, and gspot lints itself.
- `packages/cli/config/` holds the literal tables gspot ships in code. Those are the regexes and pattern lists (shebangs, generated-file banners, environment-file names), the marker strings and header templates, the refused reasons, and the file-tag table.
- Files there hold literals only. `integrity/config-purity` guards them in the gate of this repository, because its `gspot.toml` names the directory as the `config` role. An algorithm's own constant (an index, a loop bound) stays inline; nothing forces hoisting (D-22).
- The `gspot.toml` schema, loader, merge, and writer live
  in `src/policy/`, named after what the file is called in the glossary, so `config` means one
  thing in this repository.

## Libraries

One library per job, so nobody shops twice. Nothing here renders a user interface: every
command prints lines, and the only interactive moments are the questions `init` and `upgrade`
ask.

| Job                                                   | Library                                                              | Note                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Render a preset template                              | `eta`                                                                | every `*.tmpl` under `presets/`; the generated-file header is prepended by gspot (D-63)                                              |
| Command parsing, `--help`, unknown-command suggestion | commander                                                            | the help text is the command reference; `docs/` is generated from it                                                                 |
| The questions in `init` and `upgrade`                 | `@clack/prompts`                                                     | imported by those two commands only; never under `--yes`, `CI` or no terminal                                                        |
| Color                                                 | picocolors                                                           | off under `NO_COLOR`, `CI`, `--no-color` or no terminal                                                                              |
| Schemas for `gspot.toml`, manifests, run record       | zod                                                                  | error messages rewritten into plain English before printing                                                                          |
| Read TOML                                             | smol-toml                                                            |                                                                                                                                      |
| Write `gspot.toml` keeping comments and order         | `@decimalturn/toml-patch`                                            | TOML 1.1; `patch()` and `TomlDocument`; a comment travels with the entry it belongs to when the entry moves or goes                  |
| Detect and drive the package manager                  | `package-manager-detector`, `nypm`                                   | lockfile and `packageManager` detection; `installDependencies` and `addDependency` for npm, pnpm, yarn, and bun                      |
| `.gitignore` semantics without git                    | `ignore`, `globby` with `gitignore: true`                            | the walk `init` does when there is no repository                                                                                     |
| Name a language gspot has no preset for               | `linguist-languages`                                                 | GitHub Linguist's extension data, offline                                                                                            |
| SARIF for CI                                          | `node-sarif-builder`                                                 | the `.gspot/last.sarif` rendering                                                                                                    |
| Shell completions                                     | `@bomb.sh/tab` with its commander adapter                            | `gspot completion <shell>`; the same library Wrangler, Nuxt, Astro, and Vitest use                                                   |
| JSON schema for `gspot.toml`                          | zod v4 `z.toJSONSchema`                                              | `gspot.schema.json`, published to SchemaStore each release                                                                           |
| Baselines where the tool has its own                  | ESLint bulk suppressions, `basedpyright --writebaseline`             | gspot drives the tool's file under `.gspot/baseline/`; the editor honors the same file                                               |
| Split identifiers into parts                          | `scule` (`splitByCase`, the case functions)                          | the naming engine's splitter; the whole-part matcher stays gspot's (D-08)                                                            |
| Find workspace packages                               | `@manypkg/get-packages`                                              | npm, pnpm, yarn, bun, Lerna and Rush workspaces from one call; scopes come from its answer                                           |
| Read and write JSON with comments                     | `jsonc-parser` (`modify`, `applyEdits`)                              | the `tsconfig.json` `extends` stub and the `.vscode/*.json` managed entries without losing a comment                                 |
| Read and write YAML keeping comments                  | `yaml` (the `Document` API)                                          | the `lefthook.yml` block, workflow rendering                                                                                         |
| Edit `package.json` keeping its indent                | `@npmcli/package-json`                                               | scripts, `devDependencies` and `packageManager` edits at `init` and `upgrade`                                                        |
| Parse `.editorconfig`                                 | `editorconfig`                                                       | the managed block and the `[format]` derivation                                                                                      |
| License expressions                                   | `spdx-expression-parse`, `spdx-satisfies`                            | matching `MIT OR Apache-2.0` against the allowlist                                                                                   |
| Markdown structure                                    | `mdast-util-from-markdown` (remark)                                  | `integrity/stale-paths`, `integrity/docs-headings`, `docs/readme-shape`, `markdown/fences`; no regex over Markdown                   |
| Unified diffs                                         | `diff` (jsdiff)                                                      | `check --fix --dry-run` and `apply --check` output                                                                                   |
| Concurrency                                           | `p-limit`                                                            | the tool runner's per-stage limit                                                                                                    |
| Plain-English schema errors                           | `zod-validation-error`                                               | every message from a bad `gspot.toml` or manifest                                                                                    |
| Messages on stderr                                    | `consola`                                                            | levels for `--quiet` and `--verbose`, TTY and CI detection, a JSON reporter under `--json`; findings on stdout stay gspot's reporter |
| Spawning on Windows                                   | `cross-spawn` where `Bun.spawn` cannot run a `.cmd` shim             | the npm-installed tools on Windows (`eslint.cmd`, `prettier.cmd`)                                                                    |
| Newer-version lookup                                  | `latest-version`                                                     | the one lookup `doctor` and `init` make                                                                                              |
| File watching (v1.1)                                  | `@parcel/watcher`                                                    | `check --watch`                                                                                                                      |
| Path selectors                                        | picomatch                                                            | one syntax everywhere                                                                                                                |
| Versions                                              | semver                                                               | pins, floors, the version-pin comparison                                                                                             |
| Parsing for the structure and naming engines          | `web-tree-sitter` with embedded grammars; `libpg-query` WASM for SQL | no native modules                                                                                                                    |
| ICU messages                                          | `@formatjs/icu-messageformat-parser`                                 | `integrity/locales`                                                                                                                  |
| CSS module classes                                    | postcss, postcss-modules                                             | `integrity/css-usage`                                                                                                                |
| Spawning tools                                        | `Bun.spawn`                                                          | no shell; explicit argument arrays                                                                                                   |

Not used: any terminal UI framework, table renderer, spinner library outside clack, logging
framework, or dependency-injection container. Columns are computed from the longest id.
[15-prior-art.md](15-prior-art.md) records the candidates that were considered and not taken.

What gspot writes itself, because no library does it: the preset loader and merge, the file-set computation from claims, natures and ignores, and the reporter that prints findings. Also the whole-part naming matcher, the structure analyses listed in [05-engines.md](05-engines.md), the integrity checks, and the writers for generated files and managed blocks. Each is small,
and each has a test. A contribution that adds a library for one of these is welcome when the
library is maintained and does the whole job.

## Build

- `bun build --compile --target=bun-<os>-<arch>` per platform, with the grammar WASM files,
  presets, rules and prose embedded through the file embedding of Bun. Output: `gspot-darwin-arm64`,
  `gspot-darwin-x64`, `gspot-linux-x64`, `gspot-linux-arm64`, `gspot-windows-x64.exe`.
- The version comes from the release tag and is written into every generated file header.
- The npm release publishes one platform package per target plus the launcher package, all at
  one version; the launcher resolves the installed platform package by `process.platform` and
  `process.arch` and fails with the install hint when none is present.
- `@gspot/eslint-plugin` builds with `bun build` to ESM and CommonJS, versioned with the binary.

## Release

Nothing in the release path is code gspot wrote:

| Step                   | Tool                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version and changelog  | `changesets`: every change lands with a changeset file; the release PR bumps the version and writes the changelog                                        |
| Build                  | a GitHub Actions matrix runs `bun build --compile` per target; the run record of the build is the release note's tool table                              |
| Provenance             | `actions/attest` signs every binary and the npm packages carry `--provenance` from trusted publishing, so `doctor` and a person can verify what they run |
| GitHub release         | `softprops/action-gh-release` uploads the binaries and checksums                                                                                         |
| npm                    | the launcher and one platform package per target, published in one job at one version                                                                    |
| Homebrew tap (post-v1) | a tap repository updated by `repository_dispatch` from the release workflow with `SierraSoftworks/actions-tap`                                           |
| Docs                   | Astro Starlight; `starlight-llms-txt` writes `llms.txt`, `llms-full.txt` and `llms-small.txt` from the same pages                                        |

## Tests

| Kind                                     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Where                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Unit                                     | config schema and merge, path selectors, natures, matcher, extractor per grammar, template rendering, managed blocks, baseline arithmetic, run record                                                                                                                                                                                                                                                                                                                                                                           | `packages/cli/tests/unit`                                                                     |
| Rule                                     | every ESLint rule with the reference repositories' test cases, run through ESLint's rule tester                                                                                                                                                                                                                                                                                                                                                                                                                                 | `packages/eslint-plugin/tests`                                                                |
| Snapshot                                 | every generated file for every preset, byte for byte                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `packages/cli/tests/snapshots`                                                                |
| Planted repository                       | `gspot init --yes` then `gspot check` on a small repository per preset, with real tools pinned in CI through mise; asserts exit code, check lines, and finding counts                                                                                                                                                                                                                                                                                                                                                           | `tests/repositories`                                                                          |
| Acceptance on the reference repositories | for each of the six repositories (the four reference repositories and the two ComfyUI custom nodes): `git worktree add <temp> HEAD --detach`, `gspot init --yes`, `gspot check --json`, compare against the repository's own gate run (every finding the old `quality/` folder reports appears under a gspot check, through the ledger's file and rule mapping), record what gspot adds, `git worktree remove`. The repository's working tree is never opened and nothing is committed anywhere. Runs on demand and on release. | `tests/acceptance`                                                                            |
| Parity                                   | the naming extractor and the structure analyses over frozen copies of the reference repositories' source; the record set is a superset of the reference implementation's                                                                                                                                                                                                                                                                                                                                                        | `tests/parity`                                                                                |
| Performance                              | `gspot check --staged` over ten staged files in a 1,000-file scope completes under 5 seconds with a warm cache and under 30 cold, on every CI platform                                                                                                                                                                                                                                                                                                                                                                          | `tests/performance`                                                                           |
| Platform                                 | the unit and planted-repository suites run on `ubuntu`, `macos` and `windows` in CI                                                                                                                                                                                                                                                                                                                                                                                                                                             | the CI matrix                                                                                 |
| Completion                               | every command and flag appears in the completions `tab` generates for bash, zsh, fish, and PowerShell                                                                                                                                                                                                                                                                                                                                                                                                                           | `packages/cli/tests/unit`                                                                     |
| Schema                                   | `gspot.schema.json` validates every fixture `gspot.toml` and rejects every invalid fixture the load tests use                                                                                                                                                                                                                                                                                                                                                                                                                   | `packages/cli/tests/unit`                                                                     |
| Launcher                                 | the npm launcher and platform packages are published to a `verdaccio` registry in CI and installed from it on the three platforms with `--ignore-scripts`; `bunx gspot --version` runs                                                                                                                                                                                                                                                                                                                                          | `tests/release`                                                                               |
| Fixtures                                 | planted repositories are written with `fs-fixture` and removed after each test                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `tests/repositories`                                                                          |
| Corpus                                   | `gspot apply --check` over the corpus (front matter, markers, links, size, layer boundary, fences, corruption, Vale), `mark-statements.ts --check`                                                                                                                                                                                                                                                                                                                                                                              | gspot's own gate; interim home `reference-rules/lint/` until `packages/cli/src/rules/` exists |
| Self                                     | `gspot check` on gspot, no ignores                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | gspot's own gate                                                                              |

Tests never call the network. Tools run in CI through mise pins; a missing tool fails the test
run, never skips it. The acceptance suite needs the reference repositories checked out beside
gspot and is the one suite that runs outside CI. A `--json` test asserts the documented shape
of every command's JSON output, because agents drive gspot through it.

## Self-lint

gspot runs gspot at full strictness with no `[[ignore]]` entries. When a rule is too strict for the code of gspot itself, the choice is to fix the code or change the rule for everyone in a recorded
decision. An ignore for gspot itself is not a choice.

The self-lint is the first integration test to pass, not the last. It runs on every change,
starting with the shell scripts and hooks in Phase 0 and covering the TypeScript from
Phase 1.

The self-lint includes the prose. Every check `summary`, `why` and `fix`, every help string, every message template and every page under `docs/` runs through the prose engine with the `gspot` style. The Vale `Readability` package runs at a stated ceiling: Flesch reading ease 60 or above, the level of plain consumer writing. A message a person without a coding background
cannot follow fails the gate the same way a long function does.

## Documentation

`docs/` is the user manual. Two kinds of page:

- **Generated**, from the same data the binary uses, so they cannot drift. Generated pages carry the header and `apply --check` guards them.
    - the command reference, from commander;
    - the settings reference, from the schema (`doctor --settings` prints the same keys);
    - one page per preset, from its manifest;
    - one page per check, from its `summary`, `why` and `fix` (`explain` prints the same text);
    - the decision log, copied from `architecture/`.
- **Written by hand**, five guides, each a task in plain English. Each guide is under two pages and every step is one command.
    - _Install gspot_;
    - _Run it in a repository you already have_ (what `init` deletes, carries and leaves alone);
    - _You got a finding, now what_ (read it, `explain` it, fix it, or `ignore` it with a reason);
    - _Monorepos and scopes_;
    - _Without mise_ (the package-manager surface and its limits).

The manual also publishes `llms.txt` at its root, the index of every page in plain text, as qlty and the Astral tools do. One more page, _Working with an agent_, says how an agent reads a finding, runs `explain`, changes policy with the writing commands, and never edits `.gspot/`. The managed block in `CLAUDE.md` links to it.

`architecture/` stays the design and is linked from the manual. `docs/` is linted by gspot like
any other Markdown in the repository, plus the readability ceiling above.

## Contribution rule

One question, in order, for every addition:

1. Does a maintained tool do this? Configure it.
2. Can an ast-grep rule, an ESLint selector, a Vale rule, a SwiftLint regex or a path rule do it?
   Write data.
3. Can a documented plugin API do it? Write inside their framework.
4. Only then write an analysis, record the search in the manifest, and expect the question at
   review.
