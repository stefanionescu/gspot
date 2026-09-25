# Remaining Work

This is the single implementation and verification backlog. Durable behavior belongs to the
linked architecture contracts. An open acceptance clause is not proof of missing code.
Where older records conflict or lack current evidence, the item remains a verification task.

## Active constraints and implementation order

Preserve public commands, configuration semantics, findings, exit codes, package exports,
all seven targets, the direct npm launcher, the independent plugin, and existing dependencies.
Keep strict coverage and both structural rules at every level. Do not add compatibility
aliases, forwarding modules, private packages, or a test framework. Work alone.
No commit, push, public publication, deployment, DNS change, or external repository mutation
is authorized by this cleanup. Generate managed outputs through policy and `gspot apply`.

Cleanup order: lifecycle publication contracts, source consumers, authored build modules,
behavior-focused test moves/splits, policy and generated output, then architecture reconciliation.
Subsequent work proceeds through confirmed defects, contract verification, repository-wide lint,
and one unchanged candidate. External work has its own prerequisites below.

### Active CI bypass

CI remains paused until explicitly re-enabled. Do not dispatch, rerun, or wait for GitHub Actions.
If commits are later authorized during this bypass, include `[skip ci]` in every commit before
pushing. Keep hooks and local staged checks enabled. Native-platform and CI-only evidence is
deferred, not passed. Local workflow implementation stays in scope. Agree execution frequency
before restoring remote gates.

## Confirmed defects and incomplete features

- **Configuration conversion:** complete nested ignore-file handling and relocated selector
  negations that adoption cannot represent. Owner: policy adoption and evaluation. Preserve
  unsupported active originals and identify every uncarried setting. Completion: native
  before/after checks on existing and future files, including correction and recovery.
  Depends on publication. Contracts: K-36, K-193, K-217, K-269, K-270.
- **Dependency relocation audit:** inspect executable Python `.pth` loaders and Windows console
  launchers against the current revision copier. Owner: repository revisions. Later launcher
  repairs do not establish every loader form. Completion: immutable staged/pushed execution
  without host-checkout imports, plus corrected/refused inputs. Depends on confinement.
  Contracts: K-70, K-271, K-272, K-293, K-294, K-295.
- **Mixed native failures:** determine whether plist and other native adapters can treat an
  inaccessible input plus a real diagnostic as findings alone. Owner: execution output and
  native check adapters. Completion: mixed malformed/missing/inaccessible cases report inability,
  then findings and clean results after correction. Depends on pinned tools. Contracts: K-42,
  K-158, K-307. This is an unresolved classification audit, not a confirmed repaired defect.
- **Remaining enforcement audits:** verify inline documentation trivia, lock-format edge cases,
  manifest-derived ignore paths, and complete per-language build settings. Owner: checks and
  configuration definitions. Completion: each contract has a concrete defect and corrected
  native result. Depends on scope resolution and normal acquisition. Contracts: K-248, K-154,
  K-156, K-159, K-246, K-274.

## Verification still required

Each item below retains the unresolved clauses from the prior grouped record. Older partial
passes do not close a clause. Reconcile implementation against the linked contract before
changing code, and implement only confirmed gaps. The completion evidence is the required
result, not a claim that it has been obtained.

Implementation-owner paths below are relative to `packages/cli/src/`, except explicit repository
paths. Build ownership is `packages/cli/build/`; configuration and rule ownership is under
`packages/cli/`.

### Lifecycle confinement

Verify managed reads, replacements, deletions, path escapes, existing links, and native filesystem behavior. Hostile concurrent directory swaps remain outside the contract.

Owner: `platform/filesystem.ts`. Dependencies: ownership/recovery. Completion evidence: Unsafe links, read-only bytes, full-disk failure, and native replacement/recovery scenarios pass.

Acceptance: K-298.

### Ownership and recovery

Complete common ownership routing, proposal publication, pruning, and interrupted recovery across init, apply, remove, and uninstall. Preserve unowned files, later edits, original bytes and modes, and fresh-clone files.

Owner: `lifecycle/ownership.ts`. Dependencies: confinement. Completion evidence: Init, apply, remove, uninstall, and interrupted batches preserve authored bytes and modes.

Acceptance: K-257, K-252, K-118, K-299.

### Configuration carryover

