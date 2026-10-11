# The command line

This part is the front door of gspot: `packages/cli/src/main.ts`, the file that builds the Commander program
(`packages/cli/src/public.ts`), the commands under `packages/cli/src/commands/`, the printing code under
`packages/cli/src/terminal/`, and their constants and types in `config/` and `types/`. Today gspot has 12 commands, 5
program options, mode flags such as `set --remove`, and two files named `public.ts` and `contracts.ts` that hold
unrelated jobs. The target has 14 commands, each with one job and no mode flags; every command takes `--json`, the
program options are `--version` and `--help` only, every help text lives in `config/commands/help.ts`, and each command
lives in `commands/<name>.ts` or `commands/<name>/command.ts`.

## Findings

### CMD-001: `check --fix --json` throws away the fix results and the dry-run diffs

- Where: `packages/cli/src/commands/check/tree.ts:20-36`, `packages/cli/src/commands/check/tree.ts:80-84`, `packages/cli/src/terminal/public.ts:50-62`, `packages/cli/src/types/execution/check.ts:112-131`
- Kind: fix-bug
- Problem: With `--json`, gspot prints only the run report. The fixer results (which files changed, why a fixer failed, and the diffs of `--fix --dry-run`) go only into the text output and into `warn()` lines, which print nothing under `--json`. So `gspot check --fix --dry-run --json` prints no diff, and `gspot check --fix --json` never says which files the fixers changed. Only the names of failed fixers reach the JSON, in the `failed` list, without the reason. gspot's own CLI rule (`.gspot/rules/general/engineering/code/CLI.md`) says JSON output is complete.
- Fix: Put the existing `FixReport` into the JSON as it is, with no new shape. Where `checkTree` builds its result (`buildResult`, inlined into `runSelected`), write `json: { ...outcome.report, ...compact({ fixes: outcome.fixes }) }`. Its `results` already carry each failed fixer's note, and `changed` and `diffs` carry the rest. `reportFixes` stays for the text only. No published schema of the run report exists, so nothing else changes.
- Size: small

### CMD-003: Two meaningless file names hold six unrelated jobs

- Where: `packages/cli/src/commands/public.ts` (`openSession`, `commandRoot`, `commandHelp`, `registerApply`, `applyCommand`), `packages/cli/src/commands/contracts.ts` (`registerInstall`, `installCommand`, `savePolicy`, `exportCommand`, `registerExport`), `packages/cli/src/public.ts`, `docs/src/config/reference.ts:15-23`, `docs/src/content/reference/commands.ts:11-13`
- Kind: move
- Problem: A newcomer cannot guess that `gspot install` lives in `commands/contracts.ts` or that `gspot apply` lives in `commands/public.ts`: command entry points use four file-name schemes (`check` in `commands/check/command.ts`; `doctor`, `explain`, and `init` in `commands/<name>/public.ts`; `apply` in `commands/public.ts`, `install` and `export` in `commands/contracts.ts`; `add`, `remove`, `set`, `list`, and `ignore` in plain `commands/<name>.ts`). Commit `9a3851a9a` merged the well-named files `apply.ts`, `install.ts`, `export.ts`, `save-policy.ts`, `session.ts`, `help.ts`, and `program.ts` into these two files, so the shared "edit gspot.toml, then write the files" step now shares a file with two commands. The docs keep a lookup table, `COMMAND_OWNERS`, that maps each command to its file and fails the docs build through an `access()` call when a file is missing.
- Fix: Split back by job, with no new code: `commands/session.ts` (`openSession`, `scopeSelections`), `commands/apply.ts` (`applyCommand`, `registerApply`, `planApply`, `staleFilesText`), `commands/install.ts`, `commands/export.ts`, and `commands/save-settings.ts` (`saveSettings`, today `savePolicy`, and `reportText`). `src/public.ts` becomes `commands/program.ts` (`buildProgram`, `main`, `printFailure`, `commandHelp`), with the help footer loop of CLX-012; `main.ts` stays. Then every command lives in one file named after it: `add`, `apply`, `export`, `ignore`, `install`, `list`, `remove`, `set`, `unignore`, and `unset` in `commands/<name>.ts`, and `check`, `doctor`, `explain`, and `init` in `commands/<name>/command.ts`, because they need more files (a `commands/init.ts` beside a `commands/init/` folder would trip `structure/stem-collisions`; see "Layout" below). In the docs, delete `COMMAND_OWNERS`, its `access()` check, and the edit links of the commands page (`editUrl: false`) (DOC-018).
- Size: medium

### CMD-004: `apply` and savePolicy are two copies of one pipeline, and they behave differently

- Where: `packages/cli/src/commands/public.ts:261-298`, `packages/cli/src/commands/contracts.ts:121-178`
- Kind: merge
- Problem: Both functions open the ownership log for writing, edit gspot.toml in memory (`editPolicy`), open a second session from the new text, emit every file (`emitAll`), write gspot.toml through the ownership log (`writePolicyFile`), and write the generated files (`writeGeneratedFiles`). Only `applyCommand` also adds the configurations the repository now needs (`reconcileConfigurations`); savePolicy, which add, remove, set, and ignore use, does not. The help of add, remove, and ignore says "gspot applies the policy", but they do not do what `gspot apply` does.
- Fix: Keep one function, `saveSettings(root, { input, change, summary })` in `commands/save-settings.ts`. `applyCommand` calls it with `change = reconciliation.mutate` and `summary = noteLines(reconciliation.notes)`. The other commands do not add configurations: doing so would make `gspot set` quietly select configurations. Delete the early return "gspot.toml already says this; nothing to apply", because apply must write the generated files even when gspot.toml does not change (writing an unchanged file changes nothing). Only apply keeps a dry run (CLX-004): `planApply` in `commands/apply.ts` prints it, and apply calls `saveSettings` only for a real run.
- Size: medium

### CMD-005: The "write gspot.toml through the ownership log" block is copied four times

- Where: `packages/cli/src/commands/public.ts:284-294`, `packages/cli/src/commands/contracts.ts:149-159`, `packages/cli/src/commands/init/contracts.ts:219-229`, `packages/cli/src/checks/general/contracts.ts:222-230`
- Kind: merge
- Problem: Four copies of the same 10 lines: `writePolicyFile({ text, original, publish: (next, expected) => applyPlans(log, [{ ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }), before: expected }]) })`. The fourth copy, in the gspot.toml format fixer (`fixPolicyLayout`), already lacks `before: expected`, so the copies already differ.
- Fix: Make `writeSettings` (today `writePolicyFile`, target `settings/file.ts`) take the ownership log, the text, and the original copy, and build the replacement plan itself, in the three-copy form with `before: expected`. Call it from apply, `saveSettings`, init, and the format fixer (`fixSettingsFormat`).
- Size: small

### CMD-006: Failures are printed two different ways, with 18 unrelated JSON error names

- Where: `packages/cli/src/commands/init/public.ts:56-75`, `packages/cli/src/commands/init/public.ts:136-141`, `packages/cli/src/commands/contracts.ts:138-171`, `packages/cli/src/commands/contracts.ts:105-112`, `packages/cli/src/commands/check/command.ts:106-117`, `packages/cli/src/public.ts:38-50`
- Kind: simplify
- Problem: Most failures throw a `GspotError`, and `main` prints it to stderr, or as `{ error, message }` on stdout under `--json`. Other failures come back as normal results with exit code 2: in text mode they print to stdout, and under `--json` they have other shapes. gspot's CLI rule says errors go to stderr, and a script that reads `--json` must handle many shapes. The `error` field can be any of 18 names: `arguments`, `failure` (from `main`), the 11 `ErrorCode` values, `already-initialized`, `unreadable-config`, `preparation`, `apply`, and `canceled`. For example, `initCommand` returns `{ text: ALREADY_INSTALLED, exitCode: EXIT_ERROR }` on stdout, and savePolicy returns `{ error: 'preparation' }` and `{ error: 'apply' }`.
- Fix: Throw a `GspotError` for "already initialized" (the `ALREADY_INSTALLED` text moves into `initCommand`) and for the preparation failure of `saveSettings` (CMD-021 deletes that wrapper). Delete the "missing tool file" result instead of converting it: it cannot happen (CMD-091). Keep the `saveSettings` message for "apply stopped after gspot.toml was written", thrown as `GspotError('apply', ...)`. Keep the install result. Then every failure prints through `printFailure` as `{ error, message }`. The canceled result of `check` keeps its `exitCode` (CMD-063).
- Size: medium

### CMD-007: Settings of three configurations are hard-coded in the generic session code and in init

- Where: `packages/cli/src/commands/public.ts:67-94`, `packages/cli/src/commands/init/contracts.ts:137-163`, `packages/cli/src/commands/init/contracts.ts:333-338`, `packages/cli/src/policy/defaults.ts:57`
- Kind: move
- Problem: `openSession` runs for every command, yet it names `swift.xcode_project`, `openapi.document`, and `site.build_command` and computes a default for each. Init names the `swift` configuration and reads `project.pbxproj` to pick `swift.xcode_destination`, and it hard-codes the commit scopes `root`, `hooks`, `deps` for the `commits` configuration. Each new configuration with a computed default must edit this shared code, and a reader of the session code meets Xcode and OpenAPI details there.
- Fix: `gspot init` writes the detected `xcode.project`, `xcode.destination`, and `openapi.document` (TML-010, TML-017), so the session stops detecting them when a command runs. Move what is left into one function, `detectedDefaults`, beside `knownSettings` in `src/settings/`: the `site.build_command` default (the npm client the repository uses, then `run build`), the Xcode destination choice, and the commit scopes, so init and the session share one rule. Its values go to `config/settings/defaults.ts`: `XCODE_DESTINATIONS`, `COMMIT_SCOPES = ['root', 'hooks', 'deps']`, and `BUILD_SCRIPT = ['run', 'build']`. POL-054 covers the same special case in `policy/defaults.ts:57`.
- Size: medium

### CMD-008: Export has three guards for the path the user typed

- Where: `packages/cli/src/commands/contracts.ts:190-198`, `packages/cli/src/commands/contracts.ts:203-209`, `tests/cli/commands/export.test.ts:56-75`
- Kind: delete
- Problem: `gspot export gspot.template.toml` writes one file that the user names. The code refuses a Windows drive-relative path such as `C:foo` on every system (on macOS and Linux that is a normal file name), and it refuses a parent folder that is a symbolic link, with a raw Node ENOENT message when the folder does not exist. It also opens the ownership log for writing only to read its file list. The user asked for this path, and following a link is what `cp` and every editor do.
- Fix: Delete the drive-relative check and the linked-parent check, with their two test rows. Keep the third row, a destination that is itself a link, which the safe folder refuses. A missing folder would then fail with the same raw Node message in `realPath` (today `canonicalPath`), so add one plain refusal: "The folder <dir> does not exist." Read the file list with `readOwnershipLog(root).files` (today `getOwnership`), which takes no lock. Keep the refusal to overwrite gspot.toml or a file gspot writes, with the text of CMD-029. Keep the troubleshooting sentence at `docs/src/content/docs/guides/troubleshooting.md:61`: it describes the path rules of gspot.toml, which still refuse a drive prefix. The error kind of these refusals is POL-062's.
- Size: small

### CMD-010: `--quiet` and `--verbose` are program options, but only `check` reads them

- Where: `packages/cli/src/public.ts:61-62`, `packages/cli/src/public.ts:75-82`, `packages/cli/src/public.ts:113-118`, `packages/cli/src/commands/check/command.ts:131-132`, `packages/cli/src/types/commands/program.ts:5`, `packages/cli/src/types/terminal.ts:5`
- Kind: move
- Problem: Every command shows `--quiet` and `--verbose` in its help, but they change nothing for apply, install, add, remove, set, ignore, list, explain, doctor, or export. Only `check` reads them, and `--quiet` also hides one `[info]` line after init. The verbosity is computed twice: in the `preAction` hook and again in `runCheck`.
- Fix: Delete `--quiet` (CMD-092). Make `--verbose` an option of `check` only, read in `runCheck`. Delete `VerbosityFlags` (it goes with `GlobalFlags`, CLX-005) and `selectVerbosity`. Put init's one line into init's result text (S03-001).
- Size: small

### CMD-011: Warnings and progress vanish under `--json`, although they go to stderr

- Where: `packages/cli/src/terminal/public.ts:50-62`, `packages/cli/src/commands/check/command.ts:148`
- Kind: simplify
- Problem: `--json` writes the result to stdout. Warnings and progress go to stderr, so they cannot break the JSON, yet the code drops them under `--json`: `warn` starts with `if (options.json) return;`, and `runCheck` gives no progress callback under `--json`. "Configured hooks are not ready" and "fixers changed 3 files" are then lost.
- Fix: Remove the `options.json` test from `warn`, and give `progress(...)` always. `note()` is deleted (S03-001). Tests that require an empty stderr under `--json` for a normal run change with it (for example `tests/cli/commands/check/verbosity.test.ts:47`).
- Size: small

### CMD-012: `PolicyFile.path` is written five times and never read

- Where: `packages/cli/src/types/policy/settings.ts:31`, `packages/cli/src/commands/public.ts:273`, `packages/cli/src/commands/contracts.ts:135`, `packages/cli/src/commands/init/public.ts:261`, `packages/cli/src/commands/init/contracts.ts:214`, `packages/cli/src/policy/public.ts:264-267`
- Kind: delete
- Problem: Each call builds `{ policy, text, path, errors: [] }`, and nothing reads `path`. The callers do not even agree on it: apply and savePolicy set an absolute path, init sets `'gspot.toml'`.
- Fix: Delete `path` from `PolicyFile` (target `SettingsFile`), from the five places that set it, and from the four test literals that set it (`tests/cli/commands/init/policy-text.test.ts:161,194,228,265`); the fifth, in `tests/cli/lifecycle/reconcile.test.ts:23`, goes with that test, which is deleted. Do not add a helper that parses the text again: apply and `saveSettings` already hold the parsed settings from `editSettings`.
- Size: small

### CMD-014: A dead branch and an optional field in the push check

