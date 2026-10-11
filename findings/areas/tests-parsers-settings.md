# Unit tests of parsers and settings

These are the unit tests of the code that reads files and tool output (`packages/cli/src/parsers/`) and of the code
that reads, checks, and writes `gspot.toml` (today `packages/cli/src/policy/`, target `src/settings/`). Today they sit
in `tests/cli/parsers/` and `tests/cli/policy/`, with data in `tests/config/cli/{parsers,policy}/` and types in
`tests/types/cli/{parsers.ts,policy/}`. The target: each test sits at the path of the source file it tests under
`tests/unit/cli/`, the many copies of one refusal are cut to one test each, tests of libraries, of removed setting
names, and of shipped data are deleted, and test data lives in `tests/config/<topic>.ts`. No new test is planned.

## Target layout

```text
tests/unit/cli/
  parsers/
    bash.test.ts, comments.test.ts, generated-header.test.ts, git.test.ts, tree-sitter.test.ts, xcode.test.ts
    json.test.ts                 JSON and JSON with comments (was json.test.ts and jsonc.test.ts)
    output/formats.test.ts       parseOutput for every format (with the format contract test)
    output/json.test.ts, output/knip.test.ts, output/markdownlint.test.ts, output/semgrep.test.ts,
    output/typos.test.ts
    sql/postgres.test.ts         was sql/statements.test.ts and pg.test.ts
    toml/document.test.ts        was toml.test.ts
  settings/
    comments.test.ts, drop-defaults.test.ts, edit.test.ts, file.test.ts, inherit.test.ts, layout.test.ts,
    normalize.test.ts, read.test.ts, templates.test.ts, view.test.ts
    errors/keys.test.ts, errors/reasons.test.ts
    schema/architecture.test.ts, schema/gspot-toml.test.ts, schema/parts.test.ts, schema/tools.test.ts
  configurations/manifests.test.ts                  was parsers/configurations/
  checks/framework/nextjs.test.ts                   Next.js build flags and next.config findings
  checks/infrastructure/nginx.test.ts
  checks/general/naming/sql.test.ts                 SQL identifiers
  checks/general/prose.test.ts                      Vale output
  checks/general/structure/trivial-functions.test.ts  statement counting
  checks/testing/swift-tests.test.ts                Swift package coverage
  execution/command/check.test.ts, execution/command/output.test.ts   command checks
  planning/checks.test.ts                           check replacement and Xcode file selection
  repository/tooling/files.test.ts                  INI sections
  tools/npm/lockfiles.test.ts, tools/versions.test.ts
tests/config/settings/{errors,file,schema,scopes}.ts, comments.ts, git.ts, output.ts, markdown.ts, spelling.ts,
  knip.ts, semgrep.ts, formatting.ts, nextjs.ts, nginx.ts, npm.ts, sql.ts, structure.ts, swift.ts, tools.ts,
  xcode.ts, expo.ts, generated-files.ts, configurations.ts, bash/checks.ts
```

Deleted whole: `parsers/settings.test.ts`, `parsers/setting-values.test.ts` (POL-001), `parsers/eslint-schema.test.ts`
(the preset capture moves to `scripts/`, whose tests go), `parsers/expo.test.ts` (the Expo check test runs the same
reports), `parsers/swift/source.test.ts` (PAR-001), `policy/public-shape.test.ts` (split, TPP-030),
`tests/types/cli/parsers.ts`, `tests/types/cli/policy/`.

## Findings

### TPP-002: "An unknown key is refused" is tested in at least 9 places, through one code path

- Where: `tests/config/cli/policy/read/settings.ts:50-63` (`UNKNOWN_KEY_CASES`), `tests/config/cli/policy/schema/tools.ts:98-112`,
  `tests/cli/policy/read/recovery.test.ts:86-91`, `:101-107`, `tests/config/cli/policy/schema/exceptions.ts:5-112`
  (6 "removed" rows), `tests/config/cli/policy/public-shape.ts:2-10` (`POLICY_PUBLIC_REFUSALS`),
  `tests/config/cli/policy/read/settings.ts:38` (`REMOVED_STRUCTURE_SETTINGS`), `tests/config/cli/policy/schema/cases.ts:217-230`,
  `tests/cli/policy/key-paths.test.ts:62-69`, `tests/cli/policy/schema.test.ts:47`
- Kind: delete
- Problem: Every one of these sends an unknown key into the same zod `strictObject` and the same message builder
  (`issueLines` in `policy/public.ts:37-47`, "`x` is not a setting gspot knows under [...]"). None of the removed names
  has special handling in the source. Testing one path nine times adds run time and reading time and proves nothing
  new.
- Fix: Keep one test: "an unknown key is refused: $name" in `tests/unit/cli/settings/errors/keys.test.ts`, with its
  rows (`UNKNOWN_KEY_CASES`: top level, nested table, a `[[scope]]` record) in `tests/config/settings/errors.ts`.
  Delete the other eight places, including all of `exceptions.ts` except its two allowed-registry rows, which join
  `PUBLISHED_SCHEMA_CASES` in `tests/config/settings/schema.ts`, and the `schema.test.ts:47` line. Do together with
  TPP-003.
- Size: medium

### TPP-003: Tests keep removed setting names and old internal names alive

- Where: `tests/config/cli/policy/public-shape.ts:2-10` and `tests/cli/policy/public-shape.test.ts:21-24`;
  `public-shape.test.ts:55-58` (`not.toHaveProperty('scopes' | 'checks' | 'ignores' | 'agentRules')`), `:152-154`
  (`imports_allowed`), `:162` (`test_support`); `tests/config/cli/policy/read/settings.ts:37-38` and
  `read/settings.test.ts:183-189` (`REMOVED_STRUCTURE_SETTINGS`); the "removed ..." rows of
  `tests/config/cli/policy/schema/exceptions.ts`; `tests/config/cli/policy/schema/cases.ts:217-230` (removed `locales`);
  `tests/cli/parsers/configurations/declarations.test.ts:139-156` (syntax selector); `tests/config/cli/policy/schema/fields.ts:23-53`
