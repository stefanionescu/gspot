# Tests: the other integration tests

332 rows. move 107, delete 88, keep 66, merge 43, inline 15, split 10, rename 3.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/config/tools/commands/add-remove-configurations.ts`

- (the file) (file): **move** to `tests/config/libraries.ts`. One user (TTO-034): the zod sample joins the library topic file, LINT stays in the test as a single short literal used by one test file, so it stays in the test, and BASH_IN_API goes (TTO-024).
- LINT (const exported, 1-1): **inline** to `tests/integration/library/zod.test.ts` `adding the zod configuration adds its ESLint finding, and removing it drops its plugin`. Its test keeps gspot add and gspot remove; one use, a single short literal used by one test file, so it stays in the test.
- LOOSE (const exported, 3-4): **move** to `tests/config/libraries.ts` `LOOSE_ZOD_SCHEMA`. Used by the test and its prepare function in one file; a multi-line sample source goes to tests/config/ under a plain name.
- BASH_IN_API (const exported, 6-11): **delete**. TTO-024: the scope-removal test goes; the unit remove test already writes the same gspot.toml.

## `tests/config/tools/commands/cancellation.ts`

- (the file) (file): **delete**. THR-020: startCommand in tests/setup/processes.ts sets the pipes and the kill signal; the one-line file goes
- CHILD_OPTIONS (const exported, 1-1): **delete**. THR-020: the hand-written Bun.spawn in the stdin cancellation test becomes startCommand, which owns these options

## `tests/config/tools/commands/doctor.ts`

- (the file) (file): **delete**. THR-009: tool names passed to buildToolsPath change nothing; the one-line file goes
- HOOK_DOCTOR_TOOLS (const exported, 1-1): **delete**. THR-009: the names only fed a guard; toolsPath() takes no names.

## `tests/config/tools/commands/python-quickstart.ts`

- (the file) (file): **merge** to `tests/config/e2e.ts`. TTO-018, TTO-018: the two tutorial tests merge into one e2e test.each, and this data becomes the Python row of TUTORIALS in tests/config/e2e.ts, beside QUICKSTART_COMMANDS.
- INVALID_SOURCE (const exported, 2-2): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: becomes the invalidSource field of the Python row of TUTORIALS in tests/config/e2e.ts.
- INITIALIZE (const exported, 5-5): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: the init argv is written once in the test, and the row keeps only its configuration name.
- PROJECT_COMMANDS (const exported, 8-11): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: becomes the projectCommands field of the Python row of TUTORIALS.

## `tests/config/tools/commands/swift-quickstart.ts`

- (the file) (file): **merge** to `tests/config/e2e.ts`. TTO-018, TTO-018: this data becomes the Swift row of TUTORIALS in tests/config/e2e.ts.
- SOURCE (const exported, 2-2): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: becomes part of the files field of the Swift row of TUTORIALS.
- TESTS (const exported, 3-4): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: becomes part of the files field of the Swift row of TUTORIALS.
- INVALID_SOURCE (const exported, 7-7): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: becomes the invalidSource field of the Swift row of TUTORIALS.
- INITIALIZE (const exported, 10-10): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: the init argv is written once in the test, and the row keeps only its configuration name.
- SOURCE_PATH (const exported, 13-13): **merge** to `tests/config/e2e.ts` `TUTORIALS`. TTO-018: becomes the sourcePath field of the Swift row of TUTORIALS.

## `tests/config/tools/commands/template.ts`

- (the file) (file): **move** to `tests/config/template.ts`. One user (TTO-034); the data goes to tests/config/template.ts.
- TEMPLATE_CUSTOMIZATIONS (const exported, 2-10): **move** to `tests/config/template.ts` `TEMPLATE_CUSTOMIZATIONS`. Used only by the function that prepares the source repository; a gspot.toml sample goes to tests/config/; it writes \[\[command_check\]\] name = "sandbox/pass" with the same command, paths and stage, and \[\[scope\]\] path = "app" configurations = \["bash"\].
- TEMPLATE_IGNORES (const exported, 12-15): **move** to `tests/config/template.ts` `TEMPLATE_IGNORES`. Used only by the function that prepares the source repository; a table goes to tests/config/.

## `tests/config/tools/fixers.ts`

- (the file) (file): **merge** to `tests/config/check.ts`. One user (TTO-034); the fix table joins tests/config/check.ts with the other fix data (FIXER_FEEDBACK_CASES, FIX_REFUSALS); SHFMT_FORMATTED_SCRIPT goes (TTO-022).
- PARTIAL_FIX_CASES (const exported, 4-23): **move** to `tests/config/check.ts` `PARTIAL_FIX_CASES`. The table of its one test.each; it lives in tests/config/check.ts with the other fix data.
- SHFMT_FORMATTED_SCRIPT (const exported, 25-25): **delete**. TTO-022: the merged shfmt test.each checks the fixed text per style row

## `tests/config/tools/generation/ci.ts`

- (the file) (file): **move** to `tests/config/ci.ts`. TTO-005: the tool-free CI script tests join the unit CI test; the data goes to tests/config/ci.ts, NPM_PROGRAM goes (INS-003), and DOCTOR_EXIT_CODES, a single short literal used by one test file, so it stays in the test.
- DOCTOR_EXIT_CODES (const exported, 1-1): **inline** to `tests/unit/cli/generation/ci.test.ts` `the generated mise job runs doctor before checking and keeps doctor exit %s`. The table of its one test.each: \[0, 37\], a single short literal used by one test file, so it stays in the test.
- MISE_PROGRAM (const exported, 3-8): **move** to `tests/config/ci.ts` `MISE_PROGRAM`. A fake program used by both tests of the file; fake program text goes to tests/config/; every generated job runs mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot ..., so the fake mise skips the tool names up to -- before it runs the command, and its trust and install branch goes (INS-003).
- GSPOT_PROGRAM (const exported, 10-17): **move** to `tests/config/ci.ts` `GSPOT_PROGRAM`. A fake program used by both tests of the file; fake program text goes to tests/config/.
- SETUP_CASES (const exported, 19-28): **move** to `tests/config/ci.ts` `SETUP_CASES`. The table of its one test.each, in tests/config/; generated CI always uses mise, so the isMise column and its false rows go (INS-003).
- SETUP_ARGUMENTS (const exported, 30-30): **move** to `tests/config/ci.ts` `SETUP_ARGUMENTS`. Used only by this test; a list goes to tests/config/.
- SETUP_PROGRAM (const exported, 32-38): **move** to `tests/config/ci.ts` `SETUP_PROGRAM`. Used only by this test; fake program text goes to tests/config/.
- NPM_PROGRAM (const exported, 40-42): **delete**. Generated CI always installs with mise, so no job runs npm install --global (INS-003).

## `tests/config/tools/generation/hooks.ts`

- (the file) (file): **move** to `tests/config/hooks.ts`. TTO-005, TTO-009: the hook script tests move to the unit hooks test; the data goes to tests/config/hooks.ts.
- RUNNER_CASES (const exported, 1-5): **move** to `tests/config/hooks.ts` `RUNNER_CASES`. The table of its one test.each plus the top-level row from the CLI hooks test (TTO-009), in tests/config/hooks.ts; with no runner setting and no bare gspot (INX-003, INX-005), each row is a repository shape: a root package.json that lists @gspothq/cli gives npm exec --no -- gspot, and no such package.json gives mise exec -- gspot.
- HOOK_CASES (const exported, 7-11): **move** to `tests/config/hooks.ts` `HOOK_CASES`. Used only by this test; a table goes to tests/config/; the commit-msg row expects gspot check --message-file without --hook (CLX-006).
- HOOK_PROGRAM (const exported, 13-18): **move** to `tests/config/hooks.ts` `HOOK_PROGRAM`. Used only by this test; fake program text goes to tests/config/.

## `tests/config/tools/generation/html-accessibility.ts`

- (the file) (file): **move** to `tests/config/html.ts`. One user (TTO-029); the data goes to tests/config/html.ts.
- HTML_ACCESSIBILITY_PAGE (const exported, 4-15): **move** to `tests/config/html.ts` `AUTOPLAY_PAGE`. Page text; drop the repeated HTML_ACCESSIBILITY prefix; it lives in tests/config/html.ts.
- HTML_ACCESSIBILITY_CORRECTED (const exported, 17-28): **move** to `tests/config/html.ts` `CONTROLLED_PLAYBACK_PAGE`. The page after the fix (glossary: fix, not correction); it lives in tests/config/html.ts.
- HTML_ACCESSIBILITY_SCOPES (const exported, 30-34): **move** to `tests/config/html.ts` `AUTOPLAY_SCOPE_SETTINGS`. Short TOML used once; a multi-line gspot.toml sample goes to tests/config/, with settings in the name (glossary): \[\[scope\]\] path = "app" configurations = \["site"\] with site.build_command = \["node", "build.mjs"\].
- HTML_ACCESSIBILITY_CHECKS (const exported, 36-61): **move** to `tests/config/html.ts` `AUTOPLAY_CHECKS`. TTO-029: the configuration field goes with the --print-config step; written as const without the HtmlAccessibilityCheck annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/generation/parameter-limits.ts`

- (the file) (file): **merge** to `tests/config/structure.ts`. One user; the test checks the structure limit limits.function_parameters, so the data joins tests/config/structure.ts.
- PARAMETER_CASES (const exported, 2-71): **move** to `tests/config/structure.ts` `PARAMETER_LIMIT_TOOLS`. One row per tool that counts parameters (glossary: no "cases"), in tests/config/structure.ts; the command column goes, since the test runs through gspot check (TTC-014).

## `tests/config/tools/generation/platform-security.ts`

