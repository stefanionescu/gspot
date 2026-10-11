# Source: the CLI entry, commands, terminal, ESLint plugin, scripts, and docs site

604 rows. keep 211, move 146, delete 112, rename 97, inline 21, merge 16, split 1.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/scripts/build.ts`

- root (const, 12-12): **move** to `scripts/build.ts` `cliFolder`. ROOT-017: one root scripts folder; one build script serves both npm packages, with the grammar step inside it (SCR-005); root means the repository root only, so this is cliFolder; it is computed from import.meta.url at load, so it stays in the script.
- distribution (const, 13-13): **move** to `scripts/build.ts` `cliDistribution`. SCR-005: the plugin build joins the same script, so this one is named for the CLI; it is computed from cliFolder, so it stays in the script.
- schemaCheck (const, 20-24): **delete**. POL-001: the setting-schema generator and scripts/setting-values.ts are deleted, so this check goes.
- result (const, 32-47): **move** to `scripts/build.ts` `cliBuild`. ROOT-017, SCR-005: the one build script; DEC-009 drops the parsers/tool/format.ts entry; ROOT-004 makes every dependency external (no zod bundling); ROOT-068 one configurationManifests call and no main.js rename; the entry points are the moved program files. Values to config: CLI_ENTRY_POINTS = \["src/main.ts", "src/checks/framework/site/linkinator-program.ts", "src/checks/framework/site/purgecss-program.ts"\] -&gt; scripts/config/build.ts; CLI_BANNER = "#!/usr/bin/env node" -&gt; scripts/config/build.ts; CLI_EXECUTABLE = "gspot.js" (set through naming, ROOT-068) -&gt; scripts/config/build.ts; DIST_FOLDER = "dist" -&gt; scripts/config/build.ts; LICENSE_FILE = "LICENSE.md" -&gt; scripts/config/build.ts.
- readme (const, 53-53): **delete**. The README generator goes; packages/cli/README.md is written by hand.
- sections (const, 54-54): **delete**. The README generator goes; packages/cli/README.md is written by hand.
- packageReadme (const, 55-59): **delete**. The README generator goes; packages/cli/README.md is written by hand.

## `packages/cli/scripts/grammars.ts`

- downloadPinnedFile (function, 17-46): **move** to `scripts/build.ts` `downloadPinnedFile`. ROOT-017, SCR-005, SCR-006: the grammar step is part of the one build script; it takes (path, url, checksum), so PinnedDownload goes; SCR-006 hash check then writeFile, with no temporary file; ROOT-021 no AbortSignal timeout. Values to config: CHECKSUM_ALGORITHM = "sha256" -&gt; scripts/config/grammars.ts.
- copyGrammars (function, 54-67): **inline** to `scripts/build.ts` `top-level build steps`. SCR-005, SCR-006: the build is its one caller, so the copy loop becomes top-level build steps; the RUNTIME_WASM copies and their two license copies go, because libpg-query.wasm is unread and web-tree-sitter ships its own file. Values to config: GRAMMARS_FOLDER = "grammars" -&gt; packages/cli/src/config/system/assets.ts (wasmPath reads the same folder); LICENSES_FOLDER = "licenses" -&gt; scripts/config/grammars.ts; PACKAGE_LICENSE_FILE = "LICENSE" -&gt; scripts/config/grammars.ts; SWIFT_LICENSE_FILE = "tree-sitter-swift.txt" -&gt; scripts/config/grammars.ts.

## `packages/cli/src/commands/add.ts`

- addCommand (function, 24-56): **keep** to `packages/cli/src/commands/add.ts` `addCommand`. Command add stays: it refuses unknown and always-selected configurations and takes the names out of removed_configurations; CMD-032 shares the edit setup and one always-selected refusal with remove; the runner setting goes, so assertVersionPin takes the root alone (INX-003).
- registerAdd (function exported, 62-83): **keep** to `packages/cli/src/commands/add.ts` `registerAdd`. Command add stays; CMD-092 deletes -C, so the action passes process.cwd(); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012); CLX-004 deletes --dry-run.

## `packages/cli/src/commands/check/arguments.ts`

- matchingFiles (function, 11-17): **move** to `packages/cli/src/commands/check/tree.ts` `matchingFiles`. CMD-055: only tree.ts calls the two helpers.
- selectedPaths (function exported, 26-31): **move** to `packages/cli/src/commands/check/tree.ts` `pathArguments`. CMD-055: moves to tree.ts, its one user; CMD-050: selection is the glossary word for configurations, so it is pathArguments.
- refuseUnknownChecks (function exported, 38-47): **move** to `packages/cli/src/commands/check/tree.ts` `refuseUnknownChecks`. CMD-055: moves to tree.ts, its one user; the name stays because CMD-092 deletes --skip.

## `packages/cli/src/commands/check/command.ts`

- readPushInput (function, 25-37): **keep** to `packages/cli/src/commands/check/command.ts` `readPushInput`. TCM-002: bad bytes on the pre-push input must not crash gspot.
- pushOptions (function, 40-47): **keep** to `packages/cli/src/commands/check/command.ts` `pushOptions`. CMD-023: delete the argument-count check and PUSH_ARGUMENTS.
- checkStaged (function, 50-72): **keep** to `packages/cli/src/commands/check/command.ts` `checkStaged`. The hand checks stay: --hook pre-commit turns on staged in code; NMU-032 error code arguments.
- checkCommand (function, 75-91): **keep** to `packages/cli/src/commands/check/command.ts` `checkCommand`. CMD-024: accessSync instead of reading the file; --dry-run turns on --fix through Commander .implies, so the "--dry-run requires --fix." refusal goes (CLX-007); no commit-msg refusal is added (CLX-006).
- runCancelable (function, 94-118): **inline** to `packages/cli/src/commands/check/command.ts` `runCheck`. CMD-063: runCheck owns the signals and sets exit 130 or 143; one caller, so the catch of the canceled run joins the try/finally of runCheck.
- runCheck (function, 121-161): **keep** to `packages/cli/src/commands/check/command.ts` `runCheck`. --base stays with --changed and fills CheckOptions.base (CMD-049); CMD-053 flags typed by Commander; CMD-063: it owns the signals and also writes the signal code (130 or 143) into the printed JSON exitCode after Ctrl-C or SIGTERM; CMD-092 --verbose is a check flag; CMD-011 progress also under --json; it reads json and verbose from its own options, with no optsWithGlobals (CLX-005); the message stage comes from --message-file alone (CLX-006). Values to config: SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } -&gt; packages/cli/src/config/terminal.ts (the CMD-063 codes, beside EXIT_ERROR; the handler registers each key).
- registerCheck (function exported, 167-197): **keep** to `packages/cli/src/commands/check/command.ts` `registerCheck`. --base &lt;ref&gt; stays, implies --changed, and has no default: an absent value means the upstream or default branch; CMD-053 and CLX-005: program.command('check') with its own --json and --verbose; CMD-092 deletes --skip and adds --verbose; --hook takes pre-commit or pre-push (CLX-006); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012). Values to config: CHECK_HOOKS = \['pre-commit', 'pre-push'\] -&gt; packages/cli/src/config/generation/hooks.ts (beside HOOK_ARGS).

## `packages/cli/src/commands/check/push.ts`

- checkRevision (function, 12-37): **keep** to `packages/cli/src/commands/check/push.ts` `checkRevision`. Real job: one pushed commit in its own copy.
- buildPushReport (function, 40-52): **keep** to `packages/cli/src/commands/check/push.ts` `buildPushReport`. CMD-063 leaves push.ts as it is.
- assertPushOptions (function exported, 58-70): **keep** to `packages/cli/src/commands/check/push.ts` `assertPushOptions`. CMD-029 plain refusal text; --dry-run turns on --fix, so options.fix covers it, the isDryRun test goes, and the message names --fix (CLX-007).
- checkPush (function exported, 79-107): **keep** to `packages/cli/src/commands/check/push.ts` `checkPush`. CMD-014: delete the dead early return and read result.json; CMD-029: Branches and tags not checked.

## `packages/cli/src/commands/check/tree.ts`

- reportFixes (function, 20-36): **keep** to `packages/cli/src/commands/check/tree.ts` `reportFixes`. CMD-001: text only; the JSON carries the FixReport.
- warnAboutHooks (function, 39-49): **keep** to `packages/cli/src/commands/check/tree.ts` `warnAboutHooks`. Real job: warns when hooks are not ready.
- changedSet (function, 52-61): **keep** to `packages/cli/src/commands/check/tree.ts` `changedSet`. CMD-049: reads CheckOptions.base; hooks.push_files is deleted, so the push_files === "all" early return goes: the push hook checks what is pushed, and planning widens to every file when gspot.toml or .gspot/ changed (TML-002).
- stagedSet (function, 64-72): **keep** to `packages/cli/src/commands/check/tree.ts` `stagedSet`. Real job.
- rewriteReproductions (function, 75-78): **delete**. EXG-026: the run builds the reproduce line once, with push from RunOptions, so the second build for --hook pre-push goes.
- buildResult (function, 80-84): **inline** to `packages/cli/src/commands/check/tree.ts` `runSelected`. One caller; CMD-001: json is the run report plus the fixes; CMD-014: no report copy field.
- selectionsFor (function, 87-98): **rename** to `packages/cli/src/commands/check/tree.ts` `runFilters`. CMD-050: selection is the glossary word for configurations, so it is runFilters.
- runSelected (function, 101-135): **keep** to `packages/cli/src/commands/check/tree.ts` `runSelected`. Real job.
- checkTree (function exported, 145-161): **keep** to `packages/cli/src/commands/check/tree.ts` `checkTree`. Real job, used by command.ts and push.ts; the runner setting goes, so assertVersionPin takes the root alone (INX-003).

## `packages/cli/src/commands/contracts.ts`

- errorText (function, 34-36): **delete**. CMD-021: errorText exists only for the savePolicy wrapper that renames errors, and that wrapper goes.
- planPolicy (function, 44-54): **delete**. Set, unset, add, remove, ignore and unignore have no dry run, so the shared dry-run planner goes (CLX-004).
- registerInstall (function exported, 60-79): **move** to `packages/cli/src/commands/install.ts` `registerInstall`. CMD-003: contracts.ts splits by job, and install gets its own file; CMD-092 and CMD-015 delete --refresh-lockfiles; its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012); CLX-004 deletes --dry-run.
- installCommand (function exported, 86-113): **move** to `packages/cli/src/commands/install.ts` `installCommand`. CMD-003: moves to commands/install.ts; CMD-015; CMD-029 "Nothing to install."; tests reach install through it; it has no dry-run branch and takes the start folder alone, so InstallOptions goes (CLX-004); assertVersionPin takes the root alone (INX-003).
- savePolicy (function exported, 121-178): **move** to `packages/cli/src/commands/save-settings.ts` `saveSettings`. CMD-003: moves to commands/save-settings.ts as saveSettings (CMD-003; glossary: settings, not policy); CMD-005 one writeSettings call; CMD-006; CMD-021 drops the try/catch; it has no dry-run branch, and apply runs its own dry run (planApply) before it calls saveSettings (CLX-004).
- exportCommand (function exported, 188-235): **move** to `packages/cli/src/commands/export.ts` `exportCommand`. CMD-003: moves to commands/export.ts; CMD-008 drops two path guards and reads getOwnership; CMD-029; CMD-078 no preview variable; it has no dry-run branch, so 'would write' and the printed template go (CLX-004).
- registerExport (function exported, 241-254): **move** to `packages/cli/src/commands/export.ts` `registerExport`. CMD-003: moves to commands/export.ts; its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012); CLX-004 deletes --dry-run.

## `packages/cli/src/commands/doctor/contracts.ts`

- configurationSuggestions (function, 19-72): **rename** to `packages/cli/src/commands/doctor/suggestions.ts` `configurationSuggestions`. CMD-056: doctor/contracts.ts becomes doctor/suggestions.ts; the rows print gspot add and gspot remove, which stay; CMD-047 text.
- inactiveFileRow (function, 74-90): **rename** to `packages/cli/src/commands/doctor/suggestions.ts` `inactiveFileRow`. CMD-056: doctor/contracts.ts becomes doctor/suggestions.ts.
- buildFileRow (function, 92-107): **rename** to `packages/cli/src/commands/doctor/suggestions.ts` `buildFileRow`. CMD-056: doctor/contracts.ts becomes doctor/suggestions.ts; the row prints gspot add &lt;configuration&gt;, which stays.
- unownedConfigs (function, 109-132): **rename** to `packages/cli/src/commands/doctor/suggestions.ts` `unownedToolFiles`. CMD-056: doctor/contracts.ts becomes doctor/suggestions.ts; glossary tool file (config is a retired name); PLR-006: doctor keeps its own small read.
- getUnownedOutputs (function, 134-143): **rename** to `packages/cli/src/commands/doctor/suggestions.ts` `unrecordedFiles`. CMD-056: doctor/contracts.ts becomes doctor/suggestions.ts; it lists files under .gspot/ that the ownership log does not record, and output names only tool output (NMS).
- getSuggestions (function exported, 150-173): **rename** to `packages/cli/src/commands/doctor/suggestions.ts` `listSuggestions`. CMD-056: doctor/contracts.ts becomes doctor/suggestions.ts; NMS-016: get hides file reads, list names listings; duplicate-pin detection is deleted, so the duplicateMisePins field and its call go and it reads no MISE_TOML (INX-007).

## `packages/cli/src/commands/doctor/public.ts`

- versionText (function, 33-39): **rename** to `packages/cli/src/commands/doctor/command.ts` `versionText`. CMD-056: doctor/public.ts becomes doctor/command.ts.
- toolLines (function, 41-49): **rename** to `packages/cli/src/commands/doctor/command.ts` `toolLines`. CMD-056: doctor/public.ts becomes doctor/command.ts; state system.
- suggestionLines (function, 51-65): **rename** to `packages/cli/src/commands/doctor/command.ts` `suggestionLines`. CMD-056: doctor/public.ts becomes doctor/command.ts; CMD-073; the "pinned twice" block goes with duplicateMisePins (INX-007).
- versionLine (function, 67-72): **rename** to `packages/cli/src/commands/doctor/command.ts` `versionLine`. CMD-056: doctor/public.ts becomes doctor/command.ts.
- buildDoctorReport (function, 80-121): **rename** to `packages/cli/src/commands/doctor/command.ts` `buildDoctorReport`. CMD-056: doctor/public.ts becomes doctor/command.ts; it reads ruleFiles; CI is on when ci.enabled is true (TML-015); the table is \[rules\], so it reads policy.rules (TML-003).
- formatDoctorReport (function, 128-141): **rename** to `packages/cli/src/commands/doctor/command.ts` `formatDoctorReport`. CMD-056: doctor/public.ts becomes doctor/command.ts; NMU-011 label.
- doctorCommand (function exported, 148-158): **rename** to `packages/cli/src/commands/doctor/command.ts` `doctorCommand`. CMD-056: doctor/public.ts becomes doctor/command.ts; CMD-074 template string at the call site; CMD-029 text; tests reach doctor through it.
- registerDoctor (function exported, 164-175): **rename** to `packages/cli/src/commands/doctor/command.ts` `registerDoctor`. CMD-056: doctor/public.ts becomes doctor/command.ts; its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012).

## `packages/cli/src/commands/explain/contracts.ts`

- getToolPin (function, 11-25): **merge** to `packages/cli/src/configurations/tool-pins.ts` `toolDeclaration`. It repeats toolDeclaration (NMS table B): the check's own manifest first, then any manifest; its fallback pin has no rule_url or crash_pattern, so callers read the same values.
- getRulePlugin (function, 27-32): **rename** to `packages/cli/src/commands/explain/check.ts` `getRulePlugin`. CMD-003: explain keeps command.ts and check.ts, so contracts.ts becomes check.ts.
- getRulePage (function, 35-43): **rename** to `packages/cli/src/commands/explain/check.ts` `getRulePage`. CMD-003: explain keeps command.ts and check.ts, so contracts.ts becomes check.ts. Values to config: RULE_PLACEHOLDER = '{rule}' -&gt; packages/cli/src/config/configurations.ts (with the other manifest placeholders).
- getFacts (function, 46-67): **rename** to `packages/cli/src/commands/explain/check.ts` `getFacts`. CMD-003: contracts.ts becomes explain/check.ts; CMD-071 minVersions only.
- repositoryLines (function, 70-88): **rename** to `packages/cli/src/commands/explain/check.ts` `repositoryLines`. CMD-003: contracts.ts becomes explain/check.ts; the text keeps gspot add &lt;configuration&gt;, which stays.
- describeCheck (function, 90-122): **rename** to `packages/cli/src/commands/explain/check.ts` `describeCheck`. CMD-003: contracts.ts becomes explain/check.ts; CMD-029 texts; CMD-071.
- explainCheck (function exported, 130-163): **rename** to `packages/cli/src/commands/explain/check.ts` `explainCheck`. CMD-003: contracts.ts becomes explain/check.ts.
- explainToolRule (function exported, 171-205): **rename** to `packages/cli/src/commands/explain/check.ts` `explainLintRule`. CMD-003: contracts.ts becomes explain/check.ts; CMD-070 and glossary: lint rule, not tool rule; TCM-013 drops summary: null; the options line reads: Change its options: gspot set tools.&lt;tool&gt;.rules '{ "&lt;rule&gt;" = \[&lt;options&gt;\] }' (set merges the entry into the table; no --reason), and to accept a finding it prints gspot ignore &lt;check&gt; --rule &lt;rule&gt; --reason "...". Values to config: ESLINT_TOOL = 'eslint' -&gt; packages/cli/src/config/generation/eslint.ts (the literal is written in about 17 places).

## `packages/cli/src/commands/explain/public.ts`

- formatList (function, 35-37): **rename** to `packages/cli/src/commands/explain/command.ts` `formatList`. CMD-056: explain/public.ts becomes explain/command.ts.
- explainConfiguration (function, 39-81): **rename** to `packages/cli/src/commands/explain/command.ts` `explainConfiguration`. CMD-056: explain/public.ts becomes explain/command.ts; CMD-070 alwaysSelected.
- scopeLines (function, 84-100): **rename** to `packages/cli/src/commands/explain/command.ts` `scopeLines`. CMD-056: explain/public.ts becomes explain/command.ts; CMD-092: gspot unset replaces set --default; CMD-029 text; a reason sits next to its value, so the line says "write it as { value = ..., reason = \\"...\\" }" and the reason on record is read from that form (CFR-002).
- explainSetting (function, 102-144): **rename** to `packages/cli/src/commands/explain/command.ts` `explainSetting`. CMD-056: explain/public.ts becomes explain/command.ts; NMU-020 reason-needed texts.
- buildUnknownSubjectDiagnostic (function, 146-158): **rename** to `packages/cli/src/commands/explain/command.ts` `buildUnknownSubjectDiagnostic`. CMD-056: explain/public.ts becomes explain/command.ts.
- explainSlashed (function, 161-171): **rename** to `packages/cli/src/commands/explain/command.ts` `explainSlashed`. CMD-056: explain/public.ts becomes explain/command.ts.
- explainNamed (function, 173-178): **rename** to `packages/cli/src/commands/explain/command.ts` `explainNamed`. CMD-056: explain/public.ts becomes explain/command.ts; PLG-049: ESLint core rule names are imported as JSON. Values to config: ESLINT_TOOL (from packages/cli/src/config/generation/eslint.ts).
- uncheckedNote (function, 180-188): **rename** to `packages/cli/src/commands/explain/command.ts` `uncheckedNote`. CMD-056: explain/public.ts becomes explain/command.ts; glossary stale; \[\[generated\]\] and its generator field are deleted, so producedBy goes and the note reads "generated: eligible for secrets and freshness checks" (CFR-005).
- buildPathReport (function, 196-230): **rename** to `packages/cli/src/commands/explain/command.ts` `buildPathReport`. CMD-056: explain/public.ts becomes explain/command.ts; CMD-017 no fallback scope; \[\[generated\]\] and \[\[vendored\]\] are deleted, so the remedy reads "mark it linguist-generated or linguist-vendored in .gitattributes, or gspot add &lt;configuration&gt;" (CFR-005).
- formatPathReport (function, 237-257): **rename** to `packages/cli/src/commands/explain/command.ts` `formatPathReport`. CMD-056: explain/public.ts becomes explain/command.ts; glossary covers, not owned by, in the text.
- explain (function exported, 266-276): **rename** to `packages/cli/src/commands/explain/command.ts` `explain`. CMD-056: explain/public.ts becomes explain/command.ts; tests reach explain through it.
- registerExplain (function exported, 282-301): **rename** to `packages/cli/src/commands/explain/command.ts` `registerExplain`. CMD-056: explain/public.ts becomes explain/command.ts; CMD-092 starts in process.cwd(); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012).
- explainPath (function exported, 310-321): **rename** to `packages/cli/src/commands/explain/command.ts` `explainPath`. CMD-056: explain/public.ts becomes explain/command.ts; stop exporting, because it is used only in its own file (ARC-026).

## `packages/cli/src/commands/ignore.ts`

- assertKnownCheck (function, 20-24): **keep** to `packages/cli/src/commands/ignore.ts` `assertKnownCheck`. Real refusal of a misspelled check.
- buildReasonHint (function, 26-31): **keep** to `packages/cli/src/commands/ignore.ts` `buildReasonHint`. List options stay variadic, so the hint keeps one --paths followed by the globs (CLX-005).
- buildIgnore (function, 33-46): **inline** to `packages/cli/src/commands/ignore.ts` `ignoreCommand`. ignore --until stays, so the entry keeps its until date (parseExpiryDate); its four if blocks are one compact({ check, rule, paths, reason, until }) literal in ignoreCommand, its only caller, and the paths.length &gt; 0 test goes because Commander never passes an empty variadic list.
- deleteIgnore (function, 48-86): **move** to `packages/cli/src/commands/unignore.ts` `unignoreCommand`. CMD-092: gspot unignore replaces ignore --remove; it deletes every ignore of the check; --rule keeps it to entries with that rule; --paths takes those paths out of matching entries and deletes an entry with no path left, and it leaves an ignore that has no paths and says so; reason and until are not matched (CLX-011).
- ignoreCommand (function, 93-119): **keep** to `packages/cli/src/commands/ignore.ts` `ignoreCommand`. CMD-065; CMD-032 shared edit setup; CMD-092 no --remove branch; CMD-029 text; there is no dry run, so 'Ignore proposed.' goes (CLX-004); assertVersionPin takes the root alone (INX-003).
- registerIgnore (function exported, 125-151): **keep** to `packages/cli/src/commands/ignore.ts` `registerIgnore`. --until stays; CMD-092 deletes --remove (gspot unignore); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012); CLX-004 deletes --dry-run.

## `packages/cli/src/commands/init/contracts.ts`

- retireReplaced (function, 50-76): **move** to `packages/cli/src/commands/init/write.ts` `deleteReplacedFiles`. CMD-056: init/contracts.ts splits by job, and this goes to init/write.ts; CMD-016 returns kept paths, with no folder branch and no throw; CMD-077: retire is a retired word, so it is deleteReplacedFiles.
- requireTerminal (function, 79-84): **inline** to `packages/cli/src/commands/init/command.ts` `askConfirmation`. CMD-056: its one caller left is askConfirmation ("Continue?"), so the two lines join it; the question flags are deleted (CMD-092), so without a terminal it says "Pass --yes to accept the plan." (CLX-001).
- askChoice (function, 86-102): **delete**. Init asks no choice question, only "Continue?" (CLX-001), so askChoice goes.
- detectCi (function, 104-111): **inline** to `packages/cli/src/commands/init/settings-text.ts` `proposeCi`. CMD-037: reads tooling.ci only; two lines with one caller, so it joins proposeCi (CLX-001). Values to config: GITLAB_CI_FILE = '.gitlab-ci.yml' -&gt; packages/cli/src/config/repository/tooling.ts; GITHUB_WORKFLOWS_FOLDER = '.github/workflows/' -&gt; packages/cli/src/config/repository/tooling.ts.
- planCi (function, 113-124): **move** to `packages/cli/src/commands/init/settings-text.ts` `proposeCi`. CMD-056: moves beside draftSettings as proposeCi, because it does not plan (NMS table B); it proposes the CI provider without asking, none when a lint job exists (CLX-001); the choices come from CI_FILE_LABELS plus none. Values to config: ORIGIN_URL_SETTING = 'remote.origin.url' -&gt; packages/cli/src/config/system/git.ts; REMOTE_URL_SCHEME = /^(?:https?|ssh):\\/\\//u, REMOTE_URL_USER = /^\[^@/\]+@/u -&gt; packages/cli/src/config/commands/init.ts.
- headTables (function, 126-184): **move** to `packages/cli/src/commands/init/settings-text.ts` `headTables`. CMD-056: moves to init/settings-text.ts; CMD-042 draftSelection shared with readFormatTables; CMD-007 Xcode destination from detectedDefaults; init writes the detected xcode.project, xcode.destination and openapi.document, and xcode.destination is absent when nothing is detected (POL-033, TML-010); scopes are \[\[scope\]\] records with path and dotted keys (TML-017); TEMPLATE_HEAD goes, because the configurations key written after the template spread wins (TML-011). Values to config: PBXPROJ_NAME = 'project.pbxproj' -&gt; packages/cli/src/config/parsers/xcode.ts (beside PBXPROJ; it moves with the CMD-007 destination code).
- applyIntegrations (function, 187-196): **inline** to `packages/cli/src/commands/init/settings-text.ts` `initSettingsText`. CMD-044: one if/else per key, one caller; it writes ci.enabled = true (provider only when it is not the default github) and rules.enabled = false only when rules are off (TML-015, TML-017); there is no runner key (INX-003).
- writeSetup (function exported, 205-249): **move** to `packages/cli/src/commands/init/write.ts` `writeInitFiles`. Init never installs: prepareToolProjects, installTools and the install option go, and the last line says run gspot install; CMD-056: moves to init/write.ts; glossary setup row: writeSetup is retired for init files; CMD-041; CMD-005.
- askQuestions (function exported, 258-278): **delete**. Init asks no question but "Continue?": planInit sets hooks and rules on and takes the CI provider from proposeCi, or all three from the template (CLX-001).
- askConfirmation (function exported, 288-299): **move** to `packages/cli/src/commands/init/command.ts` `askConfirmation`. CMD-056, CMD-029: the "Continue?" prompt is the only question, so it sits with its one caller, initCommand, with no flag parameter (CLX-001, CMD-092).
- proposeText (function exported, 309-325): **move** to `packages/cli/src/commands/init/settings-text.ts` `initSettingsText`. CMD-056: becomes initSettingsText in init/settings-text.ts (CMD-078; settings, not policy); CMD-043; NMU-031; the schema line carries the running version, <<https://unpkg.com/@gspothq/cli@><version>/gspot.schema.json> (CFR-001); the "Copied from template" comment names the template file given to --from (TML-011); the preface is "# gspot settings for this repository. Change them with gspot set, unset, ignore, add, and remove." (TML-017).
- draftPolicy (function exported, 333-351): **move** to `packages/cli/src/commands/init/settings-text.ts` `draftSettings`. CMD-056: becomes draftSettings in init/settings-text.ts (glossary settings); CMD-046 spreads the answers; CMD-007 commit scopes from detectedDefaults; the draft carries ci and rules, written as ci.enabled and rules.enabled, with no runner field (TML-015, INX-003). Values to config: COMMIT_SCOPES = \['root', 'hooks', 'deps'\] -&gt; packages/cli/src/config/settings/defaults.ts (with the CMD-007 detected defaults).

## `packages/cli/src/commands/init/detection.ts`

- row (function, 6-10): **keep** to `packages/cli/src/commands/init/detection.ts` `row`. Real job.
- scopesRow (function, 12-20): **keep** to `packages/cli/src/commands/init/detection.ts` `scopesRow`. CMD-092: no --scope-configurations note.
- toolingRows (function, 22-35): **keep** to `packages/cli/src/commands/init/detection.ts` `toolingRows`. Real job; the runner row goes, because init does not report or set a runner (INX-003).
- ownershipRows (function, 37-42): **rename** to `packages/cli/src/commands/init/detection.ts` `replaceRows`. Glossary replace: owner and owns are retired here (NMU-072).
- detectionText (function exported, 49-86): **keep** to `packages/cli/src/commands/init/detection.ts` `detectionText`. NMU-009: group labels come from GROUP_LABELS.

## `packages/cli/src/commands/init/plan.ts`

- runnerRows (function, 35-54): **rename** to `packages/cli/src/commands/init/plan.ts` `toolProjectRows`. NMS table B: these are tool-project rows; the mise file row shows whenever misePins is not empty (INS-003); its path is .gspot/mise.toml, MISE_TOOL_PROJECT_FILE in packages/cli/src/config/system/locations.ts (INX-001), and its count holds only program tools, no gspot and no Node (INX-002).
- noLongerRuns (function, 57-72): **keep** to `packages/cli/src/commands/init/plan.ts` `noLongerRuns`. CMD-029 text (a package.json whose dependencies); duplicate-pin detection is deleted, so the duplicatePins parameter and the mise.toml row go and it reads no MISE_TOML; it lists lint folders and lint-only manifests (INX-007).
- retainedCiRows (function, 75-85): **rename** to `packages/cli/src/commands/init/plan.ts` `keptCiRows`. CMD-029: kept, not retained; TTC-032: retains is retired.
- section (function, 87-91): **keep** to `packages/cli/src/commands/init/plan.ts` `section`. Real job.
- configurationRows (function, 93-103): **keep** to `packages/cli/src/commands/init/plan.ts` `configurationRows`. Real job.
- configurationSection (function, 105-112): **keep** to `packages/cli/src/commands/init/plan.ts` `configurationSection`. Real job.
- templateSection (function, 114-124): **keep** to `packages/cli/src/commands/init/plan.ts` `templateSection`. The text keeps gspot add &lt;id&gt;, which stays.
- buildInitPlan (function exported, 135-185): **keep** to `packages/cli/src/commands/init/plan.ts` `buildInitPlan`. gspot never touches CLAUDE.md, so the CLAUDE.md row of the delete list goes; CMD-091 no unread; the duplicateMisePins call goes (INX-007); the "CI setup (no workflow generated)" block, ciNpmInstall and CI_SETUP, goes (INX-005); the template block has no selection and names the template file (TML-011); it reads policy.rules.enabled. Values to config: GITIGNORE_FILE = '.gitignore' -&gt; packages/cli/src/config/repository/tracked.ts (also in config/lifecycle/ownership.ts RETAINED_PATHS).
- initPlanText (function exported, 192-208): **keep** to `packages/cli/src/commands/init/plan.ts` `initPlanText`. CMD-091: no missing section.

## `packages/cli/src/commands/init/public.ts`

- templateAnswers (function, 42-53): **inline** to `packages/cli/src/commands/init/command.ts` `planInit`. CMD-056: there are no question flags to fill (CLX-001, INX-003), so the template values for hooks, ci and rules become the answers in planInit, read from rules.enabled, ci.enabled and ci.provider (TML-015), and its configurations pass as they are (CMD-039); CMD-045.
- presentPlan (function, 56-75): **inline** to `packages/cli/src/commands/init/command.ts` `initCommand`. CMD-091: the unreadable branch is dead, so only the dry run is left; one caller; CMD-076.
- parseScopeConfigurations (function, 78-89): **delete**. CMD-092: --scope-configurations is deleted.
- assertCleanTree (function, 91-101): **rename** to `packages/cli/src/commands/init/command.ts` `assertCleanTree`. CMD-056: init/public.ts becomes init/command.ts; NMU-032 git error code. Values to config: GIT_STATUS_ARGUMENTS = \['status', '--porcelain'\] -&gt; packages/cli/src/config/system/git.ts.
- printDetection (function, 104-127): **rename** to `packages/cli/src/commands/init/command.ts` `printDetection`. CMD-056: init/public.ts becomes init/command.ts.
- initCommand (function exported, 134-166): **rename** to `packages/cli/src/commands/init/command.ts` `initCommand`. Init never installs: no installation note, no installation error, exit 0 after the write, and the text ends with run gspot install; CMD-056: init/public.ts becomes init/command.ts; CMD-006 throws for an existing gspot.toml; CMD-039; tests reach init through it.
- registerInit (function exported, 172-230): **rename** to `packages/cli/src/commands/init/command.ts` `registerInit`. --no-install goes with the install step, and the description says run gspot install; CMD-056: init/public.ts becomes init/command.ts; CMD-092 deletes eight flags, and no question or runner flags are left (CLX-001, INX-003); the option is --configurations &lt;names...&gt; (CLX-013); --json is its own option, so the --json needs --yes test reads the command options (CLX-005); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012).
- prepare (function exported, 238-284): **rename** to `packages/cli/src/commands/init/command.ts` `planInit`. CMD-056: becomes planInit in init/command.ts; CMD-088: tests call initCommand, so stop exporting; CMD-041; it makes the answers itself: template values, else hooks and rules on and proposeCi (CLX-001); readRepository loses its exclude argument and gets no gspot.toml file declarations (TMF-003, CFR-005).
- readFormatTables (function exported, 294-330): **move** to `packages/cli/src/commands/init/format.ts` `readFormatTables`. PAR-011, DEC-009: the small Prettier and EditorConfig reader lives in commands/init/format.ts; CMD-042. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.

## `packages/cli/src/commands/init/takeover.ts`

- captureOwned (function, 8-16): **inline** to `packages/cli/src/commands/init/replace.ts` `planReplacedFiles`. CMD-091: the missing-file branch is dead; one caller, planReplacedFiles.
- recordOutcome (function, 19-27): **rename** to `packages/cli/src/commands/init/replace.ts` `recordOutcome`. The file is replace.ts, and the text says replace, not takes over.
- planTakeover (function exported, 37-69): **rename** to `packages/cli/src/commands/init/replace.ts` `planReplacedFiles`. Glossary replace, with takeover retired: takeover.ts becomes replace.ts; CMD-077.

## `packages/cli/src/commands/list.ts`

- scopeTag (function, 16-18): **keep** to `packages/cli/src/commands/list.ts` `scopeTag`. Real job.
- buildSettingsResult (function, 20-39): **keep** to `packages/cli/src/commands/list.ts` `buildSettingsResult`. CMD-068: filter on origin, not display text.
- buildConfigurationsResult (function, 41-76): **keep** to `packages/cli/src/commands/list.ts` `buildConfigurationsResult`. LIF-036: settingsSkip.
- buildSettingRows (function, 84-112): **keep** to `packages/cli/src/commands/list.ts` `buildSettingRows`. POL-034: the extra key keeps its name, as the code already says extra; the extra table carries its own reason, { value, reason }, so the row reads that reason (CFR-002); scopes are \[\[scope\]\] records.
- statusLabel (function, 114-117): **keep** to `packages/cli/src/commands/list.ts` `statusLabel`. Real job.
- registerList (function exported, 123-138): **keep** to `packages/cli/src/commands/list.ts` `registerList`. CLX-012; the argument is new Argument("\[what\]").choices(LIST_KINDS).default("configurations") (CLX-013); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012). Values to config: LIST_KINDS = \['configurations', 'settings'\] -&gt; packages/cli/src/config/commands/list.ts.

## `packages/cli/src/commands/public.ts`

- scopeSelections (function, 45-100): **move** to `packages/cli/src/commands/session.ts` `scopeSelections`. CMD-003: moves to commands/session.ts; CMD-007: the per-configuration defaults move to detectedDefaults; CMD-060 plain tuple; init writes xcode.project and openapi.document when it finds them, so only site.build_command keeps a computed default (TML-010); selectPackageInstaller takes no runner argument and falls back to npm (INX-003). Values to config: BUILD_SCRIPT = \['run', 'build'\] -&gt; packages/cli/src/config/settings/defaults.ts (with the CMD-007 detected defaults).
- driftText (function, 102-121): **move** to `packages/cli/src/commands/apply.ts` `staleFilesText`. Its only caller is planApply in apply.ts (CLX-004); drift is a retired name (glossary: stale), so it prints the StaleFile list as staleFilesText.
- planApply (function, 123-132): **move** to `packages/cli/src/commands/apply.ts` `planApply`. Only apply keeps a gspot.toml dry run, so planApply moves to apply.ts (CLX-004).
- reportText (function, 134-143): **move** to `packages/cli/src/commands/save-settings.ts` `reportText`. CMD-004: one write report, beside saveSettings.
- openSession (function exported, 151-207): **move** to `packages/cli/src/commands/session.ts` `openSession`. Install goes straight into .gspot/ with no staging folder, so the getPendingInstallations field of the tool search goes; CMD-003: moves to commands/session.ts; CMD-060; CMD-012 no PolicyFile.path; scopes are \[\[scope\]\] records with path; fileDeclarations gets only the configurations declarations (CFR-005); the exclude argument and the pathMatcher(policy.exclude) guard go (TMF-003); installUv is deleted, so the pythonInstaller field goes and uv is found through the one mise bin-paths call (INX-006).
- commandRoot (function exported, 214-216): **delete**. CMD-092: -C is deleted, so every command starts in process.cwd().
- commandHelp (function exported, 223-231): **move** to `packages/cli/src/commands/program.ts` `commandHelp`. CMD-003: moves to commands/program.ts; CLX-012 one loop in buildProgram, no throw; CLX-012 exit lines built here; the levels branch goes (CLX-010).
- registerApply (function exported, 237-254): **move** to `packages/cli/src/commands/apply.ts` `registerApply`. CMD-003: moves to commands/apply.ts; its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012).
- applyCommand (function exported, 261-298): **move** to `packages/cli/src/commands/apply.ts` `applyCommand`. CMD-003: moves to commands/apply.ts; it calls saveSettings with the reconcile change; CMD-022 reads gspot.toml once; tests reach apply through it.

## `packages/cli/src/commands/remove.ts`

- removeCommand (function, 23-68): **keep** to `packages/cli/src/commands/remove.ts` `removeCommand`. Command remove stays: it refuses always-selected and required configurations and records removed_configurations; CMD-032 shares the edit setup and one always-selected refusal with add; assertVersionPin takes the root alone (INX-003).
- registerRemove (function exported, 74-95): **keep** to `packages/cli/src/commands/remove.ts` `registerRemove`. Command remove stays; CMD-092 deletes -C, so the action passes process.cwd(); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012); CLX-004 deletes --dry-run.

## `packages/cli/src/commands/set.ts`

- parseStructured (function, 35-48): **keep** to `packages/cli/src/commands/set.ts` `parseStructured`. Real job: set writes single values and list items only, and record lists are written by hand, so the JSON branch goes and only one value in the TOML inline form (a rule-options list or an extra table) is parsed; the message names only that form.
- parseItem (function, 50-56): **keep** to `packages/cli/src/commands/set.ts` `parseItem`. Export it: unset.ts parses list items too.
- buildSettingError (function, 58-69): **keep** to `packages/cli/src/commands/set.ts` `buildSettingError`. Export it: unset.ts refuses unknown settings the same way.
- parseSettingValue (function, 71-91): **keep** to `packages/cli/src/commands/set.ts` `parseSettingValue`. No record lists go through set, so the item-reason branch goes and a list value is its parsed items.
- changeText (function, 94-98): **inline** to `packages/cli/src/commands/set.ts` `describeSet`. CMD-092: no --replace or --remove mode is left; one caller.
- describeSet (function, 100-112): **keep** to `packages/cli/src/commands/set.ts` `describeSet`. Real job.
- changeSetting (function, 114-150): **keep** to `packages/cli/src/commands/set.ts` `changeSetting`. CMD-092: set writes a value or adds list items only; POL-003 adds keys to a table; --reason writes the reason form { value = ..., reason = "..." } (CFR-002); adding a list item that loosens the check without --reason is refused, and the message prints the current reason (TMF-006); &lt;values...&gt; is required, so the needs-a-value check goes (CLX-013); removed_configurations is not a setting, so set refuses it (CLX-003); record lists are written by hand, so the record-item reason branch goes.
- setCommand (function, 157-182): **split** to `packages/cli/src/commands/set.ts; packages/cli/src/commands/unset.ts` `setCommand;unsetCommand`. The --default branch becomes gspot unset, which also removes list items; unset takes no --reason (CLX-002), deletes a value together with its reason form with no \[reasons\] table (CFR-002), refuses removed_configurations (CLX-003), and registers --scope; neither set nor unset has --dry-run (CLX-004); CMD-092; CMD-020 scope message from getScopeTable; CMD-032; assertVersionPin takes the root alone (INX-003).
- registerSet (function exported, 188-225): **keep** to `packages/cli/src/commands/set.ts` `registerSet`. CMD-092 deletes --replace, --remove and --default; the argument is &lt;values...&gt; (CLX-013); the Levels block of the set help goes (CLX-010); its help texts move into COMMAND_HELP in packages/cli/src/config/commands/help.ts (CLX-012); CLX-004 deletes --dry-run.

## `packages/cli/src/config/agent-rules.ts`

- FRONT_MATTER (const exported, 2-2): **delete**. CFL-025 deletes its only user.
- CHECKS_INSTALLED (const exported, 4-5): **rename** to `packages/cli/src/config/rules.ts` `CHECKS_CLOSING`. CMD-084: the closing paragraph, without the banned conjunction with; NMU-031 text; the file follows the rules rename, config/rules.ts.
- RULES_ALONE (const exported, 7-8): **rename** to `packages/cli/src/config/rules.ts` `RULES_ONLY_CLOSING`. CMD-084; glossary: rules are written, not installed; the file follows the rules rename, config/rules.ts.
- INSTRUCTION_HEADING (const exported, 11-11): **rename** to `packages/cli/src/config/rules.ts` `RULES_HEADING`. The AGENTS.md heading is # Rules; glossary managed block, with instruction index retired; the file follows the rules rename, config/rules.ts.

## `packages/cli/src/config/commands/check.ts`

- CHECK_FLAG_DEFAULTS (const exported, 1-1): **delete**. --skip is deleted (CMD-092) and --base has no default, so the defaults table goes.
- PUSH_ARGUMENTS (const exported, 4-4): **delete**. CMD-023: the argument-count check goes, so PUSH_ARGUMENTS goes.

## `packages/cli/src/config/commands/doctor.ts`

- COLUMN_WIDTHS (const exported, 6-6): **keep** to `packages/cli/src/config/commands/doctor.ts` `COLUMN_WIDTHS`. A static value with one user; it stays in the doctor config file.
- VERSION_GAP (const exported, 8-8): **keep** to `packages/cli/src/config/commands/doctor.ts` `VERSION_GAP`. A static value with one user; it stays in the doctor config file.
- SUGGESTION_SECTIONS (const exported, 10-16): **keep** to `packages/cli/src/config/commands/doctor.ts` `SUGGESTION_SECTIONS`. CMD-073 inline type; CMD-047 titles; it stays in config/, written as const without the SuggestionSection annotation, because config/ may not import types/; suggestionLines checks each key.
- HEADER_BYTES (const exported, 18-18): **keep** to `packages/cli/src/config/commands/doctor.ts` `HEADER_BYTES`. PLR-006: doctor keeps its own small read; it stays in the doctor config file.
- TOOL_STATE_COLORS (const exported, 20-27): **keep** to `packages/cli/src/config/commands/doctor.ts` `TOOL_STATE_COLORS`. State host becomes system; it stays in config/ without the satisfies clause, which imports picocolors and types/; toolLines indexes it with ToolInspection\['state'\] and colors, so a missing state or color fails the type check.
- CI_REPORT_PATHS (const exported, 29-29): **move** to `packages/cli/src/config/generation/ci.ts` `CI_FILE_LABELS`. The same provider-to-file map as the CI_CHOICES labels without none, so one table sits beside GITHUB_WORKFLOW; doctor prints it, and proposeCi reads its keys, github and gitlab (CLX-001).
- STALE_SETUP_WARNING (const exported, 32-32): **inline** to `packages/cli/src/commands/doctor/command.ts` `doctorCommand`. CMD-074: filled once, so the template string sits at the call site; CMD-029 text.

## `packages/cli/src/config/commands/explain.ts`

- DIRECTION_TEXTS (const exported, 3-9): **rename** to `packages/cli/src/config/commands/explain.ts` `REASON_NEEDED_TEXTS`. NMU-020: key reason_needed; POL-027: no tightening entry; the docs settings page imports it; it stays in config/ as const without the SettingDeclaration annotation, because config/ may not import types/.

## `packages/cli/src/config/commands/help.ts`

- COMMAND_HELP (const exported, 5-65): **keep** to `packages/cli/src/config/commands/help.ts` `COMMAND_HELP`. Unset and unignore are added, add and remove stay; one as const record per command with every help text: summary, description, arguments, options, exit codes, example (CLX-012); CLX-012: typed by command name, so commandHelp and buildProgram write keyof typeof COMMAND_HELP at the use site, with no CommandName type and no types/commands/help.ts; CLX-012 only what differs; the levels field goes (CLX-010); CLX-008 deletes the help command; DOC-006: the docs commands page imports it.

## `packages/cli/src/config/commands/init.ts`

- COLUMN_GAP (const exported, 5-5): **keep** to `packages/cli/src/config/commands/init.ts` `COLUMN_GAP`. A static value with one user; it stays in the init config file.
- CONFIGURATION_WIDTH (const exported, 7-7): **keep** to `packages/cli/src/config/commands/init.ts` `CONFIGURATION_WIDTH`. A static value with one user; it stays in the init config file.
- REASON_WIDTH (const exported, 9-9): **keep** to `packages/cli/src/config/commands/init.ts` `REASON_WIDTH`. A static value with one user; it stays in the init config file.
- HOOKS_ROW (const exported, 12-15): **keep** to `packages/cli/src/config/commands/init.ts` `HOOKS_ROW`. A static value with one user; it stays in the init config file.
- CI_SETUP (const exported, 17-19): **delete**. INX-005: the "CI setup (no workflow generated)" block goes, so CI_SETUP goes.
- JSON_SCHEMA_URL (const exported, 21-21): **move** to `packages/cli/src/config/settings/file.ts` `SCHEMA_URL_PREFIX`. Users are init and the gspot.toml writer, so it moves to the gspot.toml file topic, config/settings/file.ts; the URL carries the running version, so it is SCHEMA_URL_PREFIX = "<https://unpkg.com/@gspothq/cli@>" (CFR-001); the docs schema page that read it is deleted. Values to config: SCHEMA_FILE = "gspot.schema.json" -&gt; packages/cli/src/config/settings/file.ts.
- SCHEMA_LINE (const exported, 23-23): **delete**. The schema line holds the running version, so it is no fixed value: the gspot.toml writer builds it from SCHEMA_COMMENT_PREFIX, SCHEMA_URL_PREFIX, the version, and SCHEMA_FILE in config/settings/file.ts, and apply rewrites it when the version differs (CFR-001).
- TEMPLATE_HEAD (const exported, 25-25): **delete**. The template and selection keys are deleted, and headTables writes configurations after the template spread, so the filter has nothing to do (TML-011).
- RUNNER_CHOICES (const exported, 27-34): **delete**. The runner setting is deleted (INX-003), so its choices go.
- CI_CHOICES (const exported, 36-40): **delete**. Init asks no CI question (CLX-001); proposeCi tests the origin host against the keys of CI_FILE_LABELS.
- ALREADY_INSTALLED (const exported, 42-43): **inline** to `packages/cli/src/commands/init/command.ts` `initCommand`. CMD-006: initCommand throws GspotError for an existing gspot.toml.
- DETECTION_LABEL_WIDTH (const exported, 45-45): **keep** to `packages/cli/src/config/commands/init.ts` `DETECTION_LABEL_WIDTH`. A static value with one user; it stays in the init config file.
- DETECTION_GAP_WIDTH (const exported, 47-47): **keep** to `packages/cli/src/config/commands/init.ts` `DETECTION_GAP_WIDTH`. A static value with one user; it stays in the init config file.
- PREFACE (const exported, 49-54): **rename** to `packages/cli/src/config/commands/init.ts` `PREFACE_BODY`. The preface reads "# gspot settings for this repository. Change them with gspot set, unset, ignore, add, and remove." (TML-017); CMD-043: text without the schema line; NMU-031; it stays in the init config file.
- ATTRIBUTES_ROW (const exported, 57-60): **keep** to `packages/cli/src/config/commands/init.ts` `ATTRIBUTES_ROW`. A static value with one user; it stays in the init config file.
- XCODE_DESTINATIONS (const exported, 63-71): **move** to `packages/cli/src/config/settings/defaults.ts` `XCODE_DESTINATIONS`. CMD-007: init and the session share one detectedDefaults beside knownSettings, so the detected default values go to config/settings/defaults.ts with COMMIT_SCOPES and BUILD_SCRIPT.

## `packages/cli/src/config/commands/list.ts`

- KEY_GAP (const exported, 1-1): **keep** to `packages/cli/src/config/commands/list.ts` `KEY_GAP`. A static value with one user; it stays in the list config file.
- VALUE_WIDTH (const exported, 3-3): **keep** to `packages/cli/src/config/commands/list.ts` `VALUE_WIDTH`. A static value with one user; it stays in the list config file.

## `packages/cli/src/config/commands/program.ts`

- HELP_CODES (const exported, 1-1): **delete**. CMD-030: exit 0 only when Commander says 0, so the table goes.

## `packages/cli/src/config/commands/set.ts`

- INTEGER (const exported, 1-1): **keep** to `packages/cli/src/config/commands/set.ts` `INTEGER`. A static value with one user; it stays in the set config file.
- DECIMAL (const exported, 3-3): **keep** to `packages/cli/src/config/commands/set.ts` `DECIMAL`. A static value with one user; it stays in the set config file.
- STRUCTURED (const exported, 6-6): **keep** to `packages/cli/src/config/commands/set.ts` `STRUCTURED`. A static value with one user; it stays in the set config file.

## `packages/cli/src/config/configurations.ts`

- CONFIGURATION_RULES_FOLDER (const exported, 5-5): **rename** to `packages/cli/src/config/configurations.ts` `RULES_FOLDER`. The lowest file shared by rules.ts and the configurations, and the build-time manifest check imports it; LIF-010: the owner name is rules, so RULES_FOLDER; it stays in config/configurations.ts.
- SETTING_DEFAULT_FIELDS (const exported, 8-8): **delete**. No user is left: validateDefaults and assertSettingsAgree go, because each setting is declared once.
- SENTENCE_MIN_CHARS (const exported, 10-10): **delete**. LIF-006: the schema uses z.string().min(1), so the constant goes.
- CONFIG_PREFIX (const exported, 12-12): **move** to `packages/cli/src/config/system/locations.ts` `TOOL_FILE_PREFIX`. CMD-085: built only from TOOL_FILE_DIRECTORY, so it sits beside it in config/system/locations.ts as TOOL_FILE_PREFIX; manifests.ts, tool-pins.ts and repository/selectors.ts use it.
- NAMING_TERMS_FILE (const exported, 14-14): **rename** to `packages/cli/src/config/configurations.ts` `NAMING_DEFAULTS_FILE`. One user; glossary naming defaults (naming/defaults.json); it stays in config/configurations.ts.
- CONFIGURATION_LABELS (const exported, 17-26): **rename** to `packages/cli/src/config/configurations.ts` `GROUP_LABELS`. NMU-009: one table of group labels, with General, which the docs import; glossary configuration group; GROUPS is the one group list in config/configurations.ts: the manifest group field becomes z.enum(GROUPS), GROUP_LABELS is keyed by it, and types/ derives the group type; written as const without the Manifest annotation, because config/ may not import types/. Values to config: GROUPS = \['language', 'framework', 'platform', 'database', 'testing', 'infrastructure', 'library', 'general'\] -&gt; packages/cli/src/config/configurations.ts.
- MISE_BACKENDS (const exported, 28-34): **keep** to `packages/cli/src/config/configurations.ts` `MISE_BACKENDS`. tool-pins.ts and tools/ use it; it stays in config/configurations.ts, as const without the MiseBackend annotation.
- INSTALLATION_KINDS (const exported, 37-37): **move** to `packages/cli/src/config/system/locations.ts` `TOOL_FOLDER_KINDS`. The tool-folder kinds are an as const list in config; the ownership log schema reads z.enum(TOOL_FOLDER_KINDS), and the tool-folder map INSTALLED_TOOL_FOLDERS is keyed by it; glossary installed tool folder.
- GSPOT_MISE_TOOL (const exported, 40-40): **delete**. gspot never pins itself in a mise file, so the gspot mise entry has no user (INX-002).
- TEST_FILES_PLACEHOLDER (const exported, 43-43): **keep** to `packages/cli/src/config/configurations.ts` `TEST_FILES_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- SETTING_PLACEHOLDER (const exported, 45-45): **keep** to `packages/cli/src/config/configurations.ts` `SETTING_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution; the build-time manifest check imports it (LIF-007).
- TOOL_FILE_PLACEHOLDER (const exported, 47-47): **keep** to `packages/cli/src/config/configurations.ts` `TOOL_FILE_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution; LIF-006: the start-up reader check goes.
- POINTER_PLACEHOLDER (const exported, 49-49): **keep** to `packages/cli/src/config/configurations.ts` `POINTER_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- WORKSPACE_PREFIX (const exported, 51-51): **keep** to `packages/cli/src/config/configurations.ts` `WORKSPACE_PREFIX`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- EXISTING_PLACEHOLDER (const exported, 53-53): **keep** to `packages/cli/src/config/configurations.ts` `EXISTING_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- EACH_PLACEHOLDER (const exported, 55-55): **keep** to `packages/cli/src/config/configurations.ts` `EACH_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution; the build-time manifest check imports it (LIF-007).
- FILES_PLACEHOLDER (const exported, 57-57): **keep** to `packages/cli/src/config/configurations.ts` `FILES_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution; execution/command/check.ts reads it.
- FILE_PLACEHOLDER (const exported, 59-59): **keep** to `packages/cli/src/config/configurations.ts` `FILE_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- ROOT_PLACEHOLDER (const exported, 61-61): **keep** to `packages/cli/src/config/configurations.ts` `ROOT_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- SCOPE_PLACEHOLDER (const exported, 63-63): **keep** to `packages/cli/src/config/configurations.ts` `SCOPE_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- INDENT_PLACEHOLDER (const exported, 65-65): **keep** to `packages/cli/src/config/configurations.ts` `INDENT_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- MESSAGE_FILE_PLACEHOLDER (const exported, 67-67): **keep** to `packages/cli/src/config/configurations.ts` `MESSAGE_FILE_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- LEVEL_PLACEHOLDER (const exported, 69-69): **keep** to `packages/cli/src/config/configurations.ts` `LEVEL_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution.
- TARGET_PLACEHOLDER (const exported, 71-71): **keep** to `packages/cli/src/config/configurations.ts` `TARGET_PLACEHOLDER`. A manifest placeholder; the placeholders stay together in config/configurations.ts, read by the manifest schema, configuration errors, repository selection and execution; one user, fillTarget.
- MANIFEST_TABLE_ORDER (const exported, 74-90): **delete**. LIF-006: the manifest table order check goes, so the order list goes.
- NPM_REQUIRES (const exported, 93-93): **delete**. Node is written at both uses, so the constant goes.

