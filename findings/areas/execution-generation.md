# Running checks and writing generated files

This part runs the checks of `gspot check` (`packages/cli/src/execution/`: each planned check and its fixer, the
`[[ignore]]` records, the run report, and scratch copies) and builds in memory every file that `gspot apply` and
`gspot init` write (`packages/cli/src/generation/`: tool files, the ESLint configuration, Git hooks, CI workflows, tool
projects, managed blocks, and file edits), with its constants in `config/` and its types in `types/`. The target:
files named for what they hold, one name for each concept, no run-time checks of gspot's own shipped files, and one
code path for each job (find a tool, run it with the one timeout, make a scratch copy). Paths without a package folder
are under `packages/cli/src/`.

## Findings

### EXG-002: Folder and file names in this area do not say what the code does

- Where: `execution/public.ts`, `execution/contracts.ts`, `execution/command/{public,contracts}.ts`,
  `execution/command/arguments/{public,contracts}.ts`, `execution/copy/{public,contracts}.ts`,
  `generation/{public,contracts}.ts`, `generation/compilation/`, `generation/documents/`,
  `generation/eslint/{public,contracts}.ts`
- Kind: rename
- Problem: Sixteen files are named `public.ts` or `contracts.ts`, and two folders are named `compilation` and
  `documents`. A newcomer cannot guess what is inside. "contracts" has no stable meaning here: in `execution/`,
  `public.ts` imports `contracts.ts`; in `command/arguments/` and `generation/eslint/` it is the reverse.
  `generation/contracts.ts:1` says "The Git hooks gspot writes", but the file also builds the Python tool project.
- Fix: Use the names in "Layout" below. Flatten `execution/command/arguments/` into `execution/command/`. The
  `compilation/` folder goes: POL-001 deletes its setting-schema generator, CFL-001 deletes Eta, `emitTarget` moves
  to `generation/tool-files.ts`, `proseInputs` to `generation/prose.ts`, and `entryFiles` to
  `generation/tool-file-sources/knip.ts`. Do after TML-001, which deletes the import rule that forced these names.
  ARC-002 renames the rest of the source tree the same way.
- Size: large

### EXG-003: `gspot/policy` bypasses `--only` and `[[ignore]]` through a special fake result

- Where: `execution/public.ts:39-58`, `:279-283`; `config/execution/runtime.ts:11`;
  `tests/cli/checks/built-in.test.ts:3,11,17`
- Kind: fix-bug
- Problem: `gspot/policy` is declared in a manifest, but the run removes it from the plan
  (`.filter(({ check }) => check.name !== POLICY_CHECK)`) and then adds a result for it at the end in any case. The
  result never goes through `settleResult`. So `--only some/check` still reports it, an `[[ignore]]` record for it is
  never applied, and its failure has no "reproduce" line. Three places special-case one check name.