- (the file) (file): **split** to `tests/config/cloudflare.ts; tests/config/supabase.ts`. TTO-006, one file per configuration: each row becomes the path-rule test of its own configuration, the Cloudflare row in the Cloudflare topic file and the Supabase row in the Supabase topic file.
- PLATFORM_PATH_CASES (const exported, 2-51): **split** to `tests/config/cloudflare.ts; tests/config/supabase.ts` `CLOUDFLARE_PATH_RULES; SUPABASE_PATH_RULES`. TTO-006: each row is a named item of its topic file; the records are \[\[scope\]\] path = "api" and path = "sibling", the api scope writes supabase.functions_folder = "api/custom" from the repository root (CFR-003), and removed_configurations stays a \[\[scope\]\] key written by hand (CLX-003).

## `tests/config/tools/generation/security.ts`

- (the file) (file): **inline** to `tests/integration/platform/supabase.test.ts`. Its Express and JWT data goes with the deleted security test, and every surviving Supabase item is a single short literal used by one test file, so it stays in the test.
- SECURITY_SOURCE (const exported, 2-9): **delete**. Dead: used only by the deleted security test, a duplicate.
- SECURITY_CORRECTION (const exported, 12-16): **delete**. Dead: used only by the deleted security test, a duplicate.
- SECURITY_FILES (const exported, 18-26): **delete**. Dead: used only by the deleted security test, a duplicate.
- SECURITY_SCOPE_POLICY (const exported, 28-32): **delete**. Dead: used only by the deleted security test, a duplicate.
- SECURITY_FINDINGS (const exported, 34-42): **delete**. Dead: used only by the deleted security test, a duplicate.
- SUPABASE_SOURCE (const exported, 44-44): **inline** to `tests/integration/platform/supabase.test.ts` `%s manual Supabase selection reports Deno secret logs in root and child scopes`. Used only by this test; a single short literal used by one test file, so it stays in the test.
- SUPABASE_CORRECTION (const exported, 45-45): **inline** to `tests/integration/platform/supabase.test.ts` `%s manual Supabase selection reports Deno secret logs in root and child scopes`. Used only by this test; a single short literal used by one test file, so it stays in the test.
- SUPABASE_SCOPE_POLICY (const exported, 46-46): **inline** to `tests/integration/platform/supabase.test.ts` `%s manual Supabase selection reports Deno secret logs in root and child scopes`. Used only by this test; a single short literal used by one test file, so it stays in the test; the scope is \[\[scope\]\] path = "child".
- SUPABASE_SOURCE_PATHS (const exported, 47-47): **inline** to `tests/integration/platform/supabase.test.ts` `%s manual Supabase selection reports Deno secret logs in root and child scopes`. Used only by this test; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/generation/semgrep.ts`

- (the file) (file): **split** to `tests/config/express.ts; tests/config/python/checks.ts; tests/config/security.ts; tests/config/execution.ts`. Each constant goes to its topic file (TTO-006, TTO-031): the Express samples to express.ts, the FastAPI source to python/checks.ts, the security-pack samples to security.ts, SEMGREP_CHECK to execution.ts.
- APP_SEMGREP (const exported, 1-2): **move** to `tests/config/express.ts` `EXPRESS_SCOPE_SETTINGS`. The gspot.toml text of the Express scope test: records app (configurations = \["express"\]), app/child and sibling, with the \[\[ignore\]\] at the root (CFR-004).
- FRAMEWORK_FILES (const exported, 5-14): **move** to `tests/config/express.ts` `EXPRESS_SCOPE_FILES`. The Express scope samples, in tests/config/express.ts; the JWT lines do not join, since the security test is deleted.
- SWIFT_SAMPLE (const exported, 17-20): **move** to `tests/config/security.ts` `SWIFT_SAMPLE`. Used only by the level test of the Semgrep security tests; it lives in tests/config/security.ts.
- BASH_DOWNLOAD_SAMPLE (const exported, 23-33): **move** to `tests/config/security.ts` `BASH_DOWNLOAD_SAMPLE`. Used only by the level test of the Semgrep security tests; it lives in tests/config/security.ts.
- EXPRESS_SOURCE_CASES (const exported, 36-45): **move** to `tests/config/express.ts` `EXPRESS_SOURCES`. The Express source files (glossary: no "cases"); they live in tests/config/express.ts.
- EXPRESS_SOURCE_FINDINGS (const exported, 47-52): **move** to `tests/config/express.ts` `EXPRESS_SOURCE_FINDINGS`. Used only by the Express source test; it lives in tests/config/express.ts.
- FRAMEWORK_FINDINGS (const exported, 55-58): **move** to `tests/config/express.ts` `EXPRESS_SCOPE_FINDINGS`. The name says which test it belongs to; it lives in tests/config/express.ts.
- FASTAPI_SOURCE (const exported, 61-68): **move** to `tests/config/python/checks.ts` `FASTAPI_SOURCE`. Used only by the FastAPI test; one Python sample, so it joins tests/config/python/checks.ts, not a one-item fastapi.ts.
- SEMGREP_PROJECT_FILES (const exported, 71-80): **move** to `tests/config/security.ts` `SEMGREP_PROJECT_FILES`. Used by the validate and platform-pack tests, and the FastAPI test writes its own pyproject.toml line; it lives in tests/config/security.ts.
- PLATFORM_SOURCE_CASES (const exported, 83-109): **move** to `tests/config/security.ts` `PLATFORM_SOURCES`. Source files of the platform-pack test (glossary: no "cases"); they live in tests/config/security.ts.
- PLATFORM_SOURCE_FINDINGS (const exported, 111-119): **move** to `tests/config/security.ts` `PLATFORM_SOURCE_FINDINGS`. Used only by the platform-pack test; it lives in tests/config/security.ts.
- PLATFORM_ALL_SOURCE_FINDINGS (const exported, 122-125): **move** to `tests/config/security.ts` `PLATFORM_ALL_SOURCE_FINDINGS`. Used only by the platform-pack test; it lives in tests/config/security.ts.
- PLATFORM_ALL_SOURCE_CORRECTIONS (const exported, 127-130): **move** to `tests/config/security.ts` `PLATFORM_ALL_SOURCE_FIXES`. Glossary: fix, not correction; it lives in tests/config/security.ts.
- PLATFORM_SOURCE_CORRECTIONS (const exported, 132-143): **move** to `tests/config/security.ts` `PLATFORM_SOURCE_FIXES`. Glossary: fix, not correction; it lives in tests/config/security.ts.
- SECURITY_CLEAN (const exported, 145-145): **move** to `tests/config/security.ts` `OWN_RULE_SOURCE`. A three-line source used once; it goes to tests/config/ under a name that says it is the source the own rule reports.
- OWN_RULE (const exported, 147-148): **move** to `tests/config/security.ts` `OWN_RULE`. The repository rule file of the own-rules test; it lives in tests/config/security.ts.
- BEARER_FILES (const exported, 151-154): **delete**. The test writes these Bearer files and never checks them; they change no result
- SEMGREP_COMMAND (const exported, 157-157): **move** to `tests/config/execution.ts` `SEMGREP_CHECK`. TTO-031: shared by the Semgrep tests in several configuration files, under a plain name; it lives with the check records of the execution tests in tests/config/execution.ts.

## `tests/config/tools/generation/site-html.ts`

- (the file) (file): **merge** to `tests/config/site.ts`. TTO-029: the site data goes to tests/config/site.ts, and the build script is shared with the HTML test.
- SITE_HTML_PAGE (const exported, 2-12): **move** to `tests/config/site.ts` `MISSING_ALT_PAGE`. Page text named for what is wrong with it; it lives in tests/config/site.ts.
- SITE_HTML_CORRECTED (const exported, 13-23): **move** to `tests/config/site.ts` `ALT_TEXT_PAGE`. The page after the fix (glossary: fix, not correction); it lives in tests/config/site.ts.
- SITE_HTML_BUILD (const exported, 25-28): **move** to `tests/config/site.ts` `COPY_PAGE_BUILD`. TTO-029: used by the HTML and site tests, so it joins the other site build script
- SITE_HTML_SCOPES (const exported, 30-43): **move** to `tests/config/site.ts` `TWO_SITE_SCOPES`. gspot.toml text with two site scopes and one ignore: records app and other, each with site.build_command = \["node", "build.mjs"\].
- SITE_HTML_RULE_SCOPES (const exported, 45-48): **delete**. TTO-029: only the deleted --print-config loop reads it
- SITE_HTML_REPOSITORIES (const exported, 50-53): **move** to `tests/config/site.ts` `BUILT_HTML_SITES`. The table of its one test loop; a table goes to tests/config/, named for its rows, a root site and a scope site.

## `tests/config/tools/lifecycle/hooks.ts`

- (the file) (file): **merge** to `tests/config/hooks.ts`. Each constant has one test (TTO-034); the data goes to tests/config/hooks.ts.
- SAMPLE_COMMAND (const exported, 1-2): **move** to `tests/config/hooks.ts` `SAMPLE_COMMAND`. A one-line command-check script used once; it goes to tests/config/hooks.ts.
- INDEX_COMMAND (const exported, 4-5): **move** to `tests/config/hooks.ts` `INDEX_COMMAND`. A one-line command-check script used once; it goes to tests/config/hooks.ts.

## `tests/config/tools/lifecycle/installer-failures.ts`

- (the file) (file): **move** to `tests/config/tools.ts`. init never installs, so its test file becomes install.test.ts (TTO-007); the version field goes (INS-001), so the file imports nothing from the CLI, and its one item sits with the tool data in tests/config/tools.ts.
- INSTALLATION_FAILURES (const exported, 4-20): **move** to `tests/config/tools.ts` `MISE_FAILURES`. The table of its one test.each, which runs gspot install after init, named for the failures; the outdated row and the version field go (INS-001), and the fake mise output writes a literal version; when mise is missing, gspot install prints "Install mise, or install these programs yourself: ..." and exits 0, and the download-failed row fails on mise install in .gspot/ and prints mise's output (INX-006, GEN-030).

## `tests/config/tools/lifecycle/python-project.ts`

- (the file) (file): **merge** to `tests/config/python/tool-project.ts`. One user; the uv tool project data goes to tests/config/python/tool-project.ts.
- PYTHON_PROJECTS (const exported, 1-5): **move** to `tests/config/python/tool-project.ts` `PYTHON_PROJECTS`. The table of its one test.each, in tests/config/; uv always comes from .gspot/mise.toml through mise bin-paths, so there is no runner column and the rows are the index files uv.toml and pyproject.toml (INX-003, INX-006).
- PYTHON_INSTALL_STEPS (const exported, 7-18): **move** to `tests/config/python/tool-project.ts` `PYTHON_INSTALL_STEPS`. Used only by this test; one step list with no runner key: mise trust .gspot/mise.toml and mise install &lt;program tools&gt; run in .gspot/, then the uv steps, with the venv step as LIF-001 decides (INX-001, INX-006).

## `tests/config/tools/lifecycle/shared-tools.ts`

- (the file) (file): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).
- PROJECT_FILES (const exported, 2-9): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).
- SCOPE (const exported, 11-11): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).
- CHECKS (const exported, 14-14): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).
- CORRECTED (const exported, 16-16): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).
- INVALID_CSS (const exported, 19-19): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).
- CLEAN_CSS (const exported, 20-20): **delete**. Used only by the deleted shared-tools tests of the test-only cache (TTO-002).

## `tests/tools/commands/add-remove-configurations.test.ts`

- (the file) (file): **merge** to `tests/integration/library/zod.test.ts`. One file per configuration: the zod test joins the zod configuration file, and the scope test merges into the unit remove test (TTO-024).
- adding an ESLint fragment exposes its finding on the next explicit check, and removing it drops its plugin (test (test), 33-60): **keep** to `tests/integration/library/zod.test.ts` `adding the zod configuration adds its ESLint finding, and removing it drops its plugin`. Real behavior; gspot add zod and gspot remove zod stay; TTO-043: no named tools; TTO-003: a real gspot install.
- removing a configuration from a scope deletes the outputs only it needed (test (test), 62-76): **merge** to `tests/unit/cli/commands/remove.test.ts` `remove applies gspot.toml and installs no npm tools`. gspot remove stays and needs no tool (TTO-005, TTO-024): add the shellcheckrc exists and deleted assertions to the remove bash --scope api test; the parsed gspot.toml holds scope = \[{ path = "api", configurations = \[\], removed_configurations = \["bash"\] }\], since remove writes removed_configurations (CLX-003).
- prepareProject (function, 19-31): **move** to `tests/integration/library/zod.test.ts` `prepareLooseSchemaProject`. Helper of the zod test, named for what it prepares. Values to config: ZOD_PROJECT_FILES = .gitignore, package.json, tsconfig.json and schema.ts as the helper writes them -&gt; tests/config/libraries.ts

## `tests/tools/commands/cancellation.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/check/command/cancellation.test.ts`. Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there; TTO-005: it uses only git and bash -n (TTO-039, THR-020).
- staged cancellation during %s preserves source content and permits retry (test (test.skipIf), 53-104): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `staged cancellation during %s preserves source content and permits retry`. Real behavior; Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there; on a stop, clone (SIGINT) exits 130 and diff and cat-file (SIGTERM) exit 143 (CMD-063), with the two codes from tests/config.
- \['diff', 'clone', 'cat-file'\] as const (test (test.skipIf), 53-53): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `['diff', 'clone', 'cat-file'] as const`. The each table of the test above; Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there.
- !isPosix (test (test.skipIf), 53-53): **rename** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `isWindows`. Signals need POSIX, so the gate stays, spelled with the one isWindows constant (TTO-019).
- push cancellation retains completed reports and names references not checked (test (test.skipIf), 106-143): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `push cancellation retains completed reports and names references not checked`. Real behavior; Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there; the push is stopped with SIGINT and exits 130 (CMD-063), with the code from tests/config.
- !isPosix (test (test.skipIf), 106-106): **rename** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `isWindows`. Signals need POSIX, so the gate stays, spelled with the one isWindows constant (TTO-019).
- push cancellation while stdin remains open handles %s and permits retry (test (test.skipIf), 145-205): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `push cancellation while stdin remains open handles %s and permits retry`. Real behavior; Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there; THR-020: the hand-written spawn becomes startCommand; the SIGINT row expects 130 and the SIGTERM row 143 (CMD-063).
- \['SIGINT', 'SIGTERM'\] as const (test (test.skipIf), 145-145): **keep** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `['SIGINT', 'SIGTERM'] as const`. The each table of the test above; Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there.
- !isPosix (test (test.skipIf), 145-145): **rename** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `isWindows`. Signals need POSIX, so the gate stays, spelled with the one isWindows constant (TTO-019).
- waitForJson (function, 19-29): **delete**. TTO-039: the fake writes its marker by rename, so waitForFile and one read replace this second polling loop
- fakeGit (function, 32-51): **move** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `fakeGit`. Ctrl-C handling is in commands/check/command.ts (runCancelable), so the test joins the unit cancellation test there; TTO-039: built with fakeTool, which also writes the Windows wrapper.

## `tests/tools/commands/ci.test.ts`

- (the file) (file): **move** to `tests/integration/ci.test.ts`. Runs the generated CI job with gspot and installed tools; a flow, not one configuration. TTO-026, TTO-003, INS-003
- generated jobs check changed objects and accept corrected source in %s CI (test (test.each), 126-148): **keep** to `tests/integration/ci.test.ts` `generated jobs check changed files and pass after the fix in %s CI`. Real behavior; TTO-026 deletes the property check at line 139; glossary (fix)
- \['gitlab', 'github'\] as const (test (test.each), 126-126): **keep** to `tests/integration/ci.test.ts` `['gitlab', 'github'] as const`. The each table of the test above.
- invalid comparisons and failed installs fail the job in %s CI (test (test.each), 150-172): **keep** to `tests/integration/ci.test.ts` `invalid comparisons and failed installs fail the job in %s CI`. Real behavior; the failed install is the job line mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot install, which the fake mise fails (INS-003).
- \['gitlab', 'github'\] as const (test (test.each), 150-150): **keep** to `tests/integration/ci.test.ts` `['gitlab', 'github'] as const`. The each table of the test above.
- full-tree selection preserves authored jobs and rejects an invalid run setting in %s CI (test (test.each), 174-200): **delete**. ci.files is deleted (TML-002): CI checks what changed, and every file when gspot.toml or .gspot/ changed, so the full-tree job this test sets up does not exist; your own CI file staying is covered by the unit init CI test.
- \['gitlab', 'github'\] as const (test (test.each), 174-174): **delete**. Table of the deleted test above (TML-002).
- commitCiSource (function, 17-21): **move** to `tests/integration/ci.test.ts` `commitCiSource`. Used four times; the file moves
- prepareCiProject (function, 24-66): **move** to `tests/integration/ci.test.ts` `prepareCiProject`. TTO-026: delete the PATH check; a real gspot install replaces shareToolProjects (TTO-003); the settings write \[ci\] enabled = true (github is the default provider, GitLab writes provider = "gitlab", TML-015), \[rules\] (TML-003) and \[\[command_check\]\] records with name and output = { format = "lines" }; the bash -n command is built from process.execPath at run time. Values to config: GITLAB_PIPELINE = 'stages: \[test\]\\napplication:\\n script: echo authored-job\\n' -&gt; tests/config/ci.ts; GITHUB_PIPELINE = 'on: push\\njobs:\\n application: ...' -&gt; tests/config/ci.ts; CI_SETTINGS = the gspot.toml with the project/syntax and project/audit command checks -&gt; tests/config/ci.ts
- createCiInstall (function, 69-98): **move** to `tests/integration/ci.test.ts` `createCiInstall`. TTO-026: return refuse alone; the job installs gspot with mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot install, so the fake is a mise on the job PATH whose exec runs the source CLI and whose refuse makes that line fail like an npm 404; the fake npm install --global and its launcher go (INS-003, INX-005).
- runCiJob (function, 101-124): **move** to `tests/integration/ci.test.ts` `runCiJob`. Used by all three tests; the file moves

## `tests/tools/commands/commit-hook.test.ts`

- (the file) (file): **merge** to `tests/integration/hooks.test.ts`. A hooks flow with installed tools; joins the hooks topic file
- installed and freshly cloned repositories enforce staged findings through real commits (test (test), 44-66): **keep** to `tests/integration/hooks.test.ts` `installed and freshly cloned repositories enforce staged findings through real commits`. Real behavior; THR-009: no tool names for the PATH; init takes no hooks option (CLX-001), and the hooks start gspot with mise exec -- gspot, so the hook PATH holds mise and the gspot command of the integration preload (INX-003, SCR-002).
- expectCloneHooks (function, 12-42): **move** to `tests/integration/hooks.test.ts` `expectCloneHooks`. Helper of the test above; the file moves.

## `tests/tools/commands/copies.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/check/tree/staged.test.ts`. --staged narrowing is in commands/check/tree.ts, so the test joins the other staged tests in tree/staged.test.ts; TTO-005: it uses only git and bash -n; TTO-038: "copies" means staged checks; skip when bash is not on PATH.
- staged checks use index bytes and policy on an unborn branch while preserving unstaged edits (test (test), 14-46): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `staged checks use the index bytes and gspot.toml on an unborn branch and keep unstaged edits`. Real behavior; --staged narrowing is in commands/check/tree.ts, so the test joins the other staged tests in tree/staged.test.ts; glossary: gspot.toml, not policy.
- staged checks read an indexed file when its working file is missing (test (test), 48-62): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `staged checks read an indexed file when its working file is missing`. Real behavior; --staged narrowing is in commands/check/tree.ts, so the test joins the other staged tests in tree/staged.test.ts.
- staged checks validate the index version pin instead of the working pin (test (test), 64-83): **keep** to `tests/unit/cli/commands/check/tree/staged.test.ts` `staged checks validate the index version pin instead of the working pin`. Real behavior; --staged narrowing is in commands/check/tree.ts, so the test joins the other staged tests in tree/staged.test.ts.
- { version: RUNNING_VERSION } (const, 12-12): **delete**. Duplicate: the CLI exports this value (RUNNING_VERSION, named GSPOT_VERSION, in packages/cli/src/config/platform/runtime.ts), so the test imports it in place of reading #cli-package a second time.

## `tests/tools/commands/doctor.test.ts`

- (the file) (file): **merge** to `tests/integration/hooks.test.ts`. Doctor reports the hook state after a real install; joins the hooks topic file
- doctor fails hooks this clone does not run and accepts them once installed (test (test), 10-28): **keep** to `tests/integration/hooks.test.ts` `doctor reports hooks this clone has not installed and accepts them after install`. Real behavior; THR-009: no tool names; glossary: system, not host, as the doctor state.

## `tests/tools/commands/example.test.ts`

- (the file) (file): **move** to `tests/integration/homepage-example.test.ts`. TTO-038: the name says which example; TTO-030; TTO-003: a real gspot install replaces shareToolProjects
- the recorded example reports the agent findings and passes after the fix (test (test), 62-103): **keep** to `tests/integration/homepage-example.test.ts` `the recorded example reports the agent findings and passes after the fix`. Real behavior.
- recorded (function, 18-29): **move** to `tests/integration/homepage-example.test.ts` `sortedFindings`. The name says what it returns: the compared fields of each finding, sorted
- expectedTranscript (function, 32-60): **move** to `tests/integration/homepage-example.test.ts` `dropOperatingSystemSkips`. TTO-030: remove the rows the plan skips for the operating system from both sides; compare totals from the JSON report; the row moving and total rewriting go

## `tests/tools/commands/nested-scopes.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/scopes.test.ts`. The deepest scope of a file is scopeOf in repository/scopes.ts, so the test joins that file's tests (about 270 lines); TTO-005: it uses only bash -n; TTO-023; skip when bash is not on PATH.
- nested scopes inherit parent configurations and settings and check each file in its deepest scope (test (test), 7-33): **keep** to `tests/unit/cli/repository/scopes.test.ts` `each file is checked once, in its deepest scope`. The deepest scope of a file is scopeOf in repository/scopes.ts; TTO-023: the settings-list half repeats the list command test and goes.

## `tests/tools/commands/pre-push.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/commands/check/push.test.ts`. checkPush is in commands/check/push.ts, so the test joins the unit pre-push test, under 300 lines; TTO-005: it uses only git and bash -n; skip when bash is not on PATH.
- new references compare with remote-tracking commits and scan custom destinations conservatively (test (test), 20-43): **keep** to `tests/unit/cli/commands/check/push.test.ts` `new references compare with remote-tracking commits and scan custom destinations conservatively`. checkPush is in commands/check/push.ts, so the test joins the unit pre-push test; TTO-025: delete the harness stdin check lines.
- fetch mapping selectors do not override the native remote-tracking namespace (test (test), 45-61): **keep** to `tests/unit/cli/commands/check/push.test.ts` `fetch mapping selectors do not override the remote-tracking namespace`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test; TTC-032: no "native".
- new references without fetched comparison objects check the full tree (test (test), 63-81): **keep** to `tests/unit/cli/commands/check/push.test.ts` `new references without fetched comparison objects check the full tree`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test.
- annotated commits resolve while blob tags, blobs, and deleted refs remain skipped (test (test), 83-108): **keep** to `tests/unit/cli/commands/check/push.test.ts` `an annotated tag of a commit is checked while blob tags, blobs, and deleted refs are skipped`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test.
- pre-push checks exact supplied objects despite conflicting working-tree repairs (test (test), 110-141): **keep** to `tests/unit/cli/commands/check/push.test.ts` `pre-push checks exact supplied objects despite conflicting working-tree repairs`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test.
- pre-push text supplies an executable reproduction of the same committed findings (test (test), 143-173): **keep** to `tests/unit/cli/commands/check/push.test.ts` `pre-push text supplies an executable reproduction of the same committed findings`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test.
- pre-push reports multiple objects once per object and handles forced rewinds (test (test), 175-223): **keep** to `tests/unit/cli/commands/check/push.test.ts` `pre-push reports multiple objects once per object and handles forced rewinds`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test.
- full-tree pre-push policy checks unchanged files in the pushed object (test (test), 225-257): **keep** to `tests/unit/cli/commands/check/push.test.ts` `a push that changes gspot.toml checks every file, also files the push did not touch`. Real behavior; checkPush is in commands/check/push.ts, so the test joins the unit pre-push test; hooks.push_files is deleted (TML-002), so the gspot set hooks.push_files all step goes; the pushed commit changes gspot.toml together with changed.sh, so the pre-push check still reports legacy.sh, since a change to gspot.toml or .gspot/ checks every file: this is the test of the TML-002 fix.
- expectWorkingTreeKept (function, 14-18): **move** to `tests/unit/cli/commands/check/push.test.ts` `expectWorkingTreeKept`. checkPush is in commands/check/push.ts, so the test joins the unit pre-push test; used by seven tests.

## `tests/tools/commands/python-quickstart.test.ts`

- (the file) (file): **move** to `tests/e2e/quickstart.test.ts`. TTO-018: runs the packed CLI installed through mise, as a user does; TTO-018: one test for both tutorials
- the Python tutorial reports its finding through the installed hook and passes after the fix (test (test), 15-65): **keep** to `tests/e2e/quickstart.test.ts` `the $name tutorial reports its finding through the installed hook and passes after the fix`. TTO-018: one test.each over the Python and Swift rows; gspot install runs mise itself in .gspot/, so the first two setup commands (mise trust .mise/conf.d/gspot-tools.toml, mise install) go (INX-001, INX-006); the tutorial pins gspot with mise use node@24 npm:@gspothq/cli@&lt;version&gt;, commits mise.toml and runs mise exec -- gspot init (INX-002, INX-005).

## `tests/tools/commands/swift-quickstart.test.ts`

- (the file) (file): **merge** to `tests/e2e/quickstart.test.ts`. TTO-018: the same steps as the Python tutorial
- the Swift tutorial reports its finding through the installed hook and passes after the fix (test (test.skipIf), 23-79): **merge** to `tests/e2e/quickstart.test.ts` `the $name tutorial reports its finding through the installed hook and passes after the fix`. TTO-018: becomes the Swift row of the test.each, with the same setup as the Python row (INX-001, INX-002, INX-005, INX-006).
- !isMacos (test (test.skipIf), 23-23): **merge** to `tests/e2e/quickstart.test.ts` `the $name tutorial reports its finding through the installed hook and passes after the fix`. TTO-018; TTO-019: the Swift row is gated by hasToolBuild('swiftlint') and swift on PATH, not by macOS

## `tests/tools/commands/template.test.ts`

- (the file) (file): **move** to `tests/integration/template.test.ts`. Export and init --from with installed tools; a flow, not one configuration. TTO-027
- exported templates (describe (describe), 129-142): **delete**. TTO-027: one test runs the three steps in order, so no describe around it
- exported templates &gt; init installs the source root policy with provenance and no source scopes (test (test), 136-136): **keep** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: the three order-dependent tests become one test
- exported templates &gt; re-export retains the customizations and native Taplo reports no formatting findings (test (test), 137-137): **merge** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: second step of the one test
- exported templates &gt; a pathless ignore covers unused variables while a path ignore excludes its neighbor (test (test), 138-141): **merge** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: third step of the one test
- TOOLS (const, 15-15): **inline** to `tests/integration/template.test.ts` `an exported template sets up another repository`. THR-009: toolsPath() takes no names; computed at load time, so the PATH value stays a local of the one test.
- first (const, 17-17): **inline** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: an await using testdir inside the one test, not module state
- second (const, 19-19): **inline** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: an await using testdir inside the one test, not module state
- prepareSource (function, 21-55): **move** to `tests/integration/template.test.ts` `exportTemplate`. TTO-027: takes the source path and is named for what it does; it runs gspot set rules.instruction_files AGENT_NOTES.md with items as plain values (TML-003, CLX-013), init takes no rule flag since rules are on by default (CLX-001), and the export note names the scope record. Values to config: TEMPLATE_FILE = 'house.template.toml' -&gt; tests/config/template.ts
- prepareDestination (function, 57-73): **move** to `tests/integration/template.test.ts` `initFromTemplate`. TTO-027: named for what it does; no --no-install (CMD-092); with no template or selection key, init always adds the detected typescript and the plan names the template file, so the two output assertions ("template house", "detected, not in the template: typescript") follow the plan text (TML-011). Values to config: TEMPLATE_FILE -&gt; tests/config/template.ts; DESTINATION_FILES = { tools/b.sh, scripts/a.sh, index.ts, .shellcheckrc } -&gt; tests/config/template.ts
- checkRootPolicy (function, 75-88): **inline** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: one caller, the one test; the provenance comment names the template file (# Copied from template house.template.toml, sha256 ...), and the source scope is a \[\[scope\]\] list, \[{ path = "app", configurations = \["bash"\] }\] (TML-011).
- checkReExport (function, 90-110): **inline** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: one caller, the one test
- checkIgnoreApplicability (function, 112-127): **inline** to `tests/integration/template.test.ts` `an exported template sets up another repository`. TTO-027: one caller, the one test

## `tests/tools/execution/acronyms.test.ts`

- (the file) (file): **delete**. Its one test is deleted as weak.
- native acronym checks honor emitted accepted words and retain unknown-word and definition coverage (test (test), 10-55): **delete**. Weak: it writes its own .vale.ini and runs vale by hand, so gspot's Vale setup never runs (TTO-028).

## `tests/tools/execution/fixers.test.ts`

- (the file) (file): **split** to `tests/integration/fix.test.ts; tests/integration/language/bash/syntax.test.ts`. The --fix flow goes to the fix topic file, and the shfmt syntax-error test, a bash configuration test, to the bash syntax file (TTO-021, TTO-022).
- SQLFluff write failures remain execution errors when its exit code also means findings (test (test.skipIf), 33-58): **move** to `tests/integration/fix.test.ts` `SQLFluff write failures remain execution errors when its exit code also means findings`. Real behavior; the gate stays; it calls installToolProjects (tests/setup/install.ts).
- process.platform === 'win32' || process.getuid?.() === 0 (test (test.skipIf), 33-33): **move** to `tests/integration/fix.test.ts` `isWindows || process.getuid?.() === 0`. TTO-019: a needed skip, spelled with the isWindows constant, not a raw process.platform check.
- $check fixes findings and reports an unchanged repeated fix until manual correction (test (test.each), 60-88): **move** to `tests/integration/fix.test.ts` `$check fixes findings, reports an unchanged second fix, and passes after a manual fix`. Real behavior; TTO-021: skips: \[\] goes; glossary: fix, not correction; it calls installToolProjects, and the sandbox gspot.toml has no runner = "mise" line (INX-003).
- PARTIAL_FIX_CASES (test (test.each), 60-60): **move** to `tests/integration/fix.test.ts` `PARTIAL_FIX_CASES`. The each table of the test above; it lives in tests/config/check.ts, and the test.each imports PARTIAL_FIX_CASES.
- shfmt reports and fixes ordinary shell formatting (test (test), 90-108): **merge** to `tests/integration/fix.test.ts` `shfmt reports, then fixes, script formatting in the %s style`. TTO-022: the same 4-space fix as the space row; its default-style row and failing first run join the merged test
- shfmt fixes shell indentation using the configured %s style (test (test.each), 110-125): **move** to `tests/integration/fix.test.ts` `shfmt reports, then fixes, script formatting in the %s style`. TTO-022: first expects exit 1 without --fix, then fixes, then passes
- \['space', 'tab'\] (test (test.each), 110-110): **move** to `tests/integration/fix.test.ts` `['default', 'space', 'tab']`. TTO-022: one row without a \[format\] table proves the default style
- shfmt reports a syntax error as a source finding and accepts the repaired script with a space in its name (test (test), 127-143): **move** to `tests/integration/language/bash/syntax.test.ts` `shfmt reports a syntax error as a finding and passes after the script is repaired`. A bash configuration test with no --fix; one file per configuration.
- prepareFixer (function, 19-30): **delete**. After TTO-021 and TTO-003 the helper is apply plus install, so both callers call installToolProjects from tests/setup/install.ts.

## `tests/tools/execution/python-staged.test.ts`

- (the file) (file): **merge** to `tests/integration/language/python/staged.test.ts`. Tests the python configuration with its installed tools: a staged Ruff run from the installed environment, in its own file since ruff.test.ts is about 300 lines.
- a staged Python finding is reported by Ruff from the installed environment while the working tree differs (test (test.skipIf), 19-59): **keep** to `tests/integration/language/python/staged.test.ts` `a staged Python finding is reported by Ruff from the installed environment while the working tree differs`. Real behavior; preparePythonInstallation takes no runner option (INX-003), and installTools takes no refreshLockfiles option, since install --refresh-lockfiles is deleted (CMD-015).
- !isPosix (test (test.skipIf), 19-19): **delete**. The test already uses environmentExecutable; delete the skip and the comment above it.

## `tests/tools/generation/ci.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/ci.test.ts`. TTO-005: fake mise, gspot and setup programs, no tool, so it joins the unit CI test; skip when bash is not on PATH.
- the generated mise job runs doctor before checking and preserves doctor exit %s (test (test.each), 22-48): **keep** to `tests/unit/cli/generation/ci.test.ts` `the generated mise job runs doctor before checking and keeps doctor exit %s`. Real behavior.
- DOCTOR_EXIT_CODES (test (test.each), 22-22): **keep** to `tests/unit/cli/generation/ci.test.ts` `[0, 37]`. The each table of the test above, written inline: \[0, 37\].
- the %s job with mise %s preserves setup exit %s and literal arguments before gspot (test (test.each), 50-93): **keep** to `tests/unit/cli/generation/ci.test.ts` `the %s job keeps setup exit %s and literal arguments before gspot`. Every generated job uses mise, so the mise column goes (INS-003).
- SETUP_CASES (test (test.each), 50-50): **keep** to `tests/unit/cli/generation/ci.test.ts` `SETUP_CASES`. The each table of the test above, without the non-mise rows; the rows live in tests/config/ci.ts, and the test.each imports SETUP_CASES.

## `tests/tools/generation/hooks.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/hooks.test.ts`. TTO-005, TTO-009: sh and fake programs only; the CLI hooks test joins it as a RUNNER_CASES row.
- the hook scripts under the %s runner run one check with the selected runner and repository inputs (test (test.each), 16-48): **keep** to `tests/unit/cli/generation/hooks.test.ts` `each hook script under the %s runner runs one check through that runner`. Real behavior; plain title; the commit-msg script runs gspot check --message-file "$1" without --hook (CLX-006); with no runner setting, each row writes the repository shape of RUNNER_CASES (a root package.json that lists @gspothq/cli, or none), the fake bare gspot goes (INX-003, INX-005), and the agentRules option of buildPolicy writes \[rules\] (TML-003).
- RUNNER_CASES (test (test.each), 16-16): **keep** to `tests/unit/cli/generation/hooks.test.ts` `RUNNER_CASES`. The each table of the test above, from tests/config/hooks.ts: a package.json pin (npm exec --no -- gspot), no pin (mise exec -- gspot) and the top-level row (INX-003, INX-005).
- a hook explains how to acquire a missing Mise runner (test (test.skipIf), 50-65): **keep** to `tests/unit/cli/generation/hooks.test.ts` `a hook says how to install mise when mise is missing`. Real behavior; the sandbox has no package.json pin, so the hook starts gspot with mise exec -- gspot and prints the missing-mise line when mise is not on PATH (INX-003).
- !isPosix (test (test.skipIf), 50-50): **delete**. TTO-009: find sh with Bun.which and set PATH to an empty folder, so the test runs on Windows too

## `tests/tools/generation/html-accessibility.test.ts`

- (the file) (file): **move** to `tests/integration/language/html.test.ts`. One file per configuration: tests the html configuration's no-autoplay rule on source and built pages. TTO-029
- '%s ${entry.check} reports audio and video autoplay and accepts user-controlled playback' (test (test.each), 22-72): **keep** to `tests/integration/language/html.test.ts` ``${entry.check} reports audio and video autoplay and accepts user-controlled playback``. Real behavior; the level loop goes as weak, so the title has no level; TTO-029: delete the --print-config step, since the finding and its absence after the fix prove the setting.
- \['recommended', 'all'\] as const (test (test.each), 22-22): **delete**. Weak: a level loop that changes nothing, since both levels expect the same two no-autoplay findings; the test runs once.

## `tests/tools/generation/parameter-limits.test.ts`

- (the file) (file): **merge** to `tests/integration/general/structure.test.ts`. The structure limit limits.function_parameters reaches Ruff and SwiftLint; one file per configuration
- '${String(scenario.command\[0\])} counts declared parameters with maximum %i' (test (test.each), 21-50): **keep** to `tests/integration/general/structure.test.ts` ``${String(scenario.command[0])} counts declared parameters with maximum %i``. Real behavior; TTC-014: it runs gspot check --only python/ruff and --only swift/swiftlint in place of commands the test typed, so the command column of PARAMETER_LIMIT_TOOLS goes; the raised limit is written \[limits.&lt;language&gt;\] function_parameters = { value = &lt;n&gt;, reason = "The project API declares eight required parameters." } (CFR-002).
- \[defaultMaximum, 8\] (test (test.each), 21-21): **keep** to `tests/integration/general/structure.test.ts` `[defaultParameterLimit, 8]`. The each table of the test above.
- { value: defaultMaximum } (const, 15-17): **move** to `tests/integration/general/structure.test.ts` `defaultParameterLimit`. Module-level value of the merged file, named for its default; computed at load time by calling knownSettings, so it stays in the test module.

## `tests/tools/generation/platform-security.test.ts`

- (the file) (file): **split** to `tests/integration/platform/cloudflare.test.ts; tests/integration/platform/supabase.test.ts`. TTO-006; one file per configuration: the Cloudflare and Supabase rows become one test each
- 'native $configuration path rules cover root and child sources at ${level}' (test (test.skipIf), 13-46): **split** to `tests/integration/platform/cloudflare.test.ts; tests/integration/platform/supabase.test.ts` `the Cloudflare path rules cover root and child sources at %s;the Supabase path rules cover root and child sources`. TTO-006, TTC-032: the Supabase test runs once, since both levels give the same findings; the Cloudflare test keeps both levels (cors finding at all) as test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- PLATFORM_PATH_CASES (test (test.skipIf), 13-13): **split** to `tests/integration/platform/cloudflare.test.ts; tests/integration/platform/supabase.test.ts`. The each table splits with its rows
- !hasToolBuild('semgrep') (test (test.skipIf), 13-13): **split** to `tests/integration/platform/cloudflare.test.ts; tests/integration/platform/supabase.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed and driven by the manifest; each new test keeps it

