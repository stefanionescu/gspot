# Unit tests of execution, install, apply, and ownership

These are the unit tests of the code that runs checks and fixers, makes scratch copies, writes generated files, sets
up Git hooks, and keeps the ownership log (today `tests/cli/execution/` and `tests/cli/lifecycle/`, with their data in
`tests/config/cli/{execution,lifecycle}/` and types in `tests/types/cli/`), plus the test of the check report printer.
The target: each test sits at the path of the source file it tests under `tests/unit/cli/` (`execution/`, `apply/`,
`install/`, `ownership/`), every weak, fake, duplicate, or self-policing test is deleted, and test data lives in
`tests/config/<topic>.ts`. No new test is planned.

## Target layout

```text
tests/unit/cli/
  execution/
    built-in.test.ts             check inputs and the files each built-in check in a scope reads
    run.test.ts                  results reported as each check ends; a built-in check that throws
    ignores.test.ts              applyIgnores, and a path ignore that does not reach the scopes below
    command/
      batches.test.ts            file batches (Windows quoting, Unicode byte limit)
      check.test.ts              runCheckCommand: tools, versions, signals, companion programs, command checks
      output.test.ts             checkedFindings, declared exit codes, crash patterns, header lines
      placeholders.test.ts       file markers, workspace expansion, tool file inputs of a scope
    copy/
      dependencies.test.ts       dependency trees in revision copies
      revision.test.ts           revision copies: nested gspot.toml, gitlinks, a hook in a linked worktree
      scratch.test.ts            scratch copies of the working tree
    fixes/
      scratch-copies.test.ts     fixes run in a scratch copy (was fixers/isolation and fixers/environment)
      outcomes.test.ts           fix results
      passes.test.ts             fixer passes and the re-checks after --fix (with the ESLint and Stylelint run)
  apply/
    write.test.ts                writing generated files, a fresh clone, tool folders gspot no longer needs
    stale.test.ts                lint rule changes and stray paths
    version-pin.test.ts          the .gspot/version pin
  install/hooks.test.ts          hook plan, setup, and status
  ownership/
    log.test.ts                  interrupted writes and their recovery
    managed-keys/json.test.ts    key edits in your own JSON files
    managed-keys/toml.test.ts    key edits in your own TOML files
    plans/blocks.test.ts         managed blocks
    plans/refusals.test.ts       plans that refuse edited, linked, or stale files
    plans/restore.test.ts        giving back files
  planning/files.test.ts, planning/checks.test.ts, planning/skips.test.ts
  generation/rule-capture.test.ts
  repository/revisions/objects.test.ts
  commands/check/tree/staged.test.ts, commands/check/tree/revisions.test.ts, commands/check/push.test.ts
  checks/framework/site/build.test.ts, checks/language/html.test.ts,
  checks/infrastructure/github-actions.test.ts, checks/general/gspot/settings-format.test.ts
  terminal/check-report.test.ts
tests/config/execution.ts, planning.ts, site.ts, hooks.ts, generated-files.ts, tools.ts, rule-capture.ts,
  settings/file.ts
```

## Findings

### TEL-001: The "output drain" copy test cannot fail

- Where: `tests/cli/execution/copy/files.test.ts:15-53`
- Kind: delete
- Problem: The test claims to prove that copying dependencies lets other process output keep flowing. It copies 2,048
  files while a child prints 8 MiB. If the copy kept gspot from reading the child's output, the child would only pause
  until the copy ended, then finish, and the test would still succeed. The 2,048 files also go through the async `cp`
  call in `copyDependencies`, not through the `WRITE_BATCH` yield loop in `copyInto` that the test was written for.
- Fix: Delete the test. It also removes the only use of `prepareTestCommand` and raw `Bun.spawn` in these tests.
- Size: small

### TEL-003: Hook status opens, checks, and reads a file in four steps, and three tests spy on the `fs` calls

- Where: `packages/cli/src/lifecycle/install/contracts.ts:211-226` (`hookStatus`); `tests/cli/lifecycle/hooks.test.ts:186-316`
- Kind: simplify
- Problem: `hookStatus` only answers "does the user's own hook file contain `gspot check --hook`?" for a status line.
  Commit `0056e1bc5` turned a 3-line check into 16 lines (open with `O_NONBLOCK`, `fstat`, read, close, a `statSync`
  fallback) to quiet a CodeQL file-race alert. Three tests (130 lines, two `eslint-disable n/no-sync` comments) then
  assert which `fs` functions were called with which open-file number and that the file is closed again. They test the
  implementation, not behavior.
