# The gspot Repository

This document decides the gspot repository: packages, folders, tests, and how gspot lints
itself. Local checks, normal hooks, and full CI against the exact task-branch commit are
required before a merge.

Two published npm packages: `@gspothq/cli` and `@gspothq/eslint-plugin`. The CLI is TypeScript bundled
to plain JavaScript that runs on Node.js 22 or newer and on Bun. Kits, guides, prose styles, and
grammar files ship inside it. It has no per-system builds, and no install script runs.

## Ownership

gspot is unreleased and has no users. Names and configuration change directly, without
compatibility aliases, Changesets, or release-PR promises. Kits live at
`packages/cli/kits/<kind>/<name>`.

The CLI owns command behavior, planning, execution, and lifecycle operations. Commands
translate arguments and present results; output renders the statuses and findings the runner
computed. Generators return proposed files, managed blocks, and structured configuration edits.
Lifecycle owns publication contracts, collisions, recorded ownership, recovery, and removal,
including writer locks, original-byte reads, stale-input checks, permissions, log
transitions, and recovery ordering. A generated header or directory name does not authorize
deletion.

The independent ESLint plugin owns editor enforcement and its public exports. The npm launcher
selects an installed platform artifact. Kits own shipped policy, pins, templates, styles, and
vocabulary; guides own instructions for agents. Documentation renders released definitions and
authored guides. Tests exercise these behaviors and installed consumer journeys.

Source is grouped by behavior and ownership. A shared module exists only when it owns shared
behavior or a shared contract. A file under 40 lines with one caller lives in that caller.
Every type alias lives under the `types/` folder of its package, one file per source family,
and every literal constant under its `config/` folder, one file per check family.

Schemas,
function tables, and values computed at load stay beside the logic that owns them. Test
locations follow the behavior they exercise; source and test directories need not mirror each
other. Repository tooling stays separate from shipped runtime behavior: Bun and mise, and no
Nx, Turborepo, task framework, or private workspace packages.

When an implementation is deleted, its unused callers, imports, types, fixtures, and tests go
with it, in the same change; nothing is relocated, aliased, or wrapped in a new abstraction.

## Where things live

