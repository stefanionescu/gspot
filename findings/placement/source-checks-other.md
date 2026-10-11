# Source: the language, framework, library, platform, infrastructure, testing, and database checks

325 rows. rename 102, keep 100, move 89, delete 25, inline 6, merge 3.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/checks/database/postgres/access.ts`

- isLooseDefiner (function, 13-23): **keep** to `packages/cli/src/checks/database/postgres/access.ts` `isLooseDefiner`. Real logic of postgres/definer-search-path; access.ts keeps its name (CKO-004 layout).
- statementFindings (function, 25-44): **keep** to `packages/cli/src/checks/database/postgres/access.ts` `statementFindings`. Two callers (grants, definer-search-path).
- rls (function exported, 51-66): **rename** to `packages/cli/src/checks/database/postgres/access.ts` `postgresRowLevelSecurity`. Check postgres/rls becomes postgres/row-level-security; CKO-019 names the export after its check ID; CKO-003 summary text.
- grants (function exported, 73-92): **rename** to `packages/cli/src/checks/database/postgres/access.ts` `postgresGrants`. CKO-019, CKO-019: the export is named after its check ID.
- definerSearchPath (function exported, 99-103): **rename** to `packages/cli/src/checks/database/postgres/access.ts` `postgresDefinerSearchPath`. CKO-019, CKO-019: the export is named after its check ID.

## `packages/cli/src/checks/database/postgres/contracts.ts`

- qualifyRelation (function, 15-18): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `qualifyRelation`. CKO-004: contracts.ts is renamed in place to schema.ts (ARC-002).
- forgetTable (function, 20-25): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `forgetTable`. CKO-004: contracts.ts is renamed in place to schema.ts; two callers.
- qualifyParts (function, 27-29): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `qualifyParts`. CKO-004: contracts.ts is renamed in place to schema.ts; two calls in readDrop.
- constraintName (function, 32-38): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `constraintName`. CKO-004: contracts.ts is renamed in place to schema.ts.
- recordForeignKey (function, 41-52): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `recordForeignKey`. CKO-004: contracts.ts is renamed in place to schema.ts.
- recordConstraint (function, 56-69): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `recordConstraint`. CKO-004: contracts.ts is renamed in place to schema.ts.
- readCreateTable (function, 71-84): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `readCreateTable`. CKO-004: contracts.ts is renamed in place to schema.ts.
- ALTERATIONS (const, 87-99): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `ALTERATIONS`. CKO-004: contracts.ts is renamed in place to schema.ts; a table of functions that call recordConstraint stays in code, not config/.
- readAlterTable (function, 101-105): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `readAlterTable`. CKO-004: contracts.ts is renamed in place to schema.ts.
- readDrop (function, 108-128): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `readDrop`. CKO-004: contracts.ts is renamed in place to schema.ts.
- READERS (const, 130-141): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `READERS`. CKO-004: contracts.ts is renamed in place to schema.ts; no CreatePolicyStmt reader is needed (CKO-003); a table of reader functions stays in code, not config/.
- summarize (function, 144-153): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `summarize`. CKO-004: contracts.ts is renamed in place to schema.ts.
- buildSchema (function exported, 160-170): **rename** to `packages/cli/src/checks/database/postgres/schema.ts` `buildSchema`. CKO-004: contracts.ts is renamed in place to schema.ts; users access.ts and foreign-keys.ts.

## `packages/cli/src/checks/database/postgres/foreign-keys.ts`

- foreignKeyIndexes (function exported, 14-26): **rename** to `packages/cli/src/checks/database/postgres/foreign-keys.ts` `postgresForeignKeyIndexes`. CKO-019, CKO-019: the export is named after its check ID.

## `packages/cli/src/checks/database/postgres/history.ts`

- COMMITTED_MIGRATIONS_MEMO (const, 12-12): **keep** to `packages/cli/src/checks/database/postgres/history.ts` `COMMITTED_MIGRATIONS_MEMO`. File-local memo key of committedMigrationTexts; a cache handle whose create function is code, so it stays here, not in config/.
- readCommittedMigrations (function, 14-33): **keep** to `packages/cli/src/checks/database/postgres/history.ts` `readCommittedMigrations`. CKO-013: drop the missing-blob throw once getBlobs returns buffers in request order.
- committedMigrationTexts (function, 35-44): **keep** to `packages/cli/src/checks/database/postgres/history.ts` `committedMigrationTexts`. CKO-026: the body becomes one keyed memo call; two callers.
- migrationOrder (function exported, 51-102): **rename** to `packages/cli/src/checks/database/postgres/history.ts` `postgresMigrationOrder`. CKO-019, CKO-019: the export is named after its check ID.
- migrationsFrozen (function exported, 109-135): **rename** to `packages/cli/src/checks/database/postgres/history.ts` `postgresEditedMigrations`. Check postgres/migrations-frozen becomes postgres/edited-migrations; CKO-019 names the export after its check ID.

## `packages/cli/src/checks/database/postgres/public.ts`

- MIGRATION_MEMO (const, 25-25): **rename** to `packages/cli/src/checks/database/postgres/migrations.ts` `MIGRATION_MEMO`. CKO-004: public.ts is renamed in place to migrations.ts; a memo key is a cache handle typed with Migration from types/, so it stays in code, not config/.
- readMigrations (function, 27-47): **rename** to `packages/cli/src/checks/database/postgres/migrations.ts` `parseMigrations`. CKO-004: public.ts is renamed in place to migrations.ts; it parses the files, and its old name goes to the exported reader.
- headerFindings (function, 49-77): **delete**. CKO-041: check postgres/migration-docs is deleted with its tests and the postgres.doc_sections setting.
- sectionFindings (function, 79-96): **delete**. CKO-041: check postgres/migration-docs is deleted, so this helper goes.
- commentsAbove (function, 99-108): **delete**. CKO-041: check postgres/migration-docs is deleted, so this helper goes.
- statementFindings (function, 110-148): **delete**. CKO-041: check postgres/migration-docs is deleted, so this helper goes.
- migrationsOf (function exported, 155-186): **rename** to `packages/cli/src/checks/database/postgres/migrations.ts` `readMigrations`. CKO-004: renamed readMigrations, without the Of suffix, for access.ts, foreign-keys.ts, history.ts and platform/supabase.ts; CKO-026 keyed memo; the shared migrationFiles call becomes migrationPaths(input) here, which supabaseMigrationNames also calls (S02-004); postgres.migrations_folder is absent when unset (TML-010), and the path is root-relative, so migrationFiles does not join the scope folder to it (CFR-003). Values to config: DOWN_MIGRATION_SUFFIX = '.down.sql' -&gt; packages/cli/src/config/checks/database.ts.
- docFindings (function exported, 195-207): **delete**. CKO-041: check postgres/migration-docs is deleted; its test migration-docs.test.ts goes with it.
- migrationDocs (function exported, 214-219): **delete**. CKO-041: check postgres/migration-docs is deleted; remove it from the manifest and checks/built-in.ts.

## `packages/cli/src/checks/framework/contracts.ts`

- svelteFindings (function exported, 18-42): **rename** to `packages/cli/src/checks/framework/svelte.ts` `svelteFindings`. CKO-004: contracts.ts is renamed in place to svelte.ts; CKO-032 takes input, uses findingAt, and falls back to rule svelte-check; TCO-014 toolPath; the export stays for its unit test.
- svelteCheck (function exported, 49-69): **rename** to `packages/cli/src/checks/framework/svelte.ts` `svelteCheck`. CKO-004: contracts.ts is renamed in place to svelte.ts; CKO-011 one tool-error helper. Values to config: SVELTE_CHECK_COMMAND = \['svelte-check', '--workspace', '.', '--output', 'machine-verbose', '--fail-on-warnings'\] -&gt; packages/cli/src/config/checks/framework/svelte.ts; SVELTE_TSCONFIG_FLAG = '--tsconfig' -&gt; packages/cli/src/config/checks/framework/svelte.ts; TSCONFIG_TOOL_FILE = 'tsconfig' -&gt; packages/cli/src/config/checks/framework/svelte.ts.

## `packages/cli/src/checks/framework/expo.ts`

- hasInstalledExpo (function, 12-20): **keep** to `packages/cli/src/checks/framework/expo.ts` `hasInstalledExpo`. Real check: Doctor exits 0 without an installed expo package. Values to config: EXPO_PACKAGE_JSON = 'expo/package.json' -&gt; packages/cli/src/config/checks/framework/expo.ts; PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.
- expoDoctor (function exported, 27-54): **keep** to `packages/cli/src/checks/framework/expo.ts` `expoDoctor`. CKO-014: the manifest when = dependencies expo replaces the code skip; CKO-032 and CKO-011; PAR-011 parseExpoDoctor moves in; the error says 'package.json is missing', because the glossary keeps manifest for manifest.toml (CKO-007). Values to config: EXPO_DOCTOR_COMMAND = \['expo-doctor'\] -&gt; packages/cli/src/config/checks/framework/expo.ts; PACKAGE_JSON (from packages/cli/src/config/parsers/dependency-files.ts).

## `packages/cli/src/checks/framework/public.ts`

- sourcePaths (function, 27-29): **merge** to `packages/cli/src/checks/finding.ts` `sourcePaths`. CKO-038: one sourcePaths(input, endings?) helper for the four copies.
- failureSummary (function, 32-37): **rename** to `packages/cli/src/checks/framework/nextjs.ts` `failureSummary`. CKO-004: public.ts is renamed in place to nextjs.ts; two callers.
- routeSegments (function exported, 44-66): **rename** to `packages/cli/src/checks/framework/nextjs.ts` `nextjsRouteSegments`. CKO-004: public.ts is renamed in place to nextjs.ts; CKO-019 names the export after its check; CKO-030 keeps the check, and the manifest says why. Values to config: APP_FOLDER = '/app/' -&gt; packages/cli/src/config/checks/framework/nextjs.ts.
- nextConfiguration (function exported, 73-89): **rename** to `packages/cli/src/checks/framework/nextjs.ts` `nextConfig`. CKO-004: public.ts is renamed in place to nextjs.ts; CKO-019 camelCase of check nextjs/next-config; PAR-011 nextSettingsFindings moves in.
- nextjsTsc (function exported, 97-138): **rename** to `packages/cli/src/checks/framework/nextjs.ts` `nextjsTsc`. CKO-004: public.ts is renamed in place to nextjs.ts; CKO-013 drops the typescript/tsc guard; DEC-008 copies with copyIntoScratch(checkInput). Values to config: NEXT_TYPEGEN_COMMAND = \['next', 'typegen'\] -&gt; packages/cli/src/config/checks/framework/nextjs.ts; CI_ENVIRONMENT = { CI: '1' } -&gt; packages/cli/src/config/checks/framework/nextjs.ts; TYPESCRIPT_TAG = 'typescript' -&gt; packages/cli/src/config/repository/inventory.ts; TYPESCRIPT_TSC_CHECK = 'typescript/tsc' -&gt; packages/cli/src/config/checks/language/typescript.ts; TSC_TOOL = 'tsc' -&gt; packages/cli/src/config/checks/language/typescript.ts.
- nextBuild (function exported, 145-166): **rename** to `packages/cli/src/checks/framework/nextjs.ts` `nextjsBuild`. CKO-004: public.ts is renamed in place to nextjs.ts; CKO-019 names it nextjsBuild; PAR-021 parseNextBuildFlags moves in. Values to config: NEXT_BUILD_COMMAND = \['next', 'build'\] (the default build script text is NEXT_BUILD_COMMAND.join(' ')) -&gt; packages/cli/src/config/checks/framework/nextjs.ts; CI_ENVIRONMENT (from packages/cli/src/config/checks/framework/nextjs.ts); PACKAGE_JSON (from packages/cli/src/config/parsers/dependency-files.ts).

## `packages/cli/src/checks/language/bash/contract.ts`

- strictModeFindings (function, 23-29): **rename** to `packages/cli/src/checks/language/bash/script-layout.ts` `strictModeFindings`. Check bash/contract becomes bash/script-layout, and the file is named after its check (CKO-018); CKO-035. Values to config: BASH_OPTION_COMMANDS = \['set ', 'shopt '\] -&gt; packages/cli/src/config/checks/language/bash.ts.
- entryFindings (function, 31-37): **rename** to `packages/cli/src/checks/language/bash/script-layout.ts` `entryFindings`. Check bash/contract becomes bash/script-layout, and the file is named after its check (CKO-018); CKO-035. Values to config: MAIN_FUNCTION (from packages/cli/src/config/checks/language/bash.ts).
- libraryLineFindings (function, 39-59): **rename** to `packages/cli/src/checks/language/bash/script-layout.ts` `libraryLineFindings`. Check bash/contract becomes bash/script-layout, and the file is named after its check (CKO-018). Values to config: SET_COMMAND = 'set ' -&gt; packages/cli/src/config/checks/language/bash.ts.
- libraryFindings (function, 61-81): **rename** to `packages/cli/src/checks/language/bash/script-layout.ts` `libraryFindings`. Check bash/contract becomes bash/script-layout, and the file is named after its check (CKO-018); glossary: env files, not configuration owners. Values to config: MAIN_FUNCTION (from packages/cli/src/config/checks/language/bash.ts).
- fileFindings (function, 83-98): **rename** to `packages/cli/src/checks/language/bash/script-layout.ts` `fileFindings`. Check bash/contract becomes bash/script-layout, and the file is named after its check (CKO-018); CKO-012 deletes the shebang filter; CKO-035 one if/else.
- contract (function exported, 105-111): **rename** to `packages/cli/src/checks/language/bash/script-layout.ts` `bashScriptLayout`. Check bash/contract becomes bash/script-layout (CKO-018); CKO-019 names the export after its check; CKO-020 export async function; it reads architecture.roles.environment_readers. Values to config: ENV_ROLE = 'environment_readers' -&gt; packages/cli/src/config/settings/values.ts.

## `packages/cli/src/checks/language/bash/doc-comments.ts`

- blockAbove (function, 15-25): **keep** to `packages/cli/src/checks/language/bash/doc-comments.ts` `blockAbove`. One caller, real logic.
- isMeaningful (function, 27-35): **keep** to `packages/cli/src/checks/language/bash/doc-comments.ts` `isMeaningful`. One caller, real logic. Values to config: LEADING_UNDERSCORES = /^\_+/u -&gt; packages/cli/src/config/checks/language/bash.ts.
- docFinding (function, 37-59): **keep** to `packages/cli/src/checks/language/bash/doc-comments.ts` `docFinding`. One caller, real logic.
- docComments (function exported, 66-77): **rename** to `packages/cli/src/checks/language/bash/doc-comments.ts` `bashDocComments`. CKO-019 names the export after its check; CKO-020 export async function. Values to config: MAIN_FUNCTION (from packages/cli/src/config/checks/language/bash.ts).

## `packages/cli/src/checks/language/bash/embeds.ts`

- embeds (function exported, 11-28): **rename** to `packages/cli/src/checks/language/bash/inline-scripts.ts` `bashInlineScripts`. Check bash/embeds becomes bash/inline-scripts, and the file is named after its check (CKO-018); CKO-019 names the export after its check; CKO-012 deletes the comment filter; CKO-020 export async function.

## `packages/cli/src/checks/language/bash/function-size.ts`

- runAstGrep (function, 23-41): **delete**. CKO-001: count branches, nesting and assignments from the tree-sitter parse, so the ast-grep run goes.
- nestingDepth (function, 43-55): **delete**. CKO-001: count branches, nesting and assignments from the tree-sitter parse, so this helper goes.
- countFindings (function, 64-90): **delete**. CKO-001: count branches, nesting and assignments from the tree-sitter parse, so this helper goes.
- functionSize (function exported, 97-119): **rename** to `packages/cli/src/checks/language/bash/function-size.ts` `bashFunctionSize`. CKO-019, CKO-019: the export is named after its check; CKO-001 compares parser counts with limits.bash.\*.

## `packages/cli/src/checks/language/bash/guards.ts`

- bashVariableDefaults (function exported, 15-35): **move** to `packages/cli/src/checks/language/bash/variable-defaults.ts` `bashVariableDefaults`. CKO-018: split from guards.ts into its own check file; CKO-012 deletes the comment filter; CKO-020 export async function; the summary says env files; it reads architecture.roles.environment_readers through ENV_ROLE. Values to config: ENV_ROLE (from packages/cli/src/config/settings/values.ts).
- guards (function exported, 42-84): **rename** to `packages/cli/src/checks/language/bash/include-guards.ts` `bashIncludeGuards`. Check bash/guards becomes bash/include-guards, and the file is named after its check (CKO-018); CKO-019 and CKO-020; guard-shared compares guard names across files, so the check declares runs = "scope" in configurations/language/bash/manifest.toml (S02-002); it reads architecture.roles.environment_readers through ENV_ROLE. Values to config: ENV_ROLE (from packages/cli/src/config/settings/values.ts).

## `packages/cli/src/checks/language/bash/safety.ts`

- safety (function exported, 11-25): **rename** to `packages/cli/src/checks/language/bash/safety.ts` `bashSafety`. CKO-019 names the export after its check; CKO-020 export async function.

## `packages/cli/src/checks/language/bash/shellcheck.ts`

- shellcheck (function exported, 15-37): **keep** to `packages/cli/src/checks/language/bash/shellcheck.ts` `shellcheck`. CKO-010: the shared runCommandGroups loop; CKO-036; the name is the tool, like deptry. Values to config: SHELLCHECK_DIALECT_FLAG = '--shell=' -&gt; packages/cli/src/config/repository/inventory.ts; DEFAULT_DIALECT = 'bash' -&gt; packages/cli/src/config/repository/inventory.ts; BATS_TAG = 'bats' -&gt; packages/cli/src/config/repository/inventory.ts.

## `packages/cli/src/checks/language/bash/sources.ts`

- sourceRuns (function, 8-17): **rename** to `packages/cli/src/checks/language/bash/source-order.ts` `sourceRuns`. CKO-018: sources.ts is renamed in place to source-order.ts, after its check.
- sourceOrder (function exported, 24-44): **rename** to `packages/cli/src/checks/language/bash/source-order.ts` `bashSourceOrder`. CKO-018: the file is named after its check; CKO-019 and CKO-020; CKO-039 shared byLengthThenName.

## `packages/cli/src/checks/language/bash/ssh.ts`

- sshBlocks (function exported, 11-28): **rename** to `packages/cli/src/checks/language/bash/ssh-blocks.ts` `bashSshBlocks`. CKO-018: ssh.ts is renamed in place to ssh-blocks.ts, after its check; CKO-019 and CKO-020. Values to config: NAMED_COMMENT = /^# \[A-Za-z\_\]\\w\*:\\s+\\S/u -&gt; packages/cli/src/config/checks/language/bash.ts.

## `packages/cli/src/checks/language/bash/unread-arguments.ts`

- unreadArguments (function exported, 9-36): **rename** to `packages/cli/src/checks/language/bash/unread-arguments.ts` `bashUnreadArguments`. CKO-019 names the export after its check; CKO-020; it reads calls across files, so the check declares runs = "scope" in the bash manifest (S02-002).

## `packages/cli/src/checks/language/bash/unused-functions.ts`

- unusedFunctions (function exported, 11-26): **rename** to `packages/cli/src/checks/language/bash/unused-functions.ts` `bashUnusedFunctions`. CKO-019 names the export after its check; CKO-020; CKO-030 the manifest says why: ShellCheck SC2329 checks one file; a commit hook would give it only the staged scripts, so the check declares runs = "scope" (S02-002). Values to config: MAIN_FUNCTION (from packages/cli/src/config/checks/language/bash.ts).

## `packages/cli/src/checks/language/bash/visibility.ts`

- privatePrefix (function exported, 11-49): **rename** to `packages/cli/src/checks/language/bash/private-prefix.ts` `bashPrivatePrefix`. CKO-018: visibility.ts is renamed in place to private-prefix.ts, after its check; CKO-019 and CKO-020; CKO-006 isToolProject becomes isPrivate; other callers may be unstaged, so the check declares runs = "scope" (S02-002). Values to config: PRIVATE_PREFIX = '\_' -&gt; packages/cli/src/config/checks/language/bash.ts; MAIN_FUNCTION (from packages/cli/src/config/checks/language/bash.ts).

## `packages/cli/src/checks/language/bash/wrappers.ts`

- wrappers (function exported, 20-58): **rename** to `packages/cli/src/checks/language/bash/wrappers.ts` `bashWrappers`. CKO-019 names the export after its check; CKO-012 deletes the shebang filter; CKO-020.

## `packages/cli/src/checks/language/contracts.ts`

- TYPESCRIPT_CHECKS (const, 31-31): **move** to `packages/cli/src/checks/language/typescript/project.ts` `CHECKED_PROJECTS`. CKO-004: the TypeScript part of language/contracts.ts moves to typescript/project.ts; NMS table B name; a memo key is a cache handle whose create function is code, so it stays here, not in config/.
- SCRIPT_MEMO (const, 33-33): **move** to `packages/cli/src/checks/language/bash/scripts.ts` `SCRIPT_MEMO`. CKO-004: the Bash reader of language/contracts.ts moves to bash/scripts.ts; a memo key is a cache handle typed with ScriptFile from types/, so it stays here, not in config/.
- readScript (function, 35-55): **move** to `packages/cli/src/checks/language/bash/scripts.ts` `readScript`. CKO-004: the Bash reader of language/contracts.ts moves to bash/scripts.ts.
- readScriptIndex (function, 57-64): **inline** to `packages/cli/src/checks/language/bash/scripts.ts` `readScripts`. CKO-004: its owners map has no production reader, so a three-line read loop is left inside readScripts.
- assertOutputsInside (function, 67-76): **delete**. DEC-008: it guards a state a normal repository never reaches.
- assertBuildInside (function, 78-81): **delete**. DEC-008: it guards a state a normal repository never reaches.
- getScriptIndex (function exported, 88-100): **move** to `packages/cli/src/checks/language/bash/scripts.ts` `readScripts`. CKO-004: moves to bash/scripts.ts; NMS table B (get becomes read); returns ScriptFile\[\] once ScriptIndex goes; CKO-026 keyed memo; the tag constant is SCRIPT_TAG. Values to config: SCRIPT_TAG (from packages/cli/src/config/repository/inventory.ts).
- functionAt (function exported, 108-112): **move** to `packages/cli/src/checks/language/bash/scripts.ts` `functionAt`. CKO-004: moves to bash/scripts.ts; users bash/script-layout, function-size, source-order.
- scopeCompilerProject (function exported, 122-143): **move** to `packages/cli/src/checks/language/typescript/tsc.ts` `scopeCompilerProject`. CKO-004: moves to typescript/tsc.ts; CKO-023 leaves javascriptTsc its only caller; stop exporting. Values to config: JSCONFIG_FILE = 'jsconfig.json' -&gt; packages/cli/src/config/parsers/tsconfig.ts.
- writeScopeProject (function exported, 153-181): **inline** to `packages/cli/src/checks/language/typescript/tsc.ts` `javascriptTsc`. CKO-023: inlined into javascriptTsc; CKO-013: its early return repeats the caller test.
- appendBuildMetadata (function exported, 190-198): **move** to `packages/cli/src/checks/language/typescript/project.ts` `appendBuildMetadata`. CKO-004: moves to typescript/project.ts; users runTsc and javascriptTsc. Values to config: TSBUILDINFO_FLAG = '--tsBuildInfoFile' -&gt; packages/cli/src/config/checks/language/typescript.ts.
- restoreCommandPaths (function exported, 207-213): **move** to `packages/cli/src/checks/language/typescript/project.ts` `restoreCommandPaths`. CKO-004: moves to typescript/project.ts; users typescript/tsc.ts and framework/nextjs.ts.
- compilerFiles (function exported, 222-254): **delete**. DEC-008: copy the scope with copyIntoScratch(checkInput(...)) instead of a compiler-chosen file set, so this goes with its copy-input tests.
- compilerCopyInputs (function exported, 264-280): **delete**. DEC-008: the same plain scratch copy as nextjsTsc without a tsconfig replaces it.
- projectChecked (function exported, 291-308): **move** to `packages/cli/src/checks/language/typescript/project.ts` `projectChecked`. CKO-004: moves to typescript/project.ts; users runTsc and typescriptTsconfig.
- runTsc (function exported, 317-361): **move** to `packages/cli/src/checks/language/typescript/project.ts` `runTsc`. CKO-004: moves to typescript/project.ts; users tsc and nextjsTsc; it uses TOOL_FILE_DIRECTORY instead of writing '.gspot/config' by hand, as javascriptTsc and the Swift checks do (S02-003). Values to config: TYPESCRIPT_TAG (from packages/cli/src/config/repository/inventory.ts); TYPESCRIPT_TSCONFIG_CHECK = 'typescript/tsconfig' -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSCONFIG_FILE = 'tsconfig.json' -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSC_BUILD_COMMAND = \['tsc', '-b'\] -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSC_PROJECT_COMMAND = \['tsc', '--noEmit', '-p'\] -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSC_PLAIN_OUTPUT = \['--pretty', 'false'\] -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSCONFIG_TSBUILDINFO = 'tsconfig.tsbuildinfo' -&gt; packages/cli/src/config/parsers/tsconfig.ts.

## `packages/cli/src/checks/language/css.ts`

- sheetFindings (function, 13-43): **delete**. CKO-029: eslint-plugin-css-modules does what css/module-classes does, so the check goes.
- moduleClasses (function exported, 50-64): **delete**. CKO-029: eslint-plugin-css-modules does what css/module-classes does, so the check goes; PAR-012: parsers/css.ts goes with it.

## `packages/cli/src/checks/language/html.ts`

- withoutPlaceholders (function, 23-35): **keep** to `packages/cli/src/checks/language/html.ts` `withoutPlaceholders`. Two calls in literalFindings.
- isActiveResource (function, 38-43): **keep** to `packages/cli/src/checks/language/html.ts` `isActiveResource`. One caller, real logic.
- scriptScheme (function, 46-61): **keep** to `packages/cli/src/checks/language/html.ts` `scriptScheme`. One caller, real logic; one placeholder origin, PLACEHOLDER_ORIGIN, serves the three URL parses (S01-011). Values to config: SCRIPT_SCHEMES = new Set(\['javascript:', 'vbscript:'\]) -&gt; packages/cli/src/config/checks/language/html.ts; PLACEHOLDER_ORIGIN (from packages/cli/src/config/checks/framework/site.ts).
- literalFindings (function, 63-95): **keep** to `packages/cli/src/checks/language/html.ts` `literalFindings`. One caller, real logic.
- inlineFindings (function, 97-120): **keep** to `packages/cli/src/checks/language/html.ts` `inlineFindings`. One caller, real logic.
- attributeFindings (function, 122-154): **keep** to `packages/cli/src/checks/language/html.ts` `attributeFindings`. One caller, real logic. Values to config: EVENT_ATTRIBUTE = /^on\[a-z\]+$/u -&gt; packages/cli/src/config/checks/language/html.ts.
- scripts (function exported, 161-170): **rename** to `packages/cli/src/checks/language/html.ts` `htmlScripts`. CKO-019, CKO-019: the export is named after its check; html/scripts runs per file over the manifest's .html and .htm source files, so the kind === 'source' filter goes and it maps input.files directly (S02-006).
- literals (function exported, 177-187): **rename** to `packages/cli/src/checks/language/html.ts` `htmlTemplateText`. CKO-018, CKO-019, CKO-019: the file and export are named after the check; CKO-014: when = setting html.templates replaces the empty-list branch.

## `packages/cli/src/checks/language/markdown.ts`

- fences (function exported, 13-36): **rename** to `packages/cli/src/checks/language/markdown.ts` `markdownFences`. CKO-019 names the export after its check; PAR-046: a tree-sitter Bash check replaces the bash -n callback, so \['bash', '-n'\] goes; markdown/fences declares files = { extensions = \[".md"\] } in configurations/language/markdown/manifest.toml, so the kind and .md tests go and no value moves (S02-006).

## `packages/cli/src/checks/language/public.ts`

- sourceStyle (function, 46-63): **move** to `packages/cli/src/checks/language/python/pydoclint.ts` `sourceStyle`. CKO-004: pydoclint leaves language/public.ts for python/pydoclint.ts.
- docstringGroups (function, 65-74): **move** to `packages/cli/src/checks/language/python/pydoclint.ts` `docstringGroups`. CKO-004: pydoclint leaves language/public.ts for python/pydoclint.ts; CKO-010: it feeds runCommandGroups.
- tsc (function exported, 82-106): **move** to `packages/cli/src/checks/language/typescript/tsc.ts` `tsc`. CKO-004: moves to typescript/tsc.ts and serves typescript/tsc and vue/vue-tsc; DEC-008 scratch copy with copyIntoScratch(checkInput); scratchFolder takes no prefix, so 'gspot-tsc-' needs no value (S01-013). Values to config: TYPESCRIPT_TAG (from packages/cli/src/config/repository/inventory.ts).
- checkjs (function exported, 114-152): **move** to `packages/cli/src/checks/language/typescript/tsc.ts` `javascriptTsc`. CKO-004: moves to typescript/tsc.ts; CKO-019 names it after check javascript/tsc; CKO-013 fixed jsconfig target, no guard; CKO-023 one empty result, and writeScopeProject is inlined. Values to config: JAVASCRIPT_TSC_COMMAND = \['tsc', '-p', '{tool_file:jsconfig}'\] (then TSC_PLAIN_OUTPUT) -&gt; packages/cli/src/config/parsers/tsconfig.ts; JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo' -&gt; packages/cli/src/config/parsers/tsconfig.ts; JSCONFIG_FILE (from packages/cli/src/config/parsers/tsconfig.ts).
- tsconfig (function exported, 159-195): **move** to `packages/cli/src/checks/language/typescript/tsconfig.ts` `typescriptTsconfig`. CKO-004: moves to typescript/tsconfig.ts; CKO-019 names the export after its check. Values to config: TSCONFIG_NAME = /^tsconfig\\.(?:.+\\.)?json$/u (replaces the startsWith and endsWith pair) -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSCONFIG_FILE (from packages/cli/src/config/parsers/tsconfig.ts); TYPESCRIPT_TAG (from packages/cli/src/config/repository/inventory.ts).
- docstringConfiguration (function exported, 203-213): **move** to `packages/cli/src/checks/language/python/pydoclint.ts` `docstringConfiguration`. CKO-004: moves to python/pydoclint.ts; the export stays for its direct table test (TCO-022).
- pydoclint (function exported, 221-249): **move** to `packages/cli/src/checks/language/python/pydoclint.ts` `pydoclint`. CKO-004: moves to python/pydoclint.ts; CKO-010 shared group loop, no one-group shortcut. Values to config: PYDOCLINT_STYLE_FLAG = '--style' -&gt; packages/cli/src/config/checks/language/python.ts; PYPROJECT_TOML (from packages/cli/src/config/parsers/dependency-files.ts).

## `packages/cli/src/checks/language/python/deptry.ts`

- deptry (function exported, 33-56): **keep** to `packages/cli/src/checks/language/python/deptry.ts` `deptry`. CKO-018: pip-installs leaves the file; the name is the tool. Values to config: DEPTRY_COMMAND = \['deptry', '.', '--no-ansi'\] -&gt; packages/cli/src/config/checks/language/python.ts; DEPTRY_EXCLUDE_FLAG = '--extend-exclude' -&gt; packages/cli/src/config/checks/language/python.ts; PYPROJECT_TOML (from packages/cli/src/config/parsers/dependency-files.ts).
- pipInstalls (function exported, 63-103): **move** to `packages/cli/src/checks/language/python/pip-installs.ts` `pythonPipInstalls`. CKO-018: split from deptry.ts into its own check file; CKO-019; CKO-040 reads the client list from the manifest, so \['uv', 'poetry', 'pdm'\] needs no config value.

## `packages/cli/src/checks/language/python/exports.ts`

- privatePrefix (function exported, 13-44): **rename** to `packages/cli/src/checks/language/python/exports.ts` `pythonPrivatePrefix`. CKO-019, CKO-019: the export is named after its check; config/checks/language/bash.ts keeps PRIVATE_PREFIX, so the Python value is PYTHON_PRIVATE_PREFIX (one name, one file). Values to config: PYTHON_PRIVATE_PREFIX = '\_' -&gt; packages/cli/src/config/checks/language/python.ts; DUNDER_PREFIX = '\_\_' -&gt; packages/cli/src/config/checks/language/python.ts.
- exportsAtBottom (function exported, 51-72): **rename** to `packages/cli/src/checks/language/python/exports.ts` `pythonExportsAtBottom`. CKO-019: the export is named after its check.
- packageExports (function exported, 79-96): **rename** to `packages/cli/src/checks/language/python/exports.ts` `pythonPackageExports`. CKO-019: the export is named after its check. Values to config: INIT_PY (from packages/cli/src/config/checks/language/python.ts).
- exportOrder (function exported, 103-122): **rename** to `packages/cli/src/checks/language/python/exports.ts` `pythonExportOrder`. CKO-019: the export is named after its check; CKO-039 shared byLengthThenName; CKO-030.

## `packages/cli/src/checks/language/python/function-size.ts`

- functionSize (function exported, 12-33): **move** to `packages/cli/src/checks/language/python/modules.ts` `pythonFunctionSize`. CKO-022: four small Python checks share python/modules.ts; CKO-019, CKO-019: the export is named after its check.

## `packages/cli/src/checks/language/python/functions.ts`

- placeholderDocstrings (function exported, 13-34): **move** to `packages/cli/src/checks/language/python/modules.ts` `pythonPlaceholderDocstrings`. CKO-022: four small Python checks share python/modules.ts; CKO-018. Values to config: NON_WORD_RUN = /\[^a-z\\d\]+/gu -&gt; packages/cli/src/config/checks/language/python.ts.

## `packages/cli/src/checks/language/python/imports.ts`

- contractConfiguration (function, 17-31): **rename** to `packages/cli/src/checks/language/python/import-linter.ts` `importLinterFile`. CKO-018: imports.ts is renamed in place to import-linter.ts; it returns import-linter's own settings file, and configuration means a selectable unit in the glossary, so it is importLinterFile (S02-005). Values to config: PYPROJECT_TOML (from packages/cli/src/config/parsers/dependency-files.ts).
- importLinter (function exported, 38-76): **rename** to `packages/cli/src/checks/language/python/import-linter.ts` `importLinter`. CKO-018: imports.ts is renamed in place to import-linter.ts; CKO-011; the name is the tool, like deptry and pydoclint. Values to config: LINT_IMPORTS_COMMAND = \['lint-imports', '--no-cache', '--verbose', '--config'\] (the file name goes last) -&gt; packages/cli/src/config/checks/language/python.ts.

## `packages/cli/src/checks/language/python/lazy-exports.ts`

- lazyExports (function exported, 13-31): **move** to `packages/cli/src/checks/language/python/modules.ts` `pythonModuleGetattr`. CKO-022: four small Python checks share python/modules.ts; check python/lazy-exports becomes python/module-getattr; CKO-019.

## `packages/cli/src/checks/language/python/singletons.ts`

- builtAtImport (function, 10-17): **move** to `packages/cli/src/checks/language/python/modules.ts` `builtAtImport`. CKO-022: four small Python checks share python/modules.ts.
- singletons (function exported, 24-41): **move** to `packages/cli/src/checks/language/python/modules.ts` `pythonSingletons`. CKO-022: four small Python checks share python/modules.ts; CKO-019 names the export after its check.

## `packages/cli/src/checks/language/sql.ts`

- sources (function, 14-21): **inline** to `packages/cli/src/checks/language/sql.ts` `sqlFunctions`. CKO-021: inlined into sqlFunctions without its kind === 'source' filter, because the check runs per file over the manifest's .sql source files (S02-006).
- isProceduralStatement (function, 24-29): **keep** to `packages/cli/src/checks/language/sql.ts` `isProceduralStatement`. Real logic of the PL/pgSQL count.
- countNodes (function, 31-40): **keep** to `packages/cli/src/checks/language/sql.ts` `countNodes`. CKO-024: walk with walkSqlTree from parsers/sql/postgres.ts.
- functionOption (function, 43-45): **keep** to `packages/cli/src/checks/language/sql.ts` `functionOption`. Two callers.
- sqlBody (function, 48-58): **keep** to `packages/cli/src/checks/language/sql.ts` `sqlBody`. One caller, real logic.
- bodyStatements (function, 61-73): **keep** to `packages/cli/src/checks/language/sql.ts` `bodyStatements`. One caller, real logic.
- functionFindings (function, 76-103): **keep** to `packages/cli/src/checks/language/sql.ts` `functionFindings`. CKO-021: limit, not threshold or maximum.
- fileFindings (function, 106-126): **keep** to `packages/cli/src/checks/language/sql.ts` `fileFindings`. One caller, real logic.
- trivialFunctions (function exported, 133-147): **rename** to `packages/cli/src/checks/language/sql.ts` `sqlFunctions`. CKO-021: check sql/trivial-functions becomes sql/functions; CKO-019 names the export after its check. Values to config: PARSED_DIALECT (from packages/cli/src/config/checks/language/sql.ts).

## `packages/cli/src/checks/language/swift/contracts.ts`

- BUILD_MEMO (const, 16-16): **rename** to `packages/cli/src/checks/language/swift/build.ts` `BUILD_MEMO`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; a memo key is a cache handle typed with SwiftBuildOutput from types/, so it stays here, not in config/.
- diagnostics (function, 18-44): **rename** to `packages/cli/src/checks/language/swift/build.ts` `outputFindings`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; glossary: finding, not diagnostic; three callers.
- expandResponseFiles (function, 48-54): **rename** to `packages/cli/src/checks/language/swift/build.ts` `expandResponseFiles`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts.
- runBuild (function, 56-72): **rename** to `packages/cli/src/checks/language/swift/build.ts` `runBuild`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; CKO-013: the cancel check stays.
- buildOutput (function, 75-80): **rename** to `packages/cli/src/checks/language/swift/build.ts` `buildOutput`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; CKO-026; NMS table B: local scopes become builds.
- withoutPrivatePrefix (function, 83-85): **rename** to `packages/cli/src/checks/language/swift/build.ts` `withoutPrivatePrefix`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; it stays unexported, because the compiler-diagnostics test passes two fixed strings (TCO-018). Values to config: MACOS_PRIVATE_REPLACEMENT = '$&lt;before&gt;/$&lt;folder&gt;/' -&gt; packages/cli/src/config/checks/language/swift.ts.
- swiftBuild (function exported, 92-101): **rename** to `packages/cli/src/checks/language/swift/build.ts` `swiftBuild`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; CKO-011. Values to config: BUILD_LEVELS = \['error'\] -&gt; packages/cli/src/config/checks/language/swift.ts.
- swiftlintAnalyze (function exported, 108-121): **rename** to `packages/cli/src/checks/language/swift/build.ts` `swiftlintAnalyze`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; CKO-011. Values to config: SWIFTLINT_YML = 'swiftlint.yml' -&gt; packages/cli/src/config/checks/language/swift.ts; SWIFTLINT_ANALYZE_COMMAND = \['swiftlint', 'analyze', '--strict', '--quiet'\] -&gt; packages/cli/src/config/checks/language/swift.ts; SWIFTLINT_CONFIG_FLAG = '--config' -&gt; packages/cli/src/config/checks/language/swift.ts; COMPILER_LOG_FLAG = '--compiler-log-path' -&gt; packages/cli/src/config/checks/language/swift.ts; REPORTED_LEVELS = \['error', 'warning'\] -&gt; packages/cli/src/config/checks/language/swift.ts.
- swiftPeriphery (function exported, 128-150): **rename** to `packages/cli/src/checks/language/swift/build.ts` `swiftPeriphery`. CKO-004: swift/contracts.ts is renamed in place to swift/build.ts; CKO-016 calls scopeBuildFolder directly; CKO-011; a DisposableStack holds one resource, so write using files = prepared.files, as runBuild and measureCoverage do (S02-001). Values to config: PERIPHERY_YML = 'periphery.yml' -&gt; packages/cli/src/config/checks/language/swift.ts; PERIPHERY_COMMAND = \['periphery', 'scan', '--strict', '--quiet', '--format', 'xcode', '--disable-update-check', '--config'\] (the config path goes last) -&gt; packages/cli/src/config/checks/language/swift.ts; REPORTED_LEVELS (from packages/cli/src/config/checks/language/swift.ts).

## `packages/cli/src/checks/language/swift/coverage.ts`

- packageCoverage (function, 13-31): **move** to `packages/cli/src/checks/testing/coverage.ts` `packageCoverage`. CKO-005: coverage has one caller, swift-tests/coverage, so it moves to checks/testing/coverage.ts; PAR-016: the parser and schemas join it. Values to config: SCRATCH_PATH_FLAG = '--scratch-path' -&gt; packages/cli/src/config/checks/language/swift.ts; SWIFT_CODECOV_COMMAND = \['swift', 'test', '--show-codecov-path'\] -&gt; packages/cli/src/config/checks/testing.ts; SWIFT_DESCRIBE_COMMAND = \['swift', 'package', 'describe', '--type', 'json'\] -&gt; packages/cli/src/config/checks/testing.ts.
- xcodeCoverage (function, 33-50): **move** to `packages/cli/src/checks/testing/coverage.ts` `xcodeCoverage`. CKO-005: moves to checks/testing/coverage.ts with its one caller; PAR-016. Values to config: COVERAGE_BUNDLE = 'coverage.xcresult' -&gt; packages/cli/src/config/checks/testing.ts; XCODE_COVERAGE_FLAGS = \['-enableCodeCoverage', 'YES', '-resultBundlePath'\] -&gt; packages/cli/src/config/checks/testing.ts; XCCOV_COMMAND = \['xcrun', 'xccov', 'view', '--report', '--json'\] -&gt; packages/cli/src/config/checks/testing.ts.
- measureCoverage (function exported, 57-66): **move** to `packages/cli/src/checks/testing/coverage.ts` `measureCoverage`. CKO-005: moves to checks/testing/coverage.ts; PAR-016; used by testing/swift-tests.ts. Values to config: COVERAGE_BUNDLE (from packages/cli/src/config/checks/testing.ts); SWIFT_PROGRAM = 'swift' -&gt; packages/cli/src/config/checks/language/swift.ts.

## `packages/cli/src/checks/language/swift/public.ts`

- assertBuildLinksInside (function, 20-32): **delete**. Guards a state the safe folder already refuses: its writes reject linked parents and its reads reject links that leave it (DEC-008).
- readBuildSources (function, 35-43): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `readBuildSources`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts.
- pruneSources (function, 46-66): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `pruneSources`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts.
- scopeBuildFolder (function exported, 74-81): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `scopeBuildFolder`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts; CKO-016: swiftPeriphery in build.ts calls it, so it stays exported. Values to config: SWIFT_BUILD_FOLDER = 'swift' -&gt; packages/cli/src/config/checks/language/swift.ts; ROOT_BUILD_FOLDER = 'root' -&gt; packages/cli/src/config/checks/language/swift.ts; SCOPE_FOLDER_PREFIX = 'scope-' -&gt; packages/cli/src/config/checks/language/swift.ts.
- buildPlan (function exported, 89-127): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `buildPlan`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts; CKO-016 build purposes only; it reads xcode.project, xcode.scheme, and xcode.destination (POL-033); an absent xcode.project means the Swift package, so the guard tests undefined and the skip message says "Set xcode.project" (TML-010). Values to config: BUILD_LOG = 'build.log' -&gt; packages/cli/src/config/checks/language/swift.ts; PACKAGE_SWIFT = 'Package.swift' -&gt; packages/cli/src/config/parsers/dependency-files.ts; PACKAGE_SCRATCH_FOLDER = 'package' -&gt; packages/cli/src/config/checks/language/swift.ts; SWIFT_PROGRAM (from packages/cli/src/config/checks/language/swift.ts); SCRATCH_PATH_FLAG (from packages/cli/src/config/checks/language/swift.ts); XCODEBUILD_PROGRAM = 'xcodebuild' -&gt; packages/cli/src/config/checks/language/swift.ts; XCODE_WORKSPACE_FLAG = '-workspace' -&gt; packages/cli/src/config/checks/language/swift.ts; XCODE_PROJECT_FLAG = '-project' -&gt; packages/cli/src/config/checks/language/swift.ts; XCODE_SCHEME_FLAG = '-scheme' -&gt; packages/cli/src/config/checks/language/swift.ts; XCODE_DESTINATION_FLAG = '-destination' -&gt; packages/cli/src/config/checks/language/swift.ts; DERIVED_DATA_FLAG = '-derivedDataPath' -&gt; packages/cli/src/config/checks/language/swift.ts; DERIVED_DATA_FOLDER = 'derived' -&gt; packages/cli/src/config/checks/language/swift.ts; CODE_SIGNING_OFF = 'CODE_SIGNING_ALLOWED=NO' -&gt; packages/cli/src/config/checks/language/swift.ts.
- buildFolder (function exported, 134-137): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `buildFolder`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts; the export stays for its cache test.
- openBuildCache (function exported, 144-155): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `openBuildCache`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts; the export stays for its cache tests. Values to config: BUILD_LOCK = 'build.lock' -&gt; packages/cli/src/config/checks/language/swift.ts.
- prepareBuildSources (function exported, 165-174): **inline** to `packages/cli/src/checks/language/swift/build-folder.ts` `prepareBuild`. CKO-016: one caller, prepareBuild.
- prepareBuild (function exported, 182-193): **rename** to `packages/cli/src/checks/language/swift/build-folder.ts` `prepareBuild`. CKO-004: swift/public.ts is renamed in place to swift/build-folder.ts; users swift/build.ts and testing/coverage.ts.

## `packages/cli/src/checks/library/drizzle.ts`

- relations (function exported, 13-72): **rename** to `packages/cli/src/checks/library/drizzle.ts` `drizzleRelations`. CKO-019, CKO-019: the export is named after its check. Values to config: TYPESCRIPT_SOURCE = /\\.tsx?$/u -&gt; packages/cli/src/config/checks/library.ts; TABLE\_BUILDER = /^(?:pg|mysql|sqlite)Table$/u -&gt; packages/cli/src/config/checks/library.ts.

## `packages/cli/src/checks/library/swift-snapshot-testing.ts`

- recordingEnabled (function, 9-16): **keep** to `packages/cli/src/checks/library/swift-snapshot-testing.ts` `recordingEnabled`. One caller, real logic.
- recording (function exported, 23-46): **keep** to `packages/cli/src/checks/library/swift-snapshot-testing.ts` `recording`. CKO-019: snapshot is a banned term, so the export has no configuration prefix; the check runs per file over tags = \[swift-test\], so the kind and tag filter goes and it maps input.files directly, with no swiftTestFiles helper (S02-006).
- references (function exported, 53-71): **keep** to `packages/cli/src/checks/library/swift-snapshot-testing.ts` `references`. CKO-019: snapshot is a banned term, so the export has no configuration prefix and the folder value is REFERENCE_FOLDER. Values to config: REFERENCE_FOLDER = '\_\_Snapshots\_\_' -&gt; packages/cli/src/config/checks/library.ts; SWIFT_EXTENSION = '.swift' -&gt; packages/cli/src/config/parsers/swift.ts; SWIFT_TEST_TAG = 'swift-test' (this check runs over the scope, so its tag filter stays) -&gt; packages/cli/src/config/repository/inventory.ts.

## `packages/cli/src/checks/library/translations.ts`

- flattenMessages (function, 9-16): **keep** to `packages/cli/src/checks/library/translations.ts` `flattenMessages`. Recursive, real logic.
- dottedKeys (function, 19-22): **keep** to `packages/cli/src/checks/library/translations.ts` `dottedKeys`. Recursive, real logic.
- translationMessage (function, 24-32): **keep** to `packages/cli/src/checks/library/translations.ts` `translationMessage`. One caller, real logic.
- locales (function exported, 39-91): **rename** to `packages/cli/src/checks/library/translations.ts` `translationsMessages`. Check translations/locales becomes translations/messages; CKO-019 names the export after its check; CKO-002: the manifest when = setting replaces the code skip, and the sentence that the check passes goes. Values to config: MESSAGE_FILE_SUFFIX = '.json' -&gt; packages/cli/src/config/checks/library.ts.

## `packages/cli/src/checks/platform/cloudflare.ts`

- scopePathsNamed (function, 16-18): **merge** to `packages/cli/src/checks/finding.ts` `sourcePaths`. CKO-038: merges into one sourcePaths helper, which matches a whole file name (path === name or path ends with /name), not a bare ending, so foo_headers does not match \_headers.
- redirects (function exported, 25-31): **rename** to `packages/cli/src/checks/platform/cloudflare.ts` `cloudflareRedirects`. CKO-019, CKO-019: the export is named after its check; PAR-011: the readers move in. Values to config: REDIRECTS_FILE = '\_redirects' -&gt; packages/cli/src/config/checks/platform/cloudflare.ts.
- wrangler (function exported, 38-82): **rename** to `packages/cli/src/checks/platform/cloudflare.ts` `cloudflareWrangler`. CKO-019: the export is named after its check; DEC-021: the schema check runs through v8r, with no hand-loaded Ajv; NMS table B. Values to config: WRANGLER_FILES = \['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'\] (the Ajv names and options go with DEC-021) -&gt; packages/cli/src/config/checks/platform/cloudflare.ts.
- headers (function exported, 88-94): **rename** to `packages/cli/src/checks/platform/cloudflare.ts` `cloudflareHeaders`. CKO-019, CKO-019: the export is named after its check. Values to config: HEADERS_FILE = '\_headers' -&gt; packages/cli/src/config/checks/platform/cloudflare.ts.
- securityHeaders (function exported, 101-124): **rename** to `packages/cli/src/checks/platform/cloudflare.ts` `cloudflareSecurityHeaders`. CKO-019: the export is named after its check. Values to config: HEADERS_FILE (from packages/cli/src/config/checks/platform/cloudflare.ts); FRAME_ANCESTORS = /frame-ancestors/iu -&gt; packages/cli/src/config/checks/platform/cloudflare.ts.

## `packages/cli/src/checks/platform/public.ts`

- configurationArguments (function, 29-34): **rename** to `packages/cli/src/checks/platform/supabase.ts` `denoConfigArguments`. CKO-004: public.ts is renamed in place to supabase.ts; it returns the --config argument for deno.json, and configuration means a selectable unit in the glossary, so it is denoConfigArguments (S02-005); two callers. Values to config: DENO_CONFIG_FILES = \['deno.json', 'deno.jsonc'\] -&gt; packages/cli/src/config/checks/platform/supabase.ts; DENO_CONFIG_FLAG = '--config' -&gt; packages/cli/src/config/checks/platform/supabase.ts.
- repositoryPath (function, 36-40): **rename** to `packages/cli/src/checks/platform/supabase.ts` `repositoryPath`. CKO-004: public.ts is renamed in place to supabase.ts; two callers. Values to config: FILE_URL_PREFIX = 'file://' -&gt; packages/cli/src/config/checks/platform/supabase.ts.
- lintFunction (function, 42-67): **inline** to `packages/cli/src/checks/platform/supabase.ts` `supabaseDenoLint`. CKO-025: inlined into supabaseDenoLint with one error that carries the tool output; CKO-011 helper for the exit code. Values to config: DENO_LINT_COMMAND = \['deno', 'lint', '--json'\] -&gt; packages/cli/src/config/checks/platform/supabase.ts.
- firstError (function, 70-76): **rename** to `packages/cli/src/checks/platform/supabase.ts` `firstError`. CKO-004: public.ts is renamed in place to supabase.ts. Values to config: FUNCTION_ENTRY_FILES (from packages/cli/src/config/checks/platform/supabase.ts).
- checkFunctionTypes (function, 78-86): **inline** to `packages/cli/src/checks/platform/supabase.ts` `supabaseDenoCheck`. CKO-025: inlined into supabaseDenoCheck with one error that carries the tool output. Values to config: FUNCTION_ENTRY_FILES = \['index.ts', 'index.tsx'\] -&gt; packages/cli/src/config/checks/platform/supabase.ts; DENO_CHECK_COMMAND = \['deno', 'check', '--quiet'\] -&gt; packages/cli/src/config/checks/platform/supabase.ts.
- readConfiguration (function, 93-103): **rename** to `packages/cli/src/checks/platform/supabase.ts` `readConfigToml`. CKO-004: public.ts is renamed in place to supabase.ts; it reads supabase/config.toml, and configuration means a selectable unit in the glossary, so it is readConfigToml (S02-005); readText returns undefined for a missing file, so the statSync and join before the read go (S02-007); two callers.
- functionFolders (function exported, 110-119): **rename** to `packages/cli/src/checks/platform/supabase.ts` `functionFolders`. CKO-004: public.ts is renamed in place to supabase.ts; the export stays for its unit test. Values to config: FUNCTION_ENTRY = /\\/index\\.tsx?$/u -&gt; packages/cli/src/config/checks/platform/supabase.ts.
- projectFile (function exported, 126-144): **rename** to `packages/cli/src/checks/platform/supabase.ts` `supabaseProjectFile`. CKO-004: public.ts is renamed in place to supabase.ts; CKO-019 names the export after its check.
- storagePolicies (function exported, 151-184): **rename** to `packages/cli/src/checks/platform/supabase.ts` `supabaseStoragePolicies`. CKO-004: public.ts is renamed in place to supabase.ts; CKO-019 names the export after its check; CKO-024 walkSqlTree, not JSON.stringify.
- migrationNames (function exported, 191-208): **rename** to `packages/cli/src/checks/platform/supabase.ts` `supabaseMigrationNames`. CKO-004: public.ts is renamed in place to supabase.ts; CKO-019; it takes the paths from migrationPaths(input) in database/postgres/migrations.ts instead of a second migrationFiles call (S02-004); postgres.migrations_folder is absent when unset, and the path is root-relative (TML-010, CFR-003). Values to config: DOWN_MIGRATION_SUFFIX (from packages/cli/src/config/checks/database.ts).
- denoLint (function exported, 215-219): **rename** to `packages/cli/src/checks/platform/supabase.ts` `supabaseDenoLint`. CKO-004: public.ts is renamed in place to supabase.ts; CKO-019 names the export after its check; CKO-025.
- denoCheck (function exported, 226-230): **rename** to `packages/cli/src/checks/platform/supabase.ts` `supabaseDenoCheck`. CKO-004: public.ts is renamed in place to supabase.ts; CKO-019 names the export after its check; CKO-025.
- serviceRoleKey (function exported, 237-262): **rename** to `packages/cli/src/checks/platform/supabase.ts` `supabaseServiceRoleKey`. CKO-004: public.ts is renamed in place to supabase.ts; CKO-019 names the export after its check. Values to config: ADMIN_KEY_TAGS = \['javascript', 'typescript', 'vue', 'svelte', 'astro', 'swift', 'python'\] -&gt; packages/cli/src/config/checks/platform/supabase.ts.

## `packages/cli/src/checks/tool/ansible.ts`

- lintProject (function, 11-37): **move** to `packages/cli/src/checks/infrastructure/ansible.ts` `lintProject`. CKO-005: checks/tool becomes checks/infrastructure (NMU-009); CKO-011. Values to config: ANSIBLE_CONFIG_SUFFIX = '.cfg' -&gt; packages/cli/src/config/checks/infrastructure/ansible.ts.
- ansibleLint (function exported, 44-65): **move** to `packages/cli/src/checks/infrastructure/ansible.ts` `ansibleLint`. CKO-005: checks/tool becomes checks/infrastructure; CKO-013: no missing-command throw; CKO-037. Values to config: ANSIBLE_CFG (from packages/cli/src/config/checks/infrastructure/ansible.ts); SKIP_LIST_FLAG = '--skip-list' -&gt; packages/cli/src/config/checks/infrastructure/ansible.ts; ALWAYS_SKIPPED_TAGS = \['experimental'\] -&gt; packages/cli/src/config/checks/infrastructure/ansible.ts.

## `packages/cli/src/checks/tool/contracts.ts`

- hasReason (function, 12-19): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `hasReason`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts (NMU-009). Values to config: SWIFT_STRING_LITERAL = /^(#\*)("""|")(\[\\s\\S\]\*)\\2\\1$/u -&gt; packages/cli/src/config/checks/testing.ts.
- skipReason (function, 21-30): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `skipReason`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts.
- disabledNodes (function, 32-50): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `disabledNodes`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts. Values to config: XCTEST_PREFIX = /^XCTest\\./u -&gt; packages/cli/src/config/checks/testing.ts.
- swiftTestsSkipReasons (function exported, 57-74): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `swiftTestsSkipReasons`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts; it runs per file with files = { tags = \[swift-test\] }, so the kind and tag filter goes and it maps input.files directly (S02-006).
- swiftTestsSleep (function exported, 81-101): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `swiftTestsSleep`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts; it maps input.files directly, without the repeated kind and tag filter (S02-006). Values to config: TYPED_TASK_CALL = /^Task&lt;\[^&gt;\]+&gt;\\./u -&gt; packages/cli/src/config/checks/testing.ts.
- coverageShortfalls (function exported, 109-136): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `coverageShortfalls`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts; the export stays for its unit tests; say minimum, not floor; coverage.overrides becomes the root record list \[\[coverage.target\]\] with name, lines, and reason, so it reads target.name and target.lines (TMF-004, CFR-004). Values to config: APP_TARGET_SUFFIX = '.app' -&gt; packages/cli/src/config/checks/testing.ts.
- swiftTestsCoverage (function exported, 143-150): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `swiftTestsCoverage`. CKO-005: tool/contracts.ts becomes testing/swift-tests.ts; CKO-033: the finding sits at Package.swift or xcode.project (POL-033); CKO-013: the cancel check stays; the \[\[coverage.target\]\] records are read from the root list (TMF-004, CFR-004).

## `packages/cli/src/checks/tool/docker.ts`

- composeGroups (function, 21-42): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `composeGroups`. CKO-005: checks/tool becomes checks/infrastructure; two callers. Values to config: COMPOSE_SUFFIXES = \['.yaml', '.yml'\] -&gt; packages/cli/src/config/checks/infrastructure/docker.ts.
- composeDocuments (function, 45-90): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `composeDocuments`. CKO-005: checks/tool becomes checks/infrastructure; two callers. Values to config: COMPOSE_CHECK = 'docker/compose' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts; DOCKERIGNORE = '.dockerignore' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts.
- scanImage (function, 93-133): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `scanImage`. CKO-005: checks/tool becomes checks/infrastructure; CKO-013 deletes the inconsistent-report guard and its test row. Values to config: TRIVY_YML = 'trivy.yml' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts; TRIVY_IMAGE_COMMAND = \['trivy', 'image', '--quiet', '--format', 'json', '--scanners', 'vuln,secret', '--exit-code', String(TRIVY_EXIT), '--config'\] (built from TRIVY_EXIT inside config/; the config path and the image go last) -&gt; packages/cli/src/config/checks/infrastructure/docker.ts.
- dockerignore (function exported, 140-193): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `dockerignore`. CKO-005: checks/tool becomes checks/infrastructure; the name is the check name docker/dockerignore. Values to config: DOCKERIGNORE (from packages/cli/src/config/repository/inventory.ts); DOCKERFILE_EXTENSION = '.dockerfile' -&gt; packages/cli/src/config/repository/inventory.ts; EDGE_SLASHES = /^\\/|\\/$/gu -&gt; packages/cli/src/config/repository/inventory.ts; IGNORE_ENTRY_FORMS = \[\['', ''\], \['\*\*/', ''\], \['', '\*'\], \['\*\*/', '\*'\]\] (prefix and suffix around each required entry) -&gt; packages/cli/src/config/repository/inventory.ts.
- trivyImage (function exported, 200-220): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `trivyImage`. CKO-005: checks/tool becomes checks/infrastructure; the name is the check name docker/trivy-image.
- compose (function exported, 228-252): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `dockerCompose`. CKO-005: checks/tool becomes checks/infrastructure; CKO-019 names the export after its check; CKO-010 keeps the findings found before a tool error. Values to config: FILE_PLACEHOLDER (from packages/cli/src/config/configurations.ts); COMPOSE_FILE_FLAG = '-f' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts.

## `packages/cli/src/checks/tool/public.ts`

- stepReferences (function, 21-25): **move** to `packages/cli/src/checks/infrastructure/github-actions.ts` `stepReferences`. CKO-004, CKO-005: tool/public.ts splits and its GitHub Actions part moves to checks/infrastructure/github-actions.ts; IGN-012: the $/ rewrite stays.
- workflowReferences (function, 27-38): **move** to `packages/cli/src/checks/infrastructure/github-actions.ts` `workflowReferences`. CKO-004, CKO-005: tool/public.ts splits and its GitHub Actions part moves to checks/infrastructure/github-actions.ts; IGN-012.
- replaceReference (function, 41-56): **move** to `packages/cli/src/checks/infrastructure/github-actions.ts` `replaceReference`. CKO-004, CKO-005: tool/public.ts splits and its GitHub Actions part moves to checks/infrastructure/github-actions.ts; IGN-025 anchors the pattern at the start of the value. Values to config: SELF_REPOSITORY_MARKER = /\\$|\\\\x24|\\\\u0024|\\\\U00000024/u (anchored as IGN-025 says) -&gt; packages/cli/src/config/checks/infrastructure/github-actions.ts.
- includedFiles (function, 59-69): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `includedFiles`. CKO-004, CKO-005: tool/public.ts splits and its nginx part moves to checks/infrastructure/nginx.ts; PAR-011 and PAR-083: parseDirectives moves in. Values to config: NGINX_FOLDER = '/etc/nginx' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts (written in four places).
- copyConfigurations (function, 71-86): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `copyNginxFiles`. CKO-004, CKO-005: moves to checks/infrastructure/nginx.ts; it copies nginx.conf and its included files, and configuration means a selectable unit in the glossary, so it is copyNginxFiles (S02-005); the mkdtemp prefix only names a temporary folder, so it needs no value (S01-013). Values to config: NGINX_MAIN_TARGET = '/etc/nginx/nginx.conf' (built from NGINX_FOLDER and NGINX_CONF inside config/) -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts.
- syntaxOutcome (function, 88-101): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `syntaxOutcome`. CKO-004, CKO-005: tool/public.ts splits and its nginx part moves to checks/infrastructure/nginx.ts. Values to config: ERROR_LOCATION = / in (?&lt;file&gt;\\/\[^\\n\]+):(?&lt;line&gt;\\d+)\\s\*$/u -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts.
- testConfiguration (function, 103-130): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `testNginxFile`. CKO-004, CKO-005: moves to checks/infrastructure/nginx.ts; it tests one nginx.conf, so it is testNginxFile (S02-005); CKO-013 deletes the no-dump guard; CKO-017: $ instead of \\r?$. Values to config: CERTIFICATE\_FILE = 'certificate.pem' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts; KEY\_FILE = 'key.pem' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts; DOCKER\_TOOL = 'docker' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts; CONFIGURATION\_DUMP\_LINE = /^# configuration file (?&lt;path&gt;\[^\\n\]+):$/gmu (nginx's own words; CKO-017 drops \\r?) -&gt; packages/cli/src/config/checks/infrastructure/docker.ts; NGINX_MAIN_TARGET (from packages/cli/src/config/checks/infrastructure/docker.ts).
- actionlintSource (function exported, 137-147): **move** to `packages/cli/src/checks/infrastructure/github-actions.ts` `actionlintSource`. CKO-004, CKO-005: moves to checks/infrastructure/github-actions.ts; the export stays for its unit test.
- actionlint (function exported, 155-177): **move** to `packages/cli/src/checks/infrastructure/github-actions.ts` `actionlint`. CKO-004, CKO-005: moves to checks/infrastructure/github-actions.ts; it reads only planned workflow and action.yml files and takes its command from the manifest; IGN-012. Values to config: YAML_FILE = /\\.ya?ml$/u -&gt; packages/cli/src/config/repository/tracked.ts; GIT_FOLDER = '.git' -&gt; packages/cli/src/config/repository/tracked.ts.
- nginxTest (function exported, 184-209): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `nginxConfigTest`. CKO-004, CKO-005: moves to checks/infrastructure/nginx.ts; CKO-019 names it after check nginx/config-test; NMS table B: workFolder becomes scratch; scratchFolder takes no prefix, so 'gspot-nginx-' needs no value (S01-013). Values to config: OPENSSL_PROGRAM = 'openssl' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; OPENSSL_KEY_FLAG = '-keyout' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; OPENSSL_CERTIFICATE_FLAG = '-out' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; KEY_FILE (from packages/cli/src/config/checks/infrastructure/nginx.ts); CERTIFICATE_FILE (from packages/cli/src/config/checks/infrastructure/nginx.ts).
- testArguments (function exported, 221-252): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `testArguments`. CKO-004, CKO-005: moves to checks/infrastructure/nginx.ts; the export stays for its unit test. Values to config: CERTIFICATE_DIRECTIVES = { ssl_certificate_key: 'key', ssl_certificate: 'certificate', ssl_trusted_certificate: 'certificate' } (which mount each directive gets) -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; DOCKER_RUN_ARGUMENTS = \['run', '--rm'\] -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; ADD_HOST_FLAG = '--add-host' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; LOOPBACK_ADDRESS = '127.0.0.1' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; VOLUME_FLAG = '-v' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; READ_ONLY_MOUNT = ':ro' -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; NGINX_TEST_COMMAND = \['nginx', '-T'\] -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; NGINX_FOLDER (from packages/cli/src/config/checks/infrastructure/nginx.ts).

## `packages/cli/src/checks/tool/xcode/project.ts`

- projectFolder (function, 16-19): **move** to `packages/cli/src/checks/infrastructure/xcode/project.ts` `projectFolder`. CKO-005: checks/tool becomes checks/infrastructure; three callers. Values to config: XCODEPROJ_SUFFIX = '.xcodeproj' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.
- orphanSources (function exported, 26-62): **move** to `packages/cli/src/checks/infrastructure/xcode/project.ts` `xcodeFilesWithoutTarget`. CKO-005: checks/tool becomes checks/infrastructure; NMU-022: check xcode/orphan-sources becomes xcode/files-without-target; CKO-019. Values to config: SWIFT_EXTENSION (from packages/cli/src/config/parsers/swift.ts); PACKAGE_SWIFT (from packages/cli/src/config/parsers/dependency-files.ts).
- testPlans (function exported, 69-98): **move** to `packages/cli/src/checks/infrastructure/xcode/project.ts` `xcodeTestPlans`. CKO-005: checks/tool becomes checks/infrastructure; CKO-019 names the export after its check. Values to config: TEST_PLAN_SUFFIX = '.xctestplan' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts; SCHEME_SUFFIX = '.xcscheme' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts; SHARED_DATA_FOLDER = '/xcshareddata/' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.
- symlinks (function exported, 105-130): **move** to `packages/cli/src/checks/infrastructure/xcode/project.ts` `xcodeSymlinks`. CKO-005: checks/tool becomes checks/infrastructure; CKO-019; CKO-014 when = git; CKO-013: no missing-blob throw.
- scopeSourcesByEnding (function exported, 138-142): **merge** to `packages/cli/src/checks/finding.ts` `sourcePaths`. CKO-038: merges into one sourcePaths helper.

## `packages/cli/src/checks/tool/xcode/resources.ts`

- assetSetName (function, 13-17): **move** to `packages/cli/src/checks/infrastructure/xcode/resources.ts` `assetSetName`. CKO-005: checks/tool becomes checks/infrastructure; two callers.
- contentsFindings (function exported, 24-45): **move** to `packages/cli/src/checks/infrastructure/xcode/resources.ts` `xcodeAssets`. CKO-005: checks/tool becomes checks/infrastructure; CKO-018, CKO-019: named after check xcode/assets; catalog is a banned word, so the folder value is XCASSETS_FOLDER. Values to config: ASSET_CONTENTS = 'Contents.json' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts; XCASSETS_FOLDER = '.xcassets/' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.
- orphanAssets (function exported, 52-81): **move** to `packages/cli/src/checks/infrastructure/xcode/resources.ts` `xcodeUnusedAssets`. CKO-005: checks/tool becomes checks/infrastructure; NMU-022: check xcode/orphan-assets becomes xcode/unused-assets (rule unused-asset). Values to config: ASSET_REFERENCE_ENDINGS = \['.swift', '.storyboard', '.xib', '.plist', 'project.pbxproj', '.xcconfig'\] -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts; ASSET_CONTENTS (from packages/cli/src/config/checks/infrastructure/xcode.ts); ASSET_KIND_SUFFIX = /(?:Color|Image)$/u -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.
- xcstrings (function exported, 88-109): **move** to `packages/cli/src/checks/infrastructure/xcode/resources.ts` `xcstrings`. CKO-005: checks/tool becomes checks/infrastructure; the name is the check name xcode/xcstrings; catalog is a banned word, so the suffix value is XCSTRINGS_SUFFIX. Values to config: XCSTRINGS_SUFFIX = '.xcstrings' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts; DEFAULT_SOURCE_LANGUAGE = 'en' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.

## `packages/cli/src/checks/tool/xcode/settings.ts`

- xcconfig (function exported, 13-36): **move** to `packages/cli/src/checks/infrastructure/xcode/settings.ts` `xcconfig`. CKO-005: checks/tool becomes checks/infrastructure; the name is the check name xcode/xcconfig. Values to config: XCCONFIG_SUFFIX = '.xcconfig' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.
- entitlements (function exported, 43-61): **move** to `packages/cli/src/checks/infrastructure/xcode/settings.ts` `xcodeEntitlements`. CKO-005: checks/tool becomes checks/infrastructure; CKO-019 names the export after its check; it reads xcode.allowed_entitlements (TML-014). Values to config: ENTITLEMENTS_SUFFIX = '.entitlements' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.
- ats (function exported, 68-83): **move** to `packages/cli/src/checks/infrastructure/xcode/settings.ts` `xcodeAppTransportSecurity`. CKO-005: checks/tool becomes checks/infrastructure; check xcode/ats becomes xcode/app-transport-security; CKO-019. Values to config: PLIST_SUFFIX = '.plist' -&gt; packages/cli/src/config/checks/infrastructure/xcode.ts.

## `packages/cli/src/config/checks/framework/nextjs.ts`

- SEGMENT_NAME (const exported, 1-1): **keep** to `packages/cli/src/config/checks/framework/nextjs.ts` `SEGMENT_NAME`. A static value; it stays in this config file.
- NEXT_CONFIG (const exported, 3-3): **keep** to `packages/cli/src/config/checks/framework/nextjs.ts` `NEXT_CONFIG`. A static value; it stays in this config file.
- CAUSE_MARKS (const exported, 5-5): **keep** to `packages/cli/src/config/checks/framework/nextjs.ts` `CAUSE_MARKS`. A static value; it stays in this config file.
- SHOWN_LINES (const exported, 7-7): **keep** to `packages/cli/src/config/checks/framework/nextjs.ts` `SHOWN_LINES`. A named number for no-magic-numbers; it stays in this config file.
- MARKED_LINES (const exported, 10-10): **keep** to `packages/cli/src/config/checks/framework/nextjs.ts` `MARKED_LINES`. A named number for no-magic-numbers; it stays in this config file.

## `packages/cli/src/config/checks/framework/svelte.ts`

- DIAGNOSTIC_LINE (const exported, 2-2): **keep** to `packages/cli/src/config/checks/framework/svelte.ts` `DIAGNOSTIC_LINE`. A static value; it stays in this config file; diagnostic is the word svelte-check uses for its output.
- FAILURE_LINE (const exported, 4-4): **keep** to `packages/cli/src/config/checks/framework/svelte.ts` `FAILURE_LINE`. A static value; it stays in this config file.

## `packages/cli/src/config/checks/language/bash.ts`

- BASH_SHEBANGS (const exported, 4-4): **keep** to `packages/cli/src/config/checks/language/bash.ts` `BASH_SHEBANGS`. A static value; it stays in this config file.
- EXIT_CALL (const exported, 6-6): **keep** to `packages/cli/src/config/checks/language/bash.ts` `EXIT_CALL`. A static value; it stays in this config file.
- MAIN_CALL (const exported, 9-9): **keep** to `packages/cli/src/config/checks/language/bash.ts` `MAIN_CALL`. A static value; it stays in this config file.
- OTHER_SHEBANG (const exported, 12-12): **keep** to `packages/cli/src/config/checks/language/bash.ts` `OTHER_SHEBANG`. A static value; it stays in this config file.
- READONLY_WORD (const exported, 14-14): **keep** to `packages/cli/src/config/checks/language/bash.ts` `READONLY_WORD`. CKO-007: named values live in config/, and a Bash keyword the check matches is one, so it stays in this config file.
- STRICT_MODE (const exported, 17-17): **keep** to `packages/cli/src/config/checks/language/bash.ts` `STRICT_MODE`. A static value; it stays in this config file as one string, not a one-item list (CKO-035).
- SSH_HEREDOC (const exported, 20-20): **keep** to `packages/cli/src/config/checks/language/bash.ts` `SSH_HEREDOC`. A static value; it stays in this config file.
- RUNTIME_EMBEDS (const exported, 23-32): **keep** to `packages/cli/src/config/checks/language/bash.ts` `RUNTIME_EMBEDS`. A static value; it stays in this config file.
- SAFETY_LINE_RULES (const exported, 35-37): **rename** to `packages/cli/src/config/checks/language/bash.ts` `ALL_LEVEL_SAFETY_PATTERNS`. A static value; it stays in this config file under the NMS table B name.
- SAFETY_OWNER_RULES (const exported, 40-45): **rename** to `packages/cli/src/config/checks/language/bash.ts` `SAFETY_PATTERNS`. A static value; it stays in this config file under the NMS table B name.
- TOP_LEVEL_ASSIGNMENT (const exported, 48-48): **keep** to `packages/cli/src/config/checks/language/bash.ts` `TOP_LEVEL_ASSIGNMENT`. A static value; it stays in this config file.
- ENTRY_FUNCTIONS (const exported, 51-51): **rename** to `packages/cli/src/config/checks/language/bash.ts` `MAIN_FUNCTION`. CKO-007: named values live in config/; the one-item list becomes the string MAIN_FUNCTION = 'main', read by script-layout (twice), doc-comments, unused-functions and private-prefix.
- DEPRECATED_ALIAS (const exported, 54-54): **keep** to `packages/cli/src/config/checks/language/bash.ts` `DEPRECATED_ALIAS`. A static value; it stays in this config file.
- FORWARDED_SCRIPT (const exported, 56-56): **keep** to `packages/cli/src/config/checks/language/bash.ts` `FORWARDED_SCRIPT`. A static value; it stays in this config file.
- FORWARDER_STEM (const exported, 59-59): **keep** to `packages/cli/src/config/checks/language/bash.ts` `FORWARDER_STEM`. A static value; it stays in this config file.
- FORWARDER_INTERPRETER (const exported, 62-62): **keep** to `packages/cli/src/config/checks/language/bash.ts` `FORWARDER_INTERPRETER`. A static value; it stays in this config file.
- FORWARDER_MAX_LINES (const exported, 65-65): **keep** to `packages/cli/src/config/checks/language/bash.ts` `FORWARDER_MAX_LINES`. A named number for no-magic-numbers; it stays in this config file.
- SOURCE_STATEMENT (const exported, 68-68): **keep** to `packages/cli/src/config/checks/language/bash.ts` `SOURCE_STATEMENT`. A static value shared by script-layout and source-order; it stays in this config file.
- WORD (const exported, 70-70): **keep** to `packages/cli/src/config/checks/language/bash.ts` `WORD`. A static value; it stays in this config file.
- VAGUE_WORDS (const exported, 73-88): **keep** to `packages/cli/src/config/checks/language/bash.ts` `VAGUE_WORDS`. A static value; it stays in this config file.
- BASH_DOC_SECTIONS (const exported, 91-91): **keep** to `packages/cli/src/config/checks/language/bash.ts` `BASH_DOC_SECTIONS`. A static value; it stays in this config file.
- COUNT_RULES (const exported, 93-97): **rename** to `packages/cli/src/config/checks/language/bash.ts` `COUNT_LIMITS`. CKO-001: the check compares three parser counts with three limits and names each in its message, so this table ({ limit, noun } for branches, nesting as 'levels of nesting', assignments) is config; isDepth and the BashCountRule import go, because config/ imports only config/.
- OUTER_LEVELS (const exported, 100-100): **delete**. CKO-001: the parser counts nesting directly, so the outer-level value goes.
- CONFIG_GUARD (const exported, 103-103): **rename** to `packages/cli/src/config/checks/language/bash.ts` `INCLUDE_GUARD`. A static value; it stays in this config file under the include-guard name (check bash/include-guards); glossary: env files, not configuration owners.
- DEFAULT_EXPANSION (const exported, 106-106): **keep** to `packages/cli/src/config/checks/language/bash.ts` `DEFAULT_EXPANSION`. A static value; it stays in this config file (CKO-018).
- SCRIPT_TAG (const exported, 108-108): **move** to `packages/cli/src/config/repository/inventory.ts` `SCRIPT_TAG`. CKO-007: file tags are named in config/repository/inventory.ts, and two areas read this one (the general prose check and bash/scripts.ts), so it moves there; it keeps the name SCRIPT_TAG, value 'shell', because shell is a banned word.
- SHELLCHECK_DIRECTIVE (const exported, 111-111): **rename** to `packages/cli/src/config/checks/language/bash.ts` `SHELLCHECK_TOOL_COMMENT`. CKO-009, NMS table B: glossary tool comment; its one user left is bash/doc-comments, because structure/import-comments goes (CKG-055); it stays in this config file.

## `packages/cli/src/config/checks/language/css.ts`

- MODULE_SUFFIX (const exported, 1-1): **delete**. CKO-029: check css/module-classes goes, so its value goes.

## `packages/cli/src/config/checks/language/html.ts`

- INERT_SCRIPT_TYPES (const exported, 1-1): **keep** to `packages/cli/src/config/checks/language/html.ts` `INERT_SCRIPT_TYPES`. A static value; it stays in this config file.
- URL_ATTRIBUTES (const exported, 3-3): **keep** to `packages/cli/src/config/checks/language/html.ts` `URL_ATTRIBUTES`. A static value; it stays in this config file.
- DOCUMENT_URL_ATTRIBUTES (const exported, 5-12): **keep** to `packages/cli/src/config/checks/language/html.ts` `DOCUMENT_URL_ATTRIBUTES`. A static value; it stays in this config file.
- ACTIVE_DOCUMENT_TYPES (const exported, 14-14): **keep** to `packages/cli/src/config/checks/language/html.ts` `ACTIVE_DOCUMENT_TYPES`. A static value; it stays in this config file.
- COPY_ATTRIBUTES (const exported, 16-16): **keep** to `packages/cli/src/config/checks/language/html.ts` `COPY_ATTRIBUTES`. A static value; it stays in this config file.
- PLACEHOLDER_MARKS (const exported, 19-24): **keep** to `packages/cli/src/config/checks/language/html.ts` `PLACEHOLDER_MARKS`. A static value; it stays in this config file.
- SHOWN_TEXT (const exported, 26-26): **keep** to `packages/cli/src/config/checks/language/html.ts` `SHOWN_TEXT`. A named number for no-magic-numbers; it stays in this config file.
- LETTERS (const exported, 28-28): **keep** to `packages/cli/src/config/checks/language/html.ts` `LETTERS`. A static value; it stays in this config file.

## `packages/cli/src/config/checks/language/python.ts`

- PYDOCLINT_DEFAULT_STYLE (const exported, 2-2): **keep** to `packages/cli/src/config/checks/language/python.ts` `PYDOCLINT_DEFAULT_STYLE`. A static value; it stays in this config file; CKO-027 drops native from its comment.
- PYDOCLINT_COMMAND (const exported, 4-4): **keep** to `packages/cli/src/config/checks/language/python.ts` `PYDOCLINT_COMMAND`. A static value; it stays in this config file.
- BROKEN_CONTRACT (const exported, 6-6): **keep** to `packages/cli/src/config/checks/language/python.ts` `BROKEN_CONTRACT`. A static value; it stays in this config file; contract is the word import-linter uses.
- PYTHON_MANIFEST (const exported, 8-8): **move** to `packages/cli/src/config/parsers/dependency-files.ts` `PYPROJECT_TOML`. CKO-007: file names live in config/; pyproject.toml is a dependency file (glossary) read by pydoclint, deptry, import-linter and IMPORT_LINTER_FILES, so it goes beside PACKAGE_JSON in config/parsers/dependency-files.ts as PYPROJECT_TOML.
- REQUIREMENTS_FILE (const exported, 10-10): **move** to `packages/cli/src/config/parsers/dependency-files.ts` `REQUIREMENTS_FILE`. dependencyFileParser and the deptry check both read this value, so it goes to the dependency-file values and deptry imports it.
- PIP_INSTALL (const exported, 12-12): **keep** to `packages/cli/src/config/checks/language/python.ts` `PIP_INSTALL`. A static value; it stays in this config file (CKO-018).
- INSTALL_EXTENSIONS (const exported, 14-14): **keep** to `packages/cli/src/config/checks/language/python.ts` `INSTALL_EXTENSIONS`. A static value; it stays in this config file (CKO-018).
- CLASS_CALL (const exported, 16-16): **keep** to `packages/cli/src/config/checks/language/python.ts` `CLASS_CALL`. A static value; it stays in this config file (CKO-022).
- IMPORTS (const exported, 18-18): **move** to `packages/cli/src/config/checks/general/structure.ts` `PYTHON_IMPORT_NODES`. CKO-009: its only user is structure/env-reads, so it goes to that check group's config file as PYTHON_IMPORT_NODES.
- DEFINITIONS (const exported, 20-20): **keep** to `packages/cli/src/config/checks/language/python.ts` `DEFINITIONS`. A static value; exports.ts is its one user, because the module \_\_getattr\_\_ check in modules.ts needs only function_definition; it stays in this config file.
- PACKAGE_FILE (const exported, 22-22): **rename** to `packages/cli/src/config/checks/language/python.ts` `INIT_PY`. CKO-007: file names live in config/; package file is a retired name (glossary: dependency file), so it takes the real file name, INIT_PY (CKO-007).
- PLACEHOLDERS (const exported, 24-24): **keep** to `packages/cli/src/config/checks/language/python.ts` `PLACEHOLDERS`. A static value; it stays in this config file (CKO-022).
- DIRECTIVE (const exported, 27-27): **delete**. CKG-055: structure/import-comments, its only user, goes.
- PYDOCLINT_TYPE_OPTIONS (const exported, 30-30): **keep** to `packages/cli/src/config/checks/language/python.ts` `PYDOCLINT_TYPE_OPTIONS`. A static value; it stays in this config file.
- GOOGLE_DOCSTRING (const exported, 32-32): **keep** to `packages/cli/src/config/checks/language/python.ts` `GOOGLE_DOCSTRING`. A static value; it stays in this config file.
- NUMPY_DOCSTRING (const exported, 34-34): **keep** to `packages/cli/src/config/checks/language/python.ts` `NUMPY_DOCSTRING`. A static value; it stays in this config file.
- IMPORT_CONTRACT_FILES (const exported, 37-37): **rename** to `packages/cli/src/config/checks/language/python.ts` `IMPORT_LINTER_FILES`. CKO-027 drops native from its comment; it lists the files import-linter reads and uses PYPROJECT_TOML; configuration means a selectable unit in the glossary, so it is not CONFIGURATION_FILES (S02-005).

## `packages/cli/src/config/checks/language/sql.ts`

- PARSED_DIALECTS (const exported, 2-2): **rename** to `packages/cli/src/config/checks/language/sql.ts` `PARSED_DIALECT`. CKO-007: named values live in config/; it holds the string 'postgres', and the check tests dialect !== PARSED_DIALECT, with no one-entry Set (CKO-021).
- OUTPUT_PARAMETERS (const exported, 4-4): **keep** to `packages/cli/src/config/checks/language/sql.ts` `OUTPUT_PARAMETERS`. A static value; it stays in this config file.

## `packages/cli/src/config/checks/language/swift.ts`

- FILE_LOCAL (const exported, 1-1): **delete**. CKG-055: structure/private-before-public, its only user, goes.
- ENVIRONMENT_READ (const exported, 3-3): **move** to `packages/cli/src/config/checks/general/structure.ts` `SWIFT_ENV_READ`. CKO-009: its only user is structure/env-reads, so it goes to that check group's config file as SWIFT_ENV_READ.
- WORKSPACE_SUFFIX (const exported, 5-5): **rename** to `packages/cli/src/config/checks/language/swift.ts` `XCODE_WORKSPACE_SUFFIX`. CKO-007: file suffixes live in config/; workspace alone means only npm workspaces in the glossary, so it is XCODE_WORKSPACE_SUFFIX (CKO-007).
- DIAGNOSTIC (const exported, 7-8): **rename** to `packages/cli/src/config/checks/language/swift.ts` `MESSAGE_LINE`. A static value; it stays in this config file; CKO-017: no drive letters, because the Swift checks never run on Windows; glossary: message, not diagnostic.
- RESPONSE_FILE (const exported, 10-10): **keep** to `packages/cli/src/config/checks/language/swift.ts` `RESPONSE_FILE`. A static value; it stays in this config file (CKO-017).
- MACOS_PRIVATE_PATH (const exported, 12-12): **keep** to `packages/cli/src/config/checks/language/swift.ts` `MACOS_PRIVATE_PATH`. A static value; it stays in this config file.
- RULE_SUFFIX (const exported, 14-14): **keep** to `packages/cli/src/config/checks/language/swift.ts` `RULE_SUFFIX`. A static value; it stays in this config file.
- DIRECTIVE (const exported, 17-17): **delete**. CKG-055: structure/import-comments, its only user, goes.
- BUILD_SOURCE_DIRECTORY (const exported, 20-20): **keep** to `packages/cli/src/config/checks/language/swift.ts` `BUILD_SOURCE_DIRECTORY`. A static value with three uses in one file; it stays in this config file.
- PACKAGE_COMMANDS (const exported, 23-28): **keep** to `packages/cli/src/config/checks/language/swift.ts` `PACKAGE_COMMANDS`. A static value; it stays in this config file; CKO-016 deletes the periphery entry.
- XCODE_COMMANDS (const exported, 31-36): **keep** to `packages/cli/src/config/checks/language/swift.ts` `XCODE_COMMANDS`. A static value; it stays in this config file; CKO-016 deletes the periphery entry.

## `packages/cli/src/config/checks/platform/cloudflare.ts`

- WRANGLER_FIELDS (const exported, 2-9): **keep** to `packages/cli/src/config/checks/platform/cloudflare.ts` `WRANGLER_FIELDS`. A static value; it stays in this config file; CKO-034 name pattern /\\S/u; DEC-021 keeps it.
- REQUIRED_HEADERS (const exported, 11-15): **keep** to `packages/cli/src/config/checks/platform/cloudflare.ts` `REQUIRED_HEADERS`. A static value; it stays in this config file.

## `packages/cli/src/config/checks/platform/supabase.ts`

- SHARED_PREFIX (const exported, 1-1): **keep** to `packages/cli/src/config/checks/platform/supabase.ts` `SHARED_PREFIX`. CKO-007: named values live in config/, and the prefix of shared function folders is one, so it stays in this config file.
- SUPABASE_CONFIG (const exported, 3-3): **rename** to `packages/cli/src/config/checks/platform/supabase.ts` `SUPABASE_CONFIG_TOML`. A static value with three uses; it stays in this config file under the name of the real file, supabase/config.toml.
- MIGRATION_NAME (const exported, 5-5): **keep** to `packages/cli/src/config/checks/platform/supabase.ts` `MIGRATION_NAME`. A static value; it stays in this config file.
- DENO_LOCATION (const exported, 7-7): **keep** to `packages/cli/src/config/checks/platform/supabase.ts` `DENO_LOCATION`. A static value; it stays in this config file.
- ADMIN_KEY_NAMES (const exported, 9-17): **keep** to `packages/cli/src/config/checks/platform/supabase.ts` `ADMIN_KEY_NAMES`. A static value; it stays in this config file.
- ADMIN_KEY_EXTENSIONS (const exported, 20-20): **keep** to `packages/cli/src/config/checks/platform/supabase.ts` `ADMIN_KEY_EXTENSIONS`. A static value; it stays in this config file.

## `packages/cli/src/config/checks/tool/ansible.ts`

- ANSIBLE_PROJECT_FILE (const exported, 1-1): **move** to `packages/cli/src/config/checks/infrastructure/ansible.ts` `ANSIBLE_CFG`. CKO-007: file names live in config/, so it takes the real file name, ANSIBLE_CFG; the file moves with checks/tool/ to the infrastructure group.
- LINT_LINE (const exported, 3-3): **move** to `packages/cli/src/config/checks/infrastructure/ansible.ts` `LINT_LINE`. A static value; the file moves with checks/tool/ to the infrastructure group (CKO-005).

## `packages/cli/src/config/checks/tool/docker.ts`

- DOCKERIGNORE_ENTRIES (const exported, 1-1): **move** to `packages/cli/src/config/checks/infrastructure/docker.ts` `DOCKERIGNORE_ENTRIES`. A static value; the file moves with checks/tool/ to the infrastructure group (CKO-005).
- TRIVY_EXIT (const exported, 4-4): **move** to `packages/cli/src/config/checks/infrastructure/docker.ts` `TRIVY_EXIT`. A named number for no-magic-numbers; the file moves with checks/tool/ to the infrastructure group.
- COMPOSE_OVERRIDE (const exported, 6-6): **move** to `packages/cli/src/config/checks/infrastructure/docker.ts` `COMPOSE_OVERRIDE`. A static value; the file moves with checks/tool/ to the infrastructure group.

## `packages/cli/src/config/checks/tool/github-actions.ts`

- ACTIONLINT_COMMAND (const exported, 1-1): **delete**. The github-actions manifest declares command = \[actionlint, -no-color, {files}\], and actionlint runs planned.check.command, so the constant goes.

## `packages/cli/src/config/checks/tool/nginx.ts`

- NGINX_MAIN (const exported, 1-1): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `NGINX_CONF`. CKO-007: file names live in config/, so it takes the real file name, NGINX_CONF (CKO-007); the file moves with checks/tool/ to the infrastructure group.
- CERTIFICATE_ARGUMENTS (const exported, 3-13): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `CERTIFICATE_ARGUMENTS`. A static value; the file moves with checks/tool/ to the infrastructure group (CKO-005).
- LOCAL_NAMES (const exported, 15-15): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `LOCAL_NAMES`. A static value; the file moves with checks/tool/ to the infrastructure group.
- HOST_PATTERNS (const exported, 17-20): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `HOST_PATTERNS`. A static value; the file moves with checks/tool/ to the infrastructure group.

## `packages/cli/src/config/checks/tool/swift-tests.ts`

- COMMENT_LINE (const exported, 1-1): **move** to `packages/cli/src/config/checks/testing.ts` `COMMENT_LINE`. A static value; the file moves with checks/tool/ to the testing group, and a one-file group folder becomes one file, config/checks/testing.ts (CKO-005).
- SLEEP_CALLS (const exported, 3-12): **move** to `packages/cli/src/config/checks/testing.ts` `SLEEP_CALLS`. A static value; the file moves with checks/tool/ to the testing group, and a one-file group folder becomes one file, config/checks/testing.ts.
- SKIP_REASON_ARGUMENT (const exported, 15-22): **move** to `packages/cli/src/config/checks/testing.ts` `SKIP_REASON_ARGUMENT`. A static value; the file moves with checks/tool/ to the testing group, and a one-file group folder becomes one file, config/checks/testing.ts.

## `packages/cli/src/config/checks/tool/xcode.ts`

- XCODE_PROJECT_FILE (const exported, 1-1): **move** to `packages/cli/src/config/parsers/xcode.ts` `PBXPROJ`. Three users in two areas (the Xcode checks and init detection), and the pbxproj parser owns the file format, so it moves to config/parsers/xcode.ts under the real file name (PAR-011).
- NOT_WORD (const exported, 3-3): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `NOT_WORD`. A static value; the file moves with checks/tool/ to the infrastructure group.
- IMAGE_SET (const exported, 5-5): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `IMAGE_SET`. A static value with two uses in one file; the file moves with checks/tool/ to the infrastructure group.
- NAMED_SETS (const exported, 7-7): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `NAMED_SETS`. A static value; the file moves with checks/tool/ to the infrastructure group.
- SETTING_NAME (const exported, 9-9): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `SETTING_NAME`. A static value; the file moves with checks/tool/ to the infrastructure group.
- INCLUDE_LINE (const exported, 11-11): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `INCLUDE_LINE`. A static value; the file moves with checks/tool/ to the infrastructure group.
- PLIST_KEY (const exported, 13-13): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `PLIST_KEY`. A static value; the file moves with checks/tool/ to the infrastructure group.
- ARBITRARY_LOADS (const exported, 15-15): **move** to `packages/cli/src/config/checks/infrastructure/xcode.ts` `ARBITRARY_LOADS`. A static value; the file moves with checks/tool/ to the infrastructure group.

## `packages/cli/src/types/checks/language/bash.ts`

- ScriptReport (type exported, 6-6): **keep** to `packages/cli/src/types/checks/language.ts` `ScriptReport`. A type of the Bash checks; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- ScriptFile (type exported, 9-15): **keep** to `packages/cli/src/types/checks/language.ts` `ScriptFile`. Shared by the script reader, script-layout and source-order; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- ScriptIndex (type exported, 18-18): **delete**. Its owners map has no production reader and readScripts returns ScriptFile\[\], so the type goes.
- AstGrepMatch (type exported, 21-21): **delete**. CKO-001: the parser counts replace the ast-grep run, so its match type goes.
- BashCountRule (type exported, 24-24): **delete**. CKO-001: the count table in config needs no rule type, so it goes.

## `packages/cli/src/types/checks/language/python.ts`

- DocstringConfiguration (type exported, 4-4): **keep** to `packages/cli/src/types/checks/language.ts` `DocstringConfiguration`. A type of the Python checks; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.

## `packages/cli/src/types/checks/language/sql.ts`

- SqlSource (type exported, 5-5): **keep** to `packages/cli/src/types/checks/language.ts` `SqlSource`. CKO-021: a type of the SQL check; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- SqlFileInput (type exported, 7-13): **keep** to `packages/cli/src/types/checks/language.ts` `SqlFileInput`. CKO-021: fields named with limit words; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- SqlFunctionFindings (type exported, 16-16): **keep** to `packages/cli/src/types/checks/language.ts` `SqlFunctionFindings`. CKO-021: a type of the SQL check; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.

## `packages/cli/src/types/checks/language/swift.ts`

- SwiftBuildPlan (type exported, 4-12): **keep** to `packages/cli/src/types/checks/language.ts` `SwiftBuildPlan`. Belongs with buildPlan, its producer, and build.ts and testing/coverage.ts import it; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- SwiftBuildOutput (type exported, 15-15): **keep** to `packages/cli/src/types/checks/language.ts` `SwiftBuildOutput`. One user; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- SwiftBuildPurpose (type exported, 18-18): **keep** to `packages/cli/src/types/checks/language.ts` `SwiftBuildPurpose`. One user; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
- PreparedSwiftBuild (type exported, 21-21): **keep** to `packages/cli/src/types/checks/language.ts` `PreparedSwiftBuild`. The return type of prepareBuild; the types of the checks are few, so it lives in one file per configuration group, types/checks/language.ts, which imports only from types/.
