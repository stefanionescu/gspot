# Repository Lint Cleanup

This record tracks the repository-wide cleanup on `fix/root-cause-lint-cleanup`.
The results below distinguish local verification from external acceptance.
No failed or unavailable check counts as passing.

## Baseline

Work resumed on `fix/root-cause-lint-cleanup` at revision
`d6403a02d83f3b609f7df876281d8e1d156a434b`, preserving the inherited 851-file change set.
The starting index contained only the rename from `statements.ts` to
`packages/eslint-plugin/src/syntax.ts`. Starting patches and index hashes are recorded under
`/tmp/gspot-lint-cleanup/resumption/`. The policy uses `level = "all"`.

The user committed the implementation as `3c4d0ba5e6ce1fc7947fcef270ddeecd95294af8`
during verification. Its files matched the candidate at that checkpoint. With explicit user approval, the normal
hooks reworded that commit to `fix(root): Complete repository cleanup`, producing
`bd7c65943be772c769fcf76dfe04b27c233dcb72`. Its tree, author, author date, and parents are
unchanged. The approved force-with-lease update pushed the task branch with normal hooks.

The empty index and its hash were recorded
after the user commit. Later verification preserves this new checkpoint. The user authorized merging the completed branch into `main` after verification.

Implementation files pass the latest direct scan. Test cleanup preserves independent
failure and correction journeys, exact process arguments, ownership bytes, and native
execution. No rule threshold or blanket exemption changed.

The preceding deterministic run passes 2,388 tests with 9,744 assertions across 273 files.
Coverage is 83.39% of functions and 84.78% of lines. Types pass. After the native platform
correction, the affected guide rerun passes 19 tests with 93 assertions, and types pass again.

The preceding full native suite passes 417 tests with 2,793 assertions across 65 files in
524.82 seconds. Full source acceptance passes 557 tests with 4,364 assertions across
105 files in 3,815.84 seconds. Installed-release acceptance passes 171 tests with 394 assertions across nine files in
243.05 seconds. Both suites use the same CLI and plugin. CI remains open.

## Current implementation evidence

The first remote run verifies documentation but stops Linux installation at the virtual
environment's `lib64` directory link. Installation publication now resolves internal directory
aliases into owned files. The filesystem owner still rejects external links and cycles before
publication. Nested aliases preserve file contents without introducing linked destination parents.

The first version of that repair checked a link with `lstat` before opening the same path, and
CodeQL reported `js/file-system-race`. The reader now asks `readlink` first; a regular file
answers `EINVAL`, so one call decides and CodeQL passes. All 65 ownership tests pass with 405
assertions; 33 native Python installation and isolation tests pass with 215 assertions.

Coverage passes 2,391 tests with 9,763 assertions, covering 83.39% of
functions and 84.85% of lines. Types and focused lint pass. All seven binaries rebuild,
and affected source acceptance passes 25 tests with 178 assertions. Installed-release
acceptance passes all 171 tests with 394 assertions. The performance fixture passes at
8.507 seconds for initialization, 4.480 seconds cold, and 4.161 seconds warm.

The macOS job exposed an undeclared pnpm prerequisite. The authored mise configuration
pins pnpm 9.9.0 and Yarn 1.22.22, matching the versions used in accepted local journeys.
Both install through mise; all 24 license-lock tests pass with 51 assertions.

The documentation review covers all 20 authored guides and the owners of generated references.
Page and sidebar names use direct task names. Repeated explanations are removed; setup,
private registries, existing configuration, hooks, CI reports, and coverage prerequisites have
explicit instructions. Conditional rule guides list their selection conditions in the reference. Framework rule
exclusions retain their selectors, setting conditions, and reasons in the same reference.

The homepage demonstrates one real Python and Bash repository. Its configuration, two native
findings, and corrected result share one example definition with the quickstart. A full native
check proves both findings and both corrections; runtime assertions reject invalid JSON and
accept archive paths containing spaces.

Sixteen page renders cover four widths and both themes.
Eight control scenarios verify copy alignment, the left menu, and theme placement and focus.
Twelve keyboard-selected demonstration states preserve focus, selection, and viewport width.
The rendered Python example retains four-space indentation at every tested width.