## `packages/cli/src/config/planning.ts`

- COVERAGE_DIMENSIONS (const exported, 1-1): **keep** to `packages/cli/src/config/planning.ts` `COVERAGE_DIMENSIONS`. LIF-038: coverageArguments stays in planning/checks.ts; it stays in config/planning.ts.
- COVERAGE_FLAGS (const exported, 3-14): **keep** to `packages/cli/src/config/planning.ts` `COVERAGE_FLAGS`. LIF-038: coverageArguments and checkCompanions read it; it stays in config/planning.ts.

## `packages/cli/src/config/terminal.ts`

- SCOPE_WIDTH_MIN (const exported, 3-3): **keep** to `packages/cli/src/config/terminal.ts` `SCOPE_WIDTH_MIN`. A static value with one user (CMD-058); it stays in config/terminal.ts.
- ID_WIDTH_MIN (const exported, 5-5): **keep** to `packages/cli/src/config/terminal.ts` `ID_WIDTH_MIN`. A static value with one user (CMD-058); it stays in config/terminal.ts.
- STATUS_WIDTH (const exported, 7-7): **keep** to `packages/cli/src/config/terminal.ts` `STATUS_WIDTH`. A static value with one user (CMD-058); it stays in config/terminal.ts.
- FILES_WIDTH (const exported, 9-9): **keep** to `packages/cli/src/config/terminal.ts` `FILES_WIDTH`. A static value with one user (CMD-058); it stays in config/terminal.ts.
- FINDINGS_SHOWN (const exported, 11-11): **keep** to `packages/cli/src/config/terminal.ts` `FINDINGS_SHOWN`. A static value with one user (CMD-058); it stays in config/terminal.ts.
- COMMIT_PREFIX_LENGTH (const exported, 13-13): **keep** to `packages/cli/src/config/terminal.ts` `COMMIT_PREFIX_LENGTH`. A static value with one user (CMD-058); it stays in config/terminal.ts.
- NOTE_STATUSES (const exported, 15-15): **keep** to `packages/cli/src/config/terminal.ts` `NOTE_STATUSES`. A static value with one user (CMD-058); it stays in config/terminal.ts, without the CheckStatus annotation, because config/ may not import types/; the report code indexes it with CheckStatus, so a missing status fails the type check.
- CHECK_STATUS_COLORS (const exported, 17-23): **keep** to `packages/cli/src/config/terminal.ts` `CHECK_STATUS_COLORS`. A static value with one user (CMD-058); it stays in config/terminal.ts, without the CheckStatus annotation, because config/ may not import types/; the report code indexes it with CheckStatus, so a missing status fails the type check.
- RESULT_JSON_INDENT (const exported, 25-25): **keep** to `packages/cli/src/config/terminal.ts` `RESULT_JSON_INDENT`. A static value with one user (CMD-058); it stays in config/terminal.ts.

