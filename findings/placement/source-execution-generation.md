# Source: running checks and writing generated files

394 rows. move 187, keep 142, delete 40, rename 19, merge 3, inline 2, split 1.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/config/execution/command.ts`

- WINDOWS_COMMAND_LIMIT (const exported, 1-1): **keep** to `packages/cli/src/config/execution/command.ts` `WINDOWS_COMMAND_LIMIT`. A command-line limit beside fileBatches; EXG-058 keeps the limit; the batches unit test reads it; it stays in config/execution/command.ts, the file of command-line limits and output tails.
- UNIX_COMMAND_LIMIT (const exported, 3-3): **keep** to `packages/cli/src/config/execution/command.ts` `UNIX_COMMAND_LIMIT`. A command-line limit beside fileBatches; EXG-058 keeps it; the batches unit test reads it; it stays in config/execution/command.ts, the file of command-line limits and output tails.
- WINDOWS_ESCAPE_EXPANSION (const exported, 5-5): **keep** to `packages/cli/src/config/execution/command.ts` `WINDOWS_ESCAPE_EXPANSION`. One user, argumentSize; EXG-058 keeps the 5x factor; it stays in config/execution/command.ts, the file of command-line limits and output tails.
- WINDOWS_ARGUMENT_OVERHEAD (const exported, 7-7): **keep** to `packages/cli/src/config/execution/command.ts` `WINDOWS_ARGUMENT_OVERHEAD`. One user, argumentSize; it stays in config/execution/command.ts, the file of command-line limits and output tails.
- TAIL_LINES (const exported, 9-9): **keep** to `packages/cli/src/config/execution/command.ts` `TAIL_LINES`. One user, toolOutputDetail; it stays in config/execution/command.ts, the file of command-line limits and output tails.

## `packages/cli/src/config/execution/copy.ts`

- WRITE_BATCH (const exported, 3-3): **rename** to `packages/cli/src/config/execution/copy.ts` `FILES_BETWEEN_PAUSES`. EXG-057: it is how often the copy loop yields for Ctrl-C, not a batch, so FILES_BETWEEN_PAUSES; one user; it stays in config/execution/copy.ts.
- CLONE_OPTIONS (const exported, 5-5): **inline** to `packages/cli/src/execution/copy/dependencies.ts` `copyTree`. EXG-067: one use; the two fs.cp options are library call options, written inline in copyTree like every other fs option object.
- SCRATCH_EXTRAS (const exported, 7-7): **keep** to `packages/cli/src/config/execution/copy.ts` `SCRATCH_EXTRAS`. One user, projectCopyInputs; its package.json entry is PACKAGE_JSON from config/parsers/dependency-files.ts; it stays in config/execution/copy.ts.
- SCRATCH_DIRECTORIES (const exported, 9-9): **merge** to `packages/cli/src/config/repository/tracked.ts` `NODE_MODULES`. EXG-055: no copy holds .venv, so the list holds only node_modules and becomes one string, NODE_MODULES in config/repository/tracked.ts, which also replaces the 'node_modules' literals in listDependencyFolders, revisionDependencies, the license check and tsconfig reading; checks/general/generated-code.ts scans the working tree and must skip .venv, so it keeps its own list in its config file.
- PACKAGE_MANIFESTS (const exported, 12-12): **rename** to `packages/cli/src/config/execution/copy.ts` `DEPENDENCY_FILES`. Glossary: manifest is only manifest.toml, and package.json and pyproject.toml are dependency files, so DEPENDENCY_FILES; scratch.ts and revision.ts use it; pyproject.toml stays in it because the revision hash check guards the in-place .venv; it stays in config/execution/copy.ts.

## `packages/cli/src/config/execution/runtime.ts`

- FAILED_STATUSES (const exported, 3-3): **rename** to `packages/cli/src/config/execution/run.ts` `FAILED_STATUSES`. Used by run.ts, report.ts and terminal/; config/execution/runtime.ts is renamed in place to run.ts, because runtime means the JavaScript runtime in the glossary (S04-010); config may not import CheckStatus from types/, so the set is typed by CHECK_STATUSES = \['passed', 'failed', 'missing', 'skipped', 'error'\] in the same file, from which types/execution/check.ts derives CheckStatus. Values to config: CHECK_STATUSES = \['passed', 'failed', 'missing', 'skipped', 'error'\] -&gt; packages/cli/src/config/execution/run.ts.
- FIX_PASSES (const exported, 5-5): **rename** to `packages/cli/src/config/execution/run.ts` `FIX_PASSES`. One user, fixerPasses; EXG-058 keeps 3 passes; config/execution/runtime.ts is renamed in place to run.ts, because runtime means the JavaScript runtime in the glossary (S04-010).
- FIX_DIFF_CONTEXT (const exported, 7-7): **rename** to `packages/cli/src/config/execution/run.ts` `FIX_DIFF_CONTEXT`. One user, applyFixers; config/execution/runtime.ts is renamed in place to run.ts, because runtime means the JavaScript runtime in the glossary (S04-010).
- RAN_STATUSES (const exported, 9-9): **rename** to `packages/cli/src/config/execution/run.ts` `RAN_STATUSES`. Used by run.ts and checks/language; config/execution/runtime.ts is renamed in place to run.ts, because runtime means the JavaScript runtime in the glossary (S04-010); typed by CHECK_STATUSES like FAILED_STATUSES.
- POLICY_CHECK (const exported, 11-11): **delete**. EXG-003: gspot/policy becomes an ordinary built-in check, so the special name, its filter and the built-in.test special case go.

## `packages/cli/src/config/generation/ci.ts`

- CACHED_PATHS (const exported, 2-10): **keep** to `packages/cli/src/config/generation/ci.ts` `CACHED_PATHS`. One user, buildJob; it stays in the CI config file.
- GITHUB_WORKFLOW (const exported, 12-12): **keep** to `packages/cli/src/config/generation/ci.ts` `GITHUB_WORKFLOW`. Beside githubFile; config/commands/doctor.ts and config/commands/init.ts import it, config to config; it stays in the CI config file.
- GITLAB_WORKFLOW (const exported, 14-14): **keep** to `packages/cli/src/config/generation/ci.ts` `GITLAB_WORKFLOW`. Beside gitlabFile; GITLAB_INCLUDE_LABEL and CI_FILE_NOTES build on it; it stays in the CI config file.
- GITLAB_INCLUDE_LABEL (const exported, 17-17): **keep** to `packages/cli/src/config/generation/ci.ts` `GITLAB_INCLUDE_LABEL`. Its two users are config/commands/doctor.ts and config/commands/init.ts, which may import config/, so it stays beside GITLAB_WORKFLOW, which it is built from.
- CI_FILE_NOTES (const exported, 20-23): **move** to `packages/cli/src/config/commands/init.ts` `CI_FILE_NOTES`. EXG-067: init screen text with one user, so it joins the init labels in config/commands/init.ts, which already imports GITHUB_WORKFLOW from config/generation/ci.ts.

## `packages/cli/src/config/generation/eslint.ts`

- MISE_SCRIPT_PATH (const exported, 4-4): **keep** to `packages/cli/src/config/generation/eslint.ts` `MISE_SCRIPT_PATH`. One user, scriptPaths, which always adds it, because a glob that matches nothing changes nothing (INX-011); it stays in the ESLint config file.
- ESLINT_RULE_NAMES_FILE (const exported, 7-7): **move** to `scripts/config/rule-lists.ts` `ESLINT_RULE_NAMES_FILE`. PLG-049: the CLI imports eslint-rule-names.json as a JSON module and no longer reads it by path, so only scripts/update-rule-lists.ts names the file, in its config file scripts/config/rule-lists.ts.
- ESLINT_RULE_NAMES_MODULE (const exported, 8-8): **move** to `scripts/config/rule-lists.ts` `ESLINT_RULE_NAMES_MODULE`. EXG-006: used only by scripts/update-rule-lists.ts (EXG-006), so it goes to scripts/config/rule-lists.ts, the config file of that script.
- ESLINT_RUNTIME_NAMES_FILE (const exported, 11-11): **move** to `scripts/config/rule-lists.ts` `ESLINT_RUNTIME_NAMES_FILE`. EXG-006: used only by scripts/update-rule-lists.ts (EXG-006), so it goes to scripts/config/rule-lists.ts, the config file of that script; the file is renamed eslint-runtime-names.json, so the value is 'configurations/language/javascript/eslint-runtime-names.json'.
- ESLINT_RUNTIME_NAMES_MODULE (const exported, 12-12): **move** to `scripts/config/rule-lists.ts` `ESLINT_RUNTIME_NAMES_MODULE`. EXG-006: used only by scripts/update-rule-lists.ts (EXG-006), so it goes to scripts/config/rule-lists.ts, the config file of that script.
- TEST_RULE_NAMES (const exported, 15-26): **keep** to `packages/cli/src/config/generation/eslint.ts` `TEST_RULE_NAMES`. CFL-001: the Jest and Vitest ESLint builders become TypeScript and import it from here; CFL-002 drops the prefer-strict-equal filter.
- LINT_CHECK (const exported, 31-31): **rename** to `packages/cli/src/config/generation/eslint.ts` `ESLINT_CHECK`. S04-008: the value is the ESLint check ID, and lint check fits every linter check, so the name says ESLint; one user, ignoreBlocks.
- ESLINT_BOUNDARY_FOLDERS (const exported, 34-34): **keep** to `packages/cli/src/config/generation/eslint.ts` `ESLINT_BOUNDARY_FOLDERS`. One user; EXG-051 builds the import-boundaries rule once; it stays in the ESLint config file.
- ESLINT_LIMITS (const exported, 37-47): **delete**. EXG-007: templates read limits by their setting names through view.limit, so the second name set goes.
- ESLINT_JAVASCRIPT_LIMITS (const exported, 50-52): **delete**. EXG-007: templates read limits by their setting names through view.limit, so the second name set goes.
- ROLE_ORDER (const exported, 55-55): **delete**. TML-001: the roles tests, types, config, test_harness, and runtime are deleted, so no role order is left.
- ROLE_IMPORT_POLICIES (const exported, 58-78): **rename** to `packages/cli/src/config/generation/eslint.ts` `TEST_IMPORT_POLICY`. TML-001: one fixed policy is left, "a file outside test_files may not import a file inside test_files", with the category built from test_files; written as const, because config may not import EslintBoundaryPolicy, and the type in types/generation/eslint.ts takes readonly arrays.
- ESLINT_BROWSER_CONFIGURATIONS (const exported, 81-81): **keep** to `packages/cli/src/config/generation/eslint.ts` `ESLINT_BROWSER_CONFIGURATIONS`. One user, frameworkRuntime; it stays in the ESLint config file.
- TRPC_DEPENDENCY_NODES (const exported, 84-84): **keep** to `packages/cli/src/config/generation/eslint.ts` `TRPC_DEPENDENCY_NODES`. One user, boundarySettings; it stays in the ESLint config file.
- TRPC_DEPENDENCY_SELECTORS (const exported, 86-111): **keep** to `packages/cli/src/config/generation/eslint.ts` `TRPC_DEPENDENCY_SELECTORS`. One user, boundarySettings; written as const, so its only type, EslintDependencyNode, goes (S04-007); it stays in the ESLint config file.
- TRPC_UNKNOWN_IMPORT_POLICIES (const exported, 114-117): **rename** to `packages/cli/src/config/generation/eslint.ts` `UNKNOWN_IMPORT_POLICIES`. NMS table B: it serves roles too, not only tRPC, so UNKNOWN_IMPORT_POLICIES; one user; written as const; it stays in the ESLint config file.
- TRPC_SERVER_VALUE_POLICY (const exported, 120-123): **keep** to `packages/cli/src/config/generation/eslint.ts` `TRPC_SERVER_VALUE_POLICY`. One user, dependencyPolicies; written as const; it stays in the ESLint config file.
- ALIAS_IMPORT_SELECTORS (const exported, 126-135): **keep** to `packages/cli/src/config/generation/eslint.ts` `ALIAS_IMPORT_SELECTORS`. One user, fragmentSelectorGroups; it stays in the ESLint config file.
- TYPESCRIPT_EXTENSION_MAP (const exported, 138-143): **keep** to `packages/cli/src/config/generation/eslint.ts` `TYPESCRIPT_EXTENSION_MAP`. One user, importStyleBlocks; it stays in the ESLint config file.
- IMPORT_EXTENSIONS (const exported, 146-157): **keep** to `packages/cli/src/config/generation/eslint.ts` `IMPORT_EXTENSIONS`. One user, importStyleBlocks; it stays in the ESLint config file.
- ENVIRONMENT_RULES (const exported, 160-163): **keep** to `packages/cli/src/config/generation/eslint.ts` `ENVIRONMENT_RULES`. One user, structuralRuleBlocks; it stays in the ESLint config file.
- ENVIRONMENT_SELECTOR (const exported, 165-169): **keep** to `packages/cli/src/config/generation/eslint.ts` `ENVIRONMENT_SELECTOR`. One user, fragmentSelectorGroups; it stays in the ESLint config file.

## `packages/cli/src/config/generation/eta.ts`

- JSON_INDENT (const exported, 1-1): **move** to `packages/cli/src/config/generation/tool-projects.ts` `JSON_INDENT`. EXG-016: config/generation/eta.ts goes with Eta (CFL-001); the npm tool project is its user in the CLI, so it joins the tool-project config file (glossary: tool project); scripts/update-rule-lists.ts imports it from there.
- ETA_OPTIONS (const exported, 3-9): **delete**. CFL-001: Eta goes, and its options with it.
- LEADING_NEWLINES (const exported, 11-11): **delete**. CFL-001: it only trims the blank lines Eta tags leave, and plain files and builders leave none.
- TOKEN_IGNORES (const exported, 14-19): **move** to `packages/cli/src/config/generation/prose.ts` `TOKEN_IGNORES`. EXG-016: the Vale lists join the prose config file beside proseInputs; the typed Vale builder imports it directly (S04-003), and the Vale integration test reads it.
- BLOCK_IGNORES (const exported, 22-22): **move** to `packages/cli/src/config/generation/prose.ts` `BLOCK_IGNORES`. EXG-016: the Vale lists join the prose config file beside TOKEN_IGNORES; the typed Vale builder imports it directly (S04-003).
- YARN_TOOL_PROJECT_SETTINGS (const exported, 25-25): **move** to `packages/cli/src/config/generation/tool-projects.ts` `YARN_TOOL_PROJECT_SETTINGS`. EXG-016: one user, npmProject; the Yarn file of the npm tool project, beside JSON_INDENT in the tool-project config file.

## `packages/cli/src/config/generation/files.ts`

- GIT_ATTRIBUTES_BLOCK (const exported, 4-7): **keep** to `packages/cli/src/config/generation/files.ts` `GIT_ATTRIBUTES_BLOCK`. One user, attributesBlock; it stays in the generated-files config file.

## `packages/cli/src/config/generation/formatting.ts`

- UNREPRESENTABLE_SELECTOR (const exported, 2-2): **keep** to `packages/cli/src/config/generation/formatting.ts` `UNREPRESENTABLE_SELECTOR`. One user, editorconfigSelector; it stays in the formatting config file, which also takes PRETTIER_DEFAULTS.

## `packages/cli/src/config/generation/headers.ts`

- JSON_EXTENSIONS (const exported, 1-1): **keep** to `packages/cli/src/config/generation/headers.ts` `JSON_EXTENSIONS`. Used by headerFor and the tool file emitter; it stays in the header config file with the comment-style sets.
- SLASH_COMMENT_EXTENSIONS (const exported, 3-3): **keep** to `packages/cli/src/config/generation/headers.ts` `SLASH_COMMENT_EXTENSIONS`. One user, headerFor; it stays in the header config file with the comment-style sets.
- HTML_EXTENSIONS (const exported, 5-5): **keep** to `packages/cli/src/config/generation/headers.ts` `HTML_EXTENSIONS`. One user, headerFor; it stays in the header config file with the comment-style sets.
- GENERATED_HEADER_LINES (const exported, 7-7): **move** to `packages/cli/src/parsers/generated-header.ts` `generatedHeader`. EXG-048: the writer and the reader keep one copy of the header text; the header has no version, 'Generated by gspot from gspot.toml. To change it, edit gspot.toml and run gspot apply.', and is written only outside .gspot/, so generatedHeader takes no version parameter (GEN-017); the sentence is text people read, so it stays in that function; the reader regex GENERATED_HEADER_LINE sits in config/generation/headers.ts.

## `packages/cli/src/config/generation/hooks.ts`

- HOOK_ARGS (const exported, 4-8): **keep** to `packages/cli/src/config/generation/hooks.ts` `HOOK_ARGS`. Beside hookLine; commands/check and install/hooks.ts import it; HookName in types/ derives from it; the commit-msg entry is "check --message-file \\"$1\\"", and the --hook choices are pre-commit and pre-push, CHECK_HOOKS (CLX-006); it stays in the hooks config file.
- HOOK_RUNNERS (const exported, 11-18): **rename** to `packages/cli/src/config/generation/hooks.ts` `RUNNERS`. Glossary runner: RUNNERS; five rows keyed by RUNNER_NAMES (npm, pnpm, yarn, bun, mise), with no bare gspot row (INX-003, INX-005, INX-003); the pin field of the mise row says mise use npm:@gspothq/cli@&lt;version&gt; (INX-002); config may not import Policy or HookRunner, so the satisfies clause goes, and RUNNERS\[runner\] in generation/hooks.ts fails to compile when a runner lacks an entry; the knip tool file takes the program of the chosen row for ignoreBinaries (TMF-002).

## `packages/cli/src/config/generation/html.ts`

- HTML_RULES (const exported, 2-7): **keep** to `packages/cli/src/config/generation/html.ts` `HTML_RULES`. CFL-018: static values of the one html-validate builder; it stays in the html config file.
- HTML_ALL_RULES (const exported, 10-10): **keep** to `packages/cli/src/config/generation/html.ts` `HTML_ALL_RULES`. CFL-018: static values of the one html-validate builder, beside HTML_RULES; it stays in the html config file.

## `packages/cli/src/config/generation/pins.ts`

- CLI_PINS (const exported, 6-45): **split** to `packages/cli/src/config/generation/ci.ts; scripts/config/grammars.ts` `CI_PINS; SWIFT_GRAMMAR_PIN`. The generated mise file has no min_version, and INS-003 deletes node and actions.node, so what is left serves only ci.ts: CI_PINS joins the CI config file and config/generation/pins.ts goes; the satisfies clauses against ActionPin and Policy go, because config may not import types; the Swift grammar pin is build-only (EXG-006), so SWIFT_GRAMMAR_PIN, without its name field, goes to scripts/config/grammars.ts with the grammar files (SCR-010).

## `packages/cli/src/config/generation/prose.ts`

- PROSE_GRAMMARS (const exported, 7-27): **keep** to `packages/cli/src/config/generation/prose.ts` `PROSE_GRAMMARS`. Used by proseInputs and the Vale check; a config value carries no type annotation, so PROSE_GRAMMARS is written as const (ARC-008), the code that reads it does the type check, and ProseGrammar goes (S04-007).
- BANNED_HEADINGS (const exported, 29-39): **keep** to `packages/cli/src/config/generation/prose.ts` `BANNED_HEADINGS`. The Vale style builder in generation/prose.ts writes the style banned-headings from BANNED_HEADINGS and the root setting docs.banned_headings and imports it directly (S04-003); the TypeScript check docs/headings goes, so it has one user.

## `packages/cli/src/config/generation/typescript.ts`

- RECOMMENDED_OPTIONS (const exported, 2-8): **keep** to `packages/cli/src/config/generation/typescript.ts` `RECOMMENDED_OPTIONS`. One user, requiredTsconfigOptions; it stays in the TypeScript compiler config file.
- COMPILER_OPTIONS (const exported, 11-15): **keep** to `packages/cli/src/config/generation/typescript.ts` `COMPILER_OPTIONS`. One user, requiredTsconfigOptions; it stays in the TypeScript compiler config file.
- JAVASCRIPT_OPTIONS (const exported, 18-18): **keep** to `packages/cli/src/config/generation/typescript.ts` `JAVASCRIPT_OPTIONS`. One user, buildJsconfig; it stays in the TypeScript compiler config file.
- JAVASCRIPT_IMPORTS (const exported, 21-28): **keep** to `packages/cli/src/config/generation/typescript.ts` `JAVASCRIPT_IMPORTS`. One user, buildJsconfig; it stays in the TypeScript compiler config file.
- JAVASCRIPT_EXCLUSIONS (const exported, 30-30): **keep** to `packages/cli/src/config/generation/typescript.ts` `JAVASCRIPT_EXCLUSIONS`. One user, buildJsconfig; it stays in the TypeScript compiler config file.
- JAVASCRIPT_EXTENSIONS (const exported, 32-32): **keep** to `packages/cli/src/config/generation/typescript.ts` `JAVASCRIPT_EXTENSIONS`. One user, buildJsconfig; it stays in the TypeScript compiler config file.
- TYPESCRIPT_DEFAULTS (const exported, 35-42): **keep** to `packages/cli/src/config/generation/typescript.ts` `TYPESCRIPT_DEFAULTS`. One user, buildTsconfig; it stays in the TypeScript compiler config file.
- JAVASCRIPT_BUNDLED_IMPORTS (const exported, 45-45): **keep** to `packages/cli/src/config/generation/typescript.ts` `JAVASCRIPT_BUNDLED_IMPORTS`. One user, buildJsconfig; it stays in the TypeScript compiler config file.

## `packages/cli/src/execution/command/arguments/contracts.ts`

- argumentSize (function, 13-17): **move** to `packages/cli/src/execution/command/batches.ts` `argumentSize`. EXG-002: arguments/contracts.ts becomes command/batches.ts, and arguments/ is flattened.
- batchedCommands (function exported, 28-46): **move** to `packages/cli/src/execution/command/batches.ts` `batchedCommands`. EXG-002: arguments/contracts.ts becomes command/batches.ts, and arguments/ is flattened; used by command/check.ts.
- fileBatches (function exported, 55-75): **move** to `packages/cli/src/execution/command/batches.ts` `fileBatches`. EXG-002: arguments/contracts.ts becomes command/batches.ts, and arguments/ is flattened; four checks and the batches test use it; EXG-058 keeps the limits.

## `packages/cli/src/execution/command/arguments/public.ts`

- commandItems (function, 33-37): **move** to `packages/cli/src/execution/command/placeholders.ts` `commandItems`. EXG-002: arguments/public.ts becomes command/placeholders.ts; user checks from gspot.toml reach substitute, so the guard stays (EXG-038).
- listArguments (function, 45-52): **move** to `packages/cli/src/execution/command/placeholders.ts` `listArguments`. EXG-002: arguments/public.ts becomes command/placeholders.ts; EXG-069: list settings only lists, one anchored pattern per placeholder.
- existingFileArguments (function, 60-65): **move** to `packages/cli/src/execution/command/placeholders.ts` `existingFileArguments`. EXG-002: arguments/public.ts becomes command/placeholders.ts; EXG-058 keeps {existing:}.
- allToolFiles (function, 67-75): **move** to `packages/cli/src/execution/command/placeholders.ts` `allToolFiles`. EXG-002: arguments/public.ts becomes command/placeholders.ts.
- toolFilePath (function, 77-84): **move** to `packages/cli/src/execution/command/placeholders.ts` `toolFilePath`. EXG-002: arguments/public.ts becomes command/placeholders.ts.
- plainPart (function, 86-103): **move** to `packages/cli/src/execution/command/placeholders.ts` `plainPart`. EXG-002: arguments/public.ts becomes command/placeholders.ts; EXG-069: {workspace:} by an anchored pattern. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts; WORKSPACE_PLACEHOLDER = /^\\{workspace:(?&lt;name&gt;\[^}\]+)\\}$/u -&gt; packages/cli/src/config/configurations.ts (EXG-069; replaces WORKSPACE_PREFIX and the endsWith check).
- nestedToolFiles (function, 106-130): **move** to `packages/cli/src/execution/command/placeholders.ts` `nestedToolFiles`. EXG-002: arguments/public.ts becomes command/placeholders.ts.
- commandToolFiles (function exported, 139-163): **move** to `packages/cli/src/execution/command/placeholders.ts` `commandToolFiles`. EXG-002: arguments/public.ts becomes command/placeholders.ts; used by command/check.ts and its test.
- isolatedFiles (function exported, 172-184): **move** to `packages/cli/src/execution/command/placeholders.ts` `scratchFiles`. EXG-002: arguments/public.ts becomes command/placeholders.ts; NMS table B, glossary scratch copy: isolatedFiles becomes scratchFiles; EXG-019 then has one caller, prepareInScratch, in check.ts.
- substituteValue (function exported, 194-219): **move** to `packages/cli/src/execution/command/placeholders.ts` `substituteValue`. EXG-002: arguments/public.ts becomes command/placeholders.ts; two checks and command/check.ts use it; the list-setting guard stays (EXG-038).
- substitute (function exported, 229-247): **move** to `packages/cli/src/execution/command/placeholders.ts` `substitute`. EXG-002: arguments/public.ts becomes command/placeholders.ts; EXG-039: read the {setting:} name from a whole-argument pattern group, with no lastIndex reset. Values to config: WHOLE_SETTING_PLACEHOLDER = /^\\{setting:(?&lt;name&gt;\[a-z\\d\_.-\]+)\\}$/u -&gt; packages/cli/src/config/configurations.ts (EXG-039; replaces the '{setting:' slice).
- perFileCommands (function exported, 255-261): **move** to `packages/cli/src/execution/command/placeholders.ts` `perFileCommands`. EXG-002: arguments/public.ts becomes command/placeholders.ts; the generated-code check, batches.ts and check.ts use it.

## `packages/cli/src/execution/command/contracts.ts`

- prefixScope (function, 27-31): **move** to `packages/cli/src/execution/command/output.ts` `prefixScope`. EXG-002: command/contracts.ts becomes command/output.ts.
- countMatches (function, 33-37): **delete**. One caller, markFailure, and finding_count_pattern leaves the command-check and manifest check schemas (TML-004), so a nonzero exit marks the failure and the count goes (PAR-005).
- unexplainedFailure (function, 39-56): **move** to `packages/cli/src/execution/command/output.ts` `unexplainedFailure`. EXG-002: command/contracts.ts becomes command/output.ts.
- markFailure (function, 58-72): **move** to `packages/cli/src/execution/command/output.ts` `markFailure`. EXG-002: command/contracts.ts becomes command/output.ts; finding_count_pattern leaves both check schemas (TML-004), so the counting branch goes and a nonzero exit marks the failure.
- attributeFile (function, 75-80): **move** to `packages/cli/src/execution/command/output.ts` `attributeFile`. EXG-002: command/contracts.ts becomes command/output.ts.
- isOnDisk (function, 82-87): **move** to `packages/cli/src/execution/command/output.ts` `isOnDisk`. EXG-002: command/contracts.ts becomes command/output.ts.
- redactedFindings (function, 89-104): **move** to `packages/cli/src/execution/command/output.ts` `redactedFindings`. EXG-002: command/contracts.ts becomes command/output.ts; EXG-033 keeps the redaction and takes the TruffleHog name out of the generic messages.
- parsedFindings (function, 106-111): **move** to `packages/cli/src/execution/command/output.ts` `parsedFindings`. EXG-002: command/contracts.ts becomes command/output.ts; EXG-033: the flag is redactsOutput.
- outputFailure (function, 113-117): **move** to `packages/cli/src/execution/command/output.ts` `outputFailure`. EXG-002: command/contracts.ts becomes command/output.ts.
- isToolBroken (function, 127-132): **move** to `packages/cli/src/execution/command/output.ts` `isToolBroken`. EXG-002: command/contracts.ts becomes command/output.ts; EXG-065 states the verifyFiles rule in its comment; finding_count_pattern leaves both check schemas, so its test leaves the condition (TML-004).
- finishResult (function exported, 143-163): **move** to `packages/cli/src/execution/command/output.ts` `finishResult`. EXG-002: command/contracts.ts becomes command/output.ts; used by check.ts; finding_count_pattern leaves both check schemas, so its test and the counting-checks comment go (TML-004).
- commandOutcome (function exported, 172-179): **move** to `packages/cli/src/execution/command/output.ts` `commandOutcome`. EXG-002: command/contracts.ts becomes command/output.ts; used by check.ts.
- recordInvocation (function exported, 187-200): **move** to `packages/cli/src/execution/command/output.ts` `recordInvocation`. EXG-002: command/contracts.ts becomes command/output.ts; EXG-035 takes tool as a parameter and deletes the throw for a state that cannot happen.
- checkedFindings (function exported, 209-217): **move** to `packages/cli/src/execution/command/output.ts` `checkedFindings`. EXG-002: command/contracts.ts becomes command/output.ts; crash detection that the output-format unit tests call directly; TPP-037 trims their repeated assertion.
- executionFailure (function exported, 226-241): **move** to `packages/cli/src/execution/command/output.ts` `executionFailure`. EXG-002: command/contracts.ts becomes command/output.ts; EXG-017: called once from the shared run step; message per EXG-044.
- hasToolError (function exported, 250-254): **move** to `packages/cli/src/execution/command/output.ts` `hasToolError`. EXG-002: command/contracts.ts becomes command/output.ts; used by fixes.ts and its test.
- toolOutputDetail (function exported, 262-267): **move** to `packages/cli/src/execution/command/output.ts` `toolOutputDetail`. EXG-002: command/contracts.ts becomes command/output.ts; used by 11 checks.
- toolDeadline (function exported, 274-276): **move** to `packages/cli/src/tools/run.ts` `toolTimeoutSeconds`. EXG-030, EXG-030, glossary timeout: one reader of tool_timeout_seconds for checks, fixers, installs and tools, in tools/, the lowest folder that calls it, beside runTool. Values to config: TOOL_TIMEOUT_SETTING = 'tool_timeout_seconds' -&gt; packages/cli/src/config/settings/values.ts (beside TOOL_TIMEOUT).

## `packages/cli/src/execution/command/public.ts`

- runCommands (function, 47-79): **move** to `packages/cli/src/execution/command/check.ts` `runCommands`. EXG-002: command/public.ts becomes command/check.ts; EXG-017: run and classify through one shared step.
- checkTool (function, 81-96): **move** to `packages/cli/src/execution/command/check.ts` `checkTool`. EXG-002: command/public.ts becomes command/check.ts; EXG-018 calls the new findTool; EXG-038: the empty-command throw goes.
- companionEnvironment (function, 99-110): **move** to `packages/cli/src/execution/command/check.ts` `companionEnvironment`. EXG-002: command/public.ts becomes command/check.ts.
- missingToolFile (function, 113-132): **move** to `packages/cli/src/execution/command/check.ts` `missingToolFile`. EXG-002: command/public.ts becomes command/check.ts.
- runInWorkspace (function, 136-161): **move** to `packages/cli/src/execution/command/check.ts` `runInScratch`. EXG-002: command/public.ts becomes command/check.ts; NMS-007, NMS-007, glossary scratch copy: runInWorkspace becomes runInScratch; EXG-019 copies and prepares through prepareInScratch.
- unavailableCompanion (function, 164-176): **move** to `packages/cli/src/execution/command/check.ts` `unavailableCompanion`. EXG-002: command/public.ts becomes command/check.ts; EXG-018 uses findTool.
- commandEnvironment (function exported, 184-205): **move** to `packages/cli/src/execution/command/check.ts` `commandEnvironment`. EXG-002: command/public.ts becomes command/check.ts; used by fixes.ts and four test files.
- prepareCommand (function exported, 216-230): **move** to `packages/cli/src/execution/command/check.ts` `prepareCommand`. EXG-002: command/public.ts becomes command/check.ts; used by fixes.ts and tests.
- runCheckCommand (function exported, 239-262): **move** to `packages/cli/src/execution/command/check.ts` `runCheckCommand`. EXG-002: command/public.ts becomes command/check.ts: the runner of a command check; EXG-018 uses findTool.
- runCheckTool (function exported, 271-297): **move** to `packages/cli/src/execution/command/check.ts` `runCheckTool`. EXG-002: command/public.ts becomes command/check.ts; EXG-041 drops the early cancel throw; EXG-031: CRLF conversion moves into runTool.

## `packages/cli/src/execution/contracts.ts`

- fixFailure (function, 31-40): **move** to `packages/cli/src/execution/fixes.ts` `fixFailure`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; it writes the note as name exited code: toolOutputDetail(result, ...), like outputFailure, not a second copy of toolOutputDetail without the TAIL_LINES bound (S04-009).
- runFix (function, 42-64): **move** to `packages/cli/src/execution/fixes.ts` `runFix`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; EXG-017: the shared run step.
- isolatedFix (function, 66-102): **move** to `packages/cli/src/execution/fixes.ts` `scratchFix`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; NMS table B: isolatedFix becomes scratchFix; EXG-019: prepareInScratch.
- mergedResult (function, 105-111): **move** to `packages/cli/src/execution/fixes.ts` `mergedResult`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts.
- runCommandFix (function, 113-147): **move** to `packages/cli/src/execution/fixes.ts` `runCommandFix`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; EXG-018: findTool.
- runFixer (function, 150-163): **move** to `packages/cli/src/execution/fixes.ts` `runFixer`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; NMS table B: the local nativeFix becomes builtInFix.
- assertCoverage (function, 166-171): **delete**. EXG-037: a runtime self-check of gspot's own built-in checks; a unit test covers checks that return files.
- checkResult (function, 174-189): **move** to `packages/cli/src/execution/built-in.ts` `checkResult`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; the built-in check adapter, without the assertCoverage call (EXG-037).
- contentsOf (function exported, 197-208): **move** to `packages/cli/src/execution/fixes.ts` `contentsOf`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; applyFixers moves to fixes.ts too, so stop exporting.
- changedPaths (function exported, 216-228): **move** to `packages/cli/src/execution/fixes.ts` `changedPaths`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; the same file as applyFixers, so stop exporting.
- fixerPasses (function exported, 241-263): **move** to `packages/cli/src/execution/fixes.ts` `fixerPasses`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; the same file as applyFixers, so stop exporting.
- checkInput (function exported, 271-299): **move** to `packages/cli/src/execution/built-in.ts` `checkInput`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; checks and tests build inputs with it.
- runBuiltInCheck (function exported, 306-321): **move** to `packages/cli/src/execution/built-in.ts` `runBuiltInCheck`. NMS table A: execution/contracts.ts splits into fixes.ts and built-in.ts; used by checks/built-in.ts.
- checkRun (function exported, 329-336): **inline** to `packages/cli/src/execution/run.ts` `planChecks`. S04-001: once EXG-038 deletes the throw (after TCO-006 moves it into assertManifests), it is the one-line lookup checks\[name\]?.run ?? runCheckCommand with one caller, planChecks; the two github-actions tests call runCheckCommand(session, planned) directly.

## `packages/cli/src/execution/copy/contracts.ts`

- copyTree (function, 38-66): **move** to `packages/cli/src/execution/copy/dependencies.ts` `copyTree`. NMS table A: copy/contracts.ts becomes copy/dependencies.ts; EXG-058 keeps junction links.
- relocated (function, 69-75): **move** to `packages/cli/src/execution/copy/dependencies.ts` `relocated`. NMS table A: copy/contracts.ts becomes copy/dependencies.ts.
- repairLink (function, 78-89): **move** to `packages/cli/src/execution/copy/dependencies.ts` `repairLink`. NMS table A: copy/contracts.ts becomes copy/dependencies.ts.
- assertDependencyReady (function, 91-107): **move** to `packages/cli/src/execution/copy/revision.ts` `assertDependencyReady`. Install has no installing state, so the installing check and its pending parameter go; revision checks go with revisionDependencies; EXG-044 message.
- assertValeMatches (function, 110-117): **move** to `packages/cli/src/execution/copy/revision.ts` `assertValeMatches`. It goes with copyValePackages; EXG-044 names the action in the message.
- copyPackageFile (function, 120-126): **move** to `packages/cli/src/execution/copy/revision.ts` `copyPackageFile`. It goes with copyValePackages.
- getDependencies (function, 130-136): **move** to `packages/cli/src/execution/copy/revision.ts` `listDependencyFolders`. NMS-016: a get name hides a file-system read; no copy holds .venv, so it lists only package.json folders whose node_modules exists and returns the folder strings, and DependencyFolder and the node_modules filter in revisionDependencies go (EXG-055). Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts; NODE_MODULES = 'node_modules' -&gt; packages/cli/src/config/repository/tracked.ts.
- assertManifestsUnchanged (function, 140-163): **move** to `packages/cli/src/execution/copy/revision.ts` `assertDependencyFilesUnchanged`. Glossary dependency file: it checks package.json and lockfiles, not manifest.toml; EXG-044 message. Values to config: GIT_HASH_PATHS = \['hash-object', '--stdin-paths'\] -&gt; packages/cli/src/config/execution/copy.ts.
- copyDependencies (function exported, 175-198): **move** to `packages/cli/src/execution/copy/dependencies.ts` `copyDependencies`. NMS table A: copy/contracts.ts becomes copy/dependencies.ts; EXG-040 deletes the doubled doc comment; EXG-022: the revision copy calls it directly.
- copyValePackages (function exported, 206-214): **move** to `packages/cli/src/execution/copy/revision.ts` `copyValePackages`. Only the revision copy calls it, so it moves to copy/revision.ts.
- revisionDependencies (function exported, 224-260): **move** to `packages/cli/src/execution/copy/revision.ts` `revisionDependencies`. Install has no installing state, so no ownership read for the installing list is left; the node_modules filter goes (EXG-055); the revision copy code sits in copy/revision.ts. Values to config: PACKAGE_SWIFT = 'Package.swift' -&gt; packages/cli/src/config/parsers/dependency-files.ts.

## `packages/cli/src/execution/copy/public.ts`

- writeScratchFile (function, 42-57): **move** to `packages/cli/src/execution/copy/scratch.ts` `writeScratchFile`. NMS table A: copy/public.ts splits into scratch.ts and revision.ts.
- caseCollision (function, 60-68): **move** to `packages/cli/src/execution/copy/revision.ts` `caseCollision`. The revision copy code sits in copy/revision.ts; EXG-058 keeps the refusal.
- populateRevision (function, 70-111): **move** to `packages/cli/src/execution/copy/revision.ts` `populateRevision`. The revision copy code sits in copy/revision.ts; EXG-022: it writes files only.
- WORKSPACE_SOURCE_MEMO (const, 113-113): **move** to `packages/cli/src/repository/scopes.ts` `WORKSPACE_SOURCE_MEMO`. EXG-023, EXG-067: it goes with workspaceSourceFiles; a memo key holds its cache factory, which is code, so it stays beside its function, not in config/.
- copyInto (function exported, 119-131): **move** to `packages/cli/src/execution/copy/scratch.ts` `writeScratchFiles`. EXG-022: it keeps only the file loop, and dependencies go through copyDependencies; the test install setup calls the two parts.
- copyIntoScratch (function exported, 142-162): **move** to `packages/cli/src/execution/copy/scratch.ts` `copyIntoScratch`. The scratch copy code sits in copy/scratch.ts; EXG-054: one input shape and the folder prefix gspot-copy-. Values to config: SCRATCH_FOLDER_PREFIX = 'gspot-copy-' -&gt; packages/cli/src/config/execution/copy.ts (EXG-054 name).
- projectCopyInputs (function exported, 171-191): **move** to `packages/cli/src/execution/copy/scratch.ts` `projectCopyInputs`. The scratch copy code sits in copy/scratch.ts; it joins each project with NODE_MODULES from config/repository/tracked.ts instead of mapping over a list (EXG-055).
- checkOutRevision (function exported, 201-234): **move** to `packages/cli/src/execution/copy/revision.ts` `copyRevision`. NMS-007, NMS table B: it copies a revision into a scratch copy, so copyRevision; EXG-032: gitTopLevel; EXG-022 calls copyDependencies directly. Values to config: REVISION_FOLDER_PREFIX = 'gspot-revision-' -&gt; packages/cli/src/config/execution/copy.ts; GIT_SHARED_CLONE = \['clone', '--shared', '--no-checkout', '--quiet', '--'\] -&gt; packages/cli/src/config/execution/copy.ts; GIT_SET_HEAD = \['update-ref', '--no-deref', 'HEAD'\] -&gt; packages/cli/src/config/execution/copy.ts; GIT_EMPTY_INDEX = \['read-tree', '--empty'\] -&gt; packages/cli/src/config/execution/copy.ts; GIT_INDEX_INFO = \['update-index', '-z', '--index-info'\] -&gt; packages/cli/src/config/execution/copy.ts; GIT_WRITE_TREE = \['write-tree'\] -&gt; packages/cli/src/config/execution/copy.ts.
- workspaceSourceFiles (function exported, 244-301): **move** to `packages/cli/src/repository/scopes.ts` `workspaceSourceFiles`. EXG-023: it copies nothing, so it moves beside packageWorkspaces in repository/scopes.ts. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.

## `packages/cli/src/execution/public.ts`

- policyErrorsResult (function, 40-50): **delete**. EXG-003: gspot/policy runs as an ordinary built-in check, so the special result goes.
- planExecutables (function, 53-58): **move** to `packages/cli/src/execution/run.ts` `planChecks`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-045: planExecutables becomes planChecks; EXG-003 drops the filter; it takes in checkRun, so run is checks\[name\]?.run ?? runCheckCommand (S04-001).
- refreshAfterFixes (function, 61-70): **move** to `packages/cli/src/execution/run.ts` `refreshAfterFixes`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-025 drops the opened parameter.
- unrunnable (function, 73-82): **move** to `packages/cli/src/execution/run.ts` `unrunnable`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-018: findTool for Docker; EXG-067: the comment says Docker is not installed. Values to config: DOCKER_TOOL = 'docker' -&gt; packages/cli/src/config/checks/infrastructure/docker.ts.
- checkFailure (function, 85-92): **move** to `packages/cli/src/execution/run.ts` `checkFailure`. NMS table A: execution/public.ts becomes execution/run.ts.
- runOne (function, 95-108): **move** to `packages/cli/src/execution/run.ts` `runOne`. NMS table A: execution/public.ts becomes execution/run.ts.
- mergeUses (function, 111-116): **delete**. EXG-066: dropIgnoredFindings adds matches into the run map directly.
- dropIgnoredFindings (function, 119-133): **move** to `packages/cli/src/execution/run.ts` `dropIgnoredFindings`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-066; finding_count_pattern leaves both check schemas (TML-004), so countedFailure goes and the status follows the kept findings.
- settleResult (function, 136-143): **move** to `packages/cli/src/execution/run.ts` `settleResult`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-026 passes push to reproduceLine.
- runChecks (function, 146-165): **move** to `packages/cli/src/execution/run.ts` `runChecks`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-056: availableParallelism, with one docs sentence. Values to config: JOBS_VARIABLE = 'GSPOT_JOBS' -&gt; packages/cli/src/config/execution/run.ts.
- replanAfterFixes (function, 168-183): **move** to `packages/cli/src/execution/run.ts` `replanAfterFixes`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-025.
- isEntryMatch (function, 185-189): **move** to `packages/cli/src/execution/ignores.ts` `isEntryMatch`. The ignore code sits in execution/ignores.ts.
- applyFixers (function exported, 198-238): **move** to `packages/cli/src/execution/fixes.ts` `applyFixers`. The fixer code sits in execution/fixes.ts; run.ts and the fixer unit tests call it.
- executeRun (function exported, 246-295): **move** to `packages/cli/src/execution/run.ts` `executeRun`. NMS table A: execution/public.ts becomes execution/run.ts; EXG-024 drops the second index read and its getter.
- applyIgnores (function exported, 303-312): **move** to `packages/cli/src/execution/ignores.ts` `applyIgnores`. The ignore code sits in execution/ignores.ts; the unused-entries check and tests use it.
- reproduceLine (function exported, 326-338): **move** to `packages/cli/src/execution/report.ts` `reproduceLine`. The report code sits in execution/report.ts; EXG-026: run.ts passes push, so commands/check/tree.ts stops rewriting it; the command line is text people read, so its words stay in the function.

## `packages/cli/src/execution/report.ts`

- failedChecks (function, 9-13): **keep** to `packages/cli/src/execution/report.ts` `failedChecks`. execution/report.ts stays.
- isIncomplete (function, 16-20): **keep** to `packages/cli/src/execution/report.ts` `isIncomplete`. execution/report.ts stays. Values to config: INCOMPLETE_STATUSES = new Set(\['missing', 'error'\]) -&gt; packages/cli/src/config/execution/run.ts (typed by CHECK_STATUSES).
- emptyResult (function exported, 27-36): **keep** to `packages/cli/src/execution/report.ts` `emptyResult`. execution/report.ts stays; used by checks and execution.
- buildRunReport (function exported, 43-76): **keep** to `packages/cli/src/execution/report.ts` `buildRunReport`. execution/report.ts stays; EXG-067 deletes the results alias.
- historyResult (function exported, 85-88): **move** to `packages/cli/src/checks/general/history.ts` `historyResult`. EXG-027: a check helper used only by commits.ts and secrets.ts in checks/general/.

## `packages/cli/src/generation/bunfig.ts`

- bunfigChanges (function exported, 14-39): **keep** to `packages/cli/src/generation/bunfig.ts` `bunfigChanges`. bunfig.ts stays; EXG-060 takes the Bun lockfile names from LOCKFILES; dependencies.scanner is absent when unset, so the test is scanner !== undefined (TML-010). Values to config: BUNFIG_FILE = 'bunfig.toml' -&gt; packages/cli/src/config/generation/file-edits.ts; RELEASE_AGE_KEY = \['install', 'minimumReleaseAge'\] -&gt; packages/cli/src/config/generation/file-edits.ts; SCANNER_KEY = \['install', 'security', 'scanner'\] -&gt; packages/cli/src/config/generation/file-edits.ts; RELEASE_AGE_SETTING = 'dependencies.min_release_age_days' -&gt; packages/cli/src/config/generation/file-edits.ts; SCANNER_SETTING = 'dependencies.scanner' -&gt; packages/cli/src/config/generation/file-edits.ts; DEPENDENCIES_CONFIGURATION = 'dependencies' -&gt; packages/cli/src/config/generation/file-edits.ts.

## `packages/cli/src/generation/compilation/contracts.ts`

- prefixed (function, 21-24): **delete**. POL-047: a second copy of prefixScopePath; its one caller, the knip entry files in generation/tool-file-sources/knip.ts, calls prefixScopePath from settings/paths.ts.
- unwrapSetting (function, 26-33): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- childSetting (function, 35-46): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- settingChildren (function, 48-63): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go, with the EXG-036 throw.
- proseInputs (function exported, 71-96): **move** to `packages/cli/src/generation/prose.ts` `proseInputs`. The Vale style builder writes the style banned-headings from BANNED_HEADINGS and docs.banned_headings; the typed Vale builders import VALE_PACKAGES, BANNED_HEADINGS, BLOCK_IGNORES and TOKEN_IGNORES from config/, PROSE_FORMATS becomes a config constant, and proseInputs returns only words, products and rules (S04-003); words is the value list of allowed_words = { value = \[...\], reason = "..." } (TMF-007). Values to config: PROSE_FORMATS = the \[extension, format\] pairs derived from PROSE_GRAMMARS -&gt; packages/cli/src/config/tools/vale.ts; VALE_TOOL = 'vale' -&gt; packages/cli/src/config/tools/vale.ts; VALE_RULE_EXTENSION = '.yml' -&gt; packages/cli/src/config/tools/vale.ts.
- entryFiles (function exported, 106-120): **move** to `packages/cli/src/generation/tool-file-sources/knip.ts` `entryFiles`. Its one reader is the knip settings file, which becomes a typed builder (CFL-001); glossary: template is the gspot export file, so not templates.ts. Values to config: KNIP_ENTRY_SETTING = 'tools.knip.entry' -&gt; packages/cli/src/config/generation/tool-file-sources.ts.
- nativeSetting (function exported, 127-159): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- compileNamespace (function exported, 166-186): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- validateDefaults (function exported, 193-215): **delete**. Defaults are declared once in TypeScript beside their zod schemas in settings/schema/tables.ts, so no manifest default is left to check at build time.
- effectiveNamespace (function exported, 223-238): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- requiredSettings (function exported, 246-267): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- publicToolTables (function exported, 274-297): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.

## `packages/cli/src/generation/compilation/public.ts`

- stylelintRuleNames (const, 62-62): **move** to `packages/cli/src/generation/tool-file-sources/stylelint.ts` `stylelintRuleNames`. CFL-001: input of the Stylelint settings builder; EXG-064, ARC-028: read with readAsset on first use, not at module load. Values to config: STYLELINT_RULE_NAMES_FILE = 'configurations/language/css/stylelint-rule-names.json' -&gt; packages/cli/src/config/generation/tool-file-sources.ts.
- htmlRules (function, 65-75): **move** to `packages/cli/src/generation/tool-file-sources/html-validate.ts` `htmlRules`. CFL-018: the two html-validate files become one builder beside HTML_RULES; CFL-001.
- scopeInputs (function, 77-135): **delete**. CFL-001: the 60-field value bag goes; each settings builder computes the few values it reads (pointers, entry files, scope dependencies, ignored paths).
- compiledSetting (function, 137-142): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- schemaFields (function, 144-146): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- namingSchemas (function, 148-170): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go, with the EXG-036 throw.
- schemaModule (function, 172-174): **delete**. POL-001: settings get hand-written zod schemas, so the setting-schema generator and its helpers go.
- eta (const exported, 177-177): **delete**. CFL-001: Eta and the eta dependency go; fragments become TypeScript functions.
- etaInputs (function exported, 186-242): **delete**. CFL-001: builders take typed inputs, so etaInputs goes.
- emitTarget (function exported, 252-267): **move** to `packages/cli/src/generation/tool-files.ts` `emitTarget`. One caller, emitToolFile; there is no Eta render, so it takes a plain file or builder output (CFL-001); there is no header inside .gspot/ and no \_gspot key, so the JSON branch returns jsonText only and a header is written only when the target is outside .gspot/, and the manifest field generated_header leaves the \[\[tool_file\]\] schema and the 10 manifests that set it (GEN-017); stop exporting.
- settingSchemaSources (function exported, 274-333): **delete**. POL-001: the generator, its script scripts/setting-values.ts and its tests go.

## `packages/cli/src/generation/contracts.ts`

- hookScript (function, 22-42): **move** to `packages/cli/src/generation/hooks.ts` `hookScript`. EXG-014: generation/contracts.ts splits into hooks.ts and python.ts; EXG-058 keeps cygpath; the start command comes from the repository: the package manager row of RUNNERS when the root package.json lists @gspothq/cli, else mise, so the runner ?? "gspot" fallback and the bare gspot row go (INX-003, INX-005). Values to config: HOOK_SHEBANG = '#!/bin/sh' -&gt; packages/cli/src/config/generation/hooks.ts; COMMIT_MESSAGE_PATH_LINES = the three shell lines that make the commit message path absolute (the case line, the cygpath line, set --) -&gt; packages/cli/src/config/generation/hooks.ts.
- hookPrefix (function exported, 49-54): **move** to `packages/cli/src/system/git.ts` `gitPrefix`. EXG-032: Git helper beside hooksDirectory (platform/git becomes system/git.ts); callers pass hasGit instead of calling isGitRepository, so system/ imports nothing from repository/. Values to config: GIT_PREFIX_ARGUMENTS = \['rev-parse', '--show-prefix'\] -&gt; packages/cli/src/config/system/git.ts.
- hookLine (function exported, 62-64): **move** to `packages/cli/src/generation/hooks.ts` `hookLine`. EXG-014: moves to generation/hooks.ts; install/hooks.ts uses it; it takes the RUNNERS row chosen from the repository (INX-003).
- hookFiles (function exported, 73-82): **move** to `packages/cli/src/generation/hooks.ts` `hookFiles`. EXG-014: moves to generation/hooks.ts; used by files.ts and hook tests; one new function here returns the start runner from the repository: it calls selectNpmClient when the root package.json lists @gspothq/cli in dependencies or devDependencies, and otherwise returns the mise row of RUNNERS; it replaces policy.runner, detectRunner is deleted (INX-003), and the knip tool file reads the same function (TMF-002).
- pythonProject (function exported, 89-110): **move** to `packages/cli/src/generation/python.ts` `pythonProject`. EXG-014: moves to generation/python.ts; GEN-015 pins Python; the Python tool project is named tools, because PEP 621 needs a name and uv never builds it, so TOOLS_PROJECT and the name checks go (INX-010).
- pythonInputs (function exported, 118-151): **move** to `packages/cli/src/generation/python.ts` `pythonInputs`. EXG-014: moves to generation/python.ts; CFL-001: input of the Ruff and basedpyright builders; CFL-022 drops basedpyrightOptions; generatedIgnores takes the configurations declarations plus the linguist-generated and linguist-vendored patterns read from every tracked .gitattributes, each prefixed with its folder, through a new repository function beside attributeKind (TMF-001, CFR-005); the exclude argument goes (TMF-003). Values to config: PYTHON_ENVIRONMENT_FOLDER = '.venv' -&gt; packages/cli/src/config/tools/python.ts.

## `packages/cli/src/generation/documents/contracts.ts`

- expandAlternatives (function, 28-69): **move** to `packages/cli/src/generation/ignore-patterns.ts` `expandAlternatives`. EXG-015: documents/ is split by job, and the ignore patterns go to generation/ignore-patterns.ts. Values to config: BRACE_TOKENS = /\\\\\[\\s\\S\]|\\\[(?:\\\\\[\\s\\S\]|\[^\\\]\\\\\])\*\\\]?|\[{},\]/gu -&gt; packages/cli/src/config/generation/ignore-patterns.ts (the brace and escape tokenizer).
- expandGlobstarSkips (function, 72-76): **move** to `packages/cli/src/generation/ignore-patterns.ts` `expandGlobstarSkips`. EXG-015: documents/ is split by job, and the ignore patterns go to generation/ignore-patterns.ts.
- rebaseOntoScope (function, 78-95): **move** to `packages/cli/src/generation/ignore-patterns.ts` `rebaseOntoScope`. EXG-015: documents/ is split by job, and the ignore patterns go to generation/ignore-patterns.ts.
- commented (function, 97-100): **move** to `packages/cli/src/generation/headers.ts` `commented`. EXG-015: documents/ is split by job, and the header code goes to generation/headers.ts.
- headerLines (function, 107-109): **merge** to `packages/cli/src/parsers/generated-header.ts` `generatedHeader`. EXG-048: the header text lives once, beside the reader, as generatedHeader, which takes no version (GEN-017).
- ruleId (function, 112-116): **move** to `packages/cli/src/generation/rule-capture.ts` `ruleId`. EXG-015: documents/ is split by job, and rule capture goes to generation/rule-capture.ts.
- getTable (function, 119-127): **merge** to `packages/cli/src/objects.ts` `valueAt`. It repeats valueAt in system/objects.ts; its extra throw guards shipped rule_keys paths, a gspot bug that tests catch (EXG-038).
- mapRules (function, 129-138): **move** to `packages/cli/src/generation/rule-capture.ts` `mapRules`. EXG-015: documents/ is split by job, and rule capture goes to generation/rule-capture.ts.
- getRules (function, 140-147): **move** to `packages/cli/src/generation/rule-capture.ts` `rulesAt`. EXG-015: documents/ is split by job, and rule capture goes to generation/rule-capture.ts; NMS-016: a pure lookup gets a plain name, not get.
- scopeIgnorePatterns (function exported, 155-164): **move** to `packages/cli/src/generation/ignore-patterns.ts` `scopeIgnorePatterns`. EXG-015: documents/ is split by job, and the ignore patterns go to generation/ignore-patterns.ts; used by the semgrep and typos builders and its test.
- generatedIgnores (function exported, 172-174): **move** to `packages/cli/src/generation/ignore-patterns.ts` `generatedIgnores`. EXG-015: documents/ is split by job, and the ignore patterns go to generation/ignore-patterns.ts; used by hooks/python, eslint and jsconfig; it takes the configurations declarations plus the linguist-generated and linguist-vendored patterns from every tracked .gitattributes, each prefixed with its folder (TMF-001, CFR-005); the exclusions parameter goes (TMF-003); the five tool files (.prettierignore, typos extend-exclude, ESLint ignores, knip ignore, Ruff and basedpyright excludes) use it. Values to config: ALWAYS_IGNORED = \['\*\*/node_modules/\*\*', DOT_GSPOT + '/\*\*'\] -&gt; packages/cli/src/config/generation/ignore-patterns.ts.
- selectedIgnorePaths (function exported, 181-196): **move** to `packages/cli/src/generation/ignore-patterns.ts` `selectedIgnorePaths`. EXG-015: documents/ is split by job, and the ignore patterns go to generation/ignore-patterns.ts; input of the ignore-file builders (CFL-001).
- hashCommentHeader (function exported, 203-205): **move** to `packages/cli/src/generation/headers.ts` `hashCommentHeader`. EXG-015: documents/ is split by job, and the header code goes to generation/headers.ts, with no version parameter (GEN-017).
- headerFor (function exported, 213-225): **move** to `packages/cli/src/generation/headers.ts` `headerFor`. EXG-015: documents/ is split by job, and the header code goes to generation/headers.ts, with no version parameter; it serves only files outside .gspot/, the pointers (GEN-017). Values to config: DASH_COMMENT_EXTENSIONS = new Set(\['.sql'\]) -&gt; packages/cli/src/config/generation/headers.ts (beside the other comment-style sets).
- addJsonHeader (function exported, 234-239): **delete**. GEN-017 drops the \_gspot JSON key, so no JSON tool file carries a header, emitTarget returns jsonText for JSON, and this function has no caller.
- fillTarget (function exported, 248-261): **move** to `packages/cli/src/generation/pointers.ts` `fillTarget`. EXG-015: documents/ is split by job, and the pointer code goes to generation/pointers.ts. Values to config: TARGET_MODULE_PLACEHOLDER = '{target_module}' -&gt; packages/cli/src/config/configurations.ts; TARGET_JSON_PLACEHOLDER = '{target_json}' -&gt; packages/cli/src/config/configurations.ts (beside TARGET_PLACEHOLDER).
- relativeTarget (function exported, 269-272): **move** to `packages/cli/src/generation/pointers.ts` `relativeTarget`. EXG-015: documents/ is split by job, and the pointer code goes to generation/pointers.ts; redirects.ts uses it.
- bodyPointer (function exported, 282-295): **move** to `packages/cli/src/generation/pointers.ts` `bodyPointer`. EXG-015: documents/ is split by job, and the pointer code goes to generation/pointers.ts.
- collectRules (function exported, 303-307): **move** to `packages/cli/src/generation/rule-capture.ts` `collectRules`. EXG-015: documents/ is split by job, and rule capture goes to generation/rule-capture.ts; CFL-001: the emitter takes the rule list from the parsed file, and recordRules goes.
- pointerPaths (function exported, 315-346): **move** to `packages/cli/src/generation/pointers.ts` `pointerPaths`. EXG-015: documents/ is split by job, and the pointer code goes to generation/pointers.ts; it types its context inline, so pointers.ts does not import tool-files.ts.

## `packages/cli/src/generation/documents/public.ts`

- pinned (function, 36-40): **move** to `packages/cli/src/generation/ci.ts` `pinned`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- buildCheckScript (function, 43-58): **move** to `packages/cli/src/generation/ci.ts` `buildCheckScript`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; EXG-059 deletes the SHA regex block. Values to config: ZERO_SHAS = \['0'.repeat(40), '0'.repeat(64)\] -&gt; packages/cli/src/config/generation/ci.ts; CI_BASE_VARIABLE = 'GSPOT_CI_BASE' -&gt; packages/cli/src/config/generation/ci.ts (also used by githubFile and gitlabFile).
- buildJob (function, 60-104): **move** to `packages/cli/src/generation/ci.ts` `buildJob`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; one job shape: checkout, cache, mise-action at CI_PINS.mise.version, then mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot install and the check step, plus &lt;manager&gt;@&lt;version&gt; in the tool list when the npm tool project uses Bun, pnpm, or Yarn; the setup-node step and Pipeline.isMise go (INS-003); setup is ci.setup_command (TML-014); EXG-059: one CI_TIMEOUT_MINUTES. Values to config: CI_TIMEOUT_MINUTES = 60 -&gt; packages/cli/src/config/generation/ci.ts (GitLab writes it as minutes too); CI_CACHE_FILES = \[SETTINGS_FILE, NPM_TOOL_PROJECT_FILE, DOT_GSPOT + '/\*lock\*', PYTHON_TOOL_PROJECT_FILE, MISE_TOOL_PROJECT_FILE, VERSION_PIN_FILE\] -&gt; packages/cli/src/config/generation/ci.ts; CHECKOUT_OPTIONS = { 'fetch-depth': 0, 'persist-credentials': false } -&gt; packages/cli/src/config/generation/ci.ts.
- asList (function, 107-110): **move** to `packages/cli/src/generation/formatting.ts` `asList`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- rebasePattern (function, 113-115): **move** to `packages/cli/src/generation/formatting.ts` `rebasePattern`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- rebaseOverrides (function, 118-137): **move** to `packages/cli/src/generation/formatting.ts` `rebaseOverrides`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- formatEntries (function, 139-150): **move** to `packages/cli/src/generation/formatting.ts` `formatEntries`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; \[\[format.override\]\] records live only at the root with root-relative paths, so overrides are read from the root list, and a scope keeps its \[format\] values as dotted keys (CFR-004).
- policyOverrides (function, 153-161): **move** to `packages/cli/src/generation/formatting.ts` `formatSettingOverrides`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; glossary settings, not policy: policyOverrides becomes formatSettingOverrides.
- pluginEntries (function, 164-173): **move** to `packages/cli/src/generation/formatting.ts` `pluginEntries`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- editorconfigSelector (function, 176-187): **move** to `packages/cli/src/generation/formatting.ts` `editorconfigSelector`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- prettierOptions (function, 194-204): **move** to `packages/cli/src/generation/formatting.ts` `prettierOptions`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts.
- githubFile (function exported, 212-252): **move** to `packages/cli/src/generation/ci.ts` `githubFile`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; INS-003: no setup-node branch, and the command is computed once: mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot; ci.files is deleted, so the all branch of buildCheckScript goes (TML-002); the jobs run on ci.operating_systems (TML-014). Values to config: GITHUB_BASE_EXPRESSION = the ${{ }} expression that picks the pull request, merge group, or push base SHA -&gt; packages/cli/src/config/generation/ci.ts; GITHUB_MANUAL_CONDITION = the push-to-default-branch condition of the manual job -&gt; packages/cli/src/config/generation/ci.ts; GITHUB_EVENTS = \['push', 'pull_request', 'merge_group'\] -&gt; packages/cli/src/config/generation/ci.ts; GITHUB_CONCURRENCY = the concurrency group and cancel-in-progress expressions -&gt; packages/cli/src/config/generation/ci.ts.
- gitlabFile (function exported, 259-283): **move** to `packages/cli/src/generation/ci.ts` `gitlabFile`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; INS-003; EXG-059; GitLab runs the same mise exec lines, with mise on its image, so the mise trust line, mise install, and the ciNpmInstall branch go; the all branch goes (TML-002). Values to config: GITLAB_BASE_LINE = GSPOT_CI_BASE="${CI\_MERGE\_REQUEST\_DIFF\_BASE\_SHA:-${CI_COMMIT_BEFORE_SHA:-}}" -&gt; packages/cli/src/config/generation/ci.ts; GITLAB_RULES = the two rules (merge request event, default branch) with their interruptible flags -&gt; packages/cli/src/config/generation/ci.ts.
- prettierConfiguration (function exported, 290-308): **move** to `packages/cli/src/generation/formatting.ts` `prettierConfiguration`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; CFL-001: the generator calls it for the Prettier tool file; the name PRETTIER_DEFAULTS holds another value, so its fixed options are PRETTIER_FIXED_OPTIONS. Values to config: PRETTIER_FIXED_OPTIONS = { arrowParens: 'always', embeddedLanguageFormatting: 'off' } -&gt; packages/cli/src/config/generation/formatting.ts.
- editorconfigOverrides (function exported, 316-327): **move** to `packages/cli/src/generation/formatting.ts` `editorconfigOverrides`. EXG-015: documents/public.ts splits into ci.ts and formatting.ts; CFL-001: input of the EditorConfig builder.
- ciNpmInstall (function exported, 334-336): **delete**. INS-003: generated CI always installs through mise, so the npm branch and its install line go, and the init plan shows the mise commands.

## `packages/cli/src/generation/eslint/boundaries.ts`

- roleDescriptors (function, 21-35): **delete**. TML-001: the five boundary roles are deleted, and one fixed rule stays: a file outside test_files may not import a file inside test_files, at level all, in every repository with JavaScript or TypeScript, so no role descriptor is left.
- dependencyPolicies (function, 38-59): **keep** to `packages/cli/src/generation/eslint/boundaries.ts` `dependencyPolicies`. TML-001: the five boundary roles are deleted, and one fixed rule stays: a file outside test_files may not import a file inside test_files, at level all, in every repository with JavaScript or TypeScript, so the role branches and ROLE_IMPORT_POLICIES give way to TEST_IMPORT_POLICY.
- boundarySettings (function, 62-83): **keep** to `packages/cli/src/generation/eslint/boundaries.ts` `boundarySettings`. TML-001: the five boundary roles are deleted, and one fixed rule stays: a file outside test_files may not import a file inside test_files, at level all, in every repository with JavaScript or TypeScript, so the role categories become one test-files category from test_files.
- boundaryBlocks (function exported, 93-135): **keep** to `packages/cli/src/generation/eslint/boundaries.ts` `boundaryBlocks`. EXG-052: the tRPC manifest says the server module must be named server; TML-001: the five boundary roles are deleted, and one fixed rule stays: a file outside test_files may not import a file inside test_files, at level all, in every repository with JavaScript or TypeScript, so roleDescriptors goes and a scope gets the block when it has modules or the level is all. Values to config: TRPC_CONFIGURATION = 'trpc' -&gt; packages/cli/src/config/generation/eslint.ts; TRPC_SERVER_MODULE = 'server' -&gt; packages/cli/src/config/generation/eslint.ts (EXG-052).

## `packages/cli/src/generation/eslint/configuration.ts`

- scopeBlocks (function, 33-55): **keep** to `packages/cli/src/generation/eslint/configuration.ts` `scopeBlocks`. EXG-051: build the import-boundaries rule once. Values to config: IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries' -&gt; packages/cli/src/config/generation/eslint.ts (EXG-051 builds the rule once).
- gspotRules (function, 58-74): **keep** to `packages/cli/src/generation/eslint/configuration.ts` `gspotRules`. EXG-051; EXG-007: index_exports through view.limit. Values to config: EXPORTS_LAST_RULE = 'import-x/exports-last' -&gt; packages/cli/src/config/generation/eslint.ts; BARREL_FILES_RULE = 'barrel-files/avoid-barrel-files' -&gt; packages/cli/src/config/generation/eslint.ts.
- limitsOf (function, 77-79): **delete**. EXG-007: templates read limits by their setting names.
- extraBlock (function, 82-90): **keep** to `packages/cli/src/generation/eslint/configuration.ts` `extraBlock`. Glossary extra tool options, already the right name; the extra table carries its reason as { value = ..., reason = "..." }, so the reason is read from that form and the tablesFor walk over table.reasons goes (CFR-002).
- eslintConfiguration (function exported, 97-130): **keep** to `packages/cli/src/generation/eslint/configuration.ts` `eslintConfiguration`. EXG-047: used only in its own file, so stop exporting; EXG-009, EXG-010 drop commentLevel and aliases; generatedIgnores takes the configurations declarations plus the linguist markers from every tracked .gitattributes (TMF-001, CFR-005); scriptPaths takes no policy (INX-011); runtimeBlocks takes no node version (TML-006). Values to config: IMPORT_LAYOUT_RULES = { 'import-x/first': 'error', 'import-x/newline-after-import': \['error', { count: 1 }\] } -&gt; packages/cli/src/config/generation/eslint.ts; ESLINT_SETTINGS_TABLE = 'tools.eslint' -&gt; packages/cli/src/config/generation/eslint.ts (also read by blocks.ts, runtimes.ts and the tool-file values).
- eslintInputs (function exported, 138-197): **keep** to `packages/cli/src/generation/eslint/configuration.ts` `eslintInputs`. CFL-001: the typed ESLint builder imports eslintRuleSettings and eslintErrorRules and reads the manifests itself, instead of through the value bag (S04-004); the presets-lookup throw for a configuration name that only a shipped builder can pass goes, because tests catch that gspot bug (EXG-038). Values to config: NODE_SHEBANG_TAG = 'shebang:node' -&gt; packages/cli/src/config/generation/eslint.ts.

## `packages/cli/src/generation/eslint/contracts.ts`

- environmentOwners (function, 29-34): **move** to `packages/cli/src/generation/eslint/blocks.ts` `environmentReaders`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts; it is named environmentReaders after the setting architecture.roles.environment_readers that it reads (glossary); a role holds globs only, so the module-name lookup goes.
- allowedPaths (function, 37-44): **move** to `packages/cli/src/generation/eslint/blocks.ts` `allowedPaths`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts.
- eslintRuleOptions (function exported, 51-63): **move** to `packages/cli/src/generation/eslint/blocks.ts` `ruleOptions`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts; PLG-048: the folder says eslint, so the name drops it; EXG-049: compute once per run.
- eslintIgnoreBlocks (function exported, 70-84): **move** to `packages/cli/src/generation/eslint/blocks.ts` `ignoreBlocks`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts; PLG-048: the folder says eslint, so the name drops it; it reads ESLINT_CHECK (S04-008).
- structuralRuleBlocks (function exported, 91-138): **move** to `packages/cli/src/generation/eslint/blocks.ts` `structuralRuleBlocks`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts; it reads the setting limits.min_function_statements. Values to config: TRIVIAL_FILES_RULE = 'gspot/no-trivial-files' -&gt; packages/cli/src/config/generation/eslint.ts; TRIVIAL_FUNCTIONS_RULE = 'gspot/no-trivial-functions' -&gt; packages/cli/src/config/generation/eslint.ts; TRIVIAL_FUNCTION_LIMIT = 'min_function_statements' -&gt; packages/cli/src/config/generation/eslint.ts; ENVIRONMENT_LANGUAGES = \['javascript', 'typescript', 'vue', 'svelte', 'astro'\] -&gt; packages/cli/src/config/generation/eslint.ts; TYPED_LANGUAGES = \['typescript', 'vue', 'svelte', 'astro'\] -&gt; packages/cli/src/config/generation/eslint.ts.
- manifestRuleBlocks (function exported, 146-168): **move** to `packages/cli/src/generation/eslint/blocks.ts` `manifestRuleBlocks`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts.
- fragmentSelectorGroups (function exported, 177-230): **move** to `packages/cli/src/generation/eslint/blocks.ts` `fragmentSelectorGroups`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts; CFL-006: read the top-level eslint_selectors list, with no fake \[\[tool_file\]\] target; it reads ESLINT_SETTINGS_TABLE.
- importStyleBlocks (function exported, 238-264): **move** to `packages/cli/src/generation/eslint/blocks.ts` `importStyleBlocks`. EXG-002: eslint/contracts.ts becomes eslint/blocks.ts; tools.eslint.import_extensions, a glob-keyed map, becomes one value tools.eslint.import_extension per scope, so the glob loop goes and each scope yields at most one block (TML-008). Values to config: FILE_EXTENSION_RULE = 'n/file-extension-in-import' -&gt; packages/cli/src/config/generation/eslint.ts.

## `packages/cli/src/generation/eslint/public.ts`

- selectorSource (function, 22-28): **move** to `packages/cli/src/generation/eslint/serialize.ts` `selectorSource`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts.
- distinctLists (function, 30-38): **move** to `packages/cli/src/generation/eslint/blocks.ts` `distinctLists`. It goes with selectorGroups to eslint/blocks.ts.
- eslintFilePatterns (function exported, 45-80): **move** to `packages/cli/src/generation/eslint/files.ts` `filePatterns`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts; PLG-048: the folder says eslint, so the name drops it; EXG-008 drops fragmentFiles. Values to config: COMPONENT_CONFIGURATIONS = \['vue', 'svelte'\] -&gt; packages/cli/src/config/generation/eslint.ts; CODE_LANGUAGES = \['javascript', 'typescript'\] -&gt; packages/cli/src/config/generation/eslint.ts (the language pair passed to sourcePattern in five places).
- serializeEslintBlock (function exported, 88-101): **move** to `packages/cli/src/generation/eslint/serialize.ts` `serializeBlock`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts; PLG-048: the folder says eslint, so the name drops it; EXG-047: stop exporting.
- eslintModule (function exported, 108-165): **move** to `packages/cli/src/generation/eslint/serialize.ts` `eslintModule`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts.
- eslintErrorRules (function exported, 172-180): **move** to `packages/cli/src/generation/eslint/serialize.ts` `eslintErrorRules`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts.
- eslintRuleSettings (function exported, 187-197): **move** to `packages/cli/src/generation/eslint/serialize.ts` `eslintRuleSettings`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts.
- eslintSourcePattern (function exported, 204-208): **move** to `packages/cli/src/generation/eslint/files.ts` `sourcePattern`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts; PLG-048: the folder says eslint, so the name drops it.
- eslintNodePatterns (function exported, 216-218): **move** to `packages/cli/src/generation/eslint/files.ts` `nodePatterns`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts; PLG-048: the folder says eslint, so the name drops it.
- readEslintPresets (function exported, 225-227): **move** to `packages/cli/src/generation/eslint/presets.ts` `readPresets`. EXG-002: eslint/public.ts splits into files.ts, serialize.ts and presets.ts; PLG-048: the folder says eslint, so the name drops it. Values to config: ESLINT_PRESETS_FILE = 'eslint-presets.json' -&gt; packages/cli/src/config/generation/eslint.ts.
- readEslintRuleNames (function exported, 233-235): **delete**. PLG-049: the CLI imports eslint-rule-names.json as a JSON module, like the other rule lists, and explain reads the imported list, so the run-time reader goes.
- validateEslintPresets (function exported, 241-266): **move** to `scripts/build.ts` `validateEslintPresets`. EXG-006: build-only, so it moves to scripts/build.ts, the one build script (SCR-010); PLG-012 keeps the build check and deletes its test; local presets becomes ruleNames.
- selectorGroups (function exported, 277-309): **move** to `packages/cli/src/generation/eslint/blocks.ts` `selectorGroups`. blocks.ts holds selectorGroups; its unit test stays.

## `packages/cli/src/generation/eslint/runtimes.ts`

- frameworkRuntime (function, 8-12): **keep** to `packages/cli/src/generation/eslint/runtimes.ts` `frameworkRuntime`. eslint/runtimes.ts stays. Values to config: REACT_NATIVE_CONFIGURATION = 'react-native' -&gt; packages/cli/src/config/generation/eslint.ts; NEXTJS_CONFIGURATION = 'nextjs' -&gt; packages/cli/src/config/generation/eslint.ts (npmProject reads it too).
- scriptPaths (function exported, 21-24): **keep** to `packages/cli/src/generation/eslint/runtimes.ts` `scriptPaths`. eslint/runtimes.ts stays; .mise/tasks/\*\* is always a script path, so the runner test and the policy parameter go (INX-011).
- runtimeBlocks (function exported, 34-76): **keep** to `packages/cli/src/generation/eslint/runtimes.ts` `runtimeBlocks`. eslint/runtimes.ts stays; tools.eslint.node_version is deleted, because eslint-plugin-n reads package.json engines, so nodeVersion goes (TML-006); tools.eslint.runtimes becomes the runtime field of the root \[\[tools.eslint.override\]\] records with root-relative paths (TML-008); the policy parameter goes (INX-011). Values to config: COMMONJS_FILES = '\*\*/\*.{cjs,cts}' -&gt; packages/cli/src/config/generation/eslint.ts.

## `packages/cli/src/generation/fragments.ts`

- fragmentOwners (function, 15-19): **rename** to `packages/cli/src/generation/fragments.ts` `fragmentConfigurations`. Owner outside the ownership log is a retired word (glossary), and it returns the configurations whose fragments a target takes, so fragmentConfigurations; fragments.ts stays.
- emittedFragments (function, 22-67): **keep** to `packages/cli/src/generation/fragments.ts` `emittedFragments`. CFL-001: each fragment becomes a function that returns imports and blocks instead of Eta text.
- fragmentInputs (function exported, 77-136): **keep** to `packages/cli/src/generation/fragments.ts` `fragmentInputs`. EXG-008, EXG-050 drop fragmentFiles and fragments; EXG-049: only for targets with fragments.

## `packages/cli/src/generation/jsconfig.ts`

- buildJsconfig (function exported, 23-59): **keep** to `packages/cli/src/generation/jsconfig.ts` `buildJsconfig`. CFL-001: the generator calls it for jsconfig.json; generatedIgnores takes the configurations declarations plus the linguist markers from every tracked .gitattributes (TMF-001, CFR-005). Values to config: JSCONFIG_FILE = 'jsconfig.json' -&gt; packages/cli/src/config/parsers/tsconfig.ts; TSCONFIG_FILE = 'tsconfig.json' -&gt; packages/cli/src/config/parsers/tsconfig.ts; SOURCE_SELECTION_FIELDS = \['files', 'include'\] -&gt; packages/cli/src/config/parsers/tsconfig.ts.

## `packages/cli/src/generation/json-format.ts`

- primitive (function, 5-9): **move** to `packages/cli/src/generation/headers.ts` `primitive`. EXG-015: json-format.ts merges into headers.ts; EXG-061 keeps jsonText.
- oneLine (function, 11-19): **move** to `packages/cli/src/generation/headers.ts` `oneLine`. EXG-015: json-format.ts merges into headers.ts.
- wrapped (function, 21-25): **move** to `packages/cli/src/generation/headers.ts` `wrapped`. EXG-015: json-format.ts merges into headers.ts.
- arrayBlock (function, 27-39): **move** to `packages/cli/src/generation/headers.ts` `arrayBlock`. EXG-015: json-format.ts merges into headers.ts.
- recordBlock (function, 41-50): **move** to `packages/cli/src/generation/headers.ts` `recordBlock`. EXG-015: json-format.ts merges into headers.ts.
- block (function, 52-56): **move** to `packages/cli/src/generation/headers.ts` `block`. EXG-015: json-format.ts merges into headers.ts.
- jsonText (function exported, 64-66): **move** to `packages/cli/src/generation/headers.ts` `jsonText`. EXG-015: json-format.ts merges into headers.ts; EXG-061 keeps jsonText and adds its test.

## `packages/cli/src/generation/mise.ts`

- miseToolLine (function exported, 15-22): **delete**. EXG-062: miseFile builds an object and prints it with the TOML printer.
- miseFile (function exported, 30-41): **keep** to `packages/cli/src/generation/mise.ts` `miseFile`. miseFile writes .gspot/mise.toml (MISE_TOOL_PROJECT_FILE) as \[tools\] plus one line per program tool: no header inside .gspot/ (GEN-017), no min_version, no gspot or Node line, no os field; it is written whenever the selected checks need a program tool, with kind tool_file, as .gspot/package.json (INX-001, INX-002, INX-006).

## `packages/cli/src/generation/public.ts`

- emitWorkflow (function, 44-69): **move** to `packages/cli/src/generation/files.ts` `emitWorkflow`. EXG-017: generation/public.ts becomes generation/files.ts; CI is on when ci.enabled is true (TML-015); the files field goes (TML-002); setup_command and operating_systems (TML-014); isMise goes (INS-003); the manual checks are the \[\[command_check\]\] records. Values to config: SWIFT_CONFIGURATION = 'swift' -&gt; packages/cli/src/config/generation/ci.ts.
- attributePattern (function, 73-79): **move** to `packages/cli/src/generation/files.ts` `attributePattern`. generation/public.ts becomes generation/files.ts. Values to config: ATTRIBUTE_GLOB_CHARACTERS = /\[\\\\\*?\[\]/gu -&gt; packages/cli/src/config/generation/files.ts; ATTRIBUTE_QUOTED_CHARACTERS = /\[\\s"\]/u -&gt; packages/cli/src/config/generation/files.ts.
- attributesBlock (function, 82-97): **move** to `packages/cli/src/generation/files.ts` `attributesBlock`. generation/public.ts becomes generation/files.ts. Values to config: LF_ATTRIBUTES = 'text eol=lf' -&gt; packages/cli/src/config/generation/files.ts; AUTO_LF_ATTRIBUTES = \['text=auto', 'eol=lf'\] -&gt; packages/cli/src/config/generation/files.ts.
- emitBlocks (function, 99-122): **move** to `packages/cli/src/generation/files.ts` `emitBlocks`. gspot never touches CLAUDE.md, so the CLAUDE.md note goes; generation/public.ts becomes generation/files.ts; EXG-004: .gitattributes only under hasGit; it reads policy.rules (enabled, instruction_files), and own_rules_folder and folder are deleted (TML-003). Values to config: GITATTRIBUTES_FILE = '.gitattributes' -&gt; packages/cli/src/config/repository/tracked.ts; GITIGNORE_FILE = '.gitignore' -&gt; packages/cli/src/config/repository/tracked.ts; AGENTS_FILE = 'AGENTS.md' -&gt; packages/cli/src/config/rules.ts.
- combineToolFiles (function, 124-134): **move** to `packages/cli/src/generation/files.ts` `mergeFileEdits`. EXG-013, glossary file edit: it merges file edits, so mergeFileEdits.
- assertDistinctPaths (function, 136-146): **move** to `packages/cli/src/generation/files.ts` `assertDistinctPaths`. generation/public.ts becomes generation/files.ts; it also checks that each path is safe to write.
- gitignoreBlock (function exported, 153-156): **move** to `packages/cli/src/generation/files.ts` `gitignoreBlock`. generation/public.ts becomes generation/files.ts; emitBlocks and its test use it; the block also lists .gspot/.npmrc and .gspot/.yarnrc-install.yml, the reference-only files one install run writes and removes, built from DOT_GSPOT with NPMRC_FILE and YARN_INSTALL_SETTINGS_FILE (S05-012).
- emitAll (function exported, 163-214): **move** to `packages/cli/src/generation/files.ts` `emitAll`. generation/public.ts becomes generation/files.ts; EXG-011 drops root from the emit input; miseFile is pushed whenever a selected check needs a program tool (INX-001, INX-006); hookFiles reads the start runner from the repository (INX-003); selectRuleFiles reads policy.rules.
- generatedPaths (function exported, 221-228): **move** to `packages/cli/src/generation/files.ts` `generatedPaths`. generation/public.ts becomes generation/files.ts.
- npmProject (function exported, 239-278): **move** to `packages/cli/src/generation/npm.ts` `npmProject`. The npm tool project code sits in generation/npm.ts; emitAll calls it; the generated .gspot/package.json has no name field: private, packageManager, devDependencies (INX-010). Values to config: NEXT_PACKAGE = 'next' -&gt; packages/cli/src/config/generation/tool-projects.ts.

## `packages/cli/src/generation/redirects.ts`

- packageRedirects (function exported, 16-70): **keep** to `packages/cli/src/generation/redirects.ts` `packageRedirects`. redirects.ts stays and returns FileEdit\[\]. Values to config: PACKAGE_JSON = 'package.json' -&gt; packages/cli/src/config/parsers/dependency-files.ts.

## `packages/cli/src/generation/tool-files.ts`

- pointerFiles (function, 19-36): **keep** to `packages/cli/src/generation/tool-files.ts` `pointerFiles`. tool-files.ts stays; CFL-041: pointer.template goes.
- isTargetEnabled (function, 39-51): **keep** to `packages/cli/src/generation/tool-files.ts` `isTargetEnabled`. tool-files.ts stays.
- emitToolFile (function, 54-96): **keep** to `packages/cli/src/generation/tool-files.ts` `emitToolFile`. CFL-001, EXG-038: the recordRules throw goes; EXG-034: the .semgrepignore skip becomes a manifest flag, so its literals go; there is no generated_header argument, because the field is deleted (GEN-017).
- emitToolFiles (function exported, 105-139): **keep** to `packages/cli/src/generation/tool-files.ts` `emitToolFiles`. tool-files.ts stays.

## `packages/cli/src/generation/tsconfig.ts`

- buildTsconfig (function exported, 16-67): **keep** to `packages/cli/src/generation/tsconfig.ts` `buildTsconfig`. CFL-001: the generator calls it, and the TypeScript check uses it.
- requiredTsconfigOptions (function exported, 75-79): **keep** to `packages/cli/src/generation/tsconfig.ts` `requiredTsconfigOptions`. Used by the TypeScript checks and generation.

## `packages/cli/src/types/execution/check.ts`

- SuppressionComment (type exported, 13-20): **move** to `packages/cli/src/types/checks/general.ts` `SuppressionComment`. EXG-028: one user, the gspot/suppressions check (CKG-028), so it moves to the general checks types file, types/checks/general.ts.
- BuiltInChecks (type exported, 23-23): **keep** to `packages/cli/src/types/execution/check.ts` `BuiltInChecks`. Beside runBuiltInCheck and checkRun; checks/built-in.ts uses it; it stays in the run types file, types/execution/check.ts.
- BuiltInFix (type exported, 26-26): **keep** to `packages/cli/src/types/execution/check.ts` `BuiltInFix`. EXG-047: used only in its own file; it stays in the run types file, types/execution/check.ts.
- FixResult (type exported, 28-31): **keep** to `packages/cli/src/types/execution/check.ts` `FixResult`. Used by built-in fixes, fixes.ts and FixReport; it stays in the run types file, types/execution/check.ts.
- FixRun (type exported, 34-34): **keep** to `packages/cli/src/types/execution/check.ts` `FixRun`. One user, runFix; it stays in the run types file, types/execution/check.ts.
- FixReport (type exported, 36-36): **keep** to `packages/cli/src/types/execution/check.ts` `FixReport`. Part of the run report; report.ts, run.ts, fixes.ts and commands/check/tree.ts use it; it stays in the run types file, types/execution/check.ts.
- RunReportOptions (type exported, 38-45): **keep** to `packages/cli/src/types/execution/check.ts` `RunReportOptions`. The options part that RunOptions extends; it stays in the run types file, types/execution/check.ts.
- Executable (type exported, 47-50): **rename** to `packages/cli/src/types/execution/check.ts` `RunnableCheck`. EXG-045: Executable means a program file elsewhere, so RunnableCheck; built-in.ts and run.ts use it; it stays in the run types file, types/execution/check.ts.
- CheckRunOptions (type exported, 53-53): **keep** to `packages/cli/src/types/execution/check.ts` `CheckRunOptions`. Beside runCheckCommand; NMS table B: the field workspace becomes scratchRoot; it stays in the run types file, types/execution/check.ts.
- Pass (type exported, 55-60): **rename** to `packages/cli/src/types/execution/check.ts` `RunState`. EXG-045, NMS-018, glossary run state: Pass becomes RunState; one user; it stays in the run types file, types/execution/check.ts.
- RunOptions (type exported, 62-66): **keep** to `packages/cli/src/types/execution/check.ts` `RunOptions`. Beside executeRun; commands/check/tree.ts and tests use it; EXG-026 adds push; it stays in the run types file, types/execution/check.ts.
- RunOutcome (type exported, 68-68): **keep** to `packages/cli/src/types/execution/check.ts` `RunOutcome`. One user, executeRun; it stays in the run types file, types/execution/check.ts.
- IgnoreUse (type exported, 70-70): **keep** to `packages/cli/src/types/execution/check.ts` `IgnoreUse`. Beside applyIgnores; run.ts and report.ts use it; it stays in the run types file, types/execution/check.ts.
- CheckOutcome (type exported, 72-72): **keep** to `packages/cli/src/types/execution/check.ts` `CheckOutcome`. Beside checkResult; the infrastructure checks use it; it stays in the run types file, types/execution/check.ts.
- BuiltInCheck (type exported, 74-74): **keep** to `packages/cli/src/types/execution/check.ts` `BuiltInCheck`. Beside runBuiltInCheck; 20 checks use it; it stays in the run types file, types/execution/check.ts.
- CheckInput (type exported, 76-102): **keep** to `packages/cli/src/types/execution/check.ts` `CheckInput`. Built by checkInput; 76 check files use it; it stays in the run types file, types/execution/check.ts.
- CheckStatus (type exported, 105-105): **keep** to `packages/cli/src/types/execution/check.ts` `CheckStatus`. PAR-006: a plain type, (typeof CHECK_STATUSES)\[number\] from config/execution/run.ts, so types/ does not import resultSchema from parsers/; terminal/ uses it; it stays in the run types file, types/execution/check.ts.
- CheckResult (type exported, 107-109): **keep** to `packages/cli/src/types/execution/check.ts` `CheckResult`. PAR-006: a plain object type, so types/ does not import resultSchema; beside emptyResult; it stays in the run types file, types/execution/check.ts.
- RunReport (type exported, 112-131): **keep** to `packages/cli/src/types/execution/check.ts` `RunReport`. Built by buildRunReport; it stays in the run types file, types/execution/check.ts.
- ReportInput (type exported, 133-142): **keep** to `packages/cli/src/types/execution/check.ts` `ReportInput`. One user, buildRunReport; it stays in the run types file, types/execution/check.ts.
- ReplannedFixResult (type exported, 145-145): **keep** to `packages/cli/src/types/execution/check.ts` `ReplannedFixResult`. One user, replanAfterFixes; it stays in the run types file, types/execution/check.ts.
- IgnoredFindings (type exported, 148-148): **keep** to `packages/cli/src/types/execution/check.ts` `IgnoredFindings`. One user, applyIgnores; it stays in the run types file, types/execution/check.ts.
- FixOptions (type exported, 151-151): **keep** to `packages/cli/src/types/execution/check.ts` `FixOptions`. One user, applyFixers; it stays in the run types file, types/execution/check.ts.

## `packages/cli/src/types/execution/command.ts`

- CheckToolProgram (type exported, 9-9): **keep** to `packages/cli/src/types/execution/command.ts` `CheckToolProgram`. One user, runCheckTool; it stays in the command types file, types/execution/command.ts.
- CheckToolOptions (type exported, 12-14): **keep** to `packages/cli/src/types/execution/command.ts` `CheckToolOptions`. One user, runCheckTool; it stays in the command types file, types/execution/command.ts.
- CommandPart (type exported, 16-16): **keep** to `packages/cli/src/types/execution/command.ts` `CommandPart`. Beside substitute; the generated-code check and tests use it; it stays in the command types file, types/execution/command.ts.
- Substitutions (type exported, 18-24): **keep** to `packages/cli/src/types/execution/command.ts` `Substitutions`. Used by placeholders, batches and check.ts; it stays in the command types file, types/execution/command.ts.
- CommandInvocation (type exported, 27-27): **keep** to `packages/cli/src/types/execution/command.ts` `CommandInvocation`. Made by perFileCommands; batches.ts and output.ts use it; it stays in the command types file, types/execution/command.ts.
- CheckTool (type exported, 30-30): **keep** to `packages/cli/src/types/execution/command.ts` `CheckTool`. One user, checkTool; it stays in the command types file, types/execution/command.ts.
- CommandEnvironment (type exported, 33-39): **keep** to `packages/cli/src/types/execution/command.ts` `CommandEnvironment`. One user, commandEnvironment; it stays in the command types file, types/execution/command.ts.
- PreparedCommand (type exported, 42-48): **keep** to `packages/cli/src/types/execution/command.ts` `PreparedCommand`. Made by prepareCommand; fixes.ts uses it; it stays in the command types file, types/execution/command.ts.
- CommandRun (type exported, 50-58): **keep** to `packages/cli/src/types/execution/command.ts` `CommandRun`. One user, runInScratch; it stays in the command types file, types/execution/command.ts.
- CommandRunState (type exported, 61-61): **keep** to `packages/cli/src/types/execution/command.ts` `CommandRunState`. Used by output.ts and check.ts; it stays in the command types file, types/execution/command.ts.
- InvocationOutput (type exported, 64-64): **keep** to `packages/cli/src/types/execution/command.ts` `InvocationOutput`. One user, recordInvocation; it stays in the command types file, types/execution/command.ts.
- ParsedFindings (type exported, 67-67): **keep** to `packages/cli/src/types/execution/command.ts` `ParsedFindings`. One user, commandOutcome; it stays in the command types file, types/execution/command.ts.
- OutputCheck (type exported, 70-70): **keep** to `packages/cli/src/types/execution/command.ts` `OutputCheck`. One user, checkedFindings; it stays in the command types file, types/execution/command.ts.
- CommandSource (type exported, 73-73): **keep** to `packages/cli/src/types/execution/command.ts` `CommandSource`. One user file; it stays in the command types file, types/execution/command.ts.
- CommandCheck (type exported, 75-75): **rename** to `packages/cli/src/types/execution/command.ts` `SubstitutionCheck`. NMS-018, glossary: a command check is a \[\[command_check\]\] record, so this subset is SubstitutionCheck; one user; it stays in the command types file, types/execution/command.ts.

## `packages/cli/src/types/execution/copy.ts`

- TreeCopy (type exported, 4-4): **rename** to `packages/cli/src/types/execution/copy.ts` `PendingLink`. NMS-007, NMS table B: it is a link to create later, so PendingLink; one user; it stays in the copy types file, types/execution/copy.ts.
- WorktreeCopy (type exported, 7-13): **rename** to `packages/cli/src/types/execution/copy.ts` `DependencyTreeCopy`. NMS-007, NMS table B: there is no Git worktree, so DependencyTreeCopy; one user; it stays in the copy types file, types/execution/copy.ts.
- RevisionSource (type exported, 16-25): **move** to `packages/cli/src/types/commands/check.ts` `RevisionSource`. EXG-028: its one user is the check command, so it moves to types/commands/check.ts.
- DependencyFolder (type exported, 27-27): **delete**. No copy holds .venv, so the dependency is always node_modules, listDependencyFolders returns the folder strings, and this record goes (EXG-055).
- DependencyCopy (type exported, 30-30): **keep** to `packages/cli/src/types/execution/copy.ts` `DependencyCopy`. Used by dependencies.ts, revision.ts and scratch.ts; it stays in the copy types file, types/execution/copy.ts.
- ScratchFile (type exported, 33-35): **keep** to `packages/cli/src/types/execution/copy.ts` `ScratchFile`. Beside writeScratchFile; revision.ts yields it; it stays in the copy types file, types/execution/copy.ts.
- ScratchCopy (type exported, 37-43): **rename** to `packages/cli/src/types/execution/copy.ts` `ScratchCopyPlan`. NMS table B: what to copy and where, so ScratchCopyPlan; copyDependencies types its own smaller input (EXG-022); it stays in the copy types file, types/execution/copy.ts.
- ScratchSource (type exported, 46-46): **rename** to `packages/cli/src/types/execution/copy.ts` `ScratchCopyPaths`. NMS table B: a copy request by paths, so ScratchCopyPaths; checks/language uses it; it stays in the copy types file, types/execution/copy.ts.

## `packages/cli/src/types/execution/reproduce.ts`

- ReproduceOptions (type exported, 4-8): **move** to `packages/cli/src/types/execution/check.ts` `ReproduceOptions`. EXG-029: a one-type file, so it merges into the run types file beside reproduceLine, and types/execution/reproduce.ts goes.

## `packages/cli/src/types/generation/ci.ts`

- ActionPin (type exported, 4-4): **keep** to `packages/cli/src/types/generation/ci.ts` `ActionPin`. Its one user is pinned() in generation/ci.ts, because the pin scripts are deleted (SCR-007); config/generation/ci.ts does not name it; it stays in the CI types file, types/generation/ci.ts.
- Pipeline (type exported, 6-16): **keep** to `packages/cli/src/types/generation/ci.ts` `Pipeline`. Beside githubFile and gitlabFile; the CI test data uses it; isMise goes (INS-003); the run field goes (TML-002); setup becomes setupCommand and platforms operatingSystems (TML-014); it stays in the CI types file, types/generation/ci.ts.
- GithubCheck (type exported, 19-19): **keep** to `packages/cli/src/types/generation/ci.ts` `GithubCheck`. One user; it stays in the CI types file, types/generation/ci.ts.

## `packages/cli/src/types/generation/eslint.ts`

- EslintRuleBlock (type exported, 7-7): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintRuleBlock`. Made by the rule-block functions; after CFL-001 no other file names it; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintRuleOptions (type exported, 10-10): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintRuleOptions`. Made by ruleOptions; serialize.ts uses it; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintModuleInput (type exported, 13-19): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintModuleInput`. One user, eslintModule; it stays in the ESLint types file, types/generation/eslint.ts.
- SelectorGroup (type exported, 22-28): **keep** to `packages/cli/src/types/generation/eslint.ts` `SelectorGroup`. Made by selectorGroups; after CFL-001 only blocks.ts names it; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintSettings (type exported, 31-31): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintSettings`. EXG-047: used only in its own file; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintBlock (type exported, 34-39): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintBlock`. Used by blocks.ts, boundaries.ts and configuration.ts; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintBoundaryFile (type exported, 42-46): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintBoundaryFile`. EXG-047: used only in its own file; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintBoundaryPolicy (type exported, 49-56): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintBoundaryPolicy`. Its arrays are readonly, so the as const policies in config/generation/eslint.ts fit it without config importing the type; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintBoundaryContext (type exported, 59-65): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintBoundaryContext`. One user; one fixed test-files rule stays (TML-001), so the roles field becomes a flag for that rule; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintDependencyNode (type exported, 68-68): **delete**. S04-007: its only use is the annotation of TRPC_DEPENDENCY_SELECTORS, which is written as const and goes into a Record&lt;string, unknown&gt; settings object, so no type is needed.
- EslintContext (type exported, 71-78): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintContext`. Used by blocks, boundaries, configuration and runtimes; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintConfiguration (type exported, 81-98): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintConfiguration`. EXG-009, EXG-010, EXG-007 drop commentLevel, aliases and limits; after CFL-001 only configuration.ts names it; it stays in the ESLint types file, types/generation/eslint.ts.
- ScopeEslintSettings (type exported, 101-101): **keep** to `packages/cli/src/types/generation/eslint.ts` `ScopeEslintSettings`. One user, ruleOptions; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintRuntimeBlock (type exported, 104-108): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintRuntimeBlock`. Made by runtimeBlocks; EslintFileSelector and EslintConfiguration use it; tools.eslint.node_version is deleted, so the nodeVersion field goes (TML-006); it stays in the ESLint types file, types/generation/eslint.ts.
- EslintFileSelector (type exported, 111-115): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintFileSelector`. Used by files.ts and serialize.ts; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintSettingsBlock (type exported, 118-123): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintSettingsBlock`. After CFL-001 only serialize.ts names it; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintModule (type exported, 126-129): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintModule`. After CFL-001 only serialize.ts names it; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintFileInputs (type exported, 132-137): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintFileInputs`. One user, filePatterns; it stays in the ESLint types file, types/generation/eslint.ts.
- EslintFiles (type exported, 140-148): **keep** to `packages/cli/src/types/generation/eslint.ts` `EslintFiles`. EXG-008 drops fragmentFiles; after CFL-001 only files.ts names it; it stays in the ESLint types file, types/generation/eslint.ts.

