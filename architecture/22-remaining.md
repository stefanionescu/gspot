# Remaining Work

This document indexes unfinished acceptance criteria in implementation order. Some rows have
partial implementations; an open row does not mean that none of its code exists. The evidence of a row is in [18-gaps.md](18-gaps.md). How it is fixed, with the files, the
logic, what goes, and the tests, is in its fix file under [fixes/](fixes/README.md). Implementation boundaries are in [16-file-tree.md](16-file-tree.md). Update a row when its acceptance criteria are met.

## Active CI bypass

Until the user explicitly re-enables CI, bypass GitHub Actions for every gspot commit and push.
This instruction takes precedence over CI execution and waiting requirements throughout this
architecture, its fix files, and inherited implementation plans, including S-12 and K-263.
It applies to every milestone, Windows repairs, and final-candidate work. A milestone, failure,
release-preparation step, or context handoff does not end the bypass.

- Include `[skip ci]` in every commit message, including this policy change, before pushing.
  Preserve conventional commit subjects by putting the marker in the commit body.
- Do not dispatch, rerun, or otherwise start CI. Do not create an unmarked checkpoint commit
  to obtain a run. Do not wait for existing runs before continuing implementation.
- Continue relevant local tests, type checks, formatting, lint, and contract checks. Run
  `gspot check --staged` as the last check before committing, and keep Git hooks enabled.
- Record CI-only acceptance and unavailable platform evidence as deferred by user instruction.
  Do not report skipped CI as passed or infer Windows/Linux verification from local macOS tests.
  Deferred CI evidence does not block implementation or require repeated requests to run CI.
- Keep product workflow implementation and local workflow validation in scope. This bypass
  governs work on gspot; it does not remove CI functionality from generated customer workflows.
- Resume CI only after an explicit user instruction. Then agree its execution frequency before
  restoring CI gates; do not automatically restore a full run after every commit.

The candidate and adoption records must distinguish completed local validation from deferred
CI evidence. Other safety, package identity, recovery, and public-release restrictions remain
in force.

## The order

The cleanup below is the current implementation order. It supersedes older phase and fix-file
sequences. Fix numbers group related evidence; they do not decide priority. Keep Yap unchanged
until the implementation gate passes. Keep hooks enabled and CI paused under the policy above.

1. Simplify infrastructure with established dependencies and remove unnecessary source artifacts.
   Keep policy, confinement, recovery, cancellation, and authored-content protection with their owners.
2. Complete lifecycle and configuration across proposals, ownership, nested scopes, takeover,
   immutable installation, recovery, and upgrades.
3. Complete execution and enforcement across shared tool execution, session observations,
   caching, cancellation, levels, and language and framework rules.
4. Complete integrations and distribution across hooks, reports, doctor, coverage, generated CI,
   isolated builds, seven targets, artifact validation, signing, and deployment preparation.
5. Complete useful documentation, executable examples, finding/correction transcripts, Spot artwork,
   and site acceptance alongside the features they describe.
6. After implementation settles, generate owned output and freeze one candidate. Build the seven
   targets once and reuse the artifacts for complete local acceptance. Record deferred platform
   evidence under the CI bypass. Pass the implementation gate before the authorized Yap adoption.
7. Leave both repositories uncommitted. Do not push, publish publicly, deploy, change DNS, or execute CI.

### Native conventions reconciliation