- Fix: Read the file once with no separate stat, which has no race:
  `try { return readFileSync(file, 'utf8').includes('gspot check --hook'); } catch (error) { if (code is 'EISDIR') return false; throw error; }`.
  A missing file still throws, as today. The one accepted difference: a hook path that is a named pipe makes the read
  wait, which the `O_NONBLOCK` open avoided. Delete the three `fs`-spy tests (`hooks.test.ts:186-239`, `:241-275`,
  `:276-316`), their table, the two suppressions, and `openSync`, `closeSync`, `fstatSync`, `constants` from the
  import. `hookStatus` moves with the hook code to `install/hooks.ts`.
- Size: medium

### TEL-004: Two test files pretend to be Windows on macOS and Linux

- Where: `tests/cli/lifecycle/ownership/preservation/restoration.test.ts:209-236`;
  `tests/cli/lifecycle/ownership/recovery/replacement.test.ts:18-101`
- Kind: delete
- Problem: These tests start a child Bun process, set `process.platform = 'win32'`, and (in `replacement.test.ts`)
  replace `node:fs` so `renameSync` throws `EPERM` on read-only files, the way Windows does. That builds a fake
  Windows out of mocks, in 120 lines of program text. CI already runs every test on real `windows-2025`, where the
  normal tests run the real Windows branch of `fileMode` and `mustUnlinkFirst`.
- Fix: Delete `restoration.test.ts:209-236`, the two fake-Windows tests of `replacement.test.ts` (`:65-78`, `:80-101`)
  with their table, and the child program `publish` (`:18-63`). Keep "a file edited during an interrupted write is
  kept" (`:103-110`), written with the `interruptOwnershipWrite` helper, in `tests/unit/cli/ownership/log.test.ts`.
- Size: medium

### TEL-005: A test still checks a feature that was deleted on 2026-09-29

