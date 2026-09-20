# Repository Accounting

Reviewed on September 20, 2026 against source revision
`7af4d7134e60e6752cf62f39df4507338fda184e`. Architecture edits are uncommitted.
This record accounts for implementation gaps and evidence; it does not certify release readiness.

## Result

The architecture contains most known defects, but its completion language was not reliable.
The build-order status table confused implementation presence with acceptance. The remaining index described
partly implemented rows as entirely unbuilt and incorrectly said Windows had never run.
Those current-status claims are corrected. Historical observations remain dated evidence.

Before this audit, the index contained 335 unchecked entries: 326 named requirements and nine
cleanup entries referring back to named owners. All 326 named IDs occur in the fix documents;
none is duplicated in the index. Architecture contains no checked-off checklist entries.
Completion claims instead appear in prose and in rows removed from the index.

Two additional requirements are recorded: K-309 for repository CI execution ownership and
frequency, and K-310 for local-registry isolation and cleanup. The index now has 337 unchecked
entries, including 328 named requirements: 267 K, 36 T, 19 S, three G, two D, and one A.
These are acceptance requirements of unequal size, not 337 independent code defects.
The nine cleanup entries overlap their named owners and must not be counted twice as work.

## Coverage and limits

The tracked inventory has 1,256 files before this audit adds this document. The principal
areas contain 438 package files, 109 preset files, 61 test files, 98 rule files, 31 prose files,
288 documentation files, 100 architecture files, and three workflows. Generated `.gspot/`
contains 97 tracked files. Other tracked files are root and tool configuration.

The review reconciles every named remaining row with the fix documents, checks phase completion
claims, and traces source at the execution, observation, lifecycle, report, and release boundaries.
It also reviews the workflow definitions and the existing local/platform evidence. Scanning a
file inventory or finding a row reference is not a line-by-line correctness proof of every file.
The older assertions that every file was read are not renewed by this audit.

No CI was started or awaited. No code, workflow, generated file or Yap file was changed.
No release, installation, destructive failure injection or website accessibility test was run.
A full dependency-security or license revalidation was not performed. Those acceptance
requirements remain with their existing owners. This audit adds no claim that all bugs are found.

## Accounting by workstream

Counts below describe the original 326 named requirements. The index remains the authoritative
list of individual IDs; grouped fix sections often close several rows.