## `packages/cli/src/public.ts`

- GspotProgram (class, 21-36): **delete**. A plain new Command replaces the class; list options stay variadic, and --json is declared on each command (CLX-005).
- printFailure (function, 38-50): **move** to `packages/cli/src/commands/program.ts` `printFailure`. IGN-022, ARC-002: the program sits in commands/program.ts; CMD-030; CMD-006.
- buildProgram (function exported, 56-100): **move** to `packages/cli/src/commands/program.ts` `buildProgram`. IGN-022: moves to commands/program.ts; add and remove stay, unset and unignore are added; CLX-012 help footer loop; the program has no options but --version and --help, the help-footer loop declares --json on every command, the hidden-copy loop goes, and preAction reads --json from the action command (CLX-005); .helpCommand(false) (CLX-008); CLX-012; docs and tests use it.
- main (function exported, 107-121): **move** to `packages/cli/src/commands/program.ts` `main`. IGN-022: moves to commands/program.ts; output is configured once; main.ts keeps setting the exit code; the catch reads argv.includes('--json'), because a Commander parse error comes before any action (CLX-005).

## `packages/cli/src/terminal/contracts.ts`

- seconds (function, 20-22): **rename** to `packages/cli/src/terminal/check-report.ts` `seconds`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts.
- location (function, 24-29): **rename** to `packages/cli/src/terminal/check-report.ts` `location`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts.
- findingLines (function, 33-40): **rename** to `packages/cli/src/terminal/check-report.ts` `findingLines`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts.
- checkTail (function, 42-45): **rename** to `packages/cli/src/terminal/check-report.ts` `checkTail`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts.
- failureLines (function, 47-56): **rename** to `packages/cli/src/terminal/check-report.ts` `failureLines`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; CMD-092: a verbose flag, no quiet.
- checkLines (function, 58-70): **rename** to `packages/cli/src/terminal/check-report.ts` `checkLines`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; CMD-092: a verbose flag, no quiet.
- ignoreLines (function, 72-81): **rename** to `packages/cli/src/terminal/check-report.ts` `ignoreLines`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; CMD-092: a verbose flag, no quiet.
- tailLines (function, 83-98): **rename** to `packages/cli/src/terminal/check-report.ts` `tailLines`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; CMD-092: no quiet.
- counted (function, 100-102): **rename** to `packages/cli/src/terminal/check-report.ts` `counted`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts.
- summaryLine (function, 104-112): **rename** to `packages/cli/src/terminal/check-report.ts` `summaryLine`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts.
- comparisonLine (function, 114-120): **rename** to `packages/cli/src/terminal/check-report.ts` `comparisonLine`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; CMD-029 text.
- runText (function exported, 129-152): **rename** to `packages/cli/src/terminal/check-report.ts` `runText`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; CMD-052 HookName, which is 'pre-commit' or 'pre-push' (CLX-006); CMD-092 verbose flag.
- progress (function exported, 162-168): **rename** to `packages/cli/src/terminal/check-report.ts` `progress`. CMD-058: terminal/contracts.ts becomes terminal/check-report.ts; it writes to process.stderr with no stream parameter; CMD-011.

