# Repository Layout

This document decides gspot's own repository: packages, folders, tests, and how gspot lints
itself.

## The tree

```text
gspot/
├── packages/
│   ├── cli/                    the binary. TypeScript, Bun.
│   │   ├── src/
│   │   │   ├── commands/       one file per command: parse flags, call one function, print
│   │   │   ├── config/         gspot.toml schema (zod), merge, validation messages
│   │   │   ├── presets/        manifest loading and validation
│   │   │   ├── repository/     tracked files, natures, scopes, staged files, manifests
│   │   │   ├── run/            check scheduling, tool runner, reporter, run record, baselines
│   │   │   ├── render/         templates, stubs, managed blocks, hooks, runner surface, workflow
│   │   │   ├── structure/      tree-sitter loading, ast-grep driver, original analyses
│   │   │   ├── naming/         policy schema, extractors, matcher
│   │   │   ├── prose/          Vale driver, grammar mapping
│   │   │   ├── integrity/      one file per integrity check
│   │   │   ├── rules/          corpus assembly, front matter, corpus lint
│   │   │   └── doctor/         tool probes, coverage report, detection report
│   │   ├── grammars/           tree-sitter WASM files, embedded at build
│   │   └── tests/
│   └── eslint-plugin/          eslint-plugin-gspot, published to npm
│       ├── src/rules/          one file per rule, ported with its tests
│       └── tests/
├── presets/                    one folder per preset: manifest.toml, templates, ast-grep rules, docs
├── rules/                      the corpus, by layer (moved from reference-rules/merged after repair)
├── prose/                      the gspot Vale style and vocabulary
├── docs/                       user documentation, published
├── architecture/               this folder
├── tests/
│   ├── repositories/           planted repositories, one per preset and one per reference shape
│   └── parity/                 naming and structure parity fixtures from the reference repos
├── gspot.toml                  gspot's own policy, written by gspot init
├── .gspot/                     gspot's own generated files
├── mise.toml                   bun, and the tools gspot's own checks need
└── package.json                workspace root
```

Two published artefacts: the binary (GitHub Releases, one asset per platform) and
`eslint-plugin-gspot` (npm). Presets, rules and prose ship inside the binary. An npm wrapper
package `gspot` downloads the matching binary at install for people who prefer `npx`.

## Folder rules

- A folder has more than one file or does not exist.
- `commands/` holds no logic. Each command is a function elsewhere that a test calls with no
  terminal.
- `integrity/` has one file per check, named after the check id.
- `structure/analyses/` has one file per original analysis, each with the tools searched in a
  header comment and in the preset manifest.
- No folder is named `util`, `helper`, `common`, `shared`, `core`, `lib` or `misc`. The naming
  policy gspot ships refuses them, and gspot lints itself.
- A constant with one reader is inline. `config/` holds the schema, not tunables.

## Libraries

One library per job, so nobody shops twice. Nothing here renders a user interface: every
command prints lines, and the only interactive moments are the questions `init` and `upgrade`
ask.

| Job | Library | Note |
| --- | --- | --- |
| Command parsing, `--help`, unknown-command suggestion | commander | the help text is the command reference; `docs/` is generated from it |
| The questions in `init` and `upgrade` | `@clack/prompts` | imported by those two commands only; never under `--yes`, `CI` or no terminal |
| Colour | picocolors | off under `NO_COLOR`, `CI`, `--no-color` or no terminal |
| Schemas for `gspot.toml`, manifests, run record | zod | error messages rewritten into plain English before printing |
| Read TOML | smol-toml | |
| Write `gspot.toml` keeping comments and order | `toml-patch`, evaluated first; a line-based appender is the fallback | the writer only appends an entry, replaces one key or removes one entry |
| Path selectors | picomatch | one syntax everywhere |
| Versions | semver | pins, floors, the version-pin comparison |
| Parsing for the structure and naming engines | `web-tree-sitter` with embedded grammars; `libpg-query` WASM for SQL | no native modules |
| ICU messages | `@formatjs/icu-messageformat-parser` | `integrity/locales` |
| CSS module classes | postcss, postcss-modules | `integrity/css-usage` |
| Spawning tools | `Bun.spawn` | no shell; explicit argument arrays |

Not used: any terminal UI framework, table renderer, spinner library outside clack, logging
framework, or dependency-injection container. Columns are computed from the longest id.

## Build