- Kind: delete
- Problem: These tests exist only to prove that old names stay gone. They police the history of the project, not its
  behavior, and make every reader learn names that no longer exist. Most rows came in commit `ca2975ca5`.
- Fix: Delete the `POLICY_PUBLIC_REFUSALS` test and data, the `REMOVED_STRUCTURE_SETTINGS` test and data, the four
  `not.toHaveProperty` lines, the `imports_allowed` and `test_support` assertions, the "removed ..." rows, the
  "removed locales" rows with `LOCALE_SCHEMA_CASES`, the whole syntax selector test with
  `SYNTAX_SELECTOR_DECLARATION` (its field assertion only restates the selector schema), and `fields.ts` (TPP-039; its
  runner rows test a deleted setting). Do together with TPP-002.
- Size: small

### TPP-004: "This tool refuses extra tool options" is tested in 6 places, and two lists copy the source

- Where: `tests/config/cli/policy/schema/tools.ts:113-130`, `:142-164` (`VERBATIM_TOOL_NAMES`, `NO_VERBATIM_TOOL_NAMES`);
  `tests/cli/policy/schema.test.ts:192-211`; `tests/config/cli/policy/read/tools.ts:24-61` and
  `tests/cli/policy/read/tools.test.ts:11-21` (`UNSUPPORTED_PYTHON_OPTIONS`); `tests/cli/policy/read/commitlint.test.ts:18-25`;
  `tests/cli/policy/read/yamllint.test.ts:15-22`; `tests/cli/policy/read/tools.test.ts:68-75`
- Kind: delete
- Problem: The two lists restate which tools in `policy/schema/tools.ts` take extra tool options (the key `verbatim`
  today, `extra` in the final `gspot.toml`): a snapshot of the source, not a test. `NO_VERBATIM_TOOL_NAMES` also mixes
  in `basedpyright` and `jest`, which are not keys of the tools table, so they fail as "unknown tool".
  `UNSUPPORTED_PYTHON_OPTIONS` has 7 rows but only 2 outcomes.
- Fix: Delete both lists, the applicability test, `UNSUPPORTED_PYTHON_OPTIONS` and its test, the extra-options
  assertions of the commitlint, yamllint, and markdownlint tests, and the lychee row. Keep one row that accepts an
  extra table (prettier) and one that refuses it (yamllint) in `PUBLISHED_SCHEMA_CASES`.
- Size: small

### TPP-005: Rule-option refusals for ESLint, Markdown, and Stylelint are tested twice or more with the same input

- Where: `tests/config/cli/policy/schema/cases.ts:50-58`, `:67-84`, `:95-106`; `tests/cli/policy/read/tools.test.ts:38-87`;
  `tests/config/cli/policy/read/tools.ts:2-22`; `tests/cli/parsers/setting-values.test.ts:39-56`; `tests/cli/policy/key-paths.test.ts:95-110`
- Kind: delete
- Problem: The Stylelint row in `cases.ts` and `read/tools.test.ts:79-87` use the same input. MD041 = true, MD045 =
  false, and `default = {}` appear in `cases.ts` and in `MARKDOWNLINT_REJECTED_SELECTIONS`. ESLint severity refusal is
  checked in four files. All of them run through the rule-option schemas of `policy/schema/tools.ts:31-121`.
- Fix: Delete the `cases.ts` rows at 50-58, 67-84, and 95-106, `setting-values.test.ts:39-56`, and
  `key-paths.test.ts:95-110`. Each refusal branch is tested once, in `REFUSED_RULE_OPTIONS` (ST3-011).
- Size: small

### TPP-006: Three tool-rule test files copy the same loop

- Where: `tests/cli/policy/read/commitlint.test.ts`, `read/yamllint.test.ts`, `read/tools.test.ts`,
  `read/settings.test.ts:158-167` (`DISABLED_RULES`); `tests/config/cli/policy/read/{commitlint,yamllint,tools}.ts`
- Kind: merge
- Problem: The loop `for (const scope of ['', '[scope."app"]\n'])` and the same `buildPolicy(...)`/`parseStrictPolicy`
  call shape are copied 9 times across these files. Commitlint and yamllint each get a whole test file and a whole
  data file for one test.
- Fix: One test, "$tool rule settings cannot turn rules on or off: $toml", in
  `tests/unit/cli/settings/schema/tools.test.ts`, reading one table, `REFUSED_RULE_OPTIONS` in
  `tests/config/settings/errors.ts`, that holds the ESLint, Markdown, Stylelint, ShellCheck, commitlint, yamllint, and
  `DISABLED_RULES` rows (ST3-011 cuts it to one row per branch). Delete `read/commitlint.test.ts`,
  `read/yamllint.test.ts`, and the three data files. Remove `__proto__` from the key loop at `read/tools.test.ts:92`
  first (ROOT-004), so the key does not move into the new file.
- Size: medium

### TPP-007: Every case is run twice, at the root and in a scope, in four different ways

- Where: manual scope rows in `tests/config/cli/policy/schema/cases.ts:18-27`, `:197-212`; `TOOL_SCHEMA_SCOPES` in
  `tests/cli/policy/schema.test.ts:174-211`; doubling with string replacement in `schema.test.ts:97-115`; the inline
  loops of TPP-006; `['', 'app'].map` in `read/tools.test.ts:11`, `schema.test.ts:74`, `read/settings.test.ts:191-195`