- Where: `packages/cli/src/commands/check/push.ts:90`, `packages/cli/src/types/commands/check.ts:8`, `packages/cli/src/commands/check/tree.ts:83`
- Kind: delete
- Problem: `checkPush` returns early "if the result has no report", but `checkTree` always sets `report`: its only return is `{ text, json: outcome.report, report: outcome.report, exitCode }`. The optional `report` field also copies `json`.
- Fix: Delete line 90. Replace `CheckCommandResult` with `CommandResult<RunReport>` and read `result.json` in `push.ts`.
- Size: small

### CMD-015: `install --refresh-lockfiles` does what deleting the lockfiles does

- Where: `packages/cli/src/commands/contracts.ts:69`, `packages/cli/src/types/commands/install.ts:1`, `tests/tools/npm/installation.test.ts:66-110`, `tests/cli/commands/program.test.ts:57-60`, `tests/config/cli/commands/program.ts:4-7`, `docs/src/content/docs/guides/install.md:73`, `docs/src/content/docs/guides/troubleshooting.md:35`; the code it reaches in `packages/cli/src/lifecycle/install/public.ts`, `packages/cli/src/tools/contracts.ts:223-258`, `packages/cli/src/types/tools/install.ts:50` (`LockfilePreparation`), `packages/cli/src/types/lifecycle/install.ts:20,29`
- Kind: delete
- Problem: The flag makes new lockfiles even when the current ones match the pins (for example after a registry republished a package at the same version). Install already makes a new lockfile when one is missing or out of date, so deleting the lockfiles and running `gspot install` does the same. Two guides document the flag, and only tests and this repository's CI (`scripts/plugin.ts install --refresh-lockfiles`, from `.github/workflows/ci.yml:40`) run it. A test checks that the old name `--refresh-locks` is refused, which polices a leftover name. Init always gives `{ refreshLockfiles: false }`.
- Fix: Delete the flag, the two tests, and both docs sentences. Troubleshooting says "To make new lockfiles, delete them and run gspot install." (DOC-061). init never installs (CMD-092), so the `refreshLockfiles` parameter is always false: delete it everywhere, with `LockfilePreparation` and the `!refreshLockfiles &&` and `refreshLockfiles ? undefined :` branches in `tools/contracts.ts`. `InstallOptions` goes (S03-008). The "retired refresh flag" test row goes with TCM-014. Do after GEN-002, which deletes the CI step that runs the flag.
- Size: medium

### CMD-016: Init's "delete the replaced files" step has two dead branches and a dead result field

- Where: `packages/cli/src/commands/init/contracts.ts:50-76`, `packages/cli/src/commands/init/contracts.ts:238`, `packages/cli/src/types/commands/init.ts:80`
- Kind: delete
- Problem: `retireReplaced` keeps a path that ends in `/` as "a folder", throws "No original file was recorded" when a read copy is missing, and fills `result.removed`. None of these can matter: tool files come from the tracked file list (never a folder, and no manifest `replace` file ends in `/`), every removed entry was read first, and nobody reads `removed`.
- Fix: Rename `retireReplaced` to `deleteReplacedFiles` in `commands/init/write.ts` (CMD-077) and make it return `string[]` (the kept paths). Delete the folder branch, the throw, `RetirementResult`, and the words "it is a folder, or" in the note on line 238.
- Size: small

### CMD-017: Explain has a fallback for a scope that always exists

- Where: `packages/cli/src/commands/explain/public.ts:199-200`
- Kind: delete
- Problem: `?? session.scopes[0]` and `selection ? … : []` guard against a missing scope. `scopeOf` always returns one of `repository.scopes` (the root scope comes first), and `session.scopes` has one entry for each of them.
- Fix: `const selection = session.scopes.find(...)!` is banned by lint, so use `session.scopes.find(...) as ScopeSelection` once, or build a `Map` by path. Delete the `?? session.scopes[0]` and the ternary.
- Size: small

### CMD-020: `set --scope` error lists "root" as a scope, but `--scope root` is refused

- Where: `packages/cli/src/commands/set.ts:162-165`, `packages/cli/src/policy/document/contracts.ts:246-255`
- Kind: fix-bug
- Problem: The message says "Available scopes: root, apps/web", but `--scope root` gives the same error again, because the test is `Object.hasOwn(policy.scope, options.scope)`. The same mistake in add and remove gets a different message, from `getScopeTable`.
- Fix: Replace the pre-check in `setCommand` with one early call of `findScopeTable` (today `getScopeTable`), and make `unsetCommand` do the same, so set and unset give the message add and remove give. Scopes are `[[scope]]` records with a `path` field (TMF), so the message is: `gspot.toml has no [[scope]] with path = "<path>". Add one, or leave out --scope.` It lists no scopes. Do not just delete the pre-check: the setting lookup runs first, so a wrong scope plus an unknown setting would then report the unknown setting instead of the wrong scope.
- Size: small

### CMD-021: savePolicy wraps file generation in a try/catch that only renames the error

- Where: `packages/cli/src/commands/contracts.ts:138-148`, `packages/cli/src/commands/contracts.ts:33-36`
- Kind: delete
- Problem: If `emitAll` throws before anything is written, the wrapper turns the error into a result with `error: 'preparation'` and exit code 2. Without it, `main` prints the same message and exits 2. The helper `errorText` exists only for these wrappers and copies a line of `public.ts:40`.
- Fix: In `saveSettings` (today `savePolicy`), delete the first try/catch. Keep the second one, because gspot.toml is written by then and the message "run gspot apply" helps, but throw it as a `GspotError` (CMD-006). Delete `errorText`.
- Size: small

### CMD-022: Apply reads gspot.toml twice, then guards against the race it created

- Where: `packages/cli/src/commands/public.ts:264-269`
- Kind: simplify
- Problem: `applyCommand` opens a session (which reads gspot.toml), then calls `preparePolicy` (which reads it again), then compares the bytes and fails with "The gspot.toml file changed while gspot was running." Reading once removes the race and the message.
- Fix: Call `readSettingsEdit(root)` (today `preparePolicy`) first, build the first session from what it read, and delete lines 268-269. The later write still compares against the bytes it read (`writeSettings` gets `original`), so no other guard is lost, for the dry run too.
- Size: small

### CMD-023: The pre-push argument count check forces a fake argument elsewhere

- Where: `packages/cli/src/commands/check/command.ts:41-42`, `packages/cli/src/config/commands/check.ts:3-4`, `packages/cli/src/execution/public.ts:329`
- Kind: delete
- Problem: The check refuses 1 or 3+ arguments after `--hook pre-push`. Git always gives 2, and only `paths[0]` (the remote) is ever read. The line that shows how to rerun a failed push check then has to add an empty `''` URL just to get past the check.
- Fix: Delete the check and `PUSH_ARGUMENTS`. Drop the `''` from `reproduceLine` (target `execution/report.ts`).
- Size: small

### CMD-024: Check reads the whole commit message file only to throw it away

- Where: `packages/cli/src/commands/check/command.ts:78-88`
- Kind: simplify
- Problem: `readFileSync(commitFile, 'utf8')` runs only to fail early, and the content is dropped. commitlint reads the file later.
- Fix: Use `accessSync(commitFile, constants.R_OK)` in place of `readFileSync`. Keep the early check: gspot's CLI rule asks to validate every argument before doing any work.
- Size: small

### CMD-027: Eight command descriptions repeat their flag help

- Where: `packages/cli/src/commands/public.ts:242`, `packages/cli/src/commands/contracts.ts:65,247`, `packages/cli/src/commands/add.ts:68`, `packages/cli/src/commands/remove.ts:80`, `packages/cli/src/commands/set.ts:195`, `packages/cli/src/commands/ignore.ts:131`, `packages/cli/src/commands/init/public.ts:177`, `packages/cli/src/commands/check/command.ts:174`
- Kind: rewrite-text
- Problem: "--dry-run prints the change and writes nothing" appears in five descriptions and again in the option list right below. Check's description repeats `--json`, `--staged`, `--changed`, and `--fix`; install's repeats `--refresh-lockfiles` and `--dry-run`; set's repeats `--replace`, `--remove`, and `--default`. The help gets long, and two copies must stay in step.
- Fix: Remove every sentence that only describes a flag from the descriptions. The descriptions of the "Target help" section below repeat no flag help.
- Size: small

### CMD-029: Error and status messages that use jargon or say the wrong thing

- Where: `add.ts:37`, `remove.ts:31`, `contracts.ts:192,197,209,96,106`, `ignore.ts:114`, `check/push.ts:68,103`, `check/command.ts:42`, `explain/public.ts:94,316`, `explain/contracts.ts:64,111,113`, `config/commands/explain.ts:8`, `config/commands/doctor.ts:32`, `init/public.ts:65,70,210`, `init/contracts.ts:100,267,297`, `init/plan.ts:80,83,63`, `init/takeover.ts:13`, `terminal/contracts.ts:117` (all under `packages/cli/src/commands/` or `packages/cli/src/`)
- Kind: rewrite-text
- Problem: Users read these when something goes wrong. Many use internal words ("follows repository inputs", "check exception", "drive-relative", "linked parent directory", "managed", "object checks", "References", "native", "authored", "fatal tool diagnostic pattern", "isolated directory", "stale setup", "proposed", "retained", "merge base"). Init calls one state "unreadable" in two places and "missing" in two others. "Cancelled" (init) and "canceled" (check) disagree.
- Fix: Replace as follows.
    - add and remove: "The `<name>` configuration follows repository inputs… record a check exception…" becomes "gspot selects <name> by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To turn one check off, run gspot ignore."
    - export: "Template export cannot replace managed X" becomes "gspot writes X itself. Choose another file name." The other two export refusals go (CMD-008).
    - install: "No managed tools or hooks to install." and "No managed tools to install." become "Nothing to install."
    - ignore: "Ignore saved." becomes "Saved the ignore for <check>." "Ignore proposed." goes with the ignore dry run (CLX-004).
    - push: "Pre-push object checks cannot be combined with …" becomes "The pre-push hook checks the pushed commits. Leave out --staged, --changed, --fix, --dry-run, and --message-file." "References not checked" becomes "Branches and tags not checked".
    - explain: "X is not a file git tracks or would track here." becomes "X is not a file in this repository." "When authored, this value requires an entry in [reasons]." becomes "If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason." "Required native version: n >= v" becomes "Needs n v or newer". "Fatal tool diagnostic pattern:" becomes "Output that means the tool crashed:". "Runs with selected files and declared configuration in an isolated directory." becomes "Runs in a scratch copy of the files it checks." The `rule-options` text goes: the options of a lint rule never need a reason, and explain prints the lines of CLX-014 for a lint rule.
    - doctor: "The saved setup is stale: {details}. Run: gspot apply" becomes "gspot apply would change gspot.toml: {details}. Run gspot apply." The details always say "added configuration X in <scope>", because apply only adds configurations, so a text that says gspot.toml lists configurations that no longer match would be wrong.
    - init: the "A tool file is unreadable" refusal and its `unreadable-config` JSON go, because that branch cannot run (CMD-091). "JSON initialization requires --yes…" becomes "--json needs --yes or --dry-run, because gspot cannot ask while it prints JSON." "Cancelled; nothing written." becomes "Canceled. Nothing was written."
    - init plan notes: "existing lint job retained; no duplicate CI job proposed" becomes "existing lint job kept. gspot adds no second CI job." "a manifest whose dependencies…" becomes "a package.json whose dependencies…". The note "CI retained; add the setup commands listed below" goes with the CI setup block of the plan (INX-005).
    - check: "Working tree compared with the merge base of X." becomes "Checked the files changed since X."
- Size: small

### CMD-030: `gspot` with no command prints help and exits 0

- Where: `packages/cli/src/public.ts:39`, `packages/cli/src/config/commands/program.ts:1`
- Kind: fix-bug
- Problem: `HELP_CODES` treats `commander.help` as success. Commander throws that code with exit code 1 when no command is given (`commander@15.0.0/lib/command.js:1594` calls `this.help({ error: true })`). So `gspot` alone prints help to stderr and exits 0, and under `--json` it prints nothing and exits 0.
- Fix: Replace the set with `if (error instanceof CommanderError && error.exitCode === 0) return 0;` and delete `config/commands/program.ts`. With no `help` command (CLX-008), only `--help` and `--version` exit 0, and `gspot` alone exits 2 like any other usage error. Under `--json`, which the catch of `main` reads from `argv` (CLX-005), Commander's message would be the placeholder "(outputHelp)", so map that case to `{ "error": "arguments", "message": "Name a command. Run gspot --help to see them." }`.
- Size: small

### CMD-032: The setup lines of the commands that edit gspot.toml are copied

- Where: `packages/cli/src/commands/add.ts:25-27,34-38`, `packages/cli/src/commands/remove.ts:24-26,28-32`, `packages/cli/src/commands/set.ts:158-161`, `packages/cli/src/commands/ignore.ts:94-97`
- Kind: merge
- Problem: Each command starts with `findRoot(cwd)`, `preparePolicy(root)`, and `assertVersionPin(root, input.table['runner'])`, and set and ignore add `readPolicyTable`. add and remove also carry the same 3-line refusal for always-selected configurations, word for word.
- Fix: Add `startSettingsEdit(cwd): { root, input, settings }` in `commands/save-settings.ts`. It calls `findRoot`, `readSettingsEdit` (today `preparePolicy`), `assertVersionPin(root)` (no runner argument, INX-003), and `parseSettings`. Call it from add, remove, set, unset, ignore, and unignore. Move the refusal into one function, `refuseAlwaysSelected(names, manifests)`, in the same file; add and remove stay separate commands.
- Size: small

### CMD-037: Init finds CI files twice

