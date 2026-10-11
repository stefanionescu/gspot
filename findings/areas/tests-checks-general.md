# Unit tests of the general checks

These are the unit tests of the checks that gspot implements in TypeScript for the general configurations
(dependencies, docs, licenses, naming, prose, repository, secrets, security, structure, and the gspot checks), plus
the site, version-pair, and stale-generated-file checks that sit in `tests/cli/checks/general/` today. Each test builds
a small sandbox, runs one check, and compares the findings. The target: each test file sits under `tests/unit/cli/` at
the path of the source file it tests and is named after that file; its data sits in `tests/config/<topic>.ts`; and
every weak, fake, duplicate, or self-policing test is deleted, not repaired. No new tests are planned; after the code
is cut, the "Untested logic" rule decides each untested behavior.

## Test data

Test constants and sample text go to `tests/config/<topic>.ts`, one file per topic. Only a single short literal used
by one test file stays in that file, and so do values computed when the test file starts (an ESLint or HTML Validate
instance, `compileTerms(...)`, a `settingsText(...)` call). A `tests/config/` file imports only `tests/config/`: it
writes its gspot.toml as text and drops type annotations from `tests/types/` or the CLI (values are written
`as const`, and the test that reads a value checks its type). No `tests/types/` file is needed for these tests. The
placement rows name each value and its file. The files these tests use:

| File                              | Holds                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `tests/config/dependencies.ts`    | the dependencies sandbox, Bun release-age rows, lockfile-host rows                  |
| `tests/config/docs.ts`            | documented tasks, scopes, findings, fence rows                                      |
| `tests/config/licenses.ts`        | license settings, allowed packages, scanner failures, scan findings                 |
| `tests/config/naming/settings.ts` | naming settings, overrides, limits, word lists                                      |
| `tests/config/naming/sources.ts`  | extractor sources with their expected names, file trees                             |
| `tests/config/prose.ts`           | the Vale alert                                                                      |
| `tests/config/react.ts`           | React and Next.js version-pair rows                                                 |
| `tests/config/repository.ts`      | tracked-file patterns                                                               |
| `tests/config/secrets.ts`         | env reader files, settings, the env example, findings                               |
| `tests/config/security.ts`        | CodeQL SARIF reports                                                                |
| `tests/config/site.ts`            | built-page rows and sandbox, web manifests, SVG rows                                |
| `tests/config/structure.ts`       | env-read sources, lone-file, prefix, and file-folder rows, trivial-function sources |
| `tests/config/suppressions.ts`    | suppression comments per tool, reason rows, compiler directives                     |
| `tests/config/unused-entries.ts`  | unused gspot.toml entry rows                                                        |

## Findings

### TCG-001: A CodeQL test asserts something that can never fail

- Where: `tests/cli/checks/general/security.test.ts:177-228` (lines 188, 192, 212)
- Kind: delete
- Problem: The test "CodeQL refuses the language %s, which names a path, before it starts a process" checks at line
  188 that opening the repository fails, installs a spy on the process runner at line 192, and checks at line 212
  that the spy is never called. Nothing runs between line 192 and line 212, so the last check always passes. Commit
  `ab8425e05` moved the refusal into settings parsing and removed the call that sat between the spy and the
  assertion.
- Fix: Delete the refusal half (lines 178-212) and its `['../outside', 'C:outside']` rows: the settings tests already
  refuse those two paths and four more for `tools.codeql.languages`. Keep the second half as one plain test in
  `tests/unit/cli/checks/general/security.test.ts`, without `test.each`: "CodeQL runs in a scratch copy that is
  deleted afterwards and leaves the repository unchanged".
- Size: small

### TCG-002: Four license tests check that a deleted file is ignored

- Where: `tests/cli/checks/general/licenses.test.ts:108-150`; `tests/config/cli/checks/general/licenses.ts:10-14` (`UNUSED_LICENSE_FILES`)
- Kind: delete
- Problem: gspot no longer writes or reads `.gspot/config/licenses.json` (commit `5a4b25e1a`). These tests write that
  file in three states and through a symbolic link, then check that the license check ignores it. They test code
  that does not exist.
- Fix: Delete the `test.each(UNUSED_LICENSE_FILES)` block, the symbolic-link test after it, and
  `UNUSED_LICENSE_FILES`. The same leftover lines in `tests/cli/generation/licenses.test.ts:23,44` go with TGN-005.
- Size: small

### TCG-003: The package.json check is never shown to report anything

- Where: `tests/cli/checks/general/dependencies/manifest-policy.test.ts:15-31`; source `packages/cli/src/checks/general/dependencies/manifests.ts:10-72`
- Kind: delete
- Problem: The check `dependencies/package-json` has three rules: `package-manager`, `private-root`, and
  `foreign-lockfile`. No test makes any of them fire. The only test of the check, "manifest policy reads", expects an
  empty list or a parse error, so it is weak.
- Fix: Delete the "manifest policy reads" test. No new test is planned here: the three rules are the first cases of
  the "Untested logic" rule after the code cut. Each gets one real test, or the rule goes if it does not work.
- Size: small

### TCG-004: The trivial-function tests hide the trivial-file rule

- Where: `tests/cli/checks/general/structure/trivial-functions.test.ts:24,34,48,67,96,106`; source `packages/cli/src/checks/general/structure/trivial-functions.ts:52-66`
- Kind: simplify
- Problem: The check has two rules, `trivial-function` and `trivial-file`. Every test filters the findings to
  `rule === 'trivial-function'` before comparing, so a wrong `trivial-file` finding passes unseen.
- Fix: Compare the full findings (rule and line) without the filter, in
  `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`. No trivial-file rows are added: the
  `isTrivialFile` tests that move into the same file already reach that rule.
- Size: small

### TCG-005: Tests stayed in the old folders after their checks moved

- Where: `tests/cli/checks/general/secrets/env/files.test.ts` (tests `repository/tracked-files`); `tests/cli/checks/general/structure/findings.test.ts:23-46` (tracked-files again); `tests/cli/checks/general/structure/large-files.test.ts` (tests `repository/large-files`); `tests/cli/checks/general/structure/suppressions.test.ts` and `structure/compiler-suppressions.test.ts` (test `gspot/suppressions`)
- Kind: move
- Problem: The folder says "secrets" or "structure", but the check under test belongs to the `repository` or `gspot`
  configuration (commits `4ea1e5c00` and `895fee582` moved the checks and left the tests). A reader looking for the
  tracked-files tests will not find them.
