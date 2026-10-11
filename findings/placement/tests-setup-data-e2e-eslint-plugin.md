# Tests: shared test code, shared test data, end-to-end tests, ESLint plugin tests

467 rows. move 310, delete 73, inline 48, split 14, keep 12, merge 9, rename 1.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/config/harness/command.ts`

- (the file) (file): **delete**. THR-010: the step label is never passed; file goes with STEP_ARGUMENTS
- STEP_ARGUMENTS (const exported, 2-2): **delete**. THR-010: runCommand and runCommandBlocking lose the step parameter; no caller passes it

## `tests/config/harness/consumer.ts`

- (the file) (file): **move** to `tests/config/e2e.ts`. One user, the packed-package setup; test data that is not a single short literal lives in a tests/config topic file, and the end-to-end values share tests/config/e2e.ts.
- OFFLINE_ENVIRONMENT (const exported, 1-10): **move** to `tests/config/e2e.ts` `OFFLINE_ENVIRONMENT`. One user, createPackedSandbox; tests/setup/ files hold no module-level constants, so the value goes to tests/config/e2e.ts.

## `tests/config/harness/environment.ts`

- (the file) (file): **inline** to `tests/setup/modules.ts`. Module folders live in modules.ts and the scripts folder in install.ts.
- MODULE_DIRECTORIES (const exported, 2-6): **inline** to `tests/setup/modules.ts` `installedModules`. The three paths become installedModules and testModules (modules.ts) and scriptsFolder (install.ts), built at load time with join calls over the short literals 'node_modules' and 'tests/node_modules'; the launchers entry goes (SCR-002).

## `tests/config/harness/fixer.ts`

- (the file) (file): **inline** to `tests/setup/fixer.ts`. THR-002; one user (fixer setup)
- FIXER_POLICY (const exported, 2-8): **inline** to `tests/setup/fixer.ts` `buildFixerSettings`. One caller; written as a template literal with JSON.stringify(process.execPath), so the EXECUTABLE and PATHS placeholders go; it stays in the function, since the text is built at call time from process.execPath and the paths argument; the check is a \[\[command_check\]\] record with name.

## `tests/config/harness/gspot.ts`

- (the file) (file): **inline** to `tests/setup/run-gspot.ts`. THR-041
- SOURCE_CLI_PATH (const exported, 2-2): **merge** to `tests/setup/run-gspot.ts` `CLI_SOURCE`. THR-041: one CLI_SOURCE = join(repositoryRoot, 'packages/cli/src') in run-gspot.ts, built at load time, which CLI_MAIN and getCliSourcePath build on; scripts/workspace.ts goes, so run-gspot.ts finds the repository root from import.meta.dir.

## `tests/config/harness/init.ts`

- (the file) (file): **delete**. CMD-092 deletes --no-runner, --no-hooks, --no-ci, --no-agent-rules and --no-install
- QUIET_INIT (const exported, 2-2): **delete**. CMD-092 deletes every flag in this list; sandboxes set hooks and CI with gspot set or a template, and there is no runner setting (INX-003, THR-024).

## `tests/config/harness/install.ts`

- (the file) (file): **delete**. TTO-003: the test-only install cache goes
- TOOL_CACHE_FOLDER (const exported, 2-2): **delete**. TTO-003: the cache folder goes with prepareSharedProjects and prepareValeProject

## `tests/config/harness/npm.ts`

- (the file) (file): **move** to `tests/config/npm.ts`. All three values are npm topic data, and tests/setup/ files hold no module-level constants, so they go to tests/config/npm.ts (THR-019, TTO-032).
- AUTHORED_FILES (const exported, 2-8): **move** to `tests/config/npm.ts` `NPM_SANDBOX_FILES`. One user; authored is jargon and package project means the tool project (glossary); tests/setup/ files hold no module-level constants, so it goes to tests/config/npm.ts; gspot never pins itself (INX-002, SCR-001), so the sandbox mise.toml with disable_tools = \["npm:@gspothq/cli"\] goes from the files.
- PACKAGE_PROJECTS (const exported, 11-18): **move** to `tests/config/npm.ts` `NPM_CLIENT_ROWS`. TTO-032: only three npm tests use it; manager is a banned name part (glossary NpmClient); the runner column goes (INX-003), so the last row (npm, package.json, none) repeats the first and goes.
- EXCLUDED_PACKAGE_CHECKS (const exported, 21-21): **move** to `tests/config/npm.ts` `NPM_SANDBOX_IGNORES`. THR-019: settingsText gets an ignore option fed by this list; one user; tests/setup/ files hold no module-level constants, so it goes to tests/config/npm.ts.

## `tests/config/harness/platforms.ts`

- (the file) (file): **move** to `tests/setup/operating-systems.ts`. Platform means only Cloudflare and Supabase (NMU-007); isWindows and isMacos are read from process.platform at load time, so they stay in tests/setup/operating-systems.ts.
- isPosix (const exported, 2-2): **move** to `tests/setup/operating-systems.ts` `isWindows`. NMU-007: replace isPosix with !isWindows, and every raw process.platform check in tests with these constants.
- isMacos (const exported, 5-5): **move** to `tests/setup/operating-systems.ts` `isMacos`. NMU-007; eight test users.

## `tests/config/harness/policy.ts`

- (the file) (file): **delete**. settingsText gets no runner option, since the runner setting goes (INX-003).
- RUNNER_POLICY (const exported, 2-2): **delete**. A two-entry map for two callers; the runner setting goes (INX-003), so settingsText gets no runner option.

## `tests/config/harness/process.ts`

- (the file) (file): **move** to `tests/config/processes.ts`. THR-020: command.ts and process.ts become processes.ts; tests/setup/ files hold no module-level constants, so the poll values go to tests/config/processes.ts, and INTERRUPTION_EXIT_CODE goes to its one test file.
- EXIT_POLL_MS (const exported, 2-2): **move** to `tests/config/processes.ts` `EXIT_POLL_MS`. THR-020; one user, waitForExit; tests/setup/ files hold no module-level constants, so it goes to tests/config/processes.ts.
- READY_POLL_MS (const exported, 3-3): **move** to `tests/config/processes.ts` `READY_POLL_MS`. THR-020; the claims test goes (TPR-021) and waitForFile replaces waitForJson (TTO-039), so waitForFile is the one user; it goes to tests/config/processes.ts.
- INTERRUPTION_EXIT_CODE (const exported, 6-6): **move** to `tests/unit/cli/ownership/log.test.ts` `INTERRUPTION_EXIT_CODE`. Its users (recovery batches, links and replacement tests) all merge into the ownership log test, which also gets interruptOwnershipWrite; 73 is a single short literal, so it stays in that test file.

## `tests/config/harness/python-installation.ts`

- (the file) (file): **move** to `tests/config/python/tool-project.ts`. TTO-003 deletes SUITE_PYTHON_FOLDER, and the rest has one user; tests/setup/ files hold no module-level constants, so it goes to tests/config/python/tool-project.ts.
- SUITE_PYTHON_FOLDER (const exported, 2-2): **delete**. installSuitePythonTools and the suite-wide Python copy go (TTO-003).
- AUTHORED_FILES (const exported, 5-11): **move** to `tests/config/python/tool-project.ts` `PYTHON_SANDBOX_FILES`. One user, createPythonSandbox; sandbox, not authored (glossary); it goes to tests/config/python/tool-project.ts; gspot never pins itself (INX-002, SCR-001), so the sandbox mise.toml with disable_tools = \["npm:@gspothq/cli"\] goes from the files.
- REDIRECTED (const exported, 14-14): **move** to `tests/config/python/tool-project.ts` `UV_PROJECT_VARIABLES`. One user; the name says what it lists; it goes to tests/config/python/tool-project.ts.
- EXCLUDED_PYTHON_CHECKS (const exported, 16-26): **move** to `tests/config/python/tool-project.ts` `PYTHON_SANDBOX_IGNORES`. THR-019: feeds the ignore option of settingsText; one user; it goes to tests/config/python/tool-project.ts.

## `tests/config/harness/registry.ts`

- (the file) (file): **split** to `tests/config/npm.ts; tests/config/python/tool-project.ts; tests/integration/python-tool-project.test.ts`. THR-001: the Python index values go with createPythonIndex into its one test; data that is not a single short literal goes to tests/config/npm.ts and tests/config/python/tool-project.ts.
- PYTHON_REGISTRY_CREDENTIALS (const exported, 1-1): **move** to `tests/config/python/tool-project.ts` `PYTHON_INDEX_CREDENTIALS`. One user, createPythonIndex, which moves into the Python tool project test; index, not registry; an object of two fields is not a single short literal, so it goes to tests/config/python/tool-project.ts.
- PACKAGE_REGISTRY_TOKEN (const exported, 2-2): **move** to `tests/config/npm.ts` `NPM_REGISTRY_TOKEN`. The setup and two npm install tests read it; it goes to tests/config/npm.ts.
- RUFF_VERSION_OUTPUT (const exported, 3-3): **move** to `tests/integration/python-tool-project.test.ts` `RUFF_VERSION_OUTPUT`. One user, createPythonIndex (THR-001); one regular expression is a single short literal, so it stays in its one test file.

## `tests/config/packages/languages.ts`

- (the file) (file): **move** to `tests/config/e2e.ts`. One user; test data that is not a single short literal lives in a tests/config topic file.
- PROSE_CHECK (const exported, 4-10): **move** to `tests/config/e2e.ts` `PROSE_CHECK`. THR-011, THR-015: a plain block, no branch inside a two-item loop; written as const without the PackageCheckCase annotation, since tests/config imports only tests/config, and the call sites check the type.
- SWIFT_CHECK (const exported, 12-18): **move** to `tests/config/e2e.ts` `SWIFT_CHECK`. THR-011, THR-015; written as const without the PackageCheckCase annotation, since tests/config imports only tests/config, and the call sites check the type.

## `tests/config/packages/launcher.ts`

- (the file) (file): **move** to `tests/config/e2e.ts`. One user, the packed CLI test; test data that is not a single short literal lives in a tests/config topic file.
- LAUNCHER_FILES (const exported, 2-11): **move** to `tests/config/e2e.ts` `STARTING_FILES`. Starting files, not launcher or authored; test data that is not a single short literal lives in a tests/config topic file; its CLAUDE.md entry stays, because the test checks that init leaves CLAUDE.md as written.
- SYNTAX_FINDINGS (const exported, 14-22): **move** to `tests/config/e2e.ts` `BASH_SYNTAX_FINDINGS`. One user; test data that is not a single short literal lives in a tests/config topic file.
- RECORD_POLICY (const exported, 25-36): **delete**. ROOT-004; ROOT-004: the \_\_proto\_\_ cases go with the zod patch; nine unit files cover key handling
- INVALID_RECORD_POLICIES (const exported, 39-46): **delete**. ROOT-004; ROOT-004

## `tests/config/packages/plugin.ts`

- (the file) (file): **split** to `tests/config/e2e.ts; tests/e2e/eslint-plugin.test.ts`. One user; test data that is not a single short literal lives in a tests/config topic file; PEER_PACKAGES stays in its test because it reads three package.json files.
- pluginConsumerTools (const exported, 6-10): **inline** to `tests/e2e/eslint-plugin.test.ts` `PEER_PACKAGES`. THR-007: the typescript-eslint pin replaces the @typescript-eslint/utils dev dependency; built at load time from three package.json imports, so it stays in the test.
- CONSUMER (const exported, 12-26): **move** to `tests/config/e2e.ts` `MODULE_PROGRAM`. PLG-013: ESM only, CommonJS reads require(...).default; PLG-001: no process global needed; test data that is not a single short literal lives in a tests/config topic file.
- DECLARATIONS (const exported, 28-34): **move** to `tests/config/e2e.ts` `TYPE_PROGRAM`. One user; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/packages/security.ts`

- (the file) (file): **delete**. THR-012: the security pack test repeats the Semgrep unit and integration tests
- SECURITY_FILES (const exported, 2-5): **delete**. THR-012

## `tests/config/packages/tools.ts`