| Folder                              | Holds                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/commands/`        | one folder per command that has more than a flag parser; `program.ts` maps error codes to exit status once            |
| `packages/cli/src/checks/<family>/` | the analyses of one check family, each exporting one `analyses` registry that the dispatch module spreads             |
| `packages/cli/src/execution/`       | planning, scheduling, cancellation, the tool runner, output parsing, the cache, and reports                           |
| `packages/cli/src/generation/`      | template rendering, managed blocks, hooks, runners, workflows; `outputs.ts` orchestrates                              |
| `packages/cli/src/lifecycle/`       | ownership, recovery, the hooks path, rule readers, and apply and uninstall publication                                |
| `packages/cli/src/policy/`          | `gspot.toml` schema, reading, validation, merge, writing, and profiles                                                |
| `packages/cli/src/kits/`            | manifest schema, loading, and selection; the assets stay under `packages/cli/kits/`                                   |
| `packages/cli/src/repository/`      | discovery, file classification, existing tooling, revisions, and snapshots                                            |
| `packages/cli/src/tools/`           | locating, inspecting, and installing tools; Python and npm projects under `.gspot/`                                   |
| `packages/cli/src/parsers/`         | tree-sitter loading, the SQL parser, comments, and TOML and JSON readers                                              |
| `packages/cli/src/platform/`        | process execution, environment access, paths, errors, and package assets                                              |
| `packages/cli/src/agents/`          | guide selection, assembly, the managed block, and the guides lint                                                     |
| `packages/cli/scripts/`             | the package build, the grammar preparation, the guides lint, and the tool pins of the tests                           |
| `packages/eslint-plugin/`           | the plugin, with its rules beside their logic, `src/types/`, and `src/config/`                                        |
| `docs/`                             | the Astro Starlight site; `docs/src/content/reference/collection.ts` renders the check and setting definitions        |
| `tests/`                            | every test, with support under `tests/support/`, literal inputs under `tests/inputs/`, and types under `tests/types/` |
| `architecture/`                     | these contracts, and `levels/inventory.csv` and `levels/native.csv` as the level source                               |

Tool command execution serves checking, installation, and detection without importing the
check runner. Check input contracts belong to the check family, independently of the runtime
dispatcher. Parsers accept source reads and disposable resources without importing check
inputs. Infrastructure never imports every check definition for a basic operation.

## Native configuration and packaging

The CLI and the independently usable ESLint plugin are separate workspace packages. The plugin
exports `configs.recommended`, `configs.all`, and its rules through the conventional ESLint
plugin shape. Both configs enable the trivial-function and trivial-file rules with the shipped
options. The plugin matches paths with `picomatch`, the matcher the CLI uses.

Authored repository tasks live in `mise.toml`, which also owns the development runtimes, and
generated integration in `.mise/conf.d/gspot-tools.toml`, which gspot writes with every tool
pin. Each tool pin has one owner. Repository choices remain in TOML, and the documentation
schema endpoint at `/schema/gspot.schema.json` generates Taplo editor assistance from the
runtime policy schema.

Tests use the native Bun test configuration in `tests/bunfig.toml`, run from `tests/` with
`--timeout 60000`, and per-case deadlines stay explicit. The root TypeScript project includes
every test under its strict settings; `tests/tsconfig.json` extends it so knip resolves the
workspace's aliases. All tests belong under `tests/`: unit CLI and plugin suites, integration
CLI, docs, and repository suites, tool integration under `integration/tools/`, source journeys
under `acceptance/source/`, and package consumers under `acceptance/package/`. `mise run test`
runs the deterministic unit and integration suites; native tools, downloads, source acceptance,
and installed release consumers have separate explicit tasks. No Vitest, Jest, or custom
coordinator runs this repository's tests.

Root configuration has explicit owners: `gspot.toml`, `mise.toml`, `package.json`,
`bunfig.toml`, `tsconfig.json`, and the authored portions of `.gitignore` and `.gitattributes`
are repository inputs, and Bun owns `bun.lock`. Policy generation owns the editor files
`eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.stylelintrc.json`, and
`.editorconfig`, the directory pointers `.swiftlint.yml` and `pyrightconfig.json`, and
`.semgrepignore`; every other check names its configuration under `.gspot/config/` by path.

Generated tool configuration lives under `.gspot/config/`, with scope paths mirrored below
it. Guides live under `.gspot/guides/`, ownership logs, writer locks, and recovery backups
under `.gspot/state/`, reports under `.gspot/reports/`, and disposable caches under
`.gspot/cache/`. Private dependency manifests, lockfiles, installed packages, and the Python
environment stay at `.gspot/`'s root for native dependency resolution; only installed
dependencies, downloaded styles, local state, reports, and caches are ignored.

The root `LICENSE.md` is the authored project license, copied into distribution output. The
`gspot` package bundles only its own source; its npm dependencies install with their own
licenses. The grammar files it ships carry their licenses in `grammars/licenses/`.

## Libraries

One implementation per job. Before adding or retaining custom infrastructure, the supported
runtime, the dependencies already installed, and maintained open-source packages are checked,
in that order. Custom code owns what is specific to gspot: kit selection and precedence,
coverage policy, finding semantics, managed ownership, and recovery decisions. No forwarding
wrapper, private workspace package, or miniature framework renames a library API. Nothing
here renders a terminal user interface: commands print lines, and init asks questions when
interactive input is available.

| Job                                                   | Library                                                                | Note                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Temporary test directories                            | `testdirs`                                                             | `testdir()` with no files, register disposal, then `createFileTree`, so setup failures are cleaned up                |
| Render a kit template                                 | `eta`                                                                  | every `*.tmpl` under `packages/cli/kits/`; the generated-file header is prepended by gspot                           |
| Command parsing, `--help`, unknown-command suggestion | commander                                                              | the public command definition feeds the reference content loader                                                     |
| The questions in `init`                               | `@clack/prompts`                                                       | never under `--yes`, `CI` or no terminal                                                                             |
| Color and messages on stderr                          | picocolors, `process.stderr`                                           | off under `NO_COLOR`, `CI`, `--no-color` or no terminal; findings on stdout stay gspot's reporter                    |
| Schemas for `gspot.toml`, manifests, the report       | zod                                                                    | error messages rewritten into plain English; `z.toJSONSchema` publishes `gspot.schema.json`                          |
| Read TOML; write `gspot.toml` keeping comments        | smol-toml; `@decimalturn/toml-patch`                                   | comments are found by scanning `#` outside strings                                                                   |
| Read and write JSON with comments                     | `jsonc-parser`                                                         | `tsconfig.json` pointers and `package.json` edits, without losing a comment or the indent                            |
| Read and write YAML keeping comments                  | `yaml` (the `Document` API)                                            | YAML configuration merges, workflow rendering                                                                        |
| Detect the package manager; find workspace packages   | `nypm`; `@manypkg/tools`                                               | installation remains owned by the runner; workspace failures remain errors                                           |
| `.gitignore` semantics without Git                    | `ignore`                                                               | nested exclusions, negations, pruning, and symlink boundaries in native traversal                                    |
| Name a language gspot has no kit for                  | `linguist-languages`                                                   | GitHub Linguist's extension data, offline                                                                            |
| SARIF for CI                                          | `node-sarif-builder`                                                   | the `.gspot/reports/report.sarif` rendering                                                                          |
| Shell completions                                     | `@bomb.sh/tab` with its commander adapter                              | `gspot completion <shell>`                                                                                           |
| Split identifiers into parts                          | `scule`                                                                | the naming engine's splitter; the whole-part matcher stays gspot's                                                   |
| License expressions                                   | `spdx-expression-parse`, `spdx-satisfies`                              | matching `MIT OR Apache-2.0` against the allowlist                                                                   |
| Markdown structure                                    | `mdast-util-from-markdown`, `mdast-util-to-string`, `unist-util-visit` | headings, README structure, fenced examples, and free-text path exclusions                                           |
| Unified diffs                                         | `diff`                                                                 | `check --fix --dry-run` output, and `integrity/generated-drift`                                                      |
| Concurrency                                           | `p-limit`                                                              | the tool runner's per-stage limit                                                                                    |
| Process execution                                     | `execa`                                                                | capture, deadlines, cancellation, and platform command shims; gspot maps results and terminates its child on failure |
| Path selectors                                        | picomatch, `Bun.Glob` for scans                                        | one syntax everywhere                                                                                                |
| Versions                                              | semver                                                                 | pins, floors, the version-pin comparison                                                                             |
| Parsing for the structure and naming engines          | `web-tree-sitter` with packaged grammars; `libpg-query` WASM for SQL   | no native modules                                                                                                    |
| ICU messages                                          | `@formatjs/icu-messageformat-parser`                                   | `i18n/locales`                                                                                                       |
| CSS selectors and class names                         | `postcss`, `postcss-scss`, `postcss-selector-parser`                   | stylesheet syntax and decoded selector classes; no regex over CSS                                                    |

