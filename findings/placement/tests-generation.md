# Tests: file generation

683 rows. move 306, delete 168, keep 146, merge 41, split 16, inline 6.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/generation/attributes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/files.test.ts`. Tests the .gitattributes block that emitAll builds (generation/files.ts in the EXG and ARC layout). managed-ignores and the level-switch test join it.
- %s attributes keep LF in generated files, including a scope folder with a space (test (test.each), 12-46): **keep** to `tests/unit/cli/generation/files.test.ts` `%s attributes keep LF in generated files, also in a scope folder with a space`. Real: Git check-attr on the emitted block. TTC-032 wording. The sample writes a \[\[scope\]\] record with path = "web app".
- \['absent', 'authored', 'managed'\] (test (test.each), 12-12): **keep** to `tests/unit/cli/generation/files.test.ts` `['absent', 'own', 'managed']`. Same rows. TTC-032: 'authored' becomes 'own'.
- generated attributes preserve LF through autocrlf checkout (test (test), 48-65): **keep** to `tests/unit/cli/generation/files.test.ts` `generated attributes keep LF through an autocrlf checkout`. Real: Git checkout-index with autocrlf. TTC-032 wording.

## `tests/cli/generation/bunfig.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/bunfig.test.ts`. Tests bunfigChanges (generation/bunfig.ts). The first test moves to the managed-keys test (TGN-058). Its data goes to tests/config/dependencies.ts.
- Bun safeguards preserve stricter age and unrelated fields across ownership merge and restoration (test (test), 12-39): **move** to `tests/unit/cli/ownership/managed-keys/toml.test.ts` `Bun release-age keys keep a stricter age and your other fields through merge and restore`. TGN-058: tests planManagedKeys and planRestoration (ownership/plans.ts, managed-keys.ts), not generation, and joins the TOML managed-keys tests in ownership/managed-keys/toml.test.ts; use 'using log'.
- Bun generation sets the required age with $name authored settings (test (test.each), 41-56): **keep** to `tests/unit/cli/generation/bunfig.test.ts` `Bun generation sets the required release age with $name bunfig settings`. Real: emitted key changes depend on your bunfig.toml.
- \[...AGE_CASES\] (test (test.each), 41-41): **keep** to `tests/unit/cli/generation/bunfig.test.ts` `AGE_CASES`. Same rows.
- Bun generation names malformed %sbunfig.toml and preserves authored bytes (test (test.each), 58-76): **keep** to `tests/unit/cli/generation/bunfig.test.ts` `Bun generation names a malformed %sbunfig.toml`. Real error. TCO-012: delete the unchanged-file line 74 (emitAll only reads). The sample writes a \[\[scope\]\] record with path = "apps/api".
- \['', 'apps/api/'\] (test (test.each), 58-58): **keep** to `tests/unit/cli/generation/bunfig.test.ts` `['', 'apps/api/']`. Same rows.

## `tests/cli/generation/ci.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/ci.test.ts`. Tests githubFile and gitlabFile (generation/ci.ts). tests/tools/generation/ci.test.ts merges in (TTO-005). Types go to tests/types/ci.ts.
- the GitHub workflow has a check and a manual job per platform and only reads the repository (test (test), 10-17): **keep** to `tests/unit/cli/generation/ci.test.ts` `the GitHub workflow has a check job and a manual job per operating system, and no manual job without manual checks`. TGN-065: delete the constant checks of lines 13-15; move the no-manual-job check of lines 28-29 here so it runs once.
- the manual job runs %s by name while ordinary jobs retain default coverage (test (test.each), 19-31): **keep** to `tests/unit/cli/generation/ci.test.ts` `the manual job runs %s by name and the check job runs every check`. TGN-065: lines 28-29 move to the first test. Every generated job runs gspot through mise exec node@24 npm:@gspothq/cli@&lt;version&gt; -- gspot ..., so the expected manual-job line is that command with check --only &lt;name&gt; (INS-003).
- \['security/codeql', 'project/audit'\] (test (test.each), 19-19): **keep** to `tests/unit/cli/generation/ci.test.ts` `['security/codeql', 'project/audit']`. Same rows.
- a Swift scope adds the macOS jobs (test (test), 33-37): **keep** to `tests/unit/cli/generation/ci.test.ts` `a Swift scope adds the macOS jobs`. Real: the job set depends on hasSwift.
- the GitLab include runs through mise when the runner is mise, and installs gspot from npm otherwise (test (test), 39-46): **delete**. INS-003: generated CI always installs the tools with mise; the npm-only branch and its tests go.
- the GitHub workflow without mise sets up Node and installs the pinned gspot from npm (test (test), 48-54): **delete**. INS-003: the setup-node and npm install branch goes, with CLI_PINS.node.

## `tests/cli/generation/commitlint.test.ts`

- (the file) (file): **split** to `tests/unit/cli/apply/write.test.ts; tests/unit/cli/commands/doctor/suggestions.test.ts`. TGN-017: the package-field write and restore test merges with the Stylelint one; TGN-033: the doctor test moves to the doctor tests.
- repository commit fields preserve unrelated package content and restore it at recommended (test (test), 15-70): **merge** to `tests/unit/cli/apply/write.test.ts` `a package.json field follows its configuration and is restored when the configuration leaves`. TGN-017: one test.each over commitlint and stylelint (writeGeneratedFiles in apply/write.ts). TGN-033: its getSuggestions lines 45 and 61-69 go to the doctor suggestions test.
- a folder without Git keeps authored commit policy and reports its actual prerequisite (test (test), 72-84): **move** to `tests/unit/cli/commands/doctor/suggestions.test.ts` `doctor tells you to run git init for commitlint in a folder without Git`. TGN-033: tests getSuggestions (doctor/suggestions.ts), not generation. TCO-012: delete line 83.

## `tests/cli/generation/config-consumers.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-files.test.ts`. TGN-061: a tool file exists only where an enabled check reads it (tool-files.ts), so config-consumers.test.ts becomes tool-files.test.ts. Four tests move: npm packages, Stylelint dialects, v8r, structure selection. every-template joins this file.
- a sibling type checker does not generate its config or pointer in a Ruff-only Python scope (test (test), 24-38): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `a Ruff-only Python scope gets no type checker file or pointer`. Real: tool files follow enabled checks.
- TypeScript-only input activates Knip and does not generate an unused JavaScript compiler config (test (test), 40-52): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `a TypeScript-only scope gets the Knip file and no jsconfig`. Real. It also covers the jsconfig line TGN-066 deletes from every-template. The inline settings table is \[rules\] (TML-003).
- ignoring SwiftLint and Periphery retains SwiftFormat without their config files (test (test), 54-65): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `ignoring SwiftLint and Periphery keeps SwiftFormat and drops their files`. Real.
- EditorConfig can remain active without generating a Prettier config or ignore file (test (test), 67-77): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `EditorConfig stays without a Prettier file or ignore file`. Real. GEN-009: one .prettierignore path after the prettierignore copy goes.
- $name installs the HTML parser only for consumed framework styles (test (test.each), 79-92): **move** to `tests/unit/cli/generation/npm.test.ts` `$name installs postcss-html only when Stylelint reads Vue or Svelte styles`. Tests which npm packages the tool project gets (generation/npm.ts). TGN-029: assert the package by name in .gspot/package.json, not equal to the manifest pin; drop the css/stylelint planning line (TGN-033).
- STYLELINT_CONSUMERS (test (test.each), 79-79): **move** to `tests/unit/cli/generation/npm.test.ts` `STYLESHEET_CASES`. Same rows (renamed with the constant).
- %s keeps framework stylesheet dialects inside their scopes (test (test.each), 94-148): **move** to `tests/unit/cli/generation/tool-file-sources/stylelint.test.ts` `Vue and Svelte stylesheet rules stay inside their scopes`. Tests the Stylelint builder (tool-file-sources/stylelint.ts). TGN-027: keep the per-scope override for Vue and Svelte, drop copied rule options; TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 94-94): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- %s generates only consumed formatter assets and tools for Go and Rust sources (test (test.each), 150-175): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `Go and Rust sources get only the formatter files and tools they use`. Real. TGN-005: drop .prettierrc.json from the loop; TGN-029: compare npm packages by name; TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 150-150): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- $runner catalog at $level with custom schemas=$hasSchemas stays native and includes mise only for its runner (test (test.each), 177-210): **move** to `tests/unit/cli/generation/tool-file-sources/v8r.test.ts` `the v8r catalog lists your custom schemas`. Tests the v8r builder. INX-003 deletes the runner setting, so the v8r tool file does not branch on it: two rows (custom schemas or none), no runner, no mockPinnedExecutables. The tool file always lists the mise schema, whose fileMatch matches nothing without a mise file, so both rows expect the mise entry (TMF-002). Custom schemas are \[\[tools.v8r.schema\]\] records with paths and url.
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; \[ ...(\['mise', 'npm', 'bun', 'pnpm', 'yarn'\] as const).map( (test (test.each), 177-183): **move** to `tests/unit/cli/generation/tool-file-sources/v8r.test.ts` `two rows: custom schemas or none`. TGN-036; INX-003: the runner half of the rows goes, leaving two rows.
- %s selects gspot in root and child structure scopes without a redundant dependency (test (test.each), 212-228): **delete**. duplicate (scope inheritance and the always-selected gspot configuration are checked by 'scope %s retains configuration %s: %s' in tests/cli/configurations/select.test.ts; TGN-031)
- \['recommended', 'all'\] as const (test (test.each), 212-212): **delete**. duplicate (rows of the deleted structure-selection test)

## `tests/cli/generation/eslint/architecture.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/boundaries/modules.test.ts; tests/unit/cli/generation/eslint/boundaries/roles.test.ts`. Tests generation/eslint/boundaries.ts, whose tests sit in boundaries/ by behavior: architecture modules, and roles with the env role. Its data goes to tests/config/eslint/architecture.ts.
- $level loads native architecture and role tools: $declarations (test (test.each), 29-91): **move** to `tests/unit/cli/generation/eslint/boundaries/modules.test.ts` `$level loads eslint-plugin-boundaries for $declarations architecture modules`. Real lint. TGN-029: assert the packages by name, not equal to the manifest pin; TGN-041: compare objects; TCO-012: delete lines 81-89.
- ARCHITECTURE_CASES (test (test.each), 29-29): **move** to `tests/unit/cli/generation/eslint/boundaries/modules.test.ts` `MODULE_CASES`. Same rows (renamed with the constant).
- native role ownership respects %s scopes (test (test.each), 93-122): **move** to `tests/unit/cli/generation/eslint/boundaries/roles.test.ts` `a file outside test_files may not import a test file, in root and child scopes, at %s`. Tests may import runtime files. TML-001: the roles tests, types, config, test_harness and runtime are deleted; the one boundary rule left is fixed and driven by test_files: a file outside test_files may not import a file inside it (level all, every repository); ROLE_TABLES, ROLE_IMPORT_CASES and ROLE_TARGETS shrink to it. The level list is LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037). TCO-012: delete line 121.
- \['recommended', 'all'\] (test (test.each), 93-93): **move** to `tests/unit/cli/generation/eslint/boundaries/roles.test.ts` `LEVELS`. The rows are LEVELS imported from packages/cli/src/config/configurations.ts, not a copy (TGN-037).
- native environment ownership respects %s modules and project scopes (test (test.each), 124-177): **move** to `tests/unit/cli/generation/eslint/boundaries/roles.test.ts` `environment reads are allowed only in environment_readers files of each scope at %s`. Real. TGN-005: delete line 154 (gspot/env-owner); TCO-012: delete line 175. architecture.roles.environment_readers is a list of globs with no module name (TML-001; see ENVIRONMENT_TABLES). The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] (test (test.each), 124-124): **move** to `tests/unit/cli/generation/eslint/boundaries/roles.test.ts` `LEVELS`. The rows are LEVELS imported from packages/cli/src/config/configurations.ts, not a copy (TGN-037).
- native %s environment rules stay absent without an owner (test (test.each), 179-193): **move** to `tests/unit/cli/generation/eslint/boundaries/roles.test.ts` `environment rules stay off when no env role is set, at %s`. Real.
- \['recommended', 'all'\] (test (test.each), 179-179): **delete**. weak (a level loop that changes nothing: no environment rule at either level; the test runs once at level all)
- boundaryVersion (const, 26-26): **delete**. TGN-029: the expected pin came from the same manifest the generator reads.
- importVersion (const, 27-27): **delete**. TGN-029.

## `tests/cli/generation/eslint/astro-parts.test.ts`

- (the file) (file): **delete**. TGN-025, TGN-061: reads one rule value and never lints. The .astro parser wiring is linted by the component parser test (configuration/components.test.ts) and astro/no-set-html-directive by the raw-HTML test.
- the generated Astro fragment enables its accessibility rule (test (test), 7-19): **delete**. TGN-025.

## `tests/cli/generation/eslint/engines.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/engines.test.ts`. Tests the generated ESLint configuration (generation/eslint/configuration.ts); its tests exceed 300 lines, so they split by topic under configuration/. Its data goes to tests/config/eslint/engines.ts; the type file is deleted (TGN-054).
- %s native Node checks follow package engines and scoped authored overrides (test (test.each), 17-74): **keep** to `tests/unit/cli/generation/eslint/configuration/engines.test.ts` `Node built-in rules follow the engines of the nearest package.json`. Real lint. TGN-037: level all only; TGN-041: compare objects; TGN-054: build phase 1 from ENGINE_SCOPES and drop the EnginePhase cast. tools.eslint.node_version is deleted because it repeats package.json engines (TML-006), so the test keeps the engines phase and the fixed phase (ENGINE_PHASES).
- \['recommended', 'all'\] as const (test (test.each), 17-17): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/eslint/escaped-scopes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/serialize.test.ts`. Tests that eslintModule (generation/eslint/serialize.ts) writes scope paths as string literals. The reason-text tests of serialization/javascript join it.
- scope path %s remains a string literal in fragment file selectors and child exclusions (test (test.each), 52-57): **keep** to `tests/unit/cli/generation/eslint/serialize.test.ts` `a scope path with a quote and code stays a string literal in the ESLint file selectors`. TGN-020: one test that compares the injected scope with 'example' once; call parseSource, not parserFor.
- \['example', "scope'; throw 1; '"\] (test (test.each), 52-52): **keep** to `tests/unit/cli/generation/eslint/serialize.test.ts` `no rows (one test)`. TGN-020.
- scopeShape (function, 10-50): **move** to `tests/unit/cli/generation/eslint/serialize.test.ts` `scopeShape`. Called twice by the one test. It writes scope: \[{ path: scope, configurations: \['javascript', 'react'\] }, { path: child, configurations: \['javascript', 'react'\] }\] as \[\[scope\]\] records, with the quote-and-code text as the path value. Values to config: ESLINT_FILE = '.gspot/config/eslint.config.mjs' -&gt; tests/config/tool-files.ts; SCOPE_CONFIGURATIONS = \['javascript', 'react'\] -&gt; tests/config/eslint/selectors.ts

## `tests/cli/generation/eslint/eslint-ignores.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts`. Tests ignoreBlocks and override blocks (eslint/contracts.ts becomes blocks.ts).
- generated ESLint applies explicit ignores after native rule options (test (test), 11-39): **keep** to `tests/unit/cli/generation/eslint/blocks.test.ts` `an ignore of an ESLint rule applies after your rule options`. Real lint. TGN-042: use lintFindings.
- ESLint overrides preserve order, nested scope bounds, future files, and path-specific ignores (test (test), 41-87): **keep** to `tests/unit/cli/generation/eslint/blocks.test.ts` `ESLint override blocks keep their order, nested scope limits, later files and path ignores`. Real lint. TGN-042.