## `packages/cli/src/terminal/public.ts`

- options (const, 7-7): **rename** to `packages/cli/src/terminal/print.ts` `options`. CMD-058: terminal/public.ts becomes terminal/print.ts; mutable output state, not a constant, so it stays in print.ts.
- printJson (function, 10-12): **rename** to `packages/cli/src/terminal/print.ts` `printJson`. CMD-058: terminal/public.ts becomes terminal/print.ts.
- colors (const exported, 14-14): **rename** to `packages/cli/src/terminal/print.ts` `colors`. CMD-058: terminal/public.ts becomes terminal/print.ts; made at load time by calling picocolors, so it stays in print.ts.
- isColorAllowed (function exported, 21-25): **rename** to `packages/cli/src/terminal/print.ts` `isColorAllowed`. CMD-058: terminal/public.ts becomes terminal/print.ts; CMD-092: no --no-color parameter, NO_COLOR stays; CMD-089 drops isCI.
- selectVerbosity (function exported, 32-35): **delete**. CMD-092 and CMD-010: there is no --quiet, and --verbose is a check flag the command reads itself.
- configureOutput (function exported, 41-44): **rename** to `packages/cli/src/terminal/print.ts` `configureOutput`. CMD-058: terminal/public.ts becomes terminal/print.ts; output is configured once.
- note (function exported, 50-53): **inline** to `packages/cli/src/commands/check/tree.ts` `reportFixes`. NMS table B keeps the name note, because info is a banned term; once CMD-010 moves the init line into its result text, note has one caller, reportFixes, and one line of work, so the \[info\] line is written there; CMD-011.
- warn (function exported, 59-62): **rename** to `packages/cli/src/terminal/print.ts` `warn`. CMD-058: terminal/public.ts becomes terminal/print.ts; CMD-011.
- printError (function exported, 68-75): **rename** to `packages/cli/src/terminal/print.ts` `printError`. CMD-058: terminal/public.ts becomes terminal/print.ts.
- printResult (function exported, 81-85): **rename** to `packages/cli/src/terminal/print.ts` `printResult`. CMD-058: terminal/public.ts becomes terminal/print.ts.
- print (function exported, 91-94): **rename** to `packages/cli/src/terminal/print.ts` `print`. CMD-058: terminal/public.ts becomes terminal/print.ts.
- noteLines (function exported, 101-103): **rename** to `packages/cli/src/terminal/print.ts` `noteLines`. CMD-058: terminal/public.ts becomes terminal/print.ts; NMS table B keeps note.

## `packages/cli/src/types/agent-rules.ts`

- AgentRules (type exported, 6-6): **move** to `packages/cli/src/types/rules.ts` `RulesSettings`. Glossary: rules, not agent rules; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;; the type holds enabled, exclude, and instruction_files, because folder and own_rules_folder are deleted (TML-003); exclude entries are written from the repository root as AGENTS.md lists them (TMF-008).
- RuleFile (type exported, 9-9): **move** to `packages/cli/src/types/rules.ts` `RuleFile`. The lowest file shared by rules.ts and generation/; glossary ruleFiles; it moves to the rules topic, types/rules.ts.
- InstructionInputs (type exported, 12-12): **move** to `packages/cli/src/types/rules.ts` `ManagedBlockValues`. One user, managedBlock; glossary managed block, with instruction index retired and Inputs as filler; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.

## `packages/cli/src/types/commands/add.ts`

- AddOptions (type exported, 2-2): **move** to `packages/cli/src/types/commands/save-settings.ts` `ConfigurationsOptions`. AddOptions and RemoveOptions are one type, so it sits with the other options of the commands that save settings; command add stays; there is no isDryRun field (CLX-004).

## `packages/cli/src/types/commands/apply.ts`

- ApplyOptions (type exported, 3-6): **move** to `packages/cli/src/types/commands/save-settings.ts` `ApplyOptions`. It sits with the other options of the commands that save gspot.toml; install has no --dry-run, so InstallOptions is a different type (CLX-004).
- ApplyPlanJson (type exported, 9-16): **move** to `packages/cli/src/types/commands/save-settings.ts` `DryRunJson`. The one dry-run JSON left is apply's, so it keeps the name DryRunJson and sits with the commands that save settings (CLX-004).

## `packages/cli/src/types/commands/check.ts`

- Checked (type exported, 6-6): **move** to `packages/cli/src/types/commands/check.ts` `Checked`. One user; stop exporting; CheckResult and RunReport are plain types in types/execution/check.ts (PAR-006), so it needs no schema type and stays in the check topic file.
- CheckCommandResult (type exported, 8-8): **delete**. CMD-014: CommandResult&lt;RunReport&gt; replaces it.
- PushReport (type exported, 11-16): **move** to `packages/cli/src/types/commands/check.ts` `PushReport`. push.ts builds it and tests read it; CheckResult and RunReport are plain types in types/execution/check.ts (PAR-006), so it stays in the check topic file.
- StagedSelection (type exported, 19-19): **move** to `packages/cli/src/types/commands/check.ts` `StagedFiles`. CMD-050: StagedFiles; stop exporting, because it is used only beside RunFilters; it stays in the check topic file.
- Selections (type exported, 21-26): **move** to `packages/cli/src/types/commands/check.ts` `RunFilters`. One user; CMD-050: RunFilters; it needs no schema type once Stage derives from STAGES, so it stays in the check topic file.
- CheckFlags (type exported, 29-39): **delete**. CMD-053: Commander infers the flags.
- CheckOptions (type exported, 41-56): **move** to `packages/cli/src/types/commands/check.ts` `CheckOptions`. The lowest file of check/, because command.ts and push.ts import tree.ts; CMD-049 field base; CMD-092 no skips, a verbose flag; hook is 'pre-commit' | 'pre-push' (CLX-006); CheckResult and RunReport are plain types in types/execution/check.ts (PAR-006), so it stays in the check topic file.

## `packages/cli/src/types/commands/doctor.ts`

- SuggestionRow (type exported, 4-4): **keep** to `packages/cli/src/types/commands/doctor.ts` `SuggestionRow`. A type with one user; it stays in the doctor topic file.
- Suggestions (type exported, 6-13): **keep** to `packages/cli/src/types/commands/doctor.ts` `Suggestions`. suggestions.ts builds it and command.ts imports it; the duplicateMisePins field goes (INX-007); it stays in the doctor topic file.
- DoctorReport (type exported, 15-24): **keep** to `packages/cli/src/types/commands/doctor.ts` `DoctorReport`. command.ts builds it and tests read it; it carries ruleFiles; it stays in the doctor topic file.
- SuggestionKey (type exported, 26-26): **delete**. CMD-073: the doctor report keeps one table for its titles, so the key type goes.
- SuggestionSection (type exported, 29-29): **delete**. CMD-073: the doctor report keeps one table for its titles, so the section type goes.

## `packages/cli/src/types/commands/explain.ts`

- Explanation (type exported, 5-10): **keep** to `packages/cli/src/types/commands/explain.ts` `Explanation`. The lowest file of explain/, because command.ts imports check.ts; CMD-070 kinds; it stays in the explain topic file.
- PathExplanation (type exported, 12-24): **move** to `packages/cli/src/types/commands/explain.ts` `PathExplanation`. One source user, and tests read it; FileKind becomes (typeof FILE_KINDS)\[number\] in types/repository/inventory.ts, so it needs no schema type and stays in the explain topic file.
- SettingScope (type exported, 26-26): **move** to `packages/cli/src/types/commands/explain.ts` `SettingScope`. One user; SettingEntry is a plain type in types/settings/values.ts (S09-012), so it stays in the explain topic file.
- ConfigurationExplanation (type exported, 28-39): **keep** to `packages/cli/src/types/commands/explain.ts` `ConfigurationExplanation`. One user; CMD-070 alwaysSelected; it stays in the explain topic file.
- Found (type exported, 41-41): **move** to `packages/cli/src/types/commands/explain.ts` `Found`. One user; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- CheckFacts (type exported, 43-50): **keep** to `packages/cli/src/types/commands/explain.ts` `CheckFacts`. One user; CMD-071: no versionRequirements; it stays in the explain topic file.

## `packages/cli/src/types/commands/export.ts`

- ExportOptions (type exported, 2-2): **keep** to `packages/cli/src/types/commands/export.ts` `ExportOptions`. One user; { cwd, file } with no isDryRun (CLX-004); it stays in the export topic file.
- ExportJson (type exported, 5-5): **keep** to `packages/cli/src/types/commands/export.ts` `ExportJson`. One user; no text field, because the dry-run template goes (CLX-004); it stays in the export topic file.

## `packages/cli/src/types/commands/help.ts`

- CommandHelp (type exported, 2-9): **delete**. Its only use is the annotation of COMMAND_HELP, which config/ may not import; the entry type is inferred from the as const table.

## `packages/cli/src/types/commands/ignore.ts`

- IgnoreOptions (type exported, 1-10): **move** to `packages/cli/src/types/commands/save-settings.ts` `IgnoreOptions`. until stays; CMD-092 drops remove; there is no isDryRun field (CLX-004); it sits with the other options of the commands that save settings.

## `packages/cli/src/types/commands/init.ts`

- Choice (type exported, 15-15): **delete**. Its only user, askChoice, goes, because init asks no choice question (CLX-001).
- Planning (type exported, 17-27): **move** to `packages/cli/src/types/commands/init.ts` `InitPlanInputs`. plan.ts and command.ts use it; CMD-046; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- InitPlan (type exported, 29-40): **keep** to `packages/cli/src/types/commands/init.ts` `InitPlan`. CMD-091: no unread field; it needs no schema type once Level derives from LEVELS; the ci field goes (INX-005), and template has no selection field (TML-011); it stays in the init topic file.
- Replaced (type exported, 43-49): **rename** to `packages/cli/src/types/commands/init.ts` `ReplacedFiles`. Glossary replace: Takeover is a retired word (CMD-077); CMD-091: no unread field; it stays in the init topic file.
- PolicyDraft (type exported, 51-60): **move** to `packages/cli/src/types/commands/init.ts` `SettingsDraft`. settings-text.ts, format.ts and command.ts use it; CMD-046: InitAnswers plus the draft fields; glossary settings; no runner field (INX-003); every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- InitAnswers (type exported, 63-68): **move** to `packages/cli/src/types/commands/init.ts` `InitAnswers`. plan.ts and settings-text.ts use it; the answers are defaults or template values, made where the draft is made (CLX-001); no runner field (INX-003); every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- InitPrepared (type exported, 71-76): **keep** to `packages/cli/src/types/commands/init.ts` `InitPrepared`. writeInitFiles takes it, and command.ts imports write.ts; CMD-041: it holds the session and the generated files; it stays in the init topic file.
- Written (type exported, 78-78): **delete**. Init never installs, so installNote and exitCode go, and writeInitFiles returns the lines as string\[\].
- RetirementResult (type exported, 80-80): **delete**. CMD-016: deleteReplacedFiles returns the kept paths, so the result type goes.
- InitJson (type exported, 83-93): **keep** to `packages/cli/src/types/commands/init.ts` `InitJson`. Init never installs, so the note field goes; one source user, and tests read it; it stays in the init topic file.
- DetectionSummary (type exported, 95-104): **move** to `packages/cli/src/types/commands/init.ts` `DetectionSummary`. One user; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- InitFileRow (type exported, 107-107): **keep** to `packages/cli/src/types/commands/init.ts` `InitFileRow`. The lowest file of replace.ts and plan.ts, so there is no type cycle; it stays in the init topic file.

## `packages/cli/src/types/commands/install.ts`

- InstallOptions (type exported, 1-1): **delete**. CMD-015 and CLX-004 leave only cwd, so installCommand takes the start folder as a string.
- InstallJson (type exported, 4-13): **keep** to `packages/cli/src/types/install.ts` `InstallJson`. One source user, and tests read it; the dry-run fields (dryRun, notes, hooks) go (CLX-004); one type, so it lives in the install area types file, types/install.ts.

## `packages/cli/src/types/commands/list.ts`

- SettingRow (type exported, 3-9): **move** to `packages/cli/src/types/commands/list.ts` `SettingRow`. One user; stop exporting; SettingDeclaration is a hand-written type in types/settings/tables.ts, so it stays in the list topic file.
- ExtraRow (type exported, 12-12): **keep** to `packages/cli/src/types/commands/list.ts` `ExtraRow`. One user; stop exporting; POL-034: extra; it stays in the list topic file.
- SettingsListing (type exported, 15-15): **merge** to `packages/cli/src/types/commands/list.ts` `SettingsListJson`. The same shape as SettingsListJson, with rows as settings.
- ConfigurationsListJson (type exported, 18-21): **keep** to `packages/cli/src/types/commands/list.ts` `ConfigurationsListJson`. One source user, and tests read it; it stays in the list topic file.
- SettingsListJson (type exported, 24-24): **move** to `packages/cli/src/types/commands/list.ts` `SettingsListJson`. One source user, and tests read it from types/commands/list.ts.

## `packages/cli/src/types/commands/program.ts`

- GlobalFlags (type exported, 5-5): **delete**. No program option is left, because --json is an option of each command (CLX-005), so there are no global flags.
- Program (type exported, 8-8): **delete**. With no global flags it is Commander's own Command type, so the register functions take Command (CLX-005).
- GlobalCommand (type exported, 11-11): **delete**. CMD-053: Commander types the action command; CMD-092: commandRoot is deleted.