- Where: `packages/cli/src/commands/init/contracts.ts:104-124`
- Kind: simplify
- Problem: `detectCi` first reads `tooling.ci` (the CI files already found among the tracked files), then opens the folder and looks for `.gitlab-ci.yml` and `.github/workflows` again, which only adds untracked CI files. It mixes `files.stat` with `readText(root, …)` for the same root.
- Fix: `proposeCi` (today `planCi`, with `detectCi` inlined, in `commands/init/settings-text.ts`) uses `tooling.ci` only; delete the second lookup and the `using files`. It proposes the provider without a question, and `none` when a lint job exists (CLX-001). It tests the origin host against the keys of `CI_FILE_LABELS` (S03-007). The file names go to `config/repository/tooling.ts` as `GITLAB_CI_FILE = '.gitlab-ci.yml'` and `GITHUB_WORKFLOWS_FOLDER = '.github/workflows/'`.
- Size: small

### CMD-039: The undocumented magic word `none` for `--configurations`

- Where: `packages/cli/src/commands/init/public.ts:47`, `packages/cli/src/config/lifecycle/selection.ts:1`, `packages/cli/src/lifecycle/selection/public.ts:49,96,161`
- Kind: simplify
- Problem: `--configurations none` means "no configurations", and the help does not say so. The template path turns an empty list into `['none']`, and three places filter `none` out again. An empty list would work in all three places.
- Fix: `planInit` uses the template's configurations as they are. Turn `['none']` into `[]` once, at the start of `initCommand` (not in the Commander action: several tests call `initCommand` directly with `configurations: ['none']`, for example `tests/cli/commands/init/ci.test.ts:92` and `refusals.test.ts:188`), and delete the three filters (in `commands/init/selection.ts` after the move). The word `none` stays on the command line, because a list option cannot take zero values; the help says "Write none for no configurations" (Target help). `NO_CONFIGURATIONS` moves to `config/commands/init.ts`.
- Size: small

### CMD-040: The init option type lives in another folder than the other init types

- Where: `packages/cli/src/types/lifecycle/selection.ts:13-26`, `packages/cli/src/types/commands/init.ts`
- Kind: move
- Problem: `InitOptions` holds the init flags (`yes`, `isDryRun`, `install`, `from`, `cwd`), but it lives in `types/lifecycle/selection.ts`. Selection uses only three of its fields, through `Pick<InitOptions, 'configurations' | 'scopes' | 'template'>` twice.
- Fix: Move `InitOptions` and `CiChoice` to `types/commands/init.ts`; `RunnerChoice` is deleted with the `runner` setting (INX-003). `InitOptions` loses `hooks`, `ci`, `agentRules`, `runner`, `install`, and `scopes` with their flags (CLX-001, CMD-092). Give selection its own `SelectionChoices = { configurations?: string[]; template?: Template }`; it has no scopes map, because `--scope-configurations` goes (S05-005). The test setup (`tests/harness/init.ts`, `tests/types/harness/init.ts`) imports these types and follows the move.
- Size: small

### CMD-041: Init opens a session and builds every file twice from the same text

- Where: `packages/cli/src/commands/init/public.ts:259-266`, `packages/cli/src/commands/init/contracts.ts:210-217`
- Kind: simplify
- Problem: `prepare` parses the new gspot.toml text, opens a session, and calls `emitAll`. After the user says yes, `writeSetup` parses the same text, opens a new session, and calls `emitAll` again.
- Fix: Put `session` and `generated` into `InitPrepared` and reuse them in `writeInitFiles` (today `writeSetup`). The second build differs only when a file changes while init waits for "Continue?".
- Size: small

### CMD-042: Two functions build the same selection object

- Where: `packages/cli/src/commands/init/public.ts:300-304`, `packages/cli/src/commands/init/contracts.ts:132-136`
- Kind: merge
- Problem: `readFormatTables` and `headTables` both build the same configuration selection (`configurations`, an empty `removed_configurations`, and the scopes) from a `PolicyDraft`, in the same text.
- Fix: Add `draftSelection(draft: SettingsDraft): ConfigurationSelection` in `commands/init/settings-text.ts` and call it from `headTables` and from `readFormatTables` (`commands/init/format.ts`).
- Size: small

### CMD-043: Init builds the file header by cutting a string at a computed length

- Where: `packages/cli/src/commands/init/contracts.ts:319-324`, `packages/cli/src/config/commands/init.ts:49-54`
- Kind: simplify
- Problem: To add the "Copied from template" line, the code slices `PREFACE` at `SCHEMA_LINE.length + 1`. A change to either constant breaks it silently.
- Fix: Store the body without the schema line as `PREFACE_BODY` in `config/commands/init.ts`: "# gspot settings for this repository. Change them with gspot set, unset, ignore, add, and remove." (TML-017). `SCHEMA_LINE` goes: the gspot.toml writer builds the `#:schema` line from `SCHEMA_URL_PREFIX`, the running version, and `SCHEMA_FILE` (CFR-001). The copied line names the template file given to `--from` (TML-011). Join the schema line, the copied line (only with `--from`), and `PREFACE_BODY` with newlines.
- Size: small

### CMD-044: `applyIntegrations` deletes keys and then writes them again

- Where: `packages/cli/src/commands/init/contracts.ts:187-196`
- Kind: simplify
- Problem: A loop deletes `hooks` and `ci` when they are off, and the next lines set them when they are on. One `if/else` per key says the same.
- Fix: Inline `applyIntegrations` into `initSettingsText` with one `if/else` per key: `[hooks] enabled = true` when hooks are on; `[ci] enabled = true` when CI is on, with `provider` only when it is not `github`; and `[rules] enabled = false` only when rules are off (TML-015, TML-017). No `runner` key (INX-003).
- Size: small

### CMD-045: In `templateAnswers` a variable named `install` holds the rules switch

- Where: `packages/cli/src/commands/init/public.ts:45,51`
- Kind: rename
- Problem: `const install = tables.agent_rules?.enabled` reads as "install the tools", but it holds the rules switch and feeds `agentRules: install`.
- Fix: `templateAnswers` is inlined into `planInit` (CLX-001). There, write `rules: tables.rules?.enabled` directly; the table is `[rules]` (TML-003).
- Size: small

### CMD-046: Init has five types for its in-between states

- Where: `packages/cli/src/types/commands/init.ts:17-76`
- Kind: simplify
- Problem: `Planning`, `InitPrepared`, `InitPlan`, `PolicyDraft`, and `InitAnswers` move mostly the same fields between four functions. `draftPolicy` copies the fields of `InitAnswers` one by one into `PolicyDraft`. `Planning` is a vague name.
- Fix: `type SettingsDraft = InitAnswers & { template?; configurations; scopes; commitScopes? }` (today `PolicyDraft`), and `{ ...answers, … }` in `draftSettings` (today `draftPolicy`). The answers are `hooks`, `ci`, and `rules`. Rename `Planning` to `InitPlanInputs`.
- Size: small

### CMD-047: Doctor suggests removing configurations the user added on purpose

- Where: `packages/cli/src/commands/doctor/contracts.ts:29-55`, `packages/cli/src/config/commands/doctor.ts:13`
- Kind: rewrite-text
- Problem: `gspot add X` exists to select a configuration that detection misses. Doctor then lists X under "selected, not detected" with `gspot remove X`, as if the choice were a mistake. The same section is also the only report of a real problem: a configuration init saved whose files are now gone. `gspot apply` never removes a saved configuration (`mergeConfigurationChoices` keeps every saved name), and gspot.toml does not record which names came from detection and which from `gspot add`, so doctor cannot tell the two cases apart. The section does not change the exit code.
- Fix: Keep the section and change only its words, so it does not push removal: title "selected, but no matching files found", command "gspot remove X (if you no longer need it)".
- Size: small

### CMD-049: `CheckOptions.changed` holds a Git ref, while `PlanOptions.changed` holds paths

- Where: `packages/cli/src/types/commands/check.ts:49`, `packages/cli/src/commands/check/command.ts:146`, `packages/cli/src/types/planning.ts:39`
- Kind: rename
- Problem: One name, two meanings one call apart: `changed: flags.changed === true ? flags.base : undefined`. The flag is `--base`, the option is `changed`, and `getChanged` calls it `reference`.
- Fix: Rename `CheckOptions.changed` to `base` (a string, `''` for the upstream or default branch).
- Size: small

### CMD-050: "Selection" names the narrowing of one run, against the glossary

- Where: `packages/cli/src/types/commands/check.ts:19-26` (`StagedSelection`, `Selections`), `packages/cli/src/commands/check/tree.ts:87` (`selectionsFor`), `packages/cli/src/commands/check/arguments.ts:26` (`selectedPaths`), `packages/cli/src/public.ts:46` (`'arguments'`), 14 `GspotError('selection', …)` in this part
- Kind: rename
- Problem: The glossary uses "select" and "selection" for choosing the configurations of a scope. Here "selection" names the paths, staged files, and stage of one run, and the JSON error code of bad arguments. Commander's bad arguments use the code `arguments` and gspot's own use `selection`: two names for one thing. Not every `selection` error is an argument error: `init/public.ts:95` ("Git status failed") and many calls in `execution/copy/`, `repository/revisions/`, and `platform/git/` report Git failures.
- Fix: Rename `Selections` to `RunFilters`, `selectionsFor` to `runFilters`, `selectedPaths` to `pathArguments`, and `StagedSelection` to `StagedFiles`. NMU-032 sets the error codes of all 54 calls (`arguments` for argument errors, and codes that say what failed for the rest). Do after NMU-032.
- Size: small

### CMD-052: The hook names of `check --hook` are written by hand

- Where: `packages/cli/src/terminal/contracts.ts:132`, `packages/cli/src/types/commands/check.ts:36`, `packages/cli/src/types/generation/hooks.ts:3`, `packages/cli/src/commands/check/command.ts:188-191`
- Kind: merge
- Problem: `'pre-commit' | 'pre-push' | 'commit-msg'` is written by hand in `runText` and in `CheckFlags`, beside `HookName`, and the `--hook` choices come from `Object.keys(HOOK_ARGS)`.
- Fix: `--hook` takes only `pre-commit` and `pre-push` (CLX-006). Write those two once, as `CHECK_HOOKS = ['pre-commit', 'pre-push'] as const` in `config/generation/hooks.ts` beside `HOOK_ARGS`. The `--hook` choices read it, and `CheckOptions` and `runText` type the hook as `(typeof CHECK_HOOKS)[number]`. `HookName` keeps the three hooks of the generated scripts. `CheckFlags` goes (CMD-053).
- Size: small

### CMD-053: `check` is built differently from the other commands, with a hand-written flag type

- Where: `packages/cli/src/commands/check/command.ts:167-170`, `packages/cli/src/types/commands/check.ts:28-39`
- Kind: simplify
- Problem: Only `check` uses `new Command<[], CheckFlags, GlobalFlags>('check').copyInheritedSettings(program)` and `addCommand`; the other eleven commands use `program.command(...)`, which does the same. `CheckFlags` repeats the option list by hand and must follow every change.
- Fix: Use `program.command('check')` and let the typings infer the flags. Type `runCheck(paths, flags: ReturnType<typeof command.opts>, command)`, or inline it. Delete `CheckFlags`.
- Size: small

### CMD-055: `check/arguments.ts` holds two helpers that only `tree.ts` calls

- Where: `packages/cli/src/commands/check/arguments.ts`
- Kind: merge
- Problem: A 47-line file with two one-caller functions: `selectedPaths` and `refuseUnknownChecks` are imported only by `check/tree.ts`.
- Fix: Move both into `check/tree.ts` (208 lines after the move), `selectedPaths` as `pathArguments` (CMD-050), and delete the file.
- Size: small

### CMD-056: The doctor, explain, and init folders use `public.ts` and `contracts.ts` instead of names

- Where: `packages/cli/src/commands/doctor/{public,contracts}.ts`, `packages/cli/src/commands/explain/{public,contracts}.ts`, `packages/cli/src/commands/init/{public,contracts}.ts`
- Kind: rename
- Problem: Before commit `9a3851a9a` these were `doctor/command.ts` and `doctor/suggestions.ts`; `explain/command.ts`, `explain/check.ts`, and `explain/path.ts`; and `init/command.ts`, `questions.ts`, `write.ts`, `prepare.ts`, and `policy-text.ts`. The names `public.ts` and `contracts.ts` say nothing.
- Fix: `doctor/command.ts` and `doctor/suggestions.ts`; `explain/command.ts` and `explain/check.ts`; `init/command.ts` (`initCommand`, `planInit`, `askConfirmation`, `registerInit`), `init/write.ts` (`writeInitFiles`, `deleteReplacedFiles`), `init/settings-text.ts` (`initSettingsText`, `draftSettings`, `headTables`, `proposeCi`), `init/format.ts` (`readFormatTables`), and `init/replace.ts` (CMD-077). No `init/questions.ts`: init asks only "Continue?" (CLX-001). Add no new code.
- Size: small

### CMD-058: The terminal folder uses `public.ts` and `contracts.ts`, and progress takes a stream only tests change

- Where: `packages/cli/src/terminal/public.ts`, `packages/cli/src/terminal/contracts.ts:162-168`, `packages/cli/src/types/terminal.ts:16`
- Kind: rename
- Problem: `terminal/contracts.ts` prints the check report and `terminal/public.ts` holds the printing functions, but neither name says so (commit `9a3851a9a` gave them these names in place of `terminal/reporter.ts` and `terminal/messages.ts`). `progress(stream, …)` takes a stream parameter only so tests can give a fake; its one production caller always gives `process.stderr`. `help.test.ts:64-71` shows tests can fake `isTTY` directly.
- Fix: Rename `terminal/public.ts` to `terminal/print.ts` and `terminal/contracts.ts` to `terminal/check-report.ts`. Make `progress(verbosity)` write to `process.stderr`, and delete `ProgressStream`. The three test calls in `tests/cli/terminal.test.ts:122-152` fake `process.stderr` instead.
- Size: small

### CMD-060: `ScopeSelections` and the session lookup are hard to follow

