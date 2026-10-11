# Tests: the general checks

491 rows. move 167, keep 147, delete 141, split 19, inline 11, merge 6.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/checks/general/dependencies/lockfile-fresh.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/dependencies/stale-lockfile.test.ts`. TCG-047; NMU-023; CKG-031 (source becomes checks/general/dependencies/stale-lockfile.ts)
- frozen installation reports $failure as inability, preserves the repository, and retries successfully (test (test.each), 14-65): **keep** to `tests/unit/cli/checks/general/dependencies/stale-lockfile.test.ts` `a failed frozen install leaves the repository unchanged and passes on retry`. TCG-010: only the 'unexpected' row stays, written as a plain test; TTC-032 title; TCG-060 drop skips: \[\]
- \[ { failure: 'missing', note: 'could not be started' }, { failure: 'deadline', note: 'ran past' }, { failure (test (test.each), 14-19): **delete**. duplicate (TCG-010: the missing, deadline and cancellation rows repeat the shared tool-failure handling tested in tests/cli/execution/tool-runner/adapters.test.ts; the 'unexpected' row is the kept test's own case without a table)
- Yarn Berry preserves its lockfile with install --immutable (test (test), 67-98): **keep** to `tests/unit/cli/checks/general/dependencies/stale-lockfile.test.ts` `Yarn Berry runs install --immutable and leaves the lockfile unchanged`. real behavior; TTC-032 title; TCG-060 drop skips: \[\]
- %s frozen installs retain complete inputs only after a manifest changes (test (test.each), 100-136): **keep** to `tests/unit/cli/checks/general/dependencies/stale-lockfile.test.ts` `the scratch copy holds every scope's files and runs bun install --frozen-lockfile --dry-run`. TCG-017: trigger rules stay in the planning test; one run asserts the copied inputs and the exact command, and the untouched half goes; TGN-037; the sample writes a \[\[scope\]\] record with path = "app"
- \['recommended', 'all'\] as const (test (test.each), 100-100): **delete**. TGN-037: the level loop adds nothing; stale-lockfile runs at recommended

## `tests/cli/checks/general/dependencies/manifest-policy.test.ts`

- (the file) (file): **delete**. no test left (the reads test is weak, the ESLint ignore test is a duplicate, the alias test tests a third-party rule)
- manifest policy reads (describe (describe), 15-31): **delete**. TTC-039: a describe with one test
- manifest policy reads &gt; accepts an absent optional manifest and a valid manifest (test (test), 16-30): **delete**. weak (TCG-003: it only expects an empty list; no test makes the package-json check report anything)
- %s checks dependency pins with ESLint and preserves scoped path ignores (test (test.each), 33-81): **delete**. duplicate (TCG-018: ESLint path ignores on package.json are checked by tests/cli/generation/eslint/package-manifests.test.ts 'package rule exceptions retain neighboring violations' and eslint-ignores.test.ts 'ESLint overrides preserve order, nested scope bounds, future files, and path-specific ignores'; its last call only expects an empty list)
- \['recommended', 'all'\] as const (test (test.each), 33-33): **delete**. TCG-018; TGN-037: one level is enough
- $level native dependency pin rules retain registry alias $version (test (test.each), 83-114): **delete**. TCG-018: tests the third-party rule package-json/restrict-dependency-ranges (a library), not gspot
- REGISTRY_ALIASES.flatMap((version) =&gt; (\['recommended', 'all'\] as const).map((level) =&gt; ({ version, level }))) (test (test.each), 83-85): **delete**. TCG-018; TGN-037: rows of the deleted alias test
- DEPENDENCIES_POLICY (const, 13-13): **delete**. unused (only the deleted reads test used it)

## `tests/cli/checks/general/dependencies/policy.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/dependencies/bun-release-age.test.ts`. TCG-047: the kept tests are bun-release-age tests; TCG-033 delete the wrong header line
- the dependencies configuration (describe (describe), 13-32): **delete**. TCG-011: shared repository and describe go; TTC-039
- the dependencies configuration &gt; invalid manifest $files refuses execution and accepts a valid manifest (test (test.each), 23-31): **delete**. TCG-011: the parse error comes from readPackageManifests when the session opens, already tested in tests/cli/repository/package-manifests.test.ts
- the dependencies configuration &gt; INVALID (test (test.each), 23-23): **delete**. TCG-011: INVALID rows go with the test
- Bun policy reports a missing bunfig.toml for %s and passes after the fix (test (test.each), 34-57): **keep** to `tests/unit/cli/checks/general/dependencies/bun-release-age.test.ts` `a Bun lockfile (%s) without bunfig.toml reports release-age and passes after the fix`. real behavior; TCG-046 'fixture' text becomes 'sample'
- \['bun.lock', 'bun.lockb'\] (test (test.each), 34-34): **keep** to `tests/unit/cli/checks/general/dependencies/bun-release-age.test.ts` `['bun.lock', 'bun.lockb']`. both lockfile formats start the check
- Bun release-age policy reads each project scope and keeps findings inside the deficient scope (test (test), 59-85): **keep** to `tests/unit/cli/checks/general/dependencies/bun-release-age.test.ts` `each scope reads its own min_release_age_days and reports only its own bunfig.toml`. real behavior; TTC-032 title; the sample writes \[\[scope\]\] records with path, and apps/second sets the dotted key dependencies.min_release_age_days = 14
- private Bun tool lockfiles do not activate the repository release-age or advisory checks (test (test), 87-109): **keep** to `tests/unit/cli/checks/general/dependencies/bun-release-age.test.ts` `a lockfile under .gspot/ starts neither bun-release-age nor osv`. real behavior; plain title

## `tests/cli/checks/general/dependencies/version-pairs.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/version-pairs.test.ts`. TCG-059; CKG-033: the source moves to checks/framework/version-pairs.ts
- '${configuration} at ${scope || 'the root'}: $name' (test (test.each), 14-68): **keep** to `tests/unit/cli/checks/framework/version-pairs.test.ts` `$name`. TCG-019: one test.each over the 4 rows at the root; no configuration and scope loops; plain path, no backslashes; delete the selection assertion
- VERSION_PAIR_CASES (test (test.each), 14-14): **keep** to `tests/unit/cli/checks/framework/version-pairs.test.ts` `VERSION_PAIR_CASES`. TCG-019: the 4 rows come from tests/config/react.ts
- a child React project compares its hoisted installed packages (test (test), 70-85): **keep** to `tests/unit/cli/checks/framework/version-pairs.test.ts` `a child React project compares its hoisted installed packages`. real behavior (child scope); the sample writes a \[\[scope\]\] record with path = "app"
- %s dispatches its own installed pair through the public check command (test (test.each), 87-109): **keep** to `tests/unit/cli/checks/framework/version-pairs.test.ts` `%s/version-pairs reports different installed versions through gspot check`. one end-to-end run per registry line (TTC-029); plain title
- \['react', 'nextjs'\] (test (test.each), 87-87): **keep** to `tests/unit/cli/checks/framework/version-pairs.test.ts` `['react', 'nextjs']`. each registry line wires its own pairs

## `tests/cli/checks/general/docs/headings.test.ts`

- (the file) (file): **delete**. the TypeScript check docs/headings is deleted with its tests; the Vale style banned-headings keeps the rule
- ordinary README headings do not produce banned-heading findings (test (test), 9-19): **delete**. the TypeScript check docs/headings is deleted with its tests; the Vale style banned-headings keeps the rule
- setext and formatted headings count, while fenced headings do not (test (test), 21-37): **delete**. the TypeScript check docs/headings is deleted with its tests; the Vale style banned-headings keeps the rule

## `tests/cli/checks/general/docs/readme-shape.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/docs/readme-shape.test.ts; tests/unit/cli/checks/general/docs/required-files.test.ts`. TCG-047: the LICENSE tests are docs/required-files tests; the split keeps only the existing tests and adds no rows
- readme shape (describe (describe), 13-56): **delete**. TTC-039: the describe groups 4 of 8 tests of one check
- readme shape &gt; a README with one H1, an opening paragraph and a setup section passes (test (test), 14-23): **keep** to `tests/unit/cli/checks/general/docs/readme-shape.test.ts` `a README with one H1, an opening paragraph and a setup section passes`. real behavior; TCG-039 write gspot.toml in the file tree
- readme shape &gt; a README missing the pieces names each one (test (test), 25-33): **keep** to `tests/unit/cli/checks/general/docs/readme-shape.test.ts` `a README missing the pieces names each one`. real behavior
- readme shape &gt; setext and formatted headings count, while fenced headings do not (test (test), 34-45): **delete**. weak: it only expects no finding; it holds no formatted heading and checks nothing about fences
- readme shape &gt; a list before the setup section does not supply an opening paragraph (test (test), 47-55): **keep** to `tests/unit/cli/checks/general/docs/readme-shape.test.ts` `a list before the setup section does not count as an opening paragraph`. real behavior
- required repository documents identify a missing license and accept its restoration (test (test), 58-73): **move** to `tests/unit/cli/checks/general/docs/required-files.test.ts` `a root without LICENSE is reported and passes once LICENSE exists`. TCG-047: tests docs/required-files; TTC-032 title
- README presence accepts the repository license filename %s (test (test.each), 75-89): **move** to `tests/unit/cli/checks/general/docs/required-files.test.ts` `the license file %s counts as a LICENSE`. TCG-047
- \['COPYING', 'LICENCE', 'LICENSE-MIT', 'LICENSE-APACHE', 'LICENSE.rst'\] (test (test.each), 75-75): **move** to `tests/unit/cli/checks/general/docs/required-files.test.ts` `['COPYING', 'LICENCE', 'LICENSE-MIT', 'LICENSE.rst']`. rows move with the test; LICENSE-APACHE goes because it takes the same '-' branch of LICENSE_FILE as LICENSE-MIT (ST1-011)
- a NOTICE file does not supply the repository license (test (test), 91-102): **move** to `tests/unit/cli/checks/general/docs/required-files.test.ts` `a NOTICE file does not count as a LICENSE`. TCG-047
- README shape diagnostics give a valid reasoned exception command without changing policy on preview (test (test), 104-136): **delete**. TCG-015: checks a help string copied from the manifest and the ignore --dry-run preview (tested in commands/policy-preview.test.ts)

## `tests/cli/checks/general/docs/stale-paths.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts`. TCG-047; the check docs/stale-paths becomes docs/missing-paths; TCG-039 one helper per file
- wildcard examples stay intact while emphasized literal paths remain checked (test (test), 19-35): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `wildcard examples are skipped; bold, italic and code paths are checked`. real behavior
- literal gitignore paths resolve while missing paths remain findings (test (test), 37-52): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `gitignored literal paths count as present; missing paths are reported`. real behavior
- command check IDs resolve while undefined checks remain findings (test (test), 54-77): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `command check names count as present; unknown ones are reported`. real behavior; the command check is a \[\[command_check\]\] record with name = "tests/coverage"
- mise task aliases resolve while undefined aliases remain findings (test (test), 79-93): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `mise task aliases count; unknown aliases are reported`. real behavior
- tasks in shared mise configuration paths resolve without reading legacy tool versions as TOML (test (test), 95-111): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `tasks in .mise/config.toml, mise.local.toml and conf.d files count, and .tool-versions is not read as TOML`. real behavior; jargon removed from the title
- document-relative references resolve without accepting nearby missing paths (test (test), 113-131): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `paths relative to the document are found, and missing ones nearby are still reported`. real behavior
- nested tilde text is excluded while shell paths remain checked (test (test), 133-145): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `text in a quoted tilde fence is skipped while sh fences are checked`. real behavior
- malformed %s reports its read failure instead of a missing task (test (test.each), 147-163): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `a malformed %s is a read error, not a missing task`. real behavior
- \[ \['package.json', '{broken'\], \['mise.toml', '\[tasks'\], \] (test (test.each), 147-150): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `[['package.json', '{broken'], ['mise.toml', '[tasks']]`. rows stay
- a directory at a task configuration path is an error, not absent configuration (test (test), 165-176): **delete**. duplicate: a folder at package.json fails in the same catch as the package.json row of 'malformed %s reports its read failure' (147-163), since packageScripts turns every read error except ENOENT into the same error (ST1-001)
- %s validates documented tasks against their runner and nearest scoped definitions (test (test.each), 178-195): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `documented tasks are checked against their task tool and the nearest scope that defines them`. TGN-037: one run at recommended, no level loop; the docs check reads RUNNER_NAMES from packages/cli/src/config/repository/tooling.ts (INX-003); the scope tables are \[\[scope\]\] records (DOC_TASK_SCOPES); "runner" names only how hooks start gspot, so the title says "task tool"
- \['recommended', 'all'\] as const (test (test.each), 178-178): **delete**. TGN-037: docs/stale-paths is a recommended check; the all run repeats it
- a selected child document does not read unrelated or shadowed package scripts (test (test), 197-207): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `a document in a child scope does not read unrelated or shadowed package scripts`. real behavior
- a selected child document reports malformed %s at its actual owner (test (test.each), 209-224): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `a document in a child scope reports a malformed %s at the file that has it`. real behavior; owner word removed
- \[ \['app/package.json', '{broken'\], \['app/mise.toml', '\[tasks'\], \] (test (test.each), 209-212): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `[['app/package.json', '{broken'], ['app/mise.toml', '[tasks']]`. rows stay
- a $language fence with "$metadata" reports example paths=$reported (test (test.each), 226-242): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `a $language fence with "$metadata" reports example paths=$reported`. real behavior
- DOC_FENCE_PATH_CASES (test (test.each), 226-226): **keep** to `tests/unit/cli/checks/general/docs/missing-paths.test.ts` `DOC_FENCE_PATH_CASES`. the table rows come from tests/config/docs.ts

