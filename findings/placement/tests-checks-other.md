# Tests: the other checks

545 rows. move 180, delete 177, keep 127, merge 36, split 14, inline 11.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/checks/built-in.test.ts`

- (the file) (file): **delete**. TCO-006: its one useful assertion (a manifest check with no command has built-in code) moves into assertManifests, which the CLI build runs; the gspot/policy pin (line 11) and the dead-entry check (line 22) go; EXG-003 first removes the POLICY_CHECK special case
- every shipped check can run and every built-in check has a declared owner (test (test), 6-23): **delete**. self-policing (checks the check registry against the shipped manifests and pins gspot/policy, TCO-006; the command-less check guard belongs in the build-time assertManifests, LIF-007)

## `tests/cli/checks/cases.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/framework/nextjs.test.ts; tests/unit/cli/checks/language/python/modules.test.ts; tests/unit/cli/checks/language/bash/script-layout.test.ts; tests/unit/cli/checks/language/bash/doc-comments.test.ts; tests/unit/cli/checks/language/bash/unused-functions.test.ts; tests/unit/cli/checks/language/bash/unread-arguments.test.ts; tests/unit/cli/checks/language/bash/source-order.test.ts; tests/unit/cli/checks/language/bash/wrappers.test.ts; tests/unit/cli/checks/language/bash/inline-scripts.test.ts; tests/unit/cli/checks/language/bash/ssh-blocks.test.ts; tests/unit/cli/checks/language/bash/variable-defaults.test.ts; tests/unit/cli/checks/language/bash/include-guards.test.ts; tests/unit/cli/checks/language/bash/safety.test.ts; tests/unit/cli/checks/general/structure/trivial-functions.test.ts; tests/unit/cli/checks/general/structure/env-reads.test.ts; tests/unit/cli/checks/general/structure/file-lines.test.ts; tests/unit/cli/checks/library/swift-snapshot-testing.test.ts`. TCG-058: each check's rows run in that check's own test file with runFindingCase, which takes the six assertions; the dependencies, structure and site rows go to their check files
- scenario.name (describe (describe), 75-97): **delete**. TCG-058: the per-scenario describe goes with the file; each check file creates its own repository
- scenario.name &gt; '${entry.check} reports ${where} and passes after the fix' (test (test), 86-95): **split** to `tests/unit/cli/checks/framework/nextjs.test.ts; tests/unit/cli/checks/language/python/modules.test.ts; tests/unit/cli/checks/language/bash/script-layout.test.ts; tests/unit/cli/checks/language/bash/doc-comments.test.ts; tests/unit/cli/checks/language/bash/unused-functions.test.ts; tests/unit/cli/checks/language/bash/unread-arguments.test.ts; tests/unit/cli/checks/language/bash/source-order.test.ts; tests/unit/cli/checks/language/bash/wrappers.test.ts; tests/unit/cli/checks/language/bash/inline-scripts.test.ts; tests/unit/cli/checks/language/bash/ssh-blocks.test.ts; tests/unit/cli/checks/language/bash/variable-defaults.test.ts; tests/unit/cli/checks/language/bash/include-guards.test.ts; tests/unit/cli/checks/language/bash/safety.test.ts; tests/unit/cli/checks/general/structure/trivial-functions.test.ts; tests/unit/cli/checks/general/structure/env-reads.test.ts; tests/unit/cli/checks/library/swift-snapshot-testing.test.ts` ``${entry.check} reports ${where} and passes after the fix`(one test per row, in each check file)`. TCG-058; the six assertions move into runFindingCase (tests/setup)
- CORRECTIONS (const, 22-28): **merge** to `tests/config/bash/checks.ts` `INCLUDE_GUARD_CASES; BASH_ENV_READ_CASES`. TCO-025: one way to say how a case is fixed; the case rows and their fixed files live in tests/config/bash/checks.ts, gspot's Bash check data; tests/config imports only tests/config, so the value drops its CaseChanges annotation and is written as const, and the test that reads it checks the type

## `tests/cli/checks/database/postgres/access.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/database/postgres/access.test.ts`. CKO-004 keeps checks/database/postgres/access.ts; its data goes to tests/config/postgres.ts
- $level grants in "$scope" omit frozen migrations and retain mutable findings (test (test.each), 17-59): **keep** to `tests/unit/cli/checks/database/postgres/access.test.ts` `grants in "$scope" skip frozen migrations and report the newer ones`. TGN-037 drop the level; TCO-012 drop the byte and mode asserts (lines 25-32, 53-57); TTC-032 title; the sample writes a \[\[scope\]\] record with path = "app"
- \[...ACCESS_SCOPES\] (test (test.each), 17-17): **keep** to `tests/unit/cli/checks/database/postgres/access.test.ts` `['', 'app']`. TGN-037, TGN-037: the table becomes the two scopes once ACCESS_SCOPES goes
- $level row security in "$scope" permits a server-only table and reports disabled RLS (test (test.each), 61-90): **keep** to `tests/unit/cli/checks/database/postgres/access.test.ts` `row security in "$scope" reports a table without row level security and passes after the fix`. TGN-037; TTC-032; the check is postgres/row-level-security; the sample writes a \[\[scope\]\] record with path = "app"
- \[...ACCESS_SCOPES\] (test (test.each), 61-61): **keep** to `tests/unit/cli/checks/database/postgres/access.test.ts` `['', 'app']`. TGN-037, TGN-037

## `tests/cli/checks/database/postgres/history.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/database/postgres/history.test.ts`. migration-order and migrations-frozen stay in database/postgres/history.ts (CKO-004); the three tests of migrationsOf move to migrations.test.ts, beside database/postgres/migrations.ts
- migration history reports changed committed SQL and an earlier new version, then passes after fixes (test (test), 25-75): **keep** to `tests/unit/cli/checks/database/postgres/history.test.ts` `migration history reports changed committed SQL and an earlier new version, then passes after fixes`. real; the check is postgres/edited-migrations
- nested scopes keep migration roots and parsed reads separate (test (test), 77-99): **keep** to `tests/unit/cli/checks/database/postgres/history.test.ts` `nested scopes keep migration roots and parsed reads separate`. real; the sample writes \[\[scope\]\] records with path, and a path written in a scope is relative to the repository root, so apps/two writes postgres.migrations_folder = "apps/two/schema" (CFR-003)
- migration analysis rejects unreadable SQL and passes after the fix in a new run (test (test), 101-110): **move** to `tests/unit/cli/checks/database/postgres/migrations.test.ts` `unreadable SQL is an error and the fixed migration is read`. tests migrationsOf, which CKO-004 puts in database/postgres/migrations.ts; TTC-032
- unpadded %s migration versions replay and freeze in numeric order (test (test.each), 112-144): **keep** to `tests/unit/cli/checks/database/postgres/history.test.ts` `unpadded %s migration versions replay and freeze in numeric order`. real
- MIGRATION_PREFIXES (test (test.each), 112-112): **keep** to `tests/unit/cli/checks/database/postgres/history.test.ts` `['', 'V']`. MIGRATION_PREFIXES written in place (TCO-027)
- dbmate and golang-migrate replays exclude rollback SQL (test (test), 146-159): **move** to `tests/unit/cli/checks/database/postgres/migrations.test.ts` `dbmate and golang-migrate replays exclude rollback SQL`. tests migrationsOf (CKO-004 database/postgres/migrations.ts)
- history reads only selected migration blobs and shares reads without mixing scopes (test (test), 161-200): **keep** to `tests/unit/cli/checks/database/postgres/history.test.ts` `history reads only selected migration blobs and shares reads without mixing scopes`. real: blob reads of the history checks; the sample writes a \[\[scope\]\] record with path = "apps/api"
- manifest migration folders retain every owned root and child file while explicit folders stay bounded (test (test), 202-242): **move** to `tests/unit/cli/checks/database/postgres/migrations.test.ts` `the default migration folders are read in root and child scopes, and a set folder replaces them`. tests migrationsOf and the folders squawk receives; TTC-032; the sample writes \[\[scope\]\] records with path, and the app record writes postgres.migrations_folder = "app/custom" from the repository root while the root keeps "custom" (CFR-003). Values to config: DEFAULT_MIGRATION_FOLDER_FILES = the six files written in each scope -&gt; tests/config/postgres.ts
- POSTGRES_HISTORY_POLICY (const, 23-23): **inline** to `tests/unit/cli/checks/database/postgres/history.test.ts` `migration history reports changed committed SQL and an earlier new version, then passes after fixes`. inlined as a buildPolicy call in its one test; after the move only this test uses it (the unreadable-SQL test needs no frozen_through)

## `tests/cli/checks/database/postgres/migration-docs.test.ts`

- (the file) (file): **delete**. CKO-041: the check postgres/migration-docs is deleted with its tests and settings
- docFindings (describe (describe), 20-39): **delete**. CKO-041
- docFindings &gt; a documented migration has no finding (test (test), 21-25): **delete**. CKO-041
- docFindings &gt; a table under the wrong section with no label has two findings at its line (test (test), 27-38): **delete**. CKO-041
- migration header and section findings name the line and corrective action (test (test), 41-49): **delete**. CKO-041
- $name (test (test.each), 51-55): **delete**. CKO-041
- HEADING_CASES (test (test.each), 51-51): **delete**. CKO-041
- input (const, 14-18): **delete**. CKO-041

## `tests/cli/checks/database/postgres/schema-fields.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/database/postgres/schema.test.ts`. TCO-032, CKO-004: tests buildSchema in database/postgres/schema.ts
- keys count as indexes, a table constraint names its columns, and a dropped table leaves (test (test), 5-22): **keep** to `tests/unit/cli/checks/database/postgres/schema.test.ts` `keys count as indexes, a table constraint names its columns, and a dropped table leaves`. real. Values to config: KEYED_TABLES_SQL = the 1_create.sql text (posts and drafts with their keys) -&gt; tests/config/postgres.ts; INDEXED_TABLE_DROP_SQL = the 2_index.sql text (an index on posts, then DROP TABLE drafts) -&gt; tests/config/postgres.ts
- table recreation discards security, keys, and indexes from the old table (test (test), 24-41): **keep** to `tests/unit/cli/checks/database/postgres/schema.test.ts` `table recreation discards security, keys, and indexes from the old table`. real. Values to config: RECREATED_TABLE_SQL = the 1_reset.sql text -&gt; tests/config/postgres.ts
- removing one equivalent index preserves the other until it is removed (test (test), 43-68): **keep** to `tests/unit/cli/checks/database/postgres/schema.test.ts` `removing one equivalent index preserves the other until it is removed`. real. Values to config: EQUIVALENT_INDEXES_SQL = the 1_create.sql text with two indexes on posts(author_id) -&gt; tests/config/postgres.ts
- dropped foreign and unique constraints remove only the fields they own (test (test), 70-87): **keep** to `tests/unit/cli/checks/database/postgres/schema.test.ts` `dropped foreign and unique constraints remove only the fields they own`. real. Values to config: DROPPED_CONSTRAINTS_SQL = the 1_keys.sql text -&gt; tests/config/postgres.ts
- native unnamed foreign keys get their suffix without counting as their own index (test (test), 89-103): **keep** to `tests/unit/cli/checks/database/postgres/schema.test.ts` `an unnamed foreign key gets the PostgreSQL default name and does not count as an index`. TTC-032. Values to config: UNNAMED_FOREIGN_KEY_SQL = the 1_keys.sql text with an unnamed REFERENCES key -&gt; tests/config/postgres.ts

## `tests/cli/checks/framework/expo.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/expo.test.ts`. framework/expo.ts stays (CKO-004); its data goes to tests/config/expo.ts, and the type is inferred (TCO-029)
- Expo Doctor preserves scoped orchestration for $name (test (test.each), 11-63): **keep** to `tests/unit/cli/checks/framework/expo.test.ts` `Expo Doctor runs once in each app folder: $name`. TTC-032; TCO-037 using for the spies; the gspot.toml text writes \[rules\] (ST1-022) and \[\[scope\]\] records with path = "apps/first" and "apps/second". Values to config: EXPO_SCOPES_SETTINGS = the two-scope gspot.toml -&gt; tests/config/expo.ts; EXPO_DOCTOR_INSTALL = the three .gspot/node_modules files -&gt; tests/config/expo.ts
- DOCTOR_RESULTS (test (test.each), 11-11): **keep** to `tests/unit/cli/checks/framework/expo.test.ts` `DOCTOR_RESULTS`. the rows come from tests/config/expo.ts; the 'successful checks' row goes because the mock returns a passing report and the check passes (ST1-016)
- Expo Doctor reports an uninstalled Expo project instead of accepting its empty success (test (test), 65-75): **keep** to `tests/unit/cli/checks/framework/expo.test.ts` `Expo Doctor reports an uninstalled Expo project instead of accepting its empty success`. real; TGN-044: buildPolicy writes the settings, with \[rules\] (ST1-022), instead of a raw gspot.toml

## `tests/cli/checks/framework/nextjs.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/nextjs.test.ts`. CKO-004: framework/public.ts becomes framework/nextjs.ts; takes the route-segments and next-config rows of cases.test.ts (TCG-058); TCO-048 and TCO-037 keep it under 300 lines
- 'Next.js output preservation in ${scope || 'root'}: ${check} reports its finding, passes after the fix, and preserves so (test (test), 81-132): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` ``${check} in ${scope || 'root'} reports in a scratch copy, passes after the fix, and leaves the source as it was``. TTC-032; TCO-012 keeps these asserts because the check runs in a copy; TCO-046 one-handle read
- failed type generation cleans the isolated copy without restoring over source edits (test (test), 134-175): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` `a failed type generation removes the scratch copy and keeps the developer's edit`. TCO-048 use mockNextjsCommands; TCO-037; TTC-032
- 'Next.js reference compilation keeps the type generation copy in ${scope || 'root'}' (test (test), 213-265): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` `Next.js reference compilation keeps the type generation copy in ${scope || 'root'}`. TCO-048 use mockNextjsCommands; TCO-037
- mockNextjsCommands (function, 26-77): **move** to `tests/unit/cli/checks/framework/nextjs.test.ts` `mockNextjsCommands`. TCO-048: gets an optional run callback and serves all three tests; return type inferred (TCO-029). Values to config: NEXT_VERSION_OUTPUT = 'Next.js v16.3.5' (written five times in this file) -&gt; tests/config/nextjs.ts; TYPESCRIPT_VERSION_OUTPUT = 'Version 5.9.3' -&gt; tests/config/nextjs.ts; TSC_FAILURE_OUTPUT = 'src/page.ts(1,1): error TS2322: Type mismatch\\n' -&gt; tests/config/nextjs.ts; BUILD_FAILURE_OUTPUT = 'Error: Page is invalid\\n' -&gt; tests/config/nextjs.ts
- prepareNextjsBuild (function, 185-210): **move** to `tests/unit/cli/checks/framework/nextjs.test.ts` `prepareNextjsBuild`. shared setup of two tests; TCO-046 one-handle read of mode and bytes; the sample writes a \[\[scope\]\] record whose path is the scope under test. Values to config: NEXT_BUILD_FILES = the tsconfig, next-env.d.ts, route types, page, next bin and unrelated files -&gt; tests/config/nextjs.ts; NEXT_CACHE_BYTES = \[0, 255, 1, 2\] -&gt; tests/config/nextjs.ts

## `tests/cli/checks/framework/svelte.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/svelte.test.ts`. CKO-004: framework/contracts.ts becomes framework/svelte.ts
- svelte-check selects the $name TypeScript target (test (test.each), 13-53): **keep** to `tests/unit/cli/checks/framework/svelte.test.ts` `svelte-check selects the $name TypeScript target`. real
- PROJECTS (test (test.each), 13-13): **keep** to `tests/unit/cli/checks/framework/svelte.test.ts` `SVELTE_PROJECTS`. the rows come from tests/config/svelte.ts
- svelteFindings (describe (describe), 55-96): **delete**. TTC-039
- svelteFindings &gt; errors and warnings become findings at one-based positions with their code as the rule (test (test), 56-78): **keep** to `tests/unit/cli/checks/framework/svelte.test.ts` `svelte-check errors and warnings become findings at one-based positions with their code as the rule`. TTC-039; CKO-032 passes input to svelteFindings
- svelteFindings &gt; a Windows file name becomes a forward-slash path (test (test.skipIf), 81-89): **keep** to `tests/unit/cli/checks/framework/svelte.test.ts` `a Windows file name becomes a forward-slash path`. TCO-014: toolPath in the source, so the test runs on every system
- svelteFindings &gt; process.platform !== 'win32' (test (test.skipIf), 81-81): **delete**. TCO-014: no skip
- svelteFindings &gt; a failure line is an error, not a clean result (test (test), 91-95): **keep** to `tests/unit/cli/checks/framework/svelte.test.ts` `a svelte-check failure line is an error, not a clean result`. TTC-039

## `tests/cli/checks/language/bash/conventions.test.ts`

- (the file) (file): **delete**. TCO-003: repeats the bash/unused-functions and bash/ssh-blocks rows; its one new fact (a comment above an ssh heredoc) becomes the corrected file of the ssh-blocks row
- shipped entry and SSH defaults report every finding and accept the declared call and heredoc (test (test), 12-37): **delete**. TCO-003

## `tests/cli/checks/language/bash/doc-comments.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/bash/doc-comments.test.ts`. bash/doc-comments.ts stays; also takes the missing-comment row (TCG-058)
- Bash documentation rejects the %s sample and accepts ordered colon summaries (test (test.each), 8-32): **keep** to `tests/unit/cli/checks/language/bash/doc-comments.test.ts` `Bash documentation rejects the %s sample and accepts ordered colon summaries`. real
- \['colon', 'dash'\] (test (test.each), 8-8): **keep** to `tests/unit/cli/checks/language/bash/doc-comments.test.ts` `['colon', 'dash']`. real

## `tests/cli/checks/language/bash/function-size.test.ts`

- (the file) (file): **delete**. no test of the file stays: 61-64 are deleted with ast-grep (CKO-001) and 65-66 move to file-lines.test.ts
- ast-grep batches all file arguments and retains matches from every batch (test (test), 16-68): **delete**. CKO-001 removes ast-grep
- ast-grep rejects %s (test (test.each), 70-109): **delete**. CKO-001
- \['fatal exit', 'malformed JSON', 'invalid match', 'unselected file'\] as const (test (test.each), 70-70): **delete**. CKO-001
- ast-grep accepts a clean native report (test (test), 111-130): **delete**. TCO-010; CKO-001
- Bash %s heredocs and multiline strings keep their literal code lines (test (test.each), 132-155): **move** to `tests/unit/cli/checks/general/structure/file-lines.test.ts` `Bash %s heredocs and multiline strings count as code lines`. TCO-034: tests structure/file-lines; TCO-012 drops the byte assert (line 147)
- \['.sh', '.bats', ''\] (test (test.each), 132-132): **move** to `tests/unit/cli/checks/general/structure/file-lines.test.ts` `['.sh', '.bats', '']`. moves with its test

## `tests/cli/checks/language/bash/portable.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/language/bash/inline-scripts.test.ts; tests/unit/cli/repository/kind.test.ts`. the small-script test (32-60) is deleted, so no part goes to script-layout.test.ts; TCO-032, TCO-034; the checks bash/embeds and bash/contract become bash/inline-scripts and bash/script-layout, and CKO-018 names the files after the checks
- inline Node has one diagnostic owner for %s (test (test.each), 17-30): **move** to `tests/unit/cli/checks/language/bash/inline-scripts.test.ts` `inline Node (%s) is reported once, by bash/inline-scripts`. tests bash/inline-scripts (bash/embeds today); TTC-032
- NODE_EMBEDS (test (test.each), 17-17): **move** to `tests/unit/cli/checks/language/bash/inline-scripts.test.ts` `NODE_EMBEDS`. moves with its test
- %s accepts a small executable without functions or a prescribed constant declaration (test (test.each), 32-60): **delete**. weak: half of it pins that bash/contract is off at level recommended (TCO-004)
- \['recommended', 'all'\] as const (test (test.each), 32-32): **delete**. TCO-004: the recommended half pins a manifest level
- generated Gradle and Maven launchers do not select Bash or receive source checks (test (test), 62-96): **move** to `tests/unit/cli/repository/kind.test.ts` `generated Gradle and Maven launchers are classified generated and never select Bash`. TCO-034: tests file kind detection and readRepository, not a Bash check

## `tests/cli/checks/language/bash/safety.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/bash/safety.test.ts`. bash/safety.ts stays; takes the blanket-success row (TCG-058)
- a cleanup exemption retains unrelated recursive removal findings in $source (test (test.each), 16-33): **keep** to `tests/unit/cli/checks/language/bash/safety.test.ts` `a trap that removes its own temporary file is allowed and other recursive removals are reported: $source`. TTC-032
- SAFETY_SOURCES (test (test.each), 16-16): **keep** to `tests/unit/cli/checks/language/bash/safety.test.ts` `SAFETY_SOURCES`. the rows come from tests/config/bash/checks.ts
- %s applies failure-discard coverage directly from the level and accepts project path names (test (test.each), 35-53): **delete**. weak: its NAMED_PATHS half guards removed rules (TCO-005), and its level all half repeats the bash/safety blanket-success finding-and-fix row
- \['recommended', 'all'\] as const (test (test.each), 35-35): **delete**. weak (table of the deleted safety.test.ts 35-53)
- the Bash contract and safety agree on the specific temporary path that a trap removes (test (test), 55-78): **keep** to `tests/unit/cli/checks/language/bash/safety.test.ts` `the Bash contract and safety agree on the specific temporary path that a trap removes`. real: two checks agree on one trap

## `tests/cli/checks/language/bash/structure.test.ts`

- (the file) (file): **delete**. TCO-032: nothing stays after TCO-003 and TCO-017
- an executable requires strict mode before its first command (test (test), 16-35): **delete**. TCO-003: the bash/contract strict-mode row repeats it
- shell reads distinguish filename lists containing newlines (test (test.skipIf), 38-55): **delete**. TCO-017: a POSIX-only test of one cache key line
- !isPosix (test (test.skipIf), 38-38): **delete**. TCO-017

## `tests/cli/checks/language/bash/visibility.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/bash/private-prefix.test.ts`. CKO-018: bash/visibility.ts becomes bash/private-prefix.ts
- shell visibility uses outside callers and keeps entrypoints public (test (test), 8-34): **keep** to `tests/unit/cli/checks/language/bash/private-prefix.test.ts` `a function called from another file must not start with _, and one used only in its own file must`. TTC-032. Values to config: PRIVATE_PREFIX_SOURCES = the owner.sh and caller.sh texts before and after the fix -&gt; tests/config/bash/checks.ts

## `tests/cli/checks/language/css.test.ts`

- (the file) (file): **delete**. CKO-029: the check css/module-classes is deleted with its tests
- global CSS classes are not module exports and explicitly local classes still require a use (test (test), 15-35): **delete**. CKO-029
- CSS module class %s supports camel-case and literal access while a Sass module is not read (test (test.each), 37-62): **delete**. CKO-029
- \['card-title', 'card_title', 'card--title'\] (test (test.each), 37-37): **delete**. CKO-029
- CSS usage ignores property-looking text in a $name (test (test.each), 64-83): **delete**. CKO-029
- \[ { name: 'comment', verbatim: '// styles.missing\\n/\* styles\["absent"\] \*/\\n' }, { name: 'string', verbatim: 'exp (test (test.each), 64-72): **delete**. CKO-029
- identically named stylesheets keep their own bindings and correct exact findings (test (test), 85-110): **delete**. CKO-029
- ignored importers cannot satisfy a selected stylesheet class (test (test), 112-139): **delete**. CKO-029
- CSS usage resolves a $name import without inferring unsupported bindings (test (test.each), 141-192): **delete**. CKO-029
- \[ { name: 'default', declaration: 'import styles from "./styles.module.css";', bound: true, (test (test.each), 141-173): **delete**. CKO-029
- CSS module $name does not guess unused classes and still reports literal missing reads (test (test.each), 194-214): **delete**. CKO-029
- DYNAMIC_READS (test (test.each), 194-194): **delete**. CKO-029
- CSS destructuring resolves aliases and reports unused definitions and missing reads at their lines (test (test), 216-239): **delete**. CKO-029
- CSS modules report undefined classes in %s importers and read corrections (test (test.each), 241-268): **delete**. CKO-029
- \['mts', 'cts'\] (test (test.each), 241-241): **delete**. CKO-029
- options (const, 13-13): **delete**. CKO-029

## `tests/cli/checks/language/html.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/html.test.ts`. language/html.ts stays; its data goes to tests/config/html.ts
- HTML script findings (describe (describe), 10-40): **delete**. TTC-039: one describe around the whole file
- HTML script findings &gt; reports the executable URL in $markup at its attribute column (test (test.each), 11-29): **keep** to `tests/unit/cli/checks/language/html.test.ts` `html/scripts reports the executable URL in $markup at its attribute column`. TTC-039: the title names the check once the describe goes
- HTML script findings &gt; ACTIVE_URLS (test (test.each), 11-11): **keep** to `tests/unit/cli/checks/language/html.test.ts` `ACTIVE_URLS`. the rows come from tests/config/html.ts
- HTML script findings &gt; accepts the inert markup %s (test (test.each), 30-39): **keep** to `tests/unit/cli/checks/language/html.test.ts` `html/scripts accepts the inert markup %s`. TTC-039
- HTML script findings &gt; INERT_MARKUP (test (test.each), 30-30): **keep** to `tests/unit/cli/checks/language/html.test.ts` `INERT_MARKUP`. the rows come from tests/config/html.ts

## `tests/cli/checks/language/markdown.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/markdown.test.ts`. language/markdown.ts stays
- TSX and JSONC fences use their declared syntax while JSON rejects comments (test (test), 10-21): **merge** to `tests/unit/cli/checks/language/markdown.test.ts` `markdown/fences reports each fence that does not parse: $name`. TCO-051: one table of { markdown, lines } rows; this becomes the TSX, JSONC and JSON rows
- a fenced block that does not parse in its language is a finding (test (test), 23-36): **keep** to `tests/unit/cli/checks/language/markdown.test.ts` `markdown/fences reports each fence that does not parse: $name`. TCO-051: becomes the one table test. Values to config: MARKDOWN_FENCE_CASES = the merged { markdown, lines } rows -&gt; tests/config/markdown.ts
- tilde fences and unclosed examples still report invalid code (test (test), 38-51): **merge** to `tests/unit/cli/checks/language/markdown.test.ts` `markdown/fences reports each fence that does not parse: $name`. TCO-051: the tilde and unclosed rows
- a %s fence rejects unclosed JSX and passes after the fix (test (test.each), 53-72): **merge** to `tests/unit/cli/checks/language/markdown.test.ts` `markdown/fences reports each fence that does not parse: $name`. TCO-051: unclosed JSX rows plus a fixed row that expects no line
- \['tsx', 'jsx'\] (test (test.each), 53-53): **merge** to `tests/unit/cli/checks/language/markdown.test.ts` `markdown/fences reports each fence that does not parse: $name`. TCO-051

## `tests/cli/checks/language/python/exports.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/python/exports.test.ts`. python/exports.ts stays (CKO-022)
- a function left out of \_\_all\_\_ carries the private prefix (test (test), 11-22): **keep** to `tests/unit/cli/checks/language/python/exports.test.ts` `a function left out of __all__ carries the private prefix`. real
- \_\_all\_\_ belongs at the bottom, lists shortest names first, and stays under the package ceiling (test (test), 24-59): **keep** to `tests/unit/cli/checks/language/python/exports.test.ts` `__all__ belongs at the bottom, lists shortest names first, and stays under the package limit`. glossary: limit, not ceiling. Values to config: EXPORT_ORDER_FILES = the three modules built from PYTHON_MODULE_HEADER and SHOWN_FUNCTION -&gt; tests/config/python/checks.ts
- \_\_all\_\_ names in shortest-first order pass export ordering (test (test), 61-71): **keep** to `tests/unit/cli/checks/language/python/exports.test.ts` `__all__ names in shortest-first order pass export ordering`. real

## `tests/cli/checks/language/python/installation.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/language/python/pip-installs.test.ts; tests/unit/cli/checks/language/python/import-linter.test.ts; tests/unit/cli/checks/language/python/deptry.test.ts`. CKO-018 splits python/deptry.ts into deptry.ts and pip-installs.ts and renames imports.ts to import-linter.ts; each test sits with its file (replaces TCO-032's dependencies.test.ts)
- Python dependency ownership with $file applies only to locked scopes and accepts removal of the duplicate list (test (test.each), 19-50): **move** to `tests/unit/cli/checks/language/python/pip-installs.test.ts` `pip-installs reports a requirements file only in a locked scope ($file) and passes once it is removed`. TTC-032; the sample writes \[\[scope\]\] records with path = "locked" and "other"
- LOCKFILES.filter(({ client }) =&gt; \['uv', 'poetry', 'pdm'\].includes(client)) (test (test.each), 19-19): **move** to `tests/unit/cli/checks/language/python/pip-installs.test.ts` `LOCKFILES.filter(({ client }) => ['uv', 'poetry', 'pdm'].includes(client))`. moves with its test
- absent Python import contracts are explicit skips and malformed project files are errors (test (test), 52-74): **move** to `tests/unit/cli/checks/language/python/import-linter.test.ts` `import-linter skips a project without contracts`. only the skip stays: the malformed half goes because readPackageManifests raises it when the session opens, which tests/cli/repository/package-manifests.test.ts 'invalid $name in $path reports its source' checks (TCO-021)
- import-linter execution failure retains %s diagnostics and source bytes (test (test.each), 76-112): **delete**. duplicate (the mock returns the diagnostic; taking it from stdout or stderr is toolOutputDetail's job, checked by 'bounded failure output retains the final diagnostic from both streams' in tests/unit/cli/execution/command/output.test.ts; TCO-012)
- \['stdout', 'stderr'\] (test (test.each), 76-76): **delete**. duplicate (table of the deleted installation.test.ts 76-112)
- import-linter follows INI precedence and retains separate chains for decorated broken statuses (test (test), 114-167): **move** to `tests/unit/cli/checks/language/python/import-linter.test.ts` `import-linter reads setup.cfg first and reports each broken contract with its import chain`. TCO-012 drops line 166; TTC-032
- deptry skips a standalone script without a project and rejects malformed project metadata (test (test), 169-191): **move** to `tests/unit/cli/checks/language/python/deptry.test.ts` `deptry skips a scope without pyproject.toml`. TCO-021: the malformed half repeats the import-linter case
- Python install path ignores accept only the selected script and keep unmanaged dependencies visible (test (test), 193-214): **delete**. TCO-013: tests the general ignore machinery
- deptry excludes nested scopes without replacing authored patterns at %s (test (test.each), 216-274): **move** to `tests/unit/cli/checks/language/python/deptry.test.ts` `deptry excludes nested scopes and keeps your own exclude patterns`. TGN-037 drop the level; TCO-038 drop toBeDefined; TTC-032; the sample writes \[\[scope\]\] records with path = "app", "app/nested" and "other"
- \['recommended', 'all'\] as const (test (test.each), 216-216): **delete**. TGN-037

## `tests/cli/checks/language/python/pydoclint.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/python/pydoclint.test.ts`. CKO-004 moves pydoclint and docstringConfiguration to language/python/pydoclint.ts
- pydoclint runs with $name (test (test.each), 14-49): **delete**. TCO-022: mock-heavy repeat of the style table and the batch test
- DOCSTRING_PROJECTS (test (test.each), 14-14): **delete**. TCO-022
- the docstring convention $name (test (test.each), 51-53): **keep** to `tests/unit/cli/checks/language/python/pydoclint.test.ts` `the docstring convention $name`. real; docstringConfiguration stays exported; rows 2 and 4 go because they repeat rows 1 and 3 with the style names swapped (ST1-016)
- \[...DOCSTRING_STYLES\] (test (test.each), 51-51): **keep** to `tests/unit/cli/checks/language/python/pydoclint.test.ts` `DOCSTRING_STYLES`. the rows come from tests/config/python/checks.ts
- absent and unsupported Ruff conventions preserve native defaults: %j (test (test.each), 55-60): **keep** to `tests/unit/cli/checks/language/python/pydoclint.test.ts` `no Ruff docstring convention, or an unsupported one, leaves pydoclint's default style: %j`. TTC-032
- \['', '\[tool.ruff\]\\nline-length = 88\\n', '\[tool.ruff.lint.pydocstyle\]\\nconvention = "pep257"\\n'\] (test (test.each), 55-55): **keep** to `tests/unit/cli/checks/language/python/pydoclint.test.ts` `['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n']`. real
- malformed Python project configuration reports the incomplete TOML key (test (test), 62-64): **delete**. TCO-021: asserts a smol-toml message
- pydoclint disables repeated signature types only when the project has not authored those options (test (test), 66-85): **keep** to `tests/unit/cli/checks/language/python/pydoclint.test.ts` `pydoclint turns off repeated signature types only when the project has not set those options`. TTC-032. Values to config: DEFAULT_PYDOCLINT_COMMAND = the expected argument list -&gt; tests/config/python/checks.ts
- pydoclint keeps earlier style findings when a later native style batch fails (test (test), 87-131): **keep** to `tests/unit/cli/checks/language/python/pydoclint.test.ts` `pydoclint keeps earlier style findings when a later style batch fails`. TTC-032; TCO-036 import the module as processes. Values to config: GOOGLE_DOCSTRING_MODULE = the Google-style module -&gt; tests/config/python/checks.ts; NUMPY_DOCSTRING_MODULE = the NumPy-style module -&gt; tests/config/python/checks.ts