- (the file) (file): **inline** to `tests/e2e/tools.test.ts`. One user; FAKE_MISE is built from CLI_PINS, the CLI's config, which tests/config may not import, so it stays in the test.
- SUPPORTED_MISE (const exported, 3-3): **inline** to `tests/e2e/tools.test.ts` `FAKE_MISE`. THR-002; one user; says what it holds

## `tests/config/plugin/environment.ts`

- (the file) (file): **move** to `tests/config/eslint-plugin.ts`. PLG-031: after PLG-001 and PLG-027 only the two alias cases need the globals; two test files read it (the plugin level test and no-client-env), so it goes to tests/config/eslint-plugin.ts.
- ENVIRONMENT_GLOBALS (const exported, 2-2): **move** to `tests/config/eslint-plugin.ts` `ENVIRONMENT_GLOBALS`. PLG-001, PLG-027, PLG-031: kept only for the alias cases; two test files read it.

## `tests/config/plugin/rules/boundaries.ts`

- (the file) (file): **split** to `tests/config/eslint-plugin.ts; tests/unit/eslint-plugin/rules/import-boundaries.test.ts`. PLG-031; the import-boundaries data that is not a single short literal goes to tests/config/eslint-plugin.ts, and FOLDERS stays in its one test.
- ALIASES (const exported, 1-1): **move** to `tests/config/eslint-plugin.ts` `IMPORT_ALIASES`. PLG-031; PLG-030: drop the unused @tests/ alias; in the plugin topic file the name says what the aliases are for.
- FOLDERS (const exported, 2-2): **inline** to `tests/unit/eslint-plugin/rules/import-boundaries.test.ts` `FOLDERS`. PLG-031; a two-item list is a single short literal, so it stays in its one test.

## `tests/config/plugin/rules/no-client-env.ts`

- (the file) (file): **move** to `tests/config/eslint-plugin.ts`. PLG-031; test data that is not a single short literal lives in a tests/config topic file.
- EXAMPLE (const exported, 1-4): **move** to `tests/config/eslint-plugin.ts` `CLIENT_ENV_SAMPLE`. PLG-031; one user; EXAMPLE says nothing; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/samples/actions.ts`

- (the file) (file): **move** to `tests/config/github-actions.ts`. THR-033: actions.ts says GitHub Actions; two test files
- WORKFLOW_HEAD (const exported, 2-3): **move** to `tests/config/github-actions.ts` `WORKFLOW_HEAD`. THR-031 rule: unit github-actions check test and integration infrastructure/github-actions test

## `tests/config/samples/bash.ts`

- (the file) (file): **move** to `tests/config/bash/tools.ts`. Data shared by many test files (THR-002); tests/config/bash.ts would pass 300 lines, so the ShellCheck, Bats, syntax and sample-script data go to tests/config/bash/tools.ts.
- HEAD (const exported, 1-2): **move** to `tests/config/bash/tools.ts` `BASH_HEADER`. HEAD says nothing (THR-033); the unit Bash check tests and integration language/bash use it; it lives in tests/config/bash/tools.ts.
- BASH_CASES_MAIN (const exported, 4-4): **move** to `tests/config/bash/tools.ts` `BASH_MAIN`. TCG-058 spreads the Bash rows over the unused-functions, source-order and import-comments tests, and bash/structure.test.ts goes; cases is a retired word (glossary); it lives in tests/config/bash/tools.ts.
- CLEAN_BASH_SCRIPT (const exported, 7-7): **move** to `tests/config/bash/tools.ts` `CLEAN_BASH_SCRIPT`. Fifteen test files use it; it lives in tests/config/bash/tools.ts.

## `tests/config/samples/checks.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. THR-031: BASE_CHECK and SEMGREP_CHECK (TTO-031) join it; the check records of the execution tests live in tests/config/execution.ts.
- CHECK_FIELDS (const exported, 2-9): **move** to `tests/config/execution.ts` `CHECK_FIELDS`. Three test files use it (configuration errors, command placeholders, manifest checks); it lives in tests/config/execution.ts.

## `tests/config/samples/ci.ts`