Implementation cleanup retains native mise fragments, Bun configuration, TOML choices, and
editor schemas. [Repository ownership](12-repository-layout.md#native-configuration-and-packaging)
records the accepted conventions and rejected custom alternatives. The plugin keeps its public
exports; layout opt-in is a separate product-rule change under K-101.

K-303 is locally resolved by the retained authored-content and failure tests. K-306 source
conversion is locally resolved; native-platform acceptance remains in K-263. Directory symmetry,
word-count renames, file inventories, arbitrary coverage quotas, and blanket conditional-suite
bans are retired, not counted as repaired product defects. The phase history is superseded by
this index; historical platform evidence remains in the repository accounting record.

Local macOS ARM64 verification uses Bun 1.3.11. Unit/plugin execution passes 380 tests.
Preservation, confinement, recovery, and cancellation execution passes 50 tests. Focused tests
exercise parsed duplicate pins, native mise task precedence and argument forwarding, accepted
and rejected schema documents, reference ownership, encoded paths, and generated ESLint levels.
The host binary and plugin build. Bundled notice bytes remain unchanged after the ownership move.
A packed plugin installs into a fresh consumer and executes both module formats and declarations;
its root license matches the repository license and its dependencies remain external.
The website builds 281 pages and copies the root schema into output.

These are development checks, not frozen-candidate acceptance. Seven-target builds, complete
native-platform runs, and site visual acceptance remain deferred. CI, publication, deployment,
and Yap migration were not executed. Prior worktree repairs remain uncommitted.

### September 21 cleanup batch

The report JSON-schema export, generated copies, binary asset, and references are removed.
Runtime report validation and the configuration schema remain. The excluded filesystem-package
assessment is removed; manifests, imports, lockfiles, and scripts contain no dependency on it.

CLI notices and licenses are generated in release output. The plugin build independently stages
its license at the package root and leaves declared npm dependencies external. The launcher has its own
license; each platform package carries the binary notices. Platform packages reuse the launcher
README. Source-package legal copies and the platform README-only directory are removed.

Build and publication commands use Execa. Globby replaces recursive asset walkers in builds and
source execution. Binary Git capture also uses Execa, preserving arbitrary bytes, diagnostics,
deadlines, and cancellation. Bun requires a Node encoding name for process streams, so binary
capture uses base64 transport and decodes at the shared process boundary.

The current ESLint generator does not contain the obsolete Unicorn rule that crashed lint.
Regenerating its output through the generator and lifecycle owner repairs the local configuration.
The focused cleanup lint and TypeScript checks pass. The existing installed-consumer test still
has lint findings, including complexity and unsafe JSON access; broader lint acceptance is open.

Local development evidence on macOS arm64, Bun 1.3.11, version 0.1.0:

- Script argument acceptance: six tests, 250 assertions, all passed.
- Process, hook, and cancellation acceptance: 28 tests, 254 assertions, all passed.
- Installed launcher/platform/plugin and embedded-binary acceptance: three tests, 174 assertions,
  all passed using the isolated local registry.
- The host binary builds. SHA-256:
  `9ee04529a76182d9e4fd50117693813ca53893fc3cfe4934df80748571e552ba`.
- Base revision: `950b548244fc1347bbf99cf876b5bb92478afe63`, with the preserved uncommitted repairs
  and this batch. This is development evidence, not a frozen source or release candidate.

The CLI regression run passed 529 tests and failed one test because the host mise was 2026.5.15.
That test passed with a temporary copy of the pinned mise 2026.8.8 release, verified against the
SHA-256 in its official release metadata. The host installation was unchanged. This was a focused
rerun, not a second complete suite run.

The documentation build passes for 281 pages with valid internal links. Visual acceptance remains
open: browser control is unavailable, and native screen capture failed before opening the guide.
The temporary documentation server was stopped.

The first repository-wide `gspot apply` failed during Bun lock resolution before publishing files.
After staging the plugin in an isolated local registry and routing only its npm scope there, apply
exited 0. It generated the tool manifest and lock and preserved edited or unowned outputs. The
registry was stopped after the command. Complete drift reconciliation, immutable self-install,
all-level self-checks, remaining subsystem work, visual documentation acceptance, and the candidate
gate remain open. No seven-target rebuild was performed for this batch. Linux and Windows execution
remain deferred under the CI bypass. Yap is unchanged.

Reproduce the focused evidence with:

```shell
bunx tsc --noEmit
bun test tests/release/arguments.test.ts
bun test packages/cli/tests/integration/spawn.test.ts tests/acceptance/cli/cancellation.test.ts tests/acceptance/cli/hooks.test.ts
bun packages/cli/build.ts
GSPOT_RELEASE_TEST=1 bun test tests/release/install.test.ts tests/release/plugin.test.ts tests/release/binary.test.ts
```

### September 21 ownership and observation repairs

K-299 and K-300: uninstall no longer infers deletion authority from Git tracking or current
templates. Apply retains original bytes and modes when adopting identical unrecorded files or
blocks. Fresh-clone files survive both direct uninstall and uninstall after apply. The ownership
contract and its written-file fix now agree on this behavior. Uninstall plans include pending
journal entries, then recover them through the lifecycle owner before restoration. The preview
remains read-only. Uninstall writes its interactive preview to stderr so `--json` emits one valid
JSON document on stdout.

K-307: Git repository detection reports failed probes instead of calling them repositories.
Init checks status only after establishing that Git is present, and a failed status read refuses
initialization before writing. Missing Git, corrupt metadata, tracked deletions, and no-Git
folders retain distinct outcomes. PostgreSQL and Xcode now use strict index, tree, and batched blob readers. PostgreSQL
shares its committed SQL observation within a session. Unborn branches are distinct from
corrupt HEAD references. Xcode reads symlink targets from the index and preserves unusual
filenames. The unused executable-bit writer and failure-to-empty Git helper are removed.

Local macOS development verification passes 70 tests with 447 assertions across confinement,
ownership, init failure handling, repository observation, and lifecycle/uninstall acceptance.
Type checking passes. Formatting and whitespace checks pass for this batch. Focused lint passes
for the changed uninstall, init, observation, and test files. The apply owner separates proposal publication and pruning, with common preservation
reporting. Its focused lint passes without disabling rules. The uninstall acceptance test no longer installs unrelated
linters because its commands execute no checks.

Reproduce the behavioral evidence from the repository root:

```shell
bun test packages/cli/tests/integration/lifecycle/confined.test.ts packages/cli/tests/integration/lifecycle/ownership.test.ts packages/cli/tests/integration/lifecycle/init.test.ts packages/cli/tests/integration/repository/tracked.test.ts tests/acceptance/cli/lifecycle.test.ts tests/acceptance/cli/uninstall.test.ts
bunx tsc --noEmit
```

This batch does not close K-298, K-299, K-300, or K-307 as a whole. Native Windows confinement
is still unimplemented and securely refuses mutations. Complete lifecycle routing and pruning,
other configuration and enforcement work, distribution, website acceptance, and the candidate
gate remain open. No candidate was frozen or built. No repository commit, push, CI run, public
publication, deployment, DNS change, or Yap migration was performed. Prior repairs remain in the
worktree. Disposable Git tests create their own histories without changing this repository.

### September 21 Git and scope observations

K-307, cleanup rows 21–23: strict Git entry and blob readers are shared with revision
snapshots. Required Git failures propagate. A missing initial commit is accepted only for an
unborn symbolic branch with no matching ref and no Git diagnostics. PostgreSQL reads committed
SQL in one batch per session. Xcode reads staged symlink objects rather than HEAD paths.
The unused executable-bit writer and lossy Git convenience function are removed.

PostgreSQL migration discovery and Xcode project-file selection respect the deepest declared
scope. Migration directories are relative to that scope. Parsed migrations are reused within
the session; subsequent command sessions read new contents. Tests cover independent nested
projects, configured migration roots, exact findings, corrected inputs, corrupt index/HEAD,
unborn history, Unicode/newline filenames in Git observations, and unchanged snapshot bytes.
Snapshot creation still enforces the lifecycle path restrictions when materializing files.

Local Git/history, selector, and cancellation verification passes 17 tests with 175 assertions.
The added scope cases pass with the focused reader suites: five tests and 35 assertions.
Focused source/test lint and type checking pass. The snapshot owner separates entry parsing,
blob framing, dependency readiness, and materialization without disabling lint rules.
Normal reference generation updated the PostgreSQL setting description (271 pages generated).
This is development evidence, not candidate or native Windows acceptance.

```shell
bun test packages/cli/tests/integration/repository/snapshot.test.ts packages/cli/tests/integration/checks/postgres-history.test.ts tests/acceptance/cli/selectors.test.ts tests/acceptance/cli/cancellation.test.ts
bunx tsc --noEmit
```

### September 21 reference contract repairs

K-304: command references use Commander usage and option descriptions, including inherited
global flags, choices, defaults, and implicit help. Generation traverses nested public commands
and excludes hidden commands and hook options. Repeated setting definitions must match exactly;
matching definitions list every owner. Conflicting definitions fail generation before output
publication. Root and integration settings continue to come from the configuration owner.

This validation exposed conflicting duplication thresholds and OpenAPI descriptions. The
structure and duplication definitions now agree. Raising minimum copied lines or tokens weakens
detection and requires a reason when `require_reasons` is enabled; lowering them does not.
The FastAPI and Express descriptions now agree on their shared setting.

Normal reference generation writes 271 pages and removes the obsolete generated page for the
hidden completion command. Reference, setting-policy, and preset-validation tests pass: 44 tests,
93 assertions. Type checking passes. The website builds 280 pages, creates its search index,
and validates all internal links. The final reference description edit was regenerated and
covered by the focused reference tests. Desktop/mobile visual and accessibility acceptance
remain open.

The generator validates publication targets in one helper and names permission constants.
Its preservation tests use typed asynchronous assertions. Repository policy now declares the
same Node floor as package engines, applied through `gspot set`. Focused lint passes for the
reference writer, its tests, and apply. The three focused suites pass 30 tests with 167
assertions, and type checking passes. No suppression was added. K-304 remains open for complete global configuration coverage and release-matched
candidate evidence; these development checks do not establish public-launch acceptance.

Reproduce the focused checks from the repository root:

```shell
bun test tests/integration/reference-pages.test.ts packages/cli/tests/unit/policy/settings.test.ts packages/cli/tests/unit/presets/select.test.ts
bunx tsc --noEmit
mise run docs:build
```

### September 21 repository CI ownership

K-309 local definitions use one authored workflow. Repository policy no longer requests a
second generated CI workflow. Apply restored the recorded original of that output, and the
obsolete original was removed as part of consolidating its check and report responsibilities.
Consumer workflow generation remains unchanged.

The configured cadence is affected checks for pull requests, merge queues, and main pushes.
Full Linux/macOS/Windows, unit coverage, integration, acceptance, manual checks, and the
single documentation build run at explicit full dispatch or release checkpoints. Release
artifact construction depends on full acceptance. Platform package installation tests remain
in the release owner. Normal and manual reports have separate artifacts; SARIF upload keeps
its restricted permissions. Jobs require the owner-controlled `GSPOT_CI_ENABLED=true` variable.
No CI was executed or enabled. Native execution, cold/warm timing, and remote required-check
behavior are explicitly deferred under the CI bypass.

Local validation: pinned actionlint 1.7.12 accepts both authored workflows. The exact-object CI
command passes its defect/correction, unchanged legacy input, invalid-object, and report
preservation journey (one test, 17 assertions). The native mise test verifies that the fragment
was discovered before testing root-task precedence and argument forwarding. Both mise tests
pass with the previously verified mise 2026.8.8 binary (seven assertions). The host mise was
not updated. Root `min_version` now makes an older runner fail explicitly.

```shell
bun test tests/integration/ci-affected.test.ts
bun test packages/cli/tests/integration/emit/runner-tasks.test.ts
mise exec actionlint@1.7.12 -- actionlint .github/workflows/ci.yml .github/workflows/release.yml
```

### September 21 adapter execution and scoped inputs

License scanning refuses absent installed dependencies instead of returning no findings. Its
JSON response is validated. The real pinned npm scanner passes allowed-license, disallowed-license,
compound-expression, matching-exception, and stale-exception journeys. Its observed version-command
exit status is recorded by the preset instead of bypassing the shared version probe.

Cloudflare types generation and license scanning use the shared tool runner. Cloudflare header,
redirect, configuration, and types selection respect the deepest project scope. Retained generation
tests preserve authored bytes and modes after success and failure. Bash documentation syntax checks
also use the shared runner, including cancellation. Process failure classification is shared by
adapters and direct checks; malformed or failed secret scans retain diagnostic redaction.

Local verification: runner, parser-boundary, and cancellation tests pass 29 cases with 337
assertions. The real pinned TruffleHog history/redaction journey passes 28 assertions. Cloudflare
scope/preservation and missing-dependency tests pass six cases with 19 assertions. The actual
license acceptance journey passes. Focused lint and TypeScript validation pass for these owners.

Supabase function discovery, configuration findings, database types, and Deno execution use the
project scope. Deno reports are validated and cannot convert empty failure output to a clean scan.
The Supabase configuration reader uses the strict TOML parser and validates its consumed fields;
malformed configuration prevents storage-policy success. Two focused cases pass seven assertions,
including an actual pinned Deno 2.6.6 defect/correction run and cancellation. Other execution adapters,
incremental Swift builds, and complete enforcement acceptance remain open.

### September 21 documentation and site implementation

The landing page, shared light/dark theme, navigation, and error page use the Spot identity.
Three image concepts were reviewed before selecting the character. Production poses, source
masters, prompts, and export provenance are retained in `docs/design/spot.md`. WebP exports,
the compact PNG, social image, and SVG favicon are local assets. Generation used the built-in
image tool; its underlying model version was not exposed.

Task guides cover setup, scopes, profiles, custom checks, hooks, CI, findings, and troubleshooting.
The Bash finding and correction transcript comes from actual CLI execution. Complete guide
policy examples load through the production parser. References include the product version and
links to their source definitions, pinned to the source revision in release builds.

The latest build produces 314 pages and a search index. The emitted-site validator checks local links,
fragment targets, and image paths across custom pages and generated references. The landing
and error pages pass HTML validation. Focused documentation, reference, link, and release tests
pass: 19 tests and 66 assertions. Documentation TypeScript and affected TypeScript lint pass.

The Pages workflow builds previews without deployment permissions. Released deployments require
published stable tags matching the CLI version. Documentation corrections require an exact source
commit descended from that tag and reject changes to product inputs. Artifacts retain source
provenance. Dispatching a previous published tag defines rollback by a pinned rebuild. Both CI and
Pages remain behind owner-controlled gates; neither was enabled or run. Public deployment,
protected environment configuration, DNS, and live rollback evidence remain externally deferred.

Desktop/mobile, keyboard, and screen-reader review remain open. Browser inventory exposed no
controllable browser; native Chrome opened the local page but returned no accessible content and
reported screenshot capture unavailable. The temporary preview server and browser tab were closed.
This is a tooling limitation, not visual acceptance. Candidate generation and complete feature
acceptance remain open.

### September 21 agent and installed-plugin verification

Agent instructions reach AGENTS.md, detected Gemini, Claude, and Copilot files, and configured
`rules.agents` destinations. Existing Cursor directories receive an always-applied rule through
normal file ownership. Authored Cursor files remain preserved. Actual CLI acceptance verifies
shared blocks, unchanged reapply timestamps, original bytes and modes after uninstall, removal
of created files, and refusal of escaping destinations. Agent and settings tests pass 11 cases
with 42 assertions. Focused lint and root TypeScript checks pass.

Plugin recommended rules derive from rule metadata. Both generated levels retain demonstrated
client-environment and duplicate-export defects; exported-alias preferences require all. Generated
ESLint tests execute both levels. All 261 plugin unit tests pass. The isolated installed-package
journey passes 12 assertions across ESM, CommonJS, declarations, and the actual README examples.
It also verifies occupied-port refusal, startup deadlines, registry readiness, and cleanup.

Snapshot materialization uses the same handle confinement with native POSIX path components,
so valid Git names containing backslashes remain unchanged. Portable lifecycle destination
validation remains strict. Snapshot, selector, and confinement tests pass 16 cases with 150
assertions. Windows secure mutation is still unimplemented and refuses mutation; native Windows
acceptance cannot be inferred from these local results.

### September 21 ESLint overrides and incremental Swift builds

Required-rule integrity inspects every selected source file in its deepest scope instead of
sampling one file per extension. ESLint configuration resolution uses the shared runner and
validates its report. The real ESLint journey catches a disabled rule in the later file,
accepts its correction, rejects broken configuration, and propagates cancellation. Focused
lint and TypeScript checks pass.

Swift compilation retains compiler state across sessions. Analyzer builds use a separate clean
build directory and run at the manual stage. Scope identifiers no longer collapse slash and
hyphen paths to the same build directory. Eleven focused tests pass, including native Swift 6.3.2
compilation: the initial build took 1522 ms and the unchanged build took 338 ms. The object file
modification time remains unchanged, and a subsequent source defect produces a compiler finding.
The actual package acceptance journey also passes compilation, clean SwiftLint analysis, and
Periphery defect/correction checks (13 assertions). The isolation regression verifies that
manual analysis clears its own compiler state and preserves incremental state and logs.
These measured times are local observations. Xcode-specific native acceptance and platform cache relocation remain open. CI remains paused.

### September 21 generated Git attributes

The generated proposal includes an owned `.gitattributes` block marking `.gspot/**` generated
and enforcing LF. An actual Git checkout with `core.autocrlf=true` preserves generated bytes;
uninstall restores authored attributes. The combined attribute and agent CLI journeys pass
three cases with 35 assertions. This implements K-273 locally. Native Windows checkout evidence
remains deferred under the platform constraint. The updated site builds 314 pages with valid
local links and fragments after agent settings and Swift stage regeneration.

### September 21 Python scope and Swift execution boundaries

Dependency ownership runs per Python scope only where uv.lock, poetry.lock, or pdm.lock exists.
It inspects the deepest scope and leaves unlocked projects outside that check. The CLI journey
finds a duplicate requirements file only in the locked scope and accepts its removal. Python
import contracts are detected by parsing TOML, including quoted table forms, rather than scanning
for a literal header. Missing contracts are explicit skips; malformed TOML fails the check.
Two CLI tests pass nine assertions. The actual Python preset defect journey passes 29 assertions.

Swift compilation, analysis, and Periphery use the shared tool runner for resolution, environment,
deadlines, cancellation, and process failures. Twelve focused tests pass with 18 assertions,
including native incremental compilation, separate analyzer state, timeout classification, and
pre-launch cancellation. Repeated timings vary (1107 ms initial, 395 ms unchanged in the later run);
compiler object preservation is the regression assertion, rather than a timing threshold affected
by host load. The earlier one-third timing assertion is superseded by this direct reuse evidence.

### September 21 cache retention and host artifact

Full cache-enabled runs retire recorded verdict files older than 30 days through the existing
ownership journal. Narrowed runs and `--no-cache` leave them untouched. Edited and unowned files
remain preserved. Hashing reads raw bytes without a base64 copy, and structured cache keys prevent
newline-bearing paths from being confused with multiple input records. The cache format advances
to prevent reuse of old keys. Storage, recovery, report, and retention tests pass 26 cases with
162 assertions; the additional full-versus-narrowed regression passes with the retention batch
(four cases, 11 assertions). Focused cache lint and TypeScript checks pass. Configuration-specific
cache invalidation and platform build-cache relocation remain open under K-43/K-44.

File hashes and the generated-file observation are shared within each execution pass, after
fixers complete. The next pass reads them again. A regression verifies one binary read per
shared configuration, reuse of unchanged results, and invalidation after an edit. The latest
storage and retention run passes 19 cases with 102 assertions. Execute-module lint still reports
complexity, parameter-count, and non-null assertion findings; it is not a clean lint
acceptance result. Other touched cache owners and tests pass focused lint. Swift cancellation
also preserves analyzer state before cleanup when the session is already canceled.

The preceding agent, ESLint, Python, and Swift batch builds as a signed macOS ARM64 executable.
Its embedded-asset journey passes seven assertions. That development binary has SHA-256
`9e70a8ac3904929478dfbf2487b5c92bee3a1ab4accfc73868a0ef253427b799`.
It predates the cache-retention changes and is not a frozen candidate. After cache retention,
shared hashes, and init-preview repairs, the host binary was rebuilt and its embedded journey
again passed seven assertions. The updated SHA-256 is
`a44aa5995198ad022d0871b3c4e53072fb850a5c4dcb0d3d15c397a0fc160690`.
No other target was built and no CI, publication, deployment, or migration was executed.

The init preview uses the same detected/configured instruction destinations as apply, resolved
from the final proposed policy. Its read-only CLI test passes nine assertions and preserves all
fixture bytes. The old unconditional CLAUDE.md preview and configuration example are reconciled
with this behavior in their existing architecture owners.

### Repository clutter audit

Removed the obsolete `.config/mise/conf.d/gspot.toml`; generated tasks use
`.mise/conf.d/gspot-tools.toml`, now included in the validation template. Removed three
helper/string-only test files and two redundant assertions; preset dependency selection now
uses a diamond graph to verify ordering and deduplication. Removed repeated verification
transcripts, directory diagrams, occurrence-count targets, and per-edit full-check requirements.
Preservation tests and the implementation and adoption gates remain.

Focused validation passes: 43 behavioral tests, TypeScript, formatting, and lint of the changed
TypeScript files. The mise execution test used the temporary pinned 2026.8.8 binary. No complete
suite, documentation build, release rebuild, CI run, or Yap migration was performed for this audit.

### Cleanup acceptance backlog

These are implementation tasks, not claims of completed repairs. Close a task only with
observable behavior from its current owner. Related fix sections retain defect evidence
and detailed contracts; this list owns cleanup status. No separate audit framework or test
inventory is required. Existing code has no claim to preservation merely because it exists.

All existing Swift, JavaScript, TypeScript, and Python rules remain required across supported
frameworks. Preserve public plugin exports and standalone enforcement too. Replacement must
prove the same intended protection on every affected surface first.

Tests must protect findings, corrections, preservation, recovery, cancellation, and actual
installed execution. Do not require repository inventories, fixed rule counts, helper-call
assertions, a mirrored test tree, or repeated builds after individual edits. Keep language
semantics explicit and preserve standalone plugin enforcement when replacing internals.

Earlier local runs exercised installation, takeover, recovery, concurrency, caching, hooks,
and tool execution. Their repeated command transcripts and intermediate pass counts are
removed here; checked tasks retain their status, and the fix files retain defect contracts.
Those runs did not freeze a candidate. Historical Docker Linux and Rosetta results do not
establish native Intel or Windows acceptance. Windows lifecycle confinement remains open.
Use the current batch evidence above and the candidate gate below for the next acceptance run.

#### Installed product and release tests

- [x] **1. Replace reference acceptance.** In `tests/acceptance/cli/reference.test.ts`, require
      successful initialization, the expected executed checks, and reviewed structured findings.
      An empty run, missing tools, unexpected skips, or zero engine errors alone cannot pass.
- [x] **2. Repair worktree isolation.** Check init and Git cleanup exit statuses in
      `tests/harness/worktree.ts`. Compare worktree inventories before and after, rather than assuming one
      worktree. Verify preserved repository content; delete redundant status-count machinery.
- [x] **3. Exercise a fresh installed consumer.** Build, publish to an isolated local registry,
      install, initialize, report a known defect, correct it, and pass. Assert command exits and
      the exact finding. This journey must not symlink checkout dependencies or run source entry points.
- [x] **4. Verify packaged assets.** From the installed artifact outside the source checkout,
      detect and select grouped presets, generate config, and exercise embedded templates,
      grammars, prose styles, shipped vocabulary, and project vocabulary. Include offline
      recommended prose checks; a version response is insufficient.
- [x] **5. Combine publication and installation tests.** Move useful package-identity checks
      from `tests/release/publish.test.ts` into the consumer journey, then delete the repeated
      publication scenario. Derive versions from built artifacts; remove hardcoded `0.1.0`.
- [x] **6. Execute the published plugin.** Replace metadata-only confidence in
      `tests/release/plugin.test.ts` with installation, usable public exports and declarations,
      and real ESLint findings from the published package. Exercise recommended and all.
- [ ] **7. Separate pin availability from compatibility.** A registry version lookup establishes
      availability only. Execute the pinned tools with generated config and parse their actual
      results before claiming compatibility. Use the installed-consumer journey for registry setup
      and cleanup; do not maintain a separate harness suite.

#### Ownership, recovery, and generated output

- [x] **8. Remove directory-wide uninstall.** Replace recursive deletion of `.gspot/` in
      `packages/cli/src/lifecycle/uninstall-command.ts` with explicit owned-file operations.
      Preserve unowned files, later user edits, and recovery material (K-299).
- [ ] **9. Give lifecycle ownership one owner.** Init, apply, upgrade, remove, and uninstall use
      the same record of original bytes and modes, installed content, later edits, and interrupted
      operations. Delete ownership reconstruction from filenames, headers, or current templates.
- [ ] **10. Validate mutation paths once.** Route mutations through the boundary in K-298,
      including symlink parents and supported platform path forms. Independent path joins cannot
      authorize writes, replacements, or deletion. Test escape rejection without harming sentinels.
- [ ] **11. Separate generation from mutation.** Discovery and rendering return proposals.
      One managed application boundary owns collisions, replacement, pruning, and recovery.
      Delete writes from renderers and competing application paths after callers migrate.
- [x] **12. Make reference generation safe.** Render and validate output in
      `docs/reference-pages.ts` before applying it. Replace and prune only owned marked pages. Delete recursive removal
      of the reference root. Verify an authored sentinel survives and a failed render preserves output.
- [x] **13. Stop tracking generated reference copies.** Generate them during the docs build;
      delete the stale-copy comparison mode after generation behavior has coverage (K-303).
      Test completeness and content against validated definitions, not checked-in duplicate output.
- [x] **14. Remove the public decisions mirror.** Delete `decisionsPage`, its generated page,
      and its sidebar entry. Link architecture history separately where useful. Public docs describe
      implemented released behavior, not unfinished design or acceptance status (K-304).
- [x] **15. Delete forwarding-only generation helpers.** Inline wrappers such as
      `quote(JSON.stringify)` that add no behavior. Preserve real escaping, serialization, malformed
      input handling, and format-specific rendering tests. Do not replace one wrapper with another.

#### Execution and observations

- [ ] **16. Use one tool execution contract.** Executable resolution, version selection,
      environment, working directory, argument batching, timeout, cancellation, output capture,
      and failure classification belong to the shared runner. Preserve process termination tests.
- [x] **17. Remove adapter execution copies.** Migrate Ansible, Python import-linter, Docker
      image, and framework-build subprocess/reporting paths to that contract. Retain domain-specific
      discovery and multistep preparation. Do not introduce a generic workflow language.
- [x] **18. Validate check variants.** Replace loose optional combinations in `CheckSpec` with
      explicit external-tool and built-in forms. Reject impossible combinations at loading. Keep
      multistep preparation in ordinary code instead of encoding arbitrary control flow in manifests.
- [x] **19. Resolve dispatch once.** Planning selects the implementation; execution calls it.
      Delete dispatch-only wrappers and repeated name lookups in `run/analyses.ts`, `run/engines.ts`,
      and catalogs where they add no behavior. Preserve shared context and preparation owners.
- [ ] **20. Stop using integrity as a miscellaneous catalog.** Move checks to the domain they
      inspect. Move shared parsing and platform operations outside check catalogs. Infrastructure
      must not import the entire catalog for a basic operation.

- [ ] **21. Observe the repository once per command.** Share files, scopes, metadata, and Git
      observations within a session. The next session observes changes. Remove repeated discovery
      and process-global caches that need test reset hooks; retain repeated Swift-session regression.
- [ ] **22. Stop turning read failures into empty input.** Audit required readers, including
      the plugin directory reader. Distinguish allowed absence from unreadable or malformed input.
      Remove broad catch-and-empty fallbacks and their false-success tests.
- [ ] **23. Justify each cache.** Verify keys and invalidation include actual source, config,
      tool, and scope inputs. Delete caches without demonstrated value or reliable ownership.
      Test changed inputs and sessions, not the existence of a cache or reset method.
- [ ] **24. Report execution honestly.** Distinguish not-applicable, platform unavailable,
      explicit skip, missing prerequisite, missing tool, and delegation. Required checks that did
      not run fail acceptance even when the engine error count is zero.
- [ ] **25. Resolve check ownership explicitly.** Validate `reported_by` and `takes_over` so a
      requested check never appears executed merely because another entry describes its coverage.
      Separate descriptive coverage from executable specs; delete duplicate executable registrations.

#### Policy and enforcement

- [ ] **26. Make schemas own input contracts.** Derive parsed-input types, field lists,
      defaults, help, and reference data from validated definitions. Keep a separate normalized
      type only for a real transformation. Delete manually synchronized copies after consumers move.
- [ ] **27. Complete preset policy ownership.** Presets own shipped tools, pins, templates,
      default rule policy, styles, and vocabulary. CLI code owns loading, validation, operational
      parsing, and execution. Verify grouped discovery and compiled lookup; create no path aliases.
- [ ] **28. Consolidate persistent exceptions.** Replace overlapping local skips, ignores,
      and exception branches with the canonical persistent policy. Keep temporary command selection
      and baselines distinct. Delete superseded schemas, readers, commands, and tests together.
- [ ] **29. Finish recommended and all.** One metadata owner drives planner, templates, plugin,
      and documentation. Recommended produces useful findings on ordinary projects; forwarding
      preferences belong at all. Retain the rule there and delete independent duplicated rule lists.
- [ ] **30. Preserve rules during replacement.** Keep public plugin exports. Verify pinned replacements
      through generated config and standalone use. Cover scopes, aliases, type-only imports,
      exemptions, valid cases, and finding locations. Retain anonymous-forwarding and Next.js
      re-export regressions before closing K-188.

- [x] **31. Preserve universal coverage without forced universal analyses.** D-149 and
      `fixes/18-one-copy.md` supersede the forced universal design with shared proven operations.
      Both explicitly permit language-specific semantics. Enforcement evidence remains open in K-235.

#### Meaningful tests and completion

- [ ] **32. Replace weak finding assertions.** Review the 22 acceptance files identified by
      `toContain(planted.expected)` in the audit. Assert check, intended rule or diagnostic, file,
      location, exit status, and corrected behavior. A filename or words such as `The`, `turn`,
      and `helpers` are not evidence.

- [ ] **33. Test generated behavior.** Replace redundant plugin-import and config-substring
      assertions with findings from the loaded generated configuration. Keep meaningful escaping,
      malformed-input, serialization, and preservation regressions. Validate published schemas by
      acceptance and rejection, not property inspection. Fold vocabulary formatting into real generation.
- [ ] **34. Name acceptance cases individually.** Replace large loops that stop at the first
      failure with identifiable cases. Share expensive setup only when isolation and restoration
      are reliable. Do not build a case-definition language to avoid ordinary tests.
- [ ] **35. Share setup that does work.** Deduplicate actual installation and tool setup;
      keep case-specific inputs beside the case. Retain filesystem, process, and registry support
      with real behavior. Evaluate native APIs and open-source candidates before keeping custom
      infrastructure, following [the reuse decision](12-repository-layout.md#libraries). Filesystem
      test inputs use `testdirs` directly; the private testing workspace and its dependency entries
      are removed. Cleanup is registered before populating each temporary directory.
      Broader setup consolidation remains open. Record concrete unmet requirements;
      do not introduce a private package merely to forward a library API.

- [ ] **36. Exercise representative projects.** Use a small matrix covering fresh and existing
      projects, mixed languages, nested scopes, and clean clones. Exercise actual installation,
      hooks, retained config, and supported package managers. Keep focused unit tests inexpensive;
      do not make every test install the world.
- [ ] **37. Use tool-owned config resolution.** Use executable resolvers for ESLint, formatter,
      framework, and compiler settings. Preserve unsupported input with an explicit limitation.
      Delete heuristic parsers only after consumers move. Retain nested TypeScript package inheritance
      and generated-base resolution regressions against the installed compiler.
- [ ] **38. Consolidate architecture status.** Keep canonical contracts in their owner sections
      and actionable cleanup status here. Remove repeated current-status prose from phase summaries,
      gaps, and fixes; preserve historical failure evidence once with links.

- [ ] **39. Remove paperwork as acceptance.** Delete fixed rule-count targets, mandatory test
      filename inventories, source-text coverage guards, and blanket config-table requirements.
      Remove tests for deleted implementation details.

- [ ] **40. Accept the installed product.** Completion means required checks execute, planted
      defects produce useful findings, corrected inputs pass, user files survive, and representative
      project output is reviewed.

### Implementation gate before touching the app

This is the authoritative handoff gate for D-121. Fix-file numbers are subject grouping, not
permission to postpone dependencies.

Apply K-298 and K-299 before destructive lifecycle work.
Apply K-300 and K-308 before changing schemas and callers. Apply K-301 before accepting
recommended output. Apply K-303 through K-307 before relying on generation, packaging, or harness results.

Integrate
scenario tests from file 23 with their owning features. Complete file 22's code and package
validation before the handoff; only registry ownership, actual public publication, deployment,
and adoption-derived measurements remain external or post-adoption gates.

Implement coherent batches against the owning contracts, then run focused verification.
Resolve missing implementation details with those owners; no separate patch paperwork is required.

Record the source revision, candidate version, artifact hashes, command exit statuses, and CI
run URL (or the active bypass and deferred evidence) as evidence for this gate. All results
must refer to the same candidate revision:

1. Close the applicable fix acceptance criteria, including unit, integration, planted-repository,
   lifecycle recovery, snapshot, hook, documentation, and release-package tests. Run the full
   implemented unit/plugin, integration, and acceptance suites, and explicitly enable release
   suites after building their prerequisites. Measure coverage without an arbitrary quota.
   A conditional suite skipped for a required candidate platform is deferred evidence, not a pass.
1. Build all supported release targets and validate the launcher, platform packages, plugin,
   embedded resources, notices, schema, and sample install from the local registry.
1. Exercise supported-platform checks in CI when enabled. During the active bypass, record
   this evidence as deferred. A local macOS pass is not Windows or Linux evidence.
1. Run the candidate binary on gspot itself, with `level = "all"`, strict check coverage,
   no ignore entries, no local skip file, and no temporary rule disabling. Run
   `gspot check --no-cache`, `gspot check --stage manual --no-cache`, and `gspot doctor`.
1. Every required check must execute and pass. A missing tool, setup error, or skipped required
   check is not a clean result. Any fixes invalidate the previous result until rerun.
1. Verify apply is idempotent and install preserves tracked content in a disposable clean
   checkout. Build and check the manual there, including samples, links, reference contracts,
   and the asset acceptance requirements. Inspect unexpected tracked or untracked output.
1. Exercise real commit and pre-push hooks in test repository repositories, including rejection cases
   and existing-hook chaining. Do not create a dummy app commit to test the hooks of gspot itself.
1. When CI is enabled, read successful jobs for that exact revision, not merely the workflow
   configuration or an older green badge. During the active bypass, defer this requirement
   without starting or waiting for runs. Never describe deferred evidence as verified.
1. Repository pushes and commits still require the authority applicable to that implementation
   turn. This review authorizes neither.
1. As the last check before any authorized gspot commit, run `gspot check --staged`. A staged
   pass complements, and never replaces, the full candidate checks above.

### App handoff and branch replacement

The user authorizes deletion of the old local `chore/gspot` branch only after the gate above.
No second approval for that exact deletion is needed once its identity and gate are verified.
This is not authority to delete other branches, remote refs, uncommitted work, or ignored files.

Read-only inspection on September 20, 2026 found a clean checkout on `chore/gspot`, tip
`ca2594d1f`, and local `master` at `aa4358be4`, with `origin/HEAD` pointing to `origin/master`.
Four commits exist on the old branch beyond local `master`. These are observations, not frozen
execution inputs. Re-read status, branch tips, default-branch tracking, and worktrees when the
handoff begins. Inspect any changed branch history before deletion; do not discard new work
under the old authorization without establishing that it belongs to the obsolete migration.

Run read-only preflight from `/Users/dr_stone/Documents/work/yap-swift-app`:

```shell
git status --short --branch
git branch -vv
git worktree list
git symbolic-ref refs/remotes/origin/HEAD
git rev-parse chore/gspot master
git log --oneline master..chore/gspot
```

Proceed only with a clean tracked and untracked worktree and no other worktree using the old
branch. Do not use reset, clean, stash, or an automatic pull to manufacture that condition.
Record the full old tip and chosen base in the handoff report before deleting the ref. The
chosen base is local `master`, after checking that it is the intended app baseline and recording
its relation to the already available `origin/master`; do not silently change it to another ref.
If `chore/gspot-adoption` already exists, inspect and report it rather than overwriting it.

After these checks and the implementation gate, the exact local branch operations are:

```shell
git switch master
git branch -D chore/gspot
git switch -c chore/gspot-adoption master
```

The old branch's unmerged commits are deliberately discarded from its branch ref. The recorded
tip and local reflog can assist recovery while objects remain, but are not a permanent backup.
No remote deletion or push is part of this procedure. If interrupted, inspect current refs and
resume from the observed state; do not blindly repeat the deletion sequence.

Install the verified candidate launcher, platform package, and plugin through the isolated
local registry of D-158, never `file:../gspot` or a workspace import. Record the registry setup
command and artifact identity in the implementation handoff before using it. Keep credentials
and registry routing local to the process. Verify that generated configs and lockfiles contain
no machine-local dependency path, registry URL, or credential. A fresh install must resolve the
same candidate through the configured registry without changing tracked files.

Run `gspot init` and read the plan before accepting takeover. Read every resulting written or
removed file. Run `gspot check --no-cache`, `gspot check --stage manual --no-cache`, and
`gspot doctor`; record timings, findings, tool versions, retained files, and recovery behavior
in `GSPOT-MIGRATION.md`. Validate the hooks without pushing to the app remote. Keep app source
findings separate from gspot defects. Do not introduce baselines or ignores to manufacture green.

All gspot tests and self-lint must pass before this handoff. The existing app is not promised to
pass without app-source fixes, which remain outside this migration. Report those findings
honestly. A gspot crash, false positive, wrong location, missing required tool, lost policy,
unsafe mutation, or failed recovery blocks adoption completion. Fix it in gspot, rerun the gate,
and retry. Do not declare completion with such a defect merely added to the backlog.

Leave the app diff on `chore/gspot-adoption`, with no push. Commit only when authorized and after
its staged checks pass. Do not bypass hooks to create migration commits. Request direction if
app findings prevent a commit. Keep the validated migration uncommitted and leave its report available.

### Review status

The September 20, 2026 integrity review makes this architecture ready to start implementation
as a target specification. It does not claim that the code is complete or that every future
adoption finding is predictable. The implementation gate and app acceptance above remain
mandatory.

The historical review checked document links and requirement ownership. File counts and
fixed section templates are retired as acceptance criteria; current behavioral evidence
belongs to each fix owner.

External launch prerequisites remain explicit: registry ownership and publishing credentials,
CI access, supported-platform execution, and site hosting/domain access. An unavailable external
prerequisite blocks its gate, not the unrelated implementation work. No green test, release,
deployment, or app adoption is inferred from this documentation review.

## Every row, by fix file

Each named row links to its owning acceptance section, including rows grouped under another
ID. The September 20 reconciliation found exactly one owner for each named row.
Thirty-two requirements are locally complete; 296 named rows remain open.
Completed evidence stays in each owning acceptance section.
The nine cleanup entries refer to those owners and add no independent requirements. Historical
omissions and their current dispositions are recorded in the [audit](23-repository-audit.md#historical-requirement-dispositions).

### Delete First

[00-delete-first.md](fixes/00-delete-first.md)

- [ ] [D-129](fixes/00-delete-first.md#d-129-commands-and-flags-that-leave): Delete `gspot declare`, six of the seven lists of `gspot allow`, `uninstall --keep-hooks`, and `apply --check`. File explanations are implemented by `explain <path>`.
- [ ] [D-100](fixes/00-delete-first.md#d-100-the-lint-files-at-the-root-of-this-repository): Delete the twelve lint stubs at the root of this repository.
- [ ] [K-47](fixes/00-delete-first.md#d-100-the-lint-files-at-the-root-of-this-repository): Delete the nine `copy = true` stubs and `copyStubContent` (D-100).
- [ ] [K-100](fixes/00-delete-first.md#k-99-keys-and-settings-with-no-reader): Delete `limits.line_length`, `limits.trivial_ast_nodes` and `tools.trufflehog.verified_only`.
- [x] [K-102](fixes/00-delete-first.md#k-102-seven-plugin-rules): Retain the forwarding rule exports and options. The default config uses `no-call-through` once, with every supported function form covered; K-235 preserves other languages.
- [x] [K-187](fixes/00-delete-first.md#k-102-seven-plugin-rules): Retain both plugin folder rules for standalone users. The CLI uses the structure engine, with language and framework source claims and correction regressions.
- [ ] [K-188](fixes/00-delete-first.md#k-102-seven-plugin-rules): Preserve existing plugin exports and standalone behavior. Prove replacement enforcement on every affected surface before consolidating internals; keep custom rules where needed.
- [x] [K-111](fixes/00-delete-first.md#k-111-three-ways-to-silence-a-finding-become-one): Delete the `lint:justify` and `lint:allow-...` markers.
- [x] [K-115](fixes/00-delete-first.md#k-111-three-ways-to-silence-a-finding-become-one): Delete the `finding` key of `[[ignore]]`.
- [x] [K-119](fixes/00-delete-first.md#k-119-a-branch-for-an-engine-that-is-not-built): Delete the branch for an engine that is not built, and keep the comment openers and `UNPARSED_LIMIT` once.
- [x] [K-146](fixes/00-delete-first.md#k-146-the-word-corpus): Remove the word `corpus` from the 34 places in the source.
- [ ] [K-180](fixes/00-delete-first.md#k-180-manifest-keys-a-pin-and-a-runner-that-do-nothing): Delete the manifest keys `executable` and `ubi`, and the three readers of `ubi`.
- [ ] [K-240](fixes/00-delete-first.md#k-180-manifest-keys-a-pin-and-a-runner-that-do-nothing): Delete the runner value `uv` until a reference repository needs it.
- [x] [K-205](fixes/00-delete-first.md#k-205-generated-pages-that-git-tracks): The docs build runs `reference-pages.ts` first, the pages are git-ignored, and the `docs/generated` check goes.
- [ ] [K-259](fixes/00-delete-first.md#k-259-leftovers-in-gitignore): Drop the scratch entry from `.gitignore`, run pytest of the tests in their own folder, and move the managed block to the end of the file.
- [ ] [K-282](fixes/00-delete-first.md#k-282-the-order-works-against-itself): Delete a thing in the commit that builds what replaces it.
- [x] [K-290](fixes/00-delete-first.md#k-290-the-baseline-and-the-first-check): Delete the baseline, the first check of `init`, and every run that `add`, `upgrade`, and a level change start (D-165).

### The First Fixes

[01-first-fixes.md](fixes/01-first-fixes.md)

- [ ] [K-36](fixes/01-first-fixes.md#k-36-takeover-deletes-a-file-two-tools-read): Take `setup.cfg` and `tox.ini` off the sqlfluff path list, and never delete a file more than one tool reads (D-109).
- [ ] [K-156](fixes/01-first-fixes.md#k-156-a-check-deletes-untracked-sql-files): Run `drizzle-kit generate` over a copy in the cache and compare; never write into the tree, never run `git clean`.
- [ ] [K-159](fixes/01-first-fixes.md#k-156-a-check-deletes-untracked-sql-files): Make `express/openapi-fresh` write back the text it read, and never run `git checkout`.
- [ ] [K-257](fixes/01-first-fixes.md#k-257-a-full-disk-cuts-the-policy-in-half): Write every file through a temporary file and a rename, and let a failed cache write be one line on stderr.
- [ ] [K-252](fixes/01-first-fixes.md#k-257-a-full-disk-cuts-the-policy-in-half): Report a run whose report cannot be written in one line on stderr, and keep its findings and its exit code.
- [ ] [K-109](fixes/01-first-fixes.md#k-109-gspot-replaces-a-script-of-the-developer): Never inject a lifecycle script; replace an existing lint task only with explicit acceptance and recoverable originals.
- [ ] [K-147](fixes/01-first-fixes.md#k-147-one-wrong-line-stops-every-command): Run `check` with the rest of the config when one line is wrong, and report that line as a finding.
- [x] [K-206](fixes/01-first-fixes.md#k-206-two-pins-their-npm-package-never-had): An installer that numbers differently carries its own version beside its name, and a release test asks each registry for every pin.
- [x] [K-226](fixes/01-first-fixes.md#k-226-tsc--p-reads-nothing-in-a-project-with-references): The check builds references as authored in a disposable copy, including dependent declarations. Output paths must remain inside that copy.
- [ ] [K-229](fixes/01-first-fixes.md#k-229-list-items-cut-in-mid-sentence): The items are restored from the reference repositories. The lint of the rule files reports a list item that stops with no sentence end.
- [x] [K-234](fixes/01-first-fixes.md#k-234-the-suppressions-check-is-blind-in-four-languages): Let each manifest declare the suppression comment of its tool, and read that list for every comment style. Delete the table in `config/integrity.ts` (K-110).
- [x] [K-110](fixes/01-first-fixes.md#k-234-the-suppressions-check-is-blind-in-four-languages): Keep one list of suppression forms (K-234).
- [ ] [K-238](fixes/01-first-fixes.md#k-238-values-are-interpolated-without-destination-escaping): Validate semantic values and serialize strings, keys, paths, and comments for each destination format; test printable quotes and backslashes as well as forbidden controls.
- [ ] [K-241](fixes/01-first-fixes.md#k-241-nine-contradictions-between-rule-files-and-checks): Settle each of the nine contradictions in the rule file, on the side of the decision or the check. Test the rule names a rule file names against the templates.
- [ ] [K-246](fixes/01-first-fixes.md#k-246-a-check-that-no-preset-ships): Ship `integrity/generated-drift` in the structure preset. Build `integrity/generated-fresh` with `[[generated]]`, or take its name out of every document.
- [x] [K-250](fixes/01-first-fixes.md#k-250-libraries-the-documents-name-and-nothing-installs): Make the two SPDX packages and the Markdown parser dependencies that do their job. Use or drop each other library the two documents name.
- [ ] [K-251](fixes/01-first-fixes.md#k-251-two-commands-pass-flags-their-tool-lacks): Drop `--skip-updates` from the dotenv fixer, give v8r its config through `V8R_CONFIG_FILE`, and fail the contract test on a flag the pinned tool lacks.
- [ ] [K-253](fixes/01-first-fixes.md#k-253-the-workflow-gspot-writes-breaks-the-rule-file-gspot-installs): Make the workflow gspot writes follow `GITHUB-ACTIONS.md`: a pinned runner image, a timeout, and a concurrency group. Name the tasks as D-116 decides.
- [ ] [K-261](fixes/01-first-fixes.md#k-261-good-examples-that-fail-the-checks-beside-them): Correct every good example that fails a check, and make `rules/lint` run the linter of the preset over each fenced good example.

### Takeover and Detection

[02-takeover.md](fixes/02-takeover.md)

- [ ] [K-193](fixes/02-takeover.md#k-193-takeover-drops-what-a-repository-turned-on): Resolve every governed file, preserve path-specific rules through overrides and ignores, and retain original configuration whenever behavior cannot be carried without loss.
- [ ] [K-41](fixes/02-takeover.md#k-193-takeover-drops-what-a-repository-turned-on): Read disabled ESLint rules from the rules table of the old config alone (K-193).
- [ ] [K-182](fixes/02-takeover.md#k-182-one-file-proposes-a-whole-language-preset): A language that has a project file is proposed from that file, as D-108 proposes a scope: `pyproject.toml`, `package.json`, or `Package.swift`.
- [ ] [K-214](fixes/02-takeover.md#k-182-one-file-proposes-a-whole-language-preset): Init says that the folder is no git repository, and a preset whose checks all need git is not proposed there.
- [ ] [K-247](fixes/02-takeover.md#k-182-one-file-proposes-a-whole-language-preset): Recommend a tool preset only where the repository holds that tool, and write a stub only where D-100 allows one. Read a declared workspace from `package.json` with no lockfile.
- [ ] [K-120](fixes/02-takeover.md#k-120-init-reads-one-prettier-form): Read the format of a repository from every Prettier form, `.editorconfig` and Biome before proposing one.
- [ ] [K-126](fixes/02-takeover.md#k-126-dependencies-from-one-python-form): Read dependencies from `requirements.txt`, Poetry tables and `Pipfile` too.
- [ ] [K-128](fixes/02-takeover.md#k-128-file-tags-for-component-files): D-140 adds the two component endings.
- [ ] [K-42](fixes/02-takeover.md#k-42-fixers-get-every-file-on-one-command-line): Send fixer files through `fileBatches`, and report a fixer that exits nonzero.
- [ ] [K-158](fixes/02-takeover.md#k-42-fixers-get-every-file-on-one-command-line): Closes with K-42: batch the pages and stylesheets.
- [ ] [K-76](fixes/02-takeover.md#k-76-mise-tasks-that-are-files): Read mise tasks from `.mise/tasks/` files too.
- [ ] [K-78](fixes/02-takeover.md#k-76-mise-tasks-that-are-files): Check the gspot line of the hooks for every value of `hooks.tool`.
- [ ] [K-237](fixes/02-takeover.md#k-237-packages-that-are-no-lint-tools): The list holds the packages of tools a preset pins, read from the manifests, and nothing else.

### Hooks, Explicit Setup, and Shared Manifests

[03-hooks.md](fixes/03-hooks.md)

- [ ] [K-56](fixes/03-hooks.md#k-56-init-never-reads-what-a-hook-calls): Make init read what a hook calls, and put the gspot line in that task (D-114).
- [ ] [K-57](fixes/03-hooks.md#k-56-init-never-reads-what-a-hook-calls): Never set `core.hooksPath` where a tracked file sets it, and say when a clone runs no hooks (D-115).
- [ ] [K-58](fixes/03-hooks.md#k-58-command-names-a-team-already-types): Propose new bodies for the `lint` and `format` names a repository has, and write `gspot:*` only where none exists (D-116).
- [ ] [K-59](fixes/03-hooks.md#k-59-lint-tables-in-a-shared-manifest): Read lint tables of `pyproject.toml` and lint keys of `package.json`, carry them, and list them under remove by hand (D-117).
- [ ] [K-60](fixes/03-hooks.md#k-60-a-failing-hook-names-no-way-out): End a failing hook run with `git commit --no-verify` and the command that reproduces it.
- [ ] [K-292](fixes/03-hooks.md#k-292-local-hooks-must-keep-executing): Never set `core.hooksPath`; compose hooks with reachable dispatch, argument forwarding, independent stdin replay, failure propagation, and ownership-aware restoration (D-167).

### Slow Checks and the Cache

[04-speed.md](fixes/04-speed.md)

- [ ] [K-43](fixes/04-speed.md#k-43-every-check-hashes-all-of-gspot): Hash `.gspot/` once for a run, key each check on the config files it names, and hash files without base64 (D-102).
- [ ] [K-44](fixes/04-speed.md#k-43-every-check-hashes-all-of-gspot): Drop cache entries older than 30 days, and move the Swift build folder to the cache folder of the platform (D-102).
- [ ] [K-71](fixes/04-speed.md#k-43-every-check-hashes-all-of-gspot): Closes with K-44.
- [ ] [K-53](fixes/04-speed.md#k-53-init-opens-three-sessions-applies-twice-and-runs-every-check): Make init open one session, apply once, install the tools, and run no check (D-165).
- [ ] [K-127](fixes/04-speed.md#k-53-init-opens-three-sessions-applies-twice-and-runs-every-check): Make `upgrade` run no check, and print an image finding as one line.
- [ ] [K-138](fixes/04-speed.md#k-138-two-full-parses-for-the-naming-checks): Parse each source file once for both naming checks.
- [ ] [K-148](fixes/04-speed.md#k-138-two-full-parses-for-the-naming-checks): One parsed set for a scope and a run, shared the way the shell index is.
- [x] [K-143](fixes/04-speed.md#k-143-a-clean-swift-build-on-every-run): Build Swift incrementally for `swift/build`, and keep the clean build for the analyzer at the `manual` stage (D-122).
- [ ] [K-162](fixes/04-speed.md#k-162-one-git-process-for-each-migration): Read migration history with one `git ls-tree` and one `git diff`.
- [ ] [K-176](fixes/04-speed.md#k-176-vale-starts-once-for-every-source-file): Map the borrowed extensions under `[formats]` in `vale.ini`, so every file goes by path in one run for each extension.
- [ ] [K-196](fixes/04-speed.md#k-196-commit-stage-checks-that-read-a-whole-scope): D-102 gets its measure. The timed test of the tools table runs each check on the planted repository of its preset, and a check over the ceiling is at `push`.

### The Files gspot Writes

[05-written-files.md](fixes/05-written-files.md)

- [ ] [A-5](fixes/05-written-files.md#a-5-a-skip-file-hid-a-failing-gate): End `init` by naming the fix run, and delete `gspot.local.toml` with everything that reads it (D-173).
- [ ] [K-72](fixes/05-written-files.md#k-72-generated-files-show-as-code-in-a-pull-request): Add one managed block to `.gitattributes`: `.gspot/** linguist-generated`.
- [ ] [K-118](fixes/05-written-files.md#k-118-apply-deletes-files-it-did-not-write): Apply one ownership contract across apply, remove, and uninstall; preserve unmarked files and modified managed outputs, including the hand-made gitleaks baseline.
- [ ] [K-296](fixes/05-written-files.md#k-296-nobody-wrote-down-what-the-gitignore-block-holds): Build the `.gitignore` block from the manifests, and create the file where none exists (D-170).

### The Config Text and Scopes

[06-config.md](fixes/06-config.md)

- [ ] [K-51](fixes/06-config.md#k-51-scope-settings-as-inline-tables): Write scope settings as sub-tables, and fix the writer so both forms load (D-106).
- [ ] [K-88](fixes/06-config.md#k-88-src-is-refused-where-src-is-wanted): Accept `src` as `src/**`, and allow a scope inside a scope.
- [ ] [K-89](fixes/06-config.md#k-89-working-words-of-the-code-reach-a-person): Rename `PolicyScopeLayer`, and keep `slot`, `surface`, `direction` and `exposes` out of text a person reads.
- [ ] [K-215](fixes/06-config.md#k-215-one-idea-many-words-in-setting-names): D-144, with the table in [19-names.md](19-names.md) and a test over the manifests.
- [ ] [K-224](fixes/06-config.md#k-215-one-idea-many-words-in-setting-names): Each changes in the commit of its rename.
- [ ] [K-228](fixes/06-config.md#k-215-one-idea-many-words-in-setting-names): The two switches go, and the name becomes `xcode/asset-catalogs`.
- [ ] [K-222](fixes/06-config.md#k-222-two-tools-set-the-yaml-indent-in-opposite-ways): The YAML block leaves the EditorConfig template, so one value holds for every tool.
- [ ] [K-48](fixes/06-config.md#k-48-scopes-from-two-workspace-forms-only): Propose a scope for every folder with a project file, and keep scope files under `.gspot/<scope>/` (D-108).

### Levels

[07-levels.md](fixes/07-levels.md)

- [ ] [K-198](fixes/07-levels.md#k-198-every-template-starts-at-the-strictest-setting): Each template renders by level. `recommended` holds the recommended set of each tool and the rules that find a defect, and `all` holds the rest (D-119, D-126).
- [ ] [K-52](fixes/07-levels.md#k-198-every-template-starts-at-the-strictest-setting): Mark each opt-in SwiftLint rule `recommended` or `all`, and render by level (D-110).
- [ ] [K-221](fixes/07-levels.md#k-198-every-template-starts-at-the-strictest-setting): With K-198, each template renders by level.
- [x] [K-101](fixes/07-levels.md#k-101-the-plugin-calls-house-style-recommended): Layout preferences are opt-in in standalone and generated ESLint configurations. Broader usefulness remains K-301.
- [ ] [K-135](fixes/07-levels.md#k-135-one-shell-check-holds-sixteen-rules): Split `structure/bash-interpreter` so strict mode and the `mktemp` trap are checks of their own at `recommended`.
- [ ] [K-141](fixes/07-levels.md#k-135-one-shell-check-holds-sixteen-rules): Move the default-owner, underscore, doc-section and ordering rules of shell to the `all` level.
- [ ] [K-142](fixes/07-levels.md#k-135-one-shell-check-holds-sixteen-rules): Keep the shell defect checks at `recommended`: discarded failures, unchecked `cd`, recursive remove, broad `pkill`, `mktemp` with no trap, unread arguments, and duplicate or unused functions.
- [ ] [K-123](fixes/07-levels.md#k-135-one-shell-check-holds-sixteen-rules): Delete the `run_ssh`, `_CFG_<NAME>_READY`, `nvidia-smi` and `/root/.cache` checks from the bash preset.
- [ ] [K-152](fixes/07-levels.md#k-152-seven-python-checks-of-one-style): Move the seven Python style checks to the `all` level.
- [x] [K-151](fixes/07-levels.md#k-152-seven-python-checks-of-one-style): Run `integrity/dependency-ownership` only where the scope holds a Python lockfile (`uv.lock`, `poetry.lock`, `pdm.lock`).
- [ ] [K-227](fixes/07-levels.md#k-152-seven-python-checks-of-one-style): The docstring style is read from the `[tool.pydoclint]` or `[tool.ruff.lint.pydocstyle]` table of the project, and both checks belong to the `all` level. The pytest preset names `pytest-cov` as a tool.
- [ ] [K-174](fixes/07-levels.md#k-174-strict-defaults-of-one-owner-in-five-presets): The check belongs to the `all` level.
- [ ] [K-161](fixes/07-levels.md#k-174-strict-defaults-of-one-owner-in-five-presets): Move `sql/block-comments` to the `all` level, and teach the SQL reader block comments once (K-178).
- [ ] [K-167](fixes/07-levels.md#k-174-strict-defaults-of-one-owner-in-five-presets): The postgres preset ships `client_schemas = []`, and the supabase preset sets `["public"]`, which a platform preset may do.
- [ ] [K-112](fixes/07-levels.md#k-174-strict-defaults-of-one-owner-in-five-presets): Keep one README contents rule, at the `all` level, that does not clash with the banned heading.
- [ ] [K-200](fixes/07-levels.md#k-174-strict-defaults-of-one-owner-in-five-presets): The preset is `proposed`, as `security` and `licenses` are, and the scope list holds what `tools.commitlint.scopes` names and nothing else.
- [ ] [K-175](fixes/07-levels.md#k-175-seven-vale-packages-and-93-rules-turned-off): `recommended` runs the `gspot` style alone, which is what `WRITING.md` tells an agent. The `all` level adds the packages. The off list and the vocabulary move into the prose preset.
- [x] [K-201](fixes/07-levels.md#k-201-the-shared-tsconfig-sets-how-a-project-builds): The base holds the flags that only add errors, and every option that changes emit or resolution stays in the `tsconfig.json` of the repository.
- [ ] [K-218](fixes/07-levels.md#k-218-semgrep-packs-that-name-the-functions-of-one-repository): A shipped pack names the API of its framework and nothing else. A rule that names a function of one repository moves into that repository, under `tools.semgrep.rules`, in its migration.
- [ ] [K-93](fixes/07-levels.md#k-93-defaults-that-assume-one-kind-of-project): Detect the build command, the output folder, the assets folder and the Swift destination, or ask.
- [ ] [K-230](fixes/07-levels.md#k-230-rule-files-do-not-follow-the-levels): A section of a rule file carries the level of the checks it describes, and the assembler leaves out a section above the level of the repository. `REACT.md` names the file after its component.

### Frameworks, Naming, and Lint Tools

[08-frameworks.md](fixes/08-frameworks.md)

- [ ] [K-217](fixes/08-frameworks.md#k-217-gspot-overwrites-the-eslint-of-the-developer): D-145.
- [ ] [K-239](fixes/08-frameworks.md#k-217-gspot-overwrites-the-eslint-of-the-developer): Closes with D-145: stop writing `prepare` and the pins into `package.json`.
- [ ] [K-207](fixes/08-frameworks.md#k-207-the-pinned-plugins-do-not-fit-the-pinned-eslint): D-142. The pin is the newest ESLint every shipped plugin supports, and the registry test of K-206 reads each range.
- [x] [K-213](fixes/08-frameworks.md#k-207-the-pinned-plugins-do-not-fit-the-pinned-eslint): On ESLint 9 (D-142) the setting is `detect`, and `installedReact` goes.
- [ ] [K-208](fixes/08-frameworks.md#k-208-the-shared-rules-do-not-reach-a-component): D-137. The list of code files holds the endings a framework claims, and one ESLint check reads it.
- [ ] [K-209](fixes/08-frameworks.md#k-208-the-shared-rules-do-not-reach-a-component): D-138. The list stands in the manifest with its reasons, and a test compares the final config of a component file with that of a plain `ts` file.
- [ ] [K-210](fixes/08-frameworks.md#k-208-the-shared-rules-do-not-reach-a-component): D-140, through `takes_over`, `claims`, and the plugins of each tool.
- [ ] [K-211](fixes/08-frameworks.md#k-211-framework-presets-are-thin-beside-what-exists): D-141, and each rule file grows to what its linters enforce.
- [ ] [K-212](fixes/08-frameworks.md#k-211-framework-presets-are-thin-beside-what-exists): The `jest` preset of D-141, with the same ten rules.
- [ ] [K-50](fixes/08-frameworks.md#k-50-framework-names-in-the-shared-naming-policy): Move framework names out of the shared naming policy into `[[naming.rules]]` of each framework preset (D-112).
- [ ] [K-133](fixes/08-frameworks.md#k-50-framework-names-in-the-shared-naming-policy): Move the `handle` exception out of the naming engine into the react preset (D-112).
- [ ] [K-136](fixes/08-frameworks.md#k-50-framework-names-in-the-shared-naming-policy): Accept PascalCase for component functions and files through `[[naming.rules]]` of each framework preset, and test react with naming on.
- [ ] [K-49](fixes/08-frameworks.md#k-49-the-prefix-rule-reads-kebab-case-alone): Split the prefix with `naming/split.ts`, count source files alone as peers, and delete the copy in the plugin (D-111).
- [ ] [K-137](fixes/08-frameworks.md#k-137-the-extractor-skips-every-awaited-value): Skip only a dynamic `import()` in the TypeScript extractor, not every awaited value.
- [ ] [K-233](fixes/08-frameworks.md#k-233-the-css-preset-claims-files-it-cannot-read): The preset claims `.css` alone, and a `scss` preset that pins `stylelint-config-standard-scss` arrives when the owner or a reference repository asks for it (D-136).
- [ ] [K-236](fixes/08-frameworks.md#k-236-two-linters-that-exist-and-that-no-manifest-holds): `licenses/npm` becomes one check that runs the scanner gspot already pins, and the supabase preset gains the lint at the `manual` stage.
- [ ] [K-80](fixes/08-frameworks.md#k-236-two-linters-that-exist-and-that-no-manifest-holds): Closes with K-236.
- [ ] [K-248](fixes/08-frameworks.md#k-248-the-ledger-drops-rules-of-the-reference-repositories): Carry the iOS and the Python Semgrep packs first. Build each other ledger row that names an unbuilt check, or mark it cut with its reason.
- [ ] [K-249](fixes/08-frameworks.md#k-249-eight-pins-older-than-what-a-reference-repository-runs): Raise the eight pins that sit below what a reference repository runs, and fail the release test on a pin below the floor the ledger records.
- [ ] [K-256](fixes/08-frameworks.md#k-256-swift-test-files-held-to-production-rules): Write a nested SwiftLint file over the test folders the xctest preset claims, with the three rules off.
- [ ] [K-264](fixes/08-frameworks.md#k-264-a-fresh-clone-gets-no-tools-and-no-hooks): Build `gspot install`, call it from `init`, `upgrade`, and both CI jobs, and name it in every message about a missing tool (D-156).
- [ ] [K-265](fixes/08-frameworks.md#k-264-a-fresh-clone-gets-no-tools-and-no-hooks): Serve the launcher and the plugin from the registry of the harness, reached through `GSPOT_REGISTRY` (D-158).
- [ ] [K-266](fixes/08-frameworks.md#k-264-a-fresh-clone-gets-no-tools-and-no-hooks): Install the Python tools from a generated `.gspot/pyproject.toml` into `.gspot/.venv` with uv (D-157).
- [ ] [K-283](fixes/08-frameworks.md#k-264-a-fresh-clone-gets-no-tools-and-no-hooks): Count in the plan the binaries that need mise, and show the one line that installs mise and then all of them.
- [ ] [K-267](fixes/08-frameworks.md#k-267-the-install-inside-gspot-does-not-see-the-repository-around-it): Pass the registry settings of the root to the install under `.gspot/`, and keep it a project of its own under each package manager.
- [ ] [K-268](fixes/08-frameworks.md#k-268-the-tools-of-the-developer-now-read-gspot): Print one ignore hint for each tool of the developer that reads `.gspot/`, and report advisories in the lockfiles of gspot apart.
- [ ] [K-297](fixes/08-frameworks.md#k-297-nothing-says-what-a-machine-without-mise-node-or-uv-gets): Never block the setup on a missing tool, and install the npm tools with bun where no JavaScript exists (D-171, D-172).

### The Manifest Owns What the Preset Knows

[09-manifests.md](fixes/09-manifests.md)

- [ ] [K-79](fixes/09-manifests.md#k-79-one-file-registers-130-analyses-under-names-of-their-own): Register each analysis from the manifest of its preset, name it after its check name, and split `integrity/` by what it holds.
- [ ] [K-39](fixes/09-manifests.md#k-39-takeover-tables-that-name-29-tools): Replace `OWNER_PRESET`, `CHECK_BY_TOOL` and the nine tool tables of `propose.ts` with keys the manifests hold.
- [ ] [K-14](fixes/09-manifests.md#k-39-takeover-tables-that-name-29-tools): Move every owner row and check row of takeover into the manifest of its preset (K-39).
- [ ] [K-107](fixes/09-manifests.md#k-39-takeover-tables-that-name-29-tools): Replace the hand-written fields of `CarriedLists` with a map keyed by tool, filled from the manifests (K-39).
- [ ] [K-13](fixes/09-manifests.md#k-39-takeover-tables-that-name-29-tools): Delete `gspot allow gitleaks`, `osv` and `licenses` with the trim of D-131.
- [ ] [K-38](fixes/09-manifests.md#k-38-tool-names-flags-and-banners-in-the-core): Move each tool name, flag, banner and check name the core holds into the manifest of its preset.
- [ ] [K-17](fixes/09-manifests.md#k-38-tool-names-flags-and-banners-in-the-core): Take the preset names `swift`, `prose`, `typescript` and `commits` out of the core; a manifest key says what the core inferred from the name.
- [ ] [K-85](fixes/09-manifests.md#k-38-tool-names-flags-and-banners-in-the-core): Move the four version flags into `version_command` of their manifests, and hint the install of the runner the repository uses.
- [ ] [K-113](fixes/09-manifests.md#k-38-tool-names-flags-and-banners-in-the-core): Give a manifest a key for the page of a rule, and delete `TOOL_RULE_SOURCES`.
- [ ] [K-177](fixes/09-manifests.md#k-38-tool-names-flags-and-banners-in-the-core): The message comes from the install hint.
- [ ] [K-203](fixes/09-manifests.md#k-38-tool-names-flags-and-banners-in-the-core): The word list comes from the manifests.
- [ ] [K-197](fixes/09-manifests.md#k-197-one-template-holds-the-rules-of-seven-presets): A fragment exports its selectors, and the template joins the selectors of every selected fragment into the one rule. The javascript template then names no library (D-139).
- [ ] [K-223](fixes/09-manifests.md#k-197-one-template-holds-the-rules-of-seven-presets): D-139 covers them, and its test reads every template for a call of `has(`.
- [ ] [K-199](fixes/09-manifests.md#k-197-one-template-holds-the-rules-of-seven-presets): No template holds a default.
- [ ] [K-220](fixes/09-manifests.md#k-197-one-template-holds-the-rules-of-seven-presets): The entry list holds the entries the detected framework has, and what this repository needs stands in its own `tools.knip.entry`.
- [ ] [K-105](fixes/09-manifests.md#k-105-the-shape-of-the-config-is-written-twice): Infer the config types from the zod schema, and keep each list of hook tools, runners, and CI providers once.
- [ ] [K-183](fixes/09-manifests.md#k-105-the-shape-of-the-config-is-written-twice): The zod schema is the one owner, and the types are inferred from it.
- [ ] [K-106](fixes/09-manifests.md#k-105-the-shape-of-the-config-is-written-twice): Move test-only types out of the types of the binary, and delete the two stale doc comments.
- [ ] [K-55](fixes/09-manifests.md#k-55-constants-written-more-than-once): Keep the default hooks folder name in one constant.
- [ ] [K-77](fixes/09-manifests.md#k-55-constants-written-more-than-once): Keep the path of the mise file and of `.gspot/hooks` in one constant each.
- [ ] [K-124](fixes/09-manifests.md#k-55-constants-written-more-than-once): Keep one `HOOK_DIRECTORIES` list.
- [ ] [K-131](fixes/09-manifests.md#k-55-constants-written-more-than-once): Keep `JSON_INDENT` and the mise file path once each.
- [ ] [K-165](fixes/09-manifests.md#k-55-constants-written-more-than-once): Keep the five release targets in one list, and stop embedding the `schema/` folder nobody reads.
- [ ] [K-94](fixes/09-manifests.md#k-55-constants-written-more-than-once): Closes with K-169.
- [ ] [K-169](fixes/09-manifests.md#k-55-constants-written-more-than-once): It moves to `profile/schema.ts`.
- [ ] [K-24](fixes/09-manifests.md#k-24-small-duplicates-inside-the-engines): Rename `bashText`, `bashList` and `bashSetting` of the structure context after what they read, for every language.
- [ ] [K-139](fixes/09-manifests.md#k-24-small-duplicates-inside-the-engines): Share one `add` function and one label table across the extractors, and pick a grammar from a table.
- [ ] [K-171](fixes/09-manifests.md#k-24-small-duplicates-inside-the-engines): Every check gspot owns counts code lines through `structure/code-lines.ts`, the summary says which languages a tool counts, and the pair of constants goes.
- [ ] [K-190](fixes/09-manifests.md#k-24-small-duplicates-inside-the-engines): One helper in `files.ts` takes the check and returns the listeners.
- [ ] [K-40](fixes/09-manifests.md#k-40-the-init-proposal-holds-values-of-one-repository): Propose the types folder and the commit scopes from what the repository holds; write no `api/types`, `root`, `hooks` or `deps` by default.
- [ ] [K-179](fixes/09-manifests.md#k-179-general-rule-files-go-into-every-repository): A general file that a preset lists installs with that preset, and the general files no preset lists install always. The core names no folder.
- [ ] [K-232](fixes/09-manifests.md#k-179-general-rule-files-go-into-every-repository): The nextjs preset lists its second file. The swift preset lists the two framework files where the project imports that framework. A file with no preset to carry it is deleted (D-134) until a preset asks for it.
- [ ] [K-231](fixes/09-manifests.md#k-231-guides-that-are-the-notes-of-one-product): With K-203, a language or framework file says what holds for every project of that kind. The rest moves into the repository it came from, during its migration.
- [ ] [K-260](fixes/09-manifests.md#k-231-guides-that-are-the-notes-of-one-product): Cut each of the nine guides down to the rules of its library, and take every passage about one product out.
- [ ] [K-242](fixes/09-manifests.md#k-231-guides-that-are-the-notes-of-one-product): Move the working habits of the owner out of the general rule files into a profile, and add `quality/` to the words the rules lint refuses.
- [ ] [K-262](fixes/09-manifests.md#k-231-guides-that-are-the-notes-of-one-product): Write the six cut items of `DOCKER.md` and the broken sentences whole, and take each habit of the owner out of the twelve guides.
- [x] [K-255](fixes/09-manifests.md#k-255-one-check-name-shipped-by-two-presets): Ship `i18n/locales` and its one setting from the i18n preset alone, and make the nextjs preset recommend i18n.
- [x] [G-13](fixes/09-manifests.md#g-13-two-conventions-for-constants): Retired mandatory directory symmetry. Keep local constants with consumers and extract only real shared contracts.

### Tests

[10-tests.md](fixes/10-tests.md)

- [ ] [T-27](fixes/10-tests.md#t-27-the-harness-lets-a-failed-init-pass): `install()` expects exit 0 when every tool of the install is on the `PATH` it was given, and `plant()` fails when its pattern is absent.
- [ ] [T-4](fixes/10-tests.md#t-27-the-harness-lets-a-failed-init-pass): Use `install()` in the seven tests that run `init` through `run()`.
- [ ] [T-8](fixes/10-tests.md#t-27-the-harness-lets-a-failed-init-pass): Fail with a message about the machine when `toolsPath` cannot find a tool.
- [ ] [T-21](fixes/10-tests.md#t-27-the-harness-lets-a-failed-init-pass): The harness owns one builder of a whole `EngineInput`, and the four tests use it.
- [x] [T-9](fixes/10-tests.md#t-27-the-harness-lets-a-failed-init-pass): Retired mandatory tests/config placement; T-27 retains failed-setup and restoration acceptance.
- [ ] [T-24](fixes/10-tests.md#t-24-the-tests-install-the-way-no-developer-does): The planted installs of D-113 cover each value of `--runner`, `--hooks`, and `--ci` once, and one of them starts from a repository that has hooks and mise tasks.
- [ ] [T-1](fixes/10-tests.md#t-24-the-tests-install-the-way-no-developer-does): Add a planted install with the mise runner.
- [ ] [T-2](fixes/10-tests.md#t-24-the-tests-install-the-way-no-developer-does): Add a planted default `init` that runs in every test run, and drop `--without` where a preset is tested.
- [ ] [T-32](fixes/10-tests.md#t-24-the-tests-install-the-way-no-developer-does): In the release test of K-206, install the pins of every npm preset into an empty folder with each package manager, and run one check there.
- [ ] [T-3](fixes/10-tests.md#t-3-planted-cases-the-adoption-findings-need): Plant two scopes of different languages, a nested scope, and a scope outside a workspace.
- [ ] [T-6](fixes/10-tests.md#t-3-planted-cases-the-adoption-findings-need): Plant snake_case and PascalCase siblings for the prefix rule.
- [ ] [T-7](fixes/10-tests.md#t-3-planted-cases-the-adoption-findings-need): Plant `setup.cfg`, a `hooks/` folder of source files, `.mise/tasks/`, and hooks that must keep running.
- [ ] [T-13](fixes/10-tests.md#t-3-planted-cases-the-adoption-findings-need): Plant a hook that calls a task, a setup task that sets the hooks path, a fresh clone, a `[tool.ruff]` table, and a `lint` script.
- [ ] [T-28](fixes/10-tests.md#t-28-checks-that-no-test-makes-fail): One planted defect for each, and the ones that need the network or Docker run in the `manual` job of CI.
- [ ] [T-17](fixes/10-tests.md#t-28-checks-that-no-test-makes-fail): Closes with T-28.
- [ ] [T-14](fixes/10-tests.md#t-28-checks-that-no-test-makes-fail): Make the guard test pass only for a check name inside a planted case that expects exit 1.
- [ ] [T-30](fixes/10-tests.md#t-28-checks-that-no-test-makes-fail): One case for each preset, which expects the message of its own selector and exit 1.
- [ ] [G-2](fixes/10-tests.md#t-28-checks-that-no-test-makes-fail): Exercise actual check defects and corrected inputs; retain meaningful engine behavior tests and delete empty test folders.
- [ ] [T-29](fixes/10-tests.md#t-29-expectations-that-any-output-holds): Each expects the rule name or the sentence of its finding.
- [ ] [T-26](fixes/10-tests.md#t-29-expectations-that-any-output-holds): Each expects the rule or the sentence of its finding, as the other cases do.
- [ ] [T-5](fixes/10-tests.md#t-29-expectations-that-any-output-holds): Closes with T-29.
- [ ] [T-18](fixes/10-tests.md#t-29-expectations-that-any-output-holds): Expect a status or a finding, not the check name, in the two expectations.
- [ ] [T-23](fixes/10-tests.md#t-23-folders-and-analyses-with-no-unit-test): Give each analysis that reads text a unit test on a text, with no tool, and no repository.
- [ ] [T-10](fixes/10-tests.md#t-23-folders-and-analyses-with-no-unit-test): Closes with T-23.
- [ ] [T-15](fixes/10-tests.md#t-23-folders-and-analyses-with-no-unit-test): Add cases to `require-server-only` and `tests-directory-contents`.
- [ ] [T-16](fixes/10-tests.md#t-23-folders-and-analyses-with-no-unit-test): Add edge cases to the 18 unit test files that hold one input each.
- [ ] [T-19](fixes/10-tests.md#t-19-no-test-reads-the-shipped-policy-over-ordinary-code): One test for each language runs the shipped policy over a short file written the way that language and its frameworks are written, and expects no finding.
- [ ] [T-33](fixes/10-tests.md#t-19-no-test-reads-the-shipped-policy-over-ordinary-code): Generated and established reference projects get a usefulness review of each recommended finding before message/count snapshots; no unexplained house-style finding is accepted (K-301).
- [ ] [K-28](fixes/10-tests.md#k-28-the-eslint-template-has-411-lines-and-its-test-has-21): Test the ESLint template by resolving the config for one file of each file class and comparing rule lists.
- [ ] [T-36](fixes/10-tests.md#t-36-no-test-holds-a-generated-file-byte-for-byte): Exercise generated configuration through its pinned consumer. Keep exact-output snapshots only for meaningful serialization contracts.
- [ ] [T-12](fixes/10-tests.md#t-12-no-test-measures-time): Add a timed test with a ceiling over a planted repository of 5,000 files.
- [ ] [T-22](fixes/10-tests.md#t-22-tests-that-read-a-list-written-by-hand): The test reads the commands from the program, and looks for each in both scripts.
- [ ] [T-25](fixes/10-tests.md#t-22-tests-that-read-a-list-written-by-hand): Read the version from the one version source in the two release tests.
- [x] [T-31](fixes/10-tests.md#t-31-test-files-named-after-folders-that-are-gone): Retired filename-only renames. T-34 retains the real Xcode project requirement.
- [x] [T-11](fixes/10-tests.md#t-31-test-files-named-after-folders-that-are-gone): Retired filename-only renames under T-31.
- [ ] [T-34](fixes/10-tests.md#t-31-test-files-named-after-folders-that-are-gone): The test repository is a project Xcode generated.
- [ ] [T-20](fixes/10-tests.md#t-20-tests-that-change-with-their-subject): Change the four tests that expect a defect, each in the commit that fixes its defect.
- [ ] [T-35](fixes/10-tests.md#t-20-tests-that-change-with-their-subject): Each of these changes in the commit that changes its subject (D-129 to D-133, D-144, D-165).

### Checks That Assume One Layout

[11-layouts.md](fixes/11-layouts.md)

- [ ] [K-149](fixes/11-layouts.md#k-149-checks-read-the-whole-repository-and-ignore-their-scope): Hand a check the files of its scope in the engine input, and let only a `runs = "once"` check reach the whole repository.
- [ ] [K-155](fixes/11-layouts.md#k-149-checks-read-the-whole-repository-and-ignore-their-scope): Closes with K-149; move the svgo byte check to `all`.
- [ ] [K-163](fixes/11-layouts.md#k-149-checks-read-the-whole-repository-and-ignore-their-scope): Find `supabase/config.toml` inside the scope the check runs in.
- [ ] [K-144](fixes/11-layouts.md#k-144-swift-files-compared-by-name-and-snapshots-by-one-layout): Compare Swift files by path in `xcode/orphan-sources`, move `xcode/test-plan` to `all`, and give reference images a layout setting.
- [ ] [K-90](fixes/11-layouts.md#k-144-swift-files-compared-by-name-and-snapshots-by-one-layout): Check the reference image layout against the real test files in the redo of the app.
- [ ] [K-150](fixes/11-layouts.md#k-144-swift-files-compared-by-name-and-snapshots-by-one-layout): Find Swift tests by their imports and attributes, and read the reason of a skipped test as text.
- [ ] [K-153](fixes/11-layouts.md#k-153-python-modules-named-from-the-repository-root): Name modules from the package roots the project declares (`[tool.setuptools]`, `[tool.hatch]`, a `src/` folder, the scope), and plant a cycle under `src/` in the test.
- [ ] [K-154](fixes/11-layouts.md#k-154-the-static-site-checks-build-inside-the-working-tree): Build the site into a folder of the cache, with the command of the package manager the repository uses, parsed the way a shell parses it.
- [ ] [K-160](fixes/11-layouts.md#k-160-every-sql-file-is-parsed-as-postgres): The check runs only where the dialect is `postgres`, and init proposes the dialect from what it finds (a `supabase/` folder, `pg` in the dependencies, a `mysql2` dependency).
- [ ] [K-184](fixes/11-layouts.md#k-184-a-dockerignore-beside-every-dockerfile): The check accepts the places Docker reads, which are the folder of the Dockerfile, the file named after it, and the root of the scope.
- [ ] [K-191](fixes/11-layouts.md#k-191-plugin-rule-defaults-that-are-folders-of-one-repository): A default names no folder. The template passes what the config of the repository says, and a rule with nothing passed reports nothing.

### The Menu, the Questions, and the Agent Block

[12-menu.md](fixes/12-menu.md)

- [ ] [K-62](fixes/12-menu.md#k-62-no-command-lists-what-exists-and-what-is-on): Build `gspot list` (D-118).
- [ ] [K-63](fixes/12-menu.md#k-62-no-command-lists-what-exists-and-what-is-on): Give every check and every opt-in rule a `level`, and delete `[inspection] strict` as the switch (D-119).
- [ ] [K-64](fixes/12-menu.md#k-64-one-list-of-every-proposed-preset): Ask the preset question in three groups (D-120).
- [ ] [K-65](fixes/12-menu.md#k-65-the-managed-block-is-a-padded-table): Write the managed block as a plain list of the selected presets (A-25).

### Plain Words and Renames

[13-words.md](fixes/13-words.md)

- [x] [K-54](fixes/13-words.md#k-54-render-and-synced): Retired occurrence-count rename campaign; rename only misleading contracts or effects.
- [ ] [K-66](fixes/13-words.md#k-66-made-up-words-a-person-reads): Replace the made-up words a person reads with the words of 19-names.md.
- [ ] [K-67](fixes/13-words.md#k-67-the-layer-key-of-a-rule-file): Delete the `layer:` key from every rule file; the folder says it.

### Cache Keys and the Push

[14-push.md](fixes/14-push.md)

- [x] [K-69](fixes/14-push.md#k-69-a-repository-check-is-cached-on-less-than-it-reads): Cache a `[[check]]` only on the inputs it names, or never.
- [ ] [K-70](fixes/14-push.md#k-70-the-push-hook-checks-the-working-tree): Make the pre-push hook check the commits being pushed, not the working tree.
- [ ] [K-293](fixes/14-push.md#k-293-a-whole-project-check-fails-every-push-of-an-old-repository): Select affected projects from changed, deleted, and renamed paths; preserve all their findings and tool failures (D-168).
- [ ] [K-294](fixes/14-push.md#k-293-a-whole-project-check-fails-every-push-of-an-old-repository): Pass the base commit as `--changed=<commit>` in both CI jobs, and name the package manager the install under `.gspot/` takes.
- [ ] [K-295](fixes/14-push.md#k-295-two-flags-name-one-idea): Give `--changed` an optional ref, and delete `--since` (D-169).

### The Top Level of This Repository

[15-top-level.md](fixes/15-top-level.md)

- [x] [K-73](fixes/15-top-level.md#k-73-prose-and-schema-at-the-top-level): Grouped preset ownership and schema consolidation are implemented; root inventory requirements are retired. Documentation examples retain their own acceptance.
- [x] [K-68](fixes/15-top-level.md#k-73-prose-and-schema-at-the-top-level): The root configuration schema is the only generated source; the website build copies it into output.

### What Runs Where, and What It Prints

[16-output.md](fixes/16-output.md)

- [ ] [K-81](fixes/16-output.md#k-81-a-run-prints-nothing-until-it-ends): Print a line as each check ends, leave passed checks out of the end list, and give counts and times in the summary (D-124).
- [ ] [K-84](fixes/16-output.md#k-81-a-run-prints-nothing-until-it-ends): Reword the `direction` column and the `not a slot` section, and print `unchanged` for a cached pass.
- [ ] [K-117](fixes/16-output.md#k-81-a-run-prints-nothing-until-it-ends): Print the findings in the CI log, and write the JSON report beside them.
- [ ] [K-82](fixes/16-output.md#k-82-doctor-reads-the-config-and-never-asks-git): Ask git whether the hooks run in this clone.
- [ ] [K-83](fixes/16-output.md#k-82-doctor-reads-the-config-and-never-asks-git): Count as unchecked only files that a linter reads, and use the same count in `check` and `doctor` (S-6).
- [ ] [S-6](fixes/16-output.md#k-82-doctor-reads-the-config-and-never-asks-git): Closes with K-83.
- [ ] [K-166](fixes/16-output.md#k-166-a-file-counts-as-checked-when-spelling-reads-it): Make `doctor` and `gspot list` report which looks each file ending gets, and name an ending that gets only the general ones.
- [ ] [K-122](fixes/16-output.md#k-122-questions-and-messages-in-made-up-terms): Word the init questions in plain terms (19-names.md).
- [ ] [K-132](fixes/16-output.md#k-122-questions-and-messages-in-made-up-terms): Say so when the preset question takes its default list without a terminal.
- [ ] [K-130](fixes/16-output.md#k-122-questions-and-messages-in-made-up-terms): Read the rule lists of every tool template in the upgrade report, not only lines shaped like ESLint.
- [ ] [K-185](fixes/16-output.md#k-122-questions-and-messages-in-made-up-terms): Explain looks in every scope, and prints the value of each scope that holds the key.
- [ ] [K-243](fixes/16-output.md#k-122-questions-and-messages-in-made-up-terms): Report a config that does not load with its file, its line, and a plain sentence. Print the hooks line of the uninstall plan only when the path will be unset.

### The Recommended Level

[17-recommended.md](fixes/17-recommended.md)

- [x] [K-74](fixes/17-recommended.md#k-74-the-typescript-preset-edits-the-tsconfigjson-of-the-developer): Put no `extends` into the `tsconfig.json` of the developer at `recommended`, and require no compiler option there (D-126).
- [ ] [K-75](fixes/17-recommended.md#k-75-checks-of-taste-that-fail-a-normal-repository): Move exact versions, `packageManager`, the release age, README rules, banned headings and the Contents rule to the `all` level.
- [ ] [K-91](fixes/17-recommended.md#k-75-checks-of-taste-that-fail-a-normal-repository): Move the shell header rules, `types-placement` and `no-single-file-folders` to the `all` level.

### One Copy of Each Rule

[18-one-copy.md](fixes/18-one-copy.md)

- [ ] [K-87](fixes/18-one-copy.md#k-87-three-copies-of-one-idea): Share proven common rule operations and preset-owned limits while preserving language-specific semantics and intended enforcement.
- [ ] [K-235](fixes/18-one-copy.md#k-87-three-copies-of-one-idea): With K-87, remove the universal-analysis prescription. Verify invalid and valid language cases, preserve language policy scope, and place preferences at `all` through one level owner.
- [ ] [K-86](fixes/18-one-copy.md#k-87-three-copies-of-one-idea): Allow `swift` and `python` as folder names here by `structure.folder_name_allowed`, and move the list out of the shell file (D-128, D-135).

### The Command Surface and GitLab

[19-gitlab.md](fixes/19-gitlab.md)

- [ ] [K-95](fixes/19-gitlab.md#k-95-one-name-for-one-idea-on-the-command-line): Build the command surface of 02-cli.md: delete the unused flags, and keep one name for one idea (D-129 to D-133).
- [ ] [K-98](fixes/19-gitlab.md#k-95-one-name-for-one-idea-on-the-command-line): Read the global flags in one function that every command calls.
- [ ] [K-96](fixes/19-gitlab.md#k-96-gitlab-beside-github): Add `--ci gitlab`, and look for `.gitlab-ci.yml` beside `.github` (D-133).
- [ ] [K-284](fixes/19-gitlab.md#k-284-one-way-to-turn-a-thing-off-and-a-way-to-turn-one-check-on): Delete `tools.<name>.enabled` and `gspot allow`, add `extra_checks`, and install no tool whose every check is ignored (D-160).
- [ ] [K-285](fixes/19-gitlab.md#k-284-one-way-to-turn-a-thing-off-and-a-way-to-turn-one-check-on): Rename `profile save` to `gspot export`, and carry an `[[ignore]]` with no path in a profile (D-161).
- [ ] [K-287](fixes/19-gitlab.md#k-287-one-word-for-the-name-of-a-thing): Say name for a check, a preset, a rule, and a setting, and rename the manifest key `id` to `name` (D-163).
- [ ] [K-288](fixes/19-gitlab.md#k-287-one-word-for-the-name-of-a-thing): Add `--dry-run` to `install`, `apply`, `add`, and `remove` (D-163).
- [x] [K-289](fixes/19-gitlab.md#k-287-one-word-for-the-name-of-a-thing): Make a reason optional, with `require_reasons` for a repository that wants it (D-164).
- [ ] [K-291](fixes/19-gitlab.md#k-291-check-one-file-and-leave-a-project-out): Make `check` take paths, add `--only` and `exclude`, and take `--scope` off `check` (D-166).

### gspot Checks Itself

[20-self-check.md](fixes/20-self-check.md)

- [ ] [S-1](fixes/20-self-check.md#s-1-no-linter-reads-a-template): Add one check that writes every template of every preset into the cache and runs the parser and formatter of each kind over it.
- [ ] [S-2](fixes/20-self-check.md#s-1-no-linter-reads-a-template): Closes with S-1.
- [ ] [S-3](fixes/20-self-check.md#s-3-no-hook-runs-the-tests): Run mise run test as the unit/plugin push check; measure coverage without a quota. Candidate acceptance explicitly runs the other suites.
- [ ] [S-7](fixes/20-self-check.md#s-3-no-hook-runs-the-tests): Make the documents test fetch what it needs or fail; no test skips itself because something is absent.
- [ ] [S-8](fixes/20-self-check.md#s-3-no-hook-runs-the-tests): Turn the test rules on through `eslint-plugin-jest` for every test runner the template knows.
- [ ] [S-9](fixes/20-self-check.md#s-3-no-hook-runs-the-tests): Turn `[inspection] strict` on in this repository until D-119 replaces it.
- [ ] [S-12](fixes/20-self-check.md#s-3-no-hook-runs-the-tests): Document local verification and CI acceptance under the [active CI bypass](#active-ci-bypass). Do not require a GitHub run while the bypass is active.
- [ ] [S-4](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Delete the three folder exemptions of stale-paths, and name the other repositories this folder writes about in one setting.
- [ ] [S-5](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Run the build of the manual as a `[[check]]` at the manual stage, and delete the link exemption.
- [ ] [S-11](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Load every `toml` block of the manual through the config reader, and parse every `gspot` line of a `bash` block with the program.
- [ ] [S-13](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Change each document in the commit that builds its decision, and write `17-migration.md` again from the redo of the app.
- [ ] [S-14](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Generate implemented reference facts once in the manual; do not add `architecture/presets.ts`. Keep target architecture authored, distinguish planned names through tracked gaps, and remove duplicate current-state inventories (K-304).
- [ ] [S-16](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Correct the false sentences of `02`, `03`, `11`, and `19` with S-13, fix the empty list in the unexposed-setting message, and load every example config through the reader (S-11).
- [ ] [S-17](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Change each false sentence of `04` to `12` in the commit that builds or drops what it says.
- [ ] [S-18](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Write each preset page and the file tree from the manifests and the disk with S-14, and change the other sentences with S-13.
- [ ] [K-225](fixes/20-self-check.md#s-4-documents-name-paths-that-nothing-verifies): Each text changes in the commit of its subject, and the check of S-11 also parses every `gspot` command inside a `summary`, `why`, and `help`.
- [ ] [S-15](fixes/20-self-check.md#s-15-01-productmd-promises-what-no-test-holds): Write `01-product.md` again after the Adoption phase, from what the product does, with the test that holds each promise.

### The README, the Manual, and the Site

[21-manual.md](fixes/21-manual.md)

- [ ] [G-10](fixes/21-manual.md#g-10-the-documentation-is-thin): Implement the README brief, task-based manual navigation, and playful terminal field notebook design in 21-documentation.md. Include image-generated Spot concepts and shared website/README assets. Verify release-matched examples, responsive and accessible rendering, and reader-task acceptance checks.
- [ ] [K-202](fixes/21-manual.md#g-10-the-documentation-is-thin): Rewrite guides from verified test data before the app handoff and add app-derived evidence after adoption ([21-documentation.md](21-documentation.md)), and S-11 keeps them true.
- [ ] [S-19](fixes/21-manual.md#s-19-six-questions-no-guide-answers): Write the six guides a stranger needs, each from a run in `examples/`.

### Before Launch

[22-launch.md](fixes/22-launch.md)

- [ ] [K-263](fixes/22-launch.md#k-263-windows-and-packaged-platform-acceptance-remain-incomplete): Run the unit tests, the planted repositories, and `gspot check` in the Windows job, and record each failure as a row.
- [ ] [K-164](fixes/22-launch.md#k-164-a-release-can-ship-broken-and-say-nothing): Both scripts stop at the first missing file, and the publish step verifies every package before it publishes the first.
- [ ] [K-145](fixes/22-launch.md#k-164-a-release-can-ship-broken-and-say-nothing): Ship `LICENSE.md` in the `files` of the launcher, the plugin, and each platform package.
- [ ] [K-121](fixes/22-launch.md#k-164-a-release-can-ship-broken-and-say-nothing): Confirm this project owns the npm name `gspot` before any command asks the registry about it.
- [ ] [K-244](fixes/22-launch.md#k-164-a-release-can-ship-broken-and-say-nothing): Name Homebrew in an install hint only for a tool with no pin, give a `github` installer its tag form, and ask all four registries in the release test.
- [ ] [K-245](fixes/22-launch.md#k-164-a-release-can-ship-broken-and-say-nothing): Write one notice file at build from the license of every bundled dependency and grammar, and embed it. Give the Swift grammar a build script that names its source commit.
- [ ] [K-280](fixes/22-launch.md#k-280-alpine-and-the-first-download): Add the two musl targets, sign the macOS binaries, and say in the install guide what each system shows.
- [x] [K-281](fixes/22-launch.md#k-281-renames-after-the-first-release): Migrate old TOML before validating the target schema, preserve recovery, and update the pin last (D-159).

### Every Place a Developer Comes From

[23-scenarios.md](fixes/23-scenarios.md)

- [ ] [K-269](fixes/23-scenarios.md#k-269-no-table-says-which-tool-gets-a-root-pointer): Hold a `pointer` form for each tool in its manifest, and write the table of root pointers.
- [ ] [K-270](fixes/23-scenarios.md#k-269-no-table-says-which-tool-gets-a-root-pointer): Preserve EditorConfig sections and Prettier overrides in format overrides; retain files with behavior that cannot be carried.
- [ ] [K-271](fixes/23-scenarios.md#k-271-a-folder-with-no-git-is-half-decided): State what each git flag answers with no git, add a `gitleaks dir` check, and name other version control as this same mode.
- [ ] [K-272](fixes/23-scenarios.md#k-272-git-cases-no-test-holds): Give each of the eight git cases one stated behavior and one planted case.
- [ ] [K-273](fixes/23-scenarios.md#k-273-generated-files-drift-on-windows): Add `.gspot/** text eol=lf` to the managed `.gitattributes` block.
- [ ] [K-274](fixes/23-scenarios.md#k-274-a-merge-conflict-under-gspot): Report a conflict marker under `.gspot/` as one finding that names `gspot apply` and `gspot install`.
- [ ] [K-275](fixes/23-scenarios.md#k-275-hook-tools-init-does-not-know): Add the pre-commit framework, lint-staged, and `simple-git-hooks` as hook forms.
- [ ] [K-276](fixes/23-scenarios.md#k-276-the-github-job-misses-what-real-repositories-need): Give the GitHub job least permissions, a SARIF upload that can work, the merge queue event, and a cache.
- [ ] [K-277](fixes/23-scenarios.md#k-277-the-gitlab-job-is-one-sentence): Write the CodeClimate report, set the clone depth, and find GitLab by its file.
- [ ] [K-278](fixes/23-scenarios.md#k-278-every-other-ci-system-gets-nothing): Print the three CI lines under `--no-ci`, and show them for four systems in one guide.
- [x] [K-279](fixes/23-scenarios.md#k-279-only-two-agent-files): Write the index of rule files into every agent file the repository holds (`[rules] agents`).

### Cross-cutting Contracts

[24-contracts.md](fixes/24-contracts.md)

- [ ] [K-298](fixes/24-contracts.md#k-298-managed-paths-can-escape-their-root): Managed paths can escape their root.
- [ ] [K-299](fixes/24-contracts.md#k-299-recovery-and-uninstall-disagree-about-ownership): Recovery and uninstall disagree about ownership.
- [ ] [K-300](fixes/24-contracts.md#k-300-target-documents-give-incompatible-instructions): Target documents give incompatible instructions.
- [ ] [K-301](fixes/24-contracts.md#k-301-recommended-adoption-findings-need-usefulness-tests): Recommended adoption findings need usefulness tests.
- [ ] [K-302](fixes/24-contracts.md#k-302-the-website-has-source-but-no-deployment-contract): The website has source but no deployment contract.

### Scripts, Names, and Failure Handling

[25-simplification.md](fixes/25-simplification.md). Integrate these with K-205, K-164,
K-263, and takeover work; do not defer their safety fixes until after release.

- [x] [K-303](fixes/25-simplification.md#k-303-the-reference-generator-deletes-more-than-it-owns): Resolved locally: reference generation preserves authored content and prior pages on formatting/write failure; retained tests cover collisions and confinement.
- [ ] [K-304](fixes/25-simplification.md#k-304-generated-reference-pages-are-not-automatically-correct): Generated reference pages are not automatically correct.
- [x] [K-306](fixes/25-simplification.md#k-306-file-urls-are-used-as-filesystem-paths): Source file-URL conversion is resolved locally; current native-platform execution remains K-263.
- [ ] [K-307](fixes/25-simplification.md#k-307-failure-to-empty-helpers-hide-incomplete-checks): Failure-to-empty helpers hide incomplete checks.
- [ ] [K-308](fixes/25-simplification.md#k-308-the-naming-specification-contradicts-its-own-examples): Apply the canonical field, parameter, action, and coverage vocabulary; remove contradictory naming requirements.

### Repository Audit Follow-ups

The [September 20 accounting](23-repository-audit.md) maps current evidence to existing owners.
These two additional requirements have their acceptance criteria in those owners.

- [x] [K-309](fixes/20-self-check.md#k-309-repository-ci-repeats-expensive-work): One repository CI owner and the agreed cadence are defined and locally validated. Native runs, remote merge-gate behavior, and timing evidence are explicitly deferred by the active CI bypass.
- [ ] [K-310](fixes/10-tests.md#k-310-the-registry-harness-can-accept-an-unrelated-server): Confine the local registry harness and clean up failed startup ([10-tests.md](fixes/10-tests.md)).

## Remaining cleanup

Fix owners retain the concrete naming, suppression, shell-policy, lint-package selection,
and skipped-test defects. Word occurrence counts and test filenames are not acceptance
criteria. Review any parked work or obsolete root stubs for authored changes before removal.

## What is still unchecked

By the order of the owner, nothing below is touched before its step.

- A real install in yap-swift-app, with every written file read, and the time of every check
  there. Follow the app handoff gate above.
- Any other reference repository.

The [implementation reconciliation](23-repository-audit.md#implementation-reconciliation) records
the retained rule guides read in this turn and assigns their defects to existing owners. The
historical count of 33 unread files is not a current inventory or an acceptance result.

Windows has successful historical runs and later failures in GitHub Actions.
K-263 remains open; the latest async harness change does not prove the timeout cause. Further
CI execution is deferred by the active bypass. See [the audit](23-repository-audit.md).

The following September 19 observations are historical evidence, not a current exhaustive
verification claim. The audit records remaining evidence limits and stale completion claims.

Checked on September 19, 2026, with the row that holds what was found:

- The `why` text of the 205 checks: sound.
- Every pin on npm, PyPI, crates.io, GitHub, and Homebrew (K-206, K-207, K-244).
- A tool that crashes, a config cut in half, two runs at once, and `apply` killed midway (K-243).
- The licenses of the 34 bundled dependencies and the nine grammars (K-245).
- The build of the docs site: 301 pages, every internal link valid.
- Every check name, flag, config key, manifest key, and path the documents name (S-14, K-246).
- The 48 preset pages and `16-file-tree.md`, by eye (S-18, K-254 to K-256, T-36).
- The flags each manifest passes, against the help text of the pinned tool (K-251).
- A full disk, on a 12 MB disk image: the policy file is cut in half (K-257).
- The Compose check, run with Docker Compose 5.5.1: it fails on every file (K-258).
- The `.gitignore` of this repository against what git tracks and what sits on disk (K-259).
- The 12 rule files the owner chose, read whole (K-260 to K-262).

### Repository task ownership cleanup

Mise is the repository command surface. Root and documentation package scripts, including the
Astro postinstall hook, are removed. `.mise/conf.d/repo.toml` owns setup, builds, test suites,
types, documentation, and release tasks. `repo:setup` installs the frozen Bun workspace and
then invokes `docs:sync` through a native task dependency. Documentation builds generate
references through native task dependencies and validate emitted links after Astro builds.
Root mise overrides keep generated gspot commands bound to repository source. CI definitions
and contributor guides use the same tasks directly. The generated gspot fragment retains its
existing owner. Yap was inspected as a reference and was not changed. CI remains paused.

Local verification uses mise 2026.8.8: `repo:setup` passes with the frozen lockfile unchanged;
`docs:build` builds 314 pages and validates local links and fragments; `check:types` passes
for the root and docs. Workflow task names resolve, actionlint passes, and `build -- --help`
forwards arguments to the existing build owner. Native task precedence and documentation
examples pass four tests with 19 assertions. No CI workflow was executed.
