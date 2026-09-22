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

gspot is unreleased and has no users. Change names and configuration directly. Do not maintain
compatibility aliases, version migrations, Changesets, or release-PR promises. Presets live at
`presets/<name>`; the data/configuration preset and its public check prefix are `configs`.

The CLI owns command behavior, planning, execution, and lifecycle operations. Commands translate
arguments and present results; output renders the statuses and findings computed by the runner.
Generators return proposals. Lifecycle owns collisions, recorded ownership, recovery, and removal.
A generated header or directory name does not authorize deletion.

The independent ESLint plugin owns editor enforcement and its public exports. The npm launcher
selects an installed platform artifact. Presets own shipped policy, pins, templates, styles, and
vocabulary; rule guides own instructions for agents. Documentation renders released definitions
and authored guides. Tests exercise these behaviors and installed consumer journeys.

Group source by behavior and ownership. Extract a shared module only when it owns shared behavior
or a shared contract. Keep local types, schemas, constants, and functions beside their consumers.
Do not require a file per type, constant, forwarding function, or check. Test locations follow
the behavior they exercise; source/test directory symmetry is not required.

Use the preset kind `policy` for cross-language checks. It groups preset
selection and planning; it does not prescribe the taxonomy of commands, tests, docs,
or unrelated source directories. Configurable shipped naming and placement policies remain
available at their specified levels. They are not blanket instructions to reorganize gspot.

Repository tooling stays separate from shipped runtime behavior. Keep Bun and mise. Do not
introduce Nx, Turborepo, a task framework, or private workspace packages to copy their layouts.
Retain schemas where editor, runtime, or documentation consumers need them. Retain WASM grammars,
platform definitions, and provenance with their actual consumers. Stage generated distribution
copies in ignored build output. Notice assembly belongs to packaging; plugin dependencies stay
external. The launcher, plugin, and platform packages each carry the required license.

Domain checks share parsers and preparation where useful and preserve language semantics.
Infrastructure must not import an entire check catalog for a basic operation. Change an owner
with its callers, assets, and build inputs in the same implementation batch. Update all consumers directly when moving or deleting implementations.

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

The root `LICENSE.md` is the authored project license. Builds copy it into distribution output,
including `packages/eslint-plugin/dist/LICENSE.md`. CLI notices describe actual bundled inputs,
embedded grammars, and Bun; `packages/cli/notices.json` owns pinned supplemental text and provenance.
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

Nothing here renders a terminal user interface. Commands print lines; init and apply ask
questions when interactive input is available.