## `tests/cli/checks/general/duplication.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/duplication.test.ts`. unit test of checks/general/duplication.ts (CKG-027 splits general/public.ts)
- duplication refuses $name and removes temporary reports (test (test.each), 34-63): **delete**. duplicate and weak: the fatal-exit row takes the same code !== 0 branch as the exit-1 row of 65-89, the no-statistics row only shows that zod rejects a report without a field, and 65-89 also checks that the report folder is deleted (ST1-002)
- EXECUTION_FAILURES (test (test.each), 34-34): **delete**. rows of the deleted test (ST1-002)
- duplication preserves stdout diagnostics when exit %i produces no report (test (test.each), 65-89): **keep** to `tests/unit/cli/checks/general/duplication.test.ts` `jscpd output is kept in the error when exit %i writes no report`. real behavior; CKG-017 keeps the jscpd stat that gives this message; the sample.sh read at the end goes because jscpd only reads
- \[1, 0\] (test (test.each), 65-65): **keep** to `tests/unit/cli/checks/general/duplication.test.ts` `[1, 0]`. both exits give different messages
- duplication accepts a clean report and removes the temporary report directory (test (test), 91-110): **delete**. weak: the mocked jscpd returns a clean report and the check passes; 65-89 checks the report-folder deletion, and real jscpd runs in tests/integration/general/duplication.test.ts (ST1-002)
- clone findings (describe (describe), 112-150): **delete**. TTC-039 and TCG-023: the describe and the skip go
- clone findings &gt; '${mode} clone paths retain owned copies and exclude other files' (test (test.skipIf), 114-149): **keep** to `tests/unit/cli/checks/general/duplication.test.ts` `${mode} clone paths are reported only for files the scope covers`. TCG-023 keep the three rows; CKG-054: call jscpd with a mocked report instead of the unexported cloneFindings
- clone findings &gt; mode === 'namespaced' && process.platform !== 'win32' (test (test.skipIf), 114-114): **delete**. TCG-023: outside Windows the namespaced row equals the absolute row and is cheap
- prepareDuplicationProject (function, 19-32): **inline** to `tests/unit/cli/checks/general/duplication.test.ts` `jscpd output is kept in the error when exit %i writes no report`. one caller is left once 34-63 and 91-110 go, so it is inlined; the fake jscpd install uses the shared fake npm tool helper (ST1-019, ST1-020); drop tool_timeout_seconds = 1 (TCG-010)

## `tests/cli/checks/general/generated-code.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/stale-generated-files.test.ts; tests/unit/cli/execution/command/placeholders.test.ts`. TCG-059; CKG-032 (source moves to checks/stale-generated-files.ts); TCG-020 prepareCommand assertions move to the placeholder tests
- unmatched generated patterns at %s in %s do not start a tool (test (test.each), 15-29): **keep** to `tests/unit/cli/checks/stale-generated-files.test.ts` `a check with no matching generated files at %s starts no tool`. TCG-020: call staleGeneratedFiles directly; TGN-037: the scope loop only; the sample writes a \[\[scope\]\] record with path = "apps/api"
- GENERATED_SCOPES (test (test.each), 15-15): **keep** to `tests/unit/cli/checks/stale-generated-files.test.ts` `['', 'apps/api']`. TGN-037: the two scopes inline; GENERATED_SCOPES goes
- whole-setting generator argv at %s in %s retain empty and multiword entries (test (test.each), 31-61): **move** to `tests/unit/cli/execution/command/placeholders.test.ts` `a list setting fills whole arguments and keeps empty and multiword entries`. TCG-020: tests prepareCommand and placeholder expansion (execution/command/placeholders.ts); the empty generate_command case stays in stale-generated-files.test.ts as its own sandbox that writes no generate_command (absent means no generation check, TML-010); a scoped openapi table is a \[\[scope\]\] record with openapi.document = "apps/api/openapi.json", written from the repository root (CFR-003)
- GENERATED_SCOPES (test (test.each), 31-31): **delete**. TGN-037; TCG-020: the moved placeholder test needs no scope or level table
- required generated paths at %s in %s refuse escaping authored links before execution (test (test.each), 63-85): **keep** to `tests/unit/cli/checks/stale-generated-files.test.ts` `an openapi document at %s that links outside the repository is refused before any tool starts`. real behavior; TCG-020 direct call; TTC-032 title; the sample writes \[\[scope\]\] records with path, and openapi.document = "apps/api/openapi.json" is written from the repository root (CFR-003)
- GENERATED_SCOPES (test (test.each), 63-63): **keep** to `tests/unit/cli/checks/stale-generated-files.test.ts` `['', 'apps/api']`. TGN-037
- generated binary source links at %s in %s remain contained, cached, and unchanged (test (test.each), 87-117): **keep** to `tests/unit/cli/checks/stale-generated-files.test.ts` `an openapi document at %s linked to a binary file is read once and left unchanged`. real behavior; TCG-020; the sample writes \[\[scope\]\] records with path, and openapi.document = "apps/api/openapi.json" is written from the repository root (CFR-003)
- GENERATED_SCOPES (test (test.each), 87-87): **keep** to `tests/unit/cli/checks/stale-generated-files.test.ts` `['', 'apps/api']`. TGN-037

## `tests/cli/checks/general/gspot.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/gspot/unused-entries.test.ts; tests/unit/cli/checks/general/naming/checks/settings.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-031; glossary check name gspot/unused-entries; CKG-028 source checks/general/gspot/unused-entries.ts; CKG-005 naming rows move to naming/settings; TCG-032 header goes
- check path ignores must match tracked paths even when documentation mentions them (test (test), 12-55): **keep** to `tests/unit/cli/checks/general/gspot/unused-entries.test.ts` `an [[ignore]] or [[command_check]] path that matches no tracked file is reported, even when a document names it`. real behavior; ROOT-004: an ordinary check name, not \_\_proto\_\_; TCG-031 one helper unusedEntryFindings(session); \[\[generated\]\] is deleted (CFR-005), so its entry and expected finding go; the command check is a \[\[command_check\]\] record with name and paths, and its finding names \[\[command_check\]\]. Values to config: UNUSED_ENTRY_SETTINGS = the settings object with one \[\[command_check\]\] record and one \[\[ignore\]\] entry -&gt; tests/config/unused-entries.ts
- $name (test (test.each), 57-83): **keep** to `tests/unit/cli/checks/general/gspot/unused-entries.test.ts` `$name`. real behavior; TCG-031 helper
- AUTHORED_PATH_CASES (test (test.each), 57-57): **keep** to `tests/unit/cli/checks/general/gspot/unused-entries.test.ts` `UNUSED_PATH_CASES`. the rows come from tests/config/unused-entries.ts; the glossary retires 'authored'
- $name (test (test.each), 85-116): **move** to `tests/unit/cli/checks/general/naming/checks/settings.test.ts` `$name`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; CKG-005: unusedNames moves into the naming settings check; CKG-006: the unused-ignore assertions and rows go
- NATIVE_EXCEPTION_CASES (test (test.each), 85-85): **move** to `tests/unit/cli/checks/general/naming/checks/settings.test.ts` `UNUSED_NAME_CASES`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; CKG-005; TCG-045 rename; the rows come from tests/config/naming/settings.ts

## `tests/cli/checks/general/license-origins.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/general/licenses/allowed-packages.test.ts`. TCG-034: two files for one check; the licenses tests exceed 300 lines, so they split into scan and allowed-packages; the gspot.toml record is \[\[licenses.allowed_package\]\] with name, version and reason
- license inventory preserves $name (test (test.each), 62-119): **keep** to `tests/unit/cli/checks/general/licenses/allowed-packages.test.ts` `allowed packages: $name`. TCG-034: expected findings go into each row instead of the if/else; TTC-032 title; the row 'tooling and lockfile membership cannot justify an exception' goes because row 1 already shows it (ST1-011); \[\[licenses.allowed_package\]\] is a root-only record with name, version and reason, so the scoped origins and the license field go and the stale message names no scope (CFR-004, TML-009)
- EXCEPTION_MEMBERSHIP (test (test.each), 62-62): **keep** to `tests/unit/cli/checks/general/licenses/allowed-packages.test.ts` `ALLOWED_PACKAGE_SCOPE_CASES`. TCG-045; the rows come from tests/config/licenses.ts and hold root records only (CFR-004, TML-009)
- prepareInventories (function, 21-60): **merge** to `tests/setup/licenses.ts` `prepareLicenseSandbox`. TCG-034: one setup helper for both license test files; TCG-057 check whether apply is needed; it writes one root \[\[licenses.allowed_package\]\] record (name = "Absent_Package", version = "2.0.0", reason) and no scoped record, and scopes stay plain \[\[scope\]\] records with path (CFR-004, TML-009). Values to config: ABSENT_PACKAGE_LOCKFILE = '\[\[package\]\]\\nname = "Absent_Package"\\nversion = "2.0.0"\\n' -&gt; tests/config/licenses.ts; LICENSE_TOOL_PROJECT_FILES = the two tool project files under .gspot/ -&gt; tests/config/licenses.ts; SAMPLE_PYPROJECT = '\[project\]\\nname = "sample"\\nversion = "0.0.0"\\n' -&gt; tests/config/licenses.ts