- Fix: The tracked-files and large-files tests go to `tests/unit/cli/checks/general/repository.test.ts`, beside the
  source `checks/general/repository.ts` that holds both checks; the moved tracked-files test from
  `structure/findings.test.ts` stays as the one test that shows the check passing again after `git rm --cached`.
  The suppression tests (with `compiler-suppressions.test.ts`) go to
  `tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts` and `syntax.test.ts`, split by behavior because
  together they go over 300 lines. Delete the old files.
- Size: medium

### TCG-007: Tests copy whole shipped lists and so only check the copy

- Where: `tests/config/cli/checks/general/naming/ownership.ts:21-46` (`BASH_NAMES`), `:48-95` (`PYTHON_NAMES`), `:97` (`LIFECYCLE_NAMES`), `:99-109` (`FOREIGN_NAMES`), `:2-19` (`FRAMEWORK_CONTRACTS`); `tests/config/cli/checks/general/structure/prefix-collisions.ts:2-12` (`PREFIX_OWNER_CASES`), `:15-32` (`NESTJS_KIND_CASES`); `tests/cli/checks/general/naming/ownership.test.ts:92-116,147-178`; `tests/cli/checks/general/structure/prefix-collisions.test.ts:147-180,182-213`
- Kind: delete
- Problem: These lists are exact copies of lists in the shipped manifests (the 24 Bash names, the 46 Python dunder
  names and four `setUp` names, the framework names, the 16 NestJS kinds, the prefix lists). The tests ban every name
  and check that none is reported. That is a snapshot: removing a name from the product breaks the test, adding one
  is never seen, and the behavior needs one name, not 24 or 46.
- Fix: Delete the Bash-list test (`ownership.test.ts:92-116`), the Python dunder test (`:147-178`), and the
  prefix-owner test (`prefix-collisions.test.ts:147-180`), with `BASH_NAMES`, `PYTHON_NAMES`, `LIFECYCLE_NAMES`,
  `FOREIGN_NAMES`, `PREFIX_OWNER_CASES`, and `NESTJS_KIND_CASES`. The kept NestJS test uses `controller` and `service`
  inline. `FRAMEWORK_CONTRACTS` becomes `FRAMEWORK_NAMES` in `tests/config/naming/settings.ts`. ST1-005 and ST1-008
  trim the other tables that copy shipped lists.
- Size: medium

### TCG-008: A test polices an owner decision instead of testing behavior

- Where: `tests/cli/checks/general/naming/vocabulary.test.ts:191-217`, `tests/config/cli/checks/general/naming/vocabulary.ts:19-35` (`RESTORED_TERMS`); also `vocabulary.test.ts:155-171`
- Kind: delete
- Problem: "restored terms fail in identifiers and paths at all" checks that 15 named words are in the shipped banned
  list. It guards an owner decision, not code; the banned-word mechanism has its own unit tests. The test at lines
  155-171 is different: it is the only test that shows `naming/paths` reads the names of Markdown files.
- Fix: Delete the restored-terms test and `RESTORED_TERMS`. The owner's decision that the banned terms stay complete
  is recorded in `AGENTS.md`, not in a test. Keep the test at lines 155-171 as "a Markdown file name with a banned
  word is reported" in `tests/unit/cli/checks/general/naming/checks/paths.test.ts`.
- Size: small

### TCG-010: The shared "tool timed out, is canceled, or is missing" logic is tested again in three checks

- Where: `dependencies/lockfile-fresh.test.ts:14-65` (rows `missing`, `deadline`, `cancellation`); `duplication.test.ts:34-63` with `tests/config/cli/checks/general/duplication.ts:10-27`; `prose.test.ts:39-66` with `tests/config/cli/checks/general/prose.ts:4-7`
- Kind: delete
- Problem: These rows test `executionFailure` (`packages/cli/src/execution/command/contracts.ts:226-240`), which every
  built-in check shares, and each copy needs a special `tool_timeout_seconds = 1` in its sandbox only to make the
  message predictable. The process timeout keeps its own test, and cancel is tested in the check command's
  cancellation tests.
- Fix: Delete the three rows of the stale-lockfile test (it stays as one plain test: a failed frozen install leaves
  the repository unchanged and passes on retry), both prose rows with `EXECUTION_FAILURES`, and the whole duplication
  refusal table (ST1-002). Drop the `tool_timeout_seconds = 1` lines. No "missing" row is added anywhere.
- Size: small

### TCG-011: Package.json parse errors use a shared repository and two rows test the same branch

- Where: `tests/cli/checks/general/dependencies/policy.test.ts:13-32`; `tests/config/cli/checks/general/dependencies/policy.ts:8-24` (`INVALID`); `tests/cli/checks/cases.test.ts:32`
- Kind: delete
- Problem: Three tiny cases build a shared repository with `beforeAll`/`afterAll`, and two of them hit the same error.
  The error does not come from the package-json check at all: `readPackageManifests` throws it while the session
  opens, and the dependency-file reader tests already cover `{`, a version that is not text, and the refused
  session. The describe title is also the title of a second repository that `cases.test.ts` builds.
- Fix: Delete the `describe` block, its shared repository, and `INVALID`.
- Size: small

### TCG-012: structure/findings.test.ts builds a shared repository for one test