- Kind: simplify
- Problem: The scope prefix (`scope.app.`) in an error message comes from one place (`errorText` and `issueLines`).
  Running every case twice tests that one place hundreds of times. Four ways to do it make the tests hard to read, and
  the string-replace trick in `schema.test.ts:109-111` rewrites expected messages, which can hide mistakes.
- Fix: Remove the scope doubling from every table and loop, and delete the manual scope rows, `TOOL_SCHEMA_SCOPES`,
  and the string replacement. The scope prefix is checked once, by the inline `[[scope]]` row of the key-path test in
  `tests/unit/cli/settings/read.test.ts`.
- Size: medium

### TPP-008: The relative-path check is tested in 4 places, on keys that share one schema

- Where: `tests/cli/policy/read/boundaries.test.ts:9-26`; `tests/cli/policy/schema.test.ts:165-172`;
  `tests/cli/policy/read/settings.test.ts:191-227` with `tests/config/cli/policy/read/settings.ts:41-47`;
  `tests/cli/parsers/setting-values.test.ts:104-124`
- Kind: delete
- Problem: All of these test the one `relativePath` schema. `schema.test.ts:165-172` runs the same 8 bad paths on
  `agent_rules.own_rules_folder` that `boundaries.test.ts` already runs. `PATH_SETTINGS` runs 5 settings × 2 levels × 2
  scopes × 8 or 9 paths (about 180 parses), but the level never changes how a path is checked. The boundaries test
  itself runs its 8 paths on four keys; three of them (`agent_rules.folder`, `agent_rules.own_rules_folder`,
  `architecture.roles.test_harness`) use the same schema, and all three are deleted keys (TML-001, TML-003).
- Fix: Keep the boundaries test with its 8 paths on the `[[scope]]` `path` only, as "$where refuses the path $path" in
  `tests/unit/cli/settings/schema/parts.test.ts` (rows `UNSAFE_DIRECTORIES` in `tests/config/settings/schema.ts`).
  Delete `schema.test.ts:165-172`, the `PATH_SETTINGS` test and data, and `setting-values.test.ts` (POL-001).
- Size: small

### TPP-009: Reason checks are duplicated

- Where: `tests/config/cli/policy/read/settings.ts:30-35` with `read/settings.test.ts:35-47` (`MALFORMED_REASON_CASES`);
  `tests/config/cli/policy/schema/cases.ts:8-27`; `tests/config/cli/policy/schema/exceptions.ts:113-131` (words rows);
  `tests/cli/policy/settings/known.test.ts:26-46`
- Kind: delete
- Problem: "A reason must be text" is tested in two files with the same inputs, and only restates the string type of
  a reason, a plain zod line. "A word needs a text reason" is tested in two more.
- Fix: Delete the `MALFORMED_REASON_CASES` test and data, `cases.ts:8-27`, the two words rows, and the tests "spelling
  accepts the reason %s" and "spelling refuses a word without a string reason". Keep one test, "a word with the
  reason %s is refused" (rows `''` and `'because'`), in `tests/unit/cli/settings/errors/reasons.test.ts`; it writes
  `allowed_words = { value = ["Codex"], reason = ... }`.
- Size: small

### TPP-010: Small duplicate tests inside the settings tests

- Where: `tests/cli/policy/read/settings.test.ts:117-120` and `tests/cli/policy/file.test.ts:163-168` (missing
  gspot.toml); `read/settings.test.ts:77-88` and `key-paths.test.ts:10-16`, `:39-42` with `tests/config/cli/policy/key-paths.ts:2-10`
  (an ESLint rule turned off in a scope); `read/recovery.test.ts:93-99` and `key-paths.test.ts:18-26`, `:87-90` (TOML
  syntax error); `read/settings.test.ts:122-131` and `tests/cli/parsers/configurations/checks.test.ts:31-40` and
  `cases.ts:131-147` (empty command)
- Kind: delete
- Problem: Same input, same code path, different file. Each pair checks the same message from the same function.
- Fix: Delete `read/settings.test.ts:117-120`. Move the fix assertion of `key-paths.test.ts:14-15` into the test
  "turning off an ESLint rule in a scope points to gspot ignore" (`tests/unit/cli/settings/schema/tools.test.ts`) and
  delete `SEMANTIC_KEY_PATH_CASES` with `semanticErrors`. Delete `recovery.test.ts:93-99`. Delete
  `read/settings.test.ts:122-131` and `checks.test.ts:31-40`; the three command rows of `cases.ts` stay in
  `PUBLISHED_SCHEMA_CASES`, where they also check the published `prefixItems`.
- Size: small

### TPP-011: A test checks that generated setting schemas are fresh

- Where: `tests/cli/parsers/setting-values.test.ts:58-68`
- Kind: delete
- Problem: The test regenerates `packages/cli/src/policy/schema/native/*.ts` in memory, formats it twice with Prettier,
  and compares it with the file on disk, a second copy of `bun scripts/setting-values.ts --check` with its own copy of
  the workaround that runs Prettier twice. POL-001 deletes the setting-schema compiler and the generated schemas.
- Fix: Delete the test with the rest of `setting-values.test.ts`.
- Size: small

### TPP-012: Two tests police the shipped configuration manifests instead of testing code

- Where: `tests/cli/parsers/configurations/checks.test.ts:53-73`; `tests/cli/parsers/configurations/declarations.test.ts:175-181`
- Kind: delete
- Problem: "every tool named by a manifest command is declared by a shipped configuration" and "every shipped setting
  declares a default" walk every shipped manifest and check a house rule ("every X has a Y"). That is self-policing.
- Fix: Delete both tests.
- Size: small

### TPP-013: Tests of third-party libraries instead of gspot code

- Where: `tests/cli/parsers/json.test.ts:5-12`, `:19-22`; `tests/cli/parsers/jsonc.test.ts:11-14`;
  `tests/cli/parsers/sql/pg.test.ts:8-17`, `:25-29`; `tests/cli/policy/expiry.test.ts:29-45`, `:47-51`; the calendar
  rows of `tests/config/cli/policy/expiry.ts:7-9`, `:15-32`