## `tests/cli/checks/language/python/singletons.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/python/modules.test.ts`. CKO-022 merges singletons.ts, function-size.ts, functions.ts and lazy-exports.ts into python/modules.ts; also takes the Python rows of cases.test.ts (TCG-058)
- a module-level instance is a singleton until its composition file has a policy ignore (test (test), 11-32): **keep** to `tests/unit/cli/checks/language/python/modules.test.ts` `a module-level instance is a singleton until an ignore names its file`. real; TTC-032
- FastAPI composition objects use the same explicit file ignores as other Python singletons (test (test), 34-61): **delete**. duplicate: 11-32 shows that a module-level instance is reported and an ignore naming its file hides it; the check has no FastAPI-specific code, so the title guards an exemption that does not exist (ST1-012)
- singleton file ignores preserve unaccepted files in root and nested scopes (test (test), 63-87): **delete**. TCO-013: tests the general ignore and scope machinery
- the removed singleton allowance setting is refused while preserving source bytes (test (test), 89-99): **delete**. TCO-005: guards a removed setting

## `tests/cli/checks/language/sql.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/sql.test.ts`. language/sql.ts stays; CKO-021 renames the check sql/functions
- SQL and PL/pgSQL apply the statement threshold and the parameter limit (test (test), 9-66): **keep** to `tests/unit/cli/checks/language/sql.test.ts` `SQL and PL/pgSQL functions apply the statement limit and the parameter limit`. CKO-021: the word is limit; \[reasons\] is deleted (CFR-002), so the raised limit is written function_parameters = { value = 8, reason = "..." } in \[limits.sql\]
- SQL atomic bodies count each statement and reject files containing only trivial functions (test (test), 68-88): **keep** to `tests/unit/cli/checks/language/sql.test.ts` `SQL atomic bodies count each statement and reject files containing only trivial functions`. real
- SQL function analysis keeps quoted bodies strict and preserves psql source bytes (test (test), 90-112): **keep** to `tests/unit/cli/checks/language/sql.test.ts` `a function body that does not parse is an error, and the fixed body is checked`. TTC-032
- the $dialect dialect bypasses PostgreSQL parsing (test (test.each), 114-147): **keep** to `tests/unit/cli/checks/language/sql.test.ts` `the $dialect dialect bypasses PostgreSQL parsing`. real
- FOREIGN_DIALECT_CASES (test (test.each), 114-114): **keep** to `tests/unit/cli/checks/language/sql.test.ts` `FOREIGN_DIALECT_CASES`. the rows come from tests/config/sql.ts
- SQL function structure follows the coverage level and preserves check-specific path ignores (test (test), 149-171): **delete**. TCO-020: the ignore is never exercised; TCO-004: the other half pins a level