- Where: `packages/cli/src/commands/public.ts:151-207`, `packages/cli/src/types/commands/session.ts`
- Kind: simplify
- Problem: `openSession` uses `installer` inside a closure before the line that declares it (line 189 against line 204). It pushes a fake `gspot.toml` entry into the file list "so init can plan". The type `ScopeSelections` exists for one return value.
- Fix: Declare `let npmClient: NpmClientIdentity | undefined;` above the session object and assign it after (`selectNpmClient` gives the value), so the closure does not read a name declared below it; `applicableManifests` needs the finished session, so the value itself cannot move up. Return a plain tuple from `scopeSelections` and delete `ScopeSelections`. Keep the default parameter (`settingsFile = readSettings(root)`): removing it would add `readSettings(root)` at each caller that uses it (list, explain, doctor), which is more code, not less.
- Size: small

### CMD-061: The `--base` default lives in a config file

- Where: `packages/cli/src/config/commands/check.ts:1`, `packages/cli/src/commands/check/command.ts:182,192`
- Kind: simplify
- Problem: `CHECK_FLAG_DEFAULTS = { base: '', skip: [] }` exists only to give Commander defaults, and an array default shows as "(default: [])" in help.
- Fix: `--skip` goes with its default (CMD-092). Write `''` in place for `--base` and delete `CHECK_FLAG_DEFAULTS`. With `PUSH_ARGUMENTS` gone (CMD-023), `config/commands/check.ts` is empty and goes.
- Size: small

### CMD-063: Ctrl-C exits with code 2, not the signal's code

- Where: `packages/cli/src/commands/check/command.ts:106-160`, `packages/cli/src/commands/check/push.ts:42-45`, `packages/cli/src/execution/report.ts:16-19,48`, `.gspot/rules/general/engineering/code/CLI.md` ("exit with the signal's status")
- Kind: fix-bug
- Problem: gspot's CLI rule says a stopped program exits with the signal's status (130 for Ctrl-C). `check` returns 2, the code for bad input, and its JSON says 2 too. Three places turn a stop into 2: `exitCode: EXIT_ERROR` in the canceled result of `runCancelable`; `signal.aborted ? EXIT_ERROR : 0` in `buildPushReport`; and `isIncomplete` in `execution/report.ts`, which marks an aborted run `EXIT_ERROR` when the run returns instead of throwing.
- Fix: Change only `runCheck`, which owns the signal handlers (`runCancelable` is inlined into it): record which signal fired, and after the run returns, print the result with exit code 130 for SIGINT or 143 for SIGTERM, and write the same code into the printed JSON `exitCode`. That one place covers all three paths; leave `report.ts` and `push.ts` as they are. The codes are `SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 }` in `config/terminal.ts`, beside `EXIT_ERROR`. The exit-codes docs page lists 130 and 143. A failed fixer still exits 2.
- Size: small

### CMD-065: Ignore changes the list outside the change function

- Where: `packages/cli/src/commands/ignore.ts:99-118`
- Kind: simplify
- Problem: `mergeIgnore(list, …)` changes `input.table.ignore` in place before savePolicy runs. The change function then only sets `raw['ignore'] = list`, which is usually the same array, because `editPolicy` calls `mutate(table)` on that same `input.table`. Two opposite `if` blocks follow each other.
- Fix: `gspot unignore` takes over the remove branch (CLX-011), so `ignoreCommand` has no `options.remove` test. Do the reason check first, then call `mergeIgnore` inside the change function and keep its result for the printed text. The ignore record is built in place with `compact` (S03-002).
- Size: small

### CMD-068: List filters settings by reading its own display text

- Where: `packages/cli/src/commands/list.ts:22-24`, `packages/cli/src/commands/list.ts:102`, `packages/cli/src/policy/settings/contracts.ts:81,234`
- Kind: simplify
- Problem: To drop inherited rows, list tests `source.startsWith('configuration')` and `source.startsWith('[scope."x"]')`. `source` is a sentence built for people. The filter works today, but a change to that wording breaks it silently.
- Fix: Add `origin: 'root' | 'scope' | 'configuration' | 'unset'` and `originScope?: string` to `SettingEntry` (target `types/settings/values.ts`) and filter on those.
- Size: small

### CMD-070: Explain's JSON uses names that differ from the glossary

- Where: `packages/cli/src/types/commands/explain.ts:6,38`, `packages/cli/src/commands/explain/public.ts:52`, `packages/cli/src/commands/explain/contracts.ts:171,200`
- Kind: rename
- Problem: The kind `tool-rule` and the function `explainToolRule` say "tool rule", which the glossary retires for "lint rule". The field `auto` means `always_selected` (`auto: manifest.configuration.always_selected`).
- Fix: Kind `lint-rule`, function `explainLintRule` (in `commands/explain/check.ts`), field `alwaysSelected`. Six test lines in `tests/cli/commands/explain/command.test.ts` assert `kind: 'tool-rule'` and change with it.
- Size: small

### CMD-071: Explain keeps the minimum versions in two forms

- Where: `packages/cli/src/types/commands/explain.ts:43-50`, `packages/cli/src/commands/explain/contracts.ts:62-65`
- Kind: simplify
- Problem: `CheckFacts` has `minVersions` and `versionRequirements`; the second is made from the first only to print it.
- Fix: Keep `minVersions` and build the lines in `describeCheck`.
- Size: small

### CMD-073: The doctor report keeps three artifacts for five titles and a one-field wrapper

- Where: `packages/cli/src/config/commands/doctor.ts:10-16`, `packages/cli/src/types/commands/doctor.ts:21` (`rules: { files }`), `:26-29`
- Kind: simplify
- Problem: `SUGGESTION_SECTIONS`, `SuggestionSection`, and `SuggestionKey` exist to map five keys to five titles. The result field `rules: { files }` is an object with one field, a level that says nothing.
- Fix: Keep the array: it fixes the print order. Write it `as const` with no type annotation (`config/` imports only `config/`), and let `suggestionLines` check each key when it indexes `suggestions[key]`. Delete `SuggestionKey` and `SuggestionSection`. The `duplicateMisePins` field leaves `Suggestions` (INX-007), so no `Omit` is needed. `rules: { files }` becomes `ruleFiles: number`; the JSON of `doctor --json` changes, and no docs page or test shows the field.
- Size: small

### CMD-074: The stale warning is a template with a placeholder that is filled once

- Where: `packages/cli/src/config/commands/doctor.ts:31-32`, `packages/cli/src/commands/doctor/public.ts:154`
- Kind: simplify
- Problem: `STALE_SETUP_WARNING` holds `{details}`, and its one caller calls `.replace('{details}', …)`.
- Fix: Write the text as a template string where `doctorCommand` prints it: `gspot apply would change gspot.toml: ${details}. Run gspot apply.` (CMD-029). Delete `STALE_SETUP_WARNING`.
- Size: small

### CMD-076: Dry-run messages differ from command to command

- Where: `packages/cli/src/commands/contracts.ts:48`, `packages/cli/src/commands/init/public.ts:60`, `packages/cli/src/commands/contracts.ts:222`, `packages/cli/src/commands/ignore.ts:114`
- Kind: rewrite-text
- Problem: Dry runs end in different ways: "(dry run: gspot.toml not written)", "--dry-run: nothing written.", "would write X", "Ignore proposed.", and nothing at all for apply.
- Fix: Only init, apply, and `check --fix` keep a dry run (CLX-004). End each of the three with the same line: "Dry run: nothing was written."
- Size: small

### CMD-077: Init names the replace action with retired words

- Where: `packages/cli/src/types/commands/init.ts:43-49` (`Replaced`), `packages/cli/src/commands/init/takeover.ts` (`planTakeover`), `packages/cli/src/commands/init/contracts.ts:50` (`retireReplaced`), `packages/cli/src/commands/init/detection.ts` (`ownershipRows`), `packages/cli/src/commands/init/plan.ts:198` ("delete")
- Kind: rename
- Problem: The glossary names this action "replace" and retires takeover, retire, and retirement. The code uses `takeover.ts`, `planTakeover`, `retireReplaced`, `RetirementResult`, `Replaced` as a type name, and `removed`, while the plan prints "delete".
- Fix: `takeover.ts` becomes `commands/init/replace.ts`; `planTakeover` becomes `planReplacedFiles`; `Replaced` becomes `ReplacedFiles`; `retireReplaced` becomes `deleteReplacedFiles` (CMD-016); `ownershipRows` becomes `replaceRows`; the field `removed` becomes `deleted`, and the JSON key `remove` becomes `delete`, the word the plan prints. `RetirementResult` goes (CMD-016).
- Size: small

### CMD-078: "Proposal" and "preview" are still used, against the glossary

- Where: `packages/cli/src/commands/init/contracts.ts:309` (`proposeText`), `packages/cli/src/commands/public.ts:267` (`proposal`), `packages/cli/src/commands/ignore.ts:114` ("Ignore proposed."), `packages/cli/src/commands/init/plan.ts:83` ("proposed"), `packages/cli/src/commands/contracts.ts:42,82,116,185,221` and `set.ts:1,153` ("preview", `let preview`)
- Kind: rename
- Problem: The glossary says a computed change is a plan and showing it is a dry run, and it retires "proposal" and "preview". These names and texts still use them.
- Fix: `proposeText` becomes `initSettingsText` in `commands/init/settings-text.ts` (not `policyText`, which already names a variable and a field of `InitPrepared`); `proposal` becomes `edit`; the doc comments say "dry run". "Ignore proposed.", export's `preview`, and the previews of the setting commands go with their dry runs (CLX-004); the plan note text is CMD-029's.
- Size: small

### CMD-079: Comments and doc comments full of internal words

- Where: `commands/public.ts:1,146,167,210-212,218-222`; `commands/contracts.ts:1-2,33,38-43,115-119`; `add.ts:1`; `remove.ts:1`; `set.ts:1,34`; `ignore.ts:104`; `list.ts:119-120`; `check/command.ts:74`; `explain/public.ts:160`; `init/takeover.ts:7`; `terminal/public.ts:96-100`; `terminal/contracts.ts:154-160`; `types/commands/save-policy.ts:4,7,10`; `types/commands/session.ts:4`; `types/commands/program.ts:10`; `types/commands/set.ts:13`; `types/commands/list.ts:23`; `types/terminal.ts:9`; `config/commands/init.ts:62`; `config/agent-rules.ts:10`; `config/configurations.ts:36,42,92`; `types/configurations.ts:36,61,63,72,83`; `types/planning.ts:63,67,88`; `types/agent-rules.ts:5,11` (all under `packages/cli/src/`)
- Kind: rewrite-text
- Problem: The comments use words a newcomer does not know: "transaction", "claimed policy edit", "canonical", "proposal", "native", "authored", "effective", "contract", "contractual exit code", "retains", "publish", "dispatch", "mutation copy", "native line prefix", "enforcement contract". For example: "One claimed policy edit validates the authored values, then applies prepared outputs without installing tools." (`contracts.ts:1`) and "Shared introduction and enforcement contract in each managed instruction index." (`config/agent-rules.ts:10`).
- Fix: Rewrite each in plain words with the glossary names, for example: "Edits gspot.toml, checks it, then writes the generated files. Installs nothing." / "Init has not written gspot.toml yet, so add it to the file list by hand." / "A set value: a list, or one value." / "Reads the files init will delete, before it writes anything." / "The heading of the managed block in each file that holds it, such as AGENTS.md." (`RULES_HEADING`, today `INSTRUCTION_HEADING`, opens the managed block, which can sit in other instruction files too, so "the first line of AGENTS.md" would be wrong.) Comments on code that other findings delete (`planPolicy`, `types/commands/program.ts`) go with that code. Delete a comment that only repeats the function name ("Registers add.").
- Size: small

### CMD-084: Two rules constants have names that do not say what they are

- Where: `packages/cli/src/config/agent-rules.ts:4-11`, `packages/cli/src/agent-rules/contracts.ts:48`
- Kind: rename
- Problem: `CHECKS_INSTALLED` and `RULES_ALONE` are the two possible closing paragraphs of the managed block in AGENTS.md (`const closing = hasChecks ? CHECKS_INSTALLED : RULES_ALONE;`), but the names do not say so. The `RULES_ALONE` text says "These files are installed copies", but rules are written, not installed.
- Fix: Rename them `CHECKS_CLOSING` and `RULES_ONLY_CLOSING` in `config/rules.ts` (today `config/agent-rules.ts`). The text of `RULES_ONLY_CLOSING`: "gspot writes these files. To change them, edit [rules] in gspot.toml and run gspot apply. Do not edit the files under the rules folder."
- Size: small

### CMD-085: The tool file folder constants carry retired names and sit apart

- Where: `packages/cli/src/config/configurations.ts:12` (`CONFIG_PREFIX`), `packages/cli/src/config/platform/locations.ts:4` (`CONFIGURATION_DIRECTORY`); users `packages/cli/src/configurations/contracts.ts:70`, `packages/cli/src/configurations/public.ts:100,110`, and 5 more files that import `CONFIGURATION_DIRECTORY`
- Kind: rename
- Problem: `CONFIGURATION_DIRECTORY` is `'.gspot/config'`, the folder of tool files, and `CONFIG_PREFIX` is `'.gspot/config/'`. The glossary retires "config" and "configuration" as names for a tool file, and "configuration" already means the selectable unit (`packages/cli/configurations/`). `CONFIG_PREFIX` also sits in the configurations file, next to `NAMING_TERMS_FILE = 'configurations/general/naming/policy.json'`, which points into the shipped `configurations/` folder, so a reader will think both point at the same folder.
- Fix: Rename `CONFIGURATION_DIRECTORY` to `TOOL_FILE_DIRECTORY` and `CONFIG_PREFIX` to `TOOL_FILE_PREFIX`, and put both in `config/system/locations.ts`. `NAMING_DEFAULTS_FILE` (CFG-035) stays in `config/configurations.ts`. It points into the shipped `configurations/` folder, so it must not be built from the tool file prefix (that would point at `.gspot/config/general/...`, which does not exist).
- Size: small

### CMD-086: Thin wrapper types in the top-level types files