Complete lossless effective configuration resolution for path-specific rules, shared manifests, formatter overrides, and every supported root pointer. Retain unsupported source configuration and list every uncarried setting. Keep developer ESLint and its dependencies intact.

Owner: `policy/adoption/`. Dependencies: lifecycle publication. Completion evidence: Native before/after comparisons retain effective configuration for existing and future files; unsupported settings retain originals.

Acceptance: K-36, K-193, K-41, K-120, K-59, K-217, K-239, K-269, K-270.

### Tool installation

Verify immutable installation under each supported package manager, workspace and private-registry configuration. Complete manifest-owned install metadata, missing-host advice, isolation, retries, and tracked-file preservation. Resolve changed locks only during apply.

Owner: `tools/`. Dependencies: publication and package locks. Completion evidence: Fresh npm, Bun, pnpm, Yarn Classic/modern, Python, workspaces, and authenticated registries install locked tools without tracked changes.

Acceptance: K-237, K-264, K-265, K-266, K-283, K-267, K-268, K-297, K-180, K-240.

### Initialization and detection

Complete project and dependency detection, grouped configuration selection, detected defaults, and one read-only proposal. Initialize new and existing repositories without running checks; a missing tool differs from invalid configuration or failed lock resolution.

Owner: `commands/init/`. Dependencies: adoption and tools. Completion evidence: New/existing project journeys distinguish invalid configuration, unavailable tools, and failed lock resolution without running checks.

Acceptance: K-182, K-214, K-247, K-53, K-93, K-40, K-64, K-127, K-126, K-128.

### Configuration and scopes

Complete readable comment-preserving writes, deepest-scope selection, consistent formatting settings, canonical setting names, and destination-safe serialization. Separate syntax failure from recoverable policy findings.

Owner: `policy/`. Dependencies: schemas and generation. Completion evidence: Root and nested scopes preserve comments, settings precedence, serialization, and malformed-input diagnostics.

Acceptance: K-147, K-238, K-51, K-88, K-215, K-224, K-48, K-222, K-228, K-116.

### Commands and reusable profiles

Finish the exact public command surface and selectors. Preserve export and init --from, including pathless ignores and integration choices; report omitted repository-specific values. Verify dry-run preservation and effective add/remove dependencies.

Owner: `commands/ and policy/profiles/`. Dependencies: policy and lifecycle. Completion evidence: Public help, selectors, dry runs, add/remove, export, and init --from match the command contract.

Acceptance: D-129, K-62, K-63, K-95, K-98, K-284, K-285, K-287, K-288, K-291, K-290, K-289.

### Hook composition and runner tasks

Verify each supported hook manager and runner, reachable existing-hook composition, independently replayed stdin, failures, clone-local setup, and owned restoration. Preserve developer tasks and never inject prepare scripts.

Owner: `lifecycle/hooks/`. Dependencies: installation and recovery. Completion evidence: Every manager/runner clone journey preserves locks and tasks, forwards stdin, rejects defects, and restores owned hooks.

Acceptance: K-109, K-76, K-78, K-56, K-57, K-58, K-60, K-292, K-275, K-37, K-108.

### Immutable Git selection

Complete exact staged and pushed object selection, all ref pairs, first pushes, deleted branches, shallow clones, submodules, linked worktrees, and config below the Git root. Keep whole-project findings and failures for affected scopes; no-Git mode remains supported.

Owner: `repository/revisions/`. Dependencies: confinement and dependency copying. Completion evidence: Staged and all pushed objects, shallow clones, worktrees, submodules, and nested policy use immutable selected inputs.

Acceptance: K-70, K-293, K-294, K-295, K-271, K-272.

### Process execution and failure reporting

Finish routing tools and fixers through shared resolution, batching, deadlines, cancellation, and capture. Audit remaining failure-to-empty readers. The plugin directory reader already propagates read failures. Distinguish absent, skipped, failed, changed, and unchanged results.

Owner: `platform/spawn.ts and execution/`. Dependencies: tool observations. Completion evidence: Native fatal, malformed, finding, corrected, cancellation, and deadline cases retain exact exits and cleanup.

Acceptance: K-42, K-158, K-307, K-140, K-157, K-258.

### Session observations and parsing

Complete session-owned file, scope, parse, and Git observation reuse. Refresh after edits and between sessions. Preserve scoped SQL history, staged Xcode symlinks, unusual filenames, malformed-input failures, and language-specific parsing.