| Fix owner                        | Named rows | Outstanding work                                                                                   |
| -------------------------------- | ---------: | -------------------------------------------------------------------------------------------------- |
| [00](fixes/00-delete-first.md)   |         22 | Remove unused commands, flags, fields, duplicate rules and baselines after replacements exist.     |
| [01](fixes/01-first-fixes.md)    |         35 | Destructive checks, shared configuration, tool invocation, serialization and false findings.       |
| [02](fixes/02-takeover.md)       |         13 | Detection, lossless carryover, path-specific formatting and task discovery.                        |
| [03](fixes/03-hooks.md)          |          6 | Existing hook control flow, task preservation, argument and stdin forwarding.                      |
| [04](fixes/04-speed.md)          |         12 | Repeated hashing/parsing, bounded reads, batching and measured performance.                        |
| [05](fixes/05-written-files.md)  |          4 | Owned output, safe removal, ignore blocks and local skip-file removal.                             |
| [06](fixes/06-config.md)         |          9 | Nested scopes, selectors, serialization and canonical configuration fields.                        |
| [07](fixes/07-levels.md)         |         21 | Level-aware templates and rules; remove house-style defaults from recommended.                     |
| [08](fixes/08-frameworks.md)     |         27 | Framework enforcement, compatible pins and isolated tool installation.                             |
| [09](fixes/09-manifests.md)      |         38 | Manifest ownership and duplicate registration/configuration tables.                                |
| [10](fixes/10-tests.md)          |         38 | Honest setup, useful assertions, actual installs, snapshots and performance tests. K-310 adds one. |
| [11](fixes/11-layouts.md)        |         11 | Scope-aware checks and nonstandard repository layouts.                                             |
| [12](fixes/12-menu.md)           |          4 | Discovery, questions and generated agent instructions.                                             |
| [13](fixes/13-words.md)          |          3 | Public vocabulary and obsolete front matter.                                                       |
| [14](fixes/14-push.md)           |          5 | Cache inputs, staged snapshots, exact push revisions and project-wide findings.                    |
| [15](fixes/15-top-level.md)      |          2 | Repository layout and owned top-level resources.                                                   |
| [16](fixes/16-output.md)         |         12 | Progress, diagnostics, doctor and truthful check coverage.                                         |
| [17](fixes/17-recommended.md)    |          3 | Developer compiler configuration and practical recommended defaults.                               |
| [18](fixes/18-one-copy.md)       |          3 | Shared cross-language analysis implementations.                                                    |
| [19](fixes/19-gitlab.md)         |          9 | Canonical CLI, GitLab and selector behavior.                                                       |
| [20](fixes/20-self-check.md)     |         17 | Templates, samples, coverage and promise verification. K-309 adds one.                             |
| [21](fixes/21-manual.md)         |          3 | Guides, README, artwork, website and user-facing recovery documentation.                           |
| [22](fixes/22-launch.md)         |          8 | Seven-target packages, native resources, release and upgrade acceptance.                           |
| [23](fixes/23-scenarios.md)      |         11 | Root pointers, Git edge cases, hook managers and CI provider scenarios.                            |
| [24](fixes/24-contracts.md)      |          5 | Confined mutation, recovery, canonical contracts, usefulness and deployment.                       |
| [25](fixes/25-simplification.md) |          5 | Safe reference generation, complete reference, filesystem paths, observations and naming.          |

## Source findings and existing owners

| Evidence in source                                                                                                                               | Consequence                                                                                                                           | Open owner                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `packages/cli/src/repository/staged.ts` substitutes empty paths after failed Git commands and excludes deletions with `ACMRT`.                   | A failed observation or last-file deletion can prevent a required check from running. Follow the paths through `run/plan.ts`.         | K-307, K-69, K-70, K-272                                 |
| `repository/tracked.ts`, `repository/tags.ts` and `run/cache.ts` still contain broad read/stat fallbacks.                                        | Denied access and disappearing content can look absent, empty or cacheable.                                                           | K-307                                                    |
| `platform/spawn.ts` infers Windows timeouts from a signal plus configured deadline.                                                              | Non-timeout termination can be misclassified; launch and stream failure handling need distinct tests.                                 | K-263, K-307                                             |
| `tests/harness/planted.ts` tolerates failed initialization when config exists and uses unchecked shell filesystem commands.                      | A fixture can pass after unsuccessful setup or fail to restore its intended state. Async `finally` handling is only a partial repair. | T-27, T-8                                                |
| `run/fixers.ts` records missing/timeout errors but does not reject every nonzero fixer status; scratch cleanup is not in `finally`.              | Failed corrections can look executed, and exceptional paths can leave scratch output.                                                 | K-42, K-300, K-308                                       |
| `lifecycle/uninstall-command.ts` infers ownership from rendered paths/headers and recursively removes `.gspot/`.                                 | Developer edits and recovery data lack the required ownership protections.                                                            | K-118, K-298, K-299                                      |
| `lifecycle/upgrade/command.ts` writes the pin before applying output and still invokes the first-run baseline flow.                              | An interrupted upgrade can leave the pin ahead of installed state.                                                                    | K-281, K-290, K-298, K-299                               |
| `run/execute.ts` writes cache results without preserving an established verdict on write failure; `run/record/write.ts` writes reports directly. | Reporting/storage failure can replace useful check output with an exception.                                                          | K-257, K-307                                             |
| `docs/reference-pages.ts` removes the reference tree, incompletely derives public contracts and publishes architecture decisions as reference.   | Authored content is at risk and generated pages can still be wrong.                                                                   | K-205, K-303, K-304                                      |
| `packages/cli/publish.ts` skips failed binary copies and advertises a five-platform package set.                                                 | Incomplete releases can proceed; musl coverage and complete input validation are missing.                                             | K-164, K-280                                             |
| `tests/harness/registry.ts` uses a predictable port, accepts a generic ping and discards process output.                                         | An unrelated server can satisfy readiness; failed startup leaks owned resources.                                                      | New K-310                                                |
| `.github/workflows/ci.yml` and `gspot.yml` repeat Ubuntu setup/checks and lack obsolete-run cancellation.                                        | Intermediate pushes repeat costly work.                                                                                               | New K-309; generated workflow safety remains K-253/K-276 |
| `bunfig.toml` has no coverage floor; release tests are opt-in.                                                                                   | A green ordinary suite does not prove coverage or packaged installation.                                                              | S-7, S-8, T-24, K-263                                    |
| `docs/public/` has a favicon and schemas, without the requested production artwork variants.                                                     | The visual brief and page/asset acceptance remain unfinished.                                                                         | G-10, K-302, documentation brief                         |