- (the file) (file): **move** to `tests/config/ci.ts`. TTO-005 merges the CI generation tool test into the unit CI test, so one user; test data that is not a single short literal lives in a tests/config topic file.
- PIPELINE (const exported, 3-9): **move** to `tests/config/ci.ts` `LINUX_PIPELINE`. THR-033; TTO-005: one user after the merge; one CI job shape (INS-003), so isMise goes and the name drops MISE; platforms becomes operating_systems; written as const without the Pipeline annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/samples/cloudflare.ts`

- (the file) (file): **move** to `tests/config/cloudflare.ts`. Two test files
- WRANGLER (const exported, 1-2): **move** to `tests/config/cloudflare.ts` `WRANGLER`. unit cloudflare configuration test and integration platform/cloudflare
- PACKAGE (const exported, 4-5): **move** to `tests/config/cloudflare.ts` `WRANGLER_PACKAGE_JSON`. THR-033: PACKAGE says nothing

## `tests/config/samples/commands.ts`

- (the file) (file): **split** to `tests/config/settings/scopes.ts; tests/config/init.ts; tests/config/set.ts; tests/config/execution.ts; tests/config/planning.ts`. THR-031: commands.ts is a grab bag, so each value goes to its topic file: scope settings to tests/config/settings/scopes.ts, init files to init.ts, set values to set.ts, the check program to execution.ts and the planning values to planning.ts (THR-033, TEL-014).
- REPORT_PROGRAM (const exported, 4-4): **move** to `tests/config/execution.ts` `REPORT_PROGRAM`. One user, reportingCheck (THR-031); the program of a check, beside CHECK_FIELDS in tests/config/execution.ts.
- PROJECT_TRIGGERS (const exported, 6-9): **move** to `tests/config/planning.ts` `PROJECT_TRIGGERS`. TEL-014: triggers.test.ts and the impact trigger test join the planning files test, so one user; test data that is not a single short literal lives in a tests/config topic file.
- PROJECT_OPTIONS (const exported, 11-11): **move** to `tests/config/planning.ts` `PROJECT_OPTIONS`. TEL-014: every test that reads it lands in the planning files test; test data that is not a single short literal lives in a tests/config topic file.
- NESTED_POLICY (const exported, 13-18): **move** to `tests/config/settings/scopes.ts` `TWO_SCOPES_SETTINGS`. THR-031: two sibling scopes, written as \[\[scope\]\] records with path and dotted keys (CFR-003); settings, not policy; the planning files test and integration language/bash use it, and settings with several scopes are one topic in tests/config/settings/.
- EXCEPTION_REASON (const exported, 20-20): **move** to `tests/config/set.ts` `SETTING_REASON`. Its two users are the set tests that also share PROJECT_WORDS, so it goes to tests/config/set.ts; exception is a retired word (glossary: reason).
- INIT_ORIGINALS (const exported, 22-28): **move** to `tests/config/init.ts` `REPLACED_TOOL_FILES`. THR-031 exception: stays beside INIT_FILES, which spreads it; glossary replace
- INIT_FILES (const exported, 30-36): **move** to `tests/config/init.ts` `INIT_FILES`. THR-031; unit init replace test and the integration install test (TTO-002 keeps shared-tools test 3)

## `tests/config/samples/commitlint.ts`

- (the file) (file): **move** to `tests/config/commitlint.ts`. Three test files
- COMMITLINT_PACKAGE (const exported, 2-3): **move** to `tests/config/commitlint.ts` `COMMITLINT_PACKAGE`. unit Commitlint generation, a unit init test and integration general/commits

## `tests/config/samples/components.ts`

- (the file) (file): **move** to `tests/config/components.ts`. Several framework tests
- COMPONENT_TSCONFIG (const exported, 6-6): **move** to `tests/config/components.ts` `COMPONENT_TSCONFIG`. integration framework astro, svelte and vue
- COMPONENT_SOURCE (const exported, 9-10): **move** to `tests/config/components.ts` `ANSWER_MODULE`. holds a TypeScript module, not a component; unit React rules and four integration files

## `tests/config/samples/configurations.ts`

- (the file) (file): **move** to `tests/config/configurations.ts`. THR-028 adds ALWAYS_SELECTED here
- CONFIGURATION_TABLE (const exported, 1-2): **move** to `tests/config/configurations.ts` `CONFIGURATION_TABLE`. unit managed-ignores and manifest declaration tests

## `tests/config/samples/css.ts`

- (the file) (file): **move** to `tests/config/stylelint.ts`. THR-033: css.ts holds a Stylelint package.json and two CSS snippets
- TAKEOVER_PACKAGE (const exported, 2-3): **move** to `tests/config/stylelint.ts` `STYLELINT_PACKAGE_JSON`. THR-033; glossary replace (takeover retired); four test files
- INVALID_CSS (const exported, 6-6): **move** to `tests/config/stylelint.ts` `INVALID_CSS`. unit init changed-after-plan test and init replace test (TGN-030)
- VALID_CSS (const exported, 7-7): **inline** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `VALID_CSS`. Its one user, eslint/takeover.test.ts, becomes the init replace tool-files test (TGN-030), so it is written there.

## `tests/config/samples/docs.ts`

- (the file) (file): **move** to `tests/config/docs.ts`. unit docs checks and integration markdown, docs and prose files
- README (const exported, 2-19): **move** to `tests/config/docs.ts` `README`. unit readme-shape and integration markdown-docs-prose
- GUIDE (const exported, 21-21): **move** to `tests/config/docs.ts` `GUIDE`. integration prose and markdown-docs-prose rows
- LICENSE (const exported, 23-23): **move** to `tests/config/docs.ts` `LICENSE`. unit required-files and integration commits and docs tests
- MISSING_SECTIONS_README (const exported, 24-24): **move** to `tests/config/docs.ts` `MISSING_SECTIONS_README`. unit headings and readme-shape tests (TCG-055 keeps both)
- SETEXT_README (const exported, 25-26): **delete**. Dead: no kept user, since the headings check and the readme-shape row that read it are deleted.

## `tests/config/samples/expo.ts`

- (the file) (file): **move** to `tests/config/expo.ts`. PAR-011 moves parseExpoDoctor into checks/framework/expo.ts, so both users become one test file; DOCTOR_RESULTS in tests/config/expo.ts reads it.
- PASSING_REPORT (const exported, 2-2): **move** to `tests/config/expo.ts` `PASSING_REPORT`. PAR-011: one user after the parser and check tests share a file; DOCTOR_RESULTS in tests/config/expo.ts reads it.

## `tests/config/samples/formatting.ts`

- (the file) (file): **move** to `tests/config/formatting.ts`. unit formatting, unit template export and integration general/format
- FORMAT_OVERRIDES_POLICY (const exported, 3-27): **move** to `tests/config/formatting.ts` `FORMAT_OVERRIDES_SETTINGS`. Settings, not policy; three test files; the scope overrides become root \[\[format.override\]\] records with root-relative paths (apps/web/\*\*, !apps/web/exempt.js, apps/web/admin/\*\*), the scopes keep only dotted values (format.indent_width), and the sample uses \[rules\] (CFR-003, CFR-004, TML-003).
- FORMAT_CASES (const exported, 30-37): **move** to `tests/config/formatting.ts` `PRETTIER_OPTIONS_BY_FILE`. cases is a retired word; says what each row holds; two test files

## `tests/config/samples/git.ts`

- (the file) (file): **move** to `tests/config/git.ts`. THR-031: one push data file; git.ts keeps its name as the Git topic file and also takes the pre-push argv and the hook program.
- PUSH_CONTENT (const exported, 2-8): **move** to `tests/config/git.ts` `PUSH_CONTENT`. The setup git.ts (preparePushRepository) plus the unit pre-push and revision push tests use it; it lives in tests/config/git.ts.
- NESTED_POLICY_FILES (const exported, 11-14): **move** to `tests/config/git.ts` `NESTED_SCOPE_FILES`. THR-031; settings, not policy; the copy entries and revision push tests use it; it lives in tests/config/git.ts.

## `tests/config/samples/javascript.ts`

- (the file) (file): **move** to `tests/config/eslint/overrides.ts`. javascript.ts holds an ESLint override setting (THR-033); the ESLint override records are one topic in tests/config/eslint/.
- ESLINT_OVERRIDE_POLICY (const exported, 3-24): **move** to `tests/config/eslint/overrides.ts` `ESLINT_OVERRIDES_SETTINGS`. THR-033; settings, not policy; the unit eslint ignores and template export tests use it; the scope overrides become root \[\[tools.eslint.override\]\] records with root-relative paths, the scope keeps tools.eslint.rules as a dotted key, and the sample uses \[rules\] (CFR-003, CFR-004, TML-003).

## `tests/config/samples/nested-scopes.ts`

- (the file) (file): **merge** to `tests/config/settings/scopes.ts`. THR-031: one scopes data file; settings with several scopes are one topic in tests/config/settings/.
- NESTED_SCOPES_POLICY (const exported, 1-21): **move** to `tests/config/settings/scopes.ts` `NESTED_SCOPES_SETTINGS`. Settings, not policy; the unit list test and the check scopes test use it (TTO-005, TTO-023); scopes are \[\[scope\]\] records with path and dotted keys (CFR-003), and the sample uses \[rules\] (TML-003).

## `tests/config/samples/nextjs.ts`

- (the file) (file): **move** to `tests/config/nextjs.ts`. unit Next.js and translations tests and integration framework/nextjs
- NEXT_CONFIG_FILE (const exported, 3-4): **move** to `tests/config/nextjs.ts` `NEXT_CONFIG_FILE`. unit Next.js check rows (TCG-058) and integration framework/nextjs
- NEXT_PAGE (const exported, 7-8): **move** to `tests/config/nextjs.ts` `NEXT_PAGE`. unit Next.js rows and integration framework/nextjs
- NEXT_LAYOUT (const exported, 11-12): **move** to `tests/config/nextjs.ts` `NEXT_LAYOUT`. unit Next.js rows and integration framework/nextjs
- NEXT_MESSAGES (const exported, 15-18): **move** to `tests/config/nextjs.ts` `NEXT_MESSAGES`. unit translations and integration framework/nextjs

## `tests/config/samples/npm.ts`

- (the file) (file): **split** to `tests/config/npm.ts; tests/config/settings/file.ts`. The mise runner settings are not npm data (THR-031): the npm values go to tests/config/npm.ts, and the settings constant, which holds only the two npm check ignores (INX-003), to tests/config/settings/file.ts with the other data for writing gspot.toml.
- YARN_MANAGERS (const exported, 3-16): **move** to `tests/config/npm.ts` `YARN_CLIENTS`. The unit npm generation and npm install tests use it; manager is a banned name part (glossary NpmClient); written as const without the YarnOperations annotation, since tests/config imports only tests/config, and the test checks the type.
- NATIVE_MISE_POLICY (const exported, 19-26): **move** to `tests/config/settings/file.ts` `NPM_CHECK_IGNORES`. A settings value, not npm data (THR-031); runner = "mise" goes (INX-003), so the text is the two \[\[ignore\]\] records of the npm checks, named for that; it lives with the data for writing gspot.toml in tests/config/settings/file.ts.

## `tests/config/samples/ownership.ts`

- (the file) (file): **move** to `tests/config/generated-files.ts`. OWNERSHIP_REFUSAL has five users; the ownership log records generated files, one topic with apply and the generated-file check.
- OWNERSHIP_BYTES (const exported, 2-6): **delete**. TEL-062: the restoration bytes are never read; the replacement and batch arrays are written inline in the replacement recovery test, which joins the ownership log test.
- OWNERSHIP_REFUSAL (const exported, 8-8): **move** to `tests/config/generated-files.ts` `OWNERSHIP_REFUSAL`. Five ownership tests across plans and managed-key files use it; it lives in tests/config/generated-files.ts.

## `tests/config/samples/policy.ts`

- (the file) (file): **move** to `tests/config/settings/file.ts`. Settings, not policy; the commented gspot.toml text joins the data for writing gspot.toml in tests/config/settings/file.ts.
- AUTHORED_POLICY (const exported, 2-3): **move** to `tests/config/settings/file.ts` `COMMENTED_SETTINGS`. Authored is a retired word; the unit settings edit and file tests use it; push_files goes (TML-002), so the commented \[hooks\] key is enabled = true.

## `tests/config/samples/pre-push.ts`

- (the file) (file): **move** to `tests/config/git.ts`. TTO-005 merges the pre-push tool test into the unit pre-push test, so one user; test data that is not a single short literal lives in a tests/config topic file.
- PUSH_CHECK_ARGV (const exported, 1-1): **move** to `tests/config/git.ts` `PUSH_CHECK_ARGV`. One user after the merge (TTO-005); a seven-item list is not a single short literal, so it goes to tests/config/git.ts.
- PUSH_CHECK_COMMAND (const exported, 3-3): **move** to `tests/config/git.ts` `PUSH_CHECK_COMMAND`. One user after the merge (TTO-005); built only from PUSH_CHECK_ARGV, so it lives beside it in tests/config/git.ts.

## `tests/config/samples/prose.ts`

- (the file) (file): **move** to `tests/config/set.ts`. Two set tests use it; both values the set tests write live in tests/config/set.ts.
- PROSE_WORDS (const exported, 2-2): **move** to `tests/config/set.ts` `PROJECT_WORDS`. The words setting holds project names; the set words and set exceptions tests use it; it lives in tests/config/set.ts.

## `tests/config/samples/python.ts`

- (the file) (file): **split** to `tests/config/python/checks.ts; tests/config/python/tool-project.ts`. THR-031; every kept item joins the Python topic files: tests/config/python.ts would pass 300 lines, so the check data goes to python/checks.ts and the uv tool project data to python/tool-project.ts.
- CLEAN_MODULE (const exported, 2-3): **merge** to `tests/config/python/checks.ts` `ARITHMETIC_MODULE`. One module keeps the full Args and Returns docstrings for double and triple; it lives in tests/config/python/checks.ts.
- MODULE_PATH (const exported, 5-5): **move** to `tests/config/python/checks.ts` `ARITHMETIC_MODULE_PATH`. Integration python and pytest write the module at this path; it lives in tests/config/python/checks.ts.
- PYPROJECT (const exported, 7-8): **move** to `tests/config/python/checks.ts` `PYPROJECT`. PYTEST_PYPROJECT builds on it; the unit pydoclint, Python rows and init replace tests use it; it lives in tests/config/python/checks.ts.
- PYTHON_MODULE_HEADER (const exported, 10-10): **move** to `tests/config/python/checks.ts` `PYTHON_MODULE_HEADER`. The unit Python exports and modules tests use it (private-before-public is deleted); it lives in tests/config/python/checks.ts.
- PRIVATE_PYTHON_PROJECT (const exported, 12-21): **move** to `tests/config/python/tool-project.ts` `PYTHON_TOOL_PROJECT`. Glossary: tool project, not private project; the unit Python project and uv tests use it; the Python tool project is named tools (INX-010).
- PRIVATE_PYTHON_LOCKFILE (const exported, 23-34): **move** to `tests/config/python/tool-project.ts` `PYTHON_TOOL_LOCKFILE`. Glossary: tool project; the unit Python project and uv tests use it; the lockfile names the project tools (INX-010).
- PROJECT_INDEX (const exported, 36-42): **move** to `tests/config/python/tool-project.ts` `PYPROJECT_UV_INDEX`. THR-031: one user, the index settings test (tools/python/settings.ts); test data that is not a single short literal lives in a tests/config topic file, under a name that says which file holds the index.
- AUTHORED_UV_INDEX (const exported, 44-52): **move** to `tests/config/python/tool-project.ts` `UV_TOML`. Authored is a retired word; it holds uv.toml text; the index settings and uv tests use it.
- UV_LOCKFILE_MISMATCHES (const exported, 54-59): **move** to `tests/config/python/tool-project.ts` `UV_LOCKFILE_MISMATCHES`. THR-031: one user, since the lockfiles test merges into the Python project test; test data that is not a single short literal lives in a tests/config topic file.
- PYTHON_PROJECT_FILES (const exported, 62-68): **move** to `tests/config/python/tool-project.ts` `PYTHON_WORKSPACE_FILES`. Three unit tests use it; workspace says what it holds and frees PYTHON_PROJECT_FILES.
- ARITHMETIC_TESTS (const exported, 70-71): **move** to `tests/config/python/checks.ts` `ARITHMETIC_TESTS`. One user once the pytest rows of the cases table join the pytest file (TTC-001); test data that is not a single short literal lives in a tests/config topic file.
- MATH (const exported, 73-74): **move** to `tests/config/python/checks.ts` `ARITHMETIC_MODULE`. THR-033: it gets the full docstrings and absorbs CLEAN_MODULE; integration python and pytest use it.
- PROJECT (const exported, 76-76): **move** to `tests/config/python/checks.ts` `PYTEST_PYPROJECT`. THR-033; one user; built only from PYPROJECT, a config value, so it lives beside it in tests/config/python/checks.ts.

## `tests/config/samples/quickstart.ts`

- (the file) (file): **move** to `tests/config/e2e.ts`. TTO-018 merges the two tutorial tests, and TTO-018 moves them to the e2e suite; test data that is not a single short literal lives in a tests/config topic file.
- SETUP_COMMANDS (const exported, 2-10): **move** to `tests/config/e2e.ts` `QUICKSTART_COMMANDS`. TTO-018: one user after the merge; in the e2e topic file the name says whose commands; users never trust or install gspot's mise file by hand, so the mise trust .mise/conf.d/gspot-tools.toml and bare mise install steps go, since gspot install runs mise for .gspot/mise.toml (INX-001, INX-009); every quickstart is init, install, check, with no gspot doctor line, since gspot install names missing programs.

## `tests/config/samples/react.ts`

- (the file) (file): **move** to `tests/config/react.ts`. THR-031: two one-user samples go to their tests, and REACT_NATIVE_TSCONFIG stays since react-rules.test.ts splits by fragment; tests/config may not import #tests/package.json, so the file holds the package names and fixed versions only, and the react and react-dom versions are added at the use site.
- EXPO_DEPENDENCIES (const exported, 6-10): **move** to `tests/config/react.ts` `EXPO_DEPENDENCIES`. Three unit test files use it; no React version here: the use site adds react from #tests/package.json, which tests/config may not import.
- NATIVE_DEPENDENCIES (const exported, 13-13): **move** to `tests/config/react.ts` `REACT_NATIVE_DEPENDENCIES`. React Native is the product name, and native alone is filler (glossary); three unit test files use it; only react-native with its fixed version, and the use site adds react from #tests/package.json.
- WEB_DEPENDENCIES (const exported, 16-19): **move** to `tests/config/react.ts` `WEB_PACKAGES`. The unit React rules and integration framework/react use it; the value is the package names \['react', 'react-dom'\], and the use site adds their versions from #tests/package.json.
- NATIVE_TSCONFIG (const exported, 22-25): **move** to `tests/config/react.ts` `REACT_NATIVE_TSCONFIG`. react-rules.test.ts splits into fragments/react.test.ts, fragments/react-native.test.ts and generation/npm.test.ts, so two or more test files use it; named like REACT_NATIVE_DEPENDENCIES, since native alone is filler (glossary); THR-031.
- WEB_TSCONFIG (const exported, 28-37): **move** to `tests/config/react.ts` `WEB_TSCONFIG`. unit React rules and integration framework/react
- CLEAN_COMPONENT (const exported, 40-42): **move** to `tests/config/react.ts` `CLEAN_COMPONENT`. THR-031: one user; test data that is not a single short literal lives in a tests/config topic file.
- COUNTER (const exported, 44-45): **move** to `tests/config/react.ts` `COUNTER`. unit React rules and integration framework/react

## `tests/config/samples/secrets.ts`

- (the file) (file): **move** to `tests/config/secrets.ts`. Every user of these samples joins general/secrets/gitleaks.test.ts (THR-031); test data that is not a single short literal lives in a tests/config topic file, and the file keeps its name.
- testKeyId (const exported, 2-2): **move** to `tests/config/secrets.ts` `AWS_KEY_ID`. THR-031, THR-033; test data that is not a single short literal lives in a tests/config topic file; the halves are joined from literals only.
- secretSettings (const exported, 5-5): **move** to `tests/config/secrets.ts` `AWS_CREDENTIALS`. THR-031; settings means gspot.toml (glossary), so not AWS_SETTINGS; built only from AWS_KEY_ID, so it lives beside it.
- testApiToken (const exported, 8-8): **move** to `tests/config/secrets.ts` `API_TOKEN`. THR-033; its two users join the one secrets integration file; test data that is not a single short literal lives in a tests/config topic file.

## `tests/config/samples/site.ts`

- (the file) (file): **move** to `tests/config/site.ts`. unit site checks and integration framework/site; TTO-029 adds SITE_HTML_BUILD here
- BUILD (const, 2-3): **inline** to `tests/config/site.ts` `STATIC_SITE_FILES`. Used only inside STATIC_SITE_FILES; write the text in the build.js entry
- STATIC_SITE_HEADERS (const, 5-6): **inline** to `tests/config/site.ts` `STATIC_SITE_FILES`. Used only inside STATIC_SITE_FILES (\_headers entry)
- SVG (const, 8-8): **inline** to `tests/config/site.ts` `STATIC_SITE_FILES`. Used only inside STATIC_SITE_FILES (logo.svg entry)
- HOME (const, 10-10): **inline** to `tests/config/site.ts` `STATIC_SITE_FILES`. Used only inside STATIC_SITE_FILES (index.html entry)
- ABOUT (const, 12-12): **inline** to `tests/config/site.ts` `STATIC_SITE_FILES`. Used only inside STATIC_SITE_FILES (about.html entry)
- SITE_BUILD_SCRIPT (const exported, 14-20): **move** to `tests/config/site.ts` `SITE_BUILD_SCRIPT`. unit site build test and integration framework/site
- SITE_POLICY (const exported, 23-23): **move** to `tests/config/site.ts` `SITE_SETTINGS`. Settings, not policy; three test files use it.
- STATIC_SITE_FILES (const exported, 25-36): **move** to `tests/config/site.ts` `STATIC_SITE_FILES`. The unit site output test and integration framework/site use it; the package.json text holds the pinned Bun version as text ('bun@1.4.2'), not the running Bun.version, so tests/config computes nothing at load.

## `tests/config/samples/spelling.ts`

- (the file) (file): **move** to `tests/config/spelling.ts`. 14 test files; move the typos ignore entry of gspot.toml to this path
- TYPO (const exported, 3-11): **move** to `tests/config/spelling.ts` `TYPO`. 14 test files

## `tests/config/samples/supabase.ts`

- (the file) (file): **move** to `tests/config/supabase.ts`. TCO adds SUPABASE_CONFIG and MIGRATION here
- GREET (const exported, 2-2): **move** to `tests/config/supabase.ts` `HELLO_EDGE_FUNCTION`. THR-033: GREET says nothing; unit service-role-key test and integration platform/supabase

## `tests/config/samples/swift/source.ts`

- (the file) (file): **split** to `tests/config/swift.ts; tests/config/structure.ts`. Flatten samples/swift/ into one Swift data file; test data that is not a single short literal lives in a tests/config topic file; ACCESSOR_DECLARATIONS follows the trivial-functions test into tests/config/structure.ts.
- CLEAN_SWIFT (const exported, 3-4): **move** to `tests/config/swift.ts` `CLEAN_SWIFT`. Six test files
- CAST_SWIFT (const exported, 7-8): **move** to `tests/config/swift.ts` `CAST_SWIFT`. One user once the Swift checks and scopes tests become the one Swift integration file, language/swift/swiftlint-swiftformat.test.ts (TTC-001); test data that is not a single short literal lives in a tests/config topic file.
- ACCESSOR_DECLARATIONS (const exported, 11-22): **move** to `tests/config/structure.ts` `ACCESSOR_DECLARATIONS`. The Swift source parser test is deleted, so one user; the statement code is in the trivial-functions check (S08-002), whose test data is in tests/config/structure.ts.
- SWIFT_PACKAGE (const exported, 24-25): **move** to `tests/config/swift.ts` `SWIFT_PACKAGE`. setup check-input.ts plus two Swift build tests

## `tests/config/samples/swift/tests.ts`

- (the file) (file): **move** to `tests/config/swift.ts`. The swift-tests sources data that also used it is deleted (TCO-004, TCO-013), so one user; SNAPSHOT_REPOSITORY in tests/config/swift.ts reads it.
- CLEAN (const exported, 1-1): **move** to `tests/config/swift.ts` `CLEAN_XCTEST`. CLEAN says nothing (THR-033); one user; SNAPSHOT_REPOSITORY in tests/config/swift.ts reads it.

## `tests/config/samples/swift/xcode.ts`

- (the file) (file): **merge** to `tests/config/xcode.ts`. Two files named xcode.ts hold Xcode project text, so they become one.
- XCODE_PROJECT (const exported, 1-20): **move** to `tests/config/xcode.ts` `TEST_TARGET_PBXPROJ`. Named for what it holds, a project with one unit-test target; integration language/swift and testing/swift-tests use it.

## `tests/config/samples/taplo.ts`

- (the file) (file): **move** to `tests/config/set.ts`. Two test files; the Taplo option and reason that the set and explain tests write live in tests/config/set.ts.
- TAPLO_OPTIONS (const exported, 2-2): **move** to `tests/config/set.ts` `TAPLO_OPTIONS`. The explain subjects and set command tests use it; it lives in tests/config/set.ts.
- TAPLO_REASON (const exported, 3-3): **move** to `tests/config/set.ts` `TAPLO_REASON`. The explain subjects and set command tests use it; it lives in tests/config/set.ts.

## `tests/config/samples/typescript.ts`

- (the file) (file): **move** to `tests/config/typescript.ts`. THR-031: one-user samples go to their tests; every kept item joins the TypeScript topic file, tests/config/typescript.ts.
- ZOD_PACKAGE (const exported, 3-4): **move** to `tests/config/typescript.ts` `ZOD_PACKAGE`. Its two users are both tests of the zod configuration; test data that is not a single short literal lives in a tests/config topic file.
- TYPESCRIPT_PACKAGE (const exported, 6-20): **move** to `tests/config/typescript.ts` `TYPESCRIPT_PACKAGE`. One user, the TypeScript checks data of language/typescript/repository-checks.test.ts (THR-031); test data that is not a single short literal lives in a tests/config topic file; its package.json text holds the pinned Bun version as text ('bun@1.4.2'), not Bun.version.
- STRICT_COMPILER_OPTIONS (const exported, 23-36): **move** to `tests/config/typescript.ts` `STRICT_COMPILER_OPTIONS`. Ten files use it, two data files among them.
- VALID (const exported, 38-39): **move** to `tests/config/typescript.ts` `STRICT_TSCONFIG_TEXT`. THR-033: VALID says nothing; four test files
- COMPILER_SOURCE (const exported, 41-41): **move** to `tests/config/typescript.ts` `COMPILER_SOURCE`. unit suppressions test and integration language/javascript
- IMPORTED_AMBIENT_FILES (const exported, 44-51): **move** to `tests/config/typescript.ts` `IMPORTED_AMBIENT_FILES`. unit TypeScript projects and integration language/javascript
- ROOT_PORT_SOURCE (const exported, 53-53): **move** to `tests/config/typescript.ts` `ROOT_PORT_SOURCE`. unit tsconfig and tsc check tests (CKO-004 splits typescript)
- CHILD_PORT_SOURCE (const exported, 55-55): **move** to `tests/config/typescript.ts` `CHILD_PORT_SOURCE`. unit tsconfig and tsc check tests

## `tests/config/samples/xcode.ts`

- (the file) (file): **move** to `tests/config/xcode.ts`. One Xcode data file.
- PBXPROJ_PROJECT (const exported, 1-21): **move** to `tests/config/xcode.ts` `GROUPED_PBXPROJ`. Two pbxproj samples share a file, so each name says what it holds; the unit Xcode parser and project check tests use it.
- XCODE_METADATA (const exported, 24-25): **move** to `tests/config/xcode.ts` `BUILD_SETTINGS_PBXPROJ`. metadata is vague; unit init settings-text and Swift generation tests

## `tests/config/timeouts.ts`

- (the file) (file): **move** to `tests/config/processes.ts`. The preload calls setDefaultTimeout(TEST_TIMEOUT_MS) (THR-025); tests/setup/ files hold no module-level constants, so the value goes to tests/config/processes.ts, where the poll intervals join it.
- TEST_TIMEOUT_MS (const exported, 2-2): **move** to `tests/config/processes.ts` `TEST_TIMEOUT_MS`. THR-025: one limit beside the clamp code, which preload.ts imports for setDefaultTimeout; tests/setup/ files hold no module-level constants, so it goes to tests/config/processes.ts.

## `tests/harness/check-case.ts`

- (the file) (file): **move** to `tests/setup/fixes.ts`. THR-036; THR-023; THR names: check sample
- runCheckCase (function exported, 17-30): **move** to `tests/setup/fixes.ts` `checkChanges`. THR-023: applies the changes, runs check --only, puts the files back; five test files; case is a retired word
- runFindingCase (function exported, 39-56): **move** to `tests/setup/fixes.ts` `runCheckSample`. THR-023: one fix rule (no in-checks); THR names: check sample; TCG-058 moves the six shared assertions in here; the check argv holds the sample's check name, so no value goes to config.

## `tests/harness/command.ts`

- (the file) (file): **move** to `tests/setup/processes.ts`. THR-020: command.ts and process.ts become one file
- deadline (const, 11-11): **move** to `tests/setup/processes.ts` `timeoutAt`. THR-020; glossary: timeout, not deadline; a mutable module variable (the running test timeout), not a constant, so it stays.
- prepareTestCommand (function exported, 20-27): **move** to `tests/setup/processes.ts` `prepareCommand`. THR-020; THR-010: no step label; Test is redundant in tests/setup; its return type PreparedCommand is written in the signature.
- openTestBudget (function exported, 33-41): **move** to `tests/setup/processes.ts` `startTestTimeout`. THR-025: the preload opens it; budget is a retired word (glossary timeout)
- remainingTestTime (function exported, 44-46): **move** to `tests/setup/processes.ts` `timeLeft`. THR names; TTO-039 removes the cancellation copy of the wait loop, so only processes.ts reads it; stop exporting
- runTestCommand (function exported, 55-67): **move** to `tests/setup/processes.ts` `runCommand`. THR-020; THR-010: drop the step parameter; one shared timeout error
- runTestCommandBlocking (function exported, 76-88): **move** to `tests/setup/processes.ts` `runCommandBlocking`. THR-020; THR-010
- fakeCommand (function exported, 96-101): **move** to `tests/setup/processes.ts` `fakeCommand`. THR-020; TTO-017 replaces five hand-written copies with it

## `tests/harness/consumer.ts`

- (the file) (file): **move** to `tests/setup/e2e-sandbox.ts`. THR-036; THR-011; THR-015; glossary e2e (consumer retired)
- createConsumer (function exported, 27-72): **move** to `tests/setup/e2e-sandbox.ts` `createPackedSandbox`. THR-011: takes the npmrc path only; glossary: sandbox and e2e, consumer retired; the starting package.json is named sandbox. Values to config: NPM_INSTALL_FLAGS = \['--ignore-scripts', '--no-audit', '--no-fund'\] -&gt; tests/config/e2e.ts
- initializeConsumer (function exported, 80-105): **move** to `tests/setup/e2e-sandbox.ts` `setUpPackedSandbox`. THR-015: one init, level, install helper for the languages, cli and tools tests; it takes cwd, configurations and level; init has no question flags, so the --no-agent-rules filter goes (CLX-001).
- getPublishedRelease (function exported, 108-112): **delete**. THR-016: tests read the version from #cli-package and the registry from the runner variables.
- runPackageCheck (function exported, 121-136): **move** to `tests/e2e/languages.test.ts` `runPackedCheck`. THR-011: one caller; drop the fix branch, fixed and the sample guard

## `tests/harness/docker.ts`

- (the file) (file): **delete**. SUP-008: Docker tests fail on Linux without Docker; the gate is isLinux
- available (const, 6-6): **delete**. SUP-008
- hasLinuxDocker (function exported, 12-22): **delete**. SUP-008: replace !hasLinuxDocker() with !isLinux from operating-systems.ts

## `tests/harness/environment.ts`

- (the file) (file): **split** to `tests/setup/environment.ts; tests/setup/modules.ts; tests/setup/e2e-sandbox.ts; tests/setup/check-input.ts`. environment.ts keeps environment variables only; sourceLauncherDirectory goes (SCR-002), so nothing joins tests/setup/install.ts.
- inherited (const, 10-10): **move** to `tests/setup/e2e-sandbox.ts` `inherited`. Only the packed-sandbox environment reads it, so it is not exported; read from the environment at load time, so it stays.
- installedModules (const exported, 13-13): **move** to `tests/setup/modules.ts` `installedModules`. Module folders live in modules.ts.
- testModules (const exported, 15-15): **move** to `tests/setup/modules.ts` `testModules`. Module folders live in modules.ts.
- sourceLauncherDirectory (const exported, 17-17): **delete**. scripts/gspot goes (SCR-002, SCR-010): the integration preload (tests/setup/integration.ts) writes a gspot command with fakeTool, sandboxPath puts its folder first, and mise where runs from the repository root.
- consumerEnvironment (const exported, 20-31): **move** to `tests/setup/e2e-sandbox.ts` `packedEnvironment`. Only e2e files use it; consumer is retired (glossary); built at load time from the inherited environment, so it stays.
- setEnvironmentVariable (function exported, 38-41): **move** to `tests/setup/environment.ts` `setEnvironmentVariable`. THR-017: every save and restore uses useEnvironment; the integration preload tests/setup/integration.ts writes process.env, with no test runner script (SCR-003); not exported.
- useEnvironment (function exported, 48-56): **move** to `tests/setup/environment.ts` `useEnvironment`. THR-017; 13 test files
- isolateCompilerCache (function exported, 62-67): **move** to `tests/setup/check-input.ts` `isolateCompilerCache`. Not an environment variable; it sits beside swiftBuildInput, its main user, for the Swift build tests.

## `tests/harness/expectations.ts`

- (the file) (file): **move** to `tests/setup/matchers.ts`. THR-036
- rejection (function exported, 9-17): **move** to `tests/setup/matchers.ts` `rejection`. THR-036; 54 test files
- containing (function exported, 25-27): **move** to `tests/setup/matchers.ts` `containing`. Kept: not a plain forward; the cast types the AsymmetricMatcher that toContainEqual and toStrictEqual require, so inlining would put a type assertion at each of 72 call sites.
- containingAll (function exported, 35-37): **move** to `tests/setup/matchers.ts` `containingAll`. Kept for the same reason as containing: the cast types the AsymmetricMatcher.
- textContaining (function exported, 45-47): **move** to `tests/setup/matchers.ts` `textContaining`. Kept for the same reason as containing: the cast types the AsymmetricMatcher.

## `tests/harness/fixer.ts`

- (the file) (file): **move** to `tests/setup/fixer.ts`. THR-036; fix tests (TEL keeps isolation and outcomes)
- planFixer (function exported, 12-16): **move** to `tests/setup/fixer.ts` `planFixer`. THR-036
- buildFixerPolicy (function exported, 23-28): **move** to `tests/setup/fixer.ts` `buildFixerSettings`. Settings, not policy.

## `tests/harness/generated.ts`

- (the file) (file): **move** to `tests/setup/generate.ts`. THR-036; THR-035: header above the imports
- eslintConfigurationSchema (const exported, 13-18): **move** to `tests/setup/generate.ts` `eslintConfigurationSchema`. eight test files
- createEslint (function exported, 25-31): **move** to `tests/setup/generate.ts` `createEslint`. 37 test files
- emitFile (function exported, 40-48): **move** to `tests/setup/generate.ts` `emitFile`. seven test files

## `tests/harness/git.ts`

- (the file) (file): **move** to `tests/setup/git.ts`. THR-036
- git (function exported, 19-42): **move** to `tests/setup/git.ts` `git`. THR-036. Values to config: GIT_TEST_CONFIG = \['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', '-c', 'core.autocrlf=false'\] -&gt; tests/config/git.ts; GIT_TEST_ENVIRONMENT = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '' } -&gt; tests/config/git.ts
- gitOutput (function exported, 50-54): **move** to `tests/setup/git.ts` `gitOutput`. THR-036
- commitAll (function exported, 60-69): **move** to `tests/setup/git.ts` `commitAll`. THR-036. Values to config: SANDBOX_COMMIT_STEPS = \[\['init', '-q'\], \['add', '-A'\], \['commit', '-qm', 'init'\]\] -&gt; tests/config/git.ts
- markExecutable (function exported, 77-89): **move** to `tests/setup/git.ts` `markExecutable`. THR-036; isWindows in place of a raw platform check.
- preparePushRepository (function exported, 96-116): **move** to `tests/setup/git.ts` `preparePushRepository`. The unit pre-push and revision push tests use it after TTO-005; its return type is written in the signature.

## `tests/harness/gspot.ts`

- (the file) (file): **move** to `tests/setup/run-gspot.ts`. THR-036; THR-041
- gspot (const exported, 17-17): **move** to `tests/setup/run-gspot.ts` `CLI_MAIN`. THR-041: built from CLI_SOURCE; says it is the path of main.ts, not gspot itself
- getCliSourcePath (function exported, 25-27): **delete**. A wrapper that only forwards to join(CLI_SOURCE, path); its four callers write join(CLI_SOURCE, '...') with the exported CLI_SOURCE.
- runGspot (function exported, 37-75): **move** to `tests/setup/run-gspot.ts` `runGspot`. THR-017: useEnvironment for the variables; with no -C (CMD-092, CLX-009), runGspot calls process.chdir(cwd) inside its try and restores the folder in finally. Values to config: GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } -&gt; tests/config/processes.ts
- checkReport (function exported, 85-93): **move** to `tests/setup/run-gspot.ts` `checkReport`. 53 test files use it; its return type is written in the signature.
- spawnGspot (function exported, 104-115): **move** to `tests/setup/run-gspot.ts` `spawnGspot`. 71 test files use it; it reads GSPOT_ENVIRONMENT from tests/config/processes.ts, and its options type is written in the signature.
- startGspot (function exported, 125-143): **delete**. THR-020: startCommand replaces it; TTO-005 merges its two users into one cancellation test
- buildRunOptions (function exported, 151-153): **move** to `tests/setup/run-gspot.ts` `buildRunOptions`. 47 test files

## `tests/harness/init.ts`

- (the file) (file): **move** to `tests/setup/init.ts`. THR-036
- buildInitArguments (function exported, 13-28): **move** to `tests/setup/init.ts` `buildInitArguments`. init takes --configurations and --json only (CMD-092): with no init questions (CLX-001) and no install step, the hooks, CI and QUIET_INIT flags go, and the function keeps 'init', '--yes', '--configurations' and --json; a test that needs hooks, CI or rules off passes --from with a template; THR-024: the installed sandbox uses it too; its options type is written in the signature.
- buildInitOptions (function exported, 37-49): **move** to `tests/setup/init.ts` `buildInitOptions`. init never installs, so the install field goes, and CLX-001 removes hooks, runner, ci and agentRules from InitOptions; the builder keeps cwd, yes and isDryRun and sets template where a test needs quiet defaults; 11 test files use it.

## `tests/harness/input.ts`

- (the file) (file): **move** to `tests/setup/check-input.ts`. THR-036; THR-031: BASE_CHECK comes from tests/config/execution.ts.
- buildCheckInput (function exported, 26-43): **move** to `tests/setup/check-input.ts` `buildCheckInput`. 60 test files use it; its options type is written in the signature.
- projectChecks (function exported, 49-68): **move** to `tests/unit/cli/planning/files.test.ts` `projectChecks`. TEL-014: every caller lands in the planning files test
- swiftBuildInput (function exported, 77-92): **move** to `tests/setup/check-input.ts` `swiftBuildInput`. Three Swift build tests use it; its return type is written in the signature.

## `tests/harness/install.ts`

- (the file) (file): **move** to `tests/setup/install.ts`. THR-036; TTO-003 cuts the cache; THR-009
- removeConfigurations (function, 46-60): **inline** to `tests/setup/install.ts` `initRepository`. One caller; one gspot remove call with every name replaces the loop, since gspot remove stays and takes several names.
- npmProjects (const, 62-62): **delete**. TTO-003: sandboxes run the real gspot install with the normal npm and uv caches.
- valeProjects (const, 63-63): **delete**. TTO-003
- cacheDirectory (function, 66-71): **delete**. TTO-003
- prepareSharedProjects (function, 74-111): **delete**. TTO-003; TTO-002 deletes the test of this cache
- prepareValeProject (function, 114-145): **delete**. TTO-003
- buildToolsPath (function exported, 152-165): **move** to `tests/setup/install.ts` `toolsPath`. THR-009: the names changed nothing but a guard, so it takes no parameter and reads PATH when called; the integration preload builds the PATH, with no test runner script (SCR-003).
- buildSandboxPath (function exported, 172-175): **move** to `tests/setup/install.ts` `sandboxPath`. THR-009: no names parameter; sandbox (glossary); the first PATH entry is the folder where the integration preload writes the gspot command with fakeTool, not scripts/ (SCR-002).
- initRepository (function exported, 184-203): **move** to `tests/setup/install.ts` `initRepository`. init never installs, so the --no-install argument goes and gspot install runs after init through installToolProjects (TTO-003); nine test files use it; its settings type SandboxSettings comes from tests/types/sandbox.ts.
- installToolProjects (function exported, 206-213): **move** to `tests/setup/install.ts` `installToolProjects`. TTO-003: every sandbox runs the real gspot install through it
- shareToolProjects (function exported, 220-247): **delete**. TTO-003: its eight callers run initRepository or installToolProjects

## `tests/harness/migrations.ts`

- (the file) (file): **inline** to `tests/unit/cli/checks/database/postgres/schema.test.ts`. The migration-docs test is deleted, so one user
- parseMigration (function exported, 13-16): **move** to `tests/unit/cli/checks/database/postgres/schema.test.ts` `parseMigration`. One user after the migration-docs test is deleted

## `tests/harness/npm.ts`

- (the file) (file): **move** to `tests/setup/npm-clients.ts`. THR-036 named it package-managers.ts, but manager is a banned name part; glossary NpmClient
- writePackageProject (function, 24-59): **move** to `tests/setup/npm-clients.ts` `writeNpmClientSandbox`. One caller; glossary: sandbox (package project means the tool project); settingsText takes only the ignores, with no runner option (INX-003); not exported; its options type is written in the signature, and the packageManager field is added at run time. Values to config: NPM_SANDBOX_PACKAGE = { private: true, devDependencies: { eslint: '0.0.0-authored' }, scripts: { test: 'authored-command' }, workspaces: \['\*\*'\] } -&gt; tests/config/npm.ts; PNPM_WORKSPACE = 'packages:\\n - "\*\*"\\n' -&gt; tests/config/npm.ts
- prepareToolProject (function, 62-67): **inline** to `tests/setup/npm-clients.ts` `createNpmClientSandbox`. TTO-016: one caller; its name clashed with the product prepareToolProject
- readPackageInputs (function exported, 70-83): **move** to `tests/setup/npm-clients.ts` `readToolProjectFiles`. says what it reads: the tool project manifest, lockfile and ownership log; four npm tests
- createPackageProject (function exported, 86-139): **move** to `tests/setup/npm-clients.ts` `createNpmClientSandbox`. THR-017: useEnvironment for the Yarn and Bun folders; glossary NpmClient and sandbox; the runner parameter goes (INX-003).

## `tests/harness/pins.ts`

- (the file) (file): **move** to `tests/setup/pins.ts`. THR-036
- mockPinnedExecutables (function exported, 15-38): **move** to `tests/setup/pins.ts` `mockPinnedExecutables`. 17 test files
- buildLibraryPin (function exported, 46-48): **move** to `tests/setup/pins.ts` `buildLibraryPin`. tool inspection tests
- buildBinaryPin (function exported, 58-65): **move** to `tests/setup/pins.ts` `buildProgramPin`. NMS-026: the tool kind binary becomes program
- inspectionContext (function exported, 72-74): **delete**. THR-041: the three tests write { root, inspections: new Map() }

## `tests/harness/platforms.ts`

- (the file) (file): **split** to `tests/setup/operating-systems.ts; tests/setup/modules.ts; tests/setup/fake-tool.ts`. Six unrelated jobs, split by topic (NMU-007).
- packageNames (function, 17-29): **move** to `tests/setup/modules.ts` `packageNames`. A private helper of modules.ts.
- hasToolBuild (function exported, 36-40): **move** to `tests/setup/operating-systems.ts` `hasToolBuild`. NMU-007; the tool build gate sits with the operating-system helpers.
- getKeptMode (function exported, 48-51): **delete**. PLR-011: the 14 tests import the product fileMode.
- linkInstalledModules (function exported, 59-75): **move** to `tests/setup/modules.ts` `linkInstalledModules`. Module folders and links live in modules.ts.
- usePlatform (function exported, 82-90): **move** to `tests/setup/operating-systems.ts` `useOperatingSystem`. NMU-007: platform means only Cloudflare and Supabase; more tests use it to simulate an operating system.
- copyInstalledModule (function exported, 97-120): **delete**. THR-008: after TTO-003 its two HTML tests link modules with linkInstalledModules
- fakeTool (function exported, 129-139): **move** to `tests/setup/fake-tool.ts` `fakeTool`. TTO-039 uses it for Windows-safe fakes.

## `tests/harness/policy.ts`

- (the file) (file): **move** to `tests/setup/settings.ts`. THR-036; settings, not policy.
- buildPolicy (function exported, 14-18): **move** to `tests/setup/settings.ts` `settingsText`. settingsText (TGN-044); its options type is written in the signature; with no runner option (INX-003) it keeps the ignore option and one option rules?: boolean: the text writes \[rules\] enabled = false unless rules is true, which the rules tests and 62 other tests pass, and two tests add their own \[rules\] table.
- policyFindings (function exported, 26-34): **move** to `tests/setup/settings.ts` `settingsErrors`. TPP-027: errors, not findings; settings, not policy.
- alwaysSelectedConfigurations (function exported, 37-44): **delete**. THR-028 replaces it with ALWAYS_SELECTED, the literal list of always-selected configurations, in tests/config/configurations.ts.
- reportingCheck (function exported, 51-57): **move** to `tests/setup/settings.ts` `reportingCheck`. Five test files use it; it returns the CLI's command-check type CommandCheck and takes Pick&lt;CommandCheck, 'paths'|'stage'&gt; in its signature; REPORT_PROGRAM comes from tests/config/execution.ts.

## `tests/harness/preload.ts`

- (the file) (file): **move** to `tests/setup/preload.ts`. THR-036; THR-025: setDefaultTimeout(TEST_TIMEOUT_MS); THR-026: no orphan comment
- version (const, 5-5): **delete**. THR-026: mise pins Bun, so the version guard repeats the pin.
- budget (const, 11-11): **move** to `tests/setup/preload.ts` `testTimeout`. THR-025; glossary: timeout, not budget; a mutable module variable of the preload, not a constant, so it stays.

## `tests/harness/preservation.ts`

- (the file) (file): **move** to `tests/setup/files.ts`. THR-036; the file helpers live in tests/setup/files.ts.
- resetIndex (function, 25-29): **move** to `tests/setup/files.ts` `resetIndex`. A private helper.
- originalFile (function, 31-40): **move** to `tests/setup/files.ts` `originalFile`. A private helper.
- isAbsent (function, 42-50): **delete**. absentParents uses !pathExists; a parent folder is never a broken link.
- absentParents (function, 52-62): **move** to `tests/setup/files.ts` `absentParents`. A private helper.
- restoreFiles (function, 64-74): **move** to `tests/setup/files.ts` `restoreFiles`. A private helper.
- removeParents (function, 76-84): **move** to `tests/setup/files.ts` `removeParents`. A private helper.
- writeChanges (function, 86-98): **move** to `tests/setup/files.ts` `writeChanges`. A private helper.
- applyChanges (function exported, 101-125): **move** to `tests/setup/files.ts` `applyChanges`. check-samples.ts, sandbox.ts and integration tests use it.
- readTree (function exported, 132-150): **move** to `tests/setup/files.ts` `readTree`. TCO-046: read mode and bytes from one file handle.
- pathExists (function exported, 157-162): **move** to `tests/setup/files.ts` `pathExists`. Kept: it turns a rejected access into false, which 85 test files need, so it is not a plain forward.

## `tests/harness/process.ts`

- (the file) (file): **merge** to `tests/setup/processes.ts`. THR-020
- waitForExit (function exported, 13-27): **move** to `tests/setup/processes.ts` `waitForExit`. THR-020
- waitForFile (function exported, 30-34): **move** to `tests/setup/processes.ts` `waitForFile`. THR-020
- captureChild (function exported, 37-50): **move** to `tests/setup/processes.ts` `captureChild`. THR-020: startCommand returns the captured child; export only while a test still captures a child it spawned itself
- interruptOwner (function exported, 59-80): **move** to `tests/unit/cli/ownership/log.test.ts` `interruptOwnershipWrite`. Its two users (recovery batches and links) merge into one test; owner is retired outside the ownership log (glossary); its interruption type is written in the signature.

## `tests/harness/python-installation.ts`

- (the file) (file): **move** to `tests/setup/python.ts`. THR-036, TTO-003, THR-001; the installUv import goes with installSuitePythonTools (INX-006).
- pythonLockfiles (const, 38-38): **delete**. TTO-003
- pythonEnvironment (function, 41-47): **delete**. TTO-003: both callers are deleted
- installSuitePythonTools (function exported, 55-94): **delete**. TTO-003: the suite-wide Python install goes.
- preparePythonProject (function exported, 101-125): **delete**. TTO-003: its one caller prepareSharedProjects is deleted
- sharePythonTools (function exported, 132-142): **delete**. TTO-003; TTO-041: the Semgrep test runs gspot apply instead
- preparePythonInstallation (function exported, 145-194): **move** to `tests/setup/python.ts` `createPythonSandbox`. THR-017: useEnvironment; glossary: sandbox; the Python install and staged-check tests use it; the runner option goes (INX-003); its options and return types are written in the signature. Values to config: PYTHON_INDEX_NAME = 'gspot-test' -&gt; tests/config/python/tool-project.ts
- createPythonRegistry (function exported, 202-241): **move** to `tests/integration/python-tool-project.test.ts` `createPythonIndex`. THR-001: one test file; write the wheel in TypeScript with node:zlib crc32 (stored entries, Unix modes) in place of python3; index, not registry; its return type is written in the signature.

## `tests/harness/quickstart.ts`

- (the file) (file): **inline** to `tests/e2e/quickstart.test.ts`. TTO-018 merges the two tutorial tests; TTO-018 moves them to e2e
- prepareQuickstart (function exported, 17-62): **move** to `tests/e2e/quickstart.test.ts` `prepareQuickstart`. TTO-018; TTO-018: one test file; THR-018: the registry writes its npmrc; mise where and mise which run with the repository root as cwd, not scripts/ (SCR-002); uv is a program tool found like the others (mise where), and the pins hold no gspot or Node (INX-002, INX-006); its return type is written in the signature.

## `tests/harness/registry.ts`

- (the file) (file): **merge** to `tests/setup/install.ts`. No test runner script and no scripts/npm-registry.ts (SCR-004, SCR-010): only tests and the integration preload use this code, so it stays test setup.
- packedPackagesSchema (const exported, 21-31): **move** to `tests/setup/install.ts` `packedPackagesSchema`. SCR-004, ROOT-026: with its inferred type; not exported; a zod schema stays with its code (SCR-010).
- packRegistryPackages (function exported, 40-63): **move** to `tests/setup/install.ts` `packPackages`. The integration preload and createNpmRegistry call it (SCR-010). Values to config: NPM_PACK_FLAGS = \['--ignore-scripts', '--json'\] -&gt; tests/config/integration.ts; PACKED_PACKAGES_FILE = 'packages.json' -&gt; tests/config/integration.ts
- createPackageRegistry (function exported, 71-123): **move** to `tests/setup/install.ts` `createNpmRegistry`. THR-018: writes the npmrc and returns url and npmrc; named for its file; its options type is written in the signature (SCR-010). Values to config: REGISTRY_HOST = '127.0.0.1' -&gt; tests/config/integration.ts; UPSTREAM_REGISTRY = '<https://registry.npmjs.org/>' -&gt; tests/config/integration.ts; GSPOT_PACKAGE_SCOPE = '@gspothq/' -&gt; tests/config/integration.ts
- createInstallationRegistry (function exported, 131-155): **move** to `tests/setup/install.ts` `createInstallationRegistry`. THR-018: shrinks to the existence check; installToolProjects and the hooks test use it; its return type is written in the signature.

## `tests/harness/repository.ts`

- (the file) (file): **split** to `tests/setup/sandbox.ts; tests/integration/general/files.test.ts`. THR-024, THR-043; glossary: sandbox, not test repository; the runtime detection rows stay as a function in tests/setup/sandbox.ts.
- writeRepository (function, 25-42): **move** to `tests/setup/sandbox.ts` `writeSandbox`. THR-024; glossary: sandbox; private; gspot never pins itself (INX-002, SCR-001), so the sandbox mise.toml with disable_tools = \["npm:@gspothq/cli"\] goes from the files. Values to config: SANDBOX_PACKAGE_JSON = { name: 'example', version: '1.0.0', private: true, description: 'A sandbox.', type: 'module' } (dependencies added at run time) -&gt; tests/config/sandbox.ts; SANDBOX_GITIGNORE = 'node_modules\\n' -&gt; tests/config/sandbox.ts
- prepareCliRepository (function exported, 50-56): **merge** to `tests/setup/sandbox.ts` `createSandbox`. THR-024: every unit caller passes runGspot with this preparation
- prepareTestRepository (function exported, 64-78): **move** to `tests/setup/sandbox.ts` `prepareInstalledSandbox`. THR-024: buildInitArguments in place of the hand-built list; three integration tests call it directly; no QUIET_INIT default, and buildInitArguments gives init --yes --configurations (CLX-001).
- createTestRepository (function exported, 87-108): **move** to `tests/setup/sandbox.ts` `createSandbox`. THR-024: no callbacks; no tools, gspot in the same process; the one Cloudflare custom case is written in its test
- preserveRepositoryChanges (function exported, 116-131): **move** to `tests/integration/general/files.test.ts` `preserveSandboxChanges`. One test file
- runtimeEvidenceCases (function exported, 137-192): **move** to `tests/setup/sandbox.ts` `runtimeDetectionRows`. Shared test data of two test files; evidence is jargon; the rows are built from the CLI's JAVASCRIPT_RUNTIMES, which tests/config may not import, so this stays a function in tests/setup that builds them.
- shareRepository (function exported, 199-207): **move** to `tests/setup/sandbox.ts` `shareInstalledSandbox`. THR-024 (shareInstalledRepository, with is banned); glossary sandbox

## `tests/harness/ruff_wheel.py`

- (the file) (file): **delete**. THR-001: the wheel is written in TypeScript inside createPythonIndex; remove python from gspot.toml configurations

## `tests/harness/rule-tester.ts`

- (the file) (file): **move** to `tests/setup/rule-tester.ts`. THR-036; PLG-032
- createRuleTester (function exported, 24-43): **move** to `tests/setup/rule-tester.ts` `createRuleTester`. PLG-032: itOnly is it.only (PLG-032); keep tsconfigRootDir only for the typed run PLG-029 adds, with a comment without semicolons. Values to config: RULE_TESTER_ROOT = '/repo' -&gt; tests/config/eslint-plugin.ts; RULE_TESTER_PARSER_OPTIONS = { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } -&gt; tests/config/eslint-plugin.ts

## `tests/harness/syntax.ts`

- (the file) (file): **inline** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`. THR-041; the Swift source parser test is deleted and the statement code is in the trivial-functions check (S08-002), so its one test file is that test.
- parseTestSource (function exported, 11-18): **move** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `parseTestSource`. One user after the Swift source parser test is deleted; its return type is written in the signature.

