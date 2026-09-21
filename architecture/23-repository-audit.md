# Repository Accounting

Historical review at source revision `7af4d7134e60e6752cf62f39df4507338fda184e` on
September 20, 2026. This record preserves useful failure and platform evidence; it does not
certify the current worktree or a release candidate. Current dispositions belong to
[remaining work](22-remaining.md). Repeated inventories, phase summaries, and code snapshots
are retired because they became stale while the owning fixes changed.

## Completion and Windows evidence

The recorded full local suite for this source revision passed 499 tests, skipped three and
failed none: 1,933 assertions across 140 files, 509.83 seconds. The three skipped release cases
mean this is ordinary-suite evidence, not package acceptance. This is prior execution evidence,
not a new test run performed for the documentation audit.

The historical review recorded a full three-platform pass at `b553f9d7b8d25640da0d8dbb4c799966f2aed9ec`.
That establishes historical Windows execution. It does not validate later revisions.
At `b5770a0`, a Windows shell test repository printed a completed check and then reached the harness
120-second timeout. The output alone does not identify which process or pipe remained open.
At `4a02c87`, Windows failed the secrets self-check before the suite, a separate failure.

At `7af4d71`, the harness uses asynchronous spawning and explicit stream collection, and local
regressions cover termination, output, and test repository restoration. This does not prove the original
Windows mechanism or a repaired full Windows run. K-263 stays open. The temporary diagnostic
workflow is absent; no new observer is required to remain in the repository. Further remote
verification is deferred under the active CI bypass, not reported as green.

K-305, K-219 and K-204 have explicit revision/platform evidence in this historical record. K-92 and K-97
also have recorded implementation and regression descriptions; those are not new open defects.
Deleted Go/Rust/Ruby
preset requirements K-168, K-170 and K-173 have a scope-removal disposition. K-306 source conversion is resolved locally; remaining native-platform acceptance belongs to K-263.
K-307 and K-308 retain their own open scope.

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
| K-92          | Complete              | The historical review recorded removal of delegation preferences from generated blocks and regressions with and without checks. The repository preference remains outside managed blocks.                                          |
| K-97          | Complete              | The historical review recorded deletion and rejection of the unused project-template flags, with completion, type, and reference checks.                                                                                           |
| K-168         | Complete              | Scope removed with the Go preset at `fbfb142`. Do not restore the deleted preset.                                                                                                                                                  |
| K-170         | Complete              | Scope removed with the Rust preset at `fbfb142`. Do not restore the deleted preset.                                                                                                                                                |
| K-173         | Complete              | Scope removed with the Ruby preset at `fbfb142`. Do not restore the deleted preset.                                                                                                                                                |
| K-204         | Complete              | The historical review recorded the bounded Linux/macOS CI repair at `faf350fa49cf87bcc5f8278954db06788bd00305`. K-263 retains Windows acceptance.                                                                                  |
| K-219         | Complete              | The historical review recorded source-header regressions at `b553f9d7b8d25640da0d8dbb4c799966f2aed9ec`; platform limits remain explicit there.                                                                                     |
| K-305         | Complete              | The historical review recorded all six script argument tests on three platforms at `7464e27cb6a5ffb64e62311702421926b39bb687`. Package acceptance remains open.                                                                    |

These historical completions apply only to their stated scope and revision. They do not accept
the current candidate. The remaining index links all 328 named IDs to exact acceptance sections.
No product requirement closes in this accounting change. The unread rule-file review remains
open, as do implementation, candidate validation, and Yap adoption.

Historical successful executions:

- [Three-platform run at b553f9d](https://github.com/stefanionescu/gspot/actions/runs/35498214484).
- [Script-argument validation at 7464e27](https://github.com/stefanionescu/gspot/actions/runs/35501385005).
- [Linux/macOS repair at faf350f](https://github.com/stefanionescu/gspot/actions/runs/35487384035).

## Implementation reconciliation

The implementation checkout started on `main` at
`7af4d7134e60e6752cf62f39df4507338fda184e`, with the architecture edits intact.
The historical accounting matched the then-current index to its fix owners. Those counts
are not current completion measures. The remaining-work index owns present status.

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