This example exposed deptry scanning private installed tools outside Git repositories. The
Python check excludes `.gspot` while retaining authored native exclusions. Its regression keeps
an undeclared application import failing, accepts the correction, and verifies configuration
changes invalidate the Git-backed cache.

The affected native run passes 35 tests and 262 assertions. The Python source file passes
11 tests and 72 assertions, including the new regression. The broader Python and lifecycle source rerun passes 32 tests and 186 assertions. The
installed-release rerun passes 171 tests and 394 assertions. Earlier full source and release results below describe the preceding candidate.

The commitlint pointer used a retired configuration path. Direct native execution reproduced
the missing-module failure. Its manifest now uses the generated target placeholder, and apply
regenerates the pointer. Native commitlint rejects an invalid message and accepts the correction.
The four commit acceptance tests pass with 51 assertions; 220 generation tests pass with
1,304 assertions. Other manifest pointers already derive their target or copy their generated content.

All seven CLI targets rebuild. The four affected installed binary tests pass with 21 assertions.
A separate compiled-CLI journey generates the pointer and verifies both native message outcomes.

The full check exposed blocked process output during isolated dependency copying. A CPU
profile traced the delay to synchronous workspace copies and cleanup. Git read the same
objects successfully on its own but exceeded its unchanged timeout during the full run.
Workspace copies and concurrent cleanup now use asynchronous filesystem operations.
Link repair, permissions, bounds, and working-tree preservation retain their existing owners.
A native-output regression fails with the synchronous implementation and passes after the repair.

All 277 execution tests pass with 1,172 assertions, and TypeScript passes.
The coverage rerun passes 2,389 tests with 9,752 assertions. Function coverage remains
83.39%, and line coverage remains 84.78%.

The uncached commit-and-push check passes 141 checks in 238.713 seconds. Its 12 ownership
skips name their replacement checks. All seven manual checks pass without skips in
214.509 seconds, including Bun coverage, CodeQL, and the selected Semgrep packs. Doctor exits 0.

The native rerun passes 419 tests with 2,816 assertions across 66 files. All seven binaries,
the plugin, and eight CLI package dry runs pass. Affected source acceptance passes 54 tests
with 331 assertions across ten files. Installed-release acceptance passes all 171 tests
with 394 assertions across nine files.

The staged gate exposed an obsolete repository plugin registration. It redirected checks to
untracked workspace build output that is absent from immutable Git snapshots. The source
installer already supplies and verifies the same plugin through the private installation.
Removing the registration and regenerating ESLint configuration preserves the effective
configuration for CLI, test, and documentation files. Repository policy owns this repair.

The full uncached normal check passes again after that deletion. A disposable staged
violation still reports `gspot/no-trivial-functions`; the corrected index passes, and the
real index stays unchanged. Repeated apply writes nothing, preview has no drift, and
doctor exits 0 against the resulting policy.

The pre-push run exposed report tests inheriting the parent hook context. The existing test
preload clears that context in the test process. Hook-specific cases still set and verify
their own context, and the parent Git hook remains enabled. All 25 focused report and
coverage tests pass with 77 assertions when launched from a pre-push environment.
The full coverage run in that environment passes 2,389 tests with 9,752 assertions.

Repository CI downloads normal and manual reports separately. Each Static Analysis Results
Interchange Format (SARIF) upload uses a distinct category. This follows the
[GitHub requirement for report identity](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file).

YAML, Actions, and workflow-security checks pass. The native CI regression passes one test
with 17 assertions. This workflow-only correction leaves CLI, plugin, and acceptance inputs
unchanged. Remote upload verification remains part of the exact-commit CI gate.

The source-checkout install task builds and publishes the workspace plugin only into the
existing isolated registry, runs immutable `gspot install`, and compares installed ESM,
CommonJS, and declaration bytes against the build. The package metadata uses canonical repository URLs. The generated lock and isolated-registry
installation are refreshed for that tarball; installed package metadata and all three build files
match the workspace candidate. The lock contains no temporary registry address. Source acceptance shares this registry lifecycle, including cancellation and
cleanup. CI supplies its read-only GitHub token for normal acquisitions and runs release
consumer and documentation tests in the full workflow.

