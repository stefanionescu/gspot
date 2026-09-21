# Scripts, Names, and Failure Handling

This review supplements existing fixes instead of creating a second cleanup plan. K-205 already
removes tracked reference output; K-164 already rejects incomplete releases. The changes below
close concrete gaps in those plans. They do not authorize deleting implementation files before
replacement behavior and its acceptance checks exist.

## K-303: The reference generator deletes more than it owns

**Resolved locally.** The generator renders and formats before mutation, refuses authored
collisions, stages replacement bytes, and prunes only obsolete marked pages. It rejects unsafe
paths and linked output ancestry. Generated pages are ignored and built on demand under K-205.
The forwarding-only `quote` helper and public decision-log mirror are absent.

[Retained reference tests](../../tests/integration/reference-pages.test.ts) exercise unchanged
output, authored sentinels, marker quotations, collisions, formatting and write failures,
unsafe paths, and symlink confinement. Script-argument tests reject malformed calls before writes.
Reference completeness remains separate under K-304; this resolution does not accept the site.

## K-304: Generated reference pages are not automatically correct

**What is wrong.** `commandPage()` reads only top-level commands and local options. `settingsPage()` reads manifest settings, keeps the first repeated name, and hard-codes old command and reason prose. `decisionsPage()` publishes the entire architecture decision log and rewrites links to the default branch. Generation does not prove completeness or release accuracy.

**Target.** Generate the public reference from the same validated command, schema, and manifest definitions as the CLI. Keep design history in architecture, linked rather than copied into the public reference.

**Files.** `docs/reference-pages.ts`, `docs/astro.config.ts`, command registration, setting definitions, and reference tests. Amend S-14 rather than adding `architecture/presets.ts`.

**Logic.** Traverse supported command nesting, include inherited global options, and omit hook-only internals. Include global settings as well as manifest settings. Repeated settings either have identical definitions with all owners listed or produce a conflict; never silently select the first. Derive public usage from the actual command contract.

Delete the decision-log mirror and its URL-rewrite regexes; keep a clearly labeled link to architecture at the matching source revision. Do not add a second generator that rewrites target architecture tables from today's implementation.

**What goes.** `decisionsPage`, its copied public page and sidebar entry, hard-coded stale usage claims, first-wins conflicting settings, and the proposed second architecture generator.

**Tests.** Every public command and global option appears once in the correct context. Global config fields are represented. Conflicting duplicate settings fail generation. A released site contains no target-only architecture prose presented as implemented behavior.

**Done when.** Generated reference content matches the released public contract, and architecture remains the owner of design decisions.

## K-306: File URLs are used as filesystem paths

**Source conversion resolved locally.** Filesystem consumers use `fileURLToPath`; URL route
paths remain URLs. The September 20 encoded-checkout run used `workspace % café` and passed
schema/reference validation, both package builds, and source asset lookup. Retained asset and
plugin tests exercise encoded file URLs. No decoding wrapper is needed.