The presence of `catch`, a fallback, a wrapper or a platform branch is not itself a defect.
Keep handling for real external failures; remove behavior that hides those failures, duplicates
an owner or exists without a supported contract. K-242 already covers personal working habits
being shipped as universal rules. Renaming those habits does not make them product requirements.

## Completion and Windows evidence

The recorded full local suite for this source revision passed 499 tests, skipped three and
failed none: 1,933 assertions across 140 files, 509.83 seconds. The three skipped release cases
mean this is ordinary-suite evidence, not package acceptance. This is prior execution evidence,
not a new test run performed for the documentation audit.

The build-order record lists a full three-platform pass at `b553f9d7b8d25640da0d8dbb4c799966f2aed9ec`.
That establishes historical Windows execution. It does not validate later revisions.
At `b5770a0`, a Windows shell fixture printed a completed check and then reached the harness
120-second timeout. The output alone does not identify which process or pipe remained open.
At `4a02c87`, Windows failed the secrets self-check before the suite, a separate failure.

At `7af4d71`, the harness uses asynchronous spawning and explicit stream collection, and local
regressions cover termination, output, and fixture restoration. This does not prove the original
Windows mechanism or a repaired full Windows run. K-263 stays open. The temporary diagnostic
workflow is absent; no new observer is required to remain in the repository. Further remote
verification is deferred under the active CI bypass, not reported as green.

K-305, K-219 and K-204 have explicit revision/platform evidence in the build-order record. K-92 and K-97
also have recorded implementation and regression descriptions; those are not new open defects.
Deleted Go/Rust/Ruby
preset requirements K-168, K-170 and K-173 have a scope-removal disposition. Partial K-306,
K-307 and K-308 work correctly remains in the open index.

The gap log references 29 K IDs absent from the remaining index. The disposition table below
records each ID. Their omission does not prove 29 regressions. S-14 requires a repair and
evidence, explicit supersession, or scope deletion for each omission. Older decisions
alone cannot substantiate implementation completion. No unsupported percentage-complete claim
can be derived from the open-row count or the build-order phase labels.

## Historical requirement dispositions

The original descriptions are preserved in `architecture/18-gaps.md` at the parent of
`fb0928be7d970f451ad13854150c53041b8466da`. A removed row is not evidence of acceptance.
The table reconciles all 29 omitted K IDs. An open successor inherits the original obligation
listed here; supersession does not close that obligation or count it as another requirement.

