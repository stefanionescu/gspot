# Unit tests of the other checks

These are the unit tests of the built-in checks for languages, frameworks, libraries, platforms, databases,
infrastructure, and testing tools: the TypeScript functions in `packages/cli/src/checks/` outside `general/`. Most
tests write a small sandbox, open a gspot session on it, run one check, and compare the findings; some replace the
process runner with a mock, so no real tool runs. The target: each test file sits under `tests/unit/cli/` at the path
of the source file it tests (the `tool/` group becomes `infrastructure/` and `testing/`, as in the configurations),
its data sits in `tests/config/<topic>.ts`, and every weak, fake, duplicate, or self-policing test is deleted, not
repaired. No new tests are planned; after the code is cut, the "Untested logic" rule decides each untested behavior.

## Test data

Test constants and sample text go to `tests/config/<topic>.ts`, one file per topic. Only a single short literal used
by one test file stays in that file, and so do values computed when the test file starts. A `tests/config/` file
imports only `tests/config/`: it writes its gspot.toml as text and carries no type annotations (ST5-015). No
`tests/types/` file is needed for these tests (TCO-029). The placement rows name each value and its file. The files
these tests use:

| File                              | Holds                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `tests/config/bash/checks.ts`     | the Bash sandbox and the rows of each Bash check, safety and inline-script samples          |
| `tests/config/cloudflare.ts`      | the Wrangler schema and files                                                               |
| `tests/config/docker.ts`          | Trivy reports, Compose sources, Docker ignore and context rows                              |
| `tests/config/expo.ts`            | Expo Doctor results and reports                                                             |
| `tests/config/generated-files.ts` | the one generator script and the stale-file rows of every generator                         |
| `tests/config/github-actions.ts`  | the called workflow and its references                                                      |
| `tests/config/html.ts`            | active and inert HTML URLs                                                                  |
| `tests/config/nextjs.ts`          | Next.js routes, package.json, build output, rows                                            |
| `tests/config/nginx.ts`           | nginx configuration samples                                                                 |
| `tests/config/postgres.ts`        | grant files, frozen-migration rows, row-security source                                     |
| `tests/config/python/checks.ts`   | Python module samples and rows, docstring styles, the import-linter report                  |
| `tests/config/sql.ts`             | foreign SQL dialect rows                                                                    |
| `tests/config/supabase.ts`        | storage policies, service-key settings and readers, generated types                         |
| `tests/config/svelte.ts`          | svelte-check projects and output                                                            |
| `tests/config/swift.ts`           | Swift build selection and purposes, snapshot rows, XCTest settings and failures, sleep rows |
| `tests/config/translations.ts`    | translation files, sandbox, rows                                                            |
| `tests/config/trpc.ts`            | tRPC imports, types, modules, files                                                         |
| `tests/config/xcode.ts`           | asset settings rows, invalid test plans and resources                                       |

## Findings

### TCO-002: One function, "is the generated file stale", is tested four times with four copies of the same scaffold

- Where: `tests/cli/checks/tool/openapi-fresh.test.ts:33-178`; `tests/cli/checks/platform/cloudflare/types.test.ts:35-145`; `tests/cli/checks/library/drizzle.test.ts:26-137`; `tests/cli/checks/platform/supabase/types.test.ts`; generator scripts `tests/config/cli/checks/tool/openapi-fresh.ts:1-9`, `tests/config/cli/checks/platform/cloudflare/types.ts:1-6`, `tests/config/cli/checks/library/drizzle.ts:3-17`; types `tests/types/cli/checks/openapi.ts`, `platform/cloudflare.ts`, `drizzle.ts`
- Kind: merge
- Problem: Each file builds a project with a fake generator script and checks the same three things: a failing
  generator gives an error, a stale output gives a `stale` finding, and the files stay as they were. The copies differ
  only in which setting names the generated file. All three local helpers are named `applyChanges` and
  `expectPreserved`, and all three types hold the same shape.
- Fix: One table test in `tests/unit/cli/checks/stale-generated-files.test.ts`, "each generator configuration reports
  a failed run and a stale file and leaves the files unchanged", with one row per configuration (openapi, cloudflare,
  drizzle, supabase): the settings text, the generated paths, and the expected findings. One generator script and the
  rows go to `GENERATOR_CASES` in `tests/config/generated-files.ts`; one function, `writeGeneratorProject`, writes the
  project of each row. Delete the Cloudflare and Drizzle copies, the three `applyChanges` and `expectPreserved`
  copies, the three generator constants, and the three type files. Keep only what is specific, in the same file: the
  Cloudflare `--env-interface` test, the missing `openapi.document` test, and the Supabase schema and Docker tests.
  The mocked Spectral test goes: the integration tests run real Spectral with the generated ruleset. Do after TCG-020,
  which sets up the direct call of `staleGeneratedFiles` in that file.
- Size: large

