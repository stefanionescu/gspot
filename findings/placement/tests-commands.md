# Tests: commands, configurations, rules

704 rows. keep 283, delete 228, move 142, inline 25, split 16, merge 10.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/agent-rules/assemble.test.ts`

- (the file) (file): **move** to `tests/unit/cli/rules.test.ts`. TCM-032; agent-rules/ merges into src/rules.ts (glossary "rules"); RUNTIME_RULE_CASES moves in; about 175 lines after TCM-007 and TCM-045
- \[agent_rules\] exclude (describe (describe), 19-38): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `[rules] exclude`. POL-052: excludeErrors moves to settings/errors/keys.ts; glossary: \[agent_rules\] becomes \[rules\]; rules.exclude entries are written as AGENTS.md lists the rules, from the repository root (.gspot/rules/...) (TMF-008)
- \[agent_rules\] exclude &gt; a file path and a category folder are accepted (test (test), 20-22): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `a file path and a category folder are accepted`. POL-052; the accepted entries are .gspot/rules/general/engineering/code/ACCESSIBILITY.md and .gspot/rules/library (TMF-008)
- \[agent_rules\] exclude &gt; an entry that matches no rule file names the near match (test (test), 24-29): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `an entry that matches no rule file names the near match`. POL-052; the entry and the near match are written from the repository root (.gspot/rules/general/engineering/code/ACCESIBILITY.md) (TMF-008)
- \[agent_rules\] exclude &gt; the required first-read entry %s cannot be left out (test (test.each), 31-37): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `a first-read entry %s cannot be left out`. POL-052; keep one file entry and one folder entry, since every row takes the same branch; each first-read entry is written with the .gspot/rules/ prefix (TMF-008)
- \[agent_rules\] exclude &gt; \[...FIRST_READ, 'general/engineering/agent', 'general/prose'\] (test (test.each), 31-31): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `a first-read entry %s cannot be left out`. table of the test above; one file entry and one folder entry
- level filtering respects fenced examples, nested sections, and the next peer heading (test (test), 40-49): **keep** to `tests/unit/cli/rules.test.ts` `level filtering respects fenced examples, nested sections, and the next heading of the same depth`. real (TCM); tests textAtLevel
- $runtime guidance with $dependency in $scope preserves native rules at $level (test (test.each), 51-85): **keep** to `tests/unit/cli/rules.test.ts` `$runtime rules with $dependency in $scope select DENO.md and NODE.md`. real; TGN-037: drop the level loop (no assertion depends on it); the parsed table is policy.rules (TML-003); the sample writes a \[\[scope\]\] record with path = "app"
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; \['', 'app'\].flatMap((scope) =&gt; RUNTIME_RULE_CASES.map((row) (test (test.each), 51-55): **keep** to `tests/unit/cli/rules.test.ts` `$runtime rules with $dependency in $scope select DENO.md and NODE.md`. table of the test above; scopes x RUNTIME_RULE_CASES, no level loop (TGN-037); the react-native and expo rows hit the same NODE.md exclusion, so one of them stays
- $dependency dependency selects component guidance at $level (test (test.each), 87-111): **delete**. weak: pins sentences of the shipped COMPONENTS.md and repeats one dependency condition five times; dependency-driven rule selection stays tested by generation/guides.test.ts 'conditional guides follow file and dependency evidence'
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; \['astro', 'svelte', 'vue', 'react', 'unrelated'\].map((depen (test (test.each), 87-91): **delete**. weak: table of the deleted component test
- renamed library guidance retains its native contents and removes the former filenames (test (test), 113-131): **delete**. TCM-007: checks that old rule file names stay gone (self-policing)
- shortened guidance installs at $level in $name (describe (describe.each), 133-182): **delete**. TCM-007: the describe.each over levels and scopes goes; its TALKING.md check stays as one plain test
- shortened guidance installs at $level in $name &gt; (\['recommended', 'all'\] as const).flatMap((level) =&gt; \['', 'app'\].map((scope) =&gt; ({ level, scope, name: scope || (describe (describe.each), 133-137): **delete**. TCM-007; table of the describe above
- shortened guidance installs at $level in $name &gt; TALKING and level filtering retain their original content (test (test), 165-174): **delete**. weak: compares installed rule text with the shipped files and pins sentences (TCM-007); TALKING.md selection stays tested by the runtime test and the always-selected test, level filtering by 'level filtering respects fenced examples' and generation/guides.test.ts
- shortened guidance installs at $level in $name &gt; %s omits the checked instruction %s (test (test.each), 175-178): **delete**. TCM-007: polices the wording of shipped rule files
- shortened guidance installs at $level in $name &gt; CHECKED_RULE_LINES (test (test.each), 175-175): **delete**. TCM-007; table of the deleted test
- shortened guidance installs at $level in $name &gt; %s retains the primary reference %s (test (test.each), 179-181): **delete**. TCM-007: polices the URLs in shipped rule files
- shortened guidance installs at $level in $name &gt; UPSTREAM_GUIDES (test (test.each), 179-179): **delete**. TCM-007; table of the deleted test
- always-selected instructions use manifest metadata at %s (test (test.each), 184-217): **keep** to `tests/unit/cli/rules.test.ts` `an always-selected configuration installs its rule file once`. TCM-045: do not change the shared manifest cache, use the always-selected engineering configuration; TGN-037: drop the level loop; the parsed table is policy.rules (TML-003)
- \['recommended', 'all'\] as const (test (test.each), 184-184): **delete**. TGN-037: the level table goes; the test runs once

## `tests/cli/agent-rules/instructions.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/rules.test.ts`. TCM-032; tests managedBlock, which joins src/rules.ts; joins assemble.test.ts
- the managed block (describe (describe), 23-47): **keep** to `tests/unit/cli/rules.test.ts` `the managed block`. real
- the managed block &gt; an empty manual language list retains general check instructions (test (test), 24-31): **keep** to `tests/unit/cli/rules.test.ts` `with no configurations the block still lists the general rules and the check command`. real; the sample uses settingsText(\[\], { rules: true }), since the helper keeps the rules option
- the managed block &gt; with a check selected it names the command, and an excluded file leaves the index (test (test), 33-46): **keep** to `tests/unit/cli/rules.test.ts` `with a check selected the block names the command, and an excluded file leaves the index`. real; the sample writes \[rules\] exclude = \[".gspot/rules/general/engineering/code/ACCESSIBILITY.md"\] (TML-003, TMF-008) through settingsText(\['spelling'\], { rules: true, tables: '\[rules\] exclude = \[...\]' }), so the helper writes one \[rules\] table
- blockFor (function, 11-21): **move** to `tests/unit/cli/rules.test.ts` `blockFor`. test helper used by both block tests; it reads policy.rules (TML-003)

## `tests/cli/commands/agents.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/files.test.ts`. gspot never touches CLAUDE.md, so the CLAUDE.md tests go; the block test joins the test of emitAll in generation/files.ts (TCM-012, TCM-032); the outside-path test repeats a schema test
- agent rules reach AGENTS.md and configured files, and other agent files stay as written (test (test), 16-54): **keep** to `tests/unit/cli/generation/files.test.ts` `the managed block reaches AGENTS.md and the instruction files, and a second apply leaves AGENTS.md alone`. TCM-012: delete the .cursor, Copilot and GEMINI.md parts (removed features); gspot.toml loses the CodeQL ignore for this file; the command is gspot set rules.instruction_files TEAM.md (TML-003)
- an agent destination outside the repository is refused (test (test), 56-64): **delete**. repeats the relative-path refusal of tests/cli/parsers/setting-values.test.ts:113; set refusals that leave gspot.toml unchanged are tested in set.test.ts
- init deletes CLAUDE.md and moves its text to the end of AGENTS.md (test (test), 66-86): **delete**. gspot never touches CLAUDE.md
- disabled agent rules preserve authored instructions during init, preview, and later apply (test (test), 88-107): **delete**. gspot never touches CLAUDE.md
- apply moves an installed CLAUDE.md once and drops the copy of the block (test (test), 109-127): **delete**. gspot never touches CLAUDE.md
- init deletes a CLAUDE.md link and moves nothing (test (test.skipIf), 129-137): **delete**. gspot never touches CLAUDE.md
- !isPosix (test (test.skipIf), 129-129): **delete**. TCM-024: the Windows skip is not needed; directory links pass on Windows CI
- INIT (const, 14-14): **delete**. gspot never touches CLAUDE.md; only the deleted CLAUDE.md tests use it

## `tests/cli/commands/apply.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/apply.test.ts`. unit test of commands/apply.ts; gains the reason-error test of check/policy-errors.test.ts
- apply preserves a policy replaced after session opening and publishes no generated files (test (test), 22-58): **delete**. TCM-027, CMD-022: apply reads gspot.toml once, so the guard, this spy test and its eslint-disable go
- init deletes a replaced file, and apply exits 2 while preserving later edits and unowned content (test (test), 60-80): **keep** to `tests/unit/cli/commands/apply.test.ts` `init deletes a replaced file, and apply exits 2 and keeps later edits and files gspot did not write`. real
- a generated plan cannot write into the lifecycle state folder (test (test), 82-96): **keep** to `tests/unit/cli/commands/apply.test.ts` `a generated file cannot go into .gspot/state`. real; TCM-030 rewrites the message; rules.folder is deleted (TML-003), so the sample reaches the state-folder refusal through \[rules\] instruction_files = \[".gspot/state/notes/AGENTS.md"\], the one written path a user still chooses
- apply previews missing outputs without writing (test (test), 98-118): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply --dry-run lists missing generated files and writes nothing`. real; glossary: dry run
- apply previews only a changed version pin (changed: %s) without writing (test (test.each), 120-148): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply --dry-run shows only a changed version pin (changed: %s) and writes nothing`. real
- \[false, true\] (test (test.each), 120-120): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply --dry-run shows only a changed version pin (changed: %s) and writes nothing`. table of the test above
- malformed authored blocks refuse apply before generated files change (test (test), 150-163): **keep** to `tests/unit/cli/commands/apply.test.ts` `a broken managed block stops apply before generated files change`. real
- apply refuses a writer claim %s and names it (test (test.each), 166-191): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply refuses a writer lock %s and names it`. real; process 1 is the only test of the EPERM branch, so it stays; glossary: writer lock
- \[ \['empty', ''\], \['held by a live process', undefined\], ...(process.platform === 'win32' ? \[\] : \[\['held by p (test (test.each), 166-170): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply refuses a writer lock %s and names it`. table of the test above; the Windows filter stays
- apply --json prints one error object when it refuses an edited generated file (test (test), 193-213): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply --json prints one error object when it refuses an edited generated file`. real
- apply refuses to move a generated file to a spelling that differs only by letter case (test (test), 215-233): **delete**. rules.folder is deleted (TML-003), so the rule files have one fixed path and this sample cannot rename them by case
- apply --dry-run reports a changed file, a stray, a conflict, and an edited block, and writes nothing (test (test), 235-275): **keep** to `tests/unit/cli/commands/apply.test.ts` `apply --dry-run reports a changed file, a stray, a conflict, and an edited block, and writes nothing`. real
- INIT (const, 20-20): **inline** to `tests/unit/cli/commands/apply.test.ts` `init deletes a replaced file, and apply exits 2 and keeps later edits and files gspot did not write`. one user

## `tests/cli/commands/check/arguments.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/tree/arguments.test.ts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; TCM-032: tests narrowing by paths, --only, --staged and --hook; check/arguments.ts merges into check/tree.ts (CMD-055); joined by the fix feedback test
- file and folder arguments intersect check lists, and --skip leaves the other checks (test (test), 32-69): **keep** to `tests/unit/cli/commands/check/tree/arguments.test.ts` `file and folder arguments narrow the files each check gets`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; CMD-092 deletes --skip, so its half goes
- a program option ends a list option, so the path after it stays a file argument (test (test), 71-78): **delete**. fake: it tests commander, a third-party library: --only is a plain variadic option (commands/check/command.ts:177), and commander ends it at the next option; gspot has no code here
- -C resolves file arguments from the folder it names (test (test), 80-110): **delete**. CMD-092 deletes -C
- --staged keeps default stages while --hook pre-commit selects commit checks (test (test), 112-156): **keep** to `tests/unit/cli/commands/check/tree/arguments.test.ts` `--staged keeps every stage while --hook pre-commit runs only commit checks`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; TCM-005: delete the GSPOT_HOOK environment line; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- a manual check runs only when --only names it (test (test), 158-179): **keep** to `tests/unit/cli/commands/check/tree/arguments.test.ts` `a manual check runs only when --only names it`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; TCM-047: drop the exit code and missing assertions; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- a scope path selects its checks and its reproduction command repeats the same findings (test (test), 181-206): **keep** to `tests/unit/cli/commands/check/tree/arguments.test.ts` `a scope path narrows to its checks and its reproduce command finds the same findings`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; the sample writes \[\[scope\]\] records with path = "api" and "web"
- a staged change to only gspot.toml rechecks every file a configuration check owns (test (test), 208-226): **keep** to `tests/unit/cli/commands/check/tree/arguments.test.ts` `a staged change to gspot.toml alone rechecks every file a configuration check covers`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; glossary: covers
- selectionSandbox (function, 15-30): **inline** to `tests/unit/cli/commands/check/tree/arguments.test.ts` `file and folder arguments narrow the files each check gets`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; CMD-050 retires "selection" for narrowing; its other two callers are deleted (-C and the variadic-option test), so one caller is left and it is inlined

## `tests/cli/commands/check/cancellation.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/command/cancellation.test.ts`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; Ctrl-C handling is in commands/check/command.ts (runCancelable); joins the check refusal tests; its data goes to tests/config/check.ts, except the four-word SLOW_CHECK
- check propagates %s to an active tool and reports cancellation (test (test.skipIf), 13-36): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `check passes %s to a running tool and reports the run as canceled`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; real; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- \['SIGINT', 'SIGTERM'\] as const (test (test.skipIf), 13-13): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `check passes %s to a running tool and reports the run as canceled`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above
- !isPosix (test (test.skipIf), 13-13): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `check passes %s to a running tool and reports the run as canceled`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; TCM-024: this skip is needed (Windows has no POSIX signals)

## `tests/cli/commands/check/changed.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/tree/changed.test.ts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; tests --changed narrowing (changedSet in check/tree.ts and repository/revisions/changes.ts); the check tree tests split by behavior to stay under 300 lines
- changed selection uses a merge base, labels its source, and keeps a following folder positional (test (test), 17-62): **keep** to `tests/unit/cli/commands/check/tree/changed.test.ts` `--changed compares with the merge base, names its base, and a folder argument stays a path`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; --base stays with --changed: the test keeps --changed --base base and the folder argument after it
- changed selection names the missing comparison and labels the remote default (test (test), 64-82): **keep** to `tests/unit/cli/commands/check/tree/changed.test.ts` `--changed without an upstream names the fix, and uses the remote default branch`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; the message keeps 'use --changed --base &lt;ref&gt;'
- %s reports a setup error outside Git (test (test.each), 84-95): **move** to `tests/unit/cli/commands/check/command/refusals.test.ts` `%s outside Git reports a setup error`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; the refusal is in commands/check/command.ts
- \['--changed', '--staged', '--hook'\] (test (test.each), 84-84): **move** to `tests/unit/cli/commands/check/command/refusals.test.ts` `%s outside Git reports a setup error`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above
- a shallow comparison failure explains how to fetch the missing history (test (test), 97-118): **keep** to `tests/unit/cli/commands/check/tree/changed.test.ts` `a shallow clone explains how to fetch the missing history`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; it keeps --changed --base &lt;commit&gt;
- policy (const, 12-15): **move** to `tests/unit/cli/commands/check/tree/changed.test.ts` `GSPOT_TOML`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; glossary: "policy" is retired in code; the outside-Git test in command/refusals.test.ts writes its own gspot.toml; the settings object writes command_check: \[{ name: "sandbox/paths", ... }\]

## `tests/cli/commands/check/copies.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/tree/staged.test.ts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; TCM-032 (it tests --staged); TEL-015 adds the staged CLI tests of tests/cli/execution/copy here
- index snapshots preserve binary bytes and executable modes without applying checkout conversion or writing source outputs (test (test), 17-54): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `a staged check reads index bytes and file modes, converts no line endings, and writes nothing into the working tree`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; glossary: scratch copy; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- index checks copy matching locked dependencies and preserve authored files (test (test), 56-98): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `a staged check copies the locked dependencies and leaves the working tree as it was`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- staged Python drift keeps the verified project environments at %s (test (test.each), 100-139): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `a staged check keeps the matching Python tool environments and refuses unstaged project changes`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; TGN-037: drop the level loop; glossary: gspot/drift becomes gspot/generated-files; the sample writes a \[\[scope\]\] record with path = "child"
- \['recommended', 'all'\] as const (test (test.each), 100-100): **delete**. TGN-037: the level table goes

## `tests/cli/commands/check/feedback.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/tree/fixes.test.ts`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; reportFixes is in commands/check/tree.ts; its data goes to tests/config/check.ts, except the one-line DETECTED_SOURCE
- check correction feedback names $name and preserves preview bytes (test (test.each), 10-59): **keep** to `tests/unit/cli/commands/check/tree/fixes.test.ts` `check --fix reports $name, and --dry-run writes nothing`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; real; glossary: fix, dry run; the settings object writes a \[\[command_check\]\] record with name; --dry-run turns on --fix, so --fix is optional (CLX-007)
- FIXER_FEEDBACK_CASES (test (test.each), 10-10): **keep** to `tests/unit/cli/commands/check/tree/fixes.test.ts` `check --fix reports $name, and --dry-run writes nothing`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; table of the test above

