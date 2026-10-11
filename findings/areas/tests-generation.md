# Unit tests of file generation

gspot emits (builds in memory) every file it writes: tool files under `.gspot/config/`, pointers, hooks, CI files,
rules, and the managed block; `emitAll` does all of it. These tests build a sandbox with a `gspot.toml`, run `emitAll`
(or `createEslint`, which also writes the files and reads the real ESLint configuration), and then parse the output or
lint with it. Most tests check real behavior; the problems are tests that copy template constants, guard removed
things, check settings or commands instead of generation, or repeat each other. The target: each test file sits under
`tests/unit/cli/` at the path of the source file it tests (the ESLint tests split into `generation/eslint/blocks`,
`boundaries/`, `configuration/`, and `fragments/` by behavior), its data sits in `tests/config/<topic>.ts`, and every
weak, fake, duplicate, or self-policing test is deleted, not repaired. No new tests are planned.

## Test data

Test constants and sample text go to `tests/config/<topic>.ts`; the ESLint data forms the folder `tests/config/eslint/`
because it is about 600 lines. Only a single short literal used by one test file stays in that file, and so do values
computed when the test file starts (`PARSERS`, `configurations`, `check`). A `tests/config/` file imports only
`tests/config/` and writes its gspot.toml as text. Test types go to `tests/types/<topic>.ts` (TGN-046). The placement
rows name each value and its file. The files these tests use:

| File                                                                                                         | Holds                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/config/eslint/architecture.ts`                                                                        | `[[architecture.module]]` records, roles, environment readers                                                                                                                                                                                          |
| `tests/config/eslint/engines.ts`                                                                             | Node engine scopes, packages, findings                                                                                                                                                                                                                 |
| `tests/config/eslint/fragments.ts`                                                                           | the Jest, Vitest, Zustand, TanStack Query, and TypeScript fragment samples                                                                                                                                                                             |
| `tests/config/eslint/framework.ts`                                                                           | component files, i18n, React Native, raw-HTML components                                                                                                                                                                                               |
| `tests/config/eslint/jsdoc-types.ts`                                                                         | JSDoc type files, rules, findings                                                                                                                                                                                                                      |
| `tests/config/eslint/levels.ts`                                                                              | lint rules that change with the level, suppression comments                                                                                                                                                                                            |
| `tests/config/eslint/lint-rules.ts`                                                                          | one defect per pair of duplicate lint rules (`DUPLICATE_RULE_CASES`); the required rules per configuration as literal data (`REQUIRED_RULES`, `REQUIRED_RULE_CASES`, `REQUIRED_RULE_FILES`), since the manifest tables they were read from are deleted |
| `tests/config/eslint/node-scripts.ts`                                                                        | Node scripts with and without extensions                                                                                                                                                                                                               |
| `tests/config/eslint/overrides.ts`                                                                           | `[[tools.eslint.override]]` settings, runtime rows                                                                                                                                                                                                     |
| `tests/config/eslint/selectors.ts`                                                                           | restricted selectors, Express sources                                                                                                                                                                                                                  |
| `tests/config/eslint/sorting.ts`                                                                             | sorting levels, rules, rows                                                                                                                                                                                                                            |
| `tests/config/eslint/structure.ts`                                                                           | imports, re-exports, barrels, entry files                                                                                                                                                                                                              |
| `tests/config/commitlint.ts`, `stylelint.ts`, `knip.ts`, `semgrep.ts`, `swift.ts`, `typescript.ts`, `sql.ts` | the tool samples of each tool file                                                                                                                                                                                                                     |
| `tests/config/formatting.ts`, `ignore-patterns.ts`                                                           | format settings, Prettier plugins, ignore rows                                                                                                                                                                                                         |
| `tests/config/npm.ts`, `dependencies.ts`                                                                     | the npm tool project and its answers; Bun release-age rows                                                                                                                                                                                             |
| `tests/config/replace.ts`                                                                                    | tool files that init replaces or keeps                                                                                                                                                                                                                 |
| `tests/config/rules.ts`                                                                                      | rule file selection rows                                                                                                                                                                                                                               |
| `tests/config/serialization.ts`                                                                              | odd strings that must stay data                                                                                                                                                                                                                        |
| `tests/config/tool-files.ts`                                                                                 | the tool-file parse rows and the ESLint file path                                                                                                                                                                                                      |
| `tests/types/ci.ts`, `tool-files.ts`, `tool-output.ts`                                                       | parsed CI files; Ruff, Knip, and Stylelint tool files; one lint finding row                                                                                                                                                                            |

## Findings

### TGN-002: Two tests police the inside of the ESLint template

- Where: `tests/cli/generation/eslint/levels.test.ts:124-171` and `:173-199`
- Kind: delete
- Problem: The last test parses the ESLint template's compiled source and requires every all-level rule to sit inside
  an `IS_ALL ? ... : ...` branch: a house rule about how the template is written. The test before it builds the
  template output with three hooks replaced by fakes to watch which rule blocks it builds. Both came with a template
  rewrite (commit `52404404f`) that, by its own message, produced the same rules as before. The behavior "an all-level
  rule is off at recommended" is checked end to end by many per-rule tests, and `levels.test.ts:44-60` checks that
  `all` keeps every `recommended` rule.
- Fix: Delete both tests. CFL-002 reverts the template's level branches.
- Size: medium

### TGN-005: Assertions that a removed file, rule, or name is still gone

- Where: `eslint/layout.test.ts:44-45` (`gspot/sort-imports`, `gspot/sort-exports`); `eslint/architecture.test.ts:154` (`gspot/env-owner` ESLint rule); `licenses.test.ts:23,44` (`licenses.json`); `eslint/framework/selectors.test.ts:31,173` and `tests/config/cli/generation/eslint/framework.ts:19-23` (`REMOVED_ZOD_RULES`); `namespaces.test.ts:48` and `tests/config/cli/generation/namespaces.ts` (`retired` names); `vale.test.ts:49,52,53,58,111,195`; `serialization/documents.test.ts:200`; `eslint/policy.test.ts:90,103` (`legacy`); `formatting.test.ts:263` and `config-consumers.test.ts:164` (`.prettierrc.json`); `guides.test.ts:96-97,128`
- Kind: delete
- Problem: Each line checks that something deleted before is still absent. Nothing in the product can
  bring it back by accident; the code that made it is gone. These lines only remember history.
- Fix: Delete each listed assertion, `REMOVED_ZOD_RULES`, and the `retired` data, and rename tests whose title names
  the removed thing. At `config-consumers.test.ts:164` remove only `.prettierrc.json` from the list: the same loop
  checks that `.gspot/config/prettier.json` and `.prettierignore` are not written, which is live behavior. Several of
  the lines go anyway with the tests that hold them (TGN-006, TGN-015, TGN-031, TGN-027).
- Size: small

### TGN-006: A whole file that guards a past rename

- Where: `tests/cli/generation/namespaces.test.ts` (144 lines), `tests/config/cli/generation/namespaces.ts`
- Kind: delete
- Problem: The first test (16 sandboxes) checks each configuration's `kind` constant and that its old name is gone:
  self-policing. The second checks check-input building and the `structure/lone-files` check, which have their own
  tests, and the svgo default, a manifest constant. Only the third, svgo setting inheritance, tests behavior, and that
  is settings code, not generation.
- Fix: Delete the first two tests, their helpers, and the data file. Move the svgo inheritance test to
  `tests/unit/cli/settings/inherit.test.ts` as "a zero svgo setting is inherited, and a scope value applies to its
  children", run once.
- Size: medium

### TGN-008: A plugin rule tested again with a 1,960-character source string

- Where: `tests/cli/generation/eslint/functions.test.ts:31-60`; `tests/config/cli/generation/eslint/functions.ts`
- Kind: delete
- Problem: The second test lints a 30-statement source to test `gspot/no-trivial-functions` forms (callbacks,
  recursion, exports) that the plugin's own rule test already covers one per line. It also writes `consumer.ts`, which
  it never lints.
- Fix: Delete the second test and its data file. The first test joins
  `tests/unit/cli/generation/eslint/fragments/typescript.test.ts` with its source inline. Once the plugin test covers
  the type-aware inherited-method exemption (PLG-029), it only checks that the generated configuration gives lint
  rules type information.
- Size: small

### TGN-009: The Testing Library dependency check is tested twice

- Where: `tests/cli/generation/eslint/framework/rules.test.ts:95-118`; `tests/cli/generation/eslint/testing-library.test.ts`
- Kind: merge
- Problem: Both build a root with `@testing-library/*`, a child without it, and check that only the root test file is
  reported. The framework test also covers the Vue and Svelte packages; the other file covers React only.
- Fix: The Testing Library test (`tests/unit/cli/generation/eslint/fragments/testing-library.test.ts`) takes the
  `vue` and `svelte` rows; then delete `framework/rules.test.ts:95-118`.
- Size: small

### TGN-010: Vue and Svelte raw-HTML rules tested twice

- Where: `tests/cli/generation/eslint/framework/rules.test.ts:172-210`; `tests/cli/generation/eslint/html-injection.test.ts`
- Kind: merge
- Problem: Both check that `svelte/no-at-html-tags` and `vue/no-v-html` report raw HTML. The only new point in
  `rules.test.ts` is that the rules are off outside the component scope; it also reads two Svelte rule severities,
  which are fixed template values.
- Fix: Delete `rules.test.ts:172-210`. In the raw-HTML test
  (`tests/unit/cli/generation/eslint/configuration/components.test.ts`) add a `plain.js` file outside the framework
  scope and assert no finding there.
- Size: small

### TGN-011: A Vitest test repeats the next test

- Where: `tests/cli/generation/eslint/vitest.test.ts:43-52`
- Kind: delete
- Problem: It checks that `vitest/no-focused-tests` is on at level all. The test at lines 54-85 checks the same value
  at both levels and also lints.
- Fix: Delete lines 43-52.
- Size: small

### TGN-012: A focused Jest test is checked three times

- Where: `tests/cli/generation/eslint/jest.test.ts:32-49`, `:51-70`; `eslint/fragments.test.ts:12-49` (jest row)
- Kind: delete
- Problem: `jest/no-focused-tests` on a `test.only` is checked by all three, with the same source text and rule.
- Fix: Delete `jest.test.ts:32-49`.
- Size: small

### TGN-013: A settings refusal test sits in an HTML test file

- Where: `tests/cli/generation/html.test.ts:73-87`; `tests/config/cli/generation/html.ts:12-18`
- Kind: delete
- Problem: It checks that `gspot.toml` refuses a lint rule turned off in `tools.<tool>.rules`. That is settings
  parsing, which the settings tests already check, not HTML generation. It also loops over both levels although the
  level plays no part.
- Fix: Delete the test and `DISABLED_TOOL_RULES`.
- Size: small

### TGN-014: Knip output parsing is tested twice

- Where: `tests/cli/generation/knip.test.ts:152-209`; `tests/config/cli/generation/knip.ts:48-54`
- Kind: delete
- Problem: It runs real Knip to check that the output parser keeps line, column, and a spaced file name. The parser
  test covers the same parsing with a stored Knip report.
- Fix: Delete the test and `KNIP_DIAGNOSTIC_FILES`; the stored report stays tested by the parser test.
- Size: small

### TGN-015: Node runtime detection is tested a third time

- Where: `tests/cli/generation/guides.test.ts:71-80`
- Kind: delete
- Problem: It runs all `runtimeEvidenceCases()` rows (19 sandboxes) to see whether `NODE.md` is written. Runtime
  detection has its own test with the same rows, and `NODE.md` selection by runtime is tested in the rules tests.
- Fix: Delete the test.
- Size: small

### TGN-017: The same package-field test is written twice

- Where: `tests/cli/generation/commitlint.test.ts:15-70`; `tests/cli/generation/stylelint.test.ts:16-61`
- Kind: merge
- Problem: Both do the same steps: emit a `package.json` field change, write it, check the ownership log, check doctor
  suggestions, edit the file, drop the configuration, and check the field is restored. Only the tool and the expected
  values differ.
- Fix: One `test.each` over commitlint and stylelint in `tests/unit/cli/apply/write.test.ts`: "a package.json field
  follows its configuration and is restored when the configuration goes". The doctor parts move to the doctor
  suggestion tests (TGN-033). Delete the two copies.
- Size: medium

### TGN-018: Two parameter-limit tests for one setting

- Where: `tests/cli/generation/eslint/parameter-limits.test.ts`; `tests/tools/generation/parameter-limits.test.ts:21-49`; `tests/config/tools/generation/parameter-limits.ts`
- Kind: simplify
- Problem: Both run the same scenario (the default limit reports 8 parameters; a limit of 8 does not), for JavaScript
  and TypeScript in one file and for Python and Swift in the other, with different helpers and row shapes. Each Python and Swift row holds its own `ruff check --config ...` or `swiftlint lint --quiet ...` command, so if gspot runs the tools with other flags, the test still passes (the same problem as TTC-014).
- Fix: Keep both, with one row shape. The ESLint test stays a unit test
  (`tests/unit/cli/generation/eslint/configuration/parameter-limits.test.ts`), because the unit suite runs real ESLint.
  The Python and Swift test stays an integration test, merged into `tests/integration/general/structure.test.ts` and
  run through `gspot check --only python/ruff` and `--only swift/swiftlint`, because the unit suite cannot run Ruff or SwiftLint; the command column goes. The raised limit is written `[limits.<language>] function_parameters = { value = <n>, reason = "..." }`.
- Size: small

### TGN-019: A Zod version parameter that changes nothing

- Where: `tests/cli/generation/eslint/framework/selectors.test.ts:162-183`
- Kind: delete
- Problem: The test runs for Zod `3.25.76` and `4.6.2`, but nothing in gspot reads the Zod version, so both rows test
  the same thing. The test also checks three removed rules (TGN-005).
- Fix: Keep one row and drop the removed-rule loop, in `tests/unit/cli/generation/eslint/fragments/zod.test.ts`: "Zod
  reports z.any() and keeps its schema rules".
- Size: small

### TGN-020: A test row compares a result with itself

- Where: `tests/cli/generation/eslint/escaped-scopes.test.ts:52-57`
- Kind: delete
- Problem: The row `'example'` checks that `scopeShape('example')` equals `scopeShape('example')`, so it cannot fail.
- Fix: Drop the table: one test, "a scope path with a quote and code stays a string literal", compares the injected
  scope with the `'example'` shape once, in `tests/unit/cli/generation/eslint/serialize.test.ts`.
- Size: small

### TGN-023: A title about "preview" with no preview in code or test

- Where: `tests/cli/generation/level-contract.test.ts:14-32`
- Kind: delete
- Problem: The title says "Ruff selects stable rules with preview disabled". Neither the Ruff template nor the test
  mentions preview. The test checks that the first rule of the manifest list is in the output and that the
  basedpyright mode equals the manifest value: both copy the input.
- Fix: Delete the test; the Ruff test already checks rule families with literals. The file's other test, "switching
  the level and back writes the same files and the AGENTS.md level", joins `tests/unit/cli/generation/files.test.ts`.
- Size: small

### TGN-025: Tests that read one rule setting and never lint their sample

- Where: `eslint/astro-parts.test.ts` (whole file); `eslint/react-rules.test.ts:52-76`; `eslint/import-boundaries.test.ts:10-20`; `eslint/typescript-eslint.test.ts:99-112`; `eslint/layout.test.ts:7-18`; `eslint/vitest.test.ts:43-52`; `eslint/restricted-imports.test.ts:54-67`
- Kind: delete
- Problem: Each test builds the configuration and checks that one rule is set to `2`. Several write sources with real
  defects (`<img>` without `alt`, `dangerouslySetInnerHTML`, a missing `key`) and never lint them. A configured value
  says nothing about whether the rule fires: these tests are weak.
- Fix: Delete every listed test and `tests/config/cli/generation/eslint/astro-parts.ts`. The rules they name are
  linted by other tests (`react/no-danger` and `astro/no-set-html-directive` by the raw-HTML test).
- Size: medium

### TGN-026: A layout test asks about a file it did not create

- Where: `tests/cli/generation/eslint/layout.test.ts:12,16`
- Kind: delete
- Problem: The sandbox has `src/order.ts`; the test computes the configuration for `src/order.js` in a
  TypeScript-only sandbox, and only reads one rule value.
- Fix: Delete the test; the next test in the file covers sorting by level.
- Size: small

### TGN-027: Literal copies of template constants

- Where: `serialization/documents.test.ts:161-202` (Markdown `MD013`, `MD033`, `MD043`, `MD001`; Ruff isort), `:145`; `html.test.ts:10-44` and `tests/config/cli/generation/html.ts:2-9`; `config-consumers.test.ts:94-148`; `eslint/selectors.test.ts:65-71` and `tests/config/cli/generation/eslint/selectors.ts:17-26` (`LEVEL_RULES`); `eslint/framework/selectors.test.ts:27-29` and `framework.ts:13-18`; `swift.test.ts:73-76`; `formatting.test.ts:33-55`
- Kind: delete
- Problem: These assertions copy fixed values from a template into the test. They test nothing that depends on input,
  break on every intended template edit, and only freeze output.
- Fix: Keep only the parts that change with input or level (`MD041` and `MD025` by level, the per-scope Stylelint
  override for Vue and Svelte). Delete the rest: the Taplo defaults test, the Ruff isort test, `BUILT_HTML_RULES`,
  `LEVEL_RULES`, `ALL_SECURITY_RULES`, the literal `disabled_rules` list, and the Swift `ruleData` key checks.
- Size: medium

### TGN-028: The duplicate-rules test mostly tests other people's plugins

- Where: `tests/cli/generation/eslint/overlaps.test.ts` (144 lines); `tests/config/cli/generation/eslint/overlaps.ts` (234 lines), `eslint-regex.ts` (69), `eslint-deprecation.ts` (42); `tests/types/cli/generation/eslint/overlaps.ts`
- Kind: simplify
- Problem: gspot's part here is a fixed list of duplicate rules switched off in the template. The test lints 7 regex
  forms and 5 deprecated-API forms twice (`.js` and `.ts`) with exact columns; those findings come from
  `eslint-plugin-regexp` and `typescript-eslint`. The data uses a generic row type with a callback per row and four
  hand-written `.js`/`.ts` copy maps.
- Fix: One test at one level, "each pair of duplicate rules reports a defect once, from the kept rule", in
  `tests/unit/cli/generation/eslint/configuration/duplicate-rules.test.ts` (the lint rule tables live in
  `config/generation/eslint-rules.ts`, read by `generation/eslint/configuration.ts`). One source per rule pair goes to
  `DUPLICATE_RULE_CASES` in `tests/config/eslint/lint-rules.ts`. Drop the columns, the fix run, and the form matrix;
  delete the three data files and the type file. The test stays because it lints real defects and would fail if the
  list of switched-off rules broke.
- Size: medium

### TGN-029: Expected values read from the same data the code reads

- Where: `level-contract.test.ts:23-31`; `eslint/policy.test.ts:80-83`; `eslint/architecture.test.ts:26-27,40-41`; `config-consumers.test.ts:86-89,166-172`; `npm.test.ts:69-75`; `serialization/toml.test.ts:141-144`
- Kind: delete
- Problem: The expected pin, rule, or option is taken from `configurationManifests()` or a source constant, the same
  place the generator takes it. If the manifest is wrong, both sides are wrong together.
- Fix: Where the point is "a package is or is not installed", assert presence or absence by name only. Delete the
  pin-equals-manifest checks (`boundaryVersion`, `importVersion`, `policy.test.ts:80-83`, the mise pin test at
  `toml.test.ts:141-144`). The npm manifest row asserts an exact pin, not the manifest value.
- Size: small

### TGN-030: The "takeover" tests are `init` tests

- Where: `tests/cli/generation/eslint/takeover.test.ts` (186 lines); `tests/config/cli/generation/eslint/takeover.ts`
- Kind: move
- Problem: The file lives under `generation/eslint` but tests `init` replacing Stylelint and Knip files (and one ESLint
  file) with `prepare` and `writeSetup`.
- Fix: Move it to `tests/unit/cli/commands/init/replace/tool-files.test.ts`, with titles that say "replace"; its data
  goes to `tests/config/replace.ts` (`KNIP_FILES`).
- Size: small

### TGN-031: Settings tests in the generation folder

- Where: `licenses.test.ts` (both tests); `eslint/runtimes.test.ts:149-153,155-190`; `serialization/toml.test.ts:123-139`; `vale.test.ts:91-105,109-119`; `shared-settings.test.ts:197-232`; `config-consumers.test.ts:212-228`; `eslint/fragments.test.ts:51-63`; `swift.test.ts:46-51`; `formatting.test.ts:285-288`
- Kind: move
- Problem: These tests call only `openSession` or `parseStrictPolicy` and read settings or selection; generation is
  not involved. `vale.test.ts:91-105` checks which manifest declares a setting, which is self-policing data.
- Fix: Move the settings checks to the settings tests: the invalid runtime and the OSV expiry tests to
  `tests/unit/cli/settings/read.test.ts`; the site build command and the lines of `swift.test.ts:46-51`,
  `formatting.test.ts:285-288`, and `runtimes.test.ts:174-180` to `tests/unit/cli/settings/view.test.ts`. Delete
  `vale.test.ts:91-105`. Delete the license inheritance test (`licenses.test.ts:7-31`) and the runtime inheritance test
  (`runtimes.test.ts:155-190`): allowed packages and ESLint overrides are root records (CFR-004). Delete the two
  selection tests (`config-consumers.test.ts:212-228`, `fragments.test.ts:51-63`), which the configuration selection
  tests already cover. The second license test stays a generation test in `tests/unit/cli/generation/npm.test.ts`: "a
  root allowed package installs the license tool for a child scope without a root manifest".
- Size: medium

### TGN-032: Schema and parser tests in the generation folder

- Where: `npm.test.ts:104-112` (`toolProjectSchema`); `eslint/runtimes.test.ts:206-210` (`eslintGlobalsSchema`); `trivy.test.ts:41-44`; `eslint/fragments.test.ts:65-75` (`typescriptImports`); `eslint/node-scripts.test.ts:104-153` (`eslintFilePatterns` with a hand-made ESLint configuration and `parseOutput`)
- Kind: move
- Problem: These test a schema or a parser with no generated file.
- Fix: Move the tool-project schema test to `tests/unit/cli/parsers/tool-project.test.ts` and the Trivy schema lines to
  `tests/unit/cli/settings/schema/tools.test.ts`. Delete the globals schema test: the schema moves to
  `scripts/update-rule-lists.ts` (PAR-031), and script tests go. The `typescriptImports` test stays in
  `tests/unit/cli/generation/fragments.test.ts`, because the function moves into `generation/fragments.ts` (PAR-075).
  Test `eslintFilePatterns` directly with picomatch in `tests/unit/cli/generation/eslint/files.test.ts`, without
  building ESLint and without the `parseOutput` half; no file with a backslash is written, so the Windows skip goes.
- Size: small

### TGN-033: Doctor and planning checks inside generation tests

- Where: `commitlint.test.ts:72-84`; `stylelint.test.ts:36-44`; `eslint/framework/selectors.test.ts:48-52`; `eslint/mobile-applicability.test.ts:22-27`; `formatting.test.ts:75-82,264-266`
- Kind: move
- Problem: Doctor suggestions (`getSuggestions`), planned checks (`configuredChecks`, `planRun`), and a check's command
  line are tested in the middle of generation tests; the selectors test title talks about server-only rules and then
  checks that doctor suggests `css`.
- Fix: Move the doctor parts to `tests/unit/cli/commands/doctor/suggestions.test.ts` (for example "doctor tells you to
  run git init for commitlint in a folder without Git"), the planning lines to `tests/unit/cli/planning/checks.test.ts`,
  and the shfmt command line (`formatting.test.ts:75-82`) to `tests/unit/cli/execution/command/placeholders.test.ts`.
  Delete `formatting.test.ts:264-266` (a manifest constant).
- Size: small

### TGN-034: Rule file selection is tested under the name "guides"

- Where: `tests/cli/generation/guides.test.ts` (130 lines); `tests/config/cli/generation/guides.ts`
- Kind: move
- Problem: The file tests which rule files are written. The product and the glossary call them rules; "guides" is a
  second name, and rule selection already has its own test file.
- Fix: Merge the kept tests into `tests/unit/cli/rules.test.ts` (TCM-032), split by behavior if the file passes 300
  lines. Rename `generatedGuides` to `writtenRuleFiles`; its configuration list becomes `RULE_CONFIGURATIONS` in
  `tests/config/rules.ts`. Delete the Node runtime test (TGN-015), the Playwright test (ST2-002), and the test of the
  two unconditional HTTP and OpenAPI rule files (self-policing). The Drizzle driver table keeps one PostgreSQL driver
  (`pg`) and one other (`mysql2`).
- Size: small

### TGN-036: Sandboxes for a two-branch template

- Where: `tests/cli/generation/config-consumers.test.ts:177-210`
- Kind: simplify
- Problem: The v8r tool file has two branches, but the test runs 7 runner rows at 2 levels and mocks executables to
  make the extra runners work. With the `runner` setting gone (INX-003), the v8r file always lists the mise schema
  (TMF-002) and no longer depends on a runner.
- Fix: Two rows (custom schemas or none) at one level, both expecting the mise entry, with custom schemas written as
  `[[tools.v8r.schema]]` records; no runner and no `mockPinnedExecutables`. The test moves to
  `tests/unit/cli/generation/tool-file-sources/v8r.test.ts`.
- Size: small

### TGN-038: A full `gspot apply` run to confirm what emitAll just showed

- Where: `tests/cli/generation/npm.test.ts:76-83`
- Kind: delete
- Problem: For the manifest row the test starts the CLI to run `apply` and reads the same pin back; lines 68-75 already
  check the pin from `emitAll`.
- Fix: Delete lines 76-83.
- Size: small

### TGN-039: Exact TypeScript compiler messages in an ESLint test

- Where: `tests/cli/generation/eslint/jsdoc-types.test.ts:83-100`
- Kind: simplify
- Problem: The test runs `tsc` on the generated `jsconfig.json` and compares the compiler's exact error text, file
  positions included. That is TypeScript's output, not gspot's.
- Fix: Assert the exit code (2, then 0) and the three file names only.
- Size: small

### TGN-040: Compiling and running code to test typescript-eslint's fixer

- Where: `tests/cli/generation/eslint/policy.test.ts:130-192`
- Kind: simplify
- Problem: The test fixes type imports, formats with Prettier, compiles with `tsc`, runs the result with Node, and
  checks its JSON output. gspot's part is only that the two rules are on at `all` and off at `recommended`.
- Fix: Lint `index.ts` once per level and assert that the two rule IDs appear at `all` and not at `recommended`, in
  `tests/unit/cli/generation/eslint/fragments/typescript.test.ts`. Delete the fix, format, compile, and run steps.
- Size: small

### TGN-041: Comparing JSON strings instead of values

- Where: `eslint/policy.test.ts:40,64,88,125,155`; `eslint/jsdoc-types.test.ts:71,82`; `eslint/overlaps.test.ts:120,132`; `eslint/engines.test.ts:62`; `eslint/node-scripts.test.ts:60,92`; `eslint/architecture.test.ts:55,80`
- Kind: simplify
- Problem: Each builds `JSON.stringify(...)` and compares strings with `toBe`. A failure prints two long strings with no
  diff, and key order matters for no reason. Five files repeat a local `lintReport` function.
- Fix: Return plain objects and compare with `toStrictEqual`, using the function of TGN-042.
- Size: small

### TGN-042: The same finding filter is written 64 times

- Where: every file under `tests/cli/generation/eslint/`
- Kind: simplify
- Problem: Tests repeat `results.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === X).map(...))`
  with small changes (file names cut from paths, `\\` replaced, sort): 64 copies, 4 path-cleaning forms.
- Fix: One function in `tests/setup/generate.ts`, `lintFindings(eslint, root, files, rules): { file, rule, line }[]`
  (POSIX paths, sorted), returning `LintFinding` rows (`tests/types/tool-output.ts`). Replace the copies
  (`nodeFindings`, `messagesOf`, `ruleReports`, `testingLibraryMessages`).
- Size: medium

### TGN-043: Three ways to read the computed ESLint configuration

- Where: `tests/harness/generated.ts:13-18` (`eslintConfigurationSchema`, 8 users); `tests/types/cli/generation/configuration-files.ts:28-34` (`ComputedEslint`, `RuntimeConfiguration`, 12 users); `as Linter.Config` (4 files); `tests/types/cli/generation/eslint/nextjs.ts`
- Kind: merge
- Problem: One job, three tools: a zod parse, a type cast, and a cast to ESLint's own type.
- Fix: One function, `configFor(eslint, file)`, in `tests/setup/generate.ts`, that parses with the zod schema
  (extended with `languageOptions` and `settings`). Delete `ComputedEslint`, `RuntimeConfiguration`,
  `NextEslintConfiguration`, the casts, and `configuredRules`.
- Size: medium

### TGN-046: The `tests/types/cli/generation/` mirror is mostly one-use types

- Where: `tests/types/cli/generation/` (7 files, 74 lines, including `ci.ts`); `gspot.toml:50-58` (two `[[naming.overrides]]` that name `configuration-files.ts` and `ci.ts`)
- Kind: delete
- Problem: `BoundaryResult` types one local variable; `EnginePhase` exists only for a cast; `OverlapCase` types one
  table; `NextEslintConfiguration` and `FileRuleFinding` are covered by TGN-043 and TGN-042. `configuration-files.ts` mixes Ruff, Knip, Stylelint, Markdown, YAML, and ESLint shapes with one row type. The shapes that stay are types, so they go to `tests/types/`, not to the value files `tests/config/ci.ts` and `tests/config/npm.ts`.
- Fix: Let TypeScript infer the one-use types and delete their files. `ci.ts` becomes `tests/types/ci.ts` (the parsed GitHub and GitLab CI shapes); the Ruff, Knip, and Stylelint shapes go to `tests/types/tool-files.ts`, and `LintFinding` (the row `lintFindings` returns) to `tests/types/tool-output.ts`. The two naming overrides in `gspot.toml` (`MD007`,
  `with`) follow the new paths.
- Size: small

### TGN-047: Data files named after a test that does not use them

- Where: `tests/config/cli/generation/eslint/eslint-deprecation.ts`, `eslint-regex.ts` (used by `eslint/overlaps.test.ts`); `eslint/framework.ts` (used by `eslint/framework/selectors.test.ts`); `serialization.ts` (used by `serialization/documents.test.ts`); `commitlint.ts` `INACTIVE_CONFIGURATIONS` (used only by `tests/cli/commands/init/takeover.test.ts:15`)
- Kind: move
- Problem: The data files are said to mirror their tests, but these do not, so a reader opens the wrong file.
- Fix: Each value goes to its topic file: the duplicate-rule sources to `tests/config/eslint/lint-rules.ts`, the
  framework data to `tests/config/eslint/framework.ts`, the odd strings to `tests/config/serialization.ts`, and
  `INACTIVE_CONFIGURATIONS` to `tests/config/replace.ts`.
- Size: small

### TGN-049: Doc comments with nothing under them

- Where: `tests/config/cli/generation/eslint/node-scripts.ts:177-179`
- Kind: delete
- Problem: Two doc comments describe constants that are gone; each is followed by another comment, not a declaration.
- Fix: Delete lines 177-179 (keep the comment on line 181).
- Size: small

### TGN-050: File names in a skip list that gspot never writes

- Where: `tests/config/cli/generation/every-template.ts:20` (`'semgrepignore'`), `:25` (`'.swiftformat'`)
- Kind: delete
- Problem: The list names files the parse loop skips. No manifest writes `semgrepignore` (without a dot) or
  `.swiftformat`; the real targets are `.semgrepignore` and `.gspot/config/swiftformat`.
- Fix: Delete the two entries.
- Size: small

### TGN-051: Unused or extra fields in test data

- Where: `tests/config/cli/generation/eslint/layout.ts:1-4` (`enabled` repeats `severity === 2`), `:15-45` (`name` never read); `swift.ts:22` (`[['lf'], ['crlf']]`); `eslint/required-rules.ts:2` (`CHECK_LEVELS`); `shared-settings.ts:1-3` (`KNIP`, `STYLELINT`, `RUFF` path constants); `eslint/node-scripts.ts:7-65` (`strict: []` on 8 of 9 rows)
- Kind: simplify
- Problem: Extra fields and wrappers that no test needs.
- Fix: Drop `enabled` and `name`; use `test.each(['lf', 'crlf'])`; delete `CHECK_LEVELS` and import `LEVELS` in the
  test; write the paths inline; make `strict` optional.
- Size: small

### TGN-052: The same gspot.toml is written three times in one file

- Where: `tests/cli/generation/eslint/structure.test.ts:129-202`
- Kind: merge
- Problem: Three tests build the same sandbox with the same 4-line settings string, copied word for word, for the same
  4 level and re-export rows (12 sandboxes).
- Fix: One `test.each(LEVEL_REEXPORT_CASES)` that builds the sandbox once and runs the import, re-export, and barrel
  checks: "%s %s: import, re-export and barrel rules in root and child scopes". The sample writes `limits.index_exports = 2` plain (DT1-005).
- Size: small

### TGN-053: The Knip command is written out five times

- Where: `tests/cli/generation/knip.test.ts:37-47,76-87,111-121,158-168,233-245`; `tests/cli/generation/eslint/takeover.test.ts:140-148`
- Kind: simplify
- Problem: Each test spells out the same `node .gspot/node_modules/knip/bin/knip.js --config ... --reporter json`
  arguments; the copies differ only in `--include`.
- Fix: One local function `runKnip(root, include)` at the top of the Knip test, reading `KNIP_ARGV` from
  `tests/config/knip.ts`.
- Size: small

### TGN-054: Engine phase data copies its own scope list

- Where: `tests/config/cli/generation/eslint/engines.ts:1-2,31`; `tests/cli/generation/eslint/engines.test.ts:32`
- Kind: simplify
- Problem: The phase data spells out the scope tables that `ENGINE_SCOPES` already holds, and
  `const phases: EnginePhase[] = ENGINE_PHASES;` only casts. `tools.eslint.node_version` goes (TML-006), so the two
  `node_version` phases go too.
- Fix: Keep one phase, built from `ENGINE_SCOPES`; delete the cast and `EnginePhase`.
- Size: small

### TGN-055: The fragment test counts text occurrences

- Where: `tests/cli/generation/eslint/fragments.test.ts:30-32,40`
- Kind: delete
- Problem: It counts how many times a rule name appears in the generated text and then checks the same thing by
  linting; the count breaks if the template quotes the name once more. The `nestjs` row lints nothing (an `if` skips
  it), so it is weak.
- Fix: Delete the count and the `nestjs` row.
- Size: small

### TGN-056: The framework selectors test is a grab bag

- Where: `tests/cli/generation/eslint/framework/selectors.test.ts:17-39`
- Kind: simplify
- Problem: One test checks four sonarjs severities, two password rules, three removed Zod rules, React Native list
  selectors, and react-hook-form selectors, under a title that says nothing specific.
- Fix: Keep the selector lint (lines 32-37) as "React Native and react-hook-form syntax selectors report at level all
  only" in `tests/unit/cli/generation/eslint/blocks.test.ts`; delete the severity tables (TGN-027) and the Zod part
  (TGN-005).
- Size: small

### TGN-057: A Swift test also tests nginx

- Where: `tests/cli/generation/swift.test.ts:56-78`
- Kind: simplify
- Problem: A SwiftFormat line-ending test also checks the `ruleData` keys of the gixy (nginx) file, and loops over both
  levels inside one test with the same expectations.
- Fix: Drop `nginx`, the `gixy.cfg` line, and the `ruleData` checks; run once.
- Size: small

### TGN-058: The bunfig test drives ownership internals

- Where: `tests/cli/generation/bunfig.test.ts:12-39`
- Kind: move
- Problem: The first test calls `planMerge`, `planRestoration`, and `applyPlans` from the ownership log and disposes the
  log by hand (`log[Symbol.dispose]()`, line 37). That tests the ownership log, not generation.
- Fix: Move it to the TOML managed-key tests, `tests/unit/cli/ownership/managed-keys/toml.test.ts` (TEL-029), and use
  `using log`.
- Size: small

### TGN-061: File names that say nothing or mislead

- Where: `level-contract.test.ts`, `config-consumers.test.ts`, `shared-settings.test.ts`, `namespaces.test.ts`, `guides.test.ts`, `every-template.test.ts`, `eslint/mobile-applicability.test.ts`, `eslint/vite-entries.test.ts`, `eslint/astro-parts.test.ts`, `eslint/escaped-scopes.test.ts`, `eslint/overlaps.test.ts`, `eslint/policy.test.ts`, `eslint/takeover.test.ts`, `eslint/scopes.test.ts`, `serialization/javascript.test.ts`, and two `selectors.test.ts` files
- Kind: rename
- Problem: Names are jargon ("contract", "consumers", "namespaces", "applicability"), describe a mechanism instead of
  the behavior, or clash with other folders (`eslint/policy.test.ts`, four `takeover.test.ts` files).
- Fix: Each unit test sits at the path of the source file it tests under `tests/unit/cli/generation/`:
  `files.test.ts` (attributes, managed ignores, the level switch), `tool-files.test.ts` (was `config-consumers` and
  `every-template`), one file per tool file source in `tool-file-sources/` (`knip`, `ruff`, `stylelint`, `semgrep`,
  `squawk`, `swiftformat`, `trivy`, `typos`, `markdownlint`, `html-validate`, `v8r`), `prose.test.ts` (was `vale`),
  `tsconfig.test.ts` (was `typescript`), and `pointers.test.ts`. The ESLint tests go to `eslint/blocks.test.ts`,
  `eslint/serialize.test.ts` (was `escaped-scopes` and `serialization/javascript`), `eslint/runtimes.test.ts`,
  `eslint/boundaries/`, `eslint/configuration/` (`duplicate-rules`, `entry-files`, `suppression-comments`, `levels`,
  `imports`, `structure`, ...), and `eslint/fragments/` (one file per configuration fragment, such as `expo`,
  `typescript`, `react-native`). `namespaces`, `guides`, `takeover`, and `astro-parts` go (TGN-006, TGN-034, TGN-030,
  TGN-025).
- Size: medium

### TGN-062: Grab-bag files near the 300-line limit

- Where: `formatting.test.ts` (290 lines), `knip.test.ts` (283), `shared-settings.test.ts` (232), `config-consumers.test.ts` (228), `vale.test.ts` (226)
- Kind: simplify
- Problem: Each mixes several tools and kinds of code (settings, doctor, planning, Prettier, shfmt command lines). They
  are long because of the misplaced and duplicate parts above.
- Fix: After TGN-005, TCO-012, and TGN-031 to TGN-033, split by source file (TGN-061): `shared-settings.test.ts`
  splits into the Knip, Ruff, and ignore-pattern tests and the settings view test; the Prettier ignore tests of
  `formatting.test.ts` go to `ignore-patterns.test.ts`. Most files then fall under 120 lines.
- Size: medium

### TGN-065: The CI test repeats a check in every row and checks constants

- Where: `tests/cli/generation/ci.test.ts:13-15`, `:28-29`
- Kind: simplify
- Problem: Lines 28-29 (no manual job when no check is manual) run again for each row of the `test.each`, and lines
  13-15 check the fixed path and workflow name.
- Fix: Move lines 28-29 into the first test so they run once, and delete lines 13-15.
- Size: small

### TGN-066: The every-template test repeats checks made elsewhere

- Where: `tests/cli/generation/every-template.test.ts:90-94`
- Kind: delete
- Problem: It asserts that `jsconfig.json` is absent and that the `commitlint` and `jscpd` files are absent at
  recommended. The tool-file test covers the first; the level gating of tool files is covered by `targets` (lines
  80-89) in the same test.
- Fix: Delete lines 90-94.
- Size: small

### TGN-068: Six sandboxes check one manifest line each

- Where: `tests/cli/generation/eslint/framework/rules.test.ts:120-142`
- Kind: simplify
- Problem: Six frameworks are tested for the same "a bundler scope does not require the `.js` suffix" result. Each
  gets it from the same one-line manifest setting, through the same code (`importStyleBlocks`), so five rows only check
  that a manifest still holds that line.
- Fix: Keep the `react` row and the root check, in `tests/unit/cli/generation/eslint/configuration/imports.test.ts`.
- Size: small

### ST2-001: The Jest `valid-expect` test checks a plugin default

- Where: `tests/cli/generation/eslint/jest.test.ts:7-30`; `packages/cli/configurations/test/jest/eslint.fragment.js.eta:2`
- Kind: delete
- Problem: The test lints `expect(value, "message")` and expects `jest/valid-expect`. gspot sets that rule with
  `{ maxArgs: 1 }`, the plugin's own default, so the test passes whether gspot sets the option or not. The scope test
  in the same file already shows that the fragment works and that `@jest/globals` is recognized.
- Fix: Delete the test. The redundant `{ maxArgs: 1 }` in the template is a note for the Jest configuration.
- Size: small

### ST2-002: Four tests repeat a kept test

- Where: `tests/cli/generation/eslint/react-rules.test.ts` (row "bare react-native"); `tests/cli/generation/guides.test.ts:104-130` (Playwright rules); `tests/cli/generation/serialization/javascript.test.ts:63-91`; `tests/cli/commands/set/words.test.ts`; `tests/cli/configurations/owners.test.ts:54-65`
- Kind: delete
- Problem: The bare React Native row lints raw text in a `View`, which the React Native raw-text test already lints.
  The Playwright test repeats the `@playwright/test` row of the conditional rule-file test, and its child-scope row
  repeats the scope rows of the runtime rule test. The runtime-name test checks that names from a closed list cannot
  inject code, while every runtime is linted by "runtime globals and Node.js rules stay apart". The `set/words` test
  checks the Vale word list that the Vale vocabulary test already checks. "a scope narrows the covered files" repeats
  the scope rows of the migration coverage test.
- Fix: Delete them, with `PLAYWRIGHT_DEPENDENCIES` and the file `set/words.test.ts`. Keep only the Expo row of
  `REACT_NATIVE_FIXES` and `src/Box.tsx` of `REACT_NATIVE_FILES`.
- Size: small

### ST2-004: Parameter tables that repeat one branch

- Where: Drizzle drivers (`guides.test.ts:82`), the runner loop of the Next.js plugin test (`npm.test.ts:88`), seven package managers for the site build command (`shared-settings.test.ts:197-201`), two malformed tsconfig rows (`typescript.test.ts:12`), eight sorting rows (`eslint/layout.test.ts:20`); in the command tests the react-native and expo rows, two pre-push argument rows, six Commander argument errors, and three lefthook names
- Kind: simplify
- Problem: Each table runs the same code path once per row; the rows differ only by a manifest list entry, a name the
  plugin owns, or Commander's own message. The Next.js runner loop runs the same test under two runners that change
  nothing (and the runner setting goes). The sorting rows test perfectionist's own sorting (side effects, comment
  attachment, groups) rather than gspot's options.
- Fix: Delete the runner loop (weak). Keep one row per branch in the other tables: one PostgreSQL driver (`pg`) and one
  other; `npm fallback` and `declared Bun`, in the root and in `app`; one malformed tsconfig; the sorting rows that
  depend on gspot's options; one argument error per gspot branch.
- Size: small

### ST2-007: A test data value is placed with a deleted test

- Where: `VITEST_FILES` (`tests/config/cli/generation/eslint/vitest.ts`)
- Kind: move
- Problem: `VITEST_FILES` is placed with the role test, which is deleted (a duplicate of the role import test); its
  only user is the Vitest rule test.
- Fix: `VITEST_FILES` goes to `tests/config/eslint/fragments.ts`, with the two files the Vitest rule test uses.
- Size: small

### ST2-011: ESLint role data keeps the `config` role that goes

- Where: `tests/config/cli/generation/eslint/architecture.ts:50-52,65,74,88` (`ROLE_IMPORT_CASES`, `ROLE_TABLES`, `ROLE_TARGETS`)
- Kind: delete
- Problem: The three tables still use `config = "config/**"`, a role that TML-001 deletes with the roles `tests`,
  `types`, `test_harness`, and `runtime`. The role test keeps only the fixed `test_files` rule.
- Fix: Drop the two `config` rows, the two `config` lines, and `config/value.ts`; the tables move to
  `tests/config/eslint/architecture.ts`.
- Size: small

### DT1-001: A scope cannot clear an inherited list, and two samples rely on it

- Where: `tests/config/cli/generation/eslint/architecture.ts:117-119` (the "empty" scope with `env = []` in `ENVIRONMENT_TABLES`); `tests/cli/generation/knip.test.ts:263` (`[scope."app/deep"] test_files = []`)
- Kind: delete
- Problem: Today a scope that writes `env = []` turns the environment rules off for its folder, and the test expects
  `empty/src/source.js` to pass. In the target format a list adds up without repeats across levels (TMF rule 6), so
  an empty list in a scope adds nothing and the root `environment_readers` still applies.
- Fix: Drop the "empty" row of `ENVIRONMENT_TABLES`. The Knip `[]` row stays (it adds nothing either way). The way to
  stop a check in one folder is an `[[ignore]]` with `paths`.
- Size: small

### DT1-003: Root-only module records need unique names

- Where: `tests/cli/checks/library/trpc.test.ts:20` (three modules named `server` in three scopes); `ARCHITECTURE_POLICIES` and `TEST_BOUNDARY_POLICY` in `tests/config/cli/generation/eslint/` (modules `app` and `storage` in a scope beside root modules of the same names); CFR-004
- Kind: rename
- Problem: CFR-004 moves every `[[architecture.module]]` record to the root, with root paths. Today each scope can
  reuse a module name; at the root two records named `server` collide, and `may_import` names become ambiguous.
- Fix: Module names are unique across the root list, and gspot refuses a repeated name. The tRPC test merges the paths
  of its three `server` modules into one root `server` module; the two generation samples (`MODULE_TABLES` and
  `QA_MODULE_TABLES` in `tests/config/eslint/architecture.ts`) give their scope copies distinct names.
- Size: small

### DT1-008: An empty `xcode.destination` is refused

- Where: `SWIFT_PROJECT_POLICY` (`tests/config/cli/generation/swift.ts`, nested scope, with `swift.test.ts` asserting the empty destination); `MANUAL_SWIFT_CHOICES` (`tests/config/cli/commands/init/policy-text.ts`, row "empty destination")
- Kind: delete
- Problem: The two samples write `xcode_destination = ""`. The empty-string form is refused for every setting
  (TML-010), `xcode.destination` included; an absent `xcode.destination` means the default,
  `generic/platform=iOS Simulator`.
- Fix: The SwiftFormat sample (`SWIFT_PROJECT_SETTINGS` in `tests/config/swift.ts`) drops the nested empty
  destination line and the SwiftFormat test drops the matching assertion; the init sample (`TEMPLATE_SWIFT_CHOICES` in
  `tests/config/init.ts`) drops its "empty destination" row.
- Size: small
