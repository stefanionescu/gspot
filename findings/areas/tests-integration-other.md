# Other integration tests

These are the tests in `tests/tools/` outside `configurations/`: commands, generation, install, npm tool project, and
tool-output tests that run gspot with real tools (37 test files, 19 data files, 6 type files). 23 of their 82 tests use
no pinned tool at all, one file checks only the test setup, and one file greps tool help text for manifest flags. The
target: tests that need installed tools stay in `tests/integration/` (one file per configuration or per flow, one real
`gspot install` per file, no test-only install cache), tests that need only `git`, `bash` or `sh` move to the unit
suite, the packed-CLI tutorial test moves to `tests/e2e/`, and test data goes to `tests/config/<topic>.ts`. In Where
lines, short paths are under `tests/tools/`.

## Layout

```text
tests/integration/
  ci.test.ts                       the generated CI job, run end to end (from commands/ci)
  fix.test.ts                      --fix with SQLFluff, typos and shfmt (from execution/fixers)
  homepage-example.test.ts         the homepage example (from commands/example)
  hooks.test.ts                    commit-hook, doctor and lifecycle/hooks
  install.test.ts                  shared-tools test 3, npm/installation and npm/refusals
  npm-tool-project.test.ts         npm/lockfiles and npm/project
  python-tool-project.test.ts      lifecycle/python-project
  template.test.ts                 commands/template
  framework/express, fastapi       from generation/semgrep
  general/security/semgrep         from generation/semgrep
  general/spelling, language/markdown   from parsers/output/markdownlint-typos
  general/structure                from generation/parameter-limits
  infrastructure/xcode             from parsers/output/plist
  language/bash/shellcheck         from parsers/output/partial-output
  language/bash/syntax             the shfmt syntax-error test of execution/fixers
  language/html                    from generation/html-accessibility
  framework/site                   from generation/site-html
  language/python/staged           from execution/python-staged
  library/zod                      the zod test of commands/add-remove-configurations
  platform/cloudflare, supabase    from generation/platform-security and generation/security
tests/unit/cli/
  commands/check/command/cancellation.test.ts, commands/check/push.test.ts, commands/check/tree/staged.test.ts,
  commands/install.test.ts, commands/remove.test.ts, generation/ci.test.ts, generation/hooks.test.ts,
  repository/scopes.test.ts, tools/npm/project/install.test.ts
tests/e2e/quickstart.test.ts       the Python and Swift tutorials
```

Deleted: `manifest-flags-in-help.test.ts`, `execution/acronyms.test.ts`, `lifecycle/mise-execution.test.ts`, the
first two tests of `lifecycle/shared-tools.test.ts`, the Express test of `generation/security.test.ts`, and the folders
`tests/config/tools/` and `tests/types/tools/`.

## Findings

### TTO-001: The flag-in-help test polices manifest data with a text grep

- Where: `manifest-flags-in-help.test.ts:1-176`, `tests/types/tools/manifest-flags-in-help.ts`
- Kind: delete
- Problem: The test runs no check. For each manifest command it guesses the flags and subcommands with regular
  expressions, runs `<tool> --help`, strips terminal overstrike bytes, and greps the text: a lint of gspot's own data.
  To do it, it builds a third private install pipeline in `beforeAll` (lines 93-150), carries a suppression that
  names two lint rules for one problem (line 64), escapes a regular expression by hand instead of `RegExp.escape`
  (line 170), and skips every case on Windows to hide a timeout (lines 94, 152-155). The real proof that a flag works
  is running the check, and 47 of the 52 manifest checks that pass flags already run in other integration tests.
- Fix: Delete both files, with the install pipeline, the suppression, the skip, the early return and the comment.
  The five checks no other test runs (`cloudflare/stale-types`, `dependencies/osv`, `security/semgrep-registry`,
  `github-actions/pinact`, `xcode/xmllint`) are inputs to the untested-logic rule after the cut; no new test is
  planned now.
- Size: small

### TTO-002: `shared-tools.test.ts` tests the test-only install cache, and CI carries two groups for it

- Where: `lifecycle/shared-tools.test.ts:29-85,87-111,113-124`, `tests/config/tools/lifecycle/shared-tools.ts`,
  `.github/workflows/ci.yml:152-157` (`shared-recommended`, `shared-all`), `ci.yml:174`
- Kind: delete
- Problem: Test 1 checks the test-only install cache in `tests/harness/install.ts:62-111` (the second sandbox gets
  the first sandbox's lockfile, the fake registry got zero requests, the copied `node_modules` sits inside the
  sandbox), which is self-policing; its product part (ESLint and Vale find `debugger` in two scopes) is covered by the
  configuration tests. Test 2 repeats the real Stylelint runs of
  `tests/tools/configurations/language/css.test.ts:38,101`. Only test 3 is a product test. Because these tests are
  slow, CI names their titles in two matrix groups and in the shard pattern, so renaming a test moves or drops it.
- Fix: Delete tests 1 and 2 and their data file. Move test 3 to `tests/integration/install.test.ts` as "after init and
  install, apply has nothing to change". The two named groups go with the other name patterns (TTC-001).
- Size: small

