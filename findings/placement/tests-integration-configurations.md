# Tests: integration tests of the configurations

775 rows. move 297, keep 175, delete 135, merge 63, inline 59, rename 29, split 17.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/config/tools/configurations/cases.ts`

- (the file) (file): **split** to `tests/config/bash/tools.ts; tests/config/sql.ts`. SCENARIOS goes with the table runner (TTC-001, THR-002); the Bash size locations go to tests/config/bash/tools.ts and the SQL ignore to the SQL sandbox in tests/config/sql.ts.
- SCENARIOS (const exported, 27-74): **delete**. TTC-001: one test file per configuration replaces the scenario table (owner rule: no CI groups or shards)
- BASH_LOCATIONS (const exported, 77-83): **move** to `tests/config/bash/tools.ts` `BASH_SIZE_LOCATIONS`. TTC-005: the Bash size samples go to the Bash topic file, each location written in its case; the static table goes to tests/config/bash/tools.ts, written as const without the BashBoundary annotation, while SIZE_CASES stays in the test because it is computed from the shipped limits at load time.
- SQL_EXCLUSION (const exported, 85-88): **inline** to `tests/config/sql.ts` `SQL_SANDBOX`. The gspot ignore becomes an \[\[ignore\]\] entry in the gspot.toml of SQL_SANDBOX, static data in place of a setup command, and the copy in db/.sqlfluffignore goes (TTC-005, TTC-036).

## `tests/config/tools/configurations/database.ts`

- (the file) (file): **move** to `tests/config/postgres.ts`. TTC-026: the postgres cases join the Squawk test in one postgres file; the data goes to the postgres topic file in tests/config/.
- FOLDER (const exported, 4-4): **move** to `tests/config/postgres.ts` `MIGRATIONS_FOLDER`. Used by the sandbox and the case, both config items, so it lives in config under a plain name, not exported (TTC-037).
- TEAMS (const exported, 6-17): **inline** to `tests/config/postgres.ts` `POSTGRES_SANDBOX`. One use, so it is written into the sandbox in tests/config/postgres.ts (TTC-037).
- REPOSITORY (const exported, 19-24): **move** to `tests/config/postgres.ts` `POSTGRES_SANDBOX`. The sample of a configuration is its SANDBOX, and the topic prefix keeps names unique; drop the blank line (TTC-038); written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 26-40): **move** to `tests/config/postgres.ts` `POSTGRES_CASES`. TTC-001: the file runs its own cases on its sandbox; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/framework/astro.ts`

- (the file) (file): **move** to `tests/config/astro.ts`. Test data goes to tests/config/astro.ts; PAGE, a single short literal used by one test file, so it stays in the test.
- CLEAN (const exported, 1-1): **move** to `tests/config/astro.ts` `ASTRO_PAGE`. Sample source goes to tests/config/; CLEAN alone says nothing in a topic file.
- PAGE (const exported, 3-3): **move** to `tests/integration/framework/astro.test.ts` `PAGE`. Six uses in the one test; a single short literal, so it stays there without an export.
- BUNDLED (const exported, 7-7): **move** to `tests/config/astro.ts` `BUNDLED_ASTRO_PAGE`. Sample source that is not a single short literal goes to tests/config/.

## `tests/config/tools/configurations/framework/nestjs.ts`

- (the file) (file): **move** to `tests/config/nestjs.ts`. TTC-002: one file and one sandbox for the nestjs cases and tests; the data goes to tests/config/nestjs.ts.
- SWAGGER_DEPENDENCY (const exported, 6-6): **inline** to `tests/integration/framework/nestjs.test.ts` `the Swagger lint rules apply only when package.json declares @nestjs/swagger`. One use, written in the test; TTC-031: the jargon comment goes.
- GREETER (const exported, 8-9): **inline** to `tests/config/nestjs.ts` `NESTJS_SANDBOX`. One use, so it is written into the sandbox in tests/config/nestjs.ts (TTC-037).
- CONTROLLER (const exported, 11-12): **move** to `tests/config/nestjs.ts` `NESTJS_CONTROLLER`. TTC-004: the sandbox file and the broken case file both derive from it in tests/config/nestjs.ts.
- NESTJS_MODULE (const exported, 14-15): **inline** to `tests/config/nestjs.ts` `NESTJS_SANDBOX`. One use, so it is written into the sandbox in tests/config/nestjs.ts (TTC-037).
- REPOSITORY (const exported, 17-28): **move** to `tests/config/nestjs.ts` `NESTJS_SANDBOX`. TTC-002, TTC-005: one sandbox for cases and tests; config may not import package.json files, so the test adds the NestJS, rxjs and reflect-metadata versions; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 30-40): **move** to `tests/config/nestjs.ts` `NESTJS_CASES`. TTC-004: the case writes its own broken controller in place of files: {}; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/framework/nextjs.ts`

- (the file) (file): **merge** to `tests/config/nextjs.ts`. Test data joins the shared Next.js samples in tests/config/nextjs.ts.
- COUNT (const exported, 6-6): **delete**. Dead: used only by a deleted test (the --skip duplicate, skippedReplacement).
- BUILD_FAILURE (const exported, 9-10): **move** to `tests/config/nextjs.ts` `NEXT_BUILD_FAILURE_PAGE`. One use; sample source goes to tests/config/.
- PACKAGE (const exported, 12-24): **move** to `tests/config/nextjs.ts` `NEXT_PACKAGE`. package.json joins the sandbox files; config may not import next/package.json, so the package stays a config item and the test adds the next, react and react-dom versions.
- REPOSITORY (const exported, 26-48): **move** to `tests/config/nextjs.ts` `NEXTJS_SANDBOX`. The sample of a configuration is its SANDBOX; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 50-62): **delete**. TTC-007: the one nextjs/tsc case repeats the delegation and reference tests
- REFERENCE_PROJECT_FILES (const exported, 64-68): **move** to `tests/config/nextjs.ts` `REFERENCE_PROJECT_FILES`. Two uses in the reference test; it lives in tests/config/nextjs.ts.

## `tests/config/tools/configurations/framework/react.ts`

- (the file) (file): **merge** to `tests/config/react.ts`. React DOM stays its own configuration; TTC-001: the react cases get their own file; the data joins the shared React samples in tests/config/react.ts.
- REPOSITORY (const exported, 5-10): **move** to `tests/config/react.ts` `REACT_SANDBOX`. React DOM stays its own configuration, so the sandbox keeps selecting typescript and react-dom (TTC-001); written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 12-24): **move** to `tests/config/react.ts` `REACT_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/framework/svelte.ts`

- (the file) (file): **move** to `tests/config/svelte.ts`. TTC-002: one file and one sandbox for the svelte cases and the Prettier test; the data goes to tests/config/svelte.ts.
- COUNT (const exported, 5-5): **inline** to `tests/config/svelte.ts` `SVELTE_CASES`. One use, so it is written into the cases in tests/config/svelte.ts (TTC-037).
- SVELTE_CLEAN (const exported, 7-8): **move** to `tests/config/svelte.ts` `SVELTE_CLEAN`. Used by the sandbox and the Prettier test; it lives in tests/config/svelte.ts.
- PRODUCT (const exported, 10-11): **inline** to `tests/config/svelte.ts` `SVELTE_CASES`. One use, so it is written into the cases in tests/config/svelte.ts (TTC-037).
- CARD (const exported, 13-14): **inline** to `tests/config/svelte.ts` `SVELTE_CASES`. One use, so it is written into the cases in tests/config/svelte.ts (TTC-037).
- REPOSITORY (const exported, 16-23): **move** to `tests/config/svelte.ts` `SVELTE_SANDBOX`. TTC-005: the Svelte version comes from #tests/package.json, which config may not import, so the test adds it; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 25-79): **move** to `tests/config/svelte.ts` `SVELTE_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/framework/vue.ts`

- (the file) (file): **move** to `tests/config/vue.ts`. TTC-001: the vue cases get their own file; the data goes to tests/config/vue.ts.
- VUE_CLEAN (const exported, 5-6): **inline** to `tests/config/vue.ts` `VUE_SANDBOX`. One use, so it is written into the sandbox in tests/config/vue.ts (TTC-037).
- REPOSITORY (const exported, 8-16): **move** to `tests/config/vue.ts` `VUE_SANDBOX`. TTC-005: the Vue version comes from #tests/package.json, which config may not import, so the test adds it; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 18-91): **move** to `tests/config/vue.ts` `VUE_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/general/codeql.ts`

- (the file) (file): **move** to `tests/config/security.ts`. CodeQL is part of the security configuration, so its samples join the security topic file; the four one-line values, single short literals used by one test file, stay in the test.
- CODEQL_LANGUAGE (const exported, 1-1): **inline** to `tests/integration/general/security/codeql.test.ts` `CodeQL reports SQL injection in Python and passes a parameterized query`. One use; a single short literal used by one test file, so it stays in the test.
- CODEQL_FILE (const exported, 2-2): **move** to `tests/integration/general/security/codeql.test.ts` `CODEQL_FILE`. Five uses in the test; a single short literal used by one test file, so it stays in the test.
- CODEQL_SAMPLE (const exported, 3-4): **move** to `tests/config/security.ts` `CODEQL_SAMPLE`. Two uses in the test; sample source goes to tests/config/.
- CODEQL_CORRECTED (const exported, 5-6): **move** to `tests/config/security.ts` `CODEQL_FIXED`. Two uses; fixed, not corrected (TTC names); sample source goes to tests/config/.
- CODEQL_RULE (const exported, 7-7): **inline** to `tests/integration/general/security/codeql.test.ts` `CodeQL reports SQL injection in Python and passes a parameterized query`. One use; a single short literal used by one test file, so it stays in the test.
- CODEQL_LINE (const exported, 8-8): **inline** to `tests/integration/general/security/codeql.test.ts` `CodeQL reports SQL injection in Python and passes a parameterized query`. One use; a single short literal used by one test file, so it stays in the test.
- CODEQL_COLUMN (const exported, 9-9): **inline** to `tests/integration/general/security/codeql.test.ts` `CodeQL reports SQL injection in Python and passes a parameterized query`. One use; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/general/commits/hooks.ts`

- (the file) (file): **merge** to `tests/config/commitlint.ts`. The commitlint data joins the shared commitlint samples in tests/config/commitlint.ts; DERIVED_SCOPE_POLICY and COMMITS_SETUP, single short literals used by one test file, stay in the test.
- DERIVED_SCOPE_POLICY (const exported, 2-2): **inline** to `tests/integration/general/commits/messages.test.ts` `commitlint accepts exact folder-name scopes or no scope, reports bad messages, and runs only at level all`. One use; a single short literal used by one test file, so it stays in the test; the text is \[\[scope\]\] path = "Packages/Core" configurations = \[\].
- COMMIT_MESSAGES (const exported, 5-17): **move** to `tests/config/commitlint.ts` `COMMIT_MESSAGES`. The table of the commitlint test; a table goes to tests/config/.
- COMMITS_SETUP (const exported, 20-20): **inline** to `tests/integration/general/commits/messages.test.ts` `beforeAll of a repository with the commit hooks installed`. One use: two short argument lists, a single short literal, so they stay in the test; TTC-031: the jargon comment goes.

## `tests/config/tools/configurations/general/commits/takeover.ts`

- (the file) (file): **merge** to `tests/config/commitlint.ts`. TTC-021: only the file names stay, and they join tests/config/commitlint.ts.
- COMMITLINT_REPOSITORY (const exported, 4-4): **delete**. TTC-021: the tests take commitlint from the pinned tools path, not from an installed sandbox
- COMMITLINT_TAKEOVERS (const exported, 7-20): **move** to `tests/config/commitlint.ts` `COMMITLINT_FILES`. TTC-021: a list of file names (.cts gets the CommonJS body) in tests/config/commitlint.ts; TTC-031: the history comment goes.

## `tests/config/tools/configurations/general/dependencies/lockfiles.ts`

- (the file) (file): **merge** to `tests/config/dependencies.ts`. One file for the dependencies configuration (THR-002), in tests/config/dependencies.ts.
- JAVASCRIPT_PROJECT (const, 2-10): **move** to `tests/config/dependencies.ts` `LOCAL_NPM_PROJECT`. Spread into four rows; JAVASCRIPT_PROJECT says less than what it is, a package.json project with local file dependencies.
- PYTHON_PROJECT (const, 11-21): **move** to `tests/config/dependencies.ts` `LOCAL_UV_PROJECT`. Spread into the uv row; the name says it is the uv project with local path sources.
- NATIVE_LOCKFILES (const exported, 23-49): **move** to `tests/config/dependencies.ts` `LOCKFILES`. The test.each table; glossary: no "native"; it lives in tests/config/dependencies.ts.

## `tests/config/tools/configurations/general/dependencies/syncpack.ts`

- (the file) (file): **merge** to `tests/config/dependencies.ts`. TTC-021; the data goes to tests/config/dependencies.ts.
- REPOSITORY (const exported, 4-4): **delete**. TTC-021: Syncpack comes from the pinned tools path, not an installed sandbox; TTC-031 comment goes
- SYNCPACK_TAKEOVERS (const exported, 7-22): **move** to `tests/config/dependencies.ts` `SYNCPACK_FILES`. TTC-021: build the rows from the file names; TTC-031: the history comment goes; it lives in tests/config/dependencies.ts.

## `tests/config/tools/configurations/general/duplication.ts`

- (the file) (file): **inline** to `tests/integration/general/duplication.test.ts`. Two numbers for one test, both single short literals used by one test file, so they stay in the test.
- METADATA_ENTRIES (const exported, 2-2): **inline** to `tests/integration/general/duplication.test.ts` `a block copied between two files is a finding on the file that holds it`. One use; a single short literal used by one test file, so it stays in the test.
- COMMAND_STEPS (const exported, 5-5): **inline** to `tests/integration/general/duplication.test.ts` `a block copied between two files is a finding on the file that holds it`. One use; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/general/files.ts`

- (the file) (file): **move** to `tests/config/files.ts`. TTC-002: one sandbox for the files cases and tests; the data goes to tests/config/files.ts.
- REPOSITORY (const exported, 4-13): **move** to `tests/config/files.ts` `FILES_SANDBOX`. TTC-002, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 15-47): **move** to `tests/config/files.ts` `FILES_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/general/format.ts`

- (the file) (file): **merge** to `tests/config/formatting.ts`. THR-002; the data goes to the formatting topic file in tests/config/.
- EDITORCONFIG_VIOLATIONS (const exported, 2-6): **move** to `tests/config/formatting.ts` `EDITORCONFIG_VIOLATIONS`. The table of the EditorConfig test; a table goes to tests/config/.

## `tests/config/tools/configurations/general/gspot.ts`

- (the file) (file): **inline** to `tests/integration/general/gspot.test.ts`. A one-line file; a single short literal used by one test file, so it stays in the test.
- GENERATED (const exported, 1-1): **move** to `tests/integration/general/gspot.test.ts` `SHELLCHECK_RC`. Six uses in the test, under a name that says which generated file it is; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/general/licenses.ts`

- (the file) (file): **move** to `tests/config/licenses.ts`. Test data goes to tests/config/licenses.ts; LICENSE_CHECK, a single short literal used by one test file, so it stays in the test.
- ROOT (const exported, 1-1): **move** to `tests/config/licenses.ts` `LICENSES_ROOT_PACKAGE`. One use; a multi-line package.json sample is not a short literal, so it goes to tests/config/.
- LICENSE_CHECK (const exported, 3-3): **move** to `tests/integration/general/licenses.test.ts` `LICENSE_CHECK`. Two uses: a four-word argument list, a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/general/lychee.ts`

- (the file) (file): **merge** to `tests/config/docs.ts`. lychee tests the docs configuration (TTC-026), so its data joins tests/config/docs.ts.
- LINK_PAGE (const exported, 2-3): **move** to `tests/config/docs.ts` `LINK_PAGE`. Two uses; it lives in tests/config/docs.ts.
- LINK_SCOPE_TABLES (const exported, 6-7): **move** to `tests/config/docs.ts` `LINK_SCOPE_SETTINGS`. One use; a long gspot.toml sample goes to tests/config/, with settings, not tables, in the name (glossary); the root writes \[docs\] allowed_urls = { value = \["/root-only$"\], reason = "..." } and the scope is \[\[scope\]\] path = "app" with docs.allowed\_urls = { value = \["/child-only$"\], reason = "..." } (CFR-002).
- LINK_TEXT_CASES (const exported, 10-13): **move** to `tests/config/docs.ts` `LINK_TEXT_CASES`. The table of expectTextFragments; a table goes to tests/config/.

## `tests/config/tools/configurations/general/markdown-docs-prose.ts`

- (the file) (file): **split** to `tests/config/markdown.ts; tests/config/docs.ts; tests/config/prose.ts`. TTC-001: one file per configuration splits the markdown, docs and prose sample, so the markdownlint, lychee and Vale rows go to their topic files.
- CORRECTIONS (const exported, 6-8): **inline** to `tests/config/docs.ts` `DOCS_CASES`. TTC-004: the lychee case carries its own fixed file, written into the case in tests/config/docs.ts.
- CASES (const exported, 10-38): **split** to `tests/config/markdown.ts; tests/config/docs.ts; tests/config/prose.ts` `MARKDOWN_CASES; DOCS_CASES; PROSE_CASES`. TTC-001: the three markdownlint rows, the lychee row and the Vale row go to the topic files of their configurations; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- REPOSITORY (const exported, 40-45): **split** to `tests/config/markdown.ts; tests/config/docs.ts; tests/config/prose.ts` `MARKDOWN_SANDBOX; DOCS_SANDBOX; PROSE_SANDBOX`. TTC-001: each file selects only its own configuration, and each sandbox goes to its topic file; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/general/prose/emission.ts`

- (the file) (file): **move** to `tests/config/prose.ts`. VALE_INI and CONCRETE_RULE are used by two or more test files (THR-002), so they live in the prose topic file.
- VALE_INI (const exported, 1-1): **move** to `tests/config/prose.ts` `VALE_INI`. Used by prose/styles and prose/vale
- CONCRETE_RULE (const exported, 3-3): **move** to `tests/config/prose.ts` `CONCRETE_RULE`. Used by prose/vale and general/structure (which writes its own copy today)

## `tests/config/tools/configurations/general/prose/headings.ts`

- (the file) (file): **delete**. Its one constant goes with the deleted scope-table heading test.
- HEADING_SCOPES (const exported, 1-6): **delete**. Dead: only the deleted scope-table heading test reads it, and the child-only test cleans no sample files once that test is gone.

## `tests/config/tools/configurations/general/prose/packages.ts`

- (the file) (file): **merge** to `tests/config/prose.ts`. Test data goes to tests/config/prose.ts; INSTALLED, a single short literal used by one test file, so it stays in the test.
- ENCODED_ARCHIVE (const exported, 2-3): **move** to `tests/config/prose.ts` `VALE_PACKAGE_FILES`. TTC-022: the eight files as a plain record in tests/config/prose.ts; the test builds the Zip.
- INSTALLED (const exported, 5-5): **move** to `tests/integration/general/prose/packages.test.ts` `GOOGLE_TERMS_FILE`. Five uses, under a name that says which installed file it is; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/general/prose/rules.ts`

- (the file) (file): **merge** to `tests/config/prose.ts`. TTC-018: the package-rule and scope tests share one file; the data goes to tests/config/prose.ts.
- PACKAGE_STYLE_CASES (const exported, 1-130): **move** to `tests/config/prose.ts` `PACKAGE_STYLE_CASES`. IGN-002: drop the rows of the six gspot rules turned off again; one line per row; it lives in tests/config/prose.ts.

## `tests/config/tools/configurations/general/prose/styles.ts`

- (the file) (file): **merge** to `tests/config/prose.ts`. THR-002; the data goes to tests/config/prose.ts.
- CURRENCY_CASES (const exported, 2-10): **move** to `tests/config/prose.ts` `CURRENCY_CASES`. The table of the currency test, in tests/config/prose.ts.
- STYLE_CASES (const exported, 13-38): **move** to `tests/config/prose.ts` `STYLE_CASES`. The table of the style test, in tests/config/prose.ts.

## `tests/config/tools/configurations/general/prose/vocabulary.ts`

- (the file) (file): **merge** to `tests/config/prose.ts`. The vocabulary test joins the styles file; the data goes to tests/config/prose.ts.
- VOCABULARY_INI (const exported, 2-3): **delete**. TTC-014: the test runs Vale with the generated vale.ini, not a hand-written one
- VOCABULARY_SOURCE (const exported, 4-5): **move** to `tests/config/prose.ts` `VOCABULARY_SOURCE`. Two uses; it lives in tests/config/prose.ts.

## `tests/config/tools/configurations/general/secrets/environment.ts`

- (the file) (file): **move** to `tests/config/secrets.ts`. THR-002, TTC-026, NMU-024; the data goes to tests/config/secrets.ts.
- ENV_SOURCE (const exported, 4-4): **move** to `tests/config/secrets.ts` `ENV_SOURCE`. Two config cases use it, so it lives in tests/config/secrets.ts, not exported (TTC-037).
- REPOSITORY (const exported, 6-11): **move** to `tests/config/secrets.ts` `ENV_EXAMPLES_SANDBOX`. TTC-002, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 13-26): **move** to `tests/config/secrets.ts` `ENV_EXAMPLES_CASES`. TTC-001; NMU-024: the check becomes secrets/env-examples; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/general/secrets/gitleaks-output.ts`

