# Unit tests of planning, system, repository, and tools

These are the unit tests of four CLI folders: `planning/` (which checks run, on which files, and why a check is
skipped), `system/` (today `platform/`: child processes, the safe folder, the writer lock, globs, managed blocks),
`repository/` (the file list, file kinds, scopes, Git changes, dependency files), and `tools/` (finding tool programs,
reading their versions, the npm and Python tool projects, Vale packages). Today they sit in
`tests/cli/{planning,platform,repository,tools}/`, with 26 data files in a copy of that tree under
`tests/config/cli/`. The target: each test sits at the path of the source file it tests under `tests/unit/cli/`, the
link refusal and level loops are tested once, the tests that mock gspot's own functions or count internal calls go,
and test data lives in `tests/config/<topic>.ts`. No new test is planned.

## Target layout

```text
tests/unit/cli/
  planning/
    checks.test.ts             always-selected checks, typescript/tsc replacements, history checks, ignored checks
    files.test.ts              trigger files, EditorConfig files, lockfile triggers, Next.js build routes
    skips.test.ts              skip causes: no Git, a missing setting, no Windows build, dependency conditions
    needed-tools.test.ts       Node, schema peers, ESLint plugins, coverage providers
  system/                      (was platform/)
    assets.test.ts, environment.test.ts, file-reads.test.ts, files.test.ts (globs), managed-blocks.test.ts
    safe-folder/lock.test.ts, names.test.ts, open.test.ts, reads.test.ts, writes.test.ts
    processes/run.test.ts, processes/stop.test.ts
  repository/
    aliases.test.ts, dependency-files.test.ts, detect.test.ts, find-root.test.ts, kind.test.ts, scopes.test.ts,
    select.test.ts, selectors.test.ts, tags.test.ts, tracked.test.ts
    revisions/changes.test.ts, revisions/push.test.ts
  tools/
    run.test.ts, diagnostics.test.ts, versions.test.ts
    find/programs.test.ts, find/libraries.test.ts
    npm/project/client.test.ts, npm/project/install.test.ts
    python/settings.test.ts, python/project/lockfiles.test.ts, python/project/uv.test.ts
  install/vale.test.ts
  configurations/tool-pins.test.ts
  commands/doctor/command.test.ts, commands/init/command/configurations.test.ts
  execution/copy/revision.test.ts, execution/fixes/passes.test.ts
  parsers/dependency-files.test.ts, parsers/tsconfig.test.ts, rules.test.ts, generation/tool-files.test.ts
tests/config/planning.ts, system.ts, repository.ts, tools.ts, npm.ts, python/tool-project.ts, prose.ts, git.ts,
  formatting.ts, docs.ts, nextjs.ts, init.ts
```

Deleted whole: `platform/writes.test.ts` (LIF-004), `tools/mise-pins.test.ts` (INX-007 deletes the duplicate-pin
check), and the empty folder `tests/types/cli/tools/`.

## Findings

### TPR-001: A planning test can never fail

- Where: `tests/cli/planning/dependencies.test.ts:35-45`
- Kind: delete
- Problem: The test wants to prove that planning does not read a broken `package.json`. It opens the session first,
  then breaks the file. The session already read every dependency file when it opened (`openSession`,
  `commands/public.ts:198`), and planning only uses that copy, so nothing can ever read the broken file, whatever
  planning does.
- Fix: Delete the test.
- Size: small

### TPR-002: Two macOS tests assert that a Bun bug exists

- Where: `tests/cli/platform/root.test.ts:199-241`; `tests/config/cli/platform/root.ts:29-31`;
  `packages/cli/src/platform/root/reads.ts:162-174`; `docs/src/content/docs/guides/requirements.md:27`
- Kind: delete
- Problem: Bun 1.4.2 on macOS cannot find the real path of a folder whose name holds a backslash, and gspot turns that
  into an error in `canonicalPath`. Two tests create such a folder and expect the failure. When Bun fixes its bug, both
  tests fail although gspot did nothing wrong. One of them also runs the whole `list` command in a unit test.
- Fix: Delete both macOS tests and `POSIX_CANONICAL_ROOT` / `POSIX_CANONICAL_SOURCE`. Keep the special case in
  `canonicalPath`: `readText` turns `ENOENT` into "file absent" (`platform/root/public.ts:303`), so without it an
  existing file would be skipped without a word, and an existing root would look like a missing `gspot.toml`. Delete
  the docs sentence at `requirements.md:27` (DOC-060). No replacement test is planned; the "Untested logic" rule
  decides after the code is cut.
- Size: small

### TPR-003: A test changes the shared, cached configuration data and never puts it back

- Where: `tests/cli/planning/requirements.test.ts:15-21`
- Kind: fix-bug
- Problem: The test sets `ruff.min_versions` on the `python/ruff` check. That check object lives in the process-wide
  cache of `configurationManifests()`, so the change stays for every later test in the same Bun process, and results
  can depend on test order.
