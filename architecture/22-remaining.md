# Remaining Work

This is the only status record for the architecture. Contracts describe the target; source and
recorded execution establish only the behavior they actually cover. Local verification below covers the implementation cleanup. Unrelated architecture groups remain open.

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

The reconciled backlog has **30 open behavior groups**. Four additional gates are deferred:
native-platform/remote CI execution, website publication and rollback, registry/public-release
authority, and Yap adoption. Four groups record implemented local behavior. Architecture status
consolidation is complete, and implementation prescriptions are retired.

## Implementation order

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

Open. Route every managed read, write, replacement, and deletion through confinement. The standard filesystem implementation is shared across platforms; native execution evidence remains deferred. Reject path escapes and existing symlink parents before touching external files. Hostile concurrent directory swaps are outside the contract.

Open acceptance IDs: K-298.

Former unnamed cleanup entries: 10.

Source and retained evidence: [packages/cli/src/lifecycle/confined.ts](../packages/cli/src/lifecycle/confined.ts), [packages/cli/tests/integration/lifecycle/confined.test.ts](../packages/cli/tests/integration/lifecycle/confined.test.ts).

Acceptance: [K-298](03-configuration.md#acceptance-k-298).

### Ownership and recovery

Open. Complete common ownership routing, proposal publication, pruning, and interrupted recovery across init, apply, remove, and uninstall. Preserve unowned files, later edits, original bytes and modes, and fresh-clone files.

Open acceptance IDs: K-257, K-252, K-118, K-299.

Former unnamed cleanup entries: 9, 11.

Source and retained evidence: [packages/cli/src/lifecycle/ownership.ts](../packages/cli/src/lifecycle/ownership.ts), [packages/cli/tests/integration/lifecycle/ownership.test.ts](../packages/cli/tests/integration/lifecycle/ownership.test.ts).

Acceptance: [K-118](03-configuration.md#acceptance-k-118), [K-299](03-configuration.md#acceptance-k-299), [K-257](03-configuration.md#acceptance-k-257).

### Configuration carryover

Open. Complete lossless effective configuration resolution for path-specific rules, shared manifests, formatter overrides, and every supported root pointer. Retain unsupported source configuration and list every uncarried setting. Keep developer ESLint and its dependencies intact.

Open acceptance IDs: K-36, K-193, K-41, K-120, K-59, K-217, K-239, K-269, K-270.

Former unnamed cleanup entries: 37.

Source and retained evidence: [packages/cli/src/lifecycle/takeover.ts](../packages/cli/src/lifecycle/takeover.ts), [tests/acceptance/cli/takeover.test.ts](../tests/acceptance/cli/takeover.test.ts).

Acceptance: [K-36](03-configuration.md#acceptance-k-36), [K-193](03-configuration.md#acceptance-k-193), [K-120](03-configuration.md#acceptance-k-120), [K-59](10-hooks-ci-runners.md#acceptance-k-59), [K-217](03-configuration.md#acceptance-k-217), [K-269](03-configuration.md#acceptance-k-269).

### Tool installation

Open. Verify immutable installation under each supported package manager, workspace and private-registry configuration. Complete manifest-owned install metadata, missing-host advice, isolation, retries, and tracked-file preservation. Resolve changed locks only during apply.

Open acceptance IDs: K-180, K-240, K-237, K-264, K-265, K-266, K-283, K-267, K-268, K-297.

Source and retained evidence: [packages/cli/src/lifecycle/install-command.ts](../packages/cli/src/lifecycle/install-command.ts), [packages/cli/tests/integration/install.test.ts](../packages/cli/tests/integration/install.test.ts).

Acceptance: [K-264](11-toolchain.md#acceptance-k-264), [K-267](03-configuration.md#acceptance-k-267), [K-297](11-toolchain.md#acceptance-k-297), [K-180](04-presets.md#acceptance-k-180), [K-237](03-configuration.md#acceptance-k-237), [K-268](03-configuration.md#acceptance-k-268).

### Initialization and detection

Open. Complete project and dependency detection, grouped preset selection, detected defaults, and one read-only proposal. Initialize new and existing repositories without running checks; a missing tool differs from invalid configuration or failed lock resolution.

Open acceptance IDs: K-182, K-214, K-247, K-126, K-128, K-53, K-93, K-40, K-64.

Locally implemented IDs: K-127.

Source and retained evidence: [packages/cli/src/lifecycle/init/command.ts](../packages/cli/src/lifecycle/init/command.ts).

Acceptance: [K-182](04-presets.md#acceptance-k-182), [K-126](03-configuration.md#acceptance-k-126), [K-128](03-configuration.md#acceptance-k-128), [K-53](05-engines.md#acceptance-k-53), [K-93](04-presets.md#acceptance-k-93), [K-40](04-presets.md#acceptance-k-40), [K-64](02-cli.md#acceptance-k-64).

### Configuration and scopes

Open. Complete readable comment-preserving writes, deepest-scope selection, consistent formatting settings, canonical setting names, and destination-safe serialization. Separate syntax failure from recoverable policy findings.

Open acceptance IDs: K-147, K-238, K-51, K-88, K-215, K-224, K-228, K-222, K-48.

Source and retained evidence: [packages/cli/src/policy/schema.ts](../packages/cli/src/policy/schema.ts), [packages/cli/tests/integration/policy/takeover.test.ts](../packages/cli/tests/integration/policy/takeover.test.ts).

Acceptance: [K-51](03-configuration.md#acceptance-k-51), [K-88](03-configuration.md#acceptance-k-88), [K-48](03-configuration.md#acceptance-k-48), [K-215](03-configuration.md#acceptance-k-215), [K-222](03-configuration.md#acceptance-k-222), [K-238](03-configuration.md#acceptance-k-238), [K-147](03-configuration.md#acceptance-k-147), [K-116](03-configuration.md#acceptance-k-116).

### Commands and reusable profiles

Open. Finish the exact public command surface and selectors. Preserve export and init --from, including pathless ignores and integration choices; report omitted repository-specific values. Verify dry-run preservation and effective add/remove dependencies.

Open acceptance IDs: D-129, K-62, K-63, K-95, K-98, K-284, K-285, K-287, K-288, K-291.

Locally implemented IDs: K-290, K-289.

Source and retained evidence: [packages/cli/src/program.ts](../packages/cli/src/program.ts), [tests/acceptance/cli/profile.test.ts](../tests/acceptance/cli/profile.test.ts).

Acceptance: [D-129](02-cli.md#acceptance-d-129), [K-95](02-cli.md#acceptance-k-95), [K-284](02-cli.md#acceptance-k-284), [K-287](02-cli.md#acceptance-k-287), [K-291](02-cli.md#acceptance-k-291), [K-62](02-cli.md#acceptance-k-62), [K-290](02-cli.md#acceptance-k-290).

### Hook composition and runner tasks

Open. Verify each supported hook manager and runner, reachable existing-hook composition, independently replayed stdin, failures, clone-local setup, and owned restoration. Preserve developer tasks and never inject prepare scripts.

Open acceptance IDs: K-109, K-76, K-78, K-56, K-57, K-58, K-60, K-292, K-275.

Source and retained evidence: [packages/cli/src/lifecycle/hooks.ts](../packages/cli/src/lifecycle/hooks.ts), [tests/acceptance/cli/hooks.test.ts](../tests/acceptance/cli/hooks.test.ts).

Acceptance: [K-37](10-hooks-ci-runners.md#acceptance-k-37), [K-56](10-hooks-ci-runners.md#acceptance-k-56), [K-58](10-hooks-ci-runners.md#acceptance-k-58), [K-60](10-hooks-ci-runners.md#acceptance-k-60), [K-76](03-configuration.md#acceptance-k-76), [K-292](10-hooks-ci-runners.md#acceptance-k-292), [K-108](03-configuration.md#acceptance-k-108), [K-109](03-configuration.md#acceptance-k-109), [K-275](10-hooks-ci-runners.md#acceptance-k-275).

### Immutable Git selection

Open. Complete exact staged and pushed object selection, all ref pairs, first pushes, deleted branches, shallow clones, submodules, linked worktrees, and config below the Git root. Keep whole-project findings and failures for affected scopes; no-Git mode remains supported.

Open acceptance IDs: K-70, K-293, K-294, K-295, K-271, K-272.

Source and retained evidence: [packages/cli/src/repository/snapshot.ts](../packages/cli/src/repository/snapshot.ts), [tests/acceptance/cli/selectors.test.ts](../tests/acceptance/cli/selectors.test.ts).

Acceptance: [K-70](10-hooks-ci-runners.md#acceptance-k-70), [K-293](10-hooks-ci-runners.md#acceptance-k-293), [K-295](10-hooks-ci-runners.md#acceptance-k-295), [K-272](10-hooks-ci-runners.md#acceptance-k-272), [K-271](10-hooks-ci-runners.md#acceptance-k-271).

### Process execution and failure reporting

Open. Finish routing tools and fixers through shared resolution, batching, deadlines, cancellation, and capture. Audit remaining failure-to-empty readers, including the plugin directory reader. Distinguish absent, skipped, failed, changed, and unchanged results.

Open acceptance IDs: K-42, K-158, K-307.

Former unnamed cleanup entries: 16, 22, 24.

Source and retained evidence: [packages/cli/src/platform/spawn.ts](../packages/cli/src/platform/spawn.ts), [packages/cli/tests/integration/spawn.test.ts](../packages/cli/tests/integration/spawn.test.ts).

Acceptance: [K-42](05-engines.md#acceptance-k-42), [K-140](05-engines.md#acceptance-k-140), [K-157](05-engines.md#acceptance-k-157), [K-307](05-engines.md#acceptance-k-307), [K-258](06-enforcement-ledger.md#acceptance-k-258).

### Session observations and parsing

Open. Complete session-owned file, scope, parse, and Git observation reuse. Refresh after edits and between sessions. Preserve scoped SQL history, staged Xcode symlinks, unusual filenames, malformed-input failures, and language-specific parsing.

Open acceptance IDs: K-138, K-148, K-176, K-24, K-139, K-171, K-190.

Locally implemented IDs: K-162.

Former unnamed cleanup entries: 21.

Source and retained evidence: [packages/cli/src/run/session.ts](../packages/cli/src/run/session.ts), [packages/cli/tests/integration/checks/postgres-history.test.ts](../packages/cli/tests/integration/checks/postgres-history.test.ts).

Acceptance: [K-138](05-engines.md#acceptance-k-138), [K-162](05-engines.md#acceptance-k-162), [K-176](05-engines.md#acceptance-k-176), [K-24](12-repository-layout.md#acceptance-k-24).

### Cache correctness and performance

Open. Complete configuration, tool, scope, and declared-input invalidation; relocate platform build caches. Preserve owned 30-day retention and narrowed-run behavior. Measure bounded commit and initialization cost under stated cold/warm conditions.

Open acceptance IDs: K-43, K-44, K-71, K-196, T-12.

Partially implemented ID: K-69. No-input repository checks bypass cache; explicit input
acceptance remains open in this group.

Former unnamed cleanup entries: 23.

Source and retained evidence: [packages/cli/src/run/cache.ts](../packages/cli/src/run/cache.ts), [packages/cli/tests/integration/run/cache-retention.test.ts](../packages/cli/tests/integration/run/cache-retention.test.ts).

Acceptance: [K-43](05-engines.md#acceptance-k-43), [K-69](10-hooks-ci-runners.md#acceptance-k-69), [K-196](05-engines.md#acceptance-k-196), [T-12](12-repository-layout.md#acceptance-t-12).

### Isolated generators and builds

Open. Complete isolated generation and build checks without modifying authored or untracked working-tree files. Swift incremental compilation is locally implemented; native Xcode reuse and platform cache placement remain open.

Open acceptance IDs: K-156, K-159, K-154.

Partially implemented ID: K-143. Incremental package builds and analyzer isolation have
local evidence; Xcode and platform cache behavior remain open in this group.

Source and retained evidence: [packages/cli/src/checks/swift/build.ts](../packages/cli/src/checks/swift/build.ts).

Acceptance: [K-156](05-engines.md#acceptance-k-156), [K-154](06-enforcement-ledger.md#acceptance-k-154), [K-143](05-engines.md#acceptance-k-143).

### Strictness levels and adoption usefulness

Open. Complete one level owner across planning, templates, plugin, prose, and guides. Recommended findings must demonstrate defects on ordinary and established projects. Retain all opt-in naming, layout, forwarding, and style rules at all.

Open acceptance IDs: K-198, K-52, K-221, K-135, K-141, K-142, K-123, K-152, K-227, K-174, K-161, K-167, K-112, K-200, K-175, T-19, T-33, K-75, K-91, K-301.

Locally implemented IDs: K-101, K-151, K-201, K-74.

Former unnamed cleanup entries: 29.

Source and retained evidence: [tests/acceptance/cli/levels.test.ts](../tests/acceptance/cli/levels.test.ts).

Acceptance: [K-198](04-presets.md#acceptance-k-198), [K-101](04-presets.md#acceptance-k-101), [K-135](04-presets.md#acceptance-k-135), [K-152](04-presets.md#acceptance-k-152), [K-174](04-presets.md#acceptance-k-174), [K-175](04-presets.md#acceptance-k-175), [K-201](04-presets.md#acceptance-k-201), [K-74](04-presets.md#acceptance-k-74), [K-75](04-presets.md#acceptance-k-75), [K-301](04-presets.md#acceptance-k-301), [T-19](12-repository-layout.md#acceptance-t-19).

### Shared language and plugin enforcement

Open. Finish equivalent shared enforcement across Swift, JavaScript, TypeScript, Python, and framework components. Preserve all standalone plugin exports and options, alias and type-only import handling, valid exemptions, locations, and corrected cases.

Open acceptance IDs: K-188, K-208, K-209, K-210, K-50, K-133, K-136, K-49, K-137, K-87, K-235, K-86.

Locally implemented IDs: K-102, K-187.

Former unnamed cleanup entries: 30.

Source and retained evidence: [packages/cli/src/structure/engine.ts](../packages/cli/src/structure/engine.ts), [packages/cli/tests/integration/emit/plugin-levels.test.ts](../packages/cli/tests/integration/emit/plugin-levels.test.ts).

Acceptance: [K-102](05-engines.md#acceptance-k-102), [K-208](05-engines.md#acceptance-k-208), [K-50](06-enforcement-ledger.md#acceptance-k-50), [K-87](06-enforcement-ledger.md#acceptance-k-87), [K-186](06-enforcement-ledger.md#acceptance-k-186), [K-189](06-enforcement-ledger.md#acceptance-k-189), [K-137](06-enforcement-ledger.md#acceptance-k-137), [K-49](06-enforcement-ledger.md#acceptance-k-49).

### Planned integrations and preset coverage

Open. Implement every explicitly agreed ledger capability, including the planned Jest preset and remaining nginx acceptance. Complete framework accessibility and test integrations, scoped security packs, non-npm licenses, database lint, and Swift test overrides. Do not expand this into adding every available linter.

Open acceptance IDs: K-218, K-211, K-212, K-233, K-236, K-80, K-248, K-256.

Source and retained evidence: [presets](../presets).

Acceptance: [K-211](06-enforcement-ledger.md#acceptance-k-211), [K-233](06-enforcement-ledger.md#acceptance-k-233), [K-236](06-enforcement-ledger.md#acceptance-k-236), [K-248](06-enforcement-ledger.md#acceptance-k-248), [K-256](06-enforcement-ledger.md#acceptance-k-256), [K-218](04-presets.md#acceptance-k-218).

### Tool compatibility and release pins

Open. Execute the pinned tools with generated configurations and parse actual results. Registry existence and peer ranges are necessary metadata, not compatibility evidence. Preserve distinct installer versions and supported generated rule names.

Open acceptance IDs: K-251, K-207, K-249.

Locally implemented IDs: K-206, K-250, K-213.

Former unnamed cleanup entries: 7.

Source and retained evidence: [packages/cli/src/platform/tool-probe.ts](../packages/cli/src/platform/tool-probe.ts).

Acceptance: [K-207](05-engines.md#acceptance-k-207), [K-206](11-toolchain.md#acceptance-k-206), [K-249](06-enforcement-ledger.md#acceptance-k-249), [K-251](06-enforcement-ledger.md#acceptance-k-251), [K-250](06-enforcement-ledger.md#acceptance-k-250).

### Domain-specific scope behavior

Open. Complete per-scope inputs and layout-independent behavior for Python, Swift, SQL dialects, Docker, and route tests. Preserve TypeScript project references, statement locations, Bash/Zsh/Bats distinctions, and external protocol names.

Open acceptance IDs: K-149, K-155, K-163, K-144, K-90, K-150, K-153, K-160, K-184, K-191.

Locally implemented IDs: K-226.

Source and retained evidence: [packages/cli/src/checks](../packages/cli/src/checks).

Acceptance: [K-149](06-enforcement-ledger.md#acceptance-k-149), [K-144](06-enforcement-ledger.md#acceptance-k-144), [K-153](06-enforcement-ledger.md#acceptance-k-153), [K-160](06-enforcement-ledger.md#acceptance-k-160), [K-184](06-enforcement-ledger.md#acceptance-k-184), [K-191](06-enforcement-ledger.md#acceptance-k-191), [K-172](06-enforcement-ledger.md#acceptance-k-172), [K-178](06-enforcement-ledger.md#acceptance-k-178), [K-226](06-enforcement-ledger.md#acceptance-k-226), [K-254](06-enforcement-ledger.md#acceptance-k-254), [K-134](06-enforcement-ledger.md#acceptance-k-134), [K-192](06-enforcement-ledger.md#acceptance-k-192).

### Manifest and schema ownership

Open. Complete feature-owned policy, tool metadata, fragments, schemas, and check dispatch. Derive parsed types and choices from definitions. Reject conflicting identities and invalid variants; keep shared parsers outside check catalogs.

Open acceptance IDs: K-100, K-79, K-39, K-14, K-107, K-13, K-38, K-17, K-85, K-113, K-177, K-203, K-197, K-223, K-199, K-220, K-105, K-183, K-106, K-55, K-77, K-124, K-131, K-165, K-94, K-169.

Locally implemented IDs: K-119, K-255.

Former unnamed cleanup entries: 20, 25, 26, 27.

Source and retained evidence: [packages/cli/src/presets/manifest-schema.ts](../packages/cli/src/presets/manifest-schema.ts), [packages/cli/tests/unit/presets/select.test.ts](../packages/cli/tests/unit/presets/select.test.ts).

Acceptance: [K-79](04-presets.md#acceptance-k-79), [K-39](04-presets.md#acceptance-k-39), [K-38](04-presets.md#acceptance-k-38), [K-197](04-presets.md#acceptance-k-197), [K-105](04-presets.md#acceptance-k-105), [K-55](12-repository-layout.md#acceptance-k-55), [K-99](04-presets.md#acceptance-k-99), [K-104](04-presets.md#acceptance-k-104), [K-119](04-presets.md#acceptance-k-119), [K-255](04-presets.md#acceptance-k-255).

### Rule guides and agent instructions

Open. Complete level-aware rule assembly, conditional selection, prose consistency, and correct examples. Fix recorded Bash retry/status, sentinel, decimal port, deletion-root, Python limit/suppression, and SQL ownership examples. Preserve shared agent blocks and authored Cursor files.

Open acceptance IDs: K-229, K-241, K-261, K-230, K-179, K-232, K-231, K-260, K-242, K-262, K-65, K-67.

Locally implemented IDs: K-279.

Source and retained evidence: [packages/cli/src/rules/assemble.ts](../packages/cli/src/rules/assemble.ts), [tests/acceptance/cli/agents.test.ts](../tests/acceptance/cli/agents.test.ts).

Acceptance: [K-179](09-rules.md#acceptance-k-179), [K-231](09-rules.md#acceptance-k-231), [K-230](09-rules.md#acceptance-k-230), [K-229](09-rules.md#acceptance-k-229), [K-241](09-rules.md#acceptance-k-241), [K-261](09-rules.md#acceptance-k-261), [K-65](09-rules.md#acceptance-k-65), [K-67](09-rules.md#acceptance-k-67), [K-279](09-rules.md#acceptance-k-279), [S-10](09-rules.md#acceptance-s-10).

### Exceptions and public vocabulary

Open. Finish one tracked exception policy and public definition/reference names. Preserve external tool directives, optional reasons and require_reasons, scoped ignores, and executable fixer results. No repository-wide synonym campaign is required.

Open acceptance IDs: K-89, K-66, K-308.

Locally implemented IDs: K-111, K-115, K-234, K-110.

Former unnamed cleanup entries: 28.

Source and retained evidence: [packages/cli/src/policy/ignore-command.ts](../packages/cli/src/policy/ignore-command.ts), [packages/cli/tests/unit/policy/settings.test.ts](../packages/cli/tests/unit/policy/settings.test.ts).

Acceptance: [K-111](02-cli.md#acceptance-k-111), [K-114](05-engines.md#acceptance-k-114), [K-234](06-enforcement-ledger.md#acceptance-k-234), [K-89](03-configuration.md#acceptance-k-89), [K-66](02-cli.md#acceptance-k-66), [K-308](05-engines.md#acceptance-k-308).

### Generated metadata and drift

Open. Complete manifest-derived untracked paths, supported root pointers, meaningful generated-drift findings, and merge-conflict recovery. The current ignore block still hardcodes Vale paths. Preserve recovery metadata and retire obsolete local skip behavior.

Open acceptance IDs: D-100, K-47, K-259, K-246, A-5, K-296, K-274.

Source and retained evidence: [packages/cli/src/emit/managed-blocks.ts](../packages/cli/src/emit/managed-blocks.ts), [tests/acceptance/cli/lifecycle.test.ts](../tests/acceptance/cli/lifecycle.test.ts).

Acceptance: [D-100](02-cli.md#acceptance-d-100), [A-5](03-configuration.md#acceptance-a-5), [K-296](03-configuration.md#acceptance-k-296), [K-259](02-cli.md#acceptance-k-259), [K-246](05-engines.md#acceptance-k-246), [K-274](03-configuration.md#acceptance-k-274).

### Reports, doctor, and check coverage

Open. Complete progress output, truthful summaries and cached results, Git hook diagnostics, per-kind check coverage, scoped explanations, and useful configuration errors. Message-stage runs must preserve the prior report.

Open acceptance IDs: K-81, K-84, K-117, K-82, K-83, S-6, K-166, K-122, K-132, K-130, K-185, K-243.

Source and retained evidence: [packages/cli/src/output/reporter.ts](../packages/cli/src/output/reporter.ts), [tests/acceptance/cli/checks.test.ts](../tests/acceptance/cli/checks.test.ts).

Acceptance: [K-81](02-cli.md#acceptance-k-81), [K-82](02-cli.md#acceptance-k-82), [K-166](02-cli.md#acceptance-k-166), [K-122](02-cli.md#acceptance-k-122), [K-45](10-hooks-ci-runners.md#acceptance-k-45).

### Consumer CI generation

Open. Complete GitHub fork/private/merge-queue behavior, least permissions, useful SARIF, GitLab CodeClimate reports and clone depth, and documented commands for other CI systems. Preserve no-CI selection and existing workflow ownership.

Open acceptance IDs: K-253, K-96, K-276, K-277, K-278.

Source and retained evidence: [packages/cli/src/emit](../packages/cli/src/emit), [tests/acceptance/cli/hooks.test.ts](../tests/acceptance/cli/hooks.test.ts).

Acceptance: [K-96](10-hooks-ci-runners.md#acceptance-k-96), [K-276](10-hooks-ci-runners.md#acceptance-k-276), [K-277](10-hooks-ci-runners.md#acceptance-k-277), [K-278](10-hooks-ci-runners.md#acceptance-k-278), [K-253](10-hooks-ci-runners.md#acceptance-k-253).

### Behavioral acceptance quality

Open. Finish defects and corrected cases with exact check, diagnostic, file, location, and exit assertions. Exercise fresh/existing projects, scopes, package managers, generated configs, and real hooks. Remove obsolete detail tests and share only setup that does real work.

Open acceptance IDs: T-27, T-4, T-8, T-21, T-24, T-1, T-2, T-32, T-3, T-6, T-7, T-13, T-28, T-17, T-14, T-30, G-2, T-29, T-26, T-5, T-18, T-23, T-10, T-15, T-16, K-28, T-36, T-22, T-25, T-20, T-35.

Locally implemented IDs: T-9.

Former unnamed cleanup entries: 32, 33, 34, 35, 36.

Source and retained evidence: [tests/harness/planted.ts](../tests/harness/planted.ts), [tests/acceptance/cli/reference.test.ts](../tests/acceptance/cli/reference.test.ts).

Acceptance: [T-27](12-repository-layout.md#acceptance-t-27), [T-24](12-repository-layout.md#acceptance-t-24), [T-3](12-repository-layout.md#acceptance-t-3), [T-28](12-repository-layout.md#acceptance-t-28), [T-29](12-repository-layout.md#acceptance-t-29), [T-23](12-repository-layout.md#acceptance-t-23), [K-28](12-repository-layout.md#acceptance-k-28), [T-36](12-repository-layout.md#acceptance-t-36), [T-22](12-repository-layout.md#acceptance-t-22), [T-20](12-repository-layout.md#acceptance-t-20).

### Repository checks and tooling

Open. Finish template validation at both levels, meaningful unit/plugin push checks, and required prerequisite failures. Keep Bun and mise, feature-owned constants, schemas and assets with consumers, and no source/test symmetry or new private packages.

Open acceptance IDs: S-1, S-2, S-3, S-7, S-8, S-12.

Locally implemented IDs: G-13, K-306.

Retired IDs: S-9.

Source and retained evidence: [.mise/conf.d/repo.toml](../.mise/conf.d/repo.toml), [tests/integration/ci-affected.test.ts](../tests/integration/ci-affected.test.ts).

Acceptance: [S-1](12-repository-layout.md#acceptance-s-1), [S-3](12-repository-layout.md#acceptance-s-3), [G-13](12-repository-layout.md#acceptance-g-13), [K-306](12-repository-layout.md#acceptance-k-306).

### Reference content loaders

Open. Replace generated source Markdown with validated Astro content entries. Preserve public URLs, inherited options, complete settings, source links, duplicate detection, and authored guides. Retire writer/pruning machinery only after equivalent content-store behavior passes.

Open acceptance IDs: S-4, S-5, S-11, S-14, S-16, S-17, K-225, S-15, K-304.

Locally implemented IDs: K-205, K-303.

Retired IDs: S-13, S-18.

Source and retained evidence: [docs/src/content/reference.ts](../docs/src/content/reference.ts), [tests/integration/reference-pages.test.ts](../tests/integration/reference-pages.test.ts).

Acceptance: [K-205](21-documentation.md#acceptance-k-205), [K-303](21-documentation.md#acceptance-k-303), [K-304](21-documentation.md#acceptance-k-304), [S-4](21-documentation.md#acceptance-s-4), [S-15](21-documentation.md#acceptance-s-15).

### Guides and site acceptance

Open. Complete release-matched reader tasks and visual review at desktop/mobile widths, both themes, keyboard, screen reader, reduced motion, and zoom. Preserve the plain text identity and real transcripts; source presence and a successful build do not prove usability.

Open acceptance IDs: G-10, K-202, S-19.

Source and retained evidence: [docs/src/pages/index.astro](../docs/src/pages/index.astro).

Acceptance: [G-10](21-documentation.md#acceptance-g-10), [S-19](21-documentation.md#acceptance-s-19).

### Packaging and installed-product acceptance

Open. Validate every artifact before publication, legal payloads, schemas, provenance, signing, all seven targets, and the installed launcher/platform/plugin journey. Freeze one candidate and reuse its artifacts; a prior host-only package pass is not candidate acceptance.

Open acceptance IDs: K-164, K-145, K-121, K-244, K-245, K-280.

Former unnamed cleanup entries: 40.

Source and retained evidence: [packages/cli/publish.ts](../packages/cli/publish.ts), [tests/release/install.test.ts](../tests/release/install.test.ts).

Acceptance: [K-164](11-toolchain.md#acceptance-k-164), [K-280](11-toolchain.md#acceptance-k-280).

### Native Windows lifecycle

Open. Implement native Windows secure lifecycle operations before accepting Windows initialization, apply, recovery, and uninstall. Current source explicitly refuses mutation outside Darwin/Linux. Historical successful Windows tests predate this boundary and cannot close the gap.

Open acceptance IDs: K-263.

Source and retained evidence: [packages/cli/src/lifecycle/confined.ts](../packages/cli/src/lifecycle/confined.ts), [packages/cli/tests/integration/lifecycle/confined.test.ts](../packages/cli/tests/integration/lifecycle/confined.test.ts).

Acceptance: [K-263](11-toolchain.md#acceptance-k-263).

### Architecture contract agreement

Architecture complete; runtime acceptance stays open in its behavior owners. This consolidation establishes one contract owner and one grouped status owner. Runtime help, schemas, emitted output, and lifecycle agreement remain part of their owning open groups; document cleanup alone does not complete those behaviors.

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

Source and retained evidence: [tests/harness/registry/lifecycle.ts](../tests/harness/registry/lifecycle.ts), [tests/release/plugin.test.ts](../tests/release/plugin.test.ts).

Acceptance: [K-310](12-repository-layout.md#acceptance-k-310).

### Applying an installed version

Version migrations and the upgrade command are retired. Apply accepts the installed binary,
previews generated changes, and advances the version pin only after successful publication.
Package managers update gspot; install consumes resulting tool locks independently.

Local evidence: changed-pin preview/application and edited-output regression in
[apply.test.ts](../packages/cli/tests/integration/lifecycle/apply.test.ts), plus 42 confinement
and ownership recovery tests. Platform and complete candidate acceptance remain deferred.

### Repository CI definitions

Implemented locally: one authored owner, affected checks at normal cadence and explicit full-platform checkpoints. Native execution, remote required-check behavior, and timing remain deferred while CI is paused.

Locally implemented IDs: K-309.

Source and retained evidence: [.github/workflows/ci.yml](../.github/workflows/ci.yml), [tests/integration/ci-affected.test.ts](../tests/integration/ci-affected.test.ts).

Acceptance: [K-309](10-hooks-ci-runners.md#acceptance-k-309).

### Website deployment

Deferred: publication of a stable release, protected Pages environment, domain ownership, HTTPS cutover, and a live rollback require external release/account actions. Local source provides guarded previews and release-aligned deployment checks. No deployment is authorized by this cleanup.

Deferred IDs: K-302.

Source and retained evidence: [.github/workflows/site.yml](../.github/workflows/site.yml), [docs/scripts/verify-release.ts](../docs/scripts/verify-release.ts).

Acceptance: [K-302](21-documentation.md#acceptance-k-302).

### Retired implementation prescriptions

Retired: mandatory directory symmetry and filename inventories, one-file-per-type/constant, global synonym counts, repeated status logs, and per-edit full matrices. Preserve configurable shipped naming and placement rules and their public exports. Generated-Markdown mechanics retire only after the loader replacement is verified.

Retired IDs: T-34, K-146, K-282, T-31, T-11, K-54, K-73, K-68.

Former unnamed cleanup entries: 39.

Source and retained evidence: [architecture/12-repository-layout.md](../architecture/12-repository-layout.md), [architecture/21-documentation.md](../architecture/21-documentation.md).

Acceptance: [K-146](02-cli.md#acceptance-k-146), [K-54](02-cli.md#acceptance-k-54), [K-282](02-cli.md#acceptance-k-282), [K-61](12-repository-layout.md#acceptance-k-61), [K-73](12-repository-layout.md#acceptance-k-73), [T-31](12-repository-layout.md#acceptance-t-31).

## Current architecture verification

The September 22 documentation-only verification covers 16 retained documents and 85 removals.
All 305 named disposition rows and 25 unnamed cleanup entries have one status assignment;
30 groups remain open. Prettier, Markdown lint, architecture links and anchors, whitespace
validation, and the requested commit-message validation passed. No product tests or release
builds were run.

The required source-checkout `gspot check --staged` failed before running checks: `lstat`
reported `ENOENT` for `docs/node_modules/zod` inside its temporary Git revision tree.
This is a verification blocker, not a passing staged gate. Commit and push remain pending;
keep CI paused and repair the implementation outside this architecture-only batch.

## Historical and deferred evidence

September 21 macOS ARM64 development runs used Bun 1.3.11. The previous record reports local
ownership/confinement recovery, strict Git observations, scope handling, tool cancellation,
agent preservation, Git attributes, plugin levels, and installed package journeys. Those
results were produced during development, before a frozen candidate. They are historical
execution evidence, not tests rerun by this documentation change.

The source review confirms that the Git-attributes proposal and its autocrlf/restoration journey
exist. K-273 is therefore locally implemented alongside K-72, despite its old unchecked row.
The same distinction applies to registry child ownership (K-310), strict batched SQL history
(K-162), and incremental Swift builds (K-143). Native-platform evidence remains separate.
Current hardcoded ignore paths and unsupported Windows mutation branches remain visible gaps.

Reference generation already includes inherited Commander options and rejects conflicting
settings. Complete global setting coverage and the Astro content-loader replacement remain
open. The current site has a real Bash finding/correction transcript, task guides,
version/source links, and guarded release deployment definitions. Previous site builds and link
checks passed locally; desktop/mobile, keyboard, screen-reader, and live deployment acceptance
were not completed. Page totals and intermediate timings are not acceptance evidence.

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
   turn. This documentation batch authorizes only its own architecture commit and normal push.
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
isolated local registry, never `file:../gspot` or a workspace import. Record the registry setup
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

The CLI uses standard filesystem APIs and retains ownership, original-file recovery, symlink
checks, and edited-file protection. Staged snapshots copy every dependency tree before link
validation. Presets are flat, `configs` is the public data/configuration preset, and `policy`
is the cross-language kind. Types and constants moved to behavioral owners. CLI upgrade,
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
filenames. Unsupported legacy ESLint, processors, EditorConfig imports, nested formatter
configuration, and JSON5 conversion fail explicitly and leave originals intact.

Verification passed: 819 unit/plugin/integration tests, 27 adoption acceptance tests against a
built candidate served by a temporary local fixture, and nine targeted adoption tests including
rejection of JSON-coerced executable settings. The CLI and plugin build; CommonJS and ESM plugin
consumer checks, workspace/documentation type checks, and 28 staged checks passed. The local
fixture serves an npm-packed candidate without publishing it. The 310-page site build includes
search and valid links/fragments; authored/generated reference collisions are rejected.

Cleanup remains incomplete. Direct ESLint over CLI source, plugin source, and the reference
loader reports 3,282 findings, including 2,444 trivial-function findings. Remove unnecessary
functions and resolve the other findings; required external callbacks need individually reasoned,
narrow suppressions. No filler statements, structural-rule blanket suppressions, or unrelated
backlog completion are accepted. The staged gate does not include the all-level ESLint command,
so its success does not establish a clean self-lint run. Unsupported adoption cases above remain
explicit limitations, not successful conversions.

One path-specific exception covers Zizmor's self-repository syntax audit for the reusable release
workflow: pinned Actionlint rejects that audit's dollar-prefixed replacement. CI remains paused,
hooks remain enabled, and no commit, publication, deployment, or reference-repository change was
performed.

## Documentation and packaging layout cleanup

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