- Fix: Make it an ordinary built-in check named `gspot/settings`: add it to `BUILT_IN_CHECKS` in
  `checks/built-in.ts` with a `run` that returns the session's gspot.toml errors as findings (the manifest already
  sets `runs = "once"`). Delete `policyErrorsResult`, the filter in `planChecks`, and `POLICY_CHECK`. Users then see
  `gspot/settings` as passed in every run with valid settings, and a `--staged` run that does not stage `gspot.toml`
  skips it (the check's `files` is `gspot.toml`). Update `tests/cli/commands/check/policy-errors.test.ts:75-92`,
  which expects no result for valid settings. TCO-006 deletes the test that pins the special case.
- Size: small

### EXG-004: `.gitattributes` is written in folders that have no Git

- Where: `generation/public.ts:108-110`
- Kind: fix-bug
- Problem: The `.gitignore` block is written only when `repository.hasGit` is true. The `.gitattributes` block is
  written always. Without Git, that file does nothing. Two tests pin today's behavior:
  `tests/cli/commands/init/refusals.test.ts:152,158` and `tests/cli/lifecycle/apply/publication.test.ts:34`.
- Fix: Put both pushes under the same `if (repository.hasGit)`. Update the two tests.
- Size: small

### EXG-006: Build-only ESLint checks and constants live in run-time source

- Where: `generation/eslint/public.ts:237-266` (`validateEslintPresets`); `config/generation/eslint.ts:8,11,12`
  (`ESLINT_RULE_NAMES_MODULE`, `ESLINT_RUNTIME_NAMES_FILE`, `ESLINT_RUNTIME_NAMES_MODULE`);
  `config/generation/pins.ts:35-44` (`CLI_PINS.swiftGrammar`)
- Kind: move
- Problem: Only build scripts use these, but they sit in run-time source. The bundler drops unused functions, so most
  of this never ships; `CLI_PINS.swiftGrammar` does, as part of the `CLI_PINS` object. Inside
  `validateEslintPresets`, a variable named `presets` holds the list of rule names (line 243).
- Fix: Move `validateEslintPresets` into `scripts/build.ts` (SCR-010). Move the three ESLint constants to
  `scripts/config/rule-lists.ts`; `scripts/update-rule-lists.ts` is their one user. Split `CLI_PINS`: `CI_PINS` joins
  `config/generation/ci.ts`, and the Swift grammar pin goes to `scripts/config/grammars.ts` as `SWIFT_GRAMMAR_PIN`
  (version, URL, checksum, license; no `name` field). `scripts/build.ts`, whose first step copies the grammars, joins
  it with `SWIFT_GRAMMAR_FILE` from the CLI config. `config/generation/pins.ts` goes. Rename the local `presets` to
  `ruleNames`.
- Size: small

### EXG-007: ESLint limits get a second set of names although tool file sources already have `limit()`

- Where: `config/generation/eslint.ts:36-52` (`ESLINT_LIMITS`, `ESLINT_JAVASCRIPT_LIMITS`);
  `generation/eslint/configuration.ts:76-79, 102, 109-110`; `types/generation/eslint.ts:86-87`;
  `configurations/language/javascript/eslint.config.mjs.eta:41-53`
- Kind: delete
- Problem: The setting `limits.nesting` reaches the ESLint template as `limits.depth`; `callback_nesting` becomes
  `nestedCallbacks`, `cyclomatic_complexity` becomes `cyclomatic`, and so on. Each limit has two names, although
  every tool file source already gets `limit(key, language)` from the scope view.
- Fix: The ESLint tool file source (CFL-001) reads each limit by its setting name, for example
  `view.limit('nesting', 'typescript')`. In `gspotRules`, use `view.limit('index_exports', 'typescript')`. Delete
  `ESLINT_LIMITS`, `ESLINT_JAVASCRIPT_LIMITS`, `limitsOf`, and the `limits` and `javascriptLimits` fields.
- Size: small

### EXG-008: The value `fragmentFiles` is never read

- Where: `generation/compilation/public.ts:229`; `generation/fragments.ts:87,108,112,125`;
  `types/generation/eta.ts:93`; `generation/eslint/public.ts:66`; `types/generation/eslint.ts:142`
- Kind: delete
- Problem: The value is computed and passed to every template, but no template uses it. `EslintFiles.fragmentFiles`
  is read only to fill it.
- Fix: Delete `fragmentFiles` from `fragmentInputs`, `EslintFiles`, and `eslintFilePatterns`. `EtaInputs` and
  `etaInputs` go with Eta (CFL-001).
- Size: small

### EXG-009: ESLint `commentLevel` is always `'error'`

- Where: `generation/eslint/configuration.ts:119`; `types/generation/eslint.ts:90`; `eslint.config.mjs.eta:7-9, 277-279, 334`
- Kind: delete
- Problem: The type allows `'error' | 'off'`, but the one assignment in the source tree sets `'error'`. The template
  tests it twice, and the "off" branch can never run.
- Fix: Delete the field. The ESLint tool file source always imports `eslintComments` and always sets `commentRules`.
- Size: small

### EXG-010: `EslintConfiguration.aliases` is set and never read

- Where: `generation/eslint/configuration.ts:104`; `types/generation/eslint.ts:82`
- Kind: delete
- Problem: The local `aliases` goes to `gspotRules`; the copy on the returned object is unused.
- Fix: Delete the field from the type and the return value.
- Size: small

### EXG-011: `EmitInputs.root` is never read

- Where: `types/generation/files.ts:36`; `generation/public.ts:187`
- Kind: delete
- Problem: `emitToolFiles` gets `root` and never uses it.
- Fix: Delete `root` from `EmitInputs` and from the call.
- Size: small

### EXG-013: `Generated.toolFiles` holds edits to the user's files, not tool files

- Where: `types/generation/files.ts:27-32, 46-49`; `generation/public.ts:124-134, 192`; `generation/bunfig.ts`;
  `generation/redirects.ts`
- Kind: rename
- Problem: Everywhere else a tool file is a whole generated file (`kind: 'tool_file'`). Here `toolFiles` is a list
  of key changes to `bunfig.toml` and `package.json` (`EmittedToolFile = { path, changes: KeyChange[] }`).
- Fix: Rename `Generated.toolFiles` to `fileEdits`, `EmittedToolFile` to `FileEdit`, and `combineToolFiles` to
  `mergeFileEdits`. `FileEdit` moves to `types/ownership.ts`, beside `KeyChange`.
- Size: medium (6 files use `EmittedToolFile`)

### EXG-014: `generation/contracts.ts` mixes Git hooks and Python

- Where: `generation/contracts.ts`
- Kind: move
- Problem: The header says the file is about Git hooks. Half of it builds the Python tool project and the Python
  values: `hookScript`, `hookPrefix`, `hookLine`, `hookFiles` (lines 20-82); `pythonProject`, `pythonInputs` (lines
  84-151).
- Fix: Split into `generation/hooks.ts` and `generation/python.ts`. `hookPrefix` moves to `system/git.ts` as
  `gitPrefix` (EXG-032). `generation/hooks.ts` also holds the one function that picks the start command for the hooks
  and the `AGENTS.md` managed block: the npm client that `selectNpmClient` finds when the root `package.json` lists
  `@gspothq/cli`, otherwise `mise exec -- gspot`, from the `RUNNERS` table keyed by `RUNNER_NAMES` (INX-003).
- Size: small

### EXG-015: `generation/documents/` holds six unrelated jobs

- Where: `generation/documents/public.ts`, `generation/documents/contracts.ts`
- Kind: move
- Problem: CI workflows, Prettier options, EditorConfig, file headers, ignore-pattern rewriting, pointer files, and lint rule capture share one folder named "documents"; in `public.ts` the CI workflow code (`githubFile`, `gitlabFile`, `buildJob`, `buildCheckScript`, `pinned`) sits beside the Prettier and EditorConfig code under two header comments for two topics. The plural also clashes with `policy/document/`, unrelated code that reads and edits gspot.toml (renamed by POL-044).
- Fix: Split into `generation/ci.ts`, `generation/formatting.ts`, `generation/headers.ts` (with `json-format.ts`
  merged in), `generation/ignore-patterns.ts`, `generation/pointers.ts`, and `generation/rule-capture.ts`. The CI functions go to `ci.ts`, Prettier and EditorConfig to `formatting.ts`, and `ciNpmInstall` is deleted (INS-003). A folder `generation/tool-files/` cannot be used: it would sit beside `generation/tool-files.ts`. Delete the `documents/` folder. `getTable` merges into `valueAt` in `src/objects.ts`; `headerLines` becomes `generatedHeader`
  (EXG-048); `addJsonHeader` goes, because generated JSON gets no `_gspot` key (GEN-017).
- Size: medium

### EXG-016: `config/generation/eta.ts` is a grab bag

- Where: `config/generation/eta.ts`
- Kind: move
- Problem: Only `ETA_OPTIONS` and `LEADING_NEWLINES` are about Eta. `TOKEN_IGNORES` and `BLOCK_IGNORES` are Vale
  settings, read only by `proseInputs`. `YARN_TOOL_PROJECT_SETTINGS` is the Yarn file of the npm tool project, read
  only by `npmProject`. `JSON_INDENT` is JSON layout.
- Fix: `TOKEN_IGNORES` and `BLOCK_IGNORES` move to `config/generation/prose.ts`, and the Vale tool file sources import
  them (S04-003). `JSON_INDENT` and `YARN_TOOL_PROJECT_SETTINGS` move to `config/generation/tool-projects.ts`;
  `JSON_INDENT` then serves `npmProject` and `scripts/update-rule-lists.ts`. `ETA_OPTIONS` and `LEADING_NEWLINES` go
  with Eta (CFL-001). Delete `config/generation/eta.ts`.
- Size: small

### EXG-017: Three copies of "run a tool with the timeout, then classify the failure"

- Where: `execution/command/public.ts:58-66` (`runCommands`), `:271-297` (`runCheckTool`);
  `execution/contracts.ts:42-64` (`runFix`)
- Kind: merge
- Problem: Each calls `runTool(argv, { ...prepared, timeoutSeconds: toolDeadline(view), cancelSignal })` and then
  `executionFailure(result, name, view)`. `fixFailure` (`execution/contracts.ts:31-40`) wraps `executionFailure` a
  fourth way.
- Fix: Add one `runPlannedTool(argv, options, view, name)` to `execution/command/check.ts` that returns the result or
  the failure, with the timeout from `toolTimeoutSeconds()` (EXG-030). Use it in all three places.
- Size: small

### EXG-018: Four copies of "find the tool, check that it is installed"

- Where: `execution/command/public.ts:81-96` (`checkTool`), `:164-176` (`unavailableCompanion`), `:249-255`
  (`runCheckCommand`); `execution/contracts.ts:122-134` (`runCommandFix`); `execution/public.ts:76-80` (Docker)
- Kind: merge
- Problem: Each does `inspectTool({ ...session, cwd }, { ...tool, env })`, then `toolAvailability`, then tests
  `'status' in availability`.
- Fix: One `findTool(session, cwd, tool, env)` in `execution/command/check.ts` that returns `{ path }` or the failure
  note. Call it from each place.
- Size: small

### EXG-019: "Run inside a scratch copy" is written twice

- Where: `execution/command/public.ts:134-161` (`runInWorkspace`); `execution/contracts.ts:66-102` (`isolatedFix`),
  `:135-144`
- Kind: merge
- Problem: Both copy `isolatedFiles(...)` into a scratch copy with `dependencies: []`, build a session rooted at the
  copy, compute `commandEnvironment` again, and call `prepareCommand`. The lines are nearly the same.
- Fix: One `prepareInScratch(session, planned, command, toolPath)` in `execution/command/check.ts` that returns the
  scratch copy and the prepared command. `runInScratch` (today `runInWorkspace`) and `scratchFix` (today
  `isolatedFix`) both use it; `isolatedFiles` becomes `scratchFiles`.
- Size: small

### EXG-020: `isolatedFix` writes repository files with raw `fs` calls

- Where: `execution/contracts.ts:86-101`
- Kind: simplify
- Problem: It opens a confined folder only to call `realPath`, compares bytes by hand, and then calls
  `writeFileSync`/`unlinkSync`. The safe folder already has "replace only while the file still matches" in `write`
  and `remove` (`types/platform/root.ts:33,39`). Every other repository write in the CLI goes through it.
- Fix: In `scratchFix`, write through the folder that `openSafeFolder` returns (PLR-008):
  `files.write(path, { bytes, mode }, original)` and `files.remove(path, original)`. Pass the file mode of new files.
  Delete the manual compare loop and the raw calls. A source file with a second hard link is then refused, as every
  other repository write already refuses it.
- Size: small

### EXG-021: Fixers snapshot the same files at three levels

- Where: `execution/public.ts:220-223` (`applyFixers`); `execution/contracts.ts:45,56` (`runFix`), `:251-255`
  (`fixerPasses`)
- Kind: simplify
- Problem: `applyFixers` reads every path before and after. Each fixer pass in `fixerPasses` reads every path before
  and after. Each `runFix` reads its own paths before and after. `contentsOf` runs 6 times for one fix run.
- Fix: Delete the outer snapshot in `applyFixers`: `fixerPasses` returns the first pass's "before" and the last
  pass's "after", which give the same changed list and dry-run diff. Keep the per-pass snapshot: it is the only one
  that sees a fixer change a file in another fixer's list, and that file then gets a second pass. Keep the snapshot
  in `runFix`: it covers only that fixer's paths, sets the fixer's status, and is the only view of a fixer that runs
  in a scratch copy.
- Size: small

### EXG-022: `copyInto` has two modes; the revision copy calls it only to copy dependencies

- Where: `execution/copy/public.ts:119-131, 106, 230`
- Kind: simplify
- Problem: `populateRevision` calls `copyInto` with `dependencies: []` (files only). `checkOutRevision` calls it with
  `files: []` (dependencies only), which is `copyDependencies` plus a useless `openRoot`.
- Fix: `writeScratchFiles` keeps only the file loop, and dependencies go through `copyDependencies`.
  `copyIntoScratch` calls both; `copyRevision` (today `checkOutRevision`) calls `copyDependencies` directly. Update
  the caller in `tests/harness/install.ts`.
- Size: small

### EXG-023: `workspaceSourceFiles` does no copying but lives in `copy/`

- Where: `execution/copy/public.ts:113, 236-301`
- Kind: move
- Problem: It finds the source files of the npm workspace packages a project depends on. That is repository
  knowledge. Its callers are `execution/contracts.ts:274` and `checks/language/contracts.ts`; it reads
  `packageWorkspaces` from `repository/paths/contracts.ts`.
- Fix: Move it to `repository/scopes.ts`, next to the npm workspace code. `WORKSPACE_SOURCE_MEMO` moves with it: a
  memo key is code, so it stays beside its function, not in `config/`.
- Size: small

### EXG-024: `executeRun` reads the Git index a second time and hides it behind a getter

- Where: `execution/public.ts:248-265`
- Kind: delete
- Problem: `openSession` already ran `readRepository`, which reads the index (`repository/public.ts:135`).
  `executeRun` reads it again and wraps it in a lazy getter (a property that runs code each time it is read), so each
  check reports the error. After `--fix`, `refreshAfterFixes` replaces the repository and the getter is gone anyway.
  The second read serves only a session reused after the index changed; production opens one session per run
  (`commands/check/tree.ts:153-160`).
- Fix: Delete the second read and the getter, and use `opened.repository` as it is. Rewrite
  `tests/cli/execution/git-index.test.ts:12-36`, which corrupts the index between two `executeRun` calls on one
  session: corrupt it before `openSession` and expect the session to fail.
- Size: small

### EXG-025: `refreshAfterFixes` changes the caller's session object

- Where: `execution/public.ts:61-70, 168-183`
- Kind: simplify
- Problem: It writes `opened.repository` and `opened.packageManifests`, a hidden side effect on the caller's object.
  The only production caller (`commands/check/tree.ts:112-134`) never reads the session again.
- Fix: Drop the `opened` parameter from `refreshAfterFixes` and `replanAfterFixes`.
- Size: small

### EXG-026: The "reproduce" command line is built twice for pushes

- Where: `execution/public.ts:138-142`; `commands/check/tree.ts:75-78, 133`
- Kind: simplify
- Problem: The run builds one line; the check command then replaces it for `--hook pre-push`:
  `rewriteReproductions` calls `reproduceLine` again with `options.push`.
- Fix: Add `push` to `RunOptions` and pass it in `settleResult`. Delete `rewriteReproductions`.
- Size: small

### EXG-027: `historyResult` is a check helper in the run report file

- Where: `execution/report.ts:78-88`
- Kind: move
- Problem: Only the commit-message and secret-history checks use it (`checks/general/commits.ts:21`,
  `checks/general/secrets.ts:114,157`).
- Fix: Move it to `checks/general/history.ts`.
- Size: small

### EXG-028: Two types live in the wrong place

- Where: `types/execution/check.ts:13-20` (`SuppressionComment`); `types/execution/copy.ts:15-25` (`RevisionSource`)
- Kind: move
- Problem: Only the structure checks use `SuppressionComment`. Only the check command uses `RevisionSource`.
- Fix: Move `SuppressionComment` to `types/checks/general.ts` and `RevisionSource` to `types/commands/check.ts`.
- Size: small

### EXG-029: `types/execution/reproduce.ts` holds one type, and its comment sits on the import

- Where: `types/execution/reproduce.ts:1-8`
- Kind: merge
- Problem: An 8-line file for one type. The doc comment is above the `import`, not the type.
- Fix: Move `ReproduceOptions` into `types/execution/check.ts`, with its doc comment above the type. Delete the file.
- Size: small

### EXG-030: The tool time limit is read in four ways, and some installs ignore the user's setting

- Where: `execution/command/contracts.ts:269-276` (`toolDeadline`); `lifecycle/install/public.ts:122,132,175`;
  `tools/contracts.ts:324`; tests `tests/cli/tools/vale.test.ts:52`, `tests/harness/install.ts:137`
- Kind: fix-bug
- Problem: `toolDeadline(view)` exists, but `lifecycle/install/public.ts:175` and seven test lines read
  `Number(rootView(...).settings['tool_timeout_seconds'])` again. `runTool` silently falls back to the built-in 600
  seconds, so eleven install-time calls ignore a changed `tool_timeout_seconds`: `lifecycle/install/public.ts:122,132`
  (`mise --version`, `mise install`), `tools/npm/contracts.ts:89,241,244`, `tools/npm/yarn.ts:51,63`, and
  `tools/python/public.ts:66,90,182,191`. The code also gives the time limit six names: `TOOL_DEADLINE` (a setting declaration), `toolDeadline()` (which returns `tool_timeout_seconds`), `timeoutSeconds`, `timeoutMs`, `*_TIMEOUT_MS`, and "tool deadline" in messages ("Vale package sync exceeded its tool deadline."); "deadline" is on 24 lines in 10 files.
- Fix: Make `timeoutSeconds` required in `ToolRunOptions` and delete the fallback in `runTool`. Rename
  `toolDeadline` to `toolTimeoutSeconds` and move it to `tools/run.ts`, beside `runTool`; it reads the setting through
  `TOOL_TIMEOUT_SETTING` in `config/settings/values.ts`. `TOOL_DEADLINE` goes, because POL-025 declares the setting
  once. Use "timeout", the word the setting uses, everywhere; messages say "ran longer than tool_timeout_seconds". Pass `toolTimeoutSeconds()` to every call; callers that have no session today get the value passed down.
  The fixed 15-second version runs take the same value (S05-007). Do after TTO-003, which deletes the test setup code
  at `tests/harness/install.ts:137` that reads the setting by hand.
- Size: medium

### EXG-031: Windows line endings are converted in two places

- Where: `execution/command/public.ts:291-296`; `parsers/output/public.ts:238`
- Kind: merge
- Problem: Built-in checks get CRLF converted in `runCheckTool`; command checks get it converted later in
  `parseOutput`. One Windows need is handled twice, in two layers.
- Fix: Convert once in `runTool` (`tools/run.ts`), for text results only, and delete both other conversions.
- Size: small

### EXG-032: Git helpers are written again outside `platform/git`

- Where: `generation/contracts.ts:49-54` (`hookPrefix`, `rev-parse --show-prefix`); `execution/copy/public.ts:207-208`
  (`rev-parse --show-toplevel`); `platform/git/contracts.ts:70`; `repository/discovery/contracts.ts:91`
- Kind: merge
- Problem: The "top level" query is written three times, and `.replace(/\n$/u, '')` to drop Git's final newline six
  times. `hookPrefix` is a Git helper in the generation folder, while its sibling `hooksDirectory` sits in
  `platform/git/public.ts:72-76`; `lifecycle/install/contracts.ts:17` imports it from generation.
- Fix: Add `gitTopLevel(root)` to `system/git.ts`, and move `hookPrefix` there as `gitPrefix`; its callers pass
  `hasGit`. Its Git arguments go to `config/system/git.ts` as `GIT_PREFIX_ARGUMENTS`. `gitText` callers that need one
  line use a `gitLine` helper that drops the final newline.
- Size: small

### EXG-033: A generic "withhold output" flag exists for TruffleHog only

- Where: `execution/command/contracts.ts:89-111, 152-156`; `parsers/output/public.ts:139-215` (`withholdOutput`)
- Kind: simplify
- Problem: `withholdOutput` is true only for `trufflehog-json`, and the generic code writes "TruffleHog failed..." in
  its messages. The flag also keeps a crashed TruffleHog run from printing its raw output, which can hold secrets:
  without it, `checkedFindings` calls `outputFailure`, which prints the tool output.
- Fix: Keep the flag and name it for what it guards: `redactsOutput`. Remove the TruffleHog name from the generic
  messages. Do not move the refusal into `read`: `read` gets no exit code.
- Size: small

### EXG-034: The generic tool file emitter special-cases `.semgrepignore`

- Where: `generation/tool-files.ts:85-89`
- Kind: simplify
- Problem: Generic code skips a scope's `.semgrepignore` when it equals the root one. No other tool gets this, and
  `target.endsWith('/.semgrepignore')` is the only tool name in that file. The skip stops four byte-identical
  `.semgrepignore` files in this repository, and `tests/cli/generation/semgrep.test.ts:104-118` covers it.
- Fix: Make it a `[[tool_file]]` manifest flag, for example `skip_if_same_as_root = true` on the Semgrep entry, and
  delete the `.semgrepignore` literals from `generation/tool-files.ts`.
- Size: small

### EXG-035: `recordInvocation` guards a state that cannot happen

- Where: `execution/command/contracts.ts:187-191`
- Kind: delete
- Problem: It throws when `planned.tool` is undefined. Its only caller, `runCommands` (`command/public.ts:76`),
  already holds a defined `tool`, and `runCheckCommand` returns early when `tool` is undefined
  (`command/public.ts:247`).
- Fix: Pass `tool` as a parameter and delete the throw.
- Size: small

### EXG-036: Guards in the schema generator for states that cannot happen

- Where: `generation/compilation/public.ts:155-156`; `generation/compilation/contracts.ts:53`
- Kind: delete
- Problem: `namingSchemas` throws when a setting has no compiled schema, but `values` holds every name of the same
  list. `settingChildren` throws when `name.split('.')` has no first part, which never happens.
- Fix: Nothing to do on its own: POL-001 deletes the setting-schema generator, and both guards go with it.
- Size: small

### EXG-037: The run checks gspot's own built-in checks on every user run

- Where: `execution/contracts.ts:165-171, 182-186` (`assertCoverage`)
- Kind: delete
- Problem: Every run checks that each built-in check reports only files it gets ("The built-in check reported
  coverage for X, outside its supplied source inventory."). This polices gspot's own code on every user's machine. A
  broken built-in check is a gspot bug.
- Fix: Delete `assertCoverage`. Whether the built-in checks that return `files` need a test is settled after the
  code cut, by the rule for untested logic.
- Size: small

### EXG-038: More run-time checks of shipped tool file sources and manifests

- Where: `generation/tool-files.ts:83-84` (a tool file source "did not provide its declared rule data");
  `execution/contracts.ts:329-336` (the `checkRun` throw); `execution/command/arguments/public.ts:33-37`
  (`commandItems`), `:206` (a list setting in a scalar slot); `execution/command/public.ts:86` ("An empty command
  cannot run")
- Kind: delete
- Problem: These check gspot's own shipped files on every user run. A mistake there is a gspot bug, and
  `assertManifests` already validates the manifests at build time. Two of them also guard user checks: checks from
  `gspot.toml` pass through `substitute` too, and `assertManifests` never sees them.
- Fix: Move the shipped-file checks into `assertManifests`, which the build runs on every shipped manifest, and
  delete them from the run path: the rule-data throw in `generation/tool-files.ts`, the `checkRun` throw, and "An
  empty command cannot run". Keep `commandItems` and the list-setting guard at `arguments/public.ts:206`. Do after
  TCO-006, which adds "a manifest check with no command has a built-in check" to `assertManifests`, so a broken
  manifest is still caught at build time.
- Size: small

### EXG-039: A global regular expression is reset by hand

- Where: `execution/command/arguments/public.ts:236-239`
- Kind: simplify
- Problem: `SETTING_PLACEHOLDER` (`config/configurations.ts:45`) has the `g` flag. The code calls `.exec`, resets
  `lastIndex`, and then cuts the name out with `part.slice('{setting:'.length, -1)` instead of using the match group.
- Fix: Add `WHOLE_SETTING_PLACEHOLDER = /^\{setting:(?<name>[a-z\d_.-]+)\}$/u` to `config/configurations.ts` and read
  `groups.name`. Delete the `lastIndex` line.
- Size: small

### EXG-040: The same doc comment is written twice

- Where: `execution/copy/contracts.ts:165-174`
- Kind: delete
- Problem: Lines 165-169 and 170-174 are two identical JSDoc blocks above `copyDependencies`.
- Fix: Delete one.
- Size: small

### EXG-041: `runCheckTool` tests for cancel before `runTool` tests it again

- Where: `execution/command/public.ts:276`
- Kind: delete
- Problem: `runTool` already returns a canceled result (`tools/contracts.ts:325-333`), and `executionFailure` turns
  it into an error.
- Fix: Delete the early throw.
- Size: small

### EXG-043: Comments are full of jargon

- Where: the whole area. Examples: `types/execution/check.ts:25` "A native correction publishes through the same
  repository or disposable-copy boundary as command fixes"; `types/execution/command.ts:8` "A selected tool's public
  API executed by a bundled, supervised native program"; `execution/contracts.ts:149`; `execution/copy/public.ts:41`;
  `types/execution/check.ts:150` and `types/execution/command.ts:32,69` (broken grammar)
- Kind: rewrite-text
- Problem: "native" appears in 72 comment lines and "authored" in 50 in this part. They add no meaning.
- Fix: Rewrite each comment in plain words, or delete it when the name already says it. Examples: "A built-in fix
  writes through the same checks as a command fix." "Runs a bundled script that calls the tool's JavaScript API." "A
  canceled run, or a fixer with no files, runs nothing." Write short sentences without semicolons. Then remove these
  files from the Vale ignore records of `gspot.toml` (IGN-002).
- Size: medium

### EXG-044: Error messages tell the user to do things they cannot follow

- Where: `execution/copy/contracts.ts:57-59` ("Prepare isolated dependencies for this revision"), `:114-116`
  ("Prepare this revision separately and run gspot apply"), `:146-148`; `execution/command/contracts.ts:237-238`
  ("failed during process launch, capture, or termination"); `generation/eslint/public.ts:245,251,262` ("Refresh the
  core rule names", with no command)
- Kind: rewrite-text
- Problem: The reader cannot tell what "prepare" or "refresh" means.
- Fix: Name the action. For example: "node_modules/x links outside the repository, so gspot cannot copy it for this
  commit. Check the commit in its own clone after running npm install there." The rule-name messages move with
  `validateEslintPresets` to `scripts/build.ts` (EXG-006) and say "Run mise run update:rule-lists to update the rule
  names."
- Size: small

### EXG-045: `Executable` and `Pass` each mean two things

- Where: `types/execution/check.ts:47-50, 55-60`; `execution/public.ts:53`; `execution/contracts.ts:230-263`
- Kind: rename
- Problem: Elsewhere "executable" means a program file (`inspectExecutable`, `environmentExecutable`). Here it means
  "a planned check with its run function". `Pass` is the run state, but "pass" also means a fixer pass and a passed
  check.
- Fix: Rename `Executable` to `RunnableCheck` and `planExecutables` to `planChecks`; rename `Pass` to `RunState`.
- Size: small

### EXG-047: Ten exports are used only inside their own file

- Where: `generation/eslint/configuration.ts` `eslintConfiguration`; `generation/eslint/public.ts`
  `serializeBlock` (today `serializeEslintBlock`, PLG-048); `generation/mise.ts` `miseToolLine`; `types/execution/check.ts` `BuiltInFix`,
  `RunReportOptions`; `types/generation/eslint.ts` `EslintBoundaryFile`, `EslintSettings`;
  `types/generation/files.ts` `GeneratedBlock`, `ToolFileConsumers`; `types/generation/fragments.ts`
  `FragmentSelector`
- Kind: delete
- Problem: Nothing outside each file names them (tests, scripts, and docs included), so `export` is not needed.
- Fix: Remove `export` from each. `miseToolLine` goes with EXG-062.
- Size: small

### EXG-048: The "Generated by gspot" header is written in one place and detected in another

- Where: `config/generation/headers.ts:7` (`GENERATED_HEADER_LINES`); `config/parsers/generated-header.ts:1-7`;
  `generation/documents/contracts.ts:97-109, 203-225` (`headerLines`); `parsers/public.ts:311-319` (`hasHeader`)
- Kind: merge
- Problem: The text "Generated by gspot" is defined in `config/generation/headers.ts` and matched by a separate regex
  in `config/parsers/generated-header.ts`: the writer and the reader keep separate copies of the comment marks (`#`,
  `//`, `--`, `<!--`) and of the JSON key, and `_gspot` is written twice, as `GENERATED_JSON_KEY` and inside the
  `JSON_HEADER` regex. `GENERATED_HEADER_LINES` is a one-item array with a `{{version}}` placeholder.
- Fix: Keep one copy of the header text: `generatedHeader()` in `parsers/generated-header.ts` returns the one line
  "Generated by gspot from gspot.toml. To change it, edit gspot.toml and run gspot apply." with no version (GEN-017),
  and `hasGeneratedHeader` (today `hasHeader`) detects it in the same file. `headerLines` and
  `GENERATED_HEADER_LINES` merge into `generatedHeader`. The file stays in the parser layer, because
  `repository/public.ts` calls `hasGeneratedHeader` and `repository` may not import `generation`. The reader's match
  values `GENERATED_HEADER_LINE` and `HEADER_LINES_CHECKED` go to `config/generation/headers.ts`, beside the writer's
  comment-mark constants. Delete `config/parsers/generated-header.ts`, `GENERATED_JSON_KEY`, and `JSON_HEADER`:
  generated JSON gets no `_gspot` key, and files inside `.gspot/` get no header (GEN-017).
- Size: small

### EXG-049: ESLint fragment values are built again for every tool file

- Where: `generation/tool-files.ts:76`; `generation/fragments.ts:128-134`; `generation/eslint/configuration.ts:177-182`
- Kind: simplify
- Problem: `emitToolFile` calls `fragmentInputs` for every target with no condition, including `.semgrepignore` and
  `vale.ini`. Each call builds `eslintModule`, `eslintRuleOptions(policy)`, and the selector groups again.
  `eslintModule` is built in three places.
- Fix: Call `fragmentInputs` only when the target has fragments (`fragments.length > 0` or `scope_fragments`).
  Compute `eslintRuleOptions(policy)` once per run.
- Size: small

### EXG-050: The values `fragments` and `fragmentParts` hold the same data

- Where: `generation/fragments.ts:122-123`; `types/generation/eta.ts:89-91`
- Kind: delete
- Problem: `fragments` is `fragmentParts.join('\n')`. Two templates use `fragments`, one uses `fragmentParts`.
- Fix: Delete `fragments`. The tool file sources (CFL-001) join `fragmentParts` themselves.
- Size: small

### EXG-051: The import-boundaries rule is built twice

- Where: `generation/eslint/configuration.ts:33-55` (`scopeBlocks`), `:58-74` (`gspotRules`)
- Kind: merge
- Problem: Both build `'gspot/import-boundaries': ['error', { folders: [...ESLINT_BOUNDARY_FOLDERS, ...scopePaths], aliases }]`.
- Fix: One `importBoundariesRule(scopes, aliases)` used by both, with the rule ID in `IMPORT_BOUNDARIES_RULE` in
  `config/generation/eslint.ts`.
- Size: small

### EXG-052: tRPC rules depend on a module named exactly "server"

- Where: `generation/eslint/boundaries.ts:105-107`; `config/generation/eslint.ts:84-123`
- Kind: rewrite-text
- Problem: The tRPC import rules turn on only when a `[[architecture.module]]` record is named `server`. Nothing
  tells the user this name matters: the tRPC manifest says only "the declared server module"
  (`configurations/library/trpc/manifest.toml:5`).
- Fix: Say in the tRPC manifest text and in the docs: "Name your server module `server` in
  `[[architecture.module]]`."
- Size: small

### EXG-053: `installedRoot` in `TsconfigInput` is a hidden mode switch

- Where: `generation/tsconfig.ts:17, 36, 48`; `generation/compilation/public.ts:194-200`;
  `checks/language/contracts.ts:346`
- Kind: rename
- Problem: Generation never passes `installedRoot`; the TypeScript check always passes it
  (`session.installedRoot ?? session.root`). "Undefined" really means "do not add `typeRoots` to your own project".
  The value is also a path: line 36 looks for type roots in that folder.
- Fix: Keep it as a path, with a name that says what it is, for example `typeRootsFolder`. Its doc comment says that
  only the TypeScript check sets it, and that a project you wrote then gets `typeRoots`.
- Size: small

### EXG-054: `copyIntoScratch` accepts two input shapes

- Where: `execution/copy/public.ts:133-162`
- Kind: simplify
- Problem: It takes either a `ScratchSource` or a `CheckInput` plus `extra`, chosen by `'paths' in input`. Four
  callers (`execution/command/public.ts:140`, `execution/contracts.ts:73`,
  `checks/general/dependencies/lockfile/fresh.ts:43`, `checks/tool/public.ts:164`) pass `dependencies: []` by hand.
  Every copy is named `gspot-fix-`, even for checks.
- Fix: Keep only the `ScratchCopyPaths` form (today `ScratchSource`). Add `checkCopyInputs(input, extra)` that
  returns one for the six `CheckInput` callers. Default `dependencies` to `[]`. Drop the folder prefix:
  `scratchFolder()` takes none and always uses `gspot-` (S01-013).
- Size: small

### EXG-055: `.venv` is cloned in some copies and not in others

- Where: `config/execution/copy.ts:9` (`SCRATCH_DIRECTORIES`); `execution/copy/public.ts:177-183`;
  `execution/copy/contracts.ts:128-136` (`getDependencies`), `:244-245` (the `node_modules` filter);
  `types/execution/copy.ts:27` (`DependencyFolder`); `checks/general/generated-code.ts:44`
- Kind: simplify
- Problem: Scratch copies of the working tree clone `.venv`; revision copies do not, "because Python tools run in
  place". `getDependencies` finds `.venv` folders only for `revisionDependencies` to drop them. The generated-code
  check reuses `SCRATCH_DIRECTORIES` for another job: skipping folders when it scans the working tree.
- Fix: No copy holds `.venv`, because the Python tools run in place. `listDependencyFolders` (today
  `getDependencies`) lists only `package.json` folders whose `node_modules` exists, and returns folder strings.
  Delete `DependencyFolder` and the `node_modules` filter. `SCRATCH_DIRECTORIES` then holds one value: merge it into
  `NODE_MODULES = 'node_modules'` in `config/repository/tracked.ts`, which also replaces the `'node_modules'` literals
  in `listDependencyFolders` and `revisionDependencies`. The generated-code check keeps its own exclusion list in its
  config file, because it must still skip `.venv`. Keep `pyproject.toml` in `DEPENDENCY_FILES` (today
  `PACKAGE_MANIFESTS`): the revision hash check also guards the `.venv` that the Python tools use in place.
- Size: small

### EXG-056: A bad `GSPOT_JOBS` value is ignored without a word

- Where: `execution/public.ts:147-148`
- Kind: fix-bug
- Problem: `GSPOT_JOBS=abc` or `GSPOT_JOBS=0` silently uses all cores, and the count comes from `cpus().length`
  instead of `availableParallelism()`.
- Fix: Use `availableParallelism()`. On the `GSPOT_JOBS` row of `docs/src/content/docs/reference/exit-codes.md`, say
  that any value other than a positive whole number uses all cores. Add no new error: it would add code.
- Size: small

### EXG-057: `WRITE_BATCH` names a pause interval, not a batch

- Where: `config/execution/copy.ts:3` (`WRITE_BATCH = 64`); `execution/copy/public.ts:123`
- Kind: rename
- Problem: The value is how often the copy loop yields so that a cancel can be seen.
- Fix: Rename it to `FILES_BETWEEN_PAUSES` in `config/execution/copy.ts`. Keep the pause: without it, a long
  synchronous copy loop cannot notice Ctrl-C.
- Size: small

### EXG-058: Limits, fallbacks, and per-OS branches in this area, with verdicts

- Where: as listed below
- Kind: simplify
- Problem: Each of these needs a reason to stay.
    - `FIX_PASSES = 3` (`execution/contracts.ts:250`): reruns fixers on files the previous fixer pass changed, so a
      formatter can format what another fixer wrote. Keep.

    - `fileBatches` Windows limit 7000 and the 5x escape factor (`execution/command/arguments/contracts.ts:13-17, 57`):
      `.cmd` wrappers hit the 8191-character limit of `cmd.exe`; the factor is a worst case and gives about 22 files per
      process on Windows. Keep; the comment is rewritten in EXG-043.

    - Unix limit of 100,000 bytes: below real limits. Keep.
    - `junction` links on Windows (`execution/copy/contracts.ts:45`): plain directory links need admin rights. Keep.
    - The case-collision refusal (`execution/copy/public.ts:59-81`): needed on macOS and Windows file systems. Keep.
    - `cygpath` in the commit-msg hook (`generation/contracts.ts:29-31`): needed for Git for Windows. Keep.
    - CRLF conversion: needed on Windows; do it once (EXG-031).
    - The pause every 64 files: needed for cancel; rename it (EXG-057).
    - The `p-limit` job count: needed; see EXG-056.
    - `tool_timeout_seconds`: one setting; remove the silent fallback (EXG-030).
    - The generated CI limit of 60 minutes: one constant (EXG-059).
    - `allSettled` in `runChecks` (`execution/public.ts:151-164`): `runOne` already catches every check error, so this
      covers only a throw from `onResult` or from ignore matching. Keep, with a comment that names that case.

    - The `existsSync(upper)` file-system test and the `{existing:...}` and `{workspace:...}` placeholders that expand
      to nothing: real features. Keep.

- Fix: Only the changes in the findings named above, plus the `allSettled` comment.
- Size: small

### EXG-059: Generated CI repeats the 60-minute limit and validates a trusted SHA

- Where: `generation/documents/public.ts:78, 273, 42-58`
- Kind: simplify
- Problem: GitHub and GitLab each hard-code 60 minutes. The generated script also checks that `GSPOT_CI_BASE` looks
  like a SHA, although GitHub and GitLab fill that value, it is quoted, and `gspot check --base` refuses a bad commit
  anyway.
- Fix: One `CI_TIMEOUT_MINUTES = 60` in `config/generation/ci.ts`, used by both providers. Delete the SHA pattern
  block; keep the empty and all-zeros cases (`ZERO_SHAS` in `config/generation/ci.ts`).
- Size: small

### EXG-060: `bunfig.ts` repeats the Bun lockfile names

- Where: `generation/bunfig.ts:19`
- Kind: merge
- Problem: `['bun.lock', 'bun.lockb']` is already in `LOCKFILES` (`config/parsers/lockfiles.ts:4,13`,
  `client: 'bun'`).
- Fix: `LOCKFILES.filter((entry) => entry.client === 'bun').map((entry) => entry.file)`.
- Size: small

### EXG-061: JSON layout is written by hand, and not the same way everywhere

- Where: `generation/json-format.ts` (66 lines); `generation/public.ts:259-267`
- Kind: simplify
- Problem: `jsonText` copies Prettier's JSON layout by hand so that generated JSON passes Prettier; Prettier's own
  `format` is async and `emitTarget` is synchronous. The npm tool project ignores it and uses a fixed 4-space indent.
- Fix: Keep `jsonText` and move it into `generation/headers.ts` (EXG-015). It can go only if generated JSON files
  leave the Prettier check, and that choice is still open. Whether it needs a test is settled after the code cut, by the
  rule for untested logic.
- Size: small

### EXG-062: The mise file is written as hand-made TOML

- Where: `generation/mise.ts:15-22, 30-41`
- Kind: simplify
- Problem: Other TOML output uses `stringify` from `@decimalturn/toml-patch` (`generation/contracts.ts:95`,
  `compilation/public.ts:235`). This file joins strings and uses `JSON.stringify` for TOML values.
- Fix: `miseFile` writes `.gspot/mise.toml` (`MISE_TOOL_PROJECT_FILE`): `[tools]` with one line per program tool, no
  `min_version`, no gspot or Node line, and no header (INX-001, INX-002, GEN-017). Build an object and call
  `stringify(..., TOOL_EMIT_FORMAT)`; only the swiftformat entry stays an inline table. Delete `miseToolLine`.
- Size: small

### EXG-064: Two ways to read shipped rule-name lists

- Where: `generation/compilation/public.ts:34, 62`; `generation/eslint/public.ts:233-235`
- Kind: simplify
- Problem: The Stylelint names come from a relative JSON `import`, parsed when the module is first imported. The
  ESLint names come from `readAsset`.
- Fix: Read both with `readAsset` on first use. `stylelintRuleNames` moves to
  `generation/tool-file-sources/stylelint.ts` and reads the file named by `STYLELINT_RULE_NAMES_FILE` in
  `config/generation/tool-file-sources.ts`.
- Size: small

### EXG-065: The "did the tool crash" rule is hard to follow

- Where: `execution/command/contracts.ts:119-132, 209-217`
- Kind: rewrite-text
- Problem: `verifyFiles` is true for every manifest check (`planned.manifest !== undefined`) and, for user checks,
  only for the `typos` and `markdownlint` formats (`parsers/output/public.ts`). The comment does not say this.
- Fix: Drop the per-format `verifyFiles` flag from every output format and the `planned.manifest` case: `checkedFindings` calls `isToolBroken` for every check, which already returns false unless the output format names files (`namesFiles`), so one rule holds for manifest checks and checks you own, and the doc comment of `isToolBroken` states it.
- Size: small

### EXG-066: Ignore counting goes through three helpers

- Where: `execution/public.ts:110-133`; `types/execution/check.ts:148`
- Kind: simplify
- Problem: `dropIgnoredFindings` gets both the map and its keys. `applyIgnores` makes new counters, and `mergeUses`
  copies them back with a cast.
- Fix: Let `dropIgnoredFindings` add each match into the shared map directly, and delete `mergeUses`. Keep
  `applyIgnores` and `IgnoredFindings.uses`: `checks/general/contracts.ts:137` reads `.uses` to find ignore records
  that match nothing, and two tests call `applyIgnores`.
- Size: small

### EXG-067: Small leftovers

- Where: `execution/report.ts:45`; `config/generation/eslint.ts:28`; `execution/public.ts:72`;
  `generation/public.ts:113`; `commands/init/plan.ts:173`; `config/generation/ci.ts:16-23`;
  `generation/documents/public.ts:334`; `config/execution/copy.ts:5`
- Kind: delete
- Problem: Small noise left in the code.
- Fix:
    - `execution/report.ts:45` `const results = ran;`: delete the alias.
    - `config/generation/eslint.ts:28`, the dangling comment "Shared ESLint data comes from the JavaScript
      configuration's shipped assets.": delete it.

    - `execution/public.ts:72` says "in need of a Docker daemon", but the code checks only that Docker is installed:
      say "Docker is not installed".

    - The two notes that CLAUDE.md text moves to the end of AGENTS.md (`generation/public.ts:113`,
      `commands/init/plan.ts:173`): delete both; gspot never touches CLAUDE.md.

    - `CI_FILE_NOTES` is init screen text: move it to `config/commands/init.ts`. `GITLAB_INCLUDE_LABEL` stays in
      `config/generation/ci.ts`, beside `GITLAB_WORKFLOW` and the `CI_FILE_LABELS` table built from them (S03-007).

    - `ciNpmInstall` (`generation/documents/public.ts:334`): delete it; generated CI starts gspot through mise only
      (INX-005, INS-003).

    - `CLONE_OPTIONS` (`config/execution/copy.ts:5`), one use: write the two `fs.cp` options inline in `copyTree`.

- Size: small

### EXG-068: `CheckInput` repeats fields it can derive

- Where: `types/execution/check.ts:76-102`; `execution/contracts.ts:271-299`
- Kind: simplify
- Problem: `scope`, `view`, and `scopeRoot` all come from `selection` and `root`: `checkInput` sets
  `scope: planned.scope.scope.path`, `view: planned.scope.view`, `scopeRoot: join(session.root, ...)`, and
  `selection: planned.scope`. 76 files use `CheckInput`.
- Fix: Keep `selection` and `root`; delete the three derived fields and update the callers.
- Size: large

### EXG-069: Command placeholders are parsed three different ways

- Where: `execution/command/arguments/public.ts:45-52, 92-102, 229-247`
- Kind: simplify
- Problem: `{workspace:x}` is found by a string prefix. `{each:...}` and `{existing:...}` use anchored regular
  expressions. `{setting:x}` uses a global one (EXG-039). A list setting also accepts a plain string
  (`listArguments`, line 50).
- Fix: Use one anchored regular expression per whole-argument placeholder, in `config/configurations.ts`
  (`WHOLE_SETTING_PLACEHOLDER`, and `WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u`, which replaces
  `WORKSPACE_PREFIX` and the `endsWith` test). List settings accept lists only.
- Size: small

### S04-001: `checkRun` becomes a one-line wrapper once its throw goes

- Where: `execution/contracts.ts:329-336` (`checkRun`); its caller `execution/public.ts:53-58` (`planExecutables`,
  target `planChecks`); tests `tests/cli/checks/tool/github-actions.test.ts:112`,
  `tests/tools/configurations/infra/github-actions.test.ts:60`
- Kind: simplify
- Problem: Once EXG-038 deletes its throw, what is left is `checks[check.name]?.run ?? runCheckCommand`, with one
  production caller. The two tests that call it plan `github-actions/actionlint`, a command check.
- Fix: Inline it into `planChecks` in `execution/run.ts`: `run: options.checks[check.check.name]?.run ?? runCheckCommand`. The two tests call `runCheckCommand(session, planned)`. Do after EXG-038.
- Size: small

### S04-003: `proseInputs` passes five config constants through the template value bag

- Where: `generation/compilation/contracts.ts:71-96` (`proseInputs`, target `generation/prose.ts`)
- Kind: simplify
- Problem: It returns `VALE_PACKAGES`, `BANNED_HEADINGS`, `BLOCK_IGNORES`, and `TOKEN_IGNORES` unchanged (lines 75,
  76, 89, 90), and computes `formats` only from `PROSE_GRAMMARS` (line 91). A value bag made sense for Eta, which sees
  only what it is handed. TypeScript tool file sources import config directly.
- Fix: The Vale tool file sources import `BANNED_HEADINGS`, `BLOCK_IGNORES`, and `TOKEN_IGNORES` from
  `config/generation/prose.ts`, and `VALE_PACKAGES` from `config/tools/vale.ts`. Add `PROSE_FORMATS` (the
  `[extension, format]` pairs, derived from `PROSE_GRAMMARS`) to `config/generation/prose.ts`. `proseInputs` returns
  only the allowed words (the gspot.toml `allowed_words` list and the manifests' `allowed_words` lists) and `rules`.
- Size: small

### S04-004: `eslintInputs` passes functions through the value bag and guards a shipped name

- Where: `generation/eslint/configuration.ts:138-197`
- Kind: simplify
- Problem: It hands `eslintRuleSettings`, `eslintErrorRules`, and `eslintAllRules` to the template (lines 176, 185, 186) only because Eta cannot import. Its `eslintPresets` lookup throws "No configuration owns the X ESLint presets"
  (line 191) for a name that only a shipped template passes.
- Fix: The ESLint tool file source (CFL-001) imports `eslintRuleSettings` and `eslintErrorRules` and reads
  `eslint_all_rules` itself. Delete the throw: a wrong shipped name is a gspot bug, not a user error.
- Size: small

### S04-007: Three types exist only to annotate config values, which config may not import

- Where: `types/generation/hooks.ts:6` (`HookRunner`), `types/generation/prose.ts:2` (`ProseGrammar`),
  `types/generation/eslint.ts:68` (`EslintDependencyNode`)
- Kind: delete
- Problem: Each type's only use is the annotation or `satisfies` clause of one constant in `config/`. `config/`
  imports only from `config/`, and a config value carries no type annotation, so the annotations go and the types are
  then unused.
- Fix: Delete the three types. `RUNNERS`, keyed by `RUNNER_NAMES`, loses its `satisfies` clause: `RUNNERS[runner]` in
  `generation/hooks.ts` still fails to compile when a runner has no entry. Write `PROSE_GRAMMARS` and
  `TRPC_DEPENDENCY_SELECTORS` `as const` with no annotation; the code that reads them does the type check.
- Size: small

### S04-008: `LINT_CHECK` names the ESLint check ID with a name that fits every linter

- Where: `config/generation/eslint.ts:31`; its one user `generation/eslint/contracts.ts:72` (`eslintIgnoreBlocks`)
- Kind: rename
- Problem: The value is `'javascript/eslint'`. About 30 checks run a linter, so "lint check" does not say which.
- Fix: Rename it to `ESLINT_CHECK` in `config/generation/eslint.ts`.
- Size: small

### S04-009: `fixFailure` has no line cap, so a crashed fixer can print thousands of lines

- Where: `execution/contracts.ts:31-40` (`fixFailure`, target `execution/fixes.ts`);
  `execution/command/contracts.ts:262-267` (`toolOutputDetail`)
- Kind: fix-bug
- Problem: `fixFailure` joins the whole stderr and stdout by hand (line 38). `toolOutputDetail` does the same but
  keeps only the last `TAIL_LINES` lines of each stream, and `outputFailure` (line 115) already uses it for the same
  message shape.
- Fix: Build the note as `` `${name} exited ${code}: ${toolOutputDetail(result, '')}` ``, and drop the colon when the
  detail is empty.
- Size: small

### S04-010: `config/execution/runtime.ts` uses "runtime" for the run

- Where: `config/execution/runtime.ts` (`FAILED_STATUSES`, `FIX_PASSES`, `FIX_DIFF_CONTEXT`, `RAN_STATUSES`)
- Kind: rename
- Problem: The file holds the statuses and fixer passes of a check run. "Runtime" already names the JavaScript
  runtime (`config/platform/runtime.ts`, `generation/eslint/runtimes.ts`). The glossary word is "run".
- Fix: Rename the file in place to `config/execution/run.ts`. It also takes `CHECK_STATUSES` (see "Imports of config/
  and types/").
- Size: small

## Layout

```text
packages/cli/src/execution/
  run.ts                executeRun, runChecks, runOne, planChecks, settleResult, dropIgnoredFindings
  fixes.ts              applyFixers, fixerPasses, runFixer, runFix, scratchFix, runCommandFix, fixFailure
  built-in.ts           runBuiltInCheck, checkInput, checkResult
  ignores.ts            applyIgnores, isEntryMatch
  report.ts             buildRunReport, emptyResult, failedChecks, reproduceLine
  command/check.ts      runCheckCommand, runCheckTool, runInScratch, prepareInScratch, findTool, runPlannedTool,
                        prepareCommand, commandEnvironment
  command/output.ts     finishResult, commandOutcome, recordInvocation, checkedFindings, hasToolError,
                        executionFailure, toolOutputDetail
  command/placeholders.ts  substitute, substituteValue, commandToolFiles, scratchFiles, perFileCommands, commandItems
  command/batches.ts    fileBatches, batchedCommands
  copy/scratch.ts       copyIntoScratch, projectCopyInputs, writeScratchFiles
  copy/revision.ts      copyRevision, populateRevision, revisionDependencies, listDependencyFolders, copyValePackages
  copy/dependencies.ts  copyDependencies, copyTree, repairLink
packages/cli/src/generation/
  files.ts              emitAll, generatedPaths, gitignoreBlock, attributesBlock, emitBlocks, mergeFileEdits
  tool-files.ts         emitToolFiles, emitToolFile, emitTarget
  tool-file-sources/    one TypeScript tool file source per tool (knip.ts, stylelint.ts, html-validate.ts, ...)
  fragments.ts  headers.ts (json-format.ts merged in)  ignore-patterns.ts  pointers.ts  rule-capture.ts
  ci.ts  formatting.ts  hooks.ts  python.ts  npm.ts  prose.ts
  bunfig.ts  mise.ts  redirects.ts  jsconfig.ts  tsconfig.ts
  eslint/files.ts       eslintFilePatterns, eslintSourcePattern, eslintNodePatterns
  eslint/serialize.ts   eslintModule, serializeEslintBlock, eslintErrorRules, eslintRuleSettings
  eslint/blocks.ts      the rule blocks of today's eslint/contracts.ts, selectorGroups
  eslint/presets.ts     readEslintPresets, readEslintRuleNames
  eslint/configuration.ts  eslint/boundaries.ts  eslint/runtimes.ts
```

Items that leave this part:

- `gitPrefix` (today `hookPrefix`) and `gitTopLevel` go to `system/git.ts` (EXG-032).
- `generatedHeader` goes to `parsers/generated-header.ts` (EXG-048); `getTable` merges into `valueAt` in
  `src/objects.ts`.
- `workspaceSourceFiles` and `WORKSPACE_SOURCE_MEMO` go to `repository/scopes.ts` (EXG-023).
- `toolTimeoutSeconds` (today `toolDeadline`) goes to `tools/run.ts` (EXG-030).
- `historyResult` goes to `checks/general/history.ts` (EXG-027).
- `validateEslintPresets` goes to `scripts/build.ts` (EXG-006).
- The setting-schema generator of `generation/compilation/` is deleted (POL-001), and so are Eta, `etaInputs`, and
  `EtaInputs` (CFL-001).

## Constants and types

Every constant and type of this area lives in `config/` or `types/`, grouped by topic. `config/` imports only
`config/`; `types/` imports only `config/` and `types/`.

| Path                                     | Topic                                                                                                                                                                                               | Comes from                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `config/execution/command.ts`            | command-line limits per OS, output tail                                                                                                                                                             | kept                                                                      |
| `config/execution/copy.ts`               | scratch copies: `FILES_BETWEEN_PAUSES`, `SCRATCH_EXTRAS`, `DEPENDENCY_FILES`, the Git arguments of the revision copy                                                                                | kept                                                                      |
| `config/execution/run.ts`                | the check run: `CHECK_STATUSES`, `FAILED_STATUSES`, `RAN_STATUSES`, `FIX_PASSES`, `FIX_DIFF_CONTEXT`, `JOBS_VARIABLE`, the Docker tool name                                                         | `config/execution/runtime.ts`                                             |
| `config/generation/ci.ts`                | CI workflows: paths, cached paths, `CI_PINS`, `CI_TIMEOUT_MINUTES`, `CI_CACHE_FILES`, `ZERO_SHAS`, `CI_BASE_VARIABLE`, the GitHub and GitLab static parts, `GITLAB_INCLUDE_LABEL`, `CI_FILE_LABELS` | `config/generation/ci.ts`, `config/generation/pins.ts`                    |
| `config/generation/eslint.ts`            | ESLint: rule IDs, boundary policies (`TEST_IMPORT_POLICY`), selectors, language lists, file patterns, `ESLINT_SETTINGS_TABLE`, `ESLINT_CHECK`                                                       | kept                                                                      |
| `config/generation/file-edits.ts`        | file edits to `bunfig.toml`: file name, key paths, setting names                                                                                                                                    | new                                                                       |
| `config/generation/files.ts`             | generated files and managed blocks: the `.gitattributes` block and its patterns                                                                                                                     | kept                                                                      |
| `config/generation/formatting.ts`        | Prettier and EditorConfig: the selector EditorConfig cannot express, fixed Prettier options                                                                                                         | kept                                                                      |
| `config/generation/headers.ts`           | the generated header: comment style by extension, `GENERATED_HEADER_LINE`                                                                                                                           | kept                                                                      |
| `config/generation/hooks.ts`             | Git hooks: `HOOK_ARGS`, `RUNNERS`, the hook shebang, the commit-message path lines                                                                                                                  | kept                                                                      |
| `config/generation/html.ts`              | html-validate rules                                                                                                                                                                                 | kept                                                                      |
| `config/generation/ignore-patterns.ts`   | ignore-pattern rewriting: brace tokenizer, folders that are always ignored                                                                                                                          | new                                                                       |
| `config/generation/prose.ts`             | Vale: `PROSE_GRAMMARS`, `BANNED_HEADINGS`, `TOKEN_IGNORES`, `BLOCK_IGNORES`, `PROSE_FORMATS`, the rule extension                                                                                    | `config/generation/prose.ts`, `config/generation/eta.ts`                  |
| `config/generation/tool-file-sources.ts` | static values of the TypeScript tool file sources: the knip entry setting, `STYLELINT_RULE_NAMES_FILE`                                                                                              | new                                                                       |
| `config/generation/tool-projects.ts`     | the npm tool project: `JSON_INDENT`, `YARN_TOOL_PROJECT_SETTINGS`, the `next` package name                                                                                                          | `config/generation/eta.ts`                                                |
| `config/generation/typescript.ts`        | tsconfig and jsconfig options and file names                                                                                                                                                        | kept                                                                      |
| `config/commands/init.ts`                | gains `CI_FILE_NOTES`                                                                                                                                                                               | `config/generation/ci.ts`                                                 |
| `config/configurations.ts`               | gains the placeholders `WHOLE_SETTING_PLACEHOLDER`, `WORKSPACE_PLACEHOLDER`, `{target_module}`, `{target_json}`                                                                                     | new values                                                                |
| `config/parsers/dependency-files.ts`     | gains `PACKAGE_JSON`, `PACKAGE_SWIFT`                                                                                                                                                               | new values                                                                |
| `config/repository/tracked.ts`           | gains `NODE_MODULES`, `GITATTRIBUTES_FILE`, `GITIGNORE_FILE`                                                                                                                                        | `SCRATCH_DIRECTORIES` of `config/execution/copy.ts` (EXG-055); new values |
| `config/tools/python.ts`                 | gains `PYTHON_ENVIRONMENT_FOLDER` (the project `.venv`)                                                                                                                                             | new value                                                                 |
| `config/rules.ts`                        | gains `AGENTS_FILE`                                                                                                                                                                                 | new value                                                                 |
| `config/settings/values.ts`              | gains `TOOL_TIMEOUT_SETTING`                                                                                                                                                                        | new value                                                                 |
| `config/system/git.ts`                   | gains `GIT_PREFIX_ARGUMENTS`                                                                                                                                                                        | new value                                                                 |
| `scripts/config/grammars.ts`             | gains `SWIFT_GRAMMAR_PIN`                                                                                                                                                                           | `config/generation/pins.ts`                                               |
| `scripts/config/rule-lists.ts`           | the module and file names that the rule-list script reads                                                                                                                                           | `config/generation/eslint.ts`                                             |
| `types/execution/check.ts`               | the check run: built-in checks, fixes, run options and `RunState`, the report, statuses, `ReproduceOptions`                                                                                         | `types/execution/check.ts`, `types/execution/reproduce.ts`                |
| `types/execution/command.ts`             | command checks: placeholders, invocations, prepared commands, output                                                                                                                                | kept                                                                      |
| `types/execution/copy.ts`                | scratch copies and dependency trees (`ScratchCopyPlan`, `ScratchCopyPaths`, `DependencyTreeCopy`)                                                                                                   | kept                                                                      |
| `types/generation/ci.ts`                 | CI pins, pipeline, GitHub check step                                                                                                                                                                | kept                                                                      |
| `types/generation/eslint.ts`             | ESLint blocks, boundaries, file selectors, module                                                                                                                                                   | kept                                                                      |
| `types/generation/files.ts`              | generated files, emit inputs, the npm tool project input, `HookName` (derived from `HOOK_ARGS`)                                                                                                     | `types/generation/files.ts`, `npm.ts`, `hooks.ts`                         |
| `types/generation/formatting.ts`         | Prettier, EditorConfig, JSON layout                                                                                                                                                                 | kept                                                                      |
| `types/generation/fragments.ts`          | fragments and their selectors                                                                                                                                                                       | kept                                                                      |
| `types/generation/typescript.ts`         | `JsconfigInput`, `TsconfigInput`                                                                                                                                                                    | `types/generation/jsconfig.ts`, `tsconfig.ts`                             |
| `types/checks/general.ts`                | gains `SuppressionComment`                                                                                                                                                                          | `types/execution/check.ts`                                                |
| `types/commands/check.ts`                | gains `RevisionSource`                                                                                                                                                                              | `types/execution/copy.ts`                                                 |
| `types/ownership.ts`                     | gains `FileEdit` (with `KeyChange`) and the hand-written `CapturedLintRules`                                                                                                                        | `types/generation/files.ts`, `types/generation/rules.ts`                  |

Files that go: `config/generation/eta.ts`, `config/generation/pins.ts`, `types/execution/reproduce.ts`,
`types/generation/eta.ts`, `types/generation/prose.ts`, `types/generation/rules.ts`, `types/generation/jsconfig.ts`,
`types/generation/tsconfig.ts`, `types/generation/npm.ts`, `types/generation/hooks.ts`.

Items that stay in their module:

- Memo keys (`WORKSPACE_SOURCE_MEMO` and the other `*_MEMO` keys) hold code: a cache factory whose identity is the
  cache key. They stay beside their function, in every area.
- `stylelintRuleNames` is computed from a file, so it stays in `generation/tool-file-sources/stylelint.ts` and is
  read on first use (EXG-064).

## Values that move into config/

Messages people read stay in the code: the reproduce line, error notes, and the generated header sentence. So do
library call options, such as the `fs.cp` and `picomatch` options. The values that move:

1. The Git arguments of the revision copy (`GIT_SHARED_CLONE`, `GIT_SET_HEAD`, `GIT_EMPTY_INDEX`, `GIT_INDEX_INFO`,
   `GIT_WRITE_TREE`, `GIT_HASH_PATHS`) go to `config/execution/copy.ts`.
2. `PACKAGE_JSON = 'package.json'` goes to `config/parsers/dependency-files.ts`. It replaces eight literals in five
   functions and one in `SCRATCH_EXTRAS`, and it merges with `NPM_MANIFEST` in `config/checks/general/dependencies.ts`,
   which holds the same value.
3. `TOOL_TIMEOUT_SETTING = 'tool_timeout_seconds'` goes to `config/settings/values.ts` (EXG-030).
4. `CI_TIMEOUT_MINUTES = 60` goes to `config/generation/ci.ts`, used by GitHub and GitLab (EXG-059).
5. `ESLINT_SETTINGS_TABLE = 'tools.eslint'` goes to `config/generation/eslint.ts`; today it is written in five places
   in four generation files.
6. `CODE_LANGUAGES = ['javascript', 'typescript']` goes to `config/generation/eslint.ts`; it is the language pair
   passed to `eslintSourcePattern` in five places.
7. `WHOLE_SETTING_PLACEHOLDER` and `WORKSPACE_PLACEHOLDER` go to `config/configurations.ts`. They replace string
   slicing and a `lastIndex` reset (EXG-039, EXG-069).
8. `JOBS_VARIABLE = 'GSPOT_JOBS'` goes to `config/execution/run.ts`.
9. The static parts of the GitHub and GitLab files (`GITHUB_EVENTS`, `GITHUB_BASE_EXPRESSION`,
   `GITHUB_MANUAL_CONDITION`, `GITHUB_CONCURRENCY`, `GITLAB_BASE_LINE`, `GITLAB_RULES`, `CHECKOUT_OPTIONS`, and
   `CI_CACHE_FILES`) go to `config/generation/ci.ts`. `CI_CACHE_FILES` names the path constants of `gspot.toml`, the
   npm and Python tool projects and their lockfiles, `.gspot/mise.toml`, and the version pin.
10. The rule IDs the ESLint generator writes (`IMPORT_BOUNDARIES_RULE`, `TRIVIAL_FILES_RULE`,
    `TRIVIAL_FUNCTIONS_RULE`, `FILE_EXTENSION_RULE`, `IMPORT_LAYOUT_RULES`, and the other rule-ID constants) go to
    `config/generation/eslint.ts`.

## Imports of config/ and types/

`config/` files that import from outside `config/`:

| File                             | Import                                                                              | Fix                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/execution/runtime.ts:1`  | `type CheckStatus` from `types/execution/check.ts`                                  | Add `CHECK_STATUSES = ['passed', 'failed', 'missing', 'skipped', 'error'] as const` to `config/execution/run.ts` (S04-010). Type the sets `new Set<(typeof CHECK_STATUSES)[number]>(...)`. `types/execution/check.ts` derives `CheckStatus` from it. `config/terminal.ts:1` has the same import and takes the same fix. |
| `config/generation/eslint.ts:1`  | `type EslintBoundaryPolicy, EslintDependencyNode` from `types/generation/eslint.ts` | Write the policies and selectors `as const`. Make the arrays of `EslintBoundaryPolicy` in `types/` readonly, so the literal values fit it. Delete `EslintDependencyNode` (S04-007).                                                                                                                                     |
| `config/generation/hooks.ts:1-2` | `type Policy`, `type HookRunner` from `types/`                                      | Drop the `satisfies` clause and delete `HookRunner` (S04-007). The index `RUNNERS[runner]` keeps the completeness check.                                                                                                                                                                                                |
| `config/generation/pins.ts:1-2`  | `type Policy`, `type ActionPin` from `types/`                                       | Drop both `satisfies` clauses. `CI_PINS` moves to `config/generation/ci.ts` (EXG-006). `pinned(pin: ActionPin)` and `CI_PINS.runners[platform]` keep the type checks where the values are used.                                                                                                                         |
| `config/generation/prose.ts:3`   | `type ProseGrammar` from `types/generation/prose.ts`                                | Write `PROSE_GRAMMARS` `as const` with no annotation, and delete `ProseGrammar` (S04-007).                                                                                                                                                                                                                              |

`config/execution/copy.ts` and `config/generation/files.ts` import `config/platform/locations.ts`. That is config to
config and allowed; the path becomes `config/system/locations.ts`.

`types/` files that import from outside `config/` and `types/`:

| File                            | Import                                                                                                | Fix                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types/execution/check.ts:1,7`  | `type z` from `zod`; `type resultSchema` from `parsers/schema/contracts.ts`                           | `CheckStatus` and `CheckResult` become plain types, and `resultSchema` is deleted (PAR-006). Both imports go.                                    |
| `types/generation/eta.ts:2,6`   | `dirname`, `relative` from `node:path/posix`; `frozenMigrationPaths` from `parsers/sql/migrations.ts` | The file is deleted with Eta (CFL-001).                                                                                                          |
| `types/generation/rules.ts:1-2` | `type z`; `type ruleSettingsSchema` from `parsers/schema/contracts.ts`                                | `CapturedRules` becomes `CapturedLintRules`, written by hand in `types/ownership.ts`; the schema is checked against it (LIF-010). The file goes. |

`types/generation/hooks.ts:1` imports `HOOK_ARGS` from `config/`, which is allowed. `scripts/types/pins.ts` imports
`ActionPin` from the CLI's `types/`; it is deleted with `scripts/check-pins.ts`, so `pinned()` in `generation/ci.ts`
is the one user of that type.

The rule for every area: a config value that carries a `types/` annotation either becomes `as const`, with the
`types/` type made readonly so the value fits, or drops a `satisfies` clause whose check the indexed use already does.
When the named type is only the shape of the value, `types/` derives it with `typeof`.

## Names

| Concept                                                                      | The one name                                                                                                                                             | Today                                                                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The temporary copy a check or fix runs in                                    | scratch copy: `copyIntoScratch`, `runInScratch`, `prepareInScratch`, `scratchFix`, `scratchFiles`, `copyRevision`, `ScratchCopyPlan`, `ScratchCopyPaths` | `runInWorkspace`, `isolatedFix`, `isolatedFiles`, `checkOutRevision`, `ScratchCopy`, `ScratchSource` |
| npm, pnpm, Yarn, and Bun workspaces                                          | workspace (only this meaning)                                                                                                                            | also the scratch copy                                                                                |
| Changing files so findings go away                                           | fix; fixer; fixer pass                                                                                                                                   | correction, "native correction"                                                                      |
| A check gspot runs in its own code                                           | built-in check                                                                                                                                           | native check                                                                                         |
| A time limit                                                                 | timeout: `tool_timeout_seconds`, `toolTimeoutSeconds`, `timeoutSeconds`, `TOOL_TIMEOUT_SETTING`                                                          | `toolDeadline`, `TOOL_DEADLINE`                                                                      |
| What a tool file is made from                                                | tool file source: a plain file, or a function in `generation/tool-file-sources/`                                                                         | `.eta` template, `EtaInputs`, `ScopeEtaInputs`                                                       |
| Key edits to a file the user already has                                     | file edit: `FileEdit`, `fileEdits`, `mergeFileEdits`                                                                                                     | `Generated.toolFiles`, `EmittedToolFile`, `combineToolFiles`                                         |
| Making file text in memory                                                   | emit (code only)                                                                                                                                         | compile (`compilation/`)                                                                             |
| ESLint limits                                                                | the setting names: `nesting`, `callback_nesting`, `cyclomatic_complexity`                                                                                | `depth`, `nestedCallbacks`, `cyclomatic`                                                             |
| A planned check with its run function                                        | `RunnableCheck`, `planChecks`                                                                                                                            | `Executable`, `planExecutables`                                                                      |
| One run's state                                                              | `RunState`                                                                                                                                               | `Pass`                                                                                               |
| The program that starts gspot in the hooks and the `AGENTS.md` managed block | runner: `RUNNER_NAMES`, `RUNNERS`                                                                                                                        | `HOOK_RUNNERS`                                                                                       |
| The Git top level and prefix                                                 | `gitTopLevel`, `gitPrefix` in `system/git.ts`                                                                                                            | `hookPrefix`, inline `rev-parse` calls                                                               |
| How often the copy loop pauses                                               | `FILES_BETWEEN_PAUSES`                                                                                                                                   | `WRITE_BATCH`                                                                                        |
| The ESLint check ID                                                          | `ESLINT_CHECK`                                                                                                                                           | `LINT_CHECK`                                                                                         |
| The fixed values of a check run                                              | `config/execution/run.ts`                                                                                                                                | `config/execution/runtime.ts`                                                                        |
