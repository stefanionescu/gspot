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
| Acceptance on the reference repositories | for each of the four repositories: `git worktree add <temp> HEAD --detach`, `gspot init --yes`, `gspot check --json`, compare against the repository's own gate run (every finding the old `quality/` folder reports appears under a gspot check, through the ledger's file and rule mapping), record what gspot adds, `git worktree remove`. The repository's working tree is never opened and nothing is committed anywhere. Runs on demand and on release. | `tests/acceptance` |
| Parity | the naming extractor and the structure analyses over frozen copies of the reference repositories' source; the record set is a superset of the reference implementation's | `tests/parity` |
| Performance | `gspot check --staged` over ten staged files in a 1,000-file scope completes under 5 seconds with a warm cache and under 30 cold, on every CI platform | `tests/performance` |
| Platform | the unit and planted-repository suites run on `ubuntu`, `macos` and `windows` in CI | the CI matrix |
| Corpus | `reference-rules/lint/corpus-lint.ts` (front matter, markers, links, size, layer boundary, fences, corruption, Vale), `mark-statements.ts --check`, `completeness-check.ts` | gspot's own gate; interim home `reference-rules/lint/` until `packages/cli/src/rules/` exists |
| Self | `gspot check` on gspot, no ignores | gspot's own gate |

Tests never call the network. Tools run in CI through mise pins; a missing tool fails the test
run, never skips it. The acceptance suite needs the four reference repositories checked out
beside gspot and is the one suite that runs outside CI.

## Self-lint

gspot runs gspot at full strictness with no `[[ignore]]` entries. When a rule is too strict for
gspot's own code, the choice is to fix the code or change the rule for everyone in a recorded
decision. An ignore for gspot itself is not a choice.

The self-lint is the first integration test to pass, not the last. It runs on every change.

## Documentation

`docs/` is the user manual: install, first run, the configuration reference generated from the
settings schema, one page per preset generated from the manifests, the command reference
generated from commander, and a page per engine. Generated pages are generated files with the
header. `architecture/` stays the design and is linked from the manual.

## Contribution rule

One question, in order, for every addition:

1. Does a maintained tool do this? Configure it.
2. Can an ast-grep rule, an ESLint selector, a Vale rule, a SwiftLint regex or a path rule do it?
   Write data.
3. Can a documented plugin API do it? Write inside their framework.
4. Only then write an analysis, record the search in the manifest, and expect the question at
   review.