| Historical ID | Status                | Disposition and evidence                                                                                                                                                                                                           |
| ------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K-1           | Open                  | Superseded by K-290: remove both baseline flows rather than retain their earlier consolidation.                                                                                                                                    |
| K-4           | Partially implemented | `naming/policy.ts` reads removable groups from the shipped policy after `fb0928b`. K-55 owns the remaining duplicate-data audit; acceptance is not inferred from the move.                                                         |
| K-5           | Open                  | Superseded by K-307 and K-263: timeout and process termination acceptance remains open despite the earlier batching repair at `74275c6`.                                                                                           |
| K-6           | Open                  | Superseded by K-42: a nonzero fixer status must fail visibly. The audit still finds this defect.                                                                                                                                   |
| K-7           | Open                  | Superseded by K-42 and K-298: dry-run scratch copies must link dependency directories and preserve the repository.                                                                                                                 |
| K-8           | Partially implemented | `fb0928b` moved the probe to `platform/tool-probe.ts`. K-38 owns the remaining manifest ownership work.                                                                                                                            |
| K-9           | Partially implemented | `tool-probe.test.ts` covers library discovery in root and nested scopes and reports off-pin versions. K-244 and K-307 own truthful version probes and failed observations; a package lookup alone does not accept those contracts. |
| K-10          | Open                  | Superseded by K-105: derive configuration types and diagnostics from the schema owner rather than duplicate key tables or depend on private schema internals.                                                                      |
| K-11          | Partially implemented | `policy/merge.ts` resolves limits by exact setting keys. K-105 owns schema and setting consistency acceptance.                                                                                                                     |
| K-12          | Open                  | Superseded by K-284 and K-300: removal must change the effective selection or explain the dependency that prevents it.                                                                                                             |
| K-15          | Open                  | Superseded by K-193 and K-307: preserve path-specific policy and report parse failures.                                                                                                                                            |
| K-16          | Open                  | Superseded by K-118 and K-299: remove only owned dependency, task, and hook changes while preserving recovery.                                                                                                                     |
| K-19          | Open                  | Superseded by K-65: generated agent instructions must reflect the selected checks and omit check instructions for a rules-only installation.                                                                                       |
| K-20          | Partially implemented | `rules/assemble.ts` reads exclusions. K-179 owns selection and exclusion acceptance for shipped rule files.                                                                                                                        |
| K-22          | Open                  | Superseded by K-64: grouped preset questions must control the accepted selection.                                                                                                                                                  |
| K-23          | Open                  | Superseded by K-87 and T-23: syntax-based shell references and independent analysis regressions remain required.                                                                                                                   |
| K-26          | Open                  | Superseded by K-149 and T-28: tracked dependency directories must remain visible to the integrity check and have a planted defect.                                                                                                 |
| K-29          | Open                  | Superseded by S-3, S-7, and K-263: meaningful coverage and compiled-binary execution must pass, including explicitly enabled release cases.                                                                                        |
| K-30          | Open                  | Superseded by K-304 and G-10: complete public command references and README examples, excluding internal commands.                                                                                                                 |
| K-33          | Open                  | Superseded by K-304: document implemented environment variables and reject unsupported reference claims.                                                                                                                           |
| K-35          | Open                  | Superseded by K-211 and K-248: verify Ansible, GitHub Actions rule selection, and Swift test enforcement against retained preset ledgers.                                                                                          |
| K-92          | Complete              | The build-order record lists removal of delegation preferences from generated blocks and regressions with and without checks. The repository preference remains outside managed blocks.                                            |
| K-97          | Complete              | The build-order record lists deletion and rejection of the unused project-template flags, with completion, type, and reference checks.                                                                                             |
| K-168         | Complete              | Scope removed with the Go preset at `fbfb142`. Do not restore the deleted preset.                                                                                                                                                  |
| K-170         | Complete              | Scope removed with the Rust preset at `fbfb142`. Do not restore the deleted preset.                                                                                                                                                |
| K-173         | Complete              | Scope removed with the Ruby preset at `fbfb142`. Do not restore the deleted preset.                                                                                                                                                |
| K-204         | Complete              | The build-order record lists the bounded Linux/macOS CI repair at `faf350fa49cf87bcc5f8278954db06788bd00305`. K-263 retains Windows acceptance.                                                                                    |
| K-219         | Complete              | The build-order record lists source-header regressions at `b553f9d7b8d25640da0d8dbb4c799966f2aed9ec`; platform limits remain explicit there.                                                                                       |
| K-305         | Complete              | The build-order record lists all six script argument tests on three platforms at `7464e27cb6a5ffb64e62311702421926b39bb687`. Package acceptance remains open.                                                                      |

