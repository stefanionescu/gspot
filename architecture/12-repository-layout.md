# The gspot Repository

Verification follows the [active CI bypass](22-remaining.md#active-ci-bypass). Local checks
and hooks remain required; GitHub execution and CI-only acceptance are deferred until the
user explicitly re-enables CI.

This document decides the gspot repository: packages, folders, tests, and how gspot lints
itself.

Two published artifacts: the binary (GitHub Releases, one asset per platform) and
`@gspot/eslint-plugin` (npm). Configurations, rules, and prose ship inside the binary. On npm the binary ships the way Biome and ast-grep ship theirs. One package per platform (`@gspot/cli-darwin-arm64`, `@gspot/cli-linux-x64` and the rest) holds the executable, gated by the `os` and `cpu` fields. A thin `gspot` package lists them as `optionalDependencies`, and its `bin` launcher runs the one that installed. Nothing downloads at install time and no
install script runs, so `npx`, `--ignore-scripts`, proxies, and offline mirrors all work.

Central test suites classify tests by their actual dependencies. Shared CLI support separates
command execution, Git setup, tool installation, defect fixtures, and file preservation. Release
publication prepares disposable package directories. Binary independence is exercised from an
isolated build whose checkout and dependencies are removed before the consumer runs.

Revision selection keeps dependency copying and relocation separate from Git-object framing
and reading. Both use the existing confinement boundary; neither changes the selected checkout.

## Ownership

gspot is unreleased and has no users. Change names and configuration directly. Do not maintain
compatibility aliases, Changesets, or release-PR promises. Configurations live at
`packages/cli/configurations/<kind>/<name>`; the data/configuration configuration and its public check prefix are `configs`.

The CLI owns command behavior, planning, execution, and lifecycle operations. Commands translate
arguments and present results; output renders the statuses and findings computed by the runner.
Generators return proposals. Lifecycle owns collisions, recorded ownership, recovery, and removal.
A generated header or directory name does not authorize deletion.

The independent ESLint plugin owns editor enforcement and its public exports. The npm launcher
selects an installed platform artifact. Configurations own shipped policy, pins, templates, styles, and
vocabulary; rule guides own instructions for agents. Documentation renders released definitions
and authored guides. Tests exercise these behaviors and installed consumer journeys.

During cleanup, delete confirmed redundant implementation and its unused callers, imports,
types, fixtures, and tests together. Do not relocate it, retain an alias, or wrap it with a new
abstraction. Repairs belong directly in the surviving owner. Report what was actually removed
and which behavior remains verified; architecture edits alone do not satisfy code cleanup.

Group source by behavior and ownership. Extract a shared module only when it owns shared behavior
or a shared contract. Keep local types, schemas, constants, and functions beside their consumers.
Do not require a file per type, constant, forwarding function, or check. Test locations follow
the behavior they exercise; source/test directory symmetry is not required.

Use the configuration kind `policy` for cross-language checks. It groups configuration
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
Infrastructure must not import all check definitions for a basic operation. Change an owner
with its callers, assets, and build inputs in the same implementation batch. Update all consumers directly when moving or deleting implementations.

Use `testdirs` directly for temporary test directories. Register disposal before creating files
so setup failures are cleaned up. Keep test-only types with tests and exercise harness behavior
through real product journeys.

## CLI ownership boundaries

The executable entry delegates to Commander composition. Command adapters parse flags and
present command results. Execution planning, scheduling, cancellation, and diagnostic parsing
remain separate from check implementations. Policy owns validation and mutation proposals. The `configurations` owner provides shipped check
definitions and selection. Output owns terminal and report formats.
Naming and structure analyses retain their language-specific semantics beside their consumers.

Next.js source checks and execution live in `checks/nextjs/source.ts` and `checks/nextjs/build.ts`.
Jest execution and its shared validation schema live in `checks/jest/run.ts` and
`checks/jest/schema.ts`. Hook names and hook metadata belong to `repository/hooks.ts`;
dependency directory names belong to repository file classification. Dependency checks share
lockfile formats. Other check constants stay with their consumers.

Agent metadata and generated instructions belong to `agents/metadata.ts` and
`agents/instructions.ts`. Shipped assets remain under `packages/cli/configurations/`; source definitions and selection belong
to `packages/cli/src/configurations/`. Homepage components live under `docs/src/components/home/`; Starlight
overrides live under `docs/src/components/starlight/`. Artwork is grouped by home, identity, README, badges,
and diagrams under `docs/public/brand/`.

Generation proposes configuration content. Lifecycle applies those proposals through recorded
ownership, preserves local edits, and restores recovery copies. Apply registration, previews, and command orchestration belong to commands. Shared publication stays in lifecycle. Tool acquisition owns installation, version probes, installer hints,
package-manager connection settings, locked npm and Python projects, and installed-file
publication. It uses filesystem confinement and lifecycle ownership for repository writes. Hook adoption
and restoration remain lifecycle operations. Vale checking belongs to checks, style rendering to generation, and package installation to tools.

Shared SQL parsing and Tree-sitter loading belong to parsers. Grammar names belong to the asset boundary;
language-specific identifier extraction and analysis remain in naming and checks. Agent-guide
assembly and validation are distinct from executable checks. Their internal owner name does not
change the public rules configuration or the embedded rules asset paths. Repository discovery
owns file classification. The suppression check owns its directive constant.

Platform provides process execution, environment access, paths, and embedded assets. The launcher target manifest remains the single source for release platforms. Tool probes own shared tool observations; doctor consumes those observations in its report.

The CLI binary build entry is `packages/cli/build/command.ts`; input preparation, notice assembly, and
publication live under `packages/cli/build/`. The binary builder uses Bun's build API
and passes dependency metadata directly to notice generation. It preserves the ignored build
directory, embedded evaluator asset key, EditorConfig WASM integration, and platform signing.
Swift parser preparation downloads a checksum-pinned upstream release into ignored build output.
Notice assembly fetches missing supplemental licenses and Bun and Swift notices from pinned
sources. Every downloaded or cached input must match its recorded SHA-256. Other parser
assets resolve from locked packages. Installed binaries embed the parser and perform no download.
The asset boundary declares every supported parser and rejects undeclared filenames.

These boundaries use the entry/command separation and development-script ownership inspected
in Nx revision `59b35fba73` and Turborepo revision `1dead3cc9d`. They retain Bun, mise, and the
existing packages without introducing a task framework or compatibility modules.

Types and runtime validators live with their feature owners. Filesystem and process operations
own their boundary contracts. Policy, manifest, profile, journal, and report schemas sit with their
features. Evaluation request and response schemas form a shared protocol independent of the
evaluators. Command and check-output validation remain shared boundaries used by both policy
and configuration manifests. Emitter shapes belong to the corresponding emitters. Tool command
execution serves checking, installation, and detection without importing the check runner.

Check input contracts belong to the check feature, independently of the runtime dispatcher.
Parsers accept source observations and disposable resources without importing check inputs.
Repository discovery receives journal-owned runtime paths from command composition. The source
reader owns the byte observations used by parsers, suppression readers, and result caching.

Foreign configuration readers belong to adoption. Lifecycle retires explicitly selected files
against their observed bytes and permissions. Initialization owns its policy proposal and Xcode
scheme discovery. Writing commands prepare a policy mutation once, then publish that proposal
under the lifecycle lock before applying generated configuration.

Doctor-specific diagnosis and reporting belong to `commands/doctor/`. Initialization planning,
questions, and selection belong to `commands/init/`. Shared coverage analysis belongs to execution,
and its text rendering belongs to output. Direct imports include type and dynamic dependencies.

## Native configuration and packaging

The CLI and independently usable ESLint plugin remain separate workspace packages.
The plugin exports `configs.recommended`, `configs.all`, and its existing rules through
[ESLint's conventional plugin shape](https://eslint.org/docs/latest/extend/plugins).
Local constants and types stay with consumers unless a shared contract justifies extraction.

Keep all authored repository tasks, including source-checkout overrides and CI orchestration, in `.mise/conf.d/repo.toml` and generated integration in
`.mise/conf.d/gspot-tools.toml`, using the
[native mise configuration location](https://mise.jdx.dev/configuration.html).
The authored configuration adds `.mise/gspot/` to PATH so hooks and tasks run repository
source. Root `mise.toml` owns development runtimes and checkout settings. Keep each identical tool pin in one owner. Duplicate-pin
detection parses only `[tools]` with smol-toml, so task and environment keys cannot become pins.

Repository choices remain in TOML. The documentation schema endpoint generates
[Taplo editor assistance](https://taplo.tamasfe.dev/configuration/using-schemas.html) directly from
the runtime policy schema. The repository editor directive uses the public schema URL.

Use [Bun's native test configuration](https://bun.sh/docs/test/configuration) in `tests/bunfig.toml`.
Run test tasks from `tests/` with `--timeout 60000`; per-case deadlines remain explicit.
The root TypeScript project includes every test under its strict workspace settings.
All tests belong under the root `tests/`: unit CLI and plugin suites, integration CLI, docs,
and repository suites, tool integration under `integration/tools`, source journeys under
`acceptance/source`, and release consumers under `acceptance/release`. Support owns process, registry, and fixture lifetime; types stay with those owners.
`mise run test` targets deterministic unit and integration execution using documented development
prerequisites and installed workspace dependencies. Native tools, downloads, source acceptance,
and installed release consumers require separate explicit tasks. The release task runs directly
after its artifact prerequisites are built; no environment opt-in hides its tests. Do not add Vitest, Jest, or a custom coordinator for this
repository. Framework configurations can still use their own test tools.

Root configuration has explicit owners. `gspot.toml`, `mise.toml`, `package.json`,
`bunfig.toml`, `tsconfig.json`, and the authored portions of `.gitignore` and `.gitattributes`
are repository inputs. Bun owns `bun.lock`. Policy generation owns the native-discovery
files `.commitlintrc.json`, `.gitleaks.toml`, `.markdownlint-cli2.jsonc`, `.semgrepignore`,
`.shellcheckrc`, `.taplo.toml`, `.yamllint.yml`, `osv-scanner.toml`, and `typos.toml`.
Retained EditorConfig, Prettier, and ESLint entry points continue serving editors; ownership
records, rather than generated-looking headers, govern replacement. Agent instructions and
Git attributes retain their authored content outside managed blocks. The policy schema feeds the documentation endpoint at `/schema/gspot.schema.json`.
The documentation build validates its emitted JSON against the runtime schema. Native filenames remain stable.

Generated tool configuration and bundled tool rules live under `.gspot/config/`, with scope paths
mirrored below it. Agent guides remain under `.gspot/rules/`. Ownership journals, writer locks,
and recovery backups live under `.gspot/state/`. Reports use `.gspot/reports/`; disposable caches
use `.gspot/cache/`. Private dependency manifests, lockfiles, installed packages, and the Python
environment remain at `.gspot/`'s root for native dependency resolution. Ignore rules use the same
path definitions as storage. Only installed dependencies, downloaded styles, local state, reports,
and caches are ignored.

Hooks inside the configured repository share its ownership journal. Git-internal hooks use state
under the resolved Git directory. External destinations keep their state and writer lock inside
the hook destination. Only the current journal establishes ownership. Obsolete journals and
recovery layouts remain unowned data and are not converted or deleted.

The root `LICENSE.md` is the authored project license. Builds copy it into distribution output,
including `packages/eslint-plugin/dist/LICENSE.md`. CLI notices describe actual bundled inputs,
embedded grammars, and Bun; the notice script owns pinned supplemental sources, checksums, and attribution.
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
| Render a configuration template                       | `eta`                                                                  | every `*.tmpl` under `packages/cli/configurations/`; the generated-file header is prepended by gspot                                                       |
| Command parsing, `--help`, unknown-command suggestion | commander                                                              | the public command definition feeds the reference content loader                                                                                           |
| The questions in `init`                               | `@clack/prompts`                                                       | imported by those two commands only; never under `--yes`, `CI` or no terminal                                                                              |
| Color                                                 | picocolors                                                             | off under `NO_COLOR`, `CI`, `--no-color` or no terminal                                                                                                    |
| Schemas for `gspot.toml`, manifests, the report       | zod                                                                    | error messages rewritten into plain English before printing                                                                                                |
| Read TOML                                             | smol-toml                                                              |                                                                                                                                                            |
| Write `gspot.toml` keeping comments and order         | `@decimalturn/toml-patch`                                              | TOML 1.1; `patch()` and `TomlDocument`; a comment travels with the entry it belongs to when the entry moves or goes                                        |
| Detect the package manager                            | `nypm`                                                                 | `detectPackageManager` reads repository metadata; installation remains owned by the runner.                                                                |
| `.gitignore` semantics without Git                    | `ignore`, pinned in the CLI package                                    | Native directory traversal applies nested exclusions, negations, pruning, and symlink boundaries while preserving newline-containing paths.                |
| Name a language gspot has no configuration for        | `linguist-languages`                                                   | GitHub Linguist's extension data, offline                                                                                                                  |
| SARIF for CI                                          | `node-sarif-builder`                                                   | the `.gspot/reports/report.sarif` rendering                                                                                                                |
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

Custom code owns the rules and decisions specific to gspot: configuration selection and precedence,
coverage policy, finding semantics, managed ownership, and recovery decisions. Use the libraries
above for parsing, matching, serialization, and execution where their contracts fit. Do not claim
that no library exists without evaluating candidates. Do not require one library to implement
an entire gspot workflow before reusing the part it already solves.

## Build

- `bun build --compile --target=bun-<os>-<arch>` per platform, with the grammar WASM files,
  configurations, rules and prose embedded through the file embedding of Bun. Output: `gspot-darwin-arm64`,
  `gspot-darwin-x64`, `gspot-linux-x64`, `gspot-linux-arm64`, `gspot-windows-x64.exe`, plus Linux x64 and ARM64 musl targets from the same platform definition.
- The release tag must match the package version source; generated file headers use that version.
- The npm release publishes one platform package per target plus the launcher package, all at one version.
- The launcher resolves the installed platform package by `process.platform` and `process.arch`, and fails with the install hint when none is present.
- `@gspot/eslint-plugin` builds with `bun build` to ESM and CommonJS, versioned with the binary.
- The plugin exports `configs.recommended` and `configs.all` for standalone use. Both enable
  trivial-function and trivial-file rules by default, with the shipped options.
- The plugin matches paths with `picomatch`, the matcher the binary uses, so one pattern in
  `gspot.toml` means one thing.

## Release

The version has one source: `version` in `packages/cli/package.json`. The build passes it
to the binary through the package manifest import, the plugin exposes it in `meta.version`, and `publish.ts`
reads it for every npm manifest. The release workflow fails when the tag differs from it. The
workflow selects the explicit `test:release` task against the binaries it built,
before it publishes. One more test starts the compiled binary of the runner's platform in a
planted repository and runs `init --yes` and `check`.

Native tools own release operations. gspot retains artifact staging and bundled-notice assembly:

| Step                   | Tool                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package versions       | Edit package versions directly. Keep release packaging without release-PR machinery.                                                                     |
| Build                  | a GitHub Actions matrix runs `bun build --compile` per target; the report of the build is the tool table of the release note                             |
| Provenance             | `actions/attest` signs every binary and the npm packages carry `--provenance` from trusted publishing, so `doctor` and a person can verify what they run |
| GitHub release         | `gh release create` uploads the binaries, checksums, license, and bundled notices                                                                        |
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
contract and cannot replace it. No arbitrary percentage floor applies.

Delete redundant cases when they prove the same behavior
through the same boundary. A case at another shipped surface, level, parser, platform, or recovery
boundary can provide distinct evidence; do not delete it merely because its setup looks similar.

Before removing a weak test that is the only coverage for a retained requirement, strengthen or
replace that coverage at the owning behavior. Keep meaningful byte, permission, escaping,
serialization, and restoration assertions. Remove source-token searches, fixed inventory totals,
assertions of forwarding, duplicated snapshots, and configuration substring checks when executed
behavior already covers their purpose. Do not invent a new test-audit registry or test-count target.
Record a concise reason for deletions with the owning remaining-work group and run its affected
suite. A reduced test count is neither a success criterion nor evidence of lost coverage by itself.

Platform prerequisites remain explicit. Invoke every required candidate suite through its task;
missing required tools fail instead of silently skipping tests. Source acceptance and installed
release consumers run sequentially because they exercise shared build and parser assets. The actionable cleanup is in
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
[Documentation](21-documentation.md) owns the content-loader contract, the plain text site
design, and release-aligned deployment and rollback. Guide length
follows the task; no page quota, separate fixture system, or universal prose parser is required.

Documentation content loading belongs in `docs/src/content/reference/loader.ts`. The executable checks
for built links and release-aligned deployment belong in `docs/scripts/`. Plugin rule metadata
and common option schemas belong in `packages/eslint-plugin/src/rules/` beside their consumers.

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

### Acceptance K-55

Use one platform definition for build targets, launcher selection, package names, and release assets. Preserve genuinely shared policy contracts; keep algorithm constants with their consumers. Verify installed artifacts against the same target definition.

### Acceptance K-24

Share proven parsing, line counting, and extraction operations without forcing language-specific analyses into one abstraction. Retain accurate finding locations and language semantics. Verify defects and corrected inputs through the consuming analyses.

### Acceptance G-13

Colocate constants with the behavior that uses them. Share a literal contract only
when multiple consumers need it. Configurations own shipped tool pins and policy. The package layout
need not match between CLI and plugin.

Remove unrelated central tables and forwarding accessors. Keep algorithm constants
with their algorithm and preserve legitimate shared contracts.

Exercise the behavior that consumes a shared contract. Moving a local constant alone
does not justify a new test.

### Acceptance K-306

Convert file URLs through the platform API, including encoded characters, spaces, Unicode, and native Windows paths. Verify source scripts and installed consumers without treating local POSIX execution as native Windows acceptance.

### Acceptance T-27

Product journeys fail at the actual failed prerequisite, installation, or initialization step.
Report the missing tool and installation action. A fixture transformation must fail if its
expected input is absent; setup errors cannot become passing product evidence.

Check the actual init exit and resulting policy. Keep setup and cleanup with the owning suite.
Do not require named harness helpers, a case count, a harness-only test suite, or mocked product
assertions.

### Acceptance T-24

Exercise supported runner, hook, and CI integrations through representative installed journeys.
Include default initialization, existing hooks and tasks, mise with GitHub CI, npm, pnpm, Bun,
and no runner with GitLab CI. Cover other supported choices where they have distinct behavior.
Verify emitted integration, a real staged check, and hook invocation in the owning cases.

Private tool installation uses each supported package manager and executes installed checks.
Share a representative dependency installation where it proves the same boundary; do not repeat
an expensive install for every configuration solely to satisfy a matrix count. Native configuration
behavior still needs defect and correction evidence at both levels.

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

For each generated project and representative established multi-package project, run `init --yes` and `check`. Review each recommended finding against its defect or mandatory structural contract before
accepting message snapshots (K-301). Required API suppressions must be narrow and reasoned;
ordinary callbacks and framework names are not automatic exemptions. Include valid API wrappers, framework adapters, and identifiers containing `generate` or `service`. A count alone is not an acceptance criterion. The naming test runs the shipped policy over one short file for each
language and framework, and expects no finding.

### Acceptance K-28

Resolve generated ESLint configuration for source, tests, scripts, configuration, and framework components. Execute defects and corrections under the resolved rules. Preserve meaningful format and selector assertions; a rule-count snapshot does not establish enforcement.

### Acceptance T-36

Test generated behavior with the actual pinned consumer. Preserve exact-byte assertions where serialization, escaping, authored content, or recovery requires them. A snapshot directory for every configuration is not required.

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

One repository check writes every template of every configuration into the cache, at both
levels, and runs the parser and the formatter of each kind over the result.

Render each configuration with its planted policy, then validate the output with its pinned consumer,
including Prettier, Taplo, yamllint, and ESLint where applicable. Retain exact serialization
assertions only for contractual bytes. T-36 requires generated behavior, not a snapshot inventory.

A template with a broken TOML line fails the check.

### Acceptance S-3

The deterministic unit, plugin, and integration tests run at the push stage. Coverage measures in-process source execution without an arbitrary percentage quota.
Subprocess and native execution provide separate behavioral evidence. Native and release suites
retain explicit prerequisites. The
work of a change follows the [active CI bypass](22-remaining.md#active-ci-bypass).
While it is active, local verification permits continued implementation without a GitHub run.

The check runs `mise run test`. Use `mise run test:coverage` for measurement. Both tasks run
from `tests/`, load `tests/bunfig.toml`, and pass `--timeout 60000` to Bun. Focused tasks are
`test:unit` and `test:integration`. Candidate acceptance also runs `test:tools`,
`test:acceptance`, and `test:release`; build release prerequisites first and run source acceptance
before installed consumers. Native tools and downloads do not belong in routine documentation
tests. The Jest configuration configures ESLint for `bun:test` through `globalPackage`; the repository
replaces native Jest coverage execution with its Bun tasks. Preserve `level = "all"` and
`[coverage] strict = true`, which govern product checks rather than a test coverage percentage.

`CONTRIBUTING.md` explains local verification and how to read CI results when CI is enabled.
It must not require a GitHub run while the active bypass applies.