## `tests/tools/generation/security.test.ts`

- (the file) (file): **move** to `tests/integration/platform/supabase.test.ts`. Its Express test is deleted as a duplicate, and the Supabase test moves to its configuration file.
- %s security rules follow JWT dependencies and Express scopes with one runtime rule identity (test (test.skipIf), 22-50): **delete**. Duplicate: 'the Express rules stay within inherited scopes' builds the same four scopes and proves the Express scopes, the Semgrep generation test '%s emits JWT rules only for nearest project dependencies' proves the JWT rules follow the jsonwebtoken dependency, and the sensitive data Semgrep test reports the JWT rule (TTO-006).
- \['recommended', 'all'\] as const (test (test.skipIf), 22-22): **delete**. Duplicate: the level table of the deleted test above.
- !hasToolBuild('semgrep') (test (test.skipIf), 22-22): **delete**. Duplicate: the gate of the deleted test above.
- %s manual Supabase selection reports Deno secret logs in root and child scopes (test (test.skipIf), 52-85): **move** to `tests/integration/platform/supabase.test.ts` `manual Supabase selection reports Deno secret logs in root and child scopes`. Real behavior; the level loop goes as weak, so the title has no level; one file per configuration.
- \['recommended', 'all'\] as const (test (test.skipIf), 52-52): **delete**. Weak: a level loop that changes nothing, since both levels expect the same findings; the test runs once.
- !hasToolBuild('semgrep') (test (test.skipIf), 52-52): **move** to `tests/integration/platform/supabase.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed

## `tests/tools/generation/semgrep.test.ts`

- (the file) (file): **split** to `tests/integration/framework/express.test.ts; tests/integration/framework/fastapi.test.ts; tests/integration/general/security/semgrep.test.ts`. TTO-006, one file per configuration: the Express and FastAPI pack tests go to their configurations, and the level, validate, platform-pack and own-rule tests stay with the security configuration.
- framework security packs stay within inherited scopes (test (test.skipIf), 42-71): **move** to `tests/integration/framework/express.test.ts` `the Express rules stay within inherited scopes`. Real behavior; the JWT rows do not join, since the security test is deleted; TTO-012: delete lines 49, 61, 63 and 70.
- !hasToolBuild('semgrep') (test (test.skipIf), 42-42): **move** to `tests/integration/framework/express.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed
- Semgrep rules follow the level (test (test.skipIf), 73-114): **move** to `tests/integration/general/security/semgrep.test.ts` `Semgrep rules follow the level`. Real behavior of the security configuration; TTO-041: gspot apply replaces the hidden sharePythonTools call.
- !hasToolBuild('semgrep') (test (test.skipIf), 73-73): **move** to `tests/integration/general/security/semgrep.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed.
- the Express pack reports SQL interpolation and raw response fields without misreporting positive cases (test (test.skipIf), 116-140): **move** to `tests/integration/framework/express.test.ts` `the Express pack reports SQL interpolation and raw response fields without misreporting positive cases`. Real behavior.
- !hasToolBuild('semgrep') (test (test.skipIf), 116-116): **move** to `tests/integration/framework/express.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed
- every shipped Semgrep file validates with the native parser at level %s (test (test.skipIf), 142-177): **delete**. Weak: two of its three checks compare data with data from the same source (TTO-013), and the validate step repeats the kept Semgrep tests, which run every shipped pack with semgrep scan --strict and fail on an invalid rule file.
- \['recommended', 'all'\] as const (test (test.skipIf), 142-142): **delete**. Weak: the level table of the deleted test above.
- !hasToolBuild('semgrep') (test (test.skipIf), 142-142): **delete**. Weak: the gate of the deleted test above.
- the FastAPI pack reports exception responses and accepts a stable replacement (test (test.skipIf), 179-203): **move** to `tests/integration/framework/fastapi.test.ts` `the FastAPI pack reports exception responses and accepts a stable replacement`. Real behavior.
- !hasToolBuild('semgrep') (test (test.skipIf), 179-179): **move** to `tests/integration/framework/fastapi.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed
- %s security packs report raw inputs once, accept documented forms, and pass after fixes (test (test.skipIf), 205-241): **move** to `tests/integration/general/security/semgrep.test.ts` `%s security packs report raw inputs once, accept documented forms, and pass after fixes`. Real behavior of the security configuration; it checks several packs together.
- \['recommended', 'all'\] as const (test (test.skipIf), 205-205): **move** to `tests/integration/general/security/semgrep.test.ts` `LEVELS`. The each table of the test above; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- !hasToolBuild('semgrep') (test (test.skipIf), 205-205): **move** to `tests/integration/general/security/semgrep.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed.
- repository security rules report findings and pass after fixes (test (test.skipIf), 243-269): **move** to `tests/integration/general/security/semgrep.test.ts` `repository security rules report findings and pass after fixes`. Real behavior of the security configuration; the Bearer files it wrote go.
- !hasToolBuild('semgrep') (test (test.skipIf), 243-243): **move** to `tests/integration/general/security/semgrep.test.ts` `!hasToolBuild('semgrep')`. TTO-019: needed.
- findingRows (function, 38-40): **move** to `tests/setup/run-gspot.ts` `findingRows`. Used by Semgrep tests in three files (security, express, fastapi), so it is shared test code beside checkReport