Not used: any terminal UI framework, table renderer, spinner library outside clack, logging
framework, or dependency-injection container.

## Build and release

`packages/cli/scripts/build.ts` bundles `packages/cli/src/main.ts` to `packages/cli/dist/gspot.js`
and the configuration process to `packages/cli/dist/configuration.js`, for Node, with every npm dependency left external. The
package ships `dist/`, `kits/`, `guides/`, and `grammars/`. `prepare:grammar` fills
`grammars/`: it copies the tree-sitter grammar files and downloads the Swift grammar, which
must match its pinned SHA-256. `@gspothq/eslint-plugin` builds with `bun build` to ESM and
CommonJS, versioned with `gspot`.

The version has one source, `version` in `packages/cli/package.json`: the CLI reads it through
the package manifest import, and the plugin exposes it in `meta.version`. The release workflow
fails when the tag differs. It runs the `test:package` task before publishing: both packages
are published to a local registry, installed into new projects, and run under Node.

| Step           | Tool                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Build          | `mise run build` and `mise run build:plugin`                                                                      |
| npm            | `npm publish --provenance` for `@gspothq/eslint-plugin`, then `@gspothq/cli`, in one job at one version           |
| GitHub release | `gh release create` with generated notes and no files                                                             |
| Docs           | Astro Starlight; `starlight-llms-txt` writes `llms.txt`, `llms-full.txt` and `llms-small.txt` from the same pages |