## `tests/cli/generation/eslint/fragments.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/fragments.test.ts`. Tests fragment emission per scope (generation/fragments.ts). typescriptImports moves into fragments.ts (PAR-075). The site selection test moves (TGN-031).
- '$configuration at ${level} renders each selected scope once' (test (test.each), 13-49): **keep** to `tests/unit/cli/generation/fragments.test.ts` `$configuration fragment appears once in each selected scope`. TGN-055: delete the text count and give the nestjs row a source the rule reports; TGN-037: level all only; TGN-043: use configFor. The test_harness role lines go (TML-001); the sample writes \[\[scope\]\] records with path, and first writes test_files = \["first/unit/\*\*"\] and second \["second/specs/\*\*"\] from the repository root (CFR-003).
- FRAGMENT_SCOPE_CASES (test (test.each), 13-13): **keep** to `tests/unit/cli/generation/fragments.test.ts` `FRAGMENT_SCOPE_CASES`. Same rows; TGN-037 removes the level loop around them.
- the site configuration requires HTML and suggests optional scripting and styles (test (test), 51-63): **delete**. duplicate (requires is selected and suggests is not: '%s keeps %s required and OpenAPI suggested' in tests/cli/configurations/select.test.ts; the rest reads the site manifest's requires list)
- fragment imports preserve native comments, side effects, and type and named declarations (test (test), 65-75): **keep** to `tests/unit/cli/generation/fragments.test.ts` `fragment imports keep comments, side effects, and type and named imports`. PAR-075 moves typescriptImports into generation/fragments.ts, so its test stays with fragments.

## `tests/cli/generation/eslint/framework/rules.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/fragments/react-native.test.ts; tests/unit/cli/generation/eslint/fragments/nextjs.test.ts; tests/unit/cli/generation/eslint/fragments/testing-library.test.ts; tests/unit/cli/generation/eslint/configuration/imports.test.ts; tests/unit/cli/generation/eslint/fragments/drizzle.test.ts`. Test folders mirror source folders, and framework/ matches none. Each test goes to the test of its fragment (generation/eslint/fragments/&lt;configuration&gt;.ts); TGN-009 and TGN-010 delete two.
- React Native turns off DOM accessibility rules only inside its scope (test (test), 34-41): **move** to `tests/unit/cli/generation/eslint/fragments/react-native.test.ts` `React Native turns off DOM accessibility rules only inside its scope`. Real: the React Native fragment turns off the react-dom accessibility rules; react-dom stays its own configuration. TGN-043: use configFor. The sample writes a \[\[scope\]\] record with path = "native".
- Next.js entry exclusions respect reexports = %s and nested scope ownership (test (test.each), 43-64): **move** to `tests/unit/cli/generation/eslint/fragments/nextjs.test.ts` `Next.js page files skip no-trivial-files and follow reexports = %s in nested scopes`. Real gspot logic (entry exclusions of the Next.js fragment). The sample writes a \[\[scope\]\] record with path = "app"; \[structure\] stays root only.
- \['none', 'index-only'\] (test (test.each), 43-43): **move** to `tests/unit/cli/generation/eslint/fragments/nextjs.test.ts` `['none', 'index-only']`. Same rows.
- the Testing Library rules of %s report a debugging call in a test file and nowhere else (test (test.each), 66-93): **merge** to `tests/unit/cli/generation/eslint/fragments/testing-library.test.ts` `Testing Library reports a debugging call only in test files of projects that depend on it`. TGN-009 adds Vue and Svelte rows to the Testing Library test; this test then repeats it. The inline settings table is \[rules\] (TML-003).
- \[ \['react', '@testing-library/react', '19.1.1'\], \['vue', '@testing-library/vue', '3.5.22'\], \['svelte', '@tes (test (test.each), 66-70): **merge** to `tests/unit/cli/generation/eslint/fragments/testing-library.test.ts` `Testing Library reports a debugging call only in test files of projects that depend on it`. Its rows become the vue and svelte rows (TGN-009).
- the Testing Library dependency condition remains inside its actual %s project (test (test.each), 95-118): **delete**. TGN-009: duplicate of testing-library.test.ts once that test has the Vue and Svelte rows.
- \['react', 'vue', 'svelte'\] (test (test.each), 95-95): **delete**. TGN-009.
- the %s bundler uses extensionless paths while the Node.js parent keeps JavaScript suffixes (test (test.each), 120-142): **move** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts` `a bundler scope uses extensionless imports while the Node.js parent keeps .js suffixes`. TGN-068: keep one row; the other five only check a manifest line. The sample writes a \[\[scope\]\] record with path = "app".
- \['astro', 'expo', 'react', 'react-native', 'svelte', 'vue'\] (test (test.each), 120-120): **move** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts` `['react']`. TGN-068.
- Drizzle guards only its declared clients at %s (test (test.each), 144-170): **move** to `tests/unit/cli/generation/eslint/fragments/drizzle.test.ts` `Drizzle reports delete and update without where only for its client names`. Real lint, with the same result at both levels, so level all only (TGN-037). The sample writes a \[\[scope\]\] record with path = "app" and the dotted key drizzle.client_names = \["connection"\].
- \['recommended', 'all'\] as const (test (test.each), 144-144): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- %s native Vue and Svelte presets retain their required security rules in component scopes (test (test.each), 172-210): **delete**. TGN-010: html-injection.test.ts lints the same two rules; the 'off outside the scope' point moves there; the Svelte severities are template constants (TGN-027).
- \['recommended', 'all'\] as const (test (test.each), 172-172): **delete**. TGN-010.
- configuredRules (function, 8-23): **delete**. TGN-043: tests read rules through configFor in tests/setup/generate.ts; its two callers go to different files.
- testingLibraryMessages (function, 26-32): **delete**. TGN-042: lintFindings replaces it; its callers merge or go (TGN-009).

## `tests/cli/generation/eslint/framework/selectors.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/blocks.test.ts; tests/unit/cli/generation/eslint/fragments/nextjs.test.ts; tests/unit/cli/generation/eslint/configuration/trpc.test.ts; tests/unit/cli/generation/eslint/configuration/components.test.ts; tests/unit/cli/generation/eslint/fragments/zod.test.ts; tests/unit/cli/generation/eslint/fragments/translations.test.ts`. Test folders mirror source folders, and this file is a grab bag (TGN-061): each test goes to its fragment or topic file (TGN-056, TGN-019).
- framework selectors preserve native conventions and security levels: %s (test (test.each), 17-39): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts` `React Native and react-hook-form syntax selectors report only at level all (%s)`. TGN-056: keep the selector lint (fragmentSelectorGroups in blocks.ts); delete the severity tables (TGN-027) and the Zod part (TGN-005). The sample writes \[\[scope\]\] records with path = "native", "forms" and "schema"; the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 17-17): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- Next.js server-only rules use the retained explicit server paths (test (test), 41-63): **move** to `tests/unit/cli/generation/eslint/fragments/nextjs.test.ts` `Next.js reports require-server-only in .server files and server folders`. TTC-032: the title says what it checks; TGN-033: the doctor lines 48-52 go to the doctor suggestions test. The sample writes a \[\[scope\]\] record with path = "app".
- %s tRPC procedure checks use declared router roles without crossing scopes (test (test.each), 65-122): **move** to `tests/unit/cli/generation/eslint/configuration/trpc.test.ts` `tRPC procedures need an input schema in router role files of each scope at %s`. Real lint. tRPC has no fragment: its selector comes from the manifest list and the routers role, so it is a topic of the generated configuration. The sample writes \[\[scope\]\] records with path, and child writes architecture.roles.routers = \["child/handlers/\*\*"\] from the repository root (CFR-003); the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 65-65): **move** to `tests/unit/cli/generation/eslint/configuration/trpc.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s component extension declarations select native parsers without plain-scope rule leakage (test (test.each), 124-160): **move** to `tests/unit/cli/generation/eslint/configuration/components.test.ts` `Vue, Svelte and Astro files parse in their scopes, and a plain scope gets none of their rules`. Real: proves the parser wiring. Same result at both levels: level all only (TGN-037). The sample writes \[\[scope\]\] records with path = "app" and "plain".
- \['recommended', 'all'\] as const (test (test.each), 124-124): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- Zod %s omits the three removed rules and keeps retained schema rules (test (test.each), 162-183): **move** to `tests/unit/cli/generation/eslint/fragments/zod.test.ts` `Zod reports z.any() and keeps its schema rules`. TGN-019: one row (no code reads the Zod version) and no removed-rule loop (TGN-005).
- \['3.25.76', '4.6.2'\] (test (test.each), 162-162): **move** to `tests/unit/cli/generation/eslint/fragments/zod.test.ts` `one row (no version parameter)`. TGN-019.
- %s translation rules use root and inherited scoped test paths without sibling leakage (test (test.each), 185-214): **move** to `tests/unit/cli/generation/eslint/fragments/translations.test.ts` `literal UI text is reported outside the test files of each scope at %s`. Real lint. The sample writes \[\[scope\]\] records with path, and app writes test_files = \["app/verification/\*\*"\] from the repository root (CFR-003); the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 185-185): **move** to `tests/unit/cli/generation/eslint/fragments/translations.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).

## `tests/cli/generation/eslint/functions.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts`. TGN-008 deletes the second test and its data; the first joins the TypeScript fragment tests (PLG-029).
- generated lint preserves required class method contracts (test (test), 7-29): **keep** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `the generated TypeScript configuration gives lint rules type information`. PLG-029: the plugin's own test covers the inherited-method exemption; this test only checks that type information reaches the rules.
- generated lint reports local wrappers and preserves exported functions and inline callbacks (test (test), 31-60): **delete**. TGN-008: the plugin test covers these forms one per line.

## `tests/cli/generation/eslint/html-injection.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/components.test.ts`. Joins the component parser test. TGN-010 adds a plain.js check here.
- $configuration rejects raw HTML and accepts text at $level (test (test.each), 8-33): **keep** to `tests/unit/cli/generation/eslint/configuration/components.test.ts` `$configuration reports raw HTML and accepts text, and a plain JavaScript file gets no such rule`. TGN-010: add the plain.js file outside the framework scope; TGN-037: level all only.
- COMPONENTS.flatMap((component) =&gt; (\['recommended', 'all'\] as const).map((level) =&gt; ({ ...component, level }))) (test (test.each), 8-10): **keep** to `tests/unit/cli/generation/eslint/configuration/components.test.ts` `RAW_HTML_CASES (level all only)`. TGN-037.

## `tests/cli/generation/eslint/import-boundaries.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/eslint/boundaries/modules.test.ts`. follows deleted tests: the severity-only test goes (weak, TGN-025); the module boundary test joins boundaries/modules.test.ts.
- generated JavaScript configuration enables project import boundaries (test (test), 10-20): **delete**. weak (only reads one configured severity, TGN-025)
- architecture rules use authored test patterns in each scope and keep checking other files (test (test), 22-46): **move** to `tests/unit/cli/generation/eslint/boundaries/modules.test.ts` `module boundaries skip your test files in each scope and check other files`. Real lint. TTC-032 wording; BoundaryResult is inferred (TGN-046).

## `tests/cli/generation/eslint/javascript.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts`. Import rules of the generated JavaScript configuration.
- %s native import fixes preserve executable Node ESM paths (test (test.each), 9-53): **keep** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts` `ESLint fixes useless path segments and the fixed Node ESM imports still run`. Real. TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 9-9): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/eslint/jest.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/jest.test.ts`. The Jest fragment (generation/eslint/fragments/jest.ts).
- generated lint validates native Jest expect arguments (test (test), 7-30): **delete**. weak: it checks one template constant, jest/valid-expect with maxArgs 1, which is the plugin's default, so the test passes whether gspot sets the option or not; 'Jest rules apply only to their scope for .%s files' covers the Jest fragment wiring and the @jest/globals setting.
- generated ESLint reports a focused Jest test (test (test), 32-49): **delete**. TGN-012: the focused-test finding is checked three times.
- Jest rules apply only to their declared scope for %s (test (test.each), 51-70): **keep** to `tests/unit/cli/generation/eslint/fragments/jest.test.ts` `Jest rules apply only to their scope for .%s files`. Real lint.
- \['js', 'jsx'\] (test (test.each), 51-51): **keep** to `tests/unit/cli/generation/eslint/fragments/jest.test.ts` `['js', 'jsx']`. Same rows.

## `tests/cli/generation/eslint/jsdoc-types.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/jsdoc.test.ts`. JSDoc rules of the generated configuration.
- generated %s ESLint permits JavaScript type documentation and rejects duplicate TypeScript type tags (test (test.each), 16-45): **keep** to `tests/unit/cli/generation/eslint/configuration/jsdoc.test.ts` `JSDoc types are allowed in JavaScript and duplicate TypeScript type tags are reported at %s`. Real lint; the result changes with the level. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] (test (test.each), 16-16): **keep** to `tests/unit/cli/generation/eslint/configuration/jsdoc.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s requires valid JavaScript type documentation and keeps TypeScript type tags disabled (test (test.each), 47-105): **keep** to `tests/unit/cli/generation/eslint/configuration/jsdoc.test.ts` `JavaScript needs valid JSDoc types, and tsc reads the generated jsconfig`. TGN-037: level all only; TGN-039: assert exit codes and file names only; TGN-041: compare objects; TCO-012: delete line 101.
- \['recommended', 'all'\] as const (test (test.each), 47-47): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/eslint/layout.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts`. Import and export sorting; test 1 is deleted.
- generated %s ESLint configuration selects layout by level (test (test.each), 7-18): **delete**. TGN-025, TGN-026: reads one rule value for a file it did not create; the next test covers level-dependent sorting.
- \['recommended', 'all'\] (test (test.each), 7-7): **delete**. TGN-026.
- native sorting fixes $level root and child imports and exports (test (test.each), 20-54): **keep** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts` `imports and exports are sorted at level all only, in root and child scopes ($level)`. Real fix. TGN-005: delete lines 44-45; TGN-051: drop enabled and name. The sample writes a \[\[scope\]\] record with path = "app".
- SORT_LEVELS (test (test.each), 20-20): **keep** to `tests/unit/cli/generation/eslint/configuration/imports.test.ts` `SORT_LEVELS`. Same rows; TGN-051 drops enabled.

## `tests/cli/generation/eslint/levels.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts`. Level behavior of the generated configuration. The Prettier-layout test of eslint/policy.test.ts joins it.
- %s keeps scoped framework rules and syntax selectors inside their project (test (test.each), 13-42): **keep** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `%s keeps framework rules and syntax selectors inside their scope`. Real. The sample writes a \[\[scope\]\] record with path = "app"; the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 13-13): **keep** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- all retains the effective recommended rules for the same applicable React file (test (test), 44-60): **keep** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `level all keeps every rule that recommended turns on for a React file`. Real (TGN-002 relies on it). The loop over both levels uses LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- all keeps native deferred-comment checks after prose stops treating todo as a promise (test (test), 62-94): **keep** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `level all reports TODO comments`. TTC-032: the title says what the test checks.
- %s preserves generated script and test exclusions while applying native options (test (test.each), 96-122): **keep** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `%s applies your rule options except in script and test files`. Real: rule blocks depend on your options and the file roles. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 96-96): **keep** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s authored rule payloads expose their level before preset masking (test (test.each), 124-171): **delete**. TGN-002: renders the template with fake hooks to watch rule blocks; no output changed.
- \['recommended', 'all'\] as const (test (test.each), 124-124): **delete**. TGN-002.
- authored all-only rule literals belong to the explicit level branch (test (test), 173-199): **delete**. TGN-002: polices how the template source is written.

## `tests/cli/generation/eslint/mobile-applicability.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/fragments/expo.test.ts; tests/unit/cli/generation/eslint/fragments/react-native.test.ts`. TGN-061: one test per fragment.
- Expo rules and Doctor apply to the Expo scope and leave its bare native sibling alone (test (test), 13-41): **move** to `tests/unit/cli/generation/eslint/fragments/expo.test.ts` `Expo rules apply in the Expo scope and not in its React Native sibling`. Real lint. TGN-033: the expo/doctor planning lines 22-27 move to tests/unit/cli/planning/checks.test.ts.
- native text component options preserve raw-text findings and ordinary Text components (test (test), 43-70): **move** to `tests/unit/cli/generation/eslint/fragments/react-native.test.ts` `react-native/no-raw-text keeps your skip option and reports raw text in a View`. Real lint. The settings object writes rules: { enabled: false } (TML-003).

## `tests/cli/generation/eslint/nextjs.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/nextjs.test.ts`. The Next.js fragment; two tests of framework/ join it.
- Next.js route rules resolve two project roots and disable route lookup in an empty scope (test (test), 10-58): **keep** to `tests/unit/cli/generation/eslint/fragments/nextjs.test.ts` `Next.js route rules use each project root and stay off in a scope without pages`. Real. TGN-043: configFor replaces NextEslintConfiguration. The sample writes \[\[scope\]\] records with path = "apps/first", "apps/second" and "apps/empty".
- Next.js App Router links leave the Pages Router rule off (test (test), 60-77): **keep** to `tests/unit/cli/generation/eslint/fragments/nextjs.test.ts` `an App Router link leaves the Pages Router rule off`. Real.

## `tests/cli/generation/eslint/node-scripts.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/node-scripts.test.ts`. Node script files in the generated configuration. Test 3 moves to files.test.ts (TGN-032). Its data goes to tests/config/eslint/node-scripts.ts.
- %s native ESLint checks tagged Node files and retains typed and excluded file ownership (test (test.each), 36-73): **keep** to `tests/unit/cli/generation/eslint/configuration/node-scripts.test.ts` `ESLint lints Node script files by role and shebang, and skips generated, vendored and other files (%s)`. Real. TGN-041, TGN-042, TGN-051; TCO-012: delete lines 70-71. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 36-36): **keep** to `tests/unit/cli/generation/eslint/configuration/node-scripts.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s native extensionless Node contracts report syntax, runtime, imports and scoped structural limits (test (test.each), 75-102): **keep** to `tests/unit/cli/generation/eslint/configuration/node-scripts.test.ts` `Node scripts without an extension get syntax, global, engine, import and scope limit findings (%s)`. Real. TGN-041; TTC-032: the routine/strict fields become recommended/all. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 75-75): **keep** to `tests/unit/cli/generation/eslint/configuration/node-scripts.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- native Node glob and output boundaries retain POSIX filenames in %s (test (test.skipIf), 104-153): **move** to `tests/unit/cli/generation/eslint/files.test.ts` `Node file patterns match a file name with a backslash and not its neighbor`. TGN-032: test filePatterns (generation/eslint/files.ts) with picomatch; drop the ESLint build and the parseOutput half; with no files written, the Windows skip goes.
- NODE_SCRIPT_NATIVE_ROOTS (test (test.skipIf), 104-104): **delete**. TGN-032: report roots no longer matter once the test matches patterns directly.
- process.platform === 'win32' (test (test.skipIf), 104-104): **delete**. TGN-032: no file with a backslash is written, so Windows needs no skip.
- nodeFindings (function, 25-34): **merge** to `tests/setup/generate.ts` `lintFindings`. TGN-042: one helper replaces the copies of the finding filter.

## `tests/cli/generation/eslint/overlaps.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/duplicate-rules.test.ts`. TGN-028: duplicate rules are switched off by generation/eslint/configuration.ts from the rule tables in packages/cli/src/config/generation/lint-rules.ts, so the test sits in configuration/ beside the other configuration tests; one test, one sandbox, one source per pair; three data files and the type file go. It lints real defects and checks the visible result (one finding, not two), which a broken off-list would change.
- $level $name (test (test.each), 110-144): **keep** to `tests/unit/cli/generation/eslint/configuration/duplicate-rules.test.ts` `each pair of duplicate rules reports a defect once, from the kept rule`. TGN-028: drop columns, the fix step and the form matrix. The level column of the rows uses LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- overlaps.flatMap((scenario) =&gt; (\['recommended', 'all'\] as const).map((level) =&gt; ({ ...scenario, level }))) (test (test.each), 110-110): **delete**. TGN-028: one test over DUPLICATE_RULE_CASES at one level replaces the scenario and level matrix.
- overlaps (const, 38-108): **delete**. TGN-028: the generic case type with a callback per case goes.

## `tests/cli/generation/eslint/package-manifests.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/package-json.test.ts`. package-json rules of the generated configuration; the glossary keeps 'manifest' for manifest.toml.
- every package.json gets the package-json rules and no code rule beside a test runner (test (test), 8-30): **keep** to `tests/unit/cli/generation/eslint/configuration/package-json.test.ts` `every package.json gets the package-json rules and no code rules, also beside a test runner`. Real lint. The inline settings table is \[rules\] (TML-003).
- package rule exceptions retain neighboring violations (test (test), 32-58): **keep** to `tests/unit/cli/generation/eslint/configuration/package-json.test.ts` `an ignore of a package-json rule for one file keeps the finding in other files`. Real lint. The inline settings table is \[rules\] (TML-003).

## `tests/cli/generation/eslint/parameter-limits.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/parameter-limits.test.ts`. TGN-018: keep this unit test with the case shape of the tools test, and delete tests/tools/generation/parameter-limits.test.ts.
- 'ESLint for ${language} counts declared parameters with maximum %i${language === 'typescript' ? ' and does not count thi (test (test.each), 7-41): **keep** to `tests/unit/cli/generation/eslint/configuration/parameter-limits.test.ts` `ESLint counts declared parameters against a limit of %i`. Real lint. TGN-018: same case shape as the deleted tools test. A raised parameter limit is written function_parameters = { value = &lt;maximum&gt;, reason = "..." } in \[limits.&lt;language&gt;\] (CFR-002).
- \[7, 8\] (test (test.each), 7-7): **keep** to `tests/unit/cli/generation/eslint/configuration/parameter-limits.test.ts` `[7, 8]`. Same rows.