### TCO-003: Five tests repeat check rows that `cases.test.ts` already runs

- Where: `tests/cli/checks/language/bash/conventions.test.ts` (whole file) with `tests/config/cli/checks/language/bash/conventions.ts`; `tests/cli/checks/language/bash/structure.test.ts:16-35`; `tests/cli/checks/library/swift-snapshot-testing.test.ts:68-89,91-123`; `tests/cli/checks/library/drizzle.test.ts:157-170` with `DRIZZLE_RELATIONS_CASES`
- Kind: delete
- Problem: `cases.test.ts` already runs "report, then pass after the fix" for `bash/unused-functions`,
  `bash/ssh-blocks`, the strict-mode row of `bash/contract`, `swift-snapshot-testing/references`, and
  `swift-snapshot-testing/recording`. The tests above do the same again. The Drizzle one even writes its own case
  runner for a table of one row, while the test above it already reports and fixes `drizzle/relations`.
- Fix: Delete `conventions.test.ts` and its data, `structure.test.ts:16-35`, `swift-snapshot-testing.test.ts:68-123`,
  `drizzle.test.ts:157-170`, and `DRIZZLE_RELATIONS_CASES` and `TABLES`. The one new fact of `conventions.test.ts` (a
  `# name: what it does` line above an ssh heredoc is accepted) becomes the fixed file of the `bash/ssh-blocks` row:
  add `# restart_remote: restarts the remote service.` above the heredoc. The qualified form
  `SnapshotTesting.isRecording = true` is already the second row of the recording table that stays.
- Size: small

### TCO-004: Tests that only pin a value written in a manifest

- Where: `tests/cli/checks/library/swift-snapshot-testing.test.ts:155-173` (levels); `tests/cli/checks/tool/swift-tests/sources.test.ts:130-149` (stages); the `recommended` halves of `language/bash/portable.test.ts:44-47`, `language/sql.test.ts:159-161`, `tool/xcode/scopes.test.ts:64-68`; `built-in.test.ts:11`
- Kind: delete
- Problem: These assertions repeat "check X is level all", or "check Y runs at push". Planning by level and stage has its own tests. When the owner changes a manifest on purpose, these tests fail
  and must be edited to match, so they protect nothing.
- Fix: Delete `swift-snapshot-testing.test.ts:155-173` with `DOCUMENTATION_LEVELS`, and `sources.test.ts:130-149` with `XCTEST_FILES`. The tests that hold the `recommended` halves go whole: `portable.test.ts:32-60`
  (weak), `sql.test.ts:149-171` (TCO-020), and `xcode/scopes.test.ts:52-81` (weak). `built-in.test.ts` goes with
  TCO-006.
- Size: small

### TCO-005: Tests that guard features that were already deleted

- Where: `tests/cli/checks/language/bash/safety.test.ts:48-51` with `NAMED_PATHS_SOURCE` (`tests/config/cli/checks/language/bash/safety.ts:14-15`); `tests/cli/checks/language/python/singletons.test.ts:89-99`; `tests/cli/checks/tool/jest-execution.test.ts:33`; `tests/cli/checks/library/swift-snapshot-testing.test.ts:146-150`
- Kind: delete
- Problem: Each checks that something removed stays removed: the `unowned-cleanup` and `state-source` safety rules
  (commit `1f4d624f2`), the `singletons_allowed` setting, the Jest `--runInBand` flag (commit `56795d632`), and the
  old `swift-tests/recording` and `swift-tests/references` checks. Nothing can bring them back by accident.
- Fix: Delete `singletons.test.ts:89-99` and `NAMED_PATHS_SOURCE`. The other three lines go with the tests that hold
  them: the Bash level-loop test (`safety.test.ts:35-53`, weak), the Jest exit-code test (TCO-008), and the snapshot
  detection test (`swift-snapshot-testing.test.ts:125-153`, weak).
- Size: small

### TCO-006: `built-in.test.ts` polices the check registry

- Where: `tests/cli/checks/built-in.test.ts:1-23`
- Kind: delete
- Problem: The test checks three things. Line 11 pins that `gspot/policy` is declared once (a manifest value). Line
  22 checks that every registry entry has a manifest check. Lines 12-21 check that every manifest check without a
  command has code in `BUILT_IN_CHECKS`; that one guard protects users (a missing entry makes `gspot check` fail with
  "The check X names no command, and gspot has no built-in check by that name." for every user of that
  configuration), but it belongs in the build, not in a self-policing test.
- Fix: Delete the test file. Move the one useful guard (a manifest check with no command has built-in code) into the
  build-time `assertManifests` in `scripts/manifests.ts` (LIF-007), so the build refuses such a check. Do after
  EXG-003, which makes `gspot/settings` an ordinary built-in check and removes the `POLICY_CHECK` special case.
- Size: small

### TCO-008: `jest-execution.test.ts` tests no Jest check; it tests planning, execution, and the manifest