## `tests/harness/tooling.ts`

- (the file) (file): **move** to `tests/setup/manifest.ts`. THR-036 (THR names: manifest)
- parseConfigurationManifest (function exported, 13-19): **move** to `tests/setup/manifest.ts` `buildManifest`. Builds a test configuration manifest (THR names: manifest); nine test files use it; its options type is written in the signature.

## `tests/harness/tracked.ts`

- (the file) (file): **move** to `tests/setup/tracked-file.ts`. THR-036
- buildTrackedFile (function exported, 12-14): **move** to `tests/setup/tracked-file.ts` `buildTrackedFile`. Three test files

## `tests/package.json`

- (the file) (file): **keep** to `tests/package.json`. THR-007: delete std-env, @typescript-eslint/utils and @gspothq/cli; THR-008: update-rule-lists writes the 49 manifest pins

## `tests/packages/languages.test.ts`

- (the file) (file): **move** to `tests/e2e/languages.test.ts`. Glossary e2e (packages retired as a suite)
- one installed consumer runs the pinned language tools against samples and fixes (test (test), 90-127): **keep** to `tests/e2e/languages.test.ts` `a packed install runs the pinned language tools, reports their findings, and passes after the fixes`. Real: prose and Swift findings and fixes and SQL detection; gspot add sql stays, as doctor suggests it; THR-011 deletes the fixed assertion; THR-015: two plain blocks; consumer is retired (glossary).
- release (const, 14-14): **delete**. THR-016: tests read the version from #cli-package.
- prepareLanguages (function, 17-37): **move** to `tests/e2e/languages.test.ts` `prepareLanguages`. THR-015: calls setUpPackedSandbox; distinct setup step of the one test
- expectInstalledSql (function, 40-88): **move** to `tests/e2e/languages.test.ts` `expectInstalledSql`. 48-line assertion block of the one test