Owner: `execution/session.ts and parsers/`. Dependencies: repository observations. Completion evidence: Read/parse/Git reuse remains session-scoped and refreshes after edits; malformed input and unusual filenames remain visible.

Acceptance: K-138, K-148, K-176, K-24, K-139, K-171, K-190, K-162.

### Cache correctness and performance

Complete configuration, tool, scope, and declared-input invalidation; relocate platform build caches. Preserve owned 30-day retention and narrowed-run behavior. Measure bounded commit and initialization cost under stated cold/warm conditions.

Owner: `execution/cache.ts`. Dependencies: stable source and normal acquisition. Completion evidence: Tool/configuration/scope/declared-input changes invalidate results; owned retention and cold/warm timing meet the contract.

Acceptance: K-43, K-44, K-71, K-196, T-12, K-69.

### Isolated generators and builds

Complete isolated generation and build checks without modifying authored or untracked working-tree files. Swift incremental compilation is locally implemented; native Xcode reuse and complete build isolation remain open.

Owner: `checks/`. Dependencies: revision isolation. Completion evidence: Build/generator checks preserve authored and untracked files; native Xcode reuse and per-language build settings pass.

Acceptance: K-156, K-159, K-154, K-143.

### Strictness levels and adoption usefulness

Complete one level owner across planning, templates, plugin, prose, and guides. Recommended includes defect checks and mandatory trivial-function and trivial-file rules on
ordinary and established projects. Keep both structural rules enabled by default at every level,
root and nested scope, and standalone plugin surface. Retain other opt-in naming, layout, and
style rules at all. Do not add blanket callback or framework exemptions during cleanup.

Owner: `policy/ and generation/`. Dependencies: schemas and shared enforcement. Completion evidence: Both levels and inherited scopes execute required structural rules; optional style/naming rules retain their declared level.

Acceptance: K-198, K-52, K-221, K-135, K-141, K-142, K-123, K-152, K-227, K-174, K-161, K-167, K-112, K-200, K-175, T-19, T-33, K-75, K-91, K-301, K-101, K-151, K-201, K-74.

### Shared language and plugin enforcement

Finish equivalent shared enforcement across Swift, JavaScript, TypeScript, Python, and framework components. Preserve all standalone plugin exports and options, alias and type-only import handling, valid exemptions, locations, and corrected cases.

Owner: `checks/ and packages/eslint-plugin/src/`. Dependencies: parsers and generated configurations. Completion evidence: Cross-language defects/corrections preserve locations, aliases, type-only imports, valid exemptions, options, and plugin exports.

Acceptance: K-188, K-208, K-209, K-210, K-50, K-133, K-136, K-49, K-137, K-87, K-235, K-86, K-102, K-187, K-186, K-189.

### Planned integrations and configuration coverage

Implement every explicitly agreed ledger capability, including the planned Jest configuration and remaining nginx acceptance. Complete framework accessibility and test integrations, scoped security packs, non-npm licenses, database lint, and Swift test overrides. Do not expand this into adding every available linter.

Owner: `configurations/ and checks/`. Dependencies: ledger reconciliation. Completion evidence: Each agreed capability has native defect/correction evidence, including Jest, nginx, accessibility, security packs, licenses, databases, and Swift overrides.

Acceptance: K-218, K-211, K-212, K-233, K-236, K-80, K-248, K-256.

### Tool compatibility and release pins

Execute the pinned tools with generated configurations and parse actual results. Registry existence and peer ranges are necessary metadata, not compatibility evidence. Preserve distinct installer versions and supported generated rule names.

Owner: `configurations/ and tools/`. Dependencies: normal pinned acquisition. Completion evidence: Pinned executables consume generated configuration and emit actual parsed results; installer versions remain distinct.

Acceptance: K-251, K-207, K-249, K-206, K-250, K-213.

### Domain-specific scope behavior

Complete per-scope inputs and layout-independent behavior for Python, Swift, SQL dialects, Docker, and route tests. Preserve TypeScript project references, statement locations, Bash/Zsh/Bats distinctions, and external protocol names.

Owner: `checks/`. Dependencies: scope resolution and parsers. Completion evidence: Python, Swift, SQL, Docker, routes, TypeScript references, and shell variants retain scoped inputs and external names.

