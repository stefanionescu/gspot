# The gspot Repository

This document decides the gspot repository: packages, folders, tests, and how gspot lints
itself.

## The tree

```text
gspot/
├── .changeset/  .github/  .gspot/  .mise/    changesets, workflows, the files gspot writes here, mise pins
├── architecture/               this folder
├── docs/                       the manual, a Starlight site with generated reference pages
├── examples/                   three small repositories the README and the site show
├── packages/
│   ├── cli/                    the binary: config/, src/, types/, grammars/, tests/
│   ├── eslint-plugin/          @gspot/eslint-plugin
│   └── npm/                    the launcher package and the platform package template
├── presets/                    one folder for each preset: manifest.toml, templates, ast-grep rules, Semgrep packs
├── rules/                      the rule files, by layer
├── tests/                      planted repositories and the release suite
├── gspot.schema.json  gspot.toml  mise.toml  package.json  bunfig.toml  tsconfig.json
└── AGENTS.md  CLAUDE.md  CHANGELOG.md  CONTRIBUTING.md  LICENSE.md  NOTICE.md  README.md  SECURITY.md
```

Every folder and file, with what each holds, is in [16-file-tree.md](16-file-tree.md). A file
goes where that document says or the document changes in the same commit.

Two published artifacts: the binary (GitHub Releases, one asset per platform) and
`@gspot/eslint-plugin` (npm). Presets, rules, and prose ship inside the binary. On npm the binary ships the way Biome and ast-grep ship theirs. One package per platform (`@gspot/cli-darwin-arm64`, `@gspot/cli-linux-x64` and the rest) holds the executable, gated by the `os` and `cpu` fields. A thin `gspot` package lists them as `optionalDependencies`, and its `bin` launcher runs the one that installed. Nothing downloads at install time and no
install script runs, so `npx`, `--ignore-scripts`, proxies, and offline mirrors all work.

## What the top level holds

The projects a developer compares gspot with keep source, documents, tests, and examples at the
top, and little else.

| Project  | Top-level folders                                                           | The schema                      |
| -------- | --------------------------------------------------------------------------- | ------------------------------- |
| Ruff     | `crates`, `docs`, `python`, `scripts`, `playground`, `assets`               | `ruff.schema.json` at the root  |
| lefthook | `cmd`, `internal`, `docs`, `examples`, `packaging`, `tests`                 | `schema.json` at the root       |
| Biome    | `crates`, `packages`, `e2e-tests`, `scripts`, `plugins`                     | published with the npm package  |
| gspot    | `packages`, `presets`, `rules`, `examples`, `architecture`, `docs`, `tests` | `gspot.schema.json` at the root |

- The Vale style is the source of one preset, so it sits in `presets/prose/`. Vale loads a style
  from `<StylesPath>/<StyleName>/`, and the folder name is what a finding prints:
  `gspot.sentence-length`. A vocabulary works the same way.
- The JSON Schema lets an editor complete and check `gspot.toml`. It is one tracked file at the
  root, and the site copies it at build. The schema of the run record is embedded in the binary.
- `examples/` holds three small repositories: one package, one with two scopes, and one Swift
  package. The planted tests install into them, so they cannot go stale.
- `CHANGELOG.md` is written from the changesets. `NOTICE.md` lists the license of every
  dependency and grammar the binary embeds, and where `swift.wasm` was built from (K-245).
- The root holds no lint configuration file (D-100).

## Folder rules

- A folder has more than one file or does not exist.
- `commands/` holds no logic. Each command is a function elsewhere that a test calls with no
  terminal.
- `checks/` has one file for each check id. The folder is the first part of the id, and the file
  is the second.
- `checks/registry.ts` maps the id to the function. No other file of `src/` names a preset, a
  tool, or a check id (D-146, K-17, K-38).
- `readers/` holds a parser that more than one check uses, and a reader parses a scope once.
- `structure/analyses/` has one file for each check id, for every language the engine reads.
- No folder is named `util`, `helper`, `common`, `shared`, `core`, `lib` or `misc`. The naming
  policy gspot ships refuses them, and gspot lints itself.