### TTO-003: Most sandboxes get a copied install from a test-only cache instead of their own `gspot install`

- Where: `tests/harness/install.ts:62-145,220-247` (`shareToolProjects`, `prepareSharedProjects`,
  `prepareValeProject`, `cacheDirectory`), `tests/harness/python-installation.ts:38,55-94,101-142`
  (`pythonLockfiles`, `installSuitePythonTools`, `preparePythonProject`, `sharePythonTools`); callers in this part:
  `commands/{add-remove-configurations,ci,example}`, `execution/fixers`,
  `generation/{platform-security,security,semgrep}`, `lifecycle/shared-tools`, `parsers/output/markdownlint-typos`,
  and 27 files of the configuration tests
- Kind: delete
- Problem: To save time, the test setup runs the real `gspot install` only in the first sandbox of each npm tool
  project per test process, keeps that tree in a cache folder named by a SHA-256 hash of the project files, and
  copies it into later sandboxes with gspot's own `installTree`. Python sandboxes get a copy of one suite-wide Python
  environment that `scripts/plugin.ts` installs once. About 36 files test checks on copied installs. The cache is a
  second installer written only for tests: about 150 lines, a self-test (TTO-002), two CI groups, and nine follow-up
  fixes, and its copies still go through the slow product install path.
- Fix: Delete the test-only install cache. Each integration test file runs one real `gspot install` in `beforeAll`
  (`installToolProjects` in `tests/setup/install.ts`), and its tests share that sandbox; npm and uv use their normal
  caches. Delete `shareToolProjects`, `prepareSharedProjects`, `prepareValeProject`, `cacheDirectory`,
  `TOOL_CACHE_FOLDER`, `npmProjects`, `valeProjects`, `pythonLockfiles`, `sharePythonTools`,
  `installSuitePythonTools` and `SUITE_PYTHON_FOLDER`. If installs are slow, fix the installer (LIF-001), not the
  tests.
- Size: large

### TTO-005: One feature, two suites, same file names; 23 tool-free tests sit in the integration tests

- Where: `commands/{pre-push,copies,cancellation,nested-scopes}.test.ts`, `generation/{ci,hooks}.test.ts`,
  `lifecycle/installer-failures.test.ts`, `npm/environment.test.ts`, `commands/add-remove-configurations.test.ts:62-76`;
  their twins `tests/cli/commands/check/{pre-push,copies,cancellation}.test.ts`, `tests/cli/generation/{ci,hooks}.test.ts`
- Kind: move
- Problem: Commit `8f4909236` cut these out of the unit suite because they run `bash` or `sh`. They use no pinned tool:
  `bash/bash-syntax` runs `bash -n`, and `bash` is a system tool. The result is two files with the same name for one
  feature (`pre-push.test.ts` is 30 lines in one suite and 257 in the other), and the moved tests pay for the full mise
  install of every pinned tool.
- Fix: Allow the programs that come with Git (`git`, `bash`, `sh`) in the unit suite; a test that needs `bash` skips
  when it is not on `PATH` (Git for Windows puts only `git` there by default). Merge the halves:
    - `commands/pre-push.test.ts` → `tests/unit/cli/commands/check/push.test.ts`
    - `commands/copies.test.ts` → `tests/unit/cli/commands/check/tree/staged.test.ts`
    - `commands/cancellation.test.ts` → `tests/unit/cli/commands/check/command/cancellation.test.ts`
    - `commands/nested-scopes.test.ts` → `tests/unit/cli/repository/scopes.test.ts`
    - `generation/ci.test.ts` → `tests/unit/cli/generation/ci.test.ts`; `generation/hooks.test.ts` →
      `tests/unit/cli/generation/hooks.test.ts`

    - `lifecycle/installer-failures.test.ts` → `tests/unit/cli/commands/install.test.ts` (TTO-007)
    - `npm/environment.test.ts` → `tests/unit/cli/tools/npm/project/install.test.ts`
    - the scope-removal test → `tests/unit/cli/commands/remove.test.ts` (TTO-024)

    Their data and types go to `tests/config/` and `tests/types/` topic files. The same rule lets the Bash tests of
    TTC-007 and TTC-008 move to the unit suite.

- Size: medium

### TTO-006: Semgrep is tested in three files named after the tool, with one duplicate test

- Where: `generation/semgrep.test.ts` (7 tests), `generation/security.test.ts` (2),
  `generation/platform-security.test.ts` (1), and their data `tests/config/tools/generation/{semgrep,security, platform-security}.ts`
- Kind: merge
- Problem: `security.test.ts:22` and `semgrep.test.ts:42` build nearly the same tree (root, `app` with Express,
  `app/child`, `sibling`) and both prove that the Express pack applies to `app` and `app/child` only.
  `security.test.ts:36` also picks its rows with a magic `SECURITY_FINDINGS.slice(3)`. `platform-security.test.ts` runs
  the Cloudflare and Supabase packs in root and child scopes; `semgrep.test.ts:205` runs the same packs at the root.
  Each Semgrep run is slow, and the file names say nothing about the configuration.