## `tests/cli/checks/language/swift/build/analyzer.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/swift/build/analyzer.test.ts`. CKO-004: swift/contracts.ts becomes swift/build.ts; its three test files exceed 300 lines together, so they stay split by behavior in a folder named after the file
- analysis refuses an incomplete compiler log after a failed build (test (test), 12-26): **keep** to `tests/unit/cli/checks/language/swift/build/analyzer.test.ts` `analysis refuses an incomplete compiler log after a failed build`. real; TCO-037 using
- a silent successful SwiftLint analyzer returns no findings (test (test), 28-40): **delete**. TCO-010: the mock returns the answer
- a silent failed SwiftLint analyzer reports its exit code (test (test), 42-56): **keep** to `tests/unit/cli/checks/language/swift/build/analyzer.test.ts` `a silent failed SwiftLint analyzer reports its exit code`. real
- a timed-out Swift %s reports an error (test (test.each), 58-75): **delete**. duplicate: the 'ran past 600 seconds' error comes from the shared runCheckTool timeout path (packages/cli/src/execution/command/public.ts:271, executionFailure), tested in tests/cli/execution/tool-runner/adapters.test.ts (ST1-013)
- \['build', 'analyzer'\] (test (test.each), 58-58): **delete**. rows of the deleted test (ST1-013)
- manual analysis clears its own compiler state without consuming the incremental build result (test (test), 77-105): **keep** to `tests/unit/cli/checks/language/swift/build/analyzer.test.ts` `manual analysis clears its own compiler state without consuming the incremental build result`. real; TCO-037

## `tests/cli/checks/language/swift/build/compiler.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts`. CKO-004 swift/build.ts
- a silent successful Swift build returns no findings (test (test), 20-32): **delete**. TCO-010
- a failed Swift build without source diagnostics returns execution exit 2 and recovers (test (test.skipIf), 34-73): **keep** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts` `a failed Swift build without source diagnostics returns execution exit 2 and recovers`. TCO-015: plain test, usePlatform('darwin') where the platform matters
- !isMacos (test (test.skipIf), 34-34): **delete**. TCO-015: the process runner is mocked
- a later Swift session reads a failed build after an earlier successful build (test (test), 75-108): **keep** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts` `a later Swift session reads a failed build after an earlier successful build`. real; TCO-037
- canceled Swift compilation refuses to launch the compiler (test (test), 110-126): **keep** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts` `canceled Swift compilation refuses to launch the compiler`. real
- Swift response files stay inside the compiler cache before log publication (test (test), 128-156): **keep** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts` `Swift response files stay inside the compiler cache before log publication`. real; TCO-037
- a failed Swift source preparation releases its build claim before a later writer (test (test), 158-179): **keep** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts` `a failed Swift source preparation releases its build claim before a later writer`. real
- Swift compiler diagnostics normalize macOS private prefixes in authored source paths (test (test.skipIf), 181-202): **keep** to `tests/unit/cli/checks/language/swift/build/compiler.test.ts` `Swift compiler diagnostics drop the macOS /private prefix from source paths`. TCO-018: test the compiler diagnostics with two fixed source-path strings, on every system; withoutPrivatePrefix stays unexported.
- !isPosix (test (test.skipIf), 181-181): **delete**. TCO-018
- Xcode build plans retain destination %s for every build purpose (test (test.each), 204-229): **move** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `Xcode build plans keep destination %s for every build purpose`. tests buildPlan, which CKO-004 puts in swift/build-folder.ts; TTC-032; \[swift\] xcode_project, xcode_scheme and xcode_destination are \[xcode\] project, scheme and destination, so the declaration read is xcode.destination (POL-033)
- \['default', 'platform=macOS', ''\] (test (test.each), 204-204): **move** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `['default', 'platform=macOS', '']`. moves with its test

## `tests/cli/checks/language/swift/build/isolation.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/swift/build/isolation.test.ts`. CKO-004 swift/build.ts
- Swift build side effects stay in the source copy and do not become later inputs (test (test), 18-55): **keep** to `tests/unit/cli/checks/language/swift/build/isolation.test.ts` `Swift build side effects stay in the source copy and do not become later inputs`. real; TCO-046 one-handle read; TCO-037
- Periphery build side effects stay in its source copy and findings name original source paths (test (test), 57-84): **keep** to `tests/unit/cli/checks/language/swift/build/isolation.test.ts` `Periphery build side effects stay in its source copy and findings name original source paths`. real
- concurrent Swift compilation and Periphery retain separate source and artifact directories (test (test), 86-122): **keep** to `tests/unit/cli/checks/language/swift/build/isolation.test.ts` `concurrent Swift compilation and Periphery keep separate source and build folders`. TTC-032
- Xcode project %s cannot redirect an isolated build outside the scope (test (test.each), 124-160): **delete**. TCO-013: the path setting refusal is a settings test (policy/read/boundaries)
- \['../External.xcodeproj', 'C:External.xcodeproj'\] (test (test.each), 124-124): **delete**. TCO-013

## `tests/cli/checks/language/swift/build/plan.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/swift/build-folder.test.ts`. tests buildPlan in swift/build-folder.ts (CKO-004); cache.test.ts joins it
- Swift build selection $name (test (test.each), 16-29): **keep** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `Swift build selection $name`. real; the test reads input.view.options('xcode').project (POL-033); SWIFT_PROJECT_SELECTION_CASES says which rows go
- \[...SWIFT_PROJECT_SELECTION_CASES\] (test (test.each), 16-16): **keep** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `[...SWIFT_PROJECT_SELECTION_CASES]`. the rows come from tests/config/swift.ts
- Swift $purpose skips a missing project and keeps an authored empty choice (test (test.each), 31-65): **keep** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `Swift $purpose skips without xcode.project or Package.swift, then builds the package once Package.swift exists`. real; TTC-032; the written "" form of the project setting is deleted and absent means the Swift package (TML-010), so the sample writes no xcode.project, the assertion of the "" value goes, and the skip message and note name xcode.project
- \[...SWIFT_BUILD_PURPOSES\] (test (test.each), 31-31): **keep** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `[...SWIFT_BUILD_PURPOSES]`. the rows come from tests/config/swift.ts, without the periphery row: CKO-016 gives buildPlan only the build purposes

## `tests/cli/checks/language/swift/cache.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/language/swift/build-folder.test.ts`. tests buildFolder and openBuildCache in swift/build-folder.ts (CKO-004)
- build cache rejects external output links and concurrent writers (test (test), 10-33): **keep** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `build cache rejects external output links and concurrent writers`. real
- build state lives in the gspot cache, stable for one repository and distinct between repositories (test (test), 35-43): **keep** to `tests/unit/cli/checks/language/swift/build-folder.test.ts` `build state lives in the gspot cache, stable for one repository and distinct between repositories`. real: the cache folder is stable for one repository and different between repositories

## `tests/cli/checks/language/swift/suppressions.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TCO-034, TCG-053: tests the general gspot/suppressions check
- Swift suppression %s requires a reason and preserves source bytes (test (test.each), 7-33): **merge** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `suppression reason table (two Swift rows)`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TCO-034; TCO-012 drops the byte asserts
- \['swiftformat:disable blockComments', 'periphery:ignore'\] (test (test.each), 7-7): **merge** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `suppression reason table (two Swift rows)`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TCO-034