## `tests/packages/launcher.test.ts`

- (the file) (file): **move** to `tests/e2e/cli.test.ts`. tests the packed CLI package; launcher is a retired word for gspot (glossary)
- launcher SIGTERM cancellation terminates its ready owned process (test (test.skipIf), 46-91): **keep** to `tests/e2e/cli.test.ts` `SIGTERM to the packed gspot stops the tool process it started`. Real: SIGTERM stops the tool; THR-020: startCommand replaces the hand-written spawn; the check is a \[\[command_check\]\] record with name; launcher is retired for gspot (glossary).
- !isPosix (test (test.skipIf), 46-46): **rename** to `tests/e2e/cli.test.ts` `isWindows`. The skip of the SIGTERM test is written as isWindows.
- init replaces formatter files, moves authored instructions, and check reports findings (test (test), 93-146): **keep** to `tests/e2e/cli.test.ts` `init replaces formatter files, leaves CLAUDE.md and your AGENTS.md notes as written, and check reports findings`. gspot never touches CLAUDE.md, so the test checks that init leaves CLAUDE.md as written; real: init replaces tool files, keeps AGENTS.md notes, and check reports and passes; authored is retired (glossary).
- the packed CLI validates own record keys in Node and Bun without Node on PATH (test (test), 148-183): **delete**. Weak: the byte comparisons test npm's copy of the build, the \_\_proto\_\_ cases test the deleted zod patch, and the loop that is left only checks exit code 0 (ROOT-004, ROOT-004).
- release (const, 24-24): **delete**. THR-016: tests read the version from #cli-package.
- expectTakeover (function, 27-44): **move** to `tests/e2e/cli.test.ts` `expectReplacedFiles`. gspot never touches CLAUDE.md: it is not in plan.remove and stays as written, and AGENTS.md ends without its text; glossary: replace, not takeover.

