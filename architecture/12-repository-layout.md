# The gspot Repository

Verification follows the [active CI bypass](22-remaining.md#active-ci-bypass). Local checks
and hooks remain required; GitHub execution and CI-only acceptance are deferred until the
user explicitly re-enables CI.

This document decides the gspot repository: packages, folders, tests, and how gspot lints
itself.

Two published artifacts: the binary (GitHub Releases, one asset per platform) and
`@gspot/eslint-plugin` (npm). Presets, rules, and prose ship inside the binary. On npm the binary ships the way Biome and ast-grep ship theirs. One package per platform (`@gspot/cli-darwin-arm64`, `@gspot/cli-linux-x64` and the rest) holds the executable, gated by the `os` and `cpu` fields. A thin `gspot` package lists them as `optionalDependencies`, and its `bin` launcher runs the one that installed. Nothing downloads at install time and no
install script runs, so `npx`, `--ignore-scripts`, proxies, and offline mirrors all work.

## Ownership

[Implementation boundaries](16-file-tree.md) define responsibilities without prescribing a
folder inventory. The configuration schema supports editor completion; the runtime report
schema validates actual reports. Release staging produces notices for bundled dependencies.
Examples exercise implemented usage, and tests protect behavior rather than repository layout.

Use `testdirs` directly for temporary test directories. Register disposal before creating files
so setup failures are cleaned up. Keep test-only types with tests and exercise harness behavior
through real product journeys.

## Native configuration and packaging

The CLI and independently usable ESLint plugin remain separate workspace packages.
The plugin exports `configs.recommended`, `configs.all`, and its existing rules through
[ESLint's conventional plugin shape](https://eslint.org/docs/latest/extend/plugins).
Local constants and types stay with consumers unless a shared contract justifies extraction.

Keep authored repository tasks in `.mise/conf.d/repo.toml` and generated integration in
`.mise/conf.d/gspot-tools.toml`, using the
[native mise configuration location](https://mise.jdx.dev/configuration.html).
Root `mise.toml` overrides the generated gspot tasks to run repository source;
it is not a duplicate tool pin. Keep each identical tool pin in one owner. Duplicate-pin
detection parses only `[tools]` with smol-toml, so task and environment keys cannot become pins.

Repository choices remain in TOML. The generated root schema provides
[Taplo editor assistance](https://taplo.tamasfe.dev/configuration/using-schemas.html).
The website build copies that schema into output; a second tracked copy serves no purpose.

Use [Bun's native test configuration](https://bun.sh/docs/test/configuration) in `bunfig.toml`.
`mise run test` selects CLI unit and plugin tests. Explicit mise tasks select integration,
acceptance, and release directories; direct `bun test` has broader discovery. Release opt-in
and artifact prerequisites remain. Do not add Vitest, Jest, or a custom coordinator for this
repository. Framework presets can still use their own test tools.

Package-root `LICENSE.md` files follow npm packaging conventions. CLI notices describe actual
bundled inputs, embedded grammars, and Bun; root `LICENSES/` retains pinned supplements.
The plugin leaves dependencies external and does not copy unrelated CLI notices. Native
packaging does not assemble licenses for a compiled binary, so the small build-owned notice
assembler remains. Do not replace it with a scanner of the entire dependency tree.

## Libraries

Use one implementation per job. Before adding or retaining custom infrastructure, check the
supported runtime, dependencies already installed, and maintained open-source packages, in
that order. Prefer an existing implementation that meets the actual contract. Existing custom
code does not earn preservation because it already exists.

Record a candidate and its concrete acceptance or rejection reason in the owning design section.
Check its license, supported runtimes, maintenance, dependency cost, and real behavior. Add only
packages used by the implementation. A package name in a design table is not proof of compatibility.

Keep gspot-specific policy and orchestration around those primitives. Do not add forwarding
wrappers, private workspace packages, or miniature frameworks merely to rename a library API.
When a replacement passes, migrate callers directly and remove the superseded implementation,
package metadata, and dependencies together. The
[infrastructure candidates](15-prior-art.md#infrastructure-reuse-candidates) apply to test support,
processes, filesystem mutation, and the remaining architecture work.

Nothing here renders a terminal user interface. Commands print lines; init and upgrade ask
questions when interactive input is available.

| Job                                                   | Library                                                                | Note                                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temporary test directories                            | `testdirs`                                                             | Call `testdir()` with no files, register async disposal, then call `createFileTree`. This order preserves cleanup after setup failure.                     |
| Render a preset template                              | `eta`                                                                  | every `*.tmpl` under `presets/`; the generated-file header is prepended by gspot (D-63)                                                                    |
| Command parsing, `--help`, unknown-command suggestion | commander                                                              | the help text is the command reference; `docs/` is generated from it                                                                                       |
| The questions in `init` and `upgrade`                 | `@clack/prompts`                                                       | imported by those two commands only; never under `--yes`, `CI` or no terminal                                                                              |
| Color                                                 | picocolors                                                             | off under `NO_COLOR`, `CI`, `--no-color` or no terminal                                                                                                    |
| Schemas for `gspot.toml`, manifests, the report       | zod                                                                    | error messages rewritten into plain English before printing                                                                                                |
| Read TOML                                             | smol-toml                                                              |                                                                                                                                                            |
| Write `gspot.toml` keeping comments and order         | `@decimalturn/toml-patch`                                              | TOML 1.1; `patch()` and `TomlDocument`; a comment travels with the entry it belongs to when the entry moves or goes                                        |
| Detect the package manager                            | `nypm`                                                                 | `detectPackageManager` reads repository metadata; installation remains owned by the runner.                                                                |
| `.gitignore` semantics without git                    | `globby` with `gitignore: true`                                        | the walk `init` does when there is no repository                                                                                                           |
| Name a language gspot has no preset for               | `linguist-languages`                                                   | GitHub Linguist's extension data, offline                                                                                                                  |
| SARIF for CI                                          | `node-sarif-builder`                                                   | the `.gspot/report.sarif` rendering                                                                                                                        |
| Shell completions                                     | `@bomb.sh/tab` with its commander adapter                              | `gspot completion <shell>`; the same library Wrangler, Nuxt, Astro, and Vitest use                                                                         |
| JSON schema for `gspot.toml`                          | zod v4 `z.toJSONSchema`                                                | `gspot.schema.json`, published to SchemaStore each release                                                                                                 |
| Split identifiers into parts                          | `scule` (`splitByCase`, the case functions)                            | the naming engine's splitter; the whole-part matcher stays gspot's (D-08)                                                                                  |
| Find workspace packages                               | `@manypkg/tools`                                                       | Root-local npm, pnpm, yarn, bun, Lerna, and Rush workspace resolution; failures remain errors                                                              |
| Read and write JSON with comments                     | `jsonc-parser` (`modify`, `applyEdits`)                                | the `extends` pointer of `tsconfig.json`, without losing a comment                                                                                         |
| Read and write YAML keeping comments                  | `yaml` (the `Document` API)                                            | the `lefthook.yml` block, workflow rendering                                                                                                               |
| Edit `package.json` keeping its indent                | `jsonc-parser`                                                         | the tasks a developer accepted and the `gspot` launcher; no lint tool is written there (D-145)                                                             |
| License expressions                                   | `spdx-expression-parse`, `spdx-satisfies`                              | matching `MIT OR Apache-2.0` against the allowlist                                                                                                         |
| Markdown structure                                    | `mdast-util-from-markdown`, `mdast-util-to-string`, `unist-util-visit` | Headings, README structure, fenced examples, and free-text path exclusions.                                                                                |
| Unified diffs                                         | `diff` (jsdiff)                                                        | `check --fix --dry-run` output, and `integrity/generated-drift`                                                                                            |
| Newer-version lookup                                  | `latest-version`                                                       | the one lookup `upgrade --dry-run` makes                                                                                                                   |
| Concurrency                                           | `p-limit`                                                              | the tool runner's per-stage limit                                                                                                                          |
| Messages on stderr                                    | `consola`                                                              | levels for `--quiet` and `--verbose`, TTY and CI detection, a JSON reporter under `--json`; findings on stdout stay gspot's reporter                       |
| Process execution                                     | `execa`                                                                | Synchronous and asynchronous capture, deadlines, cancellation, and platform command shims; gspot maps results and terminates its child when capture fails. |
| Path selectors                                        | picomatch                                                              | one syntax everywhere                                                                                                                                      |
| Versions                                              | semver                                                                 | pins, floors, the version-pin comparison                                                                                                                   |
| Parsing for the structure and naming engines          | `web-tree-sitter` with embedded grammars; `libpg-query` WASM for SQL   | no native modules                                                                                                                                          |
| ICU messages                                          | `@formatjs/icu-messageformat-parser`                                   | `i18n/locales`                                                                                                                                             |
| CSS selectors and class names                         | `postcss`, `postcss-scss`, `postcss-selector-parser`                   | Stylesheet syntax and decoded selector classes; no regex over CSS.                                                                                         |
| Spawning tools                                        | `Bun.spawn`                                                            | no shell; explicit argument arrays                                                                                                                         |

Not used: any terminal UI framework, table renderer, spinner library outside clack, logging
framework, or dependency-injection container. Columns are computed from the longest id.
[15-prior-art.md](15-prior-art.md) records the candidates that were considered and not taken.

Custom code owns the rules and decisions specific to gspot: preset selection and precedence,
coverage policy, finding semantics, managed ownership, and recovery decisions. Use the libraries
above for parsing, matching, serialization, and execution where their contracts fit. Do not claim
that no library exists without evaluating candidates. Do not require one library to implement
an entire gspot workflow before reusing the part it already solves.

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

Native tools own release operations. gspot retains artifact staging and bundled-notice assembly:

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
verify optional strict policies at all. Never weaken a rule to make a test pass.

Local-registry installation tests run against the built artifacts and derive their version.
External acquisition is explicit and separate from deterministic test execution. Required
tool absence fails acceptance; unit tests need not download tools. Check coverage comes from
executed behavior, not finding a check name in test source. Coverage reports complement this
contract and cannot replace it. No arbitrary percentage floor applies. Conditional platform
and release suites are valid; required candidate suites must be explicitly enabled and run. The actionable cleanup is in
[22-remaining.md](22-remaining.md#cleanup-acceptance-backlog).

## Self-lint

gspot runs gspot at full strictness with no `[[ignore]]` entries. When a rule is too strict for the code of gspot itself, the choice is to fix the code or change the rule for everyone in a recorded
decision. An ignore for gspot itself is not a choice.

Run affected checks after each coherent batch. Run complete self-lint at `all` against the
frozen candidate under [the acceptance gate](22-remaining.md#implementation-gate-before-touching-the-app).

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