Acceptance: K-155, K-163, K-90, K-150, K-153, K-160, K-184, K-191, K-226, K-144, K-149, K-172, K-178, K-254, K-134, K-192.

### Manifest and schema ownership

Complete feature-owned policy, tool metadata, fragments, schemas, and check dispatch. Derive parsed types and choices from definitions. Reject conflicting identities and invalid variants; keep shared parsers outside check definitions.

Owner: `configurations/ and policy/`. Dependencies: contract audit. Completion evidence: Runtime/editor schemas, choices, fragments, identity collisions, and dispatch agree with feature-owned definitions.

Acceptance: K-100, K-79, K-39, K-14, K-107, K-13, K-38, K-17, K-85, K-113, K-177, K-203, K-197, K-223, K-199, K-220, K-105, K-183, K-106, K-55, K-77, K-124, K-131, K-165, K-94, K-169, K-119, K-255, K-99, K-104.

### Rule guides and agent instructions

Complete level-aware rule assembly, conditional selection, and executable example
acceptance. Retain outstanding verification for decimal ports, deletion roots, Python
limits/suppressions, and SQL ownership. Preserve shared agent blocks and authored Cursor files.

Owner: `agents/ and rules/`. Dependencies: selection and executable examples. Completion evidence: Decimal ports, deletion roots, Python limits/suppressions, SQL ownership, conditional guides, shared blocks, and Cursor preservation pass.

Acceptance: K-229, K-241, K-261, K-230, K-179, K-232, K-231, K-260, K-242, K-262, K-65, K-67, K-279, S-10.

### Exceptions and public vocabulary

Finish one tracked exception policy and public definition/reference names. Preserve external tool directives, optional reasons and require_reasons, scoped ignores, and executable fixer results. No repository-wide synonym campaign is required.

Owner: `policy/ and commands/`. Dependencies: schema/command agreement. Completion evidence: Reasons, scoped exceptions, external directives, definitions, and fixer outcomes preserve their public contracts.

Acceptance: K-89, K-66, K-308, K-111, K-115, K-234, K-110, K-114.

### Generated metadata and drift

Complete supported root pointers, meaningful generated-drift findings, and merge-conflict recovery. Manifest-derived untracked paths and no-Git ignore emission have local implementation evidence below. Preserve recovery metadata and retire obsolete local skip behavior.

Owner: `generation/ and lifecycle/drift.ts`. Dependencies: publication and ownership. Completion evidence: Root pointers, meaningful drift, conflict recovery, metadata retention, and manifest-derived ignore paths pass.

Acceptance: D-100, K-47, K-259, K-246, A-5, K-296, K-274.

### Reports, doctor, and check coverage

Complete progress output, truthful summaries and cached results, Git hook diagnostics, per-kind check coverage, scoped explanations, and useful configuration errors. Message-stage runs must preserve the prior report.

Owner: `output/ and commands/doctor/`. Dependencies: execution and comparison owners. Completion evidence: Progress, summaries, caching, coverage, explanations, hook readiness, and message-stage report preservation are exercised.

Acceptance: K-84, K-117, K-82, K-83, S-6, K-122, K-132, K-130, K-185, K-243, K-81, K-166, K-45.

### Consumer CI generation

Complete GitHub fork/private/merge-queue behavior, least permissions, useful SARIF, GitLab CodeClimate reports and clone depth, and documented commands for other CI systems. Preserve no-CI selection and existing workflow ownership.

Owner: `generation/workflow.ts`. Dependencies: workflow ownership and report schemas. Completion evidence: Local GitHub/GitLab fixtures cover forks, private repositories, merge queues, permissions, reports, clone depth, and no-CI selection.

Acceptance: K-253, K-96, K-276, K-277, K-278.

### Behavioral acceptance quality

Complete executable examples, acquisition-blocked journeys, and supported-platform acceptance.

Owner: `tests/`. Dependencies: stable source, native tools, isolated registry. Completion evidence: Every retained scenario is discovered in its proper lane; planted failures have corrected cases and exact results; no required skip is a pass.

Acceptance: T-27, T-4, T-8, T-21, T-24, T-1, T-2, T-32, T-3, T-6, T-7, T-13, T-28, T-17, T-14, T-30, G-2, T-29, T-26, T-5, T-18, T-23, T-10, T-15, T-16, K-28, T-36, T-22, T-25, T-20, T-35, T-9.