## `tests/packages/plugin.test.ts`

- (the file) (file): **move** to `tests/e2e/eslint-plugin.test.ts`. Glossary: eslint-plugin in paths
- the installed plugin holds its license and documentation, loads as both module kinds, and enforces both levels (test (test), 47-72): **keep** to `tests/e2e/eslint-plugin.test.ts` `the installed ESLint plugin loads through import and require and enforces both levels`. THR-014: drop the license and README byte checks, so the title does not promise them; THR-044: install the plugin at its own version.
- release (const, 12-12): **delete**. THR-016: tests read the version from #cli-package.
- expectPluginPayload (function, 14-22): **delete**. THR-014: checks that a build step copied two files
- expectPluginExports (function, 24-45): **move** to `tests/e2e/eslint-plugin.test.ts` `expectPluginExports`. PLG-013: ESM import and require(...).default; type check stays

## `tests/packages/security.test.ts`

- (the file) (file): **delete**. THR-012: the security pack test repeats the Semgrep unit and integration tests.
- installed language security packs use their configuration names (test (test), 13-27): **delete**. Duplicate of the Semgrep generation unit test and the Semgrep integration test (THR-012).
- release (const, 11-11): **delete**. Used only by the deleted security pack test (THR-012).

## `tests/packages/tools.test.ts`