## `packages/cli/src/types/generation/eta.ts`

- ScopeEtaInputs (type exported, 21-26): **delete**. CFL-001: it goes with scopeInputs.
- EtaInputs (type exported, 28-110): **delete**. CFL-001: the 60-field bag goes, and each builder has a typed input.

## `packages/cli/src/types/generation/files.ts`

- ToolFileConsumers (type exported, 11-11): **keep** to `packages/cli/src/types/generation/files.ts` `ToolFileConsumers`. EXG-047: used only in its own file, beside EmitConsumers; it stays in the generated-files types file, types/generation/files.ts.
- EmitConsumers (type exported, 14-14): **keep** to `packages/cli/src/types/generation/files.ts` `EmitConsumers`. One user, emitToolFiles; it stays in the generated-files types file, types/generation/files.ts.
- GeneratedBlock (type exported, 16-16): **keep** to `packages/cli/src/types/generation/files.ts` `GeneratedBlock`. EXG-047: only Generated uses it; it stays in the generated-files types file, types/generation/files.ts.
- GeneratedFile (type exported, 18-25): **keep** to `packages/cli/src/types/generation/files.ts` `GeneratedFile`. Glossary generated file; NMS table B: ruleData becomes capturedRules; the kind runner goes, because the mise file has kind tool_file, as .gspot/package.json (INX-001); tools/ also imports it; it stays in the generated-files types file, types/generation/files.ts.
- Generated (type exported, 27-32): **keep** to `packages/cli/src/types/generation/files.ts` `Generated`. Made by emitAll; EXG-013: toolFiles becomes fileEdits; it stays in the generated-files types file, types/generation/files.ts.
- EmitInputs (type exported, 35-41): **keep** to `packages/cli/src/types/generation/files.ts` `EmitInputs`. One user, emitToolFiles; EXG-011 drops root; CFL-001: no Eta value bag; it stays in the generated-files types file, types/generation/files.ts.
- ToolFileInputs (type exported, 44-44): **keep** to `packages/cli/src/types/generation/files.ts` `ToolFileInputs`. One user, because pointerPaths types its context inline; it stays in the generated-files types file, types/generation/files.ts.
- EmittedToolFile (type exported, 46-49): **move** to `packages/cli/src/types/ownership.ts` `FileEdit`. EXG-013, glossary file edit: EmittedToolFile becomes FileEdit, which absorbs KeyChange; the lowest user is the managed-keys code in ownership/, and the ownership area has one types file, types/ownership.ts.