- Where: `packages/cli/src/types/configurations.ts:59` (`ManifestCache`), `:73` (`SelectedConfigurations`), `:78` (`DetectionEvidence`), `packages/cli/src/types/planning.ts:28` (`Skip`)
- Kind: simplify
- Problem: `ManifestCache = { cache: Map | undefined }` wraps one variable and has one user (`configurations/public.ts:48`). `SelectedConfigurations = { selected: Manifest[] }` is `Pick<ScopeSelection, 'selected'>` and has two users. `DetectionEvidence` is `ConfigurationEvidence` without two fields.
- Fix: Replace `ManifestCache` with a module-level `let manifests: Map<string, Manifest> | undefined;` (lint allows it: the same file already has `let shipped` at line 50). Use `Pick<ScopeSelection, 'selected'>` at the two `SelectedConfigurations` call sites. Keep `DetectionEvidence` (about nine uses; it moves to `types/repository/selection.ts`) and `Skip` (three uses): a short name reads better than repeating a `Pick` each time.
- Size: small

### CMD-087: Tests pin exact help sentences

- Where: `tests/cli/commands/program.test.ts:48-76`, `tests/cli/commands/help.test.ts:11-56`
- Kind: delete
- Problem: The tests check that help contains phrases such as "missing or outdated tool lockfiles" and "Apply the ignore to these paths only; without it, everywhere", that every example is unique, and that the level summary appears in four places. They test text, not behavior, and every help rewrite (CLX-012) must edit them.
- Fix: TCM-003 deletes `help.test.ts`. Then remove the phrase checks in `program.test.ts` and keep its root `--help` test as the one help test. Do after TCM-003.
- Size: small

### CMD-088: Init functions are exported only so tests can skip the command

- Where: `packages/cli/src/commands/init/public.ts:238` (`prepare`), `:294` (`readFormatTables`), `packages/cli/src/commands/init/contracts.ts:205,258,309` (`writeSetup`, `askQuestions`, `proposeText`)
- Kind: simplify
- Problem: Six test files call `prepare` and then `writeSetup` instead of `initCommand`, and no production file outside the init folder calls them. The tests then depend on the inner steps, which makes the init code hard to change.
- Fix: Move those tests to `initCommand({ yes: true, … })`, then stop exporting `planInit` (today `prepare`), which only `commands/init/command.ts` uses. `readFormatTables` (in `init/format.ts`), `initSettingsText`, and `writeInitFiles` stay exported, because other init files import them. `askQuestions` is deleted (CLX-001).
- Size: medium

### CMD-089: Color is off in CI on top of the terminal test

- Where: `packages/cli/src/terminal/public.ts:21-25`
- Kind: simplify
- Problem: Color needs both stdout and stderr to be terminals, `NO_COLOR` unset, and not CI: `if (!color || noColor || isCI) return false; return process.stderr.isTTY && process.stdout.isTTY;`. In CI the streams are not terminals anyway, so the extra `isCI` test is a special case.
- Fix: Drop `|| isCI`, and drop the `std-env` import from this file.
- Size: small

### CMD-091: Init's "a tool file is missing" refusal can never run

- Where: `packages/cli/src/commands/init/takeover.ts:8-16` (the `original === undefined` branch of `captureOwned`), `packages/cli/src/commands/init/public.ts:55-75` (the `plan.unread` branch of `presentPlan`, text "A tool file is unreadable…", JSON `unreadable-config`), `packages/cli/src/commands/init/plan.ts:176,200` (`unread` and the section "missing; restore or delete it"), `packages/cli/src/types/commands/init.ts:36,47` (`InitPlan.unread`, `Replaced.unread`)
- Kind: delete
- Problem: Init lists a tool file only when it can read it (`getTooling` keeps a tool file only when `hasSection` reads it), then reads it again and handles "it is gone" with a refusal, a JSON error name, a plan section, and two fields. A file cannot disappear between two reads in the same run except by a race, so all of that is dead, and no test creates the state. It is also why init has two words, "unreadable" and "missing", for one state (CMD-029).
- Fix: In `planReplacedFiles` (`commands/init/replace.ts`, which takes in `captureOwned`), delete the `original === undefined` branch and read every replaced file directly. Delete the `unread` fields of `ReplacedFiles` and `InitPlan`, the plan section, and the `presentPlan` branch with its text and the `unreadable-config` JSON. What is left of `presentPlan`, the dry run, moves into `initCommand`.
- Size: small

### CMD-092: One command for each action, no mode flags, and every option earns its place

- Where: `packages/cli/src/commands/set.ts:195-206` (`--replace`, `--remove`, `--default`), `packages/cli/src/commands/ignore.ts:138` (`--remove`), `packages/cli/src/commands/add.ts`, `packages/cli/src/commands/remove.ts`, `packages/cli/src/public.ts:61-66` (`--quiet`, `--verbose`, `--no-color`, `-C`, `help [command]`), `packages/cli/src/commands/init/public.ts:188` (init flags), `packages/cli/src/commands/check/command.ts` (`--skip`, `--hook`), `packages/cli/src/commands/contracts.ts:65-69` (`--refresh-lockfiles`); `cli-help.txt` (the help of every command today)
- Kind: simplify
- Problem: `gspot set` has four jobs, and a flag at the end of the line picks one: add to a list (no flag), `--replace`, `--remove`, and `--default`. The word "remove" has three meanings: the `gspot remove` command (configurations), `set --remove` (list items), and `ignore --remove` (ignore records). Each command undoes itself in a different way. On a setting that is not a list, `--remove` writes the value: `gspot set level recommended --remove --dry-run` shows `level = "recommended"`. Many options do not earn their place: `--quiet`, `--no-color`, and `-C` serve only tests and one docs section; `--quiet` and `--verbose` are program options, but only `check` reads them; `--skip` repeats `--only` and `gspot ignore`; eight init flags repeat settings that `gspot set` writes; `--scope-configurations` is a second name for `--scope`; and only CI's source-install step runs `--refresh-lockfiles` (CMD-015).
- Fix: Fourteen commands, each with one job. The exact help is in the "Target help" section below.
    - `gspot init [--yes] [--from <template>] [--configurations <names...>] [--dry-run]`: write the setup files. Delete `--scope-configurations`, `--no-install`, `--ci`, `--no-ci`, `--no-hooks`, `--no-agent-rules`, `--runner`, `--no-runner`, the four questions (CLX-001), and the install step inside init: init ends with "run gspot install". It asks only "Continue?".
    - `gspot install`: install the tools and turn the Git hooks on or off. Delete `--refresh-lockfiles` (CMD-015) and `--dry-run` (CLX-004).
    - `gspot apply [--dry-run]`: write the generated files from gspot.toml.
    - `gspot check [paths...] [--only <checks...>] [--staged | --changed [--base <ref>]] [--fix] [--dry-run] [--hook pre-commit|pre-push] [--message-file <path>] [--verbose]`: run the checks. Delete `--skip` (use `--only`, or `gspot ignore`). `--verbose` moves here from the program options (CMD-010). `--hook` loses `commit-msg` (CLX-006), and `--dry-run` turns on `--fix` (CLX-007).
    - `gspot add <configuration...> [--scope <path>]` and `gspot remove <configuration...> [--scope <path>]`: select or remove configurations. They keep the record of removed configurations, so detection does not select them again; only they write `removed_configurations` (CLX-003). `remove` has only this meaning.
    - `gspot set <setting> <values...> [--scope <path>] [--reason <text>]`: write a single value, add list items, or add table entries (DS1-008).
    - New: `gspot unset <setting> [items...] [--scope <path>]`: with no items, delete your value so the root value or the default applies again; with items, take them out of a list, or the named entries out of a table. It replaces `set --default` and `set --remove`, and it takes no `--reason` (CLX-002). Replace a whole list with `gspot unset`, then `gspot set`.
    - `gspot ignore <check> [--rule <rule>] [--paths <glob...>] [--until <date>] --reason <text>`: ignore a check or one of its lint rules.
    - New: `gspot unignore <check> [--rule <rule>] [--paths <glob...>]`: replaces `ignore --remove` (CLX-011).
    - `gspot list [configurations | settings]`, `gspot explain <subject>`, `gspot doctor`, and `gspot export <file>` keep their jobs; export loses `--dry-run` (CLX-004).
    - Every command takes `--json` and `-h, --help` (CLX-005). The program options are `--version` and `--help` only. Delete `--quiet`, `--no-color` (gspot already honors `NO_COLOR`), `-C` (use `cd`, CLX-009), and the `help [command]` command (CLX-008).
    - Delete `set --replace`, `set --remove`, `set --default`, and `ignore --remove`. Update the docs pages, help texts, hook scripts, and tests that name the old commands and flags (CLX-014).
- Size: large

### CLX-001: Init's four questions break gspot's own CLI rule once their flags go

- Where: `packages/cli/src/commands/init/contracts.ts:79-124` (`requireTerminal`, `askChoice`, `detectCi`, `planCi`), `packages/cli/src/commands/init/contracts.ts:258-278` (`askQuestions`), `packages/cli/src/config/commands/init.ts:27-40` (`RUNNER_CHOICES`, `CI_CHOICES`), `packages/cli/src/commands/init/public.ts:192-204`, `tests/config/harness/init.ts:2` (`QUIET_INIT`), `tests/cli/commands/init/questions.test.ts`
- Kind: delete
- Problem: Init asks four questions: Git hooks, CI workflow, rules, and runner. Their six flags (`--no-hooks`, `--ci`, `--no-ci`, `--no-agent-rules`, `--runner`, `--no-runner`) go (CMD-092). gspot ships a CLI rule to every repository and follows it itself: "Every value a prompt asks for also has a flag. If no terminal is available, fail. Name the missing flag." (`.gspot/rules/general/engineering/code/CLI.md`, "Interface"). Without the flags, four prompts would have no flag, and the no-terminal message would name flags that are gone (`Pass --ci`, `Pass --no-runner`). The four answers are plain settings that `gspot set` already writes, and a template answers all four.
- Fix: Delete the four questions with the six flags. init proposes and asks nothing but "Continue?". Without `--from`, the plan turns on the Git hooks and the rules, and a CI workflow when existing CI files or the origin host show GitHub or GitLab and the repository has no lint job yet: it writes `[hooks] enabled = true` and, with CI, `[ci] enabled = true` (plus `provider = "gitlab"` for GitLab). With `--from`, the template decides: a key the template lacks takes the gspot.toml default (hooks and CI off, rules on). There is no runner to propose: hooks start gspot through the npm client when the root `package.json` lists `@gspothq/cli`, otherwise with `mise exec -- gspot` (INX-003). The plan ends with one line: "Change these later with gspot set hooks.enabled, ci.enabled, ci.provider, or rules.enabled." The only prompt left is "Continue?", which `--yes` answers, as the same CLI rule asks for a command that deletes files; `--dry-run` never asks. `requireTerminal` is written inside `askConfirmation` (in `commands/init/command.ts`): without a terminal and without `--yes`, init fails with "There is no terminal to ask in. Pass --yes to accept the plan." Delete `askQuestions`, `askChoice`, the flag parameter of `requireTerminal`, `RUNNER_CHOICES`, `CI_CHOICES`, `Choice`, the `select` import, the `hooks`, `ci`, `agentRules`, and `runner` fields of `InitOptions`, and `tests/cli/commands/init/questions.test.ts`. Keep the CI proposal of `planCi` as `proposeCi` in `commands/init/settings-text.ts`, with no prompt. Tests that use `QUIET_INIT` start from a template (`--from`) that holds only `[rules] enabled = false`: hooks and CI stay off because the template lacks them.
- Size: medium

### CLX-002: `unset --reason` is never needed

- Where: `packages/cli/src/commands/set.ts:134-180` (the `--remove` and `--default` branches that become `gspot unset`), `packages/cli/src/policy/errors/contracts.ts:230-269` (`isLoosening`, `isReasonOwed`), `packages/cli/src/policy/errors/public.ts:78-91` (`scalarErrors`)
- Kind: delete
- Problem: A reason is needed only when the value written in gspot.toml is looser than the shipped default. `unset` either deletes your value (the default applies, which is never looser than itself) or takes items out of your own list (part of a value that already carries its reason). Taking out an allowed item makes a check stricter. Taking out a banned word removes only a word you added: the shipped words stay, because lists add up across configurations, root, and scopes. So a `--reason` on `unset` could never be required.
- Fix: `gspot unset <setting> [items...] [--scope <path>]`, with no `--reason`. When it deletes the whole value, it deletes the value with its reason, which sits in the same entry (the reason form `{ value = ..., reason = "..." }`, CFR-002), so no reason is left behind. With items: on a list, it takes those items out; on a table of named entries, such as `tools.eslint.rules`, the items are entry names and it deletes those entries; on a setting with one value, it refuses: "level is not a list, so it takes no items. Run gspot unset level."
- Size: small

### CLX-003: `removed_configurations` is a setting, so `set` and `unset` can write the record that `add` and `remove` keep

- Where: `packages/cli/src/policy/schema/public.ts:166-168` (`removed_configurations` inside `rootSettingSchemas`), `packages/cli/src/policy/settings/public.ts:104-115` (`rootDeclarations`), `tests/cli/commands/explain/selection.test.ts:187`
- Kind: delete
- Problem: `add` and `remove` keep `removed_configurations`, the record that stops detection from selecting a removed configuration again. The same key is also a declared setting (`rootDeclarations` turns every key of `rootSettingSchemas` into a known setting), so `gspot set removed_configurations nextjs` writes it without the checks `remove` makes (the always-selected refusal and the `requireChain` refusal) and without updating `configurations`; `gspot unset` would do the same. `gspot list settings` and `gspot explain removed_configurations` show it as a setting. `configurations` itself is not in `rootSettingSchemas`, so `gspot set configurations x` is refused: the two halves of one record are treated differently.
- Fix: Move `removed_configurations` from `rootSettingSchemas` into the top-level schema of gspot.toml, next to `configurations` (`policy/schema/public.ts:184-188`). It stays a key at the root and in `[[scope]]`, written only by `add` and `remove`. `set`, `unset`, `list settings`, `explain`, and the settings reference no longer offer it. The explain test row goes with the table that TCM-048 deletes.
- Size: small

### CLX-004: `--dry-run` does not earn its place on six commands