These historical completions apply only to their stated scope and revision. They do not accept
the current candidate. The remaining index links all 328 named IDs to exact acceptance sections.
No product requirement closes in this accounting change. The unread rule-file review remains
open, as do implementation, candidate validation, and Yap adoption.

## CI bypass and developer workflow

CI executes in GitHub Actions on GitHub-hosted Linux, macOS and Windows runners, as declared
in `.github/workflows/ci.yml`. The separate generated gspot workflow also runs on GitHub.
No separate CI service or local observation tool is required by the current setup.

`[skip ci]` is an [official GitHub feature](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).
It is a legitimate temporary override. This audit provides no evidence that most developers skip
every commit, and it is not a good permanent substitute for a deliberate verification schedule.
It skips push/pull-request workflows, does not cancel running jobs, and does not suppress every
other event type. Skipped required checks can remain pending and block merging.

The current workflows use push/pull-request triggers, including tag pushes for release.
Keep public publication forbidden. Do not add dispatches, tags, or new trigger paths to evade
the user's pause. Retain the active architecture instruction to include the marker in every
gspot commit until the user explicitly re-enables CI.

K-309 defines the later workflow repair: eliminate duplicate checks, cancel superseded runs,
and agree when full platform/package verification is required. GitHub supports
[workflow concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)
for this purpose. No workflow is changed by this audit.

## Next implementation and deferred gates

Keep the original dependency order: truthful observations and safe ownership before lifecycle
expansion; canonical schemas before caller migrations; useful recommended findings before
snapshot acceptance. Integrate registry isolation before trusting local-package results.
Implement the remaining fix-file requirements without waiting for CI during the active bypass.

Do not treat this audit, ordinary local tests or a skipped workflow as the packaged-candidate
gate. Yap, package hashes, exact candidate acceptance, visual/accessibility review and adoption
evidence remain outstanding. Public publication, production deployment, DNS, and live rollback
remain external gates. Generated documentation must later be rebuilt through its owner; this
architecture-only change deliberately does not rewrite the generated decision reference.

## Initial audit validation

The updated index has 328 unique named IDs, each referenced in a fix document. The workstream
counts sum to the original 326, with two added requirements. Relative Markdown file links across
architecture resolve, and the complete tracked diff passes `git diff --check`. Only architecture
files differ. These checks validate the accounting documents, not the product acceptance gates.

## Implementation reconciliation

The implementation checkout started on `main` at
`7af4d7134e60e6752cf62f39df4507338fda184e`, with the architecture edits intact.
All 328 named rows have one linked acceptance owner. The nine cleanup entries overlap those
owners. All 29 historical omissions have a disposition above, and relative architecture file
links resolve. These are locally verified accounting results, not product acceptance.

The direct reference check passed after the existing generator ran in a disposable directory.
Only its changed decision page returned to the worktree. The normal staged gate reproduced a
cached reference failure, while the uncached gate passed 50 checks. The commit hook reproduced
the same stale failure, so K-69 became a prerequisite for committing the accounting change.

Revision `7ec8f29` prevents repository checks without declared cache inputs from reusing
verdicts. The new planted regression fails before that repair and passes after it.