- (the file) (file): **merge** to `tests/config/secrets.ts`. THR-002, TTC-026; the data goes to tests/config/secrets.ts.
- TEST_SECRETS (const exported, 3-6): **move** to `tests/config/secrets.ts` `SECRET_FILES`. TTC-040: a plain name; it lives in tests/config/secrets.ts.
- CORRECTED_SECRETS (const exported, 8-11): **move** to `tests/config/secrets.ts` `FIXED_SECRET_FILES`. TTC names: fixed; it lives in tests/config/secrets.ts.
- FILE_SCOPES (const exported, 13-16): **move** to `tests/config/secrets.ts` `GITLEAKS_SCOPES`. The table of the scratch-copy test; a table goes to tests/config/, and FILE_SCOPES says less in a topic file.
- FILE_EXPIRIES (const exported, 18-21): **delete**. TTC-008: the expiry test goes, since the unit tests cover ignore expiry; ignore --until itself stays.

## `tests/config/tools/configurations/general/secrets/pushed.ts`

- (the file) (file): **merge** to `tests/config/secrets.ts`. The malformed and crashed rows are deleted (weak: a fake TruffleHog in the real-tool suite, TTC-008); the rest goes to tests/config/secrets.ts.
- VERIFIER_TOKENS (const exported, 2-5): **move** to `tests/config/secrets.ts` `VERIFIER_TOKENS`. The fake-tool rows that printed the tokens are deleted (TTC-008), so one test file uses it; it lives in tests/config/secrets.ts.
- SECRET_VERIFICATION_CASES (const exported, 8-27): **delete**. Weak: its malformed and crashed rows run a fake TruffleHog in the real-tool suite (TTC-008); the one real-tool row needs no table.

## `tests/config/tools/configurations/general/secrets/semgrep.ts`

- (the file) (file): **move** to `tests/config/sensitive-data.ts`. Semgrep belongs to the security configuration (TTC-026); its 188 lines of sensitive-data samples get their own topic file, so tests/config/security.ts stays under 300 lines.
- SENSITIVE_FILES (const exported, 1-45): **move** to `tests/config/sensitive-data.ts` `SENSITIVE_FILES`. Three uses; it lives in tests/config/sensitive-data.ts.
- SENSITIVE_FINDINGS (const exported, 47-143): **move** to `tests/config/sensitive-data.ts` `SENSITIVE_FINDINGS`. Expected findings; they live in tests/config/sensitive-data.ts.
- SENSITIVE_CORRECTIONS (const exported, 145-188): **move** to `tests/config/sensitive-data.ts` `FIXED_SENSITIVE_FILES`. TTC names: fixed; it lives in tests/config/sensitive-data.ts.

## `tests/config/tools/configurations/general/site.ts`

- (the file) (file): **merge** to `tests/config/site.ts`. Site is a framework configuration (CKG-029); the data goes to tests/config/site.ts; COMMAND, a single short literal used by one test file, so it stays in the test.
- SELECTOR_FINDING (const, 6-11): **move** to `tests/config/site.ts` `SELECTOR_FINDING`. Two uses; it lives in tests/config/site.ts.
- COMMAND (const exported, 13-13): **move** to `tests/integration/framework/site.test.ts` `SVG_CHECK_COMMAND`. TTC-040: COMMAND names unrelated things in several files; a single short literal used by one test file, so it stays in the test.
- REPOSITORY (const exported, 15-19): **move** to `tests/config/site.ts` `SITE_SANDBOX`. TTC-002, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 21-27): **move** to `tests/config/site.ts` `SITE_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- ORPHAN_SITE_FILES (const exported, 29-33): **inline** to `tests/config/site.ts` `OUTPUT_CASES`. One use, so it is written into OUTPUT_CASES in tests/config/site.ts (TTC-037).
- USED_SELECTOR_BODY (const exported, 35-36): **move** to `tests/config/site.ts` `USED_SELECTOR_BODY`. Three uses; it lives in tests/config/site.ts.
- USED_SELECTOR_CSS (const exported, 38-38): **move** to `tests/config/site.ts` `USED_SELECTOR_CSS`. One use; a long stylesheet sample goes to tests/config/.
- REVIEWED_SELECTOR_POLICY (const exported, 40-41): **move** to `tests/config/site.ts` `REVIEWED_SELECTOR_SETTINGS`. One use; a gspot.toml sample goes to tests/config/; settings, not policy (glossary).
- LINK_CASES (const exported, 43-81): **merge** to `tests/config/site.ts` `OUTPUT_CASES`. TTC-039: the two describe blocks go, so one table in tests/config/site.ts runs every built-site case; written as const without the SiteOutputCase annotation, and the test checks the type.
- OUTPUT_CASES (const exported, 83-104): **move** to `tests/config/site.ts` `OUTPUT_CASES`. The table of the built-site test, in tests/config/site.ts, written as const so the test.each infers its row type (SiteOutputCase goes); the second purgecss row goes, since the recommended and all rows expect the same finding, so one row with the reviewed safelist stays.

## `tests/config/tools/configurations/general/spelling.ts`

- (the file) (file): **merge** to `tests/config/spelling.ts`. THR-002; the data goes to tests/config/spelling.ts.
- SPELLING_EXCLUSIONS (const exported, 2-23): **move** to `tests/config/spelling.ts` `SPELLING_EXCLUSIONS`. TTC-031: the comment becomes a plain sentence; it lives in tests/config/spelling.ts.

## `tests/config/tools/configurations/general/structure.ts`

- (the file) (file): **move** to `tests/config/structure.ts`. THR-002; the data goes to tests/config/structure.ts.
- RUFF_DIRECTIVES (const exported, 2-19): **move** to `tests/config/structure.ts` `RUFF_SUPPRESSIONS`. Glossary: no "directive" in gspot names, these are suppression comments; it lives in tests/config/structure.ts.
- VALE_DIRECTIVES (const exported, 22-30): **move** to `tests/config/structure.ts` `VALE_SUPPRESSIONS`. Glossary: no "directive" in gspot names; it lives in tests/config/structure.ts.

## `tests/config/tools/configurations/general/yaml.ts`

- (the file) (file): **merge** to `tests/config/files.ts`. yamllint belongs to the files configuration (TTC-026), so its data joins tests/config/files.ts.
- YAML_SCOPE_TABLES (const exported, 2-3): **move** to `tests/config/files.ts` `YAML_SCOPE_SETTINGS`. One use; a gspot.toml sample goes to tests/config/, with settings, not tables, in the name (glossary); the scope is \[\[scope\]\] path = "app" with the dotted key tools.yamllint.rules.truthy = { allowed-values = \["no"\] }, and format records use \[\[format.override\]\].
- YAML_SCOPE_FILES (const exported, 6-9): **move** to `tests/config/files.ts` `YAML_SCOPE_FILES`. Two uses; it lives in tests/config/files.ts.
- YAML_SCOPE_SAMPLE (const exported, 12-12): **move** to `tests/config/files.ts` `YAML_SCOPE_SAMPLE`. One use; multi-line YAML sample text goes to tests/config/.

## `tests/config/tools/configurations/infra/ansible.ts`

- (the file) (file): **move** to `tests/config/ansible.ts`. NMU-009: infra becomes infrastructure; the data goes to tests/config/ansible.ts.
- CLEAN (const exported, 4-4): **move** to `tests/config/ansible.ts` `ANSIBLE_PLAYBOOK`. Used by the sandbox, the case and both tests; CLEAN alone says nothing in a topic file.
- SHELLED (const exported, 6-6): **move** to `tests/config/ansible.ts` `SHELLED_PLAYBOOK`. Used by the case and a test; it lives in tests/config/ansible.ts.
- REPOSITORY (const exported, 8-12): **move** to `tests/config/ansible.ts` `ANSIBLE_SANDBOX`. TTC names; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 14-21): **move** to `tests/config/ansible.ts` `ANSIBLE_CASES`. The case skips by the ansible-lint pin, not by object identity; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/infra/docker.ts`

- (the file) (file): **move** to `tests/config/docker.ts`. TTC-001, TTC-026: one docker file; the data goes to tests/config/docker.ts.
- DOCKER_CLEAN (const exported, 4-5): **inline** to `tests/config/docker.ts` `DOCKER_SANDBOX`. One use, so it is written into the sandbox in tests/config/docker.ts (TTC-037).
- CARELESS (const exported, 7-7): **inline** to `tests/config/docker.ts` `DOCKER_CASES`. One use, so it is written into the cases in tests/config/docker.ts (TTC-037).
- IGNORES (const exported, 9-9): **inline** to `tests/config/docker.ts` `DOCKER_SANDBOX`. One use, so it is written into the sandbox in tests/config/docker.ts (TTC-037).
- REPOSITORY (const exported, 11-21): **move** to `tests/config/docker.ts` `DOCKER_SANDBOX`. TTC names, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 23-35): **move** to `tests/config/docker.ts` `DOCKER_CASES`. SUP-008: the compose case runs on Linux only (isLinux), not whenever Docker answers; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/infra/github-actions.ts`

- (the file) (file): **merge** to `tests/config/github-actions.ts`. TTC-001; the data goes to tests/config/github-actions.ts.
- REPOSITORY (const exported, 5-10): **move** to `tests/config/github-actions.ts` `GITHUB_ACTIONS_SANDBOX`. TTC names, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 12-33): **move** to `tests/config/github-actions.ts` `GITHUB_ACTIONS_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/infra/nginx.ts`

- (the file) (file): **move** to `tests/config/nginx.ts`. THR-002; the data goes to tests/config/nginx.ts.
- CLEAN (const exported, 1-1): **move** to `tests/config/nginx.ts` `CLEAN_NGINX_CONFIG`. One use; a multi-line nginx configuration goes to tests/config/.
- FORGED (const exported, 3-3): **move** to `tests/config/nginx.ts` `FORGED_NGINX_CONFIG`. One use; a multi-line nginx configuration goes to tests/config/.
- SERVER (const exported, 5-6): **move** to `tests/config/nginx.ts` `NGINX_SERVER`. Three uses; it lives in tests/config/nginx.ts.

## `tests/config/tools/configurations/infra/openapi.ts`

- (the file) (file): **move** to `tests/config/openapi.ts`. TTC-001: the openapi cases get their own file; the data goes to tests/config/openapi.ts.
- OPENAPI_POLICY (const exported, 4-4): **inline** to `tests/config/openapi.ts` `OPENAPI_CASES`. One use, so it is written into the cases in tests/config/openapi.ts (TTC-037).
- DOCUMENT (const exported, 6-28): **move** to `tests/config/openapi.ts` `OPENAPI_DOCUMENT`. TTC-024: the broken document derives from it in tests/config/openapi.ts.
- REPOSITORY (const exported, 30-38): **move** to `tests/config/openapi.ts` `OPENAPI_SANDBOX`. TTC-005: write-document.js joins the sandbox files; TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 40-50): **move** to `tests/config/openapi.ts` `OPENAPI_CASES`. TTC-024: OPENAPI_DOCUMENT without its operationId line; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/infra/xcode.ts`

- (the file) (file): **merge** to `tests/config/xcode.ts`. TTC-001: the xcode case gets its own file; the data goes to tests/config/xcode.ts.
- REPOSITORY (const exported, 4-8): **move** to `tests/config/xcode.ts` `XCODE_SANDBOX`. TTC names; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 10-22): **move** to `tests/config/xcode.ts` `XCODE_CASES`. The case skips by the plutil pin (macOS), not by a platforms field; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/language/bash/bats.ts`

- (the file) (file): **merge** to `tests/config/bash/tools.ts`. THR-002; tests/config/bash.ts would pass 300 lines, so the ShellCheck, Bats, syntax and sample-script data go to tests/config/bash/tools.ts.
- BATS_MINIMUM_FILES (const exported, 2-6): **move** to `tests/config/bash/tools.ts` `BATS_MINIMUM_FILES`. One use; a file record goes to tests/config/bash/tools.ts.

## `tests/config/tools/configurations/language/bash/checks.ts`

- (the file) (file): **merge** to `tests/config/bash/tools.ts`. TTC-001: the SC2086 case and the size cases go to their behavior files; tests/config/bash.ts would pass 300 lines, so the ShellCheck, Bats, syntax and sample-script data go to tests/config/bash/tools.ts.
- REPOSITORY (const exported, 5-10): **move** to `tests/config/bash/tools.ts` `BASH_SANDBOX`. One sandbox plan in tests/config/bash/tools.ts, from which shellcheck.test.ts and size.test.ts each install their own sandbox; TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 12-18): **move** to `tests/config/bash/tools.ts` `SHELLCHECK_CASES`. The SC2086 case, in tests/config/bash/tools.ts; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/language/bash/loops.ts`

- (the file) (file): **merge** to `tests/config/bash/tools.ts`. THR-002; tests/config/bash.ts would pass 300 lines, so the ShellCheck, Bats, syntax and sample-script data go to tests/config/bash/tools.ts.
- COUNTED_LOOPS (const exported, 2-15): **move** to `tests/config/bash/tools.ts` `COUNTED_LOOPS`. Two uses; it lives in tests/config/bash/tools.ts.
- CORRECTED_LOOPS (const exported, 17-25): **move** to `tests/config/bash/tools.ts` `FIXED_LOOPS`. TTC names: fixed; it lives in tests/config/bash/tools.ts.
- LOOP_COUNTS (const exported, 27-31): **move** to `tests/config/bash/tools.ts` `LOOP_COUNTS`. One use; a table goes to tests/config/bash/tools.ts.

## `tests/config/tools/configurations/language/bash/shellcheck.ts`

- (the file) (file): **merge** to `tests/config/bash/tools.ts`. THR-002; tests/config/bash.ts would pass 300 lines, so the ShellCheck, Bats, syntax and sample-script data go to tests/config/bash/tools.ts.
- DIALECT_SOURCES (const exported, 2-11): **move** to `tests/config/bash/tools.ts` `DIALECT_SOURCES`. Three uses; it lives in tests/config/bash/tools.ts.
- DIALECT_CORRECTIONS (const exported, 13-19): **move** to `tests/config/bash/tools.ts` `DIALECT_FIXES`. TTC names: fixed; it lives in tests/config/bash/tools.ts.

## `tests/config/tools/configurations/language/bash/syntax.ts`

- (the file) (file): **merge** to `tests/config/bash/tools.ts`. DECLARATION_CASES goes (CFR-005, TMF-003), so only SYNTAX_CASES is left and the file joins tests/config/bash/tools.ts.
- SYNTAX_CASES (const exported, 2-28): **move** to `tests/config/bash/tools.ts` `SYNTAX_CASES`. The table of the syntax test; it lives in tests/config/bash/tools.ts.
- DECLARATION_CASES (const exported, 31-49): **delete**. Every row of the table sets a deleted key (CFR-005 deletes \[\[generated\]\] and \[\[vendored\]\], TMF-003 the root exclude), and its one test goes.

## `tests/config/tools/configurations/language/css.ts`

- (the file) (file): **merge** to `tests/config/stylelint.ts`. THR-002; the CSS topic file is tests/config/stylelint.ts; TAILWIND_CONFIGURATIONS, a single short literal used by one test file, so it stays in the test.
- FILES (const exported, 2-5): **move** to `tests/config/stylelint.ts` `STYLESHEETS`. TTC-040: FILES names unrelated things in several files; it lives in tests/config/stylelint.ts.
- TABLES (const exported, 8-17): **move** to `tests/config/stylelint.ts` `STYLELINT_SETTINGS`. TTC-040; glossary: settings; the sample has no runner = "mise" line (INX-003), and its scope is \[\[scope\]\] path = "app" with tools.stylelint.rules.color-hex-length = "long".
- CORRECTED (const exported, 20-23): **move** to `tests/config/stylelint.ts` `FIXED_STYLESHEETS`. TTC names: fixed; it lives in tests/config/stylelint.ts.
- TAILWIND_FILES (const exported, 26-33): **move** to `tests/config/stylelint.ts` `TAILWIND_FILES`. Two uses; it lives in tests/config/stylelint.ts.
- TAILWIND_TABLES (const exported, 35-40): **move** to `tests/config/stylelint.ts` `TAILWIND_SETTINGS`. One use; a gspot.toml sample goes to tests/config/, with settings, not tables, in the name (glossary); no runner = "mise" line (INX-003), and two \[\[scope\]\] records, path = "app" and path = "other".
- TAILWIND_CONFIGURATIONS (const exported, 43-43): **inline** to `tests/integration/language/css.test.ts` `Stylelint accepts Tailwind syntax only in the scope that declares Tailwind`. One use; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/language/javascript/checks.ts`

- (the file) (file): **merge** to `tests/config/javascript.ts`. NMU-075: a file name that says what it tests; the data goes to tests/config/javascript.ts.
- CLEAN_MODULE (const exported, 3-4): **move** to `tests/config/javascript.ts` `JAVASCRIPT_MODULE`. TTC-040: CLEAN_MODULE is JavaScript here and Python elsewhere; it lives in tests/config/javascript.ts.
- REPOSITORY (const exported, 7-15): **move** to `tests/config/javascript.ts` `ESLINT_SANDBOX`. The sandbox of the ESLint test (TTC-002, TTC-038); written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/language/javascript/compiler-ownership.ts`