## `packages/cli/src/types/commands/remove.ts`

- RemoveOptions (type exported, 2-2): **merge** to `packages/cli/src/types/commands/save-settings.ts` `ConfigurationsOptions`. Command remove stays; RemoveOptions and AddOptions are one type, ConfigurationsOptions.

## `packages/cli/src/types/commands/save-policy.ts`

- PolicyPlanJson (type exported, 5-5): **delete**. Its only producer, planPolicy, goes (CLX-004).
- SavePolicyOptions (type exported, 8-8): **rename** to `packages/cli/src/types/commands/save-settings.ts` `SaveSettingsOptions`. One user; glossary settings; no isDryRun field (CLX-004); save-policy.ts becomes save-settings.ts.
- PolicySaveResult (type exported, 11-21): **rename** to `packages/cli/src/types/commands/save-settings.ts` `SaveSettingsResult`. Glossary settings; CMD-006 and CMD-021: no preparation or apply error shapes; the dry-run variant goes (CLX-004); save-policy.ts becomes save-settings.ts.

## `packages/cli/src/types/commands/session.ts`

- ScopeSelections (type exported, 5-8): **delete**. CMD-060: scopeSelections returns a plain tuple.

## `packages/cli/src/types/commands/set.ts`

- SetOptions (type exported, 1-11): **move** to `packages/cli/src/types/commands/save-settings.ts` `SetOptions`. One user; CMD-092 drops replace, remove and toDefault; no isDryRun field (CLX-004); it sits with the other options of the commands that save settings.
- ParsedSettingValue (type exported, 14-14): **move** to `packages/cli/src/types/commands/save-settings.ts` `ParsedSettingValue`. One user; it sits with the other types of the commands that save settings.

## `packages/cli/src/types/configurations.ts`

- ConfigurationEvidence (type exported, 9-14): **move** to `packages/cli/src/types/repository/selection.ts` `ConfigurationEvidence`. Detection builds it and commands/init imports it; its kind is the group type, keyof typeof GROUP_LABELS, so it needs no schema type.
- SelectionWalk (type exported, 16-22): **move** to `packages/cli/src/types/configurations.ts` `SelectionWalk`. One user, the requirement walk; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- CheckRule (type exported, 24-24): **move** to `scripts/types/manifests.ts` `CheckContradiction`. LIF-006, LIF-007: the check rules join the build-time assertManifests in scripts/manifests.ts; LIF-010: CheckRule becomes CheckContradiction; scripts keep their exported types in scripts/types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- ParsedManifest (type exported, 27-27): **move** to `packages/cli/src/types/configurations.ts` `ParsedManifest`. PAR-009; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;, types/configurations.ts.
- ExecutionFields (type exported, 29-29): **inline** to `packages/cli/src/types/configurations.ts` `CheckDeclaration`. Used only in its own file, by CheckDeclaration (ARC-026), so it inlines into CheckDeclaration, which is hand-written in types/configurations.ts.
- ToolFileDeclaration (type exported, 31-31): **move** to `packages/cli/src/types/configurations.ts` `ToolFileDeclaration`. PAR-009; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;, types/configurations.ts.
- GeneratedToolFile (type exported, 34-34): **move** to `packages/cli/src/types/generation/files.ts` `WholeToolFile`. One user; NMS table B: GeneratedToolFile lies, so WholeToolFile; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- CheckDeclaration (type exported, 37-40): **move** to `packages/cli/src/types/configurations.ts` `CheckDeclaration`. PAR-009; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;, types/configurations.ts.
- ParsedCheck (type exported, 43-43): **move** to `packages/cli/src/types/configurations.ts` `ParsedCheck`. PAR-009; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;, types/configurations.ts.
- SettingDeclaration (type exported, 45-45): **move** to `packages/cli/src/types/settings/tables.ts` `SettingDeclaration`. Each setting is declared once, in TypeScript, so no \[\[setting\]\] table is parsed and settingSchema goes (S09-012); SettingDeclaration is one hand-written type in types/settings/tables.ts, beside the setting table types.
- FileMatch (type exported, 47-47): **move** to `packages/cli/src/types/repository/selection.ts` `FileMatch`. One user; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- ManifestDeclaration (type exported, 49-53): **move** to `packages/cli/src/types/configurations.ts` `ManifestDeclaration`. PAR-009; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;, types/configurations.ts.
- Manifest (type exported, 56-56): **move** to `packages/cli/src/types/configurations.ts` `Manifest`. PAR-009: tool-pins.ts takes Manifest and manifests.ts imports tool-pins.ts; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;, types/configurations.ts.
- ManifestCache (type exported, 59-59): **delete**. CMD-086: a module-level let replaces the cache type.
- OwnedCheck (type exported, 62-62): **move** to `packages/cli/src/types/configurations.ts` `ConfigurationCheck`. allChecks and explain use it; glossary: owned is retired for this meaning, so ConfigurationCheck; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- SettingMeaning (type exported, 64-64): **delete**. Its one user, assertSettingsAgree, goes, because each setting is declared once and two declarations cannot disagree.
- ConfigurationSelection (type exported, 67-71): **move** to `packages/cli/src/types/repository/selection.ts` `ConfigurationSelection`. One user; one topic file holds the detection and selection shapes of repository/detect.ts and repository/select.ts.
- SelectedConfigurations (type exported, 73-73): **delete**. CMD-086: Pick&lt;ScopeSelection, selected&gt; replaces it.
- ConfigurationSuggestion (type exported, 75-75): **move** to `packages/cli/src/types/repository/selection.ts` `ConfigurationSuggestion`. Detection builds it and doctor imports it; one topic file holds the detection and selection shapes of repository/detect.ts and repository/select.ts.
- DetectionEvidence (type exported, 78-78): **move** to `packages/cli/src/types/repository/selection.ts` `DetectionEvidence`. One user; CMD-086 keeps the name; one topic file holds the detection and selection shapes of repository/detect.ts and repository/select.ts.
- ConfigurationDeclaration (type exported, 81-81): **keep** to `packages/cli/src/types/configurations.ts` `ConfigurationDeclaration`. unknown-names.ts and settings/read.ts use it; it stays in the configurations topic file.
- UnknownConfiguration (type exported, 84-86): **keep** to `packages/cli/src/types/configurations.ts` `UnknownConfiguration`. One user; it stays in the configurations topic file.
- PinRequirement (type exported, 89-89): **keep** to `packages/cli/src/types/configurations.ts` `PinRequirement`. One user, assertPinsAgree in scripts/manifests.ts (LIF-057), whose map holds the version and the configuration of each pin; it stays in the configurations topic file.
- ToolProjectPackage (type exported, 92-97): **keep** to `packages/cli/src/types/configurations.ts` `ToolProjectPackage`. tool-pins.ts and tools/ use it; it stays in the configurations topic file.
- MisePin (type exported, 100-105): **keep** to `packages/cli/src/types/configurations.ts` `MisePin`. tool-pins.ts, manifests.ts and generation/mise.ts use it; it stays in the configurations topic file.
- InstallationKind (type exported, 108-108): **rename** to `packages/cli/src/types/configurations.ts` `InstalledToolFolder`. Glossary installed tool folder; the type is (typeof TOOL_FOLDER_KINDS)\[number\], written in types/.
- MiseBackend (type exported, 111-111): **delete**. Its only use is the annotation of MISE_BACKENDS, which config/ may not import, and MISE_BACKENDS is written as const.
- Level (type exported, 114-114): **keep** to `packages/cli/src/types/configurations.ts` `Level`. Level = (typeof LEVELS)\[number\], with LEVELS = \['recommended', 'all'\] in packages/cli/src/config/configurations.ts; levelSchema becomes z.enum(LEVELS), so types/ needs no schema import.
- RuleSource (type exported, 117-117): **move** to `packages/cli/src/types/rules.ts` `RuleSource`. The lowest file shared by manifests.ts and rules.ts; owner name rules, so the rules topic, types/rules.ts.
- ToolProjectPins (type exported, 120-120): **keep** to `packages/cli/src/types/configurations.ts` `ToolProjectPins`. One user; it stays in the configurations topic file.

## `packages/cli/src/types/planning.ts`

- Session (type exported, 11-26): **move** to `packages/cli/src/types/planning.ts` `Session`. One Session, with ToolSession merged; the lowest folder of its users (planning, rules, generation, apply, execution, checks, commands); every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Skip (type exported, 28-28): **move** to `packages/cli/src/types/planning.ts` `Skip`. One user; CMD-086 keeps it; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Host (type exported, 31-31): **rename** to `packages/cli/src/types/planning.ts` `System`. One user; glossary: system in code, host retired; it stays in the planning file.
- PlanOptions (type exported, 33-45): **keep** to `packages/cli/src/types/planning.ts` `PlanOptions`. files.ts is the planning leaf that checks.ts imports; CMD-049; CMD-092 no skips; it needs no schema type once Stage derives from STAGES, so it stays in the planning file.
- PlanEntry (type exported, 48-48): **move** to `packages/cli/src/types/planning.ts` `PlanEntry`. files.ts and checks.ts use it; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- PlanInputs (type exported, 51-59): **move** to `packages/cli/src/types/planning.ts` `PlanInputs`. files.ts and checks.ts use it; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- Stage (type exported, 61-61): **move** to `packages/cli/src/types/configurations.ts` `Stage`. Stage = (typeof STAGES)\[number\], with STAGES = \['commit', 'push', 'manual', 'message'\] in packages/cli/src/config/configurations.ts, and checkStageSchema is z.enum(STAGES); it sits beside Level (PAR-009).
- SelectionStatus (type exported, 64-66): **rename** to `packages/cli/src/types/planning.ts` `SettingsSkip`. One user; LIF-036: settingsSkip, with settings for policy; it stays in the planning file.
- NativeIgnore (type exported, 68-68): **rename** to `packages/cli/src/types/planning.ts` `ToolIgnore`. One user; NMS table B: native is retired, so ToolIgnore; it stays in the planning file.
- PlannedCheck (type exported, 70-84): **move** to `packages/cli/src/types/planning.ts` `PlannedCheck`. files.ts is the planning leaf that skips.ts and checks.ts import; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- StageFilter (type exported, 86-86): **keep** to `packages/cli/src/types/planning.ts` `StageFilter`. PlanOptions uses it: Stage | all, with Stage from types/configurations.ts; it stays in the planning file.
- LicenseProject (type exported, 89-94): **move** to `packages/cli/src/types/planning.ts` `LicenseProject`. One user; LIF-038; every exported type is hand-written in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.

## `packages/cli/src/types/terminal.ts`

- OutputOptions (type exported, 2-2): **keep** to `packages/cli/src/types/terminal.ts` `OutputOptions`. CMD-092: json and color only, and check-report takes a verbose flag; it stays in the terminal file.
- VerbosityFlags (type exported, 5-5): **delete**. CMD-010, CMD-092: there is no --quiet, and --verbose is a check flag, so the type goes.
- Columns (type exported, 7-7): **keep** to `packages/cli/src/types/terminal.ts` `Columns`. One user; it stays in the terminal file.
- CommandResult (type exported, 10-10): **keep** to `packages/cli/src/types/terminal.ts` `CommandResult`. printResult takes it, and commands import terminal; it stays in the terminal file.
- CommandFailureJson (type exported, 13-13): **keep** to `packages/cli/src/types/terminal.ts` `CommandFailureJson`. One source user, and tests read it; it stays in the terminal file.
- ProgressStream (type exported, 16-16): **delete**. CMD-058: progress writes to process.stderr, so the stream type goes.

## `packages/eslint-plugin/build.ts`

- root (const, 9-9): **move** to `scripts/build.ts` `pluginFolder`. ROOT-017: one build script for both packages, scripts/build.ts (SCR-010); root means the repository root only, so this is pluginFolder.
- distribution (const, 10-10): **move** to `scripts/build.ts` `pluginDistribution`. ROOT-017, SCR-010: one build script for both packages, scripts/build.ts; PLG-013 one ESM build.
- declarations (const, 26-37): **move** to `scripts/build.ts` `declarations`. ROOT-017, SCR-010: one build script for both packages, scripts/build.ts; PLG-015: relative imports, so the .d.ts files resolve.

## `packages/eslint-plugin/src/comments.ts`

- isDirective (function exported, 10-14): **move** to `packages/eslint-plugin/src/rules/header-first.ts` `isToolComment`. PLG-005: one user, so it moves into rules/header-first.ts; glossary tool comment (directive is retired); PLG-002.
- isOwnLine (function exported, 22-25): **move** to `packages/eslint-plugin/src/rules/header-first.ts` `isOwnLine`. PLG-005: one user, so it moves into rules/header-first.ts.

## `packages/eslint-plugin/src/config/build.ts`

- BUILD_FORMATS (const exported, 1-4): **delete**. PLG-013, PLG-014: one ESM build, so the format list goes.

## `packages/eslint-plugin/src/config/comments.ts`

- DIRECTIVE_PREFIXES (const exported, 2-16): **rename** to `packages/eslint-plugin/src/config/comments.ts` `TOOL_COMMENT_PREFIXES`. PLG-005; PLG-002 adds prettier-ignore, nosemgrep, dprint-ignore and deno-lint-ignore; glossary tool comment; the plugin keeps config/ and types/ by topic, not by rule: the header-first comment values.
- TS_DIRECTIVE (const exported, 18-18): **rename** to `packages/eslint-plugin/src/config/comments.ts` `TS_COMMENT`. PLG-005; glossary: directive is retired; the plugin keeps config/ and types/ by topic, not by rule: the header-first comment values.
- LEADING_STAR (const exported, 20-20): **keep** to `packages/eslint-plugin/src/config/comments.ts` `LEADING_STAR`. PLG-005; the plugin keeps config/ and types/ by topic, not by rule: the comments file keeps its name.
- BLANK_LINE_DISTANCE (const exported, 23-23): **keep** to `packages/eslint-plugin/src/config/comments.ts` `BLANK_LINE_DISTANCE`. PLG-005; the plugin keeps config/ and types/ by topic, not by rule: the comments file keeps its name.

## `packages/eslint-plugin/src/config/environment.ts`

- ENVIRONMENT_HOSTS (const exported, 1-1): **keep** to `packages/eslint-plugin/src/config/environment.ts` `ENVIRONMENT_HOSTS`. PLG-005; the plugin keeps config/ and types/ by topic, not by rule: the environment file keeps its name.
- ENVIRONMENT_ALLOWED (const exported, 4-4): **keep** to `packages/eslint-plugin/src/config/environment.ts` `ENVIRONMENT_ALLOWED`. PLG-005; PLG-018 deletes the wrong comment; the plugin keeps config/ and types/ by topic, not by rule: the environment file keeps its name.

## `packages/eslint-plugin/src/config/files.ts`

- INDEX_BASENAMES (const exported, 1-11): **rename** to `packages/eslint-plugin/src/config/paths.ts` `INDEX_BASENAMES`. PLG-006: isIndexFile and no-index-imports use it; the plugin keeps config/ and types/ by topic, not by rule, and config/files.ts becomes config/paths.ts, the one name for path code.
- STDIN_NAMES (const exported, 13-13): **rename** to `packages/eslint-plugin/src/config/paths.ts` `STDIN_NAMES`. PLG-020: no empty name; one user, lintedPath; the plugin keeps config/ and types/ by topic, not by rule, and config/files.ts becomes config/paths.ts, the one name for path code.
- FILE_SCHEME (const exported, 15-15): **delete**. PLG-019: normalizePath has no URL branch, so the file scheme goes.
- INTERNAL_PREFIXES (const exported, 17-17): **move** to `packages/eslint-plugin/src/config/imports.ts` `INTERNAL_PREFIXES`. One user; the plugin keeps config/ and types/ by topic, not by rule: import specifier values sit in config/imports.ts, with no config/no/ nesting.

## `packages/eslint-plugin/src/config/layout.ts`

- BLANK (const exported, 1-1): **move** to `packages/eslint-plugin/src/config/comments.ts` `BLANK`. PLG-005; config/layout.ts held only this one item, so it joins the comments file.

## `packages/eslint-plugin/src/config/no/index-imports.ts`

- MODULE_MOCK_METHODS (const exported, 2-5): **move** to `packages/eslint-plugin/src/config/imports.ts` `MODULE_MOCK_METHODS`. DEC-022; the plugin keeps config/ and types/ by topic, not by rule: import specifier values sit in config/imports.ts, with no config/no/ nesting.

## `packages/eslint-plugin/src/config/no/trivial/files.ts`

- STRUCTURED_EXPRESSIONS (const exported, 4-4): **move** to `packages/eslint-plugin/src/config/syntax.ts` `STRUCTURED_EXPRESSIONS`. DEC-022; the plugin keeps config/ and types/ by topic, not by rule; one file, config/syntax.ts, holds the node-type lists of both trivial-code rules, and the config/no/trivial/ folders go.
- FORWARDING_NODES (const exported, 7-15): **move** to `packages/eslint-plugin/src/config/syntax.ts` `FORWARDING_NODES`. DEC-022; the plugin keeps config/ and types/ by topic, not by rule; one file, config/syntax.ts, holds the node-type lists of both trivial-code rules, and the config/no/trivial/ folders go.

## `packages/eslint-plugin/src/config/no/trivial/functions.ts`

- VALUE_PARENTS (const exported, 2-2): **move** to `packages/eslint-plugin/src/config/syntax.ts` `VALUE_PARENTS`. DEC-022; the plugin keeps config/ and types/ by topic, not by rule; one file, config/syntax.ts, holds the node-type lists of both trivial-code rules, and the config/no/trivial/ folders go.
- SHARED_READS (const exported, 5-5): **move** to `packages/eslint-plugin/src/config/syntax.ts` `MIN_SHARED_READS`. DEC-022: it is a minimum, so MIN_SHARED_READS; the plugin keeps config/ and types/ by topic, not by rule; one file, config/syntax.ts, holds the node-type lists of both trivial-code rules, and the config/no/trivial/ folders go.
- EXPORT_REFERENCES (const exported, 7-7): **move** to `packages/eslint-plugin/src/config/syntax.ts` `EXPORT_REFERENCES`. DEC-022; the plugin keeps config/ and types/ by topic, not by rule; one file, config/syntax.ts, holds the node-type lists of both trivial-code rules, and the config/no/trivial/ folders go.
- TRANSPARENT_EXPRESSIONS (const exported, 9-17): **move** to `packages/eslint-plugin/src/config/syntax.ts` `TRANSPARENT_EXPRESSIONS`. DEC-022; PLG-022: built from TYPE_WRAPPERS in syntax.ts; the plugin keeps config/ and types/ by topic, not by rule; one file, config/syntax.ts, holds the node-type lists of both trivial-code rules, and the config/no/trivial/ folders go.