## `packages/cli/src/types/generation/formatting.ts`

- JsonFormat (type exported, 3-3): **keep** to `packages/cli/src/types/generation/formatting.ts` `JsonFormat`. Beside jsonText, as json-format.ts merges into headers.ts; it stays in the formatting types file, types/generation/formatting.ts.
- FormatOverride (type exported, 5-9): **keep** to `packages/cli/src/types/generation/formatting.ts` `FormatOverride`. One user file; it stays in the formatting types file, types/generation/formatting.ts.
- PrettierPlugin (type exported, 12-16): **keep** to `packages/cli/src/types/generation/formatting.ts` `PrettierPlugin`. Beside prettierConfiguration; the formatting test data uses it; it stays in the formatting types file, types/generation/formatting.ts.
- ScopeFormat (type exported, 18-18): **keep** to `packages/cli/src/types/generation/formatting.ts` `ScopeFormat`. One user, formatEntries; it stays in the formatting types file, types/generation/formatting.ts.
- EditorconfigOverride (type exported, 20-20): **keep** to `packages/cli/src/types/generation/formatting.ts` `EditorconfigOverride`. Returned by editorconfigOverrides; the EditorConfig builder uses it; it stays in the formatting types file, types/generation/formatting.ts.
- NativeOverride (type exported, 22-26): **rename** to `packages/cli/src/types/generation/formatting.ts` `ExtraOverride`. NMS-006, NMS table B: a tool override from the extra table, and FormatOverride is taken, so ExtraOverride; it stays in the formatting types file, types/generation/formatting.ts.
- PrettierPluginOptions (type exported, 29-29): **keep** to `packages/cli/src/types/generation/formatting.ts` `PrettierPluginOptions`. One user, pluginEntries; it stays in the formatting types file, types/generation/formatting.ts.
- PrettierInput (type exported, 32-38): **keep** to `packages/cli/src/types/generation/formatting.ts` `PrettierInput`. One user, prettierConfiguration; it stays in the formatting types file, types/generation/formatting.ts.