| Job                                                   | Library                                                                | Note                                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temporary test directories                            | `testdirs`                                                             | Call `testdir()` with no files, register async disposal, then call `createFileTree`. This order preserves cleanup after setup failure.                     |
| Render a preset template                              | `eta`                                                                  | every `*.tmpl` under `presets/`; the generated-file header is prepended by gspot                                                                           |
| Command parsing, `--help`, unknown-command suggestion | commander                                                              | the public command definition feeds the reference content loader                                                                                           |
| The questions in `init`                               | `@clack/prompts`                                                       | imported by those two commands only; never under `--yes`, `CI` or no terminal                                                                              |
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
| Split identifiers into parts                          | `scule` (`splitByCase`, the case functions)                            | the naming engine's splitter; the whole-part matcher stays gspot's                                                                                         |
| Find workspace packages                               | `@manypkg/tools`                                                       | Root-local npm, pnpm, yarn, bun, Lerna, and Rush workspace resolution; failures remain errors                                                              |
| Read and write JSON with comments                     | `jsonc-parser` (`modify`, `applyEdits`)                                | the `extends` pointer of `tsconfig.json`, without losing a comment                                                                                         |
| Read and write YAML keeping comments                  | `yaml` (the `Document` API)                                            | the `lefthook.yml` block, workflow rendering                                                                                                               |
| Edit `package.json` keeping its indent                | `jsonc-parser`                                                         | the tasks a developer accepted and the `gspot` launcher; no lint tool is written there                                                                     |
| License expressions                                   | `spdx-expression-parse`, `spdx-satisfies`                              | matching `MIT OR Apache-2.0` against the allowlist                                                                                                         |
| Markdown structure                                    | `mdast-util-from-markdown`, `mdast-util-to-string`, `unist-util-visit` | Headings, README structure, fenced examples, and free-text path exclusions.                                                                                |
| Unified diffs                                         | `diff` (jsdiff)                                                        | `check --fix --dry-run` output, and `integrity/generated-drift`                                                                                            |
| Concurrency                                           | `p-limit`                                                              | the tool runner's per-stage limit                                                                                                                          |
| Messages on stderr                                    | `consola`                                                              | levels for `--quiet` and `--verbose`, TTY and CI detection, a JSON reporter under `--json`; findings on stdout stay gspot's reporter                       |
| Process execution                                     | `execa`                                                                | Synchronous and asynchronous capture, deadlines, cancellation, and platform command shims; gspot maps results and terminates its child when capture fails. |
| Path selectors                                        | picomatch                                                              | one syntax everywhere                                                                                                                                      |
| Versions                                              | semver                                                                 | pins, floors, the version-pin comparison                                                                                                                   |
| Parsing for the structure and naming engines          | `web-tree-sitter` with embedded grammars; `libpg-query` WASM for SQL   | no native modules                                                                                                                                          |
| ICU messages                                          | `@formatjs/icu-messageformat-parser`                                   | `i18n/locales`                                                                                                                                             |
| CSS selectors and class names                         | `postcss`, `postcss-scss`, `postcss-selector-parser`                   | Stylesheet syntax and decoded selector classes; no regex over CSS.                                                                                         |

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
  `gspot-darwin-x64`, `gspot-linux-x64`, `gspot-linux-arm64`, `gspot-windows-x64.exe`, plus Linux x64 and ARM64 musl targets from the same platform definition.
- The release tag must match the package version source; generated file headers use that version.
- The npm release publishes one platform package per target plus the launcher package, all at one version.
- The launcher resolves the installed platform package by `process.platform` and `process.arch`, and fails with the install hint when none is present.
- `@gspot/eslint-plugin` builds with `bun build` to ESM and CommonJS, versioned with the binary.
- The plugin exports `configs.recommended` for standalone use. `configs.all` also rejects
  forwarding functions. Each uses shipped options.
- The plugin matches paths with `picomatch`, the matcher the binary uses, so one pattern in
  `gspot.toml` means one thing.

## Release

The version has one source: `version` in `packages/cli/package.json`. The build passes it
to the binary with `--define`, the plugin build writes it into `meta.version`, and `publish.ts`
reads it for every npm manifest. The release workflow fails when the tag differs from it. The
workflow sets `GSPOT_RELEASE_TEST=1` and runs `tests/release` against the binaries it built,
before it publishes. One more test starts the compiled binary of the runner's platform in a
planted repository and runs `init --yes` and `check`.

Native tools own release operations. gspot retains artifact staging and bundled-notice assembly:

| Step                   | Tool                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package versions       | Edit package versions directly. Keep release packaging without release-PR machinery.                                                                     |
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
[22-remaining.md](22-remaining.md#grouped-dispositions).

## Self-lint

gspot runs gspot at full strictness with no `[[ignore]]` entries. When a rule is too strict for the code of gspot itself, the choice is to fix the code or change the rule for everyone in a recorded
decision. An ignore for gspot itself is not a choice.

Run affected checks after each coherent batch. Run complete self-lint at `all` against the
frozen candidate under [the acceptance gate](22-remaining.md#candidate-gate).

The self-lint includes the prose. Every check `summary`, `why`, and `help`, every help string, every message template and every page under `docs/` runs through the prose engine with the `gspot` style. The Vale `Readability` package runs at a stated ceiling: Flesch reading ease 60 or above, the level of plain consumer writing. A message a person without a coding background
cannot follow fails the gate the same way a long function does.

## Documentation

The existing Astro/Starlight site renders validated reference definitions through content
loaders and keeps authored task guides separate. Preserve released URLs, complete public
settings, inherited options, plugin exports, search, source links, and `llms.txt`.
[Documentation](21-documentation.md) owns the replacement acceptance for the existing Markdown
writer, the plain text site design, and release-aligned deployment and rollback. Guide length
follows the task; no page quota, separate fixture system, or universal prose parser is required.

## Contribution rule

One question, in order, for every addition:

1. Does a maintained tool do this? Configure it.
2. Can an ast-grep rule, an ESLint selector, a Vale rule, a SwiftLint regex or a path rule do it?
   Write data.
3. Can a documented plugin API do it? Write inside their framework.
4. Only then write an analysis, record the search in the manifest, and expect the question at
   review.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-300

Each contract has one architecture owner and each unfinished behavior has one status owner in remaining work. Keep help, schemas, references, and behavior consistent. Verify no-check initialization, read-only previews, immutable installation, reachable hook chains, application across changed version pins, and manual build/test stages.

### Acceptance K-73

The implementation prescription is retired. Preserve the behavioral contract of this owner; no cosmetic move, global synonym replacement, or file inventory is required.

### Acceptance K-55

Use one platform definition for build targets, launcher selection, package names, and release assets. Preserve genuinely shared policy contracts; keep algorithm constants with their consumers. Verify installed artifacts against the same target definition.

### Acceptance K-24

Share proven parsing, line counting, and extraction operations without forcing language-specific analyses into one abstraction. Retain accurate finding locations and language semantics. Verify defects and corrected inputs through the consuming analyses.

### Acceptance G-13

Colocate constants with the behavior that uses them. Share a literal contract only
when multiple consumers need it. Presets own shipped tool pins and policy. The package layout
need not match between CLI and plugin.

Remove unrelated central tables and forwarding accessors. Keep algorithm constants
with their algorithm and preserve legitimate shared contracts.

Exercise the behavior that consumes a shared contract. Moving a local constant alone
does not justify a new test.

### Acceptance K-306

Convert file URLs through the platform API, including encoded characters, spaces, Unicode, and native Windows paths. Verify source scripts and installed consumers without treating local POSIX execution as native Windows acceptance.

### Acceptance T-27

A harness that fails early, with a message about the machine or about `init`.

`install` expects exit 0 when every tool of the install is on the `PATH` it was given.
`toolsPath` throws and names the tool it cannot find and the command that installs it. `plant`
fails when the pattern it replaces is absent. `engineInput(overrides)` builds a whole input from a
planted folder, and the four tests use it.

Product acceptance checks the actual init exit and resulting policy. Do not add
a unit test of the harness or mock its assertions.

### Acceptance T-24

Each value of `--runner`, of the hooks choice, and of the CI choice is installed
once. One install starts from a repository that has hooks and mise tasks. One default `init` runs
in every test run.

Exercise six installs in the owning suite: mise with GitHub CI, npm, pnpm,
bun, no runner with GitLab CI, and the default with no flag. Each holds the files written, a
passing `gspot check --staged`, and a commit through the hook. The release test installs
`.gspot/package.json` of every npm preset with each package manager and runs one check there.

### Acceptance T-3

Exercise adoption defects with focused product journeys: preserved hooks and tasks, lossless configuration carryover, local ownership and recovery, readable scopes, fresh clone installation, strictness choices, and generated-file handling. Integrate cases with the behavior they verify, without a separate scenario inventory.

### Acceptance T-28

Every shipped check has one planted defect that makes it fail, with the message of
its own rule.

Execute each planted defect and assert the failing check, its rule or diagnostic,
and the affected location. A check that needs the network or Docker runs in the `manual` job
of CI. No source-text guard or separate test inventory establishes this behavior.

The planted cases for the checks described above.

### Acceptance T-29

A case expects the rule name or the sentence of its finding, and the exit code.

Assert the structured report's check, failing status, affected file, and rule or
diagnostic. Include line and column where the tool supplies them.

The owning command acceptance suites.

### Acceptance T-23

Retained analyses have meaningful invalid and valid cases at their real boundary.
Pure text logic needs no tool or repository; filesystem and process behavior use their actual
boundaries. Do not invent a universal input abstraction solely to make every test look alike.

Test actual consumed inputs, relevant limit boundaries, and valid inputs that must
not match. Share established setup behavior without forcing every analysis through a test adapter.

Exercise each retained analysis with a demonstrated defect and valid code
that must pass. Group related cases by behavior; source filenames do not define test cases.

### Acceptance T-19

The shipped defaults are measured on ordinary code.

For each generated project and representative established multi-package project, run `init --yes` and `check`. Review each recommended finding for a demonstrated defect and false positives before accepting any message or count snapshot (K-301). Include valid API wrappers, framework adapters, and identifiers containing `generate` or `service`. A count alone is not an acceptance criterion. The naming test runs the shipped policy over one short file for each
language and framework, and expects no finding.

### Acceptance K-28

Resolve generated ESLint configuration for source, tests, scripts, configuration, and framework components. Execute defects and corrections under the resolved rules. Preserve meaningful format and selector assertions; a rule-count snapshot does not establish enforcement.

### Acceptance T-36

Test generated behavior with the actual pinned consumer. Preserve exact-byte assertions where serialization, escaping, authored content, or recovery requires them. A snapshot directory for every preset is not required.

### Acceptance T-12

Two ceilings, held in CI: a staged check of ten files in a planted repository of
5,000 files, and `init --yes` on the same repository.

The test writes the 5,000 files from a generator, and runs warm and cold. The staged
check has 5 seconds warm and 30 cold, and `init` has 60.
[05-engines.md](05-engines.md) holds the ceiling of a single check (K-196).

### Acceptance T-22

A test reads what it checks from its one source.

The completion test walks the commander program, and looks for each command and flag
in the bash and the zsh script. The release tests read `version` of
`packages/cli/package.json`.

### Acceptance T-31

The implementation prescription is retired. Preserve the behavioral contract of this owner; no cosmetic move, global synonym replacement, or file inventory is required.

### Acceptance T-20

Keep surviving behavioral regressions with their implementation owner when internals change. Delete tests of removed implementation details; test filenames and commit narratives are not acceptance criteria.

### Acceptance K-310

Package tests publish and install only against their own isolated local registry.
Startup, request and shutdown deadlines are bounded. Failed startup releases owned resources
and preserves useful process output without exposing credentials.

Use a supported isolated listen address/port allocation, observe child startup and
exit, and verify readiness belongs to the child before returning a registry. An occupied port
must not allow publication into the existing service. Always await owned-child termination and
clean temporary storage, including failure before a registry object is returned. Keep retries
limited to documented startup readiness; never retry failed publication into another registry.

Publish and install built packages through the isolated consumer journey.
Fail that journey on unsuccessful startup, publication, installation, or cleanup.
Do not recreate a standalone registry-harness suite.

### Acceptance S-1

One repository check writes every template of every preset into the cache, at both
levels, and runs the parser and the formatter of each kind over the result.

The script renders each preset with its planted policy, then runs `prettier --check`,
`taplo check`, `yamllint`, and `eslint --no-config-lookup` over the files of its kind. It shares
its renders with the snapshot test (T-36).

A template with a broken TOML line fails the check.

### Acceptance S-3

The unit and plugin tests run at the push stage. Coverage measures missing behavioral evidence without an arbitrary percentage quota. Conditional platform and release suites retain explicit prerequisites. The
work of a change follows the [active CI bypass](22-remaining.md#active-ci-bypass).
While it is active, local verification permits continued implementation without a GitHub run.

The check runs `mise run test`. Use `mise run test:coverage` for measurement with shared settings in
`bunfig.toml`. Candidate acceptance explicitly runs integration, acceptance, and opted-in release suites. The docs test fetches the Vale packages in its setup, or fails with the command
that fetches them. The jest preset of [06-enforcement-ledger.md](06-enforcement-ledger.md) reads `bun:test`
through `globalPackage`, and this repository selects it. This repository sets `level = "all"` and `[coverage] strict = true`.

`CONTRIBUTING.md` explains local verification and how to read CI results when CI is enabled.
It must not require a GitHub run while the active bypass applies.

### Acceptance K-61

The implementation prescription is retired. Preserve the behavioral contract of this owner; no cosmetic move, global synonym replacement, or file inventory is required.

Documentation content loading belongs in `docs/src/content/reference.ts`. The executable checks
for built links and release-aligned deployment belong in `docs/scripts/`. Plugin rule metadata
and common option schemas belong in `packages/eslint-plugin/src/rules/` beside their consumers.