- Kind: delete
- Problem: These test that `JSON.parse`, Bun's parse error text, jsonc-parser, libpg-query, Ajv, zod `iso.date()`, and
  smol-toml work. The gspot code on these paths is one or two lines, and other tests in the same files already cover
  those lines.
- Fix: Delete the listed tests and rows, and `INVALID_JSON`, `JSONC_ENTRIES`, and `tests/config/cli/parsers/pg.ts`.
  Keep `json.test.ts:14-17` (non-object refusal), `jsonc.test.ts:6-9` (error text), and `pg.test.ts:19-23` (empty
  SQL), which moves to `tests/unit/cli/parsers/sql/postgres.test.ts`; delete `pg.test.ts`. In the until-date rows
  (`UNTIL_DATE_CASES` in `tests/config/settings/schema.ts`), keep 1 valid date and the "not a date" rows (quoted,
  datetimes, time). `ignore --until` stays, so `parseExpiryDate` stays; only its library test goes.
- Size: small

### TPP-016: Tests that only restate a zod schema line

- Where: `tests/cli/parsers/configurations/declarations.test.ts:34-43`, `:84-91`, `:183-195`, `:197-207`, `:221-234`;
  `tests/cli/parsers/configurations/checks.test.ts:75-98`; `tests/cli/policy/schema.test.ts:36-48`;
  `tests/config/cli/policy/schema/cases.ts:112-130`; `tests/cli/policy/public-shape.test.ts:160-166`
- Kind: delete
- Problem: Each of these proves that `z.string().min(1)`, `z.enum([...])`, `z.strictObject`, or
  `z.number().int().min(1).max(255)` work. They copy the schema into the test (the direction test lists every enum
  value), so a schema change means a test change with no bug found. Several also use a bare `toThrow()`.
- Fix: Delete these tests and rows. Keep the tests of gspot's own refinements: `isIgnoredPath`, the regex check of
  `crash_pattern`, `{rule}` in `rule_url`, companion tools, and checks that run in a scratch copy, in
  `tests/unit/cli/configurations/manifests.test.ts`.
- Size: small

### TPP-017: A test of a mock, and a test of call counts

- Where: `tests/cli/parsers/tree-sitter.test.ts:42-45`, `:47-74`
- Kind: delete
- Problem: The first test forces the tree-sitter parser to return `null` with `spyOn(...).mockReturnValue(null)` to
  reach a guard. The library returns `null` only without a grammar or when a progress callback stops the parse; gspot
  sets the grammar right before it parses and passes no callback, so the state cannot happen. The second test asserts
  that `Tree.prototype.delete` is called exactly 1, 2, and 5 times with no explanation of the counts.
- Fix: Delete both tests. Keep the guard: the TypeScript type needs it.
- Size: small

### TPP-018: A weaker copy of the next assertion

- Where: `tests/cli/parsers/toml.test.ts:40`
- Kind: delete
- Problem: `.toThrow()` with no message passes on any crash, and the next line already asserts the message. The other
  bare `toThrow()` tests of these folders go with TPP-016 and POL-001.
- Fix: Delete `toml.test.ts:40`.
- Size: small

### TPP-019: The Wrangler tests re-run the JSON-with-comments inputs

- Where: `tests/cli/parsers/jsonc.test.ts:16-31`
- Kind: delete
- Problem: 7 Wrangler cases re-run the JSON-with-comments inputs, but `parseWrangler` adds only a TOML branch and the
  "not an object" message. The first loop repeats the JSON-with-comments test; the second only re-runs its inputs and
  misses the TOML branch.
- Fix: Delete both loops. Merge `json.test.ts` and `jsonc.test.ts` into `tests/unit/cli/parsers/json.test.ts`
  (`parseJsonc` lives in `parsers/json.ts`). Whether the TOML branch needs a test is for the "Untested logic" rule after
  the code is cut.
- Size: small

### TPP-020: Integration-style tests sit in the parser and settings folders

- Where: `tests/cli/parsers/output/declared-checks.test.ts:59-131` (3 of 4 tests run the gspot CLI through
  `checkReport`); `tests/cli/policy/settings/view.test.ts:65-102` (check replacement through `planRun`), `:223-247`
  (Xcode file selection)
- Kind: move
- Problem: These test running command checks and planning, not the parser or the settings reader. They run whole
  commands, and a reader looking for those tests will not find them here.
- Fix: Move `declared-checks.test.ts` to the command check tests: the run tests to
  `tests/unit/cli/execution/command/check.test.ts`, the reported-files test to `execution/command/output.test.ts`
  (rows `SARIF_LOCATION_CASES` and the notes script in `tests/config/output.ts` and `tests/config/execution.ts`). Move
  `view.test.ts:65-102` and `:223-247` to `tests/unit/cli/planning/checks.test.ts`. The OpenAPI tests of `view.test.ts`
  are deleted (ST3-009).
- Size: medium

### TPP-021: Tests in the wrong owner folder

- Where: `tests/cli/parsers/configurations/checks.test.ts`, `declarations.test.ts`; `tests/cli/parsers/settings.test.ts`,
  `setting-values.test.ts`; `tests/cli/parsers/swift/coverage.test.ts:23-30`; `tests/cli/policy/schema.test.ts:213-235`
- Kind: move
- Problem: A reader looks for a test next to the code it tests. These sit in `parsers/` or `policy/` but test other
  code: `parseManifest` and `assertManifests`, the setting-schema compiler, `coverageShortfalls` of the Swift tests
  check, and the docs reference page.