## `tests/tools/generation/site-html.test.ts`

- (the file) (file): **merge** to `tests/integration/framework/site.test.ts`. One file per configuration: tests the site configuration's built HTML checks. TTO-029
- '%s keeps built HTML exceptions confined with ${repository.name}' (test (test.each), 24-79): **keep** to `tests/integration/framework/site.test.ts` `a built HTML ignore stays inside its own site with ${repository.name}`. Real behavior; the level loop goes as weak, so the title has no level; TTO-029: delete the --print-config loop; glossary: ignore, not exception.
- \['recommended', 'all'\] as const (test (test.each), 24-24): **delete**. Weak: a level loop that changes nothing, since both levels expect the same findings; the test runs once.

## `tests/tools/lifecycle/hooks.test.ts`

- (the file) (file): **move** to `tests/integration/hooks.test.ts`. Hooks with a real install; the hooks topic file (TEL-054).
- install points core.hooksPath at %s.gspot/hooks (test (test.each), 29-62): **keep** to `tests/integration/hooks.test.ts` `install points core.hooksPath at %s.gspot/hooks`. The only test where gspot install sets core.hooksPath and prints the step; install --dry-run is deleted (CLX-004), so the preview half goes and installCommand takes no isDryRun field, and the two hookStatus assertions go, since the doctor test in this file checks the same texts.
- \['', 'app/'\] (test (test.each), 29-29): **keep** to `tests/integration/hooks.test.ts` `['', 'app/']`. The each table of the test above.
- a commit in a linked worktree runs staged checks and blocks a finding (test (test), 64-114): **keep** to `tests/integration/hooks.test.ts` `a commit in a linked worktree runs staged checks and blocks a finding`. Run gspot apply before the registry and drop the in-process write; the stringified settings write command_check = \[{ name = "sandbox/defect", ... }\]; the hooks start gspot with mise exec -- gspot, so the hook PATH holds mise and the gspot command of the integration preload, not scripts/ (INX-003, SCR-002).
- a hook selects configuration below the Git root and checks its exact index (test (test), 116-158): **keep** to `tests/integration/hooks.test.ts` `a hook uses the gspot.toml below the Git root and checks the index`. Glossary: configuration means a selectable unit; the settings use \[rules\] (TML-003) and \[\[command_check\]\] name = "project/content"; the hook PATH holds mise and the gspot command of the integration preload (INX-003, SCR-002).
- hooksOf (function, 24-27): **merge** to `tests/setup/repository.ts` `hookContext`. One shared copy for the unit and integration hooks tests (TEL-054).