- (the file) (file): **inline** to `tests/integration/language/javascript/jsconfig.test.ts`. TTC-026: the compiler test joins jsconfig; its one value is a single short literal used by one test file, so it stays in the test.
- COMPILER_CORRECTED_SOURCE (const exported, 2-2): **inline** to `tests/integration/language/javascript/jsconfig.test.ts` `javascript/tsc uses gspot's own TypeScript when the project has none`. One string, one use; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/language/javascript/jsconfig.ts`

- (the file) (file): **move** to `tests/config/javascript.ts`. THR-002; the data goes to tests/config/javascript.ts.
- SCOPE_TABLE (const, 3-3): **move** to `tests/config/javascript.ts` `JSCONFIG_SCOPE_SETTINGS`. Two config rows use it, so it lives in config, with settings, not table, in the name (glossary); the text is \[\[scope\]\] path = "app" configurations = \["javascript"\].
- FORMAT_SOURCE (const, 4-4): **move** to `tests/config/javascript.ts` `FORMAT_SOURCE`. Four rows use it; it lives in tests/config/javascript.ts.
- PRIVATE_DIAGNOSTIC (const, 5-11): **move** to `tests/config/javascript.ts` `PRIVATE_DIAGNOSTIC`. Four rows use it; it lives in tests/config/javascript.ts.
- CALL_DIAGNOSTIC (const, 12-18): **move** to `tests/config/javascript.ts` `CALL_DIAGNOSTIC`. Three rows use it; it lives in tests/config/javascript.ts.
- JAVASCRIPT_PROJECT_FILES (const exported, 20-23): **move** to `tests/config/javascript.ts` `JAVASCRIPT_PROJECT_FILES`. Two uses; it lives in tests/config/javascript.ts.
- JAVASCRIPT_COMPILER_CASES (const exported, 25-133): **move** to `tests/config/javascript.ts` `JSCONFIG_CASES`. The table, with plain row names (TTC-032), in tests/config/javascript.ts, written as const so the test.each infers its row type (JsconfigCase goes); the second case writes tools.eslint.import_extension = "extensionless" (TML-008), and the last case writes no settings and checks that the default js extension keeps the Node suffix rule (TS2835).

## `tests/config/tools/configurations/language/javascript/projects.ts`

- (the file) (file): **merge** to `tests/config/javascript.ts`. THR-002; the data goes to tests/config/javascript.ts.
- JAVASCRIPT_AUTHORED_FILES (const exported, 1-6): **move** to `tests/config/javascript.ts` `YOUR_JSCONFIG_FILES`. Glossary: your own, not authored; it lives in tests/config/javascript.ts.
- JAVASCRIPT_CONFIG_CASES (const exported, 8-11): **move** to `tests/config/javascript.ts` `JSCONFIG_CHOICES`. One use; a table goes to tests/config/, its rows with and without your jsconfig ("cases" is a retired word).
- JAVASCRIPT_CONFIG_PATHS (const exported, 13-18): **move** to `tests/config/javascript.ts` `SCOPE_JSCONFIG_PATHS`. One use; a list of generated paths goes to tests/config/.

## `tests/config/tools/configurations/language/markdown.ts`

- (the file) (file): **merge** to `tests/config/markdown.ts`. THR-002; the data goes to tests/config/markdown.ts.
- FILES (const exported, 2-8): **move** to `tests/config/markdown.ts` `MARKDOWN_FILES`. TTC-040: FILES names unrelated things; it lives in tests/config/markdown.ts.
- TABLES (const exported, 11-24): **move** to `tests/config/markdown.ts` `MARKDOWNLINT_SETTINGS`. TTC-040; glossary: settings; no runner = "mise" line (INX-003), and its scope is \[\[scope\]\] path = "app" with tools.markdownlint.rules.MD044 = { names = \["Nested label"\] }.
- TABLE_COLUMN_SAMPLE (const exported, 27-27): **move** to `tests/config/markdown.ts` `TABLE_COLUMN_SAMPLE`. One use; multi-line Markdown sample text goes to tests/config/.

## `tests/config/tools/configurations/language/python/checks.ts`

- (the file) (file): **merge** to `tests/config/python/checks.ts`. THR-002, TTC-040; every surviving item joins the Python topic, and tests/config/python.ts would pass 300 lines, so the Python check data goes to tests/config/python/checks.ts.
- PYPROJECT (const exported, 6-7): **merge** to `tests/config/python/checks.ts` `PYPROJECT`. TTC-040: the shared PYPROJECT plus a PYDOCLINT_GOOGLE table; two Python test files use it; it lives in tests/config/python/checks.ts.
- REPOSITORY (const exported, 9-18): **move** to `tests/config/python/checks.ts` `PYTHON_SANDBOX`. TTC names, TTC-038; it lives in tests/config/python/checks.ts, written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 20-60): **move** to `tests/config/python/checks.ts` `PYTHON_CASES`. TTC-004: the fixed module is written in the case, not in a callback; it lives in tests/config/python/checks.ts, written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- DOCSTRING_MODULES (const exported, 63-68): **move** to `tests/config/python/checks.ts` `DOCSTRING_MODULES`. The table of the pydoclint test; it lives in tests/config/python/checks.ts.
- IMPORT_CONFIGURATIONS (const exported, 71-84): **move** to `tests/config/python/checks.ts` `IMPORT_CONFIGURATIONS`. TTC-024: setup.cfg and .importlinter share one text; it lives in tests/config/python/checks.ts.

## `tests/config/tools/configurations/language/python/ruff.ts`

- (the file) (file): **move** to `tests/config/ruff.ts`. TTC-026: one Ruff file; the Ruff samples get their own topic file, so the Python topic files stay under 300 lines.
- RULE_SOURCE (const exported, 2-2): **move** to `tests/config/ruff.ts` `RUFF_RULE_SOURCE`. One use; a multi-line Python sample goes to tests/config/.
- FUNCTION_SOURCE (const exported, 5-51): **move** to `tests/config/ruff.ts` `FUNCTION_SOURCE`. TTC-024: the forty lines come from Array.from over a config value, in tests/config/ruff.ts.
- FORMAT_CASES (const exported, 54-57): **move** to `tests/config/ruff.ts` `RUFF_FORMAT_CASES`. The table of the editor test; it lives in tests/config/ruff.ts.
- VERSION_CASES (const exported, 60-64): **move** to `tests/config/ruff.ts` `RUFF_VERSION_CASES`. The table of the version test; it lives in tests/config/ruff.ts.
- VERSION_SOURCE (const exported, 67-75): **move** to `tests/config/ruff.ts` `VERSION_SOURCE`. The sample of the version test; it lives in tests/config/ruff.ts.
- DUPLICATE_SOURCE (const exported, 78-78): **move** to `tests/config/ruff.ts` `DUPLICATE_IMPORT_SOURCE`. One use; a multi-line Python sample goes to tests/config/, under a name that says what it holds.
- RULE_SELECTIONS (const exported, 81-90): **delete**. TTC-006: snapshot of rule counts and hashes; the test compares conventions with each other
- DOCSTRING_CONVENTIONS (const exported, 93-93): **delete**. Dead: used only by the deleted rule-count snapshot test (TTC-006).
- ENABLED_RULES (const exported, 96-96): **delete**. Dead: used only by the deleted rule-count snapshot test (TTC-006).
- RULE_CODES (const exported, 97-97): **delete**. Dead: used only by the deleted rule-count snapshot test (TTC-006).

## `tests/config/tools/configurations/language/sql.ts`

- (the file) (file): **merge** to `tests/config/sql.ts`. THR-002; the data goes to tests/config/sql.ts.
- SQL_CLEAN (const exported, 4-5): **move** to `tests/config/sql.ts` `SQL_CLEAN`. Used by the sandbox file and the case fix; it lives in tests/config/sql.ts.
- PSQL (const exported, 8-9): **inline** to `tests/config/sql.ts` `SQL_SANDBOX`. One use, so it is written into the sandbox in tests/config/sql.ts (TTC-037).
- REPOSITORY (const exported, 11-20): **move** to `tests/config/sql.ts` `SQL_SANDBOX`. TTC-036: drop db/.sqlfluffignore; TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 22-28): **move** to `tests/config/sql.ts` `SQL_CASES`. TTC-004: the case writes its own fixed file; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- SQL_FUNCTION_SOURCE (const exported, 29-30): **move** to `tests/config/sql.ts` `SQL_FUNCTION_SOURCE`. Three uses; it lives in tests/config/sql.ts.

## `tests/config/tools/configurations/language/swift/checks.ts`

- (the file) (file): **merge** to `tests/config/swift.ts`. NMU-075: a file name that says what it tests; the data goes to tests/config/swift.ts.
- CASES (const exported, 5-18): **move** to `tests/config/swift.ts` `SWIFT_CASES`. TTC-004: the SwiftFormat case writes its broken file, and both cases skip by their tool pin; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- REPOSITORY (const exported, 20-25): **move** to `tests/config/swift.ts` `SWIFT_SANDBOX`. TTC names, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/language/swift/docs.ts`

- (the file) (file): **merge** to `tests/config/swift.ts`. THR-002; the data goes to tests/config/swift.ts; SWIFT_FORMAT_CHECK, a single short literal used by one test file, so it stays in the test.
- SWIFT_DOCS_SOURCE (const exported, 1-2): **move** to `tests/config/swift.ts` `SWIFT_DOCS_SOURCE`. Used by three tests; it lives in tests/config/swift.ts.
- SWIFT_INLINE_DOCS (const exported, 4-5): **move** to `tests/config/swift.ts` `SWIFT_INLINE_DOCS`. Two uses; it lives in tests/config/swift.ts.
- SWIFT_FORMAT_CHECK (const exported, 7-7): **move** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `SWIFT_FORMAT_CHECK`. Used by the helper and two tests; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/language/swift/package.ts`

- (the file) (file): **merge** to `tests/config/swift.ts`. TTC-001: the compiler-backed package cases join the build tests (both macOS); the data goes to tests/config/swift.ts.
- SWIFT_PACKAGE (const exported, 4-5): **inline** to `tests/config/swift.ts` `SWIFT_PACKAGE_SANDBOX`. TTC-040: one use, so the second SWIFT_PACKAGE name goes and the value is written into the package sandbox in tests/config/swift.ts.
- LIBRARY (const exported, 7-8): **inline** to `tests/config/swift.ts` `SWIFT_PACKAGE_SANDBOX`. One use, so it is written into the package sandbox in tests/config/swift.ts (TTC-037).
- PAIR (const exported, 10-10): **move** to `tests/config/swift.ts` `PAIR_SIZE_SOURCE`. Four uses; PAIR alone says nothing in a topic file.
- REPOSITORY (const exported, 12-21): **move** to `tests/config/swift.ts` `SWIFT_PACKAGE_SANDBOX`. TTC names, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 23-48): **move** to `tests/config/swift.ts` `SWIFT_PACKAGE_CASES`. Each case skips by its tool pin; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/language/typescript/checks.ts`

- (the file) (file): **merge** to `tests/config/typescript.ts`. THR-002, NMU-075; the data goes to tests/config/typescript.ts.
- JAVASCRIPT_CONFIG (const exported, 17-20): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. One use after the merge, so it is written into the sandbox in tests/config/typescript.ts as its jsconfig.json file.
- REPOSITORY (const exported, 22-39): **move** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. TTC-002, TTC-005: one sandbox, which the jsconfig.json file and the prepare step join; TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 41-118): **move** to `tests/config/typescript.ts` `TYPESCRIPT_CASES`. TTC-004: the javascript/tsc case writes its broken file; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/language/typescript/copy.ts`

- (the file) (file): **move** to `tests/config/tsconfig.ts`. TTC-026: copy.test.ts tests references; the data goes to the topic file of TypeScript projects and scopes, tests/config/tsconfig.ts, so typescript.ts stays under 300 lines.
- TYPESCRIPT_COPY_FILES (const exported, 1-13): **move** to `tests/config/tsconfig.ts` `REFERENCE_BUILD_FILES`. Three uses; "copy" means the scratch copy elsewhere; it lives in tests/config/tsconfig.ts.

## `tests/config/tools/configurations/language/typescript/source.ts`

- (the file) (file): **split** to `tests/config/typescript.ts; tests/config/tsconfig.ts`. Each constant goes to its one user's topic: the repository-check sources to typescript.ts, the project samples to tsconfig.ts.
- ARCHITECTURE (const exported, 5-6): **move** to `tests/config/typescript.ts` `ARCHITECTURE_SETTINGS`. The sandbox setup appends it; a gspot.toml sample, so settings in the name; it uses \[\[architecture.module\]\].
- CHECK_SCRIPT (const exported, 8-21): **move** to `tests/config/typescript.ts` `CHECK_SCRIPT`. TTC-037: the sandbox and the knip case use it; it lives in tests/config/typescript.ts.
- ORDERS_TYPES (const exported, 23-24): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. One use, so it is written into the sandbox in tests/config/typescript.ts (TTC-037).
- TOTALS_TYPES (const exported, 26-27): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. One use, so it is written into the sandbox in tests/config/typescript.ts (TTC-037).
- TOTAL (const exported, 29-44): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. One use, so it is written into the sandbox in tests/config/typescript.ts (TTC-037).
- RECEIPT (const exported, 46-50): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. One use, so it is written into the sandbox in tests/config/typescript.ts (TTC-037).
- WRONG (const exported, 52-53): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_CASES`. One use, so it is written into the cases in tests/config/typescript.ts (TTC-037).
- MISSPELLED_FILE (const exported, 55-55): **inline** to `tests/config/typescript.ts` `TYPESCRIPT_CASES`. One use, so it is written into the cases in tests/config/typescript.ts (TTC-037).
- DOUBLE_JS (const exported, 57-58): **move** to `tests/config/typescript.ts` `DOUBLE_JS`. Used by the sandbox file and the case; it lives in tests/config/typescript.ts.
- TSCONFIG_PROJECT (const exported, 60-61): **move** to `tests/config/tsconfig.ts` `TSCONFIG_PROJECT`. Two uses in the solution test; it lives in tests/config/tsconfig.ts.
- AUTHORED_TSCONFIG (const exported, 63-75): **move** to `tests/config/tsconfig.ts` `YOUR_TSCONFIG`. One use; a 13-line tsconfig sample goes to tests/config/; your own, not authored (glossary).
- OUTDIR_CASES (const exported, 78-81): **move** to `tests/config/tsconfig.ts` `OUTDIR_CASES`. The table of the outDir test; it lives in tests/config/tsconfig.ts.

## `tests/config/tools/configurations/language/typescript/standalone.ts`

- (the file) (file): **merge** to `tests/config/tsconfig.ts`. TTC-026: standalone becomes scopes; the data goes to tests/config/tsconfig.ts.
- PRIVATE_GLOBAL_DIAGNOSTIC (const, 3-9): **move** to `tests/config/tsconfig.ts` `PRIVATE_GLOBAL_DIAGNOSTIC`. Two uses; it lives in tests/config/tsconfig.ts.
- STANDALONE_TYPESCRIPT_FILES (const exported, 12-21): **move** to `tests/config/tsconfig.ts` `STANDALONE_TYPESCRIPT_FILES`. Used by two tests; the files add a .gitattributes that marks app/emitted/\*\* linguist-generated and app/vendor/\*\* linguist-vendored (CFR-005).
- STANDALONE_TYPESCRIPT_TABLES (const exported, 23-31): **move** to `tests/config/tsconfig.ts` `STANDALONE_TYPESCRIPT_SETTINGS`. Used by two tests; settings, not tables (glossary); \[\[generated\]\] and \[\[vendored\]\] go, since .gitattributes marks the folders (CFR-005) and the generated tsconfig leaves them out (TMF-001), so the settings keep only \[\[scope\]\] path = "app" configurations = \["typescript"\].
- STANDALONE_CORRECTED_SOURCE (const exported, 33-34): **move** to `tests/config/tsconfig.ts` `STANDALONE_FIXED_SOURCE`. TTC names: fixed; it lives in tests/config/tsconfig.ts.
- STANDALONE_TYPESCRIPT_DIAGNOSTICS (const exported, 36-48): **move** to `tests/config/tsconfig.ts` `STANDALONE_TYPESCRIPT_DIAGNOSTICS`. Used by two tests; it lives in tests/config/tsconfig.ts.
- ANCESTOR_TYPESCRIPT_FILES (const exported, 51-56): **move** to `tests/config/tsconfig.ts` `ANCESTOR_TYPESCRIPT_FILES`. Two uses; it lives in tests/config/tsconfig.ts.
- ANCESTOR_TYPESCRIPT_TABLES (const exported, 58-62): **move** to `tests/config/tsconfig.ts` `ANCESTOR_SCOPE_SETTINGS`. One use; a gspot.toml sample goes to tests/config/, with settings, not tables, in the name (glossary); two \[\[scope\]\] records, path = "app" and path = "app/deep".
- ANCESTOR_TYPESCRIPT_PROJECT (const exported, 64-67): **move** to `tests/config/tsconfig.ts` `ANCESTOR_TYPESCRIPT_PROJECT`. One use; a tsconfig record goes to tests/config/.

## `tests/config/tools/configurations/library.ts`

- (the file) (file): **move** to `tests/config/libraries.ts`. TTC-001: one file per configuration; one topic file holds the data of the library configurations (drizzle, trpc, zod, zustand).
- REPOSITORY (const exported, 6-13): **move** to `tests/config/libraries.ts` `LIBRARY_SANDBOX`. One sandbox plan in tests/config/libraries.ts, to which each library test adds its own configuration name; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 15-50): **split** to `tests/config/libraries.ts` `DRIZZLE_CASE; TRPC_CASE; ZUSTAND_CASE`. Each library's one case is a named item of tests/config/libraries.ts; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/platform/cloudflare.ts`

- (the file) (file): **merge** to `tests/config/cloudflare.ts`. THR-002; the data goes to tests/config/cloudflare.ts.
- CASES (const exported, 5-11): **move** to `tests/config/cloudflare.ts` `WRANGLER_CASE`. One row, so no table; a case record goes to tests/config/; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- REPOSITORY (const exported, 13-16): **move** to `tests/config/cloudflare.ts` `CLOUDFLARE_SANDBOX`. TTC names; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- WRANGLER_FORMATS (const exported, 18-34): **move** to `tests/config/cloudflare.ts` `WRANGLER_FORMATS`. TTC-024: derive the broken and fixed variants; it lives in tests/config/cloudflare.ts.

## `tests/config/tools/configurations/platform/supabase/checks.ts`

- (the file) (file): **merge** to `tests/config/supabase.ts`. Only the Supabase test that needs Docker goes; the cases that need no Docker (deno lint, deno check) stay as an ordinary integration test, and their data goes to tests/config/supabase.ts.
- SUPABASE_CONFIG (const exported, 5-5): **inline** to `tests/config/supabase.ts` `SUPABASE_SANDBOX`. One use, so it is written into the sandbox in tests/config/supabase.ts (TTC-037).
- REPOSITORY (const exported, 7-16): **move** to `tests/config/supabase.ts` `SUPABASE_SANDBOX`. TTC names, TTC-038; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 18-48): **move** to `tests/config/supabase.ts` `SUPABASE_CASES`. TTC-001; the Deno lint case writes \[\[scope\]\] path = "apps/api" configurations = \["supabase"\]; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.

## `tests/config/tools/configurations/platform/supabase/database.ts`

- (the file) (file): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- DATABASE_START (const exported, 2-7): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.

## `tests/config/tools/configurations/platform/supabase/types.ts`

- (the file) (file): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- NESTED_POLICY (const exported, 1-10): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- API_MIGRATIONS (const exported, 12-14): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- WEB_MIGRATIONS (const exported, 15-17): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.

## `tests/config/tools/configurations/test/jest.ts`

- (the file) (file): **move** to `tests/config/jest.ts`. NMU-009: test becomes testing; the data goes to tests/config/jest.ts.
- SOURCE (const exported, 1-2): **move** to `tests/config/jest.ts` `MATH_SOURCE`. Many uses; SOURCE alone says nothing; it lives in tests/config/jest.ts.
- TEST_SOURCE (const exported, 4-5): **move** to `tests/config/jest.ts` `MATH_TEST_SOURCE`. Many uses; it lives in tests/config/jest.ts.
- CORRECTED_TEST_SOURCE (const exported, 8-8): **move** to `tests/config/jest.ts` `FIXED_MATH_TEST_SOURCE`. TTC names: fixed; it lives in tests/config/jest.ts.
- JEST_PROJECT_FILES (const exported, 11-15): **move** to `tests/config/jest.ts` `JEST_PROJECT_FILES`. One use; a file record goes to tests/config/, and the test adds package.json with the Jest version.

## `tests/config/tools/configurations/test/pytest.ts`