- Where: `tests/cli/checks/tool/jest-execution.test.ts:1-138`; `tests/config/cli/checks/tool/jest-execution.ts`
- Kind: delete
- Problem: There is no Jest built-in check. Test 1 tests how `runCheckCommand` classifies exit codes, timeouts, and
  cancellation (shared execution code). Test 2 builds 20 combinations (2 levels × 2 scopes × 5 limits) for
  `coverageArguments`, which has two branches, and compares the zero rows with `ZERO_COMMANDS`, a copy of the manifest
  commands: a weak test (both branches run in the Jest integration test). Test 4 (`:130-137`) reads `manifest.toml` and checks that it contains `--rootDir={root}/{scope}`, a value written in a manifest; when the owner changes the manifest on purpose, it fails and must be edited to match.
- Fix: Delete tests 1, 2, and 4, with `OUTCOMES` and `ZERO_COMMANDS` (`tests/config/cli/checks/tool/jest-execution.ts:51-55`); the rule that a scope command needs a root placeholder belongs in the build-time `assertManifests` (`scripts/manifests.ts`). Keep test 3 ("coverage arguments leave other
  commands, your own checks, and given arguments unchanged") in `tests/unit/cli/planning/checks.test.ts`, with its
  data inlined there, and delete the data file.
- Size: medium

### TCO-009: `library/trpc.test.ts` tests generated ESLint output, not a gspot check

- Where: `tests/cli/checks/library/trpc.test.ts:1-72`; `tests/config/cli/checks/library/trpc.ts:1-69`
- Kind: move
- Problem: There is no `checks/library/trpc.ts`. The test runs ESLint with the generated `boundaries/dependencies`
  rule. It sits beside real check tests and misleads the reader. It also loops over both levels and ends by checking
  that ESLint did not rewrite any file (lines 70-71).
- Fix: Move it to `tests/unit/cli/generation/eslint/boundaries/trpc.test.ts`, run it at one level, and delete lines
  70-71. Its data goes to `tests/config/trpc.ts`; its three `server` modules become one root `server` module
  (DT1-003).
- Size: small

### TCO-010: Tests where the mock returns the answer

- Where: `tests/cli/checks/language/swift/build/compiler.test.ts:20-32`; `tests/cli/checks/language/swift/build/analyzer.test.ts:28-40`; `tests/cli/checks/language/bash/function-size.test.ts:111-130`; `tests/cli/checks/tool/docker.test.ts:80-101`
- Kind: delete
- Problem: The process runner is mocked to print nothing and exit 0, and the test asserts that the check returns no
  findings: empty in, empty out. Every "report, then fix" test in the same files already ends in this state.
- Fix: Delete the Swift and Docker tests. The function-size test goes with the ast-grep code that CKO-001 removes.
- Size: small

### TCO-013: Tests of the shared ignore and scope code repeated inside check tests

- Where: `language/python/singletons.test.ts:63-87`; `tool/swift-tests/sources.test.ts:70-92,151-179`; `language/python/installation.test.ts:193-214`; `language/swift/build/isolation.test.ts:124-160`; `tool/xcode/symlinks.test.ts:39-44`
- Kind: delete
- Problem: These tests check that `[[ignore]]` paths apply per scope, that each scope reports alone, that a path
  setting refuses `../`, and that a broken Git index fails. That is shared code with its own tests (the execution
  scope tests, the settings path tests, and the tracked-file listing tests).
- Fix: Delete the listed tests and lines.
- Size: small

### TCO-014: A Windows-only Svelte test exists because the source uses the wrong path function

- Where: `tests/cli/checks/framework/svelte.test.ts:80-89`; `packages/cli/src/checks/framework/contracts.ts:33`
- Kind: fix-bug
- Problem: `svelteFindings` turns the file name svelte-check printed into a path with `toPosix`, which changes
  backslashes only on Windows, so the backslash test can run only there (`test.skipIf(process.platform !== 'win32')`).
  gspot already has a function for a path a tool printed, with forward slashes whatever system wrote it.
- Fix: In `svelteFindings` (`checks/framework/svelte.ts`) join the scope with `toolOutputPath(diagnostic.filename)`
  (was `toolPath`). Remove the `skipIf`, so the test runs on every system.
- Size: small

### TCO-015: macOS-only skips on tests whose tools are mocks or fake scripts

- Where: `tests/cli/checks/language/swift/build/compiler.test.ts:34`; `tests/cli/checks/tool/swift-tests/execution.test.ts:23,59,99`
- Kind: delete
- Problem: `compiler.test.ts:34` mocks `run`, so no Swift compiler starts, yet the test runs only on macOS. The
  swift-tests tests use `fakeTool` scripts for `xcodebuild` and `xcrun`, and `fakeTool` already writes a Windows
  `.cmd` wrapper. `swift/build` and `swift-tests/coverage` declare macOS and Linux, so Linux CI skips these tests for
  no reason.
- Fix: Replace each `test.skipIf(!isMacos)` with a plain `test`, with `using _system = useOperatingSystem('darwin')`
  (was `usePlatform`) where the operating system matters. Confirm with one Linux run.
- Size: small

### TCO-016: The Xcode symbolic-link test skips Windows only because of an odd file name

- Where: `tests/cli/checks/tool/xcode/symlinks.test.ts:13-46`
- Kind: delete
- Problem: The file name `link\n"é.swift` (a line break and a quote) cannot exist on Windows, so the whole test is
  skipped there. The check under test does not care about the name; odd file names belong to the Git file listing
  tests. The test also creates real symbolic links and has Git record them, which on Windows needs Developer Mode or
  admin rights and Git's `core.symlinks` setting.
- Fix: Use `link.swift`, remove the skip and the comment on line 13, and delete lines 39-44 (TCO-013); the test joins
  `tests/unit/cli/checks/infrastructure/xcode/project.test.ts`. Run it once on the Windows CI; keep a Windows skip only
  if the symbolic link itself fails there, with that reason.
- Size: small

### TCO-017: A POSIX-only test checks a cache key with file names that contain line breaks

- Where: `tests/cli/checks/language/bash/structure.test.ts:37-55`
- Kind: delete
- Problem: The test proves that two lists of file names that join to the same text with `\n` get different cache
  entries. That needs file names with a line break, so it skips Windows. It guards one line,
  `JSON.stringify([input.scope, paths])` in the Bash script reader, which reads every file from disk.
- Fix: Delete the test. With TCO-003, `structure.test.ts` goes whole.
- Size: small

### TCO-018: A POSIX-only test of the macOS `/private` prefix sits in the Swift compiler tests

- Where: `tests/cli/checks/language/swift/build/compiler.test.ts:181-202`; `packages/cli/src/checks/language/swift/contracts.ts:82-85` (`withoutPrivatePrefix`)
- Kind: simplify
- Problem: The prefix removal is a pure string change with a regular expression, but the test needs a real temporary
  folder and skips Windows.
- Fix: Test the compiler diagnostics with two fixed strings, on every system; do not export the one-line
  `withoutPrivatePrefix` only for a test. Delete the skip.
- Size: small

### TCO-019: The Drizzle test branches on the operating system to fake `drizzle-kit`

- Where: `tests/cli/checks/library/drizzle.test.ts:46-52`
- Kind: simplify
- Problem: The test links Bun as `drizzle-kit.exe` or `drizzle-kit` depending on `process.platform`, although the test
  setup already has `fakeTool`, which writes the POSIX and Windows wrappers itself. The same file also passes
  `agentRules: true` three times (lines 29, 178, 212) for no reason.
- Fix: Use `fakeTool(root, 'node_modules/.bin/drizzle-kit', ...)` with the generator code inside, and drop the
  `process.platform` branch and the three `agentRules: true` options. The generator part folds into TCO-002.
- Size: small

### TCO-020: The SQL "path ignores" test never uses the ignore

- Where: `tests/cli/checks/language/sql.test.ts:149-171`
- Kind: delete
- Problem: The title says it "preserves check-specific path ignores". The ignored file `template.sql` holds
  `CREATE TABLE {{table}};`, which does not parse, and the check skips files that do not parse, so the test passes
  with or without the ignore. Its first half only checks that the check is level `all` (TCO-004).
- Fix: Delete the test.
- Size: small

### TCO-021: Tests that check a library's error text instead of gspot's behavior

- Where: `language/python/pydoclint.test.ts:62-64`; `language/python/installation.test.ts:52-74,169-191`; `language/typescript/projects.test.ts:118,125,129-134`
- Kind: delete
- Problem: The Python tests assert the exact `smol-toml` message ("incomplete key-value: cannot find end of key"),
  twice. The malformed `pyproject.toml` halves of the import-linter and deptry tests only show an error that
  `readPackageManifests` raises while the session opens, before any check; the dependency-file reader tests already
  show that message. The TypeScript test asserts what the TypeScript compiler reports on a program it built itself.
- Fix: Delete `pydoclint.test.ts:62-64` and both malformed halves of `installation.test.ts` (52-74 keeps only
  "import-linter skips a project without contracts", 169-191 keeps only "deptry skips a scope without
  pyproject.toml"). The `ts.createProgram` assertions go with the whole copied-compiler test
  (`projects.test.ts:100-155`), which tests code DEC-008 deletes.
- Size: small

### TCO-022: The first pydoclint test repeats the style table with heavy mocks

- Where: `tests/cli/checks/language/python/pydoclint.test.ts:14-49`; `DOCSTRING_PROJECTS` (`tests/config/cli/checks/language/python/pydoclint.ts:36-44`)
- Kind: delete
- Problem: It mocks the version check and the process, then reads back the `--style` argument. Style choice is already
  tested directly through `docstringConfiguration` (`pydoclint.test.ts:51-53`), and the batch test (`:87-131`)
  already shows the argument list.
- Fix: Delete the test and `DOCSTRING_PROJECTS`.
- Size: small

### TCO-023: The pinact test tests a stub that holds the logic

- Where: `tests/cli/checks/tool/github-actions.test.ts:21-52`; `PINACT_STUB` (`tests/config/cli/checks/tool/github-actions.ts:1-15`)
- Kind: delete
- Problem: `github-actions/pinact` is a plain command check from the manifest. The stub decides that all-zero pins fail
  and that the file is rewritten without `--check`; the test then confirms the stub's own rules. The command runner
  has its own tests.
- Fix: Delete the test, `PINACT_STUB`, and `TOOL_FAILURES_POLICY`.
- Size: small

### TCO-025: Three ways to say how a check row is fixed

- Where: `tests/cli/checks/cases.test.ts:21-28` (`CORRECTIONS`), `:46-70` (scenario `corrected` callbacks); per-row `corrected` in `tests/config/cli/checks/**`; `tests/harness/check-case.ts:45`
- Kind: simplify
- Problem: A row's fix can come from its own `corrected` field, from the scenario's `corrected` callback, or from the
  `CORRECTIONS` table hidden in the test file. A reader has to check three places to know what the fixed run writes.
- Fix: Move the two `CORRECTIONS` entries (`bash/guards`, `structure/env-owner`) into the fix field of their rows in
  `tests/config/bash/checks.ts` (`INCLUDE_GUARD_CASES`, `BASH_ENV_READ_CASES`) and delete `CORRECTIONS`. Keep one
  scenario default.
- Size: small

### TCO-027: The `tests/config` and `tests/types` mirror trees add a jump for these tests

- Where: 36 data files under `tests/config/cli/checks/{database,framework,language,library,platform,tool}/`; 7 type files under `tests/types/cli/checks/`
- Kind: move
- Problem: To read one test you open up to three files in three trees, and most data files serve one test and hold a
  few lines (`language/python/exports.ts` 1 line, `language/bash/conventions.ts` 4, `language/css.ts` 5). Four files
  are named after a test that does not use them, and 5 of the 7 type files are not where the mirror says.
- Fix: Delete the mirror. The data goes to `tests/config/<topic>.ts` by topic (see "Test data"); the seven type files
  go (TCO-029).
- Size: large

### TCO-029: Seven type files, each with one user, most not where the mirror says

- Where: `tests/types/cli/checks/cases.ts` (5 lines), `drizzle.ts` (11), `openapi.ts` (10), `framework/expo.ts` (4, used by a data file), `framework/nextjs.ts` (2), `platform/cloudflare.ts` (9), `platform/supabase.ts` (9)
- Kind: delete
- Problem: Each type describes the return value of one local function, and four of them do not sit at the mirrored
  path of the test they serve.
- Fix: Delete the seven files. `drizzle.ts`, `openapi.ts`, and `platform/cloudflare.ts` go with TCO-002;
  `NextjsCommands` goes with TCO-048; TypeScript infers the rest, and `SupabaseInvocation` becomes an inline
  `{ args: string[]; cwd: string }[]` in its one function.
- Size: small

### TCO-032: Test file names do not say what they test

- Where: `platform/supabase/settings.test.ts` (tests `supabase/service-role-key`); `language/typescript/contracts.test.ts` (`typescript/tsconfig`, `javascript/tsc`, the tsconfig reader); `language/python/installation.test.ts` (deptry, import-linter, pip installs); `language/bash/portable.test.ts` (inline scripts, file kinds); `language/bash/structure.test.ts`; `tool/swift-tests/sources.test.ts` (sleeps and skip reasons); `tool/openapi-fresh.test.ts`; `database/postgres/schema-fields.test.ts` (`buildSchema`); `tool/xcode/scopes.test.ts` (xcconfig, entitlements, assets, malformed files); `cases.test.ts`
- Kind: rename
- Problem: "settings", "contracts", "installation", "portable", "structure", "sources", "fresh", "fields", "scopes",
  and "cases" do not say what each file tests.
- Fix: Each unit test sits at the path of its source file under `tests/unit/cli/checks/`: `platform/supabase.test.ts`
  (with the configuration tests); `language/typescript/tsconfig.test.ts`, `language/typescript/tsc.test.ts`, and
  `tests/unit/cli/parsers/tsconfig.test.ts`; `language/python/pip-installs.test.ts`, `import-linter.test.ts`,
  `deptry.test.ts`; `language/bash/inline-scripts.test.ts` and `tests/unit/cli/repository/kind.test.ts`;
  `testing/swift-tests.test.ts`; `stale-generated-files.test.ts`; `database/postgres/schema.test.ts`;
  `infrastructure/xcode/settings.test.ts`, `resources.test.ts`, `project.test.ts`. `bash/structure.test.ts` goes
  (TCO-003, TCO-017), and `cases.test.ts` splits into the check files (TCG-058).
- Size: small

### TCO-034: Tests that test another module's code

- Where: `language/bash/function-size.test.ts:132-155` (tests `structure/file-lines`, a general check); `language/typescript/contracts.test.ts:153-181` (tests `javascript/tsc`) and `:225-254` (tests the tsconfig reader `getTsconfigProject`); `language/bash/portable.test.ts:62-96` (tests file kind detection and the `vendored` declaration); `language/swift/suppressions.test.ts` (tests the general `gspot/suppressions` check)
- Kind: move
- Problem: The folder says "Bash check" or "TypeScript check", but the code under test is elsewhere, so the test is
  hard to find and easy to repeat.
- Fix: Move `function-size.test.ts:132-155` to `tests/unit/cli/checks/general/structure/file-lines.test.ts`;
  `contracts.test.ts:153-181` to `tests/unit/cli/checks/language/typescript/tsc.test.ts`; `contracts.test.ts:225-254`
  to `tests/unit/cli/parsers/tsconfig.test.ts`; `portable.test.ts:62-96` to `tests/unit/cli/repository/kind.test.ts`
  ("generated Gradle and Maven launchers are classified generated and never select Bash"); and the two Swift rows of
  `swift/suppressions.test.ts` into the reason table of
  `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts`.
- Size: small

### TCO-036: The mocked process result is written out 69 times, and one module has two import names

- Where: `missing: false, duration: 1` literals in 69 places; 55 `spyOn(..., 'run'|'runBlocking')` calls; `import * as spawn from '#cli/platform/public.ts'` in 5 files (`swift/build/*.test.ts`, `pydoclint.test.ts`) and `import * as processes` in 23 files
- Kind: simplify
- Problem: Every test spells `{ code, stdout: '', stderr: '', missing: false, duration: 1 }` in full, and the same
  module is called `spawn` in some files and `processes` in others.
- Fix: Add `processResult(overrides)` to the test setup (defaults `code: 0`, empty output, `missing: false`,
  `duration: 1`) and use it. Import the module as `processes` everywhere.
- Size: medium

### TCO-038: Assertions that repeat the next assertion

- Where: `language/css.test.ts:97,125,206,226,254`; `language/bash/conventions.test.ts:28`; `tool/xcode/resources.test.ts:110`; `language/bash/function-size.test.ts:64`; `language/python/installation.test.ts:258` (`toBeDefined` after `!`)
- Kind: delete
- Problem: An exact array match already checks the length, and `!` already asserts the value is there. These lines add
  noise. (`framework/nextjs.test.ts:166`, `expect(scratch).not.toBe('')`, is not one of them: it stops the next line
  from passing when no copy exists.)
- Fix: Delete `xcode/resources.test.ts:110` and `installation.test.ts:258`. The other lines go with their files
  (`css.test.ts` with CKO-029, `conventions.test.ts` with TCO-003, `function-size.test.ts` with CKO-001).
- Size: small

### TCO-039: Header comments copied from another file

- Where: `language/bash/structure.test.ts:1`, `platform/cloudflare/configuration.test.ts:1`, `platform/supabase/settings.test.ts:1`
- Kind: rewrite-text
- Problem: All three say "run in-process: each reports its finding and passes after the fix". That describes
  `cases.test.ts`, not these files.
- Fix: Delete the three comments.
- Size: small

### TCO-041: `PATH` names a file path in tests that also use the `PATH` environment variable

- Where: `tests/config/cli/checks/database/postgres/history.ts:3`; `tests/config/cli/checks/tool/github-actions.ts:17` (used beside `environment.PATH` in `tests/cli/checks/tool/github-actions.test.ts:35`)
- Kind: rename
- Problem: `PATH` means the program search path to every reader. Here it is a migration file and a workflow file.
- Fix: Rename them `MIGRATION_FILE` (a short literal that stays in `history.test.ts`) and `CALLED_WORKFLOW` (in
  `tests/config/github-actions.ts`, beside `CALLED_WORKFLOW_REFERENCES`). The `$/` reference tests that use it stay,
  because the `$/` rewrite stays.
- Size: small

### TCO-042: Local helpers named `applyChanges` mean something different from the shared `applyChanges`

- Where: `tool/openapi-fresh.test.ts:33`, `platform/cloudflare/types.test.ts:35`, `library/drizzle.test.ts:26`; `tests/harness/preservation.ts:101`
- Kind: rename
- Problem: The shared function applies a row's edits and returns an undo; the local functions write a whole new
  project. One name, two meanings. The local result is also called `testRepository`, though it is not a repository.
- Fix: TCO-002 leaves one local function: name it `writeGeneratorProject` and its result `project`.
- Size: small

### TCO-043: Same constant names with different data in two data files

- Where: `TEST_PATH_FILES`, `TEST_PATH_POLICY` in `tests/config/cli/checks/platform/supabase/settings.ts:24-34` and `tests/config/cli/checks/general/naming/policy.ts:4-18`
- Kind: rename
- Problem: Two different file sets and settings share one name.
- Fix: The Supabase pair becomes `SERVICE_KEY_READERS` and `SERVICE_KEY_SETTINGS` in `tests/config/supabase.ts`.
- Size: small

### TCO-046: A CodeQL ignore covers tests that stat a file, then read it

- Where: `gspot.toml:410-414` (`security/codeql`, `js/file-system-race`) naming `tests/cli/checks/framework/nextjs.test.ts`, `tests/cli/checks/language/swift/build/isolation.test.ts`, `tests/cli/commands/agents.test.ts`, and `tests/harness/preservation.ts`
- Kind: delete
- Problem: The race warning comes from reading a file's mode with `stat` and its bytes with `readFile` as two steps
  (`nextjs.test.ts:90-91,119-121`, `isolation.test.ts:28,50-52`, `readTree` in `preservation.ts`). The ignore hides it
  instead of writing the test without the race.
- Fix: Read both from one handle (`await using file = await open(path); const { mode } = await file.stat(); const bytes = await file.readFile();`), or compare only bytes where the mode is not the point. Remove each path from the ignore
  as its file is fixed, and the ignore when no path is left. The `agents.test.ts` path goes after TCM-012 deletes the
  GEMINI.md part.
- Size: small

### TCO-048: The Next.js process mock is written three times

- Where: `tests/cli/checks/framework/nextjs.test.ts:26-77` (`mockNextjsCommands`), `:146-163`, `:228-248`
- Kind: merge
- Problem: Each copy mocks `which.sync`, `runBlocking` (the version check), and `run`. The two inline copies differ
  only in what `run` writes.
- Fix: Give `mockNextjsCommands` an optional `run` callback and use it in all three tests; its return type is inferred.
  The version and failure texts it writes go to `tests/config/nextjs.ts` (`NEXT_VERSION_OUTPUT`,
  `TYPESCRIPT_VERSION_OUTPUT`, `TSC_FAILURE_OUTPUT`, `BUILD_FAILURE_OUTPUT`).
- Size: small

### TCO-049: The Supabase types test repeats one 9-line assertion block

- Where: `tests/cli/checks/platform/supabase/types.test.ts:118-127` and `:161-170`
- Kind: simplify
- Problem: Both loops assert the same thing about every captured request.
- Fix: Assert once with `toStrictEqual` on the request list, in `tests/unit/cli/checks/stale-generated-files.test.ts`
  (TCO-002).
- Size: small

### TCO-050: Two Docker tests check the same Trivy report

- Where: `tests/cli/checks/tool/docker.test.ts:131-156` and `:192-220`
- Kind: merge
- Problem: Both feed `MIXED_REPORT`, check the same three findings, and check that a secret value is not in the output.
  The second adds a second Compose file and "scanned once". Only the first checks the message text, such as
  `nginx:1.27.2: CVE-example (example)`.
- Fix: Add the `message` field to the second test's expected list, then delete the first test.
- Size: small

### TCO-051: Four Markdown tests share one setup and overlap

- Where: `tests/cli/checks/language/markdown.test.ts:10-72`
- Kind: merge
- Problem: All four write `gspot.toml` and one `.md` file and call the same check; the first and the last both test
  TSX fences.
- Fix: One `test.each` table of `{ markdown, lines }` rows: "markdown/fences reports each fence that does not parse:
  $name".
- Size: small

### TCO-053: A table column that never changes

- Where: `tests/cli/checks/tool/swift-tests/sources.test.ts:93-107`
- Kind: simplify
- Problem: Every row sets `check: 'swift-tests/sleep'`, and the title reads "Swift syntax controls $check", so the
  column carries nothing. The rows themselves are distinct cases (a string that only looks like a sleep, a generic
  `Task<Never, Never>.sleep`, and a call over two lines).
- Fix: Drop the `check` column, call `swift-tests/sleep` directly, and title the rows by what they show. Keep the three
  rows, as `SLEEP_SYNTAX_CASES` in `tests/config/swift.ts`.
- Size: small

### ST1-012: The FastAPI singleton test guards an exemption that does not exist

- Where: `tests/cli/checks/language/python/singletons.test.ts:34-61`
- Kind: delete
- Problem: "FastAPI composition objects use the same explicit file ignores as other Python singletons" repeats lines
  11-32 (a module-level instance is reported; an ignore that names its file hides it) with `FastAPI()` calls. The
  check has no FastAPI branch (`git grep -i fastapi -- packages/cli/src/checks` finds nothing).
- Fix: Delete the test.
- Size: small

### ST1-013: Two Swift tests repeat the shared timeout handling

- Where: `tests/cli/checks/language/swift/build/analyzer.test.ts:58-75`; `tests/cli/checks/tool/swift-tests/execution.test.ts:23-58`
- Kind: delete
- Problem: Both mock a timed-out process and expect "ran past N seconds". That text comes from the shared
  `runCheckTool` and `executionFailure` path that every built-in check uses; the process timeout keeps its own test,
  and the message is tiny logic. The XCTest test's second half (a later run passes) is the fixed step of the coverage
  failure table.
- Fix: Delete both tests and the `['build', 'analyzer']` table.
- Size: small

### ST1-014: The storage-policy parse-error test repeats the migration parser test

- Where: `tests/cli/checks/platform/supabase/configuration.test.ts:168-181`
- Kind: delete
- Problem: `supabase/storage-policies` reads migrations through `migrationsOf`; the test checks that a migration that
  does not parse is an error with its file and line. The migration test "unreadable SQL is an error and the fixed
  migration is read" (moving to `tests/unit/cli/checks/database/postgres/migrations.test.ts`) checks the same error of
  `migrationsOf`.
- Fix: Delete the test.
- Size: small

### ST1-015: The Swift sleep path-ignore test repeats the planning test of path ignores

- Where: `tests/cli/checks/tool/swift-tests/sources.test.ts:109-128`
- Kind: delete
- Problem: It shows that a paths ignore removes a file from a check's input before the check reads it. That is
  planning, the same for every check, and the execution tests check the planned file list with a path ignore. It
  asserts on the planned input files, not on Swift parsing.
- Fix: Delete the test.
- Size: small

### ST1-016: Tables in the other checks test libraries or repeat a branch

- Where: `tests/config/cli/checks/tool/docker.ts:12-57` (`COMPOSE_SOURCES` rows 1-3, `REPORT_FAILURES` rows 2, 3, 6); `framework/expo.ts:13-22` ("successful checks"); `tool/xcode/scopes.ts:2-11`; `language/python/pydoclint.ts:2-34`
- Kind: simplify
- Problem: The quoted, inline, and folded Compose rows test the YAML library. "an empty report", "malformed JSON", and
  "a result without its target" pin `JSON.parse` and zod text, so only "a fatal registry failure" tests gspot's
  message. "successful checks" mocks a passing Doctor report. Each Xcode document type has three rows that only vary
  the zod rejection. Docstring rows 2 and 4 repeat rows 1 and 3 with the style names swapped.
- Fix: Drop those rows. The Trivy refusal test becomes a plain test of the fatal registry failure; keep one invalid
  document per Xcode type.
- Size: small

### ST1-021: Thirteen Bash check files would repeat the same row runner

- Where: target `tests/unit/cli/checks/language/bash/*.test.ts` (from `tests/cli/checks/cases.test.ts:75-97`)
- Kind: merge
- Problem: TCG-058 puts each check's rows in that check's own test file. With the rows in `tests/config/bash/checks.ts`,
  each of the 13 files would hold the same `beforeAll` (build the Bash sandbox), the same `afterAll`, and the same
  one-test-per-row loop around `runCheckSample`, and would build the same sandbox 13 times.
- Fix: Add one function to `tests/setup/fixes.ts`, beside `runCheckSample` (was `runFindingCase`), that
  registers the hooks and one test per row; each Bash check file becomes one import and one call. `BASH_REPOSITORY`
  stays plain data with no `prepare` callback, because `tests/config/` may not import from `tests/setup/`; each Bash
  check test marks `scripts/build.sh` executable before it runs the sample.
- Size: small

### ST1-022: Sample settings and text use retired words

- Where: `framework/expo.test.ts:15,68` (`[agent_rules]`); `platform/supabase/types.test.ts:34` (`project_id = "types-fixture"`)
- Kind: rename
- Problem: The glossary renames `[agent_rules]` to `[rules]`, and the project id uses a word on this repository's
  banned list.
- Fix: Write `[rules]` in the Expo settings and `sample` in the Supabase project (`SUPABASE_PROJECT_CONFIG` in
  `tests/config/supabase.ts`). The same word in the license tests is TCG-046.
- Size: small

### DT1-004: Two Swift project-selection rows test detection that goes

- Where: `tests/config/cli/checks/language/swift.ts` (`SWIFT_PROJECT_SELECTION_CASES`, rows "detects the root project" and "detects the scoped project without borrowing its parent"); TML-010, TML-017
- Kind: delete
- Problem: An absent `xcode.project` now means the Swift package, and `gspot init` writes the project it finds, so
  nothing is detected at check time (TML-010). The two rows test that check-time detection.
- Fix: Delete the two rows. Whether `gspot init` writing `xcode.project` gets a test is decided by the "Untested logic"
  rule after the code cut.
- Size: small
