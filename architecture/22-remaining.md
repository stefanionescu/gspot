# Remaining Work

This is the only status record for the architecture. Contracts describe the target; source and
recorded execution establish only the behavior they actually cover. Cleanup is active; feature
expansion and repository lint cleanup follow it. Recorded local passes do not establish that
the implementation, documentation, or tests are free of unnecessary complexity.

The September 23 source, test, support, and content reading is complete. Test consolidation,
preset grouping, the Astro/Starlight redesign, and the local visual matrix are implemented.
Current verification and remaining failures are consolidated under
[Behavioral acceptance quality](#behavioral-acceptance-quality),
[Reference content loaders](#reference-content-loaders),
[Guides and site acceptance](#guides-and-site-acceptance), and
[Packaging and installed-product acceptance](#packaging-and-installed-product-acceptance).
Those dispositions supersede earlier aggregate totals and audit/capture limitations.
Complete per-example execution, download-blocked journeys, assistive-technology review, and
unavailable native-platform evidence remain open. The Sweet spot continuation below records
the SQLFluff lifecycle repair and the current rendered verification.
Updating architecture does not close those product requirements. The cleanup continuation below
records the latest local results and supersedes earlier aggregate totals for this work.

## Development readiness and next work

The repository has a usable development layout: authored mise tasks have one home, source
hooks resolve the checkout launcher, and tests are grouped by execution dependencies. Keep
this layout while implementing the next behavior. No further repository-wide rename or test
hierarchy migration is justified by the current review. Review names and redundant tests with
their owning behavior; this is not a claim that every remaining implementation is minimal.

The next non-lint work is ordered below. These entries route work to existing dispositions;
they do not close acceptance IDs or create a second backlog.

| Next work | Owner and completion evidence |
| --- | --- |
| Retain process-supervision regressions | [Process execution](#process-execution-and-failure-reporting): the Darwin reaping repair passes SQLFluff and the native suite. Keep permission errors visible and verify native behavior on the remaining platforms. |
| Complete acquisition-blocked consumer journeys | [Tool installation](#tool-installation) and [packaging](#packaging-and-installed-product-acceptance): resolve or document the EditorConfig Checker HTTP 403, then rerun the affected native, source acceptance, and release cases sequentially. Preserve the earlier failures until replacement evidence exists. |
| Finish documentation acceptance | [Reference examples](#reference-content-loaders) and [site acceptance](#guides-and-site-acceptance): execute the remaining defect/correction examples, inspect the final README cards, and verify screen-reader operation. Actual browser zoom and reduced motion have local evidence. |
| Resume product implementation in dependency order | Use the [implementation order](#implementation-order-after-cleanup) and the owning group's unresolved requirements. Keep native-platform evidence, publication, external adoption, and paused CI separate from local implementation. |

The follow-up review checked task ownership, moved-path references, central test placement,
and the earlier confirmed deletion targets. It found stale imperative cleanup instructions in
this record; those are reconciled below. It did not repeat the full behavioral suites or native
platform matrix. Earlier K-149 evidence, K-222 verification, and all recorded blockers remain.
Verification for this documentation update resolved all 396 local links and heading anchors
across the 16 architecture files; the diff whitespace check passed. Repository lint remains
outside this pass.

## Cleanup continuation: source hooks, removals, and isolated verification

The checkout uses executable `.mise/gspot/gspot` through mise PATH. Tasks and installed hooks resolve
that source launcher while consumer repositories retain pinned release executables. The
commented Lefthook scaffold and unused authored private-tool dependencies and pins are removed;
Lefthook product support and native compatibility coverage remain. The generated schema,
spelling configuration, editor entry points, strict coverage, structural enforcement, and
`level = "all"` remain in place. Managed outputs were regenerated through apply.

Authored tasks and launcher PATH live in `.mise/conf.d/repo.toml`. CI affected-input
selection, release version validation and artifact assembly, and site provenance are mise
tasks. Documentation suites and built-site link checks have focused tasks. Workspace
package manifests contain no scripts. Build, packaging, registry, and link-check implementations
remain with their source owners. The checkout-local launcher lives in `.mise/gspot/`.
Task cleanup verification passed: four launcher/CI cases, 17 documentation cases, the
installed-and-cloned hook case, all three TypeScript projects, configuration regeneration,
and the 317-page site build with link and fragment validation. Disposable fixtures verified
release assembly, version rejection, provenance output, and mismatched-notice rejection.
No repository lint was run. Existing task names and paused workflow gates remain unchanged.

PostgreSQL facts discard dropped tables, policies, indexes, and constraints and disabled row
security. Equivalent surviving indexes and policies retain their facts. Suggested policy
commands use the shared POSIX argument quoting, including apostrophes and newline-containing
values. Python blocking-call analysis releases its parse tree on failure.

Central suites retain their dependency classifications. Documentation subjects, Bash subjects,
Python acceptance, native hooks, and plugin configuration now have capability names within
their owning directories. Adoption and ownership cases are split by responsibility without
removing their assertions. CLI support separates process execution, Git, tool installation,
defect expectations, and file preservation. Configuration-document editing, tool-specific
adoption, command expansion, and dependency materialization have separate owners; transaction
locking, confinement, and recovery remain with the lifecycle owner.

Registry startup accepts cancellation; termination and output draining have deadlines. Setup
and shutdown remove owned storage and preserve execution and cleanup errors. Release tests
prepare publication inputs in disposable directories. Host independence builds with isolated
dependencies, removes that build checkout, and then exercises its executable. No release test
renames the source checkout's binaries or parser assets.

The earlier geometric-g identity is superseded by the Sweet spot continuation below. Light, dark,
monochrome, favicon, editable social-card source, and 1200 × 630 sharing assets are present.
The website header, README, and sharing metadata use them. Workflow and recovery diagrams have
adjacent prose equivalents. Contributor instructions explain source hooks, configuration
ownership, central Bun configuration, and sequential source/release verification.

A clean dependency installation exposed three native site-output consumers. HTML Validate,
Linkinator, and PurgeCSS remain explicit development dependencies; their behavioral cases now
live in the native suite. The retained integration fixture also had duplicate imports that
could fail before testing selected-input isolation. It now demonstrates missing-input failure
and successful execution after selecting that input. Four unused workspace tool dependencies
remain removed, and lockfile comparison introduces no new resolved versions.

The earlier site review covered the homepage, build/overview/recovery guides, every reference category,
and 404 at 360, 768, and 1440 pixels in both themes. No reviewed page overflows the viewport.
The home link has an accessible name, Geist loads locally, keyboard focus and skip navigation
work, search returns results and closes with Escape, and code copying announces success.
Desktop and mobile Lighthouse snapshots report accessibility 100 with no failed audits after
matching the search button's name to its visible label. The accessibility tree exposes named
landmarks and controls. CSS 200% reflow passes on the build guide; actual browser zoom and
screen-reader operation remain unverified. Reduced-motion CSS is reviewed, but an operating
system media-preference session remains outstanding. These results do not replace assistive
technology review or complete execution of every reference example.

Earlier local verification, superseded where the Sweet spot continuation records a newer run:

| Verification | Result | Remaining limits |
| --- | --- | --- |
| Routine unit/plugin/integration with coverage | 1,288 pass, zero failures, 5,145 assertions, 143 files; 67.85% functions, 75.62% lines | Measurement does not replace product file-coverage enforcement |
| Native suite | 323 pass, two failures, 3,015 assertions, 30 files | One EditorConfig Checker HTTP 403 and one SQLFluff process-group cleanup `EPERM` |
| Moved native site-output cases | Three pass | Linkinator, HTML Validate, and PurgeCSS run their actual pinned executables |
| Source acceptance | 269 pass, 44 failures, 2,733 assertions, 81 files | All 44 failures stop at rate-limited EditorConfig Checker downloads |
| Source-backed installed hooks | One selected journey passes with 23 assertions | Covers staged defects, correction, and a fresh clone; two unrelated cases are filtered out |
| Release | Eight pass, one failure, 281 assertions, four files | Installed-consumer tool setup stops at the same download limit; isolated host independence and installed plugin pass |
| Types, schema, and configuration | Workspace/docs/tests types and schema freshness pass; apply preview has no drift | No repository lint run |
| Packages and documentation | All seven CLI targets build; plugin modules/declarations work in an installed consumer; 317 site pages build with valid links and fragments | Cross-compilation does not establish native platform execution |

The final routine run follows a clean dependency installation and the corrected native test
classification. Source acceptance and release ran sequentially. The source runner streamed
output, returned failure, and removed its registry storage. Focused registry tests cover bind
failure, startup timeout, cancellation, and shutdown; launcher cases cover arguments, stdin,
working directory, status, SIGINT, and SIGTERM. README/guide examples and reference validation
run within the retained routine suite. The paired Bash demonstration and captured transcript
pass in native verification.

The earlier SQLFluff `EPERM` was reproduced in the write-failure case. The Sweet spot
continuation records its diagnosed Darwin lifecycle cause and repaired verification.
Download-blocked journeys, full per-example execution, assistive-technology review, and
unavailable Windows/Linux gates remain open. Earlier K-149
evidence and K-222's outstanding verification remain unchanged. No repository lint, commit,
public publication, deployment, DNS change, external-repository edit, subagent, or CI execution
occurred. Owned site servers and browser review tabs are stopped.

## Sweet spot continuation

The September 23 continuation implements the generated Sweet spot identity, the Astro homepage,
shared documentation styling, README presentation, and the client-environment walkthrough.
The built-in image generator produced the flat mark and dimensional hero. Editable SVG marks,
wordmarks, light/dark banners, favicon, and 1200 × 630 social artwork accompany the raster
sources. Policy, tools, agents, scope, findings, and preservation graphics explain implemented
behavior. Six supported-tool logos use the retained Simple Icons CC0 notice.

The live Turborepo page and its 28 linked JavaScript/CSS resources were downloaded for review.
The read-only local source at revision `1dead3cc9d421e61327a13cb44a590e8e218793f` supplied
layout patterns for the split hero, feature sections, setup columns, and closing action.
The adapted Astro components retain the MIT notice and source attribution. No external
repository was edited. The Nx first-use progression informed the guide sequence.

The native SQLFluff write-failure case reproduced `EPERM` when the supervisor signaled the
process group from Bun's child-exit callback. Inspection of Darwin's `killpg1` behavior and the
process trace identified the group-leader reaping window: an extant group containing only
ineligible zombie members can return `EPERM`. A 10 ms deferral before exit cleanup passes the
reproduction and native suite. This is observed macOS evidence, not a timing guarantee across
platforms. Descendant termination remains enabled, permission failures remain visible, output
draining is bounded at five seconds, and disposal retains execution and cleanup errors.
Text and binary regressions cover ordinary exits, timeout, cancellation, stream failure,
descendants retaining output handles, and injected permission failures.

EditorConfig Checker's pinned wrapper and release request are valid. The wrapper forwards
`GITHUB_TOKEN` when present. A fresh acquisition passed earlier, but subsequent source and
release runs received GitHub's explicit API rate-limit response for the pinned v3.4.0 release.
No installer version, integrity contract, authentication setting, or executable source was
changed. Troubleshooting describes the rate limit and retry after its reset.

| Verification | Current result |
| --- | --- |
| Routine coverage | 1,295 pass, zero failures, 5,173 assertions across 143 files; 67.75% functions and 75.55% lines |
| Focused process supervision | 29 pass, zero failures, 137 assertions |
| Native compatibility on this macOS host | 328 pass, zero failures, 3,048 assertions across 31 files |
| Focused native acquisition | Six pass, zero failures, 333 assertions |
| Source acceptance | 264 pass, 49 failures, 2,629 assertions across 81 files; all failures stop at the pinned EditorConfig Checker rate limit |
| Release, run after source acceptance | Eight pass, one failure, 281 assertions across four files; installed-consumer acquisition stops at the same rate limit |
| Types and schema | Workspace, documentation, and test type checks pass; schema freshness passes |
| Packages | All seven CLI targets build; plugin build passes; both prepared npm payloads contain consumer READMEs with absolute links and no relative image assets |
| Documentation | 17 tests pass with 970 assertions; 318 pages build with valid local links and fragments |

The JavaScript guide commands were executed with the built plugin and ESLint. Its captured
private-environment finding and clean correction are asserted in the owning rule and plugin
configuration suites. Homepage and README excerpts use this fixture. The paired Bash transcript
passes native verification. Reference metadata and loading tests pass; they do not establish
complete execution of every shipped reference example.

Native Chrome inspection covered the homepage, installation, client-environment, build, and
recovery guides, every reference category, and the branded 404 at 360, 768, and 1440 pixels in
both themes. Reviewed pages had no viewport overflow, missing images, or unloaded fonts.
Long code and table panels scroll. Search, mobile navigation, and copy announcements worked.
Actual Chrome 200% zoom and an emulated reduced-motion media preference were exercised.
The homepage remained useful with iframe script execution disabled. Small marks at 16, 24,
and 32 pixels remained distinguishable. Tested foreground/background combinations meet
normal-text contrast, including cobalt on white and tangerine with ink.

Local GitHub-compatible README previews were inspected in both themes. This is not evidence
from the live GitHub or npm renderer. The final change from a single tool strip to six wrapping
cards remains visually unverified: ScreenCaptureKit returned error -3812 during the final
capture and reconnection attempts. The earlier successful captures remain valid for their
reviewed revisions. Actual screen-reader navigation remains unverified.

Remaining acceptance includes the final README card capture, all shipped reference-example
execution, assistive-technology review, download-blocked consumer journeys, and unavailable
Windows/Linux native gates. Public source links for new files require those files to land;
no package or site publication occurred. K-149 evidence and K-222's outstanding verification
remain unchanged. No repository lint, subagent, commit, deployment, DNS change, external-repository
edit, credential addition, or CI activation occurred. The owned preview server is stopped,
and the final build removes temporary visual-review pages. The owned Chrome review tab could
not be closed through verified UI control after the capture service failed.

## Active CI bypass

Until the user explicitly re-enables CI, bypass GitHub Actions for every gspot commit and push.
This instruction takes precedence over CI execution and waiting requirements throughout this
architecture and inherited implementation plans, including S-12 and K-263.
It applies to every milestone, Windows repairs, and final-candidate work. A milestone, failure,
release-preparation step, or context handoff does not end the bypass.

- Include `[skip ci]` in every commit message, including this policy change, before pushing.
  Use the commit placement requested by the user; the marker must reach every commit.
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

## Reconciliation and count

The input contained 296 unchecked boxes: 271 named rows linked to 148 acceptance sections,
and 25 unnamed cleanup entries. They overlapped and did not count independent features.
The groups below assign each named row and each unnamed entry once. Open groups retain their
partial implementations. Implemented locally means source and recorded local evidence exist;
it does not mean a fresh test run or current candidate acceptance. Retired means a duplicate
or implementation prescription is removed, not that a promised behavior disappeared.

The reconciled backlog has **29 open behavior groups**. Four additional gates are deferred:
native-platform/remote CI execution, website publication and rollback, registry/public-release
authority, and Yap adoption. Five groups record implemented local behavior. These are broad product concerns,
not a count of independent implementation defects.
Architecture cleanup does not close their runtime requirements.

## Cleanup before feature work

This is the active phase. Pause new integrations and feature expansion while repairing and
simplifying existing behavior. Do not start a repository-wide lint-fixing campaign. Keep
`level = "all"`, strict coverage, hooks, and existing findings visible. Trivial-function and
trivial-file enforcement stays enabled by default at every level and inherited scope, including
the standalone plugin. Do not demote it, add blanket exemptions, or inflate bodies to evade it.

Work alone. Change managed outputs through their owners and apply. Do not commit, push, publish,
deploy, change DNS, modify Yap, Nx, or Turborepo, or enable CI during this phase. Keep unavailable
native-platform evidence separate from implementation defects. No upgrade command, compatibility
aliases, migrations, replacement framework, or parallel status document is part of this cleanup.

The existing groups below own completion. Source and test cleanup has been performed and
recorded there. Deleting specifications alone does not complete unresolved behavior or
verification. Use this order for further work within the groups:

1. **Remove unnecessary implementation.** Under manifest ownership and session observations,
   trace wrappers, fallback branches, duplicate owners, and caches to their callers and contract.
   Inline pure forwarding, delete dead code, and remove impossible-state defaults. Retain real
   input validation, lifecycle recovery, cancellation, and resource cleanup. Reuse an existing
   owner; do not replace deletions with abstractions, files, registries, or compatibility layers.
2. **Repair remaining execution defects.** Preserve the SQLFluff lifecycle repair recorded in
   the readiness section. Preserve the repaired report validation and argument interpretation.
   Any further adapter change must verify fatal, malformed, defect, and corrected cases while
   retaining aggregate exits `0`, `1`, and `2`.
3. **Prune tests by behavior.** Under behavioral acceptance quality, inspect the owning suites
   alongside each cleanup. Delete obsolete-internal tests, source-token assertions, inventory
   totals, redundant snapshots, and repeated cases that prove no distinct behavior. Preserve or
   replace the only coverage of a retained requirement before deleting it. Native defects and
   corrections, parser failures, exact bytes, recovery, installed journeys, and distinct shipped
   surfaces remain meaningful evidence. Do not create a test inventory framework or count quota.
4. **Reduce instruction overhead.** Under rule guides and agent instructions, repair the managed
   block generator and corpus. Remove padded table rows, repeated guidance, generic filler, and
   mandatory reading unrelated to the task. Preserve selected rules and authored agent content.
   Verify readable generated entries, selection, preservation, and idempotent apply. The source
   corpus and generator own this work; installed `.gspot/` files are not edited by hand.
5. **Make documentation useful and accurate.** Under reference loaders and guides, supply missing
   command behavior, defect/correction examples, setting scope and precedence, and complete
   configuration examples through the existing owners. Remove stale implementation claims and
   duplicated procedures. A successful site build or page count does not prove completeness.
6. **Reconcile evidence and review the result.** Update each affected group's current disposition
   with what changed, focused checks, unresolved failures, and unavailable evidence. Remove
   superseded successful-run prose after confirming its useful evidence survives. Keep unique
   unresolved historical findings until replacement evidence establishes their disposition.
   Review the complete cleanup diff for lost behavior, new indirection, and broadened scope.

Run verification appropriate to each repair or deletion. Do not repeat full source, release,
platform, and documentation matrices after every edit. A failing behavioral check caused by
cleanup is part of this phase; existing unrelated lint findings remain later work. Do not disable
checks or conceal findings to label cleanup successful. After this phase has evidence for the
listed repairs and deletions, resume the remaining implementation order below. Freeze artifacts
and run the full candidate gate only after implementation settles.

### Audit findings and present disposition

The initial expanded audit reported structural scans of 390 JavaScript/TypeScript source files and
248 test files, compiler and Knip checks, source tracing, and targeted reproductions.
It confirmed defects and unnecessary implementation, but did not establish a complete manual
review or native acceptance on every supported platform. That read-only pass changed no files.
The focused 32-test pass includes assertions of incorrect behavior and is not acceptance.
The owning groups record subsequent repairs and the completed reading. Native acceptance
is still limited to the platforms actually exercised.

The read-only audit confirmed missing-output fallback defects in
`checks/static-site/output-checks.ts`: injected tool exit `2` with empty stdout and a fatal
stderr diagnostic yielded empty findings for link, HTML, and unused-CSS checks. This is adapter
reproduction evidence, not a native pinned-tool acceptance run. The shared runner rejects process
interruption but leaves ordinary nonzero classification to adapters. Current repair evidence is
recorded under process execution and failure reporting.

### Confirmed implementation deletions

The starting deletion targets have been applied in their source owners. `isClaimed` tests
extension membership directly; the Xcode orphan check has no `projectFindings` forwarding
boundary; edit-distance rows no longer use the four impossible-state zero defaults. Static-site
adapters validate required reports, configured build commands preserve arguments, and the
managed guide index emits compact lists without column-padding machinery.

Their behavioral evidence belongs to [process execution](#process-execution-and-failure-reporting),
[isolated builds](#isolated-generators-and-builds),
[agent instructions](#rule-guides-and-agent-instructions), and
[behavioral acceptance](#behavioral-acceptance-quality). Do not reopen these deletions merely
because the initial audit listed them. Further deletion requires caller tracing and proof that
no retained behavior loses its only coverage. The unresolved requirements in those groups remain
open independently of these completed edits.

### Instruction and documentation findings

The initial audit measured 11,385-byte agent files with 8,334 spaces in padding runs and an
approximately 26,000-word general index. The managed-block and corpus owners have since been
reviewed and corrected. Generated references include definition-owned effects, exits, settings,
and examples; complete executable example evidence remains open. Every retained test and
support module has been read, with deletion decisions recorded in the behavioral group.
The trivial-function and trivial-file defaults are intentional product requirements, not defects
to remove during cleanup. Correct contradictory references while preserving that enforcement.

Architecture changes remove empty retired clauses, obsolete level-module prescriptions, stale
native-handle claims, and repeated rule-corpus history. The structural rules remain default policy
at both levels. No runtime behavior, tests, generated agent files, or public docs are changed by
this architecture-only batch. Historical results below retain their original scope.
Rule metadata retains its validated layer, preset, and title; remove the contradictory demand
for a field-removal migration. Preset kind owns source grouping at `presets/<kind>/<name>/`; public preset and check IDs
remain unchanged. Other source and test directories do not mirror preset kinds.

Earlier architecture-only verification parsed all 16 Markdown files, resolved 380 local links
and anchors, and passed the diff whitespace check. Removed acceptance anchors and renamed sections
have no remaining Markdown references in the repository. Product tests, builds, and staged
product checks were not run for this documentation-only change. Runtime cleanup remains open.

## Implementation order after cleanup

1. Complete confinement and recovery, including Windows implementation, then lossless configuration
   carryover, proposal application, and immutable clone installation.
1. Complete execution, immutable Git inputs, session observations, cache keys, and truthful failures.
1. Complete levels and all agreed language, framework, plugin, preset, and rule-guide behavior.
1. Complete hooks, reports, CI generation, pinned-tool compatibility, and installed artifacts.
1. Complete content loaders and release-matched documentation, including site usability acceptance.
1. Freeze one candidate only after implementation settles. Reuse its artifacts for the gate below.
   Record unavailable platform evidence as deferred; leave Yap and reference repositories unchanged.

## Grouped dispositions

Each group links its existing acceptance clauses. Older checked IDs retain only their recorded
local scope. An open ID that shares a group with local IDs is not closed by those local results.

### Lifecycle confinement

Implemented locally. Managed repository reads, writes, replacements, and deletions use the shared confinement boundary. The filesystem implementation is shared across platforms; native execution evidence remains deferred. Path escapes and existing symlink parents are rejected before external files are touched. Hostile concurrent directory swaps are outside the contract.

Locally implemented IDs: K-298. Frozen-candidate and native-platform acceptance remain open.

Former unnamed cleanup entries: 10.

Source and retained evidence: [packages/cli/src/lifecycle/confined.ts](../packages/cli/src/lifecycle/confined.ts), [tests/integration/cli/lifecycle/confined.test.ts](../tests/integration/cli/lifecycle/confined.test.ts).

Repository inventory filters excluded and private lifecycle paths before observing links.
Installed dependency links are inventoried without reading external targets; external authored
source links still fail. The first full integration run passed 585 tests and exposed six
failures. After repairing inventory, relocated-checkout dependencies, and offline mise setup,
the affected five-file run passes 28 tests with 159 assertions. The unit/plugin suite passes
380 tests. These are source checks, not frozen-candidate acceptance.

Managed npm version probes validate package manifests through confinement before running
the executable. A planted external manifest link is refused, and replacing it with owned
bytes permits the probe. The probe suite passes 21 tests with 53 assertions. Package alias
generation uses the shared validated manifest schema and refuses links introduced after
inventory; alias and manifest tests pass 16 cases with 34 assertions.
Authored TypeScript configuration, including inherited configuration, uses confined reads.
Declared dependency configuration can still be read outside the root. The alias suite passes
11 cases, compiler-option checks pass 13 cases, and real TypeScript acceptance passes all
12 cases with 115 assertions. These checks do not claim a sandbox for native compiler code.

The refreshed unit/plugin suite passes 391 tests, and the integration suite passes 604 tests
with 4,144 assertions. The subsequent reader and profile changes have their affected checks
recorded separately below; final frozen-source acceptance remains open.

Acceptance: [K-298](03-configuration.md#acceptance-k-298).

The handoff audit rechecked lifecycle publication, source readers, report and cache owners,
installer publication, profile exports, and compiler output boundaries. Direct filesystem
operations outside confinement serve temporary directories, installed assets, declared host
dependencies, or Git-resolved metadata. No remaining managed repository mutation bypass was
identified. The refreshed confinement and ownership suite passes 65 cases with 464 assertions.
This local evidence does not establish native Windows behavior or a frozen candidate.

### Ownership and recovery

Open. Complete common ownership routing, proposal publication, pruning, and interrupted recovery across init, apply, remove, and uninstall. Preserve unowned files, later edits, original bytes and modes, and fresh-clone files.

Open acceptance IDs: K-257, K-252, K-118.

Locally implemented IDs: K-299. The common owner preserves originals and later edits,
serializes writers, and recovers interrupted batches. The refreshed 65-case confinement and
ownership run includes full-disk failures and simulated Windows replacement semantics.
Complete command journeys, native-platform execution, and frozen-candidate acceptance remain open.

Former unnamed cleanup entries: 9, 11.

Source and retained evidence: [packages/cli/src/lifecycle/ownership.ts](../packages/cli/src/lifecycle/ownership.ts), [tests/integration/cli/lifecycle/ownership/](../tests/integration/cli/lifecycle/ownership/).

Acceptance: [K-118](03-configuration.md#acceptance-k-118), [K-299](03-configuration.md#acceptance-k-299), [K-257](03-configuration.md#acceptance-k-257).

Profile exports validate their result and publish through the shared lifecycle journal.
Ownership records distinguish exports so apply, drift, and uninstall retain reusable profiles.
Exports refuse unsafe paths, other managed destinations, unowned conflicting bytes, and
later edits. The affected profile, ownership, and apply suite passes 65 tests with 343
assertions, including interrupted publication, retry, idempotence, and read-only originals.
CLI type checking passes.

Initialization leaves version-pin publication to successful apply. A planted generated-file
write failure retains the previous pin, and apply recovers the journal before publishing the
current pin. The init/apply suite passes 13 tests with 65 assertions. The broader lifecycle run
passes 128 tests and exposes four stale installation exit-code assertions; those now require
inability code 2, and the native Python installation rerun passes all four tests with 104
assertions. The shared read-only replacement/removal case runs without a Windows skip; local
execution passes, while native Windows evidence remains deferred.

Pending replacements retain a reference to their saved previous bytes. Recovery restores an
absent replacement destination, validates backup hashes, and preserves later edits. Windows
read-only replacement removes the verified destination after staging the new bytes, and restores
the previous bytes if publication fails. It does not temporarily change destination permissions.
The pinned [Bun boundary](https://github.com/oven-sh/bun/blob/bun-v1.3.11/src/sys_uv.zig)
uses libuv; its [Windows rename implementation](https://github.com/libuv/libuv/blob/f3ce527ea940d926c40878ba5de219640c362811/src/win/fs.c)
uses `MoveFileExW`. Filesystem-boundary simulations cover success, publication failure,
interruption, later edits, and damaged backups. The affected lifecycle suite passes 105 tests
with 756 assertions, and CLI type checking passes. Native Windows execution remains deferred.

JSON, SARIF, and GitLab reports publish through one lifecycle proposal batch. Interruption
tests verify that all changed report outputs share the pending journal and recover on retry.
Storage and report acceptance pass 24 tests with 161 assertions, including read-only output,
external links, protected authored reports, and preserved findings and exit codes. Doctor lists
unowned files under `.gspot/` without treating generated marks as deletion authority; its
three focused tests pass with 12 assertions, including unchanged bytes after apply and uninstall.

Uninstall discovers the nearest policy or ownership root and plans restoration without loading
policy or tool configuration. Nested missing-policy and malformed-policy cases restore recorded
originals, remove installed hooks, preserve unowned files, and leave the parent policy unchanged.
The affected lifecycle, installation, and root-discovery suite passes 59 tests with 416 assertions.
Staged message checks and staged dry runs also preserve existing report bytes; their two real
CLI cases pass with 14 assertions. Push dry runs skip aggregate report publication.

Uninstall reports preserved hooks relative to the policy root, with absolute destination and
backup references. Two nested-policy cases pass with 21 assertions across default and external hook
directories: both retained paths are reported without exposing content, and retry restores the
original bytes and executable mode after the edit is resolved.

XCTest removes previous result bundles through confined reads, removals, and directory pruning.
The affected XCTest, Swift, and cache suite passes 29 cases with 108 assertions, including an
external result link and a corrected read-only prior bundle. CLI type checking passes.
Native Xcode execution remains a separate unavailable gate.

The refreshed confinement and ownership suite passes 65 cases with 464 assertions. Injected
`ENOSPC` failures at the first backup, second backup, and journal publication preserve every
original byte and mode. A corrected batch installs and restores both destinations. The broader
lifecycle run passes 166 cases; its only failure is an external EditorConfig Checker release
API rate limit during native installation. That unavailable download is not a lifecycle pass.

Doctor passes with the declared mise CodeQL version and the refreshed private plugin. Preset
and dependency detection exclude generated, vendored, and private tool files; a real authored
Python project remains detectable. The detection, repository, and doctor run passes 105 cases
with 365 assertions. This corrects the false Python recommendation from `.gspot/pyproject.toml`.

JavaScript JSDoc type tags remain available to `checkJs`; the redundant-type-tag rule applies
only to TypeScript. The generated ESLint suite passes six cases with 18 assertions across
both levels, and workspace type checking passes. Three launcher callbacks have individually
justified structural suppressions for required predicate and process-listener interfaces.
Owner-driven apply refreshes ESLint configuration; the launcher check passes with no findings.
The unowned JSON and SARIF reports are preserved byte for byte with their modes through
lifecycle retirement and recovery. Subsequent report publication succeeds without warnings.
A fresh TypeScript ESLint run executes all four scopes without module-loading errors and
reports 6,030 findings. This scoped run is separate from the historical 5,710-finding baseline
and the five staged dependency errors; final repository and staged acceptance remain open.

### Configuration carryover

Disabled-rule destinations now come from the owning `tools.takeover.check` declarations.
The global tool-to-check table is removed. Manifest validation rejects missing destinations
and checks that execute another tool. Carryover refuses a missing declaration instead of
guessing its check. The affected declaration and adoption suite passes 93 cases with 345
assertions; workspace type checking passes. Unsupported importer behavior remains open.

ShellCheck adoption now uses the same directive reader as rule previews. That reader lives
under repository input handling and retains quoted codes, repeated directives, and inline
comments as separate syntax. The former importer treated comment text as part of a rule ID,
so joining carried codes onto one line could hide a later disabled code. The carryover fixture
verifies canonical rule IDs and preserved original bytes. Native pinned ShellCheck accepts
the original quoted/commented exclusions (exit 0), reports SC2046 with the former conversion
(exit 1), and accepts the corrected conversion (exit 0). The affected takeover, preview, and
documentation-example tests pass 34 tests with 154 assertions; types pass. Unsupported
ShellCheck settings remain explicitly unadopted.

SQLFluff adoption now parses case-sensitive INI through the repository reader shared with rule
previews. Valid continued exclusion lists carry from standalone `.sqlfluff` and shared
`setup.cfg` input, including CRLF text. Duplicate keys are refused before any retirement plan;
original bytes remain intact. Shared sections are parsed after selection, and `.sqlfluffignore`
continues through its path-list owner. Unsupported SQLFluff settings remain unadopted. The
affected takeover and preview suites pass 34 tests with 154 assertions; types and formatting
pass. Native SQLFluff 4.0.0 accepts both the continued original and joined carried exclusions
(exit 0), and reports CP01 when that exclusion is removed (exit 1). Full effective configuration
carryover and frozen-candidate adoption remain open.

Open. Complete lossless effective configuration resolution for path-specific rules, shared manifests, formatter overrides, and every supported root pointer. Retain unsupported source configuration and list every uncarried setting. Keep developer ESLint and its dependencies intact.

Open acceptance IDs: K-36, K-193, K-41, K-120, K-59, K-217, K-239, K-269, K-270.

Former unnamed cleanup entries: 37.

Source and retained evidence: [packages/cli/src/lifecycle/takeover.ts](../packages/cli/src/lifecycle/takeover.ts), [tests/acceptance/cli/takeover.test.ts](../tests/acceptance/cli/takeover.test.ts).

Acceptance: [K-36](03-configuration.md#acceptance-k-36), [K-193](03-configuration.md#acceptance-k-193), [K-120](03-configuration.md#acceptance-k-120), [K-59](10-hooks-ci-runners.md#acceptance-k-59), [K-217](03-configuration.md#acceptance-k-217), [K-269](03-configuration.md#acceptance-k-269).

SQLFluff takeover files and shared sections are declared by the SQL preset. Adoption
preserves `setup.cfg` and `tox.ini`, including when SQLFluff is their only section,
and identifies the adopted section for manual removal. Nested disabled rules retain
their directory scope. Unsupported and duplicate sections remain unadopted. Discovery
and carryover tests pass 18 cases with 82 assertions; two CLI cases pass with 18
assertions, preserving original bytes and modes through init and uninstall. Type checks
pass. Unsupported importer behavior and final candidate acceptance remain open.

SQLFluff and Semgrep ignore files use preset-owned takeover declarations and the
`ignore-paths` reader. Nested selectors retain their base, and unsupported negation
preserves the original without partial imports. Carried tool settings and rule exceptions
share one tool-keyed map consumed by policy emission and the takeover plan. The reader
schema rejects unknown reader names. The declaration and carryover run passes 36 cases
with 117 assertions; the affected ESLint and formatter adoption run passes 29 cases with
112 assertions after the map change.

Ruff adoption rebases basename and directory selectors to their configuration directory.
Pinned Ruff 0.16.8 diagnostics verify basename matches at deeper paths, rule-family
exemptions, retained outside-scope findings, and corrected sources. Two tests pass with
21 assertions, including refusal of unsupported nested negation and escaping selectors
without partial imports. Inherited configuration and unsupported settings remain open.

Ruff adoption also carries `extend-ignore` and `extend-per-file-ignores`. Base and additive
per-file rules combine without losing either list or their directory scope. Native pinned
Ruff diagnostics match before and after adoption for global exclusions and shared selectors:
the retained F401 defect exits 1, and its corrected source exits 0. Unsupported additive
selectors refuse the whole import and preserve original bytes. The affected Ruff and takeover
suites pass 29 tests with 175 assertions. Inherited configurations remain open.

Local Ruff `extend` chains now carry the supported exclusion settings through observed,
confined reads. Inherited files remain intact and join publication-time input validation.
Native Ruff 0.16.8 confirms accumulated ignore rules, child replacement of per-file maps,
and each inherited selector's declaring directory. The comparison retains two F401 defects
(exit 1) and accepts their corrected sources (exit 0). A shared `tool.ruff` parent retains
unrelated project metadata. Missing parents, cycles, unsupported settings, escaping paths,
and external symlinks preserve the child without partial imports. Inherited wildcard
intersections that cannot be represented and overlapping discovered configurations remain
explicitly unadopted. The affected takeover suites pass 36 tests with 217 assertions; types
pass. Full inherited configuration support and frozen-candidate adoption remain open.

Shared takeover selectors support TOML tables and JSON/YAML keys. The schema requires
`shared = true` for section selection and rejects combining `key` with `table`. Ruff
declares its standalone files and `tool.ruff` table in the Python preset; ESLint declares
the `eslintConfig` package key in the JavaScript preset. SQLFluff, Semgrep, typos,
ShellCheck, SwiftLint, Squawk, and Hadolint use their owning presets for the moved
declarations. The affected policy, discovery, init, and declaration run passes 105 cases
with 310 assertions. The full takeover CLI suite passes 20 cases with 155 assertions,
including idempotent apply and original-file restoration. Complete importer coverage
remains open.

License adoption resolves package exclusions with the installed owning scanner in the
configuration worker. It records actual package versions and reported licenses instead of
inventing `UNKNOWN`, and refuses unresolved exclusions before adding any carried entry.
Allowances outside SPDX syntax preserve the original for explicit conversion. Native scanner
5.0.1 verification passes two cases with 15 assertions, including unresolved and corrected
dependencies. The affected policy, adoption, and preset run passes 122 cases with 376
assertions before the additional SPDX refusal case. Type checking passes.

Advisory expiration imports preserve full TOML date and timestamp values, including
offsets, through generated scanner configuration. Three round-trip cases pass with
12 assertions; native advisory expiry and directory-local exception behavior remain open.
Formatter, EditorConfig, and ESLint filenames and package keys are preset declarations.
Retained-configuration detection reads those declarations instead of maintaining a second
filename list. After updating the combined formatter fixture to use its declared tool
identity, adoption passes 29 cases and the full takeover CLI suite passes 20 cases with
155 assertions. These runs do not close the remaining importer and candidate gates.

Markdownlint, basedpyright, Gitleaks, and Stylelint takeover files use preset declarations.
The affected policy, adoption, and preset run passes 127 cases with 400 assertions.
Markdown emission preserves an explicitly carried native `default: false` instead of
re-enabling shipped rules such as MD041. A native comparison reports the retained MD033
defect with identical diagnostics before and after adoption, accepts corrected content without
a heading, and fixes an explicitly enabled whitespace rule. The affected adoption and emission
run passes 58 tests with 398 assertions. The CLI adoption journey passes 11 assertions through
private installation, partial correction, a native editor check, and uninstall restoration of
original bytes and permissions. Workspace types and changed-file formatting pass.
The documentation build emits 312 pages and passes internal link and fragment checks.
A native Markdownlint 0.23.2 probe confirms that `--config` alone does not isolate policy:
an MD033 defect exits 1 with the selected configuration, then exits 0 after a nested
`.markdownlint.jsonc` disables it. The execution owner now copies only selected sources and
declared configuration into a disposable file workspace. The manifest declares this isolation
for both checks and corrections. Native discovery cannot load repository overrides or execute
their configuration scripts. Corrections validate unchanged original bytes before publishing
selected changes, retain partial corrections on cancellation or timeout, and clean up the
workspace after success and failure. Preview corrections preserve authored files.

Disjoint directory-local Markdown configurations create scoped policy tables and generated
editor pointers. Native tests verify different sibling rules, descendant inheritance, and
corrected content. Overlapping configurations remain intact before any partial adoption.
Markdownlint receives literal file arguments through its declared prefix, including brackets,
leading hashes, and leading hyphens. The execution, adoption, preset, and emission suites pass
298 tests with 1,632 assertions. Root and scoped CLI journeys pass 50 assertions through private
installation, native editor checks, staged content distinct from the working copy, partial
correction, and uninstall restoration. Types, schema freshness, manifest formatting, and
changed-file formatting pass. Package inheritance, custom rules, and overlapping Markdown
adoption remain open.

Markdown checks use native JSON result arrays from the generated CLI configuration. The editor
and CLI configurations share one effective rule owner. Native diagnostics preserve filenames
containing colons and newlines, rule IDs, source locations, and per-finding fixability.
Malformed records, unavailable source, and fatal exits return 2, including a fatal exit with
partial valid findings. Root and scoped CLI journeys pass 82 assertions through reporting,
partial correction, staged content, native editor checks, and uninstall restoration.
The affected parser, fixer, emission, and adoption run passes 166 tests with 932 assertions.
Serialization and published-schema checks pass 54 tests with 209 assertions, including exact
option keys and values in the generated JavaScript configuration. Rule previews, generated
references, and documentation examples pass 20 tests with 955 assertions. Types, schema
freshness, and manifest formatting pass. Frozen-candidate and native-platform gates remain open.

Static Markdown inheritance resolves explicit relative JSON, JSONC, and YAML parents in their
declaring directories. Child values replace inherited values by rule name. Every parent is
confined and observed for publication-time validation, and inherited originals remain intact.
Native Markdownlint 0.23.2 comparisons verify transitive inheritance, disabled defaults, child
overrides, concrete defects, corrections, and whitespace fixes. Cycles, escaping paths, external
links, missing parents, and unsupported parent settings preserve the original without partial
settings. Corrected parent files can be adopted. The affected adoption and emission suites pass
98 tests with 696 assertions. Root and scoped CLI journeys pass 90 assertions, including parent
bytes and permissions through initialization and uninstall. Workspace types, changed-file
formatting, and diff whitespace checks pass. Package inheritance and custom rules remain open.

Native-default adoption exposed a separate loss of enforcement: omitted or enabled `default`
values lost MD013 and MD033 findings because shipped overrides still applied. Adoption now
records implicit native defaults, and an explicit native default selects the native rule set
before individual overrides. Pinned Markdownlint comparisons reproduce both failures before
the fix, then preserve identical diagnostics and accept corrected content. The affected adoption
and emission run passes 67 tests with 475 assertions. Three CLI journeys pass 135 assertions
through implicit defaults, disabled defaults, inherited scopes, partial fixes, staged content,
and original-file restoration. Types and changed-file formatting pass. Broader importer and
frozen-candidate acceptance remain open.

The shared isolation owner is [file-workspace.ts](../packages/cli/src/run/file-workspace.ts),
used by the tool runner and fixer runner. Frozen-candidate and native-platform acceptance
remain open.
Nested secret, advisory, and license settings refuse conversion instead of
silently becoming repository-wide exceptions. Overlapping Ruff configurations also refuse
adoption before importing a parent exemption into a child configuration. Scope-preserving
conversion for these refusals remains implementation work, not completed acceptance.

Nonoverlapping nested spelling configurations carry locale, identity word allowances, and
exclusions into new or existing scope tables. Generated typos configuration follows each scope
and inherited descendant settings. Template-backed editor stubs translate root-relative
exclusions to their directory, preserving basename patterns, ordered negations, directory
selectors, wildcard prefixes, and brace alternatives. Pinned typos 1.43.5 comparisons cover
eight selector cases across six paths, including descendant editor configurations.

The planner partitions policy checks that read scoped native configurations. Spelling uses
that partition instead of checking every file with root settings. Checks and fixers use
`--isolated`; an unowned nested native configuration cannot override generated policy.
The policy file recognizes declared scoped dictionary words through a native file-type override,
without adding those words to other root files. The CLI acceptance case reports root and local
defects as 1, corrects eligible files, preserves excluded source and local British spelling, then
returns 0. Uninstall restores the original nested bytes and permissions. That case passes with
14 assertions. Overlapping spelling configurations, unsupported native settings, and
frozen-candidate adoption remain open.
The affected planner, emission, takeover, and manifest suite passes 252 tests with 1,438
assertions. Workspace types and changed-file formatting pass. These local results do not
replace the full integration run or frozen-candidate acceptance.

Spelling locale validation accepts the five locales supported by pinned typos. Root and scoped
policy, reasoned values, the published schema, and native configuration adoption agree.
An unsupported imported locale remains unread without retiring its original; a corrected locale
can be adopted. Invalid `set` returns 2 without changing policy or generated configuration.
Native malformed configuration already yields an execution error and status 2. The CLI case
also verifies that apply preserves an edited output and regenerates it after the defective
fixture is removed. Schema and takeover tests pass 64 cases with 288 assertions, and the
extended CLI spelling case passes with 23 assertions. Types and schema freshness pass.

Every existing takeover filename and shared selector is declared by its owning preset.
Discovery, retirement eligibility, and retained-output selection no longer maintain separate
filename or preset-owner tables. Discovered configurations require a declared reader.
`CarriedLists` is the tool-entry map; the enclosing configuration also records observations
and retirement decisions. The declaration run passes 151 tests with 507 assertions, and
the subsequent reader-contract run passes 115 tests with 396 assertions. Type checking
passes. The lifecycle run passes 105 cases with 617 assertions, and the isolated-registry
CLI takeover run passes 20 cases with 155 assertions. Unsupported readers and scope
conversion remain open; declaring a filename does not establish faithful import support.

ESLint module registration handles static imports, top-level literal dynamic imports, and
CommonJS requires. Default-export traversal avoids Bun-only synthetic CommonJS export
names in generated Node configuration. Adoption tests pass 33 cases with 134 assertions.
The imported rule reports the planted identifier and accepts the corrected source under
both Bun and Node. External module links refuse evaluation for all three import forms
without executing the external module. Type checking passes.

Declared discovery excludes managed directories and vendored inputs. The first expanded
unit/plugin/integration run passed 1,063 cases and exposed one initialization-conflict
regression: managed output was being rediscovered as an input. The corrected conflict case
passes and preserves both originals. Root legacy `.eslintignore` files are captured before
executable evaluation and their native ignore entries survive conversion. A changed ignore
file prevents publication; corrected configuration preserves future-file exclusions. The
affected adoption, policy, and discovery run passes 121 cases with 430 assertions, and type
checking passes. The repeated unit/plugin/integration run passes all 1,066 cases with
3,929 assertions before the subsequent CodeQL work.

Retained formatter configuration suppresses pointers only in its own directory. Explicitly
adopted EditorConfig documents remain generated even beside a retained package formatter table,
so init cannot retire their originals without publishing replacements. The native formatting
suite passes 24 tests with 489 assertions across JSON5, nested precedence, shared package
metadata, future selectors, repeated apply, and exact restoration. Executable configuration
that changes a reviewed input refuses publication and retains the changed input.

Package-manager detection validates manifests through the repository reader before invoking the
native detector. Malformed JSON and invalid dependency values produce inability code 2; valid
policy violations remain findings. The dependency acceptance and package-project/manifest suite
passes 15 tests with 292 assertions across npm, Bun, pnpm, and Yarn.

Root Stylelint rule tables preserve enabled rules and native options, including zero-valued
limits. Disabled primary options become ignores using the preset-declared check. Adoption
validates rule names and options with the installed preset version before permitting retirement.
Missing or mismatched installations, unknown rules, invalid options, and lossy TOML conversion
preserve the originals without partial settings. Nested, package-provided, and executable Stylelint
configuration remains unsupported and active. The policy schema, manifest, generated configuration,
and adoption guide describe the supported surface together.

The affected policy, adoption, serialization, and schema run passes 167 tests with 615 assertions.
The native CLI journey installs private tools, reports defects in a file created after adoption,
accepts corrected source, and restores the original configuration bytes and mode on uninstall.
Its nine assertions pass, including an unchanged project manifest. Workspace type checking,
schema freshness, authored TypeScript formatting, and diff whitespace checks pass. This evidence
does not close inherited and nested importer coverage or final candidate acceptance.
The macOS ARM64 CLI builds, and its compiled configuration worker preserves both carried
Stylelint rules in an initialization preview without changing originals or publishing policy.
These artifacts are provisional and are not the frozen acceptance candidate.

Stylelint emits configuration and editor pointers for each declared scope. A native acceptance
case without developer tools exposed root-based resolution of the standard configuration.
The command now resolves its dependencies from the private installation. The corrected case
passes six assertions, reporting opposite configured defects in root and nested files and
accepting corrected source through both the CLI and native editor pointers.

Static local Stylelint inheritance resolves JSON and YAML parents in declaration order, then
applies child rules. Every parent is confined and recorded for publication-time validation.
Inherited originals remain intact. Native comparisons cover future files, multiple parents,
transitive inheritance, enabled options, disabled rules, and zero-valued limits. Cycle,
invalid-option, and external-link cases preserve original files and accept corrected parents.
Package-provided inheritance remains open.

Native nested enforcement exposed that one scoped rule override dropped unrelated inherited
rules. The shared settings resolver merges per-rule tables by rule name and replaces each
rule's options as a whole. The corrected native scope and settings cases pass nine assertions,
including inherited zero-valued limits and replacement of secondary options. The affected
settings, plugin-level emission, and serialization run passes 38 tests with 222 assertions;
workspace type checking passes. Static Stylelint adoption, serialization, and takeover pass
43 tests with 275 assertions. These results do not close the remaining importer coverage.
Native resolution also exposed a package-style lookup incorrectly adopting a same-named local
file. Static adoption now requires explicit relative inheritance paths. The unsupported lookup
preserves the original; its corrected relative path adopts successfully. The Stylelint adoption
and profile run passes 27 tests with 145 assertions.

Disjoint directory-local Stylelint configurations now create scoped policy tables. Static
inheritance still validates every rule before retirement and preserves parent files. Disabled
rules retain escaped directory selectors. Scope-wide allowances also reach generated native
configurations, including descendant scopes, while partial selectors and exclusions remain
per-file filters. Native editor checks verify future files, sibling isolation, inherited
allowances, and a directory name containing brackets. Overlapping source configurations remain
unadopted before any partial carryover. Package and executable inheritance remain open.

The affected adoption, settings, and emission suites pass 140 tests with 815 assertions. Five
CSS CLI journeys pass with 50 assertions, including nested inherited adoption, private tool
installation, native editor checks, concrete defects and corrections, and restoration of the
original bytes and permissions on uninstall. Workspace types and changed-file formatting pass.

Inline suppression reads use the shared source boundary. Two planted external paths cannot
suppress findings, while corrected local comments work. The affected inline-ignore run passes
11 tests with 37 assertions. The plugin directory reader propagates missing-path and
non-directory errors; its three file-reader tests pass with seven assertions.

License adoption now carries representable nested configuration into its directory scope.
Native package resolution runs before any carried settings or retirement authorization, so
unresolved exclusions leave both root and scoped state empty and preserve the original.
Policy proposal and emission retain the two exact package exceptions in the adopted scope
and leave a sibling empty. Inspection also exposed that a restrictive `onlyAllow` list would
be widened by additive shipped allowances. Such lists now remain unadopted, as do overlapping
license configurations that need explicit conversion. The focused adoption suite passes
43 cases with 303 assertions; types, formatting, and whitespace checks pass. Full effective
configuration adoption and candidate acceptance remain open.

### Tool installation

Open. Verify immutable installation under each supported package manager, workspace and private-registry configuration. Complete manifest-owned install metadata, missing-host advice, isolation, retries, and tracked-file preservation. Resolve changed locks only during apply.

Open acceptance IDs: K-180, K-240, K-237, K-264, K-265, K-266, K-283, K-267, K-268, K-297.

Source and retained evidence: [packages/cli/src/lifecycle/install-command.ts](../packages/cli/src/lifecycle/install-command.ts), [tests/integration/cli/install.test.ts](../tests/integration/cli/install.test.ts).

Acceptance: [K-264](11-toolchain.md#acceptance-k-264), [K-267](03-configuration.md#acceptance-k-267), [K-297](11-toolchain.md#acceptance-k-297), [K-180](04-presets.md#acceptance-k-180), [K-237](03-configuration.md#acceptance-k-237), [K-268](03-configuration.md#acceptance-k-268).

Python installation excludes runtime `__pycache__` directories from publication and pruning,
while retaining packaged bytecode outside those cache directories. This preserves both unowned
and previously recorded runtime caches across repeat installation. The ownership suite passes
47 tests with 275 assertions.

Repository apply updates five generated outputs through ownership without conflicts. The new
package manifest triggers lock resolution against the local candidate registry. Locked npm
and Python installation both succeed; the installed standalone plugin is version 0.1.0 and
hooks report ready. No pending installation marker remains. Mise still cannot install its
unpublished `github:stefanionescu/gspot@0.1.0` pin. This is a candidate provisioning gate, not
authority to publish. The historical five staged dependency errors still require fresh
index verification, and final artifact hashes are not frozen.

Authenticated package installation now has fresh Git-clone evidence for npm 11.19.0,
Bun 1.3.11, pnpm 9.9.0, Yarn Classic 1.22.22, and Yarn Berry 4.9.2. The clone contains
neither installed tools nor clone-local ownership state. Two immutable installs leave Git
status clean and preserve the recorded manifest and lock bytes. The installed native formatter
reports a concrete defect, corrects it, and accepts the corrected file. The manager fixture
also retains stale-lock refusal, conflict recovery, authenticated registry access, and edited
dependency preservation. The default-manager run passes six cases with 331 assertions; the
separate Yarn Berry run passes 62 assertions. Types, formatting, and diff whitespace checks
pass. Frozen-candidate, Python, and real-hook clone acceptance remain open.

Python installation also passes fresh-clone journeys using authenticated index settings from
both `uv.toml` and `pyproject.toml`. Two installations preserve tracked files and recorded
project and lock bytes without clone-local ownership state from the original repository.
Pinned Ruff reports F401, corrects it, and accepts the corrected source. A generated Python
console script resolves its environment inside the clone, despite inherited project-redirection
variables. The Python installation suite passes four cases with 152 assertions, retaining
conflicted-lock repair and environment-relocation coverage. Types pass. These local results
leave frozen-candidate, real-hook clone, and native Windows acceptance open.

The real-commit clone journey exposed a missing setup reminder. Working-tree and staged checks
now consult the shared hook-status owner against the actual clone, preserving the selected
policy for index checks. Missing or edited integration produces one warning without changing
the check verdict. The warning disappears after installation. A Bash repository installs,
commits corrected source, and is cloned without local hook state. Two clone installations leave
tracked files unchanged. Real commits reject SC2086 and accept quoted input in both repositories.
The hook suite passes three cases with 101 assertions, including exact pushed objects and a
repository below the Git root. Doctor and installation checks pass 43 cases with 321 assertions.
Types, formatting, and diff whitespace checks pass. An earlier broader fixture hit GitHub's
rate limit while downloading EditorConfig Checker; it is not package-download acceptance.
The focused Bash hook fixture omits that unrelated formatter recommendation. Frozen-candidate
and native-platform installation gates remain open.

### Initialization and detection

Open. Complete project and dependency detection, grouped preset selection, detected defaults, and one read-only proposal. Initialize new and existing repositories without running checks; a missing tool differs from invalid configuration or failed lock resolution.

Open acceptance IDs: K-182, K-214, K-247, K-126, K-128, K-53, K-93, K-40, K-64.

Locally implemented IDs: K-127.

Source and retained evidence: [packages/cli/src/lifecycle/init/command.ts](../packages/cli/src/lifecycle/init/command.ts).

Acceptance: [K-182](04-presets.md#acceptance-k-182), [K-126](03-configuration.md#acceptance-k-126), [K-128](03-configuration.md#acceptance-k-128), [K-53](05-engines.md#acceptance-k-53), [K-93](04-presets.md#acceptance-k-93), [K-40](04-presets.md#acceptance-k-40), [K-64](02-cli.md#acceptance-k-64).

### Configuration and scopes

Open. Complete readable comment-preserving writes, deepest-scope selection, consistent formatting settings, canonical setting names, and destination-safe serialization. Separate syntax failure from recoverable policy findings.

Preset scalar conflicts retain their setting keys for validation. Explicit root or inherited
scope values settle the conflicts they cover. Unresolved scope conflicts identify the scope's
preset declaration, including scopes without settings tables. List defaults append and
deduplicate across presets before root and scope values apply. The focused settings, schema,
policy loading, and scope discovery checks pass 107 tests with 230 assertions. These cases
cover unresolved and corrected conflicts, descendant inheritance, sibling isolation, and
list merging across all layers. Remaining configuration acceptance stays open.

SQLFluff dialect precedence now uses preset-owned defaults and the shared settings resolver.
The PostgreSQL database preset declares `postgres`; plain SQL declares `ansi`. Root and scope
values override those defaults, and SQLFluff configuration emits for each scope. The native
SQLite statement reports a PostgreSQL parse defect (exit 1) and passes with its explicit
generated SQLite configuration (exit 0). Nested DuckDB settings propagate to a descendant.
The settings and emission suites pass 42 tests with 142 assertions. Generated settings
references preserve distinct preset defaults while rejecting incompatible definitions; six
reference cases pass with 905 assertions. The 312-page documentation build and internal link
checks pass. This closes the observed dialect/default mismatch, not the broader configuration
or candidate acceptance gates.

SQLFluff dialect values are validated as lowercase labels before INI emission. Runtime and
published schemas reject embedded directives, control-line endings, empty labels, and section
syntax in root and scope settings. Reasoned valid values remain accepted. The planted CLI
case returns 2 before changing existing configuration; the corrected label previews with
exit 0 and preserves its input. The settings/schema run passes 52 tests with 128 assertions,
and the CLI case passes five assertions. The published schema is regenerated by its owner.

Squawk transaction defaults now come from the PostgreSQL and Supabase manifests. The template
uses the effective setting instead of forcing Supabase to true, and each scope receives its
own configuration. Explicit false values remain false; a child inherits its containing scope's
true value. Native Squawk accepts the assumed-transaction case (exit 0), reports
`prefer-robust-stmts` for the explicit false case (exit 1), and accepts the corrected SQL
(exit 0). Settings, emission, and reference tests pass 44 cases with 996 assertions. Runtime
and published schemas require booleans, including reasoned values, in root and scope tables;
29 schema cases pass with 84 assertions. Types, formatting, and owned schema generation pass.
Full adoption and candidate acceptance remain open.

Ruff configuration now emits per scope. The emission owner restricts `has` to that scope's
presets for per-scope targets, including the root; repository-wide targets still see nested
selections. This fixes pytest allowances leaking into unrelated Python projects. The pytest
selection also enables Ruff's PT family at recommended level. Native diagnostics retain S101
outside the pytest scope, permit test assertions inside it, report PT001 for the fixture
decorator defect, and accept its correction. Scoped parameter limits emit separately. Emission
and Ruff adoption suites pass 69 tests with 441 assertions. The existing native pytest/FastAPI
CLI acceptance journey passes two cases with 11 assertions through the isolated local registry.
Types and formatting pass. Other scope/adoption requirements and frozen-candidate acceptance
remain open.

K-222 is locally implemented. EditorConfig no longer overrides YAML indentation with a
fixed width. The shared-width fixture selects `level = "all"` so it exercises shfmt.
Widths of two and six reach EditorConfig, Prettier, Markdownlint, yamllint, Ruff, Taplo,
SQLFluff, SwiftFormat, and shfmt arguments. Native Prettier rejects the planted indentation
defect, produces the expected correction, and accepts it. An explicit YAML override remains
consistent between editor discovery and generated Prettier configuration. The three focused
cases pass with 30 assertions; the broader serialization and takeover run passes 52 cases
with 368 assertions. Native formatter override, preservation, and EditorConfig adoption
acceptance passes 11 cases with 182 assertions. Frozen-candidate acceptance remains open.

Open acceptance IDs: K-147, K-238, K-51, K-88, K-215, K-224, K-228, K-48.

Locally implemented IDs: K-222.

Source and retained evidence: [packages/cli/src/policy/schema.ts](../packages/cli/src/policy/schema.ts), [tests/native/policy/takeover.test.ts](../tests/native/policy/takeover.test.ts).

Acceptance: [K-51](03-configuration.md#acceptance-k-51), [K-88](03-configuration.md#acceptance-k-88), [K-48](03-configuration.md#acceptance-k-48), [K-215](03-configuration.md#acceptance-k-215), [K-222](03-configuration.md#acceptance-k-222), [K-238](03-configuration.md#acceptance-k-238), [K-147](03-configuration.md#acceptance-k-147), [K-116](03-configuration.md#acceptance-k-116).

### Commands and reusable profiles

Open. Finish the exact public command surface and selectors. Preserve export and init --from, including pathless ignores and integration choices; report omitted repository-specific values. Verify dry-run preservation and effective add/remove dependencies.

Open acceptance IDs: D-129, K-62, K-63, K-95, K-98, K-284, K-285, K-287, K-288, K-291.

Locally implemented IDs: K-290, K-289.

Profile initialization merges carried tool configuration by setting instead of replacing the
whole tool table. A native typos regression reproduced loss of the profile word allowances
when adopting only a repository locale. The corrected journey preserves those allowances and
British spelling, reports an unrelated typo, accepts its correction, and restores the original
configuration on uninstall. Profile, initialization, and runner-task integration passes 33
cases with 166 assertions. The native profile, dependency, and duplication CLI batch passes six
cases with 57 assertions. Other profile and candidate acceptance remains open.

Source and retained evidence: [packages/cli/src/program.ts](../packages/cli/src/program.ts), [tests/acceptance/cli/profile.test.ts](../tests/acceptance/cli/profile.test.ts).

Acceptance: [D-129](02-cli.md#acceptance-d-129), [K-95](02-cli.md#acceptance-k-95), [K-284](02-cli.md#acceptance-k-284), [K-287](02-cli.md#acceptance-k-287), [K-291](02-cli.md#acceptance-k-291), [K-62](02-cli.md#acceptance-k-62), [K-290](02-cli.md#acceptance-k-290).

### Hook composition and runner tasks

Open. Verify each supported hook manager and runner, reachable existing-hook composition, independently replayed stdin, failures, clone-local setup, and owned restoration. Preserve developer tasks and never inject prepare scripts.

Open acceptance IDs: K-109, K-76, K-78, K-56, K-57, K-58, K-60, K-292, K-275.

Husky native installation and readiness are implemented locally for the version 9 runtime.
Lefthook native preparation, owned publication, and readiness are implemented for policy at
the Git root. Remaining execution, existing-manager composition, platform, and candidate
acceptance work is recorded below. Complete the full journeys before closing these managers.

The shared dispatcher now reports unavailable launchers as setup failure `2`. Native macOS
Bash reproduced `127` for a missing launcher and `1` for a PATH entry without execute permission.
The emitted invocation checks executable availability before running it; remaining shell
`126`/`127` failures normalize to `2`. The corrected cases return `0`. Original-hook failures
remain unchanged. Installation, simple-git-hooks, pre-commit, and clone regressions pass 47
cases with 503 assertions. This does not close classification of native manager or package
runner failures that use `1` for both setup errors and findings.

Husky 9.1.7 native fixtures exercise default Git hooks, an existing native installation, and
nested policy directories in paths containing spaces and an apostrophe. Preparation runs in a
disposable Git repository, so native configuration writes never change the consumer's
`core.hooksPath`. Publication and restoration use the shared lifecycle owner. The native
runtime executes authored scripts and initialization in a separate process. Successful early
`exit` or `exec` cannot skip gspot, while authored failures retain their status. Both commands
receive independently replayed push input. The managed invocation retains original remote
and message arguments even after authored `cd` and `set --` commands.

Deleting an integration script initially produced a gspot finding instead of a setup error.
The installed wrapper now rejects the missing script with `2` and an apply/install instruction.
Readiness rejects missing or edited managed blocks. Changing the configured runner initially
left a false ready status for the old fallback invocation; readiness now compares that
invocation with current emission and requires installation. Native testing also reproduced a
lost finding after an authored `set +e` and successful trailing command. The installed wrapper
now retains gspot's finding even when the native aggregate status is zero. Repeated block
markers are refused before installation. Authored content around blocks remains editable.
Uninstall restores original native/local hook bytes and authored scripts.
A fresh Husky clone uses immutable `npm ci`, runs real CLI install/apply twice without tracked
changes, rejects a staged source defect despite its corrected working tree, and accepts the
staged correction. These are source-level macOS arm64 checks, not frozen-candidate or Windows
acceptance. Older native runtime layouts still need explicit adoption evidence. Stale or edited
recognizable native launchers use the preservation-and-regeneration refusal described below.
The settled native-manager and clone run passes 17 cases
with 606 assertions. Husky plus shared installation checks pass 40 cases with 500 assertions.
Type checking, formatting, and diff whitespace checks pass. The reader guide documents explicit
installation, input preservation, runner changes, and restoration.

First adoption now refuses recognizable native launchers whose bytes differ from freshly
generated output, rather than chaining them as custom predecessors and running the manager
twice. This is a conflict refusal, not automatic migration or permission to discard edits.
Native Lefthook, Husky, simple-git-hooks, and pre-commit fixtures retain an edited final-stage
launcher without publishing earlier-stage proposals or original/manager siblings. Regenerating
through the native owner permits installation and one gspot invocation. A Lefthook `rc` change
also verifies refusal of a stale, unedited template. Native markers belong to the hook feature
owner, and the reader guide explains preservation and regeneration. An edited native auxiliary
helper is also refused before publishing any main-stage hook. The affected native adoption and
manager run passes 18 cases with 555 assertions. Types and formatting pass.

Shared hook readiness verifies the owned native manager sibling as well as the dispatcher.
Deleted, edited, or mode-changed siblings no longer produce a false ready status. The native
simple-git-hooks regression covers root and nested policy directories and accepts restored
scripts. Both simple-git-hooks and pre-commit execution remain verified by the affected suites.

Lefthook integration requires version 2.0.13 or newer and policy at the Git root. Emission and
readiness share the configuration owner, which closes its confined reader and owns only the
three gspot commands plus `no_auto_install`. Native preparation loads resolved configuration,
preserves inherited hook-template settings such as `rc`, and generates hooks in a disposable
Git directory. It publishes through the lifecycle owner without changing `core.hooksPath`.
Resolved inheritance and remote declarations are removed from the temporary configuration so
the native installer does not load those sources again from the temporary root.

The version requirement and `no_auto_install` address an observed native-helper defect.
Lefthook 1.11.13's existing `prepare-commit-msg` helper can replace dispatchers after configuration
changes, even when the three gspot hook invocations disable automatic installation. A real
commit reproduced the failure. Native 2.0.13 probing verifies that `no_auto_install` preserves
the dispatcher, and the integration fixture now completes a real commit after template changes.
Older dependencies are rejected before hook replacement. The reader guide names the requirement.

An existing hook that exactly matches the native generator is retained in lifecycle recovery
and delegated to the prepared manager once. Authored local hooks remain executable predecessors.
Keeping native originals in recovery prevents a later template change from putting the old
manager back into the executable chain. Native tests verify one gspot invocation after an
inherited `rc` change and reinstallation, and restore the original native bytes on uninstall.

The installed manager carries exact push and message arguments through quoted environment
values instead of native positional substitution. Native probes showed that both unquoted
placeholders and script entries split spaces and evaluate shell characters. The installed-hook
fixture preserves spaces, quotes, dollar signs, and backticks, and delivers two exact revision
records. Native manual `lefthook run` cannot supply this transport by itself; missing transport
fails with an installation instruction.

Installed hooks preserve gspot's result separately from Lefthook's aggregate verdict. A gspot
setup failure returns `2`, and findings return `1`. Missing manager executables and malformed
inherited configuration also return `2` with an installation hint. Runtime configuration loading
uses the native offline loader. Installation avoids `validate`, which in native 1.11.13 fetches
a schema from the upstream default branch. The fixture reproduces that network dependency and
verifies hook preparation with an unreachable HTTPS proxy after dependencies are installed.
This does not prove offline package acquisition or the final immutable clean-checkout gate.

Native command selection remains intact. If native jobs succeed without executing gspot, the
installed hook runs gspot afterward. Empty-index and unchanged-push cases verify one invocation,
a finding, and correction. The unchanged-push case first proves native command skipping and
then verifies exact arguments and replayed stdin through the installed hook. Temporary input,
configuration, and result files are removed after success and failure. Repeated installation,
authored YAML preservation, readiness, and owned restoration are verified.

Initialization-script control flow is isolated from the installed dispatcher. Native cases
reproduced false success when `rc` used `exit 0` or `exec true`. A fresh Bash process now
preserves native `set -e` behavior while the dispatcher retains the gspot verdict and push
input. Successful initialization exits still run gspot once; explicit failure remains a failure.
The fixture also consumes stdin in `rc` and verifies that gspot receives the complete replay.

Repository paths containing spaces and an apostrophe exposed an unquoted executable in the
native hook resolver. A native 2.1.14 probe reproduces the same syntax error as pinned 2.0.13,
so the minimum version remains unchanged. The manager adapter replaces the generated resolver
with a quoted invocation of the resolved repository executable. Existing auxiliary hooks that
exactly match native output receive the same repair through lifecycle ownership. Authored
auxiliary hooks remain unchanged. Missing or edited owned helpers fail readiness; edited
helpers prevent replacement, and uninstall restores the original bytes. A real commit verifies
the repaired `prepare-commit-msg` helper without replacing the gspot dispatcher. The affected
manager suites pass 13 cases with 365 assertions, and the final Lefthook plus real-Git hook
acceptance run passes six cases with 267 assertions on macOS arm64. These are source checks,
not frozen-candidate or other-platform acceptance.

The current native manager suites pass 11 cases with 221 assertions on macOS arm64. Installation,
doctor, apply, and documentation-example checks pass 63 cases with 403 assertions. CLI types,
formatting, and diff whitespace checks pass. Lefthook remains open for native runtime errors that share exit `1` with authored job
failures and broader platform/candidate acceptance. First adoption of recognizable stale or
edited launchers is covered by the conflict-refusal evidence above. Forced direct-native probes do not establish
that every installed hook input runs.

Source and retained evidence: [packages/cli/src/lifecycle/hooks.ts](../packages/cli/src/lifecycle/hooks.ts), [tests/acceptance/cli/hooks.test.ts](../tests/acceptance/cli/hooks.test.ts).

Acceptance: [K-37](10-hooks-ci-runners.md#acceptance-k-37), [K-56](10-hooks-ci-runners.md#acceptance-k-56), [K-58](10-hooks-ci-runners.md#acceptance-k-58), [K-60](10-hooks-ci-runners.md#acceptance-k-60), [K-76](03-configuration.md#acceptance-k-76), [K-292](10-hooks-ci-runners.md#acceptance-k-292), [K-108](03-configuration.md#acceptance-k-108), [K-109](03-configuration.md#acceptance-k-109), [K-275](10-hooks-ci-runners.md#acceptance-k-275).

Fresh-clone installation is exercised for Lefthook 2.0.13, simple-git-hooks 2.13.1, Husky
9.1.7, and pre-commit 4.5.1 with the real development CLI. Each fixture commits the integration
and clones without local ownership or dependencies. It runs immutable `npm ci` or `uv sync`,
then `gspot install` twice, and verifies unchanged lock bytes and
clean Git status. Real commits reject a staged source defect while preserving its corrected
working-tree content, then accept the staged correction. Authored package/native commands run
once per attempt. These are source-CLI checks, not frozen-candidate release evidence.

The simple-git-hooks clone initially failed installation because readiness required untracked
local ownership records. In their absence, readiness now compares tracked generated programs
with the expected hook body and verifies executable originals. Existing ownership still applies
its recorded hash and mode checks. An edited clone program is refused before hook publication,
and restoration permits installation. The focused clone run passes two cases with 65 assertions;
the preceding clone and native simple-git-hooks run passes six cases with 119 assertions. Types,
formatting, and diff whitespace checks pass.

Clone `apply` initially mistook the simple-git-hooks managed invocation for an original command,
proposing recursive predecessor programs and conflicting with tracked files. Emission now
retains the tracked original program when adopting an already-managed invocation. Canonical
program validation also retains local hash and mode checks where ownership exists. An edited
clone program blocks both installation and apply without changing other tracked files.

The fixture now runs installation and apply twice before exercising real staged checks. Uninstall
removes clone-local hooks and preserves tracked clone-baseline bytes with clean Git status,
matching the fresh-clone ownership contract in section 03: identical adopted proposals save
existing bytes as originals rather than authorizing deletion. The affected clone and native
simple-git-hooks suites pass six cases with 145 assertions. CLI types, formatting, and diff
whitespace checks pass.

Runner changes after clone adoption exposed two additional defects. Retained original programs
were compared against the newly requested runner, blocking regeneration. Owned originals now
use their recorded hash and mode for this decision, while first-time adoption still validates
the tracked generated program. The fixture refuses an edited original, accepts its restoration,
executes through Bun, and returns to the direct launcher with the original command intact.

Returning to the direct launcher also left an empty `scripts` object in `package.json`. Shared
configuration ownership now records parent containers created for managed fields and removes
only those containers when empty. Authored empty objects and tables remain intact. JSON, YAML,
and TOML regressions cover partial removal, complete removal, and restoration with an unrelated
authored edit. The runner round trip leaves Git clean before uninstall. Ownership, clone, and
native-manager suites pass 64 cases with 525 assertions; apply and runner-task suites pass
25 cases with 125 assertions. CLI types, formatting, and diff whitespace checks pass. Candidate
artifacts, the remaining managers/runners, and other native platforms remain separate gates.

Native simple-git-hooks initialization reproduced a false success when `SIMPLE_GIT_HOOKS_RC`
used `exit 0` or `exec true` before reaching the generated integration. The installed wrapper
now executes native initialization in a separate process and distinguishes whether it reached
the package integration. Successful early initialization exits run gspot directly. Explicit
failures and `set -e` remain failures, and a consuming initializer cannot drain gspot's replayed
push input. The regression checks exact arguments, stream bytes, and invocation counts at root
and nested policy directories. The fallback belongs to the simple-git-hooks emission owner;
readiness compares it with the current runner selection. A runner change requires reinstalling
before readiness succeeds. Further initialization and native setup-error classification cases
remain open. The final simple-git-hooks, adoption, and clone run passes 11 cases with 319
assertions, including readiness invalidation and reinstallation across a Bun runner round trip.
Type checking, formatting, and diff whitespace checks pass.

simple-git-hooks package integration uses feature-owned policy definitions and the shared
configuration lifecycle. Native 2.13.1 hooks are generated in an isolated repository before
publication. Existing local hooks and package commands both run before gspot, with replayed
push input, retained arguments, failure propagation, and idempotent installation. Uninstall
restores original package bytes and local hooks. The native fixture and configuration cases
pass three tests with 27 assertions. Alternate executable manager configuration remains an
explicit refusal with original files retained. Supported tracked tasks and the remaining native hook-manager gates remain open.

The pre-commit adapter now retains gspot's exit code independently of the native aggregate.
Native 4.5.1 reproduced gspot setup failure `2` as framework failure `1`; the emitted entry
records its result for the installed wrapper. Findings remain `1`, and setup failures return
`2`. Runtime validation rejects malformed or unavailable configuration. Commit preparation
also reports unstaged configuration and unmerged index entries as inability. A successful
framework run without the gspot invocation reports missing setup rather than success. Authored
failures retain the framework result, with and without `fail_fast`. Root and nested fixtures
verify missing framework executables, native cache errors, corrected execution, exact push
records, and message paths.

The fresh-clone matrix includes native pre-commit with a tracked `uv.lock`. It runs immutable
`uv sync --frozen --no-install-project`, real CLI install/apply twice, and real commits that
reject staged defects without replacing corrected working content. Correction and uninstall
retain clean Git state and unchanged locks. The first attempt exposed the Python snapshot gap
recorded under immutable Git selection below. The corrected journey passes after that repair.
These are source checks on macOS arm64; frozen-candidate and native-platform acceptance remain
open. Native failure statuses that remain indistinguishable from authored findings still need
requirement-specific classification evidence.

The pre-commit framework integration owns one YAML sequence entry, preserving unrelated
repository nodes and comments. Native 4.5.1 validation and hook installation run in an isolated
Git directory. Real commit, two-ref push, and message-hook cases pass, including a message path
with spaces, failure propagation, and the framework skip-variable boundary. Repeated apply and
installation preserve one integration; restoration retains a later authored setting. The three
focused tests pass with 32 assertions. Shared configuration paths represent sequence indexes
as numbers, so YAML and JSON parsers retain native collection semantics.

Hook ownership uses the Git root when checking whether an existing hook is tracked, including
hooks outside a nested policy directory. Custom hook boundaries publish their recovery ignore
block with the hook proposals and retain it after restoration. The installation suite passes
29 tests with 237 assertions, including both planted cases. The repository's installed hooks
were refreshed through the lifecycle owner; hook inspection reports ready.

Shared JSON and YAML outputs use one field proposal and drift owner; package scripts and
Lefthook preserve their behavior. The affected emission, runner, and lifecycle suite passes
58 tests with 344 assertions. No compatibility exports remain for the replaced readers.

Runner definitions now belong to the emission feature. Yarn is accepted by policy and init,
selected from repository detection, included in the review plan, and retained through profile
export/import. Two real Yarn Classic 1.22.22 task journeys preserve arguments and authored
lifecycle scripts and restore the exact original manifest.

Shared field ownership supports TOML task bodies through the native parser and comment-preserving
patcher, validating the serialized document before publication. Three focused cases pass with
21 assertions: exact restoration, preservation of unrelated edits, malformed-input refusal,
new tables, and edited-task protection. Init proposes existing lint and format names, retains
the reviewed source bytes, and publishes replacements through this owner. Actual mise and npm
execution verifies replacement bodies and argument forwarding; uninstall restores the original
configuration. CLI checks reject lifecycle names and duplicate effective names before mutation,
retain mappings through profiles and explanations, and prune previous mappings on rename.
The affected emission, installation, ownership, profile, and schema suite passes 135 tests with
761 assertions. Type checking passes. Alternate native task sources and the remaining hook
composition cases remain open.

Native simple-git-hooks and pre-commit configurations resolve from the Git root when policy
lives in a nested directory. The gspot invocation changes to the policy directory; authored
commands retain the Git working directory. Eight native/configuration cases pass across root
and nested paths containing spaces and an apostrophe. They exercise stdin replay, repeated
installation, failure propagation, message paths, original restoration, and readiness checks.
CLI type checking passes. This does not close the Husky, Lefthook, or existing-task work.

The registry-backed acceptance run passes 237 tests and reports 37 failures plus three timeout
errors. Subsequent affected runs verify documentation, configuration adoption, compiler isolation,
and component behavior, but the repository-wide acceptance gate remains open. Compiler fixtures
contain their complete TypeScript package rather than an executable copied without its runtime.
Root and nested solution/Vite cases now complete in roughly three to five seconds locally.
The affected TypeScript and Python rerun passes all 14 cases, including real pinned-tool
diagnostics and preserved Pyright exclusions. Swift passes all four cases with 67 assertions
after its fixtures use the current structural selector and statement contract. React and
Vitest passed in the preceding affected run. These runs do not close full acceptance.

### Immutable Git selection

Open. Complete exact staged and pushed object selection, all ref pairs, first pushes, deleted branches, shallow clones, submodules, linked worktrees, and config below the Git root. Keep whole-project findings and failures for affected scopes; no-Git mode remains supported.

Open acceptance IDs: K-70, K-293, K-294, K-295, K-271, K-272.

Source and retained evidence: [packages/cli/src/repository/snapshot.ts](../packages/cli/src/repository/snapshot.ts), [tests/acceptance/cli/selectors.test.ts](../tests/acceptance/cli/selectors.test.ts).

Acceptance: [K-70](10-hooks-ci-runners.md#acceptance-k-70), [K-293](10-hooks-ci-runners.md#acceptance-k-293), [K-295](10-hooks-ci-runners.md#acceptance-k-295), [K-272](10-hooks-ci-runners.md#acceptance-k-272), [K-271](10-hooks-ci-runners.md#acceptance-k-271).

Nested policy checks materialize the complete Git index or tree from the Git root and execute
inside the selected policy directory. Committed entries and pushed diffs use policy-relative
paths, including new refs compared with fetched history. A real Git hook rejects indexed bad
content while preserving corrected working bytes. Hook commands resolve runners from the policy
directory, preserve original hook arguments, and pass an absolute message-file path to gspot.
The hook suite passes 36 tests with 365 assertions; the snapshot suite passes nine tests with
64 assertions. The earlier combined selector and snapshot run passes 13 tests with 109 assertions.
These overlapping runs do not close the remaining Git cases or native-platform gates.

Submodule entries remain in snapshot indexes with their exact Git object IDs, while their
contents remain unread. Inventory excludes gitlink paths before resolving source links.
Initialization and doctor report each path once. Index and committed-tree fixtures plant
external submodule links containing invalid package manifests and verify unchanged external
bytes, empty snapshot directories, and identical index trees. The affected snapshot, doctor,
and inventory run passes 29 tests with 164 assertions; initialization passes eight tests with
43 assertions. CLI type checking passes. These cases implement the submodule contract of
K-272 without closing its remaining Git cases.

Snapshot dependency observations validate manifests and installation directories through the
shared boundary owner. Nested managed installations consult their own pending-installation
record. External links and incomplete installation fixtures reject before running checks;
corrected inputs pass. Fixer source observations also use confined reads before execution and
preview copying. Planted external source replacements preserve outside bytes in both modes;
restored sources run successfully. The fixer suite passes 21 tests with 82 assertions.

A real pre-commit clone exposed rejection of the ordinary external interpreter link created
by `uv sync`. Python dependency snapshots now recognize only the declared environment's
`python`, `python3`, and versioned interpreter aliases. Their resolved targets must match
executable regular files under the `pyvenv.cfg` host declaration. Packages remain copied and
confined. System-site-package environments are refused. An external directory named `python`
initially passed the declaration check; native regression evidence now verifies its rejection.
Linked environment metadata fails through the shared confinement owner before parsing.

Copied POSIX console launchers are relocated to the snapshot interpreter. Index and committed
snapshots cover ordinary shebangs and native shell launchers in paths containing spaces and an
apostrophe. Mutating the copied pre-commit module changes both snapshot interpreter and console
command output while the working environment's module and launcher remain byte-identical.
External package links and replaced interpreter links are refused. The final native-manager,
clone, and snapshot run passes 25 cases with 506 assertions. Type checking and diff whitespace
checks pass. The preceding affected selection/real-hook run passed its other 33 cases; its two
metadata assertions were corrected to the confinement owner's earlier refusal message.

Editable Python path-only `.pth` entries are relocated into the selected repository. Native
Hatchling 1.27.0 fixtures initially imported unstaged working source for both index and commit
selections. Both now import selected source through the interpreter and console launcher, while
the original environment retains working source. External and missing selected paths are
refused. Repository-root entries and preserved original metadata are covered. The focused
snapshot run passes 15 cases with 185 assertions; type checking and diff whitespace checks pass.

Setuptools 80.9.0 editable finder modules relocate literal `MAPPING` and `NAMESPACES` paths.
The preparer parses their Python syntax with site processing disabled, without importing the
loader. Native index and commit fixtures cover renamed package directories and namespace
packages. Nonliteral path dictionaries are refused. Unchecked-hash finder bytecode initially
retained working-source paths despite relocated source; the copied finder cache is now removed.
The final snapshot run passes 17 cases with 230 assertions. Types and diff whitespace pass.

Hatchling 1.27.0 exact editable mode with editables 0.5 also relocates literal module mappings
without executing the loader. After supplying its required runtime dependency, the native
fixture reproduced working-source imports in both index and commit snapshots before the fix.
Both selections now import selected source through Python and console commands, including
precompiled unchecked-hash loader caches. Nonliteral module mappings are refused. The focused
snapshot run passes 19 cases with 271 assertions; types and diff whitespace pass.

Other executable `.pth` loader forms and Windows console-launcher binaries still require an
implementation audit. Their isolated execution remains implementation work, separate from
unavailable native-platform and frozen-candidate evidence. Do not close dependency-snapshot
acceptance from these POSIX cases alone.

Windows launcher audit: uv 0.12.13 stores `UV_PYTHON_PATH`, `UV_TRAMPOLINE_KIND`, and optional
`UV_SCRIPT_DATA` as PE resources, rather than a trailing shebang. Its
[launcher owner](https://github.com/astral-sh/uv/blob/0.12.13/crates/uv-trampoline-builder/src/lib.rs)
distinguishes Python interpreter trampolines from script trampolines. Distlib launchers instead
combine the native launcher, shebang, and ZIP script payload. Snapshots now select Windows
`Scripts` and `Lib/site-packages` layouts and relocate Distlib interpreter headers immediately
before ZIP payloads. Quoted and unquoted path fixtures preserve the executable prefix, binary
payload, host interpreter, and original environment. Both structural fixtures pass after adding
their required lock fixture. The affected run retains 19 passing POSIX cases; types and diff
whitespace pass. These fixtures do not execute Windows binaries.

uv PE script trampolines now relocate their interpreter resource into a new read-only section.
The dedicated Windows binary-format owner preserves native code and the embedded script ZIP.
Interpreter trampolines retain their declared host interpreter. PE32 and PE32+ fixtures cover
resource preservation, external interpreter refusal, signed-image refusal, and insufficient
section-header space. A snapshot fixture verifies publication into the scratch environment and
retention of the working launcher. The affected run passes 26 cases with 303 assertions; the
final six-case launcher run adds the snapshot journey. Types and diff whitespace pass.

A downloaded uv 0.12.13 x86_64 console trampoline with fixture resources was independently
inspected using pefile 2024.8.26 after relocation. Native code, script bytes, and trampoline
kind remain intact; Python zipfile still extracts the embedded `__main__.py`. This is binary
format evidence, not native execution.

Relative uv script paths now resolve against the installed launcher directory, matching the
pinned trampoline source. Only paths resolving to the declared environment's interpreter names
are accepted. Relative Python trampolines relocate to verified host executables from
`pyvenv.cfg`; unrelated host targets are refused. Launcher relocation precedes editable-loader
parsing so a moved interpreter is ready before use. The affected snapshot and PE run passes
34 cases with 316 assertions. The final 13-case launcher run also covers both trampolines in a
snapshot and preservation of the working launchers and host executable. Types and diff
whitespace pass. Native Windows acceptance and other executable editable-loader forms remain
open.

### Process execution and failure reporting

Local cleanup evidence: required JSON arrays and finding objects are validated; absent, malformed,
and message-less reports throw and become inability. Static-site adapters validate native shapes
and exit semantics. Final filtering preserves `count_regex` failure without a located finding.
CLI regressions exit 1 for the counted defect and 2 for three invalid JSON responses. The identity
suite passes five tests with 18 assertions. Native linkinator, html-validate, and PurgeCSS each
report a defect and accept its correction. Controlled fatal, empty, malformed, and corrected
adapter cases also pass. The combined native-site/build-argument run passes 18 tests with 282
assertions. Next.js no longer suppresses generation failure by diagnostic wording; unknown-command
and invalid-directory cases reject and preserve source edits. Existing cancellation and recovery
cases remain in place. These results do not close the broader process-execution group.

Expanded audit cleanup: `output/json.ts` fabricates findings for malformed JSON and treats
missing report arrays as empty. The runner can discard the fabricated finding. Required malformed
or absent reports must produce inability. Static-site link, HTML, and unused-CSS adapters also
fabricate empty reports and accept fatal exits. Delete these fallbacks and verify native report
shapes, fatal exits, valid defects, and corrected reports. A reproduced custom `count_regex`
match exited 0 after final filtering removed the unlocated failure. Keep custom checks and
`count_regex`; preserve counted failure independently of diagnostic locations and verify CLI exits.
Next.js type generation suppresses failures containing “unknown command” or “Invalid project
directory.” Delete that text-based bypass and verify required generation failure remains visible.

Open. Finish routing tools and fixers through shared resolution, batching, deadlines, cancellation, and capture. Audit remaining failure-to-empty readers. The plugin directory reader already propagates read failures. Distinguish absent, skipped, failed, changed, and unchanged results.

Open acceptance IDs: K-42, K-158, K-307.

Drizzle migration generation, frozen lockfile validation, and duplication scanning use shared
tool resolution, deadlines, and cancellation. Drizzle uses the declared scope and real planner
in its isolated-generation fixtures. The four preservation cases pass with 36 assertions;
two interruption cases pass with 12 assertions, including removed copies and corrected retry.
Frozen installation runs in a disposable selected-file copy without sharing installed
dependencies. Missing tools no longer pass silently. Four cases pass with 28 assertions,
covering inability results, unchanged installation bytes, cleanup, and native Bun stale-lock
rejection followed by corrected-manifest success.

Frozen-install exit classification now requires the package manager's stale-lock diagnostic
before reporting a finding. Registry, authentication, and unexpected process failures report
inability instead. The final focused suite passes eight cases with 56 assertions, including
native Bun and npm stale locks, corrected manifests, retained repository bytes, and cleanup.
The installed uv command also confirms its stale-lock diagnostic without network dependencies.

Yarn lockfiles are included in freshness validation. Classic lockfiles use the frozen-install
command; modern lockfiles use immutable installation with scripts disabled. Native Yarn
1.22.22 and 4.9.2 each pass the 12-case, 90-assertion suite, which also exercises Bun and npm.
Both levels report changed manifests and accept their corrections without changing repository
manifests, lockfiles, or installed dependencies. The check reference names its five supported
package managers rather than promising validation of unrelated lockfile formats.

Duplication reports require valid statistics and clone locations. A fatal process result,
malformed report, deadline, or cancellation cannot become an empty passing result. The parser
and controlled-process cases pass seven tests with 40 assertions, including cleanup and
corrected reports. Native pinned duplication, dependency, and profile acceptance passes six
cases with 57 assertions. These counts overlap the profile evidence above.

Vale scanning now shares pinned-tool resolution, configured deadlines, cancellation, and
argument batching. Path and stdin routes preserve diagnostic locations and input bytes.
The Vale execution and package-installation run passes 13 tests with 91 assertions.
Structural ast-grep scans are asynchronous and use the same execution owner. Native matches
require valid locations and selected filenames; malformed and partial failed output cannot
pass. The affected structure, confinement, and Vale run passes 43 tests with 292 assertions,
including corrected retries, argument batching, native rule execution, and preserved edited
rules. Vale consumes validated native JSON, preserving filenames containing colons and
newlines. Invalid output cannot become an empty result. The final parser, native Vale, and
package-installation run passes 20 cases with 100 assertions, including Markdown and shell
comment defects followed by corrections. Shell CLI acceptance passes five cases with 59
assertions after updating stale output expectations. The broader document journey remains
blocked at EditorConfig Checker installation by the unauthenticated GitHub API rate limit.
Complete parser and installed-candidate acceptance remains open.

Former unnamed cleanup entries: 16, 22, 24.

Source and retained evidence: [packages/cli/src/platform/spawn.ts](../packages/cli/src/platform/spawn.ts), [tests/integration/cli/spawn.test.ts](../tests/integration/cli/spawn.test.ts).

Acceptance: [K-42](05-engines.md#acceptance-k-42), [K-140](05-engines.md#acceptance-k-140), [K-157](05-engines.md#acceptance-k-157), [K-307](05-engines.md#acceptance-k-307), [K-258](06-enforcement-ledger.md#acceptance-k-258).

Execution reports distinguish findings (`1`) from inability to run (`2`), including missing
tools, failed fixers, and cancellation during checks, index snapshots, and push selection.
The focused runner, fixer, and real cancellation suite passes 39 tests with 399 assertions.

Spelling consumes native JSON lines instead of ambiguous brief diagnostics. It retains colon,
tab, and newline filenames supported by the host, and reports filename-only defects.
UTF-8 byte offsets become character columns through confined
source reads. The native CLI case checks staged bytes against a different working copy and
preserves the working copy. Malformed records, unavailable source, out-of-range positions,
and native fatal exits are execution errors for both preset and declared typos checks.

The shared path matcher and generated ESLint policy selectors now match newline filenames.
Native ESLint verifies a scoped allowance, an unaffected defect, and its correction. The
affected execution, emission, and preview suite passes 216 tests with 1,284 assertions before
the final native-exit classification addition. The final parser suite passes 27 cases with 79
assertions. Both CLI spelling cases pass with 43 assertions, including source corrections and
manual filename correction. A native probe showed that automatic filename correction overwrites
an existing destination. The spelling fixer therefore changes contents only, and filename
findings remain non-fixable. The CLI collision case preserves both files, reports the remaining
filename defect as 1, and accepts its manual correction as 0.
Types, generated schema freshness, and formatting pass. Other tool parsers still require audit.

Correction declarations distinguish native remaining-finding exit codes from execution failures.
The policy and manifest schemas, public schema, explanations, and custom-check guide expose
`fix_findings_exit_codes`. Ruff, typos, ESLint (JavaScript, TypeScript, Vue, and Svelte), Stylelint,
Markdownlint, and SQLFluff declare their native codes. Native cases retain partial fixes, report
remaining findings as 1, and accept manually corrected source as 0. Typos records with null
corrections report non-fixable forbidden words instead of parser errors.

Corrections also honor the shared `tool_errors` pattern, which is available to repository
checks. A native SQLFluff permission failure uses the same exit code as findings but includes
a Python traceback. The declared pattern preserves status 2 and unchanged source. Restoring
write permission permits the partial fix with status 1, and correcting the remaining source
returns 0. Fatal diagnostics override even exit 0; launch, cancellation, and timeout failures
remain errors. The focused batch passes 135 tests with 404 assertions. The affected execution,
policy, and preset suites pass 266 tests with 1,140 assertions. Three CLI spelling journeys
pass with 51 assertions, including repeated partial correction. Types, owned schema generation,
and formatting pass. Native Windows permission behavior and frozen-candidate execution remain
unverified.

### Session observations and parsing

Local cleanup: Compose image scanning uses the existing YAML parser with merge-key support.
Flow mappings, folded scalars, and aliases resolve service images. Extension fields are excluded,
images are deduplicated, interpolation remains excluded, and unreadable documents fail with their
path. The generic line parser, image regex, and forwarding extractor are deleted. The executed
adapter regression verifies requested images, diagnostics, refusal, and corrected execution.
Prefix and naming identity keys use structured serialization. The tracked-path regression
retains both findings for `a\nb/c-one.ts` and `a/b\nc-one.ts`, then accepts their correction.

The no-Git newline-directory omission is corrected in the existing inventory owner. Native
directory traversal replaces `globby`; the pinned direct `ignore` dependency evaluates root
and nested ignore rules. Parent exclusions prune directories, nested negations retain eligible
files, and symbolic links and named pipes stay outside the no-Git readable file set. Git
inventory retains its existing symlink handling. The inventory suite passes 19 cases with
64 assertions, including a directory containing LF, nested negations, pruning, external links,
and a native named pipe. Native Windows execution remains unverified.

A compiled probe then exposed a related Bash diagnostic defect: line-oriented output lost
the prefix of an LF-containing directory name. Bash syntax metadata now captures the line
and message while the existing per-file runner supplies its exact input path. Explicit
captured paths remain unchanged. The regression exercises newline and colon directory names,
then corrects both scripts. The affected inventory, runner, parser, and documentation suites
pass 217 cases with 1,144 assertions. A rebuilt macOS ARM64 binary reports the exact newline
path with exit 1 and accepts the corrected script with exit 0.

Local cleanup evidence: SQL naming and migrations now surface parse errors; corrected sources
produce identifiers and statements. SQL initialization caches its promise. A fresh process
performs eight concurrent parses with one WASM load. Null-tree paths in naming, Bash, Python,
Swift, HTML, and configuration analysis throw. Python and Swift release earlier trees on failure.
The structural/parser run passes nine tests with 26 assertions. The boundary run passes 22 tests
with 145 assertions, including SQL concurrency. `Engine` and structural `Analysis` accept direct
results or promises; synchronous checks return arrays without promise scaffolding. No parser
replacement or new result status was introduced.

Expanded audit cleanup: SQL naming and migration readers discard parse errors and use empty
statements. Naming, Bash, Python, and Swift readers have null-tree paths that omit analysis.
Surface parse failures and release already-created trees on failure. Replace the malformed-SQL
empty-identifiers test with failure and correction coverage, using an ordinary SQL keyword.
Eight concurrent SQL parses initialized eight WASM modules in the reproduction. Cache the
initialization promise in the existing parser owner and verify concurrent parses.
Permit synchronous results in the internal `Engine` contract and delete forced `Promise.resolve`
wrapping; the execution owner already awaits results.

Open. Complete session-owned file, scope, parse, and Git observation reuse. Refresh after edits and between sessions. Preserve scoped SQL history, staged Xcode symlinks, unusual filenames, malformed-input failures, and language-specific parsing.

Open acceptance IDs: K-138, K-148, K-176, K-24, K-139, K-171, K-190.

Locally implemented IDs: K-162.

Former unnamed cleanup entries: 21.

Fixer verification refreshes repository files and tags before replanning checks. A planted
fixer creates a source that the subsequent check must receive; the fixer suite passes 19 tests
with 74 assertions. Tool probes refresh at each execution and after corrections.

Source and retained evidence: [packages/cli/src/run/session.ts](../packages/cli/src/run/session.ts), [tests/integration/cli/checks/postgres-history.test.ts](../tests/integration/cli/checks/postgres-history.test.ts).

Acceptance: [K-138](05-engines.md#acceptance-k-138), [K-162](05-engines.md#acceptance-k-162), [K-176](05-engines.md#acceptance-k-176), [K-24](12-repository-layout.md#acceptance-k-24).

### Cache correctness and performance

Local cleanup evidence: shell observation keys use JSON serialization of the scope and filename
list. A regression with colliding newline-containing filename lists returns distinct files and
function owners. The cache remains run-owned. The incidental `runKey` representation assertion
is deleted; selected-inventory and run-isolation coverage remain.

Expanded audit cleanup: newline-delimited shell-cache keys collide for distinct valid filename
lists, returning the first list’s index for the second list. Use structured serialization in the
existing cache and verify the colliding inputs remain isolated. Remove the `runKey` empty-object
representation assertion while preserving its actual isolation coverage.

Open. Complete configuration, tool, scope, and declared-input invalidation; relocate platform build caches. Preserve owned 30-day retention and narrowed-run behavior. Measure bounded commit and initialization cost under stated cold/warm conditions.

Open acceptance IDs: K-43, K-44, K-71, K-196, T-12.

Partially implemented ID: K-69. No-input repository checks bypass cache. Declared inputs
include ignored files and internal file links; changed, added, renamed, and deleted inputs
invalidate results. Input discovery rejects external links and parent traversal before reading
their contents. Cache identities include executable bytes, mode, resolved path, and probe state.
Checks hash named configuration and stub paths even when ignored by Git; unrelated generated
configuration does not invalidate their verdicts. The focused execution and cache suite passes
140 tests with 877 assertions. Platform build paths and complete input audits remain open.

Former unnamed cleanup entries: 23.

Source and retained evidence: [packages/cli/src/run/cache.ts](../packages/cli/src/run/cache.ts), [tests/integration/cli/run/cache-retention.test.ts](../tests/integration/cli/run/cache-retention.test.ts).

Acceptance: [K-43](05-engines.md#acceptance-k-43), [K-69](10-hooks-ci-runners.md#acceptance-k-69), [K-196](05-engines.md#acceptance-k-196), [T-12](12-repository-layout.md#acceptance-t-12).

Swift compile and analyzer state use repository-specific platform cache directories. The
cache owner rejects external output links and overlapping writers. The native Swift package
fixture retains its object timestamp on an unchanged build and reports a later source defect.
The Swift/XCTest suite passes 18 tests with 42 assertions; cache-boundary tests pass two tests
with ten assertions. XCTest uses shared deadlines and cancellation, refuses coverage after a
failed test run, and validates native report fields before evaluating coverage floors. Native
Xcode execution and complete build isolation remain open.

### Isolated generators and builds

Local cleanup evidence: configured site and OpenAPI commands use the existing dependency’s shell
syntax parser in the settings owner to produce literal arguments. Operators and expansions are
rejected explicitly. Both generators execute with empty and quoted arguments. The site test also
uses a script filename containing spaces. Existing temporary-copy preservation tests pass.
The Next.js text-based success bypass is deleted.

Expanded audit cleanup: static-site and OpenAPI configured commands split strings on spaces.
Delete that parsing in the existing owners and verify quoted paths and empty arguments survive.
No alternate command field or shell framework is required.

Open. Complete isolated generation and build checks without modifying authored or untracked working-tree files. Swift incremental compilation is locally implemented; native Xcode reuse and complete build isolation remain open.

Open acceptance IDs: K-156, K-159, K-154.

Partially implemented ID: K-143. Incremental package builds and analyzer isolation have
local evidence; Xcode and platform cache behavior remain open in this group.

Source and retained evidence: [packages/cli/src/checks/swift/build.ts](../packages/cli/src/checks/swift/build.ts).

Acceptance: [K-156](05-engines.md#acceptance-k-156), [K-154](06-enforcement-ledger.md#acceptance-k-154), [K-143](05-engines.md#acceptance-k-143).

### Strictness levels and adoption usefulness

Open. Complete one level owner across planning, templates, plugin, prose, and guides. Recommended includes defect checks and mandatory trivial-function and trivial-file rules on
ordinary and established projects. Keep both structural rules enabled by default at every level,
root and nested scope, and standalone plugin surface. Retain other opt-in naming, layout, and
style rules at all. Do not add blanket callback or framework exemptions during cleanup.

Open acceptance IDs: K-198, K-52, K-221, K-135, K-141, K-142, K-123, K-152, K-227, K-174, K-161, K-167, K-112, K-200, K-175, T-19, T-33, K-75, K-91, K-301.

Locally implemented IDs: K-101, K-151, K-201, K-74.

Former unnamed cleanup entries: 29.

Source and retained evidence: [tests/acceptance/cli/levels.test.ts](../tests/acceptance/cli/levels.test.ts).

Acceptance: [K-198](04-presets.md#acceptance-k-198), [K-101](04-presets.md#acceptance-k-101), [K-135](04-presets.md#acceptance-k-135), [K-152](04-presets.md#acceptance-k-152), [K-174](04-presets.md#acceptance-k-174), [K-175](04-presets.md#acceptance-k-175), [K-201](04-presets.md#acceptance-k-201), [K-74](04-presets.md#acceptance-k-74), [K-75](04-presets.md#acceptance-k-75), [K-301](04-presets.md#acceptance-k-301), [T-19](12-repository-layout.md#acceptance-t-19).

### Shared language and plugin enforcement

Local cleanup evidence: the entry-file option and generated exemption are removed. Knip retains
its entry selection. Standalone plugin tests and generated ESLint tests enforce both structural
rules at both levels and root/nested declared entries. The generated/owner suite passes 23 tests
with 163 assertions, including defect/correction cases. The installed Vite acceptance passes through the source acceptance runner with its isolated registry:
one test and 22 assertions. The earlier direct invocation omitted that setup and failed during
lock resolution. No public registry publication occurred. Both environment rules share global
binding and member-name analysis in the existing environment owner. Local `process`, `Bun`, and
`Deno` parameters are accepted; global environment reads remain findings. The duplicate standalone
recommended-level test is removed after preserving the location assertion in the two-level case.

Expanded audit cleanup: `no-trivial-files` exempts Knip entry paths. This contradicts mandatory
trivial-file enforcement at both levels and every scope. Delete the exemption, plugin option,
and generated wiring, while retaining Knip entry selection for Knip. Replace plugin and Vite
exemption expectations with enforcement at both levels, including nested declared entries.
Historical entry-exemption passes below are evidence of this defect, not current acceptance.
`env-access-owner` mistakes a local `process` parameter for global environment access. Consolidate
analysis with the other environment rule, retain both rules, and test local and global objects.
Delete the duplicate recommended-level client-environment case after retaining its location
assertion in the existing two-level defect/correction case.

Open. Finish equivalent shared enforcement across Swift, JavaScript, TypeScript, Python, and framework components. Preserve all standalone plugin exports and options, alias and type-only import handling, valid exemptions, locations, and corrected cases.

Open acceptance IDs: K-188, K-208, K-209, K-210, K-50, K-133, K-136, K-49, K-137, K-87, K-235, K-86.

Locally implemented IDs: K-102, K-187.

Former unnamed cleanup entries: 30.

Source and retained evidence: [packages/cli/src/structure/engine.ts](../packages/cli/src/structure/engine.ts), [tests/integration/cli/emit/plugin-levels.test.ts](../tests/integration/cli/emit/plugin-levels.test.ts).

Acceptance: [K-102](05-engines.md#acceptance-k-102), [K-208](05-engines.md#acceptance-k-208), [K-50](06-enforcement-ledger.md#acceptance-k-50), [K-87](06-enforcement-ledger.md#acceptance-k-87), [K-186](06-enforcement-ledger.md#acceptance-k-186), [K-189](06-enforcement-ledger.md#acceptance-k-189), [K-137](06-enforcement-ledger.md#acceptance-k-137), [K-49](06-enforcement-ledger.md#acceptance-k-49).

### Planned integrations and preset coverage

Open. Implement every explicitly agreed ledger capability, including the planned Jest preset and remaining nginx acceptance. Complete framework accessibility and test integrations, scoped security packs, non-npm licenses, database lint, and Swift test overrides. Do not expand this into adding every available linter.

The license preset now detects Python manifests and declares pip-licenses 5.5.5 through the
tool-installation owner. `licenses/packages` replaces the npm-only check and dispatch name,
without an alias. Each scope scans its npm and Python environments when present. Python scans
run from an empty temporary directory against the explicit project interpreter, so authored
pip-licenses exclusions do not hide packages. Both report formats are validated and share
license-expression and exact-version exception evaluation.

A native exception case exposed that changing an excepted package to an allowed license bypassed
the recorded license consent. Such changes now report the mismatch until the exception is
corrected or removed. Native npm CLI and Python scanner cases pass three tests with 22
assertions, including disallowed, accepted, stale, and corrected licenses. Types and diff
whitespace pass. Python CLI status/scoping, clean private installation, empty/malformed report
cases, lockfile exception validation, public setting-name agreement, generated references, and
candidate acceptance remain open; this does not close license integration.

Native Python CLI journeys now pass at recommended and all levels through clean private-tool
installation. Missing environments, empty scans, and missing project interpreters return 2;
disallowed licenses return 1 with the scoped manifest; corrected licenses return 0. An
unselected sibling without an installed environment does not affect the selected scope.
The initial journey exposed the planner silently omitting a policy selected only in a nested
scope. The shared planner now honors explicit `per-scope` execution for policy presets.
The affected planning, scope, and license-parser run passes 31 cases with 140 assertions.
Malformed JSON, missing package versions/licenses, empty reports, and scanner failures are
refused; corrected reports pass and temporary scanner directories are removed in both cases.
The final native Python CLI run passes both cases with 18 assertions after using the existing
acceptance timeout. Types and diff whitespace pass. Lockfile exception validation, public
setting-name agreement, generated references, and candidate acceptance remain unfinished.

License settings now use the ledger's `tools.licenses.licenses_allowed` and
`tools.licenses.packages_allowed` names throughout execution, adoption, manifest definitions,
and fixtures. No aliases retain the former keys. Root and scoped runtime/published schemas
validate package-version entries, reported licenses, and reasons; version ranges and missing
fields are rejected. The schema was regenerated through its owner and its freshness check
passes. Schema, adoption, and scanner checks pass 59 cases with 203 assertions. Native CLI and
generated-reference checks pass nine cases with 937 assertions. Types and diff whitespace
pass. The customization guide documents Python environments, exception behavior, and status
codes. Lockfile membership, the promised generated license configuration, and frozen-candidate
acceptance remain open.

License configuration now emits through its manifest/template owner to `.gspot/licenses.json`
and the corresponding per-scope paths. The scoped emission case verifies inherited license
allowances, inherited package exceptions, and unaffected siblings. Native Python CLI journeys
at both levels verify repeated apply preserves the generated bytes and still runs the scanner;
both pass with 24 assertions. The profile suite passes 16 cases with 51 assertions, including
the new license settings round trip. The affected native CLI/reference run passes nine cases
with 937 assertions. Type and whitespace checks pass. The customization guide identifies the
generated paths and their policy owner. Lockfile exception membership and frozen-candidate
acceptance remain unfinished.

`integrity/allowlists-match` now compares authored license exceptions with resolved identities
in textual npm, Bun, pnpm, Yarn, uv, Poetry, and PDM locks. Scoped exceptions can use ancestor
workspace locks; sibling locks and private `.gspot` tool locks do not satisfy them. Missing or
malformed locks are execution errors, while an absent exact version is an `unlocked-package`
finding. Python distribution names are normalized for lock membership. The 15-case format and
scope suite passes with 23 assertions, including stale/corrected versions and Yarn metadata.
The repository's real Bun lock yields 1,755 resolved identities and its expected TypeScript
version. Types and diff whitespace pass. License-only activation of the structure-owned
integrity check, additional lock-format edge cases, native manager fixtures, and final candidate
acceptance remain open; the broad license requirement is not closed.

Native npm generated version-1 and version-3 locks for a scoped dependency and an aliased
dependency. The reader now handles version-1 nested dependency trees as well as version-2/3
package tables, retaining the resolved package name rather than the installation alias.
Both native locks resolve `is-number@7.0.0` and `@types/is-number@7.0.5`. The expanded suite
passes 16 cases with 28 assertions; types and diff whitespace pass. Check selection remains
unfinished: the integrity check has one declaration under structure, while licenses requires
no other preset. Do not add duplicate declarations or silently pull in structure. The generated
license configuration also needs an execution reader; generation and idempotent apply alone
do not satisfy the configuration-reader contract.

The license scanner now reads its manifest-owned generated configuration through the confined
filesystem owner and resolves the per-scope target with the shared path owner. It validates
the allowance and exception data and compares it with the effective policy before launching
a scanner. Missing, malformed, stale, and externally linked configuration is refused before
execution; regenerated bytes restore scanning and external targets remain unchanged. The
reader handles the generated JSON ownership header. Native npm exception changes now apply
their policy before checking, and native Python checks retain both level-specific scoped
journeys. The combined run passes 14 cases with 86 assertions; types and diff whitespace pass.
The guide documents this reader and the requirement to apply changed policy. Shared integrity
check selection for licenses alone and remaining lock-format/candidate evidence remain open.

License-only selection now includes the existing `integrity/allowlists-match` definition through
the manifest's `check_references` field. References are resolved after collection validation;
the loader requires a different preset's standalone built-in check that runs once. References
do not duplicate global ownership, rename the check, or select the owner's other checks/tools.
The root planner collects references from nested selections, and once-only planning prevents
duplicates when structure is selected too. Root-only, nested-only, and combined CLI fixtures
report the stale lockfile exception once. The planning, selection, lock, and generated-reference
run passes 68 cases with 1,083 assertions. Final reference validation passes 34 cases, and the
native npm/Python CLI run passes three cases with 41 assertions. Types and whitespace pass.
The customization guide documents the shared commit check. Remaining lock-format edge cases,
broader integration agreement, and frozen-candidate acceptance still require completion.

Python license exceptions now compare normalized distribution names consistently with lockfile
membership. A native pip-licenses case first failed when the exception used `Licensed._Example`
for installed `licensed-example`. It now passes, while a changed license at the same version
still reports the stale exception. The shared name-normalization owner serves scanning and
lock validation without changing npm identity comparisons or exact version/license consent.
The focused scanner and lock run passes 30 cases with 84 assertions. Types and diff whitespace
pass. The customization guide links the Python packaging specification. Other lock-format
edge cases and candidate acceptance remain open.

Native Yarn 1.22.22 exposed alias identities being recorded under the installation name.
The lock reader now extracts the resolved npm package name from classic alias descriptors.
Native Yarn 1.22.22 and 4.9.2 locks both resolve `is-number@7.0.0` and the scoped
`@types/is-number@7.0.5`; pnpm 10.12.1 produces the same identities without a reader change.
The lock suite passes 20 cases with 40 assertions, including scoped alias descriptors.
Types pass. Python-manager lock evidence and frozen-candidate acceptance remain open.

Native Poetry 2.1.3, PDM 2.25.3, and uv locks resolve `colorama@0.4.6`. Each native lock
also passes a source CLI defect/correction pair: an exception for 0.4.5 returns 1, and the
installed locked version returns 0 with the normalized `Colorama` name. PDM needed hishel
0.1.3 in its disposable tool environment because its unconstrained dependency failed to
import. This probe did not alter repository installation policy. Frozen-candidate acceptance
remains open.

The shipped license allowances now match the ledger's list, removing the extra MIT-0 default.
A native Python case rejects MIT-0 under the shipped policy and accepts it after an explicit
allowance. The scanner, native npm/Python CLI, and generated-reference run passes 20 cases
with 993 assertions. Schema freshness and authored formatting pass. Frozen-candidate and
repository-wide license findings still require acceptance.

K-256 inspection confirms missing test-folder SwiftLint outputs. A native SwiftLint 0.63.2
probe also confirms that the current explicit `--config` command bypasses nested configuration:
the same force unwrap reports in both source and test files with that argument, while native
configuration discovery reports only the source file after a nested test override. Completion
requires generated test-folder overrides and invocation/configuration-input ownership together.
No Swift implementation was changed by this probe; K-256 remains open.

K-256 now has local implementation and native evidence. XCTest claims Swift files in test
folders and test plans. Its manifest owns directory stubs with the three disabled rules and
a parent pointer to the scoped SwiftLint configuration. Scope boundaries inside test folders
retain those overrides without duplicate generated destinations. SwiftLint runs from its scope
with native discovery; declared nested inputs enter cache keys and isolated fixer workspaces.
Missing root configuration returns a structured execution error instead of native defaults.

Native SwiftLint 0.63.2 reports force unwraps, missing documentation, and magic numbers in
source while accepting the same constructs in test folders. Corrected source returns 0.
Nested configuration edits invalidate cached success, and isolated corrections preserve test
overrides. Native editor invocations pass at recommended and all levels. A scope containing
`#` initially hid the shipped rules because an unquoted YAML pointer was truncated. Generated
pointers now use JSON-compatible quoting and that full CLI journey passes. Native macOS path
aliases are normalized by the shared diagnostic reader, preserving root-relative locations.

The affected emission, parser, manifest, and reference run passes 73 cases with 1,121
assertions. The final expanded native run passes seven cases with 61 assertions. Existing
root and scoped Swift acceptance passes two cases with 49 assertions. Types, formatting,
and whitespace checks pass. The customization guide documents native discovery. Frozen
candidate lifecycle and native-platform gates remain open.

Open acceptance IDs: K-218, K-211, K-212, K-233, K-236, K-80, K-248.

Locally implemented IDs: K-256.

The generated SwiftLint configuration now declares `doc_comment_style` and includes custom
rules in rule-change previews. Native SwiftLint 0.63.2 reports a leading block documentation
comment at its slash, while corrected triple-slash documentation passes. Syntax filtering
preserves string markers and ordinary nested block comments; triple-slash documentation can
describe block-comment syntax without a false positive. Native configurations at both levels
honor a reasoned rule exception. The all-level CLI maps the native error diagnostic to a
finding with exit 1 and a repository-relative source location.

The affected documentation-rule, XCTest, apply-preview, and reference run passes 33 cases
with 1,050 assertions. Types pass. Inline documentation trivia still requires audit under
K-248. These results do not close the broad enforcement group.

The inline documentation audit confirms a native SwiftLint 0.63.2 limitation. Custom-rule
syntax filtering examines the entire regex match, including code before the captured slash.
Changing to excluded string/comment kinds catches an inline enum-case comment but reports a
false positive for a triple-slash example after code. It also misses a documentation block
after a string or an ordinary comment. No weaker rule replaced the current one. This part of
K-248 remains open. Native fixtures remain under `/tmp` via the system temporary directory:
`gspot-swift-inline-vlsshjbh` and `gspot-swift-inline-cases-ra18jzdr`. The behavior follows the
[SwiftLint custom-rule matcher](https://github.com/realm/SwiftLint/blob/0.63.2/Source/SwiftLintCore/Extensions/SwiftLintFile%2BRegex.swift).

The missing Swift Semgrep pack is implemented at `presets/language/swift/semgrep/ios.yml`, through its
preset configuration owner. It preserves all 14 rule IDs from the read-only reference iOS
pack. The plist lookup uses the real `object(forInfoDictionaryKey:)` API, Keychain guidance
correctly describes locked-device access, and the HTTP exception does not exempt a remote
host that starts with `localhost`. Test-folder exclusions were not carried as blanket
suppressions. Plist inputs are explicit security claims, combined with language-derived
claims by the shared claims owner.

Pinned Semgrep 1.152.0 validates all 14 rules. Native and CLI defect/correction journeys pass
at recommended and all, covering every rule and native source locations (two journeys,
44 assertions). The claims and generated-reference regression
run passes 15 cases with 926 assertions. Types pass. Authored YAML follows the two-space YAML
guide and passes formatting with that width; repository-wide formatter precedence remains
an acceptance item. The initial full Swift/JavaScript/security initialization failed while
resolving the generated Bun tool lock (exit 1), without the unpublished plugin provisioned.
Re-running the full journey through the existing local candidate registry passes. The
installed plugin exists in the private project, a repeated immutable install preserves the
npm and Python manifests and locks, and the Swift security defect/correction reports 1/0.
This acceptance case passes with five assertions. The failed standalone invocation is a
candidate-provisioning limitation; frozen-artifact installation acceptance remains open.
Broad K-248 remains open.

K-144 test identification and static checks have local implementation evidence. The
repository reader identifies XCTest and Swift Testing imports and test attributes with the
Swift parser, including tests outside test folders. Strings and comments do not select tests.
Package test-target declarations propose the preset. Skip checks read the actual reason
argument, rejecting missing, empty, whitespace-only, and nil reasons. Sleep and recording
checks inspect syntax, including generic calls and multiline recording arguments. Scoped
sleep allowances and exact per-file inputs remain isolated. The initial detection, scope,
and reference run passes 53 cases with 991 assertions; existing XCTest acceptance passes
with 14 assertions.

Snapshot references use `tools.xctest.reference_layout`, with default
`__Snapshots__/{file}/{test}.*`. The setting replaces `reference_directories` without an
alias. Runtime and generated schemas reject malformed layouts. References require a
semantic test owner at the matching directory path, and nested scopes use their own layout.
The scoped planner now passes its declared claimed files, retaining binary references and
excluding child scopes. Defect-and-correction cases cover identical filenames in different
directories and custom scoped layouts. The focused Swift, scope, execution-unit, and schema
run passes 115 cases with 293 assertions. A separate execution and generated-reference run
passes 43 cases with 1,275 assertions. The final runtime/generated-schema parity run passes
57 cases with 170 assertions, including duplicate placeholders and trailing-newline rejection.
Types, changed-file formatting, schema freshness, and whitespace checks pass. `xcode/test-plan` already declares level
`all`. The Xcode group-path work and final local K-144 evidence are recorded under
domain-specific scope behavior below. Candidate acceptance remains open.

Source and retained evidence: [presets](../presets).

Acceptance: [K-211](06-enforcement-ledger.md#acceptance-k-211), [K-233](06-enforcement-ledger.md#acceptance-k-233), [K-236](06-enforcement-ledger.md#acceptance-k-236), [K-248](06-enforcement-ledger.md#acceptance-k-248), [K-256](06-enforcement-ledger.md#acceptance-k-256), [K-218](04-presets.md#acceptance-k-218).

The unfinished Jest implementation passes its initial 60-case settings, profile, execution,
generated-ESLint, and standalone structural-rule run with 253 assertions. Native Jest passes
at both levels: uncovered functions and failed assertions return 1, broken test imports return
2, and corrected tests return 0. Disposable execution preserves authored sources and reports.
Two additional native cases verify nested coverage floors and exclusion of sibling tests.
The shared JavaScript test selector omitted JSX: a planted scoped `.test.jsx` focused test
reproduced the omission. The owning manifest includes JSX, and the two scoped JavaScript/JSX
cases pass with 14 assertions after correction. Workspace type checking passes.
The private installation journey installs the published local plugin through the isolated
registry, without developer node_modules. It exposed that recommended mode generated Jest
rules but omitted both JavaScript and TypeScript ESLint execution. Their owning manifests now
select recommended; generated rule strength remains level-dependent. Native focused-test and
corrected cases pass at both levels with eight assertions. The affected policy, preset, scope,
and generated-plugin run passes 92 tests with 275 assertions. Parser/planning and Jest execution
pass 30 tests with 120 assertions, including both languages at both levels.

The Jest preset, coverage check, and settings appear in the generated documentation. The
customization guide explains private lint installation, host-owned Jest, scoped floors, status
codes, and the lint-only meaning of the Bun import setting. Documentation loading exposed
unlowered resource-management syntax in Vite's Bun module runner. The docs build configuration
targets ES2022, and shared revision metadata no longer loads the CLI during config evaluation.
The direct Astro build produces 312 pages; built-site links, workspace types, and docs types pass.
Source-checkout mise settings disable only the released gspot tool: repository tasks execute
the CLI source. The mise docs build now passes with link validation, without downloading an
unavailable release. Installed launcher acceptance remains open.

The repository selects Jest linting with `global_package = "bun:test"`. A reasoned exception
identifies the incompatible native Jest coverage command and its Bun replacements. `tests/unit`
runs `mise run test` at push; `tests/coverage` runs native Bun coverage measurement manually,
without a percentage quota, as required by S-3. Both source CLI checks pass with 762 selected
inputs. Strict check coverage and level all remain enabled. Owner-driven apply and install
pass through an isolated registry serving the local plugin; hooks remain installed. These
development locks and artifacts are not the frozen release candidate.

Configuring those checks exposed a planner defect: root repository checks discarded matching
inputs inside nested scopes. The owner now retains those inputs while preserving file selection.
A nested syntax defect reports 1 once at the root and returns 0 after correction. The impact
suite passes ten tests with 80 assertions; workspace types and authored TypeScript formatting pass.

Native nginx acceptance runs the existing `nginx:1.29.3-alpine` image at both levels without
Compose. It validates throwaway certificates and upstream host resolution, reports a planted
syntax defect at its source line, and accepts the correction. Docker startup errors return 2
instead of configuration findings. The check uses the shared command runner for cancellation
and policy deadlines, and OpenSSL is a declared host prerequisite. Captured configuration bytes
are mounted from a temporary copy; this fixes a native bind-mount failure after source correction.
Quoted certificate paths and proxy targets preserve their native meaning. The combined native
nginx/gixy acceptance passes three tests with 20 assertions, including SSRF diagnostics and the
push-stage boundary. Workspace types and authored TypeScript formatting pass.

The nginx adapter now captures recursively included repository files, including globs and
absolute `/etc/nginx` references, and maps native diagnostics to their original file and line.
Directive extraction preserves quoted whitespace and inline directives, ignores comments, and
retains a hash inside an unquoted filename. A native included-file defect and correction pass.
The same case exposed root image settings overriding a nested scope. Configuration testing now
runs per scope and selects main files by their deepest owner. Native scoped includes and the
two level-specific root journeys pass three tests with 18 assertions. Final candidate execution
remains open. The run also exposed overly broad checked-file counts for project-wide checks;
the reporting correction is recorded under reports and check coverage below.

### Tool compatibility and release pins

Local cleanup evidence: compiler-confirmed unused declarations, parameters, imports, and test
bindings are removed. Unused format/status/tool/requirement aliases are deleted. The compiler
interface and its callers no longer pass ignored compilation flags. The build-argument tests
pass, the plugin builds, and the CLI compiles for the local macOS ARM64 host. Workspace TypeScript
passes with both unused-declaration checks enabled. No cross-platform execution is inferred.

Expanded audit cleanup: remove compiler-confirmed unused Swift helper, parameter, imports,
and test bindings, preserving setup calls with effects. Delete unused `SHIPPED_JSON_FORMAT`,
its width constant, and `CheckStatus`, `RunnerTool`, and `Requirement` aliases.
`compile.ts` accepts but ignores `--compile` and `--minify-syntax` values. Delete these flags
and caller arguments, retaining compilation and syntax minification. Verify the owning build.

Open. Execute the pinned tools with generated configurations and parse actual results. Registry existence and peer ranges are necessary metadata, not compatibility evidence. Preserve distinct installer versions and supported generated rule names.

Open acceptance IDs: K-251, K-207, K-249.

Locally implemented IDs: K-206, K-250, K-213.

Former unnamed cleanup entries: 7.

Source and retained evidence: [packages/cli/src/platform/tool-probe.ts](../packages/cli/src/platform/tool-probe.ts).

Acceptance: [K-207](05-engines.md#acceptance-k-207), [K-206](11-toolchain.md#acceptance-k-206), [K-249](06-enforcement-ledger.md#acceptance-k-249), [K-251](06-enforcement-ledger.md#acceptance-k-251), [K-250](06-enforcement-ledger.md#acceptance-k-250).

### Domain-specific scope behavior

Open. Complete per-scope inputs and layout-independent behavior for Python, Swift, SQL dialects, Docker, and route tests. Preserve TypeScript project references, statement locations, Bash/Zsh/Bats distinctions, and external protocol names.

Open acceptance IDs: K-155, K-163, K-90, K-150, K-153, K-160, K-184, K-191.

Locally implemented IDs: K-226, K-144, K-149.

K-149 is locally implemented. `EngineInput` contains `files` and `scopeRoot`, with no
session reference. The execution boundary supplies explicit policy, tool-probe, scope metadata,
and run-owned caches. Only once-only checks receive `repositoryFiles`. Supabase reads its
configuration under `scopeRoot`. Markdown path validation declares its repository-wide inventory
through `runs = "once"`. Directory relationship checks run per scope so selected changes retain
the sibling context needed for their findings.

Per-scope project inputs exclude child scopes and include configuration and binary resources.
Coverage claims remain separate from those inputs. Native scratch copies take explicit source
lists instead of adding the repository inventory. Swift, Jest, site, framework, and other build
adapters use these lists. Fixer previews explicitly request their existing full repository copy.
Import and migration observation caches distinguish different supplied file lists.

CLI defect/correction cases keep two Swift scopes separate and find the nested Supabase project.
Additional cases cover scoped admin keys, locale keys, headers, and binary assets. Boundary tests
verify the absence of session and repository inventory on scoped inputs, inclusion of binary
fixtures, and exclusion of unrelated files from scratch copies. Planner, strict coverage, and
scoped-reader regressions pass 24 cases with 146 assertions. Native pinned Jest acceptance passes
six cases with 44 assertions across recommended/all levels, nested settings, lint installation,
coverage failures, test failures, corrections, and source preservation. Build, structure,
repository-reader, and generated-reference regressions pass 61 cases with 1,190 assertions.
Types and changed-file formatting pass. Final frozen-candidate acceptance remains outstanding.

The SVG check uses `static-site/svg-optimized` without an alias. It reports UTF-8 byte savings
over 10 percent at recommended and any savings at all. The adapter sends confined, captured SVG
bytes on stdin through the pinned-tool, cancellation, and deadline runner. Optimizer execution
and parse failures return status 2. Native SVGO acceptance passes with ten assertions covering
both thresholds, correction, an unselected malformed sibling, and selected malformed input.

K-144 source membership now parses the OpenStep project structure and resolves file paths
through parent groups. Display-only group names preserve their parent path. `SOURCE_ROOT`,
absolute paths, and project-directory offsets retain their separate meaning. Only source
build-phase membership counts as an explicit target source. Synchronized groups honor
per-target membership exclusions. Multiple projects in a scope contribute to one membership
comparison, and nested scopes run independently. Two files with the same basename no longer
hide an orphan or a missing target source. Malformed syntax, missing referenced objects,
group cycles, and unresolved build-setting roots return execution status 2. Test-plan target
names are read independently of source-path resolution.

The project reader follows the documented
[OpenStep property-list syntax](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/PropertyLists/OldStylePlists/OldStylePLists.html)
and the source-tree distinction in
[Xcodeproj group resolution](https://github.com/CocoaPods/Xcodeproj/blob/master/lib/xcodeproj/project/object/helpers/groupable_helper.rb).
Native `plutil` accepts and converts the planted group fixture. Existing Xcode acceptance and
the new membership cases pass ten tests with 50 assertions. The broader project, snapshot,
and existing native acceptance run passes 30 cases with 332 assertions. An execution-impact
and reference regression run passes 24 cases with 1,001 assertions.

Custom snapshot layouts also accept hyphens in both owner filenames and test names without
misidentifying the owner. The final combined Swift detection, snapshot, project membership,
and generated-reference run passes 59 cases with 1,000 assertions. Types and changed-file
formatting pass. This closes local K-144 implementation and its planted acceptance cases;
frozen-candidate and native-platform lifecycle acceptance remain open.

Source and retained evidence: [packages/cli/src/checks](../packages/cli/src/checks).

Acceptance: [K-149](06-enforcement-ledger.md#acceptance-k-149), [K-144](06-enforcement-ledger.md#acceptance-k-144), [K-153](06-enforcement-ledger.md#acceptance-k-153), [K-160](06-enforcement-ledger.md#acceptance-k-160), [K-184](06-enforcement-ledger.md#acceptance-k-184), [K-191](06-enforcement-ledger.md#acceptance-k-191), [K-172](06-enforcement-ledger.md#acceptance-k-172), [K-178](06-enforcement-ledger.md#acceptance-k-178), [K-226](06-enforcement-ledger.md#acceptance-k-226), [K-254](06-enforcement-ledger.md#acceptance-k-254), [K-134](06-enforcement-ledger.md#acceptance-k-134), [K-192](06-enforcement-ledger.md#acceptance-k-192).

### Manifest and schema ownership

Further local deletion: `prose/engine.ts` is removed. Its two analysis selections and unknown
analysis error now belong to the existing engine registry. The documentation schema renderer
also removes its single-caller constraints, array-row, and variant-row helpers; recursion lives
in `schemaRows`. The generated-page collection is named `pages` instead of `out`. Shared parser,
schema, and normalization boundaries are not deleted merely because their files are short.

Local deletion batch: naming findings, Swift test-file reads, and prose vocabulary assembly now
live in their consumers; their separate modules are deleted. Rendering, policy-path, code-count,
and naming-policy forwarders, redundant internal fallbacks, and the framework predicate factory
are removed. Naming path analysis returns its direct result. Picocolors owns the color functions
and their type; the identity callback and local painter facade are deleted. An output regression
also exposed ANSI bytes affecting status padding; padding now uses visible width. Input validation,
resource cleanup, and diagnostic locations remain covered. Verification is recorded below.

Local cleanup evidence: required scope lookup and its error now belong to `scopeHolder`.
`presetHolder`, `holderFor`, `isExtensionClaimed`, `projectFindings`, and the separate concurrency
module are deleted. Fixer ordering uses planned checks directly. Guaranteed edit-distance and
directory positions no longer have defaults. Naming, required-rule, and folder analyses trust
the supplied selection. Validated diagnostic captures and pre-push fields no longer have redundant
defaults. The affected check, policy, runner, fixer, plugin, and generation run passes 224 tests
with 869 assertions. This count is scoped evidence, not a complete audit.

Expanded audit cleanup: move the required scope lookup contract into existing `scopeHolder` and
delete duplicate `presetHolder` and `holderFor` wrappers. Delete `isExtensionClaimed`, collapse
`projectFindings` into registered `orphanSources`, and move concurrency sizing and fixer ordering
into their callers. Remove intermediate fixer objects. Delete impossible missing-selection
branches in naming, required rules, and folder analysis; guaranteed-position defaults in edit
distance and directory construction; and redundant defaults after validated captures and pre-push
fields. Verify retained calculations and selection behavior without replacement wrappers.

Open. Complete feature-owned policy, tool metadata, fragments, schemas, and check dispatch. Derive parsed types and choices from definitions. Reject conflicting identities and invalid variants; keep shared parsers outside check catalogs.

Open acceptance IDs: K-100, K-79, K-39, K-14, K-107, K-13, K-38, K-17, K-85, K-113, K-177, K-203, K-197, K-223, K-199, K-220, K-105, K-183, K-106, K-55, K-77, K-124, K-131, K-165, K-94, K-169.

Locally implemented IDs: K-119, K-255.

Former unnamed cleanup entries: 20, 25, 26, 27.

Source and retained evidence: [packages/cli/src/presets/manifest-schema.ts](../packages/cli/src/presets/manifest-schema.ts), [tests/unit/cli/presets/select.test.ts](../tests/unit/cli/presets/select.test.ts).

Acceptance: [K-79](04-presets.md#acceptance-k-79), [K-39](04-presets.md#acceptance-k-39), [K-38](04-presets.md#acceptance-k-38), [K-197](04-presets.md#acceptance-k-197), [K-105](04-presets.md#acceptance-k-105), [K-55](12-repository-layout.md#acceptance-k-55), [K-99](04-presets.md#acceptance-k-99), [K-104](04-presets.md#acceptance-k-104), [K-119](04-presets.md#acceptance-k-119), [K-255](04-presets.md#acceptance-k-255).

### Rule guides and agent instructions

Local cleanup evidence: the source testing guide allows exact contractual values. Repeated
abstraction guidance is consolidated in source `WORKING.md`. The generator emits one guide per
list entry with no padded columns. Owner-driven apply updated installed rules, ESLint policy,
and AGENTS.md/CLAUDE.md blocks. A second preview reports every generated file matches its proposal.
Selection and authored-text preservation tests pass. Installed files were not edited by hand.

Expanded audit cleanup: delete the testing guide’s blanket ban on literal expected values.
Exit codes, locations, bytes, and contractual defaults are legitimate exact assertions.
Consolidate repeated abstraction guidance in source `WORKING.md`. Replace padded generated agent
tables with a compact index that formatting does not expand. Preserve selected guidance and
authored content; verify owner-generated output and idempotence without hand-editing `.gspot/`.

The complete source-corpus reading is recorded in the behavioral group. Bash retry status and
newline-preserving sentinel examples are corrected and executed by native tests, including
producer failure. These cases are no longer pending implementation.

Open. Complete level-aware rule assembly, conditional selection, and executable example
acceptance. Retain outstanding verification for decimal ports, deletion roots, Python
limits/suppressions, and SQL ownership. Preserve shared agent blocks and authored Cursor files.

Open acceptance IDs: K-229, K-241, K-261, K-230, K-179, K-232, K-231, K-260, K-242, K-262, K-65, K-67.

Locally implemented IDs: K-279.

Source and retained evidence: [packages/cli/src/rules/assemble.ts](../packages/cli/src/rules/assemble.ts), [tests/acceptance/cli/agents.test.ts](../tests/acceptance/cli/agents.test.ts).

Acceptance: [K-179](09-rules.md#acceptance-k-179), [K-231](09-rules.md#acceptance-k-231), [K-230](09-rules.md#acceptance-k-230), [K-229](09-rules.md#acceptance-k-229), [K-241](09-rules.md#acceptance-k-241), [K-261](09-rules.md#acceptance-k-261), [K-65](09-rules.md#acceptance-k-65), [K-67](09-rules.md#acceptance-k-67), [K-279](09-rules.md#acceptance-k-279), [S-10](09-rules.md#acceptance-s-10).

### Exceptions and public vocabulary

Open. Finish one tracked exception policy and public definition/reference names. Preserve external tool directives, optional reasons and require_reasons, scoped ignores, and executable fixer results. No repository-wide synonym campaign is required.

Open acceptance IDs: K-89, K-66, K-308.

Locally implemented IDs: K-111, K-115, K-234, K-110.

Former unnamed cleanup entries: 28.

Source and retained evidence: [packages/cli/src/policy/ignore-command.ts](../packages/cli/src/policy/ignore-command.ts), [tests/unit/cli/policy/settings.test.ts](../tests/unit/cli/policy/settings.test.ts).

Acceptance: [K-111](02-cli.md#acceptance-k-111), [K-114](05-engines.md#acceptance-k-114), [K-234](06-enforcement-ledger.md#acceptance-k-234), [K-89](03-configuration.md#acceptance-k-89), [K-66](02-cli.md#acceptance-k-66), [K-308](05-engines.md#acceptance-k-308).

### Generated metadata and drift

Open. Complete supported root pointers, meaningful generated-drift findings, and merge-conflict recovery. Manifest-derived untracked paths and no-Git ignore emission have local implementation evidence below. Preserve recovery metadata and retire obsolete local skip behavior.

Open acceptance IDs: D-100, K-47, K-259, K-246, A-5, K-296, K-274.

Manifest `untracked` entries now supply tool-specific ignore paths. The prose manifest owns
the Vale download directories; shared emission retains only clone-local runtime paths.
Validation rejects paths outside `.gspot`, traversal, line injection, and noncanonical
separators. Native Git checks confirm that downloaded styles are ignored while authored source,
generated gspot rules, and vocabulary remain visible. Duplicate declarations produce one entry,
and authored ignore lines survive idempotent updates. Generated preset references list these
paths. Init and apply leave `.gitignore` unchanged outside Git, then add the managed block after
Git initialization. The lifecycle run passes 37 tests with 151 assertions; the final init,
ignore, reference, and documentation run passes 27 tests with 999 assertions. The npm clone
regression passes 60 assertions. Types, schema freshness, and formatting pass. Uninstall-state
and frozen-candidate acceptance for K-296 remain open.

The uninstall audit confirms that ownership metadata is explicitly retained by the architecture.
Native Git cases verify that uninstall keeps ownership and recovery paths ignored for both a
newly created ignore file and one with authored entries. Authored source and unowned files under
`.gspot` remain visible. Ignore-file bytes stay unchanged. These cases do not authorize deleting
local recovery or an unowned ignore block to make the working tree appear clean.

The integration run after adoption, clone-installation, hook-reminder, and ignore changes passes
835 cases with one failure across 78 files and 4,757 assertions. The failure is the no-runner
installation fixture: EditorConfig Checker receives HTTP 403 from GitHub's native-binary API
because the unauthenticated rate limit is exhausted. Installation reports failure rather than
publishing a successful result. That download remains unavailable acceptance evidence; the run
does not establish full integration or frozen-candidate acceptance.

Source and retained evidence: [packages/cli/src/emit/managed-blocks.ts](../packages/cli/src/emit/managed-blocks.ts), [tests/acceptance/cli/lifecycle.test.ts](../tests/acceptance/cli/lifecycle.test.ts).

Acceptance: [D-100](02-cli.md#acceptance-d-100), [A-5](03-configuration.md#acceptance-a-5), [K-296](03-configuration.md#acceptance-k-296), [K-259](02-cli.md#acceptance-k-259), [K-246](05-engines.md#acceptance-k-246), [K-274](03-configuration.md#acceptance-k-274).

### Reports, doctor, and check coverage

Open. Complete progress output, truthful summaries and cached results, Git hook diagnostics, per-kind check coverage, scoped explanations, and useful configuration errors. Message-stage runs must preserve the prior report.

Project-wide checks no longer count every project input as checked source. Successful execution
is intersected with declared claims. Per-scope checks with explicit input claims require a
source owned by that scope; a child source no longer triggers an empty parent analysis.
Prerequisite reporting for whole-project tools remains intact.

Engine results can report confirmed `checkedFiles`. The shared runner rejects paths outside
the repository inventory, deduplicates the list, and exposes it through the report schema and
reader guide. nginx uses its native configuration dump to confirm parsed source and include
files. A failed parse counts its located diagnostic file; an unrun or failed tool supplies no
coverage. The native included-file journey proves that three parsed files count and an unrelated
configuration does not. The run integration suite passes 128 tests with 754 assertions, the
focused native/report run passes 11 tests with 39 assertions, and workspace type checking passes.
Per-kind coverage and final candidate reporting remain open.

Doctor derives configured source coverage from the shared planner instead of crediting every
check in a selected preset. Levels, disabled checks, path exceptions, and nested scopes affect
the reported missing kinds. Enabled repository commands cover their declared paths across
child scopes. Binary, generated, and vendored files do not enter this source coverage count.
The doctor and run integration suites pass 136 tests with 781 assertions. Runtime coverage
continues to require execution evidence.

Check and doctor now use the same configured unchecked-file calculation. Only source kinds
with a registered format, syntax, style, or type check enter the unsupported-selection count.
The executed `coverage.checked` count remains independent. Strict coverage produces located
policy findings under `coverage.findings`, including text, SARIF, and GitLab output, and exits
one. An unavailable command retains exit two. Run filters do not disable this repository policy;
message hooks do not enforce it. Manual-stage checks contribute configured coverage. The global
setting appears in settings listings and explanations.

A defect/correction journey verifies these reports, an unsupported text ending, binary exclusion,
and a corrected narrowed manual run. Saved runtime reports are classified as generated through
their ownership records, so the next run does not count them as authored source. The affected
run, doctor, repository, output, and settings suites pass 236 tests with 1,140 assertions. The
manual-stage correction passes separately with ten assertions. Workspace types, generated-schema
consistency, and the 312-page documentation build with link validation pass.

K-166 is implemented locally: doctor and list share source-ending rows under
`coverage.endings`, grouped by scope and the available format, syntax, style, and types checks.
Different coverage within one ending stays on separate rows. Unsupported endings such as `.kt`
receive an explicit absence message. The CLI defect/correction journey verifies matching JSON
and text in both commands, plus removal of a path exception. Parent per-scope checks no longer
claim child-scope inputs in either configured or executed coverage. A child with no enabled
check remains uncovered until its own check is enabled. The list and run coverage suite passes
13 tests with 56 assertions; the additional child correction passes with five assertions.
Workspace type checking and formatting pass. Frozen-candidate reporting acceptance remains open.

K-81 is implemented locally. Check completion callbacks run after ignore filtering and before
the remaining checks finish. Terminal progress includes cached passes as `unchanged`; redirected
output retains failures and execution errors. JSON output receives no progress lines. The final
list contains failed, missing, errored, and skipped checks. Its one-line summary counts actual
passes, failures, skips, findings, and elapsed seconds. An empty canceled run is incomplete,
and skipped checks cannot inflate the pass count. The output and run suites pass 148 tests
with 810 assertions. A native two-command synchronization test proves callback timing and
filtered status with four assertions. Generated GitHub and GitLab workflow journeys verify
logged findings and retained report artifacts. The CI/check acceptance run passed 21 cases;
its remaining passing-list assertion was corrected to the architecture contract and then passed
individually. Workspace types, formatting, and diff checks pass. Frozen-candidate acceptance
still needs these behaviors exercised from the frozen artifacts.

File explanations now use configured checks and their source claims rather than every check
in a selected preset. They include repository commands across nested scopes, retain applicable
global exceptions, and no longer call a file unchecked merely because its check is a repository
command. Nature notes describe eligible analyses without claiming that an unselected secrets
scan ran. Setting explanations enumerate every scope that exposes the key, including settings
selected only in a child scope, with defaults, effective values, sources, and reasons. Their
change and reset commands target the corresponding scope. The explanation journey passes six
tests with 28 assertions, including execution of a scoped change followed by inspection of the
updated child and unchanged parent. This journey uses the isolated local package registry because
`set` applies the generated configuration. Workspace types and formatting pass. Remaining K-122
requirements and frozen-candidate evidence remain open.

Repository-defined check names now resolve through `explain` with their command, paths, stage,
summary, and correction advice. Planning and explanations use the same normalized definition.
The focused native CLI journey passes with eight assertions. TOML syntax errors use the pinned
parser's line and column and emit one diagnostic line without copying adjacent configuration
text. LF and CRLF defect/correction cases pass in the 46-test policy-reading suite with 90
assertions. Workspace types pass. Schema-validation and semantic policy errors still need
source-location mapping; K-122 remains open for those and its other outstanding requirements.

Schema-validation errors now map policy paths through the existing TOML library's concrete
syntax tree. Quoted keys, multiline arrays, inline tables, repeated scopes, and nested arrays
of tables retain their authored locations. Missing values point to their nearest authored
container. Unknown keys receive separate located diagnostics. Type errors retain the validator's
actual received type rather than incorrectly reporting undefined. Unsupported versions also
name the version value's location. The policy read/write run passes 59 tests with 133 assertions;
the additional nested-table case passes in the six-case focused location run with 19 assertions.
Native CLI text and JSON defect/correction cases pass for LF and CRLF with ten assertions.
Workspace types, formatting, and diff checks pass. The troubleshooting guide documents these
locations and no longer promises configuration migration during apply. Semantic policy and
selection errors still need equivalent source locations; K-122 remains open.

Normalized-policy validation now carries authored paths with its diagnostic messages. Missing
and duplicate scopes, adopted EditorConfig directories, and ESLint selector or executable paths
identify their source values. Reason requirements and disabled-rule errors carry paths through
root and scoped tool tables. The read/write suite passes 60 tests with 138 assertions. Three
additional reason/rule defect-correction cases pass with nine assertions, and a missing adopted
module case passes with four assertions after the local module is created. Workspace types,
formatting, and diff checks pass. Preset selection and effective-setting validation still produce
unlocated diagnostics and remain part of open K-122.

Preset declarations and effective-setting validation now retain authored source locations.
Unknown preset entries in root and nested lists carry correction suggestions. Unsupported
settings, reasoned loosenings, list-item problems, options duplicated under `extra`, protected
naming groups, unknown extra checks, and rule-file exclusions carry structured policy paths.
Session loading, policy edits, and initialization pass the actual policy text to validation.
Native root/nested preset and setting defect-correction cases pass with 14 assertions. Settings
and policy-writing suites pass 24 tests with 57 assertions. Workspace types, formatting, and
diff checks pass. K-122 remains open for its other message and apply-preview requirements;
frozen-candidate verification remains separate.

Apply previews now compare declared JSON, JSONC, YAML, and TOML rule lists and tables as data.
The configuration manifest's `rules_path` entries travel with each generated target. SwiftLint,
Ruff, Stylelint, markdownlint, and Hadolint declarations name their rule collections. Preview
JSON includes added, removed, and changed entries per collection; text prints those names before
the byte diff. List reordering is ignored. Malformed prior configuration reports a rule-comparison
error while preserving the byte diff. The SwiftLint journey enables a previously ignored rule,
names the addition and removed exception, preserves the original during preview, and stops
reporting the change after the proposed content is present. Apply and rule-diff suites pass 11
tests with 43 assertions; manifest checks pass 27 tests with 47 assertions. Workspace types and
generated-schema consistency pass. Executable JavaScript, INI, and shell-style rule collections
still need owner-specific comparison; K-122 remains open for complete tool coverage.

ShellCheck apply previews now compare the manifest's `enable` and `disable` lists. The reader
combines repeated directives, accepts quoted lists and comments, and normalizes optional `SC`
prefixes. It reads configuration without resolving source paths or executing commands. Malformed
rule lists retain the text diff with a comparison diagnostic. A preview fixture removes an
`SC2086` suppression, names its removal, preserves installed bytes, and stops reporting the removal
after the proposed content is present. Focused apply and comparison checks pass 13 tests with 50
assertions; workspace types and schema consistency pass. Native pinned ShellCheck 0.11.0 accepts
the repeated quoted suppression (exit 0), reports SC2086 after its removal (exit 1), and accepts
the quoted-variable correction (exit 0). The first native fixture also triggered SC2250; using
braced references isolated the intended quoting defect. Executable JavaScript, INI, and
SwiftFormat rule comparisons remain open under K-122; frozen-candidate acceptance remains separate.

SwiftFormat's generated configuration now declares `enable`, `disable`, `rules`, and `lint-only`
collections for apply previews. Its reader combines repeated options and continued lists, handles
quoted rule lists and comments, and excludes formatting options from rule summaries. Authored
sections and filters retain the byte diff with an explicit unsupported-comparison diagnostic;
their scoped semantics are not flattened. The apply fixture removes a `consecutiveSpaces`
suppression, verifies the named removal and unchanged installed bytes, and confirms the summary
disappears after correction. Focused apply/comparison suites pass 15 tests with 58 assertions;
workspace types pass. Native pinned SwiftFormat 0.61.1 accepts the disabled spacing defect
(exit 0), reports `consecutiveSpaces` after enabling it (exit 1), and accepts corrected spacing
(exit 0). K-122 remains open for JavaScript, INI, and full authored SwiftFormat section/filter
comparison; frozen-candidate acceptance remains separate.

SQLFluff apply previews now compare selected and excluded rule lists and rule-option sections.
The reader preserves case-sensitive option names, handles continued values and inherited defaults,
and compares coerced numeric and boolean values as data. Duplicate options and missing section
headers retain the text diff with a comparison diagnostic. The SQLFluff apply fixture removes a
CP01 suppression, names its removal, preserves installed bytes, and stops reporting the change
once proposed output is present. Focused apply/comparison tests pass 18 tests with 67 assertions.
Native pinned SQLFluff 4.0.0 accepts the suppressed lowercase keyword (exit 0), reports CP01 after
removing the suppression (exit 1), and accepts the uppercase correction (exit 0). K-122 remains
open for JavaScript, Vale INI, and authored SwiftFormat section/filter comparison;
frozen-candidate acceptance remains separate.

Vale's generated `[*]` rule overrides and style selections now declare their preview collections.
The INI reader retains file-pattern sections, combines repeated style selections, and preserves
Vale's distinct-value behavior for repeated rule keys. Inline comments, quotes, continued values,
and repeated sections are parsed without executing Vale or loading style packages. The apply
fixture changes prose from recommended to all, names the added upstream styles, preserves
installed bytes, and stops reporting additions after the proposed content is present. Focused
apply/comparison suites pass 20 tests with 73 assertions; workspace types pass. Native pinned
Vale 3.21.0 accepts a disabled fixture rule (exit 0), reports it after a repeated-key sequence
whose final distinct value enables it (exit 1), and accepts corrected prose (exit 0). K-122
remains open for executable JavaScript and authored SwiftFormat section/filter comparisons;
frozen-candidate acceptance remains separate.

Commitlint's generated static JavaScript export now declares its rule table for previews. A
TypeScript syntax-tree reader identifies a single CommonJS or default object export, then parses
its contents as data. Imports, additional executable statements, and computed rule values are
not evaluated; unsupported content retains the byte diff and comparison diagnostic. The apply
fixture enables `type-case`, names its changed setting, preserves installed bytes, and stops
reporting the change after correction. Focused apply/comparison suites pass 22 tests with 80
assertions; workspace types pass. Pinned Commitlint 21.2.2 accepts a disabled uppercase-type
defect (exit 0), reports `type-case` when enabled (exit 1), and accepts the lowercase correction
(exit 0). ESLint's imported and computed rule configuration still needs its comparison owner;
K-122 and frozen-candidate acceptance remain open.

The template inventory identified further undeclared collections: HTML Validate, yamllint, and
bundled Semgrep configurations. Both HTML Validate targets and yamllint now declare their rule
tables. The security, Cloudflare, Express, FastAPI, and Supabase Semgrep targets declare their
rule records. Record lists compare by string `id`, ignoring record order while detecting changed
patterns/options; missing or duplicate IDs retain the byte diff with a comparison diagnostic.
Apply fixtures enable HTML Validate and yamllint rules and restore a removed Semgrep rule. Each
names the change, preserves installed bytes, and stops reporting it after correction. Focused
apply/comparison suites pass 26 tests with 93 assertions. These tests verify preview behavior;
native enforcement and frozen-candidate evidence remain separate. K-122 still requires ESLint
comparison and authored SwiftFormat section/filter handling.

K-122's preset-list prompt now reports the selected IDs and the `--presets <ids>` override.
The message reflects either accepted defaults without a terminal or the actual interactive
answer, including an empty selection. It uses the output owner, so JSON mode suppresses the
human note. Prompt tests pass 10 tests with 20 assertions. A native nonterminal init preview
prints its detected Bash selection and override flag, writes no policy, and keeps JSON output
parseable without the note (6 assertions). Workspace types pass.

The K-122 acceptance text requires comparing lists from template renders; the shipped
SwiftFormat template has no sections or filters. Those authored constructs retain an explicit
comparison diagnostic, but extending their semantics is not a separate requirement in K-122.
The earlier entries listing that extension as an acceptance blocker overstated the contract.
ESLint's generated imported/computed rule lists remain an implementation gap, and the uninstall
message still needs reconciliation against the native-dispatcher restoration contract. K-122
and frozen-candidate acceptance remain open.

The uninstall-message audit resolves K-122's older hooks-path wording against the specific
native-hook contract in `10-hooks-ci-runners.md`: gspot never sets `core.hooksPath` and restores
only unchanged owned dispatchers. The plan now says “restore or remove unchanged dispatchers,”
covering both an original hook and a newly installed hook. Integration cases with and without
an original custom-path hook verify that the line is absent before ownership, present after
installation, and absent after uninstall. Preview preserves installed bytes; uninstall restores
the original or removes the new hook, and preserves `core.hooksPath` in both cases. These cases
pass 2 tests with 18 assertions; workspace types pass. This closes the local message gap without
introducing a hooks-path mutation. K-122 still requires ESLint's generated rule-list comparison;
the full architecture and frozen-candidate acceptance remain open.

ESLint apply previews now resolve imported and computed rule declarations through the existing
configuration process and shared deadline/cancellation owner. The JavaScript manifest declares
the `rules` collection. Temporary modules use the parent's temporary workspace; static imports
retain ESM export conditions and `import.meta.url` retains the original configuration location.
No installed configuration is replaced. Rule data retains files, ignores, base paths, and
declaration order. Generated policy and legacy matchers carry their scope criteria alongside
their executable callbacks; comparison retains both criteria and matcher text. Unavailable
dependencies or unsupported executable options retain the byte diff with a diagnostic.

The generated-config fixture narrows a `no-console` exception to `tests/**`, names the changed
rule, preserves installed bytes, and clears the summary after correction. Native ESLint confirms
that the rule changes from disabled to error outside that path. A separate imported-rule fixture
verifies module resolution, original root calculation, file scopes, and captured logging.
Missing-dependency preview remains usable. Focused apply/comparison suites pass 29 tests with
107 assertions; the final scope-sensitive evaluator cases pass 3 tests with 14 assertions.
Native flat/legacy adoption and preservation pass 7 tests with 64 assertions using the local
test registry. Types and schema consistency pass. Full-size evaluation exposed and corrected
the runtime's data-URL size limit and CommonJS-versus-ESM export resolution. Callback inputs
without scope data still produce a diagnostic. K-122 remains open for its final requirement
audit and frozen-candidate verification; this is not full architecture acceptance.

The rule-template audit also identified undeclared Squawk and Gixy collections. Squawk now
declares `excluded_rules`; Gixy declares `checks` and `skips`. Gixy's comparison reader retains
the final root selector values, parses comments and separators, and keeps plugin sections
outside root rule lists. Unsupported list-valued selectors retain a comparison diagnostic.
Apply previews name the removed exclusions and preserve installed bytes. The focused run
passes 30 tests with 108 assertions; types pass. Native Squawk 2.64.0 and Gixy 0.2.53 both
accept their suppressed defects (exit 0), report the enabled rule (exit 1), and accept the
corrected source (exit 0). The rules are `adding-required-field` and `ssrf`, respectively.
K-122's final audit and frozen-candidate verification remain open.

Open acceptance IDs: K-84, K-117, K-82, K-83, S-6, K-122, K-132, K-130, K-185, K-243.

Source and retained evidence: [packages/cli/src/output/reporter.ts](../packages/cli/src/output/reporter.ts), [tests/acceptance/cli/checks.test.ts](../tests/acceptance/cli/checks.test.ts).

Acceptance: [K-81](02-cli.md#acceptance-k-81), [K-82](02-cli.md#acceptance-k-82), [K-166](02-cli.md#acceptance-k-166), [K-122](02-cli.md#acceptance-k-122), [K-45](10-hooks-ci-runners.md#acceptance-k-45).

### Consumer CI generation

Open. Complete GitHub fork/private/merge-queue behavior, least permissions, useful SARIF, GitLab CodeClimate reports and clone depth, and documented commands for other CI systems. Preserve no-CI selection and existing workflow ownership.

Open acceptance IDs: K-253, K-96, K-276, K-277, K-278.

Source and retained evidence: [packages/cli/src/emit](../packages/cli/src/emit), [tests/acceptance/cli/hooks.test.ts](../tests/acceptance/cli/hooks.test.ts).

Acceptance: [K-96](10-hooks-ci-runners.md#acceptance-k-96), [K-276](10-hooks-ci-runners.md#acceptance-k-276), [K-277](10-hooks-ci-runners.md#acceptance-k-277), [K-278](10-hooks-ci-runners.md#acceptance-k-278), [K-253](10-hooks-ci-runners.md#acceptance-k-253).

### Behavioral acceptance quality

Open for complete executable example evidence, download-blocked journeys, the unresolved
process-cleanup failure, and supported-platform acceptance. The source, test, and support reading
is complete for the September 23 cleanup. Reading and check-ID presence do not establish that
every documented defect and correction has been executed successfully.

All tests live under `tests/`: CLI and plugin units, CLI/docs/repository integration, native
compatibility, CLI/preset source acceptance, and installed release consumers. Support is grouped
by process, registry, fixture, and cleanup responsibility. Types stay with their owners. The
package-local test directories, forwarding test alias, and top-level acceptance runner are
removed. Tasks, dependencies, fixture paths, policy triggers, and paused CI references use the
central layout. `tests/bunfig.toml` loads from the task working directory, and the test TypeScript
configuration inherits workspace strictness. The default deadline uses Bun's `--timeout 60000`.

The retention review covers all unit, plugin, integration, native, acceptance, release, and support
modules. It removes incidental object-identity, internal-map, source-token, and fixture-content
assertions while retaining structural enforcement, exact diagnostics, exits, preserved bytes,
configuration recovery, cancellation, and installed consumers. Compose adapter coverage replaces
the redundant helper test. The repository CI regression executes the authored workflow step.
Temporary-directory disposal is registered before setup can fail. Missing required tools remain
failures; no download bypass or silent test skip was added.

Source acceptance has one support entrypoint restricted to source acceptance paths and supported
name filters. It builds the plugin, owns its private registry, streams output, and supervises
child lifetime. Failure and timeout probes exit 1; an interruption probe exits 130 and removes
the registry. Persistent signal listeners repair the earlier cleanup failure. Source acceptance
and installed release consumers run sequentially to avoid mutating shared assets concurrently.
Filtered integration execution has been verified with the native test configuration loaded.

The first-party audit reads every CLI behavioral domain, the standalone plugin, scripts, build
and packaging owners, the reference loader, authored guides and READMEs, and all rule-guide
sources. Pure forwarding, duplicate manifest defaults, unused parse fields, and impossible
fallbacks are removed. Private check and parser types live beside their owners. Python, Swift,
and HTML analysis release parser trees in `finally` blocks. The no-Git traversal uses pinned
`ignore` with native directory enumeration; evidence covers newline paths, nested exclusions,
negations, pruning, and symlink boundaries. Timestamped SQL migration names are validated before
ordinary filename normalization; the regression reports the defect and accepts the correction.

Latest local verification on September 23, 2026:

| Suite or check | Result | Limits |
| --- | --- | --- |
| Routine unit/plugin/integration | 1,279 pass, 5,114 assertions, 137 files | Deterministic source behavior; not native or installed acceptance |
| Coverage | The same 1,279 cases pass; 67.10% functions, 75.20% lines | Measurement only; strict product file coverage remains enabled |
| Native | 324 pass, one failure, 3,021 assertions | EditorConfig Checker download receives GitHub HTTP 403 |
| Source acceptance | 268 pass, 45 failures, 2,725 assertions | 44 download failures and one Markdown takeover fixture failure |
| Release | Seven pass, one failure, 278 assertions | Installed CLI stops at the same EditorConfig Checker download |
| Preset/docs/repository focused batch | 69 pass, 1,083 assertions | Includes missing-example rejection and nonempty diagnostic expectations |
| Types and schemas | Workspace, docs, tests, and schema freshness pass | No repository lint run |
| Build | All seven binaries and the site build pass | Building a target is not native execution evidence |

The Markdown takeover fixture now commits dependency setup before initialization. Its focused
rerun stops at the download limit, so the corrected native journey remains unverified. An earlier
native run also failed with SQLFluff process-group cleanup `EPERM`. The Sweet spot continuation
supersedes that observation with a reproduction, lifecycle diagnosis, and native pass.
The earlier shared-WASM overlap and Next.js fixture deadline failures have corrected isolated
reruns; the suites now run sequentially and retain their behavioral assertions.

The custom-check guide's extracted Bun example passes five cases with 21 assertions. Native
Bash tests execute the published transcript, final retry failure status, and newline-preserving
command substitution with producer failure. Reference comparisons correct Ansible, Nginx,
Docker, Python, Cloudflare, Deno, Swift, SQL, Vue, and Svelte examples against retained behavioral
cases. Remaining complete per-example execution belongs to the reference group below.

Keep K-149 evidence and K-222's outstanding verification intact. No repository lint, commits,
publication, deployment, external-repository edits, or CI execution occurred in this cleanup.

Open acceptance IDs: T-27, T-4, T-8, T-21, T-24, T-1, T-2, T-32, T-3, T-6, T-7, T-13, T-28, T-17, T-14, T-30, G-2, T-29, T-26, T-5, T-18, T-23, T-10, T-15, T-16, K-28, T-36, T-22, T-25, T-20, T-35.

Locally implemented IDs: T-9.

Former unnamed cleanup entries: 32, 33, 34, 35, 36.

Source and retained evidence: [tests/support/cli/planted.ts](../tests/support/cli/planted.ts), [tests/acceptance/cli/reference.test.ts](../tests/acceptance/cli/reference.test.ts).

Acceptance: [T-27](12-repository-layout.md#acceptance-t-27), [T-24](12-repository-layout.md#acceptance-t-24), [T-3](12-repository-layout.md#acceptance-t-3), [T-28](12-repository-layout.md#acceptance-t-28), [T-29](12-repository-layout.md#acceptance-t-29), [T-23](12-repository-layout.md#acceptance-t-23), [K-28](12-repository-layout.md#acceptance-k-28), [T-36](12-repository-layout.md#acceptance-t-36), [T-22](12-repository-layout.md#acceptance-t-22), [T-20](12-repository-layout.md#acceptance-t-20).

### Repository checks and tooling

Open. Finish template validation at both levels, meaningful unit/plugin push checks, and required prerequisite failures. Keep Bun and mise, feature-owned constants, schemas and assets with consumers, and no source/test symmetry or new private packages.

The generated Jest configuration accepts Bun's optional assertion message while retaining
Jest's single-argument contract. Extra arguments still report at both levels. Generated test
overrides no longer disable file, function, and statement limits. Native ESLint defect and
correction cases pass at both levels; the complete template suite passes 16 cases with 128
assertions. Private-installation Jest and Bun lint acceptance, plus native Jest coverage,
passes six cases with 44 assertions. The repository retains native Bun unit/plugin push
checks and a separate manual coverage measurement.

Repository apply required replacing the retired license exception key with
`tools.licenses.packages_allowed`, preserving every allowance and reason. Generated outputs
were updated through apply; the next apply writes no files. Immutable npm installation
succeeds through the isolated local registry, locked Python installation succeeds, and
doctor reports every tool available and hooks installed. CI remains paused.
The provisional repository check exits 1 with 126 records and 10,888 findings, without
missing-tool or error records. It precedes the Bun assertion and test-size corrections;
it does not retire historical findings or establish final candidate acceptance.
The refreshed working-tree check exits 1 with 126 records: 79 pass, 37 fail, and ten skip.
It reports 9,861 findings and no inability records. The first staged continuation check exits
1 with 86 records and 8,145 findings, without missing-tool or error records. Repository
violations remain open; these development runs do not close the frozen-candidate gate.
After the Yarn continuation and evidence updates, the staged gate exits 1 with 86 records:
55 pass, 25 fail, and six skip. Its 8,154 findings remain unresolved; it has no missing-tool
or execution-error records. Full architecture completion and final candidate freezing remain open.

Open acceptance IDs: S-1, S-2, S-3, S-7, S-8, S-12.

Locally implemented IDs: G-13, K-306.

Retired IDs: S-9.

Source and retained evidence: [.mise/conf.d/repo.toml](../.mise/conf.d/repo.toml), [tests/integration/repository/ci.test.ts](../tests/integration/repository/ci.test.ts).

Acceptance: [S-1](12-repository-layout.md#acceptance-s-1), [S-3](12-repository-layout.md#acceptance-s-3), [G-13](12-repository-layout.md#acceptance-g-13), [K-306](12-repository-layout.md#acceptance-k-306).

### Reference content loaders

Open for complete executable defect/correction evidence for every shipped reference example.
The content and source review is complete; a reviewed explanation and a matching check ID in
source do not establish successful behavioral execution.

The existing Astro content loader renders required nonempty Markdown `example` metadata from
all 205 shipped check definitions and 25 plugin rule definitions. It rejects missing examples,
duplicate identities, and public commands without effects, exits, or examples. Repository custom
checks do not inherit shipped-reference metadata requirements. Empty planted diagnostic
expectations are rejected before fixture mutation.

Command definitions own inherited options, usage, effects, exits, and examples. Settings show
accepted values, defaults, root/scope precedence, and a validated nested policy. Check references
name repository, scope, file-list, or delegated execution. Verification selects the declared
stage and identifies prerequisites, platform restrictions, and settings that can leave a check
skipped. Delegated checks target the actual reporting owner and explain the scope of exceptions.
A skip is not described as successful verification. Source links resolve to the current preset
kind/name directories or the defining command and plugin module.

The authored-guide, README, CLI-help, generated-category, and rule-guide reading corrected
unsupported command variants, redundant apply instructions, reason requirements, and exit
claims. The Bash syntax reference reuses its tested defect and correction. The custom Bun
check is extracted and exercised by ordinary integration tests. Other concrete examples are
compared with their behavior owners and retained tests; native downloads and external services
still prevent complete execution evidence. The latest focused and broad results are recorded
under [Behavioral acceptance quality](#behavioral-acceptance-quality).

Preserve public URLs, the overview guide, the catalog grouped by preset kind, duplicate
validation, source attribution, and existing Starlight content loading. Do not add another
reference generator, example inventory framework, or assertions that merely find check IDs.

Open acceptance IDs: S-4, S-5, S-11, S-14, S-16, S-17, K-225, S-15, K-304.

Locally implemented IDs: K-205, K-303.

Retired IDs: S-13, S-18.

Source and retained evidence: [docs/src/content/reference.ts](../docs/src/content/reference.ts), [tests/integration/docs/reference.test.ts](../tests/integration/docs/reference.test.ts).

Acceptance: [K-205](21-documentation.md#acceptance-k-205), [K-303](21-documentation.md#acceptance-k-303), [K-304](21-documentation.md#acceptance-k-304), [S-4](21-documentation.md#acceptance-s-4), [S-15](21-documentation.md#acceptance-s-15).

### Guides and site acceptance

Open for assistive-technology review, complete example execution, and release-matched public
acceptance. The local visual matrix, keyboard interactions, reduced motion, and native browser
zoom checks have local evidence. ScreenCaptureKit failed again during the final README card
inspection; the Sweet spot continuation records that remaining visual check.

The Sweet spot identity uses two asymmetric cobalt forms around a tangerine dot. The image
generator supplied the flat mark and dimensional hero; editable SVG interpretations, outlined
wordmarks, README banners, and sharing assets accompany them. The exact product purpose stays
selectable beside setup and reference actions. The homepage adapts Turborepo's split hero,
feature grids, setup columns, and closing action to Astro, with its MIT notice retained.

Astro/Starlight retains navigation, search, theme persistence, and copy controls. The branded
404 uses Starlight's content route and links to the homepage and installation guide. Self-hosted
Geist and its licenses remain. The landing width is 1,200 pixels, with a 68-character manual
reading column. The executed JavaScript client-environment example leads the demonstration;
the paired Bash example remains the lightweight first-check path. Actual tool logos carry
the Simple Icons CC0 notice. Existing public routes remain.

The README and guides state source setup, prerequisites, working directories, commands, writes,
expected results, and relevant recovery. Testing, security, dependency licenses, installation,
CI, adoption, and customization procedures have owning guides. Advanced variants link to those
owners. Rule-guide corrections cover all source categories, including Bash failure propagation,
remote quoting, framework version limits, and complete Docker and Supabase examples.

The earlier headless Chrome review covered the homepage, all 18 authored guides, every reference category,
and native 404 at 360, 768, and 1,440 pixels in both themes. Measurements and visual inspection
show no page-level horizontal overflow. Code and table panels scroll independently. A forced
Astro content rebuild removed stale decorative code headers before the final captures.
Local fonts load at the requested sizes. Keyboard skip-link focus, search results and dismissal
with focus restored, mobile navigation, code copying, disclosure expansion, theme persistence,
and reduced-motion transitions have been exercised.

Native Chrome zoom was set to 200% through the isolated profile's browser setting. The homepage,
quickstart, and command reference reflow in both themes at 720 CSS pixels, device pixel ratio 2,
and visual viewport scale 1; document widths remain 712 pixels. This supersedes the earlier
emulated-only zoom evidence. The owned Chrome and preview processes were stopped after review.

The current site build produces 318 pages and passes local links and fragments. This establishes
build and navigation integrity, not complete content, screen-reader, or platform acceptance.
Publication, deployment, DNS, and external-repository changes remain deferred. K-149 and K-222
retain their separate evidence and outstanding requirements.

Open acceptance IDs: G-10, K-202, S-19.

Source and retained evidence: [docs/src/pages/index.astro](../docs/src/pages/index.astro).

Acceptance: [G-10](21-documentation.md#acceptance-g-10), [S-19](21-documentation.md#acceptance-s-19).

### Packaging and installed-product acceptance

Open. Complete frozen-candidate artifact validation, installed CLI acceptance, legal payloads,
provenance/signing verification, and native execution on supported platforms. All seven targets
build locally, but cross-compilation does not establish that each target runs.

The latest sequential source and release results are recorded under
[Behavioral acceptance quality](#behavioral-acceptance-quality). Release passes seven cases with
278 assertions and fails the installed CLI consumer when EditorConfig Checker v3.4.0 receives
GitHub HTTP 403. Locked Python installation completes first. No host executable, download bypass,
or weakened assertion substitutes for the required installed-tool probe.

Compiled macOS ARM64 execution, embedded assets, package argument validation, installed plugin
modules and declarations, both plugin levels, and extracted package README examples pass.
The compiled no-Git defect/correction probe preserves an exact newline-containing path. Release
argument tests reject malformed invocations before writes and retain existing output. The
private registry routes local `@gspot` packages without changing unrelated registry resolution.
Its owned processes and temporary files are cleaned after failure and normal completion.

Source acceptance and installed release consumers run sequentially. The earlier overlapping
WASM mutation failures have isolated passing reruns; they are not current independent defects.
Earlier fixture-summary, Git-ignore, and deadline corrections retain focused verification.
The download-blocked installed journey and corrected Markdown takeover journey remain open.
Freeze one source revision and reuse its artifact hashes only after implementation settles.
No public publication, deployment, CI re-enablement, or external-repository change is authorized.

Open acceptance IDs: K-164, K-145, K-121, K-244, K-245, K-280.

Former unnamed cleanup entries: 40.

Source and retained evidence: [packages/cli/publish.ts](../packages/cli/publish.ts), [tests/release/install.test.ts](../tests/release/install.test.ts).

Acceptance: [K-164](11-toolchain.md#acceptance-k-164), [K-280](11-toolchain.md#acceptance-k-280).

### Native Windows lifecycle

Open. The shared lifecycle boundary uses standard filesystem APIs without a Darwin/Linux-only
mutation guard. Python installation selects `Scripts/python.exe` on Windows. Complete native
Windows validation of permissions, replacement, links, recovery, and uninstall before accepting
the platform. Historical successful Windows tests do not establish current behavior.

Open acceptance IDs: K-263.

Source and retained evidence: [packages/cli/src/lifecycle/confined.ts](../packages/cli/src/lifecycle/confined.ts), [tests/integration/cli/lifecycle/confined.test.ts](../tests/integration/cli/lifecycle/confined.test.ts).

Acceptance: [K-263](11-toolchain.md#acceptance-k-263).

### Architecture contract agreement

The September 23 architecture reconciliation updates the central test tasks and prerequisites,
preset kind/name ownership, Configuration Files terminology, no-Git traversal library, site
navigation, and content-loader acceptance. Obsolete test filenames, snapshot inventories,
release opt-in wording, and implicit commit authority are removed. Current test, reference,
visual, and packaging dispositions replace superseded run narratives. Historical evidence
retains its scope; unique unresolved failures remain visible.

Documentation-only verification parses all 16 architecture documents and resolves all 386
local links and fragments. Acceptance anchors, disposition ID lists, former cleanup assignments,
K-149 evidence, and K-222 evidence remain unchanged. Diff whitespace validation passes.
No product tests, repository lint, commits, publication, deployment, or external changes were
performed for this documentation reconciliation.

Architecture cleanup defines the current contract; runtime acceptance stays open in its behavior
owners. One contract owner and one grouped status owner do not by themselves establish agreement
between implementation, generated output, and documentation. Runtime help, schemas, emitted output, and lifecycle agreement remain part of their owning open groups; document cleanup alone does not complete those behaviors.

Reconciled ID: K-300.

Former unnamed cleanup entries: 38.

Source and retained evidence: [architecture/README.md](../architecture/README.md), [architecture/22-remaining.md](../architecture/22-remaining.md).

Acceptance: [K-300](12-repository-layout.md#acceptance-k-300).

### Generated Git attributes

Implemented locally: the proposal emits linguist-generated and text eol=lf; the CLI journey preserves bytes through autocrlf checkout and restores authored attributes. Native Windows execution is deferred separately.

Locally implemented IDs: K-72, K-273.

Source and retained evidence: [packages/cli/src/emit/targets.ts](../packages/cli/src/emit/targets.ts), [tests/acceptance/cli/attributes.test.ts](../tests/acceptance/cli/attributes.test.ts).

Acceptance: [K-72](03-configuration.md#acceptance-k-72), [K-273](10-hooks-ci-runners.md#acceptance-k-273).

### Registry process ownership

Implemented locally: readiness belongs to the owned child, occupied ports are rejected, startup is bounded, and failure cleanup awaits termination. The September 21 installed-plugin journey records these regressions; current candidate acceptance remains open.

Locally implemented IDs: K-310.

Source and retained evidence: [tests/support/registry/lifecycle.ts](../tests/support/registry/lifecycle.ts), [tests/release/plugin.test.ts](../tests/release/plugin.test.ts).

Acceptance: [K-310](12-repository-layout.md#acceptance-k-310).

### Applying an installed version

Version migrations and the upgrade command are retired. Apply accepts the installed binary,
previews generated changes, and advances the version pin only after successful publication.
Package managers update gspot; install consumes resulting tool locks independently.

Local evidence: changed-pin preview/application and edited-output regression in
[apply.test.ts](../tests/integration/cli/lifecycle/apply.test.ts), plus 42 confinement
and ownership recovery tests. Platform and complete candidate acceptance remain deferred.

### Repository CI definitions

Local deletion: `tests/ci-affected.ts` and its forwarding mise task are removed. The authored
workflow validates the event base and invokes the existing push-object protocol directly, with
live command output and the existing job timeout. Its regression executes the actual YAML step
and verifies committed content, invalid-base refusal, first pushes, correction, and report
preservation. CI remains paused. No command, dispatcher, or replacement script was added.

Implemented locally: one authored owner, affected checks at normal cadence and explicit full-platform checkpoints. Native execution, remote required-check behavior, and timing remain deferred while CI is paused.

Locally implemented IDs: K-309.

Source and retained evidence: [.github/workflows/ci.yml](../.github/workflows/ci.yml), [tests/integration/repository/ci.test.ts](../tests/integration/repository/ci.test.ts).

Acceptance: [K-309](10-hooks-ci-runners.md#acceptance-k-309).

### Website deployment

Deferred: publication of a stable release, protected Pages environment, domain ownership, HTTPS cutover, and a live rollback require external release/account actions. Local source provides guarded previews and release-aligned deployment checks. No deployment is authorized by this cleanup.

Deferred IDs: K-302.

Source and retained evidence: [.github/workflows/site.yml](../.github/workflows/site.yml), [docs/scripts/verify-release.ts](../docs/scripts/verify-release.ts).

Acceptance: [K-302](21-documentation.md#acceptance-k-302).

### Retired implementation prescriptions

Retired: mandatory directory symmetry and filename inventories, one-file-per-type/constant, global synonym counts, repeated status logs, and per-edit full matrices. Preserve configurable shipped naming and placement rules and their public exports. Generated-Markdown writing and pruning are replaced by the verified Astro content loader; complete reference content acceptance remains separate.

Retired IDs: T-34, K-146, K-282, T-31, T-11, K-54, K-73, K-68.

Former unnamed cleanup entries: 39.

Source and retained evidence: [architecture/12-repository-layout.md](../architecture/12-repository-layout.md), [architecture/21-documentation.md](../architecture/21-documentation.md).

The empty retired clauses have been deleted. K-61 implementation placement is retained under
[documentation ownership](12-repository-layout.md#documentation). These deletions create no
runtime acceptance claim.

## Historical architecture verification

The September 22 documentation-only verification covers 16 retained documents and 85 removals.
All 305 named disposition rows and 25 unnamed cleanup entries have one status assignment;
30 groups remain open. Prettier, Markdown lint, architecture links and anchors, whitespace
validation, and the requested commit-message validation passed. No product tests or release
builds were run.

The required source-checkout `gspot check --staged` failed before running checks: `lstat`
reported `ENOENT` for `docs/node_modules/zod` inside its temporary Git revision tree.
This was a failed historical staged gate. Later snapshot and workspace-link repairs have
their own evidence; this failure does not override them or establish a current pass.
No commit or push is authorized during active cleanup. Keep CI paused.

## Historical and deferred evidence

The September 18 rule-corpus record reported 7,616 source statements: 6,443 exact or duplicate
matches, 255 fuzzy matches, 354 dropped entries, and 564 reasoned dispositions. It also reported
a clean Vale run over 98 files. These are retained historical observations from the retired
reconciliation, not evidence that the present corpus is concise, current, or free of contradictions.
The source material remains in Git; do not rebuild its mechanical inventory as a cleanup gate.

September 21 macOS ARM64 development runs used Bun 1.3.11. The previous record reports local
ownership/confinement recovery, strict Git observations, scope handling, tool cancellation,
agent preservation, Git attributes, plugin levels, and installed package journeys. Those
results were produced during development, before a frozen candidate. They are historical
execution evidence, not tests rerun by this documentation change.

The source review confirms that the Git-attributes proposal and its autocrlf/restoration journey
exist. K-273 is therefore locally implemented alongside K-72, despite its old unchecked row.
The same distinction applies to registry child ownership (K-310), strict batched SQL history
(K-162), and incremental Swift builds (K-143). Native-platform evidence remains separate.
Current hardcoded ignore paths remain visible gaps. Shared filesystem source does not establish
native Windows execution evidence.

The earlier reference review covered inherited Commander options and conflicting settings.
The Astro content loader and local visual, keyboard, reduced-motion, and native zoom review
are now verified under their grouped owners. Complete executable example evidence,
screen-reader review, and live deployment acceptance remain open. Page totals and intermediate
timings are not acceptance evidence.

The historical full three-platform run at `b553f9d7b8d25640da0d8dbb4c799966f2aed9ec`
preceded later Windows failures. At `b5770a0`, a check printed completion and the harness then
hit its 120-second deadline; the remaining process or pipe was not established. At `4a02c87`,
Windows failed the secrets self-check before the suite. Async harness changes and local passes
do not prove either failure repaired. Native Windows execution evidence is deferred, not
merely awaiting a CI run. Current Linux, Windows, native Intel, and musl acceptance is deferred
under platform availability and the active CI bypass; implementation can continue locally.

Historical bounded repairs remain scoped to their recorded revisions: K-204 at `faf350f`,
K-219 at `b553f9d`, and K-305 at `7464e27`. K-92 records removal of delegation preferences from
managed agent blocks; K-97 records removal of unimplemented project-template flags. K-168,
K-170, and K-173 were retired with Go, Rust, and Ruby presets at `fbfb142`; this consolidation
does not restore them or retire any other planned preset.

Older omitted IDs retain their obligations through the grouped owners:

| Earlier IDs | Owning acceptance            |
| ----------- | ---------------------------- |
| K-1         | K-290                        |
| K-4         | K-55                         |
| K-5         | K-307, K-263                 |
| K-6, K-7    | K-42, K-298                  |
| K-8, K-9    | K-38, K-244, K-307           |
| K-10, K-11  | K-105                        |
| K-12        | K-284                        |
| K-15, K-16  | K-193, K-299                 |
| K-19, K-20  | K-65, K-179                  |
| K-22, K-23  | K-64, K-87, T-23             |
| K-26, K-29  | K-149, T-28, S-3, S-7, K-263 |
| K-30, K-33  | K-304, G-10                  |
| K-35        | K-211, K-248                 |

Registry ownership of the public npm name, public publication, code signing credentials,
protected Pages configuration, DNS, and live rollback need external authority or access.
Local packaging and deployment-definition correctness remain open work, not deferred by those
constraints. CI remains paused. No publication or reference-repository mutation is authorized.

## Candidate gate

Complete the behavior groups before application adoption. Their order reflects dependencies.

Apply K-298 and K-299 before destructive lifecycle work.
Apply K-300 and K-308 before changing schemas and callers. Apply K-301 before accepting
recommended output. Apply K-303 through K-307 before relying on generation, packaging, or harness results.

Integrate scenario acceptance with its behavior owner. Complete local package validation
before handoff. Registry ownership, public publication, deployment, and adoption measurements
remain external gates.

Implement coherent batches against the owning contracts, then run focused verification.
Resolve missing implementation details with those owners; no separate patch paperwork is required.

Record the source revision, candidate version, artifact hashes, command exit statuses, and CI
run URL (or the active bypass and deferred evidence) as evidence for this gate. All results
must refer to the same candidate revision:

1. Close the applicable behavior acceptance criteria, including unit, integration, planted-repository,
   lifecycle recovery, snapshot, hook, documentation, and release-package tests. Run the full
   implemented unit/plugin, integration, native, and acceptance suites. Invoke the release
   task after building its prerequisites and after source acceptance finishes. Measure
   coverage without an arbitrary quota.
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
1. Exercise real commit and pre-push hooks in disposable repositories, including rejection cases
   and existing-hook chaining. Do not create a dummy app commit to test the hooks of gspot itself.
1. When CI is enabled, read successful jobs for that exact revision, not merely the workflow
   configuration or an older green badge. During the active bypass, defer this requirement
   without starting or waiting for runs. Never describe deferred evidence as verified.
1. Repository pushes and commits still require the authority applicable to that implementation
   turn. Architecture maintenance does not authorize a commit or push.
1. As the last check before any authorized gspot commit, run `gspot check --staged`. A staged
   pass complements, and never replaces, the full candidate checks above.

## Deferred adoption

Yap adoption is deferred until the candidate gate passes and the applicable migration task
resumes. This architecture cleanup changes neither Yap nor reference repositories. Preserve
the bounded prior handoff contract below; it is not an instruction to execute it in this batch.

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
local registry, never `file:../gspot` or a workspace import. Record the registry setup
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

Before the deferred Yap handoff, review exception files nested under the former tooling folder,
including Semgrep project/pattern lists, CodeQL false positives, Trivy settings, and any Bearer
ignores carried into Semgrep. Preserve each exception's meaning or record its justified removal.
Do not merge the adoption branch before installable public artifacts exist. Other named
reference repositories remain read-only design inputs until separately authorized.

## Implementation cleanup verification

This section retains earlier behavior-specific evidence. Its test totals and unverified-state
statements describe that earlier pass; grouped dispositions own the current status.

The CLI uses standard filesystem APIs and retains ownership, original-file recovery, symlink
checks, and edited-file protection. Staged snapshots copy every dependency tree before link
validation. Presets live at `presets/<kind>/<name>/`. Configuration Files is the title of the
public `configs` preset at `presets/policy/configs/`; `policy` is the cross-language kind. Types and constants moved to behavioral owners. CLI upgrade,
version migrations, newer-version lookup, Changesets, and generated Markdown writers are retired.

The Astro loader builds reference entries from definitions with inherited command options,
settings, source/version attribution, and duplicate-identity validation. The local 310-page
build and link/fragment check passed. The site uses plain text branding and a real transcript. Publication,
deployment, rollback execution, CI, and changes to Yap, Nx, or Turborepo were not performed.

Corrected structural checks report implemented functions using executable-statement counts.
Local tests cover 0–3 statements, nested functions, closures, decorated methods, SQL/PL/pgSQL,
positive thresholds, and native seven/eight-parameter boundaries with explicit overrides.
Adoption preserves flat ESLint selectors, imported plugins and custom rules, and native Prettier
overrides and ignore negations. Shared EditorConfig overrides emit selectors instead of current
filenames. The formatter additions and remaining conversion limitations are recorded under
the configuration carryover group. Later legacy ESLint and processor evidence is recorded
there; this earlier pass does not determine their current disposition.

Verification passed: 819 unit/plugin/integration tests, 27 adoption acceptance tests against a
built candidate served by a temporary local fixture, and nine targeted adoption tests including
rejection of JSON-coerced executable settings. The CLI and plugin build; CommonJS and ESM plugin
consumer checks, workspace/documentation type checks, and 28 staged checks passed. The local
fixture serves an npm-packed candidate without publishing it. The 310-page site build includes
search and valid links/fragments; authored/generated reference collisions are rejected.

Cleanup remains incomplete. A historical direct ESLint run over CLI source, plugin source,
and the reference loader reported 3,282 findings, including 2,444 trivial-function findings. Remove unnecessary
functions and resolve the other findings; required external callbacks need individually reasoned,
narrow suppressions. No filler statements, structural-rule blanket suppressions, or unrelated
backlog completion are accepted. The staged gate does not include the all-level ESLint command,
so its success does not establish a clean self-lint run. Unsupported adoption cases above remain
explicit limitations, not successful conversions.

The former path-specific Zizmor exception is removed from authored policy. The Actionlint and
Zizmor workflow conflict remains unresolved. CI remains paused,
hooks remain enabled, and no commit, publication, deployment, or reference-repository change was
performed.

## Documentation and packaging layout cleanup

This section retains earlier layout decisions and scoped evidence. Current site, reference,
and package acceptance is recorded in the corresponding grouped dispositions.

Public documentation describes usage and setup. Internal release-state and direct-change policy
stay in architecture. The site and README use plain product text and the CLI transcript; the
illustrated character, concept files, social artwork, and associated requirements are removed.

The reference loader lives with content in `docs/src/content/reference.ts`. Link validation and
release verification live in `docs/scripts/`. Rule metadata and shared option schemas live beside
plugin rules under `packages/eslint-plugin/src/rules/`; their types stay with those definitions.

The root project license remains the single authored copy. Plugin builds include it only under
`dist/`. `packages/cli/notices.json` consolidates the eight supplemental package notice records
with their original text and provenance. The root license archive is removed. Binary packaging
still assembles notices for bundled dependencies, the grammar, and the runtime.

Scoped verification passed: 248 plugin, documentation, deployment-guard, and script-argument tests;
workspace and documentation type checks; CLI and plugin builds; and the 310-page documentation
build with link/fragment validation. npm dry-run packing includes one plugin license under
`dist/`. All eight supplemental notice records retain their exact upstream text and source.

## Retained implementation evidence

The observations below precede the September 23 consolidation. Retain their distinct behavior,
failure, and recovery evidence; aggregate totals and earlier audit limitations do not override
current grouped dispositions. No historical pass closes an unverified platform, download,
or frozen-candidate requirement.

The refreshed unit/plugin suite passes 469 tests with 518 assertions. The full integration
suite passes 771 tests with 5,108 assertions, including the corrected documentation example.
These runs cover the configuration precedence, Ruff inheritance, SQLFluff scope/default, and
dialect-validation changes. They precede the final Squawk/Gixy preview additions, whose focused
run passes 30 tests with 108 assertions. Workspace and documentation types pass. That pass
builds 312 documentation pages and validates all links and fragments. The earlier
755-pass/one-failure integration result is superseded by this complete passing run.
Frozen artifacts, platform acceptance, and the final staged check remain open.

The repository policy selects `level = "all"` and strict coverage. Managed output was regenerated
through `apply`; no managed file was edited directly. No open behavior group is closed by this
verification. The full implementation plan and candidate acceptance remain incomplete.

Legacy ESLint adoption now resolves inherited configuration through the installed native
loader. The adopted schema and generated configuration retain native override groups, ignore
negation, default dotfile behavior, plugin environments, and extension processors. Planted
future-file diagnostics and corrected cases pass. Cascading tests cover directory-relative
overrides and `root: true` resets. Package-embedded settings retain the shared manifest bytes.
The affected initialization, adoption, policy, profile, and scope run passes 92 tests with
245 assertions. Workspace type checking passes. Complete imported-tool coverage and candidate
diagnostics remain open. This evidence does
not close the importer ledger or candidate acceptance.

Formatter adoption retains nested EditorConfig documents at their native directory bases.
Before-and-after native comparisons cover `root = true`, `unset`, future files, and combined
Prettier precedence. Prettier branches exclude nested configuration directories instead of
inheriting parent options, including explicit parsers. Profiles omit complete EditorConfig
documents while retaining reusable formatting settings. The affected adoption, initialization,
policy, profile, and serialization run passes 93 tests with 308 assertions. Workspace type
checking passes. Nested ignore files and unrepresentable relocated selectors remain open.

Installation failures now return inability status 2. A hook conflict leaves hook bytes intact
while independent installer steps continue and report their results. The installation suite
passes 26 tests with 217 assertions; an additional conflict test passes six assertions. Git
hooks rooted at the repository itself install and restore successfully. Source and compiled
mise output share one version-pin decision. The repository's three tracked generated hooks matched HEAD and had no staged edits.
Their original bytes and modes were adopted into lifecycle recovery under the approved
repository repair scope, then replaced through `installHooks`. Recovery bytes match the
originals; reinstallation leaves ownership unchanged. Source hook inspection reports ready.
`core.hooksPath` remains `.gspot/hooks`. A boundary-local managed ignore block protects the
nested ownership and recovery files. General unsupported tracked hooks still refuse installation;
this repository repair does not weaken that rule.

Authenticated immutable package installation passes six npm, Bun, pnpm, Yarn Classic, nested
project, and runner-free cases with 249 assertions. The same fixture passes separately with
Yarn 4.9.2 and 43 assertions. Real mise execution passes with an isolated locally linked gspot
pin. The staged plugin import failures trace to an absent `.gspot/node_modules/@gspot/eslint-plugin`:
resolution falls back to the workspace link and its untracked distribution. Candidate package
installation and lock acceptance remain required; no working-tree distribution is imported into
revision snapshots.

Execution now carries each per-file input with its expanded command, so trailing arguments do
not become diagnostic filenames. Fixers retain partial changes and distinguish cancellation,
deadlines, and signaled process failures from source findings. `limits.tool_seconds` belongs to
the execution owner and is available without a structural preset. The affected settings and
reference tests pass 19 cases with 940 assertions.

A real descendant-process probe reproduced writes after the parent deadline. Asynchronous text
and binary execution now supervise POSIX process groups and request Windows tree termination.
CLI exit cleanup uses the declared, pinned `signal-exit` dependency. Planted descendant writes
are prevented on macOS for cancellation, timeout, and CLI exit. The affected subprocess,
runner, and fixer suite passes 54 tests with 402 assertions. Native Windows execution and the
remaining execution audit stay open.

The confinement audit adds shared directory enumeration and metadata inspection. Policy edits,
scope validation, Xcode discovery, agent-file discovery, and cache pruning use that boundary.
ESLint and Prettier adoption check the observed configuration before executing it. Tests plant
external configuration and directory links and verify that external bytes remain unchanged.
Policy edits preserve invalid UTF-8 input and reject a permission change after observation.

Dependency publication prepares replacements, executable links, and pruning together before
publishing files. Edited links and stale dependency files refuse the complete publication.
Failed installations retain their incomplete marker. Hook installation and removal publish
proposal batches through the same owner. Restoration conflicts report both the retained
destination and the recorded original backup, without printing backup content.

Scoped verification passes 165 tests with 1,097 assertions across 14 lifecycle, policy,
installation, cache, and required-rule files. A subsequent policy-edit run passes eight tests
with 27 assertions. The hook-removal update passes 22 installation tests with 194 assertions,
including interrupted restoration. These counts overlap. Workspace type checking passes.
These checks do not close K-298, K-299, the Windows execution gate, or candidate acceptance.

Further confinement checks cover initialization scope selection, tooling-directory discovery,
and manifest inspection. Invalid, linked, and missing scope directories fail before publication.
Git-configured external hooks remain a separately resolved boundary. Vale package observation
rejects linked configuration and style directories. Package refresh plans obsolete-file pruning
with replacements, preserving edited obsolete rules before publishing any replacement.
Structural rule caches use recorded ownership and refuse edited rules. Prettier ignore observation
uses the same confined reader before and after native evaluation. Uninstall acquires the hook
boundary and prepares hook restoration before publishing repository removals.

Focused runs pass nine initialization and tooling-discovery tests with 40 assertions, four Vale
installation tests with 32 assertions, 12 confinement tests with 141 assertions, and 23 installation
tests with 200 assertions. The installation run includes a planted hook-lock conflict that leaves
repository output intact, then succeeds after the lock is released. These runs overlap earlier
counts and do not establish full acceptance.

Apply prepares generated replacements and obsolete-output restoration in one publication batch.
A planted obsolete-directory link prevents new configuration and version publication. Restoring
the directory allows pruning and repeated apply. Source discovery resolves links through the
shared boundary before reading content, retains internal-link behavior, and rejects external
file and directory targets. Manifest and attributes reads use confined observation.

Git hook discovery preserves the path returned without Git's canonicalizing path-format option,
validates it, and resolves relative paths from the Git root even with nested policy. Executable
external-hook fixtures exposed the previous canonicalization gap. Leaf and parent links now fail
before installation. Managed executable and library probes also reject external links before
executing a version command or reading package metadata.

A combined lifecycle and repository run passed 170 tests and exposed the obsolete hook test's
nonexecutable-fixture assumption. After fixing hook discovery and strengthening that fixture,
26 hook and tooling-discovery tests pass with 210 assertions. Three subsequent hook cases cover
linked parents and nested configuration roots. Fourteen tracked-file tests pass with 46 assertions.
The apply suite passes six tests with 31 assertions. Verification counts overlap.

The completed affected lifecycle and repository run passes 178 tests with 1,296 assertions
across 19 files. Workspace discovery also preflights selected configurations, glob ancestors,
and package manifests through confinement before invoking the workspace resolver. Traversal,
brace-expanded traversal, and linked package directories fail without replacing configuration.
Inactive lower-priority workspace configuration retains the native selection precedence.

ESLint adoption carries root-relative selector bases and named or imported processors. Nested
export members identify executable objects in inherited flat configuration without serializing
functions. The emitted configuration restores those registrations and resolves selector bases
from the consumer root. Policy validation rejects escaped or linked bases and local modules.
Profile export omits repository-specific selectors and registrations; profile import rejects
those registrations. Native processor tests plant a finding in a future matching file, exclude
other paths, and pass corrected content. Legacy configuration and the remaining formatter
carryover contracts remain open. The shared schema, preset setting description, and reader
guide describe the new processor and base-path fields.

Windows file identities compare the read-only state that the filesystem API represents.
POSIX identities retain their permission bits. Repeated journal writes and restoration pass
an isolated subprocess test with the Windows permission projection on macOS. This is not
native Windows evidence. The final focused confinement, ownership, and installation run passes
71 tests with 553 assertions. Workspace type checking and a macOS ARM64 candidate build pass.

The source-mode and fresh macOS candidate staged gates still exit 1. Five ESLint records fail to load the workspace
plugin artifact from the revision dependency copy. Prose, TOML formatting, workflow security,
naming, and structural findings also remain. Existing report bytes remain protected, so report
publication also fails. These runs do not replace the repository-wide
5,710-finding inventory or establish clean candidate acceptance.

Formatter adoption now retains native Prettier options, JSON5, and nested configuration defaults
as ordered selectors for future files. Root EditorConfig sections and option precedence survive
initialization and uninstall. The owning files are `lifecycle/format-evaluation.ts`,
`lifecycle/takeover.ts`, `emit/format.ts`, and the formatting manifest/template. Tests compare
native formatting before and after adoption, including new JSX, HTML, Markdown, and nested files.
The schema and public adoption guide describe the retained settings and explicit limitations.

`repository/snapshot.ts` copies only recorded, unchanged Vale package assets when snapshot and
working configuration agree. Root and nested tests reject edited assets and changed configuration.
`run/broken-tool.ts` preserves module-loading diagnostics instead of masking them as malformed
structured output. `lifecycle/python-project.ts` creates relocatable environments before immutable
sync. Its test moves a console script environment to a path containing spaces and executes it.
`platform/spawn.ts` gives an absolute executable's siblings precedence in child PATH resolution,
while retaining explicit environment removal. Async and synchronous regressions cover this.

`packages/cli/compile.ts` owns Bun compiler integration for EditorConfig's WASM loader. The
parser asset is embedded and included in dependency metadata used for distribution notices.
All seven target builds pass; native execution evidence is limited to macOS ARM64.

Root hook ownership and dispatchers are repaired through the lifecycle owner. The prior root npm installation rejected the locked plugin artifact identity.
A fresh isolated-registry resolution and immutable installation now validate the current candidate
before publication through the lifecycle owner. The installed plugin matches the build byte for byte.
A repeated root immutable installation preserves the lock. Native resolution also refreshes
transitive browser data and core-module metadata. No hook bypass or manual lock edit was used. Python tool installation succeeds through
its lifecycle owner without changing tracked Python inputs.

The following owners have additional implementation and regression evidence:

| Requirement                     | Implementation owner                                               | Verified behavior                                                                                                                                                                    | Remaining acceptance                                                                                  |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Confined managed observations   | `emit/`, `policy/read-policy.ts`, `run/version-pin.ts`             | Preview rejects external symlinks in generated and shared configuration, policy, and pins. Malformed shared JSON and YAML fail without replacing originals.                          | Complete the lifecycle routing and recovery audit under K-298 and K-299.                              |
| Markdown configuration adoption | `lifecycle/carry.ts`, `policy/propose.ts`, `run/file-workspace.ts` | Rule choices survive root and disjoint nested adoption. Native checks use isolated selected files; scoped editor pointers preserve inheritance.                                      | Complete unsupported inheritance, custom rules, overlapping configurations, and candidate acceptance. |
| Scoped plugin configuration     | `presets/language/javascript/eslint.config.js.tmpl`                         | Root and nested JavaScript files execute actual ESLint configuration at both levels without the obsolete structural-rule option.                                                     | Complete framework parity and the enforcement ledger.                                                 |
| ESLint process results          | JavaScript and TypeScript manifests, `run/parse-output.ts`         | Crash text inside linted source stays a finding result. Malformed output fails explicitly. Empty results and paths with Windows separators or sibling root prefixes parse correctly. | Complete other parsers, process execution, revision selection, and caching.                           |

The current workspace suite passes 858 tests with 3,715 assertions across 132 files. Reported
coverage is 67.17% of functions and 73.83% of lines, including fixture files in the denominator.
This run includes the Python installation and subprocess changes. Workspace
and documentation type checks pass. The plugin builds. The documentation build produces 310
pages, and its link and fragment validation passes. Formatting of changed authored TypeScript
files passes. The focused adoption and takeover suite passes 32 tests with 179 assertions. The Python
installation suite passes four tests with 104 assertions; subprocess tests pass 19 tests with
81 assertions. These counts overlap the workspace suite where applicable.

All seven CLI target builds pass: macOS ARM64 and x64, Linux ARM64 and x64 with glibc and musl,
and Windows x64. Local execution is on macOS ARM64. Cross-compilation does not establish native
Linux or Windows behavior.

Release tests ran with `GSPOT_RELEASE_TEST=1` against an isolated local registry: eight passed
with 415 assertions. The installed-consumer journey imports EditorConfig, formats future files,
and restores original configuration bytes and modes on uninstall. It hides the checkout
EditorConfig WASM asset during initialization to verify that the executable embeds its parser.
Independent ESM, CommonJS, and type consumers pass. The current rerun includes the Python
and subprocess fixes. No public publication ran.

The current built candidate's repository-wide `check --no-cache` run finishes in 109 seconds
with 109 check records and 5,710 findings: 77 records pass, 26 fail, and six delegate coverage
to another check. No record reports a missing tool or execution error. The largest result is
4,240 CLI TypeScript ESLint findings. This supersedes the preceding 5,689-finding inventory;
the added implementation also needs all-level cleanup. It does not establish clean acceptance.

Python tools have been installed through the lifecycle owner. YAML passes and Semgrep executes
in all four scopes, reporting five dynamic-import findings in the CLI configuration evaluators.
Zizmor executes and reports the unresolved self-repository workflow syntax conflict. The run
precedes this completion-record update, so neither its source identity nor the artifacts are
frozen as a final candidate.

Required-rule inspection uses one native ESLint configuration process per scope and still
queries every selected file. The focused source-mode run finishes in 1.1 seconds and retains
all 222 required-rule findings. The same focused built-candidate run takes 1.4 seconds. Tests confirm later-file overrides, a single configuration
load, corrected configuration in a repeated session, malformed-input failure, and cancellation.
The complete built-candidate gate decreases from 403 to 109 seconds in these local runs;
that comparison does not establish a portable performance guarantee.

Configuration evaluators publish structured results to confined private temporary files.
Standard output and error remain logs. This removes the extra output pipe that stalled repeated
ESLint evaluations. The unused descriptor plumbing is removed from the process runner.
The focused configuration, adoption, and subprocess suite passes 42 tests with 157 assertions.

Vale setup checks recorded bytes and modes before accepting existing packages. A fresh sync
adopts byte-identical unowned package files without changing their modes and retains their
original recovery records. It preflights the complete publication before applying proposals.
Edited outputs remain protected. Archive URLs resolve to their installed style names.
The four focused Vale tests pass with 27 assertions. Root apply records the existing matching
packages, and a staged Vale run executes and reports prose findings instead of missing packages.

Candidate acceptance remains blocked by repository-owned defects and incomplete implementation:

- Legacy ESLint cascades, registered processors, nested EditorConfig, combined formatter
  precedence, and inherited parser resets have focused passing evidence above. Certain relocated
  selector negations and nested ignore files remain explicit conversion gaps. Rejections preserve
  active originals. Complete importer-ledger and candidate acceptance remain open.
- Source and compiled builds now emit the same gspot mise pin. The source runner tests pass.
  A rebuilt candidate and apply idempotency remain required.
- The current built-candidate manual-stage gate passes all six check records: external
  documentation links, CodeQL, and Semgrep registry checks across four scopes. This does not
  clear the separate source-rule findings in the full repository gate.
- The retained candidate doctor run found all pinned tools but returned zero despite missing
  or edited pre-commit integration. Source doctor now returns a finding for that diagnostic;
  missing, installed, and edited hook cases pass in the 29-test install/doctor suite with 231
  assertions. Root hook inspection now reports ready after the recorded owner-driven repair.
  Candidate rebuilding remains open. Hooks were not disabled; CI remains paused.
- Existing `.gspot/report.json` bytes are protected as edited or unowned, so report publication
  fails. Those bytes were preserved.

The source tree and artifacts are not frozen as a final candidate. No commit, push, public
publication, deployment, DNS change, or change to Yap, Nx, or Turborepo was performed.

Structural acceptance repairs retain statement-count enforcement. Python module documentation
alone is not a trivial-code file; imports and wrappers remain findings. The affected parser and
execution suite passes 30 tests with 45 assertions. The plugin recognizes nonempty owned type
literals passed to schema APIs, including Vue props, without exempting ordinary forwarding calls.
All six native Vue/Svelte component cases pass. Declaration documentation remains attached across
lint directives; the focused rule suite passes 12 cases, and plugin type checking passes.

Private tool placement is shared by project emission and executable resolution. Pinned npm
and Python tools cannot fall back to developer installations or PATH. Host compilers retain
project resolution, including direct lookup. The focused probe suite passes 29 tests with
78 assertions; two additional host/Python regressions pass with four assertions. Workspace
type checking passes. The refreshed integration run passes 611 cases and exposes seven
fixtures that still provisioned developer tools. The corrected adapter, structure, and
confinement suites pass 44 tests with 459 assertions. These results do not close K-217 or the installation acceptance group.

The prior full acceptance run finished with 271 passes and three failures. The shifted shell
suppression line and reasons-test timeout are corrected. The former K-186 implementation passed Knip entry selection
to the plugin and incorrectly exempted mandatory trivial-file checks. Its passing results below
are historical defect evidence, not current structural acceptance.
The focused Vite, structure, and reasons run passed 14 cases with 125 assertions before strict
private resolution. Real private Python acceptance now passes both cases with 46 assertions.
The private Vite journey passes after isolating the Bun package cache for each acceptance
registry. Reusing the development plugin version had selected an older cached artifact.
The acceptance harness installs locked sandbox dependencies through their lifecycle owners;
its native-tool PATH no longer supplies private npm or Python tools.

The historical private Vite journey passed 18 assertions at both levels but required entry files
to avoid the file-only finding. Those exemption assertions are invalid and have been replaced.
The installed Vite journey passes through the isolated acceptance runner. Generated ESLint,
standalone plugin, and installed-entry verification are recorded in the current cleanup dispositions.
Structural blocks apply ancestor scopes before deeper scopes regardless of declaration order.

The repository source reader now confines full-content reads at use time, including structural,
prose, configuration, security, naming, database, and build-output consumers. Cache hashing and
inline suppression share that reader. A link introduced after inventory is refused; a corrected
internal link succeeds. The repository reader suite passes 17 cases with 59 assertions, including
an external managed Gitleaks baseline that returns inability code 2 and then passes after correction.
The affected OpenAPI, cache, suppression, and reader run passes 36 cases with 122 assertions.
The unit/plugin suite passes 397 tests. Workspace type checking passes.

CodeQL validates database and SARIF destination names before spawning. Four planted portable
escapes are refused before any tool invocation; corrected Python execution passes, using a
controlled process fixture. The security preset and generated mise pin now agree with the
ledger on CodeQL 2.24.3. Owner-driven apply also refreshes the generated ESLint policy rules.
CodeQL 2.24.3 is installed locally, and its version and language metadata are verified.

Unversioned query resolution failed against the registry with an unexpected `digest` field.
The preset now declares exact `query_packs` versions from the matching
[CodeQL release source](https://github.com/github/codeql/tree/codeql-cli/v2.24.3).
Pinned Python queries resolve and execute successfully. The adapter uses native extractor
metadata for documented language names and scans each resolved language once.
SARIF parsing rejects incomplete reports and failed invocations. It resolves URI bases and
artifact references, decodes source names, and maps temporary source locations before applying
path-specific exceptions. Character offsets honor source encoding, newlines, and column units.
The parser/execution run passes 25 cases with 72 assertions; type checking passes.
Native CLI acceptance passes four Python and JavaScript cases at both levels with 28 assertions.
The planted SQL injections report `py/sql-injection` at `query.py:6:42` and
`js/sql-injection` at `query.js:8:22`, with exit 1. Parameterized corrections exit 0.
JavaScript uses the documented `javascript-typescript` language selection. Authored files remain
unchanged. Native acceptance for the other configured languages and
complete per-language build settings remains open.

The filesystem audit also identified a static-site build in the working tree and unrestricted
Swift response-file reads. The following evidence records their completed local corrections.

Static-site builds now run from selected disposable copies. Run-owned resources retain output
for sibling checks and remove the copies after all checks settle, including failed builds.
The six site integration cases pass with 26 assertions, covering original output bytes and modes,
unrelated working-tree input, failed reproducibility, cleanup, and external output links.
The affected site, runner, and cache suite passes 24 cases with 267 assertions. Swift response-file
expansion reads only within its compiler cache before publishing the log; all 13 Swift build
integration cases pass with 24 assertions. These implementation results supersede the two open
filesystem-audit observations above, without closing native platform or final candidate gates.

Swift builds populate a stable, confined source copy in the compiler cache. Later builds restore
selected source bytes and modes, remove generated files and empty directories from that copy,
and preserve unchanged source timestamps for incremental compilation. Diagnostics map copied source
paths back to the repository. The native package test verifies reuse of an unchanged object and
a compiler diagnostic after source correction. The affected build and confinement run passes
36 cases with 250 assertions. Native static-site acceptance passes 35 assertions, with pinned
output tools running through shared deadline and cancellation handling.

The private-registry full acceptance run reports 242 passes and 32 failures. Missing private
installations in direct-init and direct-apply fixtures account for many failures. Spectral
execution and the editorconfig-checker download rate limit also require resolution. This run
is provisional: source and artifacts were not frozen, and it does not close final acceptance.

The shared compiler-source owner also serves Periphery and XCTest coverage. Each consumer has
a separate cache identity, so concurrently selected checks retain independent source copies
and artifacts. The Swift/XCTest integration run passes 22 cases with 79 assertions. Native
Swift package acceptance passes all 13 assertions after retaining actual compiler paths in the
analyzer log and mapping only reported paths. Generated internal build links are removed before
restoring selected sources.
Installation publication validates its output root and uses confined traversal before proposals.
A linked output root is refused without publishing external bytes; the corrected directory
installs. Ownership tests pass 48 cases with 279 assertions. The refreshed full integration
run passes 636 tests with 3,372 assertions. These results precede final candidate freezing.

The corrected private-installation acceptance batch passes 61 cases, with two failures. The
subsequent focused run passes all four cases with 58 assertions, covering both failures:
shallow-clone commit checks install their private tools, and Express pins Ajv in its own preset
so Spectral and its validator plugins load the same code generator. OpenAPI checks use shared
execution boundaries. Native npm wrappers initialize in the isolated installation before
publication. Failed initialization publishes no dependencies; corrected installation records
the downloaded binary before its first repository probe. The package-manager and probe suite
passes 37 cases with 337 assertions. Xcode project escape tests pass for traversal, absolute,
drive-relative, and alternate-separator inputs, each followed by corrected execution.

Fresh native-wrapper downloads reached the unauthenticated GitHub API limit. The later
integration run has 639 passes and one external-download setup failure, and the formatter
acceptance run has nine passes and eight setup failures for the same limit. These failures
remain open acceptance work. The earlier native-wrapper publication test passed with the
actual pinned binary; the later rate limit is not recorded as an implementation pass.
CodeQL now runs each language from a separate selected source copy through shared execution
boundaries. Four controlled-process cases pass 36 assertions, including no working-tree build
side effect and removal of all copies. This does not establish a native CodeQL scan.

The filesystem audit covers authored source consumers, configuration and profile publication,
managed dependencies, reports, caches, hook boundaries, and native build outputs. Managed
repository mutations use confinement and lifecycle proposals. Explicit external profiles and
declared dependency inputs remain read-only inputs; native tools run in selected copies where
they generate project output. Temporary installer files stay below newly created installation
roots, and publication validates outputs before changing the repository. Unavailable native
Windows execution and frozen-candidate acceptance remain separate gates.