## `packages/eslint-plugin/src/config/syntax.ts`

- FUNCTIONS (const exported, 1-1): **keep** to `packages/eslint-plugin/src/config/syntax.ts` `FUNCTIONS`. syntax.ts and no-trivial-files use it; PLG-022 one function selector; the plugin keeps config/ and types/ by topic, not by rule: the syntax file keeps its name.
- TYPE_ONLY (const exported, 3-3): **keep** to `packages/eslint-plugin/src/config/syntax.ts` `TYPE_ONLY`. One user; the plugin keeps config/ and types/ by topic, not by rule: the syntax file keeps its name.
- WRAPPERS (const exported, 5-12): **keep** to `packages/eslint-plugin/src/config/syntax.ts` `WRAPPERS`. PLG-022: ChainExpression plus TYPE_WRAPPERS; the plugin keeps config/ and types/ by topic, not by rule: the syntax file keeps its name.
- TRIVIAL_STATEMENTS (const exported, 15-15): **keep** to `packages/eslint-plugin/src/config/syntax.ts` `TRIVIAL_STATEMENTS`. Both trivial rules use it; the plugin keeps config/ and types/ by topic, not by rule: the syntax file keeps its name.
- EXECUTABLE_DECLARATIONS (const exported, 18-18): **keep** to `packages/eslint-plugin/src/config/syntax.ts` `EXECUTABLE_DECLARATIONS`. One user; the plugin keeps config/ and types/ by topic, not by rule: the syntax file keeps its name.
- NON_EXECUTABLE_STATEMENTS (const exported, 21-21): **keep** to `packages/eslint-plugin/src/config/syntax.ts` `NON_EXECUTABLE_STATEMENTS`. One user; the plugin keeps config/ and types/ by topic, not by rule: the syntax file keeps its name.

## `packages/eslint-plugin/src/create-rule.ts`

- createRule (const exported, 6-8): **keep** to `packages/eslint-plugin/src/create-rule.ts` `createRule`. Every rule uses it; made at load time by ESLintUtils.RuleCreator, so it stays; the rule pages live under /reference/eslint-plugin/ (DCP-015). Values to config: RULE_URL = '<https://generativespotting.com/reference/eslint-plugin/{name}/>' -&gt; packages/eslint-plugin/src/config/plugin.ts (PLG-051).
- optionsSchema (function exported, 15-17): **keep** to `packages/eslint-plugin/src/create-rule.ts` `optionsSchema`. Four rules use it.

## `packages/eslint-plugin/src/environment.ts`

- environmentReads (function exported, 10-32): **move** to `packages/eslint-plugin/src/rules/no-client-env.ts` `environmentListeners`. PLG-005: one user, so it moves into rules/no-client-env.ts; it returns listeners, so environmentListeners; PLG-001 also walks undeclared process, Bun and Deno.
- environmentNames (function exported, 39-48): **move** to `packages/eslint-plugin/src/rules/no-client-env.ts` `environmentNames`. PLG-005: one user, so it moves into rules/no-client-env.ts.

## `packages/eslint-plugin/src/imports.ts`

- isImportLike (function exported, 9-21): **move** to `packages/eslint-plugin/src/rules/header-first.ts` `isImportLike`. PLG-005: one user, so it moves into rules/header-first.ts.
- isRequireCall (function exported, 28-35): **move** to `packages/eslint-plugin/src/rules/header-first.ts` `isRequireCall`. PLG-005: one user, so it moves into rules/header-first.ts; stop exporting (PLG-023).

## `packages/eslint-plugin/src/layout.ts`

- runsOf (function exported, 9-22): **move** to `packages/eslint-plugin/src/rules/header-first.ts` `runsOf`. PLG-005: one user, so it moves into rules/header-first.ts; non-empty runs, so the two type guards go.

## `packages/eslint-plugin/src/public.ts`

- globCache (const, 7-7): **move** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `globCache`. PLG-006: only import-boundaries matches globs; a mutable cache, not a constant, so it stays in the rule.
- isGlobMatch (function, 15-22): **move** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `isGlobMatch`. PLG-006: only import-boundaries matches globs.
- lintedRoot (function, 29-39): **inline** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `lintedPath`. PLG-020: one line, settings root or cwd, with no hand-written TypeErrors, so it inlines into lintedPath. Values to config: TRAILING_SLASH = /\\/$/u -&gt; packages/eslint-plugin/src/config/paths.ts.
- normalizePath (function exported, 47-53): **rename** to `packages/eslint-plugin/src/paths.ts` `normalizePath`. PLG-006: src/public.ts becomes paths.ts; PLG-019: no URL branch, no cut at # or ?.
- relativeImportPath (function exported, 61-65): **move** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `relativeImportPath`. PLG-006: one user, import-boundaries; PLG-019 strips a query from import specifiers here. Values to config: RELATIVE_PREFIXES = \['./', '../'\] -&gt; packages/eslint-plugin/src/config/imports.ts.
- isIndexFile (function exported, 72-74): **inline** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `noTrivialFiles`. PLG-006, PLG-020: its only caller is no-trivial-files, which passes context.physicalFilename, and it is one statement over INDEX_BASENAMES.
- isAnyGlobMatch (function exported, 82-86): **inline** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `boundaryOf`. PLG-006, PLG-021: no ! exclusions, so it is globs.some((glob) =&gt; isGlobMatch(path, glob)) with one caller, boundaryOf.
- lintedPath (function exported, 93-100): **move** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `lintedPath`. PLG-020: no-trivial-files stops calling it, so import-boundaries is its one user; import-boundaries reads only the relative path, so lintedPath returns that string, or undefined for standard input, and the LintedPath type goes.

## `packages/eslint-plugin/src/rules/header-first.ts`

- commentBlocks (function, 11-35): **keep** to `packages/eslint-plugin/src/rules/header-first.ts` `commentBlocks`. Real job. Values to config: LINE_BREAK_GAP = /^\[\\t \]\*\\r?\\n\[\\t \]\*$/u -&gt; packages/eslint-plugin/src/config/comments.ts.
- startOf (function, 38-50): **keep** to `packages/eslint-plugin/src/rules/header-first.ts` `startOf`. Real job.
- isLeading (function, 53-74): **keep** to `packages/eslint-plugin/src/rules/header-first.ts` `isLeading`. Real job. Values to config: LEADING_LINE_BREAK = /^\[\\t \]\*\\r?\\n/u -&gt; packages/eslint-plugin/src/config/comments.ts.
- removalRange (function, 77-87): **keep** to `packages/eslint-plugin/src/rules/header-first.ts` `removalRange`. Real job.
- headerFirst (const exported, 89-148): **keep** to `packages/eslint-plugin/src/rules/header-first.ts` `headerFirst`. PLG-005: the guards go with non-empty runs; PLG-016: no title.

## `packages/eslint-plugin/src/rules/import-boundaries.ts`

- aliasFor (function, 9-16): **keep** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `aliasFor`. Real job. Values to config: TRAILING_STAR = /\\\*$/u -&gt; packages/eslint-plugin/src/config/paths.ts; TRAILING\_SLASH = /\\/$/u -&gt; packages/eslint-plugin/src/config/paths.ts.
- isWithinFolder (function, 18-21): **keep** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `isWithinFolder`. Real job.
- boundaryOf (function, 24-29): **keep** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `boundaryOf`. Real job.
- importBoundaries (const exported, 31-105): **keep** to `packages/eslint-plugin/src/rules/import-boundaries.ts` `importBoundaries`. PLG-034 text; PLG-016: no title. Values to config: DEFAULT_FOLDERS = \['\*/\*'\] -&gt; packages/eslint-plugin/src/config/imports.ts (PLG-051); IMPORT_SELECTOR = 'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression' -&gt; packages/eslint-plugin/src/config/syntax.ts (shared with no-index-imports).

## `packages/eslint-plugin/src/rules/no-alias-exports.ts`

- isAlias (function, 5-10): **keep** to `packages/eslint-plugin/src/rules/no-alias-exports.ts` `isAlias`. Real job.
- noAliasExports (const exported, 12-46): **keep** to `packages/eslint-plugin/src/rules/no-alias-exports.ts` `noAliasExports`. PLG-016: no title.

## `packages/eslint-plugin/src/rules/no-client-env.ts`

- noClientEnv (const exported, 7-72): **keep** to `packages/eslint-plugin/src/rules/no-client-env.ts` `noClientEnv`. PLG-001; PLG-016: no title. Values to config: PUBLIC_PREFIXES = \['NEXT_PUBLIC\_'\] -&gt; packages/eslint-plugin/src/config/nextjs.ts; CLIENT_DIRECTIVE = 'use client' -&gt; packages/eslint-plugin/src/config/nextjs.ts.

## `packages/eslint-plugin/src/rules/no-index-imports.ts`

- noIndexImports (const exported, 9-56): **keep** to `packages/eslint-plugin/src/rules/no-index-imports.ts` `noIndexImports`. PLG-025: the docs say only explicit index paths are reported; PLG-016; the framework test reads Object.hasOwn(MODULE_MOCK_METHODS, framework) instead of repeating its keys. Values to config: IMPORT_SELECTOR (from packages/eslint-plugin/src/config/syntax.ts).

## `packages/eslint-plugin/src/rules/no-trivial-files.ts`

- ownsTypeShape (function, 10-15): **keep** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `ownsTypeShape`. Real job.
- declarationContent (function, 18-40): **keep** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `declarationContent`. Real job.
- expressionContent (function, 43-62): **keep** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `expressionContent`. Real job.
- callContent (function, 65-86): **keep** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `callContent`. Real job.
- ownsStructuredValue (function, 89-108): **keep** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `ownsStructuredValue`. Real job.
- noTrivialFiles (const exported, 110-181): **keep** to `packages/eslint-plugin/src/rules/no-trivial-files.ts` `noTrivialFiles`. PLG-020; PLG-026: skip files of only empty statements; PLG-034. Values to config: SHEBANG = '#!' -&gt; packages/eslint-plugin/src/config/syntax.ts; FUNCTION_SELECTOR (PLG-022) -&gt; packages/eslint-plugin/src/config/syntax.ts.

## `packages/eslint-plugin/src/rules/no-trivial-functions.ts`

- isTransparentExpression (const, 15-15): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `isTransparentExpression`. Real job.
- VALUE_HOLDERS (const, 18-41): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `VALUE_HOLDERS`. PLG-024: no ArrayExpression entry; its entries are predicate functions, not static values, so it stays in the rule.
- isArrayElementCall (function, 44-54): **delete**. PLG-024: the ArrayExpression entry goes, so this helper has no caller.
- aliases (function, 57-66): **rename** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `callableVariables`. It returns the variables a function is called through, so callableVariables.
- functionValue (function, 73-83): **rename** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `outermostValue`. It returns the outermost value, so outermostValue; PLG-024: the two breaks go.
- isInlineValue (function, 91-97): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `isInlineValue`. Real job.
- isRecursive (function, 105-115): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `isRecursive`. Real job.
- isSharedFunction (function, 118-135): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `isSharedFunction`. Real job.
- hasDeclaredSignature (function, 138-144): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `hasDeclaredSignature`. Real job.
- hasInheritedContract (function, 147-162): **rename** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `isInheritedMethod`. Glossary: contract is filler, so isInheritedMethod; PLG-029: typed RuleTester case.
- isRequiredFunction (function, 165-172): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `isRequiredFunction`. Real job.
- noTrivialFunctions (const exported, 174-219): **keep** to `packages/eslint-plugin/src/rules/no-trivial-functions.ts` `noTrivialFunctions`. PLG-003: no suppression advice; PLG-026; PLG-034. Values to config: FUNCTION_SELECTOR (from packages/eslint-plugin/src/config/syntax.ts).

## `packages/eslint-plugin/src/rules/public.ts`

- rules (const, 12-21): **move** to `packages/eslint-plugin/src/plugin.ts` `rules`. PLG-006: rules/public.ts becomes src/plugin.ts, the entry that builds dist/plugin.js.
- allRules (const, 23-27): **merge** to `packages/eslint-plugin/src/plugin.ts` `rulesAt`. PLG-023: one rulesAt(levels) for both configs.
- recommendedRules (const, 29-33): **merge** to `packages/eslint-plugin/src/plugin.ts` `rulesAt`. PLG-023: one rulesAt(levels) for both configs.
- plugin (const, 35-38): **move** to `packages/eslint-plugin/src/plugin.ts` `plugin`. PLG-006: moves to src/plugin.ts; PLG-023: no Plugin type; PLG-015: name and version without the whole package.json.
- default (export-default exported, 41-46): **move** to `packages/eslint-plugin/src/plugin.ts` `default`. PLG-006: moves to src/plugin.ts; PLG-018 rewrites the comment; docs and tests import the plugin from here. Values to config: PLUGIN_PREFIX = 'gspot' -&gt; packages/eslint-plugin/src/config/plugin.ts (rule IDs gspot/&lt;name&gt;, config names gspot/recommended and gspot/all).

## `packages/eslint-plugin/src/rules/require-server-only.ts`

- requireServerOnly (const exported, 4-46): **keep** to `packages/eslint-plugin/src/rules/require-server-only.ts` `requireServerOnly`. Real rule. Values to config: SERVER_DIRECTIVE = 'use server' -&gt; packages/eslint-plugin/src/config/nextjs.ts; SERVER_ONLY_MODULE = 'server-only' -&gt; packages/eslint-plugin/src/config/nextjs.ts.

## `packages/eslint-plugin/src/syntax.ts`

- childNodes (function, 13-19): **keep** to `packages/eslint-plugin/src/syntax.ts` `childNodes`. Real job.
- totalStatements (function exported, 28-36): **keep** to `packages/eslint-plugin/src/syntax.ts` `totalStatements`. Both trivial rules use it.
- hasConstructorState (function exported, 43-54): **keep** to `packages/eslint-plugin/src/syntax.ts` `hasConstructorState`. Both trivial rules use it.
- unwrap (function exported, 61-65): **keep** to `packages/eslint-plugin/src/syntax.ts` `unwrap`. PLG-022: ASTUtils.isNodeOfTypes instead of ValueOperand.

## `packages/eslint-plugin/src/types/create-rule.ts`

- RuleDocs (type exported, 1-9): **rename** to `packages/eslint-plugin/src/types/rules.ts` `RuleDocs`. PLG-016: no title; PLG-017: no requiresOptions; the plugin keeps types/ by topic: one rules file, types/rules.ts, holds the rule docs, context and options.

## `packages/eslint-plugin/src/types/environment.ts`

- ClientEnvOptions (type exported, 1-1): **move** to `packages/eslint-plugin/src/types/rules.ts` `ClientEnvOptions`. Exported for its test; the plugin keeps types/ by topic: one rules file, types/rules.ts, holds the rule docs, context and options.

## `packages/eslint-plugin/src/types/files.ts`

- LintedPath (type exported, 4-4): **delete**. PLG-020: lintedPath returns the relative path only, so the type has no root field and no user.
- RuleContext (type exported, 6-6): **move** to `packages/eslint-plugin/src/types/rules.ts` `RuleContext`. PLG-023: one alias for header-first, import-boundaries and no-client-env; the plugin keeps types/ by topic: one rules file, types/rules.ts, holds the rule docs, context and options.

## `packages/eslint-plugin/src/types/import-boundaries.ts`

- ImportBoundariesOptions (type exported, 1-1): **move** to `packages/eslint-plugin/src/types/rules.ts` `ImportBoundariesOptions`. Exported for its test; the plugin keeps types/ by topic: one rules file, types/rules.ts, holds the rule docs, context and options.

## `packages/eslint-plugin/src/types/imports.ts`

- ImportNode (type exported, 3-3): **inline** to `packages/eslint-plugin/src/types/syntax.ts` `ImportSource`. PLG-023: one ImportSource type in types/syntax.ts.
- ImportSource (type exported, 5-5): **move** to `packages/eslint-plugin/src/types/syntax.ts` `ImportSource`. import-boundaries and no-index-imports use it; the plugin keeps types/ by topic: one syntax file, types/syntax.ts, holds the node shapes.

## `packages/eslint-plugin/src/types/layout.ts`

- StatementStart (type exported, 2-2): **move** to `packages/eslint-plugin/src/types/syntax.ts` `StatementStart`. PLG-005: one user; the plugin keeps types/ by topic: one syntax file, types/syntax.ts, holds the node shapes.

## `packages/eslint-plugin/src/types/no/trivial/files.ts`

- TrivialFilesOptions (type exported, 3-3): **move** to `packages/eslint-plugin/src/types/rules.ts` `TrivialFilesOptions`. DEC-022: exported for its test; the plugin keeps types/ by topic: one rules file, types/rules.ts, holds the rule docs, context and options.
- ContentCheck (type exported, 5-5): **move** to `packages/eslint-plugin/src/types/syntax.ts` `ContentCheck`. DEC-022: one user; the plugin keeps types/ by topic: one syntax file, types/syntax.ts, holds the node shapes.

## `packages/eslint-plugin/src/types/no/trivial/functions.ts`

- TrivialFunctionsOptions (type exported, 1-1): **move** to `packages/eslint-plugin/src/types/rules.ts` `TrivialFunctionsOptions`. DEC-022: exported for its test; the plugin keeps types/ by topic: one rules file, types/rules.ts, holds the rule docs, context and options.

## `packages/eslint-plugin/src/types/plugin.ts`

- Plugin (type exported, 5-8): **delete**. PLG-023: the plugin object needs no Plugin type.

## `packages/eslint-plugin/src/types/syntax.ts`

- ImplementedFunction (type exported, 3-6): **keep** to `packages/eslint-plugin/src/types/syntax.ts` `ImplementedFunction`. syntax.ts and both trivial rules use it; the plugin keeps types/ by topic: one syntax file, types/syntax.ts, holds the node shapes.
- FunctionBinding (type exported, 9-9): **rename** to `packages/eslint-plugin/src/types/syntax.ts` `NamedFunction`. One user; binding is jargon, so NamedFunction; the plugin keeps types/ by topic: one syntax file, types/syntax.ts, holds the node shapes.
- ValueOperand (type exported, 12-18): **delete**. PLG-022: ASTUtils.isNodeOfTypes replaces it.

## `scripts/config/arguments.ts`

- ARGUMENT_START (const exported, 1-1): **delete**. ROOT-020: array destructuring and process.argv\[2\] replace it.

## `scripts/config/pins.ts`