The folder check counts Astro components and schemas as siblings while retaining lone-code
and declaration-only violations. The pre-repair CLI and plugin cases fail as expected; the
corrected cases pass. The heading rule accepts the ordinary word `edge` beside Microsoft
Edge when a project vocabulary is active. Its native regression rejects a neighboring
incorrectly capitalized heading. No numeric threshold or blanket exemption changes.

Guide corrections distinguish required safety from all-only conventions. They remove
application-specific Express helpers and dependencies. They preserve declared router and runtime
contracts. NestJS response/authorization and Workers binding guidance are corrected. Generated
recommended/all comparisons cover TypeScript, CSS, Swift, HTML, Python, Express, and NestJS.
The source inventory's accepted level assignments remain unchanged.

The release task owns one registry lifecycle for all installed-consumer test files. Each consumer
remains disposable. Publication refusal and both termination signals remove the owned storage;
16 focused tests pass with 230 assertions. The source-registry task shares the same cleanup
operation. Publication is cancellable and teardown preserves independent execution failures.
The release regression that refuses a missing target retains its separate registry because it
must prove that no package was uploaded.

The build command's `--all` option derives targets from the existing manifest. It builds all seven
binaries, byte-identical to the explicit-target build before subsequent guide-only edits.
CI uses that option before installed release acceptance. Linux owns Docker-backed database
journeys; the exact test-file exclusion on the other hosts does not establish native database
execution there. The Linux result remains required.

The final documentation tests pass 15 cases with 1,711 assertions. The site build
produces 324 pages and passes link and fragment validation. The served schema matches
the policy schema exactly. Current README artwork passes
320-, 390-, 768-, and 1200-pixel render checks in both themes. Final light and dark 320-pixel
screenshots show the original blue/orange mark aligned with the wordmark.

- Long TOML table arrays expand into array-of-table blocks through the shared policy writer.
  Initialization and policy edits preserve parsed values, comments, sibling ownership,
  scoped tables, and repeated writes. The focused run passes 25 tests and 80 assertions.
- Manifest-owned ESLint exclusions preserve Next.js conditions, framework selectors,
  nested scopes, and React Native DOM exclusions. Explicit policy overrides remain last.
- Ruff convention adoption feeds generated Ruff settings and pydoclint. Explicit pydoclint
  style wins. Native Google, NumPy, explicit override, and native-default journeys pass
  four cases with 20 assertions. Nested inheritance and child override also pass focused adoption tests.
- Conditional Bun, Tailwind, Playwright, SwiftUI, and UIKit guides use the existing detection owner.
  Markdown section filtering understands headings and code fences. The focused guide and
  Python unit run passes 17 tests and 48 assertions. The section audit and native example gate are recorded below.
- Initialization without a generated workflow prints installation, check, and report-artifact
  guidance. Bitbucket detection and retained-provider cases have focused test coverage.
- Unsupported executable Python path files are refused before snapshot execution. Supported
  path declarations and Hatchling/setuptools loaders retain relocation. Ten native snapshot
  cases pass with 186 assertions. They cover index and committed revisions.
- Native plist tests reproduce mixed malformed/missing and malformed/inaccessible inputs.
  Both plist checks reject those execution failures while retaining syntax findings and
  corrected success. Two native tests pass.
- A push build with tracked `dist` preserves its bytes and clean Git status. The combined
  site/Python unit run passes 14 tests and 47 assertions.

- The installed JavaScript, CommonJS, and declaration files match the built plugin candidate
  after an isolated-registry installation. The complete deterministic suite includes plugin rules.
- SQL and Bash refactors pass 35 native defect/correction scenarios with 230 assertions.
  Process-error boundaries pass 51 focused tests, including the mixed plist scenarios.
- Policy, schema, and lifecycle cleanup has focused passing runs. Final deterministic
  coverage includes the source-registry repair.

These focused results establish the repaired scenarios, not completion of the final gate.

All ten failures from the first source acceptance diagnostic pass their focused corrections.
The six NestJS cases remove an obsolete controller suppression and retain exact finding positions.
Three static-site cases use the actual HTML line, normalized link path, and declared Node types.
The quoted-table case now reaches semantic policy rejection through valid TOML, asserts exit 1,
and proves that the selected recommended-level check also runs before and after correction.
The complete source diagnostic finished within its corrected process deadline; its acquisition rerun is recorded below.