## `tests/cli/generation/eslint/policy.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts; tests/unit/cli/generation/eslint/configuration/suppression-comments.test.ts; tests/unit/cli/generation/eslint/fragments/typescript.test.ts`. TGN-061: eslint/policy holds three unrelated tests and clashes with the settings folder.
- %s leaves layout to Prettier and applies empty-object selectors at their level (test (test.each), 23-67): **move** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `layout rules stay off and empty-object fallbacks are reported only at level all (%s)`. Real lint. TGN-041: compare objects; TCO-012: delete line 65. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 23-23): **move** to `tests/unit/cli/generation/eslint/configuration/levels.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s reports unused directives once and requires suppression reasons (test (test.each), 69-128): **move** to `tests/unit/cli/generation/eslint/configuration/suppression-comments.test.ts` `an unused eslint-disable comment is reported`. CKG-004 deletes the eslint-comments plugin and its require-description checks (lines 79-114); TGN-005: legacy; TGN-029: pin check; TGN-037: level all only; TCO-012: line 126.
- \['recommended', 'all'\] as const (test (test.each), 69-69): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- %s native type fixes preserve value exports and use separate import and export statements (test (test.each), 130-192): **move** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `type imports and exports are reported at level all and not at recommended (%s)`. TGN-040: lint index.ts once per level and assert the two rule ids; delete the fix, format, compile and run steps; TCO-012. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 130-130): **move** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).

## `tests/cli/generation/eslint/react-rules.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/fragments/react-native.test.ts; tests/unit/cli/generation/npm.test.ts`. follows deleted tests: the severity-only test goes (weak, TGN-025); the React Native lint test and the tool project test are left.
- the generated %s fragment enables its declared native rules (test (test.each), 52-65): **delete**. weak (only reads configured severities and never lints the files, TGN-025; the React rules are linted by the html-injection, levels and react-native tests)
- \[ \['react', WEB_FILES, WEB_EXPECTED\], \['react-native', NATIVE_FILES, NATIVE_EXPECTED\], \] as const (test (test.each), 52-55): **delete**. weak (rows of the deleted severity test, TGN-025)
- react/self-closing-comp waits for the all level (test (test), 67-76): **delete**. TGN-025: reads one rule value at two levels; level masking is linted by other tests (structure, jsdoc, vitest).
- the emitted bare project requires native linting without Expo or DOM tools (test (test), 78-89): **move** to `tests/unit/cli/generation/npm.test.ts` `a React Native project without Expo installs no Expo or DOM lint plugins`. Tests the npm tool project (generation/npm.ts).
- $name reports its native rule and accepts the original correction (test (test.each), 91-115): **move** to `tests/unit/cli/generation/eslint/fragments/react-native.test.ts` `$name reports its React Native rule and accepts the fixed component`. Real lint and fix. TCO-012: delete lines 106 and 112-113.
- \[...NATIVE_CORRECTIONS\] (test (test.each), 91-91): **move** to `tests/unit/cli/generation/eslint/fragments/react-native.test.ts` `REACT_NATIVE_FIXES`. The 'bare react-native' row (react-native/no-raw-text on raw text in a View, fixed with Text) repeats 'react-native/no-raw-text keeps your skip option and reports raw text in a View', so only the expo row stays, as a plain test.
- configured (function, 29-50): **delete**. After the self-closing test goes, its two remaining rows land in two fragment files; each builds its sandbox with settingsText (buildPolicy today) and createEslint (TGN-044).

## `tests/cli/generation/eslint/required-rules.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/required-rules.test.ts`. The rule list becomes a literal test constant in tests/config/eslint/lint-rules.ts and the manifests lose required_eslint_rules; PLG-012: the validateEslintPresets test goes.
- $configuration $level $route $ending rules keep their applicability (test (test.each), 29-52): **keep** to `tests/unit/cli/generation/eslint/configuration/required-rules.test.ts` `the required $configuration rules for .$ending files are on at $level ($route)`. The owner asked for this on/off test (owner decision 24).
- cases (test (test.each), 29-29): **keep** to `tests/unit/cli/generation/eslint/configuration/required-rules.test.ts` `cases`. Same rows; the test pairs REQUIRED_RULE_CASES with LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- manifest preset metadata agrees with its captured exports (test (test), 54-91): **delete**. PLG-012: tests a drift guard the build already runs on the real manifests.
- allRules (const, 11-11): **delete**. TGN-029: the inline list states each rule's level, so the test reads no manifest.
- contracts (const, 12-18): **move** to `tests/config/eslint/lint-rules.ts` `REQUIRED_RULES`. \[required_eslint_rules\] leaves the manifests, so REQUIRED_RULES is a literal list keyed by configuration and file ending, a test constant in tests/config/eslint/lint-rules.ts.
- cases (const, 19-27): **move** to `tests/config/eslint/lint-rules.ts` `REQUIRED_RULE_CASES`. Built only from REQUIRED_RULES, plain data with no level, so it sits beside it in tests/config/eslint/lint-rules.ts; the test pairs the rows with LEVELS (TGN-037).

## `tests/cli/generation/eslint/restricted-imports.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/zustand.test.ts`. Your import restrictions and the Zustand fragment's restriction in one no-restricted-imports rule.
- %s retains authored imports in store files and configuration restrictions elsewhere (test (test.each), 10-52): **keep** to `tests/unit/cli/generation/eslint/fragments/zustand.test.ts` `%s keeps your import restrictions in store files and the Zustand restriction elsewhere`. Real lint; the result changes with the level. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 10-10): **keep** to `tests/unit/cli/generation/eslint/fragments/zustand.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- Zustand exempts all eight default module store extensions from configuration restrictions (test (test), 54-67): **delete**. TGN-025: reads the configuration only; the first test already lints a store file.

## `tests/cli/generation/eslint/runtimes.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/runtimes.test.ts`. Tests runtimeBlocks and scriptPaths (generation/eslint/runtimes.ts). The invalid-runtime test moves to the settings tests.
- runtime globals and Node.js rules are isolated: %j (test (test.each), 20-45): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `runtime globals and Node.js rules stay apart: %j`. Real. PLG-011: the row service-worker becomes serviceworker. The runtime is the runtime field of a \[\[tools.eslint.override\]\] record: { paths = \["application/\*\*"\], runtime = &lt;runtime&gt; } (TML-008).
- RUNTIME_CASES (test (test.each), 20-20): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `RUNTIME_CASES`. Same rows.
- ES modules reject CommonJS globals and .cjs files retain CommonJS execution (test (test), 47-61): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `ES modules reject CommonJS globals and .cjs files keep CommonJS`. Real lint.
- framework runtimes and authored overrides stay within their project scopes (test (test), 63-98): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `framework runtimes and your runtime settings stay inside their scopes`. Real. Runtimes are root \[\[tools.eslint.override\]\] records with paths written from the repository root (native/src/browser.js, native/scripts/worker.js, native/server/\*\*); the scopes are \[\[scope\]\] records (CFR-003, CFR-004).
- later authored runtime selectors replace earlier environments instead of merging globals (test (test), 100-117): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `a later [[tools.eslint.override]] runtime replaces an earlier one`. Real lint. Two \[\[tools.eslint.override\]\] records in order: paths = \["\*\*/\*.js"\] with runtime = "browser", then paths = \["worker.js"\] with runtime = "worker" (TML-008).
- framework presets retain no globals from another runtime: %j (test (test.each), 119-136): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `framework presets keep no globals of another runtime: %j`. Real lint. The setting is a \[\[tools.eslint.override\]\] record with paths = \["src/\*\*"\] and runtime = "worker" (TML-008).
- FRAMEWORK_RUNTIME_CASES (test (test.each), 119-119): **keep** to `tests/unit/cli/generation/eslint/runtimes.test.ts` `FRAMEWORK_RUNTIME_CASES`. Same rows.
- the shipped runtime names match the pinned globals data (test (test), 138-147): **delete**. PLG-011: polices that someone ran the rule-list script.
- invalid runtime %s identifies the authored setting (test (test.each), 149-153): **move** to `tests/unit/cli/settings/read.test.ts` `an invalid runtime %s names the setting`. TGN-031: a settings validation test. PLG-011: drop the serviceworker row, which becomes valid. The invalid value is the runtime field of a \[\[tools.eslint.override\]\] record, so the error names that record field (TML-008).
- INVALID_RUNTIMES (test (test.each), 149-149): **move** to `tests/unit/cli/settings/read.test.ts` `INVALID_RUNTIMES`. Same rows, without serviceworker.
- root runtime choices reach active descendants without adding an inactive namespace to sibling scopes (test (test), 155-190): **delete**. Runtimes are root \[\[tools.eslint.override\]\] records (CFR-004), so no runtime map is inherited by scopes; what is left (a record reaches a scoped file, a later record wins) is checked by "framework runtimes and your runtime settings stay inside their scopes" and by the test that a later \[\[tools.eslint.override\]\] runtime replaces the one before it.
- Mise task defaults follow the selected runner: %s (test (test.each), 192-204): **delete**. Tests deleted code: INX-003 deletes the runner setting and INX-011 always adds .mise/tasks/\*\* to the script paths; what is left would only check that one constant glob is in the list.
- \['mise', 'npm'\] as const (test (test.each), 192-192): **delete**. Rows of the deleted runner test (INX-003).
- native globals capture refuses malformed runtime dictionaries (test (test), 206-210): **delete**. PAR-031 moves eslintGlobalsSchema to scripts/parsers/eslint.ts, and the tests of scripts/ are deleted.

## `tests/cli/generation/eslint/scopes.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts`. TGN-061: a TypeScript scope test.
- the shared ESLint configuration reads TypeScript selected only in an API scope (test (test), 10-30): **keep** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `a TypeScript scope under a root without TypeScript gets typed rules`. Real lint. The sample writes a \[\[scope\]\] record with path = "api".

## `tests/cli/generation/eslint/selectors.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/eslint/blocks.test.ts; tests/unit/cli/generation/eslint/fragments/express.test.ts`. selectorGroups moves from eslint/public.ts to blocks.ts; the Express test goes to the Express fragment test.
- general selectors form one group for every code file, in first-mention order (test (test), 17-19): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts` `general selectors form one group for every code file, in first-mention order`. Real unit test of selectorGroups.
- an allowed path set gets its own group without the selector that allows it (test (test), 21-27): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts` `an allowed path set gets its own group without the selector that allows it`. Real unit test.
- a selector with files applies there together with the general ones (test (test), 29-44): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts` `a selector with files applies there together with the general ones`. Real unit test.
- an empty allowed list adds no group (test (test), 46-48): **move** to `tests/unit/cli/generation/eslint/blocks.test.ts` `an empty allowed list adds no group`. Real unit test.
- Express selectors and native rule owners retain their level: %s (test (test.each), 50-87): **move** to `tests/unit/cli/generation/eslint/fragments/express.test.ts` `Express selectors and security rules apply in the Express scope at their level (%s)`. TGN-027: delete the LEVEL_RULES assertions; the rest depends on scope and level. The setting is import_extension = "js" (TML-008); the sample writes a \[\[scope\]\] record with path = "api"; the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 50-50): **move** to `tests/unit/cli/generation/eslint/fragments/express.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).

## `tests/cli/generation/eslint/structure.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts`. Structural rules of the generated configuration.
- generated all lint checks authored directories named after build outputs (test (test), 15-35): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `level all lints folders named like build output and skips folders marked linguist-generated in .gitattributes`. Real lint. \[\[generated\]\] is deleted (CFR-005), so the sandbox marks emitted/\*\* linguist-generated in .gitattributes.
- generated %s lint applies size limits in test files only at level all (test (test.each), 37-62): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `size limits apply to test files only at level all (%s)`. Real lint. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] (test (test.each), 37-37): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- generated %s structural rules apply to root and nested files only at level all (test (test.each), 64-91): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `trivial-file and trivial-function rules apply to root and nested files only at level all (%s)`. Real lint. The sample writes a \[\[scope\]\] record with path = "app"; the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] (test (test.each), 64-64): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s exempts JSON attributes from declared JavaScript import extensions in root and nested scopes (test (test.each), 93-127): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `a JSON import attribute is accepted where your import extensions need a suffix`. Real lint. Same result at both levels: level all only (TGN-037). The setting is import_extension = "js" (TML-008), and the sample writes a \[\[scope\]\] record with path = "app".
- \['recommended', 'all'\] (test (test.each), 93-93): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- %s %s preserves native root and child import rules (test (test.each), 129-151): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `%s %s: import, re-export and barrel rules in root and child scopes`. TGN-052: one sandbox per case runs the import, re-export and barrel checks. limits.index_exports = 2 is stricter than the default 20, so it is a plain value with no reason (CFR-002); the sample writes a \[\[scope\]\] record with path = "app".
- NATIVE_POLICY_CASES (test (test.each), 129-129): **keep** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `LEVEL_REEXPORT_CASES`. Same rows (renamed with the constant).
- %s %s preserves exact native reexport selectors and index exemptions (test (test.each), 153-177): **merge** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `%s %s: import, re-export and barrel rules in root and child scopes`. TGN-052: same sandbox and settings as the import test, where limits.index_exports = 2 is a plain value with no reason (CFR-002) and the sample writes a \[\[scope\]\] record with path = "app".
- NATIVE_POLICY_CASES (test (test.each), 153-153): **merge** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `%s %s: import, re-export and barrel rules in root and child scopes`. TGN-052.
- %s %s preserves the native barrel threshold and module classification (test (test.each), 179-202): **merge** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `%s %s: import, re-export and barrel rules in root and child scopes`. TGN-052: same sandbox and settings as the import test, where limits.index_exports = 2 is a plain value with no reason (CFR-002) and the sample writes a \[\[scope\]\] record with path = "app".
- NATIVE_POLICY_CASES (test (test.each), 179-179): **merge** to `tests/unit/cli/generation/eslint/configuration/structure.test.ts` `%s %s: import, re-export and barrel rules in root and child scopes`. TGN-052.

## `tests/cli/generation/eslint/takeover.test.ts`

- (the file) (file): **move** to `tests/unit/cli/commands/init/replace/tool-files.test.ts`. TGN-030: these are init replace tests (commands/init/replace.ts; glossary 'replace'). The replace.ts tests exceed 300 lines together (about 257 lines plus these 190), so they go into tests/unit/cli/commands/init/replace/, one file per behavior.
- native Stylelint discovery uses owned package fields at both levels in %s (test (test.each), 16-61): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `init replaces your .stylelintrc.mjs with a package.json field that Stylelint finds, in scope '%s'`. Real. TTC-032 wording (no 'native', 'owned', 'takeover'). The loop that runs gspot set level uses LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['', 'app'\] (test (test.each), 16-16): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `['', 'app']`. Same rows.
- native Stylelint discovery retires a standalone module configuration without adding a package field (test (test), 63-96): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `init replaces a standalone .stylelintrc.mjs without adding a package.json field`. Real.
- initialization retires the native ESLint configuration %s (test (test.each), 98-124): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `init replaces your ESLint file %s`. Real; 'replace', not 'retire'.
- \['eslint.config.mts', 'eslint.config.cts'\] (test (test.each), 98-98): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `['eslint.config.mts', 'eslint.config.cts']`. Same rows.
- initialization retires native Knip configuration $file and preserves unsupported names (test (test.each), 126-186): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `init replaces your Knip file $file and keeps knip.config.mjs`. Real.
- KNIP_TAKEOVERS (test (test.each), 126-126): **keep** to `tests/unit/cli/commands/init/replace/tool-files.test.ts` `KNIP_FILES`. Same rows (renamed with the constant).

## `tests/cli/generation/eslint/tanstack-query.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/tanstack-query.test.ts`. The TanStack Query fragment.
- %s TanStack rules report void queries and callback order and pass after fixes (test (test.each), 10-48): **keep** to `tests/unit/cli/generation/eslint/fragments/tanstack-query.test.ts` `TanStack Query reports a void query function and the mutation callback order`. Real lint. TGN-037: level all only; TCO-012: delete line 46.
- \['recommended', 'all'\] as const (test (test.each), 10-10): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/eslint/testing-library.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/testing-library.test.ts`. The Testing Library fragment; framework/rules.test.ts:66-93 merges in.
- 'Testing Library at ${level} reports a native finding only for selected dependency-owned test files' (test (test), 7-41): **keep** to `tests/unit/cli/generation/eslint/fragments/testing-library.test.ts` `Testing Library reports a debugging call only in test files of projects that depend on it`. TGN-009: add vue and svelte rows; TGN-037: one level. The sample writes \[\[scope\]\] records with path = "child" and "neighbor".

## `tests/cli/generation/eslint/typescript-eslint.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts`. The TypeScript fragment; the type-import, type-information and scoped TypeScript tests join it.
- an interface is reported once by consistent-type-definitions and not by types-placement (test (test), 24-36): **delete**. fake: its point, no second report from gspot/types-placement, cannot fail because that rule does not exist; what is left reads one fixed template rule
- index-only reexports keep a nonduplicate barrel and reject forwarding from an ordinary module (test (test), 38-65): **keep** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `reexports = index-only keeps re-exports in index files and reports forwarding elsewhere`. Real lint.
- generated TypeScript reports an unused ordinary local once and accepts disposal-only bindings (test (test), 67-97): **keep** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `an unused local is reported once and using declarations are accepted`. Real lint.
- generated TypeScript enables native export validation at %s (test (test.each), 99-112): **delete**. TGN-025: reads one rule value; the old lint expectation tested upstream behavior.
- \['recommended', 'all'\] as const (test (test.each), 99-99): **delete**. TGN-025.
- messagesOf (function, 12-22): **merge** to `tests/setup/generate.ts` `lintFindings`. TGN-042.

## `tests/cli/generation/eslint/vite-entries.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/configuration/entry-files.test.ts`. TGN-061: no Vite is involved; the entries are Knip entries, so vite-entries becomes entry-files.
- Vite entry files keep structural rules at %s in nested scopes (test (test.each), 28-66): **keep** to `tests/unit/cli/generation/eslint/configuration/entry-files.test.ts` `Knip entry files still get the trivial-file rules at %s, in nested scopes`. TTC-032 title. Real lint. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] (test (test.each), 28-28): **keep** to `tests/unit/cli/generation/eslint/configuration/entry-files.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- trivialFindings (function, 11-20): **move** to `tests/unit/cli/generation/eslint/configuration/entry-files.test.ts` `trivialFindings`. Called three times by the test; built on lintFindings (TGN-042). Values to config: ENTRY_FOLDERS = \['src', 'api/src'\] -&gt; tests/config/eslint/structure.ts; TRIVIAL_RULES = \['gspot/no-trivial-files', 'gspot/no-trivial-functions'\] -&gt; tests/config/eslint/structure.ts
- trivialFiles (function, 23-26): **move** to `tests/unit/cli/generation/eslint/configuration/entry-files.test.ts` `trivialFiles`. Called twice by the test; it reads TRIVIAL_RULES\[0\] ('gspot/no-trivial-files') from tests/config/eslint/structure.ts.