- Fix: Delete `security.test.ts:22-50` with `SECURITY_FILES` and `SECURITY_FINDINGS`: the Express scope test proves the
  scopes, the unit Semgrep generation test proves that the JWT lint rules follow the `jsonwebtoken` dependency, and
  the sensitive-data test reports the JWT rule. Split the rest by configuration: the Express tests go to
  `tests/integration/framework/express.test.ts` (`FRAMEWORK_FILES` becomes `EXPRESS_SCOPE_FILES` in
  `tests/config/express.ts`), the FastAPI test to `tests/integration/framework/fastapi.test.ts`, the level,
  platform-pack and repository-rule tests to `tests/integration/general/security/semgrep.test.ts`, the Supabase Deno
  test and the Supabase row of `platform-security.test.ts` to `tests/integration/platform/supabase.test.ts` (run once,
  no level loop), and the Cloudflare row to `tests/integration/platform/cloudflare.test.ts` (`test.each(LEVELS)`,
  because the `cors` finding comes only at level `all`).
- Size: medium

### TTO-007: `installer-failures` fakes mise but still installs npm tools from the public registry

- Where: `lifecycle/installer-failures.test.ts:17-101`, `tests/config/tools/lifecycle/installer-failures.ts`
- Kind: move
- Problem: Both tests replace `mise` and `uv` with `spyOn(processes, 'run')`, so no pinned tool runs. But init with
  `install: true` and the later `installCommand` still run the real `npm install --package-lock-only` and `npm ci`
  from registry.npmjs.org for the always-selected configurations, which has nothing to do with what the tests check
  (mise failures). The tests also copy the test setup's `fakeCommand` by hand, rename a field for no reason
  (`retryMessage: retryDiagnostic`), and the data file imports `CLI_PINS` from the CLI.