- Fix: The two manifest test files go to `tests/unit/cli/configurations/manifests.test.ts` (`parseManifest` in
  `configurations/manifests.ts`); their `assertManifests` test (`checks.test.ts:100-110`) is deleted, because
  `assertManifests` moves to the build-time `scripts/manifests.ts`, which has no tests. `settings.test.ts` and
  `setting-values.test.ts` are deleted with the setting-schema compiler (POL-001). The Swift coverage test goes to
  `tests/unit/cli/checks/testing/swift-tests.test.ts`. The schema examples test (`schema.test.ts:213-217`) stays in
  `tests/unit/cli/settings/schema/gspot-toml.test.ts`; `schema.test.ts:219-235`, which tests the docs reference page,
  is deleted (no suite tests the docs site).
- Size: medium

### TPP-022: The mirrored `config/` and `types/` folders split each test from its data

- Where: all 23 files in `tests/config/cli/parsers/`, all 17 files in `tests/config/cli/policy/`,
  `tests/types/cli/parsers.ts`, `tests/types/cli/policy/{expiry,file,schema}.ts`
- Kind: merge
- Problem: 44 files hold data and types for 49 test files, in a copy of the test tree. A reader opens two or three
  files to understand one test. Several data files are 1 to 13 lines. Of the 106 exported names in these files, 89 are
  imported by exactly one other file, and 5 by none (TTC-037).
- Fix: Move the data to topic files by subject: `tests/config/settings/errors.ts` (key paths, unknown keys, refused
  rule options), `settings/file.ts` (writing gspot.toml), `settings/schema.ts` (published schema cases, until dates,
  unsafe folders, the command check), `settings/scopes.ts`, and `comments.ts`, `git.ts`, `output.ts`, `markdown.ts`,
  `spelling.ts`, `knip.ts`, `semgrep.ts`, `formatting.ts`, `nextjs.ts`, `nginx.ts`, `npm.ts`, `sql.ts`,
  `structure.ts`, `swift.ts`, `tools.ts`, `xcode.ts`, `expo.ts`, `generated-files.ts`, `configurations.ts`,
  `bash/checks.ts`. A single short literal used by one test file (`NON_RECORD_JSON`, `TYPED_DECLARATION`,
  `SECURITY_DECLARATION`, `TOOL_DECLARATION`, `TEMPLATE`) and tables built from code at import time (the
  `win32.normalize` rows, the template address rows, `examples`, `validate`, `known`) stay in their test file. Rows are
  written `as const`. Delete `tests/types/cli/parsers.ts` and `tests/types/cli/policy/`.
- Size: large

### TPP-027: `policyFindings` returns errors, not findings

- Where: `tests/harness/policy.ts:26`; 35 calls in these tests
- Kind: rename
- Problem: In the glossary a finding is one problem a check reports, and a bad `gspot.toml` gives errors. This helper
  returns the error messages of a bad `gspot.toml`, so its name mixes the two.
- Fix: Rename it to `settingsErrors` (in `tests/setup/settings.ts`) and update the 35 call sites.
- Size: small

### TPP-030: `public-shape.test.ts` is the largest file and its name says nothing

- Where: `tests/cli/policy/public-shape.test.ts` (320 lines, 16 tests), `tests/config/cli/policy/public-shape.ts`
- Kind: move
- Problem: "Public shape" does not tell a reader what is tested. The file mixes scope maps, path origins, hooks,
  reasons, architecture modules and roles, and test roles.
- Fix: Move each kept test to the file of the source that does its job: the defaults test to
  `tests/unit/cli/settings/normalize.test.ts`, the module-import test to `settings/schema/architecture.test.ts`, the
  configuration-role test to `settings/errors/keys.test.ts`, the dropped-defaults test to
  `settings/drop-defaults.test.ts`, and "a tool option named reason is passed on and is not a gspot reason" to
  `settings/errors/reasons.test.ts`. Delete the history tests (TPP-003), the scope map and path-origin tests (CFR-003,
  TML-010), the hooks duplicate, the reasons-table test (CFR-002), the role misspelling test (TPP-016), the shipped
  role glob test (ST3-008), the test-role test (TML-001), and the `declaredArchitectures` test (POL-024). Delete
  `public-shape.test.ts` and its data file.
- Size: medium

### TPP-031: File names that do not say what the file tests

- Where: `tests/cli/parsers/command.test.ts`, `output/contract.test.ts`, `eslint-schema.test.ts`, `tool/tool-file.test.ts`, `statements.test.ts`,
  `naming.test.ts`; `tests/cli/policy/file.test.ts`, `key-paths.test.ts`, `read/recovery.test.ts`,
  `settings/known.test.ts`; `tests/config/cli/policy/settings.ts`, `tests/config/cli/policy/schema/exceptions.ts`;
  `tests/config/cli/parsers/statements.ts`
- Kind: rename
- Problem: A newcomer cannot guess the subject from the name, and two files are both called `statements.test.ts` for
  different things (statement counting for trivial files, and SQL statements).