- REGISTRY_TIMEOUT_MS (const exported, 1-1): **delete**. ROOT-021: no special network time limit.
- RELEASE_NOT_FOUND (const exported, 3-3): **delete**. SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- RELEASE_ENDPOINTS (const exported, 5-10): **delete**. SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- NODE_RELEASES_URL (const exported, 12-12): **delete**. No Node LTS checks; SCR-007: check:pins and scripts/pins.ts go.
- RUNNER_IMAGES_URL (const exported, 14-14): **delete**. SCR-007: the runner image check goes with check:pins (SCR-007).
- RUNNER_LABEL (const exported, 16-16): **delete**. SCR-007: the runner image check goes with check:pins (SCR-007).
- RETIRED_IMAGE (const exported, 18-18): **delete**. SCR-007: the runner image check goes with check:pins (SCR-007).

## `scripts/config/plugin.ts`

- INTERRUPTED_EXIT (const exported, 1-1): **move** to `tests/config/integration.ts` `INTERRUPTED_EXIT`. THR-004: the Ctrl-C cleanup stays; there is no runner script (SCR-003), so the cleanup moves into the integration preload tests/setup/integration.ts and its exit codes into tests/config/integration.ts.
- TERMINATED_EXIT (const exported, 3-3): **move** to `tests/config/integration.ts` `TERMINATED_EXIT`. THR-004: the Ctrl-C cleanup stays; there is no runner script (SCR-003), so the cleanup moves into the integration preload tests/setup/integration.ts and its exit codes into tests/config/integration.ts.
- SUPABASE_DATABASE_TEST (const exported, 5-5): **delete**. The Supabase test is an ordinary integration test, so no runner filter is needed.

## `scripts/eslint-presets.ts`

- project (const, 32-32): **move** to `scripts/update-rule-lists.ts` `testsFolder`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; PLG-054: no chdir; it points at tests/, so testsFolder, computed from import.meta.url. Values to config: TESTS_FOLDER = "tests" -&gt; scripts/config/rule-lists.ts.
- manifests (const, 34-34): **move** to `scripts/update-rule-lists.ts` `manifests`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts.
- versions (const, 35-35): **move** to `scripts/update-rule-lists.ts` `versions`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; THR-008: the same pins are written into tests/package.json.
- prepared (const, 36-36): **move** to `scripts/update-rule-lists.ts` `prepared`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts. Values to config: ESLINT_PRESETS_FILE = "eslint-presets.json" -&gt; packages/cli/src/config/generation/eslint.ts (generation/eslint reads the same file name at run time).
- eslintEntry (const, 37-37): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws. Values to config: ESLINT_PACKAGE = "eslint" -&gt; scripts/config/rule-lists.ts.
- eslintPackage (const, 38-38): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws.
- coreExports (const, 41-41): **move** to `scripts/update-rule-lists.ts` `builtinExports`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; core is a banned term, and ESLint's own export is builtinRules, so builtinExports.
- eslint (const, 42-42): **move** to `scripts/update-rule-lists.ts` `eslint`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts.
- presets (const, 43-48): **move** to `scripts/update-rule-lists.ts` `ruleNames`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; it holds the built-in rule names, so ruleNames. Values to config: BUILTIN_RULES_SOURCE = "builtinRules" -&gt; packages/cli/src/config/generation/eslint.ts (the rule-names schema literal uses it too).
- ruleNamesPath (const, 49-49): **inline** to `scripts/update-rule-lists.ts` `prepared`. One use.
- globalsEntry (const, 72-72): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws.
- installedGlobals (const, 73-73): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws.
- exportedGlobals (const, 78-78): **move** to `scripts/update-rule-lists.ts` `exportedGlobals`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts.
- globals (const, 79-79): **move** to `scripts/update-rule-lists.ts` `globals`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; PLG-011: no serviceworker rename.
- standardEntry (const, 87-87): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws; its entry is part of the helper result.
- standard (const, 88-88): **move** to `scripts/update-rule-lists.ts` `standard`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; it holds the installedAtPin result.
- stylelintEntry (const, 89-89): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws. Values to config: STYLELINT_PACKAGE = "stylelint" -&gt; scripts/config/rule-lists.ts.
- installedStylelint (const, 90-90): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-010: one installedAtPin helper resolves the package, reads it, compares it to the pin, and throws.
- exportedStylelint (const, 95-95): **move** to `scripts/update-rule-lists.ts` `exportedStylelint`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts.
- { default: stylelint } (const, 96-96): **move** to `scripts/update-rule-lists.ts` `{ default: stylelint }`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts.
- style (const, 97-101): **move** to `scripts/update-rule-lists.ts` `style`. PLG-007: scripts/eslint-presets.ts becomes scripts/update-rule-lists.ts; PLG-054: join(testsFolder, capture.css). Values to config: STYLE_SAMPLE_FILE = "capture.css" -&gt; scripts/config/rule-lists.ts; STYLELINT_RULES_SOURCE = "resolveConfig.rules" -&gt; packages/cli/src/config/generation/tool-file-sources.ts (the stylelint schema literal uses it too).
- writeFormattedJson (function, 115-119): **inline** to `scripts/update-rule-lists.ts` `top-level write loop`. PLG-054: one caller, so it becomes the top-level write loop. Values to config: PRETTIER_JSON_PARSER = "json" -&gt; scripts/config/rule-lists.ts.

## `scripts/parsers/npm.ts`

- npmPackSchema (const exported, 7-7): **move** to `tests/setup/install.ts` `npmPackSchema`. SCR-003, SCR-004: there is no runner in scripts/, so the packing code stays test setup in tests/setup/install.ts with its zod schema; ROOT-026: no filename regex.
- npmPackageIdentitySchema (const exported, 9-9): **move** to `scripts/update-rule-lists.ts` `npmPackageIdentitySchema`. ROOT-019: one user, so it moves into scripts/update-rule-lists.ts.
- readInstalledNpmPackage (function exported, 17-30): **merge** to `scripts/update-rule-lists.ts` `installedAtPin`. PLG-054, PLG-010: the package read folds into the pin check, installedAtPin; ROOT-019. Values to config: PACKAGE_JSON_FILE = "package.json" -&gt; scripts/config/rule-lists.ts.

## `scripts/parsers/releases.ts`

- releaseDocumentSchema (const exported, 5-7): **delete**. ROOT-019: one user; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- githubReleaseSchema (const exported, 10-17): **delete**. The newer-release check goes; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- githubCommitSchema (const exported, 19-19): **delete**. ROOT-019; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- githubReadmeSchema (const exported, 21-21): **delete**. SCR-007: the README scrape goes with check:pins (SCR-007).
- nodeReleasesSchema (const exported, 23-30): **delete**. No Node LTS checks; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.

## `scripts/pins.ts`

- releaseDocument (function, 28-37): **delete**. ROOT-021: no time limit; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- githubErrors (function, 52-67): **delete**. SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- releasedPins (function exported, 74-87): **delete**. pins.test.ts and the plugin name test go with it (SCR-007); SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- validateReleases (function exported, 95-113): **delete**. SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- validateSharedPins (function exported, 119-161): **delete**. SCR-007; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.

## `scripts/plugin.ts`

- installSuiteTools (function, 28-63): **move** to `tests/setup/integration.ts` `installPinnedTools`. SCR-003: in step 4, with the test-runner part of scripts/plugin.ts, the integration and e2e preload (bun test --preload) installs the pins once per run; it writes its temporary mise file with miseFile, so it holds the same lines as .gspot/mise.toml: program tools only, no gspot, no Node, no os field (INX-001, INX-002, INX-006); ROOT-028 lines from miseToolLine, no min_version; TTO-003 no suite Python install; NMS table B: nativePath becomes pinnedToolsPath. Values to config: PINNED_TOOLS_FILE = "mise.toml" -&gt; tests/config/integration.ts; MISE_TRUST = \["mise", "trust"\] -&gt; tests/config/integration.ts; MISE_INSTALL = \["mise", "install"\] -&gt; tests/config/integration.ts; MISE_BIN_PATHS = \["mise", "bin-paths"\] -&gt; tests/config/integration.ts.
- args (const, 65-65): **delete**. Goes in step 11 with the rest of scripts/plugin.ts: until the first publish, install:checks passes its words (install) to the CLI source with the packed ESLint plugin; only the test-runner part goes in step 4 (SCR-003).
- suite (const, 66-66): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- options (const, 71-71): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- isSourceSuite (const, 72-72): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- separator (const, 73-73): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- flags (const, 74-74): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- paths (const, 75-75): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- defaults (const, 76-76): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders; the Supabase test needs no filter.
- targets (const, 81-81): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders.
- testCommand (const, 82-89): **delete**. SCR-003: the test-runner part of scripts/plugin.ts goes in step 4, and no runner script replaces it; bun test takes its own flags and paths, and the mise tasks test, test:integration and test:e2e name the folders; THR-025: the time limit lives in the preload.

## `scripts/release.ts`

- tag (const, 8-8): **delete**. SCR-008: there is no check:release task or script; release.yml compares the tag with packages/cli/package.json in one line, and npm 11 refuses a prerelease version without --tag.
- version (const, 9-9): **delete**. SCR-008: there is no check:release task or script; release.yml compares the tag with packages/cli/package.json in one line, and npm 11 refuses a prerelease version without --tag.
- pluginVersion (const, 13-13): **delete**. SCR-008: there is no check:release task or script; release.yml compares the tag with packages/cli/package.json in one line, and npm 11 refuses a prerelease version without --tag.
- javascript (const, 16-16): **delete**. SLF-023: the CLI build writes the plugin pin, so the release script reads none.
- pin (const, 17-17): **delete**. SLF-023: the CLI build writes the plugin pin, so the release script reads none.

## `scripts/setting-values.ts`

- \[flag, ...extra\] (const, 11-11): **delete**. POL-001: scripts/setting-values.ts is deleted with the setting-schema generator.
- manifests (const, 14-14): **delete**. POL-001: scripts/setting-values.ts is deleted with the setting-schema generator.
- sources (const, 16-16): **delete**. POL-001: scripts/setting-values.ts is deleted with the setting-schema generator.

## `scripts/types/npm.ts`

- NpmPackageIdentity (type exported, 5-5): **delete**. ROOT-019: a one-line z.infer, and installedAtPin returns the parsed value.

## `scripts/types/package.ts`

- PublishedRelease (type exported, 2-5): **delete**. THR-016: there is no GSPOT_PACKAGE_RELEASE, so the type has no user.

## `scripts/types/pins.ts`

- RegistryPin (type exported, 3-3): **delete**. ROOT-019: one user; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.
- SharedPin (type exported, 5-5): **delete**. ROOT-019: one user; SCR-007: check:pins and scripts/pins.ts go; integration tests install every pin, the build checks the Swift checksum, and pinact checks action SHAs.

## `scripts/workspace.ts`

- workspaceRoot (const exported, 4-4): **delete**. ROOT-018: tests take the root from tests/setup, so the shared workspace root goes.

## `docs/.markdownlint-cli2.mjs`

- (the file) (file): **keep** to `docs/.markdownlint-cli2.mjs`. Generated pointer of the docs scope.

## `docs/.stylelintrc.json`

- (the file) (file): **keep** to `docs/.stylelintrc.json`. Generated pointer of the docs scope.

## `docs/README.md`

- (the file) (file): **keep** to `docs/README.md`. DOC-046; DOC-031: the reference code path is docs/src/reference/.

## `docs/assets/readme/badges/docs.svg`

- (the file) (file): **delete**. DOC-034: a static badge, so it goes.

## `docs/assets/readme/badges/license.svg`

- (the file) (file): **delete**. DOC-034: a static badge, and the README has a License section.

## `docs/assets/readme/badges/npm.svg`

- (the file) (file): **delete**. DOC-034: a badge for an unreleased package goes stale.

## `docs/assets/readme/banner/dark.svg`

- (the file) (file): **delete**. DOC-034: a 367 KB banner, and the README starts with a plain heading.

## `docs/assets/readme/banner/light.svg`

- (the file) (file): **delete**. DOC-034: a 367 KB banner, and the README starts with a plain heading.

## `docs/astro.config.ts`

- (the file) (file): **keep** to `docs/astro.config.ts`. DOC-002 deletes the unused-css hook; DOC-033; DOC-035 logo paths; it imports SIDEBAR from docs/src/config/navigation.ts. Values to config: SITE_URL = '<https://generativespotting.com>' -&gt; docs/src/config/site.ts; REPOSITORY_URL = '<https://github.com/stefanionescu/gspot>' -&gt; docs/src/config/site.ts; LOGO = '/logo.svg' -&gt; docs/src/config/site.ts; SOCIAL_IMAGE = '/social.png' -&gt; docs/src/config/site.ts; SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } -&gt; docs/src/config/site.ts; FONT_PACKAGES = \['geist', 'geist-mono'\] -&gt; docs/src/config/site.ts.

## `docs/package.json`

- (the file) (file): **keep** to `docs/package.json`. DOC-002 drops purgecss; ROOT-056; ROOT-057: no version field.

## `docs/public/brand/home/agents.svg`

- (the file) (file): **delete**. DCX-010: a picture of text with empty alt text that repeats the card text, so it goes with its image field and the illustration block.

## `docs/public/brand/home/finding.svg`

- (the file) (file): **delete**. DCX-010: a picture of text with empty alt text that repeats the card text, so it goes with its image field and the illustration block.

## `docs/public/brand/home/policy.svg`

- (the file) (file): **delete**. DCX-010: a picture of text with empty alt text that repeats the card text, so it goes with its image field and the illustration block.

## `docs/public/brand/identity/mark/default.png`

- (the file) (file): **delete**. DOC-035: the header uses logo.svg too, so the PNG mark goes.

## `docs/public/brand/identity/mark/light.svg`

- (the file) (file): **move** to `docs/public/logo.svg`. DOC-035: light.svg is the flat logo, not a light variant, so it becomes docs/public/logo.svg in a flat public folder.

## `docs/public/brand/identity/social.png`

- (the file) (file): **move** to `docs/public/social.png`. DOC-035: a flat public folder.

## `docs/public/licenses/turborepo.txt`

- (the file) (file): **keep** to `docs/public/licenses/turborepo.txt`. MIT notice for the copied homepage layout.

## `docs/src/components/home/Features.astro`

- (the file) (file): **keep** to `docs/src/components/home/Features.astro`. FEATURES stays in docs/src/config/home.ts and FeatureProps in docs/src/types/home.ts, so nothing moves in.

## `docs/src/components/home/Hero.astro`

- (the file) (file): **keep** to `docs/src/components/home/Hero.astro`. DOC-037; DOC-038; DOC-022; DOC-025 keeps its guard; example.json stays at docs/src/config/example.json; links go to /guides/install/#what-you-need and /guides/quickstart/javascript-typescript/ (DCP-002, DCP-009); the Hero shows the npm block of the Install page (npm install --save-dev --save-exact @gspothq/cli, npx gspot init, npx gspot install, npx gspot check) and a link to it, with no Global install tab (INX-009, INX-005).

## `docs/src/components/starlight/Header.astro`

- (the file) (file): **delete**. DCX-005: it copies Starlight's default header, so Starlight renders its own.

## `docs/src/components/starlight/Search.astro`

- (the file) (file): **delete**. DCX-006: the script turns the search button name into "SearchCtrlK", and Starlight already sets aria-label and aria-keyshortcuts, so the file and its astro.config.ts override go.

## `docs/src/components/starlight/SiteTitle.astro`

- (the file) (file): **keep** to `docs/src/components/starlight/SiteTitle.astro`. DOC-035: logo.svg.

## `docs/src/config/example.json`

- (the file) (file): **keep** to `docs/src/config/example.json`. Static recorded data with three readers (Hero.astro, the JavaScript and TypeScript quickstart page, the homepage-example integration test), so it keeps its path in docs/src/config/; DOC-022 deletes version and fix.correction; the home-page gspot.toml is real gspot init output in the final shape: the versioned #:schema line, no runner, \[rules\] without folder, \[ci\] enabled, \[\[scope\]\] records, and the final keys (TML-016, INX-003, TML-003, CFR-001).

## `docs/src/config/home.ts`

- (the file) (file): **keep** to `docs/src/config/home.ts`. FEATURES is a static table, so it stays in docs/src/config/home.ts without the FeatureProps\['features'\] annotation, because config/ may not import types/, and the Props type of Features.astro checks it (DCP-014); the image fields go with the three pictures (DCX-010); DOC-040.

## `docs/src/config/navigation.ts`

- (the file) (file): **keep** to `docs/src/config/navigation.ts`. One user, astro.config.ts; it keeps its path without the Sidebar annotation, because config/ may not import types/, and starlight() checks SIDEBAR (DCP-014); the sidebar lists the hand-written pages: Get started (overview, install, quickstart/javascript-typescript, quickstart/python, quickstart/swift, join), Daily use (findings, hooks, ci, agents), Configure (gspot-toml, exclude, monorepos, command-checks, templates, generated-files, upgrade, remove), Topics (testing, dependency-licenses, security), Troubleshooting, Reference (commands, configurations, checks, eslint-plugin, gspot.toml reference, exit-codes) (DCP-005); the reference folder names come from REFERENCE_FOLDERS in docs/src/config/reference.ts.

## `docs/src/config/reference.ts`

- (the file) (file): **keep** to `docs/src/config/reference.ts`. The file keeps DETECTION_LABELS, SCHEMA_TYPE_LABELS, CHECK_RUN_LABELS, and GSPOT_TOML_INTRO, the intro of the one gspot.toml reference page (POL-035, DOC-029), which says a loosening value is written as { value = ..., reason = "..." } (CFR-002); COMMAND_OWNERS (DOC-018) and CONFIGURATION_GROUPS (NMU-009) are deleted; REFERENCE_JSON_INDENT is inlined as 2 (DOC-040); JSON_SCHEMA_DIALECT moves with buildJsonSchema to packages/cli/src/config/settings/schema.ts (CFR-001). Values to config: REFERENCE_FOLDERS = { commands: 'commands', configurations: 'configurations', checks: 'checks', eslintPlugin: 'eslint-plugin' } -&gt; docs/src/config/reference.ts (DCP-017); REFERENCE_COLLECTION_NAME = 'gspot-reference' -&gt; docs/src/config/reference.ts; REFERENCE_IDS_KEY = 'reference-ids' -&gt; docs/src/config/reference.ts; JSON_SCHEMA_DIALECT = '<https://json-schema.org/draft/2020-12/schema>' -&gt; packages/cli/src/config/settings/schema.ts.

## `docs/src/content.config.ts`

- (the file) (file): **keep** to `docs/src/content.config.ts`. DOC-031: imports docs/src/reference/collection.ts.