## `tests/cli/generation/eslint/vitest.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/eslint/fragments/vitest.test.ts`. The Vitest fragment. Test 1 tests the role rule and moves to boundaries/roles.test.ts.
- %s closes test support to runtime code in its scope (test (test.each), 19-41): **delete**. duplicate (a runtime import of the test_harness folder is rejected in root and child scopes by 'native role ownership respects %s scopes' in tests/cli/generation/eslint/architecture.test.ts; jest or vitest selection plays no part)
- \['jest', 'vitest'\] (test (test.each), 19-19): **delete**. duplicate (rows of the deleted test-harness import test)
- Vitest rules apply without a harness role (test (test), 43-52): **delete**. TGN-011: the next test checks the same value at both levels and lints.
- %s Vitest retains required test rules and all-only strict equality (test (test.each), 54-85): **keep** to `tests/unit/cli/generation/eslint/fragments/vitest.test.ts` `Vitest reports a focused test without a fix, and strict equality only at level all (%s)`. Real lint; the result changes with the level. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 54-54): **keep** to `tests/unit/cli/generation/eslint/fragments/vitest.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- ruleReports (function, 11-17): **merge** to `tests/setup/generate.ts` `lintFindings`. TGN-042.

## `tests/cli/generation/every-template.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/tool-files.test.ts`. Every emitted tool file must parse (emitToolFiles in tool-files.ts): product behavior, kept. CFL-001 replaces the templates with builders, so no templates.ts exists.
- every configuration renders files their readers parse at level %s (test (test.each), 57-102): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `every configuration's tool files parse at level %s`. TGN-066: delete lines 90-94; TGN-050: two skip-list names. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] (test (test.each), 57-57): **keep** to `tests/unit/cli/generation/tool-files.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- PARSERS (const, 18-37): **move** to `tests/unit/cli/generation/tool-files.test.ts` `PARSERS`. Used by the parse test.
- parseJson (function, 39-43): **move** to `tests/unit/cli/generation/tool-files.test.ts` `parseJson`. Used by PARSERS.
- parseModule (function, 45-51): **move** to `tests/unit/cli/generation/tool-files.test.ts` `parseModule`. Used by PARSERS.
- configurations (const, 53-55): **move** to `tests/unit/cli/generation/tool-files.test.ts` `configurations`. Used by the parse test.

## `tests/cli/generation/formatting.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/formatting.test.ts`. Tests prettierConfiguration and editorconfigOverrides (generation/formatting.ts). The two Prettier ignore tests move to ignore-patterns.test.ts; the Taplo test goes (TGN-062).
- %s keeps Taplo defaults and applies only declared formatting choices (test (test.each), 33-55): **delete**. TGN-027: checks literal Taplo defaults; the extra-option part repeats the TOML write-and-read test (serialization/toml.test.ts:80-121).
- \['recommended', 'all'\] as const (test (test.each), 33-33): **delete**. TGN-027.
- the format width reaches editors and generated tool files (test (test), 57-104): **keep** to `tests/unit/cli/generation/formatting.test.ts` `format.indent_width reaches EditorConfig, Prettier and each tool file`. Real. TGN-033: the shfmt command-line part (lines 75-82) moves to tests/unit/cli/execution/command/placeholders.test.ts; compare parsed files with toMatchObject (TGN-046).
- an explicit YAML width override remains consistent between EditorConfig and Prettier (test (test), 106-136): **keep** to `tests/unit/cli/generation/formatting.test.ts` `a YAML indent override gives EditorConfig and Prettier the same width`. Real: Prettier resolves both files.
- formatter overrides agree for explicit configuration and editor discovery (test (test), 138-169): **keep** to `tests/unit/cli/generation/formatting.test.ts` `Prettier overrides agree in the tool file, the root pointer and editor lookup`. Real.
- generated Prettier ignore patterns give $file ignored=$ignored (test (test.each), 171-184): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `the generated .prettierignore ignores $file: $ignored`. Tests selectedIgnorePaths and generatedIgnores (ignore-patterns.ts). GEN-009: one .prettierignore. The sandbox marks generated/\*\* linguist-generated and vendored/\*\* linguist-vendored in .gitattributes, and the .prettierignore takes those patterns; the root exclude is deleted, so its row goes (TMF-001, TMF-003, CFR-005; see PRETTIER_IGNORE_SETTINGS and PRETTIER_IGNORE_CASES).
- IGNORE_CASES (test (test.each), 171-171): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `PRETTIER_IGNORE_CASES`. Same rows (renamed with the constant).
- prettierConfiguration (describe (describe), 195-239): **keep** to `tests/unit/cli/generation/formatting.test.ts` `prettierConfiguration`. Unit tests of prettierConfiguration.
- prettierConfiguration &gt; a plugin is loaded from the tool project installation relative to each tool file (test (test), 196-215): **keep** to `tests/unit/cli/generation/formatting.test.ts` `prettierConfiguration > a plugin is imported from the tool project relative to each tool file`. Real unit test. The hand-built settings write extra: undefined (POL-034).
- prettierConfiguration &gt; plugin overrides come before policy overrides, and no plugin adds no key (test (test), 217-238): **keep** to `tests/unit/cli/generation/formatting.test.ts` `prettierConfiguration > plugin overrides come before your overrides, and no plugin adds no key`. Real unit test. The hand-built settings write extra: undefined (POL-034).
- %s language editor ignores (describe (describe.each), 241-269): **delete**. TGN-037: the level loop around the language ignore test goes; the test moves to ignore-patterns.test.ts.
- %s language editor ignores &gt; \['recommended', 'all'\] as const (describe (describe.each), 241-241): **delete**. TGN-037.
- %s language editor ignores &gt; $name emits only selected language editor pointers and ignore paths (test (test.each), 242-268): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `$name: Prettier ignores only the selected languages' folders, with pointers where JavaScript is selected`. Real. TGN-005: drop .prettierrc.json (line 263); TGN-033: drop lines 264-266 (manifest constant); GEN-009: one .prettierignore.
- %s language editor ignores &gt; LANGUAGE_IGNORES (test (test.each), 242-242): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `LANGUAGE_IGNORES`. Same rows.
- %s emits EditorConfig native options under the checker name (test (test.each), 271-290): **keep** to `tests/unit/cli/generation/formatting.test.ts` `extra editorconfig-checker options reach .editorconfig`. Real. TGN-031: the settings lines 285-288 move to the settings tests; same result at both levels, so level all only (TGN-037). POL-034: verbatim becomes extra. The sample writes \[tools.editorconfig-checker.extra\] with value = { "\*.txt" = { end_of_line = "crlf" } } and reason = "..." (CFR-002).
- \['recommended', 'all'\] as const (test (test.each), 271-271): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- policy (const, 186-191): **move** to `tests/unit/cli/generation/formatting.test.ts` `settings`. Setup for the prettierConfiguration tests. Glossary: what gspot.toml holds is 'settings', not 'policy'. The record header is \[\[format.override\]\].
- selected (const, 192-192): **move** to `tests/unit/cli/generation/formatting.test.ts` `selected`. Setup for the prettierConfiguration tests.
- { format } (const, 193-193): **move** to `tests/unit/cli/generation/formatting.test.ts` `{ format }`. Setup for the prettierConfiguration tests.