## `packages/cli/src/types/generation/fragments.ts`

- Fragment (type exported, 3-3): **keep** to `packages/cli/src/types/generation/fragments.ts` `Fragment`. One user; it stays in the fragments types file, types/generation/fragments.ts, with the three fragment types.
- SelectorPaths (type exported, 6-6): **keep** to `packages/cli/src/types/generation/fragments.ts` `SelectorPaths`. Used by selectorGroups and fragmentSelectorGroups, both in blocks.ts; it stays in the fragments types file, types/generation/fragments.ts, with the three fragment types.
- FragmentSelector (type exported, 8-8): **keep** to `packages/cli/src/types/generation/fragments.ts` `FragmentSelector`. EXG-047: only SelectorPaths uses it; CFL-006: it becomes one item of the manifest eslint_selectors list; it stays in the fragments types file, types/generation/fragments.ts, with the three fragment types.

## `packages/cli/src/types/generation/hooks.ts`

- HookName (type exported, 3-3): **keep** to `packages/cli/src/types/generation/files.ts` `HookName`. Derived from HOOK_ARGS in config/generation/hooks.ts, because types may import config; commands/check and install/hooks.ts use it; one type, so it joins the generated file types in types/generation/files.ts.
- HookRunner (type exported, 6-6): **delete**. S04-007: its only use is the satisfies clause of RUNNERS, and config may not import types; RUNNERS\[runner\] in generation/hooks.ts fails to compile when a runner lacks an entry.