### Repository checks and tooling

Finish template validation at both levels, meaningful unit/plugin push checks, and required prerequisite failures. Keep Bun and mise, feature-owned constants, schemas and assets with consumers, and no source/test symmetry or new private packages.

Owner: `gspot.toml and .mise/conf.d/repo.toml`. Dependencies: all behavior owners. Completion evidence: Both generation levels, unit/plugin checks, prerequisites, Bun coverage substitution, and final repository checks execute.

Acceptance: S-1, S-2, S-3, S-7, S-8, S-12, G-13, K-306.

### Reference content loaders

Execute defect/correction examples for every shipped check and plugin reference. Keep the existing Astro loader, public URLs, validation, and attribution.

Owner: `docs/src/content/reference/`. Dependencies: released definitions and native examples. Completion evidence: Every shipped reference has executable defect/correction evidence, validated identity, source attribution, and accurate public metadata.

Acceptance: S-4, S-5, S-11, S-14, S-16, S-17, K-225, S-15, K-304, K-205, K-303.

### Guides and site acceptance

Complete executable guide examples and release-matched site acceptance. Local visual evidence does not establish deployed behavior.

Owner: `docs/`. Dependencies: reference examples and candidate artifacts. Completion evidence: Authored examples execute; site build, local links/fragments, keyboard, themes, zoom, and reduced motion remain valid.

Acceptance: G-10, K-202, S-19.

### Packaging and installed-product acceptance

Complete frozen-candidate artifact validation, installed CLI acceptance, legal payloads,
provenance/signing verification, and native execution on supported platforms. All seven targets
build locally, but cross-compilation does not establish that each target runs.

Owner: `build/ and tests/support/release/`. Dependencies: all seven builds and normal acquisition. Completion evidence: Launcher/platform/plugin payloads, legal notices, parser independence, ESM/CommonJS exports, provenance, and installed journeys pass.

Acceptance: K-164, K-145, K-121, K-244, K-245, K-280.

### Acquisition and package-manager journeys

Owner: tool installation and release acceptance. Resolve the EditorConfig Checker 3.4.0
GitHub HTTP 403 acquisition failures, plus failed mise acquisitions, through normal installation.
Do not substitute host executables, skip downloads, or treat an already installed tool as fresh
acquisition evidence. Rerun npm with no runner, Bun, pnpm, Yarn Classic and modern Yarn,
Python locks, authenticated registries, workspaces, and fresh-clone hooks. Record versions and
exact failing acquisition boundaries. Completion requires source and installed journeys to pass
sequentially on the same source. Depends on network/provider availability and candidate artifacts.
Acceptance: K-237, K-264 through K-268, K-280, K-283, K-297.

### Performance validation

Owner: execution cache and lifecycle installation. Measure cold and warm initialization,
commit checks, parser reuse, and build caches under the contract's stated conditions. The prior
performance case failed during acquisition. It has no complete replacement result. Record
hardware, versions, inputs, elapsed times, and cache state without relaxing bounds. Depends on
successful normal acquisition and stable source. Acceptance: K-43, K-44, K-69, K-71, K-196, T-12.

### Candidate gate

Owner: repository verification and release tooling. Record the base revision, source digest,
version, artifact hashes, commands, exit statuses, and active CI bypass. A source change requires
rebuilding affected artifacts and repeating affected acceptance. Required evidence:

1. Discover every retained scenario in unit, deterministic integration, native integration,
   source acceptance, and installed-release acceptance. Keep one registry lifecycle for release
   journeys and no global fixture cache. Measure coverage without introducing a quota.
2. Verify types, schema parity, commands, generation at both levels, ownership/recovery,
   cancellation, caching, revision isolation, and plugin RuleTester behavior.
3. Verify cold/warm inputs, download failures, corrupt caches, all seven binaries, standalone
   embedded parsers, legal payloads, ESM/CommonJS plugin imports, launcher behavior, and eight
   CLI package dry runs plus the plugin dry run. Do not publish publicly.
4. Run source acceptance and installed-release acceptance sequentially after source settles.
   Treat acquisition failures as failures and unavailable platforms as deferred evidence.
5. Validate architecture links, documentation references and examples, schema endpoint, site
   build, links, and fragments. Keep screen-reader acceptance outside the agreed scope.