- (the file) (file): **move** to `tests/e2e/tools.test.ts`. Glossary e2e
- the installed formatter fixes source and preserves authored package metadata (test (test), 99-115): **keep** to `tests/e2e/tools.test.ts` `the installed formatter reports and fixes source and keeps your package.json fields`. Real: the installed formatter reports, fixes and keeps package.json; glossary: your own, not authored.
- native and npm tool commands use their installed executables (test (test), 117-135): **delete**. Duplicate: the npm half is the kept jsconfig integration test 'javascript/tsc uses gspot's own TypeScript when the project has none', which asserts the check command is .gspot/node_modules/.bin/tsc; the mise half only checks exit code 0 and that the path is not under .gspot/node_modules; the kept e2e cli, tools and languages tests already run installed npm tools (Prettier) and mise tools (Vale) from the packed package.
- prepareFormatterConsumer (function, 17-72): **move** to `tests/e2e/tools.test.ts` `prepareFormatterSandbox`. THR-015: start from onlineOptions (keep NO_PROXY for the local registry) and call setUpPackedSandbox; glossary: sandbox; the empty mise.toml that picked the runner and the --no-runner filter go (INX-003, CLX-001).
- prepareNativeConsumer (function, 75-95): **delete**. Dead: used only by the deleted tool commands test.
- release (const, 97-97): **delete**. THR-016: tests read the version from #cli-package.

## `tests/plugin/configuration.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/plugin.test.ts`. PLG layout: it tests src/plugin.ts, today rules/public.ts.
- the shipped %s preset agrees with the plugin (test (test.each), 9-16): **delete**. PLG-008; PLG-012: self-policing copy check; the CLI build reads the plugin levels
- \['recommended', 'all'\] as const (test (test.each), 9-9): **delete**. PLG-008; PLG-012: argument row of the deleted test
- the plugin (describe (describe), 18-37): **delete**. PLG-027: a describe around one test; its test merges into the level test
- the plugin &gt; %s applies its trivial-function rule (test (test.each), 19-36): **delete**. Duplicate: the kept test '%s applies its alias level and enforces private client access' already checks that an all-only rule reports at level all and not at recommended (PLG-027).
- the plugin &gt; \['recommended', 'all'\] as const (test (test.each), 19-19): **delete**. Duplicate: argument row of the deleted trivial-function level test (PLG-027).
- %s applies its alias level and enforces private client access (test (test.each), 39-62): **keep** to `tests/unit/eslint-plugin/plugin.test.ts`. PLG-027: the one level test; PLG-001: no declared globals needed
- \['recommended', 'all'\] as const (test (test.each), 39-39): **keep** to `tests/unit/eslint-plugin/plugin.test.ts`. Argument row of the level test; LEVELS comes from packages/cli/src/config/configurations.ts, not a written \['recommended', 'all'\].
- %s shares plugin identity with explicit rules (test (test.each), 64-72): **keep** to `tests/unit/eslint-plugin/plugin.test.ts`. PLG-027: guards a real ESLint error (same plugin object)
- \['recommended', 'all'\] as const (test (test.each), 64-64): **keep** to `tests/unit/eslint-plugin/plugin.test.ts`. Argument row of the plugin identity test, which does not depend on the level, so one row ('all') stays.

## `tests/plugin/files.test.ts`

- (the file) (file): **delete**. Duplicate: the URL test tests dead code and the Windows test repeats the kept 'import-boundaries on Windows paths' run, so no test is left in the file (PLG-019, PLG-028).
- plugin file paths (describe (describe), 8-18): **delete**. PLG-019; PLG-028: the file URL branch goes
- plugin file paths &gt; a file URL resolves the original file through spaces, percent signs, and Unicode (test (test), 9-17): **delete**. PLG-019; PLG-028: tests a dead branch and writes a file to test a string function
- Windows paths use forward slashes and the same drive letter case (test (test), 20-23): **delete**. Duplicate: the kept run 'import-boundaries on Windows paths' lints a file under C: with a root under c: and backslashes, so it fails unless normalizePath turns backslashes into slashes and upper-cases the drive letter (PLG-028).

## `tests/plugin/rules/header-first.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/header-first.test.ts`. PLG layout; PLG-002 adds the nosemgrep and prettier-ignore cases
- the default JavaScript parser preserves declaration comments and fixes import headers before %s (test (test.each), 6-24): **keep** to `tests/unit/eslint-plugin/rules/header-first.test.ts`. Real: fixes import headers before each class form
- \['class Sample {}', 'export class Sample {}', 'export default class Sample {}'\] (test (test.each), 6-6): **keep** to `tests/unit/eslint-plugin/rules/header-first.test.ts`. argument row of the test above

## `tests/plugin/rules/import-boundaries.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/import-boundaries.test.ts`. PLG-030: delete the repeated lib/inner case and the @tests/ alias; two runs; one Options type

## `tests/plugin/rules/no-alias-exports.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/no-alias-exports.test.ts`. PLG layout

## `tests/plugin/rules/no-client-env.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/no-client-env.test.ts`. PLG-001: add a case with no declared globals

## `tests/plugin/rules/no-index-imports.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/no-index-imports.test.ts`. PLG-025: keep the rule and document that only explicit index paths report

## `tests/plugin/rules/no-trivial-files.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/no-trivial-files.test.ts`. PLG-026: delete the empty-statement case

## `tests/plugin/rules/no-trivial-functions.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/no-trivial-functions.test.ts`. PLG-024; PLG-026: delete contrived and empty-constructor cases; PLG-029: add a typed RuleTester run

## `tests/plugin/rules/require-server-only.test.ts`

- (the file) (file): **move** to `tests/unit/eslint-plugin/rules/require-server-only.test.ts`. PLG layout

## `tests/pyrightconfig.json`

- (the file) (file): **delete**. THR-001: gspot apply removes this pointer once python leaves the configurations

## `tests/ruff.toml`

- (the file) (file): **delete**. THR-001: gspot apply removes this pointer once python leaves the configurations

## `tests/types/harness/check-case.ts`

- (the file) (file): **move** to `tests/types/checks.ts`. THR-002; tests/setup/ files hold no module-level types, so the check case types go to tests/types/checks.ts ('samples' is a retired word).
- Correction (type exported, 7-14): **move** to `tests/types/checks.ts` `SampleFix`. THR-023: policy is a plain optional string; glossary: fix, not correction; fixed field; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- FindingCase (type exported, 17-25): **move** to `tests/types/checks.ts` `CheckSample`. THR names: check sample (case retired); 41 users; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file; the test data files that annotate their rows with it drop the annotation, since tests/config imports only tests/config.
- CheckCommand (type exported, 28-28): **move** to `tests/types/checks.ts` `GspotCall`. The signature of runGspot and spawnGspot, the run callback of samples and sandboxes; CheckCommand reads like the command check of the glossary; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- CheckCaseOutcome (type exported, 31-34): **move** to `tests/types/checks.ts` `SampleOutcome`. THR-011 deletes the packed-package user; the return type of runCheckSample; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.

## `tests/types/harness/command.ts`