## `packages/cli/src/types/generation/jsconfig.ts`

- JsconfigInput (type exported, 5-14): **move** to `packages/cli/src/types/generation/typescript.ts` `JsconfigInput`. One user, buildJsconfig; the one-type files jsconfig.ts and tsconfig.ts merge into one TypeScript types file, types/generation/typescript.ts, which matches config/generation/typescript.ts.

## `packages/cli/src/types/generation/npm.ts`

- NpmProjectInputs (type exported, 6-11): **move** to `packages/cli/src/types/generation/files.ts` `NpmProjectInputs`. One user, npmProject; a one-type file, so it joins the generated-files types file.

## `packages/cli/src/types/generation/prose.ts`

- ProseGrammar (type exported, 2-2): **delete**. S04-007: its only use is the annotation of PROSE_GRAMMARS, which is written as const with no type annotation, because config may not import types.

## `packages/cli/src/types/generation/rules.ts`

- CapturedRules (type exported, 5-5): **move** to `packages/cli/src/types/ownership.ts` `CapturedLintRules`. ruleSettingsSchema serves the ownership log and rule capture, and ownership/ is the lower folder; the type is hand-written in the ownership types file, types/ownership.ts, as CapturedLintRules (LIF-010).

## `packages/cli/src/types/generation/tsconfig.ts`

- TsconfigInput (type exported, 5-15): **move** to `packages/cli/src/types/generation/typescript.ts` `TsconfigInput`. One user, buildTsconfig; it joins JsconfigInput in types/generation/typescript.ts.