- `packages/cli/config/` holds the literal tables gspot ships in code. Those are the regexes and pattern lists (shebangs, generated-file banners, environment-file names), the marker strings and header templates, the refused reasons, and the file-tag table.
- Files there hold literals only, and none names a preset or a tool. `integrity/config-purity`
  guards them here, because the `gspot.toml` of this repository names the folder as the `config` role.
- A constant of one algorithm, such as an index or a loop bound, stays inline (D-22).
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
| Detect and drive the package manager                  | `nypm`                                                               | lockfile and `packageManager` detection, and the install of `.gspot/package.json` for npm, pnpm, yarn, and bun (D-145)               |
| `.gitignore` semantics without git                    | `globby` with `gitignore: true`                                      | the walk `init` does when there is no repository                                                                                     |
| Name a language gspot has no preset for               | `linguist-languages`                                                 | GitHub Linguist's extension data, offline                                                                                            |
| SARIF for CI                                          | `node-sarif-builder`                                                 | the `.gspot/report.sarif` rendering                                                                                                  |
| Shell completions                                     | `@bomb.sh/tab` with its commander adapter                            | `gspot completion <shell>`; the same library Wrangler, Nuxt, Astro, and Vitest use                                                   |
| JSON schema for `gspot.toml`                          | zod v4 `z.toJSONSchema`                                              | `gspot.schema.json`, published to SchemaStore each release                                                                           |
| Baselines where the tool has its own                  | ESLint bulk suppressions, `basedpyright --writebaseline`             | the manifest of the tool names its baseline file; every other count sits in `.gspot/baseline.json` (D-104)                           |
| Split identifiers into parts                          | `scule` (`splitByCase`, the case functions)                          | the naming engine's splitter; the whole-part matcher stays gspot's (D-08)                                                            |
| Find workspace packages                               | `@manypkg/get-packages`                                              | npm, pnpm, yarn, bun, Lerna and Rush workspaces from one call; scopes come from its answer                                           |
| Read and write JSON with comments                     | `jsonc-parser` (`modify`, `applyEdits`)                              | the `extends` pointer of `tsconfig.json`, without losing a comment                                                                   |
| Read and write YAML keeping comments                  | `yaml` (the `Document` API)                                          | the `lefthook.yml` block, workflow rendering                                                                                         |
| Edit `package.json` keeping its indent                | `@npmcli/package-json`                                               | the tasks a developer accepted and the `gspot` launcher; no lint tool is written there (D-145)                                       |
| License expressions                                   | `spdx-expression-parse`, `spdx-satisfies`                            | matching `MIT OR Apache-2.0` against the allowlist                                                                                   |
| Markdown structure                                    | `mdast-util-from-markdown` (remark)                                  | `docs/stale-paths`, `docs/headings`, `docs/readme-shape`, `markdown/fences`; no regex over Markdown                                  |
| Unified diffs                                         | `diff` (jsdiff)                                                      | `check --fix --dry-run` output, and `integrity/generated-drift`                                                                      |
| Newer-version lookup                                  | `latest-version`                                                     | the one lookup `upgrade --dry-run` makes                                                                                             |
| Concurrency                                           | `p-limit`                                                            | the tool runner's per-stage limit                                                                                                    |
| Messages on stderr                                    | `consola`                                                            | levels for `--quiet` and `--verbose`, TTY and CI detection, a JSON reporter under `--json`; findings on stdout stay gspot's reporter |
| Spawning on Windows                                   | `cross-spawn` where `Bun.spawn` cannot run a `.cmd` shim             | the npm-installed tools on Windows (`eslint.cmd`, `prettier.cmd`)                                                                    |
| Path selectors                                        | picomatch                                                            | one syntax everywhere                                                                                                                |
| Versions                                              | semver                                                               | pins, floors, the version-pin comparison                                                                                             |
| Parsing for the structure and naming engines          | `web-tree-sitter` with embedded grammars; `libpg-query` WASM for SQL | no native modules                                                                                                                    |
| ICU messages                                          | `@formatjs/icu-messageformat-parser`                                 | `integrity/locales`                                                                                                                  |
| CSS selectors and class names                         | postcss                                                              | `css/usage`; no regex over CSS                                                                                                       |
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
- The npm release publishes one platform package per target plus the launcher package, all at one version.
- The launcher resolves the installed platform package by `process.platform` and `process.arch`, and fails with the install hint when none is present.
- `@gspot/eslint-plugin` builds with `bun build` to ESM and CommonJS, versioned with the binary.
- The plugin exports `configs.recommended`, a flat config with every rule on at its shipped
  options, so a person who installs the plugin alone writes one line (D-88).