## `tests/cli/commands/check/policy-errors.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/apply.test.ts; tests/unit/cli/checks/built-in.test.ts`. EXG-003 makes it one entry of BUILT_IN_CHECKS in checks/built-in.ts; two tests repeat settings-reader tests; the reason-error test goes to the apply test; the gspot/settings test goes to the test of checks/general/gspot/settings.ts (CKG-028 folder, EXG-003)
- unknown configurations in the $scope scope identify their declaration (test (test.each), 14-29): **delete**. repeats tests/cli/policy/read/recovery.test.ts "unknown configurations ... declaration order" (root and scope key paths)
- \[ { scope: 'root', policy: buildPolicy(\['bas'\]), where: 'configurations.0' }, { scope: 'nested', (test (test.each), 14-21): **delete**. table of the deleted test
- configuration errors name the key path in text and JSON with %j lines (test (test.each), 31-44): **delete**. repeats tests/cli/policy/key-paths.test.ts (schema errors name the key path; LF and CRLF) and the JSON error shape of the reason-error test
- \['\\n', '\\r\\n'\] (test (test.each), 31-31): **delete**. table of the deleted test
- a malformed reason reports a policy error and apply preserves the authored policy (test (test), 46-61): **keep** to `tests/unit/cli/commands/apply.test.ts` `a malformed reason is a settings error: check reports it and apply writes nothing`. real; glossary: settings; \[reasons\] is deleted (CFR-002), so the malformed reason is written file_lines = { value = 1000, reason = 42 } in \[limits\], and the error names limits.file_lines.reason
- %s declares gspot/policy once and retains ordinary and message-stage error behavior (test (test.each), 63-94): **keep** to `tests/unit/cli/checks/built-in.test.ts` `gspot/settings reports gspot.toml errors as findings at every stage but message`. EXG-003 makes it one entry of BUILT_IN_CHECKS in checks/built-in.ts; EXG-003: gspot/settings becomes a built-in check, so a valid gspot.toml lists it as passed; TGN-037: drop the level loop; glossary: gspot/policy becomes gspot/settings
- \['recommended', 'all'\] as const (test (test.each), 63-63): **delete**. TGN-037: the level table goes

## `tests/cli/commands/check/pre-push.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/push.test.ts`. tests checkPush (commands/check/push.ts); TEL-015 adds the push CLI tests of tests/cli/execution/copy here
- missing %s objects fail selection without touching the working tree (test (test.each), 11-30): **keep** to `tests/unit/cli/commands/check/push.test.ts` `missing %s objects stop a pre-push check and leave the working tree as it was`. real
- \['local', 'remote'\] as const (test (test.each), 11-11): **keep** to `tests/unit/cli/commands/check/push.test.ts` `missing %s objects stop a pre-push check and leave the working tree as it was`. table of the test above

## `tests/cli/commands/check/refusals.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/command/refusals.test.ts`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; TCM-032: refusals of the check command (commands/check/command.ts); its data goes to tests/config/check.ts
- check %p exits 2 and leaves the working tree as it was (test (test.each), 33-40): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `check %p exits 2 and leaves the working tree as it was`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; real
- FIX_REFUSALS (test (test.each), 33-33): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `check %p exits 2 and leaves the working tree as it was`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above; check --dry-run turns on --fix, so the '--dry-run requires --fix.' row goes (CLX-007)
- a push hook given $name exits 2 and leaves the working tree as it was (test (test.each), 42-59): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `a pre-push check given $name exits 2 and leaves the working tree as it was`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; TCM-002: gspot reports bad bytes with its own error and the two UTF-8 rows merge; TCM-006: delete the process.stdin lines
- \[...PUSH_INPUT_REFUSALS\] (test (test.each), 42-42): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `a pre-push check given $name exits 2 and leaves the working tree as it was`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above
- a staged check during a merge conflict exits 2 with the conflict named and leaves no snapshot (test (test), 61-80): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `a staged check during a merge conflict exits 2, names the conflict, and leaves no scratch copy`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; real; glossary: scratch copy
- a staged check over a file name that is not UTF-8 exits 2 and leaves no snapshot (test (test), 82-107): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `a staged check over a file name that is not UTF-8 exits 2 and leaves no scratch copy`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; real; IGN-002: split the semicolon comment
- check with %s exits 2 and names the problem (test (test.each), 109-114): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `check with %s exits 2 and names the problem`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; real
- SELECTION_REFUSALS (test (test.each), 109-109): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `check with %s exits 2 and names the problem`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above; rename SELECTION_REFUSALS to ARGUMENT_REFUSALS (CMD-050)
- a pre-push hook reports $name in human and JSON output (test (test.each), 116-144): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `a pre-push check reports $name in text and in JSON`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; real
- PUSH_ARGUMENT_REFUSALS (test (test.each), 116-116): **keep** to `tests/unit/cli/commands/check/command/refusals.test.ts` `a pre-push check reports $name in text and in JSON`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above; both rows hit the one 'exactly two remote arguments' branch, so one row stays
- fixableSandbox (function, 21-31): **move** to `tests/unit/cli/commands/check/command/refusals.test.ts` `fixableSandbox`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; used by five tests of the same file; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"

## `tests/cli/commands/check/verbosity.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/check/command/verbosity.test.ts`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; tests the --verbose flag of check (CMD-092 moves --verbose to check); its data goes to tests/config/check.ts
- check uses $name consistently and preserves full JSON (test (test.each), 11-54): **keep** to `tests/unit/cli/commands/check/command/verbosity.test.ts` `check --verbose prints every finding and command while --json keeps every finding`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; --base HEAD stays; CMD-092 deletes --quiet, so the normal and verbose rows stay; --json and --verbose are options of check, so the flags follow the command (\[...VERBOSITY_ARGS, ...flags\] and \[...VERBOSITY_ARGS, "--json", ...flags\]) (CLX-005); the settings object writes \[\[command_check\]\] records
- \[...VERBOSITY_CASES\] (test (test.each), 11-11): **keep** to `tests/unit/cli/commands/check/command/verbosity.test.ts` `check --verbose prints every finding and command while --json keeps every finding`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; table of the test above; two rows left (normal, verbose)

## `tests/cli/commands/ci.test.ts`

- (the file) (file): **delete**. TCM-019: rows 2 and 3 repeat the CI test of init/questions; row 1 joins CI_PREFERENCE_CASES
- init plan for %s names retained jobs and the applicable workflow (test (test.each), 11-51): **merge** to `tests/unit/cli/commands/init/settings-text.test.ts` `init proposes the CI provider from %s`. TCM-019: row 1 becomes the CI_PREFERENCE_CASES row "a GitHub workflow before a GitLab remote"; planCi becomes proposeCi in commands/init/settings-text.ts (CLX-001), so the CI proposal rows sit in its test
- \[ \[ '.github/workflows/application.yml', 'on: push\\njobs:\\n application:\\n runs-on: ubuntu-24.04 (test (test.each), 11-33): **merge** to `tests/unit/cli/commands/init/settings-text.test.ts` `init proposes the CI provider from %s`. TCM-019; table of the test above; it follows the CI proposal test

## `tests/cli/commands/doctor.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/doctor/command.test.ts`. unit test of commands/doctor/command.ts (doctorCommand); about 270 lines after TGN-037, TCO-012
- doctor lists a tool only on the systems it has a build for (test (test), 25-36): **delete**. weak: asserts plutil only on a macOS host and only absence elsewhere, so the result depends on the machine
- doctor identifies unowned generated-directory files that apply preserves (test (test), 38-56): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor lists files in .gspot/ that gspot did not write, and apply leaves them`. real
- doctor reports authored Python and submodules without treating tool manifests as source (test (test), 58-87): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor reports Python and submodules and does not treat tool projects as source`. real
- doctor reports a new Python file after setup with the command that adds its configuration (test (test), 89-104): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor suggests the command that adds the configuration of a new Python file`. real; the command stays gspot add python
- doctor reports the private Python project for an applicable duplicate without claiming a mise output (test (test), 106-125): **delete**. duplicate-pin detection ("pinned twice", duplicateMisePins) is deleted (INX-007), and gspot does not write .mise/conf.d/gspot-tools.toml (INX-001)
- doctor exits by the installed library state %s: an outdated tool exits 1 (test (test.each), 127-169): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor exit code follows the library state %s: an outdated tool exits 1`. a fixed made-up pin and literal versions
- \['ok', 'newer', 'outdated'\] as const (test (test.each), 127-127): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor exit code follows the library state %s: an outdated tool exits 1`. table of the test above
- doctor detects installed test frameworks instead of suggesting a different runner (test (test), 171-192): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor detects installed test frameworks and suggests no other runner`. real
- doctor names an absent coverage plugin at %s and omits it when all floors are zero (test (test.each), 194-241): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor names a missing coverage plugin and leaves it out when every coverage limit is zero`. TGN-037: drop the level loop; \[reasons\] is deleted (CFR-002), so each lowered minimum is written in the reason form, such as lines = { value = 0, reason = "..." } in \[coverage\]
- \['recommended', 'all'\] as const (test (test.each), 194-194): **delete**. TGN-037: the level table goes
- doctor suggests scoped removals at %s after evidence disappears without changing saved choices (test (test.each), 243-281): **keep** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor suggests a remove command per scope after detection evidence goes, and changes nothing`. the command stays gspot remove (CMD-047); TGN-037: drop the level loop; TCO-012: drop the readTree snapshot; the sample writes \[\[scope\]\] records with path = "api app" and "api app/deep"
- \['recommended', 'all'\] as const (test (test.each), 243-243): **delete**. TGN-037: the level table goes

## `tests/cli/commands/explain/command.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/explain/check.test.ts`. TCM-032: tests explainToolRule and explainCheck (explain/contracts.ts becomes explain/check.ts)
- a rule is explained with the page its manifest declares (test (test), 8-29): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `a rule is explained with the page its manifest declares`. real
- a plugin rule is explained with the page of the plugin whose prefix it carries (test (test), 31-39): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `a plugin rule is explained with the page of the plugin its prefix names`. real
- raw plugin rule %s resolves its declared documentation (test (test.each), 41-50): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `a plugin rule without the eslint/ prefix finds its page: %s`. real
- \[ \['gspot/no-trivial-functions', '<https://generativespotting.com/reference/plugin/no-trivial-functions/'\>], \['@ty (test (test.each), 41-48): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `a plugin rule without the eslint/ prefix finds its page: %s`. table of the test above; the gspot rule page is <https://generativespotting.com/reference/eslint-plugin/no-trivial-functions/> (DCP-015)
- check explanations add no absent metadata (test (test), 52-56): **delete**. weak (only asserts that one optional field, path_prefix, is absent); explaining a check stays tested by explain/selection.test.ts 'configuration and check explanations still resolve without a policy' and 'native version prerequisites belong to their consuming check'
- native version prerequisites belong to their consuming check (test (test), 58-65): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `a version floor belongs to the check that needs it`. real; the title drops "native"
- an unknown raw rule namespace is refused with the requested subject (test (test), 67-73): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `an unknown rule prefix is refused and names the subject`. real
- TypeScript errors have no invented rule options or error-page link (test (test), 75-85): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `TypeScript errors have no rule options and no page link`. real
- declared native rule pages need no tool executable or summary process (test (test), 87-104): **delete**. self-policing (guards the removed summary feature: the runBlocking spy, summary: null and 'The tool says:'; TCM-013); its page and ignore-command lines repeat 'a rule is explained with the page its manifest declares' and 'declared rule pages remain available in root and child'
- native scoped plugin prefixes are exact manifest declarations (test (test), 106-116): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `a plugin prefix with an npm scope must match a manifest declaration`. real
- declared rule pages remain available in root and child at %s (test (test.each), 118-139): **keep** to `tests/unit/cli/commands/explain/check.test.ts` `rule pages work in the root and in a child scope`. TGN-037: drop the level loop; the sample writes a \[\[scope\]\] record with path = "app"
- \['recommended', 'all'\] (test (test.each), 118-118): **delete**. TGN-037: the level table goes

## `tests/cli/commands/explain/selection.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/explain/command.test.ts`. TCM-032: tests explain for settings, paths and names (explain/public.ts becomes explain/command.ts); its data goes to tests/config/explain.ts
- explain (describe (describe), 166-183): **delete**. TPP-028: the describe wrapper goes; its tests stay with their bodies inline
- explain &gt; setting explanations include nested-only settings and each inherited value (test (test), 167-167): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `a setting explanation lists settings set only in scopes and each inherited value`. real; TPP-028: body inline
- explain &gt; path explanations include enabled repository commands and global exceptions (test (test), 169-169): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `a path explanation lists the command checks and the ignores that apply`. real; TPP-028: body inline
- explain &gt; a recognized name keeps its meaning, and a tracked or explicit path selects a colliding file (test (test), 171-174): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `a configuration name stays a name, and a tracked or ./ path explains the file`. real; TPP-028: body inline
- explain &gt; a file path reports its scope, checks, and recorded ignores (test (test), 176-176): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `a file path reports its scope, checks, and ignores`. real; TPP-028: body inline
- explain &gt; a missing explicit path fails (test (test), 178-178): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `a missing ./ path fails`. real; TPP-028: body inline
- explain &gt; an unknown explanation subject uses the command error contract (test (test), 180-180): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `an unknown subject gets the command error`. real; TPP-028: body inline
- explain &gt; configuration and check explanations still resolve without a policy (test (test), 182-182): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `configuration and check explanations work without gspot.toml`. real; TPP-028: body inline
- explain recognizes the top-level setting %s (test (test.each), 185-200): **delete**. weak (only exit code 0 and the echoed key; eight rows of one branch; TCM-048)
- \[ 'level', 'removed_configurations', 'tool_timeout_seconds', 'runner', 'generated', 'vendored', (test (test.each), 185-194): **delete**. weak (table of the deleted top-level setting test, TCM-048)
- explain reads selected native Taplo options and their inherited scope reason without writes (test (test), 202-221): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `explain reads extra Taplo options and their inherited reason, and writes nothing`. TCM-004: delete the .gspot/installed.toml line; glossary: tools.&lt;tool&gt;.extra replaces verbatim; no \[reasons\] (CFR-002): the sample writes \[tools.taplo.extra\] with value = { compact_inline_tables = true } and reason, and explain reads tools.taplo.extra and its reason; the sample writes a \[\[scope\]\] record with path = "app"
- explain $key uses each current value for its reason obligation (test (test.each), 223-264): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `explain $key shows each scope value and whether it needs a reason`. TCM-004: delete the .gspot/installed.toml line; no \[reasons\] (CFR-002): each value is written { value = ..., reason = "..." } where a reason is owed, the text names the reason form, and the reason on record comes from that form; the sample writes a \[\[scope\]\] record with path = "app" and dotted keys
- REASON_VALUES (test (test.each), 223-223): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `explain $key shows each scope value and whether it needs a reason`. table of the test above
- $level neutral $key remains settable without direction or a reason (test (test.each), 266-289): **keep** to `tests/unit/cli/commands/explain/command.test.ts` `a setting with no direction is set without a reason: $key`. TGN-037: drop the level loop; TCM-004: delete the .gspot/installed.toml line; tools.v8r.schemas is \[\[tools.v8r.schema\]\] records at the root, not a value set per scope, so its row goes; one row (format.indent_style) is left, so a plain test
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; NEUTRAL_SETTING_VALUES.map((row) =&gt; ({ ...row, level }))) (test (test.each), 266-268): **delete**. one row is left, so the test needs no table
- inheritedSettings (function, 14-38): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `a setting explanation lists settings set only in scopes and each inherited value`. TPP-028: one user; the sample writes \[\[scope\]\] records with path = "api" and "api/worker" and dotted keys inside them; the expected source names the \[\[scope\]\] record
- repositoryPaths (function, 40-79): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `a path explanation lists the command checks and the ignores that apply`. TPP-028: one user; the sample writes a \[\[scope\]\] record with path = "api", and the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- collidingNames (function, 81-104): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `a configuration name stays a name, and a tracked or ./ path explains the file`. TPP-028: one user
- recordedIgnores (function, 106-131): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `a file path reports its scope, checks, and ignores`. TPP-028: one user
- missingPath (function, 133-140): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `a missing ./ path fails`. TPP-028: one user
- unknownSubject (function, 142-150): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `an unknown subject gets the command error`. TPP-028: one user
- policyFreeNames (function, 152-164): **inline** to `tests/unit/cli/commands/explain/command.test.ts` `configuration and check explanations work without gspot.toml`. TPP-028: one user

## `tests/cli/commands/export.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/export.test.ts`. unit test of commands/export.ts
- template publication is idempotent, supports re-export, and survives apply (test (test), 14-37): **keep** to `tests/unit/cli/commands/export.test.ts` `export is repeatable, writes the template again after an edit, and apply leaves it alone`. real; glossary: export, not publish; export has no dry run, so the call passes no isDryRun field (CLX-004)
- template export resolves a parent destination inside the repository from a nested working directory (test (test), 39-54): **keep** to `tests/unit/cli/commands/export.test.ts` `export from a nested folder writes a parent path inside the repository`. real; export has no dry run, so the call passes no isDryRun field (CLX-004)
- template export refuses unsafe destination %s without changing external bytes (test (test.each), 56-75): **keep** to `tests/unit/cli/commands/export.test.ts` `export refuses a destination that links to a file outside`. CMD-008: delete the drive-relative and linked-parent rows; keep the linked destination row; TCM-030 rewrites its message; export has no dry run, so the call passes no isDryRun field (CLX-004)
- \[ \[ 'C:outside.toml', 'Template export cannot use a drive-relative destination. Choose an absolute o (test (test.each), 56-63): **keep** to `tests/unit/cli/commands/export.test.ts` `export refuses a destination that links to a file outside`. table of the test above; CMD-008: one row left
- template export replaces an unowned destination and preserves its read-only mode (test (test), 77-90): **keep** to `tests/unit/cli/commands/export.test.ts` `export replaces a destination gspot did not write and keeps its read-only mode`. real; export has no dry run, so the call passes no isDryRun field (CLX-004); the template key is deleted (TML-011), so the exported text has no template = "occupied" line and the test asserts the written settings
- export refuses the managed policy with the same policy diagnostic in human and JSON output (test (test), 92-114): **keep** to `tests/unit/cli/commands/export.test.ts` `export refuses gspot.toml with the same error in text and JSON`. real
- template export previews an external atomic destination without writing either repository (test (test), 116-133): **keep** to `tests/unit/cli/commands/export.test.ts` `export to a folder outside the repository writes the template and nothing inside the repository`. real; the preview half (lines 121-127) goes because export has no --dry-run (CLX-004), and the export to an outside path stays; the template key is deleted (TML-011), so no template = "shared" assertion is left
- template export warns once for each command that needs a repository file (test (test), 135-148): **keep** to `tests/unit/cli/commands/export.test.ts` `export warns once for each command that needs a repository file`. real; export has no dry run, so the call passes no isDryRun field and the export writes the file (CLX-004); the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"

## `tests/cli/commands/help.test.ts`

- (the file) (file): **delete**. TCM-003, CMD-087: tests 1 and 2 compare the help table with itself; the color test moves to terminal/print.test.ts
- every command has native help and reference content from one metadata table (test (test), 11-36): **delete**. TCM-003: help text and the docs page come from one table; CLX-012 types COMMAND_HELP so the compiler checks it
- set help, reference levels, and policy metadata retain the authoritative coverage descriptions (test (test), 38-56): **delete**. TCM-003: LEVEL_SUMMARY compared with copies of itself (fake)
- --no-color prints the finding without ANSI escape codes on terminal streams (test (test), 58-80): **move** to `tests/unit/cli/terminal/print.test.ts` `NO_COLOR prints findings without ANSI escape codes on terminal streams`. TCM-003; CMD-092 deletes --no-color: set NO_COLOR=1 (isColorAllowed in terminal/print.ts reads it); glossary: gspot/unmatched-paths becomes gspot/unused-entries

## `tests/cli/commands/ignore/command.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/ignore.test.ts; tests/unit/cli/execution/ignores.test.ts`. the --until tests stay in ignore.test.ts; TCM-032; the run test goes to the test of execution/ignores.ts; ignore --remove steps become unignore (CMD-092)
- path-specific ignores prevent checker and fixer execution and report an entirely ignored selection (test (test), 11-58): **keep** to `tests/unit/cli/execution/ignores.test.ts` `a path ignore keeps the check and its fixer off those paths, and a run of only ignored paths is skipped`. real; execution/ignores.ts applies ignores; the restore step uses gspot unignore (CMD-092); the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- ignore with %s exits %d and leaves gspot.toml byte for byte (test (test.each), 60-70): **keep** to `tests/unit/cli/commands/ignore.test.ts` `ignore of an unknown check exits 2 and leaves gspot.toml byte for byte`. real; the second row (removing an absent entry) repeats the unignore feedback test and goes
- \[...IGNORE_CASES\] (test (test.each), 60-60): **keep** to `tests/unit/cli/commands/ignore.test.ts` `ignore of an unknown check exits 2 and leaves gspot.toml byte for byte`. table of the test above; one row left, so the test becomes a plain test
- merged ignores print saved paths and allow individual paths to be removed (test (test), 72-99): **keep** to `tests/unit/cli/commands/ignore.test.ts` `ignore merges paths into one entry and prints them, and unignore removes one path`. real; CMD-092: ignore --remove becomes unignore; hooks.push_files is deleted (TML-002), so the kept table is \[hooks\] with its comment and enabled = false; the inline table is \[rules\] (TML-003)
- ignore merges matching expiry dates and removes only the selected expiry (test (test), 101-160): **keep** to `tests/unit/cli/commands/ignore.test.ts` `ignore merges entries with the same --until date, keeps other dates apart, and unignore removes one path`. ignore --until stays; the removal step becomes unignore --rule SC2086 --paths b.sh (CLX-011: no --until filter); the inline table is \[rules\] (TML-003)
- ignore rejects an invalid expiry without changing authored policy (test (test), 162-182): **keep** to `tests/unit/cli/commands/ignore.test.ts` `ignore refuses an invalid --until date and leaves gspot.toml as it was`. ignore --until stays; real
- ignore combines matching paths, keeps different reasons, and lets a pathless entry cover the whole scope (test (test), 184-219): **keep** to `tests/unit/cli/commands/ignore.test.ts` `ignore merges matching paths, keeps different reasons apart, and an entry without paths covers the scope`. real; the last step uses gspot unignore (CMD-092): unignore --rule SC2312 deletes both SC2312 entries, so expect an empty ignore list and "deleted 2 ignores" (CLX-011)

## `tests/cli/commands/ignore/removal.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/unignore.test.ts`. TCM-032: tests the removal of ignore entries, which CMD-092 makes gspot unignore (commands/unignore.ts); IGNORE_FEEDBACK_CASES moves in
- ignore removal from %s keeps apply notes and reports an unchanged repeat (test (test.each), 12-42): **keep** to `tests/unit/cli/commands/unignore.test.ts` `unignore from %s prints its summary and reports a repeat as unchanged`. real; ignore --remove becomes unignore (CMD-092); gspot never touches CLAUDE.md, so the CLAUDE.md file, the 'note CLAUDE.md text moves' line and the AGENTS.md checks go; what stays is the summary, the removal and the 'nothing to remove' repeat, which no other kept test checks
- IGNORE_FEEDBACK_CASES (test (test.each), 12-12): **keep** to `tests/unit/cli/commands/unignore.test.ts` `unignore from %s prints its summary and reports a repeat as unchanged`. table of the test above; the apply notes go, and the name follows its test
- ignore removal keeps its summary and apply failure while preserving edited output (test (test), 44-65): **keep** to `tests/unit/cli/commands/unignore.test.ts` `unignore keeps its summary and the apply failure, and leaves an edited generated file alone`. real
- ignore removal validates unchanged policy and can repair an invalid authored ignore (test (test), 67-82): **keep** to `tests/unit/cli/commands/unignore.test.ts` `unignore checks gspot.toml and can remove an ignore that has no reason`. real
- ignore removal counts changed entries and keeps partial paths and other selectors (test (test), 84-128): **keep** to `tests/unit/cli/commands/unignore.test.ts` `unignore counts changed entries and keeps other paths and other rules`. real; unignore without --rule deletes every entry of the check (CLX-011), so the expected counts follow that match rule

## `tests/cli/commands/init/ci.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/init/settings-text.test.ts; tests/unit/cli/commands/init/plan.test.ts`. TCM-033: the CI proposal test goes to the test of settings-text.ts (proposeCi), the plan rows to the test of init/plan.ts, and the --ci test goes with the flag (CMD-092); init/questions.ts is not created
- an explicit CI provider takes precedence over $name and preserves authored jobs (test (test.each), 15-47): **delete**. CMD-092 deletes init --ci; the retained lint job rows stay in the plan test
- INIT_CI_CASES (test (test.each), 15-15): **delete**. table of the deleted test
- initialization distinguishes retained CI jobs from tool settings that generated configuration replaces (test (test), 49-75): **keep** to `tests/unit/cli/commands/init/plan.test.ts` `the init plan keeps existing CI jobs apart from tool settings that the generated tool files replace`. real
- initialization CI preference uses %s (test (test.each), 77-86): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `init proposes the CI provider from %s`. real; TCM-019 adds the row "a GitHub workflow before a GitLab remote"; askQuestions goes (CLX-001), and the rows call proposeCi in commands/init/settings-text.ts, which proposes CI without a prompt
- CI_PREFERENCE_CASES (test (test.each), 77-77): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `init proposes the CI provider from %s`. table of the test above; it follows the CI proposal test
- init keeps an unsupported CI pipeline in place and names it in the plan (test (test), 88-97): **keep** to `tests/unit/cli/commands/init/plan.test.ts` `init leaves an unsupported CI pipeline in place and names it in the plan`. real

## `tests/cli/commands/init/javascript-detection.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/init/selection.test.ts`. tests what init selects for a tooling-only package.json (selectForInit in commands/init/selection.ts, LIF-009); its data goes to tests/config/init.ts; the joined file stays under 300 lines
- %s tooling packages preserve scopes and isolate JavaScript to its consumer manifest (test (test.each), 14-48): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `a root package.json with only tool dependencies leaves JavaScript to the scope with Node source (%s)`. real
- NON_JAVASCRIPT_PROJECTS (test (test.each), 14-14): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `a root package.json with only tool dependencies leaves JavaScript to the scope with Node source (%s)`. table of the test above; one row: the other language does not change the JavaScript decision
- %s tooling packages include JavaScript tools only after a real Node source appears at either level (test (test.each), 50-78): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `JavaScript tools arrive only after real Node source appears, at both levels (%s)`. real; the level loop stays (TGN-037: more checks run at all); both loops use LEVELS from packages/cli/src/config/configurations.ts (TGN-037)
- NON_JAVASCRIPT_PROJECTS (test (test.each), 50-50): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `JavaScript tools arrive only after real Node source appears, at both levels (%s)`. table of the test above; one row, as above

## `tests/cli/commands/init/policy-text.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/init/settings-text.test.ts; tests/unit/cli/commands/init/format.test.ts`. proposeText tests go to the test of init/settings-text.ts (init/policy-text.ts, glossary settings); readFormatTables tests go to the test of init/format.ts (PAR-011)
- initialization preserves root and scoped configuration choices (test (test), 26-49): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `the gspot.toml text keeps root and scope configurations`. real; the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003); the scope is a \[\[scope\]\] record, so the parsed scope of apps/site is read from that record
- template settings survive beside the commit scopes init adds (test (test), 51-79): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `template settings stay beside the commit scopes init adds`. real; the role test_harness is deleted (TML-001), so the template keeps a setting that stays, architecture.roles.environment_readers = \["tests/env.sh"\]; the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003)
- initialization uses its selected runner over the template runner and honors disabled integrations (test (test), 81-116): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `turned-off hooks, CI and rules write no table, and the template's other settings stay`. real; the runner setting and the template runner are deleted (INX-003, INX-004), so the runner fields and the runner assertion go; the template drops hooks.push_files (TML-002), the two rules.folder assertions go because the key is deleted, the table is \[rules\] (TML-003), and ci is written \[ci\] enabled and provider (TML-015)
- template initialization retains owned comments and records copy-once provenance (test (test), 118-146): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `a template keeps its comments and gspot.toml records which template it copied`. real; the template writes \[rules\] instruction_files (TML-003); the provenance comment names the template file (# Copied from template team.template.toml, sha256 ...); the two assertions that template and selection are absent go because the keys are deleted (TML-011); the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003)
- initialization selects the native $sdk destination (test (test.each), 148-166): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `init picks the Xcode destination for SDK $sdk`. real; the title drops "native"; the view reads options('xcode').destination (POL-033); the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003)
- SDK_DESTINATIONS (test (test.each), 148-148): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `init picks the Xcode destination for SDK $sdk`. table of the test above
- initialization respects the template $name before reading SDK metadata (test (test.each), 168-204): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `the template $name wins over the SDK of the Xcode project`. real; the choices are xcode.project and xcode.destination (POL-033; see TEMPLATE_SWIFT_CHOICES); the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003)
- MANUAL_SWIFT_CHOICES (test (test.each), 168-168): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `the template $name wins over the SDK of the Xcode project`. table of the test above
- initialization preserves $name (test (test.each), 206-235): **keep** to `tests/unit/cli/commands/init/format.test.ts` `init reads the format settings from $name`. real; the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003)
- FORMAT_CASES (test (test.each), 206-206): **keep** to `tests/unit/cli/commands/init/format.test.ts` `init reads the format settings from $name`. table of the test above
- initialization preserves scoped $name (test (test.each), 237-278): **keep** to `tests/unit/cli/commands/init/format.test.ts` `init reads the format settings of each scope with $name`. real; the runner field of the draft (PolicyDraft) is deleted, so the call passes none (INX-003)
- SCOPE_FORMAT_CASES (test (test.each), 237-237): **keep** to `tests/unit/cli/commands/init/format.test.ts` `init reads the format settings of each scope with $name`. table of the test above
- initialization refuses $name without writing (test (test.each), 280-293): **delete**. fake: it cannot fail, since the rejects.toThrow is not awaited, so the test ends before the promise settles
- FORMAT_REFUSALS (test (test.each), 280-280): **delete**. fake: table of the deleted refusal test

## `tests/cli/commands/init/questions.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/init/command/confirmation.test.ts; tests/unit/cli/commands/init/settings-text.test.ts; tests/unit/cli/commands/init/plan.test.ts`. askQuestions and the choice tables go, so init/questions.ts is not created (CLX-001); askConfirmation moves to commands/init/command.ts, whose tests sit in command/ by behavior, so the confirmation tests go to command/confirmation.test.ts; the lint-job CI test goes to the proposeCi test and the plan-grouping test to the plan test
- initialization confirmations (describe (describe), 23-56): **keep** to `tests/unit/cli/commands/init/command/confirmation.test.ts` `confirmations`. real; askConfirmation moves to commands/init/command.ts, whose tests sit in command/
- initialization confirmations &gt; uses the proposed answer without opening a prompt (test (test), 24-30): **delete**. duplicate: with --yes the proposed answer is used and no prompt opens, and every init test that passes --yes, for example 'uncommitted changes stop init until they are committed', runs this path
- initialization confirmations &gt; returns the explicit answer %s from the terminal (test (test.each), 32-38): **keep** to `tests/unit/cli/commands/init/command/confirmation.test.ts` `returns the answer %s from the terminal`. real: the one test that the terminal's answer is returned
- initialization confirmations &gt; \[true, false\] (test (test.each), 32-32): **keep** to `tests/unit/cli/commands/init/command/confirmation.test.ts` `returns the answer %s from the terminal`. table of the test above
- initialization confirmations &gt; refuses an unanswered confirmation without a terminal (test (test), 40-46): **delete**. duplicate: without a terminal the confirmation is refused and names --yes, which 'init without a terminal names --yes once and writes only after --yes' in command/refusals.test.ts runs through the command
- initialization confirmations &gt; reports cancellation instead of accepting the default (test (test), 48-55): **keep** to `tests/unit/cli/commands/init/command/confirmation.test.ts` `reports cancellation instead of taking the default`. real: cancel stops init with "Canceled. Nothing was written."
- initialization $name (test (test.each), 58-73): **delete**. test of deleted code: init's runner question goes with askQuestions (CLX-001); init uses its computed defaults and prints them in the plan
- \[...RUNNER_ANSWERS\] (test (test.each), 58-58): **delete**. test of deleted code: rows of the deleted runner question test (CLX-001)
- initialization $name (test (test.each), 75-84): **delete**. test of deleted code: the runner question and its no-terminal refusal go (CLX-001)
- \[...RUNNER_FAILURES\] (test (test.each), 75-75): **delete**. test of deleted code: rows of the deleted runner refusal test (CLX-001)
- initialization groups detected test runners and infrastructure under their native categories (test (test), 86-98): **move** to `tests/unit/cli/commands/init/plan.test.ts` `the init plan groups test runners and infrastructure under their own labels`. it tests the plan text (init/plan.ts); glossary labels Testing and Infrastructure
- noninteractive dry-run accepts every default and preserves explicit answers (test (test), 100-122): **delete**. test of deleted code: with no setup questions there are no defaults to accept without a terminal (CLX-001)
- interactive dry-run retains the hooks answer and cancellation %s (test (test.each), 124-143): **delete**. test of deleted code: the 'Install Git hooks?' question goes (CLX-001)
- \[false, true\] (test (test.each), 124-124): **delete**. test of deleted code: rows of the deleted hooks question test (CLX-001)
- noninteractive source init dry-run prints a plan without writing and ordinary init still refuses (test (test), 145-173): **delete**. duplicate: the only prompt is 'Continue?', and 'init without a terminal names --yes once and writes only after --yes' in command/refusals.test.ts checks the same refusal and the dry run (CLX-001)
- interactive initialization bypasses a CI prompt for $name and retains explicit providers (test (test.each), 175-200): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `a lint job in $name means init asks no CI question and proposes no CI`. TCM-019 keeps it; CMD-092 deletes --ci, so the explicit-provider half goes; askQuestions goes (CLX-001), so the test calls proposeCi in commands/init/settings-text.ts, and a lint job means no CI is proposed
- INIT_CI_CASES (test (test.each), 175-175): **keep** to `tests/unit/cli/commands/init/settings-text.test.ts` `a lint job in $name means init asks no CI question and proposes no CI`. table of the test above; INIT_CI_CASES moves in as LINT_JOBS and follows the CI proposal test

## `tests/cli/commands/init/refusals.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/init/command/refusals.test.ts`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; unit test of the initCommand refusals; the template tests sit in command/templates.test.ts
- $name exits 2 and writes nothing (test (test.each), 18-27): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init with an unknown configuration exits 2 and writes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real; CMD-092 deletes --ci, so the --ci foo row goes
- ARGUMENT_REFUSALS (test (test.each), 18-18): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init with an unknown configuration exits 2 and writes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; table of the test above; one row, written in the test
- uncommitted changes stop init until they are committed (test (test), 29-53): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `uncommitted changes stop init until they are committed`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real
- failed Git status stops initialization with a selection error before writing (test (test), 55-84): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `a failed git status stops init before it writes`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real; CMD-050 changes the error name
- init refuses an invalid manifest before writing (test (test), 86-94): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init refuses an unreadable package.json before writing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real; glossary: manifest means only manifest.toml
- init in a repository that already has gspot.toml exits 2 and changes nothing (test (test), 96-111): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init in a repository that already has gspot.toml exits 2 and changes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real
- init from a template address that answers 404 exits 2 and writes nothing (test (test), 113-126): **delete**. weak: only checks exit code 2 and an unchanged tree, so any other error passes; the 404 refusal itself stays tested by policy/templates/sources.test.ts 'a template address that answers 404 is refused with its status'
- JSON initialization without --yes reports the argument before reading invalid project input (test (test), 128-137): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init --json without --yes names --yes before reading the repository`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real
- initialization in $name previews only applicable Git changes (test (test.each), 139-160): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init in $name plans only the Git changes that apply`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real; EXG-004: no .gitattributes outside Git, so that expectation changes
- GIT_PLAN_CASES (test (test.each), 139-139): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init in $name plans only the Git changes that apply`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; table of the test above; two rows written in the test
- initialization without a terminal names --yes once and writes only after explicit acceptance (test (test), 162-175): **keep** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init without a terminal names --yes once and writes only after --yes`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real
- init refuses unsafe or absent scope $scope before publication (test (test.each), 177-196): **delete**. CMD-092 deletes --scope-configurations, the only way to pass these scope paths; scope paths in gspot.toml are checked by the settings reader
- UNSAFE_SCOPE_CASES (test (test.each), 177-177): **delete**. table of the deleted test
- init refuses an unsafe output ancestor before attempting installation (test (test), 198-222): **delete**. init never installs tools, and gspot writes no file under .mise/ (its mise file is .gspot/mise.toml, INX-001), so a linked .mise folder is not an output ancestor; the linked .gspot refusal is tested by "a linked .gspot folder stops init and check" (session.test.ts)

## `tests/cli/commands/init/replace.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/init/replace/plan.test.ts`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; unit test of commands/init/replace.ts (init/takeover.ts renamed, glossary "replace"); the changed-after-plan tests go to the test of init/write.ts
- dry-run distinguishes source hooks from configured hooks at %s (test (test.each), 23-43): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `the init plan tells hook scripts in the source apart from the hooks folder Git uses (%s)`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; real
- \['', 'hooks', '.husky'\] (test (test.each), 23-23): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `the init plan tells hook scripts in the source apart from the hooks folder Git uses (%s)`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; table of the test above
- the init plan replaces the files of the selected tools and lists the lint folder (test (test), 45-72): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `the init plan deletes the replaced tool files and lists the lint folder`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; real
- init leaves shared %s in place and names the SQLFluff section for the developer (test (test.each), 74-95): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init leaves a shared %s in place and names its SQLFluff section`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; real
- \['setup.cfg', 'tox.ini'\] (test (test.each), 74-74): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init leaves a shared %s in place and names its SQLFluff section`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; table of the test above
- an ignore file inside a scope is replaced at init, and the scoped check runs (test (test), 97-120): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init replaces an ignore file inside a scope, and the scope check runs`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; real; CMD-092 deletes --scope-configurations: the scope comes from a template
- initialization refuses removal of a replaced file that %s after preview (test (test.each), 122-148): **move** to `tests/unit/cli/commands/init/write.test.ts` `init refuses to delete a replaced file that %s after the plan`. TCM-033: a changed-after-plan test; writeSetup is in init/write.ts; TCM-029 message
- \[ \[ 'changes', async (path: string) =&gt; { await writeFile(path, 'disable=SC2034\\n'); (test (test.each), 122-130): **move** to `tests/unit/cli/commands/init/write.test.ts` `init refuses to delete a replaced file that %s after the plan`. table of the test above
- initialization retains a shared authored link and its target bytes and mode (dry run: %s) (test (test.each), 150-178): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init keeps a linked shared file and its target bytes and mode (dry run: %s)`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; real
- \[true, false\] (test (test.each), 150-150): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init keeps a linked shared file and its target bytes and mode (dry run: %s)`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; table of the test above
- initialization identifies retained $table settings in Python project scope "$scope" (test (test.each), 180-213): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init names the $table table it leaves in pyproject.toml`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; real; CMD-092 deletes --scope-configurations, so only the root rows stay
- PYPROJECT_TAKEOVERS.flatMap((row) =&gt; \['', 'app'\].map((scope) =&gt; ({ ...row, scope }))) (test (test.each), 180-180): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init names the $table table it leaves in pyproject.toml`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; table of the test above; root rows only
- init replaces a nested spelling configuration and deletes the original (test (test), 215-240): **keep** to `tests/unit/cli/commands/init/replace/plan.test.ts` `init replaces a nested spelling configuration and deletes the original`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; TCM-052: delete the .gitignore line
- init reports each submodule once without reading its contents (test (test), 242-263): **move** to `tests/unit/cli/commands/init/plan.test.ts` `the init plan lists each submodule once and reads none of it`. it tests the retained rows of the plan (init/plan.ts)
- failed initialization preserves the previous pin when generated publication fails (test (test), 265-276): **move** to `tests/unit/cli/commands/init/write.test.ts` `a failed init keeps the previous version pin`. the failure path of writeSetup (init/write.ts)
- init retains old configuration when a conflicting replacement cannot be published (test (test), 278-294): **move** to `tests/unit/cli/commands/init/write.test.ts` `init keeps the old tool file when the generated one cannot be written`. the write order of writeSetup (init/write.ts)

## `tests/cli/commands/init/selection.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/init/selection.test.ts`. unit test of commands/init/selection.ts (selectForInit, LIF-009); gains javascript-detection.test.ts
- accepting defaults leaves the detected initialization plan unchanged (test (test), 24-48): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `accepting the defaults leaves the detected plan unchanged`. real
- initialization identifies a scope flag without attributing it to an absent policy (test (test), 50-65): **delete**. CMD-092 deletes --scope-configurations
- init selects a recommended language only when the repository holds its files (test (test), 74-96): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `init selects a recommended language only when the repository holds its files`. real; COMPONENT becomes VUE_COMPONENT
- init proposes a project scope without --scope-configurations and sets lint-only packages aside (test (test), 98-116): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `init proposes a project scope and sets lint-only packages aside`. real; CMD-092 drops --scope-configurations from the title
- Explicit Next.js choices override locale dependency detection: %j (test (test.each), 118-141): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `a named Next.js configuration list wins over locale dependency detection: %j`. real
- \[ { dependency: false, named: false, isSelected: false }, { dependency: true, named: false, isSelected: false }, (test (test.each), 118-122): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `a named Next.js configuration list wins over locale dependency detection: %j`. table of the test above
- init proposes workspace scopes without a lockfile and preserves files after resolver failure (test (test), 143-162): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `init proposes workspace scopes without a lockfile, and writes nothing when the workspace file is broken`. real
- init previews only applicable tool projects and duplicate pins for the selected runner (test (test), 164-196): **delete**. weak: computes the expected tool counts with toolProjectPins, the function the plan uses, so a bug there passes
- init counts active and disabled checks at %s (test (test.each), 198-220): **delete**. weak: computes the expected check counts by filtering the shipped checks the way the plan does
- \['recommended', 'all'\] as const (test (test.each), 198-198): **delete**. weak: level table of the deleted check-count test
- a named configuration brings its suggested configurations, and one --scope-configurations flag proposes both scopes (test (test), 222-237): **keep** to `tests/unit/cli/commands/init/selection.test.ts` `a named configuration brings its suggested configurations`. CMD-092 deletes --scope-configurations, so the scope half goes
- initialization flags control integrations without changing the authored formatter file (test (test), 239-255): **delete**. CMD-092 deletes the integration flags this test turns off; reading the format settings is tested by the FORMAT_CASES test of format.test.ts
- an explicit %s runner is selected without a prompt or tool installation (test (test.each), 257-274): **delete**. CMD-092 deletes --runner
- \['mise', 'bun', 'npm', 'pnpm', 'yarn'\] as const (test (test.each), 257-257): **delete**. table of the deleted test
- plannedConfigurations (function, 67-72): **move** to `tests/unit/cli/commands/init/selection.test.ts` `plannedConfigurations`. test helper; one test calls it twice

## `tests/cli/commands/init/takeover.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/init/write.test.ts`. TCM-032: three of four tests are edits after the plan, refused by writeSetup (init/write.ts); the inactive-checks test moves to replace/plan.test.ts
- initialization refuses publication of a shared package field edited after preview (test (test), 18-52): **keep** to `tests/unit/cli/commands/init/write.test.ts` `init refuses to write a shared package.json field edited after the plan`. real; TCM-029 message; glossary: ownership log
- initialization does not overwrite a shared file created after its absent-file preview (test (test), 54-80): **keep** to `tests/unit/cli/commands/init/write.test.ts` `init does not overwrite a shared file created after the plan`. real; TCM-029 message
- recommended initialization keeps authored configurations of inactive strict checks (test (test), 82-104): **move** to `tests/unit/cli/commands/init/replace/plan.test.ts` `at level recommended, init keeps the tool files of checks that are off`. replace/ holds the tests of commands/init/replace.ts by behavior, so no replace.test.ts beside it; TCM-032: not a changed-after-plan test; its data INACTIVE_CONFIGURATIONS has only this user; the template text has no template and selection keys, only level = "recommended" (TML-011)
- initialization preserves a retained shared configuration edited after its plan (test (test), 106-126): **keep** to `tests/unit/cli/commands/init/write.test.ts` `init keeps a shared file that was edited after the plan`. real

## `tests/cli/commands/init/templates.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/init/command/templates.test.ts`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; init --from tests of commands/init/command.ts; apart from command/refusals.test.ts
- templates (describe (describe), 90-117): **delete**. TPP-028: the describe wrapper goes
- templates &gt; init validates a template in a dry run without changing the repository (test (test), 91-91): **keep** to `tests/unit/cli/commands/init/command/templates.test.ts` `init --dry-run --from checks a template and writes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; TPP-028: body inline; ROOT-004: the \_\_proto\_\_ parts go; CMD-092 deletes --no-install; the template text has no template and selection keys, and the plan names only the template file (TML-011); the command check is a \[\[command_check\]\] record
- templates &gt; an empty %s template controls root detection without writing (test (test.each), 93-93): **keep** to `tests/unit/cli/commands/init/command/templates.test.ts` `an empty template still lets init add the detected configurations, and a dry run writes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; TPP-028: body inline; THR-028: a literal always-selected list instead of the product logic; selection is deleted and init --from always detects and adds (TML-011), so the exact row goes and the detect row is one plain test (javascript is added; no plan.template.selection)
- templates &gt; \['exact', 'detect'\] (test (test.each), 93-93): **delete**. the exact row tests the deleted selection mode (TML-011); one row is left, so no table
- templates &gt; a template with a wrong value, an unknown configuration and a path stops init before anything is written (test (test), 95-116): **keep** to `tests/unit/cli/commands/init/command/templates.test.ts` `a template with a wrong value stops init before anything is written`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; real; selection is deleted (TML-011), so the wrong value is level = "sometimes" and the error message names level
- an exact template preserves its full root policy despite new general detection at %s (test (test.each), 119-156): **keep** to `tests/unit/cli/commands/init/command/templates.test.ts` `init --from an exported template writes the same settings in another repository`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; TGN-037: drop the level loop; the exact mode is deleted and init --from always adds detected configurations (TML-011), so the destination gets no index.ts and the copy must equal the source
- \['recommended', 'all'\] as const (test (test.each), 119-119): **delete**. TGN-037: the level table goes
- templateDryRun (function, 18-56): **inline** to `tests/unit/cli/commands/init/command/templates.test.ts` `init --dry-run --from checks a template and writes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; TPP-028: one user; the template text drops template and selection, and plan.template names only the file (TML-011); the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- templateSelection (function, 58-88): **inline** to `tests/unit/cli/commands/init/command/templates.test.ts` `an empty %s template decides root detection`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; TPP-028: one user; only the detect path is left: the template text is configurations = \[\] and javascript is added (TML-011)

## `tests/cli/commands/list.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/list.test.ts`. unit test of commands/list.ts
- list shows selected policy states and available configurations while doctor keeps suggestions without writing (test (test), 13-54): **keep** to `tests/unit/cli/commands/list.test.ts` `list shows check states and available configurations`. TCM-033: delete the getSuggestions lines (doctor tests cover them); TCO-012: drop the readTree snapshot and the second gspot.toml read
- human configuration listings retain the selected names from JSON without writing (test (test), 56-73): **keep** to `tests/unit/cli/commands/list.test.ts` `the text configuration list shows the selected names of the JSON list`. TCO-012: drop the readTree snapshot
- human check listings combine scope states into one row without losing JSON scope entries (test (test), 75-103): **keep** to `tests/unit/cli/commands/list.test.ts` `the text check list puts the states of all scopes in one row`. TCO-012: drop the readTree snapshot; the sample writes \[\[scope\]\] records with path = "api" and "api/worker"
- human setting listings show authored scope overrides while JSON retains inherited values (test (test), 105-134): **keep** to `tests/unit/cli/commands/list.test.ts` `the text settings list shows scope values while JSON keeps inherited values`. TCO-012: drop the readTree snapshot; NESTED_SCOPES_POLICY writes \[\[scope\]\] records, so the text and JSON source name the api record
- human setting listings shorten long values and name extra tables while JSON retains complete values (test (test), 136-176): **keep** to `tests/unit/cli/commands/list.test.ts` `the text settings list shortens long values and names extra tool options`. TCO-012; glossary: tools.&lt;tool&gt;.extra replaces verbatim; root exclude is deleted (TMF-003), so the long value is a test_files list of two long globs; the extra table is written \[tools.shellcheck.extra\] with value = { external_sources = true } and reason, with no \[reasons\] (CFR-002)

## `tests/cli/commands/manual-choices.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/reconcile/configurations.test.ts`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; TCM-018: one file for apply keeping saved choices; reconcileConfigurations is in commands/reconcile.ts (LIF-009)
- authored language overrides survive root and scope reconciliation without detection evidence (test (test), 20-41): **keep** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `apply keeps root and scope configurations that detection does not find`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real; TCM-018
- initialization keeps an explicitly selected $name language after its source disappears (test (test.each), 43-57): **delete**. TCM-018: the root row repeats a test kept below; CMD-092 deletes --scope-configurations, which the scope row needs
- INITIAL_OVERRIDES (test (test.each), 43-43): **delete**. table of the deleted test
- a manual removal survives loss and return of detection evidence (test (test), 59-76): **keep** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `a configuration removed by hand stays removed while its files come and go`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real; gspot remove stays (not unset configurations)
- authored language choices remain when source evidence disappears and returns (test (test), 78-90): **delete**. duplicate (bash in gspot.toml stays while run.sh goes and comes back; TCM-018) of reconciliation.test.ts 'apply retains saved configurations, settings and command checks when source evidence disappears', which removes and restores source.sh and asserts bash stays
- adding an already detected language keeps it selected after its source disappears (test (test), 92-104): **delete**. gspot add stays, but TCM-018: the test repeats the test above (adding a selected language changes nothing)
- removing an authored scope language before the first apply keeps the detected language removed (test (test), 106-118): **keep** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `removing a scope configuration before the first apply keeps it removed`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real; gspot remove bash --scope api stays
- a detect template keeps its named language while other configurations follow detection (test (test), 120-130): **delete**. duplicate (only how bash got into gspot.toml differs, here a detect template; TCM-018) of reconciliation.test.ts 'apply retains saved configurations, settings and command checks when source evidence disappears'
- an authored scope keeps its language choice while absent and after its source disappears (test (test), 132-149): **delete**. duplicate (a scope keeps its configuration while its folder is gone; TCM-018) of reconciliation.test.ts 'absent scopes retain authored settings without planning their checks or tool files'; a present scope without evidence stays tested by 'authored language overrides survive root and scope reconciliation'
- policy application writes no hidden choices and refuses the retired history field (test (test), 151-164): **delete**. TCM-014: the ownership log schema is strict, so a removed field is refused anyway

## `tests/cli/commands/policy-preview.test.ts`

- (the file) (file): **delete**. CLX-004 deletes --dry-run from set, unset, ignore, unignore, add and remove, and every test here is a dry-run test of those commands
- $name previews without writing and then publishes the same policy (test (test.each), 18-50): **delete**. test of a deleted flag: --dry-run on the commands that edit gspot.toml (CLX-004)
- POLICY_PREVIEW_CASES (test (test.each), 18-18): **delete**. test of a deleted flag: rows of the deleted dry-run test (CLX-004)
- $name previews and repeats without applying edited output (test (test.each), 52-80): **delete**. test of a deleted flag (CLX-004); the 'nothing to remove' repeat stays tested by the unignore test
- POLICY_PREVIEW_UNCHANGED (test (test.each), 52-52): **delete**. test of a deleted flag: rows of the deleted test (CLX-004)
- a policy preview leaves an active writer claim and existing files untouched (test (test), 82-95): **delete**. test of a deleted flag: a set --dry-run beside a held writer lock (CLX-004)
- $name has the same preview and publication refusal without writes (test (test.each), 97-116): **delete**. test of a deleted flag: dry-run refusals of set and ignore (CLX-004)
- POLICY_PREVIEW_REFUSALS (test (test.each), 97-97): **delete**. test of a deleted flag: rows of the deleted refusal test (CLX-004)

## `tests/cli/commands/program.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/program.test.ts`. unit test of commands/program.ts (src/public.ts moves there)
- plain command input with $name exits 2 and names the argument problem (test (test.each), 10-21): **keep** to `tests/unit/cli/commands/program.test.ts` `text output for $name exits 2 and names the argument problem`. real; the gspot add row stays; TCM-014 deletes the --refresh-locks row
- ARGUMENT_REFUSALS (test (test.each), 10-10): **keep** to `tests/unit/cli/commands/program.test.ts` `text output for $name exits 2 and names the argument problem`. table of the test above; every row reaches the same gspot path (commander rejects the input, gspot exits 2 before reading gspot.toml) and only varies commander's own message text, so 'an unknown option' and 'a missing option argument' (the one whose JSON message differs) stay
- JSON command input with $name and its flag $position emits one structured error (test (test.each), 23-46): **keep** to `tests/unit/cli/commands/program.test.ts` `JSON output for $name with --json $position gives one error object`. real
- ARGUMENT_REFUSALS.flatMap(({ arguments: argv, ...entry }) =&gt; \[ { ...entry, position: 'before', argv: \['--json', (test (test.each), 23-33): **keep** to `tests/unit/cli/commands/program.test.ts` `JSON output for $name with --json $position gives one error object`. table of the test above; --json is an option of each command (CLX-005), so the 'before the command' rows go and --json stays after the arguments
- help remains readable and exits 0 after a structured argument failure (test (test), 48-61): **keep** to `tests/unit/cli/commands/program.test.ts` `help works and exits 0 after an argument error`. CMD-087: keep the root --help part; the install --refresh-lockfiles half goes (CMD-092)
- ignore %s describes root-wide ignores and removal of multiple entries (test (test.each), 63-76): **delete**. CMD-087: pins help sentences; CMD-092 deletes ignore --remove
- \['-h', '--help'\] (test (test.each), 63-63): **delete**. table of the deleted test
- a package manager version failure retains its tool code and diagnostic in human and JSON output (test (test), 78-104): **keep** to `tests/unit/cli/commands/program.test.ts` `a failed npm version lookup gives the tool error in text and JSON`. real

## `tests/cli/commands/reconciliation.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/reconcile/configurations.test.ts; tests/unit/cli/commands/reconcile/settings.test.ts`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; TCM-018: the choice tests go to reconcile/configurations.test.ts; the tests of kept settings, ignores and tool options go to reconcile/settings.test.ts
- Expo choices survive dependency removal while native tool options and previewed writes agree (test (test), 28-60): **keep** to `tests/unit/cli/commands/reconcile/settings.test.ts` `Expo stays selected and keeps its tool options while its dependency goes and comes back`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real
- React DOM and React choices retain their tools after dependency evidence disappears (test (test), 62-82): **delete**. TCM-018: repeats the saved-configurations test below, which already shows that apply keeps a configuration whose evidence is gone; React DOM stays its own configuration
- apply retains saved configurations, settings and command checks when source evidence disappears (test (test), 113-148): **keep** to `tests/unit/cli/commands/reconcile/settings.test.ts` `apply keeps saved configurations, settings, ignores and command checks when their files go`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real; the setting is architecture.roles.environment_readers and there is no \[reasons\] (TML-001, CFR-002); the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;", and the saved text holds that record
- absent scopes retain authored settings without planning their checks or tool files (test (test), 150-183): **keep** to `tests/unit/cli/commands/reconcile/settings.test.ts` `a scope whose folder is gone keeps its settings, and its checks and tool files are not planned`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real; the sample writes \[\[scope\]\] records with path, and the scripts record writes architecture.roles.environment_readers = \["scripts/source.sh"\] from the repository root, with no reasons (CFR-003); the view reads roles.environment_readers
- %s apply retains authored choices without adding automatic or inherited selections (test (test.each), 185-216): **keep** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `apply adds no always-selected or inherited configuration to the saved lists`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; TGN-037: drop the level loop
- \['recommended', 'all'\] as const (test (test.each), 185-185): **delete**. TGN-037: the level table goes
- apply records a newly detected parent stack once and preserves inherited child choices (test (test), 218-237): **keep** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `apply saves a newly detected configuration once, at the outer scope`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; real
- mockNpmLockfile (function, 89-111): **inline** to `tests/unit/cli/commands/reconcile/settings.test.ts` `Expo stays selected and keeps its tool options while its dependency goes and comes back`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; TCM-018: its return type inline (tests/types/cli/reconciliation.ts goes); its second caller (the React DOM test) is deleted, so one caller is left and the npm spy is written in that test; NPM_VERSION and NPM_SUCCESS come from tests/config/npm.ts

## `tests/cli/commands/remove.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/remove.test.ts; tests/unit/cli/commands/add.test.ts; tests/unit/cli/commands/install.test.ts`. gspot add and gspot remove stay: the remove tests stay tests of commands/remove.ts, and the add rows of the shared tests go to add.test.ts; the install failure test goes to install.test.ts (TCM-033)
- removing %s preserves the policy and reports the prescribed outcome (test (test.each), 13-42): **keep** to `tests/unit/cli/commands/remove.test.ts` `remove %s leaves gspot.toml as it was and reports the outcome`. real; gspot remove stays; the inline table is \[rules\] (TML-003); the sample writes a \[\[scope\]\] record with path = "api"
- \[ \[ 'a configuration another configuration requires', \['remove', 'javascript'\], 'Cannot remo (test (test.each), 13-22): **keep** to `tests/unit/cli/commands/remove.test.ts` `remove %s leaves gspot.toml as it was and reports the outcome`. table of the test above
- $name applies its written policy without acquiring npm tools (test (test.each), 44-74): **keep** to `tests/unit/cli/commands/remove.test.ts` `remove applies gspot.toml and installs no npm tools`. real; gspot add and gspot remove stay: the remove row stays here, and the add row becomes the same test in add.test.ts (add applies gspot.toml and installs no npm tools)
- INSTALLATION_MUTATIONS (test (test.each), 44-44): **keep** to `tests/unit/cli/commands/remove.test.ts` `remove applies gspot.toml and installs no npm tools`. table of the test above; one row for each command: the remove row stays and the add row goes to add.test.ts, so each becomes a plain test
- an unexpected installer process error reaches the program failure handler (test (test), 76-107): **move** to `tests/unit/cli/commands/install.test.ts` `an unexpected error during install reaches the failure handler and changes nothing`. TCM-033: it tests gspot install (commands/install.ts); the inline table is \[rules\] (TML-003)
- editing automatic %s coverage refuses before writing policy or generated files (test (test.each), 109-122): **keep** to `tests/unit/cli/commands/remove.test.ts` `remove refuses an always-selected configuration before writing`. gspot add and gspot remove stay: the remove half stays here and the add half becomes 'add refuses an always-selected configuration before writing' in add.test.ts; TCM-022: one configuration, plain and --json, since remove has no --dry-run (CLX-004)
- \['security', 'duplication', 'licenses', 'prose', 'naming', 'structure', 'gspot'\] (test (test.each), 109-109): **keep** to `tests/unit/cli/commands/remove.test.ts` `remove refuses an always-selected configuration before writing`. table of the test above; one configuration left (TCM-022)

## `tests/cli/commands/roots.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/session.test.ts`. TCM-032: tests where a command finds its folder (openSession and startDirectory in commands/session.ts, CMD-003); data inlined
- $name (test (test.each), 16-42): **keep** to `tests/unit/cli/commands/session.test.ts` `a linked .gspot folder stops init and check, and nothing outside changes`. split into one test for init and one for check, with no branch on the command; the command check is a \[\[command_check\]\] record with name = "&lt;id&gt;"
- LINKED_STORAGE_CASES (test (test.each), 16-16): **keep** to `tests/unit/cli/commands/session.test.ts` `a linked .gspot folder stops init and check, and nothing outside changes`. table of the test above; LINKED_STORAGE_CASES dissolves into the two tests
- a configuration below the Git root owns only its own project writes and changed paths (test (test), 44-87): **keep** to `tests/unit/cli/commands/session.test.ts` `a gspot.toml below the Git root writes and checks only its own folder`. real; it keeps --changed --base HEAD
- INIT (const, 14-14): **inline** to `tests/unit/cli/commands/session.test.ts` `a linked .gspot folder stops init and check, and nothing outside changes`. one user (the init half)

## `tests/cli/commands/save-policy.test.ts`

- (the file) (file): **delete**. TCM-021: tests an internal detail and repeats tests/cli/policy/file.test.ts:130-146
- a policy command evaluates its mutation once before applying the prepared result (test (test), 9-27): **delete**. TCM-021: checks that savePolicy calls its change function once (internal detail)
- a policy command refuses changes after capture without rereading them as its input (test (test), 29-49): **delete**. TCM-021: repeats tests/cli/policy/file.test.ts:130-146

## `tests/cli/commands/set/command.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/set/refusals.test.ts; tests/unit/cli/commands/set/values.test.ts`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; unit test of commands/set.ts; gains the declarations and typed-tables tests; the reason tests sit in set/reasons.test.ts
- set refuses %s without changing repository files (test (test.each), 29-36): **delete**. weak: only checks exit code 2 and an unchanged tree, so any other error passes; refusing an unknown key stays tested by 'set refuses the unknown or unavailable native key %s without writes'
- PROSE_REFUSALS (test (test.each), 29-29): **delete**. weak: table of the deleted prose refusal test
- set refuses $name with $policyName before reading policy or writing state (test (test.each), 38-65): **delete**. CMD-092 deletes --replace, --remove and --default, the only flags this test sets against each other
- SET_ARGUMENT_CONFLICTS.flatMap((entry) =&gt; SET_CONFLICT_POLICIES.map(({ name, policy }) =&gt; ({ ...entry, policy, p (test (test.each), 38-42): **delete**. table of the deleted test
- set refuses %s (test (test.each), 67-105): **keep** to `tests/unit/cli/commands/set/refusals.test.ts` `set refuses %s`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real; glossary: extra replaces verbatim; CMD-020 fixes the scope list in the message
- \[ \[ 'a scope-only key without --scope', \['set', 'tools.shellcheck.verbatim', '{"external_sources": t (test (test.each), 67-84): **keep** to `tests/unit/cli/commands/set/refusals.test.ts` `set refuses %s`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; table of the test above; set takes &lt;values...&gt; (CLX-013), so 'a key without a value' is a Commander usage error, and the row checks that message
- %s keeps its change in gspot.toml and exits 2 when apply then stops (test (test.each), 107-133): **keep** to `tests/unit/cli/commands/set/values.test.ts` `%s keeps its change in gspot.toml and exits 2 when apply then stops`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real; the inline table is \[rules\] (TML-003)
- \[ \[ 'set', \['set', 'limits.bash.file_lines', '200', '--reason', 'Generated scripts need this limit.' (test (test.each), 107-118): **keep** to `tests/unit/cli/commands/set/values.test.ts` `%s keeps its change in gspot.toml and exits 2 when apply then stops`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; table of the test above
- set addresses native Taplo options in the $name scope without installing tools (test (test.each), 135-177): **keep** to `tests/unit/cli/commands/set/values.test.ts` `set writes extra Taplo options in the $name scope without installing tools, and unset removes them`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real; CMD-092: set --default becomes unset; glossary: extra; the preview step (lines 147-150) goes because set has no --dry-run (CLX-004); no \[reasons\] (CFR-002): the refusal names the reason form (--reason), the reason sits in the tools.taplo.extra value, and unset removes value and reason together, so the separate reasons assertion goes; the sample writes a \[\[scope\]\] record with path = "app"
- NATIVE_OPTION_SCOPES (test (test.each), 135-135): **keep** to `tests/unit/cli/commands/set/values.test.ts` `set writes extra Taplo options in the $name scope without installing tools, and unset removes them`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; table of the test above; NATIVE_OPTION_SCOPES becomes EXTRA_OPTION_SCOPES
- set retains native ESLint override records and their outer reason (test (test), 179-203): **delete**. set writes no record lists (single values and list items only; record lists are written by hand), and \[\[tools.eslint.override\]\] is a record list with no reason field (CFR-002), so this test of set goes
- set refuses the unknown or unavailable native key %s without writes (test (test.each), 205-219): **keep** to `tests/unit/cli/commands/set/refusals.test.ts` `set refuses the unknown or unavailable key %s and writes nothing`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real; glossary: extra
- \['tools.taplo.unknown', 'tools.eslint.verbatim', 'tools.v8r.verbatim'\] (test (test.each), 205-205): **keep** to `tests/unit/cli/commands/set/refusals.test.ts` `set refuses the unknown or unavailable key %s and writes nothing`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; table of the test above
- an invalid level preserves the policy (test (test), 221-232): **keep** to `tests/unit/cli/commands/set/refusals.test.ts` `an invalid level leaves gspot.toml as it was`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real

## `tests/cli/commands/set/declarations.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/set/values.test.ts`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; one test of commands/set.ts
- declarations retain producer metadata and reasons while removing individual paths (test (test), 8-45): **delete**. \[\[generated\]\] is deleted, since files are marked linguist-generated in .gitattributes (CFR-005), and the generator field goes

## `tests/cli/commands/set/exceptions.test.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/set/reasons.test.ts; tests/unit/cli/checks/general/dependencies/lockfile-hosts.test.ts`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; the reason tests go to set/reasons.test.ts; the two lockfile-hosts tests go to the test of checks/general/dependencies/lockfile-hosts.ts (TCM-033, CKG-031)
- $key saves reasons through previews and list mutations (test (test.each), 15-75): **keep** to `tests/unit/cli/commands/set/reasons.test.ts` `$key keeps its reason through list edits`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; CMD-092: unset replaces --replace and --remove; the preview step (lines 33-48) goes because set has no --dry-run (CLX-004); each list carries its reason in the reason form, so the reason is read from &lt;key&gt;.reason (CFR-002); words is allowed_words, a list like the others, so the words map branch goes (TMF-006, TMF-007); LOOSENED_SETTINGS holds the keys
- PRIMITIVE_EXCEPTIONS (test (test.each), 15-15): **keep** to `tests/unit/cli/commands/set/reasons.test.ts` `$key keeps its reason through list edits`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; table of the test above; PRIMITIVE_EXCEPTIONS becomes LOOSENED_SETTINGS, and its rows hold the renamed keys
- $key child replacement preserves root and sibling reasons and restores inheritance (test (test.each), 77-137): **keep** to `tests/unit/cli/commands/set/reasons.test.ts` `$key set in a scope keeps the root and sibling reasons, and unset restores the inherited value`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real; CMD-092: unset then set replaces --replace, and unset replaces --default; no \[reasons\] (CFR-002): the root value and the scope value each carry their own reason form, and unset of the scope value removes its value and reason; the keys follow LOOSENED_SETTINGS
- PRIMITIVE_EXCEPTIONS.filter((entry) =&gt; entry.key !== 'words') (test (test.each), 77-77): **keep** to `tests/unit/cli/commands/set/reasons.test.ts` `$key set in a scope keeps the root and sibling reasons, and unset restores the inherited value`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; table of the test above
- license presence needs a reason only when its declared requirement is weakened (test (test), 139-176): **keep** to `tests/unit/cli/commands/set/reasons.test.ts` `turning off the license requirement needs a reason, and turning it on needs none`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real; no \[reasons\] (CFR-002): the loosened value is docs.require_license = { value = false, reason = "..." }, and setting it back to true writes the plain value
- Git download hosts require a reviewed allowance while HTTPS remains mandatory (test (test), 178-214): **keep** to `tests/unit/cli/checks/general/dependencies/lockfile-hosts.test.ts` `Git download hosts need a reviewed allow-list entry, and HTTPS stays required`. TCM-033: it tests the dependencies/lockfile-hosts check; glossary: allow-list; the setting is dependencies.allowed_registries
- registry allowances stay inside their project scope and reset to inherited defaults (test (test), 216-271): **keep** to `tests/unit/cli/checks/general/dependencies/lockfile-hosts.test.ts` `an allowed registry host applies only in its scope, and unset restores the default`. it observes the lockfile-hosts check per scope and shares HOST_LOCKFILE with the test above; CMD-092: set --default becomes unset; it writes its own two-scope gspot.toml; the setting is dependencies.allowed_registries

## `tests/cli/commands/set/reasons.test.ts`

- (the file) (file): **delete**. TCM-020: tests 1 and 3 repeat other tests, and test 2 tests the deleted naming.allowed setting
- ignores and loosened settings always require reasons and refusals preserve the policy (test (test), 9-33): **delete**. TCM-020: repeats DRY_RUN_REFUSALS rows and the needs-a-reason part of the set reason tests
- named allowances always require a reason and removal restores enforcement (test (test), 35-58): **delete**. naming.allowed is not a setting: it merges into \[\[naming.override\]\] allowed_names, a root record list (TML-005), so gspot set naming.allowed tests a deleted key
- list edits preserve authored reasons and omit defaults for $key $flag (test (test.each), 60-89): **delete**. duplicate: its one new case, a list edit that keeps the links.allowed\_urls reason, repeats '$key keeps its reason through list edits' in set/reasons.test.ts
- \[ { key: 'naming.banned', flag: '', item: 'added', expected: \['original', 'added'\] }, { key: 'naming.banned', fl (test (test.each), 60-67): **delete**. duplicate: rows of the deleted list-edit test

## `tests/cli/commands/set/typed-tables.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/set/values.test.ts`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; one test of commands/set.ts; its table data goes to tests/config/set.ts (TTC-037)
- gspot set writes a list of tables typed the TOML way as tables, and the policy refuses quoted ones (test (test), 11-39): **keep** to `tests/unit/cli/commands/set/values.test.ts` `set writes TOML-typed tables as tables, refuses unreadable input, and gspot.toml refuses quoted tables`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; real

## `tests/cli/commands/set/words.test.ts`

- (the file) (file): **delete**. it tests the Vale word list that generation/prose.ts makes, not gspot set, and its one test is a duplicate
- accepted words reach the generated Vale word file (test (test), 9-28): **delete**. duplicate: your allowed word appears once beside the selected product words and an unselected word is absent, which 'the Vale vocabulary joins selected product words and your words once each' in generation/vale.test.ts checks through emitAll, with the same once-only check for a word that is also a product name

## `tests/cli/configurations/detect.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/detect.test.ts`. TCM-017: tests repository/detect.ts; with the data in tests/config/detect.ts the kept detect tests are about 210 lines, so one file; joined by testing-library.test.ts (TCM-016)
- proposes a language from an extension and the defaults for every repository (test (test), 25-29): **keep** to `tests/unit/cli/repository/detect.test.ts` `detection proposes a language from an extension and the always-selected configurations`. real
- TanStack Query detects the declared %s adapter and drops the evidence when removed (test (test.each), 31-59): **delete**. weak (four TanStack adapters repeat one dependency glob; TCM-016); dependency-glob detection stays tested by testing-library.test.ts, and the 'gspot add' suggestion of detectUnselected by doctor.test.ts 'doctor reports a new Python file after setup with the command that adds its configuration'
- \[ '@tanstack/vue-query', '@tanstack/svelte-query', '@tanstack/solid-query', '@tanstack/angular-query-exp (test (test.each), 31-36): **delete**. weak (table of the deleted TanStack test, TCM-016)
- %s detects the supported project path %s without unrelated file evidence (test (test.each), 61-97): **delete**. weak (23 rows copy the \[detect\] tables of shipped manifests and run one code path; TCM-016)
- \[ \['cloudflare', 'wrangler.toml', undefined\], \['cloudflare', 'apps/api/wrangler.toml', undefined\], \['cloudfl (test (test.each), 61-85): **delete**. weak (table of the deleted file-name detection test, TCM-016)
- a JavaScript package with TypeScript tooling and %s declarations needs real TypeScript project evidence (test (test.each), 99-127): **keep** to `tests/unit/cli/repository/detect.test.ts` `TypeScript tooling with %s declarations needs a tsconfig.json to propose typescript`. real
- \['.d.ts', '.d.mts', '.d.cts'\] (test (test.each), 99-99): **keep** to `tests/unit/cli/repository/detect.test.ts` `TypeScript tooling with %s declarations needs a tsconfig.json to propose typescript`. table of the test above
- Python project detection uses captured dependencies after the authored manifest changes (test (test), 129-140): **delete**. TCM-043: proves nothing that the Python dependency test does not
- Python dependency detection reads $name from $path (test (test.each), 142-166): **keep** to `tests/unit/cli/repository/detect.test.ts` `Python dependencies are read from $name in $path`. real
- PYTHON_DEPENDENCY_CASES (test (test.each), 142-142): **keep** to `tests/unit/cli/repository/detect.test.ts` `Python dependencies are read from $name in $path`. table of the test above
- $name determines runtime applicability within its project (test (test.each), 168-190): **keep** to `tests/unit/cli/repository/detect.test.ts` `$name decides runtime detection within its project`. real; the rows come from runtimeDetectionRows in tests/setup/sandbox.ts (THR-043)
- runtimeEvidenceCases() (test (test.each), 168-168): **keep** to `tests/unit/cli/repository/detect.test.ts` `$name decides runtime detection within its project`. table of the test above
- Swift test detection identifies $name (test (test.each), 192-202): **keep** to `tests/unit/cli/repository/detect.test.ts` `Swift test detection: $name`. real
- SWIFT_TEST_CASES (test (test.each), 192-192): **keep** to `tests/unit/cli/repository/detect.test.ts` `Swift test detection: $name`. table of the test above
- Swift package test detection recognizes $name (test (test.each), 204-213): **keep** to `tests/unit/cli/repository/detect.test.ts` `Swift package test targets: $name`. real
- SWIFT_TARGET_CASES (test (test.each), 204-204): **keep** to `tests/unit/cli/repository/detect.test.ts` `Swift package test targets: $name`. table of the test above
- Postgres detection reads $name from "$scope" and leaves sibling scopes independent (test (test.each), 215-242): **delete**. weak (five libraries times two scopes repeat one dependency lookup; TCM-016); scoped npm and Python dependency detection, sibling independence and removal stay tested by 'Python dependency detection reads $name from $path' and testing-library.test.ts
- POSTGRES_DEPENDENCY_CASES.flatMap((entry) =&gt; \['', 'apps/api'\].map((scope) =&gt; ({ ...entry, scope }))) (test (test.each), 215-215): **delete**. weak (table of the deleted Postgres dependency test, TCM-016)
- Postgres content detection handles $name in "$scope" without borrowing sibling evidence (test (test.each), 244-266): **keep** to `tests/unit/cli/repository/detect.test.ts` `Prisma content detection handles $name in "$scope" and not in a sibling scope`. real
- POSTGRES_CONTENT_CASES.flatMap((entry) =&gt; \['', 'apps/api'\].map((scope) =&gt; ({ ...entry, scope }))) (test (test.each), 244-244): **keep** to `tests/unit/cli/repository/detect.test.ts` `Prisma content detection handles $name in "$scope" and not in a sibling scope`. table of the test above
- Postgres content detection retains native missing-file behavior and refuses invalid declared patterns (test (test), 268-284): **keep** to `tests/unit/cli/repository/detect.test.ts` `content detection skips a deleted file and refuses an invalid pattern`. real
- Prisma content discovery returns the native read error while ordinary sessions retain manual selection (test (test), 286-310): **keep** to `tests/unit/cli/repository/detect.test.ts` `a Prisma read error stops detection, and a session with saved choices does not read the file`. real

## `tests/cli/configurations/errors.test.ts`

- (the file) (file): **split** to `tests/unit/cli/configurations/schema/parts.test.ts; tests/unit/cli/configurations/schema/tool.test.ts; tests/unit/cli/configurations/schema/manifest.test.ts`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file; LIF-007, ROOT-017: assertManifests moves to scripts/, whose tests are deleted; LIF-006, TCM-008 delete the table-order and removed-key tests; the manifest schema tests join the tests of configurations/schema/ (PAR-009)
- assertManifests setting meanings (describe (describe), 18-36): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests setting meanings &gt; two configurations must agree on a setting meaning and may differ only in its default (test (test), 19-35): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests check replacements (describe (describe), 38-75): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests check replacements &gt; an invalid replacement is refused and a different declared check is accepted (test (test), 39-60): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests check replacements &gt; circular replacement is refused before either check can suppress execution (test (test), 62-74): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests native version prerequisites (describe (describe), 77-112): **delete**. the describe of the assertManifests version tests goes; its one schema test moves to schema.test.ts
- assertManifests native version prerequisites &gt; a native floor requires a declared tool even when its command names that tool (test (test), 78-85): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests native version prerequisites &gt; native version floors validate their consumer and version command: $target $diagnostic (test (test.each), 86-100): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests native version prerequisites &gt; MINIMUM_VERSION_CASES (test (test.each), 86-86): **delete**. table of the deleted test
- assertManifests native version prerequisites &gt; a malformed native version floor %s is refused at the manifest boundary (test (test.each), 102-111): **keep** to `tests/unit/cli/configurations/schema/parts.test.ts` `a malformed version floor %s is refused`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (versionFloorSchema in parts.ts); it tests versionFloorSchema (configurations/schema/parts.ts, PAR-009); TCM-048: one row per branch
- assertManifests native version prerequisites &gt; INVALID_VERSION_FLOORS (test (test.each), 102-102): **keep** to `tests/unit/cli/configurations/schema/parts.test.ts` `a malformed version floor %s is refused`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (versionFloorSchema in parts.ts); table of the test above; TCM-048
- assertManifests installation and guide declarations (describe (describe), 114-159): **delete**. the describe of assertManifests tests goes
- assertManifests installation and guide declarations &gt; a manifest whose tool is not pinned is refused: %s (test (test.each), 115-123): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests installation and guide declarations &gt; \[ \['\[\[tool\]\]\\nname = "unpinned"\\nnpm = "unpinned"\\n', 'has no version and no floor'\], \['\[\[tool\]\]\\nname = (test (test.each), 115-118): **delete**. table of the deleted test
- assertManifests installation and guide declarations &gt; 'a ${argument} check reading an empty setting validates $name' (test (test.each), 126-148): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- assertManifests installation and guide declarations &gt; \[ { name: 'an absent wait', wait: '', message: 'must wait for it' }, { name: 'an (test (test.each), 126-134): **delete**. table of the deleted test
- assertManifests installation and guide declarations &gt; a conditional agent guide must exist in its configuration before selection (test (test), 150-158): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- a generated config refuses an undeclared consuming tool and accepts a tool declared by another configuration (test (test), 161-191): **delete**. tests assertManifests, which moves to scripts/ (LIF-007, ROOT-017); tests of scripts/ are deleted; the build runs it over every shipped manifest
- replacement refuses $name (test (test.each), 193-215): **keep** to `tests/unit/cli/configurations/schema/tool.test.ts` `a replace row refuses $name`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (toolSchema and replacementSchema in tool.ts); real; tests the manifest schema (PAR-009)
- \[ { name: 'a key without shared ownership', selection: 'key = "eslintConfig"', message: 'A s (test (test.each), 193-209): **keep** to `tests/unit/cli/configurations/schema/tool.test.ts` `a replace row refuses $name`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (toolSchema and replacementSchema in tool.ts); table of the test above
- a replacement selecting a shared key preserves the containing file (test (test), 217-223): **delete**. weak (only asserts that parsing does not throw); a shared key selection is parsed and checked in full by 'native replacement filename lists retain shared sections and refuse invalid items'
- native root selectors retain fragment-only component and import refusals (test (test), 225-231): **delete**. TCM-008: checks a removed key (imports); the strict schema refuses every unknown key
- native file matchers supply detection only when the manifest omits its detection table (test (test), 233-246): **keep** to `tests/unit/cli/configurations/schema/manifest.test.ts` `a manifest without [detect] takes the matchers of [files]`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (manifestSchema and checkSchema in manifest.ts); real; a schema transform (PAR-009)
- native check declarations require a title and refuse deleted reviewer and borrowed-check fields (test (test), 248-259): **delete**. self-policing (refuses the retired keys alternatives_checked and borrowed_checks one by one; TCM-008)
- native manifest headers refuse wrong section order and separate nested values (test (test), 261-277): **delete**. LIF-006: deletes manifestTableErrors and MANIFEST_TABLE_ORDER (house table order)
- native replacement filename lists retain shared sections and refuse invalid items (test (test), 279-294): **keep** to `tests/unit/cli/configurations/schema/tool.test.ts` `a replaces list keeps shared sections and refuses invalid items`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (toolSchema and replacementSchema in tool.ts); real
- per-scope tool files retain their native declaration and refuse the retired key (test (test), 296-303): **delete**. TCM-008: checks a removed key (scoped)
- retired component globs are refused instead of replacing native tool extensions (test (test), 305-308): **delete**. TCM-008: checks a removed key (component_globs)

## `tests/cli/configurations/owners.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/select.test.ts`. TCM-017: tests isOwned and ownedBy, which move from repository/selection/public.ts to repository/select.ts (glossary: covers); joined by the scope selection test of select.test.ts
- File readers claim only their declared formats (test (test), 17-26): **delete**. TCM-015: mirrors shipped manifest data
- owners (describe (describe), 28-89): **keep** to `tests/unit/cli/repository/select.test.ts` `covers`. real; glossary: covers replaces owns
- owners &gt; match by extension, filename at any depth, tag and glob (test (test), 29-39): **keep** to `tests/unit/cli/repository/select.test.ts` `files are covered by extension, file name at any depth, tag and glob`. real
- owners &gt; a repository configuration with language ownership selects the language files (test (test), 41-52): **keep** to `tests/unit/cli/repository/select.test.ts` `a configuration that covers the language files gets them`. real
- owners &gt; a scope narrows the file set (test (test), 54-65): **delete**. duplicate: a scope narrows the covered files to its own folder, and 'migration paths in scope "%s" are covered and other file kinds are not' runs ownedBy for the root, app and other scopes and checks the same narrowing
- owners &gt; Prettier plugin file ownership follows the selected configurations %j (test (test.each), 67-88): **keep** to `tests/unit/cli/repository/select.test.ts` `the Prettier plugin files follow the selected configurations %j`. real
- owners &gt; \[ \[\['format', 'typescript'\], \['src/index.ts'\]\], \[ \['format', 'typescript', 'astro'\], (test (test.each), 67-77): **keep** to `tests/unit/cli/repository/select.test.ts` `the Prettier plugin files follow the selected configurations %j`. table of the test above
- migration path ownership in "%s" keeps original records and rejects unrelated kinds (test (test.each), 91-104): **keep** to `tests/unit/cli/repository/select.test.ts` `migration paths in scope "%s" are covered and other file kinds are not`. TCM-044: delete the two lines that guard against mutation
- PATH_OWNER_CASES (test (test.each), 91-91): **keep** to `tests/unit/cli/repository/select.test.ts` `migration paths in scope "%s" are covered and other file kinds are not`. table of the test above
- Jest file ownership in "$scope" uses effective test paths without changing records (test (test.each), 106-116): **keep** to `tests/unit/cli/repository/select.test.ts` `Jest covers the test paths of scope "$scope"`. TCM-044: delete the two lines that guard against mutation
- TEST_FILE_OWNER_CASES (test (test.each), 106-106): **keep** to `tests/unit/cli/repository/select.test.ts` `Jest covers the test paths of scope "$scope"`. table of the test above
- manifest file setting reference "$path" accepted=$accepted (test (test.each), 118-128): **move** to `tests/unit/cli/configurations/schema/manifest.test.ts` `a file path setting reference "$path" is accepted: $accepted`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (manifestSchema and checkSchema in manifest.ts); it tests parseManifest and the manifest schema, not coverage
- FILE_PATH_REFERENCES (test (test.each), 118-118): **move** to `tests/unit/cli/configurations/schema/manifest.test.ts` `a file path setting reference "$path" is accepted: $accepted`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (manifestSchema and checkSchema in manifest.ts); table of the test above
- manifests (const, 15-15): **move** to `tests/unit/cli/repository/select.test.ts` `manifests`. module constant used by the coverage tests

## `tests/cli/configurations/pins.test.ts`

- (the file) (file): **move** to `tests/unit/cli/configurations/tool-pins.test.ts`. toolProjectPackage is in configurations/tool-pins.ts (LIF-008); the hint test goes as weak
- the declared $name installer has the expected location and exact version (test (test.each), 13-22): **keep** to `tests/unit/cli/configurations/tool-pins.test.ts` `the $name installers give the tool project kind and the exact version`. real
- \[...TOOL_PROJECT_PACKAGES\] (test (test.each), 13-13): **keep** to `tests/unit/cli/configurations/tool-pins.test.ts` `the $name installers give the tool project kind and the exact version`. table of the test above
- a missing native %s tool gives actionable guidance under %s (test (test.each), 24-51): **delete**. weak: builds the expected hint from OPERATING_SYSTEMS and process.platform, the same logic as installHint, so a bug there passes
- NATIVE_HINTS (test (test.each), 24-24): **delete**. weak: table of the deleted hint test

## `tests/cli/configurations/select.test.ts`

- (the file) (file): **split** to `tests/unit/cli/configurations/select.test.ts; tests/unit/cli/repository/select.test.ts`. TCM-017: selectConfigurations stays with configurations/select.ts; selectForScope goes to the test of repository/select.ts; TCM-015 deletes the data tests
- selectConfigurations (describe (describe), 13-36): **keep** to `tests/unit/cli/configurations/select.test.ts` `selectConfigurations`. real
- selectConfigurations &gt; pulls required configurations in, dependencies first, in order of first mention (test (test), 14-23): **keep** to `tests/unit/cli/configurations/select.test.ts` `adds required configurations, dependencies first, in order of first mention`. real
- selectConfigurations &gt; an unknown configuration names the near matches (test (test), 25-27): **keep** to `tests/unit/cli/configurations/select.test.ts` `an unknown configuration names the near matches`. real
- selectConfigurations &gt; a circular requires fails with the chain (test (test), 29-35): **keep** to `tests/unit/cli/configurations/select.test.ts` `a requires cycle fails with the chain`. real
- scope %s retains configuration %s: %s (test (test.each), 38-44): **keep** to `tests/unit/cli/repository/select.test.ts` `scope %s selects configuration %s: %s`. real; selectForScope is in repository/select.ts
- PROJECT_SELECTIONS (test (test.each), 38-38): **keep** to `tests/unit/cli/repository/select.test.ts` `scope %s selects configuration %s: %s`. table of the test above
- %s keeps %s required and OpenAPI suggested (test (test.each), 46-61): **delete**. TCM-015: mirrors manifest data
- OPENAPI_FRAMEWORKS (test (test.each), 46-46): **delete**. table of the deleted test
- %s retains its %s category in root, inherited and manual child selections (test (test.each), 63-87): **delete**. TCM-015: mirrors manifest data; one case with a made-up infra manifest covers sourceConfigurations in the selectConfigurations tests
- CONFIGURATION_CATEGORIES (test (test.each), 63-63): **delete**. table of the deleted test

## `tests/cli/configurations/suppressions.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; it tests the shipped suppression patterns that the gspot/suppressions check runs (structure/public.ts moves to checks/general/gspot/suppressions.ts, CKG-028)
- the %s configuration reads %s suppressions and their reasons (test (test.each), 6-19): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `the %s suppression pattern of %s finds the comment and its reason`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; real
- SUPPRESSION_REASONS (test (test.each), 6-6): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `the %s suppression pattern of %s finds the comment and its reason`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; table of the test above

## `tests/cli/configurations/takeover.test.ts`

- (the file) (file): **split** to `tests/unit/cli/repository/tooling/files.test.ts; tests/unit/cli/repository/tooling/hooks.test.ts`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; TCM-017, TCM-032: tests repository/discovery (repository/tooling.ts); split into hook discovery and the rest to stay under 300 lines
- hook discovery preserves path whitespace and refuses malformed Git configuration (test (test), 21-37): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `hook discovery keeps spaces in core.hooksPath and refuses a broken Git configuration`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- a hooks folder outside the repository that core.hooksPath names is listed (test (test), 39-51): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a hooks folder outside the repository that core.hooksPath names is listed`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- 'simple-git-hooks is detected when its authored value is ${value}' (test (test), 54-60): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `simple-git-hooks is found from its package.json key`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; TCM-048: one value (the code checks only that the key exists); TPR-024: no for loop around test
- ast-grep adoption leaves a Qlty configuration unselected (test (test), 62-68): **delete**. TCM-041: wrong name, and an empty repository gives the same answer
- pre-commit is detected from its native configuration (test (test), 70-77): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `pre-commit is found from its configuration file`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real; the title drops "native"
- adoption discovers nested authored configuration without adopting managed or vendored inputs (test (test), 79-91): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `tool discovery finds nested tool files and skips .gspot and vendored folders`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real; the title drops "adoption"
- CI discovery recognizes $name (test (test.each), 93-144): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `CI discovery recognizes $name`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- \[ { name: 'GitHub run steps', path: '.github/workflows/check.yml', document: { j (test (test.each), 93-140): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `CI discovery recognizes $name`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; table of the test above
- CI discovery reports malformed YAML (test (test), 146-151): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `CI discovery reports malformed YAML`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- hook discovery ignores package content without a hook declaration (test (test), 153-157): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `hook discovery ignores a package.json without hooks`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- hook discovery rejects malformed package JSON (test (test), 159-164): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `hook discovery refuses a malformed package.json`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- tool discovery reads linked authored sections inside the repository (test (test), 166-178): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `tool discovery reads tool sections through a link inside the repository`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- hook discovery reports foreign folders and leaves managed and task scripts available for installation (test (test), 180-195): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `hook discovery reports other hook folders and leaves gspot and task scripts out`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- a linked $path counts as $kind without exposing external hook files (test (test.skipIf), 197-213): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a linked $path counts as $kind without reading hook files outside`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real; TCM-024: runs on Windows too
- LINKED_HOOK_FOLDERS (test (test.skipIf), 197-197): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a linked $path counts as $kind without reading hook files outside`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; table of the test above
- !isPosix (test (test.skipIf), 197-197): **delete**. TCM-024: the Windows skip is not needed
- a linked %s counts as present without reading an external rules folder (test (test.skipIf), 215-231): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `a linked %s counts as present without reading a rules folder outside`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real; TCM-024: runs on Windows too
- LINKED_RULE_FOLDERS (test (test.skipIf), 215-215): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `a linked %s counts as present without reading a rules folder outside`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; table of the test above
- !isPosix (test (test.skipIf), 215-215): **delete**. TCM-024: the Windows skip is not needed
- a linked $path counts as $kinds external configuration (test (test.skipIf), 233-245): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a linked $path counts as $kind configuration`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real; TCM-024: runs on Windows too
- LINKED_HOOK_FILES (test (test.skipIf), 233-233): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a linked $path counts as $kind configuration`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; table of the test above
- !isPosix (test (test.skipIf), 233-233): **delete**. TCM-024: the Windows skip is not needed
- hook discovery reports %s (test (test.each), 247-257): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `hook discovery reports %s`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; real
- LEFTHOOK_FILES (test (test.each), 247-247): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `hook discovery reports %s`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; table of the test above; the three lefthook file names are one lookup list, so one row stays
- tool discovery propagates a contained directory %s read failure (test (test.each), 259-273): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a read error in a hooks folder reaches the caller`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; TCM-048: one error code (EIO and EACCES take the same rethrow)
- SURVEY_READ_ERRORS (test (test.each), 259-259): **keep** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a read error in a hooks folder reaches the caller`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; table of the test above; one code left (TCM-048)
- $name reports $runner without inventing a runner file (test (test.each), 275-290): **delete**. test of deleted code: Tooling.runner, runnerFile and the mise.toml precedence go, and the hooks generator reads the start command from the repository (INX-003)
- RUNNER_CASES (test (test.each), 275-275): **delete**. test of deleted code: rows of the deleted runner discovery test (INX-003)

## `tests/cli/configurations/testing-library.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/detect.test.ts`. TCM-016: becomes the dependency-glob case of the detection tests, in the one detect test file
- Testing Library detects %s only in the project scope that declares it (test (test.each), 8-30): **keep** to `tests/unit/cli/repository/detect.test.ts` `Testing Library is detected from %s only in the scope that declares it`. TCM-016: the dependency-glob case
- \['@testing-library/react', '@testing-library/dom', '@testing-library/custom-adapter'\] (test (test.each), 8-8): **keep** to `tests/unit/cli/repository/detect.test.ts` `Testing Library is detected from %s only in the scope that declares it`. table of the test above; TCM-016, TCM-048: one package

## `tests/cli/configurations/tools.test.ts`

- (the file) (file): **split** to `tests/unit/cli/configurations/manifests.test.ts; tests/unit/cli/configurations/schema/tool.test.ts`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file; TCM-015 deletes the data tests; the linkManifestTools tests go to the test of configurations/manifests.ts, the tool schema test to schema/tool.test.ts; the assertManifests lines go (LIF-007)
- %s receives the complete %s declaration of %s in either selection order (test (test.each), 11-25): **delete**. TCM-015: mirrors shipped manifest data
- \[ \['github-actions', 'bash', 'shellcheck'\], \['nginx', 'docker', 'docker'\], \['openapi', 'files', 'ajv'\], (test (test.each), 11-16): **delete**. table of the deleted test
- independent tool declarations are refused even with second version %s (test (test.each), 27-40): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a tool declared by two configurations is refused`. TCM-048: one version (any second declaration is refused); the assertManifests half goes (LIF-007)
- \['1.0.0', '2.0.0'\] (test (test.each), 27-27): **delete**. TCM-048: the version table goes; one case
- name-only declarations resolve by registry name and refuse an absent owner (test (test), 42-61): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a tool named without a declaration links to the configuration that declares it, and fails when none does`. real; the assertManifests lines go (LIF-007)
- native tool fields and installer constraints keep their validation (test (test), 63-79): **keep** to `tests/unit/cli/configurations/schema/tool.test.ts` `a tool declaration refuses unknown fields and bad installer constraints`. configurations/schema.ts becomes the folder configurations/schema/, so each test follows its schema file (toolSchema and replacementSchema in tool.ts); real; NMS-026: kind binary becomes program; the title drops "native"
- manual Actions selection keeps ShellCheck metadata at %s in root and child scopes (test (test.each), 81-105): **delete**. TCM-015: mirrors shipped manifest data
- \['recommended', 'all'\] as const (test (test.each), 81-81): **delete**. table of the deleted test

## `tests/cli/docs.test.ts`

- (the file) (file): **delete**. self-policing: keeps two copies of the quickstart example equal
- the TypeScript quickstart retains every recorded source block in order (test (test), 8-23): **delete**. self-policing: keeps two copies of the quickstart example equal

## `tests/cli/scripts/pins.test.ts`

- (the file) (file): **delete**. SCR-007: check:pins becomes a by-hand existence check; tests of scripts/ are deleted
- pin validation requests shared releases once and leaves system tools and unpublished workspace packages out (test (test), 26-36): **delete**. SCR-007; tests of scripts/ are deleted
- pin validation reports missing releases and incompatible ESLint peers, preserving registry failures (test (test), 38-56): **delete**. SCR-007; tests of scripts/ are deleted
- pin validation rejects malformed registry metadata before compatibility checks (test (test), 58-66): **delete**. SCR-007; tests of scripts/ are deleted
- npm packing metadata accepts local archives and rejects missing or escaping output names (test (test), 68-73): **delete**. SCR-007; tests of scripts/ are deleted
- shared pin metadata rejects malformed native release, identity, image and LTS documents (test (test), 75-80): **delete**. SCR-007; tests of scripts/ are deleted
- the %s hosted image keeps update notices separate from invalid pins (test (test.each), 82-125): **delete**. SCR-007; tests of scripts/ are deleted
- RUNNER_IMAGE_CASES (test (test.each), 82-82): **delete**. SCR-007; tests of scripts/ are deleted

## `tests/cli/scripts/plugin.test.ts`

- (the file) (file): **delete**. THR-004: tests the test runner and builds the CLI inside the unit suite
- canceling workspace package packing with %s returns its signal status and removes its process and archives (test (test.skipIf), 14-64): **delete**. THR-004: tests the test runner and builds the CLI inside the unit suite
- \[ \['SIGINT', 130\], \['SIGTERM', 143\], \] as const (test (test.skipIf), 14-17): **delete**. THR-004: tests the test runner and builds the CLI inside the unit suite
- !isPosix (test (test.skipIf), 14-14): **delete**. THR-004: tests the test runner and builds the CLI inside the unit suite

## `tests/cli/scripts/release.test.ts`

- (the file) (file): **delete**. TCM-010: a repository-state check; the release workflow runs the script; tests of scripts/ are deleted
- release validation refuses %s (test (test.each), 11-15): **delete**. TCM-010
- INVALID_RELEASE_TAGS (test (test.each), 11-11): **delete**. TCM-010
- release validation accepts the stable package version and its matching plugin pin (test (test), 17-24): **delete**. TCM-010
- script (const, 9-9): **delete**. TCM-010

## `tests/cli/terminal.test.ts`

- (the file) (file): **move** to `tests/unit/cli/terminal/check-report.test.ts`. tests runText and progress (terminal/contracts.ts becomes terminal/check-report.ts, CMD-058); REPORT goes to tests/config/terminal.ts
- the reporter (describe (describe), 9-51): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `the check report`. real
- the reporter &gt; skipped checks do not count as passes and an empty canceled run is incomplete (test (test), 10-34): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `skipped checks do not count as passed, and an empty canceled run is incomplete`. real; CMD-092 deletes --quiet: assert at normal output
- the reporter &gt; prints one line per check, findings file first with a help line, reproduce lines and the summary (test (test), 35-44): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `one line per check, the findings with a help line, the reproduce lines and the summary`. real
- the reporter &gt; --quiet hides passing checks and --verbose prints ignores with reasons (test (test), 46-50): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `--verbose prints ignores with their reasons`. CMD-092 deletes --quiet, so the quiet half goes
- findings that share a help print it once, after the last of them (test (test), 53-71): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `findings that share a help print it once, after the last of them`. real
- report colors follow the configured output mode without changing its text (test (test), 73-85): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `colors change the report only by escape codes`. real
- the reporter identifies $content comparisons and hides the header in quiet mode (test (test.each), 87-98): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `the report names $content comparisons`. CMD-092 deletes --quiet, so the quiet assertion goes
- \[ { content: 'working-tree', header: 'Working tree compared with the merge base of main.\\n' }, { content: 'index (test (test.each), 87-91): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `the report names $content comparisons`. table of the test above; ComparisonCase goes, the rows use as const
- the reporter names the cause of a skipped check (test (test), 100-103): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `the report names the cause of a skipped check`. real
- a failed $hook report prints each reproduction once and the hook bypass (test (test.each), 105-117): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `a failed $hook report prints each reproduce line once and the hook bypass`. real
- \[ { hook: 'pre-commit', command: 'commit' }, { hook: 'commit-msg', command: 'commit' }, { hook: 'pre-push', (test (test.each), 105-109): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `a failed $hook report prints each reproduce line once and the hook bypass`. table of the test above; --hook takes pre-commit and pre-push only (CLX-006), so the commit-msg row goes
- terminal progress includes passed and skipped checks while log output keeps failures (test (test), 119-148): **keep** to `tests/unit/cli/terminal/check-report.test.ts` `terminal progress prints passed and skipped checks, and log output only failures`. real
- quiet terminal progress hides successful checks but retains execution errors (test (test), 150-165): **delete**. CMD-092 deletes --quiet

## `tests/config/cli/agent-rules.ts`

- (the file) (file): **move** to `tests/config/rules.ts`. only RUNTIME_RULE_CASES stays (TCM-007 deletes the rest); agent-rules becomes rules (glossary), so the file is tests/config/rules.ts
- RULE_CONFIGURATIONS (const exported, 2-16): **delete**. TCM-007
- CHECKED_RULE_LINES (const exported, 19-29): **delete**. TCM-007
- UPSTREAM_GUIDES (const exported, 32-44): **delete**. TCM-007
- RUNTIME_RULE_CASES (const exported, 47-52): **move** to `tests/config/rules.ts` `RUNTIME_RULE_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/

## `tests/config/cli/commands/check/cancellation.ts`

- (the file) (file): **move** to `tests/config/check.ts`. one user; the data of the gspot check command tests goes to tests/config/check.ts, and SLOW_CHECK, a four-word argv, stays in its test
- SLOW_CHECK (const exported, 2-2): **inline** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `check passes %s to a running tool and reports the run as canceled`. the tests of commands/check/command.ts exceed 300 lines with the joined tool-free tests, so they sit in command/ by behavior; one user; four arguments
- SLOW_TOOL_PROGRAM (const exported, 5-6): **move** to `tests/config/check.ts` `SLOW_TOOL_PROGRAM`. one user; its doc comment goes (TPP-045); a program text, not a single short literal, so tests/config/

## `tests/config/cli/commands/check/feedback.ts`

- (the file) (file): **move** to `tests/config/check.ts`. one user; test data goes to tests/config/ by topic, and DETECTED_SOURCE, one short line, stays in its test
- FIXER_FEEDBACK_CASES (const exported, 2-34): **move** to `tests/config/check.ts` `FIXER_FEEDBACK_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- DETECTED_SOURCE (const exported, 37-37): **inline** to `tests/unit/cli/commands/check/tree/fixes.test.ts` `check --fix reports $name, and --dry-run writes nothing`. the tests of commands/check/tree.ts exceed 300 lines, so they sit in tree/ by behavior; one user, one line

## `tests/config/cli/commands/check/refusals.ts`

- (the file) (file): **move** to `tests/config/check.ts`. one user; the refusal tables join the check command data in tests/config/check.ts
- FIX_REFUSALS (const exported, 2-6): **move** to `tests/config/check.ts` `FIX_REFUSALS`. one user; its doc comment goes (TPP-045); test data, so tests/config/; the '--dry-run requires --fix.' row goes (CLX-007)
- PUSH_INPUT_REFUSALS (const exported, 8-24): **move** to `tests/config/check.ts` `PUSH_INPUT_REFUSALS`. one user; its doc comment goes (TPP-045); TCM-002: the two UTF-8 rows merge into one that expects the gspot error; test data, so tests/config/
- SELECTION_REFUSALS (const exported, 26-30): **move** to `tests/config/check.ts` `ARGUMENT_REFUSALS`. one user; its doc comment goes (TPP-045); CMD-050 retires "selection" for narrowing; test data, so tests/config/
- PUSH_ARGUMENT_REFUSALS (const exported, 33-36): **move** to `tests/config/check.ts` `PUSH_ARGUMENT_REFUSALS`. one user; its doc comment goes (TPP-045); test data, so tests/config/; one row only

## `tests/config/cli/commands/check/verbosity.ts`

- (the file) (file): **move** to `tests/config/check.ts`. one user; both constants join the check command data in tests/config/check.ts
- VERBOSITY_CASES (const exported, 2-8): **move** to `tests/config/check.ts` `VERBOSITY_CASES`. one user; its doc comment goes (TPP-045); CMD-092 deletes --quiet: two rows left; test data, so tests/config/
- VERBOSITY_ARGS (const exported, 11-11): **move** to `tests/config/check.ts` `VERBOSITY_ARGS`. one user; its doc comment goes (TPP-045); --base HEAD stays; command arguments are static values, so tests/config/

## `tests/config/cli/commands/explain.ts`

- (the file) (file): **move** to `tests/config/explain.ts`. one user; the explain command data goes to tests/config/explain.ts
- EXPLAIN_POLICY (const exported, 1-11): **move** to `tests/config/explain.ts` `EXPLAIN_SETTINGS`. one user; its doc comment goes (TPP-045); glossary: "policy" is retired; test data, so tests/config/; EXPLAIN_SETTINGS because GSPOT_TOML also names a different value in tests/config/set.ts; the sample writes a \[\[scope\]\] record with path = "api"
- REASON_VALUES (const exported, 13-53): **move** to `tests/config/explain.ts` `REASON_VALUES`. one user; its doc comment goes (TPP-045); test data, so tests/config/; dependencies.registry_hosts is dependencies.allowed_registries (NMU-015) and naming.banned is naming.banned_words; values that need a reason are written in the reason form (CFR-002)
- NEUTRAL_SETTING_VALUES (const exported, 56-64): **move** to `tests/config/explain.ts` `NEUTRAL_SETTING_VALUES`. one user; its doc comment goes (TPP-045); test data, so tests/config/; the tools.v8r.schemas row goes because \[\[tools.v8r.schema\]\] records live at the root, so one row is left

## `tests/config/cli/commands/ignore.ts`

- (the file) (file): **move** to `tests/config/ignore.ts`. its constants follow their tests; the file keeps its name in tests/config/ and holds the data of the ignore, unignore and path-ignore run tests
- QUALITY_COMMAND (const exported, 2-8): **move** to `tests/config/ignore.ts` `QUALITY_COMMAND`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- QUALITY_FIX (const exported, 10-16): **move** to `tests/config/ignore.ts` `QUALITY_FIX`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- TWO_RULES (const exported, 19-30): **move** to `tests/config/ignore.ts` `TWO_RULES`. one user; a 12-line gspot.toml text is not a single short literal, so tests/config/; the inline table is \[rules\] (TML-003)
- IGNORE_CASES (const exported, 33-41): **inline** to `tests/unit/cli/commands/ignore.test.ts` `ignore of an unknown check exits 2 and leaves gspot.toml byte for byte`. one row left, written in the test
- IGNORE_FEEDBACK_CASES (const exported, 44-51): **move** to `tests/config/ignore.ts` `UNIGNORE_CASES`. one user; its doc comment goes (TPP-045); CMD-092: ignore --remove becomes unignore; test data, so tests/config/

## `tests/config/cli/commands/init/ci.ts`

- (the file) (file): **move** to `tests/config/init.ts`. both constants end in the CI proposal tests (the --ci test is deleted); the init CI data joins the init topic file in tests/config/
- INIT_CI_CASES (const exported, 2-9): **move** to `tests/config/init.ts` `LINT_JOBS`. its other user, the --ci test, is deleted (CMD-092); the name says what the rows hold; test data, so tests/config/
- CI_PREFERENCE_CASES (const exported, 12-24): **move** to `tests/config/init.ts` `CI_PREFERENCE_CASES`. one user; its doc comment goes (TPP-045); TCM-019 adds a row; test data, so tests/config/

## `tests/config/cli/commands/init/policy-text.ts`

- (the file) (file): **move** to `tests/config/init.ts`. its constants follow their tests; 'policy-text' uses a retired word, and the data belongs to the init topic file in tests/config/
- CONFIGURATIONS (const exported, 1-19): **move** to `tests/config/init.ts` `INIT_CONFIGURATIONS`. one user; its doc comment goes (TPP-045); test data, so tests/config/; the bare name CONFIGURATIONS says nothing once the constant leaves its test
- SDK_DESTINATIONS (const exported, 21-29): **move** to `tests/config/init.ts` `SDK_DESTINATIONS`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- MANUAL_SWIFT_CHOICES (const exported, 31-40): **move** to `tests/config/init.ts` `TEMPLATE_SWIFT_CHOICES`. one user; its doc comment goes (TPP-045); the choices come from a template; test data, so tests/config/; the "disabled project" and 'empty destination' rows go because the "" forms are deleted and absent means no value (TML-010), and the other rows write xcode.project and xcode.destination (POL-033)
- FORMAT_CASES (const exported, 42-89): **move** to `tests/config/init.ts` `FORMAT_FILE_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/; FORMAT_FILE_CASES because tests/config/formatting.ts has a FORMAT_CASES with another meaning
- SCOPE_FORMAT_FILES (const exported, 91-97): **move** to `tests/config/init.ts` `SCOPE_FORMAT_FILES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- FORMAT_REFUSALS (const exported, 99-102): **delete**. data used only by the deleted fake refusal test 'initialization refuses $name without writing'
- SCOPE_FORMAT_CASES (const exported, 104-125): **move** to `tests/config/init.ts` `SCOPE_FORMAT_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/

## `tests/config/cli/commands/init/questions.ts`

- (the file) (file): **delete**. every constant goes: the runner and default-answer data serve tests of deleted code (CLX-001), and RUNNER_OPTIONS is a copy of a list
- RUNNER_ANSWERS (const exported, 2-5): **delete**. test data of deleted code: the runner question (CLX-001)
- RUNNER_FAILURES (const exported, 8-21): **delete**. test data of deleted code: the runner refusals (CLX-001)
- RUNNER_OPTIONS (const exported, 24-31): **delete**. fake data: a copy of the runner labels, used only to compare the prompt with itself; the runner question is deleted (CLX-001)
- DEFAULT_ANSWERS (const exported, 34-34): **delete**. test data of deleted code: the default answers (CLX-001)

## `tests/config/cli/commands/init/refusals.ts`

- (the file) (file): **move** to `tests/config/init.ts`. one user; GIT_PLAN_CASES joins the init topic file in tests/config/, and the one ARGUMENT_REFUSALS row becomes plain literals in its test
- ARGUMENT_REFUSALS (const exported, 1-8): **inline** to `tests/unit/cli/commands/init/command/refusals.test.ts` `init with an unknown configuration exits 2 and writes nothing`. the tests of commands/init/command.ts exceed 300 lines, so they sit in command/ by behavior; CMD-092 deletes the --ci row; one row left
- GIT_PLAN_CASES (const exported, 11-14): **move** to `tests/config/init.ts` `GIT_PLAN_CASES`. one user; a two-row table, not a single short literal, so tests/config/
- UNSAFE_SCOPE_CASES (const exported, 17-21): **delete**. its test goes with --scope-configurations (CMD-092)

## `tests/config/cli/commands/init/replace.ts`

- (the file) (file): **move** to `tests/config/replace.ts`. one user; the init replace data goes to tests/config/replace.ts (glossary: replace)
- PYPROJECT_TAKEOVERS (const exported, 2-24): **move** to `tests/config/replace.ts` `REPLACED_PYPROJECT_TABLES`. one user; its doc comment goes (TPP-045); glossary: replace, not takeover; test data, so tests/config/

## `tests/config/cli/commands/init/selection.ts`

- (the file) (file): **move** to `tests/config/init.ts`. both users join selection.test.ts; the init selection data joins the init topic file, and the Vue component joins the component samples
- COMPONENT (const exported, 1-1): **move** to `tests/config/components.ts` `VUE_COMPONENT`. COMPONENT is defined twice with different text, so this one is VUE_COMPONENT; a Vue component source belongs with the other component samples in tests/config/components.ts
- NON_JAVASCRIPT_PROJECTS (const exported, 3-7): **move** to `tests/config/init.ts` `NON_JAVASCRIPT_PROJECTS`. its doc comment goes (TPP-045); one row left; test data that two tests read, so tests/config/
- TOOLING_PACKAGE (const exported, 9-9): **move** to `tests/config/init.ts` `TOOLING_PACKAGE`. its doc comment goes (TPP-045); test data that two tests read, so tests/config/

## `tests/config/cli/commands/init/tooling.ts`

- (the file) (file): **move** to `tests/config/tooling.ts`. the file keeps its name (a Tooling value, the existing-tooling topic of repository/tooling.ts); Tooling.runner and askQuestions are deleted (INX-003, CLX-001), so the object has no runner field, and its users are the proposeCi rows in settings-text.test.ts; tests/config imports only tests/config, so it drops the Tooling annotation
- EMPTY_TOOLING (const exported, 4-13): **move** to `tests/config/tooling.ts` `EMPTY_TOOLING`. both users end in one test file; test data, so tests/config/; the runner field goes (INX-003); tests/config imports only tests/config, so the value drops its Tooling annotation and is written as const, and the test that reads it checks the type

## `tests/config/cli/commands/manual-choices.ts`

- (the file) (file): **move** to `tests/config/configurations.ts`. one user; saved configuration choices join the configurations topic file in tests/config/, and SCRIPT_SOURCE, one short line, stays in its test
- AUTHORED_OVERRIDES (const exported, 2-7): **move** to `tests/config/configurations.ts` `SAVED_CHOICES`. one user; its doc comment goes (TPP-045); glossary: "authored" is retired; test data, so tests/config/; the inline table is \[rules\] (TML-003), and the sample writes a \[\[scope\]\] record with path = "api"
- SCRIPT_SOURCE (const exported, 10-10): **move** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `SCRIPT_SOURCE`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; one user (TPP-022: one-user data goes into its test); its doc comment goes (TPP-045); used by four tests of one file
- INITIAL_OVERRIDES (const exported, 13-28): **delete**. its test is deleted (TCM-018, CMD-092)
- DETECT_TEMPLATE (const exported, 31-31): **delete**. data used only by the deleted duplicate test 'a detect template keeps its named language while other configurations follow detection' (TCM-018)
- AUTHORED_SCRIPT_SCOPE (const exported, 34-39): **move** to `tests/config/configurations.ts` `SAVED_SCOPE_CHOICE`. its test keeps gspot remove, and its other user is deleted (TCM-014); a six-line gspot.toml text is not a single short literal, so tests/config/, named like SAVED_CHOICES; the inline table is \[rules\] (TML-003), and the sample writes a \[\[scope\]\] record with path = "api"

## `tests/config/cli/commands/policy-preview.ts`

- (the file) (file): **delete**. every constant serves the deleted dry-run tests (CLX-004)
- PREVIEW_POLICY (const exported, 2-29): **delete**. test data of a deleted flag (CLX-004)
- POLICY_PREVIEW_CASES (const exported, 32-138): **delete**. test data of a deleted flag (CLX-004)
- POLICY_PREVIEW_REFUSALS (const exported, 141-154): **delete**. test data of a deleted flag (CLX-004)
- POLICY_PREVIEW_UNCHANGED (const exported, 157-177): **delete**. test data of a deleted flag (CLX-004)

## `tests/config/cli/commands/program.ts`

- (the file) (file): **move** to `tests/config/terminal.ts`. one user; argument errors and the check report are what the terminal shows, so tests/config/terminal.ts
- ARGUMENT_REFUSALS (const exported, 2-18): **move** to `tests/config/terminal.ts` `ARGUMENT_ERRORS`. one user; its doc comment goes (TPP-045); TCM-014 deletes the --refresh-locks row and the add row stays; test data, so tests/config/terminal.ts; ARGUMENT_ERRORS because tests/config/check.ts has an ARGUMENT_REFUSALS for check path arguments, another concept; two rows only

## `tests/config/cli/commands/reconciliation.ts`

- (the file) (file): **move** to `tests/config/configurations.ts`. its constants follow their tests; 'reconciliation' is retired in user text, and these are saved configuration choices, so tests/config/configurations.ts; the two npm mock values go to tests/config/npm.ts
- MOBILE_RECONCILIATION_POLICY (const exported, 4-9): **move** to `tests/config/configurations.ts` `REACT_NATIVE_SETTINGS`. one user; its doc comment goes (TPP-045); glossary: "policy" and "reconciliation" are retired; test data, so tests/config/; the inline table is \[rules\] (TML-003)
- NPM_VERSION (const exported, 12-12): **move** to `tests/config/npm.ts` `NPM_VERSION`. one user (mockNpmCommands); its doc comment goes (TPP-045); test data, so tests/config/npm.ts, beside NPM_SUCCESS, which the npm spy returns with it
- NPM_SUCCESS (const exported, 15-15): **move** to `tests/config/npm.ts` `NPM_SUCCESS`. one user (mockNpmCommands); its doc comment goes (TPP-045); test data, so tests/config/npm.ts; tests/config imports only tests/config, so the value drops its SpawnResult annotation and is written as const, and the spy's mockImplementation checks the shape
- INHERITED_SELECTION_FILES (const exported, 18-23): **move** to `tests/config/configurations.ts` `INHERITED_SELECTION_FILES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- INHERITED_SELECTION_TABLE (const exported, 26-26): **inline** to `tests/unit/cli/commands/reconcile/configurations.test.ts` `apply adds no always-selected or inherited configuration to the saved lists`. the tests of commands/reconcile.ts exceed 300 lines, so they sit in reconcile/ by behavior; one user, one line; the sample writes a \[\[scope\]\] record with path = "app"
- NESTED_SELECTION_FILES (const exported, 29-34): **move** to `tests/config/configurations.ts` `NESTED_SELECTION_FILES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- REQUIRED_SELECTION_FILES (const exported, 37-40): **move** to `tests/config/configurations.ts` `REQUIRED_SELECTION_FILES`. one user; its doc comment goes (TPP-045); test data, so tests/config/

## `tests/config/cli/commands/remove.ts`

- (the file) (file): **split** to `tests/unit/cli/commands/remove.test.ts; tests/unit/cli/commands/add.test.ts`. its two rows follow their commands: the remove row into remove.test.ts, the add row into add.test.ts
- INSTALLATION_MUTATIONS (const exported, 2-15): **split** to `tests/unit/cli/commands/remove.test.ts; tests/unit/cli/commands/add.test.ts` `remove applies gspot.toml and installs no npm tools;add applies gspot.toml and installs no npm tools`. one row for each command, written in its test; its doc comment goes (TPP-045); the inline table is \[rules\] (TML-003), and the sample writes a \[\[scope\]\] record with path = "api"

## `tests/config/cli/commands/roots.ts`

- (the file) (file): **inline** to `tests/unit/cli/commands/session.test.ts`. one user
- LINKED_STORAGE_CASES (const exported, 2-21): **inline** to `tests/unit/cli/commands/session.test.ts` `a linked .gspot folder stops init and check, and nothing outside changes`. the two rows become two plain tests
- STORAGE_COMMAND (const exported, 23-23): **inline** to `tests/unit/cli/commands/session.test.ts` `a linked .gspot folder stops init and check, and nothing outside changes`. one user (the check half)

## `tests/config/cli/commands/set/command.ts`

- (the file) (file): **move** to `tests/config/set.ts`. one user; the gspot set command data goes to tests/config/set.ts
- POLICY (const exported, 1-2): **move** to `tests/config/set.ts` `SET_SETTINGS`. one user; its doc comment goes (TPP-045); glossary: "policy" is retired; test data, so tests/config/; SET_SETTINGS because GSPOT_TOML also names a different value in tests/config/explain.ts; the inline table is \[rules\] (TML-003), and the sample writes a \[\[scope\]\] record with path = "api"
- SET_ARGUMENT_CONFLICTS (const exported, 5-46): **delete**. its test goes with --replace, --remove and --default (CMD-092)
- SET_CONFLICT_POLICIES (const exported, 49-55): **delete**. its test goes with --replace, --remove and --default (CMD-092)
- NATIVE_OPTION_SCOPES (const exported, 58-61): **move** to `tests/config/set.ts` `EXTRA_OPTION_SCOPES`. one user; its doc comment goes (TPP-045); glossary: extra tool options; test data, so tests/config/; the child source names the app \[\[scope\]\] record
- ESLINT_OVERRIDES (const exported, 63-63): **delete**. set writes no record lists (single values and list items only; record lists are written by hand), so this is data of the deleted test (row 362)
- ESLINT_OVERRIDE_REASON (const exported, 64-64): **delete**. set writes no record lists (single values and list items only; record lists are written by hand), so this is data of the deleted test (row 362)
- PROSE_REFUSALS (const exported, 66-69): **delete**. data used only by the deleted weak test 'set refuses %s without changing repository files'

## `tests/config/cli/commands/set/exceptions.ts`

- (the file) (file): **move** to `tests/config/set.ts`. its constants follow their tests; 'exceptions' is a retired word, the reason data joins the set command data, and HOST_LOCKFILE joins the dependencies data
- PRIMITIVE_EXCEPTIONS (const exported, 4-18): **move** to `tests/config/set.ts` `LOOSENED_SETTINGS`. one user; its doc comment goes (TPP-045); glossary: "exception" is retired; test data, so tests/config/; site.sitemap_exclude is site.allowed_unlisted_pages (values written from the repository root with the build folder, TMF-008), dependencies.registry_hosts is dependencies.allowed_registries, and words is allowed_words (a list, defaults \[\])
- ROOT_PROJECT (const exported, 20-20): **move** to `tests/config/set.ts` `TWO_SCOPES`. used by the set reason tests; the moved hosts test writes its own scopes; test data, so tests/config/; the inline table is \[rules\] (TML-003), and the sample writes \[\[scope\]\] records with path = "app" and "sibling"
- HOST_LOCKFILE (const exported, 22-28): **move** to `tests/config/dependencies.ts` `HOST_LOCKFILE`. both of its tests move to lockfile-hosts.test.ts; a lockfile for the dependencies/lockfile-hosts check belongs to the dependencies topic in tests/config/

## `tests/config/cli/commands/set/typed-tables.ts`

- (the file) (file): **move** to `tests/config/set.ts`. one user; the table input joins the set command data in tests/config/set.ts, and CHECK, a four-word argv, stays in its test
- REASON (const exported, 1-1): **inline** to `tests/config/set.ts` `RESTRICTED_IMPORTS`. TTC-037: used only inside TABLE, so it is written inside RESTRICTED_IMPORTS in tests/config/set.ts
- TABLE (const exported, 3-3): **move** to `tests/config/set.ts` `RESTRICTED_IMPORTS`. one user; its doc comment goes (TPP-045); the name says what it holds; test data, so tests/config/
- CHECK (const exported, 5-5): **inline** to `tests/unit/cli/commands/set/values.test.ts` `set writes TOML-typed tables as tables, refuses unreadable input, and gspot.toml refuses quoted tables`. the tests of commands/set.ts exceed 300 lines, so they sit in set/ by behavior; one user, one line

## `tests/config/cli/configurations/detect.ts`

- (the file) (file): **move** to `tests/config/detect.ts`. its constants follow their tests; the detection data goes to tests/config/detect.ts (the file keeps its name)
- PYTHON_DEPENDENCY_CASES (const exported, 2-33): **move** to `tests/config/detect.ts` `PYTHON_DEPENDENCY_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- SWIFT_TEST_CASES (const exported, 36-41): **move** to `tests/config/detect.ts` `SWIFT_TEST_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- SWIFT_TARGET_CASES (const exported, 43-54): **move** to `tests/config/detect.ts` `SWIFT_TARGET_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- POSTGRES_DEPENDENCY_CASES (const exported, 57-67): **delete**. data used only by the deleted weak Postgres dependency test (TCM-016)
- POSTGRES_CONTENT_CASES (const exported, 70-97): **move** to `tests/config/detect.ts` `PRISMA_CONTENT_CASES`. one user; its doc comment goes (TPP-045); the rows are Prisma schema contents; test data, so tests/config/

## `tests/config/cli/configurations/errors.ts`

- (the file) (file): **move** to `tests/config/manifests.ts`. the two constants left are configuration manifest data, so they go to tests/config/manifests.ts (glossary: manifest); the rest go with the assertManifests and removed-key tests
- WAITING_SETTING (const exported, 1-2): **delete**. TTC-037; its test goes with assertManifests (LIF-007, ROOT-017)
- SHARED_SETTING (const exported, 5-10): **delete**. its test goes with assertManifests (LIF-007, ROOT-017)
- MINIMUM_VERSION_CASES (const exported, 13-17): **delete**. its test goes with assertManifests (LIF-007, ROOT-017)
- INVALID_VERSION_FLOORS (const exported, 19-19): **move** to `tests/config/manifests.ts` `INVALID_VERSION_FLOORS`. one user; its doc comment goes (TPP-045); TCM-048: one row per branch; manifest data, so tests/config/manifests.ts
- CONSUMER_DECLARATION (const exported, 22-26): **delete**. its test goes with assertManifests (LIF-007, ROOT-017)
- SYSTEM_TOOL_DECLARATION (const exported, 29-32): **delete**. its test goes with assertManifests (LIF-007, ROOT-017)
- SELECTOR_DECLARATION (const exported, 34-35): **move** to `tests/config/manifests.ts` `REPLACE_DECLARATION`. used by two schema tests of one file; the name says it starts a \[\[tool.replace\]\] row; manifest data, so tests/config/manifests.ts
- ROOT_SELECTOR_DECLARATION (const exported, 38-43): **delete**. its two tests check removed keys (TCM-008)
- ROOT_SELECTOR_REFUSALS (const exported, 45-45): **delete**. TCM-008
- WAITING_REFERENCES (const exported, 48-55): **delete**. its test goes with assertManifests (LIF-007, ROOT-017)

## `tests/config/cli/configurations/owners.ts`

- (the file) (file): **split** to `tests/config/select.ts; tests/config/manifests.ts`. 'owners' is a retired word (glossary: covers); the coverage data goes to tests/config/select.ts (tests of repository/select.ts) and the setting-reference rows to tests/config/manifests.ts
- UNSUPPORTED_CONFIGURATION_FILES (const exported, 2-10): **delete**. TCM-015
- SCOPE_OWNER_PATHS (const exported, 12-16): **move** to `tests/config/select.ts` `MIGRATION_PATHS`. one user; its doc comment goes (TPP-045); glossary: covers, not owner; test data, so tests/config/
- PATH_OWNER_CASES (const exported, 18-22): **move** to `tests/config/select.ts` `MIGRATION_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- TEST_FILE_OWNER_PATHS (const exported, 24-33): **move** to `tests/config/select.ts` `JEST_PATHS`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- TEST_FILE_OWNER_CASES (const exported, 35-46): **move** to `tests/config/select.ts` `JEST_CASES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- FILE_PATH_REFERENCES (const exported, 48-54): **move** to `tests/config/manifests.ts` `FILE_PATH_REFERENCES`. one user; its doc comment goes (TPP-045); manifest data, so tests/config/manifests.ts

## `tests/config/cli/configurations/pins.ts`

- (the file) (file): **move** to `tests/config/manifests.ts`. its constants follow their tests; \[\[tool\]\] installer declarations are manifest data, so the constant joins tests/config/manifests.ts
- TOOL_PROJECT_PACKAGES (const exported, 2-34): **move** to `tests/config/manifests.ts` `TOOL_PROJECT_PACKAGES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- NATIVE_HINTS (const exported, 37-42): **delete**. data used only by the deleted weak hint test 'a missing native %s tool gives actionable guidance under %s'

## `tests/config/cli/configurations/select.ts`

- (the file) (file): **move** to `tests/config/select.ts`. the selectForScope data follows its test and joins tests/config/select.ts; the TCM-015 data goes
- PROJECT_CHOICES (const exported, 2-10): **move** to `tests/config/select.ts` `PROJECT_CHOICES`. one user; its doc comment goes (TPP-045); test data, so tests/config/; the settings object holds \[\[scope\]\] records (scope: \[{ path: "app", ... }, ...\]), and removed_configurations stays a scope key
- PROJECT_SELECTIONS (const exported, 13-20): **move** to `tests/config/select.ts` `PROJECT_SELECTIONS`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- OPENAPI_FRAMEWORKS (const exported, 23-26): **delete**. TCM-015
- CONFIGURATION_CATEGORIES (const exported, 29-40): **delete**. TCM-015

## `tests/config/cli/configurations/suppressions.ts`

- (the file) (file): **move** to `tests/config/suppressions.ts`. one user; the file keeps its name in tests/config/ (suppression comments of each tool)
- SUPPRESSION_REASONS (const exported, 2-31): **move** to `tests/config/suppressions.ts` `SUPPRESSION_REASONS`. one user; its doc comment goes (TPP-045); test data, so tests/config/

## `tests/config/cli/configurations/takeover.ts`

- (the file) (file): **move** to `tests/config/tooling.ts`. its constants follow their tests; 'takeover' is retired (glossary: existing tooling), so the discovery data goes to tests/config/tooling.ts
- PACKAGE_HOOK_CONFIGURATIONS (const exported, 1-1): **inline** to `tests/unit/cli/repository/tooling/hooks.test.ts` `simple-git-hooks is found from its package.json key`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; TCM-048: one value
- LINKED_HOOK_FOLDERS (const exported, 3-6): **move** to `tests/config/tooling.ts` `LINKED_HOOK_FOLDERS`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- LINKED_RULE_FOLDERS (const exported, 8-8): **move** to `tests/config/tooling.ts` `LINKED_RULE_FOLDERS`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- LINKED_HOOK_FILES (const exported, 10-13): **move** to `tests/config/tooling.ts` `LINKED_HOOK_FILES`. one user; its doc comment goes (TPP-045); test data, so tests/config/
- LEFTHOOK_FILES (const exported, 15-15): **move** to `tests/config/tooling.ts` `LEFTHOOK_FILES`. one user; its doc comment goes (TPP-045); test data, so tests/config/; one row only
- SURVEY_READ_ERRORS (const exported, 18-18): **inline** to `tests/unit/cli/repository/tooling/hooks.test.ts` `a read error in a hooks folder reaches the caller`. the tests of repository/tooling.ts exceed 300 lines, so they sit in tooling/ by behavior; TCM-048: one code
- RUNNER_CASES (const exported, 20-73): **delete**. test data of deleted code: runner discovery (INX-003)

## `tests/config/cli/scripts/pins.ts`

- (the file) (file): **delete**. SCR-007: pins.test.ts and its data go
- REGISTRY_PIN (const exported, 1-7): **delete**. SCR-007
- ESLINT_PIN (const exported, 9-9): **delete**. SCR-007
- INCOMPATIBLE_PEER (const exported, 10-10): **delete**. SCR-007
- COMPATIBLE_PEER (const exported, 11-11): **delete**. SCR-007
- MALFORMED_PEER (const exported, 12-12): **delete**. SCR-007
- INVALID_TAG (const exported, 13-13): **delete**. SCR-007
- RUNNER_IMAGE_CASES (const exported, 15-35): **delete**. SCR-007

## `tests/config/cli/scripts/plugin.ts`

- (the file) (file): **delete**. THR-004: plugin.test.ts and its data go
- STALLED_PACKAGE_PACKING (const exported, 2-9): **delete**. THR-004

## `tests/config/cli/scripts/release.ts`

- (the file) (file): **delete**. TCM-010: release.test.ts and its data go
- INVALID_RELEASE_TAGS (const exported, 1-1): **delete**. TCM-010

## `tests/config/cli/terminal.ts`

- (the file) (file): **move** to `tests/config/terminal.ts`. one user; the file keeps its name in tests/config/; tests/config imports only tests/config, so it drops the RunReport annotation and writes the literal fields (status, stage) with 'as const' so the object still fits RunReport where runText reads it
- REPORT (const exported, 4-48): **move** to `tests/config/terminal.ts` `REPORT`. one user; its doc comment goes (TPP-045); a 45-line report is not a single short literal, so tests/config/; tests/config imports only tests/config, so the value drops its RunReport annotation and is written as const, and the test that reads it checks the type

## `tests/types/cli/npm.ts`

- (the file) (file): **delete**. its one item, YarnOperations, goes
- YarnOperations (type exported, 4-9): **delete**. no user: its only user is the annotation of YARN_CLIENTS, which goes because tests/config imports only tests/config

## `tests/types/cli/scripts.ts`

- (the file) (file): **delete**. THR-004: goes with plugin.test.ts
- PackageArchiveMarker (type exported, 2-2): **delete**. THR-004

## `tests/types/cli/terminal.ts`

- (the file) (file): **delete**. its one type goes
- ComparisonCase (type exported, 3-3): **delete**. the rows type-check where they become a RunReport comparison; a named type for one table adds nothing