- Fix: Name each test file after the source file it tests:
    - `parsers/command.test.ts` (Next.js build flags) and `parsers/nextjs.test.ts` →
      `tests/unit/cli/checks/framework/nextjs.test.ts` (`parseNextBuildFlags` moves with `nextSettingsFindings` into the
      check)

    - `parsers/eslint-schema.test.ts` → deleted (the preset capture moves to `scripts/`, whose tests go)
    - `parsers/tool/tool-file.test.ts` (INI sections) → `tests/unit/cli/repository/tooling/files.test.ts`
    - `parsers/statements.test.ts` → `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`, because
      `executableStatements` and `isTrivialFile` move into that check (S08-002); same test names; its tables go to
      `tests/config/structure.ts` (`TRIVIAL_FILES`, `STATEMENT_COUNT_CASES`, `PACKAGE_DOCSTRING_CASES`)

    - `parsers/naming.test.ts` (SQL identifiers) → `tests/unit/cli/checks/general/naming/sql.test.ts`
    - `parsers/output/contract.test.ts` (its cases are "empty" and "foreign") → joins `tests/unit/cli/parsers/output/formats.test.ts`
    - `policy/file.test.ts` → split by source file into `tests/unit/cli/settings/{file,layout,comments,drop-defaults,edit}.test.ts`
    - `policy/key-paths.test.ts` → `tests/unit/cli/settings/read.test.ts`
    - `policy/read/recovery.test.ts` → split into `settings/errors/{reasons,keys}.test.ts` and `settings/read.test.ts`
    - `policy/settings/known.test.ts` → `tests/unit/cli/settings/inherit.test.ts`
    - `tests/config/cli/policy/settings.ts` → `NESTED_SCOPE_SETTINGS` in `tests/config/settings/scopes.ts`
    - `tests/config/cli/policy/schema/exceptions.ts` ("exception" is retired) → merged into `PUBLISHED_SCHEMA_CASES`

- Size: small

### TPP-033: Titles that say something different from what the test checks

- Where: `tests/cli/policy/file.test.ts:92` 'policy edits retain invalid UTF-8 bytes' (the edit is refused and the
  file is unchanged); `tests/cli/policy/read/commitlint.test.ts:6`, `read/yamllint.test.ts:6`, `read/tools.test.ts:23`
  ("keeps ... coverage", but they check refusals)
- Kind: rewrite-text
- Problem: A title that says the opposite of the assertion misleads the reader.
- Fix: Rename the first to 'an edit of a file with invalid UTF-8 is refused and the file is unchanged'. The three tool
  tests become the one table "$tool rule settings cannot turn rules on or off: $toml" (TPP-006). The other mismatched
  titles belong to deleted tests (`jsonc.test.ts:12`, TPP-013; `declarations.test.ts:34`, TPP-016;
  `templates/export.test.ts:121`, TML-011).
- Size: small

### TPP-035: The platform skip has a wrong comment

- Where: `tests/cli/parsers/output/formats.test.ts:143-144`; `tests/cli/policy/templates/sources.test.ts:30`
- Kind: rewrite-text
- Problem: Both exceptions are needed: the first test needs a file system that ignores case (true on macOS and
  Windows, false on Linux); the second must hand a plain `http://` address to prove it is refused, so it keeps its
  `eslint-disable-next-line unicorn/prefer-https`. But the comment of the first talks about the drive letter, while
  the test changes the case of the whole path.
- Fix: Keep both. Rewrite the comment at line 143: "Windows and macOS file systems ignore case, so a tool can print the
  root in another case. Linux file systems do not." (IGN-002 removes the path from the semicolon ignore.)
- Size: small

### TPP-036: The same "find a shipped check by name" code is copied 4 times here (22 times in all tests)

- Where: `tests/cli/parsers/output/formats.test.ts:212-216`, `output/knip.test.ts:8-10`, `output/semgrep.test.ts:11-12`, `:46-47`
- Kind: simplify
- Problem: Each copy does `configurationManifests().get(x)!.checks.find((check) => check.name === y)!`. The source
  already has a function for this: `allChecks(manifests)` returns a map from check ID to `{ check, configuration }`.
- Fix: Use `allChecks(configurationManifests().values()).get('security/semgrep')!.check` and delete the local
  `configurationCheck` helper.
- Size: small

### TPP-037: The same "checkedFindings equals parseOutput" assertion is repeated in each format test

- Where: `tests/cli/parsers/output/formats.test.ts:52-58`, `:71-77`, `:92-98`, `:134-140`
- Kind: delete
- Problem: Each format test also asserts that `checkedFindings` returns the same as `parseOutput`. That is one property
  of `checkedFindings`, repeated per format.
- Fix: Keep it once, in the ShellCheck test, and delete the other copies (the xmllint test goes whole, ST3-001).
- Size: small

### TPP-039: The "published schema agrees with the runtime" table is bigger than its purpose

- Where: `tests/cli/policy/schema.test.ts:93-123`, `:174-190`; `tests/config/cli/policy/schema/{cases,fields,naming,tools}.ts`
- Kind: simplify
- Problem: The published JSON schema is made from the same zod schema by `z.toJSONSchema`. For plain zod types the two
  always agree, so most of the about 95 cases test zod's converter. Agreement matters only where gspot adds a
  hand-written `.meta()` or a refinement that JSON Schema cannot express.
- Fix: After TPP-002 to TPP-009, keep only the rows of fields with a refinement or a hand-written `.meta()`: the empty
  command, program, and argument; the format override without a setting; the `[[licenses.allowed_package]]` record
  with `name` and `version`; the SQLFluff dialect with a newline. Put them in one table, `PUBLISHED_SCHEMA_CASES` in
  `tests/config/settings/schema.ts`, for "runtime and published schemas agree on $name" in
  `tests/unit/cli/settings/schema/gspot-toml.test.ts`. Delete `fields.ts` and `naming.ts` (TML-005).
- Size: medium

### TPP-040: Three small schema tests repeat what other tests do

- Where: `tests/cli/parsers/setting-values.test.ts:28-37`, `:70-102`; `tests/cli/policy/schema.test.ts:50-91`
- Kind: delete
- Problem: The first two parse objects with the generated zod schemas and pin their full field lists, which change
  whenever a manifest changes. The third tests the prototype-key concern in four tables, while the rule-key test of
  `read/tools.test.ts:89-110` already tests such keys through the real reader, and check names become plain values
  (POL-004, POL-007).
- Fix: Delete all three (the first two with `setting-values.test.ts`, POL-001).
- Size: small

### TPP-041: The Python and Swift parse-cache tests check internal call counts