- (the file) (file): **move** to `tests/config/pytest.ts`. THR-002; the data goes to tests/config/pytest.ts; PROVIDER_FLOORS becomes \[80, 0\] in the test, a single short literal used by one test file, so it stays in the test.
- REPOSITORY (const exported, 5-15): **move** to `tests/config/pytest.ts` `PYTEST_SANDBOX`. TTC-002: the clean-sample test runs on this sandbox too; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- CASES (const exported, 17-25): **move** to `tests/config/pytest.ts` `PYTEST_CASES`. TTC-004: the case writes its broken test file in place of the runner; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- PROVIDER_FLOORS (const exported, 27-32): **inline** to `tests/integration/testing/pytest.test.ts` `pytest/coverage with a %i limit uses the project's Python and needs pytest-cov only above 0`. TTC-024, TGN-037: test.each(\[80, 0\]), since the level makes no difference; \[80, 0\] is a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/test/swift-tests.ts`

- (the file) (file): **move** to `tests/config/swift-tests.ts`. THR-002; the data goes to tests/config/swift-tests.ts; SWIFTLINT_COMMAND, a single short literal used by one test file, so it stays in the test.
- XCTEST_COVERAGE_SOURCE (const exported, 1-2): **move** to `tests/config/swift-tests.ts` `XCTEST_COVERAGE_SOURCE`. Two uses; it lives in tests/config/swift-tests.ts.
- XCTEST_COVERAGE_TESTS (const exported, 4-5): **move** to `tests/config/swift-tests.ts` `XCTEST_COVERAGE_TESTS`. Two uses; it lives in tests/config/swift-tests.ts.
- SAMPLE (const exported, 7-7): **move** to `tests/config/swift-tests.ts` `PARSER_SOURCE`. TTC-040: SAMPLE says nothing; it lives in tests/config/swift-tests.ts.
- CORRECT (const exported, 9-10): **move** to `tests/config/swift-tests.ts` `FIXED_PARSER_SOURCE`. TTC names: fixed; it lives in tests/config/swift-tests.ts.
- XCTEST_SCOPES (const exported, 12-15): **move** to `tests/config/swift-tests.ts` `XCTEST_SCOPES`. The table of the four SwiftLint tests; a table goes to tests/config/.
- XCTEST_COMMAND (const exported, 17-17): **move** to `tests/integration/testing/swift-tests.test.ts` `SWIFTLINT_COMMAND`. The command runs swift/swiftlint; a single short literal used by one test file, so it stays in the test.

## `tests/config/tools/configurations/test/vitest.ts`

- (the file) (file): **move** to `tests/config/vitest.ts`. THR-002; the data goes to tests/config/vitest.ts; PROVIDER_FLOORS becomes \[80, 0\] in the test, a single short literal used by one test file, so it stays in the test.
- VITEST_SOURCE (const exported, 5-6): **move** to `tests/config/vitest.ts` `VITEST_SOURCE`. Several uses; it lives in tests/config/vitest.ts.
- VITEST_PACKAGE (const exported, 8-8): **move** to `tests/config/vitest.ts` `VITEST_PACKAGE`. TTC-005: package.json joins the sandbox files; config may not import vitest/package.json, so the package stays a config item and the test adds the Vitest version.
- UNTESTED (const exported, 10-10): **move** to `tests/config/vitest.ts` `UNTESTED_SOURCE`. Several uses; UNTESTED alone says nothing in a topic file.
- TEST (const exported, 12-13): **move** to `tests/config/vitest.ts` `VITEST_MATH_TEST`. TEST alone says nothing; it lives in tests/config/vitest.ts.
- REPOSITORY (const exported, 15-27): **move** to `tests/config/vitest.ts` `VITEST_SANDBOX`. TTC names; written as const without the InstalledScenario annotation, since tests/config imports only tests/config, and the test checks the type.
- TRIPLE_TEST (const exported, 29-29): **inline** to `tests/config/vitest.ts` `VITEST_CASES`. TTC-004: the fixed test file is written into the case in tests/config/vitest.ts.
- CASES (const exported, 31-38): **move** to `tests/config/vitest.ts` `VITEST_CASES`. TTC-001; written as const without the FindingCase annotation, since tests/config imports only tests/config, and the test checks the type.
- PROVIDER_FLOORS (const exported, 40-45): **inline** to `tests/integration/testing/vitest.test.ts` `vitest/coverage with a %i limit runs without its coverage package only at 0`. TTC-024, TGN-037: test.each(\[80, 0\]), since the level makes no difference; \[80, 0\] is a single short literal used by one test file, so it stays in the test.

## `tests/tools/configurations/cases.test.ts`

- (the file) (file): **split** to `tests/integration/infrastructure/xcode.test.ts; tests/integration/testing/pytest.test.ts; tests/integration/infrastructure/ansible.test.ts; tests/integration/library/drizzle.test.ts; tests/integration/library/zustand.test.ts; tests/integration/library/trpc.test.ts; tests/integration/database/postgres.test.ts; tests/integration/platform/supabase.test.ts; tests/integration/infrastructure/github-actions.test.ts; tests/integration/infrastructure/docker.test.ts; tests/integration/infrastructure/openapi.test.ts; tests/integration/testing/vitest.test.ts; tests/integration/language/python/basedpyright-pydoclint.test.ts; tests/integration/language/sql.test.ts; tests/integration/language/typescript/repository-checks.test.ts; tests/integration/language/swift/swiftlint-swiftformat.test.ts; tests/integration/language/swift/build.test.ts; tests/integration/language/bash/shellcheck.test.ts; tests/integration/language/bash/size.test.ts; tests/integration/general/files.test.ts; tests/integration/language/markdown.test.ts; tests/integration/general/docs.test.ts; tests/integration/general/prose/vale.test.ts; tests/integration/framework/site.test.ts; tests/integration/general/secrets/env-examples.test.ts; tests/integration/framework/nestjs.test.ts; tests/integration/framework/react.test.ts; tests/integration/framework/svelte.test.ts; tests/integration/framework/vue.test.ts`. TTC-001: one file per configuration, each with its own sandbox and cases (owner rule: no CI shards or name groups); the Supabase test keeps only the cases that need no Docker.
- declared.name (describe (describe.skipIf), 275-312): **delete**. TTC-001: the configuration file replaces the per-scenario describe
- declared.name &gt; (declared.repository === toolAnsible.REPOSITORY && !hasToolBuild('ansible-lint')) || (declared.platforms !== (describe (describe.skipIf), 275-278): **delete**. No identity check and no platforms field; each case skips by its tool pin (hasToolBuild).
- declared.name &gt; '${entry.check} reports ${where} and passes after the fix' (test (test.skipIf), 284-310): **split** to `tests/integration/infrastructure/xcode.test.ts; tests/integration/testing/pytest.test.ts; tests/integration/infrastructure/ansible.test.ts; tests/integration/library/drizzle.test.ts; tests/integration/library/zustand.test.ts; tests/integration/library/trpc.test.ts; tests/integration/database/postgres.test.ts; tests/integration/platform/supabase.test.ts; tests/integration/infrastructure/github-actions.test.ts; tests/integration/infrastructure/docker.test.ts; tests/integration/infrastructure/openapi.test.ts; tests/integration/testing/vitest.test.ts; tests/integration/language/python/basedpyright-pydoclint.test.ts; tests/integration/language/sql.test.ts; tests/integration/language/typescript/repository-checks.test.ts; tests/integration/language/swift/swiftlint-swiftformat.test.ts; tests/integration/language/swift/build.test.ts; tests/integration/language/bash/shellcheck.test.ts; tests/integration/language/bash/size.test.ts; tests/integration/general/files.test.ts; tests/integration/language/markdown.test.ts; tests/integration/general/docs.test.ts; tests/integration/general/prose/vale.test.ts; tests/integration/framework/site.test.ts; tests/integration/general/secrets/env-examples.test.ts; tests/integration/framework/nestjs.test.ts; tests/integration/framework/react.test.ts; tests/integration/framework/svelte.test.ts; tests/integration/framework/vue.test.ts` ``${entry.check} reports ${where} and passes after the fix``. TTC-001: each file runs test.each over its own cases from its tests/config topic file, and the shared assertions are the runner runCheckSample in tests/setup/fixes.ts.
- declared.name &gt; isElsewhere || (entry.docker === true && !hasLinuxDocker()) (test (test.skipIf), 284-284): **delete**. Each case skips by its tool pin, and the Docker case skips off Linux (isLinux), not when Docker is down (SUP-008).
- defaultLimit (function, 47-53): **move** to `tests/integration/language/bash/size.test.ts` `defaultLimit`. TTC-005; TTC-035: drop the typeof guard and read the default with Number()
- nestedConditions (function, 60-64): **move** to `tests/integration/language/bash/size.test.ts` `nestedConditions`. TTC-005: builds the nesting samples from the sample line it repeats. Values to config: NESTED_CONDITION = 'if \[\[ -n "$1" \]\]; then' -&gt; tests/config/bash/tools.ts
- fileLines (const, 66-66): **move** to `tests/integration/language/bash/size.test.ts` `fileLines`. TTC-005: used in the sample and its message; computed at load time by calling defaultLimit, so it stays in the test module.
- functionLines (const, 67-67): **move** to `tests/integration/language/bash/size.test.ts` `functionLines`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- branches (const, 68-68): **move** to `tests/integration/language/bash/size.test.ts` `branches`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- nesting (const, 69-69): **move** to `tests/integration/language/bash/size.test.ts` `nesting`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- assignments (const, 70-70): **move** to `tests/integration/language/bash/size.test.ts` `assignments`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- filesAtLimit (const, 72-75): **move** to `tests/integration/language/bash/size.test.ts` `filesAtLimit`. TTC-005: used by the sample and its fix; computed at load time from the shipped limits, so it stays in the test module.
- bodyAtLimit (const, 76-76): **move** to `tests/integration/language/bash/size.test.ts` `bodyAtLimit`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- branchesAtLimit (const, 77-80): **move** to `tests/integration/language/bash/size.test.ts` `branchesAtLimit`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- assignmentsAtLimit (const, 81-83): **move** to `tests/integration/language/bash/size.test.ts` `assignmentsAtLimit`. TTC-005; computed at load time from the shipped limits, so it stays in the test module.
- BOUNDARIES (const, 84-125): **move** to `tests/integration/language/bash/size.test.ts` `SIZE_CASES`. TTC-005: the Bash size cases, written as cases directly (no BashBoundary map); computed at load time from the shipped limits, so it stays in the test module, and its file, line and rule columns come from BASH_SIZE_LOCATIONS in tests/config/bash/tools.ts.
- vitestPackage (const, 126-128): **merge** to `tests/integration/testing/vitest.test.ts` `installedSandbox`. TTC-005: package.json with the Vitest version from #tests/package.json joins the sandbox; config may not import that file, so installedSandbox stays in the test as VITEST_SANDBOX plus this package.json.
- nestDependencies (const, 129-136): **merge** to `tests/integration/framework/nestjs.test.ts` `installedSandbox`. TTC-002, TTC-005: one dependency list, read from #tests/package.json, which config may not import, so installedSandbox stays in the test as NESTJS_SANDBOX plus these dependencies.
- CALLBACKS (const, 137-246): **delete**. TTC-005: each callback moves into its configuration's SANDBOX or CASES

## `tests/tools/configurations/database.test.ts`

- (the file) (file): **move** to `tests/integration/database/postgres.test.ts`. Squawk tests the postgres configuration (TTC-026), so the postgres cases join this file.
- Squawk uses the effective transaction setting for each scope and honors false under Supabase (test (test), 24-66): **keep** to `tests/integration/database/postgres.test.ts` `Squawk uses each scope's assume_in_transaction setting, and false under Supabase`. Real behavior, run through gspot check (TTC-014); TTC-032 title; the emitAll assertion on the three squawk.toml files goes, since the per-scope check results prove the settings reach Squawk. Values to config: SQUAWK_SCOPE_SETTINGS = '\[tools.squawk\]\\nassume_in_transaction = false' with \[\[scope\]\] path = "transactional" setting tools.squawk.assume_in_transaction = true and \[\[scope\]\] path = "transactional/child" -&gt; tests/config/postgres.ts; UNWRAPPED_MIGRATION = "SET lock_timeout = '5s';..." -&gt; tests/config/postgres.ts
- squawk (function, 16-22): **delete**. Dead: once the test runs gspot check --only postgres/squawk (TTC-014), each file is checked with its scope's generated squawk.toml, so no raw squawk call with a hand-picked --config is left.

## `tests/tools/configurations/framework/astro.test.ts`

- (the file) (file): **move** to `tests/integration/framework/astro.test.ts`. tests/tools becomes tests/integration
- one Astro project reaches ESLint, astro check, and Prettier, and passes after each fix (test (test), 14-55): **keep** to `tests/integration/framework/astro.test.ts` `one Astro project reaches ESLint, astro check, and Prettier, and passes after each fix`. Real behavior.

## `tests/tools/configurations/framework/nestjs.test.ts`

- (the file) (file): **move** to `tests/integration/framework/nestjs.test.ts`. TTC-002: the nestjs cases join this file and its one sandbox
- the nestjs configuration (describe (describe), 63-90): **delete**. TTC-039: one file per configuration holds one sandbox; the describe repeats the file name
- the nestjs configuration &gt; %s enforces Swagger contracts only when the project declares Swagger (test (test.each), 78-81): **keep** to `tests/integration/framework/nestjs.test.ts` `the Swagger lint rules apply only when package.json declares @nestjs/swagger`. Real behavior; TTC-032 title.
- the nestjs configuration &gt; \['recommended', 'all'\] as const (test (test.each), 78-78): **delete**. TGN-037: the same result at both levels; run once at level all
- the nestjs configuration &gt; the type and compiler option checks accept the clean Nest module (test (test), 83-89): **delete**. Weak: only checks exit code 0 for typescript/tsc and typescript/tsconfig on a clean module.
- swaggerContracts (function, 19-61): **inline** to `tests/integration/framework/nestjs.test.ts` `the Swagger lint rules apply only when package.json declares @nestjs/swagger`. One-caller wrapper of the test body

## `tests/tools/configurations/framework/nextjs.test.ts`

- (the file) (file): **move** to `tests/integration/framework/nextjs.test.ts`. tests/tools becomes tests/integration
- the nextjs configuration (describe (describe), 159-184): **delete**. TTC-039: the sandbox belongs to the file; the describe repeats the file name
- the nextjs configuration &gt; type checking delegates to the Next.js check only when it runs (test (test), 160-160): **keep** to `tests/integration/framework/nextjs.test.ts` `type checking delegates to the Next.js check only when it runs`. Real behavior.
- the nextjs configuration &gt; the TypeScript check reports findings when the Next.js check is skipped (test (test), 161-162): **delete**. Duplicate: check --skip goes (CMD-092), and what is left, typescript/tsc running when nextjs/tsc does not, is 'type checking delegates to the Next.js check only when it runs'.
- the nextjs configuration &gt; all builds the app without an enabling flag and recommended omits the build (test (test), 163-164): **keep** to `tests/integration/framework/nextjs.test.ts` `nextjs/build builds the app at level all and is not run at level recommended`. Real behavior; TTC-032 title.
- the nextjs configuration &gt; the i18n rules reject literal markup (test (test), 165-165): **keep** to `tests/integration/framework/nextjs.test.ts` `the i18n rules reject literal markup`. Real behavior.
- the nextjs configuration &gt; '${entry.check} reports ${where} and passes after the fix' (test (test), 168-182): **delete**. TTC-007: re-runs the TS2322 case that the delegation and reference tests cover
- Next.js generates types and compiles references without a second copy or source output (test (test), 186-221): **keep** to `tests/integration/framework/nextjs.test.ts` `nextjs/tsc generates types and checks a referenced project without writing build output`. Real behavior; TTC-032 title.
- checked (function, 33-43): **keep** to `tests/integration/framework/nextjs.test.ts` `checked`. Several callers; TTC-016: delete the stale comment and the {} argument
- delegation (function, 46-55): **inline** to `tests/integration/framework/nextjs.test.ts` `type checking delegates to the Next.js check only when it runs`. One-caller wrapper of the test body
- skippedReplacement (function, 58-74): **delete**. Dead: used only by the deleted --skip test.
- literalMarkup (function, 78-92): **inline** to `tests/integration/framework/nextjs.test.ts` `the i18n rules reject literal markup`. One-caller wrapper of the test body
- buildLevels (function, 95-123): **inline** to `tests/integration/framework/nextjs.test.ts` `nextjs/build builds the app at level all and is not run at level recommended`. One-caller wrapper of the test body
- resources (const, 125-125): **keep** to `tests/integration/framework/nextjs.test.ts` `resources`. Disposes the sandbox; TTC-019: the sandbox moves inside the repository (Git-ignored folder)
- testRepository (const, 126-126): **rename** to `tests/integration/framework/nextjs.test.ts` `installedSandbox`. Glossary: sandbox, not test repository

## `tests/tools/configurations/framework/svelte.test.ts`

- (the file) (file): **move** to `tests/integration/framework/svelte.test.ts`. TTC-002: the svelte cases join this file and its sandbox
- format/prettier reports and corrects a component through the Svelte plugin (test (test), 15-34): **keep** to `tests/integration/framework/svelte.test.ts` `Prettier reports and fixes a Svelte component through the Svelte plugin`. Real behavior; TTC-032 title.
- testRepository (const, 13-13): **rename** to `tests/integration/framework/svelte.test.ts` `installedSandbox`. Glossary: sandbox

## `tests/tools/configurations/general/codeql.test.ts`

- (the file) (file): **move** to `tests/integration/general/security/codeql.test.ts`. CodeQL belongs to the security configuration (TTC-026).
- the pinned CodeQL (describe (describe.if), 22-57): **delete**. TTC-039: describe around a single test
- the pinned CodeQL &gt; hasToolBuild('codeql') (describe (describe.if), 22-22): **rename** to `tests/integration/general/security/codeql.test.ts` `test.skipIf(!hasToolBuild('codeql'))`. A needed skip (SUP-022); one skip form, on the test, once the describe goes.
- the pinned CodeQL &gt; pinned CodeQL reports SQL injection in Python and accepts a parameterized query without changing sources (test (test), 23-56): **keep** to `tests/integration/general/security/codeql.test.ts` `CodeQL reports SQL injection in Python and passes a parameterized query`. Real behavior; TTC-032 title.

## `tests/tools/configurations/general/commits/hooks.test.ts`

- (the file) (file): **move** to `tests/integration/general/commits/messages.test.ts`. With the replace tests the commits file passes 300 lines, so it splits by behavior; NMU-075 name
- native commitlint keeps exact project scopes optional and restores coverage across level changes (test (test), 56-100): **keep** to `tests/integration/general/commits/messages.test.ts` `commitlint accepts exact folder-name scopes or no scope, reports bad messages, and runs only at level all`. Real behavior; TTC-032 title; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts, without the switch back to recommended (TGN-037).
- the commits configuration (describe (describe), 176-187): **keep** to `tests/integration/general/commits/messages.test.ts` `a repository with the commit hooks installed`. Scopes the shared hook sandbox (TTC-039 keeps such a describe); TTC-032 title
- the commits configuration &gt; the commit-msg hook refuses a free-form message and takes a conventional one (test (test), 183-183): **keep** to `tests/integration/general/commits/messages.test.ts` `the commit-msg hook refuses a free-form message and takes a conventional one`. Real behavior; the commit-msg hook runs gspot check --message-file without --hook and prints no bypass line, so the "Bypass this hook once" assertion goes (CLX-006).
- the commits configuration &gt; the message-file check refuses a free-form message (test (test), 184-184): **delete**. TTC-007: repeats the message-file checks of the commitlint test
- the commits configuration &gt; the range check rejects a bypassed hook (test (test), 185-185): **keep** to `tests/integration/general/commits/messages.test.ts` `commits/commitlint-pushed reports a commit made past the hook`. Real behavior; TTC-032 title.
- the commits configuration &gt; a push checks distinct messages with identical trees and changed paths (test (test), 186-186): **keep** to `tests/integration/general/commits/messages.test.ts` `the pre-push check reads every pushed commit message, even when the trees are equal`. Real behavior; TTC-032 title.
- a shallow push checks source content but refuses incomplete required history until it is fetched (test (test), 189-237): **keep** to `tests/integration/general/commits/messages.test.ts` `a shallow push checks source content but refuses incomplete required history until it is fetched`. Real behavior.
- expectCompleteHistory (function, 26-31): **inline** to `tests/integration/general/commits/messages.test.ts` `a shallow push checks source content but refuses incomplete required history until it is fetched`. One caller
- expectDraftCheck (function, 34-54): **keep** to `tests/integration/general/commits/messages.test.ts` `expectDraftCheck`. Several callers
- sandbox (const, 102-102): **keep** to `tests/integration/general/commits/messages.test.ts` `sandbox`. The hook describe's sandbox
- root (const, 103-103): **keep** to `tests/integration/general/commits/messages.test.ts` `root`. Used by the hook tests
- environment (const, 104-104): **keep** to `tests/integration/general/commits/messages.test.ts` `environment`. TTC-035: NO_COLOR stays because git commit passes it to the hook
- initial (const, 105-105): **keep** to `tests/integration/general/commits/messages.test.ts` `initial`. Reset point of each hook test
- prepareCommits (function, 107-119): **inline** to `tests/integration/general/commits/messages.test.ts` `beforeAll of a repository with the commit hooks installed`. One-caller function; init takes no hooks option, since hooks are on by default (CLX-001), so it calls buildInitArguments(\["commits"\]); the hooks start gspot with mise exec -- gspot, so the hook PATH holds mise and the gspot command of the integration preload (INX-003, SCR-002). Values to config: COMMITS_FILES = { 'scripts/a.sh': CLEAN_BASH_SCRIPT, 'README.md': '# Test\\n', LICENSE } -&gt; tests/config/commitlint.ts
- checkCommitHook (function, 121-132): **inline** to `tests/integration/general/commits/messages.test.ts` `the commit-msg hook refuses a free-form message and takes a conventional one`. One-caller test body
- checkMessageFile (function, 134-138): **delete**. TTC-007: its test goes
- checkBypassedHook (function, 140-149): **inline** to `tests/integration/general/commits/messages.test.ts` `commits/commitlint-pushed reports a commit made past the hook`. One-caller test body
- checkDistinctMessages (function, 151-174): **inline** to `tests/integration/general/commits/messages.test.ts` `the pre-push check reads every pushed commit message, even when the trees are equal`. One-caller test body

## `tests/tools/configurations/general/commits/takeover.test.ts`

- (the file) (file): **move** to `tests/integration/general/commits/replace.test.ts`. Glossary: replace, not takeover; TTC-021 simplifies it
- initialization retires the native Commitlint configuration $file (test (test.each), 21-50): **keep** to `tests/integration/general/commits/replace.test.ts` `init replaces your commitlint file $file`. Real behavior; TTC-032 title; TTC-029: run init through the CLI; the template text keeps only level = "all" (TML-011).
- COMMITLINT_TAKEOVERS (test (test.each), 21-21): **rename** to `tests/integration/general/commits/replace.test.ts` `COMMITLINT_FILES`. TTC-021: the rows come from the file names
- native Commitlint discovery follows only the managed package field in %s (test (test.each), 52-104): **keep** to `tests/integration/general/commits/replace.test.ts` `commitlint reads the generated config through the package.json field gspot writes, in %s`. Real behavior; TTC-032 title; the template text keeps only level = "all" (TML-011); the level loop is test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- \['', 'app'\] (test (test.each), 52-52): **keep** to `tests/integration/general/commits/replace.test.ts` `['', 'app']`. Root and scope rows
- repository (const, 19-19): **delete**. TTC-021: buildSandboxPath(\['commitlint'\]) gives the PATH without an installed sandbox

## `tests/tools/configurations/general/dependencies/lockfiles.test.ts`

- (the file) (file): **merge** to `tests/integration/general/dependencies.test.ts`. One file per configuration: lockfiles and syncpack test the dependencies configuration
- native $name validates $lockfileName without changing repository inputs (test (test.each), 15-46): **keep** to `tests/integration/general/dependencies.test.ts` `dependencies/stale-lockfile reports a stale $lockfileName from $name and changes no file`. Real behavior; TTC-032 title; TTC-029: run it through gspot check.
- \[...NATIVE_LOCKFILES\] (test (test.each), 15-15): **rename** to `tests/integration/general/dependencies.test.ts` `LOCKFILES`. Glossary: no "native"

## `tests/tools/configurations/general/dependencies/syncpack.test.ts`

- (the file) (file): **merge** to `tests/integration/general/dependencies.test.ts`. One file per configuration; TTC-021
- initialization retires native Syncpack configuration $file (test (test.each), 15-57): **keep** to `tests/integration/general/dependencies.test.ts` `init replaces your Syncpack file $file and keeps syncpack.config.cts and .mts`. Real behavior; TTC-032 title; the template text keeps only level = "all" (TML-011).
- SYNCPACK_TAKEOVERS (test (test.each), 15-15): **rename** to `tests/integration/general/dependencies.test.ts` `SYNCPACK_FILES`. TTC-021
- tools (const, 13-13): **delete**. TTC-021: buildSandboxPath(\['syncpack'\]) gives the PATH

## `tests/tools/configurations/general/duplication.test.ts`

- (the file) (file): **move** to `tests/integration/general/duplication.test.ts`. tests/tools becomes tests/integration
- the duplication configuration (describe (describe), 20-64): **delete**. TTC-039: describe around a single test
- the duplication configuration &gt; a block copied between two files is a finding on the file that holds it (test (test), 21-63): **keep** to `tests/integration/general/duplication.test.ts` `a block copied between two files is a finding on the file that holds it`. Real behavior.
- checkDuplication (function, 14-18): **keep** to `tests/integration/general/duplication.test.ts` `checkDuplication`. Three callers

## `tests/tools/configurations/general/files.test.ts`