6. Run repository checks at `level = "all"`, manual checks, and doctor. The existing Bun
   `tests/unit` and `tests/coverage` substitution for Jest coverage remains the only substitution.
   No required missing tool or skipped check establishes a pass.
7. Verify repeated apply, drift preview, immutable installation in a disposable checkout, and
   real rejecting/corrected hook journeys. Run `gspot check --staged` last through a disposable
   index, and verify the real index remains byte-identical. Do not make a commit for verification.

Dependencies: confirmed repairs, normal acquisition, local tools, and the lint phase below.
Acceptance: K-24, K-28, K-55, K-300, K-303 through K-307, K-310; all applicable behavior clauses above.

## Repository-wide lint remediation

This is a required separate phase. Current cleanup preserves the findings; it does not establish
a clean repository. The historical full and staged counts are diagnostic observations, not current
completion evidence. Owner: the source/configuration owners named by each finding. Dependencies:
structural cleanup and current generated policy. Completion: rerun the unchanged candidate's
full, manual, and staged checks with every required check executed and passing.

- Repair TypeScript and ESLint findings, including authored build code.
- Repair naming, placement, structure, and trivial-function/file findings in their behavior owners.
- Remove confirmed duplication without introducing forwarding or configurable generic services.
- Repair prose, Markdown, documentation paths, and executable example findings.
- Reconcile unused dependencies, including the retained documentation YAML dependency, in the
  dependency phase. Do not remove dependencies as part of this cleanup.
- Resolve external-tool failures separately from source findings, including Pinact GitHub quotas
  and native installation failures. Re-run the affected check after the cause is resolved.

Do not disable rules, lower strictness, pad code, introduce blanket exceptions, skip required
checks, or replace native findings with mocked success. Acceptance: S-1, S-2, S-3, S-7, S-8,
S-12, K-306, and the owning language/enforcement clauses.

## External or unavailable-platform work

- **Native platforms:** owner: platform/release verification. Execute Linux glibc and musl,
  macOS x64, and Windows journeys on the supported platform. Cross-compilation and a Rosetta
  version smoke test do not establish native acceptance. Verify Windows permissions, links,
  replacement/recovery, Python launchers, uninstall, Git attributes, and process termination.
  Completion: exact-candidate native results. Depends on available hosts. Acceptance: K-263,
  K-298, K-299, K-72, K-273, K-280.
- **Remote CI:** owner: authored workflows. Keep local workflow validation active, including
  affected-object selection and generated customer workflows. Remote required-check behavior,
  platform execution, and timing require explicit CI reactivation. Completion: successful jobs
  for the exact candidate and agreed cadence. Acceptance: K-309, S-12.
- **Public release and website:** owner: release tooling and documentation deployment. Public
  registry ownership, stable release, signing/provenance, protected Pages environment, domain
  ownership, HTTPS cutover, and live rollback remain external gates. Local dry runs and guarded
  deployment-definition checks remain required. Completion: release-aligned public artifacts,
  schema, site, and tested rollback after authorization. Acceptance: K-164, K-280, K-302, S-19.
- **External adoption:** owner: the deferred Yap migration. Do not modify Yap or reference
  repositories during this cleanup. Resume only after candidate tests and self-lint pass and
  the migration task resumes. Re-read branch/status/worktree history before acting. The old
  bounded authorization concerns only local `chore/gspot`, based on local `master`, with the
  old tip and chosen base recorded. Changed work requires review; do not reset, clean, stash,
  pull, overwrite an existing `chore/gspot-adoption`, or discard newly discovered work.
  Use the installed candidate through the isolated registry, preserve nested Semgrep/CodeQL/
  Trivy/Bearer exceptions or document justified removal, and record results in
  `GSPOT-MIGRATION.md`. Verify no machine-local paths, credentials, or registry routing enter
  generated locks/configuration. Measure checks, manual checks, doctor, and hooks without a
  remote push. Separate app findings from product defects. Product crashes, false positives,
  lost policy, unsafe mutation, or failed recovery require repair and re-verification.
  Leave the adoption diff uncommitted; no merge precedes installable public artifacts.
  Completion: reviewed installed migration and recovery evidence after authorization.
  Dependencies: the candidate gate and external task resumption. Acceptance: T-19, T-33, K-301.

## Current cleanup evidence

Verification is in progress. The completion record below will contain actual results and
limitations from this cleanup, without carrying forward historical successful-run narratives.