## `tests/tools/lifecycle/installer-failures.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/install.test.ts`. init never installs, so these tests run init and then gspot install and test commands/install.ts; TTO-007: fake npm with fakeCommand too, so no tool runs; TTO-005; glossary: install, not installer.
- init preserves a usable configuration when mise is $availability and install reports the remaining work (test (test.each), 19-65): **keep** to `tests/unit/cli/commands/install.test.ts` `install after init names the remaining work when mise is $availability, keeps gspot.toml, and passes once mise works`. init writes and exits 0, then installCommand runs: the missing row expects exit 0 and the line "Install mise, or install these programs yourself: ...", and the download-failed row expects exit 2 with mise's output (INX-006, GEN-030); TTO-007, TTO-017: fakeCommand, no renamed field; THR-028: a literal always-selected list; buildInitOptions takes no runner (INX-003), init no install option, and installCommand no isDryRun (CLX-004).
- \[...INSTALLATION_FAILURES\] (test (test.each), 19-19): **keep** to `tests/unit/cli/commands/install.test.ts` `MISE_FAILURES`. The each table of the test above: the missing and download-failed rows of MISE_FAILURES in tests/config/tools.ts; INS-001 deletes the outdated row.
- init does not report success when required Python lockfile creation cannot run (test (test), 67-101): **keep** to `tests/unit/cli/commands/install.test.ts` `install after init refuses when uv cannot make the Python lockfile, and writes no .gspot/uv.lock`. init never installs, so the test runs init and then installCommand; uv comes from .gspot/mise.toml through mise bin-paths, so the fake mise answers bin-paths with a folder that holds no uv and the test expects the missing-uv message (INX-003, INX-006); main.py stays as written; TTO-017: fakeCommand for mise and uv.
- { version: RUNNING_VERSION } (const, 17-17): **delete**. Duplicate: the test imports the CLI's own version value.