- (the file) (file): **move** to `tests/integration/general/files.test.ts`. TTC-002: the files cases and the yamllint test join it; TTC-026
- Taplo preserves default spacing across levels and accepts authored inline formatting (test (test), 13-37): **keep** to `tests/integration/general/files.test.ts` `Taplo fixes inline table spacing`. Real behavior; TTC-032 title; the fix gives the same result at both levels, so one fix run is the test (TGN-037).
- Taplo applies authored native inline formatting and returns to its default (test (test), 39-72): **keep** to `tests/integration/general/files.test.ts` `Taplo follows an extra tool option for compact inline tables and returns to its default without it`. Real behavior; TTC-032 title; the sample writes \[tools.taplo.extra\] with value = { compact_inline_tables = true } and reason = "..." (CFR-002).
- Schema validation finds nested Unicode paths through the real tool (test (test), 73-124): **keep** to `tests/integration/general/files.test.ts` `v8r validates a staged JSON file with a non-ASCII path against its schema`. Real behavior; TTC-032 title; the test writes a root \[\[tools.v8r.schema\]\] record into gspot.toml (paths = \["settings/café.json"\], url = the server schema URL) in place of gspot set with a JSON map (CFR-004).
- TOML parsing stays offline for explicit schema directives at both levels (test (test), 126-167): **keep** to `tests/integration/general/files.test.ts` `Taplo never downloads a schema named in a #:schema comment`. Real behavior; TTC-032 title; both levels give the same result, so one run proves Taplo never downloads the #:schema URL.
- testRepository (const, 11-11): **rename** to `tests/integration/general/files.test.ts` `installedSandbox`. Glossary: sandbox

## `tests/tools/configurations/general/format.test.ts`

- (the file) (file): **move** to `tests/integration/general/format.test.ts`. tests/tools becomes tests/integration
- formatter overrides drive CLI findings and correction without EditorConfig conflicts (test (test), 71-111): **keep** to `tests/integration/general/format.test.ts` `Prettier uses the format overrides, and an ignore on one path stops its findings until unignore`. Real behavior; TTC-032 title; CMD-092: unignore replaces ignore --remove
- EditorConfig leaves indentation to formatters and retains native file constraints at %s (test (test.each), 113-145): **keep** to `tests/integration/general/format.test.ts` `editorconfig-checker leaves indentation to the formatter and checks line endings, the final newline, and trailing spaces`. Real behavior; TTC-032 title; TTC-033: no change to the first test's gspot.toml
- levelSchema.options (test (test.each), 113-113): **delete**. TGN-037: the same result at both levels; run once at level all
- expectFormatterCorrection (function, 13-48): **inline** to `tests/integration/general/format.test.ts` `Prettier uses the format overrides, and an ignore on one path stops its findings until unignore`. One caller
- directory (const, 50-50): **rename** to `tests/integration/general/format.test.ts` `sandbox`. Glossary: sandbox, not directory
- applied (const, 51-51): **delete**. TTC-035: beforeAll already throws on a failed apply

## `tests/tools/configurations/general/gspot.test.ts`

- (the file) (file): **move** to `tests/integration/general/gspot.test.ts`. tests/tools becomes tests/integration (npm and uv run for real)
- an edited generated file and one holding merge markers are drift findings, and a fresh apply clears them (test (test), 25-77): **keep** to `tests/integration/general/gspot.test.ts` `gspot/generated-files reports an edited file and one with merge conflict markers, and apply clears both`. Real behavior; the check is gspot/generated-files.
- the drift runner rejects a manifest that does not run once (test (test), 79-90): **delete**. Tests a guard for a state that cannot happen (CKG-016).
- GENERATED_DRIFT_OPTIONS (const, 23-23): **inline** to `tests/integration/general/gspot.test.ts` `gspot/generated-files reports an edited file and one with merge conflict markers, and apply clears both`. TTC-035: one user left; buildRunOptions already sets checks

## `tests/tools/configurations/general/licenses.test.ts`

- (the file) (file): **move** to `tests/integration/general/licenses.test.ts`. tests/tools becomes tests/integration
- native license scanning accepts allowed alternatives and rejects a disallowed dependency (test (test), 43-88): **keep** to `tests/integration/general/licenses.test.ts` `licenses/allowed accepts an allowed license choice and reports a disallowed dependency`. Real behavior; TTC-032 title; the test runs gspot install (installToolProjects) in place of a hand-installed scanner tree. Values to config: LICENSED_PACKAGES = { kind: MIT, choice: MIT OR (...), combined: MIT AND (...) } (the node_modules package.json records) -&gt; tests/config/licenses.ts
- native Python license scanning ignores project scanner exclusions and matches an exception by its normalized name (test (test), 90-137): **keep** to `tests/integration/general/licenses.test.ts` `licenses/allowed reads installed Python packages, ignores the project's pip-licenses settings, and matches an allowed package by its normalized name`. Real behavior; TTC-032 title; the allowed package is \[\[licenses.allowed_package\]\] name = "Licensed.\_Example", version = "1.0.0", reason = "GPL-3.0-only. ...", whose reason names the license, without a license cross-check (TML-009). Values to config: PIP_LICENSES_PYPROJECT = '\[project\]\\nname = "fixture"...\[tool.pip-licenses\]...' -&gt; tests/config/licenses.ts; LICENSED_EXAMPLE_METADATA = 'Metadata-Version: 2.1\\nName: licensed-example...' -&gt; tests/config/licenses.ts
- native installed font metadata justifies its root exception in a descendant without a root manifest (test (test), 139-164): **keep** to `tests/integration/general/licenses.test.ts` `an allowed package at the root covers the same package in a scope with no package.json of its own at the root`. Real behavior; TTC-032 title; the test runs gspot install (installToolProjects); the sample has no runner = "mise" line (INX-003), writes \[\[licenses.allowed_package\]\] name = "@fontsource/inter", version = "5.2.8", reason = "OFL-1.1. ..." (TML-009), and its scope is \[\[scope\]\] path = "docs". Values to config: FONT_PACKAGE_FILES = docs/package.json and the @fontsource/inter package.json -&gt; tests/config/licenses.ts
- resources (const, 25-25): **delete**. The tests run the real gspot install in each sandbox (TTO-003), and installTree and copyInstalledModule go (THR-008), so the hand-installed scanner folder goes.
- installation (const, 26-26): **delete**. The tests run gspot install in place of publishing a hand-installed scanner tree, and installTree goes as a public step.

## `tests/tools/configurations/general/lychee.test.ts`

- (the file) (file): **move** to `tests/integration/general/docs.test.ts`. lychee tests the docs configuration (TTC-026).
- native documentation links keep offline, network, fragments and exclusions in their owning scopes (test (test), 38-85): **keep** to `tests/integration/general/docs.test.ts` `docs/lychee checks local links, and docs/lychee-external checks web links, fragments, and allowed URLs per scope`. Real behavior; TTC-032 title; the text-fragment results are the same at both levels, so expectTextFragments runs once (TGN-037).
- expectLinks (function, 14-28): **keep** to `tests/integration/general/docs.test.ts` `expectLinks`. Five callers
- expectTextFragments (function, 31-36): **keep** to `tests/integration/general/docs.test.ts` `expectTextFragments`. Two callers

## `tests/tools/configurations/general/markdown-docs-prose.test.ts`

- (the file) (file): **merge** to `tests/integration/general/prose/packages.test.ts`. TTC-001: the Vale dictionary recovery is a prose package test; the cases go to their configuration files
- the markdown, docs and prose configurations (describe (describe), 12-32): **delete**. TTC-039: describe around a single test
- the markdown, docs and prose configurations &gt; installation restores missing Vale dictionaries and the check accepts the restored styles (test (test), 13-31): **keep** to `tests/integration/general/prose/packages.test.ts` `gspot install restores deleted Vale dictionaries, and prose/vale passes again`. Real behavior; TTC-031, TTC-032 title.
- testRepository (const, 10-10): **rename** to `tests/integration/general/prose/packages.test.ts` `installedSandbox`. Glossary: sandbox; it selects prose only

## `tests/tools/configurations/general/prose/headings.test.ts`

- (the file) (file): **merge** to `tests/integration/general/prose/scopes.test.ts`. The banned-headings tests stay; TTC-018: one prose scope file with one setup.
- effective native heading lists (describe (describe), 91-100): **delete**. TTC-039: once the two level tests go, the describe wraps nothing.
- effective native heading lists &gt; recommended $name uses its effective heading list and shared styles (test (test.each), 92-95): **delete**. Duplicate: docs.banned_headings is root-only and the per-scope Vale config goes, so all four scope rows run the same vale.ini and expect the same result, and the kept child-only test checks the shipped banned heading at level all and not at recommended, plus the link-text rule.
- effective native heading lists &gt; HEADING_SCOPES.map((scope) =&gt; ({ ...scope, level: 'recommended' as const })) (test (test.each), 92-92): **delete**. Table of the deleted test above. Duplicate: docs.banned_headings is root-only and the per-scope Vale config goes, so all four scope rows run the same vale.ini and expect the same result, and the kept child-only test checks the shipped banned heading at level all and not at recommended, plus the link-text rule.
- effective native heading lists &gt; all $name uses its effective heading list and shared styles (test (test.each), 96-99): **delete**. Duplicate: docs.banned_headings is root-only and the per-scope Vale config goes, so all four scope rows run the same vale.ini and expect the same result, and the kept child-only test checks the shipped banned heading at level all and not at recommended, plus the link-text rule.
- effective native heading lists &gt; HEADING_SCOPES.map((scope) =&gt; ({ ...scope, level: 'all' as const })) (test (test.each), 96-96): **delete**. Table of the deleted test above. Duplicate: docs.banned_headings is root-only and the per-scope Vale config goes, so all four scope rows run the same vale.ini and expect the same result, and the kept child-only test checks the shipped banned heading at level all and not at recommended, plus the link-text rule.
- child-only native prose inputs (describe (describe), 102-143): **delete**. TTC-039: describe around a single test
- child-only native prose inputs &gt; %s retains shared styles with only child prose inputs (test (test.each), 103-142): **keep** to `tests/integration/general/prose/scopes.test.ts` `prose/vale runs only in the scope that selects prose and still reads the shared styles`. Real behavior; TTC-032 title; the one banned-headings test of the prose integration suite, with a shipped banned heading at level all only, since docs.banned_headings is root-only (TML-012); the scope is \[\[scope\]\] path = "child" configurations = \["prose", "docs"\].
- child-only native prose inputs &gt; \['recommended', 'all'\] as const (test (test.each), 103-103): **rename** to `tests/integration/general/prose/scopes.test.ts` `LEVELS`. banned-headings runs at level all only, so the result differs by level; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- directory (const, 19-19): **merge** to `tests/integration/general/prose/scopes.test.ts` `sandbox`. TTC-018: one setup for the scope tests; it runs gspot install in the sandbox (installToolProjects in tests/setup/install.ts, TTO-003) in place of an in-process installValePackages with a hand-built owner.
- checkHeadings (function, 51-89): **delete**. Dead: its test goes as a duplicate.

## `tests/tools/configurations/general/prose/ignores.test.ts`

- (the file) (file): **merge** to `tests/integration/general/prose/scopes.test.ts`. Path ignores of prose/vale join the scope file
- a path-specific Vale ignore retains findings elsewhere and reports its actual matches (test (test), 11-60): **keep** to `tests/integration/general/prose/scopes.test.ts` `a Vale ignore with a lint rule and a path keeps findings in other files and counts its matches`. Real behavior through the CLI (TTC-029); TTC-032 title

## `tests/tools/configurations/general/prose/packages.test.ts`