- Where: `packages/cli/src/commands/add.ts:72`, `remove.ts:84`, `set.ts:208`, `ignore.ts:139`, `commands/contracts.ts:68` (install) and `:250` (export); `planPolicy` (`commands/contracts.ts:44-54`), the dry-run branch of `savePolicy` (`:121-125`), the dry-run branch of `installCommand` (`:91-98`), the "would write" branch of `exportCommand` (`:217-229`); the `isDryRun` fields of `AddOptions`, `RemoveOptions`, `SetOptions`, `IgnoreOptions`, `InstallOptions`, `ExportOptions`, `SavePolicyOptions`; `tests/cli/commands/policy-preview.test.ts`
- Kind: delete
- Problem: add and remove, set and unset, ignore and unignore undo each other. gspot.toml is in Git, and each of these commands prints the change it made (`added bash`, `level = "all" (was "recommended")`, the ignore record), so a dry run is a second way to see and undo one entry. `install` writes only inside `.gspot/` and the lockfiles gspot owns, and `gspot doctor` already reports which tools and hooks are missing. `export` writes one file you name, which you can read or delete. Outside tests, only two docs lines use these dry runs (`docs/src/content/docs/guides/remove.md:9`, `templates.md:34`). The setting dry run does not even build the generated files (`planPolicy` only diffs gspot.toml), so it cannot catch the error a real run can hit after it writes gspot.toml.
- Fix: Keep `--dry-run` only where gspot rewrites or deletes files you wrote: `init` (deletes the tool files it replaces), `apply` (rewrites gspot.toml and every generated file; the upgrade guide uses it), and `check --fix` (fixers rewrite your source). Delete it from add, remove, set, ignore, install, and export, and do not give it to unset and unignore. Delete `planPolicy`, `PolicyPlanJson`, the dry-run branches, the `isDryRun` fields, `policy-preview.test.ts`, and the dry-run cases in the set, remove, ignore, lockfile, installation, and hook tests. `planApply` stays in `commands/apply.ts`, with its JSON type `DryRunJson`. Docs: drop `remove.md:9` and the export sentence in `templates.md:34`.
- Size: medium

### CLX-005: `--json` belongs to each command; that deletes the Commander subclass without changing list options