Both tests in `tests/acceptance/cli/checks.test.ts` pass, as does
`bunx tsc --noEmit -p tsconfig.json`. The staged gate passes 63 checks, and the push hook passes
136 checks. The revision is pushed to `main` with `[skip ci]`. Explicit cache inputs remain
open under K-69. Platform verification is deferred under the CI bypass.

The rule review read 27 retained guides beyond the historical named review list:

- The five general prose guides other than review and surfaces, whose managed copies match
  their source bytes.
- Bash, CSS, HTML, SQL, and YAML language guides.
- All three Bash detail guides and the Bash and SQL naming guides.
- All four Python detail guides.
- All eight documentation templates.

The historical count of 33 unread files does not identify individual paths and predates preset
and template deletions. This named review records its coverage without inferring complete
product enforcement from a file count. The following concrete defects remain open:

| Evidence                                                                                                                    | Owner        | Required correction                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| The retry example in `rules/language/bash/OPERATIONS.md` returns 0 for `retry_retryable trial 1 0 false` and logs `exit=0`. | K-261        | Capture the failed command status inside the conditional branch and preserve it after exhausted retries. |
| The sentinel example in `rules/language/bash/LANGUAGE.md` returns 0 when its producer is `false`.                           | K-261        | Preserve the producer status while retaining trailing newlines.                                          |
| The port example in that guide accepts `08`, emits an arithmetic error, and exits 0 on system Bash.                         | K-261        | Parse and bound decimal input before arithmetic evaluation.                                              |
| `_trim_history_messages` in `rules/language/python/DESIGN.md` returns both supplied messages for a limit of zero.           | K-261        | Define and verify zero and negative limit behavior.                                                      |
| The SQL naming guide labels `users_can_view_own_order_items` as a good policy but uses `USING (true)`.                      | K-261        | Make the example enforce its stated ownership boundary.                                                  |
| The Bash safety guide validates deletion only with the suffix `*/build`.                                                    | K-241, K-261 | Match its stated owner-root restriction and demonstrate rejection outside that root.                     |
| The Python typing guide shows a suppression without a reason.                                                               | K-241, K-261 | Match the suppression contract in the agent guide.                                                       |
| The CSS, SQL, YAML, and Python packaging guides impose layout and style preferences without levels.                         | K-230, K-301 | Separate demonstrated defects from preferences when rendering recommended rules.                         |

The Bash and Python trials used isolated snippets with no network, installation, or destructive
operation. Rule-source repairs and example enforcement remain in their implementation owners.
Yap is unchanged. Candidate artifacts and adoption acceptance do not exist for this work.

## Verified deletions after reconciliation

K-104 and K-129 are complete: the unused fields, manifest conflict behavior, and serialized
repository root are removed. Selection and report-contract tests pass, and TypeScript,
reference verification, and Knip complete locally. Knip reports configuration hints but no
unused-code findings. Together with the earlier K-195 deletion, these closures leave 325
named requirements open. The original 328-row review remains historical evidence.

K-99 is also complete after root and scoped schema rejection tests and a CLI no-write
regression. The index contains 324 open named requirements. K-100 remains partial: its three
unused settings are removed, but the retained-setting reader audit is still open.

K-116 is complete after a real repository command produced mapped, nested JSON findings.
The shared output schema, parser regressions, and generated schema checks pass locally
(23 tests, 123 assertions). The index contains 323 open named requirements.

K-61 and S-10 are complete. Rule lint and its unit tests share the existing rules
folders, and imports use `#cli/rules/*`. The duplicate Vale subprocess implementation
and configuration are deleted. Nine rule tests, all 98 corpus files, and the document
acceptance suite pass. TypeScript and all 272 reference pages also pass locally.
The index contains 321 open named requirements.

K-258 is complete locally: individual file arguments retain their position after other
placeholders expand. Docker Compose accepts an absent environment file and rejects an
invalid service key. The 22 focused regressions pass with 258 assertions on macOS.
The index contains 320 open named requirements; Windows execution remains deferred.