- (the file) (file): **split** to `tests/types/processes.ts; tests/setup/run-gspot.ts`. THR-002, THR-020; shared types go to tests/types/processes.ts, and one-use types are written in their signatures.
- TestStep (type exported, 5-5): **inline** to `tests/setup/processes.ts` `prepareCommand`. THR-020: the return of prepareCommand; step is retired with THR-010; a one-use type is written in the one signature that uses it, so no module declares it.
- SpawnOutcome (type exported, 8-8): **move** to `tests/types/processes.ts` `SpawnOutcome`. THR-020; eight users; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- GspotSpawnOptions (type exported, 11-11): **inline** to `tests/setup/run-gspot.ts` `spawnGspot`. One user, spawnGspot; a one-use type is written in the one signature that uses it, so no module declares it: Pick&lt;AsyncSpawnOptions, 'stdin'&gt;.
- GspotChildOptions (type exported, 14-14): **move** to `tests/types/processes.ts` `StdinOptions`. runGspot and checkReport take it, and runGspot runs in this process, so it is no child option; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- CheckReport (type exported, 17-17): **inline** to `tests/setup/run-gspot.ts` `checkReport`. The return of checkReport; a one-use type is written in the one signature that uses it, so no module declares it: SpawnOutcome & { report: RunReport }.

## `tests/types/harness/consumer.ts`

- (the file) (file): **split** to `tests/types/e2e.ts; tests/e2e/languages.test.ts`. THR-002, THR-011; shared types go to tests/types/e2e.ts, and the one-use type is written in its signature.
- ConsumerOptions (type exported, 7-7): **move** to `tests/types/e2e.ts` `CommandOptions`. Online and offline command options of a packed sandbox, used by the sandbox and the languages test; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- Consumer (type exported, 10-19): **move** to `tests/types/e2e.ts` `PackedSandbox`. Glossary: sandbox and e2e, consumer retired; three e2e files use it; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- PackageCheckCase (type exported, 22-28): **inline** to `tests/e2e/languages.test.ts` `runPackedCheck`. THR-011: no isNpm, no fix variant, sample required; one user; a one-use type is written in the one signature that uses it, so no module declares it.
- PackageCheckOutcome (type exported, 31-33): **delete**. THR-011: fixed goes; runPackedCheck returns the failed and passed reports

## `tests/types/harness/git.ts`

- (the file) (file): **inline** to `tests/setup/git.ts`. One user; its one type is written in the signature of preparePushRepository.
- PushRepository (type exported, 2-2): **inline** to `tests/setup/git.ts` `preparePushRepository`. One user, preparePushRepository; a one-use type is written in the one signature that uses it, so no module declares it.

## `tests/types/harness/init.ts`

- (the file) (file): **inline** to `tests/setup/init.ts`. THR-002; one user
- InitArguments (type exported, 4-9): **inline** to `tests/setup/init.ts` `buildInitArguments`. CMD-092 and CLX-001 delete the hooks and CI flags; a one-use type is written in the one signature that uses it, so no module declares it: { json?: boolean; template?: string }, since buildInitArguments also takes the template for init --from.

## `tests/types/harness/input.ts`

- (the file) (file): **inline** to `tests/setup/check-input.ts`. THR-002; one user
- CheckInputOptions (type exported, 4-4): **inline** to `tests/setup/check-input.ts` `buildCheckInput`. THR-002; a one-use type is written in the one signature that uses it, so no module declares it.
- SwiftBuildInput (type exported, 7-7): **inline** to `tests/setup/check-input.ts` `swiftBuildInput`. THR-002; a one-use type is written in the one signature that uses it, so no module declares it.

## `tests/types/harness/install.ts`

- (the file) (file): **move** to `tests/types/sandbox.ts`. THR-002; TTO-003 deletes the two shared-project types; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- SandboxInstallation (type exported, 5-5): **move** to `tests/types/sandbox.ts` `SandboxSettings`. The level and configurations a sandbox sets (initRepository); installation means the tool folder (glossary); tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- SharedToolProject (type exported, 8-8): **delete**. TTO-003
- SharedToolProjects (type exported, 11-11): **delete**. TTO-003

## `tests/types/harness/npm.ts`

- (the file) (file): **split** to `tests/types/npm.ts; tests/setup/npm-clients.ts`. THR-002; shared types go to tests/types/npm.ts, and the one-use type is written in its signature.
- PackageBytes (type, 6-6): **delete**. Filler: Exclude&lt;Awaited&lt;ReturnType&lt;typeof readFile&gt;&gt;, string&gt; is Buffer, so the two types that use it write Buffer.
- PackageProject (type exported, 9-18): **move** to `tests/types/npm.ts` `NpmClientSandbox`. Glossary: NpmClient and sandbox; the setup and the npm project test use it; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- PackageProjectOptions (type exported, 21-28): **inline** to `tests/setup/npm-clients.ts` `writeNpmClientSandbox`. One user; a one-use type is written in the one signature that uses it, so no module declares it; the runner field goes (INX-003).
- PackageInputs (type exported, 31-38): **move** to `tests/types/npm.ts` `ToolProjectFiles`. The return of readToolProjectFiles, with fields typed Buffer; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.

## `tests/types/harness/policy.ts`

- (the file) (file): **inline** to `tests/setup/settings.ts`. Every type of the file is written in its signature or deleted.
- PolicyOptions (type exported, 5-5): **inline** to `tests/setup/settings.ts` `settingsText`. TGN-044; a one-use type is written in the one signature that uses it, so no module declares it; the signature has no runner option (INX-003) and keeps the ignore option and rules?: boolean.
- ReportingCheck (type exported, 7-7): **delete**. It renames the CLI's command-check type CommandCheck, which reportingCheck returns.
- ReportingCheckOptions (type exported, 9-9): **inline** to `tests/setup/settings.ts` `reportingCheck`. One user; a one-use type is written in the one signature that uses it, so no module declares it: Pick&lt;CommandCheck, 'paths'|'stage'&gt;.

## `tests/types/harness/preservation.ts`

- (the file) (file): **move** to `tests/types/checks.ts`. THR-002; the types beside applyChanges go to tests/types/checks.ts ('samples' is a retired word).
- CaseChanges (type exported, 2-9): **move** to `tests/types/checks.ts` `SampleChanges`. THR names: check sample (case retired); applyChanges takes it; six users, the checks cases test and the sample helpers; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- OriginalFile (type exported, 12-12): **move** to `tests/types/checks.ts` `OriginalFile`. Five helpers of tests/setup/files.ts use it; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.

## `tests/types/harness/process.ts`

- (the file) (file): **move** to `tests/types/processes.ts`. THR-002, THR-020; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file, and the file keeps its topic.
- CapturedProcess (type exported, 2-5): **move** to `tests/types/processes.ts` `CapturedProcess`. THR-020; run-gspot.ts and processes.ts use it; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- CapturedChild (type exported, 8-8): **move** to `tests/types/processes.ts` `CapturedChild`. THR-020; not exported; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- OwnerInterruption (type exported, 11-11): **inline** to `tests/unit/cli/ownership/log.test.ts` `interruptOwnershipWrite`. It goes with interruptOwnershipWrite; owner is retired outside the ownership log; a one-use type is written in the one signature that uses it, so no module declares it.

## `tests/types/harness/python-installation.ts`

- (the file) (file): **inline** to `tests/setup/python.ts`. THR-002
- PythonInstallation (type exported, 3-8): **inline** to `tests/setup/python.ts` `createPythonSandbox`. Glossary: sandbox; a one-use type is written in the one signature that uses it, so no module declares it; its two byte fields are Buffer.
- PythonInstallationOptions (type exported, 11-15): **inline** to `tests/setup/python.ts` `createPythonSandbox`. THR-002; a one-use type is written in the one signature that uses it, so no module declares it; the runner field goes (INX-003).

## `tests/types/harness/quickstart.ts`

- (the file) (file): **inline** to `tests/e2e/quickstart.test.ts`. THR-002; TTO-018; TTO-018
- Quickstart (type exported, 2-2): **inline** to `tests/e2e/quickstart.test.ts` `prepareQuickstart`. One user, prepareQuickstart; a one-use type is written in the one signature that uses it, so no module declares it.

## `tests/types/harness/registry.ts`

- (the file) (file): **split** to `tests/types/e2e.ts; tests/setup/install.ts; tests/integration/python-tool-project.test.ts`. SCR-004: the type cycle with registry.ts goes, and each type moves to its code; with no scripts/npm-registry.ts (SCR-010), the local npm registry types the end-to-end tests install from join the other e2e types in tests/types/e2e.ts.
- RegistryCommand (type exported, 6-6): **delete**. An alias of typeof run; write typeof run at its two users
- RegistryPackage (type exported, 9-16): **move** to `tests/types/e2e.ts` `RegistryPackage`. SCR-004; packPackages and createNpmRegistry take it; the local npm registry types the end-to-end tests install from join the other e2e types in tests/types/e2e.ts.
- PackedRegistryPackage (type exported, 19-19): **move** to `tests/types/e2e.ts` `PackedPackage`. SCR-004: every exported type is hand-written in tests/types/, and packedPackagesSchema is checked against it with satisfies z.ZodType&lt;PackedPackage&gt;; it joins the other packed-registry types in tests/types/e2e.ts.
- PackageRegistry (type exported, 22-22): **move** to `tests/types/e2e.ts` `NpmRegistry`. SCR-004; named for its file; createNpmRegistry returns it and NpmClientSandbox holds it; the local npm registry types the end-to-end tests install from join the other e2e types in tests/types/e2e.ts.
- PythonRegistry (type exported, 25-25): **inline** to `tests/integration/python-tool-project.test.ts` `createPythonIndex`. THR-001: it goes with createPythonIndex; index, not registry; a one-use type is written in the one signature that uses it, so no module declares it.
- InstallationRegistry (type exported, 28-28): **inline** to `tests/setup/install.ts` `createInstallationRegistry`. THR-018; one user; a one-use type is written in the one signature that uses it, so no module declares it.
- PackageRegistryOptions (type exported, 31-31): **inline** to `tests/setup/install.ts` `createNpmRegistry`. SCR-004; one user; a one-use type is written in the one signature that uses it, so no module declares it.

## `tests/types/harness/repository.ts`

- (the file) (file): **move** to `tests/types/sandbox.ts`. THR-024, THR-043; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file; RuntimeEvidenceCase goes.
- RepositorySetup (type, 5-19): **move** to `tests/types/sandbox.ts` `SandboxPlan`. THR names: plan of a sandbox (scenario retired); glossary: sandbox; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- TestRepository (type exported, 22-22): **merge** to `tests/types/sandbox.ts` `Sandbox`. THR-024: one sandbox type, which the Next.js helpers take; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- InProcessScenario (type exported, 25-30): **merge** to `tests/types/sandbox.ts` `SandboxPlan`. THR-024: installs, modules, without and the init never-fields are leftovers; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file; the test data files that annotate their plans with it drop the annotation.
- InstalledScenario (type exported, 33-37): **move** to `tests/types/sandbox.ts` `InstalledSandboxPlan`. THR-024: delete the unused init field and keep without and tools; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- RepositoryScenario (type exported, 40-40): **delete**. THR-024: SandboxPlan covers both plans
- OwnedTestRepository (type exported, 43-43): **move** to `tests/types/sandbox.ts` `Sandbox`. Glossary: sandbox, not test repository; tests/setup/ files hold no module-level types, so the type goes to a tests/types topic file.
- RuntimeEvidenceCase (type exported, 46-57): **delete**. Dead: runtimeDetectionRows builds the rows, its return type is inferred, and nothing else names the type.

## `tests/types/harness/syntax.ts`

- (the file) (file): **inline** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`. THR-041; one user; it follows parseTestSource into the trivial-functions test.
- OwnedSyntaxTree (type exported, 3-3): **inline** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `parseTestSource`. THR-041; one user; a one-use type is written in the one signature that uses it, so no module declares it: Tree & Disposable.

## `tests/types/harness/tooling.ts`

- (the file) (file): **inline** to `tests/setup/manifest.ts`. THR-002
- TestManifest (type exported, 4-8): **inline** to `tests/setup/manifest.ts` `buildManifest`. THR-002; one user, buildManifest; a one-use type is written in the one signature that uses it, so no module declares it.

## `tests/types/packages.ts`

- (the file) (file): **delete**. THR-015: TypeScript infers the two return types
- FormatterConsumer (type exported, 4-4): **delete**. THR-015: TypeScript infers the return type.
- NativeConsumer (type exported, 7-7): **delete**. THR-015: TypeScript infers the return type.