## `tests/tools/lifecycle/mise-execution.test.ts`

- (the file) (file): **delete**. Dead: both of its tests are deleted.
- install rejects an old runner and succeeds with the pinned CLI selected (test (test.skipIf), 90-109): **delete**. Duplicate: INS-001 deletes the old-mise refusal, and what stays, install through mise with the pinned gspot exiting 0, is what the Python tutorial test does with mise exec -- gspot install.
- !isPosix (test (test.skipIf), 90-90): **delete**. fakeTool writes the gspot launcher on Windows too, and the fake old mise goes (INS-001).
- Mise forwards CLI arguments and apply removes obsolete outputs while preserving authored files (test (test.skipIf), 111-135): **delete**. Duplicate: the obsolete-output half repeats the kept apply publication unit test, and the Python tutorial test runs gspot through mise exec with arguments.
- !isPosix (test (test.skipIf), 111-111): **delete**. Skip condition of the deleted test above.
- previousMiseVersion (const, 25-25): **delete**. INS-001: no fake old mise
- resources (const, 27-27): **delete**. Dead: both tests of the file are deleted.
- project (const, 28-28): **delete**. Dead: both tests of the file are deleted.

## `tests/tools/lifecycle/python-project.test.ts`

- (the file) (file): **move** to `tests/integration/python-tool-project.test.ts`. Python tool project install and repair (TTO-015, TTO-016, THR-001).
- private Python CLI installation preserves authored and generated inputs with %s and %s (test (test.skipIf), 42-89): **keep** to `tests/integration/python-tool-project.test.ts` `Python tool project install keeps your own and generated files with %s and %s`. Real behavior; fakeTool for uv and delimiter for PATH; glossary: your own; with mise on PATH, gspot install takes uv from mise bin-paths of .gspot/mise.toml for every row, so the broken uv on PATH applies to every row and the expected steps are PYTHON_INSTALL_STEPS with no runner key (INX-003, INX-006).
- PYTHON_PROJECTS (test (test.skipIf), 42-42): **keep** to `tests/integration/python-tool-project.test.ts` `PYTHON_PROJECTS`. The each table of the test above: the uv.toml and pyproject.toml rows of PYTHON_PROJECTS in tests/config/python/tool-project.ts, with no runner (INX-003).
- !isPosix (test (test.skipIf), 42-42): **delete**. The causes of the skip are test code (an sh fake, the ":" PATH join, python3), so it goes.
- fresh Python clones install immutable inputs twice and run their tools from any location with %s and %s (test (test.skipIf), 91-146): **keep** to `tests/integration/python-tool-project.test.ts` `fresh Python clones install the locked tools twice and run them from any folder with %s and %s`. Real behavior; the environment is built in place in .gspot/.venv (LIF-001), so the relocated-copy half goes; preparePythonInstallation takes no runner option (INX-003), and installTools takes no refreshLockfiles option (CMD-015).
- \[ \['uv.toml', 'none'\], \['pyproject.toml', 'none'\], \] as const (test (test.skipIf), 91-94): **keep** to `tests/integration/python-tool-project.test.ts` `PYTHON_PROJECTS`. The each table of the test above: the two rows of PYTHON_PROJECTS, with no runner column (INX-003).
- !isPosix (test (test.skipIf), 91-91): **delete**. The causes of the skip are test code, so it goes.
- conflicted Python lockfiles survive offline apply and are repaired by install (test (test.skipIf), 148-194): **keep** to `tests/integration/python-tool-project.test.ts` `conflicted Python lockfiles survive offline apply and are repaired by install`. Real behavior; TTO-015: expectRefusedInstall; installTree goes, so the staged recorder goes, and the refusal and the repair stay; preparePythonInstallation takes no runner option (INX-003), and installTools takes no refreshLockfiles option (CMD-015).
- !isPosix (test (test.skipIf), 148-148): **delete**. The causes of the skip are test code, so it goes.
- an installer that copies index credentials into a lockfile preserves the working environment (test (test.skipIf), 196-244): **keep** to `tests/integration/python-tool-project.test.ts` `a uv that copies index credentials into the lockfile is refused and the installed tools keep working`. Real behavior; TTO-015; fakeTool for uv; THR-001: the wheel is written in TypeScript; with no swap, the "installed tools keep working" half goes and the refusal stays; the credential check must run before the lockfile lands in .gspot/, or a refused install leaves the index password in the committed uv.lock; preparePythonInstallation takes no runner option (INX-003).
- !isPosix (test (test.skipIf), 196-196): **delete**. The causes of the skip are test code, so it goes.
- prepareLockfile (function, 28-40): **merge** to `tests/setup/install.ts` `writeLockedInputs`. TTO-016: the copies of the same four calls under two names become one helper; the refreshLockfiles option goes with the --refresh-lockfiles flag (DT3-007).