## Tests

Tests establish current product behavior with real logic, meaningful inputs, and observable
results. A test of a removed implementation, a forwarding wrapper, a filename, a registry entry, or a
source-text token establishes nothing. When a user contract survives a replacement, its
regression moves to the new owner. Shared-policy acceptance spans Swift,
JavaScript, TypeScript, Python, and their supported frameworks, on ordinary source and
framework component files, at every shipped surface including the standalone plugin.

| Boundary                | Required evidence                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parsing and policy      | Valid input resolves correctly; malformed input reports the relevant path and defect. The published schema accepts and rejects the documented cases.               |
| Rule or check           | A planted defect produces the intended check, rule or diagnostic, file, and location; corrected and valid inputs do not produce that finding.                      |
| Generated configuration | The pinned consumer loads it and reports the intended defect. Snapshots cover meaningful serialization only; they do not establish enforcement.                    |
| Command                 | Exit status, structured result, applicable check execution, and relevant filesystem effects. Missing tools, unexpected skips, and empty runs cannot pass as clean. |
| Lifecycle               | Originals, binary bytes, modes, unowned files, later edits, interrupted operations, and recovery follow the ownership contract.                                    |
| Process                 | Actual termination, output handling, argument batching, cancellation, environment, and known failure classification.                                               |
| Packaged consumer       | Build, isolated publication, fresh installation, init, exact defect, correction, and successful rerun without checkout dependency links.                           |
| Published plugin        | Install the artifact, consume its public exports and types, and obtain actual findings at the intended levels.                                                     |
| Platform                | Execute supported platform boundaries where available; a case names the platforms its tool has, and is skipped elsewhere.                                          |

A planted kit table installs its repository once and runs each defect as an edit that is
restored, through `plantedCases`. The table names the check, files, expected finding, and
correction of each case. Policy text comes from `policyOf`. A pair of levels is tested only
where `all` expects a finding `recommended` lacks.

Unit tests remain cheap. A small installation matrix covers fresh and existing repositories,
mixed languages, nested scopes, clean clones, hooks, and supported package managers. A mock
can isolate a real unit boundary; mocked tools cannot establish installed-tool compatibility.
Corrected input must remove the intended finding, and unrelated findings are never hidden to
manufacture a pass. No rule is weakened to make a test pass, and no percentage floor applies
to coverage.

Local-registry installation tests run against the built artifacts and derive their version.
Required tool absence fails acceptance; unit tests need not download tools. Source acceptance
and installed release consumers run sequentially because they exercise shared build and parser
assets.

## Self-lint

gspot runs gspot at `all` with a narrow reason on every retained exception. When a rule is too
strict for the code of gspot itself, the choice is to fix the code or change the rule for
everyone in a recorded decision. The self-lint includes the prose. Every check `summary`, `why`, and `help`, every help
string, every message template, and every page under `docs/` runs through the prose engine
with the `gspot` style. The Vale `Readability` package runs at Flesch reading ease 60 or
above.

## Documentation

The Astro Starlight site renders validated reference definitions through content loaders in
`docs/src/content/reference/collection.ts` and keeps authored task guides separate. Released
URLs, complete public settings, inherited options, plugin exports, search, source links, and
`llms.txt` are preserved. The executable checks for built links and release-aligned deployment
belong in `docs/scripts/`. Plugin rule metadata and common option schemas belong in
`packages/eslint-plugin/src/rules/` beside their consumers.

## Contribution rule

One question, in order, for every addition:

1. Does a maintained tool do this? Configure it.
2. Can an ast-grep rule, an ESLint selector, a Vale rule, a SwiftLint regex or a path rule do it?
   Write data.
3. Can a documented plugin API do it? Write inside their framework.
4. Only then write an analysis, record the search in the manifest, and expect the question at
   review.
