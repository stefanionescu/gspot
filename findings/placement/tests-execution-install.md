# Tests: execution, install, apply, ownership

401 rows. keep 148, delete 121, move 88, inline 16, merge 15, split 13.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/execution/check-input.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/built-in.test.ts`. Tests checkInput and runBuiltInCheck, which go to execution/built-in.ts (ARC layout), so the test follows the source path; its data goes to tests/config/execution.ts
- $language naming and structure read corrected source in a reused session (test (test.each), 14-39): **keep** to `tests/unit/cli/execution/built-in.test.ts` `$language built-in checks read source edited between two runs of one session`. real; TCO-012 drops the read-only file assertions (line 29); glossary retires correction (the SQL case is deleted as a duplicate, TEL-033)
- SOURCE_CORRECTIONS (test (test.each), 14-14): **keep** to `tests/unit/cli/execution/built-in.test.ts` `SOURCE_EDITS`. the rows come from tests/config/execution.ts (SOURCE_EDITS); glossary retires correction
- check inputs expose selected files and reserve the repository inventory for once-only checks (test (test), 41-99): **keep** to `tests/unit/cli/execution/built-in.test.ts` `a built-in check sees its scope's files, and a once-per-repository check also sees every file`. real; TTC-032 title; the sample writes \[\[scope\]\] records with path and dotted keys, and a path written in a scope is relative to the repository root (CFR-003)
- built-in checks read edited SQL source when a session is reused (test (test.skipIf), 102-132): **delete**. duplicate (TEL-033): repeats the reused-session test of row 3 ($language built-in checks read source edited between two runs of one session); the SQL checks and the newline file name add no behavior
- !isPosix (test (test.skipIf), 102-102): **delete**. TEL-033: the newline file name and its Windows gate go

## `tests/cli/execution/command/batches.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/command/batches.test.ts`. fileBatches goes to execution/command/batches.ts (EXG and ARC layout); TEL-009 merge into arguments.test.ts replaced by the source-path rule
- file batches (describe (describe), 5-15): **delete**. TEL-026, TTC-039: a describe around one test
- file batches &gt; a list that fits is one batch, and a long list splits under the budget in order (test (test), 6-14): **delete**. duplicate (TEL-026): the Unix batches test of row 12 also splits 5,000 paths in order under the byte limit
- Windows batches reserve quoted paths and the resolved executable (test (test), 17-31): **keep** to `tests/unit/cli/execution/command/batches.test.ts` `Windows batches leave room for quoted paths and the full executable path`. real
- Unix batches count Unicode bytes and reject an argument that cannot fit (test (test), 33-44): **keep** to `tests/unit/cli/execution/command/batches.test.ts` `a long Unicode list splits under the byte limit in order, and arguments that cannot fit are refused`. TEL-026 (the first Linux batch test is deleted as a duplicate)