## `tests/tools/lifecycle/shared-tools.test.ts`

- (the file) (file): **move** to `tests/integration/install.test.ts`. TTO-002: only test 3 stays; TTO-038: the file is named install
- shared tools preserve scoped checks and portable lockfiles at %s (test (test.each), 29-85): **delete**. TTO-002: self-policing, it tests the test-only install cache, which TTO-003 deletes.
- \['recommended', 'all'\] as const (test (test.each), 29-29): **delete**. TTO-002: table of the deleted test above.
- shared native tool projects keep a separately selected Stylelint dependency and native result (test (test), 87-111): **delete**. TTO-002: repeats the Stylelint runs of the css configuration tests
- installed tool projects leave no apply drift after initialization (test (test), 113-124): **keep** to `tests/integration/install.test.ts` `after init and install, apply has nothing to write`. TTO-002: the one product test of the file; glossary: stale, not drift; THR-009; init takes no hooks option (CLX-001).

## `tests/tools/manifest-flags-in-help.test.ts`

- (the file) (file): **delete**. TTO-001 (owner rule): it greps each tool's --help for manifest flags, which polices data (SUP-024).
- 'the help of ${title} names ${command.flags.join(' ')}' (test (test.skipIf), 155-175): **delete**. TTO-001
- !isPosix || !hasToolBuild(command.tool.name) (test (test.skipIf), 155-155): **delete**. TTO-001: the gate of the deleted test.
- manifests (const, 23-23): **delete**. TTO-001
- context (const, 24-24): **delete**. TTO-001
- hostContext (const, 26-26): **delete**. TTO-001
- flagsOf (function, 29-41): **delete**. TTO-001
- subcommandsOf (function, 43-50): **delete**. TTO-001
- helpText (function, 53-66): **delete**. TTO-001; SUP-024
- commands (const, 68-68): **delete**. TTO-001
- checks (const, 69-69): **delete**. TTO-001
- seen (const, 79-79): **delete**. TTO-001
- distinct (const, 80-85): **delete**. TTO-001
- sandbox (const, 88-88): **delete**. TTO-001
- privateContext (const, 89-89): **delete**. TTO-001: one of the install adapter copies.

## `tests/tools/npm/environment.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/tools/npm/project/install.test.ts`. TTO-005: it needs only npm and a local Bun server, no installed tool, so it joins the unit test of the npm tool project (TPR-071).
- native registry settings authenticate from an isolated project and preserve authored configuration (test (test), 8-67): **keep** to `tests/unit/cli/tools/npm/project/install.test.ts` `registry settings from the repository .npmrc authenticate an isolated project and leave the .npmrc unchanged`. Real behavior; TTC-032: no "native"; glossary: your own.

## `tests/tools/npm/installation.test.ts`

- (the file) (file): **merge** to `tests/integration/install.test.ts`. Failed and refused npm installs; joins the install topic file. TTO-015, TTO-017, CMD-015
- a failed immutable npm install preserves a %s lockfile and the previous tool tree (test (test.each), 21-64): **delete**. Tests deleted behavior: the lockfile and the old tool tree survive a failed npm ci only through a staging folder and swap; gspot installs straight into .gspot/, where npm ci empties node_modules first, and the answer to a failed install is to run gspot install again; the tree assertion is fake too, since the mocked npm ci never touches the tree.
- \['missing', 'stale'\] as const (test (test.each), 21-21): **delete**. Table of the deleted test above.
- explicit lockfile refresh installs changed package bytes at the same version and its preview writes nothing (test (test), 66-116): **delete**. install --refresh-lockfiles is deleted (CMD-015, CMD-092); delete a lockfile and run gspot install.
- direct package installation refuses a %s lockfile without publishing a tree (test (test.each), 118-152): **keep** to `tests/integration/install.test.ts` `installing the npm tool project refuses a %s lockfile and installs nothing`. Real behavior; TTO-015: expectRefusedInstall; installTree goes, so the "installs nothing" recorder goes and the refusal message is the test; createPackageProject takes no runner (INX-003), and installCommand no isDryRun (CLX-004).
- \['missing', 'stale'\] as const (test (test.each), 118-118): **keep** to `tests/integration/install.test.ts` `['missing', 'stale'] as const`. The each table of the test above.

## `tests/tools/npm/lockfiles.test.ts`