- Where: `tests/cli/parsers/tree-sitter.test.ts:47-74`, `:105-183`
- Kind: delete
- Problem: These tests spy on `Tree.prototype.delete` and `parser.parse` and assert exact call counts across a chain of
  cache steps. They test how the cache is built, not what it returns. The same flow is written twice (lines 115-150
  and 151-183) and run for both languages.
- Fix: Keep one test, "a second visit with the same files returns the same value" (`:76-102`, Python only), in
  `tests/unit/cli/parsers/tree-sitter.test.ts`. Delete the failed-read test, the two-language tests, the dispose test,
  `disposeObservations`, and `observations`.
- Size: medium

### TPP-042: SQL identifier positions are tested in two files

- Where: `tests/cli/parsers/naming.test.ts:25-32`, `tests/cli/parsers/sql/statements.test.ts:8-34`
- Kind: merge
- Problem: Both check the line and column output of `sqlIdentifiers` (psql input in one, plain SQL in the other). The
  second test also mixes the parse cache, the error text, and a fixed parse in one 27-line test.
- Fix: Move the identifier assertions of `sql/statements.test.ts:8-34` into
  `tests/unit/cli/checks/general/naming/sql.test.ts` (where `sqlIdentifiers` lives), and keep the cache part as its own
  short test in `tests/unit/cli/parsers/sql/postgres.test.ts`. Do after TCG-025, which gathers the name tests of the
  naming check.
- Size: small

### TPP-043: The link refusal tests of a gspot.toml edit are three copies of one idea

- Where: `tests/cli/policy/edit.test.ts:31-45` (link to a file outside the repository), `tests/cli/policy/file.test.ts:192-205`
  (link inside it), `:207-230` (hard link)
- Kind: merge
- Problem: All three check that an edit of a linked `gspot.toml` is refused with "private regular file" and that the
  target is unchanged.
- Fix: One `test.each` over the three link kinds, "an edit of a gspot.toml that is a link is refused and the link
  target is unchanged", in `tests/unit/cli/settings/file.test.ts`.
- Size: small

### TPP-044: Reason text inside test data is wordy

- Where: reason strings across `tests/config/cli/policy/**` and the settings tests, for example 'The sandbox supplies a
  substantive option explanation.' (`schema/tools.ts:102`, `:117`, `:126`), 'Exercise the native rule-selection
  refusal.' (`read/recovery.test.ts:17`)
- Kind: rewrite-text
- Problem: Long made-up sentences hide what matters in the row. A reason only has to be a valid reason.
- Fix: Use one short reason that meets the two-word minimum (`REASON_WORDS_MIN = 2`, so 'Reviewed.' alone is refused),
  for example `'Reviewed in tests.'`, written once in each test data file.
- Size: small

### TPP-045: Comment lines in tests that restate the title

- Where: `tests/cli/parsers/lockfiles.test.ts:1`, `tests/cli/parsers/output/contract.test.ts:1`,
  `tests/cli/policy/settings/view.test.ts:1`, `:14`, `tests/cli/policy/templates/export.test.ts:1`,
  `tests/cli/policy/templates/sources.test.ts:1`, and the one-line doc comments on data constants in
  `tests/config/cli/**` (for example `tree-sitter.ts:5`, `:13`)
- Kind: delete
- Problem: The header comments repeat the test titles in other words, and the doc comments on data constants describe
  test intent in jargon.
- Fix: Delete the header comments that repeat the titles. When the data moves to `tests/config/<topic>.ts`, drop each
  doc comment that says nothing the title does not.
- Size: small

### ST3-001: The xmllint CRLF test repeats the ShellCheck CRLF row

- Where: `tests/cli/parsers/output/formats.test.ts:61-78`
- Kind: delete
- Problem: Both tests give output of a check with the `regex` output format that ends in CRLF and expect one finding:
  `bash/shellcheck` and `files/xmllint` both declare `output = { format = "regex", ... }`, so the CRLF row of the
  ShellCheck test runs the same line splitter. The xmllint test also repeats the `checkedFindings` copy (TPP-037).
- Fix: Delete the xmllint test.
- Size: small

### ST3-002: The EditorConfig CRLF row repeats the grouped-format CRLF test

- Where: `tests/cli/parsers/output/formats.test.ts:120-141`
- Kind: delete
- Problem: EditorConfig output uses the `grouped` format. The test at `formats.test.ts:109-118` already gives grouped
  output with CRLF line endings, so the LF/CRLF table doubles the EditorConfig test for that one property.
- Fix: Delete the CRLF row and run the EditorConfig test once, with LF, as a plain test.
- Size: small

### ST3-004: One-row tables left after deletions

- Where: `tests/cli/execution/scopes.test.ts:85-123` (the `html/template-text` test, after its Supabase row goes);
  `tests/cli/parsers/jsonc.test.ts:7-9` with `JSONC_FAILURES`; `tests/cli/policy/key-paths.test.ts:92` (link to a
  folder outside the repository)
- Kind: simplify
- Problem: A `test.each` with one row is a plain test with extra indirection.
- Fix: Write each as a plain test with its values in the body: "html/template-text skips the paths of its templates
  setting" in `tests/unit/cli/checks/language/html.test.ts`, "JSON with comments names the error offset" in
  `tests/unit/cli/parsers/json.test.ts`, and "a scope path through a link to a folder outside the repository is
  refused" in `tests/unit/cli/settings/read.test.ts`.
- Size: small

### ST3-007: The mode-change refusal of a gspot.toml edit repeats two other tests

- Where: `tests/cli/policy/file.test.ts:66-93` (`refusesMode` and its test)
- Kind: delete
- Problem: A mode change after the read is refused by the same expected-file check of the writer as a byte change. The
  settings caller is covered by "an edit planned from old bytes is refused, and a new plan is accepted", and the
  writer's mode check by the `mode` row of "a stale read of ${name} refuses replacement and removal".