## `tests/cli/execution/command/expansion.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/command/placeholders.test.ts; tests/unit/cli/execution/command/check.test.ts`. commandToolFiles and substitute go to command/placeholders.ts, runCheckCommand to command/check.ts (EXG and ARC layout); TEL-009
- nested tool file inputs stop at the declared scope and reject ancestors linked outside the repository (test (test), 12-45): **keep** to `tests/unit/cli/execution/command/placeholders.test.ts` `tool file inputs of a nested scope stop at the scope folder and follow a link inside the repository`. real; TEL-019: the outside-link half (lines 31-36) goes, since the safe-folder tests own that guard; the sample writes \[\[scope\]\] records with path and dotted keys, and a path written in a scope is relative to the repository root (CFR-003)
- workspace expansion retains arguments only for a package scope: $scope (test (test.each), 47-70): **keep** to `tests/unit/cli/execution/command/placeholders.test.ts` `workspace expansion retains arguments only for a package scope: $scope`. real; workspace here is the npm workspace (glossary)
- \[ { scope: '', expected: \[\] }, { scope: 'package', expected: \['--workspace', 'package'\] }, { scope: 'source' (test (test.each), 47-51): **keep** to `tests/unit/cli/execution/command/placeholders.test.ts` `[{ scope: '', expected: [] }, { scope: 'package', ... }, { scope: 'source', ... }]`. table of the kept test. Values to config: WORKSPACE_SCOPE_CASES = the three { scope, expected } rows -&gt; tests/config/execution.ts
- command execution reads linked authored tool files and preserves strict tool-file reads (test (test), 72-96): **move** to `tests/unit/cli/execution/command/check.test.ts` `a check command runs with a tool file that is a link inside the repository`. real; TEL-019: the strict-read half (lines 92-94) goes; glossary retires authored

## `tests/cli/execution/command/failures.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/execution/command/output.test.ts`. toolOutputDetail and hasToolError go to command/output.ts (EXG layout); TEL-009 output.test.ts
- bounded failure output retains the final diagnostic from both streams (test (test), 7-23): **keep** to `tests/unit/cli/execution/command/output.test.ts` `bounded failure output retains the final diagnostic from both streams`. real
- hasToolError (describe (describe), 25-37): **delete**. TTC-039: describe wrapper with nothing to add
- hasToolError &gt; a tool's crash pattern detects crashes for every check that runs it (test (test), 26-30): **keep** to `tests/unit/cli/execution/command/output.test.ts` `a tool's crash pattern detects crashes for every check that runs it`. real
- hasToolError &gt; a check's own pattern comes before the tool's (test (test), 32-36): **keep** to `tests/unit/cli/execution/command/output.test.ts` `a check's own pattern comes before the tool's`. real

## `tests/cli/execution/command/findings.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/command/output.test.ts; tests/unit/cli/checks/infrastructure/github-actions.test.ts`. checkedFindings goes to command/output.ts; the pinact test goes to its check (CKO-005 and NMU-009 group infrastructure)
- located output rejects false paths and empty failures while retaining mixed real findings (test (test), 21-42): **keep** to `tests/unit/cli/execution/command/output.test.ts` `located output rejects false paths and empty failures while keeping mixed real findings`. real; TCO-012 drops line 41; TEL-060 comment why a manifest is set
- '${check.name} accepts a fileless result without classifying it as a crash' (test (test), 45-49): **keep** to `tests/unit/cli/execution/command/output.test.ts` `${check.name} accepts a fileless result without classifying it as a crash`. TEL-060: written as test.each(FILELESS_CHECKS)
- pin verification treats a rate limit as an execution error and accepts a completed read (test (test), 51-86): **move** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `pinact reports a rate limit as an error and a finished read as findings`. TCO-012 drops line 85; it tests the pinact check of infrastructure/github-actions.ts
- spelling distinguishes native findings from fatal exits (test (test), 88-122): **keep** to `tests/unit/cli/execution/command/output.test.ts` `spelling tells typos findings from fatal exits`. real; TTC-032 drops native; TEL-060 shares the typos report; no spelling check source exists, so it stays with checkedFindings
- source text naming module errors stays an ESLint finding (test (test), 124-159): **keep** to `tests/unit/cli/execution/command/output.test.ts` `source text naming module errors stays an ESLint finding`. real; no javascript check source exists, so it stays with checkedFindings

## `tests/cli/execution/command/placeholders.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/command/placeholders.test.ts`. perFileCommands, isolatedFiles and substituteValue go to command/placeholders.ts (EXG layout)
- replaces a file marker at position %s without dropping neighboring arguments (test (test.each), 11-20): **keep** to `tests/unit/cli/execution/command/placeholders.test.ts` `replaces a file marker at position %s without dropping neighboring arguments`. real
- \[0, 1, 2\] (test (test.each), 11-11): **keep** to `tests/unit/cli/execution/command/placeholders.test.ts` `[0, 1, 2]`. table of the kept test
- an isolated Markdown command retains the companion tool file owned by its manifest (test (test), 22-37): **keep** to `tests/unit/cli/execution/command/placeholders.test.ts` `a Markdown command run in a scratch copy keeps the tool files its manifest writes`. real; TTC-032 isolated becomes scratch copy (glossary)
- level arguments retain item boundaries at %s (test (test.each), 39-61): **delete**. weak: compares the whole Ansible command line copied from the manifest; the level choice is checked by tests/tools/configurations/infra/ansible.test.ts:58-112 (ansible-lint uses the profile of level %s)
- \['recommended', 'all'\] as const (test (test.each), 39-39): **delete**. weak: table of the deleted level test
- malformed native level arguments are refused: %s (test (test.each), 63-72): **delete**. LIF-006 and LIF-007: the level-choice rule moves into the build-only assertManifests in scripts/, whose tests are deleted
- \['{level:moderate}', '{level:moderate:}', '{level:moderate:production:extra}'\] (test (test.each), 63-63): **delete**. goes with its test

## `tests/cli/execution/copy/dependencies.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/copy/dependencies.test.ts`. dependency trees in revision copies (copyDependencies, revisionDependencies; EXG layout copy/dependencies.ts); kept apart from revision.test.ts so neither exceeds 300 lines (TEL-063)
- staged snapshots copy all workspace dependency trees before validating cross-tree links (test (test), 24-51): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `staged copies copy every workspace dependency tree before checking links between them`. real; TTC-032 snapshot becomes copy
- a workspace bin into untracked build output leaves the copy, and a broken link stops it (test (test), 53-76): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `a workspace bin into untracked build output is left out of the copy`. TEL-023: lines 71-75 go (the broken-link case repeats scratch.test.ts) and the title changes
- revision manifests refuse external links while external dependencies are privately cloned (test (test), 78-113): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `a revision copy clones external dependencies instead of linking them`. real; TEL-019: the manifest-link half (lines 89-91) goes
- a nested revision refuses its incomplete managed dependency installation (test (test), 115-145): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `a nested revision copy links .gspot/node_modules instead of copying it`. no installing mark, so the unfinished-install refusal half goes; the link half stays; real
- revision prose checks reuse the installed packages under %s (test (test.each), 147-167): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `revision copies reuse the installed Vale packages under %s`. real
- \['', 'nested/'\] (test (test.each), 147-147): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `['', 'nested/']`. table of the kept test
- a copy leaves the virtual environment in the working tree and still checks its lockfile (test (test), 169-189): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `a copy leaves the virtual environment in the working tree and still checks its lockfile`. real
- cancellation drains dependency copies before removing the copy and preserves installed files (test (test), 191-241): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `cancellation drains dependency copies before removing the copy and keeps installed files`. real; TCO-037 using instead of try/finally
- a manifest checked out with CRLF matches its LF blob when Git converts line endings (test (test), 243-261): **keep** to `tests/unit/cli/execution/copy/dependencies.test.ts` `a manifest checked out with CRLF matches its LF blob when Git converts line endings`. real
- stageRevision (function, 14-17): **move** to `tests/unit/cli/execution/copy/dependencies.test.ts` `stageRevision`. helper of seven tests in this file; the file moves
- revisionFailure (function, 20-22): **move** to `tests/unit/cli/execution/copy/dependencies.test.ts` `revisionFailure`. helper of five tests in this file; the file moves

## `tests/cli/execution/copy/entries.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/copy/revision.test.ts; tests/unit/cli/repository/revisions/objects.test.ts`. test 1 tests checkOutRevision (copy/revision.ts); test 2 tests getHeadEntries, getBlobs, getEntries (repository/revisions/objects.ts, PLR layout); TEL-016
- nested policies retain repository context with policy-relative index and committed paths (test (test), 12-41): **keep** to `tests/unit/cli/execution/copy/revision.test.ts` `a revision copy of a nested gspot.toml keeps the repository around it`. real; TTC-032 policy becomes gspot.toml
- unborn history is empty and committed blobs retain unusual filenames and bytes (test (test.skipIf), 44-68): **move** to `tests/unit/cli/repository/revisions/objects.test.ts` `unborn history is empty, and committed blobs keep unusual file names and bytes`. TEL-016: the broken-index lines 62-63 go (repeat of the repository corrupt-index test); the checkOutRevision lines 59-61 go to copy/revision.test.ts; unborn history and broken HEAD run on every system
- !isPosix (test (test.skipIf), 44-44): **move** to `tests/unit/cli/repository/revisions/objects.test.ts` `isWindows`. TEL-016 keeps the gate only on the odd file-name part, named isWindows

## `tests/cli/execution/copy/files.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/copy/scratch.test.ts`. copyIntoScratch and projectCopyInputs go to copy/scratch.ts (EXG layout)
- dependency copies let concurrent native process output drain (test (test), 15-53): **delete**. TEL-001: cannot fail for the reason it names
- preview copies workspace dependencies and preserves executable links without writing through either (test (test), 55-88): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `a dry-run copy holds workspace dependencies and working bin links, and edits in it reach neither source`. real; TTC-032 preview becomes dry run
- a workspace member that is no scope brings its own dependency store into the copy (test (test), 90-108): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `a workspace member that is no scope brings its own dependency store into the copy`. real
- a link into another linked tree points at the copy of that tree, whatever order the folder lists them in (test (test), 110-126): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `a link into another linked tree points at the copy of that tree, whatever order the folder lists them in`. real
- a dependency link that points at nothing refuses the copy (test (test), 128-137): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `a dependency link that points at nothing refuses the copy`. real; the one broken-link test (TEL-023)
- a source snapshot retains selected binary/config inputs and excludes sibling files (test (test), 139-160): **delete**. TEL-024: repeats the check copy test below
- check-input copies retain selected dependencies and optional extra file %s (test (test.each), 162-186): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `a check's scratch copy holds its files and dependencies, plus an extra file when asked: %s`. real; TTC-032 title; EXG-054 passes a ScratchSource
- \[false, true\] (test (test.each), 162-162): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `[false, true]`. table of the kept test
- workspace dependency copies preserve named transitive sources and isolate revision=%s (test (test.each), 188-239): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `workspace dependency copies keep the sources the check imports (revision copy %s)`. real; TTC-032 title; the sample writes \[\[scope\]\] records with path and dotted keys, and a path written in a scope is relative to the repository root (CFR-003)
- \[false, true\] (test (test.each), 188-188): **keep** to `tests/unit/cli/execution/copy/scratch.test.ts` `[false, true]`. table of the kept test

## `tests/cli/execution/copy/gitlinks.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/execution/copy/revision.test.ts`. TEL-063: gitlinks join the revision copy tests
- a %s copy retains gitlinks without reading submodule contents (test (test.each), 11-45): **keep** to `tests/unit/cli/execution/copy/revision.test.ts` `a %s copy keeps gitlinks without reading submodule contents`. real
- \['index', 'commit'\] as const (test (test.each), 11-11): **keep** to `tests/unit/cli/execution/copy/revision.test.ts` `['index', 'commit'] as const`. table of the kept test

## `tests/cli/execution/copy/hash-formats.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/tree/revisions.test.ts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; staged and pushed revisions with SHA-256 names and tracked links; TEL-015: full gspot check runs of staged and pushed copies test commands/check/tree.ts (checkTree checks the index or a pushed commit)
- SHA-256 object names give the staged and push checks the verdicts of SHA-1 names (test (test), 55-59): **keep** to `tests/unit/cli/commands/check/tree/revisions.test.ts` `SHA-256 object names give the staged and push checks the results of SHA-1 names`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; staged and pushed revisions with SHA-256 names and tracked links; real; TEL-015: the push setup uses one runPrePush helper in tests/setup/run-gspot.ts
- verdicts (function, 13-53): **move** to `tests/unit/cli/commands/check/tree/revisions.test.ts` `verdicts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; helper of its one test; TEL-015 runPrePush replaces the hand-written push input; command checks are \[\[command_check\]\] records with name, and the rules table is \[rules\] with enabled only (TML-003)

## `tests/cli/execution/copy/letter-case.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/check/tree/staged.test.ts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; a staged-only behavior; TEL-015, TEL-037
- staged paths preserve each spelling and its bytes, or refuse a case-folding file system (test (test), 12-64): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `staged paths that differ only by letter case keep both spellings and bytes`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; a staged-only behavior; TEL-037: split in two tests with visible skips, skipIf(caseFolding) and skipIf(!caseFolding) for "a case-folding disk refuses them"; command checks are \[\[command_check\]\] records with name, and the rules table is \[rules\] with enabled only (TML-003)

## `tests/cli/execution/copy/links.test.ts`

- (the file) (file): **delete**. weak: every test and helper of this file is deleted
- a staged check with tracked links of every kind exits by its findings alone (test (test), 38-47): **delete**. weak: checks only exit 1 and status failed, which the always-failing check gives anyway
- a push of a commit with tracked links of every kind exits by its findings alone (test (test), 49-71): **delete**. weak: checks only exit 1 and status failed
- stageLinks (function, 14-20): **delete**. weak: helper used only by the deleted tracked-links tests
- linkSandbox (function, 22-36): **delete**. weak: helper used only by the deleted tracked-links tests

## `tests/cli/execution/count-pattern.test.ts`

- (the file) (file): **delete**. finding_count_pattern leaves the command-check schema and no shipped manifest check uses it (TML-004), so the field and its test go
- counted failures survive final filtering without diagnostic locations (test (test), 19-33): **delete**. tests finding_count_pattern, which goes with the countedFailure path of execution/public.ts (TML-004); no behavior it tested stays, so no new test is needed
- identityPolicy (function, 8-17): **delete**. helper of the deleted finding_count_pattern test (TML-004)

## `tests/cli/execution/errors.test.ts`

- (the file) (file): **delete**. SUP-012: the non-Error throw test and its suppression go
- a built-in check throwing $thrown produces an actionable error (test (test.each), 10-37): **delete**. SUP-012
- NON_ERROR_FAILURES (test (test.each), 10-10): **delete**. SUP-012

## `tests/cli/execution/fixers/environment.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts`. TEL-063: joins the scratch-copy fix tests; applyFixers goes to execution/fixes.ts, whose tests exceed 300 lines and split by behavior
- fixer environment paths expand against the scratch execution root during preview (test (test), 12-34): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `a fixer's {root} environment paths point into the scratch copy during a dry run`. real; TTC-032 title

## `tests/cli/execution/fixers/isolation.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts`. fixes run in a scratch copy (applyFixers in execution/fixes.ts); the TEL folder fix/ becomes the split of fixes.ts
- corrections reject a replaced external source before execution (preview $preview, isolated $isolated) (test (test.each), 15-40): **delete**. TEL-019 drops the link half; the rest repeats the scratch-copy write test below and passes.test.ts
- \[ { preview: false, isolated: false }, { preview: true, isolated: true }, \] (test (test.each), 15-18): **delete**. table of the deleted test
- isolated corrections publish selected bytes and remove their workspace (preview %s) (test (test.each), 41-72): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `a fix in a scratch copy writes only the selected file back and removes the copy (dry run %s)`. real; TTC-032 title
- \[false, true\] (test (test.each), 41-41): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `[false, true]`. table of the kept test
- isolated correction refuses to overwrite source changed during execution and cleans up (test (test), 74-113): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `a fix in a scratch copy refuses to overwrite a file changed while it ran, and removes the copy`. real; TTC-032 title
- removes the scratch directory after a failed correction and preserves source bytes (test (test), 115-132): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `a failed fix removes its scratch folder and keeps the source bytes`. real; TTC-032 title
- cleans the scratch directory after a failed $operation (test (test.each), 134-161): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `cleans the scratch folder after a failed $operation`. real
- SCRATCH_FAILURES (test (test.each), 134-134): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `SCRATCH_FAILURES`. the rows come from tests/config/execution.ts
- a canceled correction retains partial changes and reports the process failure (isolated %p) (test (test.each), 163-207): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `a canceled fix keeps its partial changes and reports the process failure (scratch copy %p)`. TEL-058: one toMatchObject, no defensive if and pid check, keep the try/finally
- \[false, true\] (test (test.each), 163-163): **keep** to `tests/unit/cli/execution/fixes/scratch-copies.test.ts` `[false, true]`. table of the kept test

## `tests/cli/execution/fixers/linters.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/execution/fixes/passes.test.ts`. it stays in the unit suite (ESLint and Stylelint come from tests/node_modules) and joins the fix tests of execution/fixes.ts
- $configuration correction status agrees with native residual diagnostics (test (test.each), 12-83): **keep** to `tests/unit/cli/execution/fixes/passes.test.ts` `after --fix, the $configuration check status matches what the linter still reports`. real; TTC-032 title; command checks are \[\[command_check\]\] records with name
- \[ { configuration: 'javascript', tool: 'eslint', executable: 'eslint.js', path: 'sam (test (test.each), 12-39): **keep** to `tests/unit/cli/execution/fixes/passes.test.ts` `[{ configuration: 'javascript', tool: 'eslint', ... }, { configuration: 'css', tool: 'stylelint', ... }]`. table of the kept test. Values to config: FIX_LINTER_CASES = the ESLint and Stylelint rows -&gt; tests/config/execution.ts

## `tests/cli/execution/fixers/outcomes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/fixes/outcomes.test.ts`. fix outcomes of applyFixers (execution/fixes.ts), split by behavior
- a declared fatal diagnostic overrides correction exit %s (test (test.each), 16-40): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `a declared crash pattern fails a fix that exits %s`. real; glossary retires correction
- \[0, 3\] (test (test.each), 16-16): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `[0, 3]`. table of the kept test
- $name classifies $status from execution and resulting bytes (test (test.each), 42-58): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `$name classifies $status from the exit code and the resulting bytes`. real
- FIXER_OUTCOMES (test (test.each), 42-42): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `FIXER_OUTCOMES`. the rows come from tests/config/execution.ts
- compares bytes that decode to the same replacement character (test (test), 60-72): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `compares bytes that decode to the same replacement character`. real
- counts deletion of an empty file as a change (test (test), 74-85): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `counts deletion of an empty file as a change`. real
- distinguishes a skipped correction from an unavailable tool (test (test), 87-107): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `distinguishes a skipped fix from a missing tool`. real; glossary retires correction
- runs the correction executable when it differs from the check executable (test (test), 109-121): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `runs the fixer program when it differs from the check program`. real; glossary fixer
- fails the run when a correction exits nonzero even though its check passes (test (test), 123-132): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `a fix that exits nonzero fails the run even when its check passes`. real
- a failed version inspection blocks a check and its correction without changing source bytes (test (test), 134-160): **keep** to `tests/unit/cli/execution/fixes/outcomes.test.ts` `a failed version check blocks a check and its fix without changing source bytes`. real; TCO-037 using instead of try/finally

## `tests/cli/execution/fixers/passes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/fixes/passes.test.ts`. fixer passes and re-checks after --fix (fixerPasses in execution/fixes.ts)
- fix verification replaces read source bytes and preserves unrelated authored files (test (test), 11-47): **keep** to `tests/unit/cli/execution/fixes/passes.test.ts` `after --fix, the checks read the fixed file and other files stay as they were`. real; glossary retires authored; command checks are \[\[command_check\]\] records with name
- a later pass formats what a correction after the formatter wrote (test (test), 49-74): **keep** to `tests/unit/cli/execution/fixes/passes.test.ts` `a later pass formats what a fix after the formatter wrote`. real; glossary retires correction; command checks are \[\[command_check\]\] records with name
- a fixer that fails midway leaves the later fixers to run in order and keep their edits (test (test), 76-103): **keep** to `tests/unit/cli/execution/fixes/passes.test.ts` `a fixer that fails midway leaves the later fixers to run in order and keep their edits`. real; command checks are \[\[command_check\]\] records with name
- checks refresh the file inventory after a fixer creates a source (test (test), 105-123): **keep** to `tests/unit/cli/execution/fixes/passes.test.ts` `checks refresh the file inventory after a fixer creates a source`. real; command checks are \[\[command_check\]\] records with name

## `tests/cli/execution/fixers/policy-layout.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/gspot/settings-format.test.ts`. it tests the gspot/settings-format check (the glossary name for gspot/policy-layout), whose fix goes to checks/general/gspot/settings-format.ts, so the test follows the source path
- the policy-layout command corrects $name without installation (test (test.each), 21-52): **keep** to `tests/unit/cli/checks/general/gspot/settings-format.test.ts` `the gspot/settings-format fix rewrites $name without installing tools`. real; glossary check name
- POLICY_LAYOUT_CASES (test (test.each), 21-21): **keep** to `tests/unit/cli/checks/general/gspot/settings-format.test.ts` `SETTINGS_FORMAT_CASES`. the rows come from tests/config/settings/file.ts (SETTINGS_FORMAT_CASES)
- a native policy-layout correction preserves an external replacement before publication (test (test), 54-79): **delete**. TEL-008: spies on the function under test; the guarded write is tested in the ownership tests
- canceling a native policy-layout correction keeps authored bytes (test (test), 81-101): **keep** to `tests/unit/cli/checks/general/gspot/settings-format.test.ts` `canceling the gspot/settings-format fix keeps your bytes`. real; glossary retires native and authored
- the policy-layout command refuses an unrepresentable field comment before any policy write (test (test), 103-115): **keep** to `tests/unit/cli/checks/general/gspot/settings-format.test.ts` `the gspot/settings-format fix refuses a comment TOML 1.0 cannot hold before writing gspot.toml`. real; tools.&lt;tool&gt;.verbatim becomes extra, written { value = {...}, reason = "..." }, and the \[reasons\] table goes (CFR-002), so the field path in the message reads tools.prettier.extra.value.mixed.0.first

## `tests/cli/execution/fixers/triggers.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/planning/files.test.ts`. TEL-014: its two applyFixers assertions join the last-file trigger test
- a last-file %s supports fixer preview and publication with %s selection (test (test.each), 15-44): **merge** to `tests/unit/cli/planning/files.test.ts` `a last-file %s triggers the affected project with %s selection`. TEL-014
- PROJECT_TRIGGERS (test (test.each), 15-15): **merge** to `tests/unit/cli/planning/files.test.ts` `PROJECT_TRIGGERS`. TEL-014

## `tests/cli/execution/git-index.test.ts`

- (the file) (file): **delete**. EXG-024, TEL-056
- %s reports a failed index read instead of a clean verdict (test (test.each), 12-36): **delete**. EXG-024 deletes the second index read; rewritten for openSession it repeats the repository corrupt-index test (TEL-016)
- \['.env', 'node_modules/example/source.js'\] (test (test.each), 12-12): **delete**. table of the deleted test
- execution reports the unstaged selection count before command rendering (test (test), 38-60): **delete**. TEL-056: a pass-through; the printed unstaged line gets a terminal test instead

## `tests/cli/execution/ignores.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/ignores.test.ts`. applyIgnores goes to execution/ignores.ts (EXG layout)
- ignores (describe (describe), 4-44): **delete**. TTC-039: describe wrapper
- ignores &gt; match by check, rule and paths and count what they matched (test (test), 5-43): **keep** to `tests/unit/cli/execution/ignores.test.ts` `ignores match by check, rule and paths and count what they matched`. real

## `tests/cli/execution/impact.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/files.test.ts; tests/unit/cli/planning/checks.test.ts`. TEL-014: trigger and input tests go to planning (files.ts computes triggerPaths and ignored inputs; checks.ts holds isActive)
- a last-file %s triggers the affected project with %s selection (test (test.each), 20-59): **keep** to `tests/unit/cli/planning/files.test.ts` `a last-file %s triggers the affected project with %s selection`. real; TEL-014 adds the dry-run and write assertions of triggers.test.ts
- PROJECT_TRIGGERS (test (test.each), 20-20): **keep** to `tests/unit/cli/planning/files.test.ts` `PROJECT_TRIGGERS`. the rows come from tests/config/planning.ts
- a positional file trigger preserves project-wide input and findings (test (test), 61-78): **keep** to `tests/unit/cli/planning/files.test.ts` `a file named on the command line runs its scope's project check on every file of the scope`. real; title says what a positional trigger is
- a check with no command and no built-in check refuses the complete plan before any command runs (test (test), 80-107): **delete**. LIF-059 and EXG-038: checkRun's second guard goes; shipped manifests cannot hold such a check
- a project check without its own inputs is inactive even when its scope contains another language (test (test), 109-127): **move** to `tests/unit/cli/planning/checks.test.ts` `a project check without its own inputs is inactive even when its scope holds another language`. TEL-014; TEL-036 keeps only python/ruff, no platform branches
- a deleted file from another language does not trigger a TypeScript project (test (test), 129-137): **keep** to `tests/unit/cli/planning/files.test.ts` `a deleted file from another language does not trigger a TypeScript project`. real
- a deleted child-scope input triggers only the child project (test (test), 139-156): **keep** to `tests/unit/cli/planning/files.test.ts` `a deleted child-scope input triggers only the child project`. real; the sample writes \[\[scope\]\] records with path and dotted keys, and a path written in a scope is relative to the repository root (CFR-003)
- $name preserves project input selection (test (test.each), 158-176): **keep** to `tests/unit/cli/planning/files.test.ts` `$name keeps the project input selection`. real
- PROJECT_PATH_IGNORES (test (test.each), 158-158): **keep** to `tests/unit/cli/planning/files.test.ts` `PROJECT_PATH_IGNORES`. the rows come from tests/config/planning.ts

## `tests/cli/execution/prerequisites.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/skips.test.ts; tests/unit/cli/checks/framework/site/build.test.ts; tests/unit/cli/execution/run.test.ts`. the check tests move out of execution, and SUP-012 keeps the runner-error test
- a missing required setting skips its check (test (test), 13-31): **move** to `tests/unit/cli/planning/skips.test.ts` `a check whose required setting is missing is skipped with a note naming the setting`. the skip comes from planning (waitingSetting, planning/skips.ts) and xcode/entitlements is only the vehicle; NMU-015: the expected note names xcode.allowed_entitlements
- a failed site build skips every output consumer and a new session rebuilds (test (test), 33-73): **move** to `tests/unit/cli/checks/framework/site/build.test.ts` `a failed site build skips every check that reads the build, and a new session builds again`. CKG layout checks/framework/site/build.ts; the expected checks are a literal list, BUILD_OUTPUT_CHECKS in tests/config/site.ts, because expected values are not computed from product data (THR-028); site.max_kilobytes becomes \[\[site.size_limit\]\] with paths relative to the repository root (such as dist/\*\*) and kilobytes (TMF-008)
- a check runner that throws errors that check alone, and the other checks keep their results (test (test), 75-101): **move** to `tests/unit/cli/execution/run.test.ts` `a built-in check that throws becomes an error, and the other checks keep their results`. SUP-012 keeps it as the one error-path test (runOne in execution/run.ts); the thrown error comes from a built-in check; command checks are \[\[command_check\]\] records with name

## `tests/cli/execution/progress.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/run.test.ts`. onResult is called from runChecks in execution/run.ts; TEL-063 results file named for the source file
- completion callbacks publish filtered results before the remaining check finishes (test (test), 11-61): **keep** to `tests/unit/cli/execution/run.test.ts` `each check result is reported as soon as the check ends, with ignores applied`. real; TTC-032 title; command checks are \[\[command_check\]\] records with name

## `tests/cli/execution/scopes.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/built-in.test.ts; tests/unit/cli/execution/ignores.test.ts; tests/unit/cli/checks/language/html.test.ts; tests/unit/cli/execution/command/check.test.ts`. each test goes to the code it tests
- scoped readers preserve their owned inputs (describe (describe), 13-54): **delete**. TTC-039: one-name wrapper; the shared sandbox moves into the test
- scoped readers preserve their owned inputs &gt; $check receives its own files and binary assets (test (test.each), 40-53): **keep** to `tests/unit/cli/execution/built-in.test.ts` `each check in a scope reads only that scope's files: $check`. real; one table for one checkInput rule is less code than five check files; the row site/dead-assets becomes site/unused-assets (glossary)
- scoped readers preserve their owned inputs &gt; EXPECTED_READERS (test (test.each), 40-40): **keep** to `tests/unit/cli/execution/built-in.test.ts` `SCOPE_FINDINGS`. readers is jargon; the rows come from tests/config/execution.ts
- Bash safety ignores exempt declared paths without leaking to descendants or siblings (test (test), 56-83): **move** to `tests/unit/cli/execution/ignores.test.ts` `a path ignore covers its own paths, not the scopes below or beside it`. TCO-013 names it the general test of per-scope ignore paths (isEntryMatch); TCO-012 drops lines 80-82; TEL-052 join; the sample writes \[\[scope\]\] records with path and dotted keys, and a path written in a scope is relative to the repository root (CFR-003)
- $check applies canonical path settings without excluding unrelated files (test (test.each), 85-123): **move** to `tests/unit/cli/checks/language/html.test.ts` `html/template-text skips the paths of its templates setting and still checks other files`. the supabase row goes (it repeats checks/platform/supabase/settings.test.ts:26); TCO-012 drops lines 120-121; glossary retires canonical; one row is left, so it is a plain test
- \[ { configuration: 'supabase', check: 'supabase/service-role-key', setting: '\[supabase\]\\nfun (test (test.each), 85-104): **inline** to `tests/unit/cli/checks/language/html.test.ts` `html/template-text skips the paths of its templates setting and still checks other files`. only the html row stays, since the supabase row is a duplicate; a one-row table is a plain test, so its values go into the test
- native scoped command paths remain relative at %s (test (test.each), 125-142): **move** to `tests/unit/cli/execution/command/check.test.ts` `a command in a scope runs in the scope folder with paths relative to it`. it stays with commandEnvironment (command/check.ts); TTC-032 drops native; commandEnvironment never reads the level, so the test runs once as a plain test; the sample writes \[\[scope\]\] records with path and dotted keys, and the test checks the tool cwd and file paths inside the scope folder (CFR-003)
- \['recommended', 'all'\] as const (test (test.each), 125-125): **delete**. padding: a level loop that changes nothing, since cwd and file paths do not depend on the level

## `tests/cli/execution/tool-runner/adapters.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/execution/command/check.test.ts`. TEL-009: tool lookup, version floor and cancel of runCheckCommand (command/check.ts); no source folder is named tool-runner
- Ansible adapter reports a %s run through the shared runner (test (test.skipIf), 21-72): **delete**. weak: the timeout row mocks every process so no tool runs; canceling a running tool is checked by tests/cli/commands/check/cancellation.test.ts:13-36
- \['timeout', 'canceled'\] as const (test (test.skipIf), 21-21): **delete**. the timeout row mocks every process and repeats other tests
- !hasToolBuild('ansible-lint') (test (test.skipIf), 21-21): **delete**. TEL-035: a fake tool needs no Ansible build
- an adapter reports a version below the floor as missing (test (test.skipIf), 74-93): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a tool below its minimum version is reported missing`. TEL-035 title and test manifest
- !hasToolBuild('ansible-lint') (test (test.skipIf), 74-74): **delete**. TEL-035
- a reused session runs a replaced executable and reads its permissions (test (test.skipIf), 96-124): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a session that runs again uses a replaced program and reads its permissions`. real; glossary program; command checks are \[\[command_check\]\] records with name
- !isPosix (test (test.skipIf), 96-96): **keep** to `tests/unit/cli/execution/command/check.test.ts` `isWindows`. TEL-034 kept gate (permission bits), named isWindows
- versionScript (function, 16-19): **move** to `tests/unit/cli/execution/command/check.test.ts` `versionScript`. helper of the two tool tests; its body becomes a fakeTool script (TEL-035); the file merges

## `tests/cli/execution/tool-runner/arguments.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/command/check.test.ts; tests/unit/cli/execution/command/placeholders.test.ts`. TEL-009: runCheckCommand tests go to command/check.ts, argument expansion to command/placeholders.ts
- Batched tool invocations preserve spaced Unicode file arguments (test (test), 18-40): **delete**. TEL-025: repeats fileBatches and tests the process runner
- per-file execution preserves expanded flags and arguments after the file (test (test), 42-71): **move** to `tests/unit/cli/execution/command/placeholders.test.ts` `per-file commands keep expanded flags and the arguments after the file`. real; argument expansion (substitute, perFileCommands); command checks are \[\[command_check\]\] records with name
- a repository command receives a declared empty argument without changing its position (test (test), 73-97): **move** to `tests/unit/cli/execution/command/placeholders.test.ts` `a command keeps a declared empty argument in its place`. real; substitute keeps empty items; command checks are \[\[command_check\]\] records with name
- per-file failures name the selected file when expanded arguments follow it (test (test), 99-131): **keep** to `tests/unit/cli/execution/command/check.test.ts` `per-file failures name the selected file when expanded arguments follow it`. real; command checks are \[\[command_check\]\] records with name
- a signaled per-file process is an execution error rather than a source finding (test (test.skipIf), 134-156): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a per-file process killed by a signal is an error, not a finding`. real; command checks are \[\[command_check\]\] records with name
- !isPosix (test (test.skipIf), 134-134): **keep** to `tests/unit/cli/execution/command/check.test.ts` `isWindows`. TEL-034 kept gate (signals), named isWindows
- a copied command uses its declared companion executable instead of an inactive shim (test (test.skipIf), 158-196): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a command run in a copy uses its declared companion program, not an inactive PATH entry`. TEL-034: fake tools with fakeTool; TCO-037 using; command checks are \[\[command_check\]\] records with name
- !isPosix (test (test.skipIf), 158-158): **delete**. TEL-034: fakeTool writes Windows wrappers

## `tests/cli/execution/tool-runner/exit-contracts.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/execution/command/output.test.ts`. TEL-009: declared exit codes are read in command/output.ts
- declared findings exits distinguish partial reports from fatal %s execution (test (test.each), 14-52): **keep** to `tests/unit/cli/execution/command/output.test.ts` `declared exit codes tell partial findings from a fatal %s run`. real; TCO-012 drops line 50; command checks are \[\[command_check\]\] records with name
- \['{file}', '{files}'\] (test (test.each), 14-14): **keep** to `tests/unit/cli/execution/command/output.test.ts` `['{file}', '{files}']`. table of the kept test
- declared %s exits govern checks and corrections independently of the output parser (test (test.each), 54-115): **delete**. TEL-027: convoluted CLI copy of other exit-code tests
- \['typos', 'markdownlint'\] as const (test (test.each), 54-54): **delete**. table of the deleted test

## `tests/cli/execution/tool-runner/output-lines.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/command/output.test.ts; tests/unit/cli/tools/run.test.ts`. TEL-009; EXG-031 moves the CRLF conversion into runTool
- a check command hands its built-in check LF line endings when the tool prints CRLF (test (test), 11-20): **move** to `tests/unit/cli/tools/run.test.ts` `a tool's output reaches its check with LF line endings when the tool prints CRLF`. EXG-031: the one conversion lives in runTool (tools/run.ts)
- per-file failures omit only headers the selected tool declares (test (test), 22-41): **keep** to `tests/unit/cli/execution/command/output.test.ts` `per-file failures drop only the header lines the tool declares`. real; command checks are \[\[command_check\]\] records with name

## `tests/cli/execution/tool-runner/taplo.test.ts`

- (the file) (file): **delete**. TEL-021: repeats the both-streams unit test through the whole CLI
- the Taplo adapter reports both output streams and its exit code (test (test), 16-44): **delete**. TEL-021
- TOOL_FAILURES_POLICY (const, 11-14): **delete**. TEL-021: goes with its test

## `tests/cli/lifecycle/apply/eslint-dry-run.test.ts`

- (the file) (file): **delete**. duplicate (TEL-032): its one test is deleted
- apply preview reports a scoped ESLint rule change and saves the baseline only after applying it (test (test), 12-44): **delete**. duplicate (TEL-032): the dry-run rule change and the record update after apply are checked by rule-preview 15-41 (apply compares lint rules with its last successful write), and ESLint path ignores by tests/cli/generation/eslint/eslint-ignores.test.ts:41-87

## `tests/cli/lifecycle/apply/plans.test.ts`

- (the file) (file): **move** to `tests/unit/cli/apply/write.test.ts`. writeGeneratedFiles goes to apply/write.ts (LIF layout; TEL-010 lifecycle/write.test.ts)
- apply refuses a plan whose policy changed after the session was read (test (test), 13-28): **keep** to `tests/unit/cli/apply/write.test.ts` `writing generated files refuses a gspot.toml that changed after the session read it`. TEL-010; TCM-027 keeps this check and makes it throw GspotError; glossary retires policy
- a bun runner preserves the authored scripts and adds no task of its own (test (test), 30-45): **delete**. TEL-005: checks a feature deleted on 2026-09-29

## `tests/cli/lifecycle/apply/publication.test.ts`

- (the file) (file): **split** to `tests/unit/cli/apply/write.test.ts; tests/unit/cli/apply/version-pin.test.ts`. TEL-010: writing generated files is apply/write.ts; the pin write is apply/version-pin.ts
- generated files are writable: apply keeps their bytes, and a prune removes them (test (test), 15-52): **keep** to `tests/unit/cli/apply/write.test.ts` `generated files stay writable: apply keeps their bytes and removes them when nothing needs them`. real; TTC-032 title; the rules table is \[rules\] with enabled only (TML-003)
- a failed pin publication leaves the old version (test (test), 54-71): **move** to `tests/unit/cli/apply/version-pin.test.ts` `a failed version pin write leaves the old version`. real; TCO-037 using; glossary retires publication
- apply preview rejects a generated destination linked outside the repository (test (test), 73-86): **delete**. TEL-019: repeats the safe-folder link guard
- apply preview rejects an external $path before producing configuration (test (test.each), 88-103): **keep** to `tests/unit/cli/apply/write.test.ts` `apply --dry-run refuses an input $path that links outside the repository`. TEL-019 keeps this one command-level case; TTC-032 preview becomes dry run
- EXTERNAL_INPUT_CASES (test (test.each), 88-88): **keep** to `tests/unit/cli/apply/write.test.ts` `EXTERNAL_INPUT_CASES`. the rows come from tests/config/generated-files.ts
- apply validates obsolete output parents before publishing new configuration (test (test), 105-129): **keep** to `tests/unit/cli/apply/write.test.ts` `apply checks the folders of files it no longer needs before it writes anything`. real; TEL-047 plain message replaces Unsafe lifecycle parent

## `tests/cli/lifecycle/apply/rule-preview.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/apply/stale.test.ts`. TEL-010 rule-changes; compareRules and computeDrift are apply/stale.ts
- apply compares rules with its last successful write: $name (test (test.each), 15-41): **keep** to `tests/unit/cli/apply/stale.test.ts` `apply compares lint rules with its last successful write: $name`. real; glossary lint rule; the tables have no runner, since the ESLint script paths always include .mise/tasks/\*\* and the rule lists do not depend on a runner (INX-003, INX-011)
- RULE_PREVIEW_CASES (test (test.each), 15-15): **keep** to `tests/unit/cli/apply/stale.test.ts` `RULE_CHANGE_CASES`. TEL-040 drops initialLevel and proposedLevel; glossary dry run, not preview; the rows come from tests/config/rule-capture.ts (RULE_CHANGE_CASES)
- Vale previews its added style packages and native rule options at all (test (test), 43-75): **delete**. weak: pins Vale rule names copied from the shipped Vale data; Vale rule groups are checked by drift 73-91 (rule capture keeps each tool's rule groups apart) and dry-run rule changes by rule-preview 15-41
- manual JavaScript edits produce a byte diff without running the edited configuration or changing the rule baseline (test (test), 77-109): **keep** to `tests/unit/cli/apply/stale.test.ts` `a hand edit of the ESLint config shows as a byte diff, without running it or changing the rule record`. real; glossary retires authored and preview; the tables have no runner (INX-003)
- a scoped rule preview changes only the matching project configuration (test (test), 111-138): **delete**. TEL-032: the scoped rule change is tested three times
- a failed managed write retains the last successful rule baseline until the next apply succeeds (test (test), 140-168): **keep** to `tests/unit/cli/apply/stale.test.ts` `a failed write keeps the last rule record until the next apply succeeds`. real

## `tests/cli/lifecycle/cloned-output.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/apply/write.test.ts`. a fresh clone keeps committed generated files: writeGeneratedFiles in apply/write.ts
- a fresh Git clone adopts exact generated bytes without changing checkout permissions (test (test), 10-38): **keep** to `tests/unit/cli/apply/write.test.ts` `a fresh Git clone keeps the committed generated files byte for byte and mode for mode`. real

## `tests/cli/lifecycle/drift.test.ts`

- (the file) (file): **split** to `tests/unit/cli/apply/stale.test.ts; tests/unit/cli/generation/rule-capture.test.ts`. TEL-017: compareRules and stray paths stay with apply/stale.ts; collectRules goes to generation/rule-capture.ts
- rule changes name additions, removals, and changed options across every declared path (test (test), 12-23): **keep** to `tests/unit/cli/apply/stale.test.ts` `rule changes name additions, removals, and changed options across every declared path`. real
- rule collection ignores selection order while preserving record values and changed options (test (test), 25-51): **move** to `tests/unit/cli/generation/rule-capture.test.ts` `rule capture ignores selector order and keeps record values and changed options`. TEL-017
- rule values keep false, zero, null, nested options, and significant array order (test (test), 53-63): **keep** to `tests/unit/cli/apply/stale.test.ts` `rule values keep false, zero, null, nested options, and significant array order`. real (compareRules)
- rule collection rejects ambiguous generator data: $message (test (test.each), 65-71): **move** to `tests/unit/cli/generation/rule-capture.test.ts` `rule capture refuses ambiguous rule data: $message`. TEL-017
- \[ { document: { rules: \[{ id: 'same' }, { id: 'same' }\] }, message: 'contains duplicate ID same' }, { document: (test (test.each), 65-69): **move** to `tests/unit/cli/generation/rule-capture.test.ts` `[{ document: { rules: [{ id: 'same' }, { id: 'same' }] }, message: 'contains duplicate ID same' }, ...]`. table of the moved test. Values to config: RULE_CAPTURE_REFUSALS = the three { document, message } rows -&gt; tests/config/rule-capture.ts
- rule collection separates native rule groups and supports absent paths without reading serialized files (test (test), 73-91): **move** to `tests/unit/cli/generation/rule-capture.test.ts` `rule capture keeps each tool's rule groups apart and gives absent paths an empty group`. TEL-017; TTC-032 drops native
- disabled agent rules have the same stray paths in preview and apply pruning (test (test), 93-113): **keep** to `tests/unit/cli/apply/stale.test.ts` `turned-off rules have the same stray paths in a dry run and in apply's removal`. TEL-017 keeps it with computeDrift and isStray; glossary rules, setting \[rules\] with enabled only (TML-003)

## `tests/cli/lifecycle/hooks.test.ts`

- (the file) (file): **move** to `tests/unit/cli/install/hooks.test.ts`. hook plan, setup and status go to install/hooks.ts (LIF layout)
- a repository with $name keeps its hooks and gets the lines to add (test (test.each), 59-95): **keep** to `tests/unit/cli/install/hooks.test.ts` `a repository with $name keeps its hooks and gets the lines to add`. real; the hook start command follows the root package.json (a @gspothq/cli dependency gives npm exec --no -- gspot) or else mise exec -- gspot, so the rows hold a package.json dependency (INX-003); install has no --dry-run (CLX-004, DT3-007), so isDryRun and the preview step go and the lines to add are checked on the real install; install runs mise install &lt;tool names&gt; in .gspot for every repository (INX-006)
- \[...HOOK_REPOSITORIES\] (test (test.each), 59-59): **keep** to `tests/unit/cli/install/hooks.test.ts` `[...HOOK_REPOSITORIES]`. table of the kept test; the rows come from tests/config/hooks.ts
- a policy without hooks installs none (test (test), 97-104): **keep** to `tests/unit/cli/install/hooks.test.ts` `a gspot.toml without hooks installs none`. real; glossary retires policy
- an installed hook reports setup failure when its gspot launcher is %s (test (test.skipIf), 107-132): **delete**. tests the bare gspot hook start (the gspot row of HOOK_RUNNERS), which INX-005 deletes; a sandbox with no package.json pin starts gspot with mise exec -- gspot (INX-003), and the missing-start-program message is tested elsewhere
- \['missing', 'not executable'\] (test (test.skipIf), 107-107): **delete**. table of the deleted hook start test
- !isPosix (test (test.skipIf), 107-107): **delete**. gate of the deleted hook start test
- disabling hooks prunes %s.gspot/hooks and leaves unsetting Git to install (test (test.each), 134-165): **keep** to `tests/unit/cli/install/hooks.test.ts` `turning hooks off removes %s.gspot/hooks and leaves unsetting core.hooksPath to install`. TEL-066: start from hooks set with git config and keep only the off part; install has no --dry-run (CLX-004, DT3-007), so isDryRun and the install preview step go and the core.hooksPath unset is checked by the real install; the apply preview stays
- \['', 'app/'\] (test (test.each), 134-134): **keep** to `tests/unit/cli/install/hooks.test.ts` `['', 'app/']`. table of the kept test
- a nested repository reads foreign hooks from the native Git hooks directory (test (test), 167-184): **keep** to `tests/unit/cli/install/hooks.test.ts` `a nested gspot.toml reads other hooks from the repository's Git hooks folder`. real; LIF names: foreign hooks become other hooks; drops native
- foreign hook readiness keeps the opened file when its pathname changes (ready: %s) (test (test.each), 186-239): **delete**. TEL-003: spies on fs calls instead of behavior
- \[false, true\] (test (test.each), 186-186): **delete**. table of the deleted test
- foreign hook readiness refuses a directory without reading and closes its descriptor (test (test), 241-275): **delete**. weak (TEL-003): asserts which fs calls run and that a descriptor closes, not behavior
- foreign hook readiness closes its descriptor and preserves a read failure (test (test), 276-316): **delete**. TEL-003: spies on fs calls instead of behavior
- hooksOf (function, 26-29): **move** to `tests/setup/repository.ts` `hookContext`. TEL-054: shared with the hooks integration test
- prepareHookProvider (function, 37-57): **inline** to `tests/unit/cli/install/hooks.test.ts` `a repository with $name keeps its hooks and gets the lines to add`. one caller; it writes the package.json dependency of the row instead of a runner (INX-003)

## `tests/cli/lifecycle/ownership/conflicts/documents.test.ts`

- (the file) (file): **split** to `tests/unit/cli/ownership/managed-keys/toml.test.ts; tests/unit/cli/ownership/plans/blocks.test.ts`. TEL-011: TOML key tests go to managed-keys, the block test to plans/blocks; TEL-029
- TOML task ownership refuses malformed and edited fields and creates new tables (test (test), 10-28): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `managed TOML tasks refuse a malformed file and an edited key, and create new tables`. real
- edited and repeated managed blocks are preserved without overwriting their contents (test (test), 30-54): **move** to `tests/unit/cli/ownership/plans/blocks.test.ts` `an edited or repeated managed block is kept and not overwritten`. TEL-011 blocks file; glossary retires authored
- shared TOML preserves changed managed keys and rejects malformed input (test (test), 56-78): **delete**. duplicate (TEL-029: one of four copies of the TOML key scenario): the edited-key refusal and the invalid-TOML refusal are checked by documents 10-28 (managed TOML tasks refuse a malformed file and an edited key)
- restoration preserves an authored non-UTF-8 edit to owned %s fields (test (test.each), 80-92): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `giving back managed keys keeps your non-UTF-8 edit of a %s file`. real
- \['json', 'toml'\] (test (test.each), 80-80): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `['json', 'toml']`. table of the kept test

## `tests/cli/lifecycle/ownership/conflicts/links.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/ownership/plans/refusals.test.ts`. TEL-011: conflicts/plans and conflicts/links become one refusal file
- lifecycle ownership (describe (describe), 9-41): **delete**. TTC-039: one-name wrapper
- lifecycle ownership &gt; an exactly reproduced escaping link is refused before ownership or recovery changes (test (test.skipIf), 10-40): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `a link that points outside the repository is refused, even when it is unchanged`. real; TTC-032 title
- lifecycle ownership &gt; !isPosix (test (test.skipIf), 10-10): **delete**. TEL-034: other link tests run on Windows

## `tests/cli/lifecycle/ownership/conflicts/plans.test.ts`

- (the file) (file): **move** to `tests/unit/cli/ownership/plans/refusals.test.ts`. planReplacement, planBlock, planManagedKeys and planRetirement go to ownership/plans.ts; its tests exceed 300 lines and split by behavior (TEL-011)
- a prepared configuration does not write and cannot overwrite a subsequent edit (test (test), 18-36): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `a planned key edit writes nothing and refuses a later edit`. real
- overlapping configuration fields are refused without changing authored bytes (test (test), 38-59): **delete**. LIF-059 deletes the overlap self-check of keys gspot generates
- %s plans preserve intervening edits and do not claim the edited file (test (test.each), 61-95): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `%s plans refuse a file edited after planning and do not record it`. real
- \['replacement', 'block'\] as const (test (test.each), 61-61): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `['replacement', 'block'] as const`. table of the kept test
- a batch journals published files and preserves a later edited destination (test (test), 97-117): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `a batch writes the files before an edited one and refuses the edited one`. real; TTC-032 journals and publish
- a preserved file refuses the whole batch and leaves every proposed destination unchanged (test (test), 119-147): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `a file gspot does not own refuses the whole batch and leaves every file as it was`. real
- reviewed matching bytes refresh ownership without rewriting the file (test (test), 149-176): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `reviewed matching bytes refresh the record without rewriting the file`. real
- lifecycle ownership (describe (describe), 178-223): **delete**. TTC-039: one-name wrapper
- lifecycle ownership &gt; 'stale replace ${name} refuses replacement and retirement, then a fresh read succeeds' (test (test.skipIf), 184-221): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `a stale read of ${name} refuses replacement and removal, and a new read succeeds`. real; glossary retires retirement
- lifecycle ownership &gt; name === 'mode' && !isPosix (test (test.skipIf), 184-184): **keep** to `tests/unit/cli/ownership/plans/refusals.test.ts` `name === 'mode' && isWindows`. TEL-034 kept gate (mode row), named isWindows

## `tests/cli/lifecycle/ownership/installations.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/apply/write.test.ts`. ownership/tool-folders.ts does not exist: deleteToolFolder is inlined into pruneToolFolders in apply/write.ts (S05-003), so the one surviving test joins the apply write tests and goes through writeGeneratedFiles; the swap, recovery, refusal and whole-replacement tests go
- $kind installation is one record, and removing it deletes the folder (test (test.each), 11-27): **move** to `tests/unit/cli/apply/write.test.ts` `writing generated files deletes the $kind tool folder and its record when no configuration needs it`. pruneToolFolders is private to apply/write.ts (S05-003), so the test writes the folder and its installed record, then calls writeGeneratedFiles with a session that needs no $kind tools; glossary tool folder
- \[...INSTALLATIONS\] (test (test.each), 11-11): **move** to `tests/unit/cli/apply/write.test.ts` `[...TOOL_FOLDERS]`. table of the kept test; the rows come from tests/config/tools.ts (TOOL_FOLDERS)
- $kind installation refuses a folder gspot did not install and leaves it as it was (test (test.each), 29-48): **delete**. the refusal of a folder gspot did not create goes with installTree
- \[...INSTALLATIONS\] (test (test.each), 29-29): **delete**. table of the deleted refusal test
- an interrupted $kind swap retains the correct folder when $name (test (test.each), 50-70): **delete**. no swap and no crash recovery of tool folders
- INSTALLATIONS.flatMap((installation) =&gt; SWAP_CASES.map((entry) =&gt; ({ ...installation, ...entry }))) (test (test.each), 50-50): **delete**. table of the deleted swap test
- an install killed after its swap and before its record is replaced by the next install (test (test), 72-86): **delete**. no swap and no installing record
- installation publishes internal directory aliases as owned files without following external links (test (test), 88-111): **delete**. LIF-001 deletes readInstalledTree and its link handling
- installation resolves nested directory aliases and rejects cycles before publication (test (test), 113-137): **delete**. LIF-001 deletes readInstalledTree and its cycle check
- installation refuses a linked output root before publication and accepts a real directory (test (test), 139-158): **delete**. LIF-001: the package manager builds the folder inside .gspot; nothing reads a linked staged root
- a Python installation replaces the whole environment, runtime caches included, as one record (test (test), 160-181): **delete**. LIF-001 deletes the \_\_pycache\_\_ skip; whole-folder replacement stays tested below
- lifecycle ownership (describe (describe.if), 183-204): **delete**. TTC-039: one-name wrapper
- lifecycle ownership &gt; isPosix (describe (describe.if), 183-183): **delete**. its one test goes
- lifecycle ownership &gt; an installation replaces the folder it owns whole, edits and obsolete files included (test (test), 184-203): **delete**. no swap; the frozen install of the package manager owns the folder contents

## `tests/cli/lifecycle/ownership/json.test.ts`

- (the file) (file): **move** to `tests/unit/cli/ownership/managed-keys/json.test.ts`. key edits in your files (lifecycle/merge today) go to ownership/managed-keys.ts; JSON and TOML tests together exceed 300 lines and split by format
- JSON field ownership survives reopen, updates and removal while keeping unrelated bytes and modes (test (test), 12-45): **keep** to `tests/unit/cli/ownership/managed-keys/json.test.ts` `managed JSON keys survive reopening, updates and removal and keep other bytes and the mode`. real; LIF-059 drops the format assertion; TEL-052 two using blocks
- JSON ownership leaves edited managed fields and their records intact during update and restoration (test (test), 47-68): **keep** to `tests/unit/cli/ownership/managed-keys/json.test.ts` `an edited managed JSON key and its record stay as they are on update and give-back`. real
- JSONC merges retain comments, authored containers and array order while removing created parents (test (test), 70-84): **keep** to `tests/unit/cli/ownership/managed-keys/json.test.ts` `JSONC key edits keep comments, your containers and array order, and remove parents gspot created`. real
- JSON ownership rejects invalid authored package text without writes: %s (test (test.each), 86-99): **keep** to `tests/unit/cli/ownership/managed-keys/json.test.ts` `invalid package.json text is refused without writing: %s`. real
- \['', '\[\]', 'false', '{"stylelint":', '{ /\* comment \*/ "stylelint": {} }'\] (test (test.each), 86-86): **keep** to `tests/unit/cli/ownership/managed-keys/json.test.ts` `['', '[]', 'false', '{"stylelint":', '{ /* comment */ "stylelint": {} }']`. table of the kept test; 'false' reaches the same not-an-object branch as '\[\]', so '', '\[\]', '{"stylelint":' and the comment row stay, a list of short strings in the test file
- JSON ownership refuses a scalar parent and a persisted native-format mismatch (test (test), 101-121): **delete**. weak: half the test plants a recorded format that only a hand edit can make

## `tests/cli/lifecycle/ownership/preservation/blocks.test.ts`

- (the file) (file): **move** to `tests/unit/cli/ownership/plans/blocks.test.ts`. planBlock tests (ownership/plans.ts), TEL-011 blocks file
- managed block updates and removal preserve authored bytes and subsequent surrounding edits (test (test), 9-32): **keep** to `tests/unit/cli/ownership/plans/blocks.test.ts` `managed block updates and removal keep your text around the block`. real; TEL-052 two using blocks
- removing a block restores an originally empty file instead of deleting it (test (test), 34-44): **keep** to `tests/unit/cli/ownership/plans/blocks.test.ts` `removing a block restores an originally empty file instead of deleting it`. real

## `tests/cli/lifecycle/ownership/preservation/configuration.test.ts`

- (the file) (file): **split** to `tests/unit/cli/ownership/managed-keys/toml.test.ts; tests/unit/cli/ownership/plans/restore.test.ts`. TEL-011, TEL-028, TEL-029
- shared TOML updates preserve comments and later authored settings through removal (test (test), 14-45): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `a managed TOML key keeps nearby edits through update and removal`. TEL-029: the other copies of this scenario are deleted as duplicates; TEL-052
- leaving TOML keys restores their original values and preserves authored changes (test (test), 47-84): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `removing managed TOML keys puts back their old values and keeps your edits`. real
- nested TOML ownership preserves authored entries and comments through updates and removal (test (test), 86-128): **delete**. duplicate (TEL-029): the update-and-removal scenario of row 277 with a nested key
- adopting identical authored configuration restores its bytes and permissions (test (test), 130-144): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `adopting identical TOML keys and giving them back keeps the bytes and mode`. real
- identical unrecorded blocks and configuration fields survive adoption, later edits, and restoration (test (test), 146-175): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `identical unrecorded blocks and keys survive adoption, later edits and give-back`. real
- shared TOML removes created empty parents and preserves authored empty parents (test (test), 177-216): **keep** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `managed TOML keys remove the empty parents gspot created and keep yours`. real; TEL-052 using
- ownership refuses malformed $path without changing authored bytes or records: $source (test (test.each), 218-231): **delete**. TEL-028: repeats the managed-block parser rows
- MALFORMED_BLOCKS (test (test.each), 218-218): **delete**. table of the deleted test
- restoration names malformed files and preserves their bytes and ownership records (test (test), 233-261): **move** to `tests/unit/cli/ownership/plans/restore.test.ts` `giving back a malformed file names it and keeps its bytes and records`. real; planRestoration
- TOML task ownership restores original tasks with $name (test (test.each), 263-294): **delete**. duplicate (TEL-029): putting back overwritten keys is checked by row 278 (removing managed TOML keys puts back their old values), kept comments and nearby edits by row 277
- TASK_RESTORATION_CASES (test (test.each), 263-263): **delete**. duplicate (TEL-029): table of the deleted TOML task test

## `tests/cli/lifecycle/ownership/preservation/restoration.test.ts`

- (the file) (file): **move** to `tests/unit/cli/ownership/plans/restore.test.ts`. planRestoration tests (ownership/plans.ts), TEL-011 restore file
- lifecycle ownership (describe (describe), 127-142): **delete**. TTC-039, TPP-028: tests written as normal test calls
- lifecycle ownership &gt; giving back a twice replaced file deletes it, keeps unowned files, and keeps the log private (test (test.skipIf), 128-131): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `giving back a twice replaced file deletes it, keeps files gspot does not own, and keeps the log private`. TPP-028 normal test; TEL-062 plain text instead of special bytes
- lifecycle ownership &gt; !isPosix (test (test.skipIf), 128-128): **delete**. TEL-034: getKeptMode already maps Windows modes
- lifecycle ownership &gt; installed executable links run, giving them back deletes them, and later edits stay (test (test.skipIf), 133-136): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `installed program links run, giving them back deletes them, and later edits stay`. real
- lifecycle ownership &gt; !isPosix (test (test.skipIf), 133-133): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `isWindows`. TEL-034 kept gate (runs links with POSIX modes), named isWindows
- lifecycle ownership &gt; a regular file containing a link target is preserved after replacing an installed link (test (test.skipIf), 138-141): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `a regular file that holds a link target is kept after an installed link is replaced`. real
- lifecycle ownership &gt; !isPosix (test (test.skipIf), 138-138): **delete**. no reason stated, and links work on the Windows runner
- removing a managed block restores the original state when $name (test (test.each), 144-155): **delete**. TEL-030: repeats the block tests
- BLOCK_CASES (test (test.each), 144-144): **delete**. TEL-030
- giving back the last file of a folder removes the folders it leaves empty (test (test), 157-175): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `giving back the last file of a folder removes the folders it leaves empty`. real
- restoring an adopted file retains only authored bytes: $name (test (test.each), 177-207): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `giving back an adopted file keeps only your bytes: $name`. real; glossary retires authored
- ADOPTED_FILE_CASES (test (test.each), 177-177): **keep** to `tests/unit/cli/ownership/plans/restore.test.ts` `ADOPTED_FILE_CASES`. the rows come from tests/config/generated-files.ts
- Windows permission projection supports repeated log writes, idempotent replacement, and removal (test (test), 209-236): **delete**. TEL-004: fake Windows in a child process; CI runs real Windows
- a replaced file keeps no copy, and giving it back deletes it (test (test), 238-256): **delete**. TEL-030: repeats the twice-replaced test
- replacedFiles (function, 15-51): **inline** to `tests/unit/cli/ownership/plans/restore.test.ts` `giving back a twice replaced file deletes it, keeps files gspot does not own, and keeps the log private`. TPP-028
- installedLinks (function, 53-102): **inline** to `tests/unit/cli/ownership/plans/restore.test.ts` `installed program links run, giving them back deletes them, and later edits stay`. TPP-028
- regularReplacement (function, 104-125): **inline** to `tests/unit/cli/ownership/plans/restore.test.ts` `a regular file that holds a link target is kept after an installed link is replaced`. TPP-028

## `tests/cli/lifecycle/ownership/recovery/batches.test.ts`

- (the file) (file): **move** to `tests/unit/cli/ownership/log.test.ts`. interrupted writes and their recovery (recoverPending, writeBatch) go to ownership/log.ts; TEL-011 recovery file
- an interrupted batch keeps each published file, and the next batch finishes it (%s) (test (test.each), 11-52): **keep** to `tests/unit/cli/ownership/log.test.ts` `an interrupted batch keeps each written file, and the next batch finishes it (%s)`. real; glossary retires publish
- \['before', 'after'\] as const (test (test.each), 11-11): **keep** to `tests/unit/cli/ownership/log.test.ts` `['before', 'after'] as const`. table of the kept test
- interrupted batch removal recovers published deletions and retains unprocessed ownership (%s) (test (test.each), 54-95): **keep** to `tests/unit/cli/ownership/log.test.ts` `an interrupted removal batch keeps its deletions and the records it had not reached (%s)`. real
- \['before', 'after'\] as const (test (test.each), 54-54): **keep** to `tests/unit/cli/ownership/log.test.ts` `['before', 'after'] as const`. table of the kept test

## `tests/cli/lifecycle/ownership/recovery/links.test.ts`

- (the file) (file): **delete**. fake: its one test is deleted
- lifecycle ownership (describe (describe), 11-42): **delete**. TTC-039: one-name wrapper
- lifecycle ownership &gt; an interrupted link publication %s rename is kept only when it finished (test (test.skipIf), 12-41): **delete**. fake: the rejects assertion at line 32 has no await, so the after row cannot fail on it
- lifecycle ownership &gt; \['before', 'after'\] as const (test (test.skipIf), 12-12): **delete**. fake: table of the deleted test
- lifecycle ownership &gt; !isPosix (test (test.skipIf), 12-12): **delete**. fake: gate of the deleted test

## `tests/cli/lifecycle/ownership/recovery/replacement.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/ownership/log.test.ts`. TEL-011
- a failed read-only replacement keeps the original bytes and mode with Windows semantics (test (test), 65-78): **delete**. weak (TEL-004): a fake Windows built in a child process from mocks
- after %s, a read-only replacement removed on Windows counts as not written, and the next write publishes it (test (test.each), 80-101): **delete**. TEL-004: fake Windows semantics
- \['interruption', 'restoration error'\] as const (test (test.each), 80-80): **delete**. table of the deleted test
- a file edited during an interrupted replacement is kept, and recovery refuses to overwrite it (test (test), 103-110): **keep** to `tests/unit/cli/ownership/log.test.ts` `a file edited during an interrupted write is kept, and recovery refuses to overwrite it`. TEL-004: through the interruptOwner helper
- an inconsistent interrupted log cannot acquire ownership of current bytes (test (test), 112-142): **delete**. LIF-059: the pending identity self-check goes
- a full disk while logging a batch keeps every file, and the same batch succeeds afterwards (test (test), 144-199): **keep** to `tests/unit/cli/ownership/log.test.ts` `a full disk while recording a batch keeps every file, and the same batch succeeds afterwards`. real; TEL-062 inline the batch bytes
- implementation (const, 15-15): **inline** to `tests/unit/cli/ownership/log.test.ts` `a full disk while recording a batch keeps every file, and the same batch succeeds afterwards`. one user after TEL-004; the path becomes ownership/log.ts
- boundary (const, 16-16): **inline** to `tests/unit/cli/ownership/log.test.ts` `a full disk while recording a batch keeps every file, and the same batch succeeds afterwards`. one user after TEL-004; the path becomes system/safe-folder/open.ts
- publish (function, 18-63): **delete**. TEL-004: child program with fake Windows

## `tests/cli/lifecycle/reconcile.test.ts`

- (the file) (file): **delete**. weak: its one test is deleted
- reconciliation retains CSS tooling for embedded styles in $path (test (test.each), 10-34): **delete**. weak: runs a copy of the applyCommand body, not applyCommand
- COMPONENTS (test (test.each), 10-10): **delete**. weak: table of the deleted test

## `tests/cli/lifecycle/shared-document.test.ts`

- (the file) (file): **delete**. TEL-031
- shared output readers reject external links (test (test), 8-18): **delete**. TEL-019, TEL-031
- malformed shared TOML fails inspection (test (test), 20-27): **delete**. TEL-031: repeats the malformed-TOML refusals in managed-keys

## `tests/cli/lifecycle/version-pin.test.ts`

- (the file) (file): **move** to `tests/unit/cli/apply/version-pin.test.ts`. read, write and assert of the pin go to apply/version-pin.ts (LIF layout)
- the version pin is written, read, and refused when it differs (test (test), 16-43): **keep** to `tests/unit/cli/apply/version-pin.test.ts` `the version pin is written, read, and refused when it differs`. TEL-038: expect(...).toThrow plus one code check; INS-009 message text; assertVersionPin takes no runner argument, and the install line follows the start command (npm install --save-dev --save-exact @gspothq/cli@9.9.9, or mise use npm:@gspothq/cli@9.9.9), never npm install --global (INX-002, INX-003, INX-005)
- a different saved version refuses check and doctor reports both remedies until apply repairs it (test (test), 45-63): **keep** to `tests/unit/cli/apply/version-pin.test.ts` `a different saved version makes check, doctor and apply refuse until the pin file is deleted`. the test checks only the exit code of doctor, not its text, so the title does not promise that doctor names both fixes; the expected check output names the dev-dependency or mise install line, not npm install --global (INX-005)
- a different pin names the %s install before the explicit upgrade (test (test.each), 65-76): **delete**. weak (TEL-038): five of six rows copy PIN_INSTALL_COMMANDS
- PIN_INSTALLATIONS (test (test.each), 65-65): **delete**. weak (TEL-038): table of the deleted test
- { version: RUNNING_VERSION } (const, 14-14): **move** to `tests/unit/cli/apply/version-pin.test.ts` `RUNNING_VERSION`. used by two tests; it is read from the CLI package.json at load time, so it stays in the test file

## `tests/config/cli/execution/check-input.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. TEL-041: one user; test data, so the execution topic file in tests/config/
- SOURCE_CORRECTIONS (const exported, 2-19): **move** to `tests/config/execution.ts` `SOURCE_EDITS`. TEL-041; the SQL row is not added (its test is deleted as a duplicate, TEL-033); TEL-040: the structural field goes; glossary retires correction; test data, not a single short literal, so tests/config/

## `tests/config/cli/execution/command/failures.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. TEL-041: one user; test data, so the execution topic file in tests/config/
- ESLINT_CRASH (const exported, 1-7): **move** to `tests/config/execution.ts` `ESLINT_CRASH`. TEL-041; test data, so tests/config/
- ESLINT_TOOL (const exported, 9-14): **move** to `tests/config/execution.ts` `ESLINT_TOOL`. TEL-041; test data, so tests/config/

## `tests/config/cli/execution/command/findings.ts`

- (the file) (file): **split** to `tests/config/execution.ts; tests/unit/cli/execution/command/output.test.ts`. the shared check records BASE_CHECK and FAILED_RUN, LOCATED_CHECK and FILELESS_CHECKS go to tests/config/execution.ts, the check records of the execution tests (THR-031), and the two one-line paths stay in the test file; no 'satisfies CheckDeclaration' import, since tests/config imports only tests/config
- BASE_CHECK (const exported, 3-12): **move** to `tests/config/execution.ts` `BASE_CHECK`. THR-031: users are output.test.ts, the parser output tests and tests/setup/check-input.ts, so the shared value goes to tests/config/execution.ts; tests/config imports only tests/config, so it drops its CheckDeclaration annotation and is written as const, and the test that reads it checks the type
- EMPTY_FAILURE (const exported, 13-13): **move** to `tests/config/execution.ts` `FAILED_RUN`. a failed process result with empty output; users are output.test.ts and the parser output tests, so it sits with the check records of the execution tests in tests/config/execution.ts
- LOCATED_CHECK (const exported, 15-18): **move** to `tests/config/execution.ts` `LOCATED_CHECK`. TEL-041: one user; test data, so tests/config/; it spreads BASE_CHECK from the same file; it drops its CheckDeclaration annotation and is written as const, since tests/config imports only tests/config, and the test that reads it checks the type
- FILELESS_CHECKS (const exported, 20-32): **move** to `tests/config/execution.ts` `FILELESS_CHECKS`. TEL-041, TEL-060; test data, so tests/config/; it drops its CheckDeclaration annotation and is written as const, since tests/config imports only tests/config, and the test that reads it checks the type
- FALSE_PATH (const exported, 34-34): **inline** to `tests/unit/cli/execution/command/output.test.ts` `FALSE_PATH`. TEL-041; a single short literal used by one test file, so it stays in that file
- REAL_PATH (const exported, 36-36): **inline** to `tests/unit/cli/execution/command/output.test.ts` `REAL_PATH`. TEL-041; a single short literal used by one test file, so it stays in that file

## `tests/config/cli/execution/copy.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. LINKS goes with the deleted weak tracked-links tests, so only WORKSPACE_SOURCE_FILES is left (TEL-041), and it goes to the execution topic file in tests/config/
- LINKS (const exported, 2-7): **delete**. weak: data used only by the deleted tracked-links tests
- WORKSPACE_SOURCE_FILES (const exported, 9-30): **move** to `tests/config/execution.ts` `WORKSPACE_SOURCE_FILES`. TEL-041: one user; workspace is the npm workspace; 22 lines of sample files, so tests/config/

## `tests/config/cli/execution/errors.ts`

- (the file) (file): **delete**. SUP-012
- NON_ERROR_FAILURES (const exported, 1-4): **delete**. SUP-012

## `tests/config/cli/execution/fixers/isolation.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. TEL-041; test data, so the execution topic file in tests/config/
- SCRATCH_FAILURES (const exported, 2-5): **move** to `tests/config/execution.ts` `SCRATCH_FAILURES`. TEL-041; test data, so tests/config/

## `tests/config/cli/execution/fixers/outcomes.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. TEL-041; test data, so the execution topic file in tests/config/
- FIXER_OUTCOMES (const exported, 2-40): **move** to `tests/config/execution.ts` `FIXER_OUTCOMES`. TEL-041; test data, so tests/config/

## `tests/config/cli/execution/fixers/passes.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. TEL-041; test data, so the execution topic file in tests/config/
- TEXT_CHECK (const exported, 2-3): **move** to `tests/config/execution.ts` `TEXT_CHECK`. TEL-041; a long one-line script, not a short literal, so tests/config/
- TEXT_FIX (const exported, 5-6): **move** to `tests/config/execution.ts` `TEXT_FIX`. TEL-041; a long one-line script, not a short literal, so tests/config/

## `tests/config/cli/execution/fixers/policy-layout.ts`

- (the file) (file): **move** to `tests/config/settings/file.ts`. TEL-041; the gspot/settings-format fix rewrites the layout of gspot.toml, so its data joins the settings file data in tests/config/settings/file.ts, one topic: writing gspot.toml
- POLICY_LAYOUT_CASES (const exported, 2-21): **move** to `tests/config/settings/file.ts` `SETTINGS_FORMAT_CASES`. TEL-041; glossary: gspot/settings-format; tools.&lt;tool&gt;.verbatim becomes extra in the rows, written { value = {...}, reason = "..." }, and the \[reasons\] table goes (CFR-002); data about writing gspot.toml, so tests/config/settings/file.ts
- POLICY_LAYOUT_EXTERNAL_EDIT (const exported, 23-23): **delete**. TEL-008: goes with its test
- POLICY_LAYOUT_UNREPRESENTABLE (const exported, 25-26): **move** to `tests/config/settings/file.ts` `UNREPRESENTABLE_SETTINGS`. TEL-041; tools.&lt;tool&gt;.verbatim becomes extra, written { value = {...}, reason = "..." }, and the \[reasons\] table goes (CFR-002); data about writing gspot.toml, so tests/config/settings/file.ts

## `tests/config/cli/execution/impact.ts`

- (the file) (file): **move** to `tests/config/planning.ts`. TEL-041; its test is a planning test, so the planning topic file in tests/config/
- PROJECT_PATH_IGNORES (const exported, 2-43): **move** to `tests/config/planning.ts` `PROJECT_PATH_IGNORES`. TEL-041; test data, so tests/config/

## `tests/config/cli/execution/prerequisites.ts`

- (the file) (file): **move** to `tests/config/site.ts`. the site build readers stay a literal list (THR-028), in the site topic file in tests/config/
- SITE_CONSUMERS (const exported, 1-9): **move** to `tests/config/site.ts` `BUILD_OUTPUT_CHECKS`. the expected checks are a literal list, since expected values are not computed from product data (THR-028); plain name: the checks that read the built site ('consumer' is a retired word)

## `tests/config/cli/execution/scopes.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. TEL-041; test data, so the execution topic file in tests/config/
- READERS_HEADERS (const exported, 3-4): **move** to `tests/config/execution.ts` `HEADERS_FILE`. TEL-041; readers is jargon; sample text, so tests/config/
- EXPECTED_READERS (const exported, 6-35): **move** to `tests/config/execution.ts` `SCOPE_FINDINGS`. TEL-041; site/dead-assets becomes site/unused-assets (glossary); test data, so tests/config/; tests/config imports only tests/config, so the value drops its ScopeReaderFindings annotation and is written as const, and the test that reads it checks the type

## `tests/config/cli/execution/tool-runner/adapters.ts`

- (the file) (file): **inline** to `tests/unit/cli/execution/command/check.test.ts`. TEL-041; both values are one-line scripts built from process.execPath, so they stay in the test file
- PASSING_SCRIPT (const exported, 2-2): **inline** to `tests/unit/cli/execution/command/check.test.ts` `PASSING_SCRIPT`. TEL-041
- FAILING_SCRIPT (const exported, 4-4): **inline** to `tests/unit/cli/execution/command/check.test.ts` `FAILING_SCRIPT`. TEL-041

## `tests/config/cli/execution/tool-runner/output.ts`

- (the file) (file): **inline** to `tests/unit/cli/execution/command/output.test.ts`. TEL-041; a single short literal used by one test file, so it stays in that file
- HEADER_FAILURE (const exported, 1-2): **inline** to `tests/unit/cli/execution/command/output.test.ts` `HEADER_FAILURE`. TEL-041

## `tests/config/cli/lifecycle/apply.ts`

- (the file) (file): **move** to `tests/config/generated-files.ts`. TEL-041; apply input data goes to the generated-files topic file in tests/config/, and the installed tool folders to tools
- EXTERNAL_INPUT_CASES (const exported, 2-15): **move** to `tests/config/generated-files.ts` `EXTERNAL_INPUT_CASES`. TEL-041; apply input data, so tests/config/generated-files.ts

## `tests/config/cli/lifecycle/hooks.ts`

- (the file) (file): **move** to `tests/config/hooks.ts`. TEL-041; test data, so tests/config/hooks.ts, without the CLI_PINS import from the CLI package
- HOOK_REPOSITORIES (const exported, 4-27): **move** to `tests/config/hooks.ts` `HOOK_REPOSITORIES`. TEL-041; test data, so tests/config/; the runner field becomes the files that pick the start command: a package.json with a @gspothq/cli dev dependency, or none for mise exec (INX-003)
- MISE_INSTALL_RESULT (const exported, 30-36): **move** to `tests/config/hooks.ts` `MISE_INSTALL_RESULT`. TEL-041; test data, so tests/config/; the fake mise output writes the literal stdout 'mise 9999.0.0' (any version above the mise pin) instead of importing CLI_PINS, which tests/config may not import

## `tests/config/cli/lifecycle/ownership/installations.ts`

- (the file) (file): **move** to `tests/config/tools.ts`. only INSTALLATIONS stays (SWAP_CASES goes); TEL-041; its test joins apply/write.test.ts (S05-003), and installed tool folders are the tools topic in tests/config/
- SWAP_CASES (const exported, 2-9): **delete**. its swap test goes
- INSTALLATIONS (const exported, 12-15): **move** to `tests/config/tools.ts` `TOOL_FOLDERS`. TEL-041; glossary: installed tool folder, not installation; test data, so tests/config/tools.ts; its test follows pruneToolFolders into apply/write.test.ts

## `tests/config/cli/lifecycle/ownership/preservation/configuration.ts`

- (the file) (file): **delete**. duplicate (TEL-029): its one constant goes with the deleted TOML task test
- TASK_RESTORATION_CASES (const exported, 2-10): **delete**. duplicate (TEL-029): data used only by the deleted TOML task test

## `tests/config/cli/lifecycle/ownership/preservation/restoration.ts`

- (the file) (file): **move** to `tests/config/generated-files.ts`. TEL-041; the ownership log records generated files, one topic with apply and the generated-file check, so tests/config/generated-files.ts
- BLOCK_CASES (const exported, 2-5): **delete**. TEL-030
- ADOPTED_FILE_CASES (const exported, 7-11): **move** to `tests/config/generated-files.ts` `ADOPTED_FILE_CASES`. TEL-041; generated-file data, so tests/config/generated-files.ts

## `tests/config/cli/lifecycle/reconcile.ts`

- (the file) (file): **delete**. weak: its one constant goes with the deleted reconcile test
- COMPONENTS (const exported, 1-4): **delete**. weak: data used only by the deleted reconcile test

## `tests/config/cli/lifecycle/rule-preview.ts`

- (the file) (file): **move** to `tests/config/rule-capture.ts`. TEL-041; the data of the rule capture (generation/rule-capture.ts) goes to tests/config/rule-capture.ts, while eslint/lint-rules.ts holds the ESLint lint rules
- RULE_PREVIEW_CASES (const exported, 4-38): **move** to `tests/config/rule-capture.ts` `RULE_CHANGE_CASES`. TEL-040, TEL-041; glossary dry run, not preview; test data, so tests/config/rule-capture.ts; tests/config imports only tests/config, so the value drops its RulePreviewCase annotation (the type is deleted) and is written as const, and the test that reads it checks the type

## `tests/config/cli/lifecycle/version-pin.ts`

- (the file) (file): **delete**. weak (TEL-038): its one constant goes with the deleted pin table test
- PIN_INSTALLATIONS (const exported, 2-9): **delete**. weak (TEL-038): data used only by the deleted pin table test

## `tests/types/cli/execution.ts`

- (the file) (file): **delete**. TEL-041: the table is written as const
- ScopeReaderFindings (type exported, 5-9): **delete**. TEL-041: one type for one data file

## `tests/types/cli/lifecycle.ts`

- (the file) (file): **delete**. TEL-040, TEL-041
- RulePreviewCase (type exported, 5-14): **delete**. TEL-040: exists only for the dropped fields

## `tests/types/cli/reconciliation.ts`

- (the file) (file): **inline** to `tests/unit/cli/commands/reconcile/settings.test.ts`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; its one user, mockNpmCommands, is in the settings file; TCM-018: one user
- NpmLockfile (type exported, 2-2): **inline** to `tests/unit/cli/commands/reconcile/settings.test.ts` `mockNpmCommands`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; its one user, mockNpmCommands, is in the settings file; TCM-018: Disposable & { directories: string\[\] } is written as the inline return type of mockNpmCommands, so no tests/types/ file is needed