## `tests/cli/checks/general/licenses.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/licenses/scan.test.ts; tests/unit/cli/checks/general/licenses/allowed-packages.test.ts; tests/setup/licenses.ts`. TCG-034 (merged license tests exceed 300 lines); TCG-002 deletions
- license scans in scope "%s" identify missing %s dependencies before starting scanners (test (test.each), 43-69): **keep** to `tests/unit/cli/checks/general/licenses/scan.test.ts` `a scan in scope "%s" stops before any scanner when %s dependencies are not installed`. real behavior; the sample writes a \[\[scope\]\] record with path = "apps/example"
- \['', 'apps/example'\].flatMap((scope) =&gt; \[ \[scope, 'package.json', '{"name":"example","private":true}', 'node_mod (test (test.each), 43-48): **keep** to `tests/unit/cli/checks/general/licenses/scan.test.ts` `['', 'apps/example'] x (package.json, pyproject.toml)`. rows stay. Values to config: LICENSE_MANIFESTS = the package.json and pyproject.toml rows with their installed folder -&gt; tests/config/licenses.ts
- Python license scanning rejects $name and removes its temporary configuration directory (test (test.each), 71-106): **keep** to `tests/unit/cli/checks/general/licenses/scan.test.ts` `pip-licenses $name is an error and its scratch folder is deleted`. real behavior; TCO-037; glossary 'scratch'; the 'malformed JSON' row goes because it only pins JSON.parse text (ST1-011)
- SCANNER_FAILURES (test (test.each), 71-71): **keep** to `tests/unit/cli/checks/general/licenses/scan.test.ts` `SCANNER_FAILURES`. the rows come from tests/config/licenses.ts (CKG-050 keeps the zero-packages error for Python)
- a %s unused license file does not change the selected scanning policy (test (test.each), 108-128): **delete**. TCG-002: tests a deleted file (.gspot/config/licenses.json)
- UNUSED_LICENSE_FILES (test (test.each), 108-108): **delete**. TCG-002
- an unused license file linked outside the repository does not change scanning or its destination (test (test), 130-150): **delete**. TCG-002
- combined license scans preserve manifest order, license alternatives, unknown licenses, and isolated Python settings (test (test), 152-210): **keep** to `tests/unit/cli/checks/general/licenses/scan.test.ts` `one scan reads package.json and pyproject.toml, accepts a license choice, and reports unknown licenses`. real behavior; TCG-042 delete toHaveLength(3); licenses.exceptions becomes allowed_packages (POL-004): two \[\[licenses.allowed_package\]\] records with name, version and reason, the license in the reason text (TML-009). Values to config: SCAN_ALLOWED_PACKAGES = the two allowed-package records -&gt; tests/config/licenses.ts; NPM_LICENSE_REPORT = the mocked npm scanner output -&gt; tests/config/licenses.ts; PYTHON_LICENSE_REPORT = the mocked Python scanner output -&gt; tests/config/licenses.ts
- license matching preserves $name (test (test.each), 212-242): **move** to `tests/unit/cli/checks/general/licenses/allowed-packages.test.ts` `an allowed package: $name`. TCG-034; TCG-045 'exception' wording; the record has no license field (TML-009), so the license cross-check and its rows 'stale exception' and 'changed license' go; the 'corrected exception' row goes as a repeat of 'exact exception' (ST1-011); the sample writes \[\[licenses.allowed_package\]\] with name, version and reason
- LICENSE_EXCEPTIONS (test (test.each), 212-212): **move** to `tests/unit/cli/checks/general/licenses/allowed-packages.test.ts` `ALLOWED_PACKAGE_CASES`. TCG-045; glossary allowed package; the rows come from tests/config/licenses.ts, two fewer without the license cross-check (TML-009)
- preparePythonProject (function, 27-41): **move** to `tests/setup/licenses.ts` `prepareLicenseSandbox`. TCG-034: shared by scan.test.ts and allowed-packages.test.ts; glossary 'sandbox'; its settings default is LICENSE_SETTINGS from tests/config/licenses.ts. Values to config: SAMPLE_PYPROJECT = '\[project\]\\nname = "sample"\\nversion = "0.0.0"\\n' -&gt; tests/config/licenses.ts

## `tests/cli/checks/general/naming/contracts.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/naming/settings.test.ts; tests/unit/cli/checks/general/naming/names.test.ts; tests/unit/cli/checks/general/naming/checks/identifiers.test.ts; tests/unit/cli/checks/general/naming/checks/paths.test.ts; tests/unit/cli/commands/explain/command.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-047; CKG-030 and glossary (naming/settings.ts builds the naming settings, naming/names.ts checks one name); TCG-026; TCG-029
- each language owns its effective ceilings at %s (test (test.each), 46-60): **delete**. duplicate: 'category limits inherit root and scope language settings' (62-86) checks category inheritance through limitsFor; this loop over six languages and four categories only re-reads the shipped defaults (ST1-003)
- \['recommended', 'all'\] as const (test (test.each), 46-46): **delete**. TGN-037
- category ceilings inherit root and scope language settings while explicit categories take precedence (test (test), 62-86): **keep** to `tests/unit/cli/checks/general/naming/settings.test.ts` `category limits inherit root and scope language settings; a category setting wins`. real behavior; glossary 'limit'; the setting is naming.&lt;language&gt;.max_characters, and the scoped tables are a \[\[scope\]\] record with path = "app" and dotted naming.swift.max_characters, naming.swift.max_words and naming.swift.functions.max_characters. Values to config: SWIFT_NAMING_LIMITS = the root, scope and category swift limit tables -&gt; tests/config/naming/settings.ts
- %s accepts its exact ceilings and reports the next character or word (test (test.each), 88-117): **keep** to `tests/unit/cli/checks/general/naming/settings.test.ts` `%s accepts a name at its limits and reports one character or word more`. real behavior; TCG-056; the setting read is naming.&lt;language&gt;.max_characters
- \[...NAMING_LANGUAGES\] (test (test.each), 88-88): **keep** to `tests/unit/cli/checks/general/naming/settings.test.ts` `NAMING_LANGUAGES`. the table rows come from tests/config/naming/settings.ts
- technical digit words remain words in every identifier category without exempting other checks (test (test), 119-157): **move** to `tests/unit/cli/checks/general/naming/names.test.ts` `a number word such as base64 counts as one word; repeated, extra, banned and digit words are still reported`. unit test of nameFindings with the file's hand-built naming rules instead of defaultNamingContext; TCG-056 identifier() helper; the loop over TECHNICAL_NAMES and NAMING_CATEGORIES goes because it copies the shipped NUMERIC_WORDS set and the digit rule reads no category; base64 and user2 stay inline (ST1-004)
- public checks accept ordinary domain terms and numeric words in JavaScript and TypeScript (test (test), 159-181): **delete**. duplicate (TCG-029: naming/contracts.test.ts 'technical digit words remain words in every identifier category' checks the number words in every category and the digits finding for user2; naming/vocabulary.test.ts 'ordinary response and domain words pass while an adjacent banned name still fails' checks ordinary words end to end)
- public explanations report Swift and SQL category defaults and scoped overrides (test (test), 183-210): **move** to `tests/unit/cli/commands/explain/command.test.ts` `explain shows each scope's default and current naming limit`. TCG-026: tests the explain command (explainSetting in commands/explain/command.ts), where its scope row is not covered; the setting is naming.swift.functions.max_characters, and the scope is a \[\[scope\]\] record with path = "app" and the dotted key naming.swift.max_characters
- $language $category case and length follow native ownership while word limits remain (test (test.each), 212-242): **keep** to `tests/unit/cli/checks/general/naming/settings.test.ts` `$language $category: the language's own linter owns case and length; word limits still apply`. real behavior (ruleLimits, CKG-019); TTC-032 title; two rows stay (swift types: the linter owns case and length; swift functions: gspot does) because the other eight only copy the shipped naming defaults (ST1-005); the sample writes \[\[naming.override\]\] with cases = \["upper-snake"\]. Values to config: UPPER_SNAKE_OVERRIDE = the \[\[naming.override\]\] table -&gt; tests/config/naming/settings.ts
- NATIVE_NAME_CATEGORIES (test (test.each), 212-212): **keep** to `tests/unit/cli/checks/general/naming/settings.test.ts` `LINTER_CHECKED_CATEGORIES`. the two rows come from tests/config/naming/settings.ts; the glossary retires 'native', and 'owner' outside the ownership log
- %s path containers stay in the selected child scope at both levels (test (test.each), 244-287): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `[slug] path brackets apply only in the scope that selects nextjs`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-027: one run at all, an end-to-end test of naming/paths; only the nextjs row stays, as a plain test, since svelte and astro run the same code (ST1-005); the sample writes a \[\[scope\]\] record with path = "app"
- \['nextjs', 'svelte', 'astro'\] (test (test.each), 244-244): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `'nextjs' (one row, plain test)`. one row is left, so the test needs no table (ST1-005)
- %s root containers also apply to inherited child selections (test (test.each), 289-310): **delete**. weak (TCG-027: it expects no finding at both levels, so it passes even when the naming checks do not run)
- \['nextjs', 'svelte', 'astro'\] (test (test.each), 289-289): **delete**. weak (the framework rows of the deleted root-container test)
- owned (const, 27-27): **inline** to `tests/unit/cli/checks/general/naming/settings.test.ts` `check`. TCG-041: use ! on the lookup; no guard throw
- check (const, 29-29): **move** to `tests/unit/cli/checks/general/naming/settings.test.ts` `check`. used by the limit tests; it stays in the test file because it is computed at load time from the shipped manifests
- namingCeiling (function, 31-36): **move** to `tests/unit/cli/checks/general/naming/settings.test.ts` `namingLimit`. reads the shipped default of a limit setting; the moved explain test reads its defaults itself; glossary: limit, not ceiling
- defaultNamingContext (function, 38-44): **move** to `tests/unit/cli/checks/general/naming/settings.test.ts` `defaultNamingContext`. used by the limit tests

## `tests/cli/checks/general/naming/extract.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/naming/identifiers.test.ts`. TCG-025: the extractors move into checks/general/naming/ (architecture: naming extractors flat); identifiersOf, fileIdentifier, directoryIdentifiers live in naming/identifiers.ts (CKG-030); about 290 lines with the path-name tests
- identifiersOf (describe (describe), 21-75): **delete**. TTC-039: the file tests identifiersOf throughout
- identifiersOf &gt; collects TypeScript declarations by category and skips object literal keys (test (test), 22-31): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `TypeScript declarations are collected by category; object literal keys are not`. real behavior
- identifiersOf &gt; skips a name bound from another module through require or await import, and nothing else (test (test), 33-42): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `a name bound from another module through require or await import is skipped, and nothing else`. real behavior
- identifiersOf &gt; collects shell functions and variables (test (test), 44-56): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `Bash functions and variables are collected`. real behavior
- identifiersOf &gt; collects Python declarations by category and retains dunder names while leaving out self (test (test), 58-65): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `Python declarations are collected by category, dunder names included, self left out`. real behavior
- identifiersOf &gt; collects Swift declarations by category (test (test), 67-74): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `Swift declarations are collected by category`. real behavior
- $language declarations arrive in document order, including names on the same line (test (test.each), 77-84): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `$language declarations arrive in document order, including names on the same line`. real behavior
- SOURCE_ORDER_CASES (test (test.each), 77-77): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `SOURCE_ORDER_CASES`. the table rows come from tests/config/naming/sources.ts
- JavaScript destructured and arrow parameters remain declarations and exclude object keys (test (test), 86-100): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `JavaScript destructured and arrow parameters are declarations; object keys are not`. real behavior
- $language authored names retain source coordinates and omit discarded bindings (test (test.each), 102-110): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `$language names keep their line and column; discarded names such as \_ are left out`. real behavior; glossary retires 'authored'
- AUTHORED_NAME_CASES (test (test.each), 102-102): **keep** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `NAME_POSITION_CASES`. the rows come from tests/config/naming/sources.ts; the glossary retires 'authored'
- namesInCategory (function, 17-19): **move** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `namesInCategory`. used by three category tests

## `tests/cli/checks/general/naming/findings.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/naming/names.test.ts`. TCG-047 and TCG-056: unit tests of nameFindings (naming/names.ts per NMS rename table); joined by words.test.ts and contracts.test.ts unit tests
- nameFindings (describe (describe), 87-133): **delete**. TTC-039: the whole file tests nameFindings
- nameFindings &gt; reports every finding a name has, with the policy source (test (test), 88-96): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `a name reports every finding it has, with the rule source`. real behavior
- nameFindings &gt; case follows the category, and file stems are checked by dot segment (test (test), 98-109): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `case follows the category, and file stems are checked by dot segment`. real behavior
- nameFindings &gt; path exclusions, digit allowances and structural prefixes apply (test (test), 111-115): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `path exclusions, digit allowances and ignored prefixes apply`. real behavior
- nameFindings &gt; external names and file-specific contracts bypass naming checks (test (test), 117-126): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `allowed names and path overrides skip the naming rules`. TTC-032 title ('contracts')
- nameFindings &gt; a reserved term is allowed only in its named uses (test (test), 128-132): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `a reserved word is allowed only in its named categories`. real behavior
- selected prefix rules permit functions and methods and reject variables without a file-extension exception (test (test), 135-166): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `a prefix rule allows handle in functions and methods and reports it in variables`. real behavior; CKG-025 message changes
- the words of the shipped tests group pass in a test file and fail elsewhere (test (test), 168-176): **delete**. duplicate (naming/findings.test.ts 'test exemptions use the group identity independently of its display label' checks the same test-file exemption of the tests group; this copy only adds that the shipped list holds testcase)
- test exemptions use the group identity independently of its display label (test (test), 178-196): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `the tests-group exemption follows the group, not its label`. TTC-032 title
- bannedTerm (describe (describe), 200-208): **delete**. CKG-054: bannedTerm is inlined into termFindings; TTC-039
- bannedTerm &gt; matches whole parts and consecutive parts only (test (test), 201-207): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `a banned term matches whole words and runs of words only`. CKG-054: test through nameFindings, not bannedTerm
- the required folders group keeps identifier terms separate without dropping other shipped groups (test (test), 210-231): **delete**. fake: it rebuilds the term list with the product's own expression and checks that the shipped list holds 'shared'
- policy (const, 13-77): **move** to `tests/unit/cli/checks/general/naming/names.test.ts` `namingSettings`. the naming check's type is NamingSettings, so the hand-built value is namingSettings; it stays in the test file because it is built at load time with compileTerms and pathMatcher; naming.allowed merges into \[\[naming.override\]\] allowed_names and the override field names is deleted (TML-005), so the value drops the top-level allowed map (requestAnimationFrame and enhancedThing become one rule without paths) and the names field of every rule; reserved stays for the shipped reserved words
- owned (const, 79-79): **inline** to `tests/unit/cli/checks/general/naming/names.test.ts` `plain`. TCG-041: use ! on the lookup
- plain (const, 81-81): **move** to `tests/unit/cli/checks/general/naming/names.test.ts` `plain`. used by every nameFindings test; it stays in the test file because it is computed from owned.check and namingSettings
- identifier (function, 83-85): **move** to `tests/unit/cli/checks/general/naming/names.test.ts` `identifier`. TCG-056: the one identifier() helper
- TERMS (const, 198-198): **move** to `tests/unit/cli/checks/general/naming/names.test.ts` `TERMS`. used by the banned-term test; it stays in the test file because it is built at load time with compileTerms

## `tests/cli/checks/general/naming/manifest-rules.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/general/naming/settings.test.ts`. CKG-054: the rule-order test checks naming rules built by naming/rules.ts, through nameFindings
- a selected framework adds its rules after the shipped ones and before the repository rules (test (test), 13-58): **keep** to `tests/unit/cli/checks/general/naming/settings.test.ts` `a framework's naming rules come after the shipped ones and before the repository's`. CKG-054: assert outcomes through nameFindings, so rulesFor loses its export; the sample writes \[\[naming.override\]\], and the expected rule source label reads "\[\[naming.override\]\] entry 1"
- manifests (const, 10-10): **move** to `tests/unit/cli/checks/general/naming/settings.test.ts` `manifests`. used by javascript and express; it stays in the test file because it is computed at load time from configurationManifests()
- javascript (const, 11-11): **move** to `tests/unit/cli/checks/general/naming/settings.test.ts` `javascript`. used by the rule-order test; it stays in the test file because it is computed at load time from configurationManifests()
- express (const, 12-12): **move** to `tests/unit/cli/checks/general/naming/settings.test.ts` `express`. used by the rule-order test; it stays in the test file because it is computed at load time from configurationManifests()

## `tests/cli/checks/general/naming/ownership.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/naming/checks/configuration-names.test.ts; tests/unit/cli/checks/general/naming/checks/paths.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-047; naming identifiers tests exceed 300 lines, so names a configuration allows get their own file; the file-name test is a naming/paths test
- $configuration native exports and methods preserve parameter and sibling findings (test (test.each), 17-66): **keep** to `tests/unit/cli/checks/general/naming/checks/configuration-names.test.ts` `framework function names are allowed only inside the framework's scope`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title; TCG-007 keep one or two names per framework; the sample writes \[\[scope\]\] records with path = "app" and path = "sibling"
- FRAMEWORK_CONTRACTS (test (test.each), 17-17): **keep** to `tests/unit/cli/checks/general/naming/checks/configuration-names.test.ts` `FRAMEWORK_NAMES`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-007 trimmed rows; the rows come from tests/config/naming/settings.ts
- foreign native names and repository API picks receive ordinary TypeScript checks (test (test), 68-90): **keep** to `tests/unit/cli/checks/general/naming/checks/configuration-names.test.ts` `names other configurations allow are checked like any name in plain TypeScript`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-007: use two names instead of FOREIGN_NAMES
- shell variables preserve findings on functions and neighboring local bindings (test (test), 92-116): **delete**. fake (TCG-007: it bans a 24-name copy of the shipped Bash list)
- Swift native case and length rules preserve banned terms in types and parameters (test (test), 118-145): **keep** to `tests/unit/cli/checks/general/naming/checks/configuration-names.test.ts` `SwiftLint owns Swift type case and length; banned terms are still reported in types and parameters`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title
- Python native declarations reach their owning rules while invented dunders and parameters fail (test (test), 147-178): **delete**. fake (TCG-007: it bans a 46-name copy of the shipped Python dunder list and the four setUp names)
- pytest owns test-prefix counting without changing sibling Python contracts (test (test), 180-208): **keep** to `tests/unit/cli/checks/general/naming/checks/configuration-names.test.ts` `with pytest selected, the test_ prefix does not count as a word`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title; the sample writes \[\[scope\]\] records with path = "app" and path = "sibling"
- Python module filenames preserve the neighboring TypeScript filename contract (test (test), 210-230): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `__init__.ts is reported; Python __init__.py and __main__.py are allowed`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title; it runs naming/paths

## `tests/cli/checks/general/naming/paths.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts; tests/unit/cli/checks/general/naming/identifiers.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; the path-name unit tests test fileIdentifier and directoryIdentifiers (naming/identifiers.ts)
- path identifiers (describe (describe), 13-40): **delete**. TTC-039
- path identifiers &gt; the stem drops one extension, or the whole declaration suffix (test (test), 14-18): **move** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `a file name drops one extension, or the whole declaration suffix`. unit test of fileIdentifier
- path identifiers &gt; Next.js segments are unwrapped and dot folders skipped (test (test), 20-39): **move** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `Next.js folder brackets are unwrapped and dot folders skipped`. unit test of directoryIdentifiers
- Postgres migration directory digits in "%s" require its selected declaration (test (test.each), 42-70): **keep** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `a migration folder name with digits needs the postgres configuration (scope "%s")`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-041: type namingPaths as returning findings and drop the Array.isArray branches; the sample writes a \[\[scope\]\] record with path = "app"
- \['', 'app'\] (test (test.each), 42-42): **keep** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `['', 'app']`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; rows stay
- %s owns route punctuation without changing plain paths (test (test.each), 71-83): **move** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `nextjs brackets turn [slug] into a path parameter; without them names stay as written`. unit test of fileIdentifier and directoryIdentifiers; TTC-032 title; only the nextjs row stays, as a plain test, since svelte and astro run the same code with their own path_containers (ST1-005)
- \['nextjs', 'svelte', 'astro'\] (test (test.each), 71-71): **move** to `tests/unit/cli/checks/general/naming/identifiers.test.ts` `'nextjs' (one row, plain test)`. one row is left, so the test needs no table (ST1-005)

## `tests/cli/checks/general/naming/policy.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/naming/checks/settings.test.ts; tests/unit/cli/checks/general/naming/checks/identifiers.test.ts; tests/unit/cli/checks/general/naming/checks/paths.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-047: the file mixes three checks; naming/policy becomes naming/settings (glossary)
- external property allowances retain adjacent local signature findings through the CLI (test (test), 21-44): **move** to `tests/unit/cli/checks/general/naming/checks/identifiers.test.ts` `an allowed property name does not hide a bad name on the next line`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title; it runs naming/identifiers; the sample writes \[\[naming.override\]\] with paths = \["source.ts"\], categories = \["properties"\], allowed_names = \["external_key"\] and its reason, so user_name on line 3 is still reported (TML-005)
- SQL migration names retain their timestamp while enforcing snake case (test (test), 46-66): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `a SQL migration file name keeps its timestamp and must be snake case`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; it runs naming/paths
- naming policy validates inherited and scoped declarations against the complete source inventory (test (test), 68-125): **keep** to `tests/unit/cli/checks/general/naming/checks/settings.test.ts` `allowed_names that no identifier in the override paths uses are reported`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; CKG-005: the override-path part goes (gspot/unused-entries reports it); naming.allowed merges into \[\[naming.override\]\] allowed_names and record lists live only at the root, so the sample writes root records (one without paths, one with paths = \["web/\*\*"\], one with paths = \["worker/\*\*"\]); the stale message names allowed_names (TML-005, CFR-004)
- an unknown prototype case stays a policy finding while neighboring identifier checks remain active (test (test), 127-159): **delete**. ROOT-004: the \_\_proto\_\_ tests go; POL-021: the settings schema checks case names, so naming/settings drops its case block
- the selected naming configuration rejects banned terms in declarations and paths (test (test), 161-190): **move** to `tests/unit/cli/checks/general/naming/checks/identifiers.test.ts` `a banned word is reported in a name, a file name and a folder name`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; real behavior
- ordinary service and generation names pass the naming checks in code and paths (test (test), 192-205): **delete**. duplicate (TCG-029: naming/vocabulary.test.ts 'ordinary response and domain words pass while an adjacent banned name still fails' checks ordinary words end to end; this test only checks exit code 0 and passed statuses)
- naming test exemptions follow authored, inherited and Swift test conventions without reaching sibling production files (test (test), 207-220): **move** to `tests/unit/cli/checks/general/naming/checks/identifiers.test.ts` `test-file exemptions follow each scope's test_files and Swift test names`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; real behavior; TTC-032 title
- Next.js Pages Router names preserve an adjacent path finding and pass after the fix (test (test), 222-243): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `Next.js special pages such as _app and 404 are allowed; a snake_case page is reported`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title; it runs naming/paths
- MISMATCHED_POLICY (const, 11-11): **move** to `tests/config/naming/settings.ts` `MISMATCHED_SETTINGS`. glossary: settings, not policy; it is derived only from ALLOWED_NAME_SETTINGS, a config value, so it goes to config, and the worker record lists remoteRecord in allowed_names (TML-005)
- policyRows (function, 13-19): **move** to `tests/unit/cli/checks/general/naming/checks/settings.test.ts` `reportRows`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; glossary: settings, not policy

## `tests/cli/checks/general/naming/vocabulary.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/naming/checks/identifiers.test.ts; tests/unit/cli/checks/general/naming/checks/paths.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-047: tests of two checks
- ordinary response and domain words pass while an adjacent banned name still fails (test (test), 20-37): **keep** to `tests/unit/cli/checks/general/naming/checks/identifiers.test.ts` `ordinary words and number words pass; a banned word and a digit suffix are reported`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-029: the one combined ordinary-words test (merged word list)
- reserved categories apply literally and child declarations leave sibling contracts intact (test (test), 39-64): **delete**. naming.reserved is deleted because nothing uses it (TML-005); the shipped reserved words stay, and the names.test.ts test 'a reserved word is allowed only in its named categories' keeps that behavior tested
- all shipped groups apply and exact allowances leave adjacent banned names active (test (test), 66-112): **delete**. fake (it checks that seven words are in the shipped banned groups, a constant; the exact allowance is checked by naming/findings.test.ts 'external names and file-specific contracts bypass naming checks')
- hidden folders preserve filename checks without needing a list of tool directory names (test (test), 114-132): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `files in dot folders still get file-name checks`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title
- numbered task paths require their authored prefix contract (test (test), 134-153): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `a numbered file name needs an ignored_prefix override`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TTC-032 title
- an advanced guide receives the ordinary vocabulary rule (test (test), 155-171): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `a Markdown file name with a banned word is reported`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-008: kept and renamed
- an exact repeated-word exception preserves the neighboring duplicate-word diagnostic (test (test), 173-189): **delete**. the override field names is deleted (TML-005), and this test only checks that allow_repeated_words applies to the one named name
- restored terms fail in identifiers and paths at all and neither check runs at recommended (test (test), 191-217): **delete**. TCG-008: self-policing guard of an owner decision

## `tests/cli/checks/general/naming/words.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/general/naming/names.test.ts`. TCG-056: splitParts unit test joins the nameFindings tests
- splitParts (describe (describe), 4-22): **delete**. TTC-039: groups the repeatedPart test under splitParts
- splitParts &gt; splits at case boundaries, separators and digit runs; an acronym is one part (test (test), 5-16): **keep** to `tests/unit/cli/checks/general/naming/names.test.ts` `splitParts splits at case changes, separators and digit runs; an acronym is one word`. real behavior; splitParts has a source user
- splitParts &gt; finds the first repeated part (test (test), 18-21): **delete**. CKG-054: repeatedPart is exported only for tests; the duplicate-words rule is tested through nameFindings
- an unknown case never matches an identifier or invokes an inherited object member (test (test), 24-28): **delete**. ROOT-004 (\_\_proto\_\_); POL-021 (the schema refuses unknown case names); CKG-054 (hasCase loses its export)

## `tests/cli/checks/general/prose.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/prose.test.ts`. unit test of checks/general/prose.ts (CKG-027)
- an outdated Vale executable reports its missing installation without scanning (test (test), 19-37): **delete**. duplicate: it tests the shared version gate, which tests/cli/execution/tool-runner/adapters.test.ts 'an adapter reports a version below the floor as missing' checks for every pinned tool
- Vale reports $name without interpreting an empty output as success (test (test.each), 39-66): **delete**. TCG-010: both rows repeat the shared timeout and cancel handling
- EXECUTION_FAILURES (test (test.each), 39-39): **delete**. TCG-010
- Vale receives its configured deadline and returns located native alerts (test (test), 68-100): **keep** to `tests/unit/cli/checks/general/prose.test.ts` `Vale gets the timeout setting, and its alerts become findings with file, line and column`. real behavior; glossary 'timeout'; TCO-037 using
- each stdin route scans the bytes held by the run and maps its own alerts (test (test), 102-141): **keep** to `tests/unit/cli/checks/general/prose.test.ts` `files Vale reads from stdin are scanned as read at the start of the run`. real behavior; TTC-032 title
- prose routes (describe (describe), 143-168): **delete**. TTC-039
- prose routes &gt; known grammars read paths while module aliases and extensionless scripts use typed stdin (test (test), 144-153): **keep** to `tests/unit/cli/checks/general/prose.test.ts` `Vale reads known file types by path, and .mts files and scripts without an extension through stdin`. CKG-054: test through vale, so routeFor loses its export
- prose routes &gt; path routes group by extension and an extensionless script stands alone (test (test), 155-167): **keep** to `tests/unit/cli/checks/general/prose.test.ts` `Vale runs once per extension group; a script without an extension runs alone`. CKG-054: test through vale, so routeGroups loses its export

## `tests/cli/checks/general/secrets/env/files.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/repository.test.ts`. TCG-005: tests repository/tracked-files (checks/general/repository.ts, with large-files); the merged file stays under 300 lines
- tracked-file checks distinguish environment files from templates in nested folders (test (test), 14-29): **delete**. TCG-013: the last test repeats seven of its eight paths; add nested/.dev.vars to TRACKED_PATTERNS
- staged environment policy respects a check that is $name (test (test.each), 31-67): **delete**. duplicate: the 'ignored' and 'skipped' rows repeat the shared ignore and skip features (CMD-092 deletes --skip), and the 'selected' case, a staged .env reported by repository/tracked-files, is already shown by 103-148 and the moved structure/findings test 23-46; --staged only changes which files the run selects (TCG-013)
- \[...STAGED_CASES\] (test (test.each), 31-31): **delete**. weak (the 'absent' row only shows that an unrelated custom check passes; the 'ignored' and 'skipped' rows repeat the shared ignore and skip features, TCG-013); the 'selected' row is the kept test's own case without a table
- checks share one index within a run and see corrections in the next run (test (test), 69-101): **delete**. TCG-013: counts git calls (an implementation detail of the index); the pass after git rm --cached stays in the moved structure/findings test
- %s tracked-file patterns follow root, child, and sibling selections without exempting nested templates (test (test.each), 103-148): **keep** to `tests/unit/cli/checks/general/repository.test.ts` `tracked-files follows each scope's configurations: env files, dependency folders and build output are reported`. TGN-037 one level; TCG-013 delete lines 125-129 (setup check); lines 130-145 also go because the \[\[ignore\]\] half tests the shared ignore code (ST1-018)
- \['recommended', 'all'\] as const (test (test.each), 103-103): **delete**. TGN-037: tracked-files is a recommended check

## `tests/cli/checks/general/secrets/env/readers.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/secrets.test.ts`. TCG-048 (flatten secrets/env/); NMU-024 (secrets/env-template becomes secrets/env-examples); source checks/general/secrets.ts
- checks Bun and multiple declared readers without an enabling flag (test (test), 22-38): **keep** to `tests/unit/cli/checks/general/secrets.test.ts` `keys read through Bun.env and custom reader functions are reported until the example file lists them`. TTC-032 title (no enabling flag exists)
- checks each scope against its own templates and declared readers (test (test), 40-63): **keep** to `tests/unit/cli/checks/general/secrets.test.ts` `each scope checks its own example env files and reader functions`. TTC-032 title; NMU-024
- keeps Bun reads active with no custom reader declarations (test (test), 65-81): **keep** to `tests/unit/cli/checks/general/secrets.test.ts` `Bun.env reads are checked with no reader functions declared`. real behavior
- environment reads without a template in their scope report the unmet prerequisite (test (test), 83-118): **keep** to `tests/unit/cli/checks/general/secrets.test.ts` `a scope with env reads and no example env file is skipped with a note`. real behavior; NMU-024 wording; the sample writes a \[\[scope\]\] record with path = "app"
- modern environment accessors in component and module files require matching template keys (test (test), 120-159): **keep** to `tests/unit/cli/checks/general/secrets.test.ts` `import.meta.env and Deno.env reads in component and module files need example keys`. real behavior. Values to config: ENV_ACCESSOR_FILES = the eight component and module sources -&gt; tests/config/secrets.ts; ENV_ACCESSOR_EXAMPLE = the fixed .env.example -&gt; tests/config/secrets.ts

## `tests/cli/checks/general/security.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/security.test.ts; tests/unit/cli/parsers/output/sarif.test.ts`. TCG-021: ten blocks test sarifFindings (parsers/output/sarif.ts); the two CodeQL tests stay
- sarifFindings maps every result to its file and line (test (test), 30-36): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `sarifFindings maps every result to its file and line`. TCG-021
- an incomplete CodeQL report cannot become a clean result: %j (test (test.each), 38-46): **delete**. weak: it only shows that a report missing runs or results fails, with zod's error text 'runs' (ST1-007)
- \[ {}, { version: '2.1.0' }, { version: '2.1.0', runs: \[\] }, { version: '2.1.0', runs: \[{}\] }, { vers (test (test.each), 38-44): **delete**. rows of the deleted test (ST1-007)
- a valid CodeQL report with no results remains clean (test (test), 48-57): **delete**. weak: an empty results array gives no findings, empty in and empty out (ST1-007)
- CodeQL invocation failures cannot become clean results: %j (test (test.each), 59-71): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `a failed CodeQL run in the report is an error, not a clean result: %j`. TCG-021
- \[ { executionSuccessful: false }, { executionSuccessful: true, toolExecutionNotifications: \[{ level: 'error' }\] (test (test.each), 59-62): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `[{ executionSuccessful: false }, ...]`. rows move with the test. Values to config: FAILED_INVOCATIONS = \[{ executionSuccessful: false }, { executionSuccessful: true, toolExecutionNotifications: \[{ level: 'error' }\] }\] -&gt; tests/config/security.ts
- CodeQL resolves source locations before applying path-specific exceptions: %j (test (test.each), 73-108): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `source locations become repository paths before path ignores apply: %j`. TCG-021; TCG-045 ('exceptions' means ignores)
- \[ { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' }, { uri: new URL('api/some%20file.ts', sourceUri).href }, (test (test.each), 73-78): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `[{ uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' }, ...]`. rows move with the test
- CodeQL refuses unresolved or external report locations: %j (test (test.each), 110-122): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `unresolved or external report locations are refused: %j`. TCG-021
- \[ { uri: '../outside.ts' }, { uri: pathToFileURL(resolve(sourceRoot, '../outside.ts')).href }, { uri: 'https (test (test.each), 110-116): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `[{ uri: '../outside.ts' }, ...]`. rows move with the test
- CodeQL rejects cyclic URI bases before resolving a finding (test (test), 124-128): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `cyclic URI bases are refused before a finding resolves`. TCG-021
- SARIF $name is file-only without reading a missing encoded source (test (test.each), 130-151): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `a result with $name has a file only and reads no missing source`. TCG-021
- \[ { name: 'no region', region: undefined }, { name: 'negative offset', region: { charOffset: -1 } }, { name: (test (test.each), 130-134): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `[{ name: 'no region', region: undefined }, ...]`. rows move with the test. Values to config: POSITIONLESS_REGIONS = the three region rows -&gt; tests/config/security.ts
- SARIF preserves explicit positions without reading source bytes or declared encodings (test (test), 153-161): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `given positions are kept without reading source bytes or encodings`. TCG-021; TTC-032 title
- SARIF retains a repository-level finding with no invented source coordinates (test (test), 163-169): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `a result with no location is a repository-level finding without line or column`. TCG-021; TTC-032 title
- CodeQL refuses the language %s, which names a path, before it starts a process (test (test.if), 177-228): **keep** to `tests/unit/cli/checks/general/security.test.ts` `CodeQL runs in a scratch copy that is deleted afterwards and leaves the repository unchanged`. TCG-001: the refusal half cannot fail and is tested in the settings tests; keep the copy half without test.each; TCG-022 no build gate
- \['../outside', 'C:outside'\] (test (test.if), 177-177): **delete**. TCG-001: the path refusal is tested in tests/cli/policy/read/settings.test.ts
- hasToolBuild('codeql') (test (test.if), 177-177): **delete**. TCG-022: every process is mocked and planning is bypassed, so the build gate only hides the test
- %s (test (test.if), 229-299): **keep** to `tests/unit/cli/checks/general/security.test.ts` `CodeQL uses its own language names and the pinned packs once and maps SARIF locations to repository files`. real behavior; TCG-042 delete toHaveLength(count); the table goes, so the kept fourth row is a plain test with a plain title
- \[ \['CodeQL policy ignores require matching rule and path', 'js/sql-injection', \['source file.ts'\], 0\], \['CodeQL (test (test.if), 229-239): **delete**. duplicate (rows 1-3 test ignore matching by rule and path, which tests/cli/execution/ignores.test.ts 'match by check, rule and paths and count what they matched' checks; the fourth row is the kept test's own case without a table)
- hasToolBuild('codeql') (test (test.if), 229-229): **delete**. TCG-022
- sourceRoot (const, 27-27): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `sourceRoot`. used only by the SARIF tests; it stays in the test file because it is computed at load time (resolve)
- sourceUri (const, 28-28): **move** to `tests/unit/cli/parsers/output/sarif.test.ts` `sourceUri`. used only by the SARIF tests; it stays in the test file because it is computed at load time (pathToFileURL)
- ALIASED_POLICY (const, 171-174): **move** to `tests/unit/cli/checks/general/security.test.ts` `ALIASED_SETTINGS`. glossary: settings, not policy; it stays in the test file because it is built at load time with buildPolicy

## `tests/cli/checks/general/site/build.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/site/build.test.ts`. TCG-059; CKG-029 (site checks move to checks/framework/site/build.ts)
- push builds preserve tracked dist bytes and Git status (test (test), 19-42): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `a push run builds the site without changing committed dist files or Git status`. real behavior; TTC-032 title
- site build reproducibility (describe (describe), 44-97): **delete**. TTC-039
- site build reproducibility &gt; the second build preserves the output shared with other checks (test (test), 45-69): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `the second build leaves the first build's output for the other site checks`. CKG-054: go through site/build-reproducible, not the unexported cachedBuild
- site build reproducibility &gt; the first build does not import an unrelated working-tree input (test (test), 71-96): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `a build that reads an untracked file fails until the file is in the paths`. CKG-054
- a failed reproducibility build retains the first isolated output (test (test), 99-119): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `a failed second build keeps the first build's output`. CKG-054; TTC-032 title
- reproducibility $name (test (test.each), 121-152): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `reproducibility $name`. real behavior
- \[ { name: 'keeps the absolute source path fixed', script: "import {mkdirSync,writeFileSync} from 'no (test (test.each), 121-139): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `[{ name: 'keeps the absolute source path fixed', ... }, { name: 'reports output files that appear and disappear', ... }]`. rows stay. Values to config: REPRODUCIBILITY_CASES = the two build-script rows -&gt; tests/config/site.ts
- a run cleans isolated site output after build exit %i (test (test.each), 154-185): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `a run deletes the build's scratch copy after exit %i`. TCO-037 using instead of try/finally; glossary 'scratch copy'
- \[0, 7\] (test (test.each), 154-154): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `[0, 7]`. rows stay
- site output inventory refuses external links and passes after the fix (test (test), 187-200): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `a dist link that leaves the build folder is refused`. real behavior; CKG-025 message changes
- scoped site builds reuse only declared workspace sources for both native builds (test (test), 202-232): **keep** to `tests/unit/cli/checks/framework/site/build.test.ts` `a scope's site build copies only the workspace packages it depends on`. CKG-054; TTC-032 title; the sample writes \[\[scope\]\] records with path, and a scoped setting is a dotted key inside the record (path = "web", site.build_command = \["bun", "build.js"\]). Values to config: WORKSPACE_SITE_FILES = the eight workspace files -&gt; tests/config/site.ts

## `tests/cli/checks/general/site/output.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/site/built-pages.test.ts`. TCG-059; CKG-029 (linkinator, htmlValidate, purgecss, siteSize, sitemap move to built-pages.ts); TCG-058 the site/size and site/sitemap rows join
- $name rejects fatal, absent, and malformed reports (test (test.each), 20-51): **delete**. weak: it checks only that broken reports throw, and eight of its nine report rows pin JSON.parse and zod error texts
- \[...SITE_REPORTS\] (test (test.each), 20-20): **delete**. weak (the rows of the deleted report-failure test)
- analyzers (const, 14-18): **delete**. unused (only the deleted report-failure test used it)

## `tests/cli/checks/general/site/source.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/framework/site/source-files.test.ts`. TCG-059; CKG-029 (deadAssets, svgo, webManifest move to source-files.ts); NMU-022 site/dead-assets becomes site/unused-assets
- scoped %s assets retain their tracked outside references (test (test.each), 23-39): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `an asset in a scope's assets folder counts as used when a file outside the scope links to it`. TTC-032 title; one row ('assets') as a plain test, since 'public' and 'static' copy the alternatives of ASSET_FOLDER (packages/cli/src/config/checks/general/site.ts:38, ST1-008); the sample writes a \[\[scope\]\] record with path = "docs"
- \['assets', 'public', 'static'\] (test (test.each), 23-23): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `'assets' (one row, plain test)`. one row is left, so the test needs no table (ST1-008)
- asset references read staged bytes without borrowing an unstaged README or an untracked consumer (test (test), 41-59): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `unused-assets reads staged files, not an unstaged README or an untracked file`. TTC-032 title; NMU-022; the sample writes a \[\[scope\]\] record with path = "docs"
- a site without Git keeps its local references and reports an unused asset (test (test), 61-73): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `a site without Git keeps its local references and reports an unused asset`. real behavior
- a %s component names its asset (test (test.each), 75-86): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `a .tsx component names its asset`. real behavior; one row ('tsx') as a plain test, since the other suffixes copy TEXT_SUFFIXES (ST1-008)
- \['astro', 'vue', 'svelte', 'jsx', 'tsx'\] (test (test.each), 75-75): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `'tsx' (one row, plain test)`. one row is left, so the test needs no table (ST1-008)
- an unstaged deletion removes the tracked outside reference without failing the asset check (test (test), 88-101): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `an unstaged deletion removes the reference without failing the asset check`. real behavior; the sample writes a \[\[scope\]\] record with path = "docs"
- malformed web manifest %s produces a parse finding (test (test.each), 103-112): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `malformed web manifest %s produces a parse finding`. real behavior
- INVALID_WEB_MANIFESTS (test (test.each), 103-103): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `INVALID_WEB_MANIFESTS`. the table rows come from tests/config/site.ts
- a valid web manifest reports missing names and icons and passes after the fix (test (test), 114-135): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `a valid web manifest reports missing names and icons and passes after the fix`. real behavior
- SVG optimization $name (test (test.each), 137-171): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `SVG optimization $name`. real behavior; the three rows that rely on the per-level default of tools.svgo.min_saving_percent go, and the explicit-setting rows plus one exact-boundary row with percent 10 stay, without the level column (ST1-008); a lowered or raised svgo value is written min_saving_percent = { value = &lt;percent&gt;, reason = "..." } in \[tools.svgo\] (CFR-002)
- SVG_SAVING_CASES (test (test.each), 137-137): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `SVG_SAVING_CASES`. the table rows come from tests/config/site.ts, typed with as const (TCG-035)
- web manifests use native HTML links rather than JSON names at %s (test (test.each), 173-205): **keep** to `tests/unit/cli/checks/framework/site/source-files.test.ts` `web manifests are found through HTML link tags, not by file name`. TGN-037 run once; TTC-032 title; the sample writes a \[\[scope\]\] record with path = "app"
- levelSchema.options (test (test.each), 173-173): **delete**. TGN-037: site/webmanifest gives the same result at both levels

## `tests/cli/checks/general/structure/compiler-suppressions.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TCG-005: it tests gspot/suppressions, whose source moves to checks/general/gspot/suppressions.ts (CKG-028)
- %s compiler suppressions exclude quoted markers and require meaningful reasons (test (test.each), 15-69): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `@ts-ignore, @ts-expect-error and @ts-nocheck in %s need a reason; the same text in a string is not a comment`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; CKG-054: drop the suppressionComments half, the check run covers it
- \['javascript', 'typescript'\] (test (test.each), 15-15): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `['javascript', 'typescript']`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; rows stay

## `tests/cli/checks/general/structure/config-logic.test.ts`

- (the file) (file): **delete**. CKG-010: the house-style check structure/config-logic is deleted with its tests
- a configuration module with a function or a call is reported; literals pass (test (test), 10-31): **delete**. CKG-010: the house-style check structure/config-logic is deleted with its tests
- configuration imports follow project aliases and reject runtime owners (test (test), 33-55): **delete**. CKG-010: the house-style check structure/config-logic is deleted with its tests

## `tests/cli/checks/general/structure/env-owner.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/structure/env-reads.test.ts`. the check structure/env-owner becomes structure/env-reads (glossary)
- Swift environment reads require an owner and ignore comments and string literals (test (test), 10-40): **keep** to `tests/unit/cli/checks/general/structure/env-reads.test.ts` `Swift environment reads outside the env files are reported; comments and strings are not`. TTC-032 title; the setting is architecture.roles.environment_readers (TML-001)
- Python environment aliases use native bindings at level %s (test (test.each), 42-71): **keep** to `tests/unit/cli/checks/general/structure/env-reads.test.ts` `Python reads through os aliases are reported; shadowed and unrelated names are not`. TGN-037 run at all only; TTC-032 title; the setting is architecture.roles.environment_readers (TML-001)
- \['recommended', 'all'\] as const (test (test.each), 42-42): **delete**. TGN-037: the recommended run only shows that nothing ran
- Python scoped environment owners apply at level %s (test (test.each), 73-96): **keep** to `tests/unit/cli/checks/general/structure/env-reads.test.ts` `each scope uses its own env files`. TGN-037 run at all only; the scope is a \[\[scope\]\] record with path = "app" and architecture.roles.environment_readers = \["app/environment.py"\], written from the repository root (TML-001, CFR-003)
- \['recommended', 'all'\] as const (test (test.each), 73-73): **delete**. TGN-037

## `tests/cli/checks/general/structure/findings.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/repository.test.ts; tests/unit/cli/checks/general/naming/checks/paths.test.ts`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; TCG-012: shared repository goes; tracked-files test moves (TCG-005); folder-bans test goes to naming/paths because CKG-003 deletes structure/folder-names; TCG-033 header goes
- repository/tracked-files reports a dependency folder that git tracks (test (test), 23-46): **move** to `tests/unit/cli/checks/general/repository.test.ts` `a tracked dependency folder is reported and passes after git rm --cached`. TCG-005, TCG-012: build the sandbox inside the test
- %s folder bans come from the required naming group and accept an exact reasoned ignore (test (test.each), 48-96): **move** to `tests/unit/cli/checks/general/naming/checks/paths.test.ts` `a banned folder word such as 'shared' is reported in folder names`. the three naming checks live in naming/checks.ts, whose tests exceed 300 lines and sit in checks/ by check; CKG-003: folder-names merges into naming/paths (banned terms on folders); TCG-012; TGN-037 one level; one folder word ('shared', the only word unique to the folders group) instead of a loop over every shipped folders term, and the gspot ignore half goes because it tests the ignore command (TCG-015, ST1-018); the sample writes \[\[scope\]\] records with path = "app" and path = "app/worker"
- \['recommended', 'all'\] as const (test (test.each), 48-48): **delete**. TGN-037
- resources (const, 14-14): **delete**. TCG-012: no shared repository
- testRepository (const, 15-15): **delete**. TCG-012

## `tests/cli/checks/general/structure/import-comments.test.ts`

- (the file) (file): **delete**. CKG-055: the house-style check structure/import-comments is deleted with its tests
- Swift import runs report an intervening comment and accept moving it above the imports (test (test), 9-30): **delete**. CKG-055
- a comment between imports is reported at its line, and imports without one are clean (test (test), 32-45): **delete**. CKG-055

## `tests/cli/checks/general/structure/large-files.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/general/repository.test.ts`. TCG-005: tests repository/large-files (checks/general/repository.ts); TCG-032 header goes
- a file over the limit that is neither declared nor under LFS is reported (test (test), 14-34): **delete**. duplicate: the next test covers the over-limit file and the generated folder too
- %s repository size findings retain child, LFS, declared, and corrected-file behavior (test (test.each), 36-78): **keep** to `tests/unit/cli/checks/general/repository.test.ts` `large files are reported in every scope except LFS, generated and vendored files, and pass once shrunk`. TGN-037 one level; TTC-032 title; \[\[generated\]\] and \[\[vendored\]\] are deleted (CFR-005), so the sandbox marks data/\*\* linguist-generated and vendor/\*\* linguist-vendored in .gitattributes; the limit is limits.file_kilobytes. Values to config: LARGE_FILE_SETTINGS = the limits table with file_kilobytes -&gt; tests/config/repository.ts; LARGE_FILE_ATTRIBUTES = the .gitattributes text -&gt; tests/config/repository.ts
- \['recommended', 'all'\] as const (test (test.each), 36-36): **delete**. TGN-037

## `tests/cli/checks/general/structure/layout.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/structure/lone-files.test.ts`. TCG-047: mostly structure/lone-files tests
- folder checks count code files and preserve ignored and nested directories (test (test), 10-45): **keep** to `tests/unit/cli/checks/general/structure/lone-files.test.ts` `lone-files counts code files only and honors ignores and nested folders`. TTC-032 title. Values to config: LONE_FILE_TREE = the sixteen-file tree -&gt; tests/config/structure.ts
- naming checks leave the harness folder of scope %j alone (test (test.each), 47-71): **delete**. CKG-051 deletes the test_harness naming exemption; CKG-003 deletes structure/folder-names
- \['', 'nested'\] (test (test.each), 47-47): **delete**. CKG-051
- structural checks classify output directories by ownership at all (test (test), 73-103): **keep** to `tests/unit/cli/checks/general/structure/lone-files.test.ts` `build, dist and coverage folders are checked; folders marked linguist-generated in .gitattributes are not`. TTC-032 title; \[\[generated\]\] is deleted (CFR-005), so the sandbox marks emitted/\*\* linguist-generated in .gitattributes
- $framework $name route files need an explicit ignore and retain unignored neighbors (test (test.each), 110-131): **keep** to `tests/unit/cli/checks/general/structure/lone-files.test.ts` `a lone .astro or .svelte route file is reported when its framework is selected`. TTC-032 title; only the index.astro and +page.svelte rows stay because the .ts rows repeat 10-45, and the \[\[ignore\]\] half goes as shared ignore code (ST1-010)
- ROUTE_CASES (test (test.each), 110-110): **keep** to `tests/unit/cli/checks/general/structure/lone-files.test.ts` `ROUTE_CASES`. the two table rows come from tests/config/structure.ts
- loneFiles (function, 105-108): **inline** to `tests/unit/cli/checks/general/structure/lone-files.test.ts` `a lone .astro or .svelte route file is reported when its framework is selected`. one call is left once the ignore half goes, so it is inlined (ST1-020)

## `tests/cli/checks/general/structure/prefix-collisions.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts`. the check structure/prefix-collisions becomes structure/shared-prefixes; TCG-058 its cases row joins
- prefix checks group files and directories once and honor ignores and the threshold (test (test), 12-59): **keep** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts` `files that share a prefix are reported once per group; ignores and limits.prefix_collisions apply`. real behavior; \[reasons\] is deleted (CFR-002), so the raised limit is written prefix_collisions = { value = 3, reason = "..." } in \[limits\]. Values to config: PREFIX_TREE = the twenty-file tree -&gt; tests/config/structure.ts
- prefix groups remain distinct when directory and prefix contain newlines (test (test.skipIf), 61-76): **keep** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts` `prefix groups stay apart when folder and file names contain line breaks`. TCG-024: the skip stays
- !isPosix (test (test.skipIf), 61-61): **keep** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts` `!isWindows`. TCG-024 (Windows forbids line breaks in names); THR names isWindows
- path ignores exclude named prefix peers without hiding unrelated collisions (test (test), 78-98): **delete**. duplicate: 12-59 already shows that a paths ignore removes one prefix group and keeps another, and the matching is the shared code of execution/ignores (ST1-009)
- prefix checks exempt scripts throughout %s and retain neighboring collisions (test (test.each), 100-145): **keep** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts` `hook scripts under .husky do not count; other files beside them still do`. TTC-032 title; one row ('.husky') as a plain test, since the other three copy HOOK_DIRECTORIES (packages/cli/src/config/repository/hooks.ts:15, ST1-009); the sample writes a \[\[scope\]\] record with path = "app"
- \['.githooks', '.husky', '.git-hooks', '.mise/tasks/hook'\] (test (test.each), 100-100): **keep** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts` `'.husky' (one row, plain test)`. one row is left, so the test needs no table (ST1-009)
- $prefix exemption follows selected $configuration scopes (test (test.each), 147-180): **delete**. fake (TCG-007: nine rows copy the shipped prefix lists, and the recommended half repeats level filtering)
- PREFIX_OWNER_CASES (test (test.each), 147-147): **delete**. fake (TCG-007: the copied prefix rows of the deleted test)
- all NestJS declaration kinds and spec suffixes follow scope ownership while JSX and unknown kinds still collide (test (test), 182-213): **keep** to `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts` `NestJS kind suffixes do not count in NestJS scopes; JSX files and unknown kinds still do`. TCG-007: controller and service instead of the 16-kind copy; the sample writes \[\[scope\]\] records with path = "app", "app/deep" and "sibling"

## `tests/cli/checks/general/structure/private-before-public.test.ts`

- (the file) (file): **delete**. CKG-055: the house-style check structure/private-before-public is deleted with its tests
- a private Swift setter leaves its getter visible to other files (test (test), 11-30): **delete**. CKG-055
- Swift declaration order identifies private types and extensions and accepts both before shared declarations (test (test), 32-63): **delete**. CKG-055
- shell declaration order resets between files and requires main last (test (test), 65-93): **delete**. CKG-055
- a private function declared under a public one is reported while private declarations above it pass (test (test), 95-106): **delete**. CKG-055

## `tests/cli/checks/general/structure/suppressions.test.ts`

- (the file) (file): **split** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts; tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TCG-005 (gspot/suppressions); merged with compiler-suppressions and its data it exceeds 300 lines, so it splits: reason rules and the syntax each tool obeys
- suppression comments match native $name (describe (describe.each), 25-92): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `$name directives that gspot sees are the ones $name obeys`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; CKG-054: compare the suppressions findings with the real tool, not suppressionComments; glossary 'suppression syntax'
- suppression comments match native $name &gt; \[ { name: 'ESLint', configuration: 'javascript', extension: 'js', form: 'eslint', (describe (describe.each), 25-65): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `[{ name: 'ESLint', ... }, { name: 'Stylelint', ... }, { name: 'HTML Validate', ... }]`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; rows move with the test
- suppression comments match native $name &gt; recognizes $comment (test (test.each), 86-91): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `recognizes $comment`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; rows move
- suppression comments match native $name &gt; sources (test (test.each), 86-86): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `sources`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; rows move
- suppression reasons immediately above %s require an adjacent explanation comment (test (test.each), 94-120): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `a suppression in %s needs its reason on the line directly above`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; CKG-023: the message no longer prints the regular expression
- SUPPRESSION_REASON_CASES (test (test.each), 94-94): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `SUPPRESSION_REASON_CASES`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; the table rows come from tests/config/suppressions.ts
- Vale directives fail at %s (test (test.each), 122-156): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `a <!-- vale off --> comment is reported and passes once removed`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TCG-053: drop the fence and inline-code cases (the integration test covers them); TGN-037 one level. Values to config: VALE_OFF_GUIDE = the guide.md text with the vale off comment -&gt; tests/config/suppressions.ts; VALE_FIXED_GUIDE = the guide.md text without it -&gt; tests/config/suppressions.ts
- \['recommended', 'all'\] as const (test (test.each), 122-122): **delete**. TGN-037
- HTML suppression reasons exclude the %s terminator and still require a reason (test (test.each), 158-192): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `an HTML suppression that ends with %s still needs a reason`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; CKG-023 drop reasonForm; CKG-054 check through the check run
- \['--&gt;', '--!&gt;'\] (test (test.each), 158-158): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `['-->', '--!>']`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; rows stay
- forbidden security suppressions fail at level %s and removing the marker clears the finding (test (test.each), 194-223): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `a nosemgrep comment is reported even with a reason`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; TGN-037 one level
- \['recommended', 'all'\] as const (test (test.each), 194-194): **delete**. TGN-037
- shared noqa text is attributed only to the tool that reads the file (test (test), 225-243): **keep** to `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` `noqa in a SQL file is sqlfluff's; noqa in a Python file is ruff's`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; real behavior; \[agent_rules\] becomes \[rules\]
- suppression comments in %s distinguish strings and templates from executable directives (test (test.each), 245-286): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `eslint comments inside strings and templates in .%s files are not directives`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; CKG-054 through the check run. Values to config: QUOTED_ESLINT_COMMENTS = the 13-line source -&gt; tests/config/suppressions.ts
- \['js', 'ts'\] (test (test.each), 245-245): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `['js', 'ts']`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; rows move
- JSX text and quoted attributes do not become directives, but an empty expression comment does (test (test), 288-307): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `eslint comments in JSX text and quoted attributes are not directives; an empty expression comment is`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; CKG-054. Values to config: JSX_COMMENTS = the 6-line source -&gt; tests/config/suppressions.ts
- eslint (const, 22-22): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `eslint`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; used by the ESLint comparison rows; it stays in the test file because it is an ESLint instance built at load time
- html (const, 23-23): **move** to `tests/unit/cli/checks/general/gspot/suppressions/syntax.test.ts` `html`. the tests of checks/general/gspot/suppressions.ts exceed 300 lines, so they sit in suppressions/ by behavior; used by the HTML Validate comparison rows; it stays in the test file because it is an HtmlValidate instance built at load time

## `tests/cli/checks/general/structure/test-placement.test.ts`

- (the file) (file): **delete**. CKG-011: the house-style check structure/test-placement is deleted with its tests
- test placement preserves test siblings, declarations, and the declared harness (test (test), 16-33): **delete**. CKG-011
- imported framework assertions belong beside tests: %s (test (test.each), 35-47): **delete**. CKG-011
- ASSERTION_SOURCES (test (test.each), 35-35): **delete**. CKG-011
- matcher data and unrelated or shadowed bindings remain support: %s (test (test.each), 49-67): **delete**. CKG-011
- HARNESS_SOURCES (test (test.each), 49-49): **delete**. CKG-011
- a custom harness owns its support and absence of a harness produces no finding (test (test), 69-80): **delete**. CKG-011
- NestJS spec files and Jest test directories keep their native framework layout (test (test), 82-97): **delete**. CKG-011
- root and child test placement use scope-owned files and normalized harness paths (test (test), 99-122): **delete**. CKG-011
- test placement keeps reviewed ignores and remains an all-level convention (test (test), 124-138): **delete**. CKG-011: the house-style check structure/test-placement is deleted with its tests
- options (const, 14-14): **delete**. CKG-011

## `tests/cli/checks/general/structure/trivial-functions.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`. same source file, under the tests/unit/ root
- Swift reports constructors, accessors, decorated methods, nested functions, and leaves closures in place (test (test), 14-36): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `Swift reports constructors, accessors, decorated methods and nested functions, and leaves closures alone`. TCG-004: compare full findings without the trivial-function filter. Values to config: SWIFT_FUNCTION_LIMITS = '\[limits.swift\]\\nmin_function_statements = 2\\n' (written five times in this file) -&gt; tests/config/structure.ts
- Swift includes implicit getters, property readers, and subscript accessors (test (test), 38-50): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `Swift includes implicit getters, property readers and subscript accessors`. TCG-004
- Swift $name reports the trivial function at line $line (test (test.each), 52-71): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `Swift $name reports the trivial function at line $line`. TCG-004; the existing rows stay and no rows are added
- \[...TRIVIAL_FUNCTION_CASES\] (test (test.each), 52-52): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `TRIVIAL_FUNCTION_CASES`. the table rows come from tests/config/structure.ts
- Swift source with substantial function bodies passes the trivial-function check (test (test), 73-83): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `Swift source with substantial function bodies passes`. real behavior
- Python counts nested control flow and reports decorated methods and leaves lambda expressions in place (test (test), 85-109): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `Python counts nested control flow, reports decorated methods and leaves lambdas alone`. TCG-004

## `tests/config/cli/checks/general/dependencies/manifest-policy.ts`

- (the file) (file): **delete**. unused (MANIFEST and REGISTRY_ALIASES served only deleted tests)
- MANIFEST (const exported, 1-1): **delete**. unused (only deleted tests used it)
- REGISTRY_ALIASES (const exported, 4-4): **delete**. TCG-018: the alias test goes

## `tests/config/cli/checks/general/dependencies/policy.ts`

- (the file) (file): **move** to `tests/config/dependencies.ts`. TCG-058: each check runs its own rows in its own test file; every surviving item goes to tests/config/dependencies.ts, and the test files import their rows from it
- ONE_HOUR_S (const exported, 5-5): **inline** to `tests/config/dependencies.ts` `BUN_RELEASE_AGE_CASES`. TTC-037: one use, inside one row of BUN_RELEASE_AGE_CASES in config
- SEVEN_DAYS_S (const exported, 6-6): **move** to `tests/config/dependencies.ts` `SEVEN_DAYS_IN_SECONDS`. plain name; it stays beside the BUN_RELEASE_AGE_CASES rows that use it, so stop exporting
- INVALID (const exported, 8-24): **delete**. TCG-011
- CLEAN (const exported, 26-26): **inline** to `tests/config/dependencies.ts` `DEPENDENCIES_REPOSITORY`. TTC-037: one use
- FOREIGN_PNPM (const exported, 28-29): **inline** to `tests/config/dependencies.ts` `LOCKFILE_HOST_CASES`. TTC-037: one use, inside one row of LOCKFILE_HOST_CASES in config
- FOREIGN_YARN (const exported, 31-32): **inline** to `tests/config/dependencies.ts` `LOCKFILE_HOST_CASES`. TTC-037: one use, inside one row of LOCKFILE_HOST_CASES in config
- REPOSITORY (const exported, 34-38): **move** to `tests/config/dependencies.ts` `DEPENDENCIES_REPOSITORY`. TCG-058: used by bun-release-age.test.ts and lockfile-hosts.test.ts; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- CASES (const exported, 40-110): **split** to `tests/config/dependencies.ts` `BUN_RELEASE_AGE_CASES; LOCKFILE_HOST_CASES`. TCG-058: each check's rows run with runFindingCase in its own test file, not in cases.test.ts; multi-row tables stay in config, and bun-release-age.test.ts and lockfile-hosts.test.ts import them; tests/config imports only tests/config, so the values drop their FindingCase annotation and are written as const, and the tests that read them check the type

## `tests/config/cli/checks/general/dependencies/version-pairs.ts`

- (the file) (file): **move** to `tests/config/react.ts`. TCG-019: a multi-row table, so it goes to config
- VERSION_PAIR_CASES (const exported, 1-34): **move** to `tests/config/react.ts` `VERSION_PAIR_CASES`. TCG-019: the 4 React and Next.js version pairs, a multi-row table, so config; use findings: 0 or 1 without as const

## `tests/config/cli/checks/general/docs.ts`

- (the file) (file): **move** to `tests/config/docs.ts`. one user; TCG-062 comments go; it keeps its file name in tests/config/
- DOC_TASK_FILES (const exported, 2-16): **move** to `tests/config/docs.ts` `DOC_TASK_FILES`. test data of the docs check, kept in config
- DOC_TASK_SCOPES (const exported, 19-20): **move** to `tests/config/docs.ts` `DOC_TASK_SCOPES`. test data of the docs check, kept in config; the sample writes \[\[scope\]\] records with path = "app", "app/nested", "app/empty" and "sibling"
- DOC_TASK_FINDINGS (const exported, 23-32): **move** to `tests/config/docs.ts` `DOC_TASK_FINDINGS`. test data of the docs check, kept in config
- DOC_FENCE_PATH_CASES (const exported, 35-44): **move** to `tests/config/docs.ts` `DOC_FENCE_PATH_CASES`. test data of the docs check, kept in config

## `tests/config/cli/checks/general/duplication.ts`

- (the file) (file): **delete**. both constants go with the deleted tests (ST1-002)
- VALID_REPORT (const exported, 1-1): **delete**. used only by the deleted tests (ST1-002)
- EXECUTION_FAILURES (const exported, 3-28): **delete**. rows of the deleted test (ST1-002)

## `tests/config/cli/checks/general/generated-code.ts`

- (the file) (file): **delete**. TGN-037: the level and scope table goes
- GENERATED_SCOPES (const exported, 3-8): **delete**. TGN-037

## `tests/config/cli/checks/general/gspot.ts`

- (the file) (file): **split** to `tests/config/unused-entries.ts; tests/config/naming/settings.ts`. TCG-031; CKG-005 (naming rows); CKG-006 (ignore rows deleted); the two tables go to config by topic
- AUTHORED_PATH_CASES (const exported, 2-86): **move** to `tests/config/unused-entries.ts` `UNUSED_PATH_CASES`. one user; glossary retires 'authored'; \[agent_rules\] becomes \[rules\]; the cases "excluded sources and negative selectors" (root exclude is deleted) and "empty disabling paths" (the "" form is deleted) go; the other four cases write \[\[architecture.module\]\] records without reason, architecture.roles.environment_readers (roles.config is deleted), no \[reasons\] table, \[\[scope\]\] records whose paths are written from the repository root (case 2 keeps its unmatched app/gone.sh and app/deep/gone.sh, written in full), \[\[site.size_limit\]\] with kilobytes, docs.allowed_urls and rules.instruction_files (rules.folder is deleted) (TML-001, TML-003, TMF-003, TML-010, CFR-002, CFR-003)
- NATIVE_EXCEPTION_CASES (const exported, 88-233): **move** to `tests/config/naming/settings.ts` `UNUSED_NAME_CASES`. CKG-005: the three naming rows move; CKG-006: the four ignore rows go; TCG-045 rename; allowed is allowed_names in \[\[naming.override\]\] records; the case "child Python declarations satisfy normalized inherited paths" goes because record lists live only at the root, so it repeats the sibling case; the scope tables are \[\[scope\]\] records (CFR-003, CFR-004)

## `tests/config/cli/checks/general/license-origins.ts`

- (the file) (file): **move** to `tests/config/licenses.ts`. TCG-034: the license test data goes to config
- EXCEPTION_ENTRY (const exported, 2-2): **move** to `tests/config/licenses.ts` `ALLOWED_PACKAGE_ENTRY`. a static value, so it goes to config instead of the setup helper; glossary allowed package; the record has no license field (TML-009), so the entry is only reason = "...", and the helper supplies name and version
- EXCEPTION_MEMBERSHIP (const exported, 5-72): **move** to `tests/config/licenses.ts` `ALLOWED_PACKAGE_SCOPE_CASES`. TCG-034 expected findings in each row; TCG-045 and glossary (allowed package); \[\[licenses.allowed_package\]\] lives only at the root and has no license field (CFR-004, TML-009), so the four scoped-origin rows, the row "local changed license fails" and the 'tooling and lockfile membership' row (ST1-011) go; three root rows stay in config

## `tests/config/cli/checks/general/licenses.ts`

- (the file) (file): **move** to `tests/config/licenses.ts`. TCG-034; TCG-002; the surviving license data goes to config
- LICENSE_SETTINGS (const exported, 2-2): **move** to `tests/config/licenses.ts` `LICENSE_SETTINGS`. default of the shared license sandbox helper, a constant, so config; tests/setup/licenses.ts and scan.test.ts import it
- SCANNER_FAILURES (const exported, 4-8): **move** to `tests/config/licenses.ts` `SCANNER_FAILURES`. static rows of the scan test, so config; the 'malformed JSON' row goes (ST1-011)
- UNUSED_LICENSE_FILES (const exported, 10-14): **delete**. TCG-002
- LICENSE_EXCEPTIONS (const exported, 17-58): **move** to `tests/config/licenses.ts` `ALLOWED_PACKAGE_CASES`. TCG-045; static rows of the allowed-package test, so config; the 'corrected exception' row goes (ST1-011), and the rows "stale exception" and "changed license" go with the deleted license cross-check (TML-009)
- PROJECT_FINDINGS (const exported, 61-65): **move** to `tests/config/licenses.ts` `EXPECTED_SCAN_FINDINGS`. a three-row table, so config

## `tests/config/cli/checks/general/naming/contracts.ts`

- (the file) (file): **move** to `tests/config/naming/settings.ts`. the surviving naming constants go to tests/config/naming/settings.ts
- NAME_WORDS (const exported, 1-1): **move** to `tests/config/naming/settings.ts` `NAME_WORDS`. used by the limit tests; static data, so config
- DOMAIN_SOURCE (const exported, 3-5): **delete**. unused (only the deleted ordinary-words test used it)
- SCOPE_CEILINGS (const exported, 7-11): **move** to `tests/config/naming/settings.ts` `SCOPE_LIMITS`. glossary 'limit', not 'ceiling'; static data, so config
- TECHNICAL_NAMES (const exported, 13-29): **delete**. fake: a copy of 15 of the shipped NUMERIC_WORDS (packages/cli/src/config/checks/general/naming.ts:34); the kept tests use base64 inline (TCG-029, ST1-004)
- NAMING_LANGUAGES (const exported, 31-31): **move** to `tests/config/naming/settings.ts` `NAMING_LANGUAGES`. used by the limit tests; static data, so config
- NAMING_CATEGORIES (const exported, 33-48): **delete**. padding: the digit rule reads no category, so the loop over 14 categories adds nothing (ST1-004)
- NATIVE_NAME_CATEGORIES (const exported, 51-62): **move** to `tests/config/naming/settings.ts` `LINTER_CHECKED_CATEGORIES`. glossary retires 'native', and 'owner' outside the ownership log; two rows, kept in config (ST1-005)

## `tests/config/cli/checks/general/naming/extract.ts`

- (the file) (file): **move** to `tests/config/naming/sources.ts`. source samples with their expected names, kept in config (TCG-025)
- SWIFT_EXTRACTOR_SOURCE (const exported, 1-15): **move** to `tests/config/naming/sources.ts` `SWIFT_EXTRACTOR_SOURCE`. one user; a static source sample, so config
- PYTHON_EXTRACTOR_SOURCE (const exported, 17-43): **move** to `tests/config/naming/sources.ts` `PYTHON_EXTRACTOR_SOURCE`. one user; a static source sample, so config
- TYPESCRIPT_EXTRACTOR_SOURCE (const exported, 45-59): **move** to `tests/config/naming/sources.ts` `TYPESCRIPT_EXTRACTOR_SOURCE`. one user; a static source sample, so config
- TYPESCRIPT_NAMES (const exported, 62-71): **move** to `tests/config/naming/sources.ts` `EXPECTED_TYPESCRIPT_NAMES`. TCG-037 naming of expected maps; static data, so config
- PYTHON_NAMES (const exported, 73-83): **move** to `tests/config/naming/sources.ts` `EXPECTED_PYTHON_NAMES`. TCG-037 naming of expected maps; static data, so config
- SWIFT_NAMES (const exported, 85-94): **move** to `tests/config/naming/sources.ts` `EXPECTED_SWIFT_NAMES`. TCG-037 naming of expected maps; static data, so config
- SOURCE_ORDER_CASES (const exported, 96-121): **move** to `tests/config/naming/sources.ts` `SOURCE_ORDER_CASES`. one user; static rows, so config
- AUTHORED_NAME_CASES (const exported, 123-155): **move** to `tests/config/naming/sources.ts` `NAME_POSITION_CASES`. glossary retires 'authored'; static rows, so config

## `tests/config/cli/checks/general/naming/ownership.ts`

- (the file) (file): **move** to `tests/config/naming/settings.ts`. TCG-007: the long copied lists shrink to one or two names; the one surviving item goes to tests/config/naming/settings.ts
- FRAMEWORK_CONTRACTS (const exported, 2-19): **move** to `tests/config/naming/settings.ts` `FRAMEWORK_NAMES`. TCG-007: one or two names per framework; 'contracts' is filler; static rows, so config
- BASH_NAMES (const exported, 21-46): **delete**. unused (only the deleted Bash test and the deleted FOREIGN_NAMES used it)
- PYTHON_NAMES (const exported, 48-95): **delete**. unused (only the deleted Python test and the deleted FOREIGN_NAMES used it)
- LIFECYCLE_NAMES (const exported, 97-97): **delete**. unused (only the deleted Python test and the deleted FOREIGN_NAMES used it)
- FOREIGN_NAMES (const exported, 99-109): **delete**. TCG-007: 80 names built from copied lists; the test uses two names

## `tests/config/cli/checks/general/naming/paths.ts`

- (the file) (file): **move** to `tests/config/naming/sources.ts`. a static file list, so config
- MIGRATION_NAMING_FILES (const exported, 1-4): **move** to `tests/config/naming/sources.ts` `MIGRATION_FILES`. one user; shorter name; a static file list, so config

## `tests/config/cli/checks/general/naming/policy.ts`

- (the file) (file): **split** to `tests/config/naming/settings.ts; tests/config/naming/sources.ts`. settings text and file trees go to their config topic files
- SCOPE_POLICY (const exported, 1-2): **move** to `tests/config/naming/settings.ts` `ALLOWED_NAME_SETTINGS`. glossary settings; TPP-029 write as a template string with line breaks; static settings text, so config; root \[\[naming.override\]\] records with allowed_names (one without paths, one with paths = \["web/\*\*"\] for remoteRecord, one with paths = \["worker/\*\*"\] for remote_record) and \[\[scope\]\] records for web and worker, with no \[naming\] allowed and no scoped naming tables (TML-005, CFR-004)
- TEST_PATH_FILES (const exported, 4-15): **move** to `tests/config/naming/sources.ts` `TEST_PATH_FILES`. one user; a static file list, so config
- TEST_PATH_POLICY (const exported, 17-18): **move** to `tests/config/naming/settings.ts` `TEST_PATH_SETTINGS`. glossary settings; static settings text, so config; \[\[scope\]\] records with path, and the web scope writes test_files = \["apps/web/verification/\*\*"\] from the repository root (CFR-003)

## `tests/config/cli/checks/general/naming/vocabulary.ts`

- (the file) (file): **split** to `tests/config/naming/sources.ts; tests/config/naming/settings.ts`. TCG-008; file trees and settings text go to their config topic files
- GROUP_SOURCE (const exported, 1-4): **delete**. unused (only the deleted shipped-groups test used it)
- NUMBERED_FILES (const exported, 6-9): **move** to `tests/config/naming/sources.ts` `NUMBERED_FILES`. one user; a static file list, so config
- ORDINARY_WORDS (const exported, 11-11): **move** to `tests/config/naming/settings.ts` `ORDINARY_WORDS`. TCG-029: one combined list (data, message, values, id, response, category, service, generate), kept in config
- RESERVED_FILES (const exported, 13-17): **delete**. unused: only the deleted naming.reserved test used it (TML-005)
- RESTORED_TERMS (const exported, 19-35): **delete**. TCG-008
- RESERVED_POLICY (const exported, 37-40): **delete**. naming.reserved is deleted (TML-005)
- PREFIX_EXCEPTION (const exported, 42-44): **move** to `tests/config/naming/settings.ts` `NUMBERED_PREFIX_OVERRIDE`. TCG-045; static settings text, so config; the record header is \[\[naming.override\]\]
- REPEATED_EXCEPTION (const exported, 46-48): **delete**. the override field names is deleted (TML-005), and only the deleted repeated-word test used it

## `tests/config/cli/checks/general/prose.ts`

- (the file) (file): **move** to `tests/config/prose.ts`. static Vale data goes to config, beside VALE_INI
- DIAGNOSTIC (const exported, 1-1): **move** to `tests/config/prose.ts` `VALE_ALERT`. glossary: Vale 'alert'; 'diagnostic' is retired; an object used by two tests, so config
- EXECUTION_FAILURES (const exported, 4-7): **delete**. TCG-010

## `tests/config/cli/checks/general/secrets/env/files.ts`

- (the file) (file): **move** to `tests/config/repository.ts`. static repository data goes to config
- STAGED_CASES (const exported, 2-43): **delete**. unused (the kept test holds its one 'selected' case inline)
- TRACKED_PATTERNS (const exported, 46-81): **move** to `tests/config/repository.ts` `TRACKED_PATTERNS`. add nested/.dev.vars from the deleted first test (TCG-013); TPP-029 scopes as a template string; static data, so config; the sample writes \[\[scope\]\] records with path = "python", "python/deep" and "swift", and removed_configurations stays a \[\[scope\]\] key

## `tests/config/cli/checks/general/secrets/env/readers.ts`

- (the file) (file): **move** to `tests/config/secrets.ts`. the source, settings and expected findings are static data, so config
- READER_FILES (const exported, 1-8): **move** to `tests/config/secrets.ts` `READER_FILES`. one user; static data, so config
- READER_TABLES (const exported, 10-11): **move** to `tests/config/secrets.ts` `READER_TABLES`. one user; static data, so config
- READER_TEMPLATE (const exported, 13-14): **move** to `tests/config/secrets.ts` `READER_EXAMPLE`. NMU-024 'template' becomes 'example'; static data, so config
- READER_FINDINGS (const exported, 16-53): **move** to `tests/config/secrets.ts` `READER_FINDINGS`. one user; static data, so config
- PROJECT_READER_FILES (const exported, 55-62): **move** to `tests/config/secrets.ts` `SCOPE_READER_FILES`. glossary: 'project' for a scope is retired, and 'scoped' is on this repository's naming.banned list; static data, so config
- PROJECT_READER_TABLES (const exported, 64-65): **move** to `tests/config/secrets.ts` `SCOPE_READER_TABLES`. glossary; TPP-029 template string; static data, so config; the sample writes \[\[scope\]\] records with path and the dotted keys secrets.env_examples and secrets.reader_functions; 'scoped' is on this repository's naming.banned list
- PROJECT_READER_CORRECTIONS (const exported, 67-71): **move** to `tests/config/secrets.ts` `SCOPE_READER_FIXES`. glossary: 'fix', not 'correction'; 'scoped' is on this repository's naming.banned list; static data, so config

## `tests/config/cli/checks/general/security.ts`

- (the file) (file): **split** to `tests/config/security.ts; tests/unit/cli/checks/general/security.test.ts`. TCG-021: the SARIF reports are CodeQL's, the security configuration's data, so they go to tests/config/security.ts; JAVASCRIPT_LANGUAGES stays inline in security.test.ts
- JAVASCRIPT_LANGUAGES (const exported, 1-2): **inline** to `tests/unit/cli/checks/general/security.test.ts` `%s`. TCG-021: one short string, inline in the CodeQL test
- CODEQL_REPORT (const exported, 4-29): **move** to `tests/config/security.ts` `CODEQL_REPORT`. TCG-021: a SARIF report from CodeQL, the security configuration's data, so tests/config/security.ts
- CYCLIC_REPORT (const exported, 31-43): **move** to `tests/config/security.ts` `CYCLIC_REPORT`. TCG-021: a SARIF report from CodeQL, the security configuration's data, so tests/config/security.ts
- ENCODED_REPORT (const exported, 45-65): **move** to `tests/config/security.ts` `ENCODED_REPORT`. TCG-021: a SARIF report from CodeQL, the security configuration's data, so tests/config/security.ts

## `tests/config/cli/checks/general/site/output.ts`

- (the file) (file): **move** to `tests/config/site.ts`. TCG-058 the site/size and site/sitemap rows leave cases.test.ts; static data, so config
- CASES (const exported, 6-21): **move** to `tests/config/site.ts` `BUILT_PAGE_CASES`. TCG-058: a multi-row table in config that built-pages.test.ts imports; \[site\] max_kilobytes is a \[\[site.size_limit\]\] record with paths and kilobytes, its paths written from the repository root with the build folder (dist/\*\*/\*.html) (TMF-008); tests/config imports only tests/config, so the value drops its FindingCase annotation and is written as const, and the test that reads it checks the type; no new rows: the CKG-001 fix ships without an index-sitemap row
- REPOSITORY (const exported, 24-27): **move** to `tests/config/site.ts` `SITE_REPOSITORY`. TCG-058: one user after the move; static data, so config; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- SITE_REPORTS (const exported, 30-61): **delete**. unused (only the deleted report-failure test used it)

## `tests/config/cli/checks/general/site/source.ts`

- (the file) (file): **move** to `tests/config/site.ts`. static site data goes to config
- INVALID_WEB_MANIFESTS (const exported, 3-3): **move** to `tests/config/site.ts` `INVALID_WEB_MANIFESTS`. one user; static data, so config
- ORIGINAL_SVG (const exported, 6-7): **move** to `tests/config/site.ts` `ORIGINAL_SVG`. one user; static data, so config
- SVG_SAVING_CASES (const exported, 9-28): **move** to `tests/config/site.ts` `SVG_SAVING_CASES`. TCG-035: tests/config imports only tests/config, so it is written as const without the SvgSavingCase type, which goes, and the test that reads it checks the type; the three level-default rows go (ST1-008)
- MANIFEST_LINKS (const exported, 31-32): **move** to `tests/config/site.ts` `MANIFEST_LINKS`. one user; TCG-062 comment goes; static data, so config

## `tests/config/cli/checks/general/structure/compiler-suppressions.ts`

- (the file) (file): **move** to `tests/config/suppressions.ts`. TCG-005; the suppression test data goes to config
- COMPILER_DIRECTIVES (const exported, 2-2): **move** to `tests/config/suppressions.ts` `TYPESCRIPT_SUPPRESSIONS`. one user; glossary: 'directive' is retired in gspot's names, and the values are the @ts- suppression kinds; static data, so config
- COMPILER_REASON (const exported, 4-4): **move** to `tests/config/suppressions.ts` `COMPILER_REASON`. one user; static data, so config

## `tests/config/cli/checks/general/structure/env-owner.ts`

- (the file) (file): **move** to `tests/config/structure.ts`. static source samples go to config
- ENVIRONMENT_SOURCE (const exported, 2-6): **move** to `tests/config/structure.ts` `SWIFT_ENVIRONMENT_SOURCE`. one user; the name says which language; static data, so config
- PYTHON_ENVIRONMENT_SOURCE (const exported, 9-24): **move** to `tests/config/structure.ts` `PYTHON_ENVIRONMENT_SOURCE`. one user; static data, so config

## `tests/config/cli/checks/general/structure/findings.ts`

- (the file) (file): **split** to `tests/config/bash/checks.ts; tests/config/structure.ts; tests/config/suppressions.ts; tests/config/unused-entries.ts`. TCG-058: the repository and each check's rows go to config by topic, and each test file imports its rows; one tests/config/bash.ts would exceed 300 lines (about 375), so gspot's Bash check cases go to bash/checks.ts and the ShellCheck, Bats, syntax and sample-script data to bash/tools.ts
- REPOSITORY (const exported, 5-13): **move** to `tests/config/bash/checks.ts` `BASH_REPOSITORY`. TCG-058: used by five test files after the move, beside CLEAN_BASH_SCRIPT; gspot's Bash check data goes to bash/checks.ts because one bash.ts would exceed 300 lines; tests/config imports only tests/config, so the value drops its InProcessScenario annotation and is written as const, and the test that reads it checks the type
- CASES (const exported, 15-92): **split** to `tests/config/structure.ts; tests/config/suppressions.ts; tests/config/unused-entries.ts` `LONE_FILE_CASES; SHARED_PREFIX_CASES; FILE_FOLDER_CLASH_CASES; SUPPRESSION_CASES; UNUSED_ENTRY_CASES`. TCG-058: multi-row tables go to config: the three structure lists in structure.ts (the stem-collisions row goes to file-folder-clashes), SUPPRESSION_CASES in suppressions.ts, UNUSED_ENTRY_CASES in unused-entries.ts; the folder-names row is deleted with the check (CKG-003); tests/config imports only tests/config, so the values drop their FindingCase annotation and are written as const, and the tests that read them check the type

## `tests/config/cli/checks/general/structure/layout.ts`

- (the file) (file): **move** to `tests/config/structure.ts`. static data goes to config
- ROUTE_CASES (const exported, 2-7): **move** to `tests/config/structure.ts` `ROUTE_CASES`. one user; two rows (ST1-010), kept in config

## `tests/config/cli/checks/general/structure/prefix-collisions.ts`

- (the file) (file): **delete**. unused (both constants go: NESTJS_KIND_CASES and PREFIX_OWNER_CASES)
- PREFIX_OWNER_CASES (const exported, 2-12): **delete**. fake (TCG-007: a copy of the shipped prefix lists; only the deleted test used it)
- NESTJS_KIND_CASES (const exported, 15-32): **delete**. TCG-007: a copy of the 16 NestJS kinds; the test uses controller and service inline

## `tests/config/cli/checks/general/structure/suppressions.ts`

- (the file) (file): **move** to `tests/config/suppressions.ts`. the suppression test data keeps its file name in tests/config/
- SUPPRESSION_COMMENTS (const exported, 2-14): **move** to `tests/config/suppressions.ts` `ESLINT_SUPPRESSIONS`. one user; named like its two siblings; TCG-062 comments go; static data, so config
- STYLELINT_SUPPRESSIONS (const exported, 17-26): **move** to `tests/config/suppressions.ts` `STYLELINT_SUPPRESSIONS`. one user; static data, so config
- HTML_VALIDATE_SUPPRESSIONS (const exported, 29-37): **move** to `tests/config/suppressions.ts` `HTML_VALIDATE_SUPPRESSIONS`. one user; static data, so config
- SUPPRESSION_REASON_CASES (const exported, 40-67): **move** to `tests/config/suppressions.ts` `SUPPRESSION_REASON_CASES`. one user; static data, so config

## `tests/config/cli/checks/general/structure/test-placement.ts`

- (the file) (file): **delete**. CKG-011: the house-style check structure/test-placement is deleted with its tests
- TEST_FILES (const exported, 2-19): **delete**. CKG-011
- ASSERTION_SOURCES (const exported, 22-26): **delete**. CKG-011
- HARNESS_SOURCES (const exported, 29-33): **delete**. CKG-011

## `tests/config/cli/checks/general/structure/trivial-functions.ts`

- (the file) (file): **move** to `tests/config/structure.ts`. static data goes to config
- SWITCHED (const exported, 1-2): **inline** to `tests/config/structure.ts` `TRIVIAL_FUNCTION_CASES`. TTC-037: one use, inside one row of TRIVIAL_FUNCTION_CASES in config
- NEGATED (const exported, 4-5): **inline** to `tests/config/structure.ts` `TRIVIAL_FUNCTION_CASES`. TTC-037: one use, inside one row of TRIVIAL_FUNCTION_CASES in config
- TRIVIAL_FUNCTION_CASES (const exported, 7-10): **move** to `tests/config/structure.ts` `TRIVIAL_FUNCTION_CASES`. one user; static data, so config
- PROPERTY_READERS (const exported, 13-23): **move** to `tests/config/structure.ts` `PROPERTY_READERS`. one user; static data, so config