## `docs/src/content/docs/404.md`

- (the file) (file): **keep** to `docs/src/content/docs/404.md`. The head lines are needed, so the page stays.

## `docs/src/content/docs/guides/agents.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/agents.md`. DOC-068; DOC-011 text; the owner name is rules: \[agent_rules\] becomes \[rules\] and 'agent rules' becomes 'rules' on the page (glossary).

## `docs/src/content/docs/guides/ci.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/ci.md`. DOC-067; DOC-010; CI is on with ci.enabled (gspot set ci.enabled true), the provider defaults to github, and init proposes it without a question (TML-015, CLX-001); ci.files and its section go (TML-002); the page names ci.setup_command and ci.operating_systems (TML-014); one generated job shape runs through mise-action and mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot install, then check (INS-003); Your own pipeline installs mise, then runs the start command with install, then check, with no global install (INX-005); neither runs gspot doctor, because check fails with exit 2 and names each missing program; a list is replaced with gspot unset, then gspot set; the page gains Turn CI off.

## `docs/src/content/docs/guides/command-checks.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/command-checks.md`. DOC-074; command checks are \[\[command_check\]\] records with name; needs, platforms, ignore_file, finding_count_pattern, and crash_pattern leave the command-check schema, so the Count failures in the output and Native exclusions sections go (TML-004).

## `docs/src/content/docs/guides/dependency-licenses.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/dependency-licenses.md`. DOC-079; DOC-053; \[licenses.exceptions.&lt;package@version&gt;\] becomes \[\[licenses.allowed_package\]\] records with name, version, and reason, where the reason names the license and there is no license field (TML-009).

## `docs/src/content/docs/guides/exclude.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/exclude.md`. DCP-007: this page does one job, making gspot stop reporting something, and gspot.toml does another; the Ignore one finding section of policy.md moves here; the Test files section moves to testing.md (DCP-008); ignore --remove becomes gspot unignore (CMD-092); the exclude setting and the Exclude build output section go: "gspot reads the files Git tracks or would add. Mark generated and copied files in .gitattributes. Accept other findings with gspot ignore." (TMF-003); the \[\[generated\]\] and \[\[vendored\]\] section becomes the .gitattributes linguist markers (CFR-005); the ignore_file paragraph goes (TML-004); the \[\[naming.override\]\] example keeps its required reason (TMF-005); the file keeps its name, because exclude-and-ignore holds the banned word and, and the title becomes "Exclude files and ignore findings".

## `docs/src/content/docs/guides/existing-repository.md`

- (the file) (file): **merge** to `docs/src/content/docs/guides/install.md`. DCP-009: the same task as Install, with the same commands, so it merges into install.md as the Read the plan section (DOC-058); its Run the checks section repeats Install and goes; DOC-063.

## `docs/src/content/docs/guides/findings.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/findings.md`. DOC-065; DOC-015; DOC-016; links go to exclude#ignore-a-finding and gspot-toml#change-a-limit; the check --skip line and the -C sentence go (CMD-092, DCX-001); --dry-run turns on --fix, so the sentence "--dry-run requires --fix" goes (CLX-007).

## `docs/src/content/docs/guides/generated-files.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/generated-files.md`. DOC-073; DOC-083; DOC-050; the only page that names the mise file: ".gspot/mise.toml: the program tools gspot installs with mise" (INX-001); it adds "gspot updates the files in .gspot/ when you upgrade gspot. Tell dependency bots to skip that folder, for Renovate: \\"ignorePaths\\": \[\\".gspot/\*\*\\"\]." (INX-012); the tool projects carry no gspot-tools name (INX-010).

## `docs/src/content/docs/guides/hooks.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/hooks.md`. DOC-066; DOC-009; DOC-051; Prepare the clone becomes one line that links Join a repository (DCP-012); the page gains Turn hooks off; hooks.push_files is deleted (TML-002); the commit-msg line is gspot check --message-file "$1" (CLX-006); hooks start gspot from where the repository pins it: npm exec --no -- gspot, pnpm exec gspot, yarn exec gspot, or bun run --no-install gspot when package.json lists @gspothq/cli, else mise exec -- gspot (INX-003); the ignore link goes to guides/exclude.

## `docs/src/content/docs/guides/install.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/install.md`. DCP-009: Install covers requirements, install, runners and existing-repository; join.md stays its own page (DCP-005), and Install ends with one line linking Join a repository; the page holds the two install paths, package manager and mise, each once (INX-009); init never installs, so the page shows gspot install after init; the --no-install, --runner, --no-runner, and --refresh-lockfiles lines go (CMD-092); the global npm install section and the one-off npx, bunx, dlx, and mise exec inits go (INX-005); no page tells users to trust or install a gspot mise file (INX-001); mise is needed for program tools, or install each one by hand (INX-006); DOC-061; INX-009.

## `docs/src/content/docs/guides/join.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/join.md`. Join a repository stays its own page, one page for each task (DCP-005): after a clone a teammate runs gspot install, never gspot init; its steps follow the install paths: npm ci, or nothing with mise, then gspot install and gspot check, with no mise trust or mise install lines (INX-001); DOC-064.

## `docs/src/content/docs/guides/monorepos.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/monorepos.md`. DOC-071; scopes are \[\[scope\]\] records (POL-006); --scope-configurations and -C go (CMD-092), so the example uses gspot add --scope; paths written in a scope are relative to the repository root, so line 61 says "Paths you write are relative to the repository root. A configuration default paths apply inside the scope that selects it." (CFR-003); the \[scope.api.reasons\] example becomes the reason form (CFR-002); record lists sit at the root with paths into the scope (CFR-004); the -C example becomes cd api && gspot check (CLX-009).

## `docs/src/content/docs/guides/overview.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/overview.md`. NMU-011 with the owner name rules; links to /guides/requirements/, /guides/runners/, /guides/policy/, /guides/quickstart/typescript/ and /reference/plugin/ change to their final pages.

## `docs/src/content/docs/guides/policy.md`

- (the file) (file): **rename** to `docs/src/content/docs/guides/gspot-toml.md`. NMU-012: one name for the page, gspot-toml.md; DOC-069; DOC-055; DOC-005; exclude.md stays its own page, and this page's Ignore one finding section moves there (DCP-007); the remove-one-configuration half of remove.md moves in (DCP-004); the Settings for one integration link list goes (DCP-011); set --default, --replace and --remove become gspot unset (CMD-092), which takes no --reason (CLX-002); the \[reasons\] section becomes the reason form { value = ..., reason = "..." } (CFR-002); the Edit the file by hand section says "gspot.toml is TOML 1.0. Keep each inline table on one line." (CFR-007); the #:schema line carries the version (CFR-001); every example uses the final shape.

## `docs/src/content/docs/guides/quickstart/python.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/quickstart/python.md`. DCP-001: Python and Swift get one quickstart page each; DOC-062; the page uses the mise path: mise use node@24 npm:@gspothq/cli@&lt;version&gt;, commit mise.toml, then mise exec -- gspot init, install, check, with no mise trust line (INX-009, INX-001).

## `docs/src/content/docs/guides/quickstart/swift.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/quickstart/swift.md`. DCP-001: its own quickstart page; DOC-062 and INX-009 apply as on the Python page; it uses the mise path with no mise trust line (INX-009, INX-001).

## `docs/src/content/docs/guides/quickstart/typescript.md`

- (the file) (file): **rename** to `docs/src/content/docs/guides/quickstart/javascript-typescript.mdx`. PAR-047: the page renders its file blocks from example.json; DOC-014; DOC-062; one quickstart for JavaScript and TypeScript (DCP-002): JavaScript users run the same commands, and the example stays TypeScript, recorded in docs/src/config/example.json, with one short JavaScript section; the setup block is the npm path: npm install --save-dev --save-exact @gspothq/cli, commit, npx gspot init, npx gspot install, npx gspot check (INX-009).

## `docs/src/content/docs/guides/remove.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/remove.md`. DOC-058, DCP-004: the page only removes gspot from a repository, and its remove-one-configuration half moves to gspot-toml.md; remove has no --dry-run, so the Preview the removal line goes (CLX-004); the steps: git config --unset core.hooksPath, delete gspot.toml, .gspot/, the CI file, pointer files, managed blocks, then npm uninstall @gspothq/cli or mise unuse npm:@gspothq/cli (INX-009), with no mise file line (INX-001); DOC-076.

## `docs/src/content/docs/guides/requirements.md`

- (the file) (file): **merge** to `docs/src/content/docs/guides/install.md`. DCP-009: requirements are the first step of installing, so they become the What you need section of install.md: Git, Node.js 24.2+, and the package manager, or mise, which installs the program tools, else install each by hand (INX-009, INX-006); the .mise/conf.d line goes; Platform limits becomes Operating system limits (NMU-007); DOC-060.

## `docs/src/content/docs/guides/runners.md`

- (the file) (file): **merge** to `docs/src/content/docs/guides/install.md`. The runner setting and runners.md are deleted (INX-003): one sentence moves to Install, that hooks start gspot through the package manager when package.json lists @gspothq/cli, else mise exec -- gspot; gspot set runner and gspot unset runner are not documented; the tool-location paragraphs go, because generated-files.md lists those files.

## `docs/src/content/docs/guides/security.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/security.md`. DOC-008; DOC-079; the setting is tools.semgrep.registry_packs; the ignore link goes to guides/exclude.

## `docs/src/content/docs/guides/templates.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/templates.md`. DOC-075; a template carries nothing about how gspot starts, so the word runner goes (INX-004); the template and selection keys and their section go, because init --from always adds detected configurations (TML-011); export has no --dry-run, so the line 34 sentence goes (CLX-004).

## `docs/src/content/docs/guides/testing.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/testing.md`. DOC-079; it receives the Test files section (test_files) from exclude.md (DCP-008); /reference/settings/ links become /reference/gspot-toml/ (POL-035); Swift target minimums are \[\[coverage.target\]\] records with name, lines, and reason (TMF-004).

## `docs/src/content/docs/guides/troubleshooting.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/troubleshooting.md`. POL-064 heading; reference/runtime.md stays its own page, so nothing moves in (DCP-006); the GSPOT_JOBS example keeps both command forms here; runner links go to install; "npm exec cannot find gspot" becomes "Run your package manager install, then gspot install." (INX-005); the runner lines go (INX-003); the deleted-flag lines use the final forms (CLX-014).

## `docs/src/content/docs/guides/upgrade.md`

- (the file) (file): **keep** to `docs/src/content/docs/guides/upgrade.md`. DOC-076; DOC-050; remove.md stays its own page, so nothing merges in (DOC-058); the steps: npm install --save-dev --save-exact @gspothq/cli@&lt;version&gt; or mise use npm:@gspothq/cli@&lt;version&gt;, then gspot apply, gspot install, gspot check, and commit (INX-002, INX-009).

## `docs/src/content/docs/reference/runtime.md`

- (the file) (file): **rename** to `docs/src/content/docs/reference/exit-codes.md`. DCP-006: looking up exit codes and environment variables is its own task, so the page stays, with the plain file name exit-codes.md; DOC-078; it lists 130 or 143 (gspot check stopped on Ctrl-C or SIGTERM) and NO_COLOR, where any non-empty value turns color off; its GSPOT_JOBS example moves to troubleshooting.md.

## `docs/src/content/reference/checks.ts`

- (the file) (file): **move** to `docs/src/reference/checks.ts`. DOC-031: code moves out of content/; DOC-025; DOC-026; CHECK_RUN_LABELS stays in docs/src/config/reference.ts; the /reference/configurations/ link prefix comes from REFERENCE_FOLDERS in docs/src/config/reference.ts.

## `docs/src/content/reference/collection.ts`

- (the file) (file): **move** to `docs/src/reference/collection.ts`. DOC-031: code moves out of content/; DOC-024; NMU-009; there is one gspot.toml reference page and no Settings page (POL-035); page keys and the configurations/ and checks/ link prefixes come from REFERENCE_FOLDERS in docs/src/config/reference.ts; the folder value is PAGES_FOLDER in docs/src/config/. Values to config: REFERENCE_COLLECTION_NAME = 'gspot-reference' -&gt; docs/src/config/reference.ts; REFERENCE_IDS_KEY = 'reference-ids' -&gt; docs/src/config/reference.ts.

## `docs/src/content/reference/commands.ts`

- (the file) (file): **move** to `docs/src/reference/commands.ts`. DOC-031: code moves out of content/; DOC-018: no COMMAND_OWNERS, no access check; DOC-024; DOC-027; the -C sentence of the index intro goes (CMD-092); the index links Exit codes and environment variables (DCP-006); the Levels section of a command page goes (CLX-010); Global options lists only --version and --help, and --json is listed with each command that prints data (CLX-005, CLX-008); commands/ page keys and /reference/commands/ links come from REFERENCE_FOLDERS in docs/src/config/reference.ts.

## `docs/src/content/reference/configurations.ts`

- (the file) (file): **move** to `docs/src/reference/configurations.ts`. DOC-031: code moves out of content/; DOC-080; DETECTION_LABELS stays in docs/src/config/reference.ts; the /reference/configurations/ and /reference/checks/ link prefixes come from REFERENCE_FOLDERS in docs/src/config/reference.ts.

## `docs/src/content/reference/page.ts`

- (the file) (file): **move** to `docs/src/reference/markdown.ts`. DOC-031: page.ts holds Markdown helpers, so markdown.ts; DOC-018: no edit links; ReferencePage stays in docs/src/types/reference.ts.

## `docs/src/content/reference/plugin.ts`

- (the file) (file): **move** to `docs/src/reference/eslint-plugin.ts`. DOC-031; plugin alone names nothing, so eslint-plugin.ts; PLG-017; the pages live under reference/eslint-plugin/ (DCP-015); the Preset column becomes Level, and 'No preset turns this rule on' becomes 'No level turns this rule on' (glossary); page keys and links come from REFERENCE_FOLDERS.eslintPlugin in docs/src/config/reference.ts.

## `docs/src/content/reference/policy.ts`

- (the file) (file): **move** to `docs/src/reference/gspot-toml.ts`. DOC-031; POL-035: settingsPage and policyReference become one gspot.toml reference page with GSPOT_TOML_INTRO from docs/src/config/reference.ts; NMU-012; DOC-029; SettingVariant stays in docs/src/types/reference.ts; the owner label 'Repository policy' becomes 'gspot' (DCP-018); the /reference/settings/ links go; the page links the versioned schema <<https://unpkg.com/@gspothq/cli@><version>/gspot.schema.json> and imports buildJsonSchema from the CLI settings code (CFR-001); it follows the final gspot.toml shape: record lists, the reason form, no \[\[generated\]\] or \[\[vendored\]\]; the /reference/configurations/ link prefix comes from REFERENCE_FOLDERS in docs/src/config/reference.ts.

## `docs/src/content/reference/schema.ts`

- (the file) (file): **move** to `packages/cli/src/settings/schema/gspot-toml.ts`. CFR-001: buildJsonSchema moves into the CLI settings schema code: $id is the versioned unpkg URL, the description drops "in the latest release", and scripts/build.ts writes packages/cli/gspot.schema.json, listed in files of packages/cli/package.json. Values to config: JSON_SCHEMA_DIALECT = '<https://json-schema.org/draft/2020-12/schema>' -&gt; packages/cli/src/config/settings/schema.ts.

## `docs/src/content/revision.ts`

- (the file) (file): **delete**. DOC-018: the edit links go, so the revision helper has no user.

## `docs/src/env.d.ts`

- (the file) (file): **delete**. DOC-023: the empty env declaration file goes.

## `docs/src/home.css`

- (the file) (file): **keep** to `docs/src/home.css`. DOC-039 keeps its two rules.

## `docs/src/navigation.css`

- (the file) (file): **keep** to `docs/src/navigation.css`. Site styles.

## `docs/src/pages/index.astro`

- (the file) (file): **keep** to `docs/src/pages/index.astro`. DOC-039: one landing reset; FEATURES comes from docs/src/config/home.ts; the footer GitHub and license links use REPOSITORY_URL from docs/src/config/site.ts.

## `docs/src/pages/schema/gspot.schema.json.ts`

- (the file) (file): **delete**. CFR-001: unpkg serves the schema of every published version, so the docs route goes, with the structure/lone-files ignore that exists only for it.

## `docs/src/theme.css`

- (the file) (file): **keep** to `docs/src/theme.css`. DOC-021; DOC-039.

## `docs/src/types/components.ts`

- (the file) (file): **rename** to `docs/src/types/home.ts`. DCX-004: the file is named for its topic, the homepage; it keeps FeatureProps (one user, Features.astro); Sidebar is deleted, because navigation.ts drops its annotation (DCP-014), and with it the type import of @astrojs/starlight.

## `docs/src/types/reference.ts`

- (the file) (file): **keep** to `docs/src/types/reference.ts`. The file keeps ReferencePage (editUrl becomes false, DOC-018) and SettingVariant; SchemaNode is deleted (DOC-020); its type import of SettingDeclaration from packages/cli/src/types/settings/tables.ts is a type from another package, so it is allowed.

## `docs/tsconfig.json`

- (the file) (file): **keep** to `docs/tsconfig.json`. DOC-032: the site's TypeScript settings stop naming CLI type files by path.

## `docs/wrangler.jsonc`

- (the file) (file): **keep** to `docs/wrangler.jsonc`. Cloudflare Workers deploy settings.

## `packages/eslint-plugin/.markdownlint-cli2.mjs`

- (the file) (file): **delete**. GEN-006: the empty plugin scope goes, so gspot writes no pointer here.

## `packages/eslint-plugin/README.md`

- (the file) (file): **keep** to `packages/eslint-plugin/README.md`. PLG-033; PLG-013: Node.js 22.12, no CommonJS; PLG-017.

## `packages/eslint-plugin/package.json`

- (the file) (file): **keep** to `packages/eslint-plugin/package.json`. PLG-013: no main, ESM only; PLG-015: no imports field; PLG-035.

## `packages/eslint-plugin/tsconfig.json`

- (the file) (file): **keep** to `packages/eslint-plugin/tsconfig.json`. Declaration build settings.

## `scripts/gspot`

- (the file) (file): **delete**. SCR-001: a launcher that runs the CLI source while the package is unpublished; after the first npm publish (GEN-002) this repository pins npm:@gspothq/cli in its own mise.toml (mise use), like a user, and the hooks start it with mise exec -- gspot (INX-001, INX-002).

## `scripts/gspot.cmd`

- (the file) (file): **delete**. SCR-001: the Windows launcher of the CLI source; after the first npm publish this repository pins npm:@gspothq/cli in its own mise.toml and starts it with mise exec -- gspot (INX-001, INX-002).