- Fix: `init` never installs, so each test runs `init` and then `gspot install` (`installCommand`). Fake `mise`, `uv`
  and `npm` with `fakeCommand`; the fake `npm` writes the lockfile that the next step reads. uv comes from
  `.gspot/mise.toml` through `mise bin-paths`, so the fake mise answers `bin-paths`. Expected results: with mise
  missing, `gspot install` exits 0 and prints one line that names every missing program ("Install mise, or install
  these programs yourself: ..."); with a failed mise download it exits 2 and shows mise's own output (GEN-030); with no
  uv, the missing-uv message. Drop the field rename. Move the file to `tests/unit/cli/commands/install.test.ts` and the
  table to `tests/config/tools.ts` as `MISE_FAILURES`, with a literal version and no import.
- Size: small

### TTO-009: The missing-mise hook test skips Windows only because it calls `/bin/sh` with an empty PATH

- Where: `generation/hooks.test.ts:50-65`
- Kind: simplify
- Problem: Line 58 runs `/bin/sh` and line 60 sets `PATH: ''`; the first test in the same file already runs `sh` on
  every operating system. The skip hides whether a Windows hook explains a missing mise.
- Fix: Find `sh` with `Bun.which('sh')` before the call, set `PATH` to an empty temporary folder, and remove the skip.
  The test moves to `tests/unit/cli/generation/hooks.test.ts` (TTO-005); its sandbox has no `package.json` that lists
  `@gspothq/cli`, so the hook starts gspot with `mise exec -- gspot` and prints the missing-mise line. The unit hook
  test joins the same file as a row of `RUNNER_CASES`.
- Size: small

### TTO-011: The Markdown "crash" test repeats the unit tests of exit-code handling; the file mixes two tools

- Where: `parsers/output/markdownlint-typos.test.ts:73-102`; unit twins
  `tests/cli/execution/command/findings.test.ts:21-49,88-123`, `tests/cli/parsers/output/formats.test.ts:198-210`
- Kind: delete
- Problem: The test runs markdownlint once and then edits the captured result by hand (`{ ...failed, code: 2 }`,
  `{ ...failed, stdout: '[]' }`) to check that `checkedFindings` throws: the same exit-code logic the unit tests check
  with written strings. The real run adds nothing. The file name also joins two unrelated tools.
- Fix: Delete lines 73-102. Move the markdownlint test (line 42) to `tests/integration/language/markdown.test.ts` and
  the typos test (line 104) to `tests/integration/general/spelling.test.ts`. In both, drop the newline file names and
  keep the colon names (`source:files`, `name:5.md`) with their Windows filter: tools print findings as
  `file:line:column`, so a colon in a file name is a real parsing risk.
- Size: small

### TTO-012: A Semgrep test asserts its own input, then restores a file in a folder about to be deleted

- Where: `generation/semgrep.test.ts:49,61,62-70`
- Kind: delete
- Problem: `appliedPolicy` is read right after the test writes `gspot.toml` (line 49), and line 61 checks that this
  text contains the `[[ignore]]` record the test itself wrote; nothing can fail there. Line 70 restores the broken
  rule file at the end of the test, and the sandbox is deleted next.
- Fix: Delete lines 49, 61 and 70, and `originalRule` at line 63. The test moves to
  `tests/integration/framework/express.test.ts` (TTO-006).
- Size: small

### TTO-013: "Every shipped Semgrep file validates" mostly checks the manifests and the test setup

- Where: `generation/semgrep.test.ts:142-177`
- Kind: delete
- Problem: Lines 158-166 assert that the emitted Semgrep paths equal the manifest `tool_file` targets (data compared
  with data from the same source). Lines 168-170 assert that the files on disk equal what `emitAll` returned, which
  only checks that the test wrote them. The `semgrep scan --validate` step repeats the kept Semgrep tests, which run
  every shipped pack with `semgrep scan --strict` and fail on an invalid rule file.
- Fix: Delete the test and its level table.
- Size: small

### TTO-014: A clone test hides line-ending changes that gspot's own `.gitattributes` already prevents

- Where: `npm/project.test.ts:49-52`
- Kind: fix-bug
- Problem: The test normalizes CRLF before comparing the cloned lockfile, "because Git for Windows may change checkout
  line endings". gspot writes `.gspot/** text eol=lf` into `.gitattributes`, and the test commits it before cloning,
  so a CRLF lockfile would be a real bug. The next line compares `.gspot/package.json` exactly, and the Python clone
  test compares its lockfile exactly too (`python-project.test.ts:120-124`).
- Fix: Replace lines 49-51 with
  `expect(await readFile(join(clone, '.gspot', basename(inputs.lockfilePath)))).toStrictEqual(lockfile);`. The file
  becomes part of `tests/integration/npm-tool-project.test.ts`.
- Size: small

### TTO-015: Four copies of the "refused install" block

- Where: `npm/refusals.test.ts:20-38` (`expectInstallationRefusal`), `npm/installation.test.ts:131-146`,
  `lifecycle/python-project.test.ts:165-183,220-236`
- Kind: merge
- Problem: Each copy opens the ownership log, calls `installToolProject` with a recorder `installTree` that pushes
  into a `staged` array, expects a rejection message, and expects `staged` to be empty: about 15 lines each.
- Fix: Move `expectInstallationRefusal` to `tests/setup/install.ts` as
  `expectRefusedInstall(project, root, options, message)` and call it from all five places. With packages installed
  straight into `.gspot/`, the `installTree` recorder and the `staged` list go: the helper checks only the refusal
  message and the registry request count (ST5-007).
- Size: small

### TTO-016: Three copies of "write the locked inputs", under two names

- Where: `lifecycle/python-project.test.ts:28-40` (`prepareLockfile`), `npm/lockfiles.test.ts:19-25`
  (`prepareLockfile`), `npm/project.test.ts:20-26` (`prepareInputs`); `tests/harness/npm.ts:62`
  (`prepareToolProject`)
- Kind: merge
- Problem: All three run `openSession`, `emitAll`, `prepareToolProjects(..., { refreshLockfiles: false })` and
  `writeGeneratedFiles`: two names for one action. `tests/harness/npm.ts:62` uses the same name as the product's
  `prepareToolProject` for a different step that runs `gspot apply`.
- Fix: One function `writeLockedInputs(root, log)` in `tests/setup/install.ts`, with no `refreshLockfiles` option
  (`install --refresh-lockfiles` is deleted); each test reads the bytes it needs afterwards. Inline the one-caller
  `tests/harness/npm.ts:62` into `createNpmClientSandbox` in `tests/setup/npm-clients.ts`.
- Size: small

### TTO-017: Tests copy `fakeCommand` by hand

- Where: `lifecycle/installer-failures.test.ts:24-37,73-86`, `npm/refusals.test.ts:62-73`
- Kind: simplify
- Problem: Each place saves `processes.run`, spies on it, and forwards every other command. The test setup already has
  `fakeCommand(name, result)` for exactly this.
- Fix: Use `fakeCommand('mise', ...)` and `fakeCommand('npm', ...)` from `tests/setup/processes.ts` with `using`.
  Where the match is not by name (`argv.includes('ci')`, the editorconfig-checker pattern), keep the spy but replace
  the `try`/`finally` around `mockRestore` with `using`. The copies in `npm/installation.test.ts:37-48` and
  `npm/refusals.test.ts:120-129` go with their tests (ST5-007, ST5-008).
- Size: small

### TTO-018: The Python and Swift tutorial tests are the same 60 lines twice

- Where: `commands/python-quickstart.test.ts`, `commands/swift-quickstart.test.ts`,
  `tests/config/tools/commands/{python,swift}-quickstart.ts`, `tests/harness/quickstart.ts`
- Kind: merge
- Problem: Same steps in the same order: prepare mise, create the project, init, run the setup commands, commit, paste
  the bad source, see the finding, see the hook refuse, restore, pass. Only the project command, the source path, the
  check and the expected line differ. The Swift copy is gated with `skipIf(!isMacos)` although SwiftLint has a Linux
  build.
- Fix: One `test.each` over two rows in `tests/e2e/quickstart.test.ts`, with the rows as `TUTORIALS` and the
  setup steps as `QUICKSTART_COMMANDS` in `tests/config/e2e.ts`; inline `prepareQuickstart` into the test. Each row
  pins gspot the way the docs teach (`mise use node@24 npm:@gspothq/cli@<version>`, commit `mise.toml`), then runs
  `mise exec -- gspot init`, `gspot install` and `gspot check`; the old `mise trust .mise/conf.d/gspot-tools.toml` and
  `mise install` steps and the `gspot doctor` line go. Gate the Swift row with `hasToolBuild('swiftlint')` and `swift`
  on `PATH`, not `isMacos`, and let the Swift quickstart page say "macOS or Linux" if the row passes on Linux. The tutorial tests install `npm:@gspothq/cli@<version>` from the local package registry through mise and run it as a user would, which is what the end-to-end tests are for, so the merged test lives in `tests/e2e/`.
- Size: small

### TTO-019: Every operating-system gate in this part, with a verdict

- Where: listed below
- Kind: simplify
- Problem: Four ways say "this machine cannot": `isPosix`, `isMacos`, `hasToolBuild` and raw `process.platform`, and
  several gates hide fixable test code.
- Fix, per gate (all gate names come from `tests/setup/operating-systems.ts`, SUP-008):
    - `commands/cancellation.test.ts:53,106,145`: needed (Windows cannot send SIGINT or SIGTERM to a child the way POSIX
      does); write `test.skipIf(isWindows)`.

    - `commands/swift-quickstart.test.ts:23`: gate by the tool, not the system (TTO-018).
    - `execution/python-staged.test.ts:17-19` and `lifecycle/python-project.test.ts:42,91,148,196`: the causes are test
      code. Write the fake `uv` with `fakeTool` (`tests/setup/fake-tool.ts`), join `PATH` with `delimiter`
      (`python-project.test.ts:63`), and let THR-001 write the test wheel in TypeScript, so no `python3` call is left;
      then delete the five skips and the comment at `python-staged.test.ts:17`. If a real Windows bug shows up, fix it in
      the Python install code.

    - `execution/fixers.test.ts:33` `process.platform === 'win32' || getuid() === 0`: needed (SQLFluff writes its fix
      through a new file in the folder, so only a read-only folder makes it fail, and Windows ignores that); write
      `isWindows || process.getuid?.() === 0`.

    - `generation/hooks.test.ts:50`: fixable (TTO-009).
    - `lifecycle/mise-execution.test.ts:31,90,111`: go with the file; both of its tests are deleted (gspot no longer
      refuses an old mise, and the Python tutorial test runs `mise exec -- gspot` with arguments).

    - `manifest-flags-in-help.test.ts:94,155`: go with the file (TTO-001).
    - `parsers/output/plist.test.ts:13` `describe.if(isMacos)`: needed (plutil is macOS only), but read from the pin:
      `test.skipIf(!hasToolBuild('plutil'))` on the one test, without the `describe`.

    - The Semgrep and SwiftLint `hasToolBuild` gates: needed and driven by the manifest; keep.
    - `parsers/output/markdownlint-typos.test.ts:44,106` (colon file names in data): needed (Windows forbids `:` in file
      names); write the filter with `isWindows`.

    After this, `isMacos` has no user in this part. No special time limits exist here: every child uses the one
    `TEST_TIMEOUT_MS`.

- Size: small

### TTO-021: `prepareFixer` is only "write, then install", plus a hidden guard and a default

- Where: `execution/fixers.test.ts:19-30,70`
- Kind: delete
- Problem: `buildToolsPath([tool.name])` (line 28) builds a `PATH` and throws it away; it is only a hidden "is the tool
  on PATH" guard. Once the guard and the `sharePythonTools` call go (TTO-003), the helper only writes the generated
  files and installs, which `installToolProjects` already does. Line 70 passes `skips: []`, which `buildRunOptions`
  already sets.
- Fix: Delete `prepareFixer` and `skips: []`; both tests call `installToolProjects` from `tests/setup/install.ts`. The
  tests move to `tests/integration/fix.test.ts`.
- Size: small

### TTO-022: Two shfmt tests check the same 4-space fix

- Where: `execution/fixers.test.ts:90-108,110-125`, `tests/config/tools/fixers.ts:25`
- Kind: merge
- Problem: The first test (lines 90-108) fixes a script to 4-space indentation at level `all`; the
  `space` row of the next test fixes to 4 spaces too. The first adds only "the run without the fix fails" and the
  default style (no `[format]` table).
- Fix: One `test.each(['default', 'space', 'tab'])` that first expects exit 1 without `--fix`, then fixes, then passes;
  the `default` row has no `[format]` table. Delete `SHFMT_FORMATTED_SCRIPT`.
- Size: small

### TTO-023: The nested-scopes test re-checks setting inheritance that `list.test.ts` already checks

- Where: `commands/nested-scopes.test.ts:17-21`; twin `tests/cli/commands/list.test.ts:105-134`
- Kind: delete
- Problem: Lines 17-21 list settings and check the inherited values for `api/worker`, as the unit list test does with
  the same `NESTED_SCOPES_POLICY`. The unique part of the test is "each file is checked once, in its deepest scope"
  (lines 22-32).
- Fix: Delete lines 17-21 and the `SettingsListJson` import. Move the rest to `tests/unit/cli/repository/scopes.test.ts`
  (TTO-005).
- Size: small

### TTO-024: The scope-removal test repeats the unit remove test and needs no tool

- Where: `commands/add-remove-configurations.test.ts:62-76`, `tests/config/tools/commands/add-remove-configurations.ts:6-11`;
  twin `tests/cli/commands/remove.test.ts:44-74`
- Kind: move
- Problem: The settings result (`removed_configurations = ["bash"]` in the `api` scope) is what the unit `remove` test
  checks. The new part, "the scope's `shellcheckrc` is deleted", needs only `apply` and `remove`.
- Fix: Add the `shellcheckrc` exists and deleted assertions to the unit `remove bash --scope api` test; delete lines
  62-76 and `BASH_IN_API`.
- Size: small

### TTO-025: The pre-push test checks the test setup's stdin handling

- Where: `commands/pre-push.test.ts:26,29`
- Kind: delete
- Problem: Line 29 checks that `runGspot` put `process.stdin` back. That is the test setup, not gspot.
- Fix: Delete lines 26 and 29. The test moves to `tests/unit/cli/commands/check/push.test.ts` (TTO-005).
- Size: small

### TTO-026: The CI command test has a dead control, a test-setup check, and a late assertion

- Where: `commands/ci.test.ts:17-21,59,94-97,139,174-200`, `tests/types/tools/ci.ts:12-13`
- Kind: delete
- Problem: `CiInstallation.allow` is never called (only `refuse` is), and two of three tests discard the return of
  `createCiInstall`. Line 59 (`expect(environment['PATH']).toContain(root)`) checks what the test setup returns. Line
  139 checks that `generated` has the property the job already used at line 134. The test at lines 174-200 sets up a
  full-tree job and a `ci.files` value, neither of which exists in the target `gspot.toml`.
- Fix: Delete `allow` and the `CiInstallation` type (`createCiInstall` returns `refuse` alone), and lines 59 and 139; the test at lines 174-200 goes with DT3-002. Delete
  `tests/types/tools/ci.ts`. The file becomes `tests/integration/ci.test.ts`.
- Size: small

### TTO-027: The template tests depend on each other through shared module state

- Where: `commands/template.test.ts:17-19,21-73,129-142`
- Kind: simplify
- Problem: Two sandboxes are created at import time (`const first = testdir()`), filled in two `beforeAll` calls, and
  changed by the tests in order, so a test run alone misses the state of the others. Line 31 removes
  `--no-agent-rules` from the setup output with a `.filter`.
- Fix: One test, "an exported template sets up another repository", that runs the three steps in order, in
  `tests/integration/template.test.ts`, with no `describe`. Delete the `.filter`: `init` has no such flag, and rules
  are on by default.
- Size: small

### TTO-028: The acronym test bypasses gspot's Vale setup

- Where: `execution/acronyms.test.ts:10-55`
- Kind: delete
- Problem: It writes its own `.vale.ini`, copies two emitted files into a `styles/` folder it invents, and runs `vale`
  by hand. If gspot's real Vale settings change how the style is read, the test stays green: it never runs gspot's
  Vale setup.
- Fix: Delete the file (a weak test).
- Size: small

### TTO-029: The HTML tests check the tool's own settings print, and their shared build script lives in one test's data

- Where: `generation/html-accessibility.test.ts`, `generation/site-html.test.ts`,
  `tests/config/tools/generation/{html-accessibility,site-html}.ts`, `tests/types/tools/generation/html.ts`,
  `tests/config/samples/site.ts:2-3`
- Kind: simplify
- Problem: Both tests copy html-validate in, apply, check, run `html-validate --print-config`, fix, check again, and
  compare files. The `--print-config` step (`html-accessibility.test.ts:46-61`, `site-html.test.ts:52-67`) is weak: the
  finding and its absence after the fix already prove the rule setting. Both level loops expect the same findings at
  both levels. `SITE_HTML_BUILD` is used by both tests but lives in one test's data file, next to a third copy-pages
  build script in `tests/config/samples/site.ts`.
- Fix: Delete both `--print-config` steps, `HtmlValidationConfiguration` and both level loops (each test runs once).
  The tests go to their configuration files: `tests/integration/language/html.test.ts` and
  `tests/integration/framework/site.test.ts`. `SITE_HTML_BUILD` becomes `COPY_PAGE_BUILD` in `tests/config/site.ts`,
  beside the other site build script.
- Size: small

### TTO-030: The homepage replay rewrites the recorded transcript with 30 lines of string surgery

- Where: `commands/example.test.ts:31-60,80-84,94-102`
- Kind: simplify
- Problem: `expectedTranscript` edits the recorded text to mark checks the plan skips on this operating system, moves
  rows, and recomputes the totals line with a regular expression. It is hard to read and easy to break, and the JSON
  findings comparison (lines 85-88) already proves the same findings.
- Fix: Replace `expectedTranscript` with `dropOperatingSystemSkips`, which removes the rows of skipped checks from both
  sides; compare the totals from the JSON report. Rename `recorded` to `sortedFindings`. Delete the row moving and
  total rewriting. The file becomes `tests/integration/homepage-example.test.ts`.
- Size: small

### TTO-031: The shared Semgrep check command lives in one test's data, and another file retypes it

- Where: `tests/config/tools/generation/semgrep.ts:156-157`, `generation/security.test.ts:31,61`
- Kind: move
- Problem: `SEMGREP_COMMAND` is imported by 4 test files but lives in the data of `generation/semgrep.test.ts`. Its
  comment says it is "shared by generated-pack and output-parser cases"; no output-parser test uses it.
  `security.test.ts` types the same array inline twice.
- Fix: Move it to `tests/config/execution.ts` as `SEMGREP_CHECK`, with the comment "The Semgrep check with a JSON
  report.", and use it in the Supabase Semgrep test too.
- Size: small

### TTO-032: `PACKAGE_PROJECTS` sits in the test-setup data but only tests use it; its name has two meanings

- Where: `tests/config/harness/npm.ts:11-18` (`PACKAGE_PROJECTS`); `tests/config/cli/planning/requirements.ts:9-48` (`NODE_REQUIREMENTS`); users `npm/{lockfiles,project,refusals}.test.ts`; another meaning in
  `tests/config/cli/checks/library/swift-snapshot-testing.ts`
- Kind: rename
- Problem: The test setup (`tests/harness/npm.ts`) does not use it, and two different constants share the name. It and `NODE_REQUIREMENTS` vary the runner setting, which INX-003 deletes: without it, `['npm', 'package.json', 'none']` equals the first row, and the "npm EditorConfig wrapper" row (`runner = "npm"`) equals the first Python row.
- Fix: Move it to `tests/config/npm.ts` as `NPM_CLIENT_ROWS` ("manager" is a banned name part). Drop the runner column and the two repeated rows from it and from `NODE_REQUIREMENTS`, which moves to `tests/config/planning.ts` and whose tool row reads `NPM_CHECK_IGNORES` from `tests/config/settings/file.ts`.
- Size: small

### TTO-034: Type and data files that hold one line for one test

- Where: `tests/types/tools/cancellation.ts`, `tests/types/tools/ci.ts`, `tests/config/tools/commands/cancellation.ts`
  (1 line), `tests/config/tools/commands/doctor.ts` (1 line)
- Kind: move
- Problem: `CHILD_OPTIONS` and `HOOK_DOCTOR_TOOLS` are single-line constants with one user each, in files of their
  own; the two type files sit in a folder that copies the test tree.
- Fix: `CopyMarker` becomes `PausedGit` in `tests/types/processes.ts`; `FakeGitOptions` is written in the signature of
  `fakeGit`; `tests/types/tools/ci.ts` goes (TTO-026). Delete `CHILD_OPTIONS`: `startCommand` in
  `tests/setup/processes.ts` owns those options. Delete `HOOK_DOCTOR_TOOLS`: `toolsPath()` takes no names. Delete both
  one-line files.
- Size: small

### TTO-035: An unused type field

- Where: `tests/types/tools/generation/parameter-limits.ts:4`
- Kind: delete
- Problem: `ParameterDiagnostic.severity` is never read; the only user reads `code`, `rule_id`, `location` and `line`.
- Fix: Delete the field. The type becomes `ParameterFinding` in `tests/types/tool-output.ts`.
- Size: small

### TTO-038: File names that do not say what is tested

- Where: `commands/copies.test.ts`, `lifecycle/shared-tools.test.ts`, `parsers/output/markdownlint-typos.test.ts`,
  `commands/example.test.ts`, `manifest-flags-in-help.test.ts` (the only file at the suite root)
- Kind: rename
- Problem: "copies" means "staged checks read the Git index"; "shared-tools" means the test-only install cache; two
  tool names are glued; "example" does not say which example.
- Fix: `copies.test.ts` → `tests/unit/cli/commands/check/tree/staged.test.ts` (TTO-005); `shared-tools.test.ts` →
  `tests/integration/install.test.ts` (TTO-002); `markdownlint-typos.test.ts` → the markdown and spelling
  configuration files (TTO-011); `example.test.ts` → `tests/integration/homepage-example.test.ts`; delete
  `manifest-flags-in-help.test.ts` (TTO-001).
- Size: small

### TTO-039: The cancellation test writes a POSIX-only fake Git and its own wait loop

- Where: `commands/cancellation.test.ts:18-29,32-51`
- Kind: simplify
- Problem: `fakeGit` writes a file with a `#!bun` line, which only POSIX runs; `fakeTool` writes the Windows wrapper
  too. `waitForJson` is a second polling loop beside `waitForFile`, which exists only because the marker may be half
  written.
- Fix: Build the fake with `fakeTool` (`tests/setup/fake-tool.ts`). In the fake, write the marker to a temporary name
  and rename it; then use `waitForFile` (`tests/setup/processes.ts`) and one read, and delete `waitForJson`. The signal
  skips stay (TTO-019).
- Size: small

### TTO-041: A Semgrep test uses a test-setup install call as a hidden `apply`

- Where: `generation/semgrep.test.ts:90-91`
- Kind: simplify
- Problem: After rewriting `gspot.toml` to level `all`, the test calls `sharePythonTools` and throws the result away;
  the call only writes the Semgrep files again. A reader cannot see that.
- Fix: Replace line 91 with `spawnGspot(sandbox.path, ['apply'])` and assert exit 0.
- Size: small

### TTO-043: The zod add-and-remove test asks for three tools it never runs

- Where: `commands/add-remove-configurations.test.ts:30`
- Kind: simplify
- Problem: `buildSandboxPath(['typos', 'editorconfig-checker', 'ast-grep'])` asks for three tools, but every check in
  the test is `--only javascript/eslint`.
- Fix: Call `sandboxPath()`, which takes no tool names. The test moves to `tests/integration/library/zod.test.ts` and
  runs a real `gspot install` (TTO-003).
- Size: small

### ST5-007: Install tests lock in the staging folder and swap that no longer exist

- Where: `npm/installation.test.ts:21-64` (with its table), `npm/refusals.test.ts:81-112`; the `installTree` recorder
  and kept-tree assertions in `npm/refusals.test.ts:40-79`, `npm/installation.test.ts:118-152`, and
  `lifecycle/python-project.test.ts:91-146,148-194,196-244`
- Kind: delete
- Problem: Package managers install straight into `.gspot/`, with no staging folder, swap or recovery; after a failed
  install the user runs `gspot install` again. These tests assert the opposite: a failed `npm ci` keeps the old tree,
  a 404 reinstall "keeps the working tools and leaves no scratch folder", a refused install publishes nothing through
  `installTree`, and a relocated copy of the Python environment still runs. In the first test the tree assertion
  cannot fail anyway, because the mocked `npm ci` never touches `node_modules`.
- Fix: Delete `installation.test.ts:21-64` and `refusals.test.ts:81-112`. In the kept refusal tests, drop the
  `installTree` recorder and the kept-tree assertions and keep the refusal messages (TTO-015). Drop the relocated-copy
  half of `python-project.test.ts:91-146` (lines 134-144): the environment is built in place. One risk for the install
  change, kept in the credentials test: the check that refuses a lockfile holding the index password must run before
  the lockfile lands in `.gspot/`, or a refused install leaves the password in the committed `uv.lock`.
- Size: medium

### ST5-008: A test of a deleted guard is still kept

- Where: `npm/refusals.test.ts:114-134`
- Kind: delete
- Problem: LIF-002 deletes the "inputs changed during installation" guard, because production never reads the disk
  again during an install. This test passes only because it hands `installToolProject` a disk reader that production
  never uses.
- Fix: Delete the test.
- Size: small

### ST5-009: Kept tests assert flags, output and install steps that the CLI cleanup deletes

- Where: `npm/lockfiles.test.ts:34,57` (`install --dry-run`), `npm/installation.test.ts:66-116`
  (`install --refresh-lockfiles`), `lifecycle/hooks.test.ts:44-55,91,149`,
  `tests/tools/configurations/general/commits/hooks.test.ts:129`, `generation/hooks.test.ts` (`HOOK_CASES`),
  `tests/tools/configurations/language/bash/lifecycle.test.ts:43,94-139`, `commands/cancellation.test.ts:86,133,179`,
  `lifecycle/installer-failures.test.ts`, `commands/python-quickstart.test.ts` (setup commands), and the
  `runner = "mise"` lines of `STYLELINT_SETTINGS`, `MARKDOWNLINT_SETTINGS`, `TAILWIND_SETTINGS` and the fix and hook
  tables
- Kind: delete
- Problem: `install --dry-run` and `install --refresh-lockfiles` are deleted. The commit-msg hook runs
  `gspot check --message-file "$1"`, with no `--hook` and no bypass line. `init` ends with "run gspot install", not
  "run gspot check". Two hook tests put the `scripts/gspot` launcher on `PATH`. Without mise, `gspot install` prints
  one line and exits 0. After Ctrl-C gspot exits 130 (SIGINT) or 143 (SIGTERM), while the cancellation tests expect 2.
  `unignore --paths` takes only those paths out of the ignore. The quickstart's `mise trust` and `mise install` steps
  and the `runner` setting go.
- Fix: Drop the dry-run halves (the lockfile test's title becomes "apply keeps a stale lockfile and install repairs
  it"), delete `installation.test.ts:66-116`, and drop the `refreshLockfiles` option everywhere. Drop the bypass-line
  assertion and the `--hook commit-msg` expectation of `HOOK_CASES`. Expect "run gspot install" after `init`. Expect
  130 and 143 after a stop, with the same `exitCode` in the JSON report. Expect the one-line missing-mise result
  (TTO-007). Expect `unignore --paths` to remove only those paths. Delete every `runner` line and the runner column.
  Drop the two `hookStatus` assertions of the `core.hooksPath` test: the doctor test that joins the same file checks
  the same two texts through `gspot doctor`. Once the launchers go (the last step of the order of work), build the
  hook `PATH` from the folder where the integration preload writes the gspot command.
- Size: small

### ST5-010: Two tests read the gspot version from `package.json` again

- Where: `commands/copies.test.ts:12`, `lifecycle/installer-failures.test.ts:17`
- Kind: delete
- Problem: Both destructure `version` from `#cli-package`, although the CLI already exports this value, and a third
  test file (`tests/cli/lifecycle/version-pin.test.ts:14`) makes a third copy.
- Fix: Delete the copies and import `GSPOT_VERSION` from `packages/cli/src/apply/version-pin.ts`.
- Size: small