## `tests/cli/checks/language/typescript/contracts.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts; tests/unit/cli/checks/language/typescript/tsc.test.ts; tests/unit/cli/parsers/tsconfig.test.ts`. TCO-032, CKO-004: typescript/tsconfig and javascript/tsc tests sit with their files; TCO-034 moves the getTsconfigProject test to the parser (parsers/tsconfig.ts)
- malformed TypeScript configuration reports its path instead of missing options (test (test), 18-31): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `malformed TypeScript configuration reports its path instead of missing options`. real; TSCONFIG_OPTIONS_POLICY written in place
- a missing inherited configuration cannot be replaced by empty compiler options (test (test), 33-50): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `a missing inherited configuration cannot be replaced by empty compiler options`. real
- a standalone scope needs no authored tsconfig but still audits an added project configuration (test (test), 52-81): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `a scope needs no tsconfig of its own but still checks one that is added`. TTC-032 (no "authored")
- nested configurations inherit the configuration an ancestor package names (test (test), 83-115): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `nested configurations inherit the configuration an ancestor package names`. real
- recommended permits the two compiler options that all requires (test (test), 117-151): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `level recommended allows the two compiler options that level all requires`. real; the level loop TGN-037 keeps
- a scope whose project lists no JavaScript file passes with nothing to compile (test (test), 153-181): **move** to `tests/unit/cli/checks/language/typescript/tsc.test.ts` `a scope whose project lists no JavaScript file passes with nothing to compile`. TCO-034: tests javascript/tsc (checkjs), which CKO-004 puts in language/typescript/tsc.ts; the sample writes a \[\[scope\]\] record with path = "site"
- %s audits selected framework compiler options in their scope (test (test.each), 183-223): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `typescript/tsconfig checks the framework compiler options of a scope`. TGN-037: the same findings at both levels; the sample writes a \[\[scope\]\] record with path = "service"
- \['recommended', 'all'\] as const (test (test.each), 183-183): **delete**. TGN-037
- %s uses a nearest covering ancestor without accepting an excluded child (test (test.each), 225-254): **move** to `tests/unit/cli/parsers/tsconfig.test.ts` `getTsconfigProject uses the nearest covering ancestor and refuses an excluded child`. TCO-034; TGN-037 drop the level; the sample writes \[\[scope\]\] records with path = "app", "app/deep" and "sibling"
- \['recommended', 'all'\] as const (test (test.each), 225-225): **delete**. TGN-037
- TSCONFIG_OPTIONS_POLICY (const, 16-16): **inline** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `the four typescript/tsconfig tests that use it`. inlined as a buildPolicy call in the four typescript/tsconfig tests that use it

## `tests/cli/checks/language/typescript/projects.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts`. the two ancestor tests test typescript/tsconfig; the copy test (203) is deleted, so project.ts gets no test file
- %s audits a covering ancestor once and keeps child-only audits (test (test.each), 27-73): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `a covering ancestor tsconfig is checked once and a child-only project keeps its own check`. TGN-037; TTC-032; the sample writes a \[\[scope\]\] record with path = "app"
- \['recommended', 'all'\] as const (test (test.each), 27-27): **delete**. TGN-037
- %s leaves an excluded child as a standalone compiler project (test (test.each), 75-98): **move** to `tests/unit/cli/checks/language/typescript/tsconfig.test.ts` `a child excluded from the root project is its own compiler project`. TGN-037; TTC-032; the sample writes a \[\[scope\]\] record with path = "app"
- \['recommended', 'all'\] as const (test (test.each), 75-75): **delete**. TGN-037
- a copied compiler retains an imported ambient declaration absent from configuration roots (test (test), 100-155): **delete**. tests deleted code: both parts call compilerFiles and compilerCopyInputs, which DEC-008 deletes with the cross-scope guard; imported declarations in the copy stay tested by tests/integration/language/typescript/projects.test.ts

## `tests/cli/checks/library/drizzle.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/library/drizzle.test.ts`. keeps the three drizzle/relations tests; the stale-migrations tests join the stale-generated-files table (TCO-002)
- a failed generation in %s reports the failure and preserves every file (test (test.each), 79-96): **delete**. duplicate (TCO-002: the same failed-generation behavior as the kept openapi-fresh.test.ts 68-78)
- DRIZZLE_MIGRATIONS_SCOPES (test (test.each), 79-79): **delete**. duplicate (table of the deleted drizzle.test.ts 79-96)
- a stale schema in %s reports the missing migration files and preserves every file (test (test.each), 98-137): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002: the drizzle row lists its three stale files; TCO-019 fakeTool for drizzle-kit; the table rows come from tests/config/generated-files.ts (GENERATOR_CASES)
- DRIZZLE_MIGRATIONS_SCOPES (test (test.each), 98-98): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `scope column of that table`. TCO-002
- named-schema Drizzle tables need relations and comments do not satisfy the requirement (test (test), 139-155): **keep** to `tests/unit/cli/checks/library/drizzle.test.ts` `named-schema Drizzle tables need relations and comments do not satisfy the requirement`. real
- Drizzle relations reports its finding and passes after the fix (test (test.each), 157-170): **delete**. TCO-003: repeats the test above and re-implements the case runner
- DRIZZLE_RELATIONS_CASES (test (test.each), 157-157): **delete**. TCO-003
- staged Drizzle tables retain unstaged scope relations in %s (test (test.each), 172-204): **keep** to `tests/unit/cli/checks/library/drizzle.test.ts` `a staged table still sees the unstaged relations file of its scope in %s`. TCO-019 drop agentRules: true; TTC-032; the sample writes a \[\[scope\]\] record whose path is the scope under test
- \['', 'packages/db'\] (test (test.each), 172-172): **keep** to `tests/unit/cli/checks/library/drizzle.test.ts` `['', 'packages/db']`. real
- defineRelations declares every named table in %s and preserves child ownership (test (test.each), 206-239): **keep** to `tests/unit/cli/checks/library/drizzle.test.ts` `defineRelations covers every table it names (%s), and a child scope needs its own`. TCO-019; TTC-032; the sample writes a \[\[scope\]\] record with path = "child"
- \['{ teams, members }', '{ teams, people: members }'\] (test (test.each), 206-206): **keep** to `tests/unit/cli/checks/library/drizzle.test.ts` `['{ teams, members }', '{ teams, people: members }']`. real
- applyChanges (function, 26-66): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `writeGeneratorProject`. TCO-002, TCO-042: one helper writes the generator project of each row, with a \[\[scope\]\] record whose path is the scope under test
- expectPreserved (function, 69-77): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002: the preservation asserts become the table's last step (TCO-012 keeps them: the check runs a tool in a copy)