- Where: `tests/cli/checks/general/structure/findings.test.ts:1,14-46,48-96`
- Kind: delete
- Problem: The file builds a repository in `beforeAll` for a single test ("repository/tracked-files reports a
  dependency folder that git tracks"), and its header says "each repository-shape check fires on its sample", which
  it does not do. Its second test, the folder bans, belongs to the naming checks.
- Fix: Delete the shared repository and the file. The tracked-files test moves to
  `tests/unit/cli/checks/general/repository.test.ts` and builds its sandbox inside the test (TCG-005). The folder-bans
  test moves to `tests/unit/cli/checks/general/naming/checks/paths.test.ts`, because CKG-003 merges
  `structure/folder-names` into `naming/paths`; it runs once, with the word `shared` only, and without its ignore half
  (ST1-018).
- Size: small

### TCG-013: secrets/env/files.test.ts repeats itself and tests shared features

- Where: `tests/cli/checks/general/secrets/env/files.test.ts:14-29,31-67,69-101,125-129`; `tests/config/cli/checks/general/secrets/env/files.ts:2-43`
- Kind: delete
- Problem: Test 1 checks eight paths; test 4 checks seven of them too (only `nested/.dev.vars` is new). The staged test
  (31-67) reports a staged `.env` that the kept scope test and the moved structure test already show; its "ignored"
  and "skipped" rows test `[[ignore]]` and `--skip`, which work the same for every check. Test 3 counts how many times
  Git runs, an implementation detail of the repository index. Lines 125-129 check that the test setup selected
  Python.
- Fix: Delete test 1 and add `nested/.dev.vars` to `TRACKED_PATTERNS` (`tests/config/repository.ts`). Delete the
  staged test with `STAGED_CASES`, test 3, and lines 125-129. ST1-018 drops the `[[ignore]]` half of the kept scope
  test. The kept test runs once in `tests/unit/cli/checks/general/repository.test.ts`.
- Size: small

### TCG-015: A README test checks a help string and the ignore command

- Where: `tests/cli/checks/general/docs/readme-shape.test.ts:104-136`
- Kind: delete
- Problem: The test checks that the finding's `help` contains the text written in
  `packages/cli/configurations/general/docs/manifest.toml:88` (a constant), then runs `gspot ignore … --dry-run`. The
  second part tests the ignore command, and `ignore --dry-run` goes (CLX-004).
- Fix: Delete the test.
- Size: small

### TCG-017: The stale-lockfile trigger test repeats the planning test

- Where: `tests/cli/checks/general/dependencies/lockfile-fresh.test.ts:100-136`; `tests/cli/planning/lockfiles.test.ts:10-51`
- Kind: merge
- Problem: Both tests build the same sandbox (a root and an `app` scope, `bun.lock`, `source.txt`), loop over both
  levels, and check that a staged `source.txt` does not start the check while a staged manifest does. The only new
  part here is that the scratch copy holds both source files.
- Fix: Keep the trigger rules in the planning test. In
  `tests/unit/cli/checks/general/dependencies/stale-lockfile.test.ts` keep one run that asserts the files in the
  scratch copy and the exact command (`bun install --frozen-lockfile --dry-run`); drop the level loop and the
  "untouched" half.
- Size: small

### TCG-018: Two "package.json policy" tests really test the ESLint setup and a third-party plugin

- Where: `tests/cli/checks/general/dependencies/manifest-policy.test.ts:33-81,83-114`; `tests/config/cli/checks/general/dependencies/manifest-policy.ts:1-4`
- Kind: delete
- Problem: Both tests generate the full ESLint configuration and run real ESLint on `package.json`, ten times in all.
  The first checks that `[[ignore]]` paths reach ESLint, which the ESLint generation tests of `package.json` rules
  and of ESLint ignores already check. The second checks that the third-party rule
  `package-json/restrict-dependency-ranges` ignores `npm:` aliases; gspot only sets `rangeType: 'pin'`, so that
  behavior is the plugin's own.
- Fix: Delete both tests and the data file. With TCG-003 the whole of `manifest-policy.test.ts` goes.
- Size: small

### TCG-019: The version-pairs table multiplies rows that add nothing

- Where: `tests/cli/checks/general/dependencies/version-pairs.test.ts:12-68`; `tests/config/cli/checks/general/dependencies/version-pairs.ts`
- Kind: simplify
- Problem: 2 configurations × 2 scopes × 4 rows = 16 tests of `versionPairs(input, pairs)`, which takes the pair list
  as an argument, so the configuration does not matter. Line 48 turns the path into backslashes, which only tests the
  test function `toolPath`. Lines 63-67 check that the setup selected Next.js. The data writes `findings: 0 as const`.
- Fix: One `test.each` with the 4 rows at the root, plus the existing child-scope test, in
  `tests/unit/cli/checks/framework/version-pairs.test.ts` (TCG-059). Give the plain path; delete lines 63-67. The rows
  go to `VERSION_PAIR_CASES` in `tests/config/react.ts`, with `findings: 0` or `1` and no `as const`.
- Size: small

### TCG-020: The stale-generated-file tests call the check under another check's name and test execution code

- Where: `tests/cli/checks/general/generated-code.test.ts:26,59,81,111` (`BUILT_IN_CALCULATIONS['supabase/stale-types']`), `:31-61`, `:57`
- Kind: simplify
- Problem: The inputs are built for `cloudflare/stale-types` or `openapi/stale-document`, but every call goes through
  the `supabase/stale-types` key. It works only because four keys point at the same function
  (`packages/cli/src/checks/public.ts:129,138,180,187`), and it misleads the reader. Test 2 checks `prepareCommand`
  (execution code) and then changes `input.selection.view.settings` by hand.
- Fix: Import `staleGeneratedFiles` (CKG-032 renames `generatedCode` and moves it to `checks/stale-generated-files.ts`)
  and call it directly in `tests/unit/cli/checks/stale-generated-files.test.ts`. Move the `prepareCommand` assertions
  to `tests/unit/cli/execution/command/placeholders.test.ts` as "a list setting fills whole arguments and keeps empty
  and multiword entries". Instead of the hand edit, build a second sandbox without `generate_command`. TCO-002 then
  merges the OpenAPI, Cloudflare, Drizzle, and Supabase copies into the same file with the same direct call.
- Size: small

### TCG-021: security.test.ts is mostly a SARIF parser test

- Where: `tests/cli/checks/general/security.test.ts:30-169`; `tests/config/cli/checks/general/security.ts`
- Kind: move
- Problem: Ten of the twelve test blocks test `sarifFindings` from
  `packages/cli/src/parsers/output/structured/public.ts`, a report parser. The file name says "security".
- Fix: Move lines 30-169 to `tests/unit/cli/parsers/output/sarif.test.ts`, and `CODEQL_REPORT`, `CYCLIC_REPORT`,
  `ENCODED_REPORT` to `tests/config/security.ts`. Keep the CodeQL tests in
  `tests/unit/cli/checks/general/security.test.ts` with `JAVASCRIPT_LANGUAGES` inline. ST1-007 deletes two of the
  moved tests.
- Size: small

### TCG-022: CodeQL tests are skipped on some machines although nothing real runs

- Where: `tests/cli/checks/general/security.test.ts:176-177,229` (`test.if(hasToolBuild('codeql'))`)
- Kind: delete
- Problem: Both CodeQL tests mock every process and the version check and call the check function directly, so they
  bypass planning, where the "no build for this operating system" skip lives. The gate only hides the tests on arm64
  Linux.
- Fix: Remove `.if(hasToolBuild('codeql'))` and the comment on line 176. Confirm with one run on an arm64 Linux
  machine.
- Size: small

### TCG-023: A duplication test skips one row outside Windows

- Where: `tests/cli/checks/general/duplication.test.ts:112-150` (line 114)
- Kind: delete
- Problem: The loop runs three path forms; the third ("namespaced", a Windows path form) is skipped on macOS and Linux
  with `test.skipIf(...)`. `toNamespacedPath` returns its input unchanged outside Windows, so the row is cheap there.
- Fix: Delete the `test.skipIf(...)` and the `describe`, and keep the three rows. Outside Windows the "namespaced" row
  repeats "absolute"; on Windows both the plain and the namespaced absolute path stay tested.
- Size: small

### TCG-024: One platform skip is needed and stays

- Where: `tests/cli/checks/general/structure/prefix-collisions.test.ts:61` (`test.skipIf(!isPosix)`)
- Kind: rename
- Problem: The test uses file names with a line break, which Windows does not allow, so its Windows skip is needed.
- Fix: Keep the skip in `tests/unit/cli/checks/general/structure/shared-prefixes.test.ts`, written with the test setup
  flag `isWindows` (from `tests/setup/operating-systems.ts`) instead of `isPosix`.
- Size: small

### TCG-025: Name extraction tests are split between two folders

- Where: `tests/cli/checks/general/naming/extract.test.ts`; `tests/config/cli/checks/general/naming/extract.ts` (155 lines); `tests/cli/parsers/naming.test.ts`
- Kind: merge
- Problem: The TypeScript, JavaScript, Python, Swift, and Bash name extractors are tested in the checks folder, while
  the SQL extractor of the same folder is tested in `tests/cli/parsers/naming.test.ts`.
- Fix: Keep all extractor tests in one file, `tests/unit/cli/checks/general/naming/identifiers.test.ts` (the
  extractors move into `checks/general/naming/`, PAR-013), with the path identifier tests of `naming/paths.test.ts`.
  The sources and expected names go to `tests/config/naming/sources.ts` (`EXPECTED_TYPESCRIPT_NAMES`,
  `EXPECTED_PYTHON_NAMES`, `EXPECTED_SWIFT_NAMES`, `NAME_POSITION_CASES`).
- Size: medium

### TCG-026: A naming test tests the explain command

- Where: `tests/cli/checks/general/naming/contracts.test.ts:183-210`
- Kind: move
- Problem: "public explanations report Swift and SQL category defaults and scoped overrides" runs
  `gspot explain <setting> --json` and asserts only its output. The explain tests show the same value in both scopes,
  so they do not cover a scope whose current value differs from its default.
- Fix: Move it to `tests/unit/cli/commands/explain/command.test.ts` as "explain shows each scope's default and current
  naming limit".
- Size: small

### TCG-027: Two naming container tests only show "no findings"

- Where: `tests/cli/checks/general/naming/contracts.test.ts:244-287,289-310`
- Kind: delete
- Problem: "%s root containers also apply to inherited child selections" expects no findings at both levels, so it
  passes even when the naming checks do not run: a weak test. "%s path containers stay in the selected child scope at
  both levels" spends half its runs at `recommended`, where the naming checks never run, and repeats one code path for
  three frameworks.
- Fix: Delete the root-container test. Run the path-container test once at level `all` with the `nextjs` row only, as
  a plain test in `tests/unit/cli/checks/general/naming/checks/paths.test.ts` (ST1-005).
- Size: small

### TCG-029: Three tests check that ordinary words pass

- Where: `naming/vocabulary.test.ts:20-37`; `naming/contracts.test.ts:159-181`; `naming/policy.test.ts:192-205`
- Kind: merge
- Problem: Each builds a sandbox, runs the naming checks end to end, and shows that a few ordinary words (`data`,
  `message`, `response`, `service`, `generate`) are not banned: the same test three times with different word lists.
- Fix: Keep the vocabulary test in `tests/unit/cli/checks/general/naming/checks/identifiers.test.ts` and delete the
  two copies. The number words and the `user2` digit finding stay in the number-word test (ST1-004).
- Size: small

### TCG-031: gspot.test.ts has a vague name, a wrong header, repeated calls, and a 233-line data file

- Where: `tests/cli/checks/general/gspot.test.ts:1,39-48,64-73,93-102`; `tests/config/cli/checks/general/gspot.ts` (233 lines)
- Kind: rename
- Problem: The file tests only `gspot/unmatched-paths`. Its first line describes four other checks. The 10-line call
  `BUILT_IN_CHECKS['gspot/unmatched-paths'].run(session, {...}, undefined)` is written three times. The data file is
  the largest in the area and has one user.
- Fix: The file becomes `tests/unit/cli/checks/general/gspot/unused-entries.test.ts` (the check is
  `gspot/unused-entries`); its naming rows go to `tests/unit/cli/checks/general/naming/checks/settings.test.ts` with
  `unusedNames` (CKG-005). The tables go to `UNUSED_PATH_CASES` in `tests/config/unused-entries.ts` and
  `UNUSED_NAME_CASES` in `tests/config/naming/settings.ts`. Delete the header line and write the repeated call once,
  in one function of the test file.
- Size: small

### TCG-032: The same wrong header comment is pasted into three files

- Where: `tests/cli/checks/general/gspot.test.ts:1`, `structure/config-logic.test.ts:1`, `structure/large-files.test.ts:1`
- Kind: rewrite-text
- Problem: All three start with "The repository-shape integrity analyses: suppressions, policy patterns, large files,
  and configuration purity." Each file tests one check, and none tests all four.
- Fix: Delete the header lines. `config-logic.test.ts` goes whole with its check (CKG-010).
- Size: small

### TCG-033: Two more header comments describe something the file does not do

- Where: `tests/cli/checks/general/dependencies/policy.test.ts:1`; `tests/cli/checks/general/structure/findings.test.ts:1`
- Kind: rewrite-text
- Problem: `policy.test.ts` says it covers "install policy, lockfile hosts, and manifests"; it has no lockfile-host
  test. `findings.test.ts` says "each repository-shape check fires on its sample"; it has one tracked-files test and
  one folder-names test.
- Fix: Delete both lines when the files move (TCG-047, TCG-012).
- Size: small

### TCG-034: Two test files for one license check, with two copies of the setup

- Where: `tests/cli/checks/general/license-origins.test.ts:20-60,92-114`; `tests/cli/checks/general/licenses.test.ts:26-41`
- Kind: merge
- Problem: Both files test `licenses/allowed`. `prepareInventories` and `preparePythonProject` both read the
  pip-licenses pin, write a fake `pip-licenses`, and run `gspot apply`. `license-origins.test.ts` also builds the
  expected findings with `if`/`else` inside the test, so the expected result is computed, not written.
- Fix: Two files by behavior: `tests/unit/cli/checks/general/licenses/scan.test.ts` and
  `licenses/allowed-packages.test.ts`, with one setup function, `prepareLicenseSandbox` in `tests/setup/licenses.ts`.
  Each row writes its expected findings. The allowed-package rows follow `[[licenses.allowed_package]]` (root only, no
  license field; TML-009, CFR-004), so the scope rows go. The data goes to `tests/config/licenses.ts`
  (`LICENSE_SETTINGS`, `ALLOWED_PACKAGE_CASES`, `ALLOWED_PACKAGE_SCOPE_CASES`, `SCANNER_FAILURES`,
  `EXPECTED_SCAN_FINDINGS`).
- Size: medium

### TCG-035: Three type files exist for one use each

- Where: `tests/types/cli/checks/license-origins.ts` (3 lines), `tests/types/cli/checks/security.ts` (2 lines), `tests/types/cli/checks/site.ts` (8 lines)
- Kind: delete
- Problem: `ExceptionMembership` is only `(typeof EXCEPTION_MEMBERSHIP)[number]`. `CapturedInvocation` is
  `{ argv: string[]; cwd: string }`, used once. `SvgSavingCase` types one table that `as const` would type.
- Fix: Delete the three files. Write the object type inline where it is used, and write the SVG table `as const`.
- Size: small

### TCG-037: The same export names mean different things

- Where: `tests/config/cli/checks/general/naming/extract.ts:73` and `naming/ownership.ts:48` (`PYTHON_NAMES`); `tests/config/cli/checks/general/duplication.ts:3` and `prose.ts:4` (`EXECUTION_FAILURES`)
- Kind: rename
- Problem: `PYTHON_NAMES` is a map of extracted names in one file and a list of 46 dunder names in the other.
  `EXECUTION_FAILURES` has different row shapes in the two files.
- Fix: The dunder list and both `EXECUTION_FAILURES` go (TCG-007, TCG-010). The extractor map becomes
  `EXPECTED_PYTHON_NAMES` in `tests/config/naming/sources.ts`.
- Size: small

### TCG-039: The same five setup lines are repeated in almost every test

- Where: `docs/stale-paths.test.ts` (9 of 13 tests write `gspot.toml` separately), `docs/readme-shape.test.ts` (4), `structure/trivial-functions.test.ts` (5 repeated call chains), `naming/vocabulary.test.ts` (8, CLI form), and others
- Kind: simplify
- Problem: Most tests repeat: create a sandbox, write the file tree, write `gspot.toml` with a separate `Bun.write`,
  open a session, build the input, and call the check. The separate write of `gspot.toml` has no reason; the file can
  be part of the tree.
- Fix: One small function per test file, for example `missingPathFindings(files, paths?)`, with `gspot.toml` inside
  the tree. This roughly halves `docs/missing-paths.test.ts`.
- Size: medium

### TCG-041: Guards in tests for states that cannot happen

- Where: `naming/contracts.test.ts:27-29`; `naming/findings.test.ts:79-80,214-215`; `naming/paths.test.ts:54,65`
- Kind: simplify
- Problem: The tests throw their own error if the shipped `naming/identifiers` check or the root scope is missing,
  and `paths.test.ts` handles a result shape (`refused.findings`) that `naming/paths` never returns. That branch exists
  only because `namingPaths` is typed as `BuiltInCheck`, whose return type also allows a `CheckOutcome`.
- Fix: Use `!` on the lookups. Give `namingPaths` and `namingIdentifiers` their real type,
  `(input: CheckInput) => Promise<Finding[]>`, in the source; call `namingPaths` directly and delete the
  `Array.isArray(...)` branches.
- Size: small

### TCG-042: Length checks that repeat the line before

- Where: `licenses.test.ts:204`; `dependencies/manifest-policy.test.ts:99-103`; `security.test.ts:293`
- Kind: delete
- Problem: `toMatchObject` with an array already requires the same length, so the following `toHaveLength` adds
  nothing.
- Fix: Delete the `toHaveLength` assertions at `licenses.test.ts:204` and `security.test.ts:293`.
  `manifest-policy.test.ts` goes whole (TCG-018).
- Size: small

### TCG-045: "exception" names ignores, naming overrides, and allowed packages

- Where: `tests/config/cli/checks/general/gspot.ts:88` (`NATIVE_EXCEPTION_CASES`), `:189,223,228`; `tests/config/cli/checks/general/naming/vocabulary.ts:42,46` (`PREFIX_EXCEPTION`, `REPEATED_EXCEPTION`); `tests/config/cli/checks/general/licenses.ts:17` (`LICENSE_EXCEPTIONS`), `license-origins.ts:5` (`EXCEPTION_MEMBERSHIP`); `docs/readme-shape.test.ts:104`; `naming/vocabulary.test.ts:173`; `naming/findings.test.ts:135`; `security.test.ts:78` ("path-specific exceptions")
- Kind: rename
- Problem: The glossary calls an accepted finding an ignore, a naming exemption an override, and a license exception
  an allowed package. These names call all three "exceptions".
- Fix: `NATIVE_EXCEPTION_CASES` → `UNUSED_NAME_CASES`; `PREFIX_EXCEPTION` → `NUMBERED_PREFIX_OVERRIDE`;
  `LICENSE_EXCEPTIONS` → `ALLOWED_PACKAGE_CASES`; `EXCEPTION_MEMBERSHIP` → `ALLOWED_PACKAGE_SCOPE_CASES`;
  "path-specific exceptions" → "path ignores". `REPEATED_EXCEPTION` goes (TML-005), and the test with "exception
  command" goes (TCG-015). `licenses.exceptions` becomes `[[licenses.allowed_package]]` (TML-009), so no test name
  keeps "exception".
- Size: small

### TCG-046: A banned word appears in test data

- Where: `dependencies/policy.test.ts:40,68`; `license-origins.test.ts:38`; `licenses.test.ts:31,32,161`; `site/source.test.ts:150`; `structure/suppressions.test.ts:56`
- Kind: rename
- Problem: These strings use `fixture`, a word on this repository's banned list.
- Fix: Write `sample` instead (for example `'sample lockfile bytes'`, `name = "sample"`, `sample.png`). The
  `pyproject.toml` that both license helpers write becomes `SAMPLE_PYPROJECT` in `tests/config/licenses.ts`.
- Size: small

### TCG-047: Test file names do not match the source they test

- Where: `dependencies/lockfile-fresh.test.ts` (check `stale-lockfile`), `dependencies/manifest-policy.test.ts` (`package-json`), `dependencies/policy.test.ts` (mostly `bun-release-age`), `secrets/env/readers.test.ts` (`env-template`), `secrets/env/files.test.ts` (`tracked-files`), `gspot.test.ts` (`unmatched-paths`), `structure/layout.test.ts` (mostly `lone-files`), `structure/findings.test.ts`, `naming/contracts.test.ts`, `naming/findings.test.ts`, `naming/ownership.test.ts`, `naming/policy.test.ts`
- Kind: rename
- Problem: Names come from old source file names or are vague words ("findings", "layout", "contracts", "policy",
  "ownership"), so you cannot find the tests of a check by its ID.
- Fix: Each unit test sits at the path of its source file under `tests/unit/cli/`:
  `dependencies/stale-lockfile.test.ts`, `dependencies/bun-release-age.test.ts`, `secrets.test.ts` (check
  `secrets/env-examples`), `repository.test.ts`, `gspot/unused-entries.test.ts`, `structure/lone-files.test.ts`,
  `structure/env-reads.test.ts`, `structure/shared-prefixes.test.ts`, `docs/missing-paths.test.ts`. The naming tests
  split into `naming/names.test.ts`, `naming/identifiers.test.ts`, `naming/settings.test.ts`, and one file per naming
  check in `naming/checks/` (`identifiers`, `paths`, `settings`, `configuration-names`).
- Size: medium

### TCG-048: The secrets folders are two levels deep for two files

- Where: `tests/cli/checks/general/secrets/env/`, `tests/config/cli/checks/general/secrets/env/`
- Kind: move
- Problem: `secrets/` holds only `env/`, which holds two files, and one of them is not a secrets test (TCG-005).
- Fix: The env example test becomes `tests/unit/cli/checks/general/secrets.test.ts`; its data goes to
  `tests/config/secrets.ts`.
- Size: small

### TCG-053: Suppression tests are spread over four files in three folders

- Where: `tests/cli/checks/general/structure/suppressions.test.ts`, `structure/compiler-suppressions.test.ts`, `tests/tools/configurations/general/structure.test.ts` (Ruff and Vale tool comment tests), `tests/cli/checks/language/swift/suppressions.test.ts`
- Kind: merge
- Problem: The Vale comment cases are tested twice: `suppressions.test.ts:122-156` (with `<!-- vale off -->` in fences
  and inline code) and the integration test with real Vale. The two prove different things: the integration test
  proves gspot finds the same comments Vale obeys; the unit test proves the check fails and then passes after the fix.
- Fix: Keep both. In the unit test (`tests/unit/cli/checks/general/gspot/suppressions/reasons.test.ts`) drop the fence
  and inline-code cases and run it once. The integration test stays `tests/integration/general/structure.test.ts`. The
  Swift suppression test joins the same unit folder (TCO-034).
- Size: small

### TCG-055: The two docs/headings tests go with the check

- Where: `tests/cli/checks/general/docs/headings.test.ts:9-19,21-37`
- Kind: delete
- Problem: The first test maps findings to line numbers and then expects none, which hides what a wrong finding would
  be. The check itself goes: the Vale style `banned-headings` keeps the rule, and the TypeScript check
  `docs/headings` is deleted (CFG-003).
- Fix: Delete `headings.test.ts` with both tests, together with the check.
- Size: small

### TCG-056: Name-rule tests rebuild the same identifier object by hand

- Where: `naming/contracts.test.ts:94-102,128-136,140-148,226-234`; `naming/manifest-rules.test.ts:23-31,34-42,48-56`; `identifier()` at `naming/findings.test.ts:83-85`
- Kind: merge
- Problem: Seven inline copies of the same 7-field object, while `findings.test.ts` already has a function for it.
- Fix: The unit tests of `nameFindings` and `splitParts` go to `tests/unit/cli/checks/general/naming/names.test.ts`
  and the limit and rule-order tests to `naming/settings.test.ts`, both with the one `identifier()` function. Test what `rulesFor`, `hasCase`, and `repeatedPart` do through `nameFindings` (CKG-054).
- Size: small

### TCG-057: The license setup runs `gspot apply` for every test

- Where: `licenses.test.ts:27-41` (`preparePythonProject`, 14 runs, plus 4 more `apply` runs in the first test); `license-origins.test.ts:21-60` (9 runs); `duplication.test.ts:19-32` (`prepareDuplicationProject`)
- Kind: simplify
- Problem: Each test writes a fake tool and runs the full `apply` command before it mocks every process anyway. These
  tests never change the generated files.
- Fix: In the one setup function `prepareLicenseSandbox` (TCG-034), drop the `apply` run if the license check does not
  need generated files (it reads the settings since commit `5a4b25e1a`); otherwise prepare one sandbox per file and
  change only the per-row file in each test. Confirm with one run. The duplication helper is inlined into its one
  test (ST1-020).
- Size: small

### TCG-058: The case registry pulls its rows from data files named after other tests

- Where: `tests/cli/checks/cases.test.ts:16-17,10,30-74`; `tests/config/cli/checks/general/dependencies/policy.ts:40-110`; `structure/findings.ts:15-92`; `site/output.ts:6-27`
- Kind: move
- Problem: `cases.test.ts` imports `CASES` and `REPOSITORY` from the data files of three other tests. Its "structure
  configuration" scenario also holds `gspot/suppressions` and `gspot/unmatched-paths` rows. So the bun-release-age,
  lockfile-hosts, and file-folder-clash tests live in a file you would never open for them.
- Fix: Run each check's rows in that check's own test file (for example `dependencies/lockfile-hosts.test.ts`,
  `dependencies/bun-release-age.test.ts`) with `runCheckSample` (was `runFindingCase`, in
  `tests/setup/fixes.ts`), which takes the six shared assertions. The rows go to their topic files:
  `BUN_RELEASE_AGE_CASES` and `LOCKFILE_HOST_CASES` (`tests/config/dependencies.ts`), `LONE_FILE_CASES`,
  `SHARED_PREFIX_CASES`, `FILE_FOLDER_CLASH_CASES` (`tests/config/structure.ts`), `SUPPRESSION_CASES`
  (`tests/config/suppressions.ts`), and `BUILT_PAGE_CASES` (`tests/config/site.ts`). `cases.test.ts` is split this
  way and deleted (ST1-021 for the Bash rows).
- Size: medium

### TCG-059: "general" holds checks of other configurations

- Where: `tests/cli/checks/general/site/` (the `site` configuration is a framework); `dependencies/version-pairs.test.ts` (checks `react/version-pairs`, `nextjs/version-pairs`); `generated-code.test.ts` (cloudflare, openapi, supabase, drizzle)
- Kind: move
- Problem: A reader who knows that "site" is a framework configuration will not look under "general".
- Fix: Each test follows its source: `tests/unit/cli/checks/framework/site/build.test.ts`, `built-pages.test.ts`, and
  `source-files.test.ts` (CKG-029); `tests/unit/cli/checks/framework/version-pairs.test.ts` (CKG-033);
  `tests/unit/cli/checks/stale-generated-files.test.ts` (CKG-032).
- Size: small

### TCG-060: Unneeded options passed to test functions

- Where: `dependencies/lockfile-fresh.test.ts:31,87,126` (`skips: []`, already the default in `buildRunOptions`); `structure/private-before-public.test.ts:40` (`isDryRun: true` for a check without a fix)
- Kind: delete
- Problem: Noise that makes the reader look for a meaning that is not there.
- Fix: Delete the `skips: []` options. `private-before-public.test.ts` goes whole with its check (CKG-055).
- Size: small

### TCG-061: Shared sample files have wrong or jargon headers

- Where: `tests/config/samples/typescript.ts:1` ("The package manifests of test TypeScript repositories.", but the file also holds compiler options and sources); `tests/config/samples/docs.ts:1` ("Shared authored documents for native-tool and in-process document tests.")
- Kind: delete
- Problem: The first header is wrong, the second is jargon.
- Fix: The two files merge into the topic files `tests/config/typescript.ts` and `tests/config/docs.ts` (THR-002), and
  their headers go.
- Size: small

### TCG-062: Some data comments use jargon a newcomer cannot read

- Where: `tests/config/cli/checks/general/gspot.ts:1` ("Authored native source paths remain distinct from defaults, identities, and destinations."); `naming/ownership.ts:1`; `structure/suppressions.ts:1,39`; `site/source.ts:30`; `docs.ts:1`
- Kind: delete
- Problem: The comments restate the test in abstract words.
- Fix: Delete them when the data moves to `tests/config/<topic>.ts`; a well-named constant needs no comment.
- Size: small

### ST1-001: A docs test of a folder at a task file path repeats the malformed-file test

- Where: `tests/cli/checks/general/docs/stale-paths.test.ts:165-176`; source `packages/cli/src/checks/general/docs.ts:55-64`
- Kind: delete
- Problem: "a directory at a task configuration path is an error" makes `package.json` a folder and expects `Cannot read task definitions from package.json.`. The test above it (147-163) expects the same error for a malformed
  `package.json`: `packageScripts` turns every error except `ENOENT` into that message, and a folder raises `EISDIR`.
- Fix: Delete the test. The malformed-file table keeps both its rows.
- Size: small

### ST1-002: Two jscpd tests repeat the exit-code test or only show a mock's answer

- Where: `tests/cli/checks/general/duplication.test.ts:34-63,91-110`; `tests/config/cli/checks/general/duplication.ts`; `prepareDuplicationProject`
- Kind: delete
- Problem: The refusal table's "a fatal native exit" row takes the same `code !== 0` branch as the exit-1 row of the
  next test (65-89); "a report without statistics" only shows that zod rejects a report with a missing field. The
  clean-report test (91-110) mocks a clean report and expects a pass. Report-folder deletion, its only other
  assertion, is checked by 65-89.
- Fix: Delete both tests, the table, `VALID_REPORT`, `EXECUTION_FAILURES`, and the data file. Inline the sandbox
  function into the one test left (ST1-020).
- Size: small

### ST1-003: A naming limit test reads the shipped defaults again for every language

- Where: `tests/cli/checks/general/naming/contracts.test.ts:46-60`
- Kind: delete
- Problem: "each language owns its effective ceilings" loops over six languages and four categories and checks that each
  category limit equals the language limit read from the same shipped defaults. The next test (62-86) already checks
  category inheritance through `limitsFor`; the loop adds only a snapshot of the shipped default table.
- Fix: Delete the test. `namingCeiling` (renamed `namingLimit`) keeps its user, the boundary test (88-117).
- Size: small

### ST1-004: The number-word test checks a copy of the shipped word list in 14 categories

- Where: `tests/cli/checks/general/naming/contracts.test.ts:119-139`; `tests/config/cli/checks/general/naming/contracts.ts:13-48` (`TECHNICAL_NAMES`, `NAMING_CATEGORIES`)
- Kind: delete
- Problem: `TECHNICAL_NAMES` is 15 of the words in the shipped `NUMERIC_WORDS` set
  (`packages/cli/src/config/checks/general/naming.ts:34-60`). The test checks each one in 14 categories and expects no
  finding, so it only proves the copy matches the original. The digit rule does not read the category, and the test
  stubs `limitsFor`, so the category loop reaches no new code.
- Fix: Delete `TECHNICAL_NAMES` and `NAMING_CATEGORIES`. Keep the test's real lines (`base64` with a repeated word, with
  too many words, with a banned word, and `user2` with a digit) in `tests/unit/cli/checks/general/naming/names.test.ts`,
  titled "a number word such as base64 counts as one word; repeated, extra, banned and digit words are still reported".