## `tests/cli/generation/guides.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/rules.test.ts`. TGN-034: rule file selection; 'guides' is a second name. Merges into the rule selection test at tests/unit/cli/rules.test.ts (src/rules.ts); together about 270 lines.
- recommended guides omit sections marked for level all (test (test), 33-37): **delete**. Section filtering at level recommended stays covered by the unit test of textAtLevel ('level filtering respects fenced examples ...') and its wiring by 'a rule file whose sections are all for level all is written only at all'.
- a rule whose every section is for level all installs only at all (test (test), 39-45): **keep** to `tests/unit/cli/rules.test.ts` `a rule file whose sections are all for level all is written only at all`. Real.
- conditional guides follow file and dependency evidence (test (test), 47-60): **keep** to `tests/unit/cli/rules.test.ts` `rule files that need a file or a dependency are written only when it is there`. Real.
- Swift guides require parsed imports and ignore comments and strings (test (test), 62-69): **keep** to `tests/unit/cli/rules.test.ts` `Swift rule files need a real import, not one in a comment or string`. Real.
- Node agent rules follow $name evidence (test (test.each), 71-80): **delete**. TGN-015: Node runtime detection is tested in configurations/detect.test.ts and NODE.md selection in agent-rules/assemble.test.ts.
- runtimeEvidenceCases() (test (test.each), 71-71): **delete**. TGN-015.
- Drizzle PostgreSQL agent rules follow the $driver driver (test (test.each), 82-90): **keep** to `tests/unit/cli/rules.test.ts` `the Drizzle rules are written only for a PostgreSQL driver: $driver`. Real.
- \[...DRIZZLE_DRIVERS\] (test (test.each), 82-82): **keep** to `tests/unit/cli/rules.test.ts` `DRIZZLE_DRIVERS`. Padding: the four drivers hit one dependency lookup, so one PostgreSQL driver (pg) and one other (mysql2) stay.
- shared HTTP and OpenAPI agent rules use their engineering and tool owners (test (test), 92-98): **delete**. self-policing (checks the folders of two unconditional rule files and that the former Express copies stay gone, TGN-005)
- Playwright guidance follows $dependency with $runner at $level in $project (test (test.each), 104-130): **delete**. duplicate: the @playwright/test condition is checked by 'rule files that need a file or a dependency are written only when it is there', rule selection in a child scope by '$runtime rules with $dependency in $scope select DENO.md and NODE.md', and the 'playwright' row only repeats a manifest list entry
- projects.flatMap((project) =&gt; PLAYWRIGHT_RUNNERS.flatMap((runner) =&gt; PLAYWRIGHT_DEPENDENCIES.map((de (test (test.each), 104-110): **delete**. duplicate: rows of the deleted Playwright test
- generatedGuides (function, 11-23): **move** to `tests/unit/cli/rules.test.ts` `writtenRuleFiles`. TGN-034: rename generatedGuides. Values to config: RULE_CONFIGURATIONS = \['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'\] -&gt; tests/config/rules.ts
- recommended (const, 25-25): **move** to `tests/unit/cli/rules.test.ts` `recommended`. Shared by the two level tests (beforeAll).
- all (const, 26-26): **move** to `tests/unit/cli/rules.test.ts` `all`. Shared by the level and condition tests (beforeAll).
- projects (const, 100-102): **delete**. No level or scope matrix; the rows are written inline.

## `tests/cli/generation/hooks.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/hooks.test.ts`. Tests hookFiles (generation/hooks.ts). tests/tools/generation/hooks.test.ts merges in (TTO-005, TTO-009).
- a repository at the Git top level enters no folder (test (test), 8-15): **keep** to `tests/unit/cli/generation/hooks.test.ts` `a repository at the Git top level gets hooks that change no folder`. Real. The runner setting is deleted and the hooks take the start command from the repository (INX-003): this sandbox has no package.json, so its hooks run mise exec -- gspot, and the merged start-command cases cover npm, pnpm, yarn and bun from the root package.json, else mise; the commit-msg hook runs gspot check --message-file "$1" (CLX-006).

## `tests/cli/generation/html.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-file-sources/html-validate.test.ts`. Tests the html-validate builder (tool-file-sources/html-validate.ts; CFL-018: one builder). BUILT_HTML_RULES and the refusal test go.
- HTML source and built rules retain their native boundaries at %s (test (test.each), 10-44): **keep** to `tests/unit/cli/generation/tool-file-sources/html-validate.test.ts` `the source html-validate file is written once at the root, the built file per scope, and no-inline-style follows the level (%s)`. TGN-027: drop the literal rule copies; keep what changes with input or level. The sample writes a \[\[scope\]\] record with path = "app"; the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 10-10): **keep** to `tests/unit/cli/generation/tool-file-sources/html-validate.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- an ignore for %s stays with its native HTML check (test (test.each), 46-71): **keep** to `tests/unit/cli/generation/tool-file-sources/html-validate.test.ts` `an ignore for %s turns valid-id off only in its own html-validate file`. Real.
- \['html/validate', 'site/html-validate'\] (test (test.each), 46-46): **keep** to `tests/unit/cli/generation/tool-file-sources/html-validate.test.ts` `['html/validate', 'site/html-validate']`. Same rows.
- $tool refuses disabled $rule coverage in root and child policy (test (test.each), 73-87): **delete**. TGN-013: a settings refusal test that the settings tests already have.
- DISABLED_TOOL_RULES (test (test.each), 73-73): **delete**. TGN-013.

## `tests/cli/generation/ignore-patterns.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts`. Tests scopeIgnorePatterns (ignore-patterns.ts). The Prettier ignore tests and the check path-ignore tests join it.
- scope projection preserves brace and escape semantics for $pattern (test (test.each), 4-17): **keep** to `tests/unit/cli/generation/ignore-patterns.test.ts` `scope projection keeps brace and escape meaning for $pattern`. Real unit test.
- \[ { pattern: '/{apps,packages}/web/file.ts', expected: \['/file.ts'\] }, { pattern: '/{apps,{services,packages}}/w (test (test.each), 4-15): **keep** to `tests/unit/cli/generation/ignore-patterns.test.ts` `ten pattern rows`. Same rows. Values to config: SCOPE_PATTERN_CASES = the ten { pattern, expected } rows -&gt; tests/config/ignore-patterns.ts
- scope projection preserves exclusion order and nested scope isolation (test (test), 19-31): **keep** to `tests/unit/cli/generation/ignore-patterns.test.ts` `scope projection keeps exclusion order and leaves other scopes out`. Real unit test.

## `tests/cli/generation/knip.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts`. Tests the Knip builder and its entry files (tool-file-sources/knip.ts). The two Knip tests of shared-settings join it; TGN-053: one local runKnip(root, include). Values to config: KNIP_ARGV = \['node', '.gspot/node_modules/knip/bin/knip.js', '--config', '.gspot/config/knip.json', '--no-progress', '--reporter', 'json', '--include'\] -&gt; tests/config/knip.ts
- %s Knip retains native component defaults and scoped entry points (test (test.each), 29-68): **keep** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip finds unused framework component files and uses the entry points of each scope`. Real (runs Knip). TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 29-29): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- Knip owns global binary exclusions and still reports an unlisted command (test (test), 70-101): **keep** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip ignores npm, bun and git scripts and reports an unlisted program`. Real.
- %s Knip ignores selected tool packages and reports unused project dependencies (test (test.each), 103-150): **keep** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip ignores gspot's tool packages and reports your unused dependencies`. Real. TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 103-103): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- native Knip distinguishes positioned unused exports from an unlisted dependency in a spaced filename (test (test), 152-209): **delete**. TGN-014: the stored Knip report sample stays tested by the parser test.
- %s Knip ignores selected root and child pointers while reporting undeclared configuration-shaped source (test (test.each), 211-254): **keep** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip ignores gspot's pointer files and reports other configuration-like files`. Real. TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 211-211): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- %s Knip consumes normalized inherited test paths without leaking sibling entries (test (test.each), 256-283): **keep** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip gets each scope's test_files as entry points without sibling leaks`. Real. TGN-037: level all only. The sample writes \[\[scope\]\] records with path, and app writes test_files = \["app/verification/\*\*"\] and sibling \["sibling/sibling-tests/\*\*"\] from the repository root (CFR-003).
- \['recommended', 'all'\] as const (test (test.each), 256-256): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- check (const, 25-27): **move** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `check`. Read by every Knip test.

## `tests/cli/generation/level-contract.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/files.test.ts`. TGN-023 deletes the Ruff test; the level-switch test (TGN-061) tests emitAll at each level.
- %s Ruff selects stable rules with preview disabled (test (test.each), 14-32): **delete**. TGN-023: no preview anywhere; it copies manifest values; ruff families are checked with literals in the Ruff test.
- \['recommended', 'all'\] as const (test (test.each), 14-14): **delete**. TGN-023.
- switching levels restores generated defaults and agent rules (test (test), 34-52): **keep** to `tests/unit/cli/generation/files.test.ts` `switching the level and back writes the same files and the AGENTS.md level`. Real.

## `tests/cli/generation/licenses.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/inherit.test.ts; tests/unit/cli/generation/npm.test.ts`. TGN-031: the inheritance checks are settings tests; the license tool install check stays a generation test.
- license configuration retains scoped exceptions and inherited license allowances (test (test), 7-31): **delete**. \[\[licenses.allowed_package\]\] lives only at the root (CFR-004), so the scoped allowed-package half tests a deleted form, and the other half (licenses.allowed reaches every scope) repeats "lists add up across tables without repeats".
- exceptions alone activate descendant license tools without a root manifest: $configurations (test (test.each), 33-53): **move** to `tests/unit/cli/generation/npm.test.ts` `a root allowed package installs the license tool for a child scope without a root selection: $configurations`. TGN-031: the .gspot/package.json check stays as the generation test. The sample writes a root \[\[licenses.allowed_package\]\] record with name = "example", version = "1.0.0" and reason, and no license field (TML-009); the settings-view lines go because records live only at the root (CFR-004); the docs scope is a \[\[scope\]\] record.
- \[{ configurations: \['licenses'\] }, { configurations: \[\] }\] (test (test.each), 33-33): **move** to `tests/unit/cli/generation/npm.test.ts` `[{ configurations: ['licenses'] }, { configurations: [] }]`. Same rows.

## `tests/cli/generation/managed-ignores.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/files.test.ts`. Tests the .gitignore block that emitAll builds (generation/files.ts); test 2 goes (GEN-008).
- apply waits for Git before managing ignore entries with authored file=%s (test (test.each), 16-52): **keep** to `tests/unit/cli/generation/files.test.ts` `apply writes the .gitignore block only once Git exists, with your own file=%s`. Real. Line 50 follows real writes (TCO-012 keeps it).
- \[true, false\] (test (test.each), 16-16): **keep** to `tests/unit/cli/generation/files.test.ts` `[true, false]`. Same rows.
- manifest-owned tool directories are ignored while generated rules and authored sources remain visible (test (test), 54-89): **delete**. GEN-008: the manifest 'ignored' list, its schema field and this test go.

## `tests/cli/generation/namespaces.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/settings/inherit.test.ts`. follows deleted tests: the rename guards go (self-policing, TGN-006); only the svgo inheritance test is left.
- $name retains its $kind identity and native output at $level in "$scope" (test (test.each), 43-69): **delete**. self-policing (checks a configuration's kind constant and that the old names actions, i18n, xctest and static-site stay gone, TGN-006; scoped detection is checked by 'Postgres detection reads $name from "$scope"' in tests/cli/configurations/detect.test.ts and removal by the selection tests)
- namespaceCases (test (test.each), 43-43): **delete**. self-policing (rows of the deleted rename guard, TGN-006)
- site owns source inputs and structural checks at $level in "$scope" (test (test.each), 71-96): **delete**. TGN-006: the svgo default is a manifest constant; check input building and lone-files have their own tests.
- namespaceCases.filter(({ name }) =&gt; name === 'site') (test (test.each), 71-71): **delete**. TGN-006.
- site preserves numeric and zero scope defaults at %s (test (test.each), 98-144): **move** to `tests/unit/cli/settings/inherit.test.ts` `a zero svgo setting is inherited, and a scope value applies to its children`. TGN-006. Same result at both levels: level all only (TGN-037). The sample writes \[\[scope\]\] records with path, and app writes tools.svgo.min_saving_percent = { value = 8, reason = "..." } (CFR-002).
- \['recommended', 'all'\] (test (test.each), 98-98): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- namespaceCases (const, 17-19): **delete**. TGN-006: the level and scope matrix goes; the moved test lists its two rows.
- namespaceSession (function, 22-41): **delete**. self-policing (helper used only by the deleted rename-guard tests, TGN-006)

## `tests/cli/generation/npm.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/npm.test.ts`. Tests npmProject (generation/npm.ts). The schema test moves to the tool-project parser tests (TGN-032).
- Yarn $installer.version selects compatible generated settings and native lockfile creation (test (test.each), 16-34): **keep** to `tests/unit/cli/generation/npm.test.ts` `Yarn $installer.version gets the matching tool project settings`. Real.
- YARN_MANAGERS (test (test.each), 16-16): **keep** to `tests/unit/cli/generation/npm.test.ts` `YARN_CLIENTS`. Same rows; the data row is YARN_CLIENTS.
- $name (test (test.each), 36-86): **keep** to `tests/unit/cli/generation/npm.test.ts` `$name`. Real. TGN-038: delete the apply run (lines 76-83); TCO-012: delete the marker file; TGN-029: for the manifest row assert an exact pin, not the manifest value. The sample writes a \[\[scope\]\] record with path = "app".
- NEXT_INSTALLATIONS (test (test.each), 36-36): **keep** to `tests/unit/cli/generation/npm.test.ts` `NEXT_INSTALLATIONS`. Same rows.
- only selected Next scopes constrain the shared plugin version under %s (test (test.each), 88-102): **keep** to `tests/unit/cli/generation/npm.test.ts` `only selected Next.js scopes set the shared plugin version under %s`. Real. The runner setting is deleted (INX-003), so the test runs once, without a runner line; the sample writes \[\[scope\]\] records with path = "web" and "api".
- \['mise', 'npm'\] (test (test.each), 88-88): **delete**. weak: a runner loop that changes nothing, since mise and npm expect the same ^16 pin and the runner setting is deleted (INX-003); the test runs once
- $name (test (test.each), 104-112): **move** to `tests/unit/cli/parsers/tool-project.test.ts` `$name`. TGN-032: tests toolProjectSchema (parsers/tool-project.ts), not generation. The generated .gspot/package.json has no name and the schema does not check one (INX-010), so the input is the private flag, packageManager and devDependencies.
- TOOL_REQUIREMENTS (test (test.each), 104-104): **move** to `tests/unit/cli/parsers/tool-project.test.ts` `TOOL_REQUIREMENTS`. Same rows.

## `tests/cli/generation/semgrep.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-file-sources/semgrep.test.ts`. Tests the Semgrep files: the rule packs and the .semgrepignore builder (tool-file-sources/semgrep.ts) with the root-copy skip kept by EXG-034.
- manual language choices include security output without selecting security separately (test (test), 11-29): **keep** to `tests/unit/cli/generation/tool-file-sources/semgrep.test.ts` `a language choice brings its security rules without selecting security`. Real.
- 'Worker security rules cover src and edge rules retain configured paths at ${level}' (test (test), 32-66): **keep** to `tests/unit/cli/generation/tool-file-sources/semgrep.test.ts` `Cloudflare Worker rules cover src and Supabase rules use the functions folder at ${level}`. Real; the rules differ by level. The sample writes \[\[scope\]\] records with path, and api writes supabase.functions_folder = "api/edge" from the repository root (CFR-003).
- %s emits JWT rules only for nearest project dependencies (test (test.each), 69-102): **keep** to `tests/unit/cli/generation/tool-file-sources/semgrep.test.ts` `JWT rules are written only where the nearest package.json has jsonwebtoken`. Real. TGN-037: level all only. The sample writes \[\[scope\]\] records with path.
- \['recommended', 'all'\] as const (test (test.each), 69-69): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- '${level} $name' (test (test.each), 105-118): **keep** to `tests/unit/cli/generation/tool-file-sources/semgrep.test.ts` `$name`. Real (EXG-034 keeps the root-copy skip). TGN-037: level all only.
- IGNORE_CASES (test (test.each), 105-105): **keep** to `tests/unit/cli/generation/tool-file-sources/semgrep.test.ts` `SEMGREP_IGNORE_CASES (level all only)`. TGN-037.

## `tests/cli/generation/serialization/documents.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/tool-files.test.ts; tests/unit/cli/generation/pointers.test.ts; tests/unit/cli/generation/tool-file-sources/markdownlint.test.ts`. Test folders mirror source folders, and serialization/ matches no source; the tests go to the source they test (tool-files.ts, pointers.ts, the markdownlint builder); the yaml-helper and Ruff tests go. generation/tool-file-values.ts is not created, and the literal-structure test runs emitAll, so it tests generation/tool-files.ts.
- JSON option keys and YAML values keep their literal structure (test (test), 29-71): **move** to `tests/unit/cli/generation/tool-files.test.ts` `odd JSON keys and YAML values stay literal in tool files`. Real: tool files write odd strings as data; emitAll lives in generation/tool-files.ts.
- the template YAML binding preserves literal mapping keys and scalar values (test (test), 73-81): **delete**. CFL-001: Eta and etaInputs go, so the template yaml helper this test renders goes too.
- '${configuration} ESM pointers import modules whose directories contain URI delimiters and Unicode' (test (test), 84-115): **move** to `tests/unit/cli/generation/pointers.test.ts` ``${configuration} pointers import modules from folders with URI characters and Unicode``. Tests bodyPointer (generation/pointers.ts).
- XCTest Eta directory pointers retain native overrides at $level in "$scope" (test (test.each), 117-159): **move** to `tests/unit/cli/generation/pointers.test.ts` `XCTest folder pointers keep their SwiftLint overrides in scope "$scope"`. Real. TGN-037: level all only; TGN-027: drop the literal disabled_rules list (line 145). The sample writes \[\[scope\]\] records with path for the scopes of each row.
- (\['recommended', 'all'\] as const).flatMap((level) =&gt; \['', 'ios # app', 'AppTests', 'AppTests/Helpers'\].map((scop (test (test.each), 117-121): **move** to `tests/unit/cli/generation/pointers.test.ts` `four scopes at level all`. TGN-037.
- %s Markdown defaults retain native rule options and the all-only heading checks (test (test.each), 161-186): **move** to `tests/unit/cli/generation/tool-file-sources/markdownlint.test.ts` `%s turns on MD041 and MD025 only at level all and keeps your MD044 names`. TGN-027: drop the literal MD013, MD033, MD043 and MD001 checks. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 161-161): **move** to `tests/unit/cli/generation/tool-file-sources/markdownlint.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s Ruff keeps native import ordering without repository-specific generated prose (test (test.each), 188-202): **delete**. TGN-027 (literal Ruff isort options) and TGN-005 (a removed comment sentence).
- \['recommended', 'all'\] as const (test (test.each), 188-188): **delete**. TGN-027.

## `tests/cli/generation/serialization/javascript.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/generation/eslint/serialize.test.ts`. TGN-061: both tests check that values stay data in the ESLint file (eslintModule); call parseSource.
- reason comments cannot add JavaScript statements or ignore entries (test (test), 8-61): **keep** to `tests/unit/cli/generation/eslint/serialize.test.ts` `a reason text cannot add JavaScript statements or ignore entries`. Real. The reason sits in the reason form, tools.eslint.extra = { value = { name = "custom" }, reason = &lt;reason&gt; }, with no reasons table and no verbatim (CFR-002, POL-034).
- runtime names remain data in generated JavaScript (test (test), 63-91): **delete**. duplicate: runtime names come from a closed list the settings schema checks, so they cannot inject code; 'runtime globals and Node.js rules stay apart: %j' lints with every runtime, and a parse error of the ESLint file would fail every ESLint test

## `tests/cli/generation/serialization/toml.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/tool-file-sources/typos.test.ts; tests/unit/cli/generation/tool-files.test.ts; tests/unit/cli/settings/read.test.ts`. Test folders mirror source folders; TGN-031 and TGN-029. generation/tool-file-values.ts is not created, so the TOML write-and-read test goes with the tool file writer (tool-files.ts).
- typos output preserves quoted keys and paths without creating settings (test (test), 18-50): **move** to `tests/unit/cli/generation/tool-file-sources/typos.test.ts` `typos.toml keeps quoted words and paths and adds no settings`. Real. The sample writes allowed_words = { value = \[&lt;the five words&gt;\], reason = &lt;reason&gt; } (TMF-007).
- a quoted word from a template reaches typos.toml through init (test (test), 52-78): **move** to `tests/unit/cli/generation/tool-file-sources/typos.test.ts` `a quoted word from a template reaches typos.toml through init`. Real. The template keys template and selection are deleted, so the template writes configurations and allowed_words = { value = \[&lt;word&gt;\], reason = "..." } only (TML-011, TMF-007).
- TOML tool files round-trip dynamic strings and option keys (test (test), 80-121): **move** to `tests/unit/cli/generation/tool-files.test.ts` `TOML tool files keep odd strings and option keys`. Real. No reasons table: the sample writes tools.taplo.extra = { value = { &lt;option&gt; = &lt;text&gt;, column_width = 88 }, reason = &lt;reason&gt; } and docs.allowed_urls = { value = \[&lt;text&gt;\], reason = &lt;reason&gt; } (CFR-002, POL-034, NMU-017); TOML tool files are written by generation/tool-files.ts.
- an OSV expiry cannot inject another TOML table (test (test), 123-139): **move** to `tests/unit/cli/settings/read.test.ts` `an OSV ignore expiry cannot add a TOML table`. TGN-031: a settings validation test.
- Mise pins the CLI through the npm backend (test (test), 141-144): **delete**. TGN-029: the expected pin is the package version the generator reads.

## `tests/cli/generation/shared-settings.test.ts`

- (the file) (file): **split** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts; tests/unit/cli/generation/tool-file-sources/ruff.test.ts; tests/unit/cli/generation/ignore-patterns.test.ts; tests/unit/cli/settings/view.test.ts`. The Stylelint at-rule test goes (fake); the rest splits by tool (TGN-061), and the site build test is a settings test (TGN-031).
- knip takes its workspaces from the package workspaces, with the policy entries and the configuration entry files (test (test), 49-71): **move** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip workspaces come from package workspaces, your entries and the configuration entry files`. Real. TGN-029: write the javascript entry pattern literally. The sample writes \[\[scope\]\] records with path, and api writes tools.knip.entry = \["api/serve.js"\] from the repository root (CFR-003).
- knip ignores the Markdown pointer consumed by its native runner (test (test), 73-81): **move** to `tests/unit/cli/generation/tool-file-sources/knip.test.ts` `Knip ignores the Markdown pointer`. Real.
- Stylelint accepts %s (test (test.each), 83-111): **delete**. fake: the Tailwind row compares the file with a value rendered from the same template; the other rows read the fixed default or your own option, which '%s recognizes Tailwind only within its declared project' and the scoped rule-option test in tests/tools/configurations/language/css.test.ts check with real Stylelint
- \[ \['no framework', buildPolicy(\['css'\]), true, {}\], \['Next.js without Tailwind exceptions', buildPolicy(\['css', (test (test.each), 83-95): **delete**. fake: rows of the deleted Stylelint at-rule test
- Ruff selects declared runner and framework families without implicit rule ignores (test (test), 113-123): **move** to `tests/unit/cli/generation/tool-file-sources/ruff.test.ts` `Ruff selects the pytest and FastAPI families only when selected, and adds no per-file ignores`. Real. TGN-029: write the pytest families literally.
- policy ignores for the same test path share the native rule list (test (test), 125-133): **move** to `tests/unit/cli/generation/tool-file-sources/ruff.test.ts` `ignores of one test path share one Ruff per-file-ignores list`. Real.
- $check native exclusions preserve per-check and per-rule ownership (test (test.each), 135-163): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `$check: a check-wide path ignore reaches the tool file and a rule or other-check ignore does not`. Tests selectedIgnorePaths (ignore-patterns.ts).
- PATH_IGNORE_CONFIGURATIONS (test (test.each), 135-135): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `PATH_IGNORE_CASES`. Same rows (renamed with the constant).
- Semgrep editor discovery in scope "%s" uses only local check path ignores (test (test.each), 165-195): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `.semgrepignore in scope "%s" lists only that scope's Semgrep path ignores`. Tests scopeIgnorePatterns and selectedIgnorePaths. The sample writes a \[\[scope\]\] record with path = "api".
- \['', 'api'\] (test (test.each), 165-165): **move** to `tests/unit/cli/generation/ignore-patterns.test.ts` `['', 'api']`. Same rows.
- site build uses $name in "$scope" and retains explicit authored argv (test (test.each), 197-232): **move** to `tests/unit/cli/settings/view.test.ts` `the site build command defaults to your package manager in "$scope" and keeps your own`. TGN-031: reads only the settings view and gspot.toml after a write and read; TCO-012: delete lines 221 and 230-231. The sample writes \[\[scope\]\] records with path, and site.build_command is a dotted key inside the record that runs in the scope folder.
- SITE_PACKAGE_INSTALLERS.flatMap((\[name, files, installer\]) =&gt; \['', 'app'\].map((scope) =&gt; ({ name, files, install (test (test.each), 197-201): **move** to `tests/unit/cli/settings/view.test.ts` `SITE_NPM_CLIENT_CASES in the root and in app`. Padding: seven package-manager rows repeat the npm client detection that the repository tests own, so 'npm fallback' and 'declared Bun' stay, in the root and in app.
- generatedDocument (function, 31-41): **delete**. Forwarder over emitFile; the moved tests call emitFile and parse, and add their own sample file.
- manifests (const, 44-44): **delete**. TGN-029: expected values are written literally, not read from manifests.
- pytest (const, 45-45): **delete**. TGN-029: the Ruff test writes the pytest families literally.
- entry (const, 46-46): **delete**. TGN-029: the Knip test writes the entry pattern literally.
- python (const, 47-47): **inline** to `tests/unit/cli/generation/tool-file-sources/ruff.test.ts` `Ruff selects the pytest and FastAPI families only when selected, and adds no per-file ignores`. One caller.

## `tests/cli/generation/squawk.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-file-sources/squawk.test.ts`. Tests the Squawk builder (tool-file-sources/squawk.ts).
- Squawk excludes numeric migration versions through %s without rounding (test (test.each), 7-34): **keep** to `tests/unit/cli/generation/tool-file-sources/squawk.test.ts` `Squawk skips migrations through version %s without rounding`. Real.
- \[ \['2', \['migrations/2_initial.sql', 'migrations/V2_initial.sql'\]\], \[ '9007199254740992', \[ (test (test.each), 7-19): **keep** to `tests/unit/cli/generation/tool-file-sources/squawk.test.ts` `two rows: version 2 and version 2^53`. Same rows.
- freezing all migrations excludes every discovered migration from Squawk (test (test), 36-43): **keep** to `tests/unit/cli/generation/tool-file-sources/squawk.test.ts` `frozen_through = all skips every migration`. Real.
- a child-only Postgres scope emits its frozen migrations at %s (test (test.each), 45-59): **keep** to `tests/unit/cli/generation/tool-file-sources/squawk.test.ts` `a Postgres child scope writes its frozen migrations`. Real. TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 45-45): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/stylelint.test.ts`

- (the file) (file): **split** to `tests/unit/cli/apply/write.test.ts; tests/unit/cli/generation/tool-file-sources/stylelint.test.ts; tests/unit/cli/commands/doctor/suggestions.test.ts`. TGN-017: the package-field test merges with the commitlint one; TGN-033: its doctor lines go to the doctor tests; the rule-options test is a Stylelint builder test.
- Stylelint at %s keeps package fields with their applicable scope and restores them when CSS leaves (test (test.each), 16-61): **move** to `tests/unit/cli/apply/write.test.ts` `a package.json field follows its configuration and is restored when the configuration leaves`. TGN-017: one test.each over commitlint and stylelint; TGN-033: lines 36-44 (getSuggestions) move to the doctor suggestions test; TGN-037: level all only.
- \['recommended', 'all'\] as const (test (test.each), 16-16): **move** to `tests/unit/cli/apply/write.test.ts` `commitlint and stylelint rows`. TGN-017.
- %s captured Stylelint rules retain native options and filter inactive or unknown overrides (test (test.each), 63-108): **move** to `tests/unit/cli/generation/tool-file-sources/stylelint.test.ts` `your Stylelint rule options reach each scope's file, and level-gated and unknown rules are dropped (%s)`. Real (runs Stylelint); the result changes with the level. The sample writes a \[\[scope\]\] record with path = "child"; the level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 63-63): **move** to `tests/unit/cli/generation/tool-file-sources/stylelint.test.ts` `LEVELS`. Same rows: LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).

## `tests/cli/generation/swift.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-file-sources/swiftformat.test.ts`. Tests the SwiftFormat builder (tool-file-sources/swiftformat.ts).
- SwiftFormat reads each scope native package version without changing its source (test (test), 11-22): **keep** to `tests/unit/cli/generation/tool-file-sources/swiftformat.test.ts` `SwiftFormat reads each scope's Swift version from Package.swift`. Real. TCO-012: delete lines 20-21.
- SwiftFormat uses effective Xcode project choices and preserves authored destinations (test (test), 24-54): **keep** to `tests/unit/cli/generation/tool-file-sources/swiftformat.test.ts` `SwiftFormat uses the Xcode project you choose in each scope`. Real. TCO-012: delete lines 52-53; TGN-031: the settings view lines 46-51 move to the settings tests. The view reads options('xcode').destination (POL-033), and the nested scope's empty destination assertion goes with the "" line of SWIFT_PROJECT_SETTINGS (TML-010).
- SwiftFormat emits native %s line endings and only actual rule keys (test (test.each), 56-78): **keep** to `tests/unit/cli/generation/tool-file-sources/swiftformat.test.ts` `SwiftFormat writes the %s line ending you set in each scope`. TGN-057: drop nginx, gixy.cfg, the ruleData checks and the level loop. The sample writes \[\[scope\]\] records with path, and child sets the dotted key format.line_ending.
- SWIFT_LINE_ENDINGS (test (test.each), 56-56): **keep** to `tests/unit/cli/generation/tool-file-sources/swiftformat.test.ts` `['lf', 'crlf']`. TGN-051.

## `tests/cli/generation/trivy.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tool-file-sources/trivy.test.ts`. Tests the Trivy builder (tool-file-sources/trivy.ts).
- Trivy keeps typed severities and converts its duration to native seconds (test (test), 10-20): **delete**. weak: both settings equal the shipped defaults, so a template that ignored them would pass
- %s keeps root and child Trivy severity overrides typed (test (test.each), 22-45): **keep** to `tests/unit/cli/generation/tool-file-sources/trivy.test.ts` `Trivy severity settings add up through the root and child scopes`. Real. TGN-037: level all only; TGN-032: the schema lines 41-44 move to tests/unit/cli/settings/schema/tools.test.ts. The sample writes \[\[scope\]\] records with path, and child sets the dotted key tools.trivy.severity.
- \['recommended', 'all'\] as const (test (test.each), 22-22): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/typescript.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/tsconfig.test.ts`. Tests buildTsconfig (generation/tsconfig.ts). GEN-018 deletes the committed .gspot/config/tsconfig.json tool file, so the tests call buildTsconfig, which runTsc keeps using.
- malformed TypeScript configuration fails generation: %s (test (test.each), 12-26): **keep** to `tests/unit/cli/generation/tsconfig.test.ts` `a malformed tsconfig.json fails with its path and reason: %s`. Real. GEN-018: call buildTsconfig instead of emitAll.
- MALFORMED_COMPILER_CONFIGURATIONS (test (test.each), 12-12): **keep** to `tests/unit/cli/generation/tsconfig.test.ts` `MALFORMED_TSCONFIGS`. Same rows, renamed with the constant; 'null' and '\[\]' reach the same 'must be an object' branch, so the syntax-error row and one of them stay.
- generated compiler flags honor rule exclusions and preserve authored flags (test (test), 28-48): **keep** to `tests/unit/cli/generation/tsconfig.test.ts` `the strict compiler options leave out an ignored rule and keep your own options`. Real. TCO-012: delete line 47; GEN-018: read the buildTsconfig result.
- %s emits framework compiler flags only in their scope (test (test.each), 50-67): **keep** to `tests/unit/cli/generation/tsconfig.test.ts` `framework compiler options apply only in their scope`. Real. TGN-037: level all only. The sample writes a \[\[scope\]\] record with path = "service".
- \['recommended', 'all'\] as const (test (test.each), 50-50): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/cli/generation/vale.test.ts`

- (the file) (file): **move** to `tests/unit/cli/generation/prose.test.ts`. Tests proseInputs (generation/prose.ts) and the Vale files. The per-scope Vale config is deleted, CFG-008 deletes us-english and the Tengo script goes, which removes two tests; the locale refusal moves to the settings tests.
- %s vocabulary combines selected product and project words without duplicates (test (test.each), 10-36): **keep** to `tests/unit/cli/generation/prose.test.ts` `the Vale vocabulary joins selected product words and your words once each`. Real. TGN-037: level all only. The sample writes allowed_words = { value = \["NebulaConfiguration", "TypeScript"\], reason = "..." } (TMF-007).
- \['recommended', 'all'\] as const (test (test.each), 10-10): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- %s generates the portable prose style and current link-text selection (test (test.each), 38-60): **keep** to `tests/unit/cli/generation/prose.test.ts` `Vale styles and packages follow the level (%s)`. Real. TGN-005: delete lines 49, 52, 53 and 58. The level list is LEVELS from packages/cli/src/config/configurations.ts (TGN-037).
- \['recommended', 'all'\] as const (test (test.each), 38-38): **keep** to `tests/unit/cli/generation/prose.test.ts` `LEVELS`. The result changes with the level; the rows are LEVELS imported from packages/cli/src/config/configurations.ts (TGN-037).
- %s shares heading declarations and selects the scoped prose locale (test (test.each), 62-107): **keep** to `tests/unit/cli/generation/prose.test.ts` `your banned headings and the shipped ones reach the heading style once`. The banned-headings style stays and docs.banned_headings is root-only. CFG-008: delete lines 82-83 (us-english); TGN-031: delete lines 91-105; the typos locale lines 84-90 become their own test in tool-file-sources/typos.test.ts (TML-014: spelling.locale); TGN-037: level all only. The sample writes \[\[scope\]\] records with path, and british and british/american set the dotted key spelling.locale.
- \['recommended', 'all'\] as const (test (test.each), 62-62): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)
- prose locale rejects %s (test (test.each), 109-119): **delete**. fake: the rejection is never awaited, so it cannot fail
- \[ \['scoped unsupported locale', '\[scope.child.prose\]\\nlocale = "unsupported"\\n'\], \['retired tool locale', '\[tool (test (test.each), 109-112): **delete**. fake: rows of the unawaited locale rejection test
- %s emits effective scoped heading styles and shared search paths (test (test.each), 121-162): **delete**. The per-scope Vale config is deleted; this test checks vale-scoped.ini and the per-scope heading styles.
- \['recommended', 'all'\] as const (test (test.each), 121-121): **delete**. CFG-003.
- %s declares portable native replacement styles in every scope (test (test.each), 164-197): **delete**. vale-scoped.ini goes with the per-scope Vale config, the Tengo script goes, and TGN-005 removes the actions guard; the rest loops over the manifest's own style list.
- \['recommended', 'all'\] as const (test (test.each), 164-164): **delete**. CFG-003.
- %s shared vocabulary includes child-selected products without changing root heading words (test (test.each), 199-226): **keep** to `tests/unit/cli/generation/prose.test.ts` `the Vale vocabulary includes products of child scopes, and the heading style only root words`. Real. TGN-037: level all only. The sample writes allowed_words = { value = \["NebulaProduct"\], reason = "..." } (TMF-007) and \[\[scope\]\] records with path = "app" and "sibling".
- \['recommended', 'all'\] as const (test (test.each), 199-199): **delete**. weak (a level loop that changes nothing, TGN-037; the test runs once at level all)

## `tests/config/cli/generation/bunfig.ts`

- (the file) (file): **move** to `tests/config/dependencies.ts`. THR-002: one-user data goes to config by topic; the Bun release-age keys belong to the dependencies configuration, so this data joins tests/config/dependencies.ts.
- TWO_WEEKS_SECONDS (const exported, 2-2): **move** to `tests/config/dependencies.ts` `TWO_WEEKS_SECONDS`. Used by AGE_CASES and moves with it, since config imports only config; the moved merge test keeps its literal 1209600 in its bunfig text.
- AGE_CASES (const exported, 4-8): **move** to `tests/config/dependencies.ts` `AGE_CASES`. One user; test data, not a single short literal, so tests/config/.

## `tests/config/cli/generation/commitlint.ts`

- (the file) (file): **move** to `tests/config/commitlint.ts`. Test data lives in tests/config/ under a topic name; the file keeps its name (commitlint is the topic), and INACTIVE_CONFIGURATIONS leaves for tests/config/replace.ts (TGN-047).
- COMMITLINT_PROJECT (const exported, 4-9): **move** to `tests/config/commitlint.ts` `COMMITLINT_PROJECT`. Follows the merged package-field test (TGN-017); test data, so tests/config/, beside COMMITLINT_PACKAGE.
- INACTIVE_CONFIGURATIONS (const exported, 12-18): **move** to `tests/config/replace.ts` `INACTIVE_CONFIGURATIONS`. TGN-047: init replace data (existing tool files that init leaves at recommended), so it joins tests/config/replace.ts with the other replace data.
- COMMITLINT_SCOPES (const exported, 21-21): **inline** to `tests/unit/cli/apply/write.test.ts` `a package.json field follows its configuration and is restored when the configuration leaves`. One line of scope records for the commitlint row: \[\[scope\]\] records with path = "app" and "app/child".

## `tests/config/cli/generation/config-consumers.ts`

- (the file) (file): **split** to `tests/config/python/checks.ts; tests/config/swift.ts; tests/config/formatting.ts; tests/config/stylelint.ts`. Each constant follows its test to the config file of its tool, since 'config-consumers' names no topic (TGN-061); Python check data goes to python/checks.ts because one python.ts would exceed 300 lines.
- NESTED_PYTHON_POLICY (const exported, 5-16): **move** to `tests/config/python/checks.ts` `NESTED_PYTHON_SETTINGS`. One user; a gspot.toml text for Python scopes, built with settingsText (TGN-044), with \[\[scope\]\] records with path = "linted" and "typed" and \[rules\] (TML-003); glossary: settings, not policy; Python check data, so tests/config/python/checks.ts.
- SWIFT_FORMAT_POLICY (const exported, 19-31): **move** to `tests/config/swift.ts` `SWIFT_FORMAT_SETTINGS`. One user; test data, so config. The runner setting is deleted (INX-003), so the text has no runner line and keeps the files/v8r ignore; the inline table is \[rules\] (TML-003); glossary: settings, not policy.
- EDITORCONFIG_POLICY (const exported, 34-40): **move** to `tests/config/formatting.ts` `EDITORCONFIG_SETTINGS`. One user; test data, so config. The inline table is \[rules\] (TML-003); glossary: settings, not policy.
- STYLELINT_CONSUMERS (const exported, 43-69): **move** to `tests/config/stylelint.ts` `STYLESHEET_CASES`. One user. TGN-061: 'consumers' is jargon. Test data, so config: tests/config imports only tests/config, so the value drops its StylelintConsumerCase annotation and is written as const, and the test that reads it checks the type.
- STYLELINT_SCOPE_TABLES (const exported, 72-78): **move** to `tests/config/stylelint.ts` `STYLELINT_SCOPE_TABLES`. One user; test data, so config. The sample writes \[\[scope\]\] records with path = "vue", "svelte" and "mixed".
- STYLELINT_SCOPE_FILES (const exported, 80-90): **move** to `tests/config/stylelint.ts` `STYLELINT_SCOPE_FILES`. One user; test data, so config.

## `tests/config/cli/generation/eslint/architecture.ts`

- (the file) (file): **move** to `tests/config/eslint/architecture.ts`. Follows the architecture test split. ESLint test data is too big for one file, so it gets the folder tests/config/eslint/; the file keeps its name (architecture is the gspot.toml table it fills).
- ARCHITECTURE_CASES (const exported, 1-8): **move** to `tests/config/eslint/architecture.ts` `MODULE_CASES`. One user; 'architecture' named the setting table, not the cases; test data, so config.
- ARCHITECTURE_POLICIES (const exported, 10-14): **move** to `tests/config/eslint/architecture.ts` `MODULE_TABLES`. One user. Glossary: gspot.toml holds settings, not policy; test data, so config. The record header is \[\[architecture.module\]\]; the scoped variant writes root records with paths written from the repository root (apps/api/app/\*\*, apps/api/storage/\*\*) and unique names, because record lists live only at the root (CFR-003, CFR-004); the scope is a \[\[scope\]\] record with path = "apps/api".
- ARCHITECTURE_PROJECT (const exported, 16-28): **move** to `tests/config/eslint/architecture.ts` `MODULE_FILES`. One user; the files of the tree; TPP-029: drop the repeated tsconfig text; test data, so tests/config/.
- ARCHITECTURE_CORRECTION (const exported, 30-30): **move** to `tests/config/eslint/architecture.ts` `FIXED_SOURCE`. One user. Glossary: fix, not correction; test data, so tests/config/.
- ROLE_IMPORT_CASES (const exported, 33-54): **move** to `tests/config/eslint/architecture.ts` `ROLE_IMPORT_CASES`. One user; test data, so tests/config/. Only the rule "a file outside test_files may not import a test file" is left (TML-001), so the rows are imports from source folders into tests/ or \*.test.\* files (rejected at level all) and from test files into source (accepted); the types, config, env, support, public and contracts rows go.
- ROLE_TABLES (const exported, 57-77): **move** to `tests/config/eslint/architecture.ts` `TEST_IMPORT_TABLES`. One user; test data, so tests/config/. The roles types, tests, test_harness, config and runtime are deleted (TML-001), so the text keeps only the app \[\[scope\]\] record with configurations = \["typescript"\], with no role table and no role:runtime module.
- ROLE_TSCONFIG (const exported, 79-80): **move** to `tests/config/eslint/architecture.ts` `ROLE_TSCONFIG`. One user; test data, so tests/config/.
- ROLE_TARGETS (const exported, 82-94): **move** to `tests/config/eslint/architecture.ts` `ROLE_TARGETS`. One user; test data, so tests/config/. Only the source and test targets stay (runtime, tests, other, unrelated); types, support, config, env, runtime/public.ts and runtime/contracts.ts go (TML-001).
- ENVIRONMENT_TABLES (const exported, 96-120): **move** to `tests/config/eslint/architecture.ts` `ENVIRONMENT_TABLES`. One user; test data, so tests/config/. environment_readers is a glob list written from the repository root (root \["config/\*\*"\], app \["app/src/env/\*\*"\], literal \["literal/config/\*\*"\]), with no scoped \[\[architecture.module\]\] records and no module name as a role value; the "empty" scope row goes, because lists add up and a scope cannot clear an inherited list (TML-001, CFR-003, CFR-004).
- ENVIRONMENT_CASES (const exported, 122-127): **move** to `tests/config/eslint/architecture.ts` `ENVIRONMENT_CASES`. One user; test data, so tests/config/.
- ENVIRONMENT_COMPOSED (const exported, 129-129): **move** to `tests/config/eslint/architecture.ts` `ENVIRONMENT_COMPOSED`. One user; test data, so tests/config/.

## `tests/config/cli/generation/eslint/astro-parts.ts`

- (the file) (file): **delete**. TGN-025: its test is deleted.
- COMPONENT (const exported, 2-3): **delete**. TGN-025.

## `tests/config/cli/generation/eslint/engines.ts`

- (the file) (file): **move** to `tests/config/eslint/engines.ts`. One user; test data stays in tests/config/ by topic, and the file keeps its name under tests/config/eslint/.
- ENGINE_SCOPES (const exported, 1-2): **move** to `tests/config/eslint/engines.ts` `ENGINE_SCOPES`. TGN-054: phase 1 is built from it; test data, so tests/config/. The sample writes \[\[scope\]\] records with path = "old", "new", "forced", "old/legacy" and "browser", and the browser runtime is a root \[\[tools.eslint.override\]\] record with paths = \["browser/\*\*"\] and runtime = "browser" (TML-008).
- ENGINE_PACKAGES (const exported, 4-10): **move** to `tests/config/eslint/engines.ts` `ENGINE_PACKAGES`. One user; test data, so tests/config/.
- ENGINE_PATHS (const exported, 12-19): **move** to `tests/config/eslint/engines.ts` `ENGINE_PATHS`. One user; test data, so tests/config/.
- ENGINE_SOURCE (const exported, 21-21): **move** to `tests/config/eslint/engines.ts` `ENGINE_SOURCE`. One user; test data, so tests/config/.
- ENGINE_FINDINGS (const exported, 23-26): **move** to `tests/config/eslint/engines.ts` `ENGINE_FINDINGS`. One user; test data, so tests/config/.
- ENGINE_PHASES (const exported, 29-45): **move** to `tests/config/eslint/engines.ts` `ENGINE_PHASES`. One user. TGN-054: phase 1 reuses ENGINE_SCOPES, no cast; test data, so tests/config/. tools.eslint.node_version is deleted (TML-006), so one phase with ENGINE_SCOPES reports old/source.js, old/source.cjs and forced/source.js (engines &gt;=18), then the fixed phase reports nothing.

## `tests/config/cli/generation/eslint/eslint-deprecation.ts`

- (the file) (file): **merge** to `tests/config/eslint/lint-rules.ts`. TGN-028: the three overlap data files go; its one surviving row joins DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts, since the lint rules the generated ESLint file holds (required and duplicate) are one topic.
- DEPRECATION_PROJECT (const exported, 1-13): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: one deprecated call and its api.ts become one row of DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- DEPRECATION_FINDINGS (const exported, 15-37): **delete**. TGN-028: no columns or per-form findings.
- DEPRECATION_CORRECTION (const exported, 39-39): **delete**. TGN-028: no fix step.
- DEPRECATION_RULE_NAMES (const exported, 41-41): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: the row names the kept rule and its duplicate, in DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- DEPRECATION_SEVERITIES (const exported, 42-42): **delete**. TGN-028.

## `tests/config/cli/generation/eslint/eslint-regex.ts`

- (the file) (file): **merge** to `tests/config/eslint/lint-rules.ts`. TGN-028: its one surviving row joins DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts, the lint rules topic.
- REGEX_PROJECT (const exported, 1-19): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: the exponential pattern becomes one row of DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- REGEX_FINDINGS (const exported, 21-60): **delete**. TGN-028.
- REGEX_CORRECTION (const exported, 62-62): **delete**. TGN-028.
- REGEX_RULE_NAMES (const exported, 64-68): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: joins DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- REGEX_SEVERITIES (const exported, 69-69): **delete**. TGN-028.

## `tests/config/cli/generation/eslint/fragments.ts`

- (the file) (file): **move** to `tests/config/eslint/fragments.ts`. One user; test data stays in tests/config/ by topic, and the file keeps its name under tests/config/eslint/.
- FRAGMENT_SCOPE_CASES (const exported, 1-20): **move** to `tests/config/eslint/fragments.ts` `FRAGMENT_SCOPE_CASES`. One user. TGN-055: the nestjs row gets a source its rule reports; test data, so tests/config/.
- IMPORT_FRAGMENT_SOURCE (const exported, 23-30): **move** to `tests/config/eslint/fragments.ts` `IMPORT_FRAGMENT_SOURCE`. One user. TTC-032: drop 'native' from the sample names; test data, so tests/config/.

## `tests/config/cli/generation/eslint/framework.ts`

- (the file) (file): **move** to `tests/config/eslint/framework.ts`. Follows the framework/selectors split; the file keeps its name (ESLint framework fragments) under tests/config/eslint/.
- FRAMEWORK_FILES (const exported, 1-11): **split** to `tests/config/eslint/framework.ts` `SELECTOR_FILES; SERVER_FILES`. The React Native, form and schema files go with the selector test, the three server files with the Next.js test; both parts stay in the topic file.
- ALL_SECURITY_RULES (const exported, 13-18): **delete**. TGN-027: copies of template severities.
- REMOVED_ZOD_RULES (const exported, 19-23): **delete**. TGN-005: guards rules the fragment never had.
- COMPONENT_PARSER_FILES (const exported, 26-32): **move** to `tests/config/eslint/framework.ts` `COMPONENT_FILES`. One user; test data, so tests/config/.
- I18N_SOURCE (const exported, 35-35): **move** to `tests/config/eslint/framework.ts` `I18N_SOURCE`. One user; test data, so tests/config/.

## `tests/config/cli/generation/eslint/functions.ts`

- (the file) (file): **delete**. TGN-008, TPP-029.
- CALLBACK_SOURCE (const exported, 2-3): **delete**. TGN-008: its test is deleted.

## `tests/config/cli/generation/eslint/html-injection.ts`

- (the file) (file): **move** to `tests/config/eslint/framework.ts`. One user: React, Vue and Svelte components, so it joins the other framework lint data in tests/config/eslint/framework.ts.
- COMPONENTS (const exported, 2-31): **move** to `tests/config/eslint/framework.ts` `RAW_HTML_CASES`. One user; the name says what the rows hold; framework lint data, so tests/config/eslint/framework.ts.

## `tests/config/cli/generation/eslint/import-boundaries.ts`

- (the file) (file): **merge** to `tests/config/eslint/architecture.ts`. One user. Both constants are \[\[architecture.module\]\] records and cases, so they join the architecture topic file instead of a second file.
- TEST_BOUNDARY_POLICY (const exported, 2-20): **move** to `tests/config/eslint/architecture.ts` `QA_MODULE_TABLES`. One user. Settings text, not policy; no 'test' name part (banned at level all); test data beside the other architecture module data. \[\[architecture.module\]\] records live only at the root (CFR-003, CFR-004): the apps/api modules become root records with unique names and paths apps/api/app/\*\* and apps/api/storage/\*\*, and the apps/api record writes test_files = \["apps/api/app/verification/\*\*", "apps/api/app/qa/\*\*"\].
- BOUNDARY_CASES (const exported, 22-31): **move** to `tests/config/eslint/architecture.ts` `QA_IMPORT_CASES`. One user; test data, so tests/config/.

## `tests/config/cli/generation/eslint/jest.ts`

- (the file) (file): **merge** to `tests/config/eslint/fragments.ts`. The roles test writes its own settings with settingsText (TGN-044), so one user stays; one small settings text does not earn its own file, so it joins the fragment data topic file.
- APP_JEST (const exported, 1-10): **move** to `tests/config/eslint/fragments.ts` `APP_JEST`. TGN-044: build with settingsText; test data, not a single short literal, so tests/config/. The runtime and test_harness roles are deleted (TML-001), so the app scope keeps only configurations = \["jest"\] in a \[\[scope\]\] record with path = "app"; the inline table is \[rules\] (TML-003).

## `tests/config/cli/generation/eslint/jsdoc-types.ts`

- (the file) (file): **move** to `tests/config/eslint/jsdoc-types.ts`. One user; test data stays in tests/config/ by topic, and the file keeps its name under tests/config/eslint/.
- JSDOC_PROJECT (const exported, 1-17): **move** to `tests/config/eslint/jsdoc-types.ts` `JSDOC_FILES`. One user; test data, so tests/config/.
- JSDOC_CORRECTION (const exported, 19-20): **move** to `tests/config/eslint/jsdoc-types.ts` `FIXED_JSDOC`. One user. Glossary: fix, not correction; test data, so tests/config/.
- JSDOC_RULES (const exported, 22-28): **move** to `tests/config/eslint/jsdoc-types.ts` `JSDOC_RULES`. One user; test data, so tests/config/.
- JSDOC_FINDINGS (const exported, 30-42): **move** to `tests/config/eslint/jsdoc-types.ts` `JSDOC_FINDINGS`. One user; test data, so tests/config/.
- JSDOC_COMPILER_ARGV (const exported, 44-51): **move** to `tests/config/eslint/jsdoc-types.ts` `TSC_ARGV`. One user; command arguments are static values, so tests/config/.

## `tests/config/cli/generation/eslint/layout.ts`

- (the file) (file): **move** to `tests/config/eslint/sorting.ts`. One user; 'layout' names no behavior, and the data is import and export sorting, so the file is tests/config/eslint/sorting.ts.
- SORT_LEVELS (const exported, 1-4): **move** to `tests/config/eslint/sorting.ts` `SORT_LEVELS`. One user. TGN-051: drop enabled; test data, so tests/config/.
- SORT_RULES (const exported, 6-11): **move** to `tests/config/eslint/sorting.ts` `SORT_RULES`. One user; test data, so tests/config/.
- SORT_CASES (const exported, 13-46): **move** to `tests/config/eslint/sorting.ts` `SORT_CASES`. One user. TGN-051: drop the unread name field; test data, so tests/config/. Only the rows whose result depends on gspot's options stay (names, exports, header); side-effect boundary, comment attachment, groups and bare only exercise perfectionist itself.

## `tests/config/cli/generation/eslint/mobile-applicability.ts`

- (the file) (file): **merge** to `tests/config/eslint/framework.ts`. Follows the mobile test split; 'mobile-applicability' is jargon (TGN-061), so the React Native and Expo data joins the ESLint framework data file.
- TEXT_COMPONENTS (const exported, 2-6): **move** to `tests/config/eslint/framework.ts` `TEXT_COMPONENTS`. One user; test data, so tests/config/.
- MOBILE_POLICY (const exported, 9-16): **move** to `tests/config/eslint/framework.ts` `MOBILE_SETTINGS`. One user. TGN-044: build with settingsText; test data, so tests/config/. The sample writes \[\[scope\]\] records with path = "bare" and "expo-app", and the inline table is \[rules\] (TML-003).

## `tests/config/cli/generation/eslint/node-scripts.ts`

- (the file) (file): **move** to `tests/config/eslint/node-scripts.ts`. One user. TGN-049: delete the doc comments of lines 177-179; the report roots go with the rewritten pattern test; the file keeps its name under tests/config/eslint/ (198 lines).
- NODE_SCRIPT_SOURCE (const exported, 1-2): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_SOURCE`. One user; test data, so tests/config/.
- NODE_SCRIPT_CORRECTED (const exported, 3-3): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_FIXED`. One user. Glossary: fix; test data, so tests/config/.
- NODE_SCRIPT_OUTPUT (const exported, 5-5): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_OUTPUT`. Used only inside NODE_SCRIPT_CASES, so stop exporting; test data, so tests/config/.
- NODE_SCRIPT_CASES (const exported, 7-65): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_CASES`. One user. TGN-051: make strict optional; TTC-032: recommended and all fields; test data, so tests/config/.
- NODE_SCRIPT_CONTROLS (const exported, 66-73): **move** to `tests/config/eslint/node-scripts.ts` `UNLINTED_FILES`. One user. The name says ESLint must not lint them; test data, so tests/config/.
- NODE_SCRIPT_FILES (const exported, 75-94): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_FILES`. One user; test data, so tests/config/.
- NODE_SCRIPT_TABLES (const exported, 96-115): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_TABLES`. One user; test data, so tests/config/. No \[\[generated\]\] or \[\[vendored\]\]: the sandbox marks emitted/\*\* linguist-generated and vendor/\*\* linguist-vendored in .gitattributes (CFR-005); no reasons table, and the child \[\[scope\]\] record writes limits.javascript.min_function_statements = { value = 1, reason = "..." }, below the default 2 (CFR-002).
- NODE_SCRIPT_CONTRACTS (const exported, 117-175): **move** to `tests/config/eslint/node-scripts.ts` `EXTENSIONLESS_SCRIPT_CASES`. One user. TTC-032: 'contract' is filler; routine and strict become recommended and all; test data, so tests/config/.
- NODE_SCRIPT_NATIVE_ROOTS (const exported, 182-182): **delete**. TGN-032: the pattern test no longer writes files under a report root.
- NODE_SCRIPT_RULES (const exported, 184-191): **move** to `tests/config/eslint/node-scripts.ts` `NODE_SCRIPT_RULES`. One user; test data, so tests/config/.
- NODE_CONTRACT_RULES (const exported, 192-198): **move** to `tests/config/eslint/node-scripts.ts` `EXTENSIONLESS_SCRIPT_RULES`. One user. TTC-032; test data, so tests/config/.

## `tests/config/cli/generation/eslint/overlaps.ts`

- (the file) (file): **move** to `tests/config/eslint/lint-rules.ts`. TGN-028: DUPLICATE_RULE_CASES (about 30 lines) is what remains, so the file moves to the lint rules topic file, tests/config/eslint/lint-rules.ts (TGN-061: overlaps becomes duplicate rules).
- OVERLAP_SOURCES (const exported, 1-18): **move** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: one defect source per duplicate rule pair (empty character class, useless catch, collapsible if), each with its kept rule, in tests/config/eslint/lint-rules.ts.
- OVERLAP_PROJECT (const exported, 20-50): **delete**. TGN-028: no .js and .ts copy map.
- OVERLAP_CORRECTION (const exported, 52-52): **delete**. TGN-028: no fix step.
- OVERLAP_SEVERITIES (const exported, 54-62): **delete**. TGN-028.
- OVERLAP_FINDINGS (const exported, 64-78): **delete**. TGN-028.
- BINDING_SOURCES (const exported, 80-90): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: the unused local binding becomes one row of DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- BINDING_PROJECT (const exported, 92-112): **delete**. TGN-028.
- EXECUTION_SOURCES (const exported, 114-127): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: eval and new Buffer become two rows of DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- EXECUTION_PROJECT (const exported, 129-154): **delete**. TGN-028.
- BINDING_FINDINGS (const exported, 156-173): **delete**. TGN-028.
- EXECUTION_FINDINGS (const exported, 175-200): **delete**. TGN-028.
- BINDING_SEVERITIES (const exported, 202-211): **delete**. TGN-028.
- OVERLAP_RULE_NAMES (const exported, 213-221): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: each row names the kept rule and its duplicates, in DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- OVERLAP_PATTERNS (const exported, 222-222): **delete**. TGN-028.
- BINDING_RULE_NAMES (const exported, 224-233): **merge** to `tests/config/eslint/lint-rules.ts` `DUPLICATE_RULE_CASES`. TGN-028: joins DUPLICATE_RULE_CASES in tests/config/eslint/lint-rules.ts.
- BINDING_PATTERNS (const exported, 234-234): **delete**. TGN-028.

## `tests/config/cli/generation/eslint/policy.ts`

- (the file) (file): **move** to `tests/config/eslint/levels.ts`. Follows the eslint/policy test split; 'policy' is a retired name (glossary: settings), and its parts, level-dependent lint rules and the comment suppression rule (a level rule), go to one file, tests/config/eslint/levels.ts.
- COALESCING_SOURCE (const exported, 1-6): **move** to `tests/config/eslint/levels.ts` `COALESCING_SOURCE`. One user; test data, so tests/config/.
- COALESCING_CORRECTION (const exported, 8-13): **move** to `tests/config/eslint/levels.ts` `COALESCING_FIXED`. One user. Glossary: fix; test data, so tests/config/.
- TYPE_EXPORT_PROJECT (const exported, 15-21): **move** to `tests/config/eslint/levels.ts` `TYPE_EXPORT_FILES`. One user; test data, so tests/config/; the type-import rules are on at level all only.
- TYPE_EXPORT_CORRECTION (const exported, 23-27): **delete**. TGN-040: the test asserts the rule ids per level, not the fixed text.
- SUPPRESSION_PROJECT (const exported, 29-34): **move** to `tests/config/eslint/levels.ts` `SUPPRESSION_FILES`. One user. CKG-004: missing.js (the reason check) goes with the eslint-comments plugin; the comment suppression rule is a level rule, so the data sits in tests/config/eslint/levels.ts.
- SUPPRESSION_CORRECTION (const exported, 36-39): **move** to `tests/config/eslint/levels.ts` `SUPPRESSION_FIXED`. One user. CKG-004: only unused.js stays; the comment suppression rule is a level rule, so the data sits in tests/config/eslint/levels.ts.

## `tests/config/cli/generation/eslint/react-rules.ts`

- (the file) (file): **merge** to `tests/config/eslint/framework.ts`. The web constants go with the weak severity test (TGN-025); NATIVE_FILES and NATIVE_CORRECTIONS have one user, and the React Native data joins the ESLint framework data file.
- COMPONENT_HEADER (const, 3-3): **delete**. weak (used only inside WEB_FILES, which only the deleted React severity tests read)
- WEB_FILES (const exported, 5-22): **delete**. weak (used only by the deleted React severity tests, TGN-025)
- WEB_EXPECTED (const exported, 24-30): **delete**. weak (used only by the deleted React severity test, TGN-025)
- NATIVE_FILES (const exported, 32-41): **move** to `tests/config/eslint/framework.ts` `REACT_NATIVE_FILES`. One user. TTC-032: say React Native; test data, so tests/config/. Only src/Box.tsx stays, since the Label row of REACT_NATIVE_FIXES is a duplicate.
- NATIVE_EXPECTED (const exported, 43-49): **delete**. weak (used only by the deleted React severity test, TGN-025)
- NATIVE_CORRECTIONS (const exported, 51-70): **move** to `tests/config/eslint/framework.ts` `REACT_NATIVE_FIXES`. One user. Glossary: fix, not correction; test data, so tests/config/. The 'bare react-native' row goes as a duplicate of the no-raw-text test.

## `tests/config/cli/generation/eslint/required-rules.ts`

- (the file) (file): **move** to `tests/config/eslint/lint-rules.ts`. One user; the lint rules the generated ESLint file holds (required and duplicate) are one topic, so tests/config/eslint/lint-rules.ts, which also receives REQUIRED_RULES.
- CHECK_LEVELS (const exported, 2-2): **delete**. The test imports LEVELS from packages/cli/src/config/configurations.ts instead of this copy (TGN-037).
- PROJECT_FILES (const exported, 5-8): **move** to `tests/config/eslint/lint-rules.ts` `REQUIRED_RULE_FILES`. One user; test data, so tests/config/eslint/lint-rules.ts; REQUIRED_RULE_FILES because PROJECT_FILES also names a different value in tests/config/tool-files.ts.

## `tests/config/cli/generation/eslint/restricted-imports.ts`

- (the file) (file): **merge** to `tests/config/eslint/fragments.ts`. One user; after STORE_FILES goes, two small constants of the Zustand fragment join the fragment data file.
- PROJECT (const exported, 2-8): **move** to `tests/config/eslint/fragments.ts` `ZUSTAND_FILES`. One user; test data, so tests/config/.
- POLICY (const exported, 10-14): **move** to `tests/config/eslint/fragments.ts` `RESTRICTION_TABLES`. One user. Settings text, not policy; test data, so tests/config/.
- STORE_FILES (const exported, 17-26): **delete**. Its test is deleted (TGN-025).

## `tests/config/cli/generation/eslint/runtimes.ts`

- (the file) (file): **move** to `tests/config/eslint/overrides.ts`. The runtimes are the runtime field of \[\[tools.eslint.override\]\], one topic with the override settings, so tests/config/eslint/overrides.ts; INVALID_RUNTIMES stays in it although its test moves to the settings tests.
- RUNTIME_CASES (const exported, 2-23): **move** to `tests/config/eslint/overrides.ts` `RUNTIME_CASES`. One user. PLG-011: service-worker becomes serviceworker; override data, so tests/config/eslint/overrides.ts.
- FRAMEWORK_RUNTIME_CASES (const exported, 26-37): **move** to `tests/config/eslint/overrides.ts` `FRAMEWORK_RUNTIME_CASES`. One user; override data, so tests/config/eslint/overrides.ts.
- INVALID_RUNTIMES (const exported, 40-45): **move** to `tests/config/eslint/overrides.ts` `INVALID_RUNTIMES`. One user. PLG-011: drop the serviceworker row; ESLint runtime names are override data, so tests/config/eslint/overrides.ts.

## `tests/config/cli/generation/eslint/scopes.ts`

- (the file) (file): **inline** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts`. One user.
- SCOPES_SOURCE (const exported, 1-2): **inline** to `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` `a TypeScript scope under a root without TypeScript gets typed rules`. A two-line source with one caller.

## `tests/config/cli/generation/eslint/selectors.ts`

- (the file) (file): **move** to `tests/config/eslint/selectors.ts`. The selector objects go with the selectorGroups tests and the Express sources with the Express test; the file keeps its name under tests/config/eslint/ and holds both.
- STORE (const exported, 1-4): **move** to `tests/config/eslint/selectors.ts` `STORE`. One user; test data, so tests/config/.
- RAW_SQL (const exported, 5-5): **move** to `tests/config/eslint/selectors.ts` `RAW_SQL`. One user; test data, so tests/config/.
- PROCEDURE (const exported, 6-9): **move** to `tests/config/eslint/selectors.ts` `PROCEDURE`. One user; test data, so tests/config/.
- INJECTED (const exported, 10-13): **move** to `tests/config/eslint/selectors.ts` `INJECTED`. One user; test data, so tests/config/.
- RESPONSE_MESSAGES (const exported, 15-16): **move** to `tests/config/eslint/selectors.ts` `RESPONSE_MESSAGES`. One user; test data, so tests/config/.
- LEVEL_RULES (const exported, 17-26): **delete**. TGN-027: eight severities copied from the template.
- ALIAS_IMPORT (const exported, 28-28): **move** to `tests/config/eslint/selectors.ts` `ALIAS_IMPORT`. One user; test data, so tests/config/, beside RESPONSE_MESSAGES, which the same sources join.

## `tests/config/cli/generation/eslint/structure.ts`

- (the file) (file): **move** to `tests/config/eslint/structure.ts`. One user; test data stays in tests/config/ by topic, and the file keeps its name under tests/config/eslint/.
- IMPORT_FILES (const exported, 2-13): **move** to `tests/config/eslint/structure.ts` `IMPORT_FILES`. One user; test data, so tests/config/.
- IMPORT_CASES (const exported, 15-22): **move** to `tests/config/eslint/structure.ts` `IMPORT_CASES`. One user; test data, so tests/config/.
- REEXPORT_CASES (const exported, 24-28): **move** to `tests/config/eslint/structure.ts` `REEXPORT_CASES`. One user; test data, so tests/config/.
- BARREL_CASES (const exported, 30-40): **move** to `tests/config/eslint/structure.ts` `BARREL_CASES`. One user; test data, so tests/config/.
- NATIVE_POLICY_CASES (const exported, 42-47): **move** to `tests/config/eslint/structure.ts` `LEVEL_REEXPORT_CASES`. One user. TTC-032: drop 'native'; the rows are level and reexports pairs; test data, so tests/config/.

## `tests/config/cli/generation/eslint/takeover.ts`

- (the file) (file): **move** to `tests/config/replace.ts`. One user; 'takeover' is a retired name (glossary: replace), so the data of init replacing your tool files goes to tests/config/replace.ts.
- STYLELINT_DISCOVERY (const exported, 2-11): **move** to `tests/config/replace.ts` `STYLELINT_LOOKUP_SCRIPT`. One user; the name says what the text is; test data, so tests/config/.
- KNIP_TAKEOVERS (const exported, 14-18): **move** to `tests/config/replace.ts` `KNIP_FILES`. One user. Glossary: replace, not takeover; test data, so tests/config/.

## `tests/config/cli/generation/eslint/tanstack-query.ts`

- (the file) (file): **merge** to `tests/config/eslint/fragments.ts`. One user; the TanStack Query fragment data joins the fragment data file.
- QUERY_PROJECT (const exported, 2-13): **move** to `tests/config/eslint/fragments.ts` `QUERY_FILES`. One user; test data, so tests/config/.
- QUERY_SAMPLE (const exported, 15-16): **move** to `tests/config/eslint/fragments.ts` `QUERY_SAMPLE`. One user; test data, so tests/config/.
- QUERY_CORRECTION (const exported, 17-18): **move** to `tests/config/eslint/fragments.ts` `QUERY_FIXED`. One user. Glossary: fix; test data, so tests/config/.

## `tests/config/cli/generation/eslint/typescript-eslint.ts`

- (the file) (file): **merge** to `tests/config/eslint/fragments.ts`. One user; one small TypeScript project tree joins the fragment data file.
- PROJECT (const exported, 1-5): **move** to `tests/config/eslint/fragments.ts` `TYPESCRIPT_FILES`. One user; PROJECT said nothing; test data, so tests/config/.

## `tests/config/cli/generation/eslint/vite-entries.ts`

- (the file) (file): **merge** to `tests/config/eslint/structure.ts`. One user; 'vite-entries' names no topic (no Vite), and the entry-file data tests the trivial-file structure rules, so it joins tests/config/eslint/structure.ts.
- VITE_POLICY (const exported, 1-11): **move** to `tests/config/eslint/structure.ts` `ENTRY_SETTINGS`. One user. TTC-032: no Vite; TGN-044: build with settingsText; test data, so tests/config/. The sample writes \[\[scope\]\] records with path, api writes tools.knip.entry = \["api/src/main.js"\] from the repository root (CFR-003), and the inline table is \[rules\] (TML-003).
- START (const exported, 13-13): **move** to `tests/config/eslint/structure.ts` `ENTRY_SOURCE`. One user; test data, so tests/config/.
- STARTER (const exported, 15-16): **move** to `tests/config/eslint/structure.ts` `STARTER_SOURCE`. One user; test data, so tests/config/.
- TRIVIAL_FILES (const exported, 18-18): **move** to `tests/config/eslint/structure.ts` `TRIVIAL_ENTRY_SOURCES`. One user; test data, so tests/config/; TRIVIAL_ENTRY_SOURCES because TRIVIAL_FILES also names a different value in tests/config/structure.ts.

## `tests/config/cli/generation/eslint/vitest.ts`

- (the file) (file): **merge** to `tests/config/eslint/fragments.ts`. Only the Vitest rule test reads it, since the role test is deleted as a duplicate (row 245); it joins the fragment data file.
- VITEST_FILES (const exported, 1-8): **move** to `tests/config/eslint/fragments.ts` `VITEST_FILES`. Only the Vitest rule test reads it, since the role test is deleted; package.json and tests/unit/example.test.js stay, while the tests/fixtures files and src/runtime.js served the deleted test.

## `tests/config/cli/generation/every-template.ts`

- (the file) (file): **move** to `tests/config/tool-files.ts`. One user; the data for the generated tool file tests goes to tests/config/tool-files.ts.
- PROJECT_FILES (const exported, 1-12): **move** to `tests/config/tool-files.ts` `TOOL_FILE_PROJECT`. One user; test data, so tests/config/; TOOL_FILE_PROJECT, the project that turns on every tool file, because PROJECT_FILES also names a different value in tests/config/eslint/lint-rules.ts.
- PLAIN_TOOL_FILES (const exported, 14-27): **move** to `tests/config/tool-files.ts` `PLAIN_TOOL_FILES`. One user. TGN-050: delete semgrepignore and .swiftformat; test data, so tests/config/.

## `tests/config/cli/generation/formatting.ts`

- (the file) (file): **move** to `tests/config/formatting.ts`. Follows the formatting test split; the file keeps its name and holds SVELTE_PLUGIN beside the shared formatting data (FORMAT_CASES), while the three Prettier ignore constants leave for tests/config/ignore-patterns.ts with their tests.
- IGNORE_POLICY (const exported, 4-16): **move** to `tests/config/ignore-patterns.ts` `PRETTIER_IGNORE_SETTINGS`. One user. Settings, not policy; ignore-pattern data, so tests/config/ignore-patterns.ts. exclude, generated and vendored are deleted (TMF-003, CFR-005), so the settings keep configurations and the \[\[ignore\]\] entry. Values to config: PRETTIER_IGNORE_ATTRIBUTES = the .gitattributes text with generated/\*\* linguist-generated and vendored/\*\* linguist-vendored -&gt; tests/config/ignore-patterns.ts
- IGNORE_CASES (const exported, 19-31): **move** to `tests/config/ignore-patterns.ts` `PRETTIER_IGNORE_CASES`. One user; ignore-pattern data, so tests/config/ignore-patterns.ts; the excluded/source.ts row goes because root exclude is deleted (TMF-003).
- SVELTE_PLUGIN (const exported, 33-37): **move** to `tests/config/formatting.ts` `SVELTE_PLUGIN`. One user; test data, so tests/config/: tests/config imports only tests/config, so the value drops its PrettierPlugin annotation and is written as const, and the call to prettierConfiguration checks the shape.
- LANGUAGE_IGNORES (const exported, 39-72): **move** to `tests/config/ignore-patterns.ts` `LANGUAGE_IGNORES`. One user. GEN-009: one .prettierignore; ignore-pattern data, so tests/config/ignore-patterns.ts. The sample writes a \[\[scope\]\] record with path = "web".

## `tests/config/cli/generation/guides.ts`

- (the file) (file): **move** to `tests/config/rules.ts`. One user; rule file selection data goes to tests/config/rules.ts (glossary: rules).
- DRIZZLE_DRIVERS (const exported, 1-6): **move** to `tests/config/rules.ts` `DRIZZLE_DRIVERS`. One user; test data, so tests/config/; two rows only.
- PLAYWRIGHT_RUNNERS (const exported, 9-14): **delete**. The rule does not depend on the runner.
- PLAYWRIGHT_DEPENDENCIES (const exported, 16-20): **delete**. duplicate: used only by the deleted Playwright test

## `tests/config/cli/generation/html.ts`

- (the file) (file): **delete**. Both constants go (TGN-027, TGN-013).
- BUILT_HTML_RULES (const exported, 2-9): **delete**. TGN-027.
- DISABLED_TOOL_RULES (const exported, 12-18): **delete**. TGN-013.

## `tests/config/cli/generation/knip.ts`

- (the file) (file): **move** to `tests/config/knip.ts`. One user; test data stays in tests/config/ by topic, and the file keeps its name.
- KNIP_COMPONENT_FILES (const exported, 2-16): **move** to `tests/config/knip.ts` `KNIP_COMPONENT_FILES`. One user; test data, so tests/config/.
- KNIP_UNUSED_FILES (const exported, 19-26): **move** to `tests/config/knip.ts` `KNIP_UNUSED_FILES`. One user; test data, so tests/config/.
- KNIP_ENTRY_TABLES (const exported, 29-38): **move** to `tests/config/knip.ts` `KNIP_ENTRY_TABLES`. One user; test data, so tests/config/. The sample writes \[\[scope\]\] records with path, and child writes test_files = \["child/verification/\*\*"\] and tools.knip.entry = \["child/main.js"\] from the repository root (CFR-003).
- KNIP_BINARY_PACKAGE (const exported, 41-42): **move** to `tests/config/knip.ts` `KNIP_PROGRAM_PACKAGE`. One user. Glossary: program, not binary; test data, so tests/config/.
- KNIP_DEPENDENCY_PACKAGE (const exported, 45-46): **move** to `tests/config/knip.ts` `KNIP_DEPENDENCY_PACKAGE`. One user; test data, so tests/config/.
- KNIP_DIAGNOSTIC_FILES (const exported, 49-54): **delete**. TGN-014.
- KNIP_POINTER_FILES (const exported, 57-66): **move** to `tests/config/knip.ts` `KNIP_POINTER_FILES`. One user; test data, so tests/config/.
- KNIP_POINTER_TABLES (const exported, 69-76): **move** to `tests/config/knip.ts` `KNIP_POINTER_TABLES`. One user; test data, so tests/config/. The sample writes \[\[scope\]\] records with path, and child writes tools.knip.entry = \["child/main.js"\] from the repository root (CFR-003).

## `tests/config/cli/generation/namespaces.ts`

- (the file) (file): **delete**. self-policing (its one constant served only the deleted rename-guard tests, TGN-006)
- CONFIGURATION_NAMESPACES (const exported, 2-49): **delete**. self-policing (data of the deleted rename-guard tests, TGN-006)

## `tests/config/cli/generation/npm.ts`

- (the file) (file): **move** to `tests/config/npm.ts`. Each constant follows its test; both join the npm topic file in tests/config/.
- NEXT_INSTALLATIONS (const exported, 1-26): **move** to `tests/config/npm.ts` `NEXT_INSTALLATIONS`. One user; test data, so tests/config/.
- TOOL_REQUIREMENTS (const exported, 28-49): **move** to `tests/config/npm.ts` `TOOL_REQUIREMENTS`. One user (TGN-032); test data, so tests/config/.

## `tests/config/cli/generation/semgrep.ts`

- (the file) (file): **move** to `tests/config/semgrep.ts`. One user; test data stays in tests/config/ by topic, and the file keeps its name.
- SWIFT_IGNORE_FOLDERS (const exported, 1-1): **move** to `tests/config/semgrep.ts` `SWIFT_IGNORE_FOLDERS`. One user; test data, so tests/config/.
- IGNORE_CASES (const exported, 3-31): **move** to `tests/config/semgrep.ts` `SEMGREP_IGNORE_CASES`. One user; test data, so tests/config/. The sample writes \[\[scope\]\] records with path = "first", "second" and "child".

## `tests/config/cli/generation/serialization.ts`

- (the file) (file): **move** to `tests/config/serialization.ts`. Follows the documents test split; the file keeps its name in tests/config/ (odd strings that must stay data).
- KEY (const exported, 1-1): **move** to `tests/config/serialization.ts` `ODD_KEY`. One user; the name says what the value is for; test data, so tests/config/.
- VALUE (const exported, 2-2): **move** to `tests/config/serialization.ts` `ODD_VALUE`. One user; test data, so tests/config/.
- PROJECT (const exported, 3-3): **move** to `tests/config/serialization.ts` `XCODE_PROJECT`. One user; test data, so tests/config/.
- SCHEME (const exported, 4-4): **move** to `tests/config/serialization.ts` `XCODE_SCHEME`. One user; test data, so tests/config/.
- REGISTRIES (const exported, 5-5): **move** to `tests/config/serialization.ts` `REGISTRIES`. One user; test data, so tests/config/.
- SERIALIZATION_POLICY (const exported, 7-18): **move** to `tests/config/serialization.ts` `ODD_VALUE_SETTINGS`. One user. Settings, not policy; test data, so tests/config/. No reasons table; xcode: { project, scheme } (POL-033); prettier and knip write extra: { value: { &lt;KEY&gt;: &lt;VALUE&gt; }, reason: "An upstream option." } (CFR-002, POL-034).
- SERIALIZATION_FILES (const exported, 20-27): **move** to `tests/config/serialization.ts` `ODD_VALUE_FILES`. One user; test data, so tests/config/.
- MODULE_TARGETS (const exported, 30-30): **move** to `tests/config/serialization.ts` `MODULE_TARGETS`. One user; test data, so tests/config/.
- MODULE_VALUE (const exported, 31-31): **move** to `tests/config/serialization.ts` `MODULE_VALUE`. One user; test data, so tests/config/.

## `tests/config/cli/generation/shared-settings.ts`

- (the file) (file): **split** to `tests/config/ignore-patterns.ts; tests/config/site.ts`. TAILWIND_PROJECT_FILES goes with the fake Tailwind row; 'shared-settings' names no topic (TGN-061), so the path-ignore cases join the ignore-pattern data and the site build data joins the site topic file.
- KNIP (const exported, 1-1): **delete**. TGN-051: the path is written inline.
- STYLELINT (const exported, 2-2): **delete**. TGN-051.
- RUFF (const exported, 3-3): **delete**. TGN-051.
- TAILWIND_PROJECT_FILES (const exported, 5-7): **delete**. fake: used only by the deleted Tailwind row
- PATH_IGNORE_CONFIGURATIONS (const exported, 10-24): **move** to `tests/config/ignore-patterns.ts` `PATH_IGNORE_CASES`. One user; test data, so tests/config/.
- SITE_PACKAGE_INSTALLERS (const exported, 27-39): **move** to `tests/config/site.ts` `SITE_NPM_CLIENT_CASES`. One user. Glossary: NpmClient in code ('manager' is a banned term); test data, so tests/config/; two rows only.
- SITE_BUILD_COMMANDS (const exported, 41-41): **move** to `tests/config/site.ts` `SITE_BUILD_COMMANDS`. One user; test data, so tests/config/.

## `tests/config/cli/generation/squawk.ts`

- (the file) (file): **move** to `tests/config/sql.ts`. One user; Squawk reads SQL migrations, so the two small constants join the SQL topic file in tests/config/ instead of a file of their own.
- CHILD_POSTGRES_POLICY (const exported, 1-2): **move** to `tests/config/sql.ts` `CHILD_POSTGRES_TABLES`. One user. Settings text, not policy; test data, so tests/config/. The sample writes a \[\[scope\]\] record with path = "app" and the dotted key postgres.frozen_through = "2".
- CHILD_MIGRATIONS (const exported, 4-9): **move** to `tests/config/sql.ts` `CHILD_MIGRATIONS`. One user; test data, so tests/config/.

## `tests/config/cli/generation/stylelint.ts`

- (the file) (file): **move** to `tests/config/stylelint.ts`. Follows the Stylelint test split; the file keeps its name in tests/config/, and STYLELINT_SCOPES, one short line, stays in its test.
- STYLELINT_SCOPES (const exported, 4-4): **inline** to `tests/unit/cli/apply/write.test.ts` `a package.json field follows its configuration and is restored when the configuration leaves`. One line of scope records for the stylelint row: \[\[scope\]\] records with path = "app", "app/child" and "other".
- STYLELINT_PROJECT (const exported, 7-15): **move** to `tests/config/stylelint.ts` `STYLELINT_FILES`. One user; test data, so tests/config/.
- STYLELINT_SUGGESTIONS (const exported, 18-27): **move** to `tests/config/stylelint.ts` `STYLELINT_SUGGESTIONS`. Follows the doctor lines (TGN-033); test data, so tests/config/.

## `tests/config/cli/generation/swift.ts`

- (the file) (file): **move** to `tests/config/swift.ts`. One user; the file keeps its name and joins the Swift samples in tests/config/swift.ts, and SWIFT_LINE_ENDINGS becomes an inline \['lf', 'crlf'\].
- SWIFT_VERSION_FILES (const exported, 2-6): **move** to `tests/config/swift.ts` `SWIFT_VERSION_FILES`. One user; test data, so tests/config/. The sample writes a \[\[scope\]\] record with path = "nested".
- SWIFT_PROJECT_POLICY (const exported, 9-20): **move** to `tests/config/swift.ts` `SWIFT_PROJECT_SETTINGS`. One user. Settings, not policy; test data, so tests/config/. \[xcode\] project and destination (POL-033); nested writes xcode.project = "nested/Chosen.xcodeproj" from the repository root and no xcode.destination (CFR-003); the disabled scope writes no xcode.project, since absent means the Swift package, so its swiftformat file has no --swiftversion (TML-010); scopes are \[\[scope\]\] records.
- SWIFT_LINE_ENDINGS (const exported, 22-22): **inline** to `tests/unit/cli/generation/tool-file-sources/swiftformat.test.ts` `SwiftFormat writes the %s line ending you set in each scope`. TGN-051: test.each(\['lf', 'crlf'\]).

## `tests/config/cli/generation/typescript.ts`

- (the file) (file): **move** to `tests/config/typescript.ts`. One user; the constant joins the TypeScript samples (VALID) in tests/config/typescript.ts.
- MALFORMED_COMPILER_CONFIGURATIONS (const exported, 1-5): **move** to `tests/config/typescript.ts` `MALFORMED_TSCONFIGS`. One user; test data, so tests/config/; two rows only.

## `tests/types/cli/generation/ci.ts`

- (the file) (file): **move** to `tests/types/ci.ts`. TGN-046: two test files use these types (the unit CI test and tests/integration/ci.test.ts), so they are shared test types, which live in tests/types/&lt;topic&gt;.ts.
- WorkflowStep (type exported, 2-2): **move** to `tests/types/ci.ts` `WorkflowStep`. Used only by GithubWorkflow, so stop exporting; test types live in tests/types/.
- GithubWorkflow (type exported, 5-9): **move** to `tests/types/ci.ts` `GithubWorkflow`. Two test files; test types live in tests/types/.
- GitlabPipeline (type exported, 12-12): **move** to `tests/types/ci.ts` `GitlabPipeline`. Two test files; test types live in tests/types/.
- CiDocument (type exported, 15-15): **move** to `tests/types/ci.ts` `CiDocument`. tests/integration/ci.test.ts reads the parsed job with it; test types live in tests/types/.

## `tests/types/cli/generation/configuration-files.ts`

- (the file) (file): **move** to `tests/types/tool-files.ts`. TGN-046: a mixed file; three tool file shapes stay (Ruff, Knip, Stylelint) in tests/types/tool-files.ts under the glossary name 'tool file'; the ESLint shapes merge into configFor and the rest are inferred.
- RuffConfiguration (type exported, 4-6): **move** to `tests/types/tool-files.ts` `RuffToolFile`. One user. Glossary: tool file, not configuration; test types live in tests/types/.
- KnipConfiguration (type exported, 9-9): **move** to `tests/types/tool-files.ts` `KnipToolFile`. One user; test types live in tests/types/.
- StylelintConfiguration (type exported, 12-12): **move** to `tests/types/tool-files.ts` `StylelintToolFile`. One user; test types live in tests/types/.
- StylelintConsumerCase (type exported, 15-20): **delete**. TGN-046: inferred from the inline rows.
- MarkdownlintConfiguration (type exported, 23-23): **delete**. TGN-046: the format width test compares the parsed file with toMatchObject.
- YamllintConfiguration (type exported, 26-26): **delete**. TGN-046.
- ComputedEslint (type exported, 29-29): **merge** to `tests/setup/generate.ts` `configFor`. TGN-043: one helper parses the computed ESLint configuration.
- RuntimeConfiguration (type exported, 32-34): **merge** to `tests/setup/generate.ts` `configFor`. TGN-043: the schema gains languageOptions and settings.

## `tests/types/cli/generation/eslint/engines.ts`

- (the file) (file): **delete**. TGN-054, TGN-046.
- EnginePhase (type exported, 2-2): **delete**. TGN-054: only existed for a cast.

## `tests/types/cli/generation/eslint/findings.ts`

- (the file) (file): **move** to `tests/types/tool-output.ts`. TGN-042: the row type that lintFindings returns is a shared test type; the tool output shapes the integration tests read are one topic, so tests/types/tool-output.ts.
- FileRuleFinding (type exported, 4-4): **move** to `tests/types/tool-output.ts` `LintFinding`. TGN-042: the helper returns { file, rule, line } rows; tests/setup/generate.ts imports it from tests/types/tool-output.ts; glossary: finding.

## `tests/types/cli/generation/eslint/import-boundaries.ts`

- (the file) (file): **delete**. TGN-046.
- BoundaryResult (type exported, 2-2): **delete**. TGN-046: types one local variable.

## `tests/types/cli/generation/eslint/nextjs.ts`

- (the file) (file): **delete**. TGN-043.
- NextEslintConfiguration (type exported, 4-4): **delete**. TGN-043: configFor parses settings.

## `tests/types/cli/generation/eslint/overlaps.ts`

- (the file) (file): **delete**. TGN-028.
- OverlapCase (type exported, 4-13): **delete**. TGN-028.