Native Windows execution of the complete current candidate remains with
[K-263](22-launch.md#k-263-windows-and-packaged-platform-acceptance-remain-incomplete), rather than a second actionable file-URL defect.
Historical encoded-asset evidence does not establish native Windows lifecycle acceptance.

## K-307: Failure-to-empty helpers hide incomplete checks

Version probes preserve command failure instead of parsing a printed version from a failed
process. Unparsable versions are errors, and an installed npm package cannot hide a failed
executable. Check, correction, and doctor consumers report that state. Local regressions
exercise both output streams, nonzero exits, unknown output, package metadata, and unchanged
source bytes after a refused correction. Manifest-owned `version_exit_code` declares a tool's
expected probe status when its documented help command uses a nonzero status.

Probe results belong to the command session and distinguish complete pins and library search scopes.
A new session observes the tools again; a timeout takes precedence over printed shim text.

**Partial implementation.** The manifest-policy reader validates the fields it consumes and reports read or parse failures with the manifest path. Tests cover invalid JSON and invalid field shapes, denied reads, and repositories without package manifests. File listing and root discovery distinguish a confirmed non-Git directory from failed Git observation. Tests cover a corrupt index, incomplete Git metadata, a missing executable, and non-Git ignore handling.

Formatter questions reuse the parsed takeover observation instead of performing a second read that hides errors. Full per-path formatter resolution remains open.

Required input hashes and the suppression census propagate failed reads. Inline suppression
reads and tool baseline hashes permit missing files but propagate other I/O failures. Local
regressions cover unreadable sources with and without caching, preserved prior reports,
and absent versus unreadable optional inputs. Template alias readers permit missing optional
files but report unreadable or malformed package and TypeScript configuration. Valid comments
and trailing commas in TypeScript configuration remain accepted. Other observation paths
remain open.

Generation, takeover, and compiler project selection now share installed TypeScript compiler
resolution, including nested package inheritance. Generated bases are available during rendering
before application writes them. Missing arbitrary bases and invalid configurations still fail.
Retain these behavior regressions; do not restore the handwritten inheritance resolver.
Other observation paths remain subject to the cleanup backlog in 22-remaining.md.

Project detection and manifest policy share a validated package reader. Detection reports
failed reads, malformed package JSON or Python TOML, and invalid consumed fields instead of
dropping a manifest. Python workspace discovery reuses those parsed facts. npm workspace
resolution uses root-local tool resolvers, propagates errors, and works without a lockfile.
Real workspace tests cover package arrays and objects, pnpm, Lerna, Rush, malformed inputs,
and isolation from ancestor workspaces. Remaining readers still require review.

Required content reads report failures, and metadata reads permit absence only for missing
paths. Header and content classification share a bounded prefix reader that closes its file
descriptor after failed reads. Classification preserves dangling tracked symlinks without
reading their absent targets. The current device/inode root regression is retained from the
existing implementation rather than replaced with the stale parked assertion.

The affected repository, doctor, emission, and uninstall suites pass locally (26 tests,
88 assertions). Staged deletion triggers now have separate planner and execution regressions.
Environment-file and tracked-dependency checks use a shared index reader. It preserves
tracked deletions and literal path characters, permits an absent Git repository, and reports
failed index reads. Real corrupt-index tests produce error verdicts for both checks.

Attribute rules are captured per repository observation. An unreadable `.gitattributes`
reports its error, and a later session sees edited attributes without a reset hook.

Swift builds retain their exit status even when the command prints no diagnostic. Analysis
refuses failed build logs and reports an unsuccessful or timed-out analyzer as an error.
Focused tests exercise those verdicts at the subprocess boundary. Incremental builds and
native platform acceptance remain open under K-143.

Cached check results are validated with the report schema. An absent entry permits a fresh
run; malformed JSON, invalid result fields, and denied reads report the cache path and
preserve the prior report. Three cache observation regressions cover these failures.

Hook discovery, task validation, and hook removal share one Git configuration reader.
It preserves value whitespace and distinguishes an unset key from a failed command.
A real-repository regression discovers a configured dispatcher and then rejects malformed
Git configuration instead of reporting no hooks.

Other Git observations and takeover parsing remain open. Windows execution remains platform verification deferred.

Staged and changed-file readers retain deleted paths and both rename paths. Failed diffs and
merge-base observations raise errors instead of returning an empty selection. Project plans
keep absent change triggers separately from readable files, including an emptied scope.
Per-file commands do not receive those absent paths. Corrections track recreated files in
both previews and real runs.

Push-base observation reads upstream configuration separately
from its merge base: a missing upstream object, failed command, unborn HEAD, or corrupt HEAD
raises an error. Seven real-repository tests pass (42 assertions). Immutable revision
selection and first-push range semantics remain open under K-272 and K-293.

Process launch failures distinguish `ENOENT` from permission errors. Both captured streams
and child status are preserved through completion. Local real-process regressions cover the
Bun and cross-spawn backends. These repairs do not close failed Git observations or takeover
read errors, and native Windows verification remains deferred under K-263.

Documentation task discovery treats absent optional manifests as empty, but propagates
malformed TOML, malformed JSON, and other read errors with their configuration path.
Real-file regressions cover both parsers and a directory where a manifest belongs.

Init refuses all mutation when takeover reports unread configuration, including generated
root pointers that otherwise overwrite retained originals. Its preview still shows the
proposal. A real init regression verifies unchanged repository bytes and modes.

Takeover reads each input once and passes its parsed table to carry readers. JSONC
errors are collected and reported; malformed JSONC is never accepted as a partial table.
Executable configurations and ESLint configurations remain explicit unsupported input until
the tool-specific resolver lands. Init preserves these files and refuses application.
The duplicate suffix preflight and failure-to-empty carry parsers are removed.
Formatting takeover and the remaining Git observations are still open.

**What is wrong.** `platform/spawn.ts` maps every failed Git command to `undefined`; `repository/tracked.ts` then falls back to a non-Git walk. `entryFor()` drops a path after any stat failure, and `head()` returns empty text after any read failure. `checks/dependencies/manifest-policy.ts` treats unreadable or malformed package JSON as absent. The takeover readers also catch read and parse errors, while a separate preflight reparses only selected suffixes.

**Target.** Keep real boundary validation, but do not turn failed observation into valid empty input or a clean verdict.

**Files.** `platform/spawn.ts`, `repository/tracked.ts`, `checks/dependencies/manifest-policy.ts`, `lifecycle/carry.ts`, `lifecycle/unreadable.ts`, and their callers.

**Logic.** Use the existing structured process result to distinguish no Git repository from a failed Git operation. Fall back to a directory walk only after the no-Git case is established. Report permission, corruption, parse, and unexpected I/O errors with their path or command.

Treat `ENOENT` as optional only where the caller's contract permits absence. A tracked deletion remains a change trigger, not an unreadable source to hide. Make one takeover reader return parsed content or its error; retain unsupported formats explicitly instead of a second suffix-based preflight.

**What goes.** Lossy Git-output convenience handling at callers that require failure status, catch-all empty strings/undefined in required reads, and duplicated takeover read/parse ownership.

**Tests.** No-Git folders still work. A failed Git listing inside a repository does not silently walk a different file set. Unreadable or malformed package JSON reports a failure. Takeover keeps originals after read errors. Missing optional files and deleted tracked paths retain their documented behavior.

**Done when.** A reader can distinguish absent, unsupported, and failed inputs, and none produces a false clean verdict.

## K-308: The naming specification contradicts its own examples

**Partial implementation.** Prompt actions use `askConfirmation` and `askRuleFiles`. The confirmation default is `defaultAnswer`, and prompt helpers use `useDefaults` for the behavior selected by `--yes`. Boundary tests cover both defaults, terminal refusal, explicit answers, and cancellation.

The shared ESLint preset disables the type-based Boolean naming heuristic because Boolean types do not identify predicates. The naming guide distinguishes actions from stored answers and predicates. Definition and reference schemas remain open.

Fixer outcomes follow the canonical `FixResult` and `FixReport` contract. The K-42 implementation record holds local execution and cleanup evidence; broader command batching remains open.

Manifest advice and repository advice use `help`. Both correction definitions use
`fix_command` and `fix_order`; the old `fix` fields are rejected. Repository validation and
the published JSON schema require ordering when a correction command is present. The
planner preserves the declared ordering and advice, and execution resolves the correction
executable independently from the check executable. Identity and coverage migrations remain open.

**Local verification, September 20, 2026.** The affected policy, preset, run, and output suites
pass (111 tests, 529 assertions), as do the two planted repository-check tests. Type checking,
published-schema validation, and all 272 reference-page comparisons pass. Windows execution
remains deferred.

Preset definitions use `name` throughout their schema, manifests, selection, detection, and
generated-output consumers. Preset listing rows use `name`, while takeover-plan rows refer
to a `preset`. The old manifest `id` field is rejected. The affected unit and planted init,
profile, and explanation suites pass (85 tests, 306 assertions), together with type checking
and all 272 reference-page comparisons.

Check definitions use `name`; planned checks, results, listings, and path explanations
refer to checks through `check`. Repository configuration and report schemas reject the
removed `id` fields. SARIF retains its external `ruleId` contract. Cache keys include a
format version so records from the removed result contract cannot be reused. Parameter
vocabulary and coverage naming remain open.

**Local verification, September 20, 2026.** Identity migration passes 113 affected unit tests
with 541 assertions and six planted repository-check and explanation tests with 27 assertions.
Type checking, schema validation, and all 272 reference-page comparisons pass. Windows
execution remains deferred.

Runner configuration uses `runner.tool`. Task generation lives in `emit/runner-tasks.ts`,
and the runner type is derived from the normalized configuration. Runner choices,
installation ownership, and selected-settings vocabulary remain open. The affected policy,
emitter, doctor, output, planted init, and profile suites pass (66 tests, 231 assertions).
Type checking, schema validation, and reference verification pass locally.

Configuration, manifests, check definitions, and reports use `coverage`. A manifest table
declares required check kinds by extension; each check lists the kinds it supplies. This
field describes check coverage. Test coverage remains a separate metric. Strict enforcement
and accurate coverage accounting remain open under their feature owners. Local verification
passes 116 affected unit tests (557 assertions), seven planted profile and repository-check
tests (40 assertions), TypeScript, schema validation, and all reference pages.

Check execution produces a `RunReport` and writes `.gspot/report.json` and
`.gspot/report.sarif`. The runtime report schema validates reports; producers, consumers,
generated ignore entries, and workflow artifact paths use these names. GitLab output and
report isolation remain open.

Message-stage runs preserve earlier reports. Cache and report
write errors retain findings and exit status, with a storage diagnostic on stderr under K-257.
The affected unit and script-argument suites pass (68 tests, 589 assertions), followed by
the strengthened serialization regression (two tests, 18 assertions). Seven planted profile
and repository-check tests pass (40 assertions), as do TypeScript, schema validation, and
reference verification.

**What is wrong.** The names guide endorsed a writing action called `didWrite` while rejecting
`didRunFixer`. It prescribed `name` for a finding's check reference, although ignores and
findings use `check`. The glossary retained runner surface, inspection, and project templates.
Repository checks used `fix` for executable correction while manifests used it for advice.
Several CLI examples still used `<id>` and `<key>`.

**Target.** [19-names.md](../19-names.md) owns the exact vocabulary. Names distinguish definitions
from references, objects from name strings, actions from predicates, and advice from execution.

**Files.** Check, finding, manifest, config, and report types and schemas; command registration;
`run/fixers.ts`; `lifecycle/questions.ts`; `output/prompts.ts`; manifest files; the coverage
planner; generated references; and terminology contract tests.

**Logic.** Definitions use `name`; finding, result, and ignore references use `check`.
Parameters use `checkName` for the string, `check` for a definition, and `plannedCheck`
for an execution plan. Apply the corresponding preset, setting, scope, and path mappings.

Use `help` for advice and `fix_command` with `fix_order` for executable correction in both
preset and repository checks. Use `runFixer`, `askRuleFiles`, and `askConfirmation` for
actions. Keep predicates such as `isFixable` and `canAsk`. Rename manifest `[inspections]`
and check `inspection` to their specified `coverage` forms.

Follow the action/result and root/path contracts without adding alias fields or wrapper exports.
Before release, update all callers together; after release, configuration migrations follow D-159.

**What goes.** Predicate-shaped action names, generic identity aliases, the prose `fix` field,
the repository command `fix` alias, and stale glossary entries. Remove blanket word bans that
reject real map keys, Git IDs, third-party fields, or historical evidence.

**Tests.** Verify representative definition/reference serialization, parameter roles, and
manifest/repository fixer schemas. Exercise prompt defaults and cancellation after renaming.
Assert that a fixer failure is not reported as unchanged or changed. Compare command help and
generated docs with the vocabulary. Scan target examples for old spellings while excluding
explicit before/after evidence and mandated external fields.

**Done when.** The schema, types, action names, help, reference output, and architecture examples
agree without forcing different concepts to share one ambiguous name.

## What stays

Build and publish entry points have real consumers in CI and release workflows. The schema
generator publishes schemas that editors and report consumers need. The reference generator
keeps volatile public facts aligned with the CLI. None becomes unnecessary merely because it is
a script.

Keep validation of external data, command failures, permissions, and missing optional inputs.
Keep format-aware serialization and helpers that own actual grammar or lifecycle behavior.
Do not delete every `catch`, optional value, short function, or `safeParse` call by spelling.
A proposed deletion must identify the current caller and the owner that takes over its work.

## September 20 verification details

The original `repository/staged.ts` audit found failures converted to empty path sets and
`--diff-filter=ACMRT` excluding deletions. The staged, changed, and push-base readers now
propagate command failures. Planner regressions preserve last-file deletions and both rename
ends as triggers without passing absent paths to per-file commands. K-307 remains open for
other failed observations and takeover parsing.

K-263 and K-307 also cover the subprocess boundary in `platform/spawn.ts`. Windows currently
infers a timeout from any signal when a deadline was configured. Its error handler settles
before stream closure, and the blocking result can expose null streams on launch failure.
The Bun timer is cleared only after successful stream/exit completion. Verify non-timeout
signals, launch errors, stream failure, and child/pipe termination independently. Preserve
both streams and classify missing executables separately from denied execution.

The async harness change at `7af4d71` is partial evidence, not an established explanation of
the Windows timeout. Do not retain a permanent diagnostic workflow or add unconditional exits,
longer deadlines, or blind retries. Use bounded reproductions and keep only the lifecycle repair
and useful regression tests once the mechanism is established.