The source suite reached its 30-minute process deadline before discovering every file. The
harness now permits 90 minutes for the complete suite and reports an explicit timeout. CI's
full-job budget is 180 minutes for its sequential lanes. Individual test deadlines and the
60-second initialization, 30-second cold, and five-second warm limits are unchanged.
The timeout/cleanup regression passes with publication refusal and path validation:
eight tests and 17 assertions.

Full push and manual diagnostics pass. Push executes the Bun test replacement for four
owned Jest skips. Manual executes external links, registry Semgrep, CodeQL, and Bun coverage
with no skips. Later source and guide edits require affected checks again before committing.

The guide lint detects repository-specific paths even inside inline code. A regression proves
both rejection and corrected acceptance. Named ESLint rules are checked against the same level
inventory used by generated enforcement, including fenced-code and heading boundaries. These
checks do not establish full semantic agreement with every native linter. Agent and command-runner
regressions pass 28 tests and 146 assertions; workspace and documentation types pass.

The Good-example extractor retains original code, source positions, and section levels. It
automatically discovers all 50 marked blocks: 25 Bash, 14 Python, two Docker, one Swift,
one TypeScript, one TOML, five text, and one diff. Native generation tests run the code
against both generated levels; explanatory text and diffs are not executed. TOML is parsed.
Each native language has a neighboring real violation and its correction.

The push-stage
`guides/lint` check invokes the existing native test owners through `mise run guides:lint`.
The current gate passes 33 tests and 181 assertions. Later guide edits require a rerun.

Python examples also pass the generated basedpyright configuration, pydoclint command,
and all 11 structural analyses. Required FastAPI callbacks and the protocol signature carry
four line-specific, reasoned suppressions. An unnecessary neighboring wrapper still fails.
No threshold or enforcement rule was relaxed. Shell cleanup examples use owned EXIT traps
rather than altering their caller's RETURN trap.

FastAPI guide applications execute through the actual framework client. Two tests verify
request validation, public responses, upload limits, JSON Lines, and server-sent events.
Project locks are generated in disposable fixtures and execution uses `uv run --locked`.
No application dependency is added to the repository tool installation.

Naming examples use explicit name comparisons instead of undefined inputs, empty classes,
nonexistent APIs, and forwarding functions. Stored Boolean names, external wire names, and
persistence verbs agree with their owners. TypeScript, Swift, and Python examples include
their imports and implementations. The level audit separated Python import conventions,
Bash entrypoint and documentation conventions, and TypeScript non-null assertion policy
from requirements that apply at both levels.

The section audit separates naming, architecture, documentation coverage, declaration order,
and API conventions from correctness and supported runtime contracts. Generation tests verify
that the conventions disappear at recommended while neighboring correctness sections remain.
Nineteen guide selection and lint tests pass with 93 assertions. The full native candidate
run also passes the executable guide owners. A subsequent source change requires affected
evidence to run again.

Source and installed-release acceptance pass through normal authenticated acquisition,
including reruns for subsequent repairs. The contractual performance case passes with 5,000 files and ten staged inputs: initialization
8.924 seconds, cold check 4.513 seconds, and warm check 4.124 seconds. This measurement
follows source and installed-release acceptance on the unchanged CLI and plugin. The host
is an Apple M4 Max with 64 GiB of memory, macOS 26.5.1, and Bun 1.4.2.

## Website and README

The mobile menu sits on the left with a 44-pixel target and a 22-pixel icon. Search remains
on the right. The theme control uses a compact icon button in the footer or open sidebar.
Its menu opens beside the trigger, supports Escape, and restores focus.

The footer groups
its navigation and presents the license as a link. Copy controls have a 44-pixel target,
32-pixel painted button, and centered 16-pixel icon. Long commands and the client example
wrap within narrow screens. Hero spacing, section dividers, and secondary actions are consistent.
The hero includes an interactive defect/correction example. Design research covered Biome,
Linear, Astro, and Vite.