- Fix: Delete the test and its hoisted body.
- Size: small

### ST3-008: The configuration role test copies shipped role globs

- Where: `tests/cli/policy/public-shape.test.ts:168-183`
- Kind: delete
- Problem: The expected values are the `scripts` and `stores` globs copied from the shipped javascript and zustand
  manifests, so a manifest edit breaks the test with no bug. It is a copy of data, not a check of behavior.
- Fix: Delete it. No replacement test is planned; the "Untested logic" rule decides after the code is cut whether a
  role that a configuration declares needs one.
- Size: small

### ST3-009: The OpenAPI tests test check-time detection, which goes

- Where: `tests/cli/policy/settings/view.test.ts:156-187` (`OPENAPI_DOCUMENTS`, `OPENAPI_PATH_CASES`);
  `tests/config/cli/policy/settings.ts:35-53`
- Kind: delete
- Problem: Five rows, one per name in the source's detection list, test one lookup, and the list is a copy of the
  source list. The path test uses `document = ""` as an off value. TML-010 moves OpenAPI detection into `gspot init`
  (it writes `openapi.document` with the file it finds), so nothing is detected at check time and an empty string is
  no longer an off value.
- Fix: Delete both tests, `OPENAPI_DOCUMENTS`, and `OPENAPI_PATH_CASES`. The test "OpenAPI stays off without a document
  and in a scope that removes it" stays in `tests/unit/cli/settings/view.test.ts`.
- Size: small

### ST3-010: Key-path cases vary only the TOML spelling

- Where: `tests/cli/policy/key-paths.test.ts:44-85`; `tests/config/cli/policy/key-paths.ts:12-48` (`SCHEMA_KEY_PATH_CASES`)
- Kind: delete
- Problem: A quoted key, an inline table, and a multi-line array all parse to the same plain object, and the key path
  comes from the zod issue path in one place (`issueLines`). Six rows test that one place.
- Fix: Keep one row, the multi-line array index (`configurations.1`), as `KEY_PATH_CASES` in
  `tests/config/settings/errors.ts`, for "an error names the key path of $name, and the fix clears it" in
  `tests/unit/cli/settings/read.test.ts`. The scope prefix is checked by the inline `[[scope]]` row of the same test;
  the row with a record list under a scope goes, because record lists are refused in a scope (CFR-004).
- Size: small

### ST3-011: The rule-option refusal table repeats one zod branch many times

- Where: the merged rule table of TPP-006 (`tests/config/cli/policy/read/{commitlint,settings,tools,yamllint}.ts`;
  `tests/cli/policy/read/tools.test.ts:89-110`)
- Kind: delete
- Problem: 8 ESLint values fail the same `eslintOptions` union with one message, 7 commitlint values the same tuple, 7
  Markdown values two branches (key and value), 8 YAML values one message. The prototype-key test runs the same zod
  record for three tools.
- Fix: One row per refusal branch: ESLint `"error"`; Markdown `MD041 = true` and `default = {}`; commitlint `0`; YAML
  `truthy = true` and `truthy = { ignore = "**" }`; Stylelint `severity = "warning"`; ShellCheck `disable = "SC2086"`;
  the two `DISABLED_RULES` rows. They are `REFUSED_RULE_OPTIONS` in `tests/config/settings/errors.ts`. The
  prototype-key test keeps commitlint only, with the keys ordinary, constructor, prototype, and toString.
- Size: small

### ST3-013: Smaller tables with rows that reach the same branch

- Where: `tests/cli/lifecycle/ownership/json.test.ts:86` (`'false'`); `tests/cli/parsers/git.test.ts:72` (stages 2 and
  3); `tests/cli/parsers/json.test.ts:15-17` (`'true'`, `'"text"'`); `tests/cli/parsers/output/json.test.ts:42-47`
  (fix field `object`, `null`), `:104-110` (`'fatal error'`, `'{}'`); `tests/config/cli/policy/expiry.ts`
  (`offset timezone`); `tests/cli/policy/key-paths.test.ts:92` (`linked/nested`)
- Kind: delete
- Problem: Each named row reaches the same code branch as a row that stays. For example `parseJson` fails both `''` and
  `'fatal error'` at `stdout.search(/[[{]/u) === -1`, and a fix field counts as present for any value but `undefined`.
- Fix: Drop the named rows. What stays: the package.json texts `''`, `'[]'`, `'{"stylelint":'` and the comment row;
  stages `[0, 1]`; `NON_RECORD_JSON` `['null', '[]', '42']`; the fix rows `absent` and `false`; the report rows `''`,
  `'{ broken'` and `'{"items":null}'`; the until dates without the offset-timezone row; the one `linked` scope path.
- Size: small

### ST3-014: Report-error rows repeat the output-format contract test

- Where: `tests/config/cli/parsers/output/formats.ts:27-124` (`REPORT_ERRORS`); `tests/config/cli/parsers/output/knip.ts:62-71`
  (`INVALID_KNIP_REPORTS`); `tests/cli/parsers/output/semgrep.test.ts:44-72`
- Kind: delete
- Problem: The format contract test (kept, in `tests/unit/cli/parsers/output/formats.test.ts`) already refuses empty
  output and other-tool output for every JSON format. The markdown `empty report` and `non-JSON text` rows, the
  spelling `unfinished JSON` row, the knip `not JSON` row, and the Semgrep `''` and `not JSON` entries repeat it; the
  spelling `large offset` row repeats `outside offset`.
- Fix: Delete those rows. The rest go to `tests/config/markdown.ts` (`MARKDOWNLINT_REPORT_ERRORS`),
  `tests/config/spelling.ts` (`TYPOS_REPORT_ERRORS`), and `tests/config/knip.ts`, read by
  `parsers/output/markdownlint.test.ts`, `typos.test.ts`, and `knip.test.ts`.
- Size: small