- (the file) (file): **merge** to `tests/integration/npm-tool-project.test.ts`. npm, Bun, pnpm and Yarn tool projects; joins the npm tool project file. TTO-016, TTO-032
- %s from %s with %s previews lockfile drift repair without writing, then installs the repaired lockfile (test (test.each), 27-86): **keep** to `tests/integration/npm-tool-project.test.ts` `%s from %s with %s: apply keeps a stale lockfile and install repairs it`. Real behavior; glossary: stale; install --dry-run is deleted (CLX-004), so both dry-run runs and the dryRun fields go, and the test keeps: apply leaves a valid and a stale lockfile as they are, the stale lockfile shows as changed, install repairs it, and the lockfile holds no registry credential; it runs over the package.json rows (INX-003).
- PACKAGE_PROJECTS.filter((\[, path, runner\]) =&gt; path === 'package.json' && runner === 'mise') (test (test.each), 27-27): **keep** to `tests/integration/npm-tool-project.test.ts` `NPM_CLIENT_ROWS filter`. The each table of the test above: NPM_CLIENT_ROWS filtered to path === "package.json", with no runner column (INX-003); "manager" is a banned name part.
- %s from %s with %s keeps a conflicting lockfile through apply until the manager pin is corrected and install repairs it (test (test.each), 87-123): **keep** to `tests/integration/npm-tool-project.test.ts` `%s from %s with %s keeps a conflicted lockfile through apply until the packageManager pin is fixed, and install repairs it`. Real behavior; glossary: manager is banned in names; it runs over the package.json rows, with no runner column (INX-003).
- PACKAGE_PROJECTS.filter((\[, path, runner\]) =&gt; path === 'package.json' && runner === 'mise') (test (test.each), 87-87): **keep** to `tests/integration/npm-tool-project.test.ts` `NPM_CLIENT_ROWS filter`. The each table of the test above: NPM_CLIENT_ROWS filtered to path === "package.json", with no runner column (INX-003); "manager" is a banned name part.
- prepareLockfile (function, 19-25): **merge** to `tests/setup/install.ts` `writeLockedInputs`. TTO-016: the copies of the same four calls under two names become one helper; the refreshLockfiles option goes with the --refresh-lockfiles flag (DT3-007).

## `tests/tools/npm/project.test.ts`

- (the file) (file): **move** to `tests/integration/npm-tool-project.test.ts`. npm tool project install for four package managers, then a clean clone. TTO-014, TTO-016
- %s from %s with %s preserves authored and locked inputs and restores edited tool files (test (test.each), 58-120): **keep** to `tests/integration/npm-tool-project.test.ts` `%s from %s with %s keeps your own and locked files and restores edited tool files`. Real behavior; glossary: your own; with no runner column, the ("npm", "package.json", "none") row repeats the first row and goes; editorconfig-checker comes from the npm tool project, not .gspot/mise.toml, so the wrapper check runs for every row; the clone check runs for npm from package.json; installTools takes no refreshLockfiles option (CMD-015).
- PACKAGE_PROJECTS (test (test.each), 58-58): **keep** to `tests/integration/npm-tool-project.test.ts` `NPM_CLIENT_ROWS`. The each table of the test above: NPM_CLIENT_ROWS, five rows with no runner column (INX-003); "manager" is a banned name part.
- prepareInputs (function, 20-26): **merge** to `tests/setup/install.ts` `writeLockedInputs`. TTO-016: the copies of the same four calls under two names become one helper; the refreshLockfiles option goes with the --refresh-lockfiles flag (DT3-007).
- expectCloneInstallation (function, 29-56): **move** to `tests/integration/npm-tool-project.test.ts` `expectCloneInstallation`. TTO-014: compare the cloned lockfile exactly, without the CRLF normalization; installTools takes no refreshLockfiles option (CMD-015).

## `tests/tools/npm/refusals.test.ts`

- (the file) (file): **merge** to `tests/integration/install.test.ts`. Refused npm installs; joins the install topic file. TTO-015, TTO-017
- npm from package.json with mise refuses lifecycle scripts before contacting the registry (test (test), 40-55): **keep** to `tests/integration/install.test.ts` `npm from package.json refuses install scripts before contacting the registry`. Real behavior; glossary: no "lifecycle"; expectRefusedInstall checks the refusal message and the registry request count only; the PACKAGE_PROJECTS rows have no runner, so the title drops "with mise" (INX-003).
- native wrapper download failure preserves the lockfile and publishes no partial installation (test (test), 56-79): **keep** to `tests/integration/install.test.ts` `a failed program download of an npm wrapper keeps the lockfile and installs nothing`. Real behavior; TTC-032: no "native"; with no swap the kept-tree assertion goes, and the test keeps: the failed wrapper download fails the install with its own error text and leaves the lockfile as it was; createPackageProject("npm", "package.json") takes no runner (INX-003), and installCommand no isDryRun (CLX-004).
- a reinstall the registry answers with 404 keeps the working tools and leaves no scratch folder (test (test), 81-112): **delete**. Tests deleted behavior: keeping the working tools and leaving no scratch folder is the staging folder and swap; gspot installs straight into .gspot/, where npm ci removes node_modules before the 404, and the answer is to run gspot install again.
- a tool project file that changes during the install is refused and nothing is installed (test (test), 114-134): **delete**. LIF-002 deletes the "inputs changed during installation" guard and names this test for deletion: it passes only because it hands installToolProject a disk reader production never uses.
- expectInstallationRefusal (function, 20-38): **move** to `tests/setup/install.ts` `expectRefusedInstall`. TTO-015: four copies of this block in three files become one helper with five callers; it opens the ownership log, calls installToolProject and expects the refusal message, without the installTree recorder and the staged list.

## `tests/tools/parsers/output/markdownlint-typos.test.ts`

- (the file) (file): **split** to `tests/integration/language/markdown.test.ts; tests/integration/general/spelling.test.ts`. TTO-011, TTO-038: two tools in one file; one file per configuration
- native Markdown JSON preserves filename delimiters, positions, and fixability (test (test), 42-71): **move** to `tests/integration/language/markdown.test.ts` `markdownlint JSON keeps file name delimiters, positions, and fixability`. Real behavior; drop the newline file name and keep the colon name with its Windows filter; TTC-032.
- native Markdown output refuses crashes and failures without attributed findings (test (test), 73-102): **delete**. TTO-011: repeats the exit-code unit tests in tests/cli/execution/command/findings.test.ts
- native spelling JSON retains filename delimiters, Unicode columns, and forbidden words without a correction (test (test), 104-156): **move** to `tests/integration/general/spelling.test.ts` `typos JSON keeps file name delimiters, Unicode columns, and forbidden words without a fix`. Real behavior; drop the newline file name; TTC-032; THR-009.
- runMarkdown (function, 21-40): **inline** to `tests/integration/language/markdown.test.ts` `markdownlint JSON keeps file name delimiters, positions, and fixability`. One caller once the crash test goes (TTO-011); TTO-003: a real gspot install replaces shareToolProjects.

## `tests/tools/parsers/output/partial-output.test.ts`

- (the file) (file): **merge** to `tests/integration/language/bash/shellcheck.test.ts`. Tests the ShellCheck output of the bash configuration; one file per configuration.
- partial ShellCheck output beside an unreadable file is an execution error (test (test), 11-36): **keep** to `tests/integration/language/bash/shellcheck.test.ts` `partial ShellCheck output beside an unreadable file is an execution error`. Real behavior.

## `tests/tools/parsers/output/plist.test.ts`

- (the file) (file): **merge** to `tests/integration/infrastructure/xcode.test.ts`. Tests xcode/plutil; one file per configuration (group infrastructure, glossary)
- native property lists (describe (describe.if), 13-48): **delete**. A describe around one test; its gate moves to the test
- native property lists &gt; isMacos (describe (describe.if), 13-13): **move** to `tests/integration/infrastructure/xcode.test.ts` `!hasToolBuild('plutil')`. TTO-019: a tool gate uses hasToolBuild, on the test with test.skipIf.
- native property lists &gt; xcode/plutil classifies mixed native parse and input failures as execution errors (test (test), 14-47): **keep** to `tests/integration/infrastructure/xcode.test.ts` `xcode/plutil reports mixed parse and input failures as execution errors`. Real behavior; TTC-032: no "native".

## `tests/types/tools/cancellation.ts`

- (the file) (file): **move** to `tests/types/processes.ts`. One user; a paused child process is a process type, so the one type goes to tests/types/processes.ts, and FakeGitOptions stays an inline parameter type of fakeGit.
- FakeGitOptions (type exported, 2-7): **inline** to `tests/unit/cli/commands/check/command/cancellation.test.ts` `fakeGit`. The parameter type of its one user; an inline parameter type is not a module-level declaration, so it stays with fakeGit.
- CopyMarker (type exported, 10-10): **move** to `tests/types/processes.ts` `PausedGit`. The marker the paused Git call writes (TTO names table); it goes to tests/types/processes.ts.

## `tests/types/tools/ci.ts`

- (the file) (file): **delete**. THR-002; TTO-026: CiInstallation goes and CiProject is inferred
- CiProject (type exported, 4-11): **delete**. TypeScript infers the return type of prepareCiProject, its one user (as THR-015 does for the packed tests)
- CiInstallation (type exported, 13-13): **delete**. TTO-026: allow is never called; createCiInstall returns refuse alone

## `tests/types/tools/generation/html.ts`

- (the file) (file): **delete**. TTO-029: HtmlValidationConfiguration goes; HtmlAccessibilityCheck is inferred
- HtmlValidationConfiguration (type exported, 2-2): **delete**. TTO-029: only the deleted --print-config steps read it
- HtmlAccessibilityCheck (type exported, 5-13): **delete**. TypeScript infers the row type from AUTOPLAY_CHECKS once the table sits in its one test file

## `tests/types/tools/generation/parameter-limits.ts`

- (the file) (file): **move** to `tests/types/tool-output.ts`. One user (TTO-034); the tool output shapes the integration tests read are one topic, so the one type goes to tests/types/tool-output.ts.
- ParameterDiagnostic (type exported, 1-7): **move** to `tests/types/tool-output.ts` `ParameterFinding`. TTO-035: delete the unused severity field; glossary: finding, not diagnostic; it goes to tests/types/tool-output.ts.

## `tests/types/tools/manifest-flags-in-help.ts`

- (the file) (file): **delete**. TTO-001: its test file goes.
- FlagCommand (type exported, 4-4): **delete**. TTO-001: its test file goes.

## `tests/types/tools/mise-execution.ts`

- (the file) (file): **delete**. Dead: the shared project goes with the deleted mise tests.
- MiseProject (type exported, 3-9): **delete**. Dead: the mise execution tests are deleted, and each helper's return type is inferred.