- `bun build --compile --target=bun-<os>-<arch>` per platform, with the grammar WASM files,
  presets, rules and prose embedded through Bun's file embedding. Output: `gspot-darwin-arm64`,
  `gspot-darwin-x64`, `gspot-linux-x64`, `gspot-linux-arm64`, `gspot-windows-x64.exe`.
- The version comes from the release tag and is written into every generated file header.
- The npm wrapper resolves the platform and downloads the asset with checksum verification.
- `eslint-plugin-gspot` builds with `bun build` to ESM and CommonJS, versioned with the binary.

## Tests

| Kind | What | Where |
| --- | --- | --- |
| Unit | config schema and merge, path selectors, natures, matcher, extractor per grammar, template rendering, managed blocks, baseline arithmetic, run record | `packages/cli/tests/unit` |
| Rule | every ESLint rule with the reference repositories' test cases, run through ESLint's rule tester | `packages/eslint-plugin/tests` |
| Snapshot | every generated file for every preset, byte for byte | `packages/cli/tests/snapshots` |
| Planted repository | `gspot init --yes` then `gspot check` on a small repository per preset, with real tools pinned in CI through mise; asserts exit code, check lines, and finding counts | `tests/repositories` |
| Acceptance on the reference repositories | for each of the six repositories (the four reference repositories and the two ComfyUI custom nodes): `git worktree add <temp> HEAD --detach`, `gspot init --yes`, `gspot check --json`, compare against the repository's own gate run (every finding the old `quality/` folder reports appears under a gspot check, through the ledger's file and rule mapping), record what gspot adds, `git worktree remove`. The repository's working tree is never opened and nothing is committed anywhere. Runs on demand and on release. | `tests/acceptance` |
| Parity | the naming extractor and the structure analyses over frozen copies of the reference repositories' source; the record set is a superset of the reference implementation's | `tests/parity` |
| Performance | `gspot check --staged` over ten staged files in a 1,000-file scope completes under 5 seconds with a warm cache and under 30 cold, on every CI platform | `tests/performance` |
| Platform | the unit and planted-repository suites run on `ubuntu`, `macos` and `windows` in CI | the CI matrix |
| Corpus | `reference-rules/lint/corpus-lint.ts` (front matter, markers, links, size, layer boundary, fences, corruption, Vale), `mark-statements.ts --check`, `completeness-check.ts` | gspot's own gate; interim home `reference-rules/lint/` until `packages/cli/src/rules/` exists |
| Self | `gspot check` on gspot, no ignores | gspot's own gate |

Tests never call the network. Tools run in CI through mise pins; a missing tool fails the test
run, never skips it. The acceptance suite needs the reference repositories checked out beside
gspot and is the one suite that runs outside CI. A `--json` test asserts the documented shape
of every command's JSON output, because agents drive gspot through it.

## Self-lint

gspot runs gspot at full strictness with no `[[ignore]]` entries. When a rule is too strict for
gspot's own code, the choice is to fix the code or change the rule for everyone in a recorded
decision. An ignore for gspot itself is not a choice.

The self-lint is the first integration test to pass, not the last. It runs on every change,
starting with gspot's own shell scripts and hooks in Phase 0 and covering the TypeScript from
Phase 1.

The self-lint includes gspot's prose. Every check `summary`, `why` and `fix`, every help string,
every message template and every page under `docs/` runs through the prose engine with the
`gspot` style and the Vale `Readability` package at a stated ceiling (Flesch reading ease 60 or
above, the level of plain consumer writing). A message a person without a coding background
cannot follow fails the gate the same way a long function does.

## Documentation

`docs/` is the user manual. Two kinds of page:

- **Generated**, from the same data the binary uses, so they cannot drift: the command reference
  from commander, the settings reference from the schema (`doctor --settings` prints the same
  keys), one page per preset from its manifest, one page per check from its `summary`, `why` and
  `fix` (`explain` prints the same text), and the decision log copied from `architecture/`.
  Generated pages carry the header and `sync --check` guards them.
- **Written by hand**, five guides, each a task in plain English: *Install gspot*; *Run it in a
  repository you already have* (what `init` will delete, carry and leave alone); *You got a
  finding, now what* (read it, `explain` it, fix it, or `ignore` it with a reason); *Monorepos
  and scopes*; *Without mise* (the package-manager surface and its limits). Each guide is under
  two pages and every step is one command.

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