- (the file) (file): **move** to `tests/integration/general/prose/packages.test.ts`. tests/tools becomes tests/integration
- Vale package installation $name (test (test.each), 74-119): **split** to `tests/integration/general/prose/packages.test.ts` `Vale package install deletes a package gspot no longer ships; Vale package install replaces an edited package and keeps your files`. TTC-034 pattern: tests hidden in a table of callbacks become plain tests; the cloned-copy test goes, since without installTree its setup only writes different bytes into .gspot/vale, as the edited-package test does.
- \[ { name: 'replaces cloned bytes with the published package', verify: expectPublishedRules }, { name: 'deletes a (test (test.each), 74-78): **delete**. TTC-034 pattern: the table of callbacks goes
- installPackages (function, 18-33): **keep** to `tests/integration/general/prose/packages.test.ts` `installPackages`. Four callers; the helper runs gspot install in the sandbox (spawnGspot install), without installTree and the hand-built owner object (INX-006).
- expectPublishedRules (function, 35-48): **delete**. Dead: its one test, the cloned-copy test, is a duplicate of the edited-package test.
- expectPrunedRules (function, 50-63): **inline** to `tests/integration/general/prose/packages.test.ts` `Vale package install deletes a package gspot no longer ships`. One caller
- expectEditedRules (function, 65-72): **inline** to `tests/integration/general/prose/packages.test.ts` `Vale package install replaces an edited package and keeps your files`. One caller

## `tests/tools/configurations/general/prose/rules.test.ts`

- (the file) (file): **move** to `tests/integration/general/prose/scopes.test.ts`. TTC-018: rules and headings merge into one scope file
- %s preserves unique package rules at root and child scopes (test (test.each), 54-91): **keep** to `tests/integration/general/prose/scopes.test.ts` `prose/vale at level %s runs the gspot package rules without the Microsoft and Red Hat packages`. Real behavior: the result differs by level; TTC-032 title; every scope runs the one generated vale.ini, so the scope rows and their \[scope\] text go and the root runs once per level.
- \['recommended', 'all'\] as const (test (test.each), 54-54): **rename** to `tests/integration/general/prose/scopes.test.ts` `LEVELS`. TGN-037: one spelling of the level list; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- an authored rule ignore selects its scope without disabling the root rule (test (test), 93-111): **delete**. Duplicate of the kept test 'a Vale ignore with a lint rule and a path keeps findings in other files and counts its matches'.
- directory (const, 20-20): **rename** to `tests/integration/general/prose/scopes.test.ts` `sandbox`. Glossary: sandbox, not directory

## `tests/tools/configurations/general/prose/styles.test.ts`

- (the file) (file): **move** to `tests/integration/general/prose/styles.test.ts`. tests/tools becomes tests/integration
- Vale preserves ESLint delimiters while checking punctuation inside reasons and neighboring comments (test (test), 20-48): **keep** to `tests/integration/general/prose/styles.test.ts` `Vale's dashes rule checks the reason text of ESLint comments and skips the -- separator`. Real behavior; TTC-032 title.
- Vale accepts explicit minimum versions and still reports vague or redundant ranges (test (test), 50-80): **keep** to `tests/integration/general/prose/styles.test.ts` `Vale's version-range rule accepts a minimum version and reports vague ranges`. Real behavior; TTC-032 title.
- heading capitalization distinguishes ordinary edge from the browser name and rejects title case (test (test), 82-108): **keep** to `tests/integration/general/prose/styles.test.ts` `Vale's heading-case rule tells edge from Microsoft Edge and reports title case`. Real behavior; TTC-032 title; CFL-001: build the rule without Eta.
- Vale currency checks distinguish amounts from parameter text in $path (test (test.each), 110-129): **keep** to `tests/integration/general/prose/styles.test.ts` `Vale currency checks distinguish amounts from parameter text in $path`. Real behavior; TTC-014: use the generated vale.ini.
- \[...CURRENCY_CASES\] (test (test.each), 110-110): **keep** to `tests/integration/general/prose/styles.test.ts` `CURRENCY_CASES`. The table
- generated recommended Vale configuration reports unhelpful link text and accepts the destination name (test (test), 131-159): **keep** to `tests/integration/general/prose/styles.test.ts` `the generated vale.ini at level recommended reports link text such as here`. Real behavior; TTC-032 title.
- Vale $rule checks report prose findings and accept source notation (test (test.each), 161-184): **keep** to `tests/integration/general/prose/styles.test.ts` `Vale $rule checks report prose findings and accept source notation`. Real behavior; TTC-014: use the generated vale.ini.
- \[...STYLE_CASES\] (test (test.each), 161-161): **keep** to `tests/integration/general/prose/styles.test.ts` `STYLE_CASES`. The table

## `tests/tools/configurations/general/prose/vale.test.ts`

- (the file) (file): **move** to `tests/integration/general/prose/vale.test.ts`. The prose/vale case joins it
- 'native Vale reports its ${extension} finding and passes after the fix' (test (test), 15-32): **keep** to `tests/integration/general/prose/vale.test.ts` ``prose/vale reports a finding in a .${extension} file and passes after the fix``. Real behavior; TTC-032 title; only the sh run stays, since the prose/vale case in the same file (docs/selling.md) already reports a Markdown finding and passes after the fix.
- Vale parses Markdown in %s comments without treating source strings as prose (test (test.each), 35-75): **keep** to `tests/integration/general/prose/vale.test.ts` `Vale parses Markdown in %s comments without treating source strings as prose`. Real behavior.
- \[ \['ts', '//', 'const text = "delve";'\], \['mts', '//', 'const text = "delve";'\], \['py', '#', 'text = "delve" (test (test.each), 35-39): **keep** to `tests/integration/general/prose/vale.test.ts` `[['ts', ...], ['mts', ...], ['py', ...]]`. The table
- Vale retains the grammar and scope paths for %s stdin (test (test.each), 77-114): **keep** to `tests/integration/general/prose/vale.test.ts` `prose/vale keeps the language and the scope path of a .%s file it sends on stdin`. Real behavior; TTC-032 title.
- \[ \['mts', '//', 'const text = "delve";'\], \['cts', '//', 'const text = "delve";'\], \['mjs', '//', 'const text (test (test.each), 77-83): **keep** to `tests/integration/general/prose/vale.test.ts` `[['mts', ...], ['cts', ...], ['mjs', ...], ['cjs', ...], ['', ...]]`. The table

## `tests/tools/configurations/general/prose/vocabulary.test.ts`

- (the file) (file): **merge** to `tests/integration/general/prose/styles.test.ts`. The vocabulary test is about the shipped Vale styles and words
- $level native vocabulary accepts selected scoped products and reports a misspelling in "$scope" (test (test.each), 11-51): **keep** to `tests/integration/general/prose/styles.test.ts` `Vale accepts the words listed in gspot.toml and reports a misspelling in scope "$scope"`. Real behavior; TTC-014: generated vale.ini; TTC-032 title; the sample writes allowed_words = { value = \["NebulaProduct"\], reason = "The project product." } (TMF-007) and \[\[scope\]\] path = "app" configurations = \["sql"\].
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; \['', 'app'\].map((scope) =&gt; ({ level, scope }))) (test (test.each), 11-11): **rename** to `tests/integration/general/prose/styles.test.ts` `['', 'app']`. TGN-037: the level makes no difference; keep the scope rows

## `tests/tools/configurations/general/secrets/environment.test.ts`

- (the file) (file): **move** to `tests/integration/general/secrets/env-examples.test.ts`. TTC-026, NMU-024: the env example checks of the secrets configuration
- environment checks in the secrets configuration (describe (describe), 9-24): **delete**. TTC-039: describe around a single test
- environment checks in the secrets configuration &gt; the pinned dotenv fixer corrects the tracked environment template (test (test), 12-23): **keep** to `tests/integration/general/secrets/env-examples.test.ts` `dotenv-linter fixes a lowercase key in .env.example`. Real behavior; TTC-002: runs on the file's one sandbox.

## `tests/tools/configurations/general/secrets/files.test.ts`

- (the file) (file): **merge** to `tests/integration/general/secrets/gitleaks.test.ts`. TTC-026: it tests gitleaks too
- a folder with no git scans its files for secrets, and a git repository scans its changes instead (test (test), 26-61): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `the secrets checks scan the files of a folder without Git, and the staged changes once Git exists`. Real behavior; TTC-032 title.
- SECRETS_FILES_POLICY (const, 18-18): **inline** to `tests/integration/general/secrets/gitleaks.test.ts` `the secrets checks scan the files of a folder without Git, and the staged changes once Git exists`. One use
- secretChecks (function, 20-24): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `secretChecks`. Three callers; TTC-035: drop the RunOptions variable

## `tests/tools/configurations/general/secrets/gitleaks-output.test.ts`

- (the file) (file): **move** to `tests/integration/general/secrets/gitleaks.test.ts`. TTC-026: named after the tool
- native file reports retain mixed redacted rules and comma filenames and pass after the fix (test (test), 60-75): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `gitleaks reports both secrets in files, hides the tokens, and passes after the fix`. Real behavior; TTC-032 title.
- native staged reports retain mixed redacted rules and comma filenames and pass after the fix (test (test), 77-100): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `gitleaks reports both staged secrets, hides the tokens, and passes after the fix`. Real behavior; TTC-032 title.
- native history reports retain mixed redacted rules and comma filenames only in the selected commits (test (test), 102-120): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `the pushed-history check reports the secrets of the pushed commits only`. Real behavior; TTC-032 title.
- native history accepts only the exact reviewed fingerprints without disclosing either token (test (test), 122-156): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `the pushed-history check passes only the ignored fingerprints and never prints a token`. Real behavior; TTC-032 title.
- native %s file fingerprints retain exact ignores in a no-Git scratch copy (test (test.each), 158-210): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `an ignore of one gitleaks fingerprint works at the %s and in a scratch copy without Git`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["secrets"\].
- FILE_SCOPES (test (test.each), 158-158): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `FILE_SCOPES`. The table
- native file findings respect an %s fingerprint expiry (test (test.each), 212-233): **delete**. TTC-008: the unit tests cover ignore expiry; ignore --until itself stays.
- FILE_EXPIRIES (test (test.each), 212-212): **delete**. Table of the deleted test above (TTC-008).
- prepareSecrets (function, 21-27): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `prepareSecrets`. Three callers
- prepareHistory (function, 29-43): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `prepareHistory`. Two callers
- expectSecretFindings (function, 46-58): **keep** to `tests/integration/general/secrets/gitleaks.test.ts` `expectSecretFindings`. Three callers

## `tests/tools/configurations/general/secrets/pushed.test.ts`

- (the file) (file): **move** to `tests/integration/general/secrets/trufflehog.test.ts`. Named after the tool (TTC-026); the fake-tool rows are deleted (weak, TTC-008), so nothing goes to the unit suite.
- $name (test (test.each), 94-133): **keep** to `tests/integration/general/secrets/trufflehog.test.ts` `TruffleHog verifies the secrets of every pushed commit and never prints them`. Real behavior: the real-tool row stays as a plain test; the malformed and crashed rows, which run a fake TruffleHog, go (TTC-008).
- SECRET_VERIFICATION_CASES (test (test.each), 94-94): **delete**. Weak: its malformed and crashed rows run a fake TruffleHog (TTC-008), and one row is left, so no table.
- prepareSecretHistory (function, 21-41): **move** to `tests/integration/general/secrets/trufflehog.test.ts` `prepareSecretHistory`. The unit-suite rows are deleted (weak, TTC-008), so one test file uses it.
- createSecretVerifier (function, 44-92): **keep** to `tests/integration/general/secrets/trufflehog.test.ts` `createSecretVerifier`. The real-tool test; the mode file goes with the deleted fake-tool rows (TTC-008); the verify endpoint is added at run time. Values to config: TRUFFLEHOG_DETECTORS = { detectors: \[{ name: 'GspotAcceptance', keywords: \[...\], regex: {...} }\] } -&gt; tests/config/secrets.ts

## `tests/tools/configurations/general/secrets/semgrep.test.ts`

- (the file) (file): **move** to `tests/integration/general/security/sensitive-data.test.ts`. Semgrep belongs to the security configuration (TTC-026).
- sensitive data rules detect logger values and UserDefaults instances at level %s (test (test.skipIf), 17-52): **keep** to `tests/integration/general/security/sensitive-data.test.ts` `Semgrep reports secrets in log calls and UserDefaults, and passes after the fix`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.skipIf), 17-17): **delete**. TGN-037: the same findings at both levels; run once at level all
- !hasToolBuild('semgrep') (test (test.skipIf), 17-17): **keep** to `tests/integration/general/security/sensitive-data.test.ts` `!hasToolBuild('semgrep')`. SUP-022: needed, decided by the pin

## `tests/tools/configurations/general/security.test.ts`

- (the file) (file): **move** to `tests/integration/general/security/semgrep.test.ts`. One Semgrep file of the security configuration (TTO-006 merges the other Semgrep tests into it)
- malformed Bash source is a positioned finding and its correction passes (test (test.skipIf), 12-37): **keep** to `tests/integration/general/security/semgrep.test.ts` `Semgrep reports a Bash file it cannot parse as a finding at its position`. Real behavior; TTC-032 title.
- !hasToolBuild('semgrep') (test (test.skipIf), 12-12): **keep** to `tests/integration/general/security/semgrep.test.ts` `!hasToolBuild('semgrep')`. SUP-022: needed

## `tests/tools/configurations/general/site.test.ts`

- (the file) (file): **move** to `tests/integration/framework/site.test.ts`. Site is a framework configuration (CKG-029).
- the site configuration (describe (describe), 33-42): **delete**. TTC-039: describe around a single test
- the site configuration &gt; the default check inspects the built site without selecting external links (test (test), 34-41): **delete**. Weak: only checks exit code 0, a passed build and one configured value, the manual stage of site/linkinator-external; the unit test 'a manual check runs only when --only names it' covers manual checks.
- site links (describe (describe), 94-96): **delete**. TTC-039: describe around a single test
- site links &gt; native $name output reports its finding and passes after the fix (test (test.each), 95-95): **merge** to `tests/integration/framework/site.test.ts` `$check reports its finding in the built site and passes after the fix`. The same test body over another table; one table runs both
- site links &gt; LINK_CASES (test (test.each), 95-95): **merge** to `tests/integration/framework/site.test.ts` `OUTPUT_CASES`. One table
- site markup and selectors (describe (describe), 98-100): **delete**. TTC-039: describe around a single test
- site markup and selectors &gt; native $name output reports its finding and passes after the fix (test (test.each), 99-99): **keep** to `tests/integration/framework/site.test.ts` `$check reports its finding in the built site and passes after the fix`. Real behavior; TTC-033: restore gspot.toml and build.js; TTC-032 title.
- site markup and selectors &gt; OUTPUT_CASES (test (test.each), 99-99): **keep** to `tests/integration/framework/site.test.ts` `OUTPUT_CASES`. The table
- native SVG optimization enforces both level thresholds and explicit file selection (test (test), 162-176): **keep** to `tests/integration/framework/site.test.ts` `svgo enforces the saving limit of each level and checks only the files named`. Real behavior; TTC-032 title.
- testRepository (const, 31-31): **rename** to `tests/integration/framework/site.test.ts` `installedSandbox`. Glossary: sandbox
- inspectSiteOutput (function, 43-92): **inline** to `tests/integration/framework/site.test.ts` `$check reports its finding in the built site and passes after the fix`. One caller once the tables merge. Values to config: SITE_PAGE_HEAD = '&lt;!DOCTYPE html&gt;&lt;html lang="en"&gt;&lt;head&gt;&lt;meta charset="utf-8"&gt;&lt;title&gt;Example&lt;/title&gt;&lt;/head&gt;&lt;body&gt;' -&gt; tests/config/site.ts
- expectSvgThresholds (function, 103-140): **inline** to `tests/integration/framework/site.test.ts` `svgo enforces the saving limit of each level and checks only the files named`. One caller
- expectSvgSelection (function, 143-160): **inline** to `tests/integration/framework/site.test.ts` `svgo enforces the saving limit of each level and checks only the files named`. One caller

## `tests/tools/configurations/general/spelling.test.ts`

- (the file) (file): **move** to `tests/integration/general/spelling.test.ts`. tests/tools becomes tests/integration
- native spelling file-type allowances preserve unrelated findings and neighboring files at level all (test (test), 18-56): **keep** to `tests/integration/general/spelling.test.ts` `typos file-type word allowances apply only to their files at level all`. Real behavior; TTC-014: run through gspot check; TTC-032 title; the sample writes \[tools.typos.extra\] with value = { type = { fixture = { extend-glob = \["fixture.txt"\], extend-words = { colour = "..." }, extend-identifiers = { IIFEs = "IIFEs" } } } } and reason = "...", each inline table on one line (CFR-002).
- spelling locales and word allowances remain scoped in generated configurations at level all (test (test), 58-108): **keep** to `tests/integration/general/spelling.test.ts` `typos locale and word allowances stay in their scope at level all`. Real behavior; TTC-014; TTC-032 title; the sample writes \[\[scope\]\] path = "british" with spelling.locale = "en-gb" and tools.typos.extra = { value = { default = {...}, type = { upstream = {...} } }, reason = "..." } (CFR-002), and \[\[scope\]\] path = "british/child".
- spelling exclusions $patterns report the same files in a scope configuration (test (test.each), 110-160): **keep** to `tests/integration/general/spelling.test.ts` `spelling ignore paths $patterns exclude the same files in the root and scope tool files`. Real behavior; TTC-014; TTC-032 title; the stringified settings write scope as a list of records (scope: \[{ path: "nested" }, { path: "nested/child" }\]), and the \[\[ignore\]\] paths are written from the repository root (CFR-003).
- SPELLING_EXCLUSIONS (test (test.each), 110-110): **keep** to `tests/integration/general/spelling.test.ts` `SPELLING_EXCLUSIONS`. The table

## `tests/tools/configurations/general/structure.test.ts`

- (the file) (file): **move** to `tests/integration/general/structure.test.ts`. tests/tools becomes tests/integration
- suppression detection agrees with Ruff on every directive form and placement (test (test), 12-42): **keep** to `tests/integration/general/structure.test.ts` `suppression detection agrees with Ruff on every noqa comment form and place`. Compares gspot's parser with the tool on purpose (TTC-014); TTC-032 title
- shared suppression detection preserves Vale directives while excluding documented examples (test (test), 44-81): **keep** to `tests/integration/general/structure.test.ts` `suppression detection finds Vale comments and skips documented examples`. TTC-014; TTC-032 title; CONCRETE_RULE comes from tests/config/prose.ts.

## `tests/tools/configurations/general/yaml.test.ts`

- (the file) (file): **merge** to `tests/integration/general/files.test.ts`. yamllint belongs to the files configuration (TTC-026).
- native YAML keeps scoped options and formatter width through recommended/all transitions (test (test), 32-56): **keep** to `tests/integration/general/files.test.ts` `yamllint applies each scope's lint rule options, and Prettier keeps two-space YAML`. Real behavior; TTC-032 title; every level gives the same yamllint and Prettier results, so one pass is the test (TGN-037).
- expectYamlFiles (function, 18-30): **keep** to `tests/integration/general/files.test.ts` `expectYamlFiles`. Three callers

## `tests/tools/configurations/infra/ansible.test.ts`

- (the file) (file): **move** to `tests/integration/infrastructure/ansible.test.ts`. NMU-009: infra becomes infrastructure; the ansible case joins it
- Ansible detects configless projects and lints each selected scope at level %s (test (test.skipIf), 16-56): **keep** to `tests/integration/infrastructure/ansible.test.ts` `init detects Ansible without ansible.cfg, and ansible-lint checks each scope`. Real behavior; TTC-032 title; TTC-029: run through the CLI; the scope is \[\[scope\]\] path = "app" configurations = \["ansible"\].
- levelSchema.options (test (test.skipIf), 16-16): **delete**. TGN-037: the same result at both levels; run once at level all
- !hasToolBuild('ansible-lint') (test (test.skipIf), 16-16): **keep** to `tests/integration/infrastructure/ansible.test.ts` `!hasToolBuild('ansible-lint')`. SUP-022: needed, decided by the pin
- Ansible applies the %s profile beside root and child configuration files (test (test.skipIf), 58-112): **keep** to `tests/integration/infrastructure/ansible.test.ts` `ansible-lint uses the profile of level %s next to the root and scope ansible.cfg files`. Real behavior; TTC-007: delete the argv spy assertion; the scope is \[\[scope\]\] path = "app" configurations = \["ansible"\].
- levelSchema.options (test (test.skipIf), 58-58): **keep** to `tests/integration/infrastructure/ansible.test.ts` `levelSchema.options`. The profile differs by level
- !hasToolBuild('ansible-lint') (test (test.skipIf), 58-58): **keep** to `tests/integration/infrastructure/ansible.test.ts` `!hasToolBuild('ansible-lint')`. SUP-022: needed

## `tests/tools/configurations/infra/docker/generation.test.ts`

- (the file) (file): **merge** to `tests/integration/infrastructure/docker.test.ts`. TTC-026: it tests Trivy and Hadolint scopes, not generation; one docker file
- Docker configuration scans isolate deepest scopes and retain scoped advisory exceptions (test (test), 12-50): **keep** to `tests/integration/infrastructure/docker.test.ts` `Trivy checks each Dockerfile in its deepest scope and honors an ignore limited to a scope path`. Real behavior; TTC-032 title; the \[\[ignore\]\] stays at the root with paths = \["app/\*\*"\] (CFR-004). Values to config: ROOT_USER_DOCKERFILE = 'FROM node:22.11.0-bookworm-slim\\nWORKDIR /app\\nUSER root\\n...' -&gt; tests/config/docker.ts; TRIVY_SCOPE_SETTINGS = three \[\[scope\]\] records (app, app/child, sibling) and the root \[\[ignore\]\] -&gt; tests/config/docker.ts
- Hadolint keeps apt and apk version checks only at level %s in root and child scopes (test (test.each), 52-94): **keep** to `tests/integration/infrastructure/docker.test.ts` `Hadolint checks apt and apk version pins only at level all, in the root and a scope`. Real behavior; TTC-014: run through gspot check; the scope is \[\[scope\]\] path = "app" configurations = \["docker"\]. Values to config: DEBIAN_DOCKERFILE = the pinned apt sample -&gt; tests/config/docker.ts; ALPINE_DOCKERFILE = the pinned apk sample -&gt; tests/config/docker.ts
- levelSchema.options (test (test.each), 52-52): **keep** to `tests/integration/infrastructure/docker.test.ts` `levelSchema.options`. The result differs by level
- Trivy scans only Dockerfiles at level %s in root and child scopes (test (test.each), 96-140): **delete**. Weak: it copies a value from the code under test, a hand-typed Trivy command whose own --misconfig-scanners dockerfile gives the 'only Dockerfiles' result (TTC-014); the kept Trivy scope test runs docker/trivy-config through gspot.
- levelSchema.options (test (test.each), 96-96): **delete**. TGN-037: the same result at both levels; run once at level all

## `tests/tools/configurations/infra/docker/image.test.ts`

- (the file) (file): **merge** to `tests/integration/infrastructure/docker.test.ts`. TTC-026: one docker file
- native image reports distinguish a generated test key, invalid configuration, and a clean image (test (test.skipIf), 26-71): **keep** to `tests/integration/infrastructure/docker.test.ts` `docker/trivy-image reports a private key in an image, errors on a broken tool file, and passes a clean image`. Real behavior; TTC-032 title.
- !hasLinuxDocker() (test (test.skipIf), 26-26): **rename** to `tests/integration/infrastructure/docker.test.ts` `isLinux`. SUP-008: skip off Linux, fail when Docker is down on Linux
- importImage (function, 16-24): **keep** to `tests/integration/infrastructure/docker.test.ts` `importImage`. Two callers

## `tests/tools/configurations/infra/github-actions.test.ts`

- (the file) (file): **move** to `tests/integration/infrastructure/github-actions.test.ts`. NMU-009; the github-actions cases join it
- the github-actions configuration (describe (describe), 22-54): **delete**. TTC-039: describe around a single test
- the github-actions configuration &gt; GitHub initialization writes a workflow accepted by actionlint (test (test), 23-53): **keep** to `tests/integration/infrastructure/github-actions.test.ts` `the generated GitHub workflow passes actionlint`. Real behavior; TTC-023: delete the createFileTree assertion and the stale comment; init takes no --ci, so after init the test runs gspot set ci.enabled true, with github as the default provider (TML-015, CLX-001).
- Actionlint validates required reusable inputs in self-repository workflows and preserves authored files (test (test), 64-93): **keep** to `tests/integration/infrastructure/github-actions.test.ts` `actionlint reports a missing required input of a same-repository reusable workflow and keeps your files`. Real behavior; TTC-032 title. Values to config: CALLED_WORKFLOW = the reusable workflow with a required greeting input -&gt; tests/config/github-actions.ts
- Actionlint resolves a self-repository alias and reports a missing workflow before correction (test (test), 95-121): **keep** to `tests/integration/infrastructure/github-actions.test.ts` `actionlint follows a YAML alias to a same-repository workflow and reports it missing until it exists`. Real behavior; TTC-032 title.
- Zizmor audits composite actions without duplicating pinact at level %s (test (test.each), 123-180): **keep** to `tests/integration/infrastructure/github-actions.test.ts` `zizmor checks composite actions in the root and a scope`. Real behavior; TTC-032 title; no runner = "mise" line (INX-003), and the scope is \[\[scope\]\] path = "app" configurations = \["github-actions"\]. Values to config: COMPOSITE_ACTION = the zizmor composite action sample -&gt; tests/config/github-actions.ts; CHECKOUT_WORKFLOW = the zizmor workflow sample -&gt; tests/config/github-actions.ts
- levelSchema.options (test (test.each), 123-123): **delete**. TGN-037: the same result at both levels; run once at level all
- runActionlint (function, 57-61): **keep** to `tests/integration/infrastructure/github-actions.test.ts` `runActionlint`. Four callers; TTC-029: run the check through the CLI

## `tests/tools/configurations/infra/nginx.test.ts`

- (the file) (file): **move** to `tests/integration/infrastructure/nginx.test.ts`. NMU-009: infra becomes infrastructure
- nginx -t follows include globs to the source line and tells invalid configuration from a missing container (test (test.skipIf), 23-70): **keep** to `tests/integration/infrastructure/nginx.test.ts` `nginx -t follows include globs to the source line and tells invalid configuration from a missing container`. Real behavior. Values to config: NGINX_INCLUDE_FILES = proxy/nginx.conf, tls#local.conf and unrelated.conf -&gt; tests/config/nginx.ts
- !hasLinuxDocker() (test (test.skipIf), 23-23): **rename** to `tests/integration/infrastructure/nginx.test.ts` `isLinux`. SUP-008: skip off Linux, fail when Docker is down on Linux
- the nginx configuration (describe (describe), 72-98): **delete**. TTC-039: describe around a single test
- the nginx configuration &gt; gixy finds the forged proxy target and passes after the fix (test (test.skipIf), 73-97): **keep** to `tests/integration/infrastructure/nginx.test.ts` `gixy finds the forged proxy target and passes after the fix`. Real behavior.
- the nginx configuration &gt; !hasToolBuild('gixy') (test (test.skipIf), 73-73): **keep** to `tests/integration/infrastructure/nginx.test.ts` `!hasToolBuild('gixy')`. SUP-022: needed
- NGINX_POLICY (const, 18-21): **keep** to `tests/integration/infrastructure/nginx.test.ts` `NGINX_POLICY`. Used three times in the nginx -t test; computed by calling buildPolicy, so it stays in the test. Values to config: NGINX_SCOPE_SETTINGS = the settings text it passes, with \[\[scope\]\] path = "proxy" and tools.nginx.image = "nginx:1.29.3-alpine" -&gt; tests/config/nginx.ts

## `tests/tools/configurations/language/bash/bats.test.ts`

- (the file) (file): **merge** to `tests/integration/language/bash/syntax.test.ts`. The Bats syntax requirement is a syntax-check behavior; the bash file passes 300 lines and splits by behavior
- %s allows syntax checks on stock macOS Bash and reports the Bats version prerequisite (test (test.skipIf), 13-52): **keep** to `tests/integration/language/bash/syntax.test.ts` `with macOS Bash 3.2, bash-syntax runs and bats-syntax reports Bash 4.4 as missing`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.skipIf), 13-13): **delete**. TGN-037: the same result at both levels; run once at level all
- !isMacos (test (test.skipIf), 13-13): **keep** to `tests/integration/language/bash/syntax.test.ts` `!isMacos`. SUP-022: needs the stock macOS Bash 3.2

## `tests/tools/configurations/language/bash/lifecycle.test.ts`

- (the file) (file): **split** to `tests/integration/check.test.ts; tests/unit/cli/commands/ignore.test.ts`. TTC-026: lifecycle says nothing; TTC-007: the two ignore tests move back to the unit suite
- a missing tool fails with the install hint (test (test), 17-61): **move** to `tests/integration/check.test.ts` `a check whose tool is not installed fails with the pinned version and the install command`. A check flow, not one configuration, that needs the real ShellCheck; TTC-032 title; the one end-to-end test of a missing tool: init ends with "run gspot install" and takes no hooks option (CLX-001), and with no mise on PATH the check reports shellcheck &lt;version&gt; as missing with "Run: gspot install" (INX-006).
- a global ignore stops a command check and its correction command until removed (test (test), 63-92): **move** to `tests/unit/cli/commands/ignore.test.ts` `an ignore without paths stops a command check and its fixer until unignore`. TTC-007, TTO-005: back to the unit suite with the Node QUALITY_COMMAND; unignore (CMD-092); the check is \[\[command_check\]\] name = "project/quality" with the same command, fix, paths and stage.
- an ignored folder includes descendants while a negated file remains enforced (test (test), 94-139): **move** to `tests/unit/cli/commands/ignore.test.ts` `an ignored folder covers its subfolders, and a negated file in it is still checked`. TTC-007, TTO-005: no installed tool; unignore with --paths takes those paths out of the entry, so the last step expects the negated file's neighbor to be reported again (CLX-011).

## `tests/tools/configurations/language/bash/loops.test.ts`

- (the file) (file): **merge** to `tests/integration/language/bash/size.test.ts`. The loop counts are a Bash size behavior
- native Bash counts include C-style branches and nesting while omitting loop header assignments in each scope (test (test), 10-51): **keep** to `tests/integration/language/bash/size.test.ts` `Bash function-size counts C-style loops as branches and nesting, not their header assignments, in each scope`. Real behavior; TTC-032 title; no runner = "mise" line (INX-003), \[limits.bash\] keeps its one-language form (TML-007), and the scope is \[\[scope\]\] path = "api".

## `tests/tools/configurations/language/bash/shellcheck.test.ts`

- (the file) (file): **move** to `tests/integration/language/bash/shellcheck.test.ts`. The SC2086 case joins it
- %s preserves native shell dialect diagnostics, one cd owner, and source bytes (test (test.each), 11-62): **keep** to `tests/integration/language/bash/shellcheck.test.ts` `ShellCheck reports dialect findings by shebang and an unchecked cd, and changes no file`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "app".
- \['recommended', 'all'\] as const (test (test.each), 11-11): **delete**. TGN-037: the same result at both levels; run once at level all

## `tests/tools/configurations/language/bash/syntax.test.ts`

- (the file) (file): **split** to `tests/integration/language/bash/syntax.test.ts; tests/unit/cli/execution/command/check.test.ts`. The tool-free tests move to the unit suite (TTC-008, TTO-005); the settings tests and the weak level-switch test go (TTC-007), and so does the declaration test (CFR-005, TMF-003).
- $check accepts clean files and reports syntax in $path (test (test.each), 19-60): **move** to `tests/integration/language/bash/syntax.test.ts` `$check accepts clean files and reports syntax in $path`. Real behavior (pinned Bats). Values to config: SYNTAX_FILES = script.sh, launcher, script.zsh, zlauncher and script.bats as written in the body -&gt; tests/config/bash/tools.ts
- isPosix ? SYNTAX_CASES : SYNTAX_CASES.slice(0, 1) (test (test.each), 19-19): **move** to `tests/integration/language/bash/syntax.test.ts` `isWindows ? SYNTAX_CASES.slice(0, 1) : SYNTAX_CASES`. A needed skip (SUP-022: no Zsh or Bats on Windows), spelled with isWindows.
- Bash findings retain newline and colon directory names without Git (test (test.skipIf), 62-77): **move** to `tests/unit/cli/execution/command/check.test.ts` `a command check reports files whose folder name has a colon`. TTC-008: no installed tool; drop the newline name and keep the colon name.
- !isPosix (test (test.skipIf), 62-62): **move** to `tests/unit/cli/execution/command/check.test.ts` `isWindows`. Skip condition, spelled isWindows: Windows forbids a colon in a file name.
- switching levels preserves finding checks and selects stricter naming checks (test (test), 79-124): **delete**. Weak: tool-free level switching (TGN-037); the kept tests 'nextjs/build builds the app at level all and is not run at level recommended' and 'switching levels restores generated defaults and agent rules' cover level selection.
- $kind directories return to source checks when their declaration is removed (test (test.each), 126-154): **delete**. Every case sets and removes a deleted key: CFR-005 deletes \[\[generated\]\] and \[\[vendored\]\] and TMF-003 the root exclude.
- DECLARATION_CASES (test (test.each), 126-126): **delete**. Table of the deleted test above (CFR-005, TMF-003).
- command checks retain nested inputs and report their findings once at the root (test (test), 156-173): **move** to `tests/unit/cli/execution/command/check.test.ts` `a command check at the root checks a changed file of a child scope once`. TTC-008: no installed tool; TTC-032 title; the check is \[\[command_check\]\] name = "project/syntax" with the same command, paths and stage.
- placeholder reasons and omitted tool-option reasons are refused without a policy write (test (test), 175-204): **delete**. TTC-007: repeats the set and reason tests of the unit suite
- a nested unknown setting is a finding at its key path (test (test), 206-218): **delete**. TTC-007: repeats the settings reader tests
- a loosening without a reason is a finding of gspot/policy, and the rest of the policy runs (test (test), 220-242): **delete**. TTC-007: repeats the settings reader and check tests

## `tests/tools/configurations/language/css.test.ts`

- (the file) (file): **move** to `tests/integration/language/css.test.ts`. tests/tools becomes tests/integration
- %s Stylelint applies scoped native options without enabling additional checks (test (test.each), 38-78): **keep** to `tests/integration/language/css.test.ts` `Stylelint at level %s applies each scope's lint rule options and no other lint rules`. Real behavior: the result differs by level; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 38-38): **rename** to `tests/integration/language/css.test.ts` `LEVELS`. TGN-037: one spelling of the level list; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- Stylelint editor discovery lints authored build paths with the scoped options (test (test), 80-99): **keep** to `tests/integration/language/css.test.ts` `Stylelint run by an editor finds the scope's tool file and checks your build folder`. Real behavior; TTC-014 keeps this raw tool run on purpose; TTC-032 title.
- %s recognizes Tailwind only within its declared project (test (test.each), 101-140): **keep** to `tests/integration/language/css.test.ts` `Stylelint accepts Tailwind syntax only in the scope that declares Tailwind`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 101-101): **delete**. TGN-037: the same result at both levels; run once at level all
- resources (const, 21-21): **keep** to `tests/integration/language/css.test.ts` `resources`. Disposes the sandbox
- root (const, 22-22): **keep** to `tests/integration/language/css.test.ts` `root`. The sandbox path