- Fix: Hand a hand-written check to `checkToolPin` instead of editing the shipped one. The test goes to
  `tests/unit/cli/configurations/tool-pins.test.ts` ("a check's minimum version cannot lower its tool's minimum
  version").
- Size: small

### TPR-004: The hook-stage tests list shipped check names or copy the stage filter

- Where: `tests/cli/planning/selection.test.ts:163-205`; `tests/config/cli/planning/selection.ts:35-60`
- Kind: delete
- Problem: "the complete plan includes %s" checks that 11 shipped check names (`files/taplo`, `swift/periphery`, ...)
  appear in a plan, at both levels: a snapshot of shipped manifest data that fails when someone renames a check, not
  when planning breaks. The stage test beside it builds its expected list by filtering the full plan by each check's
  declared stage, the same rule as `isStageWanted`, so it cannot catch a bug in that rule. "explicitly selects
  TypeScript" only shows what the plan holds anyway.
- Fix: Delete these three tests with `HOOK_STAGE_CHECKS`, `HOOK_STAGES`, `HOOK_STAGE_FILES`, and the `describe` with its
  level table. Its last test, "a check whose tool has no Windows build is skipped on Windows", moves to
  `tests/unit/cli/planning/skips.test.ts` with its own sandbox.
- Size: small

### TPR-005: A test breaks the shipped manifest to reach a guard for broken shipped data

- Where: `tests/cli/tools/python/project.test.ts:113-125`
- Kind: delete
- Problem: The test removes `uv` from the cached `python` manifest so that `pythonInstallerPin()` throws. The shipped
  manifest always pins uv, and the build already checks the manifests. This polices shipped data, and it changes the
  global cache.
- Fix: Delete the test. Keep the one-line throw in `pythonInstallerPin` only because TypeScript needs it.
- Size: small

### TPR-008: The Vale test sits in the wrong folder

- Where: `tests/cli/tools/vale.test.ts`, `tests/config/cli/tools/vale.ts`
- Kind: move
- Problem: Every function it tests (`hasValePackages`, `installValePackages`, `deleteInstallation`) lives in the install
  code, not in `tools/`.
- Fix: Move it to `tests/unit/cli/install/vale.test.ts`, with its data in `tests/config/prose.ts`. Do after LIF-009.
- Size: small

### TPR-009: "A link that leaves the repository is refused" is tested 13 times in 9 files

- Where: `tests/cli/platform/source.test.ts:51-52`, `:116`, `:155`; `tests/cli/repository/aliases.test.ts:20-30`, `:104-117`;
  `tests/cli/repository/kinds.test.ts:129-147`; `tests/cli/repository/package-manifests.test.ts:91-104`, `:113-128`;
  `tests/cli/repository/scopes.test.ts:151-163`; `tests/cli/tools/mise-pins.test.ts:45-58`;
  `tests/cli/tools/npm/client.test.ts:40-52`; `tests/cli/tools/inspect/placement.test.ts:34-45`;
  `tests/cli/planning/selection.test.ts:109-129`
- Kind: delete
- Problem: All of these reach the same guard, `sourcePath()` in `platform/root/reads.ts:183-187`, through
  `readText`/`readSource`. Each caller tests the guard again and also tests again that "a link inside the repository is
  followed".
- Fix: Keep the two read tests (`source.test.ts` L31 and L43, in `tests/unit/cli/system/file-reads.test.ts`), the
  program test (`placement.test.ts:13`, which proves an outside program is never run, in
  `tests/unit/cli/tools/find/programs.test.ts`), and the workspace test (`scopes.test.ts:80`, its own check in
  `packageWorkspaces`). Delete the link parts of the other tests. For `selection.test.ts:109` keep only the linked
  Prettier ignore inside the repository (in `tests/unit/cli/planning/skips.test.ts`).
- Size: medium

### TPR-011: The coverage test runs 60 times to show 4 outcomes

- Where: `tests/cli/planning/selection.test.ts:207-250`; `tests/config/cli/planning/selection.ts:62-83`
- Kind: simplify
- Problem: `COVERAGE_PLUGIN_CASES` has 20 rows (2 tools × 2 levels × 5 limits) and each row runs 3 tests, each with its
  own sandbox. The level never matters (TGN-037), and the four non-zero limits all keep the provider, because
  `coverageArguments` only asks "are all limits zero?" (`planning/contracts.ts:189`).
- Fix: Use 4 rows, `pytest`/`vitest` × `zero`/`lines`, written with the reason form, as `COVERAGE_LIMITS` in
  `tests/config/planning.ts`, for "%s coverage at the %s limit" in `tests/unit/cli/planning/needed-tools.test.ts`.
  Delete the duplicate test at `:236-243`; the scope test at `:244-248` stays.
- Size: small

### TPR-012: A "Windows" test whose Windows switch changes nothing

- Where: `tests/cli/repository/tracked/discovery.test.ts:180-203`
- Kind: delete
- Problem: The test fakes `process.platform = 'win32'` and makes the first Git call fail. The failure happens in
  `readIndexEntries` before the Windows branch is reached (`repository/contracts.ts:207` versus `:216-223`), so the
  switch has no effect, and what is left repeats `corruptIndex` (L53-64).
- Fix: Delete the test.
- Size: small

### TPR-013: The hint test computes its expected value with a copy of the production code

- Where: `tests/cli/tools/inspect/hints.test.ts:18-25`, `:27-53`, `:55-91`; `tests/cli/configurations/pins.test.ts:24-51`
- Kind: delete
- Problem: The helper `installerHint` repeats the logic of `installHint` (`tools/contracts.ts:117-124`): both find the
  operating system in `OPERATING_SYSTEMS`, take the first installer the tool declares, and join the command with the
  package name. If the production logic is wrong in the same way, the test still passes.
  `configurations/pins.test.ts:24-51` is a second copy for `swiftlint` and `gitleaks`.
- Fix: Delete the hint table test with `installerHint`, and the copy in `configurations/pins.test.ts` with
  `NATIVE_HINTS`. The doctor test (`hints.test.ts:55-91`) moves to `tests/unit/cli/commands/doctor/command.test.ts`
  and asserts one literal hint; its runner rows go (INX-003).
- Size: small

### TPR-014: The scope-proposal call is written out three times

- Where: `tests/cli/repository/scopes.test.ts:16-24`; `packages/cli/src/commands/init/public.ts:243-248`;
  `packages/cli/src/lifecycle/selection/contracts.ts:85-90`
- Kind: merge
- Problem: All three call `plannedScopes(files, manifests, [...].flatMap(m => m.detect.project_files), npmToolNames(...))`. The test helper `proposeProjectScopes` copies what production does, so the test does not test
  the production composition.
- Fix: Change `plannedScopes(files, packageManifests, manifests)` to compute the patterns and npm names itself. Delete
  `proposeProjectScopes` and call `plannedScopes` directly in the test.
- Size: small

### TPR-016: POSIX-only gates on tests that work on Windows

- Where: `tests/cli/platform/claims.test.ts:197`; `tests/cli/platform/root.test.ts:99`
- Kind: delete
- Problem: "a second writer is refused until the first releases its lock" uses nothing POSIX-specific; the gate came
  from an old `if (isPosix) {` block (`98d263a56`). The system-path refusal cases also fail on Windows as wanted,
  because `nativeSegments` calls `portableSegments` there, which refuses `..`, empty segments, and control characters.
- Fix: Remove both gates.
- Size: small

### TPR-017: A macOS skip that a simulated operating system can replace

- Where: `tests/cli/platform/environment.test.ts:17-22`
- Kind: delete
- Problem: The cache-folder test is skipped on macOS because `env-paths` ignores the variables there. `env-paths` reads
  `process.platform` at call time and `process.env` by reference, so the test can simulate Linux and Windows on every
  machine.
- Fix: Replace the skip with two cases: `useOperatingSystem('linux')` with `XDG_CACHE_HOME=cache`, and
  `useOperatingSystem('win32')` with `LOCALAPPDATA=cache`.
- Size: small

### TPR-018: POSIX gates caused by `#!` scripts, and shim tests that use a program tool

- Where: `tests/cli/tools/inspect/installations.test.ts:140-145`, `:230-259`
- Kind: delete
- Problem: These tests write programs as `#!` scripts, which Windows cannot run, then skip Windows, though `fakeTool`
  already writes a `.cmd` wrapper too. The two shim tests also use `teller`, a program tool; gspot finds program tools
  through one `mise bin-paths` call and keeps the per-shim lookup in `hostCandidates` only for system tools (INX-006),
  so these tests would cover a path that program tools no longer take.
- Fix: Write the helper programs with `fakeTool` and remove both gates. Keep the two shim tests ("a program on PATH
  wins over an unrelated mise shim", "mise finds the program in the original repository") with a system tool name in
  the sample, in `tests/unit/cli/tools/find/programs.test.ts`.
- Size: small

### TPR-019: Hand-made `process.platform` overrides repeat the shared helper

- Where: `tests/cli/platform/spawn/termination.test.ts:195-205`; `tests/cli/repository/tracked/discovery.test.ts:145-155`
- Kind: simplify
- Problem: The tests set `Object.defineProperty(process, 'platform', ...)` and restore it in `finally`. The helper
  `useOperatingSystem()` (today `usePlatform()`, in `tests/setup/operating-systems.ts`) does the same in one line and
  restores the full descriptor.
- Fix: Use `using _system = useOperatingSystem('win32')` (or `'darwin'`). The third copy
  (`discovery.test.ts:196-202`) goes with TPR-012.
- Size: small

### TPR-020: Tests mock gspot's own functions or assert call order

- Where: `tests/cli/tools/inspect/installations.test.ts:49`, `:247`; `tests/cli/tools/npm/install.test.ts:178-225`;
  `tests/cli/platform/source.test.ts:73-103`; `tests/cli/repository/tracked/discovery.test.ts:77-104`
- Kind: simplify
- Problem: Three tests replace `miseHome()` (a gspot function) instead of setting `MISE_DATA_DIR`, which `miseHome`
  reads first. One test mocks `fs.mkdtempSync` only to prove that a temporary folder is not made before an error. One
  test counts calls to `fs.realpathSync` and injects two errors that take the same path. `missingGit` mocks both
  Node's `spawnSync` and gspot's `runBinary`. These pin how the code works, not what it does.
- Fix: Use `useEnvironment({ MISE_DATA_DIR: ... })`. In the npm test, assert only the error message and that no files
  changed; delete the `mkdtempSync` spy. Delete `source.test.ts:73-103`. In `missingGit`, set `PATH` to an empty folder
  instead of mocking two layers.
- Size: small

### TPR-021: The writer lock has race handling nobody asked for, with tests for it

- Where: `tests/cli/platform/claims.test.ts:15-195`; `packages/cli/src/platform/root/writes.ts:142-208`, `:277-292`;
  `packages/cli/src/platform/root/public.ts:121-133`; `config/platform/root.ts` (`CLAIM_POLL_MS`, `CLAIM_WAIT_BYTES`,
  `CLAIM_INITIALIZATION_MS`)
- Kind: simplify
- Problem: gspot lets one writer work at a time with the writer lock, `.gspot/state/writer.lock`. The lock file is
  created empty (`writeFileSync(..., { flag: 'wx' })`) and filled afterwards, so the code has a busy-wait with
  `Atomics.wait` for a lock that is still empty, a branch for an "incomplete" lock, and re-checks for microsecond races.
  Tests inject those races by mocking `fs.writeFileSync`, `fs.readFileSync`, and `process.kill`, need 3
  `eslint-disable n/no-sync` comments, and claim a made-up path, `.gspot/mutation.lock`.
- Fix: Create the lock in one step: write the token to a temporary file, then `linkSync(temp, lock)`, which fails if
  the lock exists. No empty lock can then be seen, so the wait goes (`pauseUntilClaimed`, `CLAIM_INITIALIZATION_MS`,
  `CLAIM_POLL_MS`, `CLAIM_WAIT_BYTES`) with its two tests (L74, L126), the suppression at L135, the incomplete-lock
  branch of `assertAbandonedLock`, and the abandoned empty-lock test (L175). Keep the `.reclaim` recovery folder and its
  tests (L15, L41, L150): it stops two commands that both find a dead holder from deleting each other's new lock
  (`writes.ts:185-186`). Keep L197 (a second writer is refused). The tests use the real `.gspot/state/writer.lock` and
  go to `tests/unit/cli/system/safe-folder/lock.test.ts`.
- Size: medium

### TPR-025: Tests that test another folder's code

- Where: `tests/cli/planning/dependencies.test.ts:47-65`; `tests/cli/repository/package-manifests.test.ts:72-89`,
  `:106-111`, `:140-145`, `:194-223`; `tests/cli/repository/aliases.test.ts:126-146`;
  `tests/cli/repository/generated.test.ts:50-73`; `tests/cli/platform/git.test.ts`;
  `tests/cli/planning/selection.test.ts:33-85`; `tests/cli/tools/inspect/hints.test.ts:55-91`
- Kind: move
- Problem: A reader looking for the tests of a module does not find them beside that module's source.
- Fix: Move each test to the file of the source it tests: `detectConfigurations` to
  `tests/unit/cli/repository/detect.test.ts`; the dependency-file parser rules to
  `tests/unit/cli/parsers/dependency-files.test.ts`; the fix run that rereads `package.json` to
  `tests/unit/cli/execution/fixes/passes.test.ts`; the `getTsconfig` cache test to `tests/unit/cli/parsers/tsconfig.test.ts`;
  the fix-run half of `generated.test.ts:50-73` to `execution/fixes/passes.test.ts` (TPR-030); `checkOutRevision`
  (`platform/git.test.ts`) to `tests/unit/cli/execution/copy/revision.test.ts`; the init part of
  `selection.test.ts:33-85` to `tests/unit/cli/commands/init/command/configurations.test.ts` (TPR-029); the doctor and
  check test to `tests/unit/cli/commands/doctor/command.test.ts`. `platform/writes.test.ts` is deleted with the batch
  write path (LIF-004).
- Size: medium

### TPR-026: An alias test repeats two generation tests

- Where: `tests/cli/repository/aliases.test.ts:82-102`
- Kind: delete
- Problem: It checks that the generated `.gspot/config/tsconfig.json` extends `../../tsconfig.json` and that the scope
  copy extends the scope's file. The generation tests already check both
  (`tests/cli/generation/typescript.test.ts:43`, `tests/cli/checks/language/typescript/projects.test.ts:55`).
- Fix: Delete the test.
- Size: small

### TPR-028: Timeout and cancel are tested three times

- Where: `tests/cli/tools/command.test.ts:19-25`; `tests/cli/platform/spawn/backends.test.ts:116-131`;
  `tests/cli/platform/spawn/termination.test.ts:69-91`
- Kind: delete
- Problem: `termination.test.ts:69` already checks timeout and cancel, including child processes; `run` and
  `runBinary` share `runStream`, so it covers the text runner too. `backends.test.ts:116` (cancel) is a subset, and
  `command.test.ts:19` only adds `seconds * 1000`.
- Fix: Delete `command.test.ts:19-25` and `backends.test.ts:116-131`. Keep the per-backend timeout test (it covers the
  synchronous runner).
- Size: small

### TPR-029: One test runs init, the `set` command 4 times, and planning

- Where: `tests/cli/planning/selection.test.ts:33-85`; `tests/config/cli/planning/selection.ts:29-33`
- Kind: move
- Problem: Each of 3 cases runs `prepare` twice, runs the whole CLI 4 times inside the test process (`runGspot set level ...` three times and `set licenses.allowed`, each writing generated files), then plans: 12 full command runs in
  a unit test, under a title ("retain automatic checks and level-dependent tools") that hides five claims.
- Fix: Move the init part to `tests/unit/cli/commands/init/command/configurations.test.ts` as "init with
  --configurations %j keeps the always-selected configurations", with its rows as `CONFIGURATION_CHOICES` in
  `tests/config/init.ts`. Init asks no questions (CLX-001), so the comparison of an interactive and a `--yes` run goes,
  and so does the scopes option. In planning, write `gspot.toml` with the level directly instead of calling the CLI.
- Size: medium

### TPR-030: A test title in jargon that hides five modules

- Where: `tests/cli/repository/generated.test.ts:50-73`
- Kind: rewrite-text
- Problem: "a native fixer refresh retains configuration-generated paths without exporting internal declarations" runs
  a fix, emits settings text, exports a template, and reconciles configurations, and asserts a count
  (`toHaveLength(4)`). `gspot.toml` has no `[[generated]]` key (CFR-005), so the half that checks settings text and
  templates for that key tests nothing.
- Fix: Keep only the fix-run half, as "a fix run keeps the generated-file list", in
  `tests/unit/cli/execution/fixes/passes.test.ts`, and compare the list of paths instead of the count.
- Size: small

### TPR-031: One test covers four modules and a level loop

- Where: `tests/cli/repository/package-manifests.test.ts:147-192`
- Kind: simplify
- Problem: "session package facts retain root and child detection" checks tool file inputs, rule selection,
  configuration detection, and a session error, at both levels. `COMPONENTS.md` is selected by dependencies, so the
  level never changes the result.
- Fix: Keep the session-error part ("a broken package.json stops the next session") in
  `tests/unit/cli/repository/dependency-files.test.ts`. Move the rule-selection assertion to
  `tests/unit/cli/rules.test.ts` and the tool-file-input assertion to `tests/unit/cli/generation/tool-files.test.ts`.
  The detection assertion goes (PLR-005). Drop the level loop.
- Size: small

### TPR-032: The Git hook test runs a hidden program that imports a private file by URL

- Where: `tests/cli/platform/git.test.ts`; `tests/config/cli/platform/git.ts:2-48`
- Kind: simplify
- Problem: The test makes a real commit whose hook runs a 46-line program stored as a string. The program imports
  `checkOutRevision`, `runGit`, `runGitBinary`, `gitText`, `runTool`, and a private file through
  `new URL('./contracts.ts', process.argv[3])`, and the test asserts 9 fields for 2 revisions at once, so a failure
  tells you almost nothing.
- Fix: Move the test to `tests/unit/cli/execution/copy/revision.test.ts` as "a hook in a linked worktree keeps its own
  index and HEAD". The program stays the string `GIT_HOOK_SCRIPT` and the expected values `GIT_HOOK_REPORT`, both in
  `tests/config/git.ts`. Split the nine checks into separate tests where they stand alone (environment kept, index
  kept, HEAD kept, cancel works).
- Size: medium

### TPR-034: 24 of the 26 mirrored data files have one user

- Where: `tests/config/cli/planning/*`, `tests/config/cli/platform/*`, `tests/config/cli/repository/*`, `tests/config/cli/tools/*`
- Kind: merge
- Problem: The mirror rule puts each test's data in a file with the same name in another tree. For one user this only
  adds a file to open. Some files hold almost nothing: `repository/tracked.ts` (1 line), `planning/replacements.ts`
  (4 lines), `platform/writes.ts` (5 lines), `planning/lockfiles.ts` (11 lines).
- Fix: Move the data to topic files by subject: `tests/config/planning.ts`, `system.ts`, `repository.ts`, `tools.ts`,
  and the shared files `npm.ts`, `python/tool-project.ts`, `prose.ts`, `git.ts`, `formatting.ts`, `docs.ts`,
  `nextjs.ts`, `init.ts`. A single short literal used by one test file (the system-path refusals, the settings paths
  of the docs/lychee trigger test, the generated header paths, the one redaction row) stays in its test. Tables of
  functions that call code (`backends`, `captures`) stay in their test file. Rows are written `as const`. Delete the
  four `tests/config/cli/{planning,platform,repository,tools}/` folders.
- Size: large

### TPR-039: Package-failure cases repeat each other

- Where: `tests/config/cli/tools/npm/install.ts:32-37`; `tests/cli/tools/npm/install.test.ts:88-137`
- Kind: delete
- Problem: The two refusal texts go through the same code path (`runPackageInstaller` treats any non-zero exit the
  same way), so four rows test two things.
- Fix: Keep two rows (`frozen` true and false) with one refusal text, as `INSTALL_FAILURES` in `tests/config/npm.ts`.
  The `GITHUB_TOKEN` assertion goes with the GitHub refusal note (LIF-025).
- Size: small

### TPR-040: A table column that is the same in every row

- Where: `tests/config/cli/tools/vale.ts:1-32`
- Kind: simplify
- Problem: All 5 rows of the Vale failure table carry `'tool_timeout_seconds = 1\n'`. The cancellation row's script
  never runs, because the signal is aborted before the start.
- Fix: Drop the column and set the timeout once in the test. Keep a short, unique script text for the cancellation row
  (for example `// not started`): the test later swaps the script text inside the program for the fixed one
  (`launcher.replace(script, ...)`), and an empty string would put that program before the `#!` line.
- Size: small

### TPR-045: A test that almost any code passes

- Where: `tests/cli/tools/inspect/placement.test.ts:111-122`
- Kind: delete
- Problem: It checks that a tool that exists nowhere is "missing". No program is created.
- Fix: Delete it.
- Size: small

### TPR-046: A test of an object-copy guard

- Where: `tests/cli/repository/scopes.test.ts:165-176`
- Kind: delete
- Problem: It pushes into a returned array and checks that a later call is not affected. This only guards against
  sharing the `ROOT_SCOPE` constant, which a one-line spread already prevents.
- Fix: Delete the test.
- Size: small

### TPR-049: The same read-cache literal is typed 12 times

- Where: `tests/cli/repository/aliases.test.ts:15,26,34,40,56,61,70,77,94,113,121`; `tests/cli/platform/source.test.ts:129`
- Kind: simplify
- Problem: `{ root: sandbox.path, sources: new Map(), memo: new Map() }` is written by hand each time, though
  `createReadCache(path)` exists for this.
- Fix: Use `createReadCache(sandbox.path)`. `createReadCache` finds the real path of the root, so on macOS a temporary
  `/var/...` path becomes `/private/var/...`; tests that hand `sandbox.path` next to the cache, such as the
  `getTsconfig` cache test, must use `reads.root` instead, or the cache lookups stop matching.
- Size: small

### TPR-050: One module imported under three names

- Where: `* as processes` (`discovery.test.ts`, `boundaries.test.ts`, `libraries.test.ts`, `uv.test.ts`),
  `* as environment` (`installations.test.ts:6`), `* as spawn` (`npm/install.test.ts:5`)
- Kind: rename
- Problem: All three are `#cli/platform/public.ts`, whose process functions move to `system/processes`.
- Fix: Use `* as processes` everywhere (TCO-036 does the same in the check tests).
- Size: small

### TPR-051: A variable named "unused" that is used

- Where: `tests/cli/tools/inspect/libraries.test.ts:74`, `:83`, `:94`, `:100`
- Kind: rename
- Problem: `_version` starts with `_`, the sign for "not used", but the test asserts on it.
- Fix: Rename it to `versionRun`.
- Size: small

### TPR-052: The `inspect/` test folder mirrors no source folder and its file names are unclear

- Where: `tests/cli/tools/inspect/{hints,installations,libraries,placement,versions}.test.ts` (760 lines)
- Kind: move
- Problem: All five files test `inspectTool` (`tools/public.ts:228`); there is no `src/tools/inspect/`. "placement" and
  "installations" do not say what they test, and `installations.test.ts` is mostly version reads.
- Fix: Name the files after the source files: finding programs in `tests/unit/cli/tools/find/programs.test.ts`,
  finding libraries in `tools/find/libraries.test.ts` (the `find` tests go over 300 lines and split by behavior), and
  reading versions in `tools/versions.test.ts`. The doctor test goes to `commands/doctor/command.test.ts` (TPR-025).
- Size: medium

### TPR-053: Planning file names do not say what they test

- Where: `tests/cli/planning/selection.test.ts`, `automatic-selection.test.ts`, `dependencies.test.ts`, `lockfiles.test.ts`,
  `format-inputs.test.ts`, `requirements.test.ts`, `replacements.test.ts`
- Kind: move
- Problem: `selection.test.ts` is a grab bag (init, stages, Next.js build, coverage, history), and "selection" also
  means configuration detection. `automatic-selection.test.ts` tests skip causes. `lockfiles.test.ts` tests when one
  check runs. `format-inputs.test.ts` also tests Prettier output removal.
- Fix: Name the files after the planning source files and move each test to the one it tests:
  `tests/unit/cli/planning/checks.test.ts` (which checks run), `planning/files.test.ts` (which files and triggers),
  `planning/skips.test.ts` (why a check is skipped), `planning/needed-tools.test.ts` (which tools a plan needs). The
  tests of other code go as TPR-025 and TPR-003 say.
- Size: medium

### TPR-054: Repository tests are split along lines the source does not have

- Where: `tests/cli/repository/kinds.test.ts`, `generated.test.ts`, `tracked/` (3 files), `project-folder.test.ts`,
  `selectors.test.ts`, `platform/source.test.ts:140-163`
- Kind: merge
- Problem: `kinds` and `generated` both test file-kind classification. `tracked/` mirrors no source folder, and two of
  its files hold one test each. `projectFolder` lives in `repository/scopes.ts`.
- Fix: Name the files after the repository source files: `tests/unit/cli/repository/kind.test.ts` (kinds and the
  Git-attributes test of `generated`), `repository/select.test.ts` (the generated files each scope selects),
  `repository/tracked.test.ts` (`tracked/*` and the outside-link listing test of `platform/source.test.ts`),
  `repository/find-root.test.ts` (`findRoot`), `repository/scopes.test.ts` (with `project-folder`), and
  `repository/selectors.test.ts`.
- Size: small

### TPR-055: Managed-block code lives in a file about path spellings

- Where: `packages/cli/src/platform/root/contracts.ts:207-264`; `tests/cli/platform/managed-blocks.test.ts`
- Kind: move
- Problem: The file header says "The path spellings and file copies the lifecycle accepts", but it also holds
  `blockSpan`, `applyBlock`, `currentBlock`, and the glob scanner. The config and type files for blocks are already
  separate.
- Fix: Move the three block functions to `packages/cli/src/system/managed-blocks.ts`; the test goes to
  `tests/unit/cli/system/managed-blocks.test.ts`, beside its source. Do after NMU-007 (the `platform/` to `system/`
  rename).
- Size: small

### TPR-059: `as const` tables spread back into arrays

- Where: `selection.test.ts:207` (`[...COVERAGE_PLUGIN_CASES]`), `writes.test.ts:13`, `credentials.test.ts:11`,
  `hints.test.ts:27`, `versions.test.ts:154`, `libraries.test.ts:67`
- Kind: simplify
- Problem: Data declared `as const` is copied with `[...]` so `test.each` accepts it. Noise in both places when the
  spread is not needed.
- Fix: Data in `tests/config/` is written `as const`, and bun-types 1.4.2 `test.each` takes only a mutable array for
  object rows (`test.d.ts:573-575`), so the `[...X]` spread stays for `as const` tables of object rows. Drop it
  everywhere else.
- Size: small

### TPR-062: A plain loop instead of `test.each`, with two near-duplicate cases

- Where: `tests/cli/platform/environment.test.ts:8-15`; `tests/config/cli/platform/environment.ts:2-13`
- Kind: simplify
- Problem: The file uses `for (...) test(name, ...)` where the rest of the suite uses `test.each`. The first two cases
  both show "MISE_DATA_DIR wins".
- Fix: Use `test.each` with four rows (MISE_DATA_DIR wins; XDG; an empty MISE_DATA_DIR falls through; nothing set), as
  `MISE_FOLDERS` in `tests/config/system.ts`.
- Size: small

### TPR-064: Loose assertions in the system-library test

- Where: `tests/cli/tools/inspect/libraries.test.ts:52`, `:56`, `:64`
- Kind: simplify
- Problem: `toThrow()` has no message, so any error passes. `{ ...selected, inspections: new Map() }` rebuilds a field
  `selected` already has.
- Fix: Assert the parse error message (`toThrow('Cannot read package manifest')`, the message of the package.json
  reader). Hand `selected` directly at only one of the two calls: each call needs its own `inspections` map, or the
  second call returns the cached result of the first.
- Size: small

### TPR-065: An assertion that checks for the empty string

- Where: `tests/config/cli/tools/inspect.ts:34`; `tests/cli/tools/inspect/libraries.test.ts:88`
- Kind: delete
- Problem: The `missing` row has `note: ''`, so `expect(inspected.note).toContain('')` checks nothing.
- Fix: Remove `note` from that row of `SYSTEM_PLUGIN_REPORTS` (`tests/config/tools.ts`).
- Size: small

### TPR-068: The first tag test repeats a shebang row

- Where: `tests/cli/repository/tags.test.ts:7-25`
- Kind: delete
- Problem: The `hook` file with `#!/usr/bin/env bash` repeats the `Bash` row of the shebang table.
- Fix: Drop the `hook` file and its assertions; keep the binary, Dockerfile, and extension parts.
- Size: small

### TPR-069: The Python "registry" test is about index settings

- Where: `tests/cli/tools/python/registry.test.ts`
- Kind: rename
- Problem: The test covers `parsePythonSettings` (`index-url`, `find-links`, `[[index]]`). uv and the source call these
  index settings (`PythonIndexSettings`); "registry" is npm's word.
- Fix: Move it to `tests/unit/cli/tools/python/settings.test.ts`, beside `tools/python/settings.ts`, where
  `parsePythonSettings` lives; its titles say "index settings".
- Size: small

### TPR-070: `client.test.ts` names the npm client in a folder that matches no source

- Where: `tests/cli/tools/npm/client.test.ts`; `tests/config/cli/tools/npm/client.ts`
- Kind: move
- Problem: The tests are about which npm client (npm, pnpm, Yarn, Bun) the tool project uses. The code says "package
  installer", the titles and errors say "package manager", the file says "client", and the data names use
  `MANAGERS`, a banned code word.
- Fix: Choosing the npm client lives in `tools/npm/project.ts`, so the test goes to
  `tests/unit/cli/tools/npm/project/client.test.ts`, with the code word `NpmClient` (glossary) and its data as
  `NPM_CLIENT_DECLARATIONS` and `NON_EXACT_PNPM_VERSIONS` in `tests/config/npm.ts`.
- Size: small

### TPR-071: The npm registry file holds one two-case test

- Where: `tests/cli/tools/npm/registry.test.ts`
- Kind: merge
- Problem: A 19-line file for one `test.each` of `registryEnvironment`, which lives in the same source file as the
  functions of `install.test.ts`.
- Fix: Move the test into `tests/unit/cli/tools/npm/project/install.test.ts` and delete the file.
- Size: small

### TPR-072: The macOS-refusal test fakes darwin but skips Windows

- Where: `tests/cli/platform/spawn/termination.test.ts:185-208`
- Kind: delete
- Problem: The test sets the operating system to `darwin` and mocks `process.kill`. With that set, the Windows-only
  `taskkill` path is never used (`platform/public.ts:116-139` picks the path at call time), so the `skipIf(win32)` has
  no reason.
- Fix: Drop the gate. If `detached` spawning turns out to fail on Windows CI, say so in a one-line comment.
- Size: small

### ST4-002: Two more tests repeat a guard that a kept test reaches

- Where: `tests/cli/repository/aliases.test.ts:59-62`; `tests/cli/tools/inspect/installations.test.ts:55-76`, `:147-150`
- Kind: delete
- Problem: The alias test only checks that a folder without `package.json` and `tsconfig.json` gives `{}` and no error.
  `aliasesFor` runs for every ESLint config gspot writes (`generation/eslint/configuration.ts:44`, `:101`), so every
  generation test of a sandbox without those files already fails if a missing file throws. The installations test
  checks that an npm tool's `package.json` linked outside the repository is refused before the tool runs; the refusal
  is the `sourcePath()` guard tested once in `system/file-reads` (TPR-009), and the program it keeps from running sits
  inside `.gspot/node_modules`, so not running it protects nothing. "a tool project program linked outside the
  repository is refused before it runs" stays.
- Fix: Delete both tests and the helper `linkedManifest`.
- Size: small

### ST4-003: A test builds a state gspot cannot produce, and one sample has no user

- Where: `tests/cli/tools/inspect/libraries.test.ts:91-101`; `packages/cli/src/tools/public.ts:61-62`;
  `tests/config/samples/docs.ts:25-26` (`SETEXT_README`)
- Kind: delete
- Problem: The library test builds a tool with `version_command: []`, but `commandSchema` needs at least one item
  (`parsers/schema/command.ts:10-14`), so no manifest can reach that branch of `inspectLibraryCommand`.
  `SETEXT_README` lost its last user when the headings check and the readme-shape row were deleted. (The empty-lock
  test of the writer lock is TPR-021.)
- Fix: Delete the test and `SETEXT_README`. In `inspectLibraryCommand`, read the program as the first item of a command
  the schema already checked (`const [program, ...args] = command as [string, ...string[]]`) instead of an error
  branch nothing can reach.
- Size: small

### ST4-004: Test tables whose rows repeat one branch

- Where: `tests/config/cli/platform/managed-blocks.ts:12-43` (`MALFORMED_BLOCKS`, 10 rows);
  `tests/config/cli/repository/tags.ts:2-25` (`SHEBANG_CASES`, 10 rows); `tests/cli/repository/tags.test.ts:42`
  (`['sh', 'dash']`); `tests/cli/planning/requirements.test.ts:77` (`['bun', 'mise']`);
  `tests/plugin/configuration.test.ts:64-72` (the plugin identity test at both levels)
- Kind: delete
- Problem: The five `.gitignore` rows of `MALFORMED_BLOCKS` repeat the five `AGENTS.md` marker layouts with other
  markers; the happy-path test already reads both marker styles. In the shebang table, Dash gives the same tags as
  POSIX `sh`, and zsh, Bats, Node.js, and Deno each repeat one entry of `SHEBANG_INTERPRETERS`, which makes the table a
  copy of the source list. `sh` and `dash` take the same `INTERPRETER_DIALECTS` branch. The ajv peer test runs at
  runner `bun` and `mise`, but `requiredToolNames` reads `toolProjectPackage(pin)?.requires` whatever the runner. The
  plugin identity test does not depend on the level.
- Fix: Keep the five `AGENTS.md` rows of `MALFORMED_BLOCKS` (in `tests/config/system.ts`); keep the Bash, POSIX `sh`,
  Bun (`env -S`), Python (version suffix), and plain-text rows of `SHEBANGS` (in `tests/config/repository.ts`); keep
  `sh`; delete the runner table of the ajv peer test (the runner setting goes, INX-003); run the plugin identity test
  at level `all` only.
- Size: small

### ST4-007: A test of one fallback sentence

- Where: `tests/cli/tools/credentials.test.ts:51-59`
- Kind: delete
- Problem: Once only the URL-password redaction stays, the test only checks that whitespace output gives "The package
  manager provided no diagnostics.", the fallback of a one-line branch. Tiny logic gets no test.
- Fix: Delete the test.
- Size: small