The README banner centers the wordmark and original blue/orange artwork in both themes.
Each embedded image uses 560 pixels for its 280-pixel display slot. Resampling reduces each
complete SVG to 365 KB while preserving its placement and colors. The light variant is the
fallback. The local GitHub-style preview passes image-loading and overflow checks at
320, 390, 768, and 1200 pixels in both themes.

The final site build passes 16 homepage
and overview renders at those widths and themes. Eight rendered control scenarios verify
copy centering, the left mobile menu, theme-menu placement, selection, and Escape focus.

Native Chrome verification passes at 200% zoom on the homepage and documentation. Navigation
remains available with no horizontal clipping. The browser's reduced-motion setting reports
`prefers-reduced-motion: reduce`; all nine homepage control transitions compute to zero seconds.
Keyboard and both-theme checks pass. Browser preferences are restored after verification.
These results describe local rendering, not a published site.

## Tool restoration and fixture cleanup

All 27 conflicting installed files matched their recorded hashes and modes before restoration.
The files were moved aside, the lock was regenerated through the CLI, and installation completed
normally. The installed plugin bytes match the workspace build. Temporary recovery copies are
removed, and the generated lock contains no temporary registry address.

Supabase test project IDs now fit within the native CLI's 40-character limit. Teardown runs
on startup failure and ordinary disposal. Truncated IDs left 28 Gspot databases
and networks behind; their ownership labels were inspected and each was stopped through the
native command. Both database tests pass. Unrelated project resources were preserved.

## Exception audit

All 15 authored spelling exclusions are removed. Seven repository-wide spelling allowances
are replaced with native filename rules. A duplicate case variant is also removed after a native probe. The four remaining global entries name external
packages or the Apple device-identifier API. The policy records every retained filename and
its exact excepted words, identifiers, or pattern under `tools.typos.extra.type`.

The filename rules preserve deliberate defect fixtures, upstream rule labels, and quoted
descriptions. Changing these inputs invalidates the tests or misrepresents the external contract.
The substitution dictionary excludes only mapping keys. Its replacement text remains checked.
The manifest exception matches only the complete published defect-example sentence.

Native Typos file types match basenames, not directory paths. Same-basename test files therefore
share their small token allowance. A directory-qualified native probe fails to match.
Replacing the native parser is inappropriate for this constraint. Each entry can be removed
when its fixture or external contract disappears. All 21 native exception probes preserve a
nearby real misspelling at its exact location.

A neighboring filename retains all three defects.