## `tests/tools/configurations/language/javascript/checks.test.ts`

- (the file) (file): **move** to `tests/integration/language/javascript/eslint.test.ts`. NMU-075: a file name that says what it tests; TTC-031 header comment
- javascript/eslint lints a project that has no TypeScript (test (test), 12-42): **keep** to `tests/integration/language/javascript/eslint.test.ts` `javascript/eslint lints a project that has no TypeScript`. Real behavior; TTC-002: runs on the file's one sandbox.

## `tests/tools/configurations/language/javascript/compiler-ownership.test.ts`

- (the file) (file): **split** to `tests/integration/language/javascript/jsconfig.test.ts; tests/unit/cli/tools/find/programs.test.ts`. TTC-008: the inspectTool tests need no installed tool; TTC-026: the rest joins jsconfig
- %s JavaScript uses its pinned private compiler when no project compiler exists (test (test.skipIf), 21-73): **move** to `tests/integration/language/javascript/jsconfig.test.ts` `javascript/tsc uses gspot's own TypeScript when the project has none`. Real behavior; TTC-010, TTC-011: one installCompiler helper; TTC-032 title; the inspectTool assertion goes, since the report's command path (.gspot/node_modules/.bin/tsc) already proves the private compiler ran (TTC-029).
- \['recommended', 'all'\] as const (test (test.skipIf), 21-21): **delete**. TGN-037: the same result at both levels; run once at level all
- !isPosix (test (test.skipIf), 21-21): **delete**. TTC-010: the skip came from a hand-made POSIX tsc link, and installCompiler works on Windows.
- project and snapshot compilers retain ownership while pending private installations remain explicit (test (test.skipIf), 75-118): **move** to `tests/unit/cli/tools/find/programs.test.ts` `inspectTool finds the project compiler, and the original repository's compiler from a scratch copy`. TTC-008: calls inspectTool in-process with no installed tool; gspot installs straight into .gspot/, so the pending-install part goes; the expected state is system.
- !isPosix (test (test.skipIf), 75-75): **delete**. TTC-010: the skip came from a hand-made POSIX link.
- cached private compiler inspections respect installation transitions and unrelated Python work (test (test.skipIf), 120-162): **delete**. It tests the installing state, which goes because gspot installs straight into .gspot/; the scratch-copy lookup stays in the project-compiler test.
- !isPosix (test (test.skipIf), 120-120): **delete**. TTC-010: the skip came from a hand-made POSIX link.

## `tests/tools/configurations/language/javascript/jsconfig.test.ts`

- (the file) (file): **move** to `tests/integration/language/javascript/jsconfig.test.ts`. The private-compiler test joins it (TTC-026)
- '%s JavaScript checks ${entry.name} and keeps authored inputs' (test (test.skipIf), 21-64): **keep** to `tests/integration/language/javascript/jsconfig.test.ts` `javascript/tsc checks ${entry.name} and keeps your files`. Real behavior; TTC-032 title; TTC-011: installCompiler.
- \['recommended', 'all'\] as const (test (test.skipIf), 21-21): **delete**. TGN-037: the same result at both levels; run once at level all
- !isPosix (test (test.skipIf), 21-21): **delete**. TTC-010: the skip came from a hand-made POSIX link.

## `tests/tools/configurations/language/javascript/projects.test.ts`

- (the file) (file): **move** to `tests/integration/language/javascript/projects.test.ts`. tests/tools becomes tests/integration
- JavaScript checking includes authored build directories at level all (test (test), 24-48): **keep** to `tests/integration/language/javascript/projects.test.ts` `javascript/tsc at level all also checks your build and dist folders`. Real behavior; TTC-032 title; the sandbox marks emitted/\*\* linguist-generated in .gitattributes (CFR-005), and the generated jsconfig leaves it out, so this test also proves TMF-001 for javascript/tsc.
- JavaScript checking preserves repository resolution and excludes private ambient types $name (test (test.each), 50-92): **keep** to `tests/integration/language/javascript/projects.test.ts` `javascript/tsc keeps the project's module resolution and ignores gspot's own @types, $name`. Real behavior; TTC-032 title.
- JAVASCRIPT_CONFIG_CASES (test (test.each), 50-50): **keep** to `tests/integration/language/javascript/projects.test.ts` `[{ name: 'without your jsconfig', ... }, { name: 'with your jsconfig', ... }]`. The table, written in the test.each.
- JavaScript projects retain nested compiler options and isolate the deepest scope (test (test), 94-153): **keep** to `tests/integration/language/javascript/projects.test.ts` `javascript/tsc reads each scope's own jsconfig options, and a broken one fails only its scope`. Real behavior; TTC-032 title; three \[\[scope\]\] records (app, app/child, sibling).
- %s copies imported ambient dependencies and keeps unrelated scopes separate (test (test.each), 155-185): **keep** to `tests/integration/language/javascript/projects.test.ts` `javascript/tsc copies imported ambient types and keeps other scopes apart`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "apps/web".
- \['recommended', 'all'\] as const (test (test.each), 155-155): **delete**. TGN-037: the same result at both levels; run once at level all

## `tests/tools/configurations/language/markdown.test.ts`

- (the file) (file): **split** to `tests/integration/language/markdown.test.ts; tests/unit/cli/checks/language/markdown.test.ts`. TTO-005, TTC-007: the Bash fence test needs no installed tool
- Markdown coverage switches by level while scoped native options remain effective (test (test), 16-60): **move** to `tests/integration/language/markdown.test.ts` `markdownlint adds lint rules at level all and applies each scope's lint rule options`. Real behavior; TTC-032 title; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts, without the switch back (TGN-037).
- Generated Markdown editor pointers carry defaults and scoped options (test (test), 62-84): **move** to `tests/integration/language/markdown.test.ts` `markdownlint run by an editor reads the pointer files with each scope's options`. Real behavior; TTC-014 keeps this raw tool run on purpose; TTC-032 title.
- %s preserves a reasoned Markdown rule ignore in root and scoped native configurations (test (test.each), 86-109): **move** to `tests/integration/language/markdown.test.ts` `markdownlint honors a lint rule ignore in the root and scope tool files`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 86-86): **delete**. TGN-037: the same result at both levels; run once at level all
- %s enforces native table alignment by default and applies the selected table style (test (test.each), 111-169): **move** to `tests/integration/language/markdown.test.ts` `markdownlint checks table alignment by default and the chosen table style`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 111-111): **delete**. TGN-037: the same result at both levels; run once at level all
- Bash examples report syntax errors, pass after fixes, and stop on cancellation (test (test), 171-188): **move** to `tests/unit/cli/checks/language/markdown.test.ts` `markdown/fences reports a Bash syntax error in a fence, passes after the fix, and stops on cancel`. TTC-007, TTO-005: no CLI test covers a Bash fence; it runs host bash only

## `tests/tools/configurations/language/python/checks.test.ts`

- (the file) (file): **split** to `tests/integration/language/python/basedpyright-pydoclint.test.ts; tests/integration/language/python/imports.test.ts`. With the Python cases the file passes 300 lines and splits by behavior; NMU-075 name
- deptry excludes private tools without Git and preserves authored exclusions beside real findings (test (test), 20-59): **move** to `tests/integration/language/python/imports.test.ts` `deptry ignores gspot's tool folder without Git and keeps your exclude settings`. Real behavior; TTC-032 title.
- the python configuration (describe (describe), 61-103): **delete**. TTC-039: describe around a single test
- the python configuration &gt; init replaces an authored Pyright configuration with the pointer, and the check reports the type error (test (test), 62-102): **move** to `tests/integration/language/python/basedpyright-pydoclint.test.ts` `init replaces your pyrightconfig.json with a pointer, and basedpyright reports the type error`. Real behavior; TTC-032 title.
- pydoclint detects source docstrings at $0 without repeating annotation types (test (test.each), 105-153): **move** to `tests/integration/language/python/basedpyright-pydoclint.test.ts` `pydoclint finds the docstring style of each file and does not ask for types again`. Real behavior; the title bug goes with the loop; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["python"\].
- \['recommended', 'all'\] as const (test (test.each), 105-105): **delete**. TGN-037: the same result at both levels; run once at level all
- import-linter reads $file and retains the dependency chain in each scope (test (test.each), 155-203): **move** to `tests/integration/language/python/imports.test.ts` `import-linter reads $file and reports the forbidden import in each scope`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["python"\].
- IMPORT_CONFIGURATIONS (test (test.each), 155-155): **move** to `tests/integration/language/python/imports.test.ts` `IMPORT_CONFIGURATIONS`. The table
- pydoclint preserves authored requirements to repeat signature types in docstrings (test (test), 205-234): **move** to `tests/integration/language/python/basedpyright-pydoclint.test.ts` `pydoclint keeps your settings that ask for types in docstrings`. Real behavior; TTC-032 title.

## `tests/tools/configurations/language/python/ruff/rules.test.ts`

- (the file) (file): **merge** to `tests/integration/language/python/ruff.test.ts`. TTC-026: one Ruff file (about 300 lines after TTC-006 and TTC-024)
- Ruff keeps pytest rules and scoped limits inside their selected project (test (test), 31-81): **keep** to `tests/integration/language/python/ruff.test.ts` `Ruff selects the pytest lint rules and scope limits only in the scope that selects pytest`. Real behavior; TTC-014: run through gspot check; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["pytest"\] with limits.python.function_parameters = 3, and the \[\[ignore\]\] stays at the root.
- Ruff keeps correctness at %s and runs print conventions only at all (test (test.each), 83-128): **keep** to `tests/integration/language/python/ruff.test.ts` `Ruff at level %s reports correctness, and print calls only at level all`. Real behavior: the result differs by level.
- \['recommended', 'all'\] as const (test (test.each), 83-83): **rename** to `tests/integration/language/python/ruff.test.ts` `LEVELS`. TGN-037: one spelling of the level list; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- previewCodes (const, 17-17): **keep** to `tests/integration/language/python/ruff.test.ts` `previewCodes`. Read once from the real Ruff

## `tests/tools/configurations/language/python/ruff/settings.test.ts`

- (the file) (file): **merge** to `tests/integration/language/python/ruff.test.ts`. TTC-026: one Ruff file
- Python uses one function-size ceiling without a second statement-count finding (test (test), 28-47): **keep** to `tests/integration/language/python/ruff.test.ts` `python/function-size is the only function size limit, and Ruff reports no statement count`. Real behavior; TTC-032 title.
- Ruff editor discovery and explicit formatting agree on root and nested policy (test (test), 49-69): **keep** to `tests/integration/language/python/ruff.test.ts` `Ruff run by an editor and through gspot formats each scope the same way`. Real behavior; TTC-014 keeps this raw tool run on purpose; TTC-032 title; the scope is \[\[scope\]\] path = "app" with format.quotes = "double" and format.line_ending = "lf".
- Ruff fixes respect each project Python version at %s (test (test.each), 71-117): **keep** to `tests/integration/language/python/ruff.test.ts` `Ruff fixes follow each scope's minimum Python version`. Real behavior; TTC-032 title; the built text writes one \[\[scope\]\] record with path per scope of VERSION_CASES.
- \['recommended', 'all'\] as const (test (test.each), 71-71): **delete**. TGN-037: the same result at both levels; run once at level all
- Python diagnostics keep one unused-import owner and retain type errors at %s (test (test.each), 119-148): **keep** to `tests/integration/language/python/ruff.test.ts` `Ruff alone reports an unused import, and basedpyright still reports the type error`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 119-119): **delete**. TGN-037: the same result at both levels; run once at level all
- %s Ruff prefixes retain the native rules in root and child projects with every docstring convention (test (test.each), 150-192): **delete**. Fake: a snapshot of rule counts and SHA-256 hashes (TTC-006).
- \['recommended', 'all'\] as const (test (test.each), 150-150): **delete**. Its test is deleted as fake (TTC-006).

## `tests/tools/configurations/language/sql.test.ts`

- (the file) (file): **move** to `tests/integration/language/sql.test.ts`. The sql case joins it
- SQLFluff honors root and nested dialect settings over the database default (test (test), 14-67): **keep** to `tests/integration/language/sql.test.ts` `SQLFluff uses each scope's dialect setting instead of the PostgreSQL default`. Real behavior; TTC-014: run through gspot check; TTC-032 title; the scopes are \[\[scope\]\] path = "warehouse" with tools.sqlfluff.dialect = "duckdb" and \[\[scope\]\] path = "warehouse/child".
- SQLFluff at %s accepts valid block comments and still rejects malformed queries (test (test.each), 69-96): **keep** to `tests/integration/language/sql.test.ts` `SQLFluff accepts block comments and still reports a broken query`. Real behavior; TTC-014.
- \['recommended', 'all'\] as const (test (test.each), 69-69): **delete**. TGN-037: the same result at both levels; run once at level all
- SQLFluff parses the $dialect sample that PostgreSQL rejects (test (test.each), 98-119): **keep** to `tests/integration/language/sql.test.ts` `SQLFluff parses the $dialect sample that PostgreSQL rejects`. Real behavior; TTC-014.
- FOREIGN_DIALECT_CASES (test (test.each), 98-98): **keep** to `tests/integration/language/sql.test.ts` `FOREIGN_DIALECT_CASES`. The table, shared with a unit test, comes from tests/config/sql.ts.
- SQLFluff at %s keeps function definitions and calls lowercase (test (test.each), 121-168): **keep** to `tests/integration/language/sql.test.ts` `SQLFluff reports and fixes uppercase function names`. Real behavior; TTC-014; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 121-121): **delete**. TGN-037: the same result at both levels; run once at level all

## `tests/tools/configurations/language/swift/build.test.ts`

- (the file) (file): **move** to `tests/integration/language/swift/build.test.ts`. The compiler-backed package cases join it
- incremental Swift builds preserve compiler state and still detect a changed source (test (test.skipIf), 16-46): **keep** to `tests/integration/language/swift/build.test.ts` `swift/build reuses its compiled objects and still reports a changed source`. Real behavior; TTC-029: run through the CLI; TTC-032 title. Values to config: SWIFT_6_PACKAGE = the Package.swift text -&gt; tests/config/swift.ts; the two Value.swift samples -&gt; tests/config/swift.ts
- !isMacos (test (test.skipIf), 16-16): **keep** to `tests/integration/language/swift/build.test.ts` `!isMacos`. SUP-022: needed (Xcode toolchain)
- Xcode reuses compiled objects and reports source errors without changing the project (test (test.skipIf), 47-105): **keep** to `tests/integration/language/swift/build.test.ts` `Xcode reuses compiled objects and reports source errors without changing the project`. Real behavior; the settings use \[xcode\] project, scheme and destination (TML-014). Values to config: XCODE_TOOL_PROJECT = the tool project written as its own literal, in place of 12 replaces (TTC-025) -&gt; tests/config/xcode.ts; XCODE_TOOL_SCHEME -&gt; tests/config/xcode.ts; XCODE_BUILD_SETTINGS -&gt; tests/config/xcode.ts
- !isMacos (test (test.skipIf), 47-47): **keep** to `tests/integration/language/swift/build.test.ts` `!isMacos`. SUP-022: needed

## `tests/tools/configurations/language/swift/checks.test.ts`

- (the file) (file): **move** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts`. NMU-075: a file name that says what it tests; the swift cases join it
- swiftformat keeps the source header when it fixes spacing (test (test.skipIf), 14-31): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `swiftformat keeps the source header when it fixes spacing`. Real behavior. Values to config: SOURCE_HEADER = '// Greeting.swift\\n// Created by Alex Garcia.\\n...' -&gt; tests/config/swift.ts
- !hasToolBuild('swiftformat') (test (test.skipIf), 14-14): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `!hasToolBuild('swiftformat')`. SUP-022: needed
- testRepository (const, 12-12): **rename** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `installedSandbox`. Glossary: sandbox

## `tests/tools/configurations/language/swift/docs.test.ts`

- (the file) (file): **merge** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts`. SwiftFormat block comments are part of the lint and format behavior
- recommended leaves Swift block comments unchecked (test (test.skipIf), 26-36): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `recommended leaves Swift block comments unchecked`. Real behavior.
- !isPosix (test (test.skipIf), 26-26): **rename** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `!hasToolBuild('swiftformat')`. The reason for the skip is the SwiftFormat pin, not Windows.
- all reports and fixes Swift block comments and respects the policy ignore (test (test.skipIf), 38-67): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `level all reports and fixes Swift block comments and honors an ignore in gspot.toml`. Real behavior; TTC-032 title.
- !isPosix (test (test.skipIf), 38-38): **rename** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `!hasToolBuild('swiftformat')`. The reason for the skip is the SwiftFormat pin, not Windows.
- Swift inline comments retain native exceptions, modes, and original positions (test (test.skipIf), 69-97): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `SwiftFormat reports inline block comments at their positions and keeps the file mode and swiftformat:disable comments`. Real behavior; 0o444 in place of getKeptMode; TTC-032 title.
- !isPosix (test (test.skipIf), 69-69): **rename** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `!hasToolBuild('swiftformat')`. The reason for the skip is the SwiftFormat pin, not Windows.
- nested Swift scopes retain their own native formatting exclusions (test (test.skipIf), 99-137): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `an ignore limited to a scope path stops SwiftFormat block-comment findings until unignore`. Real behavior; unignore (CMD-092); TTC-032 title; the scope is \[\[scope\]\] path = "nested".
- !isPosix (test (test.skipIf), 99-99): **rename** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `!hasToolBuild('swiftformat')`. The reason for the skip is the SwiftFormat pin, not Windows.
- documentationFindings (function, 17-23): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `documentationFindings`. Several callers

