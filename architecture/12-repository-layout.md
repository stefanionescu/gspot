# The gspot Repository

Verification follows the [active CI bypass](22-remaining.md#active-ci-bypass). Local checks
and hooks remain required; GitHub execution and CI-only acceptance are deferred until the
user explicitly re-enables CI.

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
│   ├── testing/                private @gspot/testing: sandbox.ts, cleanup.test.ts, package.json
│   └── npm/                    the launcher package and the platform package template
├── presets/                    grouped by manifest kind, then preset name
├── rules/                      the rule files, by layer
├── tests/                      planted repositories and the release suite
├── gspot.schema.json  gspot.toml  mise.toml  package.json  bunfig.toml  tsconfig.json
└── AGENTS.md  CLAUDE.md  CHANGELOG.md  CONTRIBUTING.md  LICENSE.md  NOTICE.md  README.md  SECURITY.md
```

The ownership map is in [16-file-tree.md](16-file-tree.md). It defines responsibilities, not
a mandatory inventory of source and test filenames. Move code when ownership improves;
do not preserve a layout or repeat a reorganization because an earlier plan prescribed it.

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

- The Vale style is the source of one preset, so it sits in `presets/concern/prose/`. Vale loads a style
  from `<StylesPath>/<StyleName>/`, and the folder name is what a finding prints:
  `gspot.sentence-length`. A vocabulary works the same way.
- The JSON Schema lets an editor complete and check `gspot.toml`. It is one tracked file at the
  root, and the site copies it at build. The schema of the report is part of it.
- `examples/` holds three small repositories: one package, one with two scopes, and one Swift
  package. The planted tests install into them, so they cannot go stale.
- `CHANGELOG.md` is written from the changesets. `NOTICE.md` lists the license of every
  dependency and grammar the binary embeds, and where `swift.wasm` was built from (K-245).
- The root holds no lint configuration file (D-100).

## Folder rules

- CLI unit and integration tests stay in `packages/cli/tests`. Tests for the separately
  shipped plugin stay in `packages/eslint-plugin/tests`. Root `tests` owns whole-product
  command acceptance, shared harness tests, and packaged release acceptance.
- `packages/testing` owns shared filesystem setup and cleanup for those suites. Keep it
  limited to shared test support. Test-only types live with their tests.
- Commands own argument translation and presentation. Keep application behavior testable
  without a terminal, but do not create a forwarding file for every command.
- Domain-owned checks share actual parsers and preparation where needed. A check identifier
  does not require its own source file, wrapper, test file, or registry layer.
- Planning resolves the implementation once. Infrastructure does not import a check catalog
  merely to read config or compute paths.
- Shared readers parse once per command session. Language-specific semantics remain explicit.
- No folder is named `util`, `helper`, `common`, `shared`, `core`, `lib` or `misc`. The naming
  policy gspot ships refuses them, and gspot lints itself.
- Presets own shipped policy and tool data. Colocate algorithm-specific constants and types
  with their owner; share only contracts and data that multiple consumers actually use.
  Existing `packages/cli/config/` tables remain only where they serve that boundary.
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

| Job                                                   | Library                                                                | Note                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Render a preset template                              | `eta`                                                                  | every `*.tmpl` under `presets/`; the generated-file header is prepended by gspot (D-63)                                              |
| Command parsing, `--help`, unknown-command suggestion | commander                                                              | the help text is the command reference; `docs/` is generated from it                                                                 |
| The questions in `init` and `upgrade`                 | `@clack/prompts`                                                       | imported by those two commands only; never under `--yes`, `CI` or no terminal                                                        |
| Color                                                 | picocolors                                                             | off under `NO_COLOR`, `CI`, `--no-color` or no terminal                                                                              |
| Schemas for `gspot.toml`, manifests, the report       | zod                                                                    | error messages rewritten into plain English before printing                                                                          |
| Read TOML                                             | smol-toml                                                              |                                                                                                                                      |
| Write `gspot.toml` keeping comments and order         | `@decimalturn/toml-patch`                                              | TOML 1.1; `patch()` and `TomlDocument`; a comment travels with the entry it belongs to when the entry moves or goes                  |
| Detect the package manager                            | `nypm`                                                                 | `detectPackageManager` reads repository metadata; installation remains owned by the runner.                                          |
| `.gitignore` semantics without git                    | `globby` with `gitignore: true`                                        | the walk `init` does when there is no repository                                                                                     |
| Name a language gspot has no preset for               | `linguist-languages`                                                   | GitHub Linguist's extension data, offline                                                                                            |
| SARIF for CI                                          | `node-sarif-builder`                                                   | the `.gspot/report.sarif` rendering                                                                                                  |
| Shell completions                                     | `@bomb.sh/tab` with its commander adapter                              | `gspot completion <shell>`; the same library Wrangler, Nuxt, Astro, and Vitest use                                                   |
| JSON schema for `gspot.toml`                          | zod v4 `z.toJSONSchema`                                                | `gspot.schema.json`, published to SchemaStore each release                                                                           |
| Split identifiers into parts                          | `scule` (`splitByCase`, the case functions)                            | the naming engine's splitter; the whole-part matcher stays gspot's (D-08)                                                            |
| Find workspace packages                               | `@manypkg/tools`                                                       | Root-local npm, pnpm, yarn, bun, Lerna, and Rush workspace resolution; failures remain errors                                        |
| Read and write JSON with comments                     | `jsonc-parser` (`modify`, `applyEdits`)                                | the `extends` pointer of `tsconfig.json`, without losing a comment                                                                   |
| Read and write YAML keeping comments                  | `yaml` (the `Document` API)                                            | the `lefthook.yml` block, workflow rendering                                                                                         |
| Edit `package.json` keeping its indent                | `@npmcli/package-json`                                                 | the tasks a developer accepted and the `gspot` launcher; no lint tool is written there (D-145)                                       |
| License expressions                                   | `spdx-expression-parse`, `spdx-satisfies`                              | matching `MIT OR Apache-2.0` against the allowlist                                                                                   |
| Markdown structure                                    | `mdast-util-from-markdown`, `mdast-util-to-string`, `unist-util-visit` | Headings, README structure, fenced examples, and free-text path exclusions.                                                          |
| Unified diffs                                         | `diff` (jsdiff)                                                        | `check --fix --dry-run` output, and `integrity/generated-drift`                                                                      |
| Newer-version lookup                                  | `latest-version`                                                       | the one lookup `upgrade --dry-run` makes                                                                                             |
| Concurrency                                           | `p-limit`                                                              | the tool runner's per-stage limit                                                                                                    |
| Messages on stderr                                    | `consola`                                                              | levels for `--quiet` and `--verbose`, TTY and CI detection, a JSON reporter under `--json`; findings on stdout stay gspot's reporter |
| Spawning on Windows                                   | `cross-spawn` where `Bun.spawn` cannot run a `.cmd` shim               | the npm-installed tools on Windows (`eslint.cmd`, `prettier.cmd`)                                                                    |
| Path selectors                                        | picomatch                                                              | one syntax everywhere                                                                                                                |
| Versions                                              | semver                                                                 | pins, floors, the version-pin comparison                                                                                             |
| Parsing for the structure and naming engines          | `web-tree-sitter` with embedded grammars; `libpg-query` WASM for SQL   | no native modules                                                                                                                    |
| ICU messages                                          | `@formatjs/icu-messageformat-parser`                                   | `i18n/locales`                                                                                                                       |
| CSS selectors and class names                         | `postcss`, `postcss-scss`, `postcss-selector-parser`                   | Stylesheet syntax and decoded selector classes; no regex over CSS.                                                                   |
| Spawning tools                                        | `Bun.spawn`                                                            | no shell; explicit argument arrays                                                                                                   |

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
- The plugin exports `configs.recommended` for standalone use. `configs.all` also rejects
  forwarding functions. Each uses shipped options (D-88).
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
| Build                  | a GitHub Actions matrix runs `bun build --compile` per target; the report of the build is the tool table of the release note                             |
| Provenance             | `actions/attest` signs every binary and the npm packages carry `--provenance` from trusted publishing, so `doctor` and a person can verify what they run |
| GitHub release         | `softprops/action-gh-release` uploads the binaries and checksums                                                                                         |
| npm                    | the launcher and one platform package per target, published in one job at one version                                                                    |
| Homebrew tap (post-v1) | a tap repository updated by `repository_dispatch` from the release workflow with `SierraSoftworks/actions-tap`                                           |
| Docs                   | Astro Starlight; `starlight-llms-txt` writes `llms.txt`, `llms-full.txt` and `llms-small.txt` from the same pages                                        |

## Tests

Shared-policy acceptance spans Swift, JavaScript, TypeScript, Python, and their supported
frameworks. Exercise ordinary source and framework component files. Verify each
shipped surface, including the standalone ESLint plugin; a CLI pass alone cannot establish
plugin enforcement. Preserve rule exports and language-specific protection during cleanup.

Tests establish current product behavior. They must exercise real logic with meaningful inputs
and observable results. A test of a removed implementation, a forwarding wrapper, a filename,
a registry entry, or a source-text token does not establish that the CLI works. Delete tests
whose only subject is deleted. When a user contract survives a replacement, move its
regression to the new owner and execute that owner.

| Boundary                | Required evidence                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parsing and policy      | Valid input resolves correctly; malformed input reports the relevant path and defect. Validate the published schema with accepted and rejected documents.                 |
| Rule or check           | A planted defect produces the intended check, rule or diagnostic, file, and location; corrected and valid inputs do not produce that finding.                             |
| Generated configuration | The pinned consumer loads it and reports the intended defect. Snapshots cover meaningful serialization only; they do not establish enforcement.                           |
| Command                 | Verify exit status, structured result, applicable check execution, and relevant filesystem effects. Missing tools, unexpected skips, and empty runs cannot pass as clean. |
| Lifecycle               | Originals, binary bytes, modes, unowned files, later edits, interrupted operations, and recovery follow the ownership contract.                                           |
| Process                 | Verify actual termination, output handling, argument batching, cancellation, environment, and known failure classification.                                               |
| Packaged consumer       | Build, isolated publication, fresh installation, init, exact defect, correction, and successful rerun without checkout dependency links.                                  |
| Published plugin        | Install the artifact, consume its public exports and types, and obtain actual findings at the intended levels.                                                            |
| Platform                | Execute supported platform boundaries where available; record unavailable evidence as deferred.                                                                           |

Use identifiable cases with minimal inputs. Share expensive setup only where isolation and
restoration remain reliable. Shared harness code earns its place through setup or cleanup
behavior, not forwarding. Unit tests remain cheap; a small representative installation matrix
covers fresh and existing repositories, mixed languages, nested scopes, clean clones, hooks,
retained configuration, and supported package managers.

Do not require one test file per source file, fixed test or rule counts, complete filename
inventories, or source-text coverage guards. Tests need no generic case framework or central
table of every command and timeout. A mock can isolate a real unit boundary; mocked tools
cannot establish installed-tool compatibility. Availability of a registry pin proves only
that the version exists.

Delete low-signal config substring assertions once executed findings cover the contract.
Retain meaningful serialization, escaping, malformed-input, restoration, registry isolation,
and process regressions. Corrected input must remove the intended finding; unrelated findings
must not be hidden to manufacture a pass. Test recommended behavior on ordinary code, and
verify optional strict policies at all. Never weaken a rule to make a fixture pass.

Local-registry installation tests run against the built artifacts and derive their version.
External acquisition is explicit and separate from deterministic fixture execution. Required
tool absence fails acceptance; unit tests need not download tools. Check coverage comes from
executed behavior, not finding a check name in test source. Coverage reports complement this
contract and cannot replace it. The actionable cleanup is in
[22-remaining.md](22-remaining.md#cleanup-acceptance-backlog).

## Self-lint

gspot runs gspot at full strictness with no `[[ignore]]` entries. When a rule is too strict for the code of gspot itself, the choice is to fix the code or change the rule for everyone in a recorded
decision. An ignore for gspot itself is not a choice.

The self-lint is the first integration test to pass, not the last. It runs on every change,
starting with the shell scripts and hooks in Phase 0 and covering the TypeScript from
Phase 1.

The self-lint includes the prose. Every check `summary`, `why`, and `help`, every help string, every message template and every page under `docs/` runs through the prose engine with the `gspot` style. The Vale `Readability` package runs at a stated ceiling: Flesch reading ease 60 or above, the level of plain consumer writing. A message a person without a coding background
cannot follow fails the gate the same way a long function does.

## Documentation

`docs/` is the user manual. Two kinds of page:

- **Generated**, from the same validated definitions the binary uses, with completeness tests because a generator can still omit or misstate a contract. The docs build runs `docs/reference-pages.ts` first, and git ignores the pages it writes (D-153).
    - the command reference, from commander;
    - the settings reference, from the schema (`gspot list settings` prints the same keys);
    - one page per preset, from its manifest;
    - one page per check, from its `summary`, `why`, and `help` (`explain` prints the same text);
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