- Where: `tests/cli/lifecycle/apply/plans.test.ts:30-45`
- Kind: delete
- Problem: "a bun runner preserves the authored scripts and adds no task of its own" checks that gspot does not add
  `package.json` scripts. gspot stopped writing scripts in `f5d55ed64` ("gspot writes no runner tasks or package
  scripts any more"). The old test asserted the scripts were added; it was flipped to assert their absence instead of
  being deleted. No source writes a `scripts` key.
- Fix: Delete the test and the `PackageJson` import.
- Size: small

### TEL-008: The settings-format race test spies on the function under test

- Where: `tests/cli/execution/fixers/policy-layout.test.ts:54-79`
- Kind: delete
- Problem: The test wraps `emitPolicy` (called by the fix of `gspot/settings-format`, the code under test) and writes
  to `gspot.toml` from inside it, which needs an `eslint-disable n/no-sync`. The behavior it proves, "a write refuses
  a file that changed after it was read", lives in the safe-folder writer and is tested at least five times in the
  ownership and settings tests. It is the only test that shows this fix writes through the guarded writer; that loss
  is accepted.
- Fix: Delete the test, its suppression, and `POLICY_LAYOUT_EXTERNAL_EDIT`. The other tests of this file go to
  `tests/unit/cli/checks/general/gspot/settings-format.test.ts`.
- Size: small

### TEL-009: The `tool-runner/` test folder has no source folder and misuses "runner"

- Where: `tests/cli/execution/tool-runner/` (5 files); `tests/config/cli/execution/tool-runner/` (2 files)
- Kind: merge
- Problem: No source folder is named `tool-runner`. Every test in it calls `execution/command` (`runCheckCommand`,
  `runCheckTool`, `prepareCommand`, `fileBatches`). In the glossary, "runner" names only the program that starts
  gspot in the hooks (npm, pnpm, Yarn, Bun, or mise). So the folder name is wrong twice.
- Fix: Move each test to the file of the source it tests: `runCheckCommand` tests to
  `tests/unit/cli/execution/command/check.test.ts`, argument expansion to `command/placeholders.test.ts`, declared exit
  codes and header lines to `command/output.test.ts`, and the LF line-ending test to `tests/unit/cli/tools/run.test.ts`
  (the conversion lives in `runTool`, EXG-031). Delete both `tool-runner/` folders. The unit tests mirror the source folders; a test folder stays only where it splits the tests of one big source file, such as `tests/unit/cli/execution/fixes/` and `tests/unit/cli/tools/find/`. The one-line scripts
  `PASSING_SCRIPT` and `FAILING_SCRIPT` (built from `process.execPath`) and `HEADER_FAILURE` stay in their test files.
- Size: medium

### TEL-010: `lifecycle/apply/` tests the apply code under a folder that matches no source

- Where: `tests/cli/lifecycle/apply/{eslint-dry-run,plans,publication,rule-preview}.test.ts`
- Kind: move
- Problem: Eleven of the thirteen tests call `applyCommand`, the other two call `writeGeneratedFiles`; the folder
  name matches no source folder, so a reader looking for the apply tests finds them in two places.
- Fix: Put each test beside its source file in `tests/unit/cli/apply/`: `publication.test.ts` and `plans.test.ts:13-28`
  in `write.test.ts`, the version pin write test in `version-pin.test.ts`, and `rule-preview.test.ts` in
  `stale.test.ts`. `eslint-dry-run.test.ts` is deleted (TEL-032). The command's own tests stay in
  `tests/unit/cli/commands/apply.test.ts`.
- Size: medium

### TEL-011: `ownership/` has three thin sub-folders and repeated file names

- Where: `tests/cli/lifecycle/ownership/{conflicts,preservation,recovery}/`, `installations.test.ts`, `json.test.ts`
- Kind: merge
- Problem: Three folders hold 2 or 3 files each, and their names match no source. File names repeat across these
  tests: `links.test.ts` three times, `plans.test.ts` twice, `batches.test.ts` twice. The split between "conflicts"
  and "preservation" is not clear: both test that edited files are kept.
- Fix: Delete the duplicates first (TEL-028 to TEL-031). Then: the plan tests of `ownership/plans.ts` go over 300 lines
  and split by behavior into `tests/unit/cli/ownership/plans/refusals.test.ts` (conflicts/plans, conflicts/links),
  `plans/blocks.test.ts` (preservation/blocks, the block test of conflicts/documents), and `plans/restore.test.ts`
  (preservation/restoration, the malformed-file test of preservation/configuration); the key edits in your own files
  go to `ownership/managed-keys/json.test.ts` (json) and `managed-keys/toml.test.ts` (preservation/configuration,
  conflicts/documents); recovery goes to `ownership/log.test.ts`. The one kept test of `installations.test.ts` goes to
  `tests/unit/cli/apply/write.test.ts` (S05-003).
- Size: medium

### TEL-014: `impact.test.ts` is mostly planning tests

- Where: `tests/cli/execution/impact.test.ts`; `tests/cli/execution/fixers/triggers.test.ts`
- Kind: move
- Problem: Most tests of `impact.test.ts` only call `planRun`. `triggers.test.ts` copies the sandbox setup of
  `impact.test.ts:20-59` line for line (same `NESTED_POLICY`, same `git rm`/`git mv`, same `projectChecks` call) and
  only adds two `applyFixers` calls.
- Fix: Move the trigger and input tests to `tests/unit/cli/planning/files.test.ts`, folding the two `applyFixers`
  assertions of `triggers.test.ts` into the last-file trigger test, and move `impact.test.ts:109-127` to
  `tests/unit/cli/planning/checks.test.ts`. Delete `triggers.test.ts`. The helper `projectChecks` moves into
  `planning/files.test.ts`, where all its callers are. `impact.test.ts:80-107` is deleted (LIF-059).
- Size: small

### TEL-015: Full `gspot check` runs sit in `execution/copy/`, and the push setup is written three times

- Where: `tests/cli/execution/copy/{hash-formats,letter-case,links}.test.ts`; `tests/cli/commands/check/pre-push.test.ts`
- Kind: move
- Problem: These run the whole CLI (`checkReport`, `runGspot`) with `--staged` or `--hook pre-push`. They are command
  tests. The "commit, set `refs/remotes/origin/main`, pipe `refs/heads/main <head> refs/heads/main <base>`" setup is
  written out in `hash-formats.test.ts:31-41`, `links.test.ts:51-65`, and the pre-push tests.
- Fix: Move `hash-formats.test.ts` to `tests/unit/cli/commands/check/tree/revisions.test.ts` and `letter-case.test.ts`
  to `commands/check/tree/staged.test.ts` (the tests of `commands/check/tree.ts` go over 300 lines and split by
  behavior). Delete `links.test.ts`: its two tests only check exit 1 and status `failed`, which the always-failing
  check gives anyway. Add one helper `runPrePush(root, base, head)` to `tests/setup/run-gspot.ts` and use it in every
  push test (`tree/revisions.test.ts`, `commands/check/push.test.ts`).
- Size: medium

### TEL-016: `copy/entries.test.ts` test 2 tests Git revision reading and repeats a corrupt-index check

- Where: `tests/cli/execution/copy/entries.test.ts:43-68`
- Kind: move
- Problem: It tests `getHeadEntries`, `getBlobs` and `getEntries` from `repository/revisions`. Its "broken index"
  assertion repeats the repository corrupt-index test; both reach the same `listGitFiles` error ("Git ls-files
  failed"). The whole test is skipped on Windows because of a file name with a newline, but only that part needs
  POSIX.
- Fix: Move it to `tests/unit/cli/repository/revisions/objects.test.ts`. Delete the broken-index lines (`:62-63`).
  Gate only the odd file-name part with `isWindows`; unborn history and broken HEAD run everywhere. The
  `checkOutRevision` lines (`:59-61`), which show that a revision copy keeps an odd file name, go to
  `tests/unit/cli/execution/copy/revision.test.ts`.
- Size: small

### TEL-017: `drift.test.ts` mixes generation and apply tests

- Where: `tests/cli/lifecycle/drift.test.ts:25-91`
- Kind: move
- Problem: Three tests call `collectRules` from `generation/documents/contracts.ts`. Only `compareRules` and the
  stray-path test test the apply code. The file name "drift" fits one test.
- Fix: Move `drift.test.ts:25-51`, `:65-71` and `:73-91` to `tests/unit/cli/generation/rule-capture.test.ts`, with the
  refused rule data as `RULE_CAPTURE_REFUSALS` in `tests/config/rule-capture.ts`. The `compareRules` and stray-path
  tests go to `tests/unit/cli/apply/stale.test.ts`.
- Size: small

### TEL-019: The "link leaves the repository" guard is tested again by every caller

- Where: `tests/cli/execution/command/expansion.test.ts:31-36`, `:92-94`; `tests/cli/execution/fixers/isolation.test.ts:15-40`;
  `tests/cli/lifecycle/apply/publication.test.ts:73-86`; `tests/cli/lifecycle/shared-document.test.ts:8-18`;
  `tests/cli/execution/copy/dependencies.test.ts:89-91`
- Kind: delete
- Problem: The guard lives in the safe-folder code and has its own tests. The messages "private regular file" and
  "Source link leaves the repository" appear in 24 test and test-data files. Most callers add no logic of their own;
  they just call the safe-folder reader.
- Fix: Keep the safe-folder tests and one command-level case: "apply --dry-run refuses an input that links outside"
  (`publication.test.ts:88-103`, to `tests/unit/cli/apply/write.test.ts`). Delete `publication.test.ts:73-86`,
  `shared-document.test.ts:8-18` (with the file, TEL-031), `isolation.test.ts:15-40` (its other half repeats the
  scratch-copy write test), and the link halves of `expansion.test.ts:31-36`, `:92-94` and
  `dependencies.test.ts:89-91`.
- Size: small

### TEL-021: `taplo.test.ts` repeats the "both output streams" unit test through the whole CLI

- Where: `tests/cli/execution/tool-runner/taplo.test.ts`
- Kind: delete
- Problem: It checks that a crashed tool's message holds stdout and stderr and "exit 2". `failures.test.ts:7-23`
  already tests `toolOutputDetail` for that. This copy needs a fake tool, a Git commit, a `PATH` change, and a full CLI
  run.
- Fix: Delete the file with `TOOL_FAILURES_POLICY`.
- Size: small

### TEL-023: "A dependency link that points at nothing" is tested twice

- Where: `tests/cli/execution/copy/files.test.ts:128-137`; `tests/cli/execution/copy/dependencies.test.ts:71-75`
- Kind: delete
- Problem: Both make a broken link in `node_modules/.bin` and expect `ENOENT` from the same `copyDependencies`.
- Fix: Delete `dependencies.test.ts:71-75` and rename the test at `:53` to "a workspace bin into untracked build output
  is left out of the copy".
- Size: small

### TEL-024: "A source snapshot retains selected inputs" adds nothing

- Where: `tests/cli/execution/copy/files.test.ts:139-160`
- Kind: delete
- Problem: It checks that `copyIntoScratch` copies the listed files and not others. `files.test.ts:162-186` checks the
  same (`unselected.js` absent), and its sample is the same as `check-input.test.ts:43-51`.
- Fix: Delete the test.
- Size: small

### TEL-025: The "batched Unicode arguments" test repeats `fileBatches` and branches on the platform

- Where: `tests/cli/execution/tool-runner/arguments.test.ts:18-40`
- Kind: delete
- Problem: It calls `fileBatches(..., 'win32')`, already tested in `command/batches.test.ts:17-31`, then runs each batch
  through `run` and checks the arguments arrive intact, which tests the process runner, not execution. It also
  branches on `process.platform` to pick the program.
- Fix: Delete it.
- Size: small

### TEL-026: Two batch tests overlap

- Where: `tests/cli/execution/command/batches.test.ts:5-15`, `:33-44`
- Kind: delete
- Problem: Both split 5,000 Linux paths and check order and the byte limit. The second adds Unicode and the two error
  cases. The first is wrapped in a `describe` with one test.
- Fix: Delete the first test and its `describe`. Keep the second as "a long Unicode list splits under the byte limit in
  order, and a path or tool arguments that cannot fit are refused".
- Size: small

### TEL-027: The exit-code CLI test is convoluted and repeats other tests

- Where: `tests/cli/execution/tool-runner/exit-contracts.test.ts:54-115`
- Kind: delete
- Problem: A fake check program reads `status.txt` and a `check-passes` marker to act out four states over four CLI runs, for
  two formats. The declared exit codes are covered by `exit-contracts.test.ts:14-52` (checks),
  `fixers/outcomes.test.ts:42-58` (fixers, five rows), and `command/findings.test.ts:88-122` (typos).
- Fix: Delete the test and its table.
- Size: small

### TEL-028: Malformed managed-block markers are tested ten more times

- Where: `tests/cli/lifecycle/ownership/preservation/configuration.test.ts:218-231`
- Kind: delete
- Problem: It re-runs all 10 rows of `MALFORMED_BLOCKS` through `planBlock`. The managed-block test already runs the
  same rows on the block parser, and `documents.test.ts:48-51` and `configuration.test.ts:252-254` already show that an
  ownership caller refuses bad markers without changing bytes.
- Fix: Delete the test and its import of `MALFORMED_BLOCKS`.
- Size: small

### TEL-029: The TOML "edit a key, edit nearby, update, restore" scenario is written four times

- Where: `tests/cli/lifecycle/ownership/preservation/configuration.test.ts:14-45`, `:86-128`, `:263-294`;
  `tests/cli/lifecycle/ownership/conflicts/documents.test.ts:56-78`
- Kind: delete
- Problem: Each test edits a key in a TOML file, edits another key, updates or restores, and checks the edit survived.
  Only the key shape differs (top level, nested, `[tasks]`).
- Fix: Keep `configuration.test.ts:14-45` as "a managed TOML key keeps nearby edits through update and removal" in
  `tests/unit/cli/ownership/managed-keys/toml.test.ts`. Delete the other three copies and the data of the task copy,
  `TASK_RESTORATION_CASES` (`tests/config/cli/lifecycle/ownership/preservation/configuration.ts`).
- Size: medium

### TEL-030: Restoration tests repeat each other and the block tests

- Where: `tests/cli/lifecycle/ownership/preservation/restoration.test.ts:144-155`, `:238-256`;
  `tests/config/cli/lifecycle/ownership/preservation/restoration.ts:2-5`
- Kind: delete
- Problem: `BLOCK_CASES` (block created the file, or the file was there before) repeats `blocks.test.ts:9-44`. "a
  replaced file keeps no copy, and giving it back deletes it" repeats `restoration.test.ts:15-51`.
- Fix: Delete both tests and `BLOCK_CASES`.
- Size: small

### TEL-031: `shared-document.test.ts` holds two duplicates

- Where: `tests/cli/lifecycle/shared-document.test.ts`
- Kind: delete
- Problem: The link test is a TEL-019 copy. The malformed-TOML test repeats `documents.test.ts:10-18` and
  `configuration.test.ts:255-257` (same `openMergedDocument` error). The name "shared document" is used nowhere in the
  source.
- Fix: Delete the file.
- Size: small

### TEL-032: The rule-change dry run in a scope is tested three times

- Where: `tests/cli/lifecycle/apply/rule-preview.test.ts:111-138`; `tests/cli/lifecycle/apply/eslint-dry-run.test.ts`;
  `tests/config/cli/lifecycle/rule-preview.ts:16-26`
- Kind: delete
- Problem: All three change an ignore and read `drift[].rules` from `apply --dry-run`. The logic is one `compareRules`
  call, tested on its own in `drift.test.ts:12-23`, and `eslint-dry-run.test.ts` also repeats
  `rule-preview.test.ts:15-41` (the dry-run rule change and the record update after apply).
- Fix: Delete `rule-preview.test.ts:111-138` and `eslint-dry-run.test.ts`.
- Size: small

### TEL-033: The SQL session-reuse test repeats test 1 and is skipped on Windows for no reason

- Where: `tests/cli/execution/check-input.test.ts:101-132`
- Kind: delete
- Problem: It checks that a session that runs again reads edited source, like the `SOURCE_CORRECTIONS` test at
  `:14-39`. It uses the file name `app/café\nquery.sql`, which forces `skipIf(!isPosix)`, and the newline adds nothing
  to what the test claims.
- Fix: Delete the test and its gate.
- Size: small

### TEL-034: Platform gates that are not needed

- Where: `tests/cli/lifecycle/ownership/preservation/restoration.test.ts:128-131`;
  `tests/cli/lifecycle/ownership/conflicts/links.test.ts:10`; `tests/cli/execution/tool-runner/arguments.test.ts:158-196`
- Kind: delete
- Problem: `restoration.test.ts:128`: "twice replaced file" already maps modes for Windows. `conflicts/links.test.ts:10`:
  other link tests in these files run on Windows (`dependencies.test.ts:35`, `expansion.test.ts:33`).
  `arguments.test.ts:158`: the gate exists only because the fake tools use `#!` lines, and `fakeTool` already writes
  `.cmd` wrappers for Windows.
- Fix: Remove the first two gates. Write the fake tools of the companion-program test with `fakeTool` and drop its
  gate. The gates that stay are needed and are written with `isWindows`: `adapters.test.ts:96` (permission bits),
  `arguments.test.ts:134` (signals), `conflicts/plans.test.ts:184` (the mode row), `restoration.test.ts:133` (runs
  links with POSIX modes).
- Size: small

### TEL-035: The minimum-version test is skipped on Windows because of the Ansible platform list

- Where: `tests/cli/execution/tool-runner/adapters.test.ts:74-93`
- Kind: delete
- Problem: The test uses a fake `ansible-lint` script, not the real tool. It needs `hasToolBuild('ansible-lint')` only
  because the Ansible manifest lists `macos` and `linux`, so the planner skips the check on Windows. The test is about
  "a tool below its minimum version is missing". The word "adapter" is not used in the source.
- Fix: Use a test manifest (`buildManifest` in `tests/setup/manifest.ts`) with one tool that has `min_version`, and a
  fake tool from `fakeTool`. Drop the gate. Name the test "a tool below its minimum version is reported missing"
  (in `tests/unit/cli/execution/command/check.test.ts`).
- Size: small

### TEL-036: A test hard-codes which platforms the Swift checks support

- Where: `tests/cli/execution/impact.test.ts:109-127`
- Kind: simplify
- Problem: The expected skip cause branches on `process.platform` for `swift/build` and `swift/periphery`, copying the
  Swift manifest's platform table into the test. The point of the test (a project check with no inputs of its own is
  inactive) does not need Swift.
- Fix: Keep only `python/ruff` and drop both branches. The test goes to `tests/unit/cli/planning/checks.test.ts`.
- Size: small

### TEL-037: The letter-case test runs only one of its two halves on any machine

- Where: `tests/cli/execution/copy/letter-case.test.ts:12-64`
- Kind: simplify
- Problem: It checks whether the disk folds letter case, then checks one outcome or the other. macOS CI only ever runs
  the "refuse" half; Linux CI only the "keep both" half. This is a hidden platform gate, and the test name promises
  both.
- Fix: Split it into two tests: "staged paths that differ only by letter case keep both spellings" with
  `skipIf(caseFolding)`, and "a case-folding disk refuses them" with `skipIf(!caseFolding)`, so the skip is visible.
  Both go to `tests/unit/cli/commands/check/tree/staged.test.ts` (TEL-015).
- Size: small

### TEL-038: The version-pin table test restates a constant, and test 1 uses a hand-written `try/catch`

- Where: `tests/cli/lifecycle/version-pin.test.ts:35-42`, `:65-76`; `tests/config/cli/lifecycle/version-pin.ts`
- Kind: delete
- Problem: Five of the six rows of the table test copy `PIN_INSTALL_COMMANDS` one entry at a time, so the test fails
  when a constant changes, not when the code breaks. `assertVersionPin` no longer takes a runner argument (INX-003).
  Test 1 uses a 7-line `try/catch` where one `expect(...).toThrow(...)` works.
- Fix: Delete the table test and `PIN_INSTALLATIONS`. In test 1, write
  `expect(() => assertVersionPin(root)).toThrow(...)` with the message that INS-009 sets, plus a one-line check of the
  error's `pin` code (a plain `toThrow` cannot check it). Do after INS-009. The test goes to
  `tests/unit/cli/apply/version-pin.test.ts`.
- Size: small

### TEL-040: Test data with fields that never vary

- Where: `tests/config/cli/lifecycle/rule-preview.ts` (`initialLevel`, `proposedLevel`); `tests/types/cli/lifecycle.ts`;
  `tests/config/cli/execution/check-input.ts` (`structural`)
- Kind: simplify
- Problem: `initialLevel` and `proposedLevel` are `'all'` in all three rows. `structural` is
  `'structure/trivial-functions'` in both rows. The type `RulePreviewCase` exists only for these fields.
- Fix: Drop the fields: `RULE_CHANGE_CASES` in `tests/config/rule-capture.ts` and `SOURCE_EDITS` in
  `tests/config/execution.ts` are written `as const` without them. Delete `tests/types/cli/lifecycle.ts`.
- Size: small

### TEL-041: Twenty-four one-reader data and type files mirror the test tree

- Where: `tests/config/cli/execution/**` (14 files), `tests/config/cli/lifecycle/**` (8 files);
  `tests/types/cli/{terminal,execution,lifecycle,reconciliation}.ts`
- Kind: merge
- Problem: Each data file has exactly one reader, and seventeen are 15 lines or less (`tool-runner/output.ts` is 2
  lines, `errors.ts` and `reconcile.ts` 4, `fixers/isolation.ts` 5). The folders copy the test tree, so a reader opens
  two files to follow one test. Two type files exist only to type one data file.
- Fix: Move the data to topic files by subject: `tests/config/execution.ts` (source edits, crash data, check
  declarations, copy samples, scratch failures, fix outcomes, fix scripts, the findings of checks in a scope), `planning.ts` (path
  ignores, project triggers), `site.ts` (`BUILD_OUTPUT_CHECKS`), `hooks.ts`, `generated-files.ts` (apply input,
  adopted files), `tools.ts` (installed tool folders), `rule-capture.ts`, and `settings/file.ts` (settings-format fix
  rows). A single short literal used by one test file (`FALSE_PATH`, `REAL_PATH`, `HEADER_FAILURE`) and values built
  from code at import time (`PASSING_SCRIPT`, `FAILING_SCRIPT`, `RUNNING_VERSION`) stay in their test file. Rows are
  written `as const`. Delete the four type files and the mirrored folders.
- Size: medium

### TEL-047: Tests pin jargon error messages that users see

- Where: 45 lines in `tests/`, for example `tests/cli/lifecycle/ownership/conflicts/plans.test.ts:31`,
  `recovery/links.test.ts:35`, `apply/publication.test.ts:125`, `installations.test.ts:134`, `:150`; source
  `packages/cli/src/platform/root/{public,reads,contracts,writes}.ts`, `lifecycle/ownership/public.ts:91`,
  `lifecycle/ownership/state/public.ts:70,152,168`
- Kind: rewrite-text
- Problem: Users get messages like "Lifecycle destination changed during the operation: gspot.toml", "Unsafe
  lifecycle parent: …", "Lifecycle destination is not a private regular file: …", "Reopen the lifecycle owner".
  "Lifecycle destination" and "lifecycle owner" mean nothing to a user.
- Fix: Plain messages, for example: "gspot.toml changed while gspot was writing it. Run the command again.";
  ".gspot/obsolete is a link. gspot writes only real folders. Remove the link and run the command again.";
  "linked.toml is a link. gspot reads only regular files." Update the tests in the same change. TCM-030 lists every
  source file.
- Size: medium

### TEL-052: Small style noise in the ownership tests

- Where: 38 blank lines right after `using log = openOwnership(...)`; 6 `let log = openOwnership(...)` with
  `try/finally` and re-assignment (for example `preservation/blocks.test.ts:13-31`); 16 `path: path` / `next: next`;
  9 paths built as `` `${sandbox.path}/…` `` instead of `join` (`scopes.test.ts:77-82`)
- Kind: simplify
- Problem: Leftovers that make each test a few lines longer.
- Fix: Remove the blank lines. Replace `let log` with two `{ using log = … }` blocks. Use `{ path, next }`. Use `join`.
- Size: small

### TEL-054: The `hooksOf` helper is copied in two test files

- Where: `tests/cli/lifecycle/hooks.test.ts:24-29`; `tests/tools/lifecycle/hooks.test.ts:24-27`
- Kind: merge
- Problem: The same four lines are in both. The comment above the first copy is detached by a blank line.
- Fix: Move it to `tests/setup/repository.ts` as `hookContext(root)` and import it in the unit and the integration
  hooks test. It opens a gspot session and does nothing with Git, so it does not belong in `tests/setup/git.ts`.
- Size: small

### TEL-056: The unstaged-count test checks a value that is only handed through

- Where: `tests/cli/execution/git-index.test.ts:38-60`
- Kind: delete
- Problem: The test hands `unstagedChanges: 1` in and reads `unstagedChanges: 1` out of the report. Nothing in between
  can break it.
- Fix: Delete the test. The rest of `git-index.test.ts` goes too (EXG-024), so the file is deleted. No test of the
  printed unstaged line is planned; the "Untested logic" rule decides after the code is cut.
- Size: small

### TEL-058: The canceled-fix test has defensive extras

- Where: `tests/cli/execution/fixers/isolation.test.ts:163-207`
- Kind: simplify
- Problem: `expect(result.status).toBe('failed')` is followed by `if (result.status !== 'failed') throw new Error(...)`
  only so TypeScript knows the result has a `note`. `expect(pid).toBeGreaterThan(0)` is checked again inside
  `waitForExit`.
- Fix: Use `expect(result).toMatchObject({ status: 'failed', note: textContaining('was canceled'), changed: [...] })`
  and drop the `if` and the `pid` check. Keep the `try/finally`: it stops the 10-second child when an assertion
  before it fails, so the sandbox can be deleted.
- Size: small

### TEL-059: A one-line type file for one table in `terminal.test.ts`

- Where: `tests/types/cli/terminal.ts`; `tests/cli/terminal.test.ts:87-91`
- Kind: delete
- Problem: `ComparisonCase` is used once with `satisfies`. The other table in the same file uses `as const`.
- Fix: Use `as const` and delete `tests/types/cli/terminal.ts`.
- Size: small

### TEL-060: Unexplained manifest choice and loop style in `findings.test.ts`

- Where: `tests/cli/execution/command/findings.test.ts:26-30`, `:44-49`, `:97-104`
- Kind: simplify
- Problem: `manifest: configurationManifests().get('files')!` is there only to make `planned.manifest` defined, which
  turns on file checking in `checkedFindings`. Nothing says so. The fileless cases use `for … test(...)` instead of
  `test.each`. The typos JSON at `:97-104` is the same object as `TYPO_REPORT` in the parser data.
- Fix: Add a short comment ("any manifest turns on the real-file check"). Use `test.each(FILELESS_CHECKS)`. Import
  `TYPO_REPORT` from `tests/config/spelling.ts`.
- Size: small

### TEL-061: The version-pin CLI test title promises more than it checks

- Where: `tests/cli/lifecycle/version-pin.test.ts:45-63`
- Kind: rewrite-text
- Problem: The title says "doctor reports both remedies", but the test only checks that doctor exits 1. Adding an
  assertion to rescue the test is not done.
- Fix: Title: "a different saved version makes check, doctor and apply refuse until the pin file is deleted". The
  expected check output names the dev-dependency or mise install line (INX-005).
- Size: small

### TEL-062: Special bytes are written and then deleted before anyone compares them

- Where: `tests/config/samples/ownership.ts:1-6`; `tests/cli/lifecycle/ownership/preservation/restoration.test.ts:18-19`
- Kind: simplify
- Problem: `OWNERSHIP_BYTES.restoration` (NUL, 0xFF, SOH, LF) is written to `config.txt`, which the test then replaces
  twice and deletes. The bytes are never read back, and the comment does not say why they are special. The three byte
  arrays each have one reader.
- Fix: Use plain text in the restoration test. Write the `replacement` and `batch` bytes in the one test that compares
  them ("a full disk while recording a batch keeps every file", `tests/unit/cli/ownership/log.test.ts`). Delete
  `OWNERSHIP_BYTES` and its semicolon comment.
- Size: small

### TEL-063: One-test files named after a field or a single case

- Where: `tests/cli/execution/progress.test.ts`, `ignores.test.ts`, `fixers/environment.test.ts`,
  `copy/gitlinks.test.ts`, `copy/hash-formats.test.ts`, `copy/letter-case.test.ts`, `lifecycle/cloned-output.test.ts`, `tool-runner/exit-contracts.test.ts`
- Kind: merge
- Problem: Each of these files holds one test. Several are named after a field or a single case rather than the
  source file they test.
- Fix: `progress.test.ts` goes to `tests/unit/cli/execution/run.test.ts`; `ignores.test.ts` to
  `execution/ignores.test.ts` (its own source file); `fixers/environment.test.ts` joins
  `execution/fixes/scratch-copies.test.ts`; `copy/gitlinks.test.ts` joins `execution/copy/revision.test.ts`;
  `cloned-output.test.ts` joins `tests/unit/cli/apply/write.test.ts`; `tool-runner/exit-contracts.test.ts` ("contract" says nothing) joins `execution/command/output.test.ts`. TEL-015 moves `hash-formats` and `letter-case`;
  `count-pattern.test.ts` (PAR-005), `errors.test.ts` (SUP-012), `taplo.test.ts` (TEL-021), and `reconcile.test.ts`
  (weak: it runs a copy of the `applyCommand` body) are deleted.
- Size: small

### TEL-066: `hooks.test.ts` overlaps the hook integration test

- Where: `tests/cli/lifecycle/hooks.test.ts:134-165`; `tests/tools/lifecycle/hooks.test.ts:29-63`
- Kind: merge
- Problem: Both use `['', 'app/']` prefixes and check that install points `core.hooksPath` at `<prefix>.gspot/hooks`.
  The unit test then goes on to turn hooks off.
- Fix: The integration test keeps the only "gspot install sets core.hooksPath" test. The unit test
  (`tests/unit/cli/install/hooks.test.ts`) starts from a repository whose hooks are already installed (set
  `core.hooksPath` with `git config`) and keeps only the part that turns hooks off.
- Size: small

### ST3-015: The site build test keeps its expected checks as a literal list

- Where: `tests/cli/execution/prerequisites.test.ts:33-73`; `tests/config/cli/execution/prerequisites.ts` (`SITE_CONSUMERS`)
- Kind: move
- Problem: The test lists the seven site checks that read the built site by hand. Deriving the list from the site
  manifest would compute an expected value from product data, which the test rules forbid (THR-028), and "consumer" is
  a retired word.
- Fix: Keep the literal list as `BUILD_OUTPUT_CHECKS` in `tests/config/site.ts`. The test goes to
  `tests/unit/cli/checks/framework/site/build.test.ts` as "a failed site build skips every check that reads the build".
- Size: small