- Size: small

### ST1-005: Naming tables repeat one code path for shipped data rows

- Where: `naming/contracts.test.ts:212-242` with `NATIVE_NAME_CATEGORIES` (10 rows); `naming/contracts.test.ts:244-287` and `naming/paths.test.ts:71-83` over `['nextjs', 'svelte', 'astro']`
- Kind: simplify
- Problem: Each row runs the same code; what differs is shipped data (which categories the naming defaults leave without
  a length limit, and each framework manifest's `path_containers`). A second row of the same kind can only fail when
  someone edits the shipped data.
- Fix: Keep two rows of the category table, renamed `LINTER_CHECKED_CATEGORIES` in `tests/config/naming/settings.ts`:
  Swift `types` (the linter owns case and length) and Swift `functions` (gspot does). Run the route-punctuation test of `paths.test.ts:71-83` for `nextjs` only, as a plain test; the path-container test of `contracts.test.ts:244-287` follows TCG-027.
- Size: small

### ST1-007: Two SARIF tests check zod and an empty list

- Where: `tests/cli/checks/general/security.test.ts:38-57`
- Kind: delete
- Problem: "an incomplete CodeQL report cannot become a clean result" expects a throw that contains `runs` for five
  reports that miss a schema field: zod rejecting the SARIF schema. "a valid CodeQL report with no results remains
  clean" passes an empty results list and expects no findings.
- Fix: Delete both. The SARIF tests of gspot's own errors (an unsuccessful analysis, external and cyclic locations) move
  to `tests/unit/cli/parsers/output/sarif.test.ts` (TCG-021).
- Size: small

### ST1-008: Site tables copy shipped lists and per-level defaults

- Where: `tests/cli/checks/general/site/source.test.ts:23-39,75-86,137-171`; `tests/config/cli/checks/general/site/source.ts:9-28`
- Kind: simplify
- Problem: `['assets', 'public', 'static']` copies the alternatives of `ASSET_FOLDER`; the five component suffixes copy
  part of `TEXT_SUFFIXES`; three `SVG_SAVING_CASES` rows only work because of the per-level default of
  `tools.svgo.min_saving_percent`.
- Fix: Run the asset test with `assets` and the component test with `tsx`, as plain tests. In the SVG table keep the
  rows that set the value and one exact-boundary row with `percent = 10`; drop the `level` column.
- Size: small

### ST1-009: A prefix test repeats the ignore part of the first test, and a table copies the hook folders

- Where: `tests/cli/checks/general/structure/prefix-collisions.test.ts:78-98,100-145`
- Kind: delete
- Problem: "path ignores exclude named prefix peers" shows that a paths ignore removes one prefix group and keeps
  another; the first test (12-59) shows the same with `cards/**`, and ignore matching is shared code. The hook-folder
  table copies four entries of `HOOK_DIRECTORIES`.
- Fix: Delete the path-ignore test. Run the hook test for `.husky` only, as a plain test.
- Size: small

### ST1-010: The route-file table tests plain .ts files twice and the ignore code once more

- Where: `tests/cli/checks/general/structure/layout.test.ts:105-131`; `tests/config/cli/checks/general/structure/layout.ts`
- Kind: simplify
- Problem: Two of the four rows (`index.ts`, `+page.ts`) are plain lone `.ts` files, which lines 10-45 already report.
  The second half adds an `[[ignore]]` and checks that it hides the file: shared ignore code. Only the `.astro` and
  `.svelte` rows add a fact: a selected framework's extensions count as code files.
- Fix: Keep the two framework rows, drop the ignore half, and inline `loneFiles` into the one call left. Title: "a lone
  .astro or .svelte route file is reported when its framework is selected".
- Size: small

### ST1-011: License tables carry rows that repeat another row or pin JSON.parse

- Where: `tests/config/cli/checks/general/license-origins.ts:48-54`, `licenses.ts:5,57`; `docs/readme-shape.test.ts:75`
- Kind: delete
- Problem: "tooling and lockfile membership cannot justify an exception" differs from row 1 only by its scope list,
  because the sandbox function writes the same `uv.lock` for every row. "corrected exception" takes the same branch as
  "exact exception". The "malformed JSON" scanner row pins `JSON.parse` text. `LICENSE-APACHE` takes the same `-`
  branch of `LICENSE_FILE` as `LICENSE-MIT`.
- Fix: Drop the four rows; the tests stay.
- Size: small

### ST1-018: Kept tests carry a second half about another feature

- Where: `secrets/env/files.test.ts:130-145`; `platform/cloudflare/configuration.test.ts:88-99`
- Kind: delete
- Problem: The tracked-files scope test ends with an `[[ignore]]` run (shared ignore code). The Cloudflare headers test calls `security-headers` only to expect `[]` and then checks
  that the site configuration does not select Cloudflare, which is detection, not the check.
- Fix: Drop the second halves.
- Size: small

### ST1-019: Six test files write the same fake npm tool install by hand

- Where: `duplication.test.ts:19-32`, `licenses.test.ts:158-171`, `site/source.test.ts:148-155`, `framework/svelte.test.ts:21-32`, `framework/expo.test.ts:16-18`, `tool/openapi-fresh.test.ts` (23 places in `tests/`)
- Kind: merge
- Problem: Each writes `.gspot/node_modules/<tool>/package.json` with the pinned name and version, plus a
  `.gspot/node_modules/.bin/<tool>` script, to pass the version check. No shared function exists.
- Fix: Add `fakeNpmTool(root, tool)` to `tests/setup/fake-tool.ts` beside `fakeTool`, reading the pin with `toolPin`,
  and use it in these files.
- Size: small

### ST1-020: Two test functions keep one caller

- Where: `prepareDuplicationProject` (`duplication.test.ts:19-32`), `loneFiles` (`layout.test.ts:105-108`)
- Kind: simplify
- Problem: After ST1-002 and ST1-010 each function has one call left.
- Fix: Inline each into its one test.
- Size: small