## `tests/cli/checks/library/swift-snapshot-testing.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/library/swift-snapshot-testing.test.ts`. also takes its two rows from cases.test.ts (TCG-058)
- SnapshotTesting syntax determines recording: $body (test (test.each), 14-30): **keep** to `tests/unit/cli/checks/library/swift-snapshot-testing.test.ts` `SnapshotTesting syntax determines recording: $body`. real
- \[ { body: 'let example = "isRecording = true"', count: 0 }, { body: 'SnapshotTesting.isRecording = true', count: (test (test.each), 14-18): **keep** to `tests/unit/cli/checks/library/swift-snapshot-testing.test.ts` `[     { body: 'let example = "isRecording = true"', count: 0 },     { body: 'SnapshotTesting.isRecording = true', count:`. its second row already covers the qualified SnapshotTesting.isRecording form. Values to config: SNAPSHOT_RECORDING_CASES = the body rows -&gt; tests/config/swift.ts
- snapshot references name semantic test owners and respect nested scopes (test (test), 32-66): **keep** to `tests/unit/cli/checks/library/swift-snapshot-testing.test.ts` `a snapshot folder needs a test file of the same name, in each scope`. TTC-032; the sample writes a \[\[scope\]\] record with path = "custom"
- the default snapshot layout accepts a matching source and reference (test (test), 68-89): **delete**. TCO-003: the references row repeats it
- disabled tests and snapshot recording report through the CLI and pass after the fixes (test (test), 91-123): **delete**. TCO-003: repeats the recording row and swift-tests/skip-reasons; the qualified SnapshotTesting.isRecording form TCO-003 wanted to keep is already the second row of the recording table above
- the package dependency proposes the snapshot configuration: $selected (test (test.each), 125-153): **delete**. weak: it calls detectUnselected, which PLR-005 deletes, and pads with a removed-check assert (TCO-005) and a byte assert (TCO-012)
- PACKAGE_PROJECTS (test (test.each), 125-125): **delete**. weak (table of the deleted swift-snapshot-testing.test.ts 125-153)
- the selected snapshot library ships checks at %s (test (test.each), 155-173): **delete**. TCO-004: pins manifest levels
- DOCUMENTATION_LEVELS (test (test.each), 155-155): **delete**. TCO-004, TGN-037

## `tests/cli/checks/library/translations.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/library/translations.test.ts`. library/translations.ts stays; its data goes to tests/config/translations.ts; no test is added: the CKO-002 fix ships without a no-folder test
- a missing base locale is reported and restoring it enables key comparisons (test (test), 14-30): **keep** to `tests/unit/cli/checks/library/translations.test.ts` `a missing base locale is reported and restoring it enables key comparisons`. real; TGN-044 buildPolicy instead of stringify
- $check reports $expected.rule and passes after the fix (test (test.each), 32-40): **keep** to `tests/unit/cli/checks/library/translations.test.ts` `$check reports $expected.rule and passes after the fix`. TCG-058: the rows stay here and runFindingCase takes the six assertions
- CASES (test (test.each), 32-32): **keep** to `tests/unit/cli/checks/library/translations.test.ts` `TRANSLATION_CASES`. the rows come from tests/config/translations.ts

## `tests/cli/checks/library/trpc.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/boundaries/trpc.test.ts`. boundaries/ holds the tests of generation/eslint/boundaries.ts by behavior; the tRPC rule is its own behavior; TCO-009: tests the generated boundaries rule, not a check; generation/eslint/boundaries.ts in the target tree
- the generated native tRPC rule composes server value boundaries at %s (test (test.each), 16-72): **move** to `tests/unit/cli/generation/eslint/boundaries/trpc.test.ts` `the generated boundaries rule keeps tRPC server code out of client modules`. boundaries/ holds the tests of generation/eslint/boundaries.ts by behavior, and the tRPC rule is its own behavior; TCO-009: one level, drop lines 70-71; TTC-032; \[\[architecture.module\]\] records live only at the root (CFR-004), so the three scoped module lists (app, app/child, flat) become paths of the root server module, written from the repository root: app/private/\*\*, app/child/private/\*\* and flat/router.ts; the scopes stay plain \[\[scope\]\] records
- TRPC_LEVELS (test (test.each), 16-16): **delete**. TGN-037, TGN-037

## `tests/cli/checks/platform/cloudflare/configuration.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/platform/cloudflare.test.ts`. CKO-004 keeps platform/cloudflare.ts; one test file for it, with its data in tests/config/cloudflare.ts; TCO-039 drops the copied header
- Cloudflare header checks report only files in their owning scope (test (test), 15-32): **delete**. duplicate (the kept 'headers share syntax and hosting security in both scopes' 64-100 checks the exact \_headers findings of each scope, so it shows each scope reports only its own files)
- Cloudflare redirects refuse Netlify-only status syntax at level %s in root and child scopes (test (test.each), 34-62): **keep** to `tests/unit/cli/checks/platform/cloudflare.test.ts` `Cloudflare redirects refuse Netlify-only status codes in root and child scopes`. TGN-037; TTC-032; the sample writes a \[\[scope\]\] record with path = "app". Values to config: CLOUDFLARE_REDIRECTS = the ten-line \_redirects text -&gt; tests/config/cloudflare.ts
- levelSchema.options (test (test.each), 34-34): **delete**. TGN-037, TGN-037
- headers share syntax and hosting security in both scopes at %s (test (test.each), 64-100): **keep** to `tests/unit/cli/checks/platform/cloudflare.test.ts` `_headers syntax is checked in both scopes`. TGN-037; TTC-032; the security-headers call that only expects \[\] and the site-selection half go, since the latter tests detection, not the check (ST1-018); the sample writes a \[\[scope\]\] record with path = "app". Values to config: CLOUDFLARE_HEADERS = the \_headers text -&gt; tests/config/cloudflare.ts
- levelSchema.options (test (test.each), 64-64): **delete**. TGN-037
- Wrangler validates native schema leaves and retains its requirements at %s (test (test.each), 102-146): **keep** to `tests/unit/cli/checks/platform/cloudflare.test.ts` `wrangler.json values are checked against the installed schema`. TGN-037; TTC-032; the sample writes a \[\[scope\]\] record with path = "app"
- levelSchema.options (test (test.each), 102-102): **delete**. TGN-037
- Wrangler reads installed schema assets for a copied child scope (test (test), 148-175): **keep** to `tests/unit/cli/checks/platform/cloudflare.test.ts` `Wrangler reads installed schema assets for a copied child scope`. real; TCO-012 drops lines 172-174; the sample writes a \[\[scope\]\] record with path = "app"
- Cloudflare Pages without a Wrangler configuration skips schema validation without tools (test (test), 177-190): **keep** to `tests/unit/cli/checks/platform/cloudflare.test.ts` `Cloudflare Pages without a Wrangler configuration skips schema validation without tools`. real

## `tests/cli/checks/platform/cloudflare/types.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts`. TCO-002: cloudflare/stale-types is the shared stale-generated-files check (CKG-032)
- Cloudflare types in %s report a failed generation and preserve source (test (test.each), 71-86): **delete**. duplicate (TCO-002: the same failed-generation behavior as the kept openapi-fresh.test.ts 68-78)
- CLOUDFLARE_TYPES_SCOPES (test (test.each), 71-71): **delete**. duplicate (table of the deleted cloudflare/types.test.ts 71-86)
- Cloudflare types in %s report stale types, accept regenerated ones, and preserve source (test (test.each), 88-113): **delete**. duplicate (TCO-002: the same stale-output behavior as the kept openapi-fresh.test.ts 80-99 and drizzle.test.ts 98-137)
- CLOUDFLARE_TYPES_SCOPES (test (test.each), 88-88): **delete**. duplicate (table of the deleted cloudflare/types.test.ts 88-113)
- custom Worker type files retain the configured interface and child scope (test (test), 115-145): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `custom Worker type settings reach wrangler types as --env-interface`. TCO-002 keeps this Cloudflare argument test; TCG-020 call staleGeneratedFiles directly; TTC-032; the sample writes \[\[scope\]\] records with path, and workers/api writes cloudflare.types_file = "workers/api/cloudflare-env.d.ts" from the repository root and cloudflare.types_interface = "CloudflareEnv" (CFR-003)
- mockWrangler (function, 26-32): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `mockWrangler`. used by the cloudflare row and the interface test
- applyChanges (function, 35-61): **delete**. helper used only by the deleted cloudflare/types.test.ts 71-86 and 88-113
- expectPreserved (function, 64-69): **delete**. helper used only by the deleted cloudflare/types.test.ts 71-86 and 88-113

## `tests/cli/checks/platform/supabase/configuration.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/platform/supabase.test.ts`. CKO-004: platform/public.ts becomes platform/supabase.ts; its configuration and service-role-key tests share one file (about 255 lines)
- Supabase configurations and function discovery stay within nested project scopes (test (test), 18-45): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `Supabase config.toml and function folders are read per scope`. real; TTC-032 ("configuration" names a gspot configuration); the sample writes \[\[scope\]\] records with path, and apps/api writes supabase.functions_folder = "apps/api/edge" from the repository root (CFR-003)
- Supabase malformed configuration reports syntax before storage analysis (test (test), 47-57): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `a malformed config.toml is a syntax finding and storage analysis skips it`. real; TTC-032; the sample writes a \[\[scope\]\] record with path = "apps/api"
- Supabase migration names are checked without parsing SQL or reading another scope (test (test), 59-92): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `Supabase migration names are checked without parsing SQL or reading another scope`. real; the sample writes a \[\[scope\]\] record with path = "apps/api"
- Deno lint exit %s without JSON reports the configuration diagnostic and preserves files (test (test.each), 94-122): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `Deno lint exit %s without JSON reports Deno's error text`. TCO-012 drops line 120; TTC-032
- \[1, 2\] (test (test.each), 94-94): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `[1, 2]`. real
- storage policy $name retains native scope and literal boundaries at $level (test (test.each), 124-166): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `a storage policy counts only a real bucket_id = 'name' condition on storage.objects: $name`. TGN-037; TCO-012 drops lines 151-153 and 164; TTC-032; the sample writes a \[\[scope\]\] record with path = "app"
- STORAGE_POLICIES.flatMap((entry) =&gt; levelSchema.options.map((level) =&gt; ({ ...entry, level }))) (test (test.each), 124-124): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `STORAGE_POLICIES`. TGN-037: the level flatMap goes; the rows come from tests/config/supabase.ts
- storage policy analysis retains the native malformed migration refusal (test (test), 168-181): **delete**. duplicate: storagePolicies reads migrations through migrationsOf, whose parse error the test 'unreadable SQL is an error and the fixed migration is read' in migrations.test.ts already checks (ST1-014)

## `tests/cli/checks/platform/supabase/settings.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/platform/supabase.test.ts`. TCO-032 (service-role-key) into the one test file of platform/supabase.ts; TCO-039 drops the copied header
- service role keys use effective test paths while adjacent client files still fail (test (test), 15-25): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `service role keys are allowed in each scope's test files and refused in client files`. TTC-032
- service role keys are refused in component and module clients while allowed server files remain untouched (test (test), 27-65): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `service role keys are refused in component and module clients and allowed in the functions folder`. TCO-012 drops the byte reads (line 53, 63-64); TTC-032
- privileged Supabase keys reject %s in client scopes and preserve allowed files (test (test.each), 67-104): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `a secret Supabase key read as %s is refused in client files`. TCO-012 drops lines 99-102; TTC-032; the sample writes \[\[scope\]\] records with path, and apps/web writes supabase.functions_folder = "apps/web/server" from the repository root (CFR-003)
- SECRET_KEY_READS (test (test.each), 67-67): **keep** to `tests/unit/cli/checks/platform/supabase.test.ts` `SECRET_KEY_READS`. the rows come from tests/config/supabase.ts

## `tests/cli/checks/platform/supabase/types.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts`. TCO-002: supabase/stale-types is the shared stale-generated-files check (CKG-032); the shared behavior joins the table, the Supabase-only tests move beside it
- Supabase freshness reports missing and stale types then accepts matching bytes in %s (test (test.each), 81-129): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002: the supabase row (missing, stale, matching); TCO-049 one request assertion
- \['', 'apps/api'\] (test (test.each), 81-81): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `scope column of that table`. TCO-002
- Supabase execution failures and cancellation preserve authored bytes and modes in %s (test (test.each), 131-172): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002: failure and cancellation are the table's failed-run step; TCO-012 drops the byte and mode asserts
- \['', 'apps/api'\] (test (test.each), 131-131): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `scope column of that table`. TCO-002
- Supabase passes every configured schema separately in %s (test (test.each), 174-205): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `Supabase passes every configured schema as its own --schema`. Supabase-specific part of the shared check; TCO-049
- \['', 'apps/api'\] (test (test.each), 174-174): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `['', 'apps/api']`. moves with its test
- Supabase types need Docker before invoking the local stack (test (test), 207-228): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `Supabase types need Docker before the local stack starts`. Supabase-specific; TCO-037 using
- prepareSupabaseCheck (function, 20-79): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `prepareSupabaseCheck`. serves the two Supabase tests; TCO-049, TCO-037; return type inferred (TCO-029); a scoped call writes a \[\[scope\]\] record with supabase.types_file = "&lt;scope&gt;/database.ts", written from the repository root (CFR-003). Values to config: DOCKER_VERSION_OUTPUT = 'Docker version 29.2.1\\n' -&gt; tests/config/supabase.ts; SUPABASE_VERSION_OUTPUT = '2.75.0\\n' -&gt; tests/config/supabase.ts; SUPABASE_PROJECT_CONFIG = 'project_id = "types-sample"\\n' -&gt; tests/config/supabase.ts

## `tests/cli/checks/tool/docker.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts`. CKO-005, NMU-009: checks/tool becomes checks/infrastructure; with the data in tests/config/docker.ts the kept tests are about 185 lines, so one file
- Trivy scans only service images in $name (test (test.each), 28-62): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `Trivy scans only service images in $name`. real; the anchor-merge row and the duplicates-and-interpolation row stay, while the quoted, inline and folded rows go because they test the YAML library, not gspot (ST1-016)
- COMPOSE_SOURCES (test (test.each), 28-28): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `COMPOSE_SOURCES`. the two rows come from tests/config/docker.ts
- Trivy refuses $name with its diagnostic (test (test.each), 64-78): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `a fatal registry failure is reported with its diagnostic`. real; only the 'a fatal registry failure' row stays, as a plain test, because it is gspot's own message; 'an empty report', 'malformed JSON' and 'a result without its target' only pin JSON.parse and zod text (ST1-016)
- REPORT_FAILURES (test (test.each), 64-64): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `one row, plain test`. CKO-013 drops the two inconsistent-report rows with the guard, and three more only pin parser text, so one row is left and the test needs no table; its report comes from tests/config/docker.ts
- Trivy accepts a clean native report without an image finding (test (test), 80-101): **delete**. TCO-010: the mock returns the answer
- Trivy refuses $name before scanning an image (test (test.each), 103-115): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `Trivy refuses $name before scanning an image`. real
- INVALID_COMPOSE (test (test.each), 103-103): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `INVALID_COMPOSE`. the rows come from tests/config/docker.ts
- Trivy leaves build-only services unscanned (test (test), 117-129): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `Trivy leaves build-only services unscanned`. real
- Trivy retains each native advisory and secret identity without exporting secret bytes (test (test), 131-156): **delete**. duplicate (TCO-050: the kept 'Trivy scans a repeated image once' 192-220 checks the same three findings and the hidden secret value; the kept 'Trivy scans only service images' 28-62 checks the message text)
- %s Docker language ignores (describe (describe.each), 158-176): **delete**. TGN-037: dockerignore never reads the level
- %s Docker language ignores &gt; \['recommended', 'all'\] as const (describe (describe.each), 158-158): **delete**. TGN-037
- %s Docker language ignores &gt; Docker ignore requirements follow $name (test (test.each), 159-175): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `Docker ignore requirements follow $name`. real; TGN-037 one level, so the level describe and its title prefix go
- %s Docker language ignores &gt; DOCKERIGNORE_CASES (test (test.each), 159-159): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `DOCKERIGNORE_CASES`. the rows come from tests/config/docker.ts; no describe prefix
- %s Docker context ignores (describe (describe.each), 178-190): **delete**. TGN-037
- %s Docker context ignores &gt; \['recommended', 'all'\] as const (describe (describe.each), 178-178): **delete**. TGN-037
- %s Docker context ignores &gt; $name reports only its native ignore contract (test (test.each), 179-189): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `a Dockerfile needs an ignore file that lists .git and .env: $name`. TTC-032
- %s Docker context ignores &gt; DOCKER_CONTEXT_CASES (test (test.each), 179-179): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `DOCKER_CONTEXT_CASES`. the rows come from tests/config/docker.ts; no describe prefix
- Trivy scans a repeated image once and projects every advisory and secret to its declaring files (test (test), 192-220): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `Trivy scans a repeated image once and reports each advisory and secret in every Compose file that names it`. TCO-050 adds the message field; TTC-032
- Compose $override runs after $base in the same native invocation (test (test.each), 222-247): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `Compose $override runs after $base in one docker compose call`. TTC-032
- COMPOSE_PAIRING_CASES (test (test.each), 222-222): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `COMPOSE_PAIRING_CASES`. the rows come from tests/config/docker.ts
- %s missing Docker ignore instructions list only selected language entries in root and child (test (test.each), 249-274): **move** to `tests/unit/cli/checks/infrastructure/docker.test.ts` `a missing ignore file lists the entries of the configurations selected in root and child`. TGN-037; TTC-032; the sample writes a \[\[scope\]\] record with path = "app"
- \['recommended', 'all'\] as const (test (test.each), 249-249): **delete**. TGN-037

## `tests/cli/checks/tool/github-actions.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts`. CKO-004, CKO-005, NMU-009: tool/public.ts splits into infrastructure/github-actions.ts and infrastructure/nginx.ts
- the pin verification adapter reports a rejected commit and preserves the workflow (test (test), 26-52): **delete**. TCO-023: the stub holds the logic it tests
- the reference %s reaches actionlint as %s (test (test.each), 57-73): **keep** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `the reference %s reaches actionlint as %s`. IGN-012 keeps the $/ rewrite, so these tests stay
- \[ \['$/${PATH}', './${PATH}'\], \['"$/${PATH}"', '"./${PATH}"'\], \[''$/${PATH}'', ''./${PATH}''\], \[String.ra (test (test.each), 57-68): **keep** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `[     [`$/${PATH}`, `./${PATH}`],     [`"$/${PATH}"`,`"./${PATH}"`],     [`'$/${PATH}'`, `'./${PATH}'`],     [String.ra`. PATH becomes CALLED_WORKFLOW (TCO-041). Values to config: CALLED_WORKFLOW_REFERENCES = the reference pairs, derived only from CALLED_WORKFLOW -&gt; tests/config/github-actions.ts
- an alias resolves to the anchored reference, which changes where it is written (test (test), 75-78): **keep** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `an alias resolves to the anchored reference, which changes where it is written`. real
- text that is not a YAML mapping stays as written (test (test), 80-82): **keep** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `text that is not a YAML mapping stays as written`. real
- Actionlint removes its prepared project after adapter exit $code without changing source permissions (test (test.each), 84-124): **keep** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `actionlint runs in a scratch copy that is removed after exit $code, and the workflow is unchanged`. TTC-032 (TCO-012 keeps these asserts: the tool runs in a copy)
- \[ { code: 0, status: 'passed', findings: \[\], note: undefined }, { code: 1, status: 'failed', (test (test.each), 84-93): **keep** to `tests/unit/cli/checks/infrastructure/github-actions.test.ts` `[     { code: 0, status: 'passed', findings: [], note: undefined },     {         code: 1,         status: 'failed',`. real. Values to config: ACTIONLINT_EXITS = the two exit rows -&gt; tests/config/github-actions.ts
- TOOL_FAILURES_POLICY (const, 21-24): **delete**. TCO-023

## `tests/cli/checks/tool/jest-execution.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/planning/checks.test.ts`. only the coverage-gating test (106-128) stays; TCO-008: there is no Jest check; coverageArguments stays in planning/checks.ts, and parseManifest sits in configurations/manifests.ts
- Jest command reports $name, disposes its source copy, and passes after the fix (test (test.each), 16-67): **delete**. TCO-008: exit-code handling has its own runner tests; TCO-005 (--runInBand)
- OUTCOMES (test (test.each), 16-16): **delete**. TCO-008
- $level "$scope" coverage uses the $dimension floor (test (test.each), 69-104): **delete**. weak (TCO-008: 20 rows for a two-branch function; the zero rows compare with ZERO_COMMANDS, a copy of the manifest commands, TCO-004); both branches run in tests/integration/testing/jest.test.ts
- \['recommended', 'all'\].flatMap((level) =&gt; \['', 'app'\].flatMap((scope) =&gt; \['zero', 'lines', 'branches (test (test.each), 69-75): **delete**. weak (table of the deleted jest-execution.test.ts 69-104)
- coverage gating leaves unrelated commands, authored checks, and supplied arguments unchanged (test (test), 106-128): **move** to `tests/unit/cli/planning/checks.test.ts` `coverage arguments leave other commands, your own checks, and given arguments unchanged`. TCO-008 keeps it next to the test above; TGN-044 buildPolicy; the command check is a \[\[command_check\]\] record with name = "project/tests"
- isolated scope commands require a root placeholder, including embedded native rootDir values (test (test), 130-138): **delete**. fake (TCO-004: asserts a substring of the shipped Jest manifest; the root placeholder rule moves into the build-time assertManifests, LIF-006, whose tests are deleted)

## `tests/cli/checks/tool/nginx.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/infrastructure/nginx.test.ts`. CKO-004: the nginx part of tool/public.ts becomes infrastructure/nginx.ts
- testArguments (describe (describe), 17-42): **delete**. TTC-039: wraps 1 of 4 tests
- testArguments &gt; mounts the file, a certificate and a key where the file opens them, and resolves the names it uses (test (test), 18-41): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `testArguments mounts the file, a certificate and a key where the file opens them, and resolves the names it uses`. TTC-039
- dynamic and local nginx targets stay unresolved and repeated certificate mounts are deduplicated (test (test), 44-60): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `dynamic and local nginx targets stay unresolved and repeated certificate mounts are deduplicated`. real
- empty directive input adds no mount or host (test (test), 62-70): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `empty directive input adds no mount or host`. real
- certificate failure retains the diagnostic from %s and removes scratch files without starting Docker (test (test.each), 72-112): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `a failed certificate step reports its %s text, removes the scratch files, and does not start Docker`. TTC-032 (TCO-012 keeps line 110)
- \['stdout', 'stderr'\] (test (test.each), 72-72): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `['stdout', 'stderr']`. real

## `tests/cli/checks/tool/openapi-fresh.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts`. TCO-002: openapi/stale-document is the shared stale-generated-files check (CKG-032); the Spectral test goes
- OpenAPI freshness in %s reports failed generation and preserves dirty and untracked input (test (test.each), 68-78): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002: the openapi row; it keeps the empty and spaced generate_command arguments
- \['', 'apps/api'\] (test (test.each), 68-68): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `scope column of that table`. TCO-002
- OpenAPI freshness in %s reports stale output, accepts regeneration, and preserves input (test (test.each), 80-99): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002: the openapi stale row
- \['', 'apps/api'\] (test (test.each), 80-80): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `scope column of that table`. TCO-002
- OpenAPI freshness in %s identifies a missing configured document before starting a tool (test (test.each), 101-121): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `a missing openapi.document in %s is an error before any tool starts`. openapi-specific error of the shared check; TCG-020 direct call; TTC-032; the sample writes \[\[scope\]\] records with path, and apps/api writes openapi.document = "apps/api/openapi.json" from the repository root (CFR-003)
- \['', 'apps/api'\] (test (test.each), 101-101): **move** to `tests/unit/cli/checks/stale-generated-files.test.ts` `['', 'apps/api']`. moves with its test
- Spectral at %s in %s uses the project document and its generated ruleset (test (test.each), 123-178): **delete**. the openapi integration cases run real Spectral with the generated ruleset, and this mocked copy pins the manifest command and the command runner, which have their own tests (TCO-004, TCO-023)
- SPECTRAL_SCOPES (test (test.each), 123-123): **delete**. TGN-037, TGN-037
- OPENAPI_FRESH_POLICY (const, 28-30): **merge** to `tests/config/generated-files.ts` `GENERATOR_CASES`. the openapi row's settings; the openapi row in config keeps its gspot.toml text written literally, since tests/config imports only tests/config and cannot call buildPolicy
- applyChanges (function, 33-57): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `writeGeneratorProject`. TCO-002, TCO-042; a scope writes a \[\[scope\]\] record with openapi.document = "&lt;scope&gt;/openapi.json", written from the repository root (CFR-003)
- expectPreserved (function, 60-66): **merge** to `tests/unit/cli/checks/stale-generated-files.test.ts` `each generator configuration reports a failed run and a stale file and leaves the source as it was: $configuration`. TCO-002

## `tests/cli/checks/tool/swift-tests/coverage.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/testing/swift-tests.test.ts`. CKO-004, CKO-005, NMU-009: tool/contracts.ts becomes testing/swift-tests.ts; the kept swift-tests tests are about 200 lines, so one file
- the coverage check compares each named target with its floor (test (test), 4-13): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `the coverage check compares each named target with its minimum`. real; CKO names: minimum, not floor
- the shared coverage floor applies to every source target without overriding a named floor (test (test), 15-27): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `the shared coverage minimum applies to every source target unless a target has its own`. real; CKO names: minimum, not floor

## `tests/cli/checks/tool/swift-tests/execution.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/testing/swift-tests.test.ts`. the same check, swift-tests/coverage; one swift-tests test file
- XCTest reports a timed-out native command as an error and accepts a later run (test (test.skipIf), 23-58): **delete**. duplicate: 'xcodebuild ran past' is the shared runCheckTool timeout message, tested in adapters.test.ts, and the later passing run repeats the fixed step of the coverage failure table 59-97 (ST1-013)
- !isMacos (test (test.skipIf), 23-23): **delete**. TCO-015: the tools are fakeTool scripts
- XCTest coverage classifies $failure and passes after the fix (test (test.skipIf), 59-97): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `XCTest coverage classifies $failure and passes after the fix`. TCO-015
- \[...XCTEST_FAILURES\] (test (test.skipIf), 59-59): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `[...XCTEST_FAILURES]`. the rows come from tests/config/swift.ts
- !isMacos (test (test.skipIf), 59-59): **delete**. TCO-015
- XCTest coverage refuses an external result link and removes a previous result bundle (test (test.skipIf), 99-139): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `XCTest coverage refuses an external result link and removes a previous result bundle`. TCO-015
- !isMacos (test (test.skipIf), 99-99): **delete**. TCO-015
- XCTEST_EXECUTION_OPTIONS (const, 21-21): **move** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `XCTEST_EXECUTION_OPTIONS`. shared by the three coverage-run tests; it stays in the test file because it is built at load time with buildRunOptions

## `tests/cli/checks/tool/swift-tests/sources.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/testing/swift-tests.test.ts`. TCO-032; CKO-005 testing group; one swift-tests test file
- Swift Testing outside test folders reports a sleep and passes after the fix (test (test), 17-38): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `Swift Testing outside test folders reports a sleep and passes after the fix`. real
- Swift skip reason belongs to its argument: $body (test (test.each), 40-68): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `Swift skip reason belongs to its argument: $body`. real
- \[ { body: 'try XCTSkip()', missing: true }, { body: 'try XCTSkip("")', missing: true }, { body: 'try XCTSkip (test (test.each), 40-55): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `[     { body: 'try XCTSkip()', missing: true },     { body: 'try XCTSkip("")', missing: true },     { body: 'try XCTSkip`. real. Values to config: SKIP_REASON_CASES = the body rows -&gt; tests/config/swift.ts
- Swift test checks apply sleep allowances in their declared scope (test (test), 70-92): **delete**. TCO-013: tests the general ignore and scope machinery
- Swift syntax controls $check for $body (test (test.each), 93-107): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `swift-tests/sleep reads Swift syntax: $body`. TCO-053
- \[ { check: 'swift-tests/sleep', body: 'let example = "Task.sleep(1)"', count: 0 }, { check: 'swift-tests/sleep', (test (test.each), 93-97): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `the three rows without the check column`. TCO-053. Values to config: SLEEP_SYNTAX_CASES = the three rows without the check column -&gt; tests/config/swift.ts
- a sleep path ignore excludes an unreadable file before source parsing (test (test), 109-128): **delete**. duplicate: a paths ignore removes files from a check's input before it reads them, which tests/cli/execution/impact.test.ts '$name preserves project input selection' checks for every check (ST1-015)
- the commit stage leaves the coverage run to its own stage (test (test), 130-149): **delete**. TCO-004: pins manifest stages
- Swift checks report each scope independently and file-list inputs omit sibling sources (test (test), 151-179): **delete**. TCO-013

## `tests/cli/checks/tool/xcode/project.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts`. CKO-005, NMU-009: checks/tool/xcode becomes checks/infrastructure/xcode
- Xcode sources follow group paths and target membership instead of duplicate filenames (test (test), 13-45): **keep** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts` `Xcode sources follow group paths and target membership instead of duplicate filenames`. real
- membership combines projects in a scope and checks nested scopes independently (test (test), 47-71): **keep** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts` `membership combines projects in a scope and checks nested scopes independently`. real; the sample writes a \[\[scope\]\] record with path = "nested"
- an unreadable project returns execution status 2 (test (test), 73-83): **delete**. weak (only checks exit code 2)
- project (function, 8-11): **move** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts` `project`. used by two tests; the helper keeps only the per-name replacement. Values to config: SINGLE_FILE_PBXPROJ = PBXPROJ_PROJECT without B1 and the SYNC group, derived only from a config value -&gt; tests/config/xcode.ts

## `tests/cli/checks/tool/xcode/resources.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts`. CKO-005, NMU-009
- a failed resource read is an execution error for %s; malformed JSON remains a finding (test (test.each), 13-49): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `a failed resource read is an execution error for %s, and malformed JSON is a finding`. TCO-012 drops lines 44-47 (they test the file helper)
- \[ \['xcode/xcstrings', 'App/Localizable.xcstrings', '{"sourceLanguage":"en","strings":{}}\\n'\], \['xcode/assets', ' (test (test.each), 13-16): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `[     ['xcode/xcstrings', 'App/Localizable.xcstrings', '{"sourceLanguage":"en","strings":{}}\n'],     ['xcode/assets', '`. real. Values to config: UNREADABLE_RESOURCES = the two rows -&gt; tests/config/xcode.ts
- a denied asset existence read is an execution error and a genuinely missing image is a finding (test (test), 51-86): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `a denied asset existence read is an execution error and a genuinely missing image is a finding`. TCO-012 drops lines 83-85
- Xcode asset %s accepts its camel-case symbol and reports an unrelated symbol (test (test.each), 88-112): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `Xcode asset %s accepts its camel-case symbol and reports an unrelated symbol`. TCO-038 drops line 110
- \['logo-mark', 'logo_mark', 'Logo Mark', 'Logo MarkImage', 'logo-markColor'\] (test (test.each), 88-88): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `['logo-mark', 'logo_mark', 'Logo Mark', 'Logo MarkImage', 'logo-markColor']`. real
- $title counts the asset and rejects an unrelated name (test (test.each), 114-135): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `$title counts the asset and rejects an unrelated name`. real; the sample writes a \[\[scope\]\] record with path = "app"
- ASSET_SETTING_CASES (test (test.each), 114-114): **keep** to `tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `ASSET_SETTING_CASES`. the rows come from tests/config/xcode.ts

## `tests/cli/checks/tool/xcode/scopes.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/infrastructure/xcode/settings.test.ts; tests/unit/cli/checks/infrastructure/xcode/resources.test.ts; tests/unit/cli/checks/infrastructure/xcode/project.test.ts`. TCO-032: each test sits with the xcode file whose check it runs (settings.ts, resources.ts, project.ts)
- %s checks the deepest scope and preserves sibling settings (test (test.each), 7-50): **move** to `tests/unit/cli/checks/infrastructure/xcode/settings.test.ts` `%s checks the deepest scope only`. TCO-012 drops lines 46-48; TTC-032; the setting is xcode.allowed_entitlements; the sample writes \[\[scope\]\] records with path = "app", "app/child" and "sibling", each scoped setting a dotted key inside its record
- \[ \['xcode/xcconfig', 'Build.xcconfig', 'PRODUCT_NAME App\\n', 'PRODUCT_NAME = App\\n', 'xcconfig-line'\], \[ (test (test.each), 7-16): **move** to `tests/unit/cli/checks/infrastructure/xcode/settings.test.ts` `[     ['xcode/xcconfig', 'Build.xcconfig', 'PRODUCT_NAME App\n', 'PRODUCT_NAME = App\n', 'xcconfig-line'],     [`. moves with its test. Values to config: DEEPEST_SCOPE_SETTINGS = the setting-file rows -&gt; tests/config/xcode.ts
- orphan assets follow %s and tracked scoped exceptions (test (test.each), 52-81): **delete**. weak: the recommended half pins a manifest level (TCO-004), it holds a byte assert (TCO-012), and the ignore half tests the general ignore code (TCO-013)
- \['recommended', 'all'\] as const (test (test.each), 52-52): **delete**. TCO-004
- %s reports malformed %s as a source finding (test (test.each), 83-97): **split** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts; tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `%s reports malformed %s as a source finding`. the test-plans rows test project.ts, the xcstrings and assets rows test resources.ts; one row per document type stays, since the second and third rows of each type only vary the zod rejection (ST1-016)
- INVALID_XCODE_DOCUMENTS (test (test.each), 83-83): **split** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts; tests/unit/cli/checks/infrastructure/xcode/resources.test.ts` `INVALID_XCODE_DOCUMENTS`. split with its test; the rows come from tests/config/xcode.ts

## `tests/cli/checks/tool/xcode/symlinks.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts`. xcode/symlinks lives in xcode/project.ts
- Xcode reports exact staged symlink targets before the first commit and clears corrected files (test (test.skipIf), 14-46): **keep** to `tests/unit/cli/checks/infrastructure/xcode/project.test.ts` `a staged symbolic link is reported before the first commit and passes once it is a file`. TCO-016 plain file name; TCO-013 drops lines 39-44
- !isPosix (test (test.skipIf), 14-14): **delete**. TCO-016: keep a Windows skip only if the symbolic link itself fails there, with that reason

## `tests/config/cli/checks/database/postgres/access.ts`

- (the file) (file): **move** to `tests/config/postgres.ts`. TCO-027; static data, so config
- ACCESS_SCOPES (const exported, 1-6): **delete**. TGN-037, TGN-037
- GRANT_FILES (const exported, 8-12): **move** to `tests/config/postgres.ts` `GRANT_FILES`. TCO-027; static data, so config
- FROZEN_GRANTS (const exported, 14-18): **move** to `tests/config/postgres.ts` `FROZEN_GRANTS`. TCO-027; static data, so config
- RLS_SOURCE (const exported, 20-21): **move** to `tests/config/postgres.ts` `RLS_SOURCE`. TCO-027; static data, so config

## `tests/config/cli/checks/database/postgres/history.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/database/postgres/history.test.ts; tests/unit/cli/checks/database/postgres/migrations.test.ts`. TCO-027; its tests live in two files, and its four values are short literals used by one test file each, so they stay there
- ORIGINAL (const exported, 1-1): **move** to `tests/unit/cli/checks/database/postgres/history.test.ts` `TEAMS_MIGRATION`. says what it holds; the moved unreadable-SQL test writes its own literal; one short literal, so it stays in the test file
- PATH (const exported, 3-3): **move** to `tests/unit/cli/checks/database/postgres/history.test.ts` `MIGRATION_FILE`. TCO-041: PATH reads as the search path; one short literal, so it stays in the test file
- MIGRATION_PREFIXES (const exported, 5-5): **inline** to `tests/unit/cli/checks/database/postgres/history.test.ts` `unpadded %s migration versions replay and freeze in numeric order`. TCO-027: one test
- DEFAULT_SQUAWK_FILES (const exported, 7-7): **inline** to `tests/unit/cli/checks/database/postgres/migrations.test.ts` `the default migration folders are read in root and child scopes, and a set folder replaces them`. TCO-027: one test

## `tests/config/cli/checks/database/postgres/migration-docs.ts`

- (the file) (file): **delete**. CKO-041
- SECTIONS (const exported, 1-1): **delete**. CKO-041
- NAME (const exported, 3-3): **delete**. CKO-041
- DOCUMENTED (const exported, 5-6): **delete**. CKO-041
- HEADER_FINDINGS (const exported, 8-13): **delete**. CKO-041
- HEADING_CASES (const exported, 15-38): **delete**. CKO-041

## `tests/config/cli/checks/framework/expo.ts`

- (the file) (file): **move** to `tests/config/expo.ts`. TCO-027; static data, so config
- DOCTOR_RESULTS (const exported, 6-28): **move** to `tests/config/expo.ts` `DOCTOR_RESULTS`. TCO-027; TCO-036 processResult; the 'successful checks' row goes (ST1-016); tests/config imports only tests/config, so the value drops its DoctorResult annotation and is written as const, and the test that reads it checks the type
- DOCTOR_VERSION (const exported, 31-31): **move** to `tests/config/expo.ts` `DOCTOR_VERSION`. TCO-027; static data, so config

## `tests/config/cli/checks/framework/nextjs.ts`

- (the file) (file): **move** to `tests/config/nextjs.ts`. TCG-058 moves its rows to nextjs.test.ts; the static data goes to config
- ROUTE (const exported, 5-6): **move** to `tests/config/nextjs.ts` `NEXT_ROUTE`. TTC-037; static data, so config, prefixed because the file holds other Next.js samples
- MANIFEST (const exported, 8-9): **move** to `tests/config/nextjs.ts` `NEXT_PACKAGE_JSON`. glossary: manifest means only manifest.toml; TTC-037; static data, so config
- REPOSITORY (const exported, 11-20): **move** to `tests/config/nextjs.ts` `NEXT_REPOSITORY`. TCG-058; static data, so config; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- CASES (const exported, 22-47): **move** to `tests/config/nextjs.ts` `NEXT_CASES`. TCG-058; the react/version-pairs row goes because version-pairs.test.ts already reports and passes mismatched pairs; tests/config imports only tests/config, so the value drops its FindingCase annotation and is written as const, and the test that reads it checks the type

## `tests/config/cli/checks/framework/svelte.ts`

- (the file) (file): **move** to `tests/config/svelte.ts`. TCO-027; static data, so config
- PROJECTS (const exported, 1-14): **move** to `tests/config/svelte.ts` `SVELTE_PROJECTS`. TCO-027; TGN-044 buildPolicy; static data, so config; the sample writes a \[\[scope\]\] record with path = "app"
- LINES (const exported, 17-18): **move** to `tests/config/svelte.ts` `SVELTE_CHECK_OUTPUT`. TCO-027; static data, so config; the name says what it holds

## `tests/config/cli/checks/language/bash/conventions.ts`

- (the file) (file): **delete**. TCO-003
- SCRIPT (const exported, 1-2): **delete**. TCO-003
- ONLY (const exported, 4-4): **delete**. TCO-003

## `tests/config/cli/checks/language/bash/portable.ts`

- (the file) (file): **split** to `tests/config/bash/checks.ts; tests/config/repository.ts`. SIMPLE_EXECUTABLE goes with its deleted test, and the other constants go to config by topic: NODE_EMBEDS to bash/checks.ts, GENERATED_LAUNCHERS to repository.ts
- NODE_EMBEDS (const exported, 1-1): **move** to `tests/config/bash/checks.ts` `NODE_EMBEDS`. TCO-027; gspot's Bash check data, so tests/config/bash/checks.ts
- SIMPLE_EXECUTABLE (const exported, 3-4): **delete**. data used only by the deleted portable.test.ts 32-60
- GENERATED_LAUNCHERS (const exported, 6-11): **move** to `tests/config/repository.ts` `GENERATED_LAUNCHERS`. TCO-034; file classification samples, so config

## `tests/config/cli/checks/language/bash/safety.ts`

- (the file) (file): **move** to `tests/config/bash/checks.ts`. TCO-027; gspot's Bash check data, so tests/config/bash/checks.ts
- SAFETY_SOURCES (const exported, 1-10): **move** to `tests/config/bash/checks.ts` `SAFETY_SOURCES`. TCO-027; gspot's Bash check data, so tests/config/bash/checks.ts
- SUCCESS_SOURCE (const exported, 12-12): **delete**. data used only by the deleted safety.test.ts 35-53
- NAMED_PATHS_SOURCE (const exported, 14-15): **delete**. TCO-005: names patterns of rules removed in 1f4d624f2
- WRONG_CLEANUP_SOURCE (const exported, 17-18): **move** to `tests/config/bash/checks.ts` `WRONG_CLEANUP_SOURCE`. TCO-027; gspot's Bash check data, so tests/config/bash/checks.ts
- RIGHT_CLEANUP_SOURCE (const exported, 20-21): **move** to `tests/config/bash/checks.ts` `RIGHT_CLEANUP_SOURCE`. TCO-027; gspot's Bash check data, so tests/config/bash/checks.ts

## `tests/config/cli/checks/language/bash/structure.ts`

- (the file) (file): **move** to `tests/config/bash/checks.ts`. TCG-058 puts each row in its check's file; every surviving item is gspot's Bash check data, so tests/config/bash/checks.ts
- REPOSITORY (const exported, 5-9): **merge** to `tests/config/bash/checks.ts` `BASH_REPOSITORY`. used by eleven Bash check test files and two general structure test files; the same data as the BASH_REPOSITORY of structure/findings.ts, with the default fixed file from cases.test.ts; plain data (configurations, files) with no prepare callback, since tests/config imports only tests/config and THR-024 removes sandbox callbacks, so each Bash check test marks scripts/build.sh executable with markExecutable before runCheckSample; the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- CASES (const exported, 11-154): **split** to `tests/config/bash/checks.ts` `SCRIPT_LAYOUT_CASES; DOC_COMMENT_CASES; UNUSED_FUNCTION_CASES; UNREAD_ARGUMENT_CASES; SOURCE_ORDER_CASES; WRAPPER_CASES; INLINE_SCRIPT_CASES; SSH_BLOCK_CASES; VARIABLE_DEFAULT_CASES; INCLUDE_GUARD_CASES; BASH_SAFETY_CASES; BASH_TRIVIAL_FUNCTION_CASES; BASH_ENV_READ_CASES`. TCG-058: one list per check in tests/config/bash/checks.ts, and each check file imports its own; delete the structure/import-comments and structure/private-before-public rows (CKG-055) and the bash/private-prefix row (private-prefix.test.ts already reports unprefixed and passes after the fix); the ssh-blocks row gets a fixed file with the comment line (TCO-003); TPP-029 template literals; architecture.roles.environment_readers is a list (TML-001, POL-030): environment_readers = \["scripts/settings.sh"\] and \["scripts/environment.sh"\]; the values drop their FindingCase annotation and are written as const, since tests/config imports only tests/config, and the tests that read them check the type

## `tests/config/cli/checks/language/css.ts`

- (the file) (file): **delete**. CKO-029
- DYNAMIC_READS (const exported, 2-5): **delete**. CKO-029

## `tests/config/cli/checks/language/html.ts`

- (the file) (file): **move** to `tests/config/html.ts`. TCO-027; static data, so config
- ACTIVE_URLS (const exported, 2-11): **move** to `tests/config/html.ts` `ACTIVE_URLS`. TCO-027; static data, so config
- INERT_MARKUP (const exported, 14-21): **move** to `tests/config/html.ts` `INERT_MARKUP`. TCO-027; static data, so config

## `tests/config/cli/checks/language/python/exports.ts`

- (the file) (file): **move** to `tests/config/python/checks.ts`. TCO-027: a one-line file; EXPORT_ORDER_FILES is built from it, so it goes to config; the Python check data goes to python/checks.ts because one python.ts would exceed 300 lines (about 330)
- SHOWN (const exported, 1-1): **move** to `tests/config/python/checks.ts` `SHOWN_FUNCTION`. TCO-027; the name says what it holds; Python check data, so tests/config/python/checks.ts

## `tests/config/cli/checks/language/python/installation.ts`

- (the file) (file): **move** to `tests/config/python/checks.ts`. TCO-027; Python check data, so tests/config/python/checks.ts
- IMPORT_CONTRACT_REPORT (const exported, 2-3): **move** to `tests/config/python/checks.ts` `IMPORT_CONTRACT_REPORT`. TCO-027; Python check data, so tests/config/python/checks.ts

## `tests/config/cli/checks/language/python/pydoclint.ts`

- (the file) (file): **move** to `tests/config/python/checks.ts`. TCO-027; Python check data, so tests/config/python/checks.ts
- DOCSTRING_STYLES (const exported, 2-34): **move** to `tests/config/python/checks.ts` `DOCSTRING_STYLES`. TCO-027; Python check data, so tests/config/python/checks.ts; rows 2 and 4 go (ST1-016)
- DOCSTRING_PROJECTS (const exported, 37-44): **delete**. TCO-022

## `tests/config/cli/checks/language/python/structure.ts`

- (the file) (file): **move** to `tests/config/python/checks.ts`. every surviving item is Python check data, so tests/config/python/checks.ts
- STRUCTURE_CLEAN (const exported, 5-6): **move** to `tests/config/python/checks.ts` `CLEAN_PYTHON_MODULE`. the default fixed file of the module rows; the name says what it holds; Python check data, so tests/config/python/checks.ts
- REPOSITORY (const exported, 8-16): **move** to `tests/config/python/checks.ts` `PYTHON_MODULE_REPOSITORY`. TCG-058; Python check data, so tests/config/python/checks.ts; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- LONG_FILE (const exported, 18-19): **move** to `tests/config/python/checks.ts` `LONG_PYTHON_FILE`. the Python file-lines row becomes a direct call beside the heredoc test; TTC-037; Python check data, so tests/config/python/checks.ts
- LONG_BODY (const exported, 21-21): **move** to `tests/config/python/checks.ts` `LONG_FUNCTION_BODY`. TTC-037; Python check data, so tests/config/python/checks.ts
- CASES (const exported, 23-52): **split** to `tests/config/python/checks.ts; tests/unit/cli/checks/general/structure/file-lines.test.ts` `PYTHON_MODULE_CASES; the file-lines row as a direct call`. TCG-058: the function-size, placeholder-docstrings and lazy-exports rows go to tests/config/python/checks.ts for modules.test.ts (CKO-022), and the file-lines row becomes a direct call in file-lines.test.ts; tests/config imports only tests/config, so the value drops its FindingCase annotation and is written as const, and the test that reads it checks the type

## `tests/config/cli/checks/language/sql.ts`

- (the file) (file): **move** to `tests/config/sql.ts`. two test files use it: the SQL unit test and the SQL integration test (TCO-027)
- FOREIGN_DIALECT_CASES (const exported, 1-5): **move** to `tests/config/sql.ts` `FOREIGN_DIALECT_CASES`. TCO-027

## `tests/config/cli/checks/language/swift.ts`

- (the file) (file): **move** to `tests/config/swift.ts`. the Swift test data goes to config
- SWIFT_PROJECT_SELECTION_CASES (const exported, 1-34): **move** to `tests/config/swift.ts` `SWIFT_PROJECT_SELECTION_CASES`. static data, so config; gspot init writes the project it finds and nothing is detected at check time, and absent xcode.project means the Swift package (TML-010, POL-033), so the rows "detects the root project" and "detects the scoped project without borrowing its parent" go
- SWIFT_BUILD_PURPOSES (const exported, 36-41): **move** to `tests/config/swift.ts` `SWIFT_BUILD_PURPOSES`. drop the periphery row (CKO-016); static data, so config

## `tests/config/cli/checks/library/drizzle.ts`

- (the file) (file): **move** to `tests/config/generated-files.ts`. only the generator survives, merged into the one generator script in config (TCO-002)
- DRIZZLE_MIGRATIONS_GENERATOR (const exported, 3-17): **merge** to `tests/config/generated-files.ts` `GENERATOR_SCRIPT`. TCO-002: one generator script for every row, kept in config
- DRIZZLE_MIGRATIONS_SCOPES (const exported, 19-19): **merge** to `tests/config/generated-files.ts` `GENERATOR_CASES`. TCO-002: the table rows live in config
- TABLES (const exported, 21-21): **delete**. TCO-003, TTC-037
- DRIZZLE_RELATIONS_CASES (const exported, 23-34): **delete**. TCO-003

## `tests/config/cli/checks/library/swift-snapshot-testing.ts`

- (the file) (file): **move** to `tests/config/swift.ts`. PACKAGE_PROJECTS goes with its deleted test; the rest is Swift test data, so config
- TEST_SOURCE (const, 5-5): **move** to `tests/config/swift.ts` `SNAPSHOT_TEST_SOURCE`. TCG-058; static data, so config, prefixed because the file holds other Swift samples
- REPOSITORY (const exported, 7-11): **move** to `tests/config/swift.ts` `SNAPSHOT_REPOSITORY`. TCG-058; static data, so config; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- CASES (const exported, 13-36): **move** to `tests/config/swift.ts` `SNAPSHOT_CASES`. TCG-058; static data, so config; tests/config imports only tests/config, so the value drops its FindingCase annotation and is written as const, and the test that reads it checks the type
- PACKAGE_PROJECTS (const exported, 39-48): **delete**. data used only by the deleted swift-snapshot-testing.test.ts 125-153
- DOCUMENTATION_LEVELS (const exported, 50-50): **delete**. TCO-004, TGN-037

## `tests/config/cli/checks/library/translations.ts`

- (the file) (file): **move** to `tests/config/translations.ts`. TCO-027; static data, so config
- NEXT_TRANSLATIONS (const exported, 6-6): **move** to `tests/config/translations.ts` `NEXT_TRANSLATIONS`. TTC-037; static data, so config
- REPOSITORY (const exported, 8-12): **move** to `tests/config/translations.ts` `TRANSLATION_REPOSITORY`. TCO-027; static data, so config; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- CASES (const exported, 14-27): **move** to `tests/config/translations.ts` `TRANSLATION_CASES`. TCO-027; static data, so config; tests/config imports only tests/config, so the value drops its FindingCase annotation and is written as const, and the test that reads it checks the type

## `tests/config/cli/checks/library/trpc.ts`

- (the file) (file): **move** to `tests/config/trpc.ts`. TCO-009; the tRPC test data goes to config
- TRPC_IMPORTS (const exported, 2-16): **move** to `tests/config/trpc.ts` `TRPC_IMPORTS`. TCO-009; static data, so config
- TRPC_TYPES (const exported, 18-19): **move** to `tests/config/trpc.ts` `TRPC_TYPES`. TCO-009; static data, so config
- TRPC_MODULES (const exported, 22-34): **move** to `tests/config/trpc.ts` `TRPC_MODULES`. TCO-009; the semicolon comment goes; static data, so config; the record header is \[\[architecture.module\]\]
- TRPC_LEVELS (const exported, 36-36): **delete**. TGN-037, TGN-037
- TRPC_COMMENT (const exported, 38-38): **inline** to `tests/config/trpc.ts` `TRPC_FILES`. TTC-037: one use, inside TRPC_FILES in config
- TRPC_FAILURES (const exported, 40-46): **move** to `tests/config/trpc.ts` `TRPC_FAILURES`. TCO-009; static data, so config
- TRPC_FILES (const exported, 49-69): **move** to `tests/config/trpc.ts` `TRPC_FILES`. TCO-009; static data, so config

## `tests/config/cli/checks/platform/cloudflare/configuration.ts`

- (the file) (file): **move** to `tests/config/cloudflare.ts`. only WRANGLER_SCHEMA survives, and it goes to config
- REPOSITORY (const exported, 5-16): **delete**. its two rows repeat the direct \_headers and \_redirects tests of cloudflare.test.ts, which report the same rules and show valid lines passing
- CASES (const exported, 18-29): **delete**. duplicate of the direct header and redirect tests (TCO-003 pattern)
- WRANGLER_SCHEMA (const exported, 31-41): **move** to `tests/config/cloudflare.ts` `WRANGLER_SCHEMA`. static data, so config

## `tests/config/cli/checks/platform/cloudflare/types.ts`

- (the file) (file): **delete**. every constant goes with the deleted Cloudflare failed-run and stale tests
- CLOUDFLARE_TYPES_GENERATOR (const exported, 1-6): **delete**. data used only by the deleted cloudflare/types.test.ts 71-86 and 88-113
- CLOUDFLARE_TYPES_SCOPES (const exported, 8-8): **delete**. data used only by the deleted cloudflare/types.test.ts 71-86 and 88-113

## `tests/config/cli/checks/platform/supabase/configuration.ts`

- (the file) (file): **move** to `tests/config/supabase.ts`. only STORAGE_POLICIES survives, and it goes to config
- SUPABASE_CONFIG (const exported, 1-2): **delete**. its only user is the supabase storage-policies row, which repeats the storage policy table
- MIGRATION (const exported, 4-6): **delete**. same as SUPABASE_CONFIG
- STORAGE_POLICIES (const exported, 9-40): **move** to `tests/config/supabase.ts` `STORAGE_POLICIES`. TCO-027; static data, so config

## `tests/config/cli/checks/platform/supabase/settings.ts`

- (the file) (file): **move** to `tests/config/supabase.ts`. the surviving Supabase settings data goes to config
- REPOSITORY (const exported, 6-14): **delete**. its one row (a bucket without a policy) repeats the storage policy table in supabase.test.ts
- CASES (const exported, 16-22): **delete**. duplicate of the storage policy table
- TEST_PATH_POLICY (const exported, 24-25): **move** to `tests/config/supabase.ts` `SERVICE_KEY_SETTINGS`. TCO-043; glossary settings, not policy; static data, so config; the sample writes a \[\[scope\]\] record with path = "apps/web" whose test_files are \["apps/web/qa/\*\*", "apps/web/verification/\*\*"\], written from the repository root (CFR-003)
- TEST_PATH_FILES (const exported, 27-34): **move** to `tests/config/supabase.ts` `SERVICE_KEY_READERS`. TCO-043; static data, so config
- SECRET_KEY_READS (const exported, 37-42): **move** to `tests/config/supabase.ts` `SECRET_KEY_READS`. TCO-027; static data, so config

## `tests/config/cli/checks/platform/supabase/types.ts`

- (the file) (file): **move** to `tests/config/supabase.ts`. follows the Supabase tests; static data, so config
- GENERATED_TYPES (const exported, 1-1): **move** to `tests/config/supabase.ts` `GENERATED_TYPES`. TCO-027; static data, so config
- DATABASE_SCHEMAS (const exported, 3-3): **move** to `tests/config/supabase.ts` `DATABASE_SCHEMAS`. TCO-027; static data, so config

## `tests/config/cli/checks/tool/docker.ts`

- (the file) (file): **move** to `tests/config/docker.ts`. follows the test file; it keeps its file name in tests/config/
- TRIVY_FINDINGS_EXIT (const exported, 2-2): **move** to `tests/config/docker.ts` `TRIVY_FINDINGS_EXIT`. TCO-027; static data, so config
- VALID_REPORT (const exported, 4-5): **move** to `tests/config/docker.ts` `VALID_REPORT`. TCO-027; static data, so config
- MIXED_REPORT (const exported, 7-8): **move** to `tests/config/docker.ts` `MIXED_REPORT`. TCO-027; static data, so config
- CLEAN_REPORT (const exported, 10-10): **delete**. its users go: the clean-report test (TCO-010) and the inconsistent-report row (CKO-013)
- COMPOSE_SOURCES (const exported, 12-24): **move** to `tests/config/docker.ts` `COMPOSE_SOURCES`. TCO-027; static data, so config
- REPORT_FAILURES (const exported, 26-57): **move** to `tests/config/docker.ts` `REPORT_FAILURES`. the two inconsistent-report rows go with the Trivy guard (CKO-013), and only 'a fatal registry failure' is left (ST1-016); static data, so config
- INVALID_COMPOSE (const exported, 59-63): **move** to `tests/config/docker.ts` `INVALID_COMPOSE`. TCO-027; static data, so config
- DOCKERIGNORE_CASES (const exported, 65-95): **move** to `tests/config/docker.ts` `DOCKERIGNORE_CASES`. TCO-027; TGN-044 buildPolicy; static data, so config; the sample writes \[\[scope\]\] records with path = "api" and "web"
- DOCKER_CONTEXT_CASES (const exported, 97-167): **move** to `tests/config/docker.ts` `DOCKER_CONTEXT_CASES`. TCO-027; static data, so config
- DOCKER_HOST_VERSION (const exported, 169-169): **move** to `tests/config/docker.ts` `DOCKER_VERSION`. TCO-027; static data, so config; the glossary retires 'host' for the machine
- COMPOSE_PAIRING_CASES (const exported, 171-176): **move** to `tests/config/docker.ts` `COMPOSE_PAIRING_CASES`. TCO-027; static data, so config

## `tests/config/cli/checks/tool/github-actions.ts`

- (the file) (file): **move** to `tests/config/github-actions.ts`. TCO-027; static data, so config
- PINACT_STUB (const exported, 1-15): **delete**. TCO-023
- PATH (const exported, 17-17): **move** to `tests/config/github-actions.ts` `CALLED_WORKFLOW`. TCO-041 (the $/ tests stay: IGN-012); static data, so config, and CALLED_WORKFLOW_REFERENCES is derived from it

## `tests/config/cli/checks/tool/jest-execution.ts`

- (the file) (file): **inline** to `tests/unit/cli/planning/checks.test.ts`. only SAMPLE survives
- OUTCOMES (const exported, 1-47): **delete**. TCO-008
- SAMPLE (const exported, 49-49): **inline** to `tests/unit/cli/planning/checks.test.ts` `coverage arguments leave other commands, your own checks, and given arguments unchanged`. one line of file text
- ZERO_COMMANDS (const exported, 51-55): **delete**. TCO-004: copies three manifest commands

## `tests/config/cli/checks/tool/nginx.ts`

- (the file) (file): **move** to `tests/config/nginx.ts`. TCO-027; static data, so config
- NGINX_CONFIGURATION (const exported, 1-17): **move** to `tests/config/nginx.ts` `NGINX_CONFIGURATION`. TCO-027; static data, so config

## `tests/config/cli/checks/tool/openapi-fresh.ts`

- (the file) (file): **move** to `tests/config/generated-files.ts`. TCO-002: the generator script lives in config
- OPENAPI_FRESH_GENERATOR (const exported, 1-9): **merge** to `tests/config/generated-files.ts` `GENERATOR_SCRIPT`. TCO-002: one generator script in config, which keeps the argument check for the openapi row
- SPECTRAL_SCOPES (const exported, 11-16): **delete**. TGN-037, TGN-037; its test goes
- SPECTRAL_RESULT (const exported, 18-18): **delete**. the Spectral test goes
- SPECTRAL_FINDING (const exported, 19-19): **delete**. the Spectral test goes
- SPECTRAL_MISSING_DOCUMENT (const exported, 20-26): **delete**. the Spectral test goes

## `tests/config/cli/checks/tool/swift-tests/execution.ts`

- (the file) (file): **split** to `tests/config/swift.ts; tests/unit/cli/checks/testing/swift-tests.test.ts`. TCO-027: the settings and the failure table go to config; SHEBANG stays in the test because it is built from process.execPath
- XCTEST_EXECUTION_POLICY (const exported, 1-7): **move** to `tests/config/swift.ts` `XCTEST_SETTINGS`. TCO-027; glossary settings, not policy; static data, so config; \[xcode\] project and scheme (POL-033), and the coverage target is a \[\[coverage.target\]\] record with name = "Example" and lines = 80, with no reason because 80 is not below coverage.lines (TMF-004)
- SHEBANG (const exported, 9-9): **move** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `SHEBANG`. TCO-027; it stays in the test file because it is built from process.execPath at load time
- XCTEST_FAILURES (const exported, 11-52): **move** to `tests/config/swift.ts` `XCTEST_FAILURES`. TCO-027; static data, so config; the no-project row writes no xcode.project (absent means the Swift package, so the run still skips; TML-010) and \[xcode\] scheme; the coverage minimum is a \[\[coverage.target\]\] record with name and lines

## `tests/config/cli/checks/tool/swift-tests/sources.ts`

- (the file) (file): **delete**. its one constant served only the deleted tests (TCO-004, TCO-013)
- XCTEST_FILES (const exported, 4-8): **delete**. TCO-004, TCO-013

## `tests/config/cli/checks/tool/xcode/resources.ts`

- (the file) (file): **move** to `tests/config/xcode.ts`. TCO-027; static data, so config
- ASSET_SETTING_CASES (const exported, 1-26): **move** to `tests/config/xcode.ts` `ASSET_SETTING_CASES`. TCO-027; static data, so config

## `tests/config/cli/checks/tool/xcode/scopes.ts`

- (the file) (file): **move** to `tests/config/xcode.ts`. follows the split table; static data, so config
- INVALID_XCODE_DOCUMENTS (const exported, 2-11): **split** to `tests/config/xcode.ts` `INVALID_TEST_PLAN_DOCUMENTS; INVALID_RESOURCE_DOCUMENTS`. the test-plans rows go to project, the xcstrings and assets rows to resources; one row per document type (ST1-016); static data, so config

## `tests/types/cli/checks/cases.ts`

- (the file) (file): **delete**. TCO-029; cases.test.ts goes (TCG-058)
- FindingScenario (type exported, 5-5): **delete**. TCG-058

## `tests/types/cli/checks/drizzle.ts`

- (the file) (file): **delete**. TCO-029
- MigrationProject (type exported, 4-11): **delete**. TCO-029, TCO-002: the helper it typed goes

## `tests/types/cli/checks/framework/expo.ts`

- (the file) (file): **delete**. TCO-029: TypeScript infers the table type
- DoctorResult (type exported, 4-4): **delete**. TCO-029

## `tests/types/cli/checks/framework/nextjs.ts`

- (the file) (file): **delete**. TCO-029, TCO-048
- NextjsCommands (type exported, 2-2): **delete**. TCO-048: the return type is inferred

## `tests/types/cli/checks/license-origins.ts`

- (the file) (file): **delete**. TCG-035
- ExceptionMembership (type exported, 3-3): **delete**. TCG-035: the license helper takes the test.each row without a named type

## `tests/types/cli/checks/openapi.ts`

- (the file) (file): **delete**. TCO-029
- OpenapiProject (type exported, 4-10): **delete**. TCO-029, TCO-002

## `tests/types/cli/checks/platform/cloudflare.ts`

- (the file) (file): **delete**. TCO-029
- WorkerTypesProject (type exported, 3-9): **delete**. TCO-029, TCO-002

## `tests/types/cli/checks/platform/supabase.ts`

- (the file) (file): **inline** to `tests/unit/cli/checks/stale-generated-files.test.ts`. TCO-029
- SupabaseInvocation (type exported, 3-3): **inline** to `tests/unit/cli/checks/stale-generated-files.test.ts` `prepareSupabaseCheck`. the requests array needs { args: string\[\]; cwd: string }\[\] once
- SupabaseProject (type exported, 5-9): **delete**. TCO-029: the return type is inferred

## `tests/types/cli/checks/security.ts`

- (the file) (file): **inline** to `tests/unit/cli/checks/general/security.test.ts`. TCG-035
- CapturedInvocation (type exported, 2-2): **inline** to `tests/unit/cli/checks/general/security.test.ts` `%s (the CodeQL ignore table)`. TCG-035: { argv: string\[\]; cwd: string }\[\] written once

## `tests/types/cli/checks/site.ts`

- (the file) (file): **delete**. TCG-035
- SvgSavingCase (type exported, 2-8): **delete**. TCG-035: as const types the table
