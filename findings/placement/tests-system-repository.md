# Tests: planning, system, repository, tools

552 rows. keep 204, move 172, delete 125, inline 26, split 20, merge 5.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/planning/automatic-selection.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/skips.test.ts; tests/unit/cli/planning/checks.test.ts`. Each test goes to the source file it tests (TPR-053): skip reasons to planning/skips.ts and planRun to planning/checks.ts; the exclude test goes with the root exclude setting (TMF-003), so files.test.ts gets nothing.
- %s selects general checks from a stored empty manual list without changing policy (test (test.each), 9-48): **move** to `tests/unit/cli/planning/checks.test.ts` `%s plans the always-selected checks from an empty configurations list without changing gspot.toml`. Real behavior: planRun over the always-selected configurations; duplication/jscpd differs by level, so the level table stays (glossary: always selected).
- \['recommended', 'all'\] as const (test (test.each), 9-9): **move** to `tests/unit/cli/planning/checks.test.ts`. The level changes duplication/jscpd, so both levels stay; LEVELS is imported from packages/cli/src/config/configurations.ts, not written again in the test.
- an explicitly authored Git configuration reports its repository prerequisite (test (test), 50-63): **keep** to `tests/unit/cli/planning/skips.test.ts` `a commits check outside Git is skipped because there is no history to read`. Real behavior; conditionSkip lives in planning/skips.ts.
- a projected policy input respects the repository exclusion before native tool requirements are selected (test (test), 65-77): **delete**. The root exclude setting goes (TMF-003: .gitignore, .gitattributes and \[\[ignore\]\] cover its uses), so this test of it goes.
- the Git prerequisite message names the supplied %s check (test (test.each), 79-97): **delete**. Weak: it forges when.git on a copied declaration to reach one message string; the git = false skip of secrets/gitleaks-files in a Git repository stays covered by the secrets files tool test.
- \['secrets/gitleaks-files', 'security/semgrep'\] (test (test.each), 79-79): **delete**. Table of the test above; the two cases differ only in the name in the message.

## `tests/cli/planning/dependencies.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/skips.test.ts; tests/unit/cli/repository/detect.test.ts`. Split by source file: the dependency condition tests go to planning/skips.ts (TPR-053) and the detection test to the one repository/detect test file (TPR-025, TCM-017); TPR-001 deletes the fake test.
- 'next-intl dependency condition at ${level}: $name' (test (test.each), 12-33): **keep** to `tests/unit/cli/planning/skips.test.ts` `next-intl dependency condition: $name`. Real behavior; TGN-037 drops the level loop (translations/locales is level recommended); scopes are \[\[scope\]\] records (CFR-003).
- DEPENDENCY_CASES (test (test.each), 12-12): **keep** to `tests/unit/cli/planning/skips.test.ts` `NEXT_INTL_PROJECTS`. The table stays under a name that says what it holds; its rows live in tests/config/planning.ts.
- checks without dependency conditions do not inspect unused malformed manifests (test (test), 35-45): **delete**. TPR-001: fake, the session parsed package.json before the test breaks it
- translations detection finds %s without a Next.js suggestion (test (test.each), 47-65): **move** to `tests/unit/cli/repository/detect.test.ts` `detection selects translations for %s without proposing Next.js`. It tests detectConfigurations (repository/detect.ts), so it joins the one detect test file (TPR-025, TCM-017).
- \['next-intl', 'react-i18next'\] (test (test.each), 47-47): **move** to `tests/unit/cli/repository/detect.test.ts`. Table of the test above; moves with its test.

## `tests/cli/planning/format-inputs.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/files.test.ts; tests/unit/cli/planning/checks.test.ts`. Each test goes to the source file it tests (TPR-053); the ignore_file test goes (TML-004), so skips.test.ts gets nothing from this file.
- EditorConfig selects source files beyond the formatter extensions and omits binary data (test (test), 20-33): **keep** to `tests/unit/cli/planning/files.test.ts` `EditorConfig checks source files beyond the Prettier extensions and skips binary files`. Real behavior of filesFor (planning/files.ts).
- check path ignores remove unused Prettier output and remain stable after its ignore file is removed (test (test), 35-63): **move** to `tests/unit/cli/planning/checks.test.ts` `a check ignored on all its paths leaves the plan, the needed tools, and its generated files`. Real behavior; configuredChecks (planning/checks.ts) decides it; plain title.
- a command check declares its native ignore file without borrowing a built-in check name (test (test), 65-78): **delete**. ignore_file leaves the command-check schema (\[\[ignore\]\] paths does the job, TML-004), so this test of it goes; the manifest field stays for format/prettier, and that filtering stays tested by 'Prettier filters its files through a linked ignore file inside the repository'.

## `tests/cli/planning/lockfiles.test.ts`

- (the file) (file): **move** to `tests/unit/cli/planning/files.test.ts`. Trigger files are computed in planning/files.ts, so the test sits at that source file's test path.
- %s frozen installs run only for declared changed inputs (test (test.each), 10-51): **keep** to `tests/unit/cli/planning/files.test.ts` `dependencies/stale-lockfile runs only when a declared trigger file changes`. Real behavior; TGN-037 drops the level loop; scopes are \[\[scope\]\] records (CFR-003).
- \['recommended', 'all'\] as const (test (test.each), 10-10): **delete**. TGN-037: dependencies/stale-lockfile is level recommended, both levels give the same plan

## `tests/cli/planning/replacements.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/checks.test.ts; tests/unit/cli/planning/skips.test.ts`. Each test goes to the source file it tests: skipReplacedChecks to planning/checks.ts, conditionSkip to planning/skips.ts.
- $check replaces tsc only while the replacing check runs (test (test.each), 8-34): **keep** to `tests/unit/cli/planning/checks.test.ts` `$check replaces typescript/tsc only while it runs`. Real behavior.
- REPLACEMENTS (test (test.each), 8-8): **keep** to `tests/unit/cli/planning/checks.test.ts`. Table of the test above; the two rows are not a single short literal, so they live in tests/config/planning.ts as TSC_REPLACEMENTS.
- Vue without TypeScript reports its configuration prerequisite during planning (test (test), 36-51): **move** to `tests/unit/cli/planning/skips.test.ts` `vue/vue-tsc without the typescript configuration is skipped with its condition`. Real behavior; conditionSkip (planning/skips.ts).
- a nested Next.js check replaces TypeScript only in its own scope (test (test), 53-68): **keep** to `tests/unit/cli/planning/checks.test.ts` `a nested Next.js check replaces TypeScript only in its own scope`. Real behavior; scopes are \[\[scope\]\] records (CFR-003).

## `tests/cli/planning/requirements.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/needed-tools.test.ts; tests/unit/cli/planning/skips.test.ts; tests/unit/cli/configurations/tool-pins.test.ts`. Each test goes to the source file it tests (TPR-053): needed tools to planning/needed-tools.ts, the settings skip to planning/skips.ts, checkToolPin to configurations/tool-pins.ts.
- a check version prerequisite cannot lower its tool-wide requirement (test (test), 9-22): **move** to `tests/unit/cli/configurations/tool-pins.test.ts` `a check version floor cannot lower its tool floor`. TPR-003: test checkToolPin (configurations/tool-pins.ts) with a hand-written check instead of editing the cached shipped manifest
- %s reports manual security project prerequisites explicitly (test (test.each), 24-52): **move** to `tests/unit/cli/planning/skips.test.ts` `security/codeql waits for tools.codeql.languages while security/semgrep-registry runs`. Real behavior; waitingSetting (planning/skips.ts); TGN-037 drops the level loop.
- \['recommended', 'all'\] as const (test (test.each), 24-24): **delete**. TGN-037: both checks are level recommended
- applicable tools declare Node only when npm consumers require it: $name (test (test.each), 54-75): **keep** to `tests/unit/cli/planning/needed-tools.test.ts` `the needed tools include Node only when an npm tool needs it: $name`. Real behavior; applicableManifests becomes neededToolManifests (LIF-028).
- NODE_REQUIREMENTS (test (test.each), 54-54): **keep** to `tests/unit/cli/planning/needed-tools.test.ts` `NODE_REQUIREMENTS`. Table of the test above; its rows live in tests/config/planning.ts.
- private schema tools include their runtime peer under %s (test (test.each), 77-87): **keep** to `tests/unit/cli/planning/needed-tools.test.ts` `schema tools need their ajv peer`. Real behavior; the runner setting goes (INX-003) and played no part, so the test writes no runner and is one plain test; glossary retires private for the tool project.
- \['bun', 'mise'\] (test (test.each), 77-77): **delete**. The runner table goes with the runner setting (INX-003); the runner played no part, so both rows gave the same list.
- native tool conditions retain $name with root and child selections (test (test.each), 89-109): **keep** to `tests/unit/cli/planning/needed-tools.test.ts` `eslint-plugin-boundaries is needed for $name at the levels that use it`. Real behavior: the inner level loop, over LEVELS imported from packages/cli/src/config/configurations.ts, changes the result; test_files = { value = \[\], reason = "..." } replaces the \[reasons\] table (CFR-002), and scopes are \[\[scope\]\] records (CFR-003); glossary retires native.
- ROLE_REQUIREMENTS (test (test.each), 89-89): **keep** to `tests/unit/cli/planning/needed-tools.test.ts` `ARCHITECTURE_REQUIREMENTS`. The rows hold modules and roles, not only roles, and live in tests/config/planning.ts; the rows of the runtime role and of a scope module list go (TML-001, CFR-004).

## `tests/cli/planning/selection.test.ts`

- (the file) (file): **split** to `tests/unit/cli/planning/checks.test.ts; tests/unit/cli/planning/files.test.ts; tests/unit/cli/planning/skips.test.ts; tests/unit/cli/planning/needed-tools.test.ts; tests/unit/cli/commands/init/command/configurations.test.ts`. Each test goes to the source file it tests (TPR-053): the planning tests to planning/, and the init part to the tests of commands/init/command.ts, which pass 300 lines and sit in command/ by behavior (TPR-029).
- manual configurations %j retain automatic checks and level-dependent tools (test (test.each), 33-85): **move** to `tests/unit/cli/commands/init/command/configurations.test.ts` `init with --configurations %j keeps the always-selected configurations`. init asks no questions (CLX-001) and --scope-configurations goes (CMD-092), so the test keeps init with --configurations writing the always-selected configurations; the planning assertions repeat the always-selected planning test.
- MANUAL_SELECTIONS (test (test.each), 33-33): **move** to `tests/unit/cli/commands/init/command/configurations.test.ts` `CONFIGURATION_CHOICES`. Table of the test above; its rows live in tests/config/init.ts; glossary: selection means the configurations a scope uses.
- a change to %s retains project inputs and check path ignores (test (test.each), 87-107): **move** to `tests/unit/cli/planning/files.test.ts` `a change to %s re-runs docs/lychee in every scope and keeps its path ignores`. Real behavior; trigger files in filesFor (planning/files.ts).
- POLICY_PATHS (test (test.each), 87-87): **move** to `tests/unit/cli/planning/files.test.ts`. One-line table written in the test; glossary: settings, not policy
- Prettier planning honors linked authored ignores inside the repository and rejects external targets (test (test), 109-129): **move** to `tests/unit/cli/planning/skips.test.ts` `Prettier filters its files through a linked ignore file inside the repository`. TPR-009: keep only the link inside the repository; the outside-link refusal is tested in system/file-reads; restrictIgnoredPaths (planning/skips.ts)
- $level selects Next.js builds for $route only in app scopes and retains all project inputs (test (test.each), 131-161): **move** to `tests/unit/cli/planning/files.test.ts` `$level plans nextjs/build for $route only in the app scope with all its project files`. TGN-037: one recommended case with one route plus the four all-level routes
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; NEXT_BUILD_ROUTES.map((route) =&gt; ({ level, route }))) (test (test.each), 131-131): **move** to `tests/unit/cli/planning/files.test.ts`. TGN-037: the recommended rows shrink to one; LEVELS is imported from packages/cli/src/config/configurations.ts, and the routes come from NEXT_BUILD_ROUTES in tests/config/nextjs.ts.
- %s hooks plan declared stages (describe (describe.each), 163-205): **delete**. Weak: no test is left in the describe: 'explicitly selects TypeScript' and 'selects the declared stage' are weak, 'the complete plan includes' is self-policing, and the Windows skip test moves to skips.test.ts with its own sandbox.
- %s hooks plan declared stages &gt; \['recommended', 'all'\] as const (describe (describe.each), 163-163): **delete**. TPR-004, TGN-037: every check involved is level recommended, both levels give the same plan
- %s hooks plan declared stages &gt; %s explicitly selects TypeScript (test (test.each), 179-182): **delete**. Weak: typescript/tsc is a push check, so the plan holds it at stages push and all without the --only override; the override for a manual check stays covered by '%s reports manual security project prerequisites explicitly'.
- %s hooks plan declared stages &gt; \['push', 'all'\] as const (test (test.each), 179-179): **delete**. Weak: stage table of the deleted 'explicitly selects TypeScript' test.
- %s hooks plan declared stages &gt; the complete plan includes %s (test (test.each), 183-185): **delete**. Self-policing: lists shipped check names (TPR-004).
- %s hooks plan declared stages &gt; HOOK_STAGE_CHECKS (test (test.each), 183-183): **delete**. TPR-004: the shipped check-name list goes
- %s hooks plan declared stages &gt; %s selects the declared %s stage (test (test.each), 186-198): **delete**. Weak: the expected list re-implements the stage filter from the shipped manifests.
- %s hooks plan declared stages &gt; HOOK_STAGES (test (test.each), 186-186): **delete**. Weak: hook table of the deleted stage-filter test.
- %s hooks plan declared stages &gt; Windows retains the explicit platform skip (test (test), 199-204): **move** to `tests/unit/cli/planning/skips.test.ts` `a check whose tool has no Windows build is skipped on Windows`. Real behavior; platformSkip (planning/skips.ts); gets its own sandbox.
- %s %s coverage requires its host plugin for the %s floor (describe (describe.each), 207-250): **move** to `tests/unit/cli/planning/needed-tools.test.ts` `%s coverage at the %s limit`. TPR-011: four rows (pytest and vitest, zero and lines) with no level column (TGN-037); checkCompanions and requiredToolNames are in planning/needed-tools.ts; zero limits are written lines = { value = 0, reason = "..." } (CFR-002), and scopes are \[\[scope\]\] records (CFR-003). Values to config: COVERAGE_LIMITS = the per-tool values of the describe body as columns (provider 'pytest-cov' or '@vitest/coverage-v8', sample file 'test_math.py' or 'math.test.js', configurations \['python', 'pytest'\] or \['javascript', 'vitest'\]) -&gt; tests/config/planning.ts
- %s %s coverage requires its host plugin for the %s floor &gt; \[...COVERAGE_PLUGIN_CASES\] (describe (describe.each), 207-207): **move** to `tests/unit/cli/planning/needed-tools.test.ts` `COVERAGE_LIMITS`. Table of the describe above (TPR-011: four rows); its rows live in tests/config/planning.ts; glossary retires "cases".
- %s %s coverage requires its host plugin for the %s floor &gt; the plan retains root and child with the optional provider (test (test), 236-243): **delete**. Duplicate: the doctor test of an absent coverage plugin checks the provider need above a zero limit and its absence at zero.
- %s %s coverage requires its host plugin for the %s floor &gt; scope %s retains provider requirements and companions (test (test.each), 244-248): **move** to `tests/unit/cli/planning/needed-tools.test.ts` `%s coverage at the %s limit > scope %s needs the provider and lists it as a companion`. TPR-011: the duplicate runs go with the 20-row matrix, and the test stays; glossary: limit, not floor.
- %s %s coverage requires its host plugin for the %s floor &gt; \['', 'app'\] (test (test.each), 244-244): **move** to `tests/unit/cli/planning/needed-tools.test.ts`. Scope table stays
- %s plans declared history once without source triggers (test (test.each), 252-296): **keep** to `tests/unit/cli/planning/checks.test.ts` `%s plans history checks once at the root and only for pushed commits`. Real behavior; the level changes the commitlint-pushed row, so both levels stay.
- \['recommended', 'all'\] as const (test (test.each), 252-252): **keep** to `tests/unit/cli/planning/checks.test.ts`. Level table; LEVELS is imported from packages/cli/src/config/configurations.ts, not written again in the test.

## `tests/cli/platform/assets.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/assets.test.ts`. Tests system/assets.ts (PLR-003); INS-008, INS-008 and INS-021 trim its content.
- development assets (describe (describe), 32-67): **delete**. TTC-039: a describe that adds nothing
- development assets &gt; a missing grammar refuses source execution (test (test), 33-41): **keep** to `tests/unit/cli/system/assets.test.ts` `a missing grammar file stops gspot with a reinstall message`. Real behavior; runs the source copy in a child process.
- development assets &gt; a checkout with spaces, percent signs and Unicode reads assets, validates grammars and refuses undeclared grammar names (test (test), 43-66): **keep** to `tests/unit/cli/system/assets.test.ts` `a package folder with spaces, percent signs, and Unicode reads and lists its assets`. Drop the grammar validation and the grammars copy (setup checks it), the undeclared-name refusal (INS-021) and RUNTIME_WASM (INS-008, INS-008).
- writeCheckout (function, 15-30): **move** to `tests/unit/cli/system/assets.test.ts` `writePackageFolder`. Glossary retires checkout; the undeclared.wasm file goes (INS-021); the package.json copy is read at run time and stays in the function. Values to config: PACKAGE_FOLDER_FILES = { 'packages/cli/configurations/.index.json': '{}', 'packages/cli/configurations/language/bash/.meta/state.json': '{}' } -&gt; tests/config/system.ts

## `tests/cli/platform/claims.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/safe-folder/lock.test.ts`. safe-folder/lock.ts holds the writer lock (PLR-003, PLR-008, TPR-021); glossary: lock, not claim.
- a claim released after exclusive creation fails can be acquired (test (test), 15-39): **keep** to `tests/unit/cli/system/safe-folder/lock.test.ts` `a lock removed after a failed create can be taken`. TPR-021 keeps it, rewritten for the linkSync creation; use .gspot/state/writer.lock
- a live replacement survives a stale holder check (test (test), 41-72): **keep** to `tests/unit/cli/system/safe-folder/lock.test.ts` `a live lock written during the dead-holder check survives`. TPR-021 keeps it (the .reclaim recovery folder stays)
- an empty claim can finish initialization while another writer waits (test (test), 74-124): **delete**. TPR-021: atomic linkSync creation removes the empty-lock wait this tests
- a claim published during its snapshot read is checked again without replacing its live owner (test (test), 126-148): **delete**. TPR-021: atomic linkSync creation removes the empty-lock wait this tests
- a recovery lease refuses a competing reclaimer until recovery finishes (test (test), 150-173): **keep** to `tests/unit/cli/system/safe-folder/lock.test.ts` `the recovery folder refuses a second recovery until the first one ends`. TPR-021 keeps it
- an abandoned empty claim stays intact until its owner is checked and removed (test (test), 175-195): **delete**. Weak: gspot links a fully written temporary file into place (TPR-021), so a lock file without a process ID is a state gspot cannot produce; the test writes one by hand to reach the incomplete-lock branch of assertAbandonedClaim, which goes with it.
- root lifecycle mutations: a second writer is refused until the first releases its claim (test (test.skipIf), 197-225): **keep** to `tests/unit/cli/system/safe-folder/lock.test.ts` `a second writer is refused until the first releases the lock`. Real behavior; TPR-016: no POSIX gate.
- !isPosix (test (test.skipIf), 197-197): **delete**. TPR-016: nothing POSIX-specific in the test

## `tests/cli/platform/environment.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/environment.test.ts`. Tests system/environment.ts (PLR-003, TPR-062, TPR-017).
- name (test (test), 9-15): **keep** to `tests/unit/cli/system/environment.test.ts` `mise data folder: $name`. TPR-062: test.each with four rows instead of a for loop
- a relative cache directory override is refused (test (test.skipIf), 18-22): **keep** to `tests/unit/cli/system/environment.test.ts` `a relative cache folder setting is refused on %s`. TPR-017: simulate linux and win32 with usePlatform instead of skipping macOS
- process.platform === 'darwin' (test (test.skipIf), 18-18): **delete**. TPR-017: env-paths reads process.platform at call time, so every system runs both cases

## `tests/cli/platform/git.test.ts`

- (the file) (file): **move** to `tests/unit/cli/execution/copy/revision.test.ts`. TPR-032: it tests checkOutRevision (execution/copy/revision.ts in the EXG and architecture layout)
- a linked-worktree hook keeps its custom index and HEAD while checking private revisions (test (test), 9-51): **keep** to `tests/unit/cli/execution/copy/revision.test.ts` `a hook in a linked worktree keeps its own index and HEAD while gspot copies the staged and committed revisions`. TPR-032: real behavior; split its nine checks where they stand alone.

## `tests/cli/platform/globs.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/files.test.ts`. PLR-004, PLR-020: globPaths becomes a plain walker in system/files.ts
- the pattern %s leaves its folder and is refused (test (test.each), 9-21): **keep** to `tests/unit/cli/system/files.test.ts` `a pattern that leaves the folder is refused: %s`. Real behavior; assertInsideFolder stays (PLR-004).
- \[ '../outside/\*\*', 'src/../../outside.ts', '/etc/\*\*', 'C:/Windows/\*\*', '!../outside/\*\*', '{src,. (test (test.each), 9-17): **keep** to `tests/unit/cli/system/files.test.ts`. Pattern table of the test above. Values to config: OUTSIDE_PATTERNS = the seven patterns that leave the folder ('../outside/\*\*', 'src/../../outside.ts', '/etc/\*\*', 'C:/Windows/\*\*', '!../outside/\*\*', '{src,../outside}/\*\*', 'src/{..,nested}/\*.ts') -&gt; tests/config/system.ts
- a walk that follows links ends at a link back to its own folder (test (test.skipIf), 23-29): **delete**. PLR-004: the walker never follows links, followSymlinks goes
- !isPosix (test (test.skipIf), 23-23): **delete**. PLR-004: the test goes
- $link blocks $pattern until following is requested or the link is replaced (test (test.skipIf), 31-50): **keep** to `tests/unit/cli/system/files.test.ts` `a glob does not walk through the link $link to reach $pattern`. PLR-004: keep the no-follow half, and the followSymlinks half goes; gspot writes no .mise/conf.d/ (INX-001), so the link sample uses any nested folder pattern, such as .config/sub/\*.toml, with the same behavior.
- \[ { link: '.mise', target: '../outside', pattern: '.mise/conf.d/\*.toml' }, { link: '.mise/conf.d', target: '../. (test (test.skipIf), 31-35): **keep** to `tests/unit/cli/system/files.test.ts`. Link table of the test above, with a neutral nested folder in place of .mise/conf.d (INX-001). Values to config: LINKED_MISE_FOLDERS = the three { link, target, pattern } rows -&gt; tests/config/system.ts
- !isPosix (test (test.skipIf), 31-31): **keep** to `tests/unit/cli/system/files.test.ts` `isWindows`. Skip condition, with one name for Windows; folder links need extra rights on Windows.
- hidden directories, finite patterns, exclusions, and case-sensitive matches retain their selections (test (test), 52-82): **keep** to `tests/unit/cli/system/files.test.ts` `a glob includes dot files and honors exclusions and brace patterns`. PLR-004: drop the dot: false and onlyFiles: false assertions, only tests pass them
- finite native queries keep link leaves and complete explicit aliases without entering loops (test (test.skipIf), 84-110): **keep** to `tests/unit/cli/system/files.test.ts` `a glob lists links as files and never enters them`. PLR-004: keep the two no-follow assertions; the followSymlinks assertions go
- !isPosix (test (test.skipIf), 84-84): **keep** to `tests/unit/cli/system/files.test.ts` `isWindows`. Skip condition, with one name for Windows; links need POSIX here.

## `tests/cli/platform/managed-blocks.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/managed-blocks.test.ts`. TPR-055 (do after NMU-007): the block functions move to system/managed-blocks.ts
- are appended and replaced without changing authored text (test (test), 5-14): **keep** to `tests/unit/cli/system/managed-blocks.test.ts` `a managed block is appended and replaced without changing your own text`. Real behavior; glossary retires authored.
- all block operations reject malformed markers in $path: $source (test (test.each), 16-22): **keep** to `tests/unit/cli/system/managed-blocks.test.ts` `every block operation refuses malformed markers in $path: $source`. Real behavior.
- MALFORMED_BLOCKS (test (test.each), 16-16): **keep** to `tests/unit/cli/system/managed-blocks.test.ts` `MALFORMED_BLOCKS`. TEL-028 deletes its second user, so it moves into this test; it keeps the five AGENTS.md rows, since the five .gitignore rows repeat the same marker layouts with hash markers and 'block readers keep your own text' already reads both marker styles.
- block readers preserve authored text with $name markers in $path (test (test.each), 24-43): **keep** to `tests/unit/cli/system/managed-blocks.test.ts` `block readers keep your own text with $name line endings in $path`. Real behavior; glossary retires authored.
- BLOCK_FORMATS.flatMap((context) =&gt; ( \[ \['\\n', 'LF'\], \['\\r\\n', 'CRLF' (test (test.each), 24-33): **keep** to `tests/unit/cli/system/managed-blocks.test.ts`. Table stays

## `tests/cli/platform/root.test.ts`

- (the file) (file): **split** to `tests/unit/cli/system/safe-folder/writes.test.ts; tests/unit/cli/system/safe-folder/names.test.ts; tests/unit/cli/system/safe-folder/open.test.ts; tests/unit/cli/system/safe-folder/reads.test.ts`. Each test goes to the safe-folder source file it tests: open, names, reads or writes (PLR-002, PLR-008, PLR-011, TPR-002).
- native replacement and removal preserve modes $original/$replacement and refuse stale writes (test (test.each), 19-48): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `write and remove keep the file modes $original/$replacement and refuse a stale expected copy`. Real behavior; replaceEntry (safe-folder/writes.ts).
- ROOT_REPLACEMENTS.filter(({ posix }) =&gt; !posix || isPosix) (test (test.each), 19-19): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `MODE_REPLACEMENTS`. Glossary: root means the repository root, not the safe folder
- root lifecycle mutations: $format path $path cannot change an external file (test (test .skipIf), 50-78): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `$format path $path cannot change a file outside the folder`. Real behavior; title jargon (TCM-030: lifecycle).
- (\['portable', 'native'\] as const).flatMap((format) =&gt; UNSAFE_DESTINATIONS.map((entry) =&gt; ({ format, ...entry (test (test .skipIf), 50-56): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts`. Table stays; PathFormat native becomes system (NMS)
- !isPosix (test (test .skipIf), 50-51): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `isWindows`. Skip condition, with one name for Windows; links and hard links to outside files need POSIX here.
- root lifecycle mutations: native snapshot names retain POSIX bytes while refusing traversal and private links (test (test.skipIf), 80-97): **move** to `tests/unit/cli/system/safe-folder/names.test.ts` `the system path format keeps POSIX names the portable rules refuse, and refuses links to gspot state`. Real behavior; nativeSegments and portableSegments (safe-folder/names.ts); glossary retires native and snapshot.
- !isPosix (test (test.skipIf), 80-80): **move** to `tests/unit/cli/system/safe-folder/names.test.ts` `isWindows`. Skip condition, with one name for Windows; names with a newline and a colon exist only on POSIX.
- native paths refuse the escape %j (test (test.skipIf), 99-105): **move** to `tests/unit/cli/system/safe-folder/names.test.ts` `system paths refuse the escape %j`. Real behavior; safe-folder/names.ts; glossary: PathFormat native becomes system.
- NATIVE_PATH_REFUSALS (test (test.skipIf), 99-99): **move** to `tests/unit/cli/system/safe-folder/names.test.ts`. One-line table written in the test (TPR-034)
- !isPosix (test (test.skipIf), 99-99): **delete**. TPR-016: on Windows the portable rules refuse the same paths
- root lifecycle mutations: link publication refuses target $target (test (test.skipIf), 107-129): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `a link write refuses the target $target`. Real behavior; PLR-027 removes the duplicate character check, so the NUL and backslash rows expect the segment refusal.
- LINK_TARGET_REFUSALS (test (test.skipIf), 107-107): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `LINK_TARGET_REFUSALS`. Table of the test above, moved in from tests/config (TPR-034).
- !isPosix (test (test.skipIf), 107-107): **keep** to `tests/unit/cli/system/safe-folder/writes.test.ts` `isWindows`. Skip condition, with one name for Windows; file links need POSIX here.
- mutation paths reject the portable escape %j (test (test.each), 131-149): **move** to `tests/unit/cli/system/safe-folder/names.test.ts` `portable paths refuse the escape %j`. Real behavior; portableSegments (safe-folder/names.ts).
- \[ '../outside', '/outside', 'a/../b', 'a//b', 'a/./b', 'C:relative', 'C:/absolute', Stri (test (test.each), 131-147): **move** to `tests/unit/cli/system/safe-folder/names.test.ts`. Table of the test above. Values to config: PORTABLE_PATH_ESCAPES = the fifteen refused paths ('../outside', '/outside', 'a/../b', 'a//b', 'a/./b', 'C:relative', 'C:/absolute', '\\\\server\\share', 'a\\b', 'nul.txt', 'a/COM1', 'a.', 'a ', 'a\\0b', '') -&gt; tests/config/system.ts
- mutation paths preserve ordinary Unicode names (test (test), 151-153): **move** to `tests/unit/cli/system/safe-folder/names.test.ts` `portable paths keep ordinary Unicode names`. Real behavior.
- Windows file identity for mode %i retains its writable class (test (test.each), 155-174): **delete**. PLR-011: fileMode loses its test-only platform parameter; Windows CI covers the Windows branch.
- \[ \[0o600, true\], \[0o640, true\], \[0o644, true\], \[0o755, true\], \[0o777, true\], \[0o400, false\], (test (test.each), 155-165): **delete**. PLR-011: the fake-OS table goes
- empty-directory removal bounds parents and preserves nonempty directories (test (test), 176-197): **move** to `tests/unit/cli/system/safe-folder/open.test.ts` `rmdir refuses linked and outside parents and keeps folders that are not empty`. Real behavior; rmdir is defined in openSafeFolder (safe-folder/open.ts).
- an existing macOS root reports an unmet runtime prerequisite instead of a missing policy (test (test.skipIf), 199-222): **delete**. TPR-002: asserts a Bun bug; no replacement test is planned.
- !isMacos (test (test.skipIf), 199-199): **delete**. Asserts a Bun bug (TPR-002).
- an existing macOS source reports the native runtime prerequisite without being treated as absent (test (test.skipIf), 224-241): **delete**. TPR-002: asserts a Bun bug
- !isMacos (test (test.skipIf), 224-224): **delete**. Asserts a Bun bug (TPR-002).
- a genuinely absent root retains its filesystem error rather than a runtime prerequisite (test (test), 243-251): **move** to `tests/unit/cli/system/safe-folder/reads.test.ts` `a missing folder keeps its ENOENT error`. Real behavior; canonicalPath (safe-folder/reads.ts).

## `tests/cli/platform/source.test.ts`

- (the file) (file): **split** to `tests/unit/cli/system/file-reads.test.ts; tests/unit/cli/repository/tracked.test.ts`. PLR layout: system/file-reads.ts holds readText, readSource, readPrefix, createReadCache; the discovery test goes to repository/tracked
- source reads distinguish missing optional text, required bytes, and invalid UTF-8 (test (test), 13-29): **keep** to `tests/unit/cli/system/file-reads.test.ts` `reads tell a missing optional file, required bytes, and invalid UTF-8 apart`. Real behavior.
- authored text follows file and directory links inside its root and reads hard-linked content (test (test), 31-41): **keep** to `tests/unit/cli/system/file-reads.test.ts` `text reads follow file and folder links inside the folder and read hard links`. Real behavior; TPR-009 keeps it as the one link-follow test.
- source reads refuse a link chain outside its root and succeed after the link is corrected (test (test), 43-57): **keep** to `tests/unit/cli/system/file-reads.test.ts` `reads refuse a link chain that leaves the folder and work after the link is fixed`. Real behavior; TPR-009 keeps it as the one outside-link test.
- run-owned reads hold one repository snapshot and uncached reads observe later edits (test (test), 59-71): **keep** to `tests/unit/cli/system/file-reads.test.ts` `the read cache keeps one copy per run and uncached reads see later edits`. Real behavior.
- canonical reads resolve an aliased root once and retain source errors until correction (test (test), 73-103): **delete**. Weak: it counts realpathSync calls and injects two errors on one code path (TPR-020); a failed read that is not cached stays covered by 'the read cache never serves another folder or a failed read'.
- source reads refuse an escape introduced after inventory and accept an internal replacement (test (test), 105-122): **delete**. Duplicate of the outside-link test 'reads refuse a link chain that leaves the folder and work after the link is fixed' (TPR-009).
- source reads never cache isolated output or turn failed reads into success (test (test), 124-138): **keep** to `tests/unit/cli/system/file-reads.test.ts` `the read cache never serves another folder or a failed read`. Real behavior; TPR-049: build the cache with createReadCache and pass reads.root; glossary retires isolated.
- source discovery leaves out the external %s link before inspection (test (test.each), 140-163): **move** to `tests/unit/cli/repository/tracked.test.ts` `the repository file list leaves out the outside link %s`. Real behavior; the listing (getEntry in repository/tracked.ts) leaves out the link; TPR-009: drop the readPrefix link assertion.
- \[ \['linked.ts', '../outside/secret.ts'\], \['linked-directory', '../outside'\], \] (test (test.each), 140-143): **move** to `tests/unit/cli/repository/tracked.test.ts`. Table stays

## `tests/cli/platform/spawn/backends.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/processes/run.test.ts`. PLR-003, PLR layout (system/processes.ts)
- '${backend.name}: a selected executable resolves its sibling commands before unrelated PATH tools' (test (test), 27-42): **keep** to `tests/unit/cli/system/processes/run.test.ts` ``${backend.name}: a chosen program runs its sibling commands before unrelated PATH tools``. Real behavior.
- '${backend.name}: drains both large streams and preserves status %s' (test (test.each), 43-57): **keep** to `tests/unit/cli/system/processes/run.test.ts` ``${backend.name}: drains both large streams and keeps exit code %s``. Real behavior.
- \[0, 1\] (test (test.each), 43-43): **keep** to `tests/unit/cli/system/processes/run.test.ts`. Table stays
- '${backend.name}: missing executable is a launch failure with diagnostics' (test (test), 59-65): **keep** to `tests/unit/cli/system/processes/run.test.ts` ``${backend.name}: a missing program is a launch failure with its error output``. Real behavior.
- '${backend.name}: denied execution is distinct from a missing file' (test (test.skipIf), 67-77): **keep** to `tests/unit/cli/system/processes/run.test.ts` ``${backend.name}: denied execution is not a missing file``. Real behavior.
- !isPosix (test (test.skipIf), 67-67): **keep** to `tests/unit/cli/system/processes/run.test.ts` `isWindows`. Skip condition, with one name for Windows; file modes do not deny execution on Windows.
- '${backend.name}: a genuine deadline terminates the process and reports timeout' (test (test), 79-87): **keep** to `tests/unit/cli/system/processes/run.test.ts` ``${backend.name}: a timeout stops the process and reports it``. TPR-028 keeps the per-backend timeout test (it covers runBlocking); glossary: timeout, not deadline
- '${backend.name}: a signal before the deadline is not a timeout' (test (test.skipIf), 90-99): **keep** to `tests/unit/cli/system/processes/run.test.ts` ``${backend.name}: a signal before the timeout is not a timeout``. Real behavior.
- !isPosix (test (test.skipIf), 90-90): **keep** to `tests/unit/cli/system/processes/run.test.ts` `isWindows`. Skip condition, with one name for Windows; Windows has no signals.
- a pre-aborted immediate process reports cancellation instead of success (test (test), 102-114): **keep** to `tests/unit/cli/system/processes/run.test.ts` `a process canceled before it starts reports the cancellation`. Real behavior.
- cancellation terminates the process without reporting a timeout (test (test), 116-131): **delete**. TPR-028: the byte-capture cancel test in processes-stop covers it, run and runForBytes share runStream
- $name: preserves stdin, argument boundaries, final newlines, and the requested environment (test (test.each), 133-165): **keep** to `tests/unit/cli/system/processes/run.test.ts` `$name: keeps stdin, argument boundaries, final newlines, and the given environment`. Real behavior.
- backends (test (test.each), 133-133): **keep** to `tests/unit/cli/system/processes/run.test.ts` `backends`. Table stays
- $name: explicitly removes inherited environment values (test (test.skipIf), 168-180): **keep** to `tests/unit/cli/system/processes/run.test.ts` `$name: an environment variable set to undefined is removed`. Real behavior.
- backends (test (test.skipIf), 168-168): **keep** to `tests/unit/cli/system/processes/run.test.ts` `backends`. Table stays
- !isPosix (test (test.skipIf), 168-168): **keep** to `tests/unit/cli/system/processes/run.test.ts` `isWindows`. Skip condition, with one name for Windows; Windows supplies Path itself.
- backends (const, 13-24): **move** to `tests/unit/cli/system/processes/run.test.ts` `backends`. Keeps the time-limit clamp, imported from tests/setup/processes.ts (THR-020); it holds two functions that call run and runBlocking, not static data, so it stays a module-level value of its test file.

## `tests/cli/platform/spawn/termination.test.ts`

- (the file) (file): **move** to `tests/unit/cli/system/processes/stop.test.ts`. PLR layout (system/processes.ts); with processes.test.ts it passes 300 lines, so stopping processes keeps its own file
- a failed %s stream read terminates the owned child (test (test.each), 28-52): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `a failed %s stream read stops the child`. Real behavior.
- \['text', 'binary'\] as const (test (test.each), 28-28): **keep** to `tests/unit/cli/system/processes/stop.test.ts`. Table stays
- binary capture preserves invalid UTF-8 bytes and diagnostic output (test (test), 54-67): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `byte capture keeps invalid UTF-8 bytes and the error output`. Real behavior; glossary: binary only for a non-text file (runBinary becomes runForBytes).
- %s capture stops descendants on %s before they can write after the deadline (test (test.each), 69-91): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `%s capture stops child processes on %s before they write after the time limit`. Real behavior.
- \[ \['text', 'timeout'\], \['binary', 'canceled'\], \] as const (test (test.each), 69-72): **keep** to `tests/unit/cli/system/processes/stop.test.ts`. Table stays
- a CLI exit terminates its ready asynchronous process group (test (test), 93-121): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `an exiting CLI stops its running process group`. Real behavior; THR-020: start the child with startCommand.
- live output arrives before completion while capture retains output and failure status (test (test), 123-163): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `live output arrives before the process ends while capture keeps the output and exit code`. Real behavior.
- %s capture reaps descendants holding output after an ordinary parent exit (test (test.each), 165-183): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `%s capture stops child processes that hold the output after the parent exits`. Real behavior.
- \['text', 'binary'\] as const (test (test.each), 165-165): **keep** to `tests/unit/cli/system/processes/stop.test.ts`. Table stays
- the reap after an ordinary exit accepts a macOS refusal to signal a group that has exited (test (test.skipIf), 185-208): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `the stop after a normal exit accepts the macOS refusal to signal an exited group`. Real behavior; TPR-019: usePlatform(darwin) in place of a hand-made override.
- process.platform === 'win32' (test (test.skipIf), 185-185): **delete**. TPR-072: the platform is simulated as darwin, so the taskkill path is never used
- stream consumption preserves raw bytes without captured output and retains diagnostics (test (test), 210-227): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `stream reading keeps raw bytes and the error output`. Real behavior.
- a rejected stream consumer terminates and drains its owned child (test (test), 229-254): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `a stream reader that throws stops and drains its child`. Real behavior; TPR-024: one rejection style.
- stream cancellation terminates the child and preserves the cancellation reason (test (test), 256-285): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `stream cancellation stops the child and keeps the cancellation reason`. Real behavior.
- a completed native stream retains the consumer refusal after process cleanup (test (test), 287-302): **keep** to `tests/unit/cli/system/processes/stop.test.ts` `a finished stream keeps the reader error after cleanup`. Real behavior; glossary retires native.
- captures (const, 14-19): **move** to `tests/unit/cli/system/processes/stop.test.ts` `captures`. Keeps the time-limit clamp (THR-020); it holds two functions that call run and runBlocking, not static data, so it stays in its test file.
- terminated (function, 22-26): **move** to `tests/unit/cli/system/processes/stop.test.ts` `terminated`. Two users in this file

## `tests/cli/platform/writes.test.ts`

- (the file) (file): **delete**. writeAll and the batched flush path go with LIF-001 (LIF-004).
- batch publication drains descriptors and preserves the installed tree after $name (test (test.each), 13-73): **delete**. LIF-004: it tests the deleted batch publication
- \[...FLUSH_FAILURES\] (test (test.each), 13-13): **delete**. Table of the deleted test above (LIF-004).

## `tests/cli/repository/aliases.test.ts`

- (the file) (file): **split** to `tests/unit/cli/repository/aliases.test.ts; tests/unit/cli/parsers/tsconfig.test.ts`. TPR-025: the getTsconfig cache test goes to parsers/tsconfig; TPR-009; TPR-026
- alias reads report malformed $path (test (test.each), 13-18): **keep** to `tests/unit/cli/repository/aliases.test.ts` `alias reads report a malformed $path`. Real behavior; TPR-049: use createReadCache.
- ALIAS_INPUTS (test (test.each), 13-13): **keep** to `tests/unit/cli/repository/aliases.test.ts` `ALIAS_FILES`. Table of the test above; glossary retires inputs; its rows live in tests/config/repository.ts, without the valid column of the deleted link test.
- alias reads refuse an authored $path linked outside the repository (test (test.each), 20-30): **delete**. TPR-009: the outside-link guard of readText is tested in system/file-reads
- ALIAS_INPUTS (test (test.each), 20-20): **delete**. Table of the deleted test above (TPR-009).
- root and child aliases read their own declarations with compiler paths taking precedence (test (test), 32-45): **keep** to `tests/unit/cli/repository/aliases.test.ts` `root and child aliases read their own files, and tsconfig paths win`. Real behavior.
- alias reads follow an extends into a linked node_modules package (test (test), 47-57): **keep** to `tests/unit/cli/repository/aliases.test.ts` `alias reads follow extends into a linked node_modules package`. Real behavior.
- alias discovery accepts absent configuration files (test (test), 59-62): **delete**. Duplicate: aliasesFor runs for every ESLint configuration gspot writes, so every generation test of a sandbox without a tsconfig.json or package.json imports block already fails if a missing file throws.
- inherited aliases resolve from the configuration that declares them (test (test), 64-80): **keep** to `tests/unit/cli/repository/aliases.test.ts` `inherited aliases are read relative to the file that declares them`. Real behavior.
- generated compiler configurations extend their authored alias owners (test (test), 82-102): **delete**. TPR-026: generation/typescript and checks/language/typescript tests check both extends paths
- alias discovery accepts linked authored manifests and inherited compiler configurations inside the repository (test (test), 104-117): **delete**. TPR-009: repeats the link-follow test of system/file-reads
- alias discovery reports a missing authored base by its filename (test (test), 119-124): **keep** to `tests/unit/cli/repository/aliases.test.ts` `alias reads name a missing extended file`. Real behavior.
- compiler configuration reads share one run snapshot and isolate roots and later runs (test (test), 126-146): **move** to `tests/unit/cli/parsers/tsconfig.test.ts` `tsconfig reads share one read cache per run and keep folders apart`. TPR-025: it tests getTsconfig (parsers/tsconfig.ts); TPR-049: createReadCache and reads.root

## `tests/cli/repository/generated.test.ts`

- (the file) (file): **split** to `tests/unit/cli/repository/kind.test.ts; tests/unit/cli/repository/select.test.ts; tests/unit/cli/execution/fixes/passes.test.ts`. Split by source file (TPR-054, TPR-030): fileDeclarations lives in repository/select.ts, the kind order in repository/kind.ts, and the reread after a fix in the fix passes tests; the settings/file half of the last test goes (CFR-005).
- selected configurations classify their declared files: $configurations $tables (test (test.each), 12-31): **move** to `tests/unit/cli/repository/select.test.ts` `the configurations each scope selects mark their generated files: $configurations $tables`. Real behavior; it tests fileDeclarations (repository/select.ts); scopes are \[\[scope\]\] records (CFR-003).
- GENERATED_SELECTIONS (test (test.each), 12-12): **move** to `tests/unit/cli/repository/select.test.ts` `GENERATED_SELECTIONS`. Moved in from tests/config (TPR-034)
- authored declarations and Git attributes precede configuration-generated paths (test (test), 33-48): **keep** to `tests/unit/cli/repository/kind.test.ts` `Git attributes win over the generated files of configurations`. Real behavior; declaredKind order (repository/kind.ts); gspot.toml has no \[\[generated\]\] or \[\[vendored\]\] (CFR-005), so the sample marks next-env.d.ts linguist-vendored in .gitattributes and the test checks that .gitattributes markers win over the files the configurations declare; scopes are \[\[scope\]\] records (CFR-003).
- a native fixer refresh retains configuration-generated paths without exporting internal declarations (test (test), 50-73): **move** to `tests/unit/cli/execution/fixes/passes.test.ts` `a fix run keeps the generated-file list`. TPR-030: plain name, and list the paths in place of toHaveLength(4); gspot.toml has no \[\[generated\]\] key (CFR-005), so only the fix-run half stays; scopes are \[\[scope\]\] records (CFR-003).

## `tests/cli/repository/kinds.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/kind.test.ts`. TPR-054 (kinds and generated test one concept); architecture layout repository/kind.ts
- kinds (describe (describe), 17-54): **delete**. TTC-039: a describe around one test
- kinds &gt; declarations win, then .gitattributes, then banners, then vendored directories, then the sniff (test (test), 18-53): **keep** to `tests/unit/cli/repository/kind.test.ts` `.gitattributes wins, then the files configurations declare, then banners, vendored folders, and the content sniff`. Real behavior; only configuration declarations remain (CFR-005), and declaredKind reads .gitattributes before them; the declaration in the test is one a configuration makes, with no generator field and no producedBy assertion.
- an @generated marker in a comment line makes a file generated, and the bare word does not (test (test), 56-66): **keep** to `tests/unit/cli/repository/kind.test.ts` `an @generated marker in a comment line makes a file generated, and the bare word does not`. Real behavior.
- a license text is vendored, and a source file named like one stays source (test (test), 68-79): **keep** to `tests/unit/cli/repository/kind.test.ts` `a license text is vendored, and a source file named like one stays source`. Real behavior. Values to config: LICENSE_FILES = \['LICENSE', 'LICENSE.md', 'LICENSE-MIT', 'COPYING.txt', 'LICENCE.rst', 'NOTICE', 'NOTICE.txt'\] -&gt; tests/config/repository.ts; LICENSE_LIKE_SOURCES = \['license-lockfiles.test.ts', 'license.ts', 'licenses.json', 'notice.py'\] -&gt; tests/config/repository.ts
- an unreadable attributes file cannot become an empty rule set (test (test), 81-91): **keep** to `tests/unit/cli/repository/kind.test.ts` `an unreadable .gitattributes is an error, not an empty rule set`. Real behavior; TPR-024: one rejection style.
- Git attributes use native precedence without decoding the working-tree file (test (test), 93-105): **keep** to `tests/unit/cli/repository/kind.test.ts` `Git attributes follow Git order and are not decoded from the working tree`. Real behavior; PLR-031: test through readRepository, not the exported readAttributes; glossary retires native.
- repository inventory recognizes every generated header format outside the private directory (test (test), 107-127): **keep** to `tests/unit/cli/repository/kind.test.ts` `every generated header format marks a file generated outside .gspot`. Real behavior.
- linked authored attributes classify files inside the root and reject an external target (test (test), 129-147): **delete**. TPR-009: repeats the link guards of system/file-reads
- %s attribute discovery honors later and nested overrides (test (test.each), 149-162): **keep** to `tests/unit/cli/repository/kind.test.ts` `%s attribute reads honor later and nested overrides`. Real behavior.
- \['folder', 'Git'\] (test (test.each), 149-149): **keep** to `tests/unit/cli/repository/kind.test.ts`. Table stays
- Git info attributes override tracked declarations until removed (test (test), 164-188): **keep** to `tests/unit/cli/repository/kind.test.ts` `Git info attributes override tracked declarations until removed`. Real behavior.

## `tests/cli/repository/package-manifests.test.ts`

- (the file) (file): **split** to `tests/unit/cli/repository/dependency-files.test.ts; tests/unit/cli/parsers/dependency-files.test.ts; tests/unit/cli/rules.test.ts; tests/unit/cli/generation/tool-files.test.ts; tests/unit/cli/execution/fixes/passes.test.ts`. Split by source file: dependency file reads to repository/dependency-files.ts, parser rules to parsers/dependency-files.ts (PAR-063, PAR-063, TPR-025, TPR-031), the template part to the tool file writer generation/tool-files.ts, and the reread after a fix to the fix passes tests.
- Python manifest reads preserve captured dependencies and report invalid current text (test (test), 29-39): **keep** to `tests/unit/cli/repository/dependency-files.test.ts` `Python dependency file reads keep their dependencies and report invalid text`. Real behavior.
- a failed read of a discovered manifest remains an error (test (test), 41-50): **keep** to `tests/unit/cli/repository/dependency-files.test.ts` `a dependency file that disappears after the repository read is an error`. Real behavior.
- package manifest reads preserve authored fields and distinguish missing files from invalid data (test (test), 52-70): **keep** to `tests/unit/cli/repository/dependency-files.test.ts` `package.json reads keep your own fields and tell a missing file from invalid data`. Real behavior; glossary retires authored.
- Python group includes coexist with dependency detection (test (test), 72-80): **move** to `tests/unit/cli/parsers/dependency-files.test.ts` `Python dependency groups with includes keep every dependency`. TPR-025: parser rule (parsers/dependency-files.ts)
- pytest configuration records tool use without requiring an authored dependency (test (test), 82-89): **move** to `tests/unit/cli/parsers/dependency-files.test.ts` `a pytest table counts as a pytest dependency`. TPR-025: parser rule
- manifest inspection refuses an external link replacing a manifest (test (test), 91-104): **delete**. TPR-009: repeats the outside-link guard of readText
- invalid $name in $path reports its source (test (test.each), 106-111): **move** to `tests/unit/cli/parsers/dependency-files.test.ts` `an invalid $name in $path names the file`. TPR-025: parser rule
- INVALID_PYTHON_DEPENDENCY_CASES (test (test.each), 106-106): **move** to `tests/unit/cli/parsers/dependency-files.test.ts` `INVALID_PYTHON_DEPENDENCIES`. Table of the test above; moves with its test; glossary retires "cases".
- captured manifests follow authored links inside the repository and reject invalid text (test (test), 113-128): **delete**. TPR-009: repeats the link-follow and UTF-8 tests of system/file-reads
- declared framework dependencies follow the nearest npm project boundary (test (test), 130-138): **keep** to `tests/unit/cli/repository/dependency-files.test.ts` `declared framework dependencies follow the nearest npm project`. Real behavior; getProjectDependencies (repository/dependency-files.ts).
- invalid %s content %s remains a manifest-reader error (test (test.each), 140-145): **move** to `tests/unit/cli/parsers/dependency-files.test.ts` `invalid %s content %s is a dependency file error`. TPR-025: parser rule; glossary: manifest means manifest.toml only
- INVALID_MANIFESTS (test (test.each), 140-140): **move** to `tests/unit/cli/parsers/dependency-files.test.ts` `INVALID_DEPENDENCY_FILES`. Table of the test above; moves with its test; glossary: manifest means manifest.toml only.
- session package facts retain root and child detection at %s (test (test.each), 147-192): **split** to `tests/unit/cli/repository/dependency-files.test.ts; tests/unit/cli/rules.test.ts; tests/unit/cli/generation/tool-files.test.ts` `a broken package.json stops the next session and a fixed one changes the scope dependencies; a react dependency selects COMPONENTS.md; tool file source values list the dependencies of each scope`. TPR-031: the session-error part stays here, the rule part goes to rules.test.ts and the template part to the tool file writer tests (generation/tool-files.ts); PLR-005 deletes detectUnselected, so that assertion goes; the sample uses the rules settings (TML-003) and \[\[scope\]\] records (CFR-003).
- \['recommended', 'all'\] as const (test (test.each), 147-147): **delete**. TPR-031, TGN-037: COMPONENTS.md is selected by dependencies at both levels
- fix verification refreshes the opened session package facts without changing its child (test (test), 194-223): **move** to `tests/unit/cli/execution/fixes/passes.test.ts` `a fix run rereads package.json for the open session and leaves the child scope alone`. TPR-025: it tests the fix run (execution/fixes.ts), whose reread after a fix belongs to the fix passes tests; the sample uses \[\[scope\]\] records (CFR-003) and a \[\[command_check\]\] record with name.

## `tests/cli/repository/project-folder.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/scopes.test.ts`. TPR-054; projectFolder lives in repository/scopes.ts (PLR layout)
- %s with the project file %s marks the folder %j (test (test.each), 4-13): **keep** to `tests/unit/cli/repository/scopes.test.ts` `%s with the project file %s marks the folder %j`. Real behavior.
- \[ \['api/package.json', 'package.json', 'api'\], \['package.json', 'package.json', ''\], \['services/billing/requ (test (test.each), 4-11): **keep** to `tests/unit/cli/repository/scopes.test.ts`. Table of the test above. Values to config: PROJECT_FILE_FOLDERS = the six \[path, pattern, folder\] rows -&gt; tests/config/repository.ts
- %s is no project file for %s (test (test.each), 15-22): **keep** to `tests/unit/cli/repository/scopes.test.ts` `%s is no project file for %s`. Real behavior.
- \[ \['api/package-lock.json', 'package.json'\], \['docs/supabase.md', 'supabase/config.toml'\], \['ios/App.xcworks (test (test.each), 15-20): **keep** to `tests/unit/cli/repository/scopes.test.ts`. Table of the test above. Values to config: NOT_PROJECT_FILES = the four \[path, pattern\] rows -&gt; tests/config/repository.ts

## `tests/cli/repository/revisions/changes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/revisions/changes.test.ts`. Architecture layout repository/revisions/changes.ts; TPP-028
- Git change read (describe (describe), 116-134): **delete**. TPP-028: the bodies go inline, the describe adds nothing
- Git change read &gt; reports an unborn index and its unstaged edits (test (test), 117-117): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `reports an unborn index and its unstaged edits`. Real behavior.
- Git change read &gt; keeps deletion paths in staged and reference comparisons (test (test), 119-119): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `keeps deleted paths in staged and branch comparisons`. Real behavior.
- Git change read &gt; keeps both paths of a rename across directories (test (test), 121-121): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `keeps both paths of a rename across folders`. Real behavior.
- Git change read &gt; reports corrupt or absent Git state instead of an empty staged set (test (test), 123-123): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `reports a broken or missing Git repository instead of an empty staged list`. Real behavior.
- Git change read &gt; rejects invalid reference reads without interpreting options (test (test), 125-125): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `refuses invalid references without reading them as options`. Real behavior.
- Git change read &gt; push comparison distinguishes an absent upstream from a missing upstream object (test (test), 127-127): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `push comparison tells a missing upstream from an upstream whose commit is gone`. Real behavior.
- Git change read &gt; push comparison reports an unborn or corrupt HEAD instead of inventing a base (test (test), 129-129): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `push comparison reports an unborn or broken HEAD instead of inventing a base`. Real behavior.
- Git change read &gt; a new branch compares with the remote default without losing unpublished commits (test (test), 131-131): **keep** to `tests/unit/cli/repository/revisions/changes.test.ts` `a new branch compares with the remote default without losing unpushed commits`. Real behavior.
- Git change read &gt; a branch with an upstream at HEAD compares with that exact commit (test (test), 133-133): **delete**. Duplicate: same steps and assertion as the upstream-at-HEAD step of 'push comparison tells a missing upstream from an upstream whose commit is gone': a branch whose upstream is at HEAD gets HEAD as its push base.
- unbornIndex (function, 10-18): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `reports an unborn index and its unstaged edits`. TPP-028: the body goes into its one test
- deletedPaths (function, 20-29): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `keeps deleted paths in staged and branch comparisons`. TPP-028: the body goes into its one test
- renamedPaths (function, 31-40): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `keeps both paths of a rename across folders`. TPP-028: the body goes into its one test
- corruptState (function, 42-48): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `reports a broken or missing Git repository instead of an empty staged list`. TPP-028: the body goes into its one test
- invalidReference (function, 50-59): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `refuses invalid references without reading them as options`. TPP-028: the body goes into its one test
- absentUpstream (function, 61-76): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `push comparison tells a missing upstream from an upstream whose commit is gone`. TPP-028: the body goes into its one test
- unbornHead (function, 78-86): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `push comparison reports an unborn or broken HEAD instead of inventing a base`. TPP-028: the body goes into its one test
- remoteBranch (function, 88-103): **inline** to `tests/unit/cli/repository/revisions/changes.test.ts` `a new branch compares with the remote default without losing unpushed commits`. TPP-028: the body goes into its one test
- trackedBranch (function, 105-114): **delete**. Duplicate: body of the deleted upstream-at-HEAD test.

## `tests/cli/repository/revisions/push.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/revisions/push.test.ts`. Architecture layout repository/revisions/push.ts
- the hook remote %s selects its native tracking range (test (test.each), 10-26): **keep** to `tests/unit/cli/repository/revisions/push.test.ts` `the hook remote %s selects its tracking range`. Real behavior; TTC-032: native retired.
- \['origin', undefined, 'file:///unused', '/unused'\] as const (test (test.each), 10-10): **keep** to `tests/unit/cli/repository/revisions/push.test.ts`. Table stays
- native shallow ranges distinguish unobserved history from already advertised commits (test (test), 28-54): **keep** to `tests/unit/cli/repository/revisions/push.test.ts` `a shallow clone reports incomplete history and skips commits the remote already has`. Real behavior; plain title (TTC-032).
- nested policy push selection keeps policy-relative paths for updated and new refs (test (test), 56-81): **keep** to `tests/unit/cli/repository/revisions/push.test.ts` `a gspot.toml below the Git root keeps paths relative to its folder for updated and new branches`. Real behavior; glossary: settings file, not policy.

## `tests/cli/repository/scopes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/scopes.test.ts`. PLR layout (repository/scopes.ts)
- workspace declarations retain tooling packages while scope discovery selects applications: %j (test (test.each), 26-49): **keep** to `tests/unit/cli/repository/scopes.test.ts` `workspace files list tooling packages while scope detection keeps applications: %j`. Real behavior; TPR-014: call plannedScopes directly.
- \[ { 'package.json': '{"workspaces":\["packages/\*"\]}' }, { 'package.json': '{"workspaces":{"packages":\["packages/\* (test (test.each), 26-35): **keep** to `tests/unit/cli/repository/scopes.test.ts`. Table of the test above. Values to config: WORKSPACE_DECLARATIONS = the five workspace file sets (package.json array, package.json object, pnpm-workspace.yaml, lerna.json, rush.json) -&gt; tests/config/repository.ts
- workspace discovery stays within the requested root (test (test), 51-66): **keep** to `tests/unit/cli/repository/scopes.test.ts` `workspace detection stays inside the given folder`. Real behavior.
- invalid or unreadable $path cannot become an empty workspace (test (test.each), 68-78): **keep** to `tests/unit/cli/repository/scopes.test.ts` `an invalid or unreadable $path is an error, not an empty workspace`. Real behavior.
- INVALID_WORKSPACE_CASES (test (test.each), 68-68): **keep** to `tests/unit/cli/repository/scopes.test.ts` `INVALID_WORKSPACE_FILES`. Moved in from tests/config; glossary retires "cases"
- workspace discovery refuses an external package folder from %s (test (test.each), 80-96): **keep** to `tests/unit/cli/repository/scopes.test.ts` `workspace detection refuses a package folder outside the repository from %s`. Real behavior; TPR-009 keeps it (own check in packageWorkspaces).
- \[ \['pnpm-workspace.yaml', 'packages: \["../outside"\]\\n', '../outside'\], \['rush.json', '{"projects":\[{"packageName (test (test.each), 80-83): **keep** to `tests/unit/cli/repository/scopes.test.ts`. Table stays
- broad workspace patterns ignore private environments containing external interpreter links (test (test), 98-114): **keep** to `tests/unit/cli/repository/scopes.test.ts` `broad workspace patterns skip .gspot/.venv and its outside interpreter link`. Real behavior; glossary retires private environments.
- workspace selection does not parse an inactive lower-priority configuration (test (test), 116-125): **keep** to `tests/unit/cli/repository/scopes.test.ts` `workspace detection does not parse an unused lower-priority file`. Real behavior.
- every folder that holds a project file is a scope, the root and lint-only packages aside (test (test), 127-149): **keep** to `tests/unit/cli/repository/scopes.test.ts` `every folder that holds a project file is a scope, the root and lint-only packages aside`. Real behavior.
- workspace discovery accepts linked authored declarations and package manifests inside the root (test (test), 151-163): **delete**. TPR-009: repeats the link-follow test of system/file-reads
- root selections remain local to each repository read and missing-scope fallback (test (test), 165-176): **delete**. TPR-046: guards a shared constant that a spread already copies
- scope discovery excludes declared npm tools and hook managers without hiding unpinned packages (test (test), 178-212): **keep** to `tests/unit/cli/repository/scopes.test.ts` `scope detection leaves out packages that hold only gspot npm tools or a hook manager, and keeps unpinned packages`. Real behavior.
- Python scopes use captured project files and omit workspace-only members after the manifest changes (test (test), 214-221): **keep** to `tests/unit/cli/repository/scopes.test.ts` `Python scopes use the dependency files read with the repository`. Real behavior; glossary retires captured.
- $scope resolves $path and restores its scope-relative path (test (test.each), 223-229): **keep** to `tests/unit/cli/repository/scopes.test.ts` `$scope joins $path and gives back its scope-relative path`. Real behavior; joinScope and relativeToScope (PLR-014) live in repository/scopes.ts.
- SCOPE_PATH_CASES (test (test.each), 223-223): **keep** to `tests/unit/cli/repository/scopes.test.ts` `SCOPE_PATHS`. Moved in from tests/config; glossary retires "cases"
- proposeProjectScopes (function, 16-24): **delete**. TPR-014: plannedScopes computes the patterns and npm names itself; tests call it directly

## `tests/cli/repository/selectors.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/selectors.test.ts`. pathMatcher lives in repository/selectors.ts, so the test sits at that source file's test path.
- path selectors: \*\* crosses directories, ! negates (test (test), 4-10): **keep** to `tests/unit/cli/repository/selectors.test.ts` `path selectors: ** crosses folders and ! negates`. Real behavior.

## `tests/cli/repository/tags.test.ts`

- (the file) (file): **move** to `tests/unit/cli/repository/tags.test.ts`. Architecture layout repository/tags.ts
- tags come from extension, filename, shebang and content (test (test), 7-25): **keep** to `tests/unit/cli/repository/tags.test.ts` `tags and kinds come from the extension, the file name, and the content`. TPR-068: drop the hook file, the Bash shebang row covers it
- $name source receives only its applicable language and runtime tags (test (test.each), 27-32): **keep** to `tests/unit/cli/repository/tags.test.ts` `a $name shebang gives only its language and runtime tags`. Real behavior.
- SHEBANG_CASES (test (test.each), 27-27): **keep** to `tests/unit/cli/repository/tags.test.ts` `SHEBANGS`. Table of the test above; glossary retires "cases"; it keeps Bash, POSIX shell, Bun (env -S), Python (version suffix) and plain text, since Dash repeats 'POSIX shell' and the zsh, Bats, Node.js and Deno rows each repeat one entry of the source list SHEBANG_INTERPRETERS; its rows live in tests/config/repository.ts.
- binary content receives no shebang language or runtime tags (test (test), 34-40): **keep** to `tests/unit/cli/repository/tags.test.ts` `binary content gets no shebang language or runtime tags`. Real behavior.
- %s overrides the Bash extension tag of a shell script (test (test.each), 42-47): **keep** to `tests/unit/cli/repository/tags.test.ts` `%s overrides the Bash extension tag of a .sh script`. Real behavior.
- \['sh', 'dash'\] (test (test.each), 42-42): **keep** to `tests/unit/cli/repository/tags.test.ts`. Table of the test above; dash and sh take the same INTERPRETER_DIALECTS branch, so 'sh' stays.

## `tests/cli/repository/tracked/boundaries.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/tracked.test.ts`. TPR-054: one test; tracked/ mirrors no source folder
- a non-Git walk omits named pipes from readable source files (test (test.skipIf), 7-13): **keep** to `tests/unit/cli/repository/tracked.test.ts` `a walk without Git leaves out named pipes`. Real behavior.
- !isPosix (test (test.skipIf), 7-7): **keep** to `tests/unit/cli/repository/tracked.test.ts` `isWindows`. Skip condition, with one name for Windows; mkfifo exists only on POSIX.

## `tests/cli/repository/tracked/discovery.test.ts`

- (the file) (file): **split** to `tests/unit/cli/repository/tracked.test.ts; tests/unit/cli/repository/find-root.test.ts`. TPR-054, TPP-028; findRoot and isGitRepository live in repository/find-root.ts (architecture layout)
- repository file discovery (describe (describe), 106-120): **delete**. TPP-028: the bodies go inline, the describe adds nothing
- repository file discovery &gt; keeps tracked deletions out of readable entries (test (test), 107-107): **keep** to `tests/unit/cli/repository/tracked.test.ts` `deleted tracked files are left out of the file list`. Real behavior.
- repository file discovery &gt; classifies a dangling tracked symlink without reading its absent target (test (test), 109-109): **keep** to `tests/unit/cli/repository/tracked.test.ts` `a dangling tracked link is listed without reading its target`. Real behavior.
- repository file discovery &gt; finds the nearest policy in a non-Git directory (test (test), 111-111): **move** to `tests/unit/cli/repository/find-root.test.ts` `findRoot finds the nearest gspot.toml outside Git`. Real behavior; glossary: gspot.toml, not policy.
- repository file discovery &gt; keeps the requested directory when no Git root or policy exists (test (test), 113-113): **move** to `tests/unit/cli/repository/find-root.test.ts` `findRoot keeps the start folder when there is no Git and no gspot.toml`. Real behavior.
- repository file discovery &gt; reports a corrupt Git index instead of switching to a directory walk (test (test), 115-115): **keep** to `tests/unit/cli/repository/tracked.test.ts` `a broken Git index is reported instead of a folder walk`. Real behavior.
- repository file discovery &gt; reports invalid Git metadata instead of treating the directory as non-Git (test (test), 117-117): **keep** to `tests/unit/cli/repository/tracked.test.ts` `invalid Git metadata is reported instead of treating the folder as non-Git`. Real behavior.
- repository file discovery &gt; reports a missing Git executable instead of returning a successful walk (test (test), 119-119): **keep** to `tests/unit/cli/repository/tracked.test.ts` `a missing git program is reported instead of a successful walk`. TPR-020: set PATH to an empty folder in place of mocking spawnSync and runBinary.
- tracked discovery reports a replaced parent of %s (test (test.each), 122-132): **delete**. Fake: it cannot fail, since .rejects runs without await.
- REPLACED_PARENT_PATHS (test (test.each), 122-122): **delete**. Fake: path table of the deleted test without await.
- on Windows, tracked discovery takes the executable bit from the Git index (test (test), 134-156): **keep** to `tests/unit/cli/repository/tracked.test.ts` `on Windows the executable bit comes from the Git index`. Real behavior; TPR-019: usePlatform(win32).
- an unmerged index keeps the working file readable but refuses a staged revision (test (test), 158-178): **keep** to `tests/unit/cli/repository/tracked.test.ts` `an unmerged index keeps the working file readable but refuses a staged revision`. Real behavior.
- a failed index listing cannot report a Windows executable as an ordinary file (test (test), 180-203): **delete**. TPR-012: the Windows switch is never reached; repeats the broken-index test
- 'non-Git discovery in ${JSON.stringify(folder)} applies nested ignores, pruning and link boundaries without sharing them (test (test.skipIf), 207-246): **keep** to `tests/unit/cli/repository/tracked.test.ts` `a walk without Git in ${JSON.stringify(folder)} applies nested .gitignore files, skips ignored folders, and stops at links`. Real behavior.
- !isPosix && folder.includes('\\n') (test (test.skipIf), 207-207): **keep** to `tests/unit/cli/repository/tracked.test.ts` `isWindows && folder.includes('\n')`. Skip condition, with one name for Windows; Windows file names cannot hold a newline.
- trackedDeletions (function, 17-24): **inline** to `tests/unit/cli/repository/tracked.test.ts` `deleted tracked files are left out of the file list`. TPP-028: the body goes into its one test
- danglingLink (function, 26-35): **inline** to `tests/unit/cli/repository/tracked.test.ts` `a dangling tracked link is listed without reading its target`. TPP-028: the body goes into its one test.
- nearestPolicy (function, 37-44): **inline** to `tests/unit/cli/repository/find-root.test.ts` `findRoot finds the nearest gspot.toml outside Git`. TPP-028: the body goes into its one test.
- emptyDirectory (function, 46-51): **inline** to `tests/unit/cli/repository/find-root.test.ts` `findRoot keeps the start folder when there is no Git and no gspot.toml`. TPP-028: the body goes into its one test.
- corruptIndex (function, 53-64): **inline** to `tests/unit/cli/repository/tracked.test.ts` `a broken Git index is reported instead of a folder walk`. TPP-028: the body goes into its one test.
- invalidMetadata (function, 66-75): **inline** to `tests/unit/cli/repository/tracked.test.ts` `invalid Git metadata is reported instead of treating the folder as non-Git`. TPP-028: the body goes into its one test.
- missingGit (function, 77-104): **inline** to `tests/unit/cli/repository/tracked.test.ts` `a missing git program is reported instead of a successful walk`. TPP-028: the body goes into its one test; TPR-020: no spawnSync and runBinary mocks.

## `tests/cli/repository/tracked/indexed-paths.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/tracked.test.ts`. TPR-054: one test; readIndexEntries lives in repository/tracked.ts
- the index keeps deleted tracked paths, encoded names, and excludes untracked files (test (test), 8-18): **keep** to `tests/unit/cli/repository/tracked.test.ts` `the index keeps deleted tracked paths and encoded names and leaves out untracked files`. Real behavior.

## `tests/cli/tools/command.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/run.test.ts`. runTool lives in tools/run.ts, so the test sits at that source file's test path.
- tool execution accepts literal arguments, stdin, and caller environment without policy (test (test), 5-17): **keep** to `tests/unit/cli/tools/run.test.ts` `runTool passes literal arguments, stdin, and the caller environment`. Real behavior; glossary: settings, not policy.
- tool deadlines convert seconds to a native timeout (test (test), 19-25): **delete**. TPR-028: the per-backend timeout tests cover it; it adds only seconds \* 1000

## `tests/cli/tools/credentials.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/diagnostics.test.ts`. tools/diagnostics.ts holds installationDiagnostics and the password redaction, so the test sits at that source file's test path.
- registry password parsing preserves both representations of %s (test (test.each), 7-9): **keep** to `tests/unit/cli/tools/diagnostics.test.ts` `registry passwords are read in both encodings from %s`. Real behavior.
- REGISTRY_PASSWORDS (test (test.each), 7-7): **keep** to `tests/unit/cli/tools/diagnostics.test.ts` `REGISTRY_PASSWORDS`. Moved in from tests/config (TPR-034)
- a generated lockfile containing %s fails with the installation owner error (test (test.each), 11-19): **keep** to `tests/unit/cli/tools/diagnostics.test.ts` `a lockfile that holds %s is refused`. Real behavior; TTC-032: installation owner is jargon.
- \[...LEAKED_LOCKFILES\] (test (test.each), 11-11): **keep** to `tests/unit/cli/tools/diagnostics.test.ts` `LEAKED_LOCKFILES`. TPR-059: pass the array without a spread
- a credential-free lockfile is accepted with configured passwords or no registry authentication (test (test), 21-32): **delete**. Weak: only checks that nothing is thrown.
- installation diagnostics redact $output (test (test.each), 34-36): **keep** to `tests/unit/cli/tools/diagnostics.test.ts` `installation output hides the password in a registry URL`. Real behavior; only the URL-password redaction stays, as one case.
- CREDENTIAL_DIAGNOSTICS (test (test.each), 34-34): **delete**. Only the URL-password redaction stays; the token, password and Authorization patterns go, and the one row left is written in the test.
- installation diagnostics redact known raw, URL-encoded, and base64 credentials before bounding output (test (test), 38-49): **keep** to `tests/unit/cli/tools/diagnostics.test.ts` `installation output hides known passwords in raw, URL-encoded, and base64 form before it is shortened`. Real behavior.
- installation diagnostics redact inherited authentication and distinguish absent output (test (test), 51-59): **delete**. Weak: once the inherited-variable redaction goes, only the empty-output sentence is left, the fallback of a one-line branch, and tiny logic gets no test.

## `tests/cli/tools/inspect/hints.test.ts`

- (the file) (file): **split** to `tests/unit/cli/tools/find/programs.test.ts; tests/unit/cli/commands/doctor/command.test.ts`. Each test goes to the source file it tests (TPR-052, TPR-013): inspectTool and installHint live in tools/find.ts, and the doctor test goes to commands/doctor (TPR-025).
- a missing host XML reader reports $node installation guidance without requesting a managed install (test (test.each), 27-53): **delete**. Weak: the expected hint comes from installerHint, a copy of installHint (TPR-013).
- \[...OPERATING_SYSTEMS\] (test (test.each), 27-27): **delete**. Weak: operating-system table of the deleted hint test.
- doctor and a missing XML check report the host installation prerequisite (test (test), 55-91): **move** to `tests/unit/cli/commands/doctor/command.test.ts` `doctor and gspot check report a missing xmllint with its install command`. TPR-025: it runs doctor and check; TPR-013: literal hint
- installerHint (function, 19-25): **delete**. TPR-013: copies installHint to compute the expected value

## `tests/cli/tools/inspect/installations.test.ts`

- (the file) (file): **split** to `tests/unit/cli/tools/find/programs.test.ts; tests/unit/cli/tools/versions.test.ts; tests/unit/cli/tools/find/libraries.test.ts`. TPR-052 (inspect/ mirrors no source folder), TPP-028; find.ts holds inspectTool and versions.ts the version reading; the library tests have their own file because find.test.ts would pass 300 lines.
- the tool inspection (describe (describe), 139-182): **delete**. TPP-028: the bodies go inline, the describe adds nothing
- the tool inspection &gt; version inspections and tool execution prefer helpers from the selected installation (test (test.skipIf), 140-143): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `version reads and runs use the companion programs of the chosen tool folder`. Real behavior; TPR-018: write the programs with fakeTool.
- the tool inspection &gt; !isPosix (test (test.skipIf), 140-140): **delete**. TPR-018: fakeTool writes a .cmd wrapper, so Windows runs the test
- the tool inspection &gt; an active PATH executable wins over an unrelated mise shim (test (test), 145-145): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `a program on PATH wins over an unrelated mise shim`. Real behavior; TPR-020: set MISE_DATA_DIR in place of mocking miseHome; the PATH-over-shim rule stays for system tools only, so the sample uses a system tool name (INX-006).
- the tool inspection &gt; a managed npm inspection refuses a linked manifest before executing and passes after the fix (test (test), 147-150): **delete**. Duplicate: the package.json read goes through the same sourcePath() guard that 'reads refuse a link chain that leaves the folder and work after the link is fixed' tests (TPR-009), and that an outside program never runs is 'a tool project program linked outside the repository is refused before it runs'.
- the tool inspection &gt; an npm tool is the version its package holds, whatever it prints about itself (test (test), 152-152): **move** to `tests/unit/cli/tools/versions.test.ts` `an npm tool is the version its package holds, whatever it prints`. Real behavior; it covers the linked .bin branch.
- the tool inspection &gt; an independently versioned wrapper runs native %s and reports %s (test (test.each), 154-173): **move** to `tests/unit/cli/tools/versions.test.ts` `a wrapper with its own version runs program %s and reports %s`. Real behavior; glossary retires native.
- the tool inspection &gt; \[ \['0.9.0', 'ok'\], \['0.8.0', 'outdated'\], \] as const (test (test.each), 154-157): **move** to `tests/unit/cli/tools/versions.test.ts`. Table stays
- the tool inspection &gt; a shim that no configuration gives a version is missing, not broken (test (test), 175-175): **move** to `tests/unit/cli/tools/versions.test.ts` `a shim that no configuration gives a version is missing, not broken`. Real behavior.
- the tool inspection &gt; color codes around a version are no part of it (test (test), 177-177): **move** to `tests/unit/cli/tools/versions.test.ts` `color codes around a version are no part of it`. Real behavior.
- the tool inspection &gt; a library is found only in its tool project installation (test (test), 179-179): **move** to `tests/unit/cli/tools/find/libraries.test.ts` `a library is found only in the tool project`. Real behavior.
- the tool inspection &gt; a library that is absent is missing, and one off its pin is reported (test (test), 181-181): **move** to `tests/unit/cli/tools/find/libraries.test.ts` `a library that is absent is missing, and one off its pin is reported`. Real behavior.
- a pending npm install blocks only tools selected from that installation under %s (test (test.each), 184-228): **delete**. gspot installs straight into .gspot/, so there is no installing state and no pending install blocks a tool.
- \['mise', 'npm'\] (test (test.each), 184-184): **delete**. Table of the deleted pending-install test.
- mise resolves native executables in the original repository with status %s (test (test.skipIf), 230-259): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `mise finds the program in the original repository with exit code %s`. Real behavior; TPR-018: fakeTool, no gate; TPR-020: MISE_DATA_DIR in place of the miseHome mock; program tools are found through one mise bin-paths call in .gspot, and the per-shim lookup stays only for system tools, so the sample uses a system tool name, not teller (INX-006).
- \[0, 1\] (test (test.skipIf), 230-230): **keep** to `tests/unit/cli/tools/find/programs.test.ts`. Table stays
- !isPosix (test (test.skipIf), 230-230): **delete**. TPR-018: fakeTool writes a .cmd wrapper, so Windows runs the test
- toolCompanions (function, 19-37): **inline** to `tests/unit/cli/tools/find/programs.test.ts` `version reads and runs use the companion programs of the chosen tool folder`. TPP-028: the body goes into its one test
- activeExecutable (function, 39-53): **inline** to `tests/unit/cli/tools/find/programs.test.ts` `a program on PATH wins over an unrelated mise shim`. TPP-028: the body goes into its one test.
- linkedManifest (function, 55-76): **delete**. Dead: helper of the deleted linked-manifest test.
- packageVersion (function, 78-90): **inline** to `tests/unit/cli/tools/versions.test.ts` `an npm tool is the version its package holds, whatever it prints`. TPP-028: the body goes into its one test.
- missingVersion (function, 92-101): **inline** to `tests/unit/cli/tools/versions.test.ts` `a shim that no configuration gives a version is missing, not broken`. TPP-028: the body goes into its one test.
- versionColors (function, 103-112): **inline** to `tests/unit/cli/tools/versions.test.ts` `color codes around a version are no part of it`. TPP-028: the body goes into its one test.
- installedLibrary (function, 114-124): **inline** to `tests/unit/cli/tools/find/libraries.test.ts` `a library is found only in the tool project`. TPP-028: the body goes into its one test.
- libraryVersion (function, 126-137): **inline** to `tests/unit/cli/tools/find/libraries.test.ts` `a library that is absent is missing, and one off its pin is reported`. TPP-028: the body goes into its one test.

## `tests/cli/tools/inspect/libraries.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/find/libraries.test.ts`. TPR-052; inspectTool (tools/find.ts) finds libraries; find.test.ts would pass 300 lines, so finding libraries keeps its own file
- library inspection reads native package metadata without executing an authored ESLint configuration (test (test), 15-40): **delete**. Weak: the eslint.config.mjs trap guards a state the code cannot reach; a tool project library found in .gspot/node_modules stays covered by 'a library is found only in the tool project'.
- host library inspection uses the selected project and ignores a managed-only provider (test (test), 42-65): **keep** to `tests/unit/cli/tools/find/libraries.test.ts` `a system library is read from the chosen project, not from the tool project`. TPR-064: assert the parse error message and pass selected once; glossary: system, not host or managed
- a host plugin query classifies the $name report as $state (test (test.each), 67-89): **keep** to `tests/unit/cli/tools/find/libraries.test.ts` `a system plugin query classifies the $name report as $state`. Real behavior; TPR-065: drop the empty note; TPR-051: rename \_version to versionRun.
- \[...HOST_PLUGIN_REPORTS\] (test (test.each), 67-67): **keep** to `tests/unit/cli/tools/find/libraries.test.ts` `SYSTEM_PLUGIN_REPORTS`. Glossary: system tool, not host; TPR-059: no spread
- an empty host library query is an error without executing a guessed program (test (test), 91-101): **delete**. Weak: version_command passes commandSchema, which needs at least one item, so an empty command cannot reach inspectLibraryCommand; the test builds the impossible tool by hand.

## `tests/cli/tools/inspect/placement.test.ts`

- (the file) (file): **split** to `tests/unit/cli/tools/find/programs.test.ts; tests/unit/cli/tools/find/libraries.test.ts`. TPR-052 (placement says nothing); inspectTool lives in tools/find.ts
- managed executable discovery refuses an external link before inspecting and accepts an internal replacement (test (test), 13-32): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `a tool project program linked outside the repository is refused before it runs`. Real behavior; TPR-009 keeps it (an outside program never runs).
- managed library discovery refuses a package directory linked outside the repository (test (test), 34-45): **delete**. Duplicate of the library link test 'a library linked inside the tool project is accepted and one linked outside is refused' (TPR-009).
- a missing npm tool executable cannot fall back to the developer executable (test (test), 47-73): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `a missing npm tool does not fall back to the program in the repository node_modules`. Real behavior.
- direct host lookup excludes an unrelated managed compiler (test (test), 75-88): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `a system tsc is found in node_modules and the tool project tsc is ignored`. Real behavior; glossary retires host and managed.
- a Python tool pin refuses a project executable and uses its own environment (test (test), 90-109): **keep** to `tests/unit/cli/tools/find/programs.test.ts` `a Python tool uses the tool project environment, not the repository .venv`. Real behavior.
- a snapshot finds a missing native tool missing, through the private tools it links from the working tree (test (test), 111-122): **delete**. TPR-045: weak, a tool that exists nowhere is missing
- library inspection accepts an internal package-directory link and refuses an external target (test (test), 124-141): **move** to `tests/unit/cli/tools/find/libraries.test.ts` `a library linked inside the tool project is accepted and one linked outside is refused`. Real behavior.

## `tests/cli/tools/inspect/versions.test.ts`

- (the file) (file): **split** to `tests/unit/cli/tools/versions.test.ts; tests/unit/cli/tools/find/libraries.test.ts`. TPR-052; version output parsing lives in tools/versions.ts (architecture layout, PAR-011)
- a version process classifies %s as %s (test (test.each), 16-24): **keep** to `tests/unit/cli/tools/versions.test.ts` `version output %s gives the state %s`. Real behavior.
- VERSION_PROCESS_CASES (test (test.each), 16-16): **keep** to `tests/unit/cli/tools/versions.test.ts` `VERSION_OUTPUTS`. Moved in from tests/config; glossary retires "cases"
- an npm package version does not hide a failed executable (test (test), 26-38): **keep** to `tests/unit/cli/tools/versions.test.ts` `an npm package version does not hide a failed program`. Real behavior.
- a manifest can declare its help command status without accepting other failed inspections (test (test), 40-55): **keep** to `tests/unit/cli/tools/versions.test.ts` `a manifest can declare the exit code of its version command without accepting other failures`. Real behavior.
- tool reads distinguish pins and refresh private libraries in the next session (test (test), 57-73): **move** to `tests/unit/cli/tools/find/libraries.test.ts` `library reads are kept per session and see a new install in the next session`. Real behavior; glossary retires private.
- a command shares version reads and the next session inspections again (test (test), 75-91): **keep** to `tests/unit/cli/tools/versions.test.ts` `a command reads each version once and the next session reads it again`. Real behavior.
- a host bash that prints %s is %s against the 4.4 floor (test (test.each), 93-110): **keep** to `tests/unit/cli/tools/versions.test.ts` `a system bash that prints %s is %s against the 4.4 floor`. Real behavior; glossary: system, not host.
- \[ \['3.2.57', 'outdated'\], \['5.2.0', 'host'\], \] as const (test (test.each), 93-96): **keep** to `tests/unit/cli/tools/versions.test.ts`. Table of the test above; the expected state host becomes system (glossary: system tool).
- an npm tool behind a shim file takes the version of its package (test (test), 112-127): **keep** to `tests/unit/cli/tools/versions.test.ts` `an npm tool behind a shim file takes the version of its package`. Real behavior.
- the shipped %s pin inspects versions below and at its floor (test (test.each), 137-152): **keep** to `tests/unit/cli/tools/versions.test.ts` `the %s pin is outdated below its floor and accepted at it`. Real behavior.
- \['gitleaks', 'next'\] (test (test.each), 137-137): **keep** to `tests/unit/cli/tools/versions.test.ts`. Table stays
- a private library rejects non-string $field metadata and accepts corrected bytes (test (test.each), 154-168): **move** to `tests/unit/cli/tools/find/libraries.test.ts` `a tool project library with a non-string $field is refused until it is fixed`. Real behavior.
- \[...PACKAGE_METADATA_FAILURES\] (test (test.each), 154-154): **move** to `tests/unit/cli/tools/find/libraries.test.ts` `PACKAGE_METADATA_FAILURES`. TPR-059: no spread
- belowFloor (function, 130-135): **move** to `tests/unit/cli/tools/versions.test.ts` `belowFloor`. One user, stays beside it

## `tests/cli/tools/mise-pins.test.ts`

- (the file) (file): **delete**. Duplicate-pin detection (duplicateMisePins) goes with its tests (INX-007).
- duplicate pins name the actual generated file for $runner (test (test.each), 9-21): **delete**. Tests duplicateMisePins, which goes (INX-007).
- DUPLICATE_CASES (test (test.each), 9-9): **delete**. Table of the deleted test (INX-007).
- duplicate pins exclude unconsumed tools and accept mise backend prefixes (test (test), 23-33): **delete**. Tests duplicateMisePins, which goes (INX-007).
- a missing mise file has no duplicate pins and malformed authored TOML fails visibly (test (test), 35-43): **delete**. Tests duplicateMisePins and parseMiseToolKeys, which go (INX-007).
- duplicate pins read a linked authored mise document inside the repository and refuse external links (test (test), 45-58): **delete**. TPR-009: repeats the link guards of system/file-reads

## `tests/cli/tools/npm/client.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/npm/project/client.test.ts`. Choosing the npm client lives in tools/npm/project.ts (TPR-070); the npm tests pass 300 lines in one file, so the client choice has its own file.
- without a declaration or Bun on the path, the tool project uses npm at the version it reports (test (test), 11-20): **keep** to `tests/unit/cli/tools/npm/project/client.test.ts` `without a declaration or Bun on PATH, the tool project uses npm at the version it prints`. Real behavior.
- %s names the package manager and its version (test (test.each), 22-27): **keep** to `tests/unit/cli/tools/npm/project/client.test.ts` `%s names the npm client and its version`. Real behavior; glossary: NpmClient in code.
- PACKAGE_SELECTIONS (test (test.each), 22-22): **keep** to `tests/unit/cli/tools/npm/project/client.test.ts` `NPM_CLIENT_DECLARATIONS`. Moved in from tests/config; glossary: NpmClient
- a non-exact authored manager %s is refused with the version to write (test (test.each), 29-38): **keep** to `tests/unit/cli/tools/npm/project/client.test.ts` `a pnpm version that is not exact is refused with the version to write: %s`. Real behavior.
- NON_EXACT_MANAGERS (test (test.each), 29-29): **keep** to `tests/unit/cli/tools/npm/project/client.test.ts` `NON_EXACT_PNPM_VERSIONS`. Manager is a banned code word (glossary)
- manager selection reads linked authored declarations inside the repository and refuses external ones (test (test), 40-52): **delete**. TPR-009: repeats the link guards of system/file-reads

## `tests/cli/tools/npm/install.test.ts`

- (the file) (file): **split** to `tests/unit/cli/tools/npm/project/install.test.ts; tests/unit/cli/tools/npm/project/client.test.ts`. LIF-030 (tools/npm/project.ts); LIF-025
- a refused GitHub download names the token to set: %s (test (test.each), 26-28): **delete**. LIF-025: githubRefusalNote goes
- GITHUB_DOWNLOAD_FAILURES (test (test.each), 26-26): **delete**. Table of the deleted test above (LIF-025).
- output without a refused GitHub download adds no token note: %s (test (test.each), 30-32): **delete**. LIF-025: githubRefusalNote goes
- OTHER_DOWNLOAD_OUTPUT (test (test.each), 30-30): **delete**. Table of the deleted test above (LIF-025).
- Yarn $installer.version selects compatible generated settings and native lockfile creation (test (test.each), 34-40): **delete**. Weak: it compares packageInstallerCommands with copies of the YARN_ARGUMENTS constant; the Yarn 1 and Yarn 4 split stays covered by the npm generation test.
- YARN_MANAGERS (test (test.each), 34-34): **delete**. Weak: table of the deleted Yarn command test.
- $source version metadata cannot bypass the native $operation executable check (test (test.each), 42-86): **move** to `tests/unit/cli/tools/npm/project/client.test.ts` `$source version data cannot skip the program version check before $operation`. Real behavior; glossary retires native.
- PACKAGE_VERSION_CASES (test (test.each), 42-42): **move** to `tests/unit/cli/tools/npm/project/client.test.ts` `VERSION_SOURCES`. Moved in from tests/config; glossary retires "cases"
- a package failure preserves files and redacts $refusal with frozen=$frozen (test (test.each), 88-137): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts` `a failed package install keeps the files and hides credentials, frozen=$frozen`. TPR-039: two rows; LIF-025: drop the GITHUB_TOKEN assertion
- PACKAGE_FAILURES (test (test.each), 88-88): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts` `PACKAGE_FAILURES`. TPR-039: two rows
- a successful native %s operation refuses credentials in its prepared lockfile (test (test.each), 139-176): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts` `a successful package run with frozen=%s refuses credentials in its new lockfile`. Real behavior.
- \[false, true\] (test (test.each), 139-139): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts`. Table stays
- missing Node refuses npm lockfile resolution before scratch creation and preserves a cached lockfile (test (test), 178-225): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts` `a missing Node stops npm before it writes a lockfile and keeps a cached lockfile`. Real behavior; TPR-020: drop the mkdtempSync spy and set MISE_DATA_DIR in place of mocking miseHome; the refreshLockfiles option goes with the --refresh-lockfiles flag (DT3-007), so drop it from the call.

## `tests/cli/tools/npm/registry.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/tools/npm/project/install.test.ts`. TPR-071: one test of the same source file
- invalid native settings retain their validation diagnostic for $source (test (test.each), 8-19): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts` `invalid .npmrc settings keep their error for $source`. Real behavior; glossary retires native.
- \[ { source: 'registry=not-a-valid-url\\n', message: 'Invalid registry URL in package manager configuration.' }, { (test (test.each), 8-11): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts`. Table stays

## `tests/cli/tools/python/lockfiles.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/tools/python/project/lockfiles.test.ts`. pythonLockfileMatches lives in tools/python/project.ts (LIF layout)
- private Python lockfile comparison normalizes distribution names and ignores requirement order (test (test), 10-16): **keep** to `tests/unit/cli/tools/python/project/lockfiles.test.ts` `the uv lockfile check ignores name spelling and requirement order`. Real behavior; glossary retires private.
- a changed %s makes a private Python lockfile drift (test (test.each), 18-20): **keep** to `tests/unit/cli/tools/python/project/lockfiles.test.ts` `a changed %s makes the uv lockfile stale`. Real behavior; glossary: stale, not drift.
- UV_LOCKFILE_MISMATCHES (test (test.each), 18-18): **keep** to `tests/unit/cli/tools/python/project/lockfiles.test.ts` `UV_LOCKFILE_MISMATCHES`. A one-user sample, so it moves into its test (THR-031).

## `tests/cli/tools/python/project.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/python/project/lockfiles.test.ts`. LIF-030 (tools/python/project.ts)
- a pypi constraint reaches the tool project, and only a lockfile resolved under it is current (test (test), 51-60): **keep** to `tests/unit/cli/tools/python/project/lockfiles.test.ts` `a pypi constraint reaches the tool project, and only a lockfile made under it is current`. Real behavior.
- a $state Python lockfile plans resolution when needed (test (test.each), 62-79): **delete**. Tests toolInstallationPlan, which goes (CLX-004): installNpmTools and installPythonTools run their commands directly.
- PYTHON_LOCKFILE_PLANS (test (test.each), 62-62): **delete**. Table of the deleted test above.
- a proposed Python project overrides invalid recorded bytes without writing them (test (test), 81-99): **delete**. Calls toolInstallationPlan, which goes (CLX-004).
- a repository without a Python tool project plans no installation or installation (test (test), 101-111): **delete**. Calls toolInstallationPlan, which goes (CLX-004).
- a %s bundled uv pin cannot bootstrap Python tools (test (test.each), 113-125): **delete**. TPR-005: self-policing, breaks the cached shipped manifest to reach a guard
- \['missing', 'unversioned'\] (test (test.each), 113-113): **delete**. TPR-005
- constrainedManifest (function, 23-28): **move** to `tests/unit/cli/tools/python/project/lockfiles.test.ts` `constrainedManifest`. One user, a function, not data, so it stays beside its test.
- lockfileFor (function, 31-49): **move** to `tests/unit/cli/tools/python/project/lockfiles.test.ts` `lockfileFor`. One user, so it stays beside its test; the Python tool project is named tools (INX-010). Values to config: REQUIRES_PYTHON = '&gt;=3.11' -&gt; tests/config/python/tool-project.ts; TOOL_PROJECT_NAME = 'tools' -&gt; tests/config/python/tool-project.ts

## `tests/cli/tools/python/registry.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/python/settings.test.ts`. Index settings, not registry (TPR-069); parsePythonSettings lives in tools/python/settings.ts.
- uv.toml takes precedence and local index paths follow the authored repository (test (test), 6-17): **keep** to `tests/unit/cli/tools/python/settings.test.ts` `uv.toml wins and local index paths are read relative to the repository`. Real behavior.
- project index settings are used only when uv.toml is absent (test (test), 19-36): **keep** to `tests/unit/cli/tools/python/settings.test.ts` `project index settings are used only when uv.toml is absent`. Real behavior.

## `tests/cli/tools/python/uv.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/python/project/uv.test.ts`. Running uv lives in tools/python/project.ts (LIF-030, LIF-052); with the lockfile tests one file would pass 300 lines, so running uv has its own file; installUv and its two tests go (INX-006).
- one command acquires its pinned uv once and creates lockfiles through that executable (test (test), 19-63): **delete**. installUv, the mise which lookup and the runner check behind pythonInstaller go; uv is installed by the one mise install step and found through mise bin-paths (INX-006).
- failed mise installation names the pinned uv repair and preserves repository files (test (test), 65-92): **delete**. Tests installUv, which goes (INX-006).
- failed uv %s is repairable and preserves authored inputs with redacted output (test (test.each), 94-129): **keep** to `tests/unit/cli/tools/python/project/uv.test.ts` `a failed uv %s can be repaired and hides index passwords`. Real behavior.
- \['venv', 'sync'\] (test (test.each), 94-94): **keep** to `tests/unit/cli/tools/python/project/uv.test.ts`. Table stays
- a successful uv operation refuses a password in its temporary lockfile and preserves managed inputs (test (test), 131-152): **keep** to `tests/unit/cli/tools/python/project/uv.test.ts` `a successful uv run refuses a password in its new lockfile and keeps the tool project files`. Real behavior.
- localPythonInstallation (function, 154-168): **move** to `tests/unit/cli/tools/python/project/uv.test.ts` `runPythonInstall`. Two users; LIF-001/LIF-055: the installTree callback goes, only read stays

## `tests/cli/tools/vale.test.ts`

- (the file) (file): **move** to `tests/unit/cli/install/vale.test.ts`. TPR-008 (do after LIF-009): it tests install/vale.ts
- Vale package installation preserves styles after %s and succeeds after the fix (test (test.each), 26-71): **keep** to `tests/unit/cli/install/vale.test.ts` `a failed Vale package install reports %s, and the next install succeeds after the fix`. vale sync writes straight into .gspot/, so the kept-styles and work-folder assertions go and the setup writes .gspot/vale directly; TPR-040: drop the timeout column; LIF-018: failures are thrown, not returned.
- VALE_ACQUISITION_FAILURES (test (test.each), 26-26): **keep** to `tests/unit/cli/install/vale.test.ts` `VALE_INSTALL_FAILURES`. Glossary retires acquisition
- Vale package detection rejects a linked %s (test (test.each), 99-103): **delete**. LIF-017, TPR-009: the link refusals are the safe-folder guards, tested in system/safe-folder
- VALE_DETECTION_LINKS (test (test.each), 99-99): **delete**. Table of the deleted test above (LIF-017).
- Vale package removal refuses a linked %s without deleting outside styles (test (test.each), 105-119): **delete**. LIF-016, LIF-017: the Vale link checks and the read before delete go
- VALE_REMOVAL_LINKS (test (test.each), 105-105): **delete**. Table of the deleted test above (LIF-016, LIF-017).
- package readiness requires the generated config at %s (test (test.each), 121-130): **keep** to `tests/unit/cli/install/vale.test.ts` `Vale packages are ready at %s only with the generated vale.ini and the installed folders`. Real behavior; the level changes the result.
- \['recommended', 'all'\] as const (test (test.each), 121-121): **keep** to `tests/unit/cli/install/vale.test.ts`. Level table; LEVELS is imported from packages/cli/src/config/configurations.ts, not written again in the test.
- all requires the shipped %s folder regardless of an edited Packages option (test (test.each), 132-143): **keep** to `tests/unit/cli/install/vale.test.ts` `level all needs the shipped %s folder whatever the Packages line says`. Real behavior.
- VALE_PACKAGE_FOLDERS (test (test.each), 132-132): **keep** to `tests/unit/cli/install/vale.test.ts` `VALE_PACKAGE_FOLDERS`. Table of the test above; VALE_PACKAGE_FOLDERS is a shipped constant in packages/cli/src/config/, and the test imports it from there.
- recommended installation checks config presence=%s without native sync (test (test.each), 145-174): **keep** to `tests/unit/cli/install/vale.test.ts` `at level recommended install installs no Vale packages`. LIF-018: the level is checked first, so vale.ini presence does not matter; one case.
- \[false, true\] (test (test.each), 145-145): **delete**. LIF-018: the config-presence switch does not change the result.
- linkedStyles (function, 74-97): **delete**. LIF-016, LIF-017: its two link tests go

## `tests/config/cli/planning/dependencies.ts`

- (the file) (file): **move** to `tests/config/planning.ts`. One user; test data that is not a single short literal lives in a tests/config topic file.
- DEPENDENCY_CASES (const exported, 1-42): **move** to `tests/config/planning.ts` `NEXT_INTL_PROJECTS`. One user; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/planning/format-inputs.ts`

- (the file) (file): **move** to `tests/config/formatting.ts`. Its test splits by source file; the ignore_file data goes (TML-004), so only the formatting values are left, and they join the formatting topic file.
- EDITORCONFIG_INPUTS (const exported, 2-10): **move** to `tests/config/formatting.ts` `EDITORCONFIG_FILES`. One user; glossary retires inputs; test data that is not a single short literal lives in a tests/config topic file.
- FORMAT_POLICY (const exported, 12-12): **move** to `tests/config/formatting.ts` `FORMAT_SETTINGS`. One user; glossary: settings, not policy; test data that is not a single short literal lives in a tests/config topic file; the sample has no runner = "mise" (INX-003) and uses \[rules\] (TML-003).
- PRETTIER_PATH_IGNORE (const exported, 14-15): **move** to `tests/config/formatting.ts` `PRETTIER_PATH_IGNORE`. One user; test data that is not a single short literal lives in a tests/config topic file.
- AUTHORED_IGNORE_CHECK (const exported, 17-29): **delete**. Dead: used only by the deleted ignore_file test (TML-004).

## `tests/config/cli/planning/lockfiles.ts`

- (the file) (file): **move** to `tests/config/planning.ts`. One user; test data that is not a single short literal lives in a tests/config topic file.
- LOCKFILE_TRIGGER_NAMES (const exported, 2-11): **move** to `tests/config/planning.ts` `LOCKFILE_TRIGGER_NAMES`. One user; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/planning/replacements.ts`

- (the file) (file): **move** to `tests/config/planning.ts`. One user; test data that is not a single short literal lives in a tests/config topic file.
- REPLACEMENTS (const exported, 1-4): **move** to `tests/config/planning.ts` `TSC_REPLACEMENTS`. Two rows of four fields are not a single short literal, so they live in a tests/config topic file.

## `tests/config/cli/planning/requirements.ts`

- (the file) (file): **move** to `tests/config/planning.ts`. Test data that is not a single short literal lives in a tests/config topic file.
- PYTHON_PROJECT (const, 3-6): **move** to `tests/config/planning.ts` `PYTHON_APP_FILES`. Used by two rows of NODE_REQUIREMENTS; test data that is not a single short literal lives in a tests/config topic file; PYTHON_PROJECT would read as the Python tool project.
- NODE_REQUIREMENTS (const exported, 9-48): **move** to `tests/config/planning.ts` `NODE_REQUIREMENTS`. One user; test data that is not a single short literal lives in a tests/config topic file; every runner table goes (INX-003), so the "npm EditorConfig wrapper" row matches the first row and goes, and the native-tools row reads NPM_CHECK_IGNORES (the two \[\[ignore\]\] records) from tests/config/settings/file.ts.
- ROLE_REQUIREMENTS (const exported, 51-77): **move** to `tests/config/planning.ts` `ARCHITECTURE_REQUIREMENTS`. One user; the rows hold modules and roles; test data that is not a single short literal lives in a tests/config topic file; the runtime role rows go (the role is deleted, TML-001) and so does the scope module row (record lists live at the root, CFR-004), leaving a root \[\[architecture.module\]\] row at both levels and a row without modules at level all only.

## `tests/config/cli/planning/selection.ts`

- (the file) (file): **split** to `tests/config/docs.ts; tests/config/nextjs.ts; tests/config/init.ts; tests/config/planning.ts`. Its test splits by source file (TPR-053, TPR-029), so each value joins its topic file in tests/config/.
- POLICY_PATHS (const exported, 1-1): **inline** to `tests/unit/cli/planning/files.test.ts` `a change to %s re-runs docs/lychee in every scope and keeps its path ignores`. A two-item one-line list is a single short literal, so it is written in the test.each call; glossary: settings, not policy.
- LINK_POLICY (const exported, 3-10): **move** to `tests/config/docs.ts` `DOCS_SETTINGS`. One user; glossary: settings, not policy; test data that is not a single short literal lives in a tests/config topic file; scopes are \[\[scope\]\] records (CFR-003).
- NEXT_BUILD_FILES (const exported, 13-19): **move** to `tests/config/nextjs.ts` `NEXT_BUILD_FILES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- NEXT_BUILD_TABLES (const exported, 21-23): **move** to `tests/config/nextjs.ts` `NEXT_BUILD_TABLES`. One user; test data that is not a single short literal lives in a tests/config topic file; scopes are \[\[scope\]\] records (CFR-003).
- NEXT_BUILD_ROUTES (const exported, 26-26): **move** to `tests/config/nextjs.ts` `NEXT_BUILD_ROUTES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- MANUAL_SELECTIONS (const exported, 29-33): **move** to `tests/config/init.ts` `CONFIGURATION_CHOICES`. Moves with the init test (TPR-029); test data that is not a single short literal lives in a tests/config topic file.
- HOOK_STAGES (const exported, 35-38): **delete**. Dead: used only by the deleted stage-filter test.
- HOOK_STAGE_CHECKS (const exported, 40-52): **delete**. TPR-004: self-policing list of shipped check names
- HOOK_STAGE_FILES (const exported, 54-60): **delete**. The hand-written manifest replaces the shipped configurations and their files.
- COVERAGE_PLUGIN_CASES (const exported, 62-83): **move** to `tests/config/planning.ts` `COVERAGE_LIMITS`. TPR-011: four rows; glossary retires "cases" and uses limit, not floor; test data that is not a single short literal lives in a tests/config topic file.
- HISTORY_TABLES (const exported, 86-86): **move** to `tests/config/planning.ts` `HISTORY_TABLES`. One user; test data that is not a single short literal lives in a tests/config topic file; scopes are \[\[scope\]\] records (CFR-003).
- HISTORY_MANIFEST (const exported, 89-115): **move** to `tests/config/planning.ts` `HISTORY_MANIFEST`. One user; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/platform/assets.ts`

- (the file) (file): **move** to `tests/config/system.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file.
- ASSETS_CONFIGURATION (const exported, 1-1): **move** to `tests/config/system.ts` `BASH_MANIFEST`. One user; the name says what it holds; test data that is not a single short literal lives in a tests/config topic file.
- CHECKOUT (const exported, 3-3): **move** to `tests/config/system.ts` `PACKAGE_FOLDER`. One user; glossary retires checkout and workspace; test data that is not a single short literal lives in a tests/config topic file, beside the files of the same folder.
- ASSET_READER_SCRIPT (const exported, 5-12): **move** to `tests/config/system.ts` `ASSET_READER_SCRIPT`. Short after INS-021, and tests/setup holds only code that two or more test files use; test data that is not a single short literal lives in a tests/config topic file; RUNTIME_WASM goes (SCR-006), so the reader script lists the grammar files only.

## `tests/config/cli/platform/environment.ts`

- (the file) (file): **move** to `tests/config/system.ts`. TPR-034, TPR-062; test data that is not a single short literal lives in a tests/config topic file.
- MISE_DIRECTORY_CASES (const exported, 1-33): **move** to `tests/config/system.ts` `MISE_FOLDERS`. TPR-062: four rows; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/platform/git.ts`

- (the file) (file): **move** to `tests/config/git.ts`. TPR-032; test data that is not a single short literal lives in a tests/config topic file; tests/config/git.ts is the Git topic file.
- GIT_HOOK_SCRIPT (const exported, 2-48): **move** to `tests/config/git.ts` `GIT_HOOK_SCRIPT`. The hook program has one user (TPR-032), and test data that is not a single short literal lives in a tests/config topic file.
- GIT_HOOK_EXPECTED (const exported, 51-79): **move** to `tests/config/git.ts` `GIT_HOOK_REPORT`. The expected report of the hook, 28 lines, is not a single short literal, so it lives in a tests/config topic file under a name that says it is the report the hook writes.

## `tests/config/cli/platform/managed-blocks.ts`

- (the file) (file): **move** to `tests/config/system.ts`. TEL-028 deletes the lifecycle user, so one user is left; test data that is not a single short literal lives in a tests/config topic file.
- BLOCK_FORMATS (const exported, 2-10): **move** to `tests/config/system.ts` `BLOCK_FORMATS`. One user; test data that is not a single short literal lives in a tests/config topic file.
- MALFORMED_BLOCKS (const exported, 12-43): **move** to `tests/config/system.ts` `MALFORMED_BLOCKS`. TEL-028 deletes the second user; five rows; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/platform/root.ts`

- (the file) (file): **move** to `tests/config/system.ts`. Its test splits by safe-folder file; every kept item joins the system topic file.
- ROOT_REPLACEMENTS (const exported, 1-4): **move** to `tests/config/system.ts` `MODE_REPLACEMENTS`. One user; glossary: root means the repository root; test data that is not a single short literal lives in a tests/config topic file.
- UNSAFE_DESTINATIONS (const exported, 6-10): **move** to `tests/config/system.ts` `OUTSIDE_LINKS`. One user; glossary retires destination for these paths; test data that is not a single short literal lives in a tests/config topic file.
- NATIVE_PATH_REFUSALS (const exported, 12-12): **inline** to `tests/unit/cli/system/safe-folder/names.test.ts` `system paths refuse the escape %j`. A four-item one-line list is a single short literal, so it is written in the test.each call; glossary: PathFormat native becomes system.
- LINK_TARGET_REFUSALS (const exported, 14-27): **move** to `tests/config/system.ts` `LINK_TARGET_REFUSALS`. One user; test data that is not a single short literal lives in a tests/config topic file.
- POSIX_CANONICAL_ROOT (const exported, 30-30): **delete**. TPR-002: the macOS Bun-bug tests go
- POSIX_CANONICAL_SOURCE (const exported, 31-31): **delete**. The macOS Bun-bug tests go (TPR-002).

## `tests/config/cli/platform/writes.ts`

- (the file) (file): **delete**. writeAll and the batched flush path go (LIF-004), so its test goes.
- FLUSH_FAILURES (const exported, 2-5): **delete**. Used only by the deleted batch publication test (LIF-004).

## `tests/config/cli/repository/aliases.ts`

- (the file) (file): **move** to `tests/config/repository.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file.
- ALIAS_INPUTS (const exported, 2-13): **move** to `tests/config/repository.ts` `ALIAS_FILES`. One user; glossary retires inputs; test data that is not a single short literal lives in a tests/config topic file; the valid field goes with the deleted link test.
- ALIAS_PROJECT (const exported, 16-21): **move** to `tests/config/repository.ts` `ALIAS_PROJECT`. One user after TPR-026; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/repository/generated.ts`

- (the file) (file): **move** to `tests/config/repository.ts`. REFERENCE_FILES is shared by the repository tests after the split, and test data that is not a single short literal lives in a tests/config topic file, so the data joins tests/config/repository.ts and needs no one-item declaration-files.ts.
- REFERENCE_FILES (const exported, 1-8): **move** to `tests/config/repository.ts` `DECLARATION_FILES`. Shared by four test files, all repository topics, so it lives in tests/config/repository.ts under a name that says what it holds.
- GENERATED_SELECTIONS (const exported, 10-28): **move** to `tests/config/repository.ts` `GENERATED_SELECTIONS`. One user; test data that is not a single short literal lives in a tests/config topic file; scopes are \[\[scope\]\] records (CFR-003).

## `tests/config/cli/repository/kinds.ts`

- (the file) (file): **move** to `tests/config/repository.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file.
- GENERATED_HEADER_PATHS (const exported, 2-2): **inline** to `tests/unit/cli/repository/kind.test.ts` `every generated header format marks a file generated outside .gspot`. A one-line list of six file names is a single short literal, so it becomes a local value of its one test.
- ATTRIBUTE_PRECEDENCE_FILES (const exported, 4-32): **move** to `tests/config/repository.ts` `ATTRIBUTE_FILES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- ATTRIBUTE_PRECEDENCE_KINDS (const exported, 34-50): **move** to `tests/config/repository.ts` `ATTRIBUTE_KINDS`. TPR-034: the expected kinds of a 16-line table, not a single short literal, so they live in a tests/config topic file.
- ATTRIBUTE_CLEARED_KINDS (const exported, 52-68): **move** to `tests/config/repository.ts` `CLEARED_ATTRIBUTE_KINDS`. TPR-034: the expected kinds of a 16-line table, not a single short literal, so they live in a tests/config topic file.

## `tests/config/cli/repository/package-manifests.ts`

- (the file) (file): **split** to `tests/config/repository.ts; tests/config/npm.ts`. TPR-025 and TPR-031 split its test; test data that is not a single short literal lives in a tests/config topic file, so the values go to the repository and npm topic files.
- AUTHORED_PACKAGE_FIELDS (const exported, 1-6): **move** to `tests/config/repository.ts` `PACKAGE_FIELDS`. One user; glossary retires authored; test data that is not a single short literal lives in a tests/config topic file.
- PROJECT_DEPENDENCY_FILES (const exported, 9-15): **move** to `tests/config/repository.ts` `PROJECT_DEPENDENCY_FILES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- PROJECT_DEPENDENCY_SCOPES (const exported, 17-25): **move** to `tests/config/repository.ts` `PROJECT_DEPENDENCY_SCOPES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- INVALID_PYTHON_DEPENDENCY_CASES (const exported, 28-36): **move** to `tests/config/repository.ts` `INVALID_PYTHON_DEPENDENCIES`. One user; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.
- INVALID_MANIFESTS (const exported, 39-45): **move** to `tests/config/repository.ts` `INVALID_DEPENDENCY_FILES`. One user; glossary: manifest means manifest.toml only; test data that is not a single short literal lives in a tests/config topic file.
- SESSION_PACKAGE_FILES (const exported, 48-53): **move** to `tests/config/npm.ts` `REACT_AND_VUE_PACKAGES`. Four test files use it after TPR-025 and TPR-031 (repository/dependency-files, rules, generation/tool-files, execution/fixes).
- SESSION_PACKAGE_REPLACEMENT (const exported, 55-55): **move** to `tests/config/npm.ts` `ROOT_PACKAGE_WITHOUT_DEPENDENCIES`. Two test users (repository/dependency-files, execution/fixes)
- SESSION_PACKAGE_FIX (const exported, 57-57): **move** to `tests/config/npm.ts` `CLEAR_DEPENDENCIES_SCRIPT`. One user, the fix passes test (TPR-025); built only from ROOT_PACKAGE_WITHOUT_DEPENDENCIES, so it is a config value beside it.

## `tests/config/cli/repository/scopes.ts`

- (the file) (file): **move** to `tests/config/repository.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file.
- INVALID_WORKSPACE_CASES (const exported, 2-9): **move** to `tests/config/repository.ts` `INVALID_WORKSPACE_FILES`. One user; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.
- SCOPE_PATH_CASES (const exported, 12-19): **move** to `tests/config/repository.ts` `SCOPE_PATHS`. One user; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/repository/tags.ts`

- (the file) (file): **move** to `tests/config/repository.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file.
- SHEBANG_CASES (const exported, 2-25): **move** to `tests/config/repository.ts` `SHEBANGS`. One user; glossary retires "cases"; five rows; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/repository/tracked.ts`

- (the file) (file): **delete**. Fake: the file holds only REPLACED_PARENT_PATHS, whose one test is deleted.
- REPLACED_PARENT_PATHS (const exported, 1-1): **delete**. Fake: used only by the deleted test without await.

## `tests/config/cli/tools/credentials.ts`

- (the file) (file): **move** to `tests/config/tools.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file.
- REGISTRY_PASSWORDS (const exported, 1-6): **move** to `tests/config/tools.ts` `REGISTRY_PASSWORDS`. One user; test data that is not a single short literal lives in a tests/config topic file.
- LEAKED_LOCKFILES (const exported, 8-11): **move** to `tests/config/tools.ts` `LEAKED_LOCKFILES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- CREDENTIAL_DIAGNOSTICS (const exported, 14-23): **inline** to `tests/unit/cli/tools/diagnostics.test.ts` `installation output hides the password in a registry URL`. One { output, expected } row is left, a single short literal, so it is written in the test.

## `tests/config/cli/tools/inspect.ts`

- (the file) (file): **move** to `tests/config/tools.ts`. Its two users split, and each constant has one user; test data that is not a single short literal lives in a tests/config topic file.
- PACKAGE_METADATA_FAILURES (const exported, 2-5): **move** to `tests/config/tools.ts` `PACKAGE_METADATA_FAILURES`. One user; test data that is not a single short literal lives in a tests/config topic file.
- HOST_PLUGIN_REPORTS (const exported, 7-35): **move** to `tests/config/tools.ts` `SYSTEM_PLUGIN_REPORTS`. One user; glossary: system tool, not host; test data that is not a single short literal lives in a tests/config topic file.
- VERSION_PROCESS_CASES (const exported, 38-52): **move** to `tests/config/tools.ts` `VERSION_OUTPUTS`. One user; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/tools/mise-pins.ts`

- (the file) (file): **delete**. Every item of the file served the deleted duplicate-pin tests (INX-007).
- DECLARED_TOOLS (const exported, 4-24): **delete**. Dead: used only by the deleted duplicate-pin tests (INX-007).
- DUPLICATE_CASES (const exported, 26-35): **delete**. Dead: used only by the deleted duplicate-pin tests, and its rows are runner values (INX-007, INX-003).
- MISE_DECLARATIONS (const exported, 37-38): **delete**. Dead: used only by the deleted duplicate-pin tests (INX-007).

## `tests/config/cli/tools/npm/client.ts`

- (the file) (file): **move** to `tests/config/npm.ts`. TPR-034, TPR-070; test data that is not a single short literal lives in a tests/config topic file.
- PACKAGE_SELECTIONS (const exported, 1-34): **move** to `tests/config/npm.ts` `NPM_CLIENT_DECLARATIONS`. One user; glossary: NpmClient; test data that is not a single short literal lives in a tests/config topic file.
- NON_EXACT_MANAGERS (const exported, 36-40): **move** to `tests/config/npm.ts` `NON_EXACT_PNPM_VERSIONS`. One user; manager is a banned code word; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/tools/npm/install.ts`

- (the file) (file): **move** to `tests/config/npm.ts`. TPR-034; its test splits and LIF-025 deletes the GitHub data; test data that is not a single short literal lives in a tests/config topic file.
- AUTHORED_VERSION_INPUTS (const, 1-3): **move** to `tests/config/npm.ts` `DECLARED_VERSION_FILES`. One user; glossary retires authored and inputs; test data that is not a single short literal lives in a tests/config topic file.
- RECORDED_VERSION_INPUTS (const, 5-8): **move** to `tests/config/npm.ts` `RECORDED_VERSION_FILES`. One user; glossary retires inputs; test data that is not a single short literal lives in a tests/config topic file.
- GITHUB_DOWNLOAD_FAILURES (const exported, 11-15): **delete**. LIF-025: githubRefusalNote goes
- OTHER_DOWNLOAD_OUTPUT (const exported, 18-30): **delete**. githubRefusalNote goes (LIF-025), so its test goes.
- PACKAGE_FAILURES (const exported, 32-37): **move** to `tests/config/npm.ts` `INSTALL_FAILURES`. TPR-039: two rows; test data that is not a single short literal lives in a tests/config topic file, and in the npm topic file the name says what fails.
- PACKAGE_VERSION_CASES (const exported, 39-44): **move** to `tests/config/npm.ts` `VERSION_SOURCES`. One user; glossary retires "cases"; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/cli/tools/python.ts`

- (the file) (file): **move** to `tests/config/python/tool-project.ts`. TPR-034; test data that is not a single short literal lives in a tests/config topic file; tests/config/python.ts would pass 300 lines, so the Python check data goes to python/checks.ts and the uv tool project data to python/tool-project.ts.
- LOCKFILE_STEPS (const, 3-3): **delete**. Dead: used only by the deleted PYTHON_LOCKFILE_PLANS.
- CONSTRAINT (const exported, 5-5): **move** to `tests/config/python/tool-project.ts` `PYJWT_CONSTRAINT`. One user; test data that is not a single short literal lives in a tests/config topic file, under a name that says what it holds.
- CONSTRAINT_ARGUMENT (const exported, 6-6): **move** to `tests/config/python/tool-project.ts` `PYJWT_CONSTRAINT_ARGUMENT`. One user; built only from PYJWT_CONSTRAINT, a config value, so it lives beside it in tests/config/python/tool-project.ts.
- PYTHON_LOCKFILE_PLANS (const exported, 8-32): **delete**. Dead: used only by the deleted toolInstallationPlan test.
- PYTHON_ENVIRONMENT_STEPS (const exported, 34-37): **delete**. Dead: used only by the deleted toolInstallationPlan tests.

## `tests/config/cli/tools/vale.ts`

- (the file) (file): **move** to `tests/config/prose.ts`. TPR-034, TPR-008; test data that is not a single short literal lives in a tests/config topic file; Vale is the tool of the prose configuration.
- VALE_ACQUISITION_FAILURES (const exported, 1-32): **move** to `tests/config/prose.ts` `VALE_INSTALL_FAILURES`. TPR-040: drop the timeout column; glossary retires acquisition; test data that is not a single short literal lives in a tests/config topic file.
- CORRECTED_VALE_ACQUISITION (const exported, 34-42): **move** to `tests/config/prose.ts` `FIXED_VALE_INSTALL_SCRIPT`. A short program used by one test; glossary retires corrected and acquisition; test data that is not a single short literal lives in a tests/config topic file.
- CONFIG (const exported, 44-44): **move** to `tests/config/prose.ts` `VALE_PACKAGES_INI`. One user; CONFIG says nothing; test data that is not a single short literal lives in a tests/config topic file; it lists the Vale packages, unlike VALE_INI in the same file, the sample with BasedOnStyles.
- VALE_DETECTION_LINKS (const exported, 46-49): **delete**. LIF-017: its test goes
- VALE_REMOVAL_LINKS (const exported, 51-54): **delete**. LIF-016, LIF-017: its test goes