- The plugin matches paths with `picomatch`, the matcher the binary uses, so one pattern in
  `gspot.toml` means one thing.

## Release

The version has one source: `version` in `packages/cli/package.json` (D-84). The build passes it
to the binary with `--define`, the plugin build writes it into `meta.version`, and `publish.ts`
reads it for every npm manifest. The release workflow fails when the tag differs from it. The
workflow sets `GSPOT_RELEASE_TEST=1` and runs `tests/release` against the binaries it built,
before it publishes. One more test starts the compiled binary of the runner's platform in a
planted repository and runs `init --yes` and `check`.

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

| Kind               | What                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | one test file for each source file with logic, in every folder of `src/`: schema and merge, selectors, natures, the matcher, each extractor, each check, each writer (T-23)      |
| Rule               | every ESLint rule through the rule tester of ESLint                                                                                                                              |
| Snapshot           | every generated file of every preset for a fixed policy, compared with a tracked copy (T-36)                                                                                     |
| Planted repository | `gspot init` as a developer runs it, then `gspot check`, on a small repository for each preset, with the real tools; exit code, check lines, and the text of each finding (T-24) |
| Failing case       | every shipped check has one planted case that makes it fail (T-17, T-28)                                                                                                         |
| Platform           | the unit tests, the planted repositories, and `gspot check` run on Linux, macOS, and Windows in CI (K-263)                                                                       |
| Completion         | every command and flag of the program appears in the completions for bash, zsh, fish, and PowerShell, read from the program and not from a list (T-22)                           |
| Schema             | `gspot.schema.json` accepts every example config of this folder and of the guides, and refuses every invalid fixture (S-11)                                                      |
| Tool contract      | every flag a manifest passes exists in the help text of the pinned tool (K-251)                                                                                                  |
| Launcher           | the launcher and the platform packages are published to a `verdaccio` registry and installed from it with `--ignore-scripts`                                                     |
| Time               | a staged check of ten files in a scope of 1,000 files ends within its stated limit, warm and cold (T-12)                                                                         |
| Rule files         | the repository check `rules/lint` reads front matter, links, size, the layer of each file, fences, and each good example (K-261)                                                 |
| Self               | `gspot check` on gspot, with no `[[ignore]]` entry                                                                                                                               |

`tests/config/` holds the init command lines, the fixture text, the tool lists, and the timeouts
that test files share (D-113). The harness fails a test whose `init` exits with an error (T-27).

Tests never call the network. Tools run in CI through mise pins, and a missing tool fails the
run. A `--json` test holds the documented shape of the JSON output of every command, because
agents drive gspot through it.

`bun test --coverage` runs in CI and the summary is part of the run. A check id that no test
names fails the unit test `every shipped check has a test`, which walks `presets/*/manifest.toml`.

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

- **Generated**, from the same data the binary uses, so they cannot drift. `docs/reference-pages.ts` writes them and, with `--check`, the repository check `docs/generated` fails when they differ (D-78).
    - the command reference, from commander;
    - the settings reference, from the schema (`gspot list settings` prints the same keys);
    - one page per preset, from its manifest;
    - one page per check, from its `summary`, `why` and `fix` (`explain` prints the same text);
    - the decision log, copied from `architecture/`.
- **Written by hand**, six guides, each a task in plain English. Each guide is under two pages and every step is one command.
    - _Install gspot_;
    - _Run it in a repository you already have_ (what `init` deletes, carries and leaves alone);
    - _You got a finding, now what_ (read it, `explain` it, fix it, or `ignore` it with a reason);
    - _Monorepos and scopes_;
    - _Without mise_ (the package-manager surface and its limits).

The manual also publishes `llms.txt` at its root, the index of every page in plain text (qlty and the Astral tools publish one too). One more page, _Working with an agent_, says how an agent reads a finding, runs `explain`, changes policy with the writing commands, and never edits `.gspot/`. The managed block in `CLAUDE.md` links to it.

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