Four Windows launcher constants retain the PE32 and PE32+ format names, including digits
and the otherwise banned term `PLUS`.
The [Microsoft PE contract](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
defines their magic values and directory offsets. The allowance names one file and four
constants. Other identifiers in the same file remain checked. Remove it when those formats leave
launcher support.

Internal section, payload, and checksum names are repaired without exceptions.
The SHA-256 algorithm name and generated checksum output remain unchanged.
The adjacent unlisted format constant still reports digits in the effective-policy probe.

Native filesystem overloads retain `withFileTypes` in two exact files. Generated workflow
test types retain `with` and `when` as properties in one exact file. These are Node,
GitHub Actions, and GitLab CI keys. Internal variables retain naming enforcement.
Remove an allowance when its native contract leaves the implementation.

Two exact import lines retain folder and project boundary exceptions. The npm launcher owns
the release target JSON consumed by CLI compilation and CI workflow generation. Moving or
duplicating the inventory separates it from a published consumer. Tests use named workspace
aliases for the same inventory and the root package manifest. Remove the exceptions if this
ownership or either CLI consumer changes. Native ESLint probes accept the two documented
imports and report both boundary rules for an adjacent unrelated import.

Standalone publishing tests copy the release scripts and npm inventory without the workspace
TypeScript configuration. Those consumers require the relative import. The root alias alone
does not provide a standalone runtime contract.

The npm package-table validation domain retains literal lockfile versions `2` and `3`.
A single-line numeric-literal exception replaces two redundant version constants. The [npm lockfile contract](https://docs.npmjs.com/files/package-lock.json/)
defines these versions. Remove the exception when the supported package-table formats change
or the numeric rule recognizes such validation domains. Other numeric expressions remain checked.

Architecture documents participate in the path check. Exact references replace the blanket exclusion.
These include 52 historical references, 11 prior-art paths, 23 generated or embedded paths, and 24 example paths. Each group records its owner and removal condition in policy.

Missing-path and
allowlist-consistency checks pass. Adjacent missing literal paths remain covered by the
document-relative, wildcard, and custom-check regression tests. Obsolete task, Deno, CodeQL,
and Python Semgrep claims are corrected rather than excepted.

Executable directives retain specific contracts: macOS link modes, unpublished TOML
node kinds, npm lock versions, standalone target imports, a required package entrypoint,
and Bun matcher types. Other matches are planted defects or suppression-parser inputs.
No executable skipped test or unfinished test marker is retained.

The `axe-core@4.13.0` license exception accepts only `MPL-2.0`. The installed
package declares that license and includes its full text. The required JSX
accessibility plugin depends on this unmodified development package. It is absent
from the CLI binary. Review the exception when the dependency version changes.

The `node-no-configured-require` exception applies only to six named files under
`packages/cli/src/native/` in policy. These evaluators execute authored
configuration and resolve installed APIs from the target repository. Static
imports select the CLI dependency graph and cannot implement that contract.

The file is the smallest supported policy scope. Other security rules remain
active. Native tests verify findings in the excepted file and an adjacent file.
Remove an exception when its evaluator stops loading selected executable modules.

The TOML enum suppressions remain justified: `@decimalturn/toml-patch@3.0.5`
declares `NodeType` internally but omits it from package exports. Literal
discriminants provide narrowing without private imports or casts. Revisit these
line-scoped exceptions when the dependency exports the enum.

The Astro schema route retains its published URL through an exact directory
exception. Its callback uses the framework APIRoute type. The obsolete npm
single-file exception is removed. Exact language-test directories identify the
configuration being tested, rather than the implementation language. Remove
these exceptions if the route contract or test ownership changes. Neighboring
invalid support folders remain covered by regression tests.

Eight exact accessibility test files retain `gspot.alt-text` exceptions because their
strings plant missing attributes. The Svelte parser test has a separate exception
for an exact upstream diagnostic. These fixtures retain their assertions. Images
used only for link or scope tests receive alt text, and those tests pass. Remove
these exceptions when their deliberate defects or upstream diagnostic disappear.

The package-installation test retains its exact-file `RedHat.MergeConflictMarkers`
exception because it verifies generated-lockfile drift and recovery from conflict
markers. Other prose rules remain active. A native regression verifies that an
excepted fixture still reports other prose defects and an adjacent image still
reports missing alt text.

The source launcher retains one `Google.OxfordComma` exception. Its Bash runtime
header requires a version followed by the exact two-platform spelling. A serial
comma changes that parsed contract. Remove the exception if the header contract
or upstream prose rule changes.

Vale vocabulary retains official product capitalization for Nx, Turborepo, Husky,
Lefthook, and EditorConfig Checker. A native neighboring heading with incorrect
capitalization still reports. Remove vocabulary entries when the products leave
the documentation.

Two exact documentation-path allowances cover the CSS runner argument relative
to its declared test working directory and the ignored runtime report uploaded by
CI. Tracked-source lookup cannot resolve either contract. Remove these allowances
if the invocation directory or report path changes. The published 404 filename
exception is removable only when Starlight stops requiring that route convention.

The UUID advisory `GHSA-w5hq-g745-h8pq` reached the lockfile through `gaxios`, a dependency
of linkinator 6. Linkinator 8.1.0 fetches with `undici` and carries no `uuid`, so the
advisory left the graph and its exception is gone. Linkinator 8 serves the site on the
loopback address and reports relative links, and the internal-link skip names that host.

Documentation path analysis recognizes document-relative references and mise aliases.
Allowlist validation accepts untracked path allowances only when documentation
actually references them. Regression tests retain missing paths, unused allowances,
and source exclusions that match nothing. Both regressions fail before correction;
15 focused tests pass afterward. Type checks pass.

The blanket `docs/**` path exclusion is replaced with exact consumer-example and
output paths, with reasons. The blanket `architecture/**` exclusion is removed.
Qualified source paths repair 148 references. Exact allowances retain reviewed historical,
external, and example paths. These changes increase checked documentation coverage;
the path and allowance checks pass. The final full checks still verify these retained entries against the candidate.

Type assertions preserve callback uses and direct invocations in the function rule.
Seven regression cases expose false findings or missed immediately invoked functions
before correction. Required instance methods are matched against implemented interfaces
and base classes. Neighboring unrelated methods and static methods remain checked.
Generated-policy tests cover both levels and retain precise locations for direct calls.

Native naming exceptions identify exact ESLint API members, PostgreSQL AST tags,
Node filesystem options, vulnerability database table names, and Vale settings. Internal type aliases
and variables are renamed instead. The gitleaks exception follows the actual type
owner; its former source-file allowance is removed. Bun 1.4.2 still defines
`AsymmetricMatcher` as `any`, so the three typed comparison boundaries remain justified.

CodeQL `js/file-system-race` exceptions cover nine exact fixture files. Agent and
uninstall tests, Next.js and Swift isolation tests, and package-installation tests
compare file bytes and modes across operations in owned temporary repositories.
Storage report tests inspect owned obstructions. Resource-read and cache tests
intentionally replace files, including the regression that reproduces the repaired
production race.

The acceptance preservation helper only reads and restores owned
temporary fixture trees. No production file or other CodeQL rule is excluded.
Each policy entry states its ownership constraint and removal condition.

Native CodeQL verification uses two identical temporary race fixtures. An exact-path
exception accepts one while the neighboring fixture still
reports `js/file-system-race` at line two, column 66. The exception does not disable
the query. The full scan passes these retained entries without new findings.

Four production CodeQL exceptions retain specific, tested contracts:

- `packages/cli/src/generation/fragments.ts` uses complete JSON literals in standalone JavaScript.
  Its output never enters an HTML script element. Generated parser and plugin tests
  retain hostile-looking scope strings while detecting undefined references.
- `packages/cli/src/checks/actions.ts` rewrites one leading self-repository marker. Native tests
  preserve later dollar signs in filenames and still report expression errors.
- `packages/cli/src/repository/revisions/refspecs.ts` validates both sides with Git before substituting
  the single permitted wildcard. Three malformed-mapping cases reject multiple
  wildcards, accept correction, and respect negative mappings.
- `packages/cli/scripts/inputs.ts` verifies downloaded bytes against the pinned SHA-256 digest
  before creating a cache file. Corrupt downloads and HTTP failures cannot populate
  that cache. Four regression cases verify these boundaries.

The policy names each exact file, rule, constraint, and removal condition. A native
CodeQL probe detects all four excluded query families in a neighboring fixture while
accepting only the explicitly named duplicate. Other rules remain enabled in both.
The combined JavaScript-generation and grammar suite passes seven tests with
65 assertions. Git mapping validation passes three cases with nine assertions.

## Suppressions that became code

The twelve enum-comparison suppressions around the TOML parser are gone:
`packages/cli/src/policy/toml/nodes.ts` reads a node's kind through one guard, because the parser
keeps its enum private. The build
script reads the release target table from disk instead of importing across package folders.
The two npm lockfile formats are named constants. The Vale image and merge-marker rules run on
markup files only, so the seven test-file ignores are gone. The enforcement ledger and the prior
art record name their reference repositories without file paths, so the docs path allowance is
gone. Linkinator 8.1.0 dropped the dependency that carried the uuid advisory, so the ignore for
Open Source Vulnerabilities (OSV) is gone.

## Full-force enforcement

The trivial-function rule lost every exemption the language does not force: shared computation,
contextual signatures, callback properties, and repeated references. Nested callbacks now count
toward a function's statements. Two plugin rules were added, `gspot/export-layout` and
`gspot/no-import-comments`, both at level `all`. Unused parameters report in every position in
TypeScript, JavaScript, and Python. Every switched-off ESLint rule in the generated template
carries its reason; `n/no-sync` and `unicorn/no-null` stay off by decision. Test files keep only
`no-magic-numbers` and `no-non-null-assertion` off, with reasons.

Under those rules the tree reached zero ESLint findings. Functions called once were inlined.
Functions whose shape an external contract fixes carry a suppression with a named reason.
The remaining magic numbers became named constants. The message catalog under
`packages/cli/src/policy/messages.ts` holds one policy ignore because each entry is a distinct message. The build scripts keep a local exit constant
because release tests copy them without the alias.

CodeQL passed after `installed-files.ts` reads a link target before opening a file and
`locate.ts` reads a manifest without a preceding stat. Types, 961 unit tests, 1,441 integration
tests, 463 plugin tests, 141 normal checks, and seven manual checks pass on the current tree.

## Verification

Bun 1.4.2 owns all accepted runtime evidence. Detailed reports and failed diagnostic history
remain outside tracked source under `/tmp/gspot-lint-cleanup/resumption/`.

| Required gate                 | Current evidence                                                                                                 | Scope and required follow-up                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Discovery                     | 453 files: 94 unit, 179 deterministic integration, 66 native, 105 source, and nine release.                      | Complete.                                                                                        |
| Types and coverage            | Types pass. Coverage passes 2,391 tests with 9,763 assertions; 83.39% functions and 84.85% lines.                | The manual coverage replacement passes too.                                                      |
| Native tools                  | 419 tests and 2,816 assertions across 66 files pass.                                                             | Local macOS evidence; other native platforms use their CI runners.                               |
| Builds and packages           | Seven targets and plugin build; eight CLI package dry runs and one plugin dry run pass.                          | Host embedded parsers, ESM/CommonJS imports, and installed journeys pass.                        |
| Source and release acceptance | Full source baseline: 557 tests and 4,364 assertions. Current release: 171 tests and 394 assertions.             | Affected reruns: 32 Python/lifecycle tests, four commit tests, and 54 workspace-copy tests.      |
| Documentation                 | 15 tests and 1,711 assertions pass; 324 pages build with valid links and fragments.                              | Schema parity, responsive controls, code indentation, and README artwork have rendered evidence. |
| Performance                   | 5,000 files, ten staged: initialization 8.507 seconds, cold 4.480 seconds, warm 4.161 seconds.                   | Measured after source and installed-release acceptance; all limits pass.                         |
| Full checks and doctor        | 141 normal checks pass with 12 ownership skips; seven manual checks pass without skips. Doctor exits 0.          | Every ownership skip names its passing replacement.                                              |
| Lifecycle                     | 18 final clone and hook tests pass with 237 assertions. Repeated apply writes nothing; preview reports no drift. | The real index matches its recorded checkpoint before staged verification.                       |
| Staged index                  | The final check uses a disposable index containing the reviewed changes.                                         | `final-staged.json` and `final-staged-index.json` record its result and real-index hashes.       |
| Remote CI                     | The workflow installs the source plugin and uploads normal and manual reports separately.                        | Require successful Linux, macOS, Windows, and report jobs for the exact commit before merging.   |

The complete deterministic suite covers policy serialization, generated configuration, ownership,
immutable revisions, process errors, cache invalidation, reports, and plugin rules. Native and
provider-dependent checks retain their separate gates. Ownership skips satisfy their contract only
when their named replacement passes. A repair invalidates the affected evidence.

## Remote verification

[The candidate gate](22-remaining.md#candidate-gate) defines the required local checks.
Keep accepted level assignments unchanged and commit with normal hooks. Enable
`GSPOT_CI_ENABLED` and dispatch full CI against the existing task branch.
[CI runs for this branch](https://github.com/stefanionescu/gspot/actions/workflows/ci.yml?query=branch%3Afix%2Froot-cause-lint-cleanup)
record each commit's platform results and uploaded reports.

The first full runs on the four-platform matrix found what each platform lacks. Arm64 Linux has
no aqua build of dotenv-linter and no CodeQL CLI. The Linux runners had no Supabase CLI. A newer
trivy checks bundle broke the pinned binary. Windows resolves a fake npm only through a command
file, and the plugin tester needed an absolute parser root. Each is repaired in code or in the
workflow, and a tool pin now names the platforms it ships for.

Merge the completed task branch into `main` only after its exact-commit CI succeeds, using
normal hooks. Do not create another branch. Public publication, deployment, and changes to
other repositories remain excluded. Unavailable native targets and provider-dependent gates
retain their separate requirements in phase 10 of the backlog.