- Where: `packages/cli/src/public.ts:19-36` (`GspotProgram`), `:60-64`, `:75-82`, `:95-98`, `:113-119`; `packages/cli/src/types/commands/program.ts` (`GlobalFlags`, `GlobalCommand`, `Program`); `packages/cli/src/commands/public.ts:214-216`; `packages/cli/src/commands/init/public.ts:206`; `packages/cli/src/commands/check/command.ts:131,148`; `packages/cli/src/config/commands/help.ts:28,63`
- Kind: simplify
- Problem: Once `--quiet`, `--no-color`, and `-C` go and `--verbose` moves to `check` (CMD-092), `--json` is the only program option left. The `GspotProgram` subclass and 60 hidden option copies (5 program options on each of 12 commands) exist so that a program option after a list option (`gspot check --only a --json src`) ends the list. Commander 15 already does that when `--json` is declared on the command itself: its `parseOptions` ends a variadic option at the next argument that starts with `-` and reads that argument as an option of the same command, so `--only a --json src` gives `only = ["a"]`, `json = true`, `paths = ["src"]`. Only two help examples write `--json` before the command (`gspot --json export`, `gspot --json doctor`); docs and tests write it after.
- Fix: Declare `--json` on every command in the loop that adds the help footer (CLX-012); every one of the 14 commands prints data. Read it in the `preAction` hook from the action command (Commander gives it as the hook's second argument). In the catch of `main`, which also handles Commander's own parse errors before any action, use `argv.includes('--json')`. Delete `GspotProgram`, the `valued` scan, the hidden-copy loop, `GlobalFlags`, `GlobalCommand`, `Program`, and every `optsWithGlobals` call; the register functions take Commander's `Command`. List options keep taking several values (`--only a b`). Change the two help examples to `gspot export gspot.template.toml --json` and `gspot doctor --json`. The program options are `--version` and `--help` only.
- Size: small

### CLX-006: `--hook commit-msg` repeats `--message-file`

- Where: `packages/cli/src/config/generation/hooks.ts:7`, `packages/cli/src/commands/check/command.ts:151-156,188-191`, `packages/cli/src/terminal/contracts.ts:149-150`, `.gspot/hooks/commit-msg:7`, `docs/src/content/docs/guides/hooks.md:30`
- Kind: delete
- Problem: The commit-msg hook runs `gspot check --hook commit-msg --message-file "$1"`, but `--message-file` alone already selects the message checks: `if (flags.messageFile !== undefined || hook === 'commit-msg') options.stage = 'message';` (`check/command.ts:155`). The `commit-msg` choice of `--hook` adds only the line "Bypass this hook once: git commit --no-verify", and `--hook commit-msg` without `--message-file` runs the message checks with no file. Two flags for one job.
- Fix: `--hook` takes `pre-commit` or `pre-push`, the two hooks whose protocol gspot must copy (the staged copy of the index, and the pushed commits on standard input). The generated commit-msg script runs `gspot check --message-file "$1"`. A failed message check prints no bypass line: the fix is a new message, and `git commit --no-verify` still works. The `--hook` choices are `CHECK_HOOKS` (CMD-052), not `Object.keys(HOOK_ARGS)`. Update `hooks.md:30`.
- Size: small

### CLX-007: `check --dry-run` refuses to run without `--fix` instead of turning it on

- Where: `packages/cli/src/commands/check/command.ts:77,186`, `docs/src/content/docs/guides/findings.md:65`
- Kind: simplify
- Problem: On `check`, a dry run has one meaning (show what the fixers would change), yet `gspot check --dry-run` fails with "--dry-run requires --fix." (`if (options.isDryRun && !options.fix) throw …`). `--base` already turns on `--changed` with Commander's `.implies`.
- Fix: `new Option('--dry-run', 'Print the changes the fixers would make, and write nothing. Turns on --fix').implies({ fix: true })`. Delete the refusal and the docs sentence "`--dry-run` requires `--fix`".
- Size: small

### CLX-008: `gspot help <command>` is a second way to print help

- Where: `packages/cli/src/public.ts:66`, `packages/cli/src/config/commands/program.ts:1`
- Kind: delete
- Problem: `gspot <command> --help` prints the same page. A second spelling is one more thing to document and test, and `HELP_CODES` must treat its exit code specially (CMD-030). No doc, test, script, or message runs `gspot help`.
- Fix: `.helpCommand(false)` in place of `.helpCommand('help [command]', ...)`. The error footer keeps pointing to `--help` (CLX-012).
- Size: small

### CLX-009: `-C` is used by the test setup and one docs page

- Where: `tests/harness/gspot.ts:66`, `docs/src/content/docs/guides/monorepos.md:92-98`, `gspot.toml:40-43`, `packages/cli/src/commands/public.ts:214-216` (`commandRoot`)
- Kind: delete
- Problem: `-C` goes, because `cd` does the same. Two users must change first: a docs section ("A policy below the Git root") teaches `gspot -C api check` (`monorepos.md:95`), and `runGspot` puts `-C cwd` before the arguments of every in-process test run (`const code = await main(['-C', cwd, ...argv]);`). gspot.toml also carries a naming override for the option value `C`.
- Fix: In `runGspot`, call `process.chdir(cwd)` inside the existing `try` and restore the previous folder in `finally`; the function already swaps stdout, stderr, stdin, and the environment the same way, with `GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' }` from `tests/config/processes.ts`. Do this before `-C` goes. Docs: `cd api && gspot check`. Delete the `C` naming override in `gspot.toml:40-43`. Each command starts in `process.cwd()`, and `commandRoot` goes.
- Size: small

### CLX-010: `gspot set --help` prints the level text that `gspot explain level` prints

- Where: `packages/cli/src/config/commands/help.ts:40` (`levels`), `packages/cli/src/commands/public.ts:225-227` (the `levels` branch of `commandHelp`), `packages/cli/src/types/commands/help.ts`
- Kind: delete
- Problem: The "Levels:" block is in the help of `set` only. The same two sentences are the description of the `level` setting, which `gspot explain level` and `gspot list settings` print: `levels: \`${LEVEL_SUMMARY}\n\n${ALL_LEVEL_SUMMARY}\``and`description: \`${LEVEL_SUMMARY} ${ALL_LEVEL_SUMMARY}\``(`policy/schema/public.ts:160-162`). Tests check this text in four places (CMD-087).
- Fix: Delete `levels` from `COMMAND_HELP`, the `levels` branch of `commandHelp`, and the field of `CommandHelp`. This also removes the only import from `config/policy/settings.ts` into the help file.
- Size: small

### CLX-011: `unignore` deletes every ignore of the check unless `--rule` or `--paths` narrow it

- Where: `packages/cli/src/commands/ignore.ts:48-86` (`deleteIgnore`, which becomes `unignoreCommand` in `commands/unignore.ts`), `packages/cli/src/commands/ignore.ts:136-138`
- Kind: simplify
- Problem: Today `ignore X --remove` without `--rule` matches only records that have no rule, and without `--paths` only records that have no paths: the selector `{ check, rule: options.rule, … }` is compared with `isDeepStrictEqual`. In plain English, "stop ignoring X" means every ignore of X; someone who ignored X for two folders and runs `gspot unignore X` would get "nothing to remove". With `--remove`, `--reason` and `--until` also choose which records to delete, although the help says `--reason` is "required when adding". The summary says "removed N ignore entries" even when it only took some paths out of a record.
- Fix: `unignore` deletes every ignore record of the check. `--rule` keeps the deletion to records with that rule. `--paths` takes those paths out of the matching records that list paths, and deletes a record when no path is left. A record without `paths` covers every path, so `--paths` leaves it, deletes nothing from it, and says so: "Kept 1 ignore that covers every path. To delete it, run gspot unignore without --paths." `reason` and `until` are not part of the match. Print "deleted N ignores" and "took M paths out of K ignores" apart.
- Size: small

### CLX-012: Every help text is a fixed value, so it belongs in `config/commands/help.ts`, with one footer loop

- Where: the `.summary()`, `.description()`, `.argument()`, and `.option()` texts in the 12 register functions
  (`add.ts:64-72`, `remove.ts:76-84`, `set.ts:190-208`, `ignore.ts:127-139`, `list.ts:125-133`,
  `commands/public.ts:239-245`, `commands/contracts.ts:62-69,243-250`, `check/command.ts:171-193`,
  `doctor/public.ts:166-171`, `explain/public.ts:284-290`, `init/public.ts:174-205`); 12 calls of
  `.addHelpText('after', commandHelp('…'))` (`add.ts:70`, `remove.ts:82`, `set.ts:197`, `ignore.ts:133`, `list.ts:130`,
  `check/command.ts:176`, `contracts.ts:67,249`, `public.ts:244`, `doctor/public.ts:171`, `explain/public.ts:290`,
  `init/public.ts:179`); `packages/cli/src/public.ts:60-68`; `packages/cli/src/commands/public.ts:218-231`;
  `packages/cli/src/config/commands/help.ts:5-65`; `docs/src/content/reference/commands.ts:27`;
  `tests/cli/commands/help.test.ts:14-16,34-35`
- Kind: move
- Problem: The exit codes and examples of a command are in `config/commands/help.ts`, while its summary, description,
  argument, and option texts are inline in its register function, so one help page lives in two places. Fixed values
  belong in `config/`. The texts use words that make the reader guess ("reconcile", "root selection", "apply the
  policy", "effective", "authored entry", "locked tools", "exact copy of the index", "applicable inputs", "loosen",
  "general checks remain automatic", "Select a runner"); add and remove have a broken sentence ("…to one scope, apply
  the policy."). The exit-code texts disagree: nine repeat "2: the input was invalid, or <command> could not finish.",
  six end their first line with "or the dry run finished", export's omits its own dry run, and the install example
  runs `gspot install --dry-run`. Each register function adds the help footer by hand: twelve copies of one line and
  twelve imports. `COMMAND_HELP` is `Record<string, …>`, so `commandHelp` and the docs page both throw "has no help
  metadata" when they run, and a test compares the keys with the command names. The error footer "(run gspot --help to
  see every command)" is wrong after an error in one command.
- Fix: One record per command in `config/commands/help.ts`, written `as const`: `{ summary, description, arguments, options, exitCodes, example }`, with the texts of the "Target help" section below. They use the glossary words
  (settings, rules, lint rule, dry run, select) and say what each command writes. Each record holds its own exit-code
  lines as written there: "or the dry run finished" is only on apply, and the install example is `gspot install`. The
  register functions read their texts from it. In `buildProgram` (`commands/program.ts`), after the commands are
  registered, loop once over `program.commands`: add the help footer with
  `commandHelp(COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP])`, and declare `--json` (CLX-005). There is
  no `CommandHelp` or `CommandName` type (S03-009) and no `types/commands/help.ts` or `types/commands/program.ts`, so a
  missing key fails to compile; delete both "has no help metadata" throws. The error footer becomes "(add --help to see
  the options)". The key-equality test and the test that requires every example to be unique go with `help.test.ts`
  (TCM-003). 14 commands at about 15 lines each stay under 300 lines.
- Size: medium

### CLX-013: Three argument names to fix

- Where: `packages/cli/src/commands/set.ts:192`, `packages/cli/src/commands/list.ts:132`, `packages/cli/src/commands/init/public.ts:182-185`
- Kind: rename
- Problem: `set [value...]` is optional only because `--default` took no value; with `--default` gone, a missing value is a usage error that Commander can report, and the hand check "needs a value; pass one, or --default" (`set.ts:122-126`) has no job. `list [kind]` reuses "kind", which the glossary gives to the file kind, and its default does not show in help, although gspot's CLI rule asks help to print every default ("`--help` prints usage, every flag with its default, and one example"). `--configurations <configurations...>` repeats the flag name as its placeholder.
- Fix: `.argument('<values...>', 'The new value, or the items or table entries to add')`, and delete the hand check; `new Argument('[what]', 'What to list').choices(['configurations', 'settings']).default('configurations')`; `--configurations <names...>`.
- Size: small

### CLX-014: Messages and docs that print flags the target deletes

- Where: `packages/cli/src/commands/explain/public.ts:97-98`, `explain/contracts.ts:185-187`, `set.ts:125`, `planning/contracts.ts:139`, `init/detection.ts:18`, `config/commands/help.ts:9,14,19,24,28,49,63`; docs `monorepos.md:76,95`, `policy.md:38,71,98-99`, `ci.md:9-10,29`, `runners.md:18,32,34`, `existing-repository.md:51`, `install.md:71,73`, `troubleshooting.md:35,71`, `findings.md:54,57,65`, `hooks.md:30,39`, `remove.md:9`, `templates.md:34`
- Kind: rewrite-text
- Problem: Each of these prints or teaches a flag or form that goes: `gspot set <key> --default` (explain), `gspot set 'tools.<tool>.rules.<rule>' <options> --reason "..."` (explain on a lint rule: no such setting, and the options of a lint rule never take a reason), "pass one, or --default" (set), "skipped by --skip" (the skip reason in reports), "from --scope-configurations" (init detection), the dry-run and `gspot --json` examples in help, and the docs lines listed. A missed one sends users to a refused command.
- Fix: explain prints `Back to the default: gspot unset <key>`. On a lint rule, explain prints no `--reason` for options: to accept a finding it keeps `gspot ignore <check> --rule <rule> --reason "..."` (with and without `--paths`), and to change the options it names the setting `tools.<tool>.rules`: `Change its options: gspot set tools.eslint.rules '{ "no-console" = [<options>] }'` (`set` adds table entries, DS1-008). Delete the `set.ts:125` check (CLX-013), the `--skip` skip reason with `--skip`, and the detection note branch; use the examples of the "Target help" section. Docs: `gspot set ci.enabled true`, plus `gspot set ci.provider gitlab` for GitLab, in place of `init --ci` (`ci.md:9-10`; `set` already writes the workflow, so no `gspot apply` follows, DOC-010); `gspot unset ci.operating_systems windows` for list edits (`ci.md:29`, `policy.md:98-99`); `gspot unignore` (`policy.md:71`); `runners.md` is deleted with the `runner` setting (INX-003), so its lines get no replacement; "run gspot install" instead of `--no-install`; "delete the lockfiles and run gspot install" (CMD-015); `gspot check --only` or `gspot ignore` instead of `--skip`; `gspot check --message-file "$1"` (`hooks.md:30`); `cd api && gspot check` (`monorepos.md:95`); and plain `gspot init` for scopes (`monorepos.md:76`). The table "Old and new command lines" below lists the common cases.
- Size: small

### S03-001: `note()` has one caller left

- Where: `packages/cli/src/terminal/public.ts:50-53`; callers `packages/cli/src/commands/check/tree.ts:30`, `packages/cli/src/commands/init/public.ts:154`
- Kind: simplify
- Problem: CMD-010 moves init's `[info]` line into init's result text. Then `note()` has one caller, `reportFixes` ("no fixer changed anything"), and one line of work: after CMD-011 it only writes to stderr with a cyan `[info]` prefix.
- Fix: Write that line in `reportFixes` (`commands/check/tree.ts`) and delete `note` from `terminal/print.ts`. `warn` keeps its three callers.
- Size: small

### S03-002: `buildIgnore` writes four `if` blocks for one object literal

- Where: `packages/cli/src/commands/ignore.ts:33-46`
- Kind: simplify
- Problem: The function builds the ignore record field by field. `compact()` already does this in one line, and it is imported in the same file. The `paths.length > 0` test guards an empty list that Commander never gives: a variadic option needs at least one value (`--paths <glob...>`).
- Fix: In `ignoreCommand`, write `{ check, ...compact({ rule, paths, reason, until: until === undefined ? undefined : parseExpiryDate(until) }) }` and delete `buildIgnore`.
- Size: small

### S03-007: Two tables map a CI provider to the same file label

- Where: `packages/cli/src/config/commands/doctor.ts:29` (`CI_REPORT_PATHS`), `packages/cli/src/config/commands/init.ts:36-40` (`CI_CHOICES`)
- Kind: merge
- Problem: `CI_REPORT_PATHS = { github: GITHUB_WORKFLOW, gitlab: GITLAB_INCLUDE_LABEL }` and the labels of `CI_CHOICES` are the same map; `CI_CHOICES` only adds `none`.
- Fix: One `CI_FILE_LABELS` in `config/generation/ci.ts`, beside `GITHUB_WORKFLOW`. Doctor prints it. `CI_CHOICES` is deleted with init's questions (CLX-001), and `proposeCi` tests the origin host against the keys of `CI_FILE_LABELS`.
- Size: small

### S03-008: Two option types are one, and one option type has one field

- Where: `packages/cli/src/types/commands/add.ts`, `packages/cli/src/types/commands/remove.ts`, `packages/cli/src/types/commands/install.ts`
- Kind: merge
- Problem: `AddOptions` and `RemoveOptions` are the same type in two files. Once `--refresh-lockfiles` and `--dry-run` go (CMD-015, CLX-004), `InstallOptions` is `{ cwd }`, a wrapper around one string.
- Fix: One `ConfigurationsOptions` type in `types/commands/save-settings.ts` for add and remove. Delete `InstallOptions`, and give `installCommand` the start folder. `ApplyOptions` (`{ cwd, isDryRun }`) moves to `types/commands/save-settings.ts`.
- Size: small

### S03-009: `CommandHelp` and `MiseBackend` exist only to annotate a config table

- Where: `packages/cli/src/types/commands/help.ts`, `packages/cli/src/types/configurations.ts:111`
- Kind: delete
- Problem: Each type has one use: the annotation of `COMMAND_HELP` or of `MISE_BACKENDS`. `config/` may import only `config/`, so the annotations go, and then nothing names the types.
- Fix: Write both tables `as const` and delete both types. The two users of a command name, `commandHelp` and `buildProgram`, write `keyof typeof COMMAND_HELP` where they use it (CLX-012). With `GlobalFlags` and `Program` gone (CLX-005), `types/commands/program.ts` has nothing left and goes; no `types/commands/help.ts` is made.
- Size: small

### S03-010: The installed tool folder names are written twice

- Where: `packages/cli/src/config/configurations.ts:37` (`INSTALLATION_KINDS`), `packages/cli/src/config/platform/locations.ts:44` (`INSTALLATION_DIRECTORIES`)
- Kind: merge
- Problem: `['npm', 'python', 'vale']` is written as `INSTALLATION_KINDS` and again as the keys of `INSTALLATION_DIRECTORIES` (target `INSTALLED_TOOL_FOLDERS`). The ownership log schema reads the list in `z.enum`, and the state code indexes the map.
- Fix: Keep the three names once, as `TOOL_FOLDER_KINDS = ['npm', 'python', 'vale'] as const` beside `INSTALLED_TOOL_FOLDERS` in `config/system/locations.ts`, and key the folder table by it. The ownership log schema reads `z.enum(TOOL_FOLDER_KINDS)`, and `InstalledToolFolder = (typeof TOOL_FOLDER_KINDS)[number]` sits in `types/configurations.ts`. Do not build the schema from the table's keys: `Object.keys` returns `string[]`, so the schema would output `string`.
- Size: small

### S03-012: Most CLI types are built on zod-inferred types, so they cannot sit in `types/` today

- Where: every `types/` file of this part; `packages/cli/src/types/configurations.ts:5-7`, `packages/cli/src/types/planning.ts:4`, `packages/cli/src/types/agent-rules.ts:3`
- Kind: move
- Problem: `types/` may import only `config/` and `types/`, but many types are built on `z.infer` types of schema files: `Manifest` (from `manifestSchema`), `Policy`, `ToolPin`, `Template`. Every type that names one of them, such as `Session`, `PlannedCheck`, `CheckDeclaration`, `InitAnswers`, and `DetectionSummary`, cannot sit in `types/`, and without a rule for enums even `Level` and `Stage` would pull plain types (`PlanOptions`, `RunFilters`, `InitPlan`) out. 32 of the CLI's `types/` files import a schema or code file.
- Fix: (1) Small enums become `as const` lists in `config/configurations.ts` (`LEVELS`, `STAGES`, `GROUPS`); the schema reads them with `z.enum(LIST)`, and `types/` derives the type, as `FILE_KINDS` already does. (2) Every other exported type, object types too, is written by hand in its `types/` file, and the schema is checked against it with the type rule: each schema object literal is written `z.object({ ... } satisfies SchemaShape<T>)` (`SchemaShape` in `types/objects.ts`). So `Manifest`, `Session`, `PlannedCheck`, `CheckDeclaration`, `InitAnswers`, `DetectionSummary`, `SettingDeclaration`, `SettingRow`, `SettingScope`, `CheckOptions`, `PushReport`, and the rest go to `types/` too. `z.infer` is not used for exported types.
- Size: medium

### S03-013: Six config files of this part import `types/` or a package

- Where: `packages/cli/src/config/configurations.ts:1`, `packages/cli/src/config/terminal.ts:1`, `packages/cli/src/config/commands/doctor.ts:1-3`, `packages/cli/src/config/commands/explain.ts:1`, `packages/cli/src/config/commands/help.ts:1`, `packages/cli/src/config/commands/init.ts:2`
- Kind: simplify
- Problem: These files import types (or a package type) only to annotate a table, but `config/` may import only `config/`. 24 CLI config files break the rule in the same way.
- Fix: Write each table `as const` and let its user check it: indexing `TOOL_STATE_COLORS[tool.state]` or `CHECK_STATUS_COLORS[check.status]` still fails to compile when a key is missing. Where a list type is needed, use a config list (`CHECK_STATUSES`, `GROUPS`) instead of a type. Per file: `GROUP_LABELS` (today `CONFIGURATION_LABELS`) and `MISE_BACKENDS` are `as const`, with `GROUPS` keying the labels; `config/terminal.ts` types its two tables by `CHECK_STATUSES` or not at all; `config/commands/doctor.ts` drops the `satisfies` clause and the `SuggestionSection[]` annotation (CMD-073); `REASON_NEEDED_TEXTS` in `config/commands/explain.ts` drops the `SettingDeclaration` annotation; `COMMAND_HELP` drops `CommandHelp` (S03-009); `config/commands/init.ts` loses its import with `RUNNER_CHOICES` and `CI_CHOICES` (CLX-001).
- Size: small

### S03-015: `types/commands/` has 16 files for 9 topics

- Where: `packages/cli/src/types/commands/*.ts`
- Kind: merge
- Problem: Nine files (`add.ts`, `remove.ts`, `help.ts`, `ignore.ts`, `session.ts`, `set.ts`, `apply.ts`, `install.ts`, `export.ts`) hold 1 to 3 declarations, each with one user.
- Fix: Seven files: `check`, `doctor`, `explain`, `export`, `init`, `list`, and `save-settings` (today `save-policy.ts`: the options and results of every command that saves gspot.toml, and apply's dry-run JSON). The install JSON goes to `types/install.ts`, and the top-level items to `types/repository/selection.ts` and `types/rules.ts`. Delete `add.ts`, `remove.ts`, `apply.ts`, `help.ts`, `ignore.ts`, `install.ts`, `program.ts`, `session.ts`, and `set.ts`.
- Size: small

### S03-016: The same file and tool names are written as literals in many files

- Where: `'mise.toml'` (doctor, the init plan, `tools/public.ts`, `config/repository/inventory.ts`), `'.gitignore'` (the init plan, `config/lifecycle/ownership.ts`, others), `'eslint'` (about 17 places), `'package.json'` (all under `packages/cli/src/`)
- Kind: merge
- Problem: One value, many spellings to keep in step.
- Fix: `MISE_TOML` in `config/repository/tooling.ts`, `GITIGNORE_FILE` in `config/repository/tracked.ts`, `ESLINT_TOOL` in `config/generation/eslint.ts`, and `PACKAGE_JSON` in `config/parsers/dependency-files.ts`.
- Size: small

### DS1-008: `gspot set` keeps one structured form for one value

- Where: `packages/cli/src/commands/set.ts:35-91` (`parseStructured`, `parseSettingValue`), `packages/cli/src/commands/set.ts:130-145` (`changeSetting`), `packages/cli/src/config/commands/set.ts` (`STRUCTURED`)
- Kind: simplify
- Problem: `gspot set` parses JSON into record lists and adds a reason to record items, but record lists are written by hand. `parseStructured` also reads one structured value that is not a record, such as the options of one lint rule, an `extra` table, or one inline-table item of a list, and that form must stay.
- Fix: `gspot set` writes single values, list items, and table entries, and never a `[[...]]` record list. A list item may be one inline table, as in `tools.eslint.restricted_imports` (`{ name, message }`); a table entry is one entry of a table such as `tools.eslint.rules`. Delete the record-item reason branches of `parseSettingValue` and `changeSetting`. `parseStructured` loses its JSON branch and reads one value in the TOML inline form, the syntax of gspot.toml itself; `STRUCTURED` stays for that test. `gspot unset <setting> <items...>` takes out list items, or the named entries of a table (CLX-002).
- Size: small

## Target help

This is what `gspot --help` and `gspot <command> --help` print after the cleanup, in the layout of Commander 15 at 80
columns. Each text lives in `COMMAND_HELP` in `packages/cli/src/config/commands/help.ts` (CLX-012), and the docs
commands page is built from it.

```text
=================== gspot --help
Usage: gspot [options] [command]

Lint AI-generated code and write rules for AI coding agents.

Options:
  --version                             Print the version
  -h, --help                            Print help for the command

Commands:
  init [options]                        Set up gspot in this repository
  install [options]                     Install the tools and turn the Git hooks
                                        on or off
  apply [options]                       Write the generated files from
                                        gspot.toml
  check [options] [paths...]            Run the checks
  add [options] <configuration...>      Select configurations
  remove [options] <configuration...>   Remove configurations
  set [options] <setting> <values...>   Change a setting
  unset [options] <setting> [items...]  Delete your value of a setting
  ignore [options] <check>              Ignore a check or one of its lint rules
  unignore [options] <check>            Stop ignoring a check
  list [options] [what]                 List configurations or settings
  explain [options] <subject>           Explain a check, lint rule,
                                        configuration, setting, or file
  doctor [options]                      Check the gspot setup
  export [options] <file>               Write a template for other repositories

=================== gspot init --help
Usage: gspot init [options]

Find the configurations this repository needs, print the plan, and write it when
you accept: gspot.toml, the tool files, the rules, the Git hooks, and the CI
workflow. The plan turns on the Git hooks and the rules, and a CI workflow when
the repository is on GitHub or GitLab and has no lint job yet. With --from, the
template decides them. Change them afterwards with gspot set. init deletes the
tool files it replaces, and Git keeps the old copies. init installs no tools and
runs no checks: run gspot install next.

Options:
  --yes                        Write the plan without asking
  --from <template>            Start from a template: a path, an https URL, or
                               github:owner/repo[/path][@ref]
  --configurations <names...>  Use these configurations at the root instead of
                               the detected ones. Write none for no
                               configurations
  --dry-run                    Print the plan and write nothing
  --json                       Print the result as JSON. Needs --yes or
                               --dry-run
  -h, --help                   Print help for the command

Exit codes:
- 0: the plan was written, printed, or declined.
- 2: the input was invalid, or gspot init could not finish.

Example:
gspot init --dry-run

=================== gspot install --help
Usage: gspot install [options]

Install the tools gspot.toml needs: the npm and Python tools into .gspot/ at the
versions in its lockfiles, and the program tools with mise at the versions in
.gspot/mise.toml. Without mise, it installs the npm tools, and the Python tools
when uv is on PATH, and prints one line that names every program you must
install. It also turns the Git hooks on or off as gspot.toml says. A missing or
out-of-date lockfile is made first. Run it after init, after you clone a
repository that uses gspot, and when apply says the tools changed. If it fails,
fix the error it prints and run it again.

Options:
  --json      Print the result as JSON
  -h, --help  Print help for the command

Exit codes:
- 0: the tools are installed, or the missing programs are named.
- 2: the input was invalid, or gspot install could not finish.

Example:
gspot install

=================== gspot apply --help
Usage: gspot apply [options]

Add the configurations the repository now needs to gspot.toml, then write the
tool files, rules, Git hooks, and CI workflow from gspot.toml. A generated file
you edited stays as it is, and apply names it. apply installs no tools: run
gspot install after it.

Options:
  --dry-run   Print the changes, with each lint rule that turns on or off, and
              write nothing
  --json      Print the result as JSON
  -h, --help  Print help for the command

Exit codes:
- 0: the generated files were written, or the dry run finished.
- 2: the input was invalid, or gspot apply could not finish.

Example:
gspot apply --dry-run

=================== gspot check --help
Usage: gspot check [options] [paths...]

Run the checks and print each finding with its file, line, lint rule, and help.
Without paths or options, gspot checks every file in the working tree.

Arguments:
  paths                  Files or folders to check. Leave out to check the whole
                         repository

Options:
  --only <checks...>     Run only these checks, such as python/ruff
  --staged               Check only the staged files, as they are staged
  --changed              Check only the files changed since the upstream or
                         default branch
  --base <ref>           Use this branch, tag, or commit instead of the upstream
                         branch. Turns on --changed
  --fix                  Run the fixers, then run the checks again
  --dry-run              Print the changes the fixers would make, and write
                         nothing. Turns on --fix
  --hook <hook>          Run the checks of this Git hook, as the hook does. Put
                         the arguments Git passes after -- (choices:
                         "pre-commit", "pre-push")
  --message-file <path>  Check this commit message file, as the commit-msg hook
                         does
  --verbose              Print every finding, each command gspot runs, and each
                         ignore with its reason
  --json                 Print the report as JSON
  -h, --help             Print help for the command

Exit codes:
- 0: every check that ran passed. The report lists the skipped checks.
- 1: findings remain.
- 2: the run could not finish: a tool is missing, a fixer failed, a report is invalid, or the input is invalid.
- 130 or 143: the run was stopped (Ctrl-C or SIGTERM). The exitCode in the --json report is the same.

Example:
gspot check --staged

=================== gspot add --help
Usage: gspot add [options] <configuration...>

Select configurations in gspot.toml and write the generated files. The
configurations they need are selected too, but gspot.toml lists only the names
you give. Run gspot install next if they need new tools.

Arguments:
  configuration   Configuration names, such as pytest. gspot list shows them all

Options:
  --scope <path>  Select them in this scope only
  --json          Print the result as JSON
  -h, --help      Print help for the command

Exit codes:
- 0: the configurations were added.
- 2: the input was invalid, or gspot add could not finish.

Example:
gspot add pytest --scope services/api

=================== gspot remove --help
Usage: gspot remove [options] <configuration...>

Remove configurations from gspot.toml and write the generated files. gspot
remembers the removal, so detection does not select them again. gspot add undoes
it. gspot refuses to remove a configuration that another selected configuration
needs.

Arguments:
  configuration   Configuration names to remove

Options:
  --scope <path>  Remove them from this scope only
  --json          Print the result as JSON
  -h, --help      Print help for the command

Exit codes:
- 0: the configurations were removed, or none was selected.
- 2: the input was invalid, or gspot remove could not finish.

Example:
gspot remove nextjs --scope apps/web

=================== gspot set --help
Usage: gspot set [options] <setting> <values...>

Change one setting in gspot.toml and write the generated files. gspot checks the
value first. For a list, the values are added to it. For a table such as
tools.eslint.rules, give one TOML inline table, and its entries are added. A
command such as ci.setup_command is replaced whole. Record lists such as
[[command_check]] are written by hand. Run gspot install next if the change
needs new tools.

Arguments:
  setting          The setting name, such as limits.file_lines. gspot list
                   settings shows them all
  values           The new value, or the items or table entries to add

Options:
  --reason <text>  Why you change it. Needed when the change makes a check
                   weaker
  --scope <path>   Change the setting in this scope only
  --json           Print the result as JSON
  -h, --help       Print help for the command

Exit codes:
- 0: the setting was written and applied.
- 2: the input was invalid, or gspot set could not finish.

Example:
gspot set level all

=================== gspot unset --help
Usage: gspot unset [options] <setting> [items...]

Delete your value of a setting from gspot.toml and write the generated files.
The root value or the default applies again. With items, take only those items
out of a list, or only those entries out of a table such as tools.eslint.rules.
A setting with one value takes no items.

Arguments:
  setting         The setting name, such as naming.banned_words
  items           List items or table entry names to take out. Leave out to
                  delete your whole value

Options:
  --scope <path>  Change the setting in this scope only
  --json          Print the result as JSON
  -h, --help      Print help for the command

Exit codes:
- 0: the value was deleted and applied, or there was no value to delete.
- 2: the input was invalid, or gspot unset could not finish.

Example:
gspot unset level

=================== gspot ignore --help
Usage: gspot ignore [options] <check>

Turn off a check, or one of its lint rules, for some paths or everywhere. gspot
writes the ignore with your reason to gspot.toml and writes the generated files.
Each report counts the ignores, and gspot check --verbose prints them with their
reasons.

Arguments:
  check              The check to turn off, such as python/ruff

Options:
  --reason <text>    Why you ignore it (required)
  --rule <rule>      Turn off only this lint rule of the check
  --paths <glob...>  Turn it off only for these paths
  --until <date>     Stop ignoring it on this date, YYYY-MM-DD (UTC)
  --json             Print the result as JSON
  -h, --help         Print help for the command

Exit codes:
- 0: the ignore was written and applied.
- 2: the input was invalid, or gspot ignore could not finish.

Example:
gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."

=================== gspot unignore --help
Usage: gspot unignore [options] <check>

Stop ignoring a check: delete its ignores from gspot.toml and write the
generated files. With --rule, delete only the ignores of that lint rule. With
--paths, take those paths out of the ignores that list them, and delete an
ignore that has no path left. An ignore without paths covers every path: --paths
leaves it, and unignore says so.

Arguments:
  check              The ignored check, such as python/ruff

Options:
  --rule <rule>      Delete only the ignores of this lint rule
  --paths <glob...>  Take only these paths out of the ignores
  --json             Print the result as JSON
  -h, --help         Print help for the command

Exit codes:
- 0: the matching ignores were deleted or changed, or none matched.
- 2: the input was invalid, or gspot unignore could not finish.

Example:
gspot unignore javascript/eslint --rule no-console

=================== gspot list --help
Usage: gspot list [options] [what]

List the selected and available configurations, with the state of each check in
each scope. gspot list settings lists each setting, its value, and where the
value comes from. Long values are cut short, and --json prints them in full.
list changes nothing.

Arguments:
  what        What to list (choices: "configurations", "settings", default:
              "configurations")

Options:
  --json      Print the result as JSON
  -h, --help  Print help for the command

Exit codes:
- 0: the list was printed.
- 2: the input was invalid, or gspot list could not finish.

Example:
gspot list settings

=================== gspot explain --help
Usage: gspot explain [options] <subject>

Explain a check, a lint rule, a configuration, a setting, or a file: what it is,
its state in this repository, and the commands that change it. explain changes
nothing.

Arguments:
  subject     A check (python/ruff), lint rule (eslint/no-console),
              configuration (python), setting (limits.file_lines), or file
              (./src/app.ts)

Options:
  --json      Print the result as JSON
  -h, --help  Print help for the command

Exit codes:
- 0: the explanation was printed.
- 2: the subject is unknown, or the input was invalid.

Example:
gspot explain python/ruff

=================== gspot doctor --help
Usage: gspot doctor [options]

Report the tools, Git hooks, CI workflow, rules, and gspot version. Suggest
configurations to add or remove and tool files to delete. List the lint jobs you
already run and the submodules gspot does not read. doctor changes nothing. Each
line that needs work shows the command that fixes it.

Options:
  --json      Print the result as JSON
  -h, --help  Print help for the command

Exit codes:
- 0: the selected tools and hooks are ready.
- 1: a selected tool is missing, invalid, newer, or outdated, or a hook is not ready.
- 2: gspot doctor could not finish.

Example:
gspot doctor

=================== gspot export --help
Usage: gspot export [options] <file>

Write gspot.toml as a template that other repositories can start from with gspot
init --from. The template leaves out scopes. If a command check runs a script
from this repository, copy the script too. gspot.toml does not change.

Arguments:
  file        The template file to write, such as gspot.template.toml

Options:
  --json      Print the result as JSON
  -h, --help  Print help for the command

Exit codes:
- 0: the template was written.
- 2: the input was invalid, or gspot export could not finish.

Example:
gspot export gspot.template.toml
```

## Old and new command lines

Docs, messages, hook scripts, and tests change these lines (CLX-014).

| Action                              | Old                                                                                   | New                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Take items out of a list            | `gspot set naming.banned foo --remove`                                                | `gspot unset naming.banned_words foo`                                                                |
| Go back to the default              | `gspot set level --default`                                                           | `gspot unset level`                                                                                  |
| Replace a whole list                | `gspot set naming.banned a b --replace`                                               | `gspot unset naming.banned_words`, then `gspot set naming.banned_words a b`                          |
| Take one lint rule's options out    | none: `gspot set tools.eslint.rules --default` deletes the options of every lint rule | `gspot unset tools.eslint.rules no-console`                                                          |
| Stop ignoring a check               | `gspot ignore <check> --remove`                                                       | `gspot unignore <check>`                                                                             |
| Set up a repository                 | `gspot init` (asks four questions, installs)                                          | `gspot init`, then `gspot install`                                                                   |
| Choose hooks, CI, and rules at init | a question or a flag                                                                  | the plan shows what init turns on; `gspot set` changes it                                            |
| Turn CI on                          | `gspot init --ci github`, or `gspot set ci.provider github`                           | `gspot set ci.enabled true` (it writes the workflow; for GitLab also `gspot set ci.provider gitlab`) |
| Get JSON                            | `gspot --json doctor`                                                                 | `gspot doctor --json`                                                                                |
| Run gspot in a subfolder            | `gspot -C api check`                                                                  | `cd api && gspot check`                                                                              |
| Check a commit message              | `gspot check --hook commit-msg --message-file F`                                      | `gspot check --message-file F`                                                                       |
| Show what the fixers change         | `gspot check --fix --dry-run`                                                         | `gspot check --dry-run` (or with `--fix`)                                                            |
| Try a setting first                 | `gspot set X v --dry-run`                                                             | `gspot set X v`; `gspot unset X` undoes it                                                           |
| Undo a removal record by hand       | `gspot set removed_configurations ...`                                                | `gspot add <name>`                                                                                   |

## Layout

Every command lives in `commands/<name>.ts` or `commands/<name>/command.ts` (CMD-003, CMD-056, CMD-058, S03-015).

```text
packages/cli/src/
  main.ts                       calls main() and sets the exit code
  commands/
    program.ts                  buildProgram, main, printFailure, commandHelp (today src/public.ts)
    session.ts                  openSession, scopeSelections
    save-settings.ts            saveSettings, reportText, startSettingsEdit, refuseAlwaysSelected
    reconcile.ts                reconcileConfigurations and its helpers
    apply.ts  install.ts  export.ts
    add.ts  remove.ts  set.ts  unset.ts  ignore.ts  unignore.ts  list.ts
    check/    command.ts  push.ts  tree.ts
    doctor/   command.ts  suggestions.ts
    explain/  command.ts  check.ts
    init/     command.ts  write.ts  settings-text.ts  replace.ts  format.ts  selection.ts  detection.ts  plan.ts
  terminal/   print.ts  check-report.ts
  config/
    commands/ doctor.ts  explain.ts  help.ts  init.ts  list.ts  set.ts
    configurations.ts  planning.ts  rules.ts  terminal.ts
  types/
    commands/ check.ts  doctor.ts  explain.ts  export.ts  init.ts  list.ts  save-settings.ts
    configurations.ts  install.ts  planning.ts  rules.ts  terminal.ts
```