## `tests/tools/configurations/language/swift/scopes.test.ts`

- (the file) (file): **merge** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts`. The scope test is part of the lint and format behavior
- the swift configuration inside a scope (describe (describe), 15-58): **delete**. TTC-039: describe around a single test
- the swift configuration inside a scope &gt; SwiftLint and SwiftFormat read the configuration of their scope, and the findings keep the scope path (test (test.skipIf), 16-57): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `SwiftLint and SwiftFormat read the configuration of their scope, and the findings keep the scope path`. Real behavior; gspot.toml holds \[\[scope\]\] path = "ios" configurations = \["swift"\] in place of init --scope-configurations ios=swift (CMD-092).
- the swift configuration inside a scope &gt; !hasToolBuild('swiftlint') (test (test.skipIf), 16-16): **keep** to `tests/integration/language/swift/swiftlint-swiftformat.test.ts` `!hasToolBuild('swiftlint')`. SUP-022: needed

## `tests/tools/configurations/language/typescript/checks.test.ts`

- (the file) (file): **split** to `tests/integration/language/typescript/repository-checks.test.ts; tests/integration/language/typescript/projects.test.ts`. With the typescript cases the file passes 300 lines; NMU-075 name for the sandbox half; TTC-026
- the typescript configuration (describe (describe), 39-67): **delete**. TTC-039: the sandbox belongs to the file; the describe repeats the file name
- the typescript configuration &gt; every check passes on the clean repository (test (test), 40-44): **delete**. Weak: only checks exit code 0 on the clean repository.
- the typescript configuration &gt; spelling/typos keeps its exclusions for a file named on the command line (test (test), 47-66): **move** to `tests/integration/language/typescript/repository-checks.test.ts` `typos keeps its excluded paths for a file named on the command line`. Real behavior; TTC-032 title.
- a TypeScript solution checks both projects without writing build output (test (test), 93-128): **move** to `tests/integration/language/typescript/projects.test.ts` `typescript/tsc checks both projects of a solution and writes no build output`. Real behavior; TTC-032 title. Values to config: SOLUTION_TSCONFIG = the solution file with two references -&gt; tests/config/tsconfig.ts
- a TypeScript scope keeps authored compiler settings while both levels enforce type safety (test (test), 130-174): **move** to `tests/integration/language/typescript/projects.test.ts` `typescript/tsc keeps your tsconfig.json in a scope and reports type errors at both levels`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "apps/web" configurations = \["typescript"\], and the level loop is test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- $name (test (test.each), 176-214): **move** to `tests/integration/language/typescript/projects.test.ts` `$name`. Real behavior.
- OUTDIR_CASES (test (test.each), 176-176): **move** to `tests/integration/language/typescript/projects.test.ts` `OUTDIR_CASES`. The table
- repository (const, 26-36): **merge** to `tests/config/typescript.ts` `TYPESCRIPT_SANDBOX`. TTC-002, TTC-005: the sandbox files and its jsconfig.json are static data, so they join TYPESCRIPT_SANDBOX in tests/config/typescript.ts, written as const without the InstalledScenario annotation; the prepare step (gspot apply, then the Prettier fix) is code and stays in the test.
- testRepository (const, 37-37): **rename** to `tests/integration/language/typescript/repository-checks.test.ts` `installedSandbox`. Glossary: sandbox
- applyPolicy (function, 71-75): **move** to `tests/integration/language/typescript/projects.test.ts` `applySettings`. Three callers; glossary: settings, not policy
- checkTypes (function, 78-84): **move** to `tests/integration/language/typescript/projects.test.ts` `checkTypes`. Four callers
- linkCompiler (function, 87-91): **move** to `tests/setup/install.ts` `installCompiler`. One helper links TypeScript and its tsc launcher, used in seven places (TTC-010, TTC-011).

## `tests/tools/configurations/language/typescript/copy.test.ts`

- (the file) (file): **merge** to `tests/integration/language/typescript/projects.test.ts`. TTC-026: copy.test.ts tests project references
- %s reference builds retain imported declarations and inherited configs without sibling installations (test (test.each), 17-77): **keep** to `tests/integration/language/typescript/projects.test.ts` `typescript/tsc builds a referenced project with its imported declarations and extended config and ignores other folders`. Real behavior; TTC-029: drop the internal-function assertions and the throw; TTC-032 title; two \[\[scope\]\] records, path = "app" and path = "neighbor".
- \['recommended', 'all'\] as const (test (test.each), 17-17): **delete**. TGN-037: the same result at both levels; run once at level all

## `tests/tools/configurations/language/typescript/standalone.test.ts`

- (the file) (file): **move** to `tests/integration/language/typescript/scopes.test.ts`. TTC-026: standalone becomes scopes
- %s standalone TypeScript checks its own scope and keeps project declarations without private globals (test (test.skipIf), 28-90): **keep** to `tests/integration/language/typescript/scopes.test.ts` `typescript/tsc at level %s checks each scope alone and keeps your declarations, without gspot's own @types`. Real behavior: findings differ by level; TTC-032 title; the getTsconfig fileNames assertions go, since the per-scope check results show which files each scope compiles (TTC-029), and no finding from app/emitted or app/vendor, marked in .gitattributes, proves the generated tsconfig leaves them out (CFR-005, TMF-001).
- \['recommended', 'all'\] as const (test (test.skipIf), 28-28): **rename** to `tests/integration/language/typescript/scopes.test.ts` `LEVELS`. TGN-037: one spelling of the level list; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- !isPosix (test (test.skipIf), 28-28): **delete**. TTC-010: the skip came from a hand-made POSIX link.
- %s runs a covering ancestor compiler once across nested scopes (test (test.each), 92-131): **keep** to `tests/integration/language/typescript/scopes.test.ts` `typescript/tsc runs a covering parent tsconfig once for nested scopes`. Real behavior; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.each), 92-92): **delete**. TGN-037: the same result at both levels; run once at level all
- %s compiles covering ancestors once and checks child-only selections (test (test.each), 133-195): **keep** to `tests/integration/language/typescript/scopes.test.ts` `typescript/tsc checks a scope through the parent tsconfig, alone when named, and in staged files`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["typescript"\].
- \['recommended', 'all'\] as const (test (test.each), 133-133): **delete**. TGN-037: the same result at both levels; run once at level all
- %s staged standalone TypeScript checks index sources without working-tree fixes (test (test.skipIf), 197-230): **keep** to `tests/integration/language/typescript/scopes.test.ts` `typescript/tsc at level %s checks staged files, not working-tree fixes`. Real behavior: findings differ by level; TTC-032 title.
- \['recommended', 'all'\] as const (test (test.skipIf), 197-197): **rename** to `tests/integration/language/typescript/scopes.test.ts` `LEVELS`. TGN-037: one spelling of the level list; test.each(LEVELS), with LEVELS imported from packages/cli/src/config/configurations.ts.
- !isPosix (test (test.skipIf), 197-197): **delete**. TTC-010: the skip came from a hand-made POSIX link.

## `tests/tools/configurations/platform/cloudflare.test.ts`

- (the file) (file): **move** to `tests/integration/platform/cloudflare.test.ts`. tests/tools becomes tests/integration
- native $check retains the missing-date finding and its correction (test (test.each), 48-60): **keep** to `tests/integration/platform/cloudflare.test.ts` `cloudflare/wrangler reports a missing compatibility date and passes after the fix`. Real behavior; TTC-032 title.
- CASES (test (test.each), 48-48): **delete**. One case, so no table
- native Wrangler schema validates root and child values at %s (test (test.each), 62-93): **delete**. Duplicate of the kept test 'cloudflare/wrangler reports every wrong value in each file format and scope' (TTC-007).
- levelSchema.options (test (test.each), 62-62): **delete**. Its test merges into the kept Wrangler test (TTC-007).
- native Wrangler reports every scalar error in all formats and scopes at %s (test (test.each), 95-130): **keep** to `tests/integration/platform/cloudflare.test.ts` `cloudflare/wrangler reports every wrong value in each file format and scope`. Real behavior; TTC-029: run through the CLI; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["cloudflare"\].
- levelSchema.options (test (test.each), 95-95): **delete**. TGN-037: the same result at both levels; run once at level all
- repository (const, 21-21): **rename** to `tests/integration/platform/cloudflare.test.ts` `installedSandbox`. Glossary: sandbox; the setup runs gspot install (installToolProjects, TTO-003) in place of its own npm install of Ajv published with installTree, and copyInstalledModule goes (THR-008).

## `tests/tools/configurations/platform/supabase.test.ts`

- (the file) (file): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- native Supabase freshness rejects drift and accepts regenerated database types (test (test.skipIf), 27-60): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- !runsDatabase (test (test.skipIf), 27-27): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- native Supabase freshness isolates two scoped databases and preserves their configuration (test (test.skipIf), 62-105): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- !runsDatabase (test (test.skipIf), 62-62): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- runsDatabase (const, 25-25): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- configureDatabaseProject (function, 107-130): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- prepareSupabaseDatabase (function, 133-163): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.

## `tests/tools/configurations/test/jest.test.ts`

- (the file) (file): **move** to `tests/integration/testing/jest.test.ts`. NMU-009: test becomes testing
- native Jest at all applies nested coverage settings without executing sibling tests (test (test), 38-70): **keep** to `tests/integration/testing/jest.test.ts` `jest/coverage at level all uses the scope's coverage limits and runs only that scope's tests`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = "app" configurations = \["jest"\] with coverage.functions = 100.
- native Jest at all reports uncovered functions and failed tests while preserving working-tree files (test (test), 72-101): **keep** to `tests/integration/testing/jest.test.ts` `jest/coverage at level all reports uncovered functions and failed tests and keeps your files`. Real behavior; TTC-032 title.
- native Jest reports a test file that cannot load as an execution error and passes after the fix (test (test), 103-122): **keep** to `tests/integration/testing/jest.test.ts` `jest/coverage reports a test file with a missing import as an error and passes after the fix`. Real behavior; TTC-032 title.
- native Jest $level runs root and child tests without zero-floor coverage flags (test (test.each), 124-153): **keep** to `tests/integration/testing/jest.test.ts` `jest/coverage runs root and scope tests without coverage flags when every limit is 0`. Real behavior; the literal $level title goes with the loop; the scope is \[\[scope\]\] path = "app" configurations = \["jest"\]. Values to config: COVERAGE_ZERO_LIMITS = the \[coverage\] table with every limit at 0, each lowered limit in the reason form such as lines = { value = 0, reason = "..." }, one copy for the Jest, pytest and Vitest tests -&gt; tests/config/planning.ts
- \['recommended', 'all'\] as const (test (test.each), 124-124): **delete**. TGN-037: the same result at both levels; run once at level all
- files (const, 19-24): **keep** to `tests/integration/testing/jest.test.ts` `files`. Three uses
- prepareJest (function, 27-36): **keep** to `tests/integration/testing/jest.test.ts` `prepareJest`. Two callers. Values to config: JEST_COVERAGE_SETTINGS = '\[coverage\]\\nlines = 80\\nbranches = 80\\nfunctions = 80\\nstatements = 80\\n' -&gt; tests/config/jest.ts

## `tests/tools/configurations/test/pytest.test.ts`

- (the file) (file): **move** to `tests/integration/testing/pytest.test.ts`. The pytest case joins it
- the pytest configuration (describe (describe), 17-37): **delete**. TTC-039: describe around a single test
- the pytest configuration &gt; naming accepts the test\_ prefix of a test function and Ruff and coverage accept its clean source (test (test), 18-36): **delete**. Weak: only checks exit code 0 for three checks on the clean sample; the unit test 'pytest owns test-prefix counting without changing sibling Python contracts' covers the test\_ prefix.
- native pytest at %s uses its project interpreter with a %i floor without pytest-cov (test (test.each), 60-82): **keep** to `tests/integration/testing/pytest.test.ts` `pytest/coverage with a %i limit uses the project's Python and needs pytest-cov only above 0`. Real behavior; TTC-029: run through the CLI; TTC-032 title; the limits use the reason form of COVERAGE_ZERO_LIMITS (CFR-002), and the 80 row sets lines = 80 at the use site. Values to config: COVERAGE_ZERO_LIMITS -&gt; tests/config/planning.ts
- \[...PROVIDER_FLOORS\] (test (test.each), 60-60): **rename** to `tests/integration/testing/pytest.test.ts` `[80, 0]`. TTC-024, TGN-037: the level makes no difference
- sandbox (const, 39-39): **keep** to `tests/integration/testing/pytest.test.ts` `sandbox`. The project without pytest-cov
- project (const, 40-40): **keep** to `tests/integration/testing/pytest.test.ts` `project`. Compared after each run
- lockfile (const, 41-41): **keep** to `tests/integration/testing/pytest.test.ts` `lockfile`. Compared after each run

## `tests/tools/configurations/test/swift-tests.test.ts`

- (the file) (file): **move** to `tests/integration/testing/swift-tests.test.ts`. NMU-009: test becomes testing
- XCTest and xccov report a below-floor target and pass after testing its uncovered function (test (test.skipIf), 29-80): **keep** to `tests/integration/testing/swift-tests.test.ts` `swift-tests/coverage reports a target under its coverage limit and passes after testing the uncovered function`. Real behavior; glossary: limit, not floor; the settings use \[xcode\] project, scheme and destination (TML-014) and \[\[coverage.target\]\] name = "Inspection.xctest", lines = 100, with no reason because 100 does not lower the limit (TMF-004).
- !isMacos (test (test.skipIf), 29-29): **keep** to `tests/integration/testing/swift-tests.test.ts` `!isMacos`. SUP-022: needed (Xcode)
- 'Swift test overrides ${name} $name' (test (test.skipIf), 145-168): **split** to `tests/integration/testing/swift-tests.test.ts` `SwiftLint $name reports the source lint rules and passes after the fix; SwiftLint $name reports a lint rule turned back on in an edited AppTests tool file; SwiftLint $name fixes source formatting with --fix; SwiftLint $name refuses a missing root tool file and names its path`. TTC-034: four test.each(XCTEST_SCOPES) blocks, one per behavior; the scope is \[\[scope\]\] path = &lt;scope&gt; configurations = \["swift-tests"\].
- configurationCases (test (test.skipIf), 145-145): **delete**. TTC-034: the callback table goes
- !hasToolBuild('swiftlint') (test (test.skipIf), 145-145): **keep** to `tests/integration/testing/swift-tests.test.ts` `!hasToolBuild('swiftlint')`. SUP-022: needed; on each of the four tests
- a Swift test scope %s has one complete native configuration (test (test.skipIf), 171-197): **keep** to `tests/integration/testing/swift-tests.test.ts` `a swift-tests scope %s gets one complete SwiftLint tool file`. Real behavior; TTC-032 title; the scope is \[\[scope\]\] path = &lt;scope&gt; configurations = \["swift-tests"\].
- \['AppTests', 'AppTests/Helpers'\] (test (test.skipIf), 171-171): **keep** to `tests/integration/testing/swift-tests.test.ts` `['AppTests', 'AppTests/Helpers']`. The table
- !hasToolBuild('swiftlint') (test (test.skipIf), 171-171): **keep** to `tests/integration/testing/swift-tests.test.ts` `!hasToolBuild('swiftlint')`. SUP-022: needed
- configurationCases (const, 82-142): **split** to `tests/integration/testing/swift-tests.test.ts` `SwiftLint $name reports the source lint rules and passes after the fix; SwiftLint $name reports a lint rule turned back on in an edited AppTests tool file; SwiftLint $name fixes source formatting with --fix; SwiftLint $name refuses a missing root tool file and names its path`. TTC-034: each callback becomes its own test

## `tests/tools/configurations/test/vitest.test.ts`

- (the file) (file): **move** to `tests/integration/testing/vitest.test.ts`. The vitest case joins it
- native Vitest reports a threshold and its fix in root and child scopes at %s (test (test.each), 25-62): **keep** to `tests/integration/testing/vitest.test.ts` `vitest/coverage reports a coverage limit and passes after the fix, in the root and a scope`. Real behavior; TTC-029: run through the CLI; TTC-035: no throw guards; the root half repeats the vitest case of the same file, so only the app scope runs, as \[\[scope\]\] path = "app" configurations = \["typescript", "vitest"\].
- \['recommended', 'all'\] as const (test (test.each), 25-25): **delete**. TGN-037: the same result at both levels; run once at level all
- native Vitest at %s runs with a %i floor without its provider (test (test.each), 64-89): **keep** to `tests/integration/testing/vitest.test.ts` `vitest/coverage with a %i limit runs without its coverage package only at 0`. Real behavior; TTC-029; the limits use the reason form of COVERAGE_ZERO_LIMITS (CFR-002), and the 80 row sets lines = 80 at the use site. Values to config: COVERAGE_ZERO_LIMITS -&gt; tests/config/planning.ts
- \[...PROVIDER_FLOORS\] (test (test.each), 64-64): **rename** to `tests/integration/testing/vitest.test.ts` `[80, 0]`. TTC-024, TGN-037: the level makes no difference
- files (const, 20-23): **merge** to `tests/integration/testing/vitest.test.ts` `installedSandbox`. The same value as the other installedSandbox of this file: VITEST_SANDBOX plus package.json with the installed Vitest version, one copy in the test.

## `tests/types/tools/cases.ts`

- (the file) (file): **delete**. TTC-001, TTC-005: the scenario table and callback map go
- ConfigurationScenario (type exported, 5-8): **delete**. TTC-001: no scenario table
- BashBoundary (type exported, 11-11): **delete**. TTC-005: the size cases are written as cases directly
- ConfigurationCallbacks (type exported, 14-14): **delete**. TTC-005: no callback map

## `tests/types/tools/configurations/general/lychee.ts`

- (the file) (file): **move** to `tests/types/tool-output.ts`. The tool output shapes the integration tests read are one topic, so the one type goes to tests/types/tool-output.ts.
- LinkFailure (type exported, 2-2): **move** to `tests/types/tool-output.ts` `LinkFailure`. Parameter type of expectLinks; it goes to tests/types/tool-output.ts with the other tool output shapes.

## `tests/types/tools/configurations/general/prose.ts`

- (the file) (file): **delete**. Dead: its one type served checkHeadings, which goes with the deleted heading scope test.
- HeadingCase (type exported, 4-4): **delete**. Dead: it served checkHeadings, which goes with the deleted heading scope test.

## `tests/types/tools/configurations/general/secrets.ts`

- (the file) (file): **move** to `tests/types/secrets.ts`. One types file for the secrets tests (gitleaks and TruffleHog), tests/types/secrets.ts.
- SecretHistory (type exported, 2-2): **move** to `tests/types/secrets.ts` `SecretHistory`. Return type of prepareSecretHistory, which stays in the TruffleHog test; types go to tests/types/&lt;topic&gt;.ts.
- SecretVerifier (type exported, 5-10): **move** to `tests/types/secrets.ts` `SecretVerifier`. Return type of createSecretVerifier; the modeFile field goes with the deleted fake-tool rows.
- GitleaksHistory (type exported, 12-12): **move** to `tests/types/secrets.ts` `GitleaksHistory`. Return type of prepareHistory; types go to tests/types/&lt;topic&gt;.ts.

## `tests/types/tools/configurations/general/site.ts`

- (the file) (file): **delete**. Its one type goes: OUTPUT_CASES is written as const, and the test.each infers the row type.
- SiteOutputCase (type exported, 5-12): **delete**. Config may not import types, so OUTPUT_CASES is written as const in tests/config and the test.each infers the row type; inspectSiteOutput is inlined into that test, so nothing names the type.

## `tests/types/tools/configurations/language/javascript.ts`

- (the file) (file): **delete**. Its one type goes: JSCONFIG_CASES is written as const, and the test.each infers the row type.
- JsconfigCase (type exported, 4-12): **delete**. Config may not import types, so JSCONFIG_CASES is written as const in tests/config and the test.each infers the row type.

## `tests/types/tools/configurations/language/python.ts`

- (the file) (file): **move** to `tests/types/tool-output.ts`. The tool output shapes the integration tests read are one topic, so the one type goes to tests/types/tool-output.ts.
- RuffFinding (type exported, 2-2): **move** to `tests/types/tool-output.ts` `RuffFinding`. One user; it goes to tests/types/tool-output.ts with the other tool output shapes.

## `tests/types/tools/configurations/language/typescript.ts`

- (the file) (file): **move** to `tests/types/tool-output.ts`. The tool output shapes the integration tests read are one topic, so the one type goes to tests/types/tool-output.ts.
- TypecheckOutcome (type exported, 3-3): **move** to `tests/types/tool-output.ts` `TypecheckOutcome`. Return type of checkTypes; it goes to tests/types/tool-output.ts with the other tool output shapes.

## `tests/types/tools/configurations/supabase.ts`

- (the file) (file): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- SupabaseProjectFiles (type exported, 3-6): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
- SupabaseDatabase (type exported, 9-12): **delete**. The Supabase test that needs Docker goes with its data; the platform/supabase integration test keeps the cases that need no Docker.
