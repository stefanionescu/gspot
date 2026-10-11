# The tests/ layout and shared test code

`tests/` is one Bun workspace (`@gspothq/tests`) with 956 tracked files today: the fast CLI tests (`tests/cli/`), the
ESLint plugin tests (`tests/plugin/`), the tests that run the real tools (`tests/tools/`), the tests of the packed
packages (`tests/packages/`), shared test code (`tests/harness/`), and test data and types in two copies of the test
tree (`tests/config/`, `tests/types/`). `scripts/plugin.ts` starts every suite. The target: three suites named for what
they need (`tests/unit/`, `tests/integration/`, `tests/e2e/`), each started by `bun test` from a mise task with no
runner script, shared code in `tests/setup/`, and test data and types grouped by topic in `tests/config/` and
`tests/types/`. No new test is planned.

## Layout

```text
tests/
  unit/
    cli/             unit tests of packages/cli/src; each test sits at the path of the source file it tests
    eslint-plugin/   tests of packages/eslint-plugin
  integration/       gspot with the pinned tools installed, on sample repositories
  e2e/               both npm packages, packed and installed in a new project
  setup/             code that two or more test files share, and the two Bun preloads
  config/            test data, one file per topic (tests/config/<topic>.ts)
  types/             types that two or more modules use
  package.json       test dependencies
```

| Suite                | Task                        | Command                                                                                                |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tests/unit/`        | `mise run test`             | `bun test tests/unit` (the preload `tests/setup/preload.ts` comes from `bunfig.toml`)                  |
| `tests/integration/` | `mise run test:integration` | `bun test --preload ./tests/setup/preload.ts --preload ./tests/setup/integration.ts tests/integration` |
| `tests/e2e/`         | `mise run test:e2e`         | `bun test --preload ./tests/setup/preload.ts --preload ./tests/setup/integration.ts tests/e2e`         |

Each task depends on `build`. The CI jobs carry the same names (`unit`, `integration`, `e2e`). The preload
`tests/setup/integration.ts` packs both packages, installs every pinned tool with mise, uses a private Bun cache,
writes the `gspot` command, sets the run folder and registry variables in `process.env`, and removes its temporary
folder at the end or on Ctrl-C (exit 130 or 143). Its values live in `tests/config/integration.ts`.

Three rules make the layout:

1. A suite folder says what its tests need: nothing installed (`unit`), the pinned tools (`integration`), or the packed
   packages (`e2e`). The folder name is also the task name and the CI job name.
2. Each unit test sits at the path of the source file it tests. A test file that goes over 300 lines splits by
   behavior into a folder of that name.
3. Test data goes to `tests/config/<topic>.ts`, grouped by topic; only a single short literal stays in a test file,
   and a value built from code when its file is imported stays in the file that builds it. `tests/config/` imports
   only `tests/config/`. `tests/types/` holds the types that two or more modules use; a type used by one function is
   written in its signature. `tests/setup/` holds no module-level constants or types.

## Shared test code

| Today (`tests/harness/`)    | Target (`tests/setup/`)                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-case.ts`             | `fixes.ts` (`runCheckSample`, `checkChanges`)                                                                                                                      |
| `command.ts`, `process.ts`  | `processes.ts`                                                                                                                                                     |
| `consumer.ts`               | `e2e-sandbox.ts` (`createPackedSandbox`, `setUpPackedSandbox`)                                                                                                     |
| `docker.ts`                 | deleted (SUP-008)                                                                                                                                                  |
| `environment.ts`            | `environment.ts` (environment variables only); module folders to `modules.ts`, `packedEnvironment` to `e2e-sandbox.ts`, `isolateCompilerCache` to `check-input.ts` |
| `expectations.ts`           | `matchers.ts`                                                                                                                                                      |
| `fixer.ts`                  | `fixer.ts`                                                                                                                                                         |
| `generated.ts`              | `generate.ts`                                                                                                                                                      |
| `git.ts`                    | `git.ts`                                                                                                                                                           |
| `gspot.ts`                  | `run-gspot.ts`                                                                                                                                                     |
| `init.ts`                   | `init.ts`                                                                                                                                                          |
| `input.ts`                  | `check-input.ts`; `projectChecks` moves into `tests/unit/cli/planning/files.test.ts`                                                                               |
| `install.ts`, `registry.ts` | `install.ts`                                                                                                                                                       |
| `migrations.ts`             | into its one test, `tests/unit/cli/checks/database/postgres/schema.test.ts`                                                                                        |
| `npm.ts`                    | `npm-clients.ts`                                                                                                                                                   |
| `pins.ts`                   | `pins.ts`                                                                                                                                                          |
| `platforms.ts`              | `operating-systems.ts`, `modules.ts`, `fake-tool.ts`                                                                                                               |
| `policy.ts`                 | `settings.ts`                                                                                                                                                      |
| `preload.ts`                | `preload.ts`                                                                                                                                                       |
| `preservation.ts`           | `files.ts`                                                                                                                                                         |
| `python-installation.ts`    | `python.ts`; `createPythonIndex` moves into `tests/integration/python-tool-project.test.ts`                                                                        |
| `quickstart.ts`             | into its one test, `tests/e2e/quickstart.test.ts`                                                                                                                  |
| `repository.ts`             | `sandbox.ts`; `preserveSandboxChanges` moves into `tests/integration/general/files.test.ts`                                                                        |
| `ruff_wheel.py`             | deleted (THR-001)                                                                                                                                                  |
| `rule-tester.ts`            | `rule-tester.ts`                                                                                                                                                   |
| `syntax.ts`                 | into its one test, `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`                                                                             |
| `tooling.ts`                | `manifest.ts`                                                                                                                                                      |
| `tracked.ts`                | `tracked-file.ts`                                                                                                                                                  |
| none                        | `integration.ts`, the preload of `test:integration` and `test:e2e`                                                                                                 |
| none                        | `repository.ts`, `hookContext` (TEL-054)                                                                                                                           |

## Findings

### THR-001: One 51-line Python helper pulls the whole Python toolchain into this repository

- Where: `tests/harness/ruff_wheel.py`; `tests/harness/python-installation.ts:202-241`; `tests/ruff.toml`;
  `tests/pyrightconfig.json`; `.gspot/config/tests/ruff.toml`; `.gspot/config/tests/basedpyrightconfig.json`;
  `gspot.toml:6`; `AGENTS.md:50-55`; `.gspot/pyproject.toml`; `.gspot/uv.lock`; `.gspot/rules/language/python/*.md`
- Kind: delete
- Problem: `ruff_wheel.py` writes a fake Ruff wheel for the Python tool project test, and it is the only Python file in
  the repository. The root `gspot.toml` selects the `python` configuration only to check it. That brings six Python
  rule files into `AGENTS.md`, two pointer files in `tests/`, two generated tool files, and five Python tool pins
  (`basedpyright`, `deptry`, `import-linter`, `pydoclint`, `ruff`) into the repository's own tool project. It also needs
  a `python3` on `PATH` on every Linux and macOS machine that runs the integration tests.
- Fix: Write the wheel in TypeScript inside `createPythonIndex` (today `createPythonRegistry`; it moves into its one
  user, `tests/integration/python-tool-project.test.ts`): build the five entries and `RECORD` (SHA-256, base64url), and
  write a zip with `node:zlib` `crc32` (local headers, central directory, end record; about 40 lines). Store the entries
  without compression, as the Python file does, so `deflateRawSync` is not needed, and set the Unix mode in each
  central-directory entry (0o755 for `ruff-<version>.data/scripts/ruff`, 0o644 for the rest). Delete `ruff_wheel.py`.
  Remove `"python"` from `configurations` in `gspot.toml`, run `gspot apply`, and let it delete `tests/ruff.toml`,
  `tests/pyrightconfig.json`, the two `.gspot/config/tests/` files, and the Python rule links in `AGENTS.md`. uv stays
  (Semgrep, yamllint, and zizmor need it).
- Size: medium

### THR-002: `tests/config/` and `tests/types/` copy the test tree and mostly hold one-use files

- Where: `tests/config/**` (378 files, 13,644 lines); `tests/types/**` (60 files, 643 lines); `AGENTS.md` ("Test
  `config/` and `types/` folders mirror the tests that use them"); `gspot.toml:50-68` (`[[naming.overrides]]` entries
  that name `tests/types/...` or `tests/config/...`)
- Kind: merge
- Problem: Each test reads its data from a second file in a copy of the test tree, and its types from a third file in
  another copy, so a reader opens three files to understand one test. 275 of 378 data files and 26 of 60 type files
  have exactly one importer; 62 data files and 23 type files have 5 lines or fewer; about half of the 72 exports of
  `tests/config/harness/` and `tests/types/harness/` are used only by the helper of the same name. The copies do not
  even follow the test tree, and `tests/types/harness/registry.ts` and `tests/harness/registry.ts` import each other.
- Fix: Keep `tests/config/` and `tests/types/`, grouped by topic, with no copy of the test tree (LAY-012 lists the
  files). Test data goes to `tests/config/<topic>.ts` (for example `execution.ts`, `planning.ts`, `system.ts`,
  `repository.ts`, `tools.ts`, `npm.ts`, `git.ts`, `e2e.ts`, `processes.ts`, `eslint-plugin.ts`, `ci.ts`,
  `settings/file.ts`); the constants that sit in setup files today move there too. A single short literal used by one
  test file stays in it, and a value built from code when its file is imported stays where it is built (`isWindows`,
  `isMacos`, `installedModules`, `testModules`, `CLI_SOURCE`, `CLI_MAIN`, `packedEnvironment`, `PEER_PACKAGES`,
  `FAKE_MISE`, the `backends` and `captures` tables). `tests/config/` imports only `tests/config/` and writes its values
  `as const`; `tests/types/` holds only types that two or more modules use and may import `tests/config/`,
  `tests/types/`, and the CLI's types (`import type`). This repository's `[[architecture.module]]` list gives
  `tests/config/` and `tests/types/` one module each. The `AGENTS.md` text follows DCX-017. Move the
  `[[naming.override]]` entries that name old test paths with their files.
- Size: large

### THR-004: A unit test builds the whole CLI and rewrites `packages/cli/dist` to test the test runner

- Where: `tests/cli/scripts/plugin.test.ts`; `tests/config/cli/scripts/plugin.ts`; `tests/types/cli/scripts.ts`;
  `scripts/plugin.ts:96-103`, `:170-177`
- Kind: delete
- Problem: The test checks that pressing Ctrl-C during the test runner's packing exits with 130 or 143 and removes its
  temporary folder: the test code testing itself. It runs `scripts/plugin.ts --help`; `--help` is not a suite word, so
  the runner runs the full CLI build first (which deletes `packages/cli/dist`), twice (SIGINT and SIGTERM), inside the
  unit suite.
- Fix: Delete the test, its data and type files, and `GSPOT_PACKAGE_MARKER` (only the test and its fake `npm` use it).
  The Ctrl-C cleanup itself stays: the preload `tests/setup/integration.ts` removes its temporary folder and exits 130
  or 143 on SIGINT and SIGTERM, with those exit codes in `tests/config/integration.ts` (SCR-003).
- Size: small

### THR-007: Three test dependencies are dead or used only for a side effect

- Where: `tests/package.json:7`, `:24`, `:75`; `gspot.toml:276-278` (knip ignore); `tests/config/packages/plugin.ts:2`, `:9`;
  `tests/harness/install.ts:154`
- Kind: delete
- Problem: `std-env` has no importer in `tests/`; it was added for a test that later stopped importing it, and a knip
  ignore hides it. `@typescript-eslint/utils` is read only for its version string. `@gspothq/cli: workspace:*` has no
  importer; its only effect is `tests/node_modules/.bin/gspot -> ../@gspothq/cli/dist/gspot.js`, which puts the last
  built `dist`, not the source, first on the tools `PATH`.
- Fix: Delete `std-env` and `@typescript-eslint/utils` from `tests/package.json` and from the knip pattern in
  `gspot.toml` (then `gspot apply` rewrites `.gspot/config/knip.json`). The e2e test reads the typescript-eslint
  version from `testsPackage.devDependencies['typescript-eslint']` (the packages share one version number) in its own
  file (`PEER_PACKAGES`, built when the file is imported), not from the plugin's `^8.70.0` range, which would install a
  different 8.x on different days. Delete the `@gspothq/cli` dependency (keep `@gspothq/eslint-plugin`, which generated
  configs import); tests that run `gspot` by name use the command the preload writes. Run the integration suite once
  after the change.
- Size: small

### THR-008: 49 tool versions are written twice, and npm tools reach test repositories three ways

- Where: `tests/package.json:10-89`; `packages/cli/configurations/**/manifest.toml`; `tests/harness/platforms.ts:59-120`;
  `tests/harness/install.ts:62-145`
- Kind: merge
- Problem: 49 devDependencies are exact copies of manifest npm pins (49 equal, 0 different). Nothing keeps them equal:
  when a manifest pin changes, the unit tests keep using the old plugin. Test repositories also get npm tools three
  different ways: links to all of `tests/node_modules` (`linkInstalledModules`), a copy of one module
  (`copyInstalledModule`), and a real `gspot install` cached by file content and copied into each repository
  (`prepareSharedProjects`).
- Fix: Keep the 49 entries (Bun installs only the packages a workspace declares, and test files import `eslint` and
  `stylelint` by name). Remove the hand copy instead: `scripts/update-rule-lists.ts` (task `update:rule-lists`), which
  already reads every manifest npm pin, writes those versions into `tests/package.json` and then runs `bun install`.
  TTO-003 removes `prepareSharedProjects`; then delete `copyInstalledModule`, and its two site HTML tests use
  `linkInstalledModules`.
- Size: medium

### THR-009: `buildToolsPath(names)` returns the same `PATH` whatever names it gets

- Where: `tests/harness/install.ts:147-175`; 51 calls in `tests/tools/**`, `tests/harness/`, and `scripts/plugin.ts:55`
- Kind: simplify
- Problem: The tool names change nothing in the result. They only feed a guard that throws "Required test tool X is
  unavailable" when the runner did not install the tool. Every pin is installed before the tests start, and a missing
  tool already shows as a `missing` check in the report.
- Fix: Replace it with `toolsPath()` in `tests/setup/install.ts`, with no parameter (it reads `PATH` when called), and
  `buildSandboxPath(names)` with `sandboxPath()`. Delete the guard and the names at all call sites.
- Size: medium

### THR-010: The `step` parameter of the command runners is never passed

- Where: `tests/harness/command.ts:55-88`; `tests/config/harness/command.ts`
- Kind: delete
- Problem: `runTestCommand` and `runTestCommandBlocking` take a `step` name with a default built from
  `STEP_ARGUMENTS = 2`. None of their 159 and 32 callers passes it, and the timeout message already prints the whole
  command. The two functions also repeat the same 3-line timeout error.
- Fix: Delete the `step` parameter from both (`runCommand` and `runCommandBlocking` in `tests/setup/processes.ts`),
  delete `tests/config/harness/command.ts`, and build the timeout error in one small function both use.
- Size: small

### THR-011: Dead branches in the packed-package helper, and a test assertion on the dead branch

- Where: `tests/harness/consumer.ts:28`, `:121-136`; `tests/types/harness/consumer.ts:21-33`; `tests/packages/languages.test.ts:112`
- Kind: delete
- Problem: `PackageCheckCase` allows `{ fix: true }` and `isNpm`, and `runPackageCheck` has a `--fix` branch that
  returns `fixed`. No data uses `fix: true` or reads `isNpm`. `languages.test.ts` then asserts
  `expect(fixed).toBeUndefined()`, which tests the helper's dead branch. `createConsumer` takes `registry.url` but uses
  only `registry.npmrc`, and `runPackageCheck` has one caller.
- Fix: Delete `isNpm`, the `fix` variant, `fixed`, `PackageCheckOutcome`, the `if (check.sample !== undefined)` guard,
  and `languages.test.ts:112`. Move `runPackageCheck` into `tests/e2e/languages.test.ts` as `runPackedCheck`, with its
  type written in its signature. `createPackedSandbox` (was `createConsumer`, in `tests/setup/e2e-sandbox.ts`) takes
  the `.npmrc` path.
- Size: small

### THR-012: The installed security-pack test repeats a unit test

- Where: `tests/packages/security.test.ts`; `tests/config/packages/security.ts`
- Kind: delete
- Problem: The test installs the packed CLI, runs `apply`, and checks that two generated Semgrep files contain one rule
  ID each. `tests/cli/generation/semgrep.test.ts` already checks the JavaScript Semgrep files, the integration Semgrep
  test covers the Swift rule, and every other packed-package test already proves that the package ships
  `configurations/`.
- Fix: Delete both files.
- Size: small

### THR-014: The installed plugin test compares copied license and README bytes

- Where: `tests/packages/plugin.test.ts:14-22`, `:47-72`
- Kind: delete
- Problem: `expectPluginPayload` checks that the build copied two files into the package, a "file exists" check of the
  build script. The rest of the test (the plugin works through `import` and `require`, the rule fires at both levels,
  the types compile) is the real test.
- Fix: Delete `expectPluginPayload` and its call, and drop the license and README from the test title (in
  `tests/e2e/eslint-plugin.test.ts`).
- Size: small

### THR-015: The packed-package tests repeat the same setup three times and branch inside a two-item loop

- Where: `tests/harness/consumer.ts:80-105`; `tests/packages/tools.test.ts:17-95`; `tests/packages/languages.test.ts:94-125`;
  `tests/types/packages.ts`
- Kind: simplify
- Problem: "Run init, set the level, run install, throw on failure" is written three times. `prepareFormatterConsumer`
  builds its own environment and unsets six proxy variables by hand. `languages.test.ts` loops over two checks and then
  asks `if (check === SWIFT_CHECK)` and `if (check === PROSE_CHECK)` inside the loop, so the loop hides two different
  tests. `tests/types/packages.ts` holds two return types of two local functions.
- Fix: One helper, `setUpPackedSandbox(installation, { cwd, configurations, level })`, in
  `tests/setup/e2e-sandbox.ts`. `prepareFormatterSandbox` starts from the online options and keeps `NO_PROXY` for the
  local registry. Write the prose check and the Swift check as two plain blocks. Delete `tests/types/packages.ts` and
  let TypeScript infer the two return types.
- Size: small

### THR-016: Test settings travel through a JSON environment variable named "release"

- Where: `scripts/plugin.ts:150-157`; `scripts/types/package.ts`; `tests/harness/consumer.ts:107-112`;
  `tests/harness/install.ts:66-71`; `tests/harness/python-installation.ts:102-103`, `:133-139`; `tests/harness/registry.ts:73-75`
- Kind: simplify
- Problem: Nothing is published, yet the type is `PublishedRelease` and the variable `GSPOT_PACKAGE_RELEASE`. Its
  `version` repeats `#cli-package`, and its `work` folder repeats `dirname(GSPOT_PACKAGE_ARCHIVES)`, a variable that
  names a JSON list of packed packages, not archives. The type lives in `scripts/types/` though only tests read it.
- Fix: Delete `PublishedRelease`, `GSPOT_PACKAGE_RELEASE`, `getPublishedRelease`, and the `release` constants of the
  e2e tests. The preload `tests/setup/integration.ts` sets the run folder (the packed-package list sits inside it at a
  fixed name, `PACKED_PACKAGES_FILE` in `tests/config/integration.ts`) and the registry variables in `process.env`;
  tests read the version from `#cli-package`.
- Size: medium

### THR-017: Environment save and restore is written by hand four times next to the helper that does it

- Where: `tests/harness/environment.ts:48-56` (`useEnvironment`); `tests/harness/gspot.ts:53-71`; `tests/harness/npm.ts:111-122`;
  `tests/harness/python-installation.ts:162-170`; `scripts/plugin.ts:56-62`
- Kind: merge
- Problem: `useEnvironment` sets variables and restores them when the scope ends. Four places copy the same "remember,
  set, restore" steps with a `previous` map.
- Fix: Use `using _ = useEnvironment({...})` (or `resources.use(useEnvironment({...}))`) in `runGspot`, the npm client
  sandbox, and the Python sandbox. The runner's copy goes with the runner (SCR-003).
- Size: small

### THR-018: The same `.npmrc` line is written in four places

- Where: `scripts/plugin.ts:144-145`; `tests/harness/quickstart.ts:23-24`; `tests/harness/registry.ts:141-142`;
  `tests/packages/tools.test.ts:35`
- Kind: merge
- Problem: Each place writes `@gspothq:registry=<url>/` to its own `.npmrc` after starting a registry.
- Fix: `createNpmRegistry` (in `tests/setup/install.ts`) writes the `.npmrc` in its work folder and returns
  `{ url, npmrc }`. Delete the copies; `createInstallationRegistry` shrinks to the existence check.
- Size: small

### THR-019: Two test projects repeat the same starting files and ignore tables under the same name

- Where: `tests/config/harness/npm.ts:2-8`, `:21`; `tests/config/harness/python-installation.ts:5-11`, `:16-26`;
  `tests/harness/npm.ts:37-40`; `tests/harness/python-installation.ts:150-153`; `tests/config/harness/policy.ts`
- Kind: merge
- Problem: Two constants are both called `AUTHORED_FILES`, and both start with the same sandbox `mise.toml`
  (`disable_tools = ["npm:@gspothq/cli"]`, so that mise does not install the unpublished CLI). Two helpers build the
  same `[[ignore]]` TOML from a list of check names. `RUNNER_POLICY` is a two-entry map in its own file that only
  these two use. gspot never pins itself (INX-002), so that `mise.toml` has nothing to turn off.
- Fix: Give `settingsText` an `ignore: { checks, reason }` option and use it in both helpers. Drop the `mise.toml`
  entry from both file sets (no `MISE_WITHOUT_CLI` constant), and name them `NPM_SANDBOX_FILES`
  (`tests/config/npm.ts`) and `PYTHON_SANDBOX_FILES` (`tests/config/python/tool-project.ts`), with their check lists
  `NPM_SANDBOX_IGNORES` and `PYTHON_SANDBOX_IGNORES`. Delete `tests/config/harness/policy.ts` and `RUNNER_POLICY`:
  there is no runner setting (INX-003), so `settingsText` gets no runner option. Do after TGN-044.
- Size: small

### THR-020: Two helper files manage child processes, and tests copy the "start a live child" code

- Where: `tests/harness/command.ts`; `tests/harness/process.ts`; `tests/harness/gspot.ts:125-143`; hand-written copies
  in `tests/packages/launcher.test.ts:63-78`, `tests/cli/commands/check/refusals.test.ts:89`,
  `tests/cli/commands/apply.test.ts:176`, `tests/cli/platform/spawn/termination.test.ts:100`,
  `tests/tools/commands/cancellation.test.ts:166`
- Kind: merge
- Problem: `command.ts` bounds children by the time limit and `process.ts` waits for them and captures their output;
  the split has no reason. `startGspot` does "prepare the time limit, `Bun.spawn` with pipes and SIGKILL" for gspot
  only, so other tests repeat those 10 lines.
- Fix: One file, `tests/setup/processes.ts`, with `runCommand`, `runCommandBlocking`, `prepareCommand`,
  `startCommand(command, options)` (returns the captured child), `waitForExit`, `waitForFile`, `startTestTimeout`, and
  `timeLeft`. `interruptOwner` becomes `interruptOwnershipWrite` in its one test file,
  `tests/unit/cli/ownership/log.test.ts`. Delete `startGspot`; its users call `startCommand`. Replace the copies that
  remain after TEL-001, TPR-021, and THR-004 delete theirs. Keep the time-limit clamp for asynchronous children too:
  Bun's test timeout kills only the children it started itself, while the clamp hands a time limit to gspot's `run`,
  which kills the whole process tree.
- Size: medium

### THR-023: The fix-merging rule in `check-case.ts` handles cases that never happen

- Where: `tests/harness/check-case.ts:1`, `:45-50`; `tests/types/harness/check-case.ts:6-14`;
  `tests/config/cli/checks/general/structure/findings.ts:89`
- Kind: simplify
- Problem: The fix inherits the sample's settings and program list unless it sets them to `undefined` on purpose,
  tested with `'policy' in given`. Nobody sets the program list to `undefined`, and one case sets the settings to
  `undefined`. The header says "within the test budget", but the file has no time-limit code.
- Fix: Change that one case to an empty string. Merge with one rule: `{ check: entry.check, files: given.files, policy: given.policy ?? entry.policy, executable: entry.executable, removed: given.removed }`, and make the settings
  field of `SampleFix` (was `Correction`, in `tests/types/checks.ts`) a plain optional string. The file becomes
  `tests/setup/fixes.ts` with the header "Runs one check on a bad sample, then on its fix, and puts the files
  back."
- Size: small

### THR-024: Test repository helpers take callbacks that callers always pass in fixed pairs

- Where: `tests/harness/repository.ts:44-108`, `:199-207`; `tests/types/harness/repository.ts:4-43`
- Kind: simplify
- Problem: `createTestRepository(plan, run, prepare)` takes two callbacks. Every unit caller passes `runGspot` with
  `prepareCliRepository`; `shareRepository` passes `spawnGspot` with `prepareTestRepository`; one integration test
  passes its own function. `InProcessScenario` forbids `installs` and `modules`, fields no type has. No scenario sets
  `InstalledScenario.init`, so `prepareTestRepository` always builds the init arguments by hand instead of calling
  `buildInitArguments`.
- Fix: Two plain functions in `tests/setup/sandbox.ts`: `createSandbox(plan)` (no tools, gspot in the same process)
  and `shareInstalledSandbox(plan)` (installs tools once for a file; "with" is a banned name part).
  `prepareInstalledSandbox` uses `buildInitArguments`. Write the one custom case in its Cloudflare integration test.
  Delete the `never` fields and the unused `init` field. The types are `SandboxPlan`, `InstalledSandboxPlan`, and
  `Sandbox` in `tests/types/sandbox.ts`.
- Size: medium

### THR-025: The 15-minute limit sits in the runner, so a hung unit test waits 15 minutes and plain `bun test` has no limit

- Where: `tests/config/timeouts.ts`; `scripts/plugin.ts:9`, `:82-89`; `tests/harness/preload.ts`; `tests/harness/command.ts:5`, `:33-46`
- Kind: simplify
- Problem: The one limit is sized for the slowest integration test (an Astro case, about 14.5 minutes). The runner hands
  it to every suite as `--timeout`, so a stuck unit test also waits 15 minutes, while `bun test` run directly uses
  Bun's 5-second default and still clamps child processes to 15 minutes.
- Fix: Keep one limit, in one place: `TEST_TIMEOUT_MS` in `tests/config/processes.ts`, which the preload
  `tests/setup/preload.ts` hands to `setDefaultTimeout` beside the per-test time limit it already opens. Delete
  `tests/config/timeouts.ts`; the runner's `--timeout` goes with the runner. After the test-speed work (TTC-001),
  measure again and lower the one limit to the new slowest test.
- Size: small

### THR-026: The preload keeps a comment for code that was removed, and checks a version mise already pins

- Where: `tests/harness/preload.ts:5-9`
- Kind: delete
- Problem: Line 9 says "Tests start outside hook context; hook scenarios set their own context explicitly." The line it
  described was removed in `5586a3c91`, and the comment keeps `preload.ts` on the Vale semicolon ignore list. The exact
  Bun version guard (lines 5-7) repeats the pin in `mise.toml` and `package.json` `packageManager`.
- Fix: Delete line 9 and the version guard: mise pins Bun and is the one way to run the tests.
- Size: small

### THR-028: A helper computes expected values with the product's own rule

- Where: `tests/harness/policy.ts:36-44`; users `tests/cli/commands/init/templates.test.ts:53`, `:77`, `:81`,
  `tests/cli/planning/automatic-selection.test.ts:25`, `tests/cli/planning/selection.test.ts:54`,
  `tests/tools/lifecycle/installer-failures.test.ts:53`
- Kind: delete
- Problem: `alwaysSelectedConfigurations()` filters the manifests the same way the product does (`always_selected`,
  `general`, no `when`), and the tests use the result as the expected value. If the product rule and the helper
  change together, the tests still pass.
- Fix: Write the expected names once as a literal list, `ALWAYS_SELECTED` in `tests/config/configurations.ts`, compare
  sets row by row, and delete the helper.
- Size: small

### THR-031: Some "shared" samples have one user, some sit in the wrong file, and a helper imports one test's data

- Where: `tests/config/samples/commands.ts` (`REPORT_PROGRAM`, `INIT_ORIGINALS`, `INIT_FILES`, `PROJECT_TRIGGERS`, `PROJECT_OPTIONS`, `NESTED_POLICY`, `EXCEPTION_REASON`); `tests/config/samples/nested-scopes.ts`; `tests/config/samples/git.ts:11`; `css.ts:7` (`VALID_CSS`);
  `pre-push.ts:1` (`PUSH_CHECK_ARGV`); `python.ts:36`, `:54` (`PROJECT_INDEX`, `UV_LOCKFILE_MISMATCHES`); `react.ts:22`,
  `:40` (`NATIVE_TSCONFIG`, `CLEAN_COMPONENT`); `secrets.ts:2`, `:5`; `typescript.ts:6` (`TYPESCRIPT_PACKAGE`);
  `npm.ts:1`, `:19` (`NATIVE_MISE_POLICY`, and an import of `#tests/types/cli/npm.ts`); `tests/harness/input.ts:15`
  (imports `BASE_CHECK` from `tests/config/cli/execution/command/findings.ts`)
- Kind: move
- Problem: `samples/` is meant for data that two or more test files share, but 11 exports have one user.
  `NATIVE_MISE_POLICY` is a runner and ignore setting, not npm data. A sample file imports a test type. `BASE_CHECK` has four users (three tests and a helper) but lives in one test's private data file. `samples/commands.ts` holds a reporting script, scope samples, a reason, and init samples, none of them about "commands". `NESTED_POLICY` holds two sibling scopes, not nested ones, while `NESTED_SCOPES_POLICY` and `NESTED_POLICY_FILES` sit in two more files with near-identical names.
- Fix: Each value goes to its topic file: `REPORT_PROGRAM`, `BASE_CHECK` (beside `CHECK_FIELDS`), and `EMPTY_FAILURE`
  (as `FAILED_RUN`, a failed process result with empty output) to `tests/config/execution.ts`; `INIT_ORIGINALS` as
  `REPLACED_TOOL_FILES` beside `INIT_FILES` (which spreads it) in `tests/config/init.ts`; `PUSH_CHECK_ARGV` and `NESTED_POLICY_FILES` (as `NESTED_SCOPE_FILES`) to `tests/config/git.ts`; `PROJECT_TRIGGERS` and `PROJECT_OPTIONS` to `tests/config/planning.ts`; `NESTED_POLICY` as `TWO_SCOPES_SETTINGS` and `NESTED_SCOPES_POLICY` as `NESTED_SCOPES_SETTINGS` to `tests/config/settings/scopes.ts`; `EXCEPTION_REASON` as `SETTING_REASON` to `tests/config/set.ts`; `PROJECT_INDEX` as `PYPROJECT_UV_INDEX` and `UV_LOCKFILE_MISMATCHES` to
  `tests/config/python/tool-project.ts`; `NATIVE_TSCONFIG` as `REACT_NATIVE_TSCONFIG` and `CLEAN_COMPONENT` to
  `tests/config/react.ts`; `TYPESCRIPT_PACKAGE` to `tests/config/typescript.ts`. `VALID_CSS`, a single short literal,
  stays in its one test. `NATIVE_MISE_POLICY` loses its runner line (INX-003) and becomes `NPM_CHECK_IGNORES`, the two
  `[[ignore]]` records of the npm checks, in `tests/config/settings/file.ts`. The sample drops its type annotation, and `YarnOperations` goes. The Supabase copy of `NESTED_POLICY` goes with the deleted Supabase Docker test.
- Size: small

### THR-033: Sample names do not say what they hold

- Where: `tests/config/samples/bash.ts` (`HEAD`), `typescript.ts` (`VALID`), `swift/tests.ts` (`CLEAN`), `cloudflare.ts`
  (`PACKAGE`), `python.ts` (`PROJECT`, `MATH`, `CLEAN_MODULE`), `supabase.ts` (`GREET`), `ci.ts` (`PIPELINE`), `secrets.ts`
  (camelCase `testKeyId`, `secretSettings`, `testApiToken`), `xcode.ts` and `swift/xcode.ts`; file names `commands.ts`,
  `javascript.ts` (an ESLint override setting), `css.ts` (a Stylelint `package.json` and two CSS snippets), `actions.ts`
- Kind: rename
- Problem: A reader cannot tell what `HEAD`, `VALID`, or `PACKAGE` holds without opening the file. Two files named
  `xcode.ts` hold Xcode project text in two folders, and two Python modules (`CLEAN_MODULE`, `MATH`) both define
  `double`.
- Fix: `HEAD` → `BASH_HEADER` (`tests/config/bash/tools.ts`); `VALID` → `STRICT_TSCONFIG_TEXT`; `CLEAN` →
  `CLEAN_XCTEST`; `PACKAGE` → `WRANGLER_PACKAGE_JSON`; `PROJECT` → `PYTEST_PYPROJECT`; `MATH` and `CLEAN_MODULE` → one
  `ARITHMETIC_MODULE` with the full `Args`/`Returns` docstrings that pydoclint accepts at level `all`
  (`tests/config/python/checks.ts`); `GREET` → `HELLO_EDGE_FUNCTION`; `PIPELINE` → `LINUX_PIPELINE` (one CI job shape,
  INS-003); `testKeyId` → `AWS_KEY_ID`, `secretSettings` → `AWS_CREDENTIALS`, `testApiToken` → `API_TOKEN`; the two
  Xcode files → one `tests/config/xcode.ts` with `GROUPED_PBXPROJ`, `TEST_TARGET_PBXPROJ`, and
  `BUILD_SETTINGS_PBXPROJ`. Files: `commands.ts` splits by topic (THR-031); `javascript.ts` → `tests/config/eslint/overrides.ts`
  (`ESLINT_OVERRIDES_SETTINGS`); `css.ts` → `tests/config/stylelint.ts`; `actions.ts` → `tests/config/github-actions.ts`;
  `ci.ts` stays `tests/config/ci.ts`.
- Size: small

### THR-035: The shared test code is written in jargon

- Where: all of `tests/harness/`, `tests/types/harness/`, `tests/config/harness/`
- Kind: rewrite-text
- Problem: Comments and names use words a newcomer does not know: "native" (28 times in `tests/harness/`, 968 in
  `tests/`), "authored" (24), "owned" (18), "evidence" (5), "scenario" (21), "boundary" (8), "budget" (9), "consumer"
  (15). Examples: "Observe the sample and its fix, restoring each source edit before returning reports to the test"
  (`check-case.ts:33`); "Bun owns the loopback npm server used by installation tests and automation" (`registry.ts:1`);
  "Interrupt a native ownership publication at its observed root file operation" (`process.ts:53`). `generated.ts`
  puts its header after the imports, and six helper files have no header.
- Fix: Rewrite every header and doc comment in plain words, with the glossary's names: "tool" for "native tool"
  ("real tool" only when contrasting with a fake), "sandbox" for a test's temporary repository, "packed sandbox" for
  "consumer", "timeout" for "budget", "your own" for "authored", "plan" for "scenario". For example `registry.ts:1` →
  "A local npm registry that serves the packed packages."; `check-case.ts:33` → "Runs the check on the bad sample and on
  its fix, and puts the files back." Give every setup file a one-line header at the top.
- Size: medium

### THR-036: Rename `tests/harness/` to `tests/setup/` and its files to plain names

- Where: `tests/harness/**`; `bunfig.toml:9`; `gspot.toml:161`, `:164` and the ignore lists; `tests/**` imports
  (`#tests/harness/...`); `TESTING.md:49`, `:63` and `PLAYWRIGHT.md:22` ("test support folder")
- Kind: rename
- Problem: "Harness" is jargon, picked only because `support` is a banned folder name. The shipped rules call the same
  thing "test support folder", the check example tells users `tests/support`, and the setting is `test_harness`: three
  names for one concept.
- Fix: Rename the folder to `tests/setup/` with the file names in the "Shared test code" table. Update `bunfig.toml`
  (the preload path), the `gspot.toml` lists, and the imports. Say "test setup folder" in `TESTING.md` and
  `PLAYWRIGHT.md`. The `test_harness` role is deleted, not renamed (TML-001), so the product code and the manifest
  example of that role need no rename.
- Size: large

### THR-037: Each suite has three or four names, and none says what the suite does

- Where: folders `tests/cli`, `tests/plugin`, `tests/tools`, `tests/packages`; runner words `cli`, `plugin`, `test`,
  `package` (`scripts/plugin.ts:67-70`); tasks `test`, `test:tools`, `test:package`, `test:database` (`mise.toml`); CI
  jobs `test`, `tools`, `package`
- Kind: rename
- Problem: `tools` also names the CLI module `packages/cli/src/tools/` and its unit tests `tests/cli/tools/`. `cli` and
  `tools` both test the CLI; the real difference is "no tools installed" versus "the pinned tools installed".
  `packages` reads as the root `packages/` folder. `tests/cli/scripts/` tests repository scripts, and
  `tests/cli/docs.test.ts` tests the docs.
- Fix: The suites are `tests/unit/` (with `cli/` and `eslint-plugin/`), `tests/integration/`, and `tests/e2e/`, with
  the tasks `test`, `test:integration`, `test:e2e` and the CI jobs `unit`, `integration`, `e2e`; there is no runner
  argument. There is no `tests/scripts/` (the tests of `scripts/` go) and no `tests/database/` (the Supabase test that
  needs Docker is deleted, with its task and workflow; its other cases stay in
  `tests/integration/platform/supabase.test.ts`). `tests/cli/docs.test.ts`, which keeps two copies of the quickstart
  example equal, is deleted.
- Size: large

### THR-038: Task descriptions and test error messages use jargon

- Where: `mise.toml:42`, `:46`, `:50`, `:73`; `tests/harness/consumer.ts:110`; `tests/harness/install.ts:68`;
  `tests/harness/python-installation.ts:103`; `tests/harness/registry.ts:75`
- Kind: rewrite-text
- Problem: "Run deterministic CLI and plugin tests.", "Run native compatibility tests with the selected tools
  installed.", "Build and pack the CLI with the plugin, then test installed consumers.", "Run installed acceptance
  through mise run test:package." No contributor document explains the suites, so these lines are the only
  explanation.
- Fix: Task descriptions: `test` "Run the unit tests."; `test:integration` "Run gspot with the pinned tools installed,
  on sample repositories."; `test:e2e` "Install both packed npm packages in a new project and test them there." The
  setup error texts say "Run this test with mise run test:integration." or "... mise run test:e2e."
- Size: small

### THR-039: CI test jobs check out Git history the tests do not use

- Where: `.github/workflows/ci.yml:73-74`, `:85-89`, `:161-169`
- Kind: simplify
- Problem: The `test` and `tools` jobs check out the full Git history (`fetch-depth: 0`), but no test runs Git in the
  real checkout; tests run Git only in temporary repositories.
- Fix: Drop `fetch-depth: 0` from the test jobs. Every job runs the same `mise run setup` (RTX-002), and the setup
  action has no inputs and always installs Bun and Node (RTX-004).
- Size: small

### THR-041: One-line wrappers and single-use types in the shared code

- Where: `tests/harness/pins.ts:67-74` (`inspectionContext`); `tests/types/harness/syntax.ts` (`OwnedSyntaxTree`);
  `tests/config/harness/gspot.ts` (`SOURCE_CLI_PATH`) with `tests/harness/gspot.ts:17`, `:25-27` and `scripts/plugin.ts:159`;
  `tests/harness/expectations.ts:25-47`; `tests/harness/preservation.ts:157-162`
- Kind: simplify
- Problem: `inspectionContext(root)` returns `{ root, inspections: new Map() }` for three tests in one folder.
  `OwnedSyntaxTree` is a one-line type file for one function. The source CLI path is written in a data file, again as
  the prefix of `getCliSourcePath`, and again in the runner, and `getCliSourcePath(path)` only returns
  `join(<root>, 'packages/cli/src', path)`.
- Fix: Write `{ root, inspections: new Map() }` in the three tests and delete `inspectionContext`. Write
  `OwnedSyntaxTree` in the signature of `parseTestSource`, which moves into its one test file. Keep one
  `CLI_SOURCE = join(repositoryRoot, 'packages/cli/src')` in `tests/setup/run-gspot.ts`, build `CLI_MAIN` from it,
  delete `getCliSourcePath` (its four callers write `join(CLI_SOURCE, '...')`), and delete
  `tests/config/harness/gspot.ts`. Four helpers that look like wrappers stay: `containing`, `containingAll`, and
  `textContaining` exist for the cast (bun-types returns `AsymmetricMatcher`, so inlining would put a type assertion
  at each of 130 call sites), and `pathExists` turns a rejected `access` into `false` for its 85 users.
- Size: small

### THR-043: `runtimeEvidenceCases()` is test data hidden in the repository helper

- Where: `tests/harness/repository.ts:133-192`; `tests/types/harness/repository.ts:45-57`
- Kind: rename
- Problem: A list of runtime detection rows sits in the file that creates test repositories, and "evidence" is jargon.
  Two test files use it.
- Fix: The rows are built from the CLI's `JAVASCRIPT_RUNTIMES`, which `tests/config/` may not import, so they stay a
  function: `runtimeDetectionRows()` in `tests/setup/sandbox.ts`. Delete `RuntimeEvidenceCase` and let TypeScript
  infer the row type.
- Size: small

### THR-044: The installed-plugin test installs the plugin at the CLI's version number

- Where: `tests/packages/plugin.test.ts:56`; `scripts/plugin.ts:154`; `scripts/release.ts:13-19`
- Kind: fix-bug
- Problem: The test runs `npm install @gspothq/eslint-plugin@<version>` with the version of the CLI package. The local
  registry serves the plugin only at its own version. Both packages are 0.1.0 today, so it works by luck. The release
  check does not require the two versions to match, so the first release that bumps only one of them breaks this test
  with "no matching version".
- Fix: Install `@gspothq/eslint-plugin@${pluginPackage.version}` (import `#eslint-plugin-package`) in
  `tests/e2e/eslint-plugin.test.ts`.
- Size: small

### ST4-006: Filler types and one-use types in the shared test code

- Where: `tests/types/harness/npm.ts:6` (`PackageBytes`), `tests/types/harness/python-installation.ts`,
  `tests/types/harness/policy.ts:7` (`ReportingCheck`), `tests/types/harness/repository.ts:46-57`
  (`RuntimeEvidenceCase`), and 21 types that each annotate one parameter or one return of one function
- Kind: delete
- Problem: `PackageBytes` spells `Buffer` as `Exclude<Awaited<ReturnType<typeof readFile>>, string>` (and twice more in
  the Python types). `ReportingCheck` renames the CLI's command-check type. `RuntimeEvidenceCase` only types the
  return of a function. The 21 one-use types would each need a `tests/types/` file, though the signature alone can hold
  them.
- Fix: Delete the three; write `Buffer`, the CLI's `CommandCheck`, and the inferred row type. Write each one-use type
  in the signature that uses it. Only types that two or more modules use go to `tests/types/`: `checks.ts`,
  `processes.ts`, `sandbox.ts`, `npm.ts`, and `e2e.ts`.
- Size: small

### ST4-010: Names that are too short for a shared topic file, and one clash

- Where: `tests/config/cli/planning/{replacements,requirements}.ts`, `tests/config/cli/platform/git.ts`,
  `tests/config/cli/tools/{npm/install,python,vale}.ts`, `tests/config/plugin/rules/{boundaries,no-client-env}.ts`,
  `tests/config/samples/{python,quickstart}.ts`, `tests/types/harness/command.ts:14`
- Kind: rename
- Problem: In a topic file shared by many tests, `REPLACEMENTS`, `PYTHON_PROJECT`, `GIT_HOOK_EXPECTED`, `CONSTRAINT`,
  `PACKAGE_FAILURES`, `EXAMPLE`, `ALIASES`, `PROJECT_INDEX`, and `SETUP_COMMANDS` do not say what they hold;
  `PYTHON_PROJECT` would read as the Python tool project. The Vale sample `CONFIG` would clash with another Vale
  sample in `tests/config/prose.ts`. `GspotChildOptions` types `runGspot`, which runs in this process.
- Fix: `TSC_REPLACEMENTS`, `PYTHON_APP_FILES`, `GIT_HOOK_REPORT`, `PYJWT_CONSTRAINT`, `PYJWT_CONSTRAINT_ARGUMENT`,
  `INSTALL_FAILURES`, `CLIENT_ENV_SAMPLE`, `IMPORT_ALIASES`, `PYPROJECT_UV_INDEX`, `QUICKSTART_COMMANDS`,
  `VALE_PACKAGES_INI`, and `StdinOptions`.
- Size: small

### ST4-011: Test data that reads the running Bun or another package when its file is imported

- Where: `tests/config/samples/site.ts:27` (`STATIC_SITE_FILES`); `tests/config/samples/typescript.ts:15`
  (`TYPESCRIPT_PACKAGE`); `tests/config/samples/react.ts:2`, `:8`, `:13`, `:17-18`
- Kind: simplify
- Problem: Two `package.json` samples write `"packageManager": "bun@${Bun.version}"`, so the data changes with the Bun
  that runs the tests. The React samples read versions from `#tests/package.json`. A `tests/config/` file may import
  only `tests/config/`.
- Fix: Write the pin as text, `bun@1.4.2`, in `STATIC_SITE_FILES` (`tests/config/site.ts`) and `TYPESCRIPT_PACKAGE`
  (`tests/config/typescript.ts`). The React samples (`tests/config/react.ts`) hold package names and fixed versions
  only (`WEB_PACKAGES` is `['react', 'react-dom']`); the test that uses them adds the `react` and `react-dom`
  versions from `#tests/package.json`.
- Size: small

### DT3-001: Five integration test tables still say "inline rows" although their data sits in tests/config

- Where: `tests/tools/execution/fixers.test.ts:60`; `tests/tools/generation/ci.test.ts:50`;
  `tests/tools/generation/hooks.test.ts:16`; `tests/tools/lifecycle/installer-failures.test.ts:19`;
  `tests/tools/lifecycle/python-project.test.ts:42`
- Kind: move
- Problem: The tables these tests use move to `tests/config/`, but the tests were still planned with their rows
  inline, so the data would sit in two places.
- Fix: Each test imports its table: `PARTIAL_FIX_CASES` (`tests/config/check.ts`), `SETUP_CASES`
  (`tests/config/ci.ts`), `RUNNER_CASES` (`tests/config/hooks.ts`), `MISE_FAILURES` (was `INSTALLATION_FAILURES`,
  `tests/config/tools.ts`), and `PYTHON_PROJECTS` (`tests/config/python/tool-project.ts`).
- Size: small

### DT3-002: The CI full-tree test tests a deleted key, and the pre-push full-tree test becomes the test of its fix

- Where: `tests/tools/commands/ci.test.ts:174-200`; `tests/tools/commands/pre-push.test.ts:225-257`
- Kind: delete
- Problem: The CI test exists to set `ci.files = all` (and to see a bad value refused), a key TML-002 deletes. The
  pre-push test sets `hooks.push_files = all`, also deleted, but its pushed commit changes `gspot.toml` together with
  `changed.sh`, which is exactly the case TML-002's fix widens to every file.
- Fix: Delete the CI test with its `['gitlab', 'github']` table; its "your own CI file stays" assertion is the kept unit
  test of init and CI files. The pre-push test drops its `set` step, keeps its assertion that `legacy.sh` is reported,
  and becomes "a push that changes gspot.toml checks every file, also files the push did not touch" in
  `tests/unit/cli/commands/check/push.test.ts`.
- Size: small

### DT3-003: The declaration test tests three deleted keys only

- Where: `tests/tools/configurations/language/bash/syntax.test.ts:126-154`;
  `tests/config/tools/configurations/language/bash/syntax.ts:31-49`
- Kind: delete
- Problem: Both cases of `DECLARATION_CASES` set `generated`, `vendored` (CFR-005 deletes them), or the root `exclude`
  (TMF-003 deletes it), then take them out with `set --remove`. Nothing of the test survives.
- Fix: Delete the test and `DECLARATION_CASES`; the rest of the data goes to `tests/config/bash/tools.ts`. Whether
  "a file marked `linguist-generated` in `.gitattributes` is left out of `bash/bash-syntax` and checked again after
  the line is removed" needs a test is for the "Untested logic" rule after the code is cut.
- Size: small

### DT3-004: The Vale package helper still installs through `installTree`

- Where: `tests/tools/configurations/general/prose/packages.test.ts:18-33` (`installPackages`)
- Kind: simplify
- Problem: The helper calls the internal `installValePackages` with a hand-built owner whose `installTree` writes the
  folder. `installTree` goes, and every integration sandbox runs the real `gspot install` (TTO-003).
- Fix: The helper runs `gspot install` in the sandbox (`spawnGspot`).
- Size: small

### DT3-005: The quickstart e2e test starts with a one-off init the docs no longer show

- Where: `tests/tools/commands/python-quickstart.test.ts:28`; `tests/tools/commands/swift-quickstart.test.ts:43`;
  `tests/config/samples/quickstart.ts` (`SETUP_COMMANDS`)
- Kind: delete
- Problem: The test runs `mise exec npm:@gspothq/cli@<version> -- gspot init`, then `mise trust .mise/conf.d/gspot-tools.toml` and `mise install`. The one-off init leaves no pin, the user pins gspot with
  `mise use node@24 npm:@gspothq/cli@<version>`, and `gspot install` runs mise itself for `.gspot/mise.toml`. An e2e
  test that replays a path the docs do not show checks the wrong thing.
- Fix: The two tutorials merge into `tests/e2e/quickstart.test.ts`, which runs `mise use node@24 npm:@gspothq/cli@<version>`, commits `mise.toml`, runs `mise exec -- gspot init`, then `QUICKSTART_COMMANDS`
  (`tests/config/e2e.ts`) without the two mise lines and without a `gspot doctor` line: init, install, check.
- Size: small

### DT3-006: One jsconfig case tests a glob key that goes

- Where: `tests/config/tools/configurations/language/javascript/jsconfig.ts:110-132`
- Kind: simplify
- Problem: The case "an unused extensionless file class retains native Node suffix requirements" writes
  `[tools.eslint.import_extensions] "unused/**" = "extensionless"`, a glob key that matches nothing.
  `tools.eslint.import_extension` becomes one value per scope (TML-008), so no glob key exists. What the case proves
  (the default `js` keeps the TS2835 suffix rule) is real, and no other case asserts TS2835.
- Fix: The case drops its settings and checks the default (in `JSCONFIG_CASES`, `tests/config/javascript.ts`).
- Size: small

### DT3-007: Setup code still carries the deleted runner, init, and install options

- Where: `tests/harness/npm.ts:86-90` (`createPackageProject` `runner` parameter); `preparePythonInstallation`
  (`runner` option); `tests/harness/init.ts` and `tests/config/harness/init.ts` (`QUIET_INIT`, the `hooks`, `ci`,
  `runner`, `agentRules`, `install` options); the `refreshLockfiles` option passed to `installTools` and
  `prepareToolProjects`; `installCommand({ isDryRun })`
- Kind: delete
- Problem: The tests that call these options lose them with the runner setting (INX-003), the init questions
  (CLX-001), the install step of init, the `--refresh-lockfiles` flag, and `install --dry-run` (CLX-004), but the
  setup code still defines them.
- Fix: Delete the options: `createNpmClientSandbox` (was `createPackageProject`) and `createPythonSandbox` (was
  `preparePythonInstallation`) take no runner; delete `QUIET_INIT`; `buildInitArguments` keeps `init`, `--yes`,
  `--configurations`, and `--json`, and hands `--from` a template that turns hooks, CI, and rules off where a test
  needs that; `buildInitOptions` keeps `cwd`, `yes`, `isDryRun`, and the template; delete `refreshLockfiles` and
  `installCommand`'s `isDryRun`. `settingsText` keeps one option, `rules?: boolean` (the rules tests need rules on).
  The runner column of `NPM_CLIENT_ROWS` is TTO-032; the first two rows of `QUICKSTART_COMMANDS` are DT3-005.
- Size: small

### TTC-039: `describe` blocks wrap one test or group tests at random

- Where: `tests/tools/configurations/`: `general/duplication.test.ts:20`, `general/secrets/environment.test.ts:9`,
  `general/markdown-docs-prose.test.ts:12`, `infra/nginx.test.ts:72`, `infra/github-actions.test.ts:22`,
  `language/python/checks.test.ts:61`, `test/pytest.test.ts:17`, `language/swift/scopes.test.ts:15`,
  `general/codeql.test.ts:22`, and the blocks that only repeat the file name in `framework/nestjs.test.ts`,
  `framework/nextjs.test.ts`, `general/site.test.ts`, and `typescript/checks.test.ts`; `tests/cli/checks/general/`:
  `dependencies/manifest-policy.test.ts:15`, `dependencies/policy.test.ts:13`, `docs/readme-shape.test.ts:13` (4 of 8
  tests of one check), `site/build.test.ts:44` (2 of 6 reproducibility tests), `naming/words.test.ts:4` (holds a
  `repeatedPart` test under the name `splitParts`), `duplication.test.ts:112`; `tests/cli/checks/`:
  `language/html.test.ts:10` (one block around the whole file), `tool/nginx.test.ts:17` (1 of 4 tests),
  `database/postgres/migration-docs.test.ts:20` (2 of 4), `framework/svelte.test.ts:55` (3 of 4); `tests/cli/`:
  `lifecycle/ownership/conflicts/links.test.ts:9`, `lifecycle/ownership/conflicts/plans.test.ts:178` (both named "lifecycle ownership", like the restoration block of TPP-028), `execution/ignores.test.ts:4`,
  `execution/command/batches.test.ts:5`, `execution/command/failures.test.ts:25`, `terminal.test.ts:9` (3 of its 10
  tests in "the reporter"), `execution/scopes.test.ts:13`, `repository/kinds.test.ts:17-54`,
  `platform/assets.test.ts:32`
- Kind: delete
- Problem: A `describe` that wraps one test, or some tests of a file and not others, adds a level of indentation and a
  second title and groups nothing; a file per source file already groups its tests. Five of the integration blocks
  copy scenario names from `cases.ts`, which the CI name patterns also match.
- Fix: Remove these wrappers and dedent; each title then names its check once. Keep `describe` only where it scopes a
  shared sandbox inside a file (the commit hooks sandbox of `general/commits/messages.test.ts`). The shared sandbox of
  `execution/scopes.test.ts:13` moves into its test. A gate on a removed `describe` moves to the test as
  `test.skipIf(...)`. `migration-docs.test.ts` goes whole with its check (CKO-041).
- Size: small

### TTC-037: `export` on test constants that only their own file uses

- Where: `tests/tools/configurations/config/`: `.../database.ts` (`FOLDER`, `TEAMS`), `framework/nestjs.ts`
  (`GREETER`, `NESTJS_MODULE`), `framework/svelte.ts` (`COUNT`, `PRODUCT`, `CARD`), `framework/vue.ts` (`VUE_CLEAN`),
  `general/secrets/environment.ts` (`ENV_SOURCE`), `general/site.ts` (`ORPHAN_SITE_FILES`), `infra/docker.ts`
  (`DOCKER_CLEAN`, `CARELESS`, `IGNORES`), `infra/openapi.ts` (`OPENAPI_POLICY`), `language/sql.ts` (`PSQL`),
  `language/swift/package.ts` (`SWIFT_PACKAGE`, `LIBRARY`, `PAIR`), `platform/supabase/checks.ts`
  (`SUPABASE_CONFIG`), `language/typescript/source.ts` (`CHECK_SCRIPT` and the five samples only
  `typescript/checks.ts` uses); `tests/config/cli/checks/general/dependencies/policy.ts:5,26,28,31` (`ONE_HOUR_S`,
  `CLEAN`, `FOREIGN_PNPM`, `FOREIGN_YARN`), `tests/config/cli/checks/general/structure/trivial-functions.ts:1,4`
  (`SWITCHED`, `NEGATED`); `tests/config/cli/checks/framework/nextjs.ts:5,8` (`ROUTE`, `MANIFEST`),
  `tests/config/cli/checks/library/trpc.ts:38` (`TRPC_COMMENT`), `tests/config/cli/checks/library/translations.ts:6`
  (`NEXT_TRANSLATIONS`), `tests/config/cli/checks/language/python/structure.ts:18,21` (`LONG_FILE`, `LONG_BODY`),
  `tests/config/cli/checks/library/drizzle.ts:21` (`TABLES`); `tests/config/cli/configurations/errors.ts:1`
  (`WAITING_SETTING`), `tests/config/cli/commands/set/typed-tables.ts:1` (`REASON`);
  `tests/config/cli/parsers/git.ts:11` (`ENTRY_FAILURE`), `:31` (`BLOB_FAILURE`),
  `tests/config/cli/parsers/tree-sitter.ts:6` (`PYTHON_SOURCES`), `:14` (`SWIFT_SOURCES`),
  `tests/config/cli/policy/read/recovery.ts:1` (`GOOD_IGNORE`)
- Kind: simplify
- Problem: Each of these has no user outside its own data file; most only serve other constants in the same file.
  Knip does not report them, because the generated Knip settings make every file under `tests/**` an entry and set
  `ignoreExportsUsedInFile`. `CLEAN` also writes `"packageManager": "bun@${Bun.version}"`, so a test constant depends
  on the running Bun.
- Fix: When the values move to their topic files, inline each one-use value into the sandbox, row, or cases that use
  it (for example `GREETER` into `NESTJS_SANDBOX`, `CARELESS` into `DOCKER_CASES`, the six general values into their
  rows in `tests/config/dependencies.ts` and `tests/config/structure.ts`, `REASON` into its table). Keep a value as its
  own unexported constant only where two items of the topic file use it (`MIGRATIONS_FOLDER`, `ENV_SOURCE`,
  `CHECK_SCRIPT`); `ENTRY_FAILURE` and `BLOB_FAILURE` move to `tests/config/git.ts` without `export`. `CLEAN` writes
  the repository's pinned Bun version as plain text. Values whose tests go leave with them: `TABLES` (TCO-003),
  `PYTHON_SOURCES`, `SWIFT_SOURCES`, and `GOOD_IGNORE` (TPP-041, PAR-001, POL-065).
- Size: small

### TCO-037: Spies are undone in three ways

- Where: `try { ... } finally { run.mockRestore(); }` 27 times in `tests/cli/checks/`
  (`language/swift/build/{analyzer,compiler,isolation}.test.ts`, `tool/xcode/resources.test.ts`,
  `tool/swift-tests/execution.test.ts`, `platform/supabase/types.test.ts`, `library/drizzle.test.ts`,
  `framework/expo.test.ts`, `framework/nextjs.test.ts`), in `tests/cli/checks/general/site/build.test.ts:163-184` and
  `site/output.test.ts:33-49`, and 14 times in `tests/cli/execution/` and `tests/cli/lifecycle/` (for example
  `fixers/outcomes.test.ts:147-159`, `tool-runner/arguments.test.ts:187-194`, `copy/dependencies.test.ts:206-240`,
  `apply/publication.test.ts:61-70`); `new DisposableStack()` in `duplication.test.ts:41-55`,
  `licenses.test.ts:82-98`, `prose.test.ts:49-60`; `using spy = spyOn(...)` elsewhere
- Kind: simplify
- Problem: Bun spies are disposable, and most files already write `using spy = spyOn(...)`, sometimes in the same file
  as a `try`/`finally` block. Three patterns for one job; each `try`/`finally` adds 3 to 6 lines and a level of
  nesting for the same effect.
- Fix: Use `using name = spyOn(...)` for every spy; delete the `try`/`finally` blocks and the manual `mockRestore()`
  calls. Keep `DisposableStack` only where one test holds several resources that must close together.
- Size: small

### TPR-024: Tests write the same thing in several ways

- Where: all test files of `tests/cli/planning/`, `platform/`, `repository/`, `tools/`, and `commands/`
- Kind: simplify
- Problem: "This fails" is written as `await rejection(p)` (34 times), `await rejects(p, ...)` from `node:assert` (4), `throws(...)` from `node:assert` (4), `p.catch((error: unknown) => error)` then `toMatchObject` (9), and `expect(p).rejects` (1). In the command tests, TOML is also parsed with `smol-toml` `parse` (13 imports), `Bun.TOML.parse` (2), and `parseStrictPolicy` (24); files are written with `Bun.write` (24) and `writeFile` (42); the temporary folder is called `sandbox` (177), `directory` (54), and `repository` (2); and parameter loops use `test.each` and also `for (...) test(...)`.
- Fix: One rule: synchronous code `expect(() => f()).toThrow(message)`; asynchronous code with a message only
  `expect(await rejection(p)).toBe(message)`; asynchronous code with an error code
  `await expect(p).rejects.toMatchObject({ code, message })`. Drop the `node:assert` imports. `smol-toml` `parse` for raw TOML, and the settings reader only when the test needs the settings object; `writeFile` and `readFile` from `node:fs/promises`; `sandbox` for the folder; `test.each` for every table.
- Size: small

### TGN-044: Tests write `gspot.toml` in four ways, through a helper named like a source function

- Where: `tests/harness/policy.ts:14-18` (`buildPolicy`); `buildPolicy(...)` 139 times in `tests/cli/generation/` and
  152 times in `tests/cli/checks/`, and 59 calls with `{ agentRules: true }` in the parser and settings tests; raw
  strings that repeat `[agent_rules]\nenabled = false` (19 in `tests/cli/generation/`; `framework/expo.test.ts:15,68`,
  `tests/config/cli/checks/tool/docker.ts:66-94`, `tests/config/cli/checks/framework/svelte.ts:5,11`,
  `tests/config/cli/checks/tool/swift-tests/execution.ts:1-7`); `smol-toml` `stringify` (15 in
  `tests/cli/generation/`; `library/translations.test.ts:18`, `tool/jest-execution.test.ts:85,110`); constants from
  data files (8); `emitPolicy` (1)
- Kind: simplify
- Problem: Raw strings must repeat by hand what the shared function adds itself, such as the `[agent_rules]` table.
  `buildPolicy` in the tests returns TOML text, while `buildPolicy` in `packages/cli/src/policy/normalize.ts:158`
  turns a parsed table into an object: same name, different meaning. `agentRules: true` means "do not add the line
  that turns rules off", which is backwards and does not matter to a parse-only test:
  `buildPolicy(['bash'], { agentRules: true, tables: X })` is just `configurations = ["bash"]\n` plus X.
- Fix: Rename the helper to `settingsText` in `tests/setup/settings.ts`. It writes `[rules] enabled = false` unless its
  one option, `rules: true`, is set (the rules tests need rules on). Test files write their settings with
  `settingsText`, not raw strings; `stringify` stays only where a test needs odd keys or values, and the parse-only
  tests of the settings reader use a template string (`` `configurations = ["bash"]\n${X}` ``). A `tests/config/`
  value cannot call a function, so it writes its gspot.toml as text (for example `SVELTE_PROJECTS`,
  `DOCKERIGNORE_CASES`, `NESTED_PYTHON_POLICY`, `APP_JEST`, `MOBILE_SETTINGS`, `ENTRY_SETTINGS`).
- Size: medium

### TPP-028: Test bodies are written as named constants and registered far below

- Where: `tests/cli/policy/edit.test.ts:47-80` (`changesKey`, `deduplicatesEntries`); `tests/cli/policy/file.test.ts:46-64`
  (`refusesBytes`); `tests/cli/policy/key-paths.test.ts:18-36` (`syntaxErrors`, `externalScope`);
  `tests/cli/repository/revisions/changes.test.ts:10-134`; `tests/cli/repository/tracked/discovery.test.ts:17-120`;
  `tests/cli/tools/inspect/installations.test.ts:19-182`; `tests/cli/commands/explain/selection.test.ts:14-183`;
  `tests/cli/commands/init/templates.test.ts:18-117`; `tests/cli/lifecycle/ownership/preservation/restoration.test.ts:15-142`
- Kind: simplify
- Problem: Each test body is a top-level `const name = async () => {...}`, and a `describe` block up to 100 lines
  further down calls `test('...', name)` or `test.skipIf(...)(..., name)`, so the reader jumps to match a title with
  its body. Each function is used once. They exist because the file wraps its tests in a `describe` block, which adds a
  callback level, and `max-nested-callbacks` is 3. One commit, `c84681573`, wrote most of these under a size exception.
- Fix: Write each body inside its `test('title', async () => {...})` and delete the single-purpose `describe`
  wrappers. Do the same for the other one-`describe` files of the parser and settings tests (`naming.test.ts`,
  `read/boundaries.test.ts`, the `describe` blocks in `output/json.test.ts`, `read/settings.test.ts`,
  `settings/known.test.ts`, `declared-checks.test.ts`). The restoration tests become normal `test(...)` calls in
  `tests/unit/cli/ownership/plans/restore.test.ts`.
- Size: small

### TTC-029: Tests run a check in many different ways, often through internals or with the check name typed twice

- Where: the integration tests (`tests/tools/configurations/`): `spawnGspot` (47 files, 307 uses), `runGspot` (5),
  `checkReport` (2), `runCheckCase` (4), `runFindingCase` (3), `executeRun` (9 files, 32 uses), `runBuiltInCheck`
  (4 files, 19 uses), `runCheckCommand` (2), `BUILT_IN_CALCULATIONS[...]` called directly (11 files, 40 uses),
  `checkRun` (1); internals such as `cachedBuild` (`general/site.test.ts:64`), `buildPlan`
  (`language/swift/build.test.ts:29`), `compilerCopyInputs`, `compilerFiles` and `getTsconfigProject`
  (`typescript/copy.test.ts:38-50`), `inspectTool` (`javascript/compiler-ownership.test.ts:39-45`), `getTsconfig`
  (`typescript/standalone.test.ts:46-56`). The unit tests of the checks (`tests/cli/checks/`):
  `BUILT_IN_CALCULATIONS[id](buildCheckInput(await openSession(root), id, ...))` 141 times (for example
  `language/css.test.ts` 15 times), direct imports such as `versionPairs`, `cloneFindings`, `linkinator`,
  `suppressionComments`, `executeRun(session, buildRunOptions(...))` 42 times, `checkReport`/`runGspot` 85 + 12 times,
  and `runCheckCase` with `createTestRepository`
- Kind: simplify
- Problem: For the same kind of test the files pick different layers, so a reader must learn up to ten ways in. A test
  that calls an internal function breaks when that function is renamed, even if gspot still works, and many simple
  rule tests pay for a full CLI run with JSON output (every test in `naming/vocabulary.test.ts` runs the CLI two or
  three times to check one name rule). In the unit tests the check name is typed twice in each call (once as the table
  key, once for `buildCheckInput`), so a test can pass while it calls the wrong check, which is how the wrong-key calls
  of TCG-020 slipped in; importing each check function directly would not remove the second name, because
  `buildCheckInput` still needs it. `copy.test.ts` also guards its own setup with
  `throw new Error('No root TypeScript reference check was planned.')`, and several internal assertions repeat what
  the check result shows anyway: the report already names `.gspot/node_modules/.bin/tsc` as the command, and the
  per-scope results show which files each scope compiles.
- Fix: One rule. Unit tests of a check call `checkFindings(root, check, options)`, one function in
  `tests/setup/check-input.ts` that opens the session, builds the input, and calls `CHECK_FUNCTIONS` (today
  `BUILT_IN_CALCULATIONS`) with the same name; this deletes roughly 300 lines. Each check keeps one end-to-end test
  through `checkReport` that also checks the fixed state, and `executeRun` is called only where the test is about
  running (timeouts, scratch copies, cleanup). Integration tests run checks through the CLI
  (`spawnGspot(root, ['check', '--only', id, '--json'])`). Delete the internal assertions in `copy.test.ts:33-54` with
  the guard, `compiler-ownership.test.ts:39-45`, and `standalone.test.ts:46-56`; keep the check runs.
- Size: large

### TTC-032: Test titles and test code use jargon instead of saying what is checked

- Where: all of `tests/`: at least 235 titles contain "native", 361 contain "preserve(s)" or "retain(s)", 134 contain
  "authored". Per area: the general check tests ("native" 68, "contract" 31, "authored" 30, "owner/ownership" 28,
  "preserve/retain" 36, "neighboring/adjacent" 13); the other check tests ("native" 32, "retains" 26, "preserves" 21,
  "boundary" 14; `framework/expo.test.ts:11` "Expo Doctor preserves scoped orchestration for $name",
  `tool/docker.test.ts:179` "$name reports only its native ignore contract"); the execution, install, and ownership
  tests (about 75 titles; "native" 52 in 19 files, "preview" 61, "correction(s)" 28, "publication/publish" 26,
  "workspace" for a copy 21, "snapshot" 2, "adapter" 3; `restoration.test.ts:209`, `conflicts/links.test.ts:11`,
  `progress.test.ts:11`, `check-input.test.ts:41`); the generation tests (241 places in titles, comments, variable
  names, and constants; "contract" 40, "owner" 53, "retain" 33, "preserve" 26, "authored" 64, 19 variables named
  `native`; titles that say nothing, such as `level-contract.test.ts:14`, `eslint/vite-entries.test.ts:28`,
  `eslint/levels.test.ts:62`, `trivy.test.ts:10`); the parser and settings tests ("native" 124, "authored" 104,
  "retain" 54, "preserve" 28, "surface" 16, "boundary" 8, "owner/owned" 34; `NATIVE_EDIT_POLICY`); the planning,
  system, repository, and tools tests (`generated.test.ts:50` "a native fixer refresh", `push.test.ts:28` "native
  shallow ranges", `root.test.ts:81`); the integration tests (`'native $name validates $lockfileName without changing repository inputs'`, "native" 49 times in 18 files of the other integration tests, such as
  `parsers/output/markdownlint-typos.test.ts:42,104`, `plist.test.ts:13-14`, `npm/environment.test.ts:8`)
- Kind: rewrite-text
- Problem: A title is the first thing a reader sees when a test fails, and these read as noise or cannot be understood
  without reading the code ('native policy metadata example %j parses in every published surface'). "native" alone
  means "real", "installed", "the tool's own", "built in", "Git's own", "this operating system", "a TOML date", and
  "declared in the code". The glossary uses "fix" and "fixer" (not correction), "dry run" (not preview), "scratch
  copy" (not snapshot or workspace), and "write" (not publish).
- Fix: A title names the check or tool, the input, and the expected result in plain words ("<input> gives <result>"),
  for example "`__init__.ts` is reported; Python `__init__.py` and `__main__.py` are allowed", "Expo Doctor runs once
  in each app folder", "a shallow clone reports incomplete history and skips commits it cannot see", "a link that
  points outside the repository is refused, even when it is unchanged", "level all reports TODO comments",
  "`'dependencies/stale-lockfile reports a stale lockfile'`", "a TOML syntax error names the file, line and column".
  Titles and test code do not use "native" (unless it means React Native; say "the tool", "the real markdownlint
  output", "the installed Taplo", "the tool's own option"), "contract" (say the real rule), "authored" ("your own", or
  nothing), "preserve" or "retain" ("keeps", and only when keeping is the point), "owner", "surface", "boundary",
  "neighboring", or "adjacent"; "correction" becomes "fix", "preview" "dry run", "publish" "write", and "workspace" or
  "snapshot" for a copy "scratch copy". Rename `native` variables to `findings`, `config`, or `parsed`, and the
  `routine`/`strict` fields in the Node script data to `recommended`/`all`. The placement rows give each new title.
- Size: large

### TGN-037: Tests run at both levels where the result is the same, and the level list has many copies and names

- Where: the generation tests (`tests/cli/generation/`): `eslint/tanstack-query.test.ts`, `eslint/html-injection.test.ts`,
  `eslint/engines.test.ts`, `eslint/javascript.test.ts`, `eslint/jsdoc-types.test.ts:47`, `eslint/fragments.test.ts:12`,
  `eslint/policy.test.ts:69`, `eslint/testing-library.test.ts`, `knip.test.ts:29,103,211,256`, `semgrep.test.ts:69,104`,
  `vale.test.ts:10,199`, `stylelint.test.ts:16`, `config-consumers.test.ts:94,150`, `swift.test.ts:58`,
  `formatting.test.ts:241`, `typescript.test.ts:50`, `serialization/documents.test.ts:117`, `squawk.test.ts:45`,
  `trivy.test.ts:22`, `html.test.ts:76`. The general check tests (`tests/cli/checks/general/`):
  `dependencies/lockfile-fresh.test.ts:100`, `dependencies/manifest-policy.test.ts:33,84`,
  `docs/stale-paths.test.ts:178`, `generated-code.test.ts:15,31,63,87` (via `GENERATED_SCOPES`),
  `naming/contracts.test.ts:46,247,292`, `naming/vocabulary.test.ts:213`, `secrets/env/files.test.ts:103`,
  `site/source.test.ts:173`, `structure/env-owner.test.ts:42,73`, `structure/findings.test.ts:48`,
  `structure/large-files.test.ts:36`, `structure/prefix-collisions.test.ts:173`, `structure/suppressions.test.ts:122,194`,
  `structure/test-placement.test.ts:125`. The other check tests (`tests/cli/checks/`):
  `database/postgres/access.test.ts:17,61` (`ACCESS_SCOPES`), `language/python/installation.test.ts:216`,
  `language/typescript/contracts.test.ts:183,225`, `language/typescript/projects.test.ts:27,75`,
  `platform/cloudflare/configuration.test.ts:34,64,102`, `platform/supabase/configuration.test.ts:124`,
  `tool/docker.test.ts:158,178,249`, `tool/jest-execution.test.ts:69-75`, `tool/openapi-fresh.test.ts:123`
  (`SPECTRAL_SCOPES`), `library/trpc.test.ts:16` (`TRPC_LEVELS`), and `DOCUMENTATION_LEVELS`. The command tests:
  `tests/cli/commands/doctor.test.ts:194`, `:243`, `reconciliation.test.ts:185`, `init/templates.test.ts:119`,
  `explain/command.test.ts:118`, `explain/selection.test.ts:267`, `check/copies.test.ts:100`,
  `check/policy-errors.test.ts:63`, `configurations/tools.test.ts:81`, `agent-rules/assemble.test.ts:52`, `:184`. The
  planning and repository tests: `tests/cli/planning/dependencies.test.ts:11`, `lockfiles.test.ts:10`,
  `requirements.test.ts:24`, `selection.test.ts:131-148`, `:207`, `tests/cli/repository/package-manifests.test.ts:147`.
  The settings tests: `tests/cli/policy/settings/view.test.ts:155-247`. The execution tests:
  `tests/cli/execution/scopes.test.ts:125-142`. The integration tests (`tests/tools/configurations/`): 44 level loops,
  5 of them `['recommended', 'all', 'recommended']` (`general/commits/hooks.test.ts:86`, `general/files.test.ts:24`,
  `general/lychee.test.ts:74`, `general/yaml.test.ts:42`, `language/markdown.test.ts:19`), loops inside test bodies
  (`general/files.test.ts:24,150`, `general/lychee.test.ts:74`, `prose/rules.test.ts:59`, `prose/vale.test.ts:14`,
  `general/yaml.test.ts:43`, `test/vitest.test.ts:39`), the `$level` loops of `test/jest.test.ts:125` and
  `language/python/checks.test.ts:106`, and two purgecss rows in `OUTPUT_CASES` (`config/.../general/site.ts:91-104`)
  that expect the same finding. The level list itself: `['recommended', 'all'] as const` 155 times in 96 test files,
  `levelSchema.options` 12 times, `packages/cli/src/parsers/schema/contracts.ts:169` (`levelSchema`)
- Kind: simplify
- Problem: Each of these runs the same scenario at `recommended` and `all` and expects the same result at both, and
  each run builds a full sandbox (for the ESLint tests the whole configuration, for the integration tests a real tool
  run). A check runs at level `recommended` or only at `all`: for a `recommended` check the `all` run gives the same
  result, and for an `all` check the `recommended` run only shows "nothing ran", which the planning tests already
  cover. Many checks never read the level at all (grants, row security, deptry, Docker ignores, storage policies, the
  Cloudflare checks, `commandEnvironment`): 88 runs where 36 do the same work in the other check tests alone.
  Switching levels and back is gspot logic that the unit suite covers. The Jest and pydoclint titles never fill in
  their `$level` or `$0` value, so both runs share one name. The CLI has one list, `LEVELS = ['recommended', 'all']`
  in `packages/cli/src/config/configurations.ts`, but the tests keep 155 copies under six names, so a third level
  would need 96 edits; `DOCUMENTATION_LEVELS` is wrong (these are levels, not documentation).
- Fix: Remove these level loops and the `level === 'recommended' ? … : …` branches, and run each test once. Unit tests
  run at the lowest level that selects the check under test (the default level when the code never reads the level);
  generation tests run at `all`, which holds every rule of `recommended`; integration tests run at `all` (the Vale
  package rules at the root only, the Vitest test in the `app` scope only, one purgecss row with the reviewed
  safelist). Keep a level loop only where the result changes with the level: the level switch inside
  `language/typescript/contracts.test.ts:117`, the Ruff, Stylelint, Hadolint, ansible-lint, and markdownlint
  integration tests, and for Next.js one `recommended` case with one route and the four `all` routes. Test "switching
  back restores the defaults" once in the unit suite. Delete `GENERATED_SCOPES` (write the two scopes `['', 'apps/api']`
  in the test), `ACCESS_SCOPES` (the scope column becomes a plain `['', 'app']`), `TRPC_LEVELS`,
  `DOCUMENTATION_LEVELS`, and the `describe.each` wrappers in `docker.test.ts`; the Jest coverage table and the
  Spectral test go whole (TCO-008, TCO-002). The command-path test of a scope becomes "a command in a scope runs in
  the scope folder with paths relative to it" in `tests/unit/cli/execution/command/check.test.ts`; the settings
  view loops go after the moves of TPP-020. Every level table that stays is `test.each(LEVELS)`, with `LEVELS`
  imported from `packages/cli/src/config/configurations.ts` (test files may import the CLI's config). One copy stays:
  the program text in `tests/config/e2e.ts` (`MODULE_PROGRAM`), which the e2e test runs against the packed plugin,
  because `tests/config/` may not import the CLI.
- Size: large

### TCO-012: Tests assert that a read-only call did not change files

- Where: the other check tests (`tests/cli/checks/`, about 25 assertions): `language/swift/suppressions.test.ts:22,31`;
  `tool/xcode/scopes.test.ts:46-48,80`; `platform/supabase/configuration.test.ts:120,151-153,164,178`;
  `platform/supabase/settings.test.ts:52-54,63-64,99-102`; `language/python/installation.test.ts:110,166,213`;
  `library/swift-snapshot-testing.test.ts:85-88,151`; `database/postgres/access.test.ts:25-32,53-57`;
  `library/trpc.test.ts:70-71`; `tool/xcode/resources.test.ts:44-47,83-85`;
  `platform/cloudflare/configuration.test.ts:172-174`; `language/swift/build/plan.test.ts:27`;
  `language/bash/function-size.test.ts:147`. The execution tests: `tests/cli/execution/command/findings.test.ts:41`,
  `:85`; `tool-runner/exit-contracts.test.ts:50`; `scopes.test.ts:80-82`, `:120-121`; `check-input.test.ts:29`. The
  command tests: `tests/cli/commands/list.test.ts` (10 `readTree` calls, a `.gspot` check, and a gspot.toml read in
  test 1), `doctor.test.ts:262`, `:274-275`, `explain/selection.test.ts`, `program.test.ts:66`, `:75` (138 `readTree`
  calls and 16 `control.txt` checks in these tests). The generation tests (`tests/cli/generation/`):
  `swift.test.ts:20-21,52-53`; `typescript.test.ts:47`; `bunfig.test.ts:74`; `commitlint.test.ts:83`;
  `npm.test.ts:61-62,85`; `shared-settings.test.ts:221,230-231`; `eslint/policy.test.ts:65,126,189-190`;
  `eslint/jsdoc-types.test.ts:101`; `eslint/react-rules.test.ts:106,112-113`; `eslint/overlaps.test.ts:138-142`;
  `eslint/tanstack-query.test.ts:46`; `eslint/architecture.test.ts:81,121,175`; `eslint/node-scripts.test.ts:70-71,151`
- Kind: delete
- Problem: These checks, commands, and steps only read: the read-only checks, `checkedFindings` and
  `runCheckCommand`, `list`, `doctor`, `explain` and `--help`, `emitAll` ("writes nothing"), `openSession`, and ESLint
  `lintFiles` without a fix. Asserting afterwards that file bytes, modes, `gspot.toml`, a whole folder snapshot, or an
  unrelated `control.txt` or `entry.sh` are unchanged cannot fail unless the code starts writing, which is not what
  these tests are about. It also makes titles longer ("... and preserves source bytes"). In
  `xcode/resources.test.ts:44-47` and `:83-85` the trailing lines even test the file helper and `writeFile`, not the
  check.
- Fix: Delete these assertions, the before/after snapshots, the `control.txt`/`entry.sh` checks, the `marker` file in
  `npm.test.ts`, and the "preserves ..." words from the titles. Keep "unchanged" assertions only where the code under
  test writes or runs a tool in a scratch copy: fixers, apply, dry-run and refusal tests, the Next.js, stale-generated-
  file, Swift build isolation, actionlint, and nginx checks, and the generation tests that follow real writes
  (`commitlint.test.ts:43`, `stylelint.test.ts:33-35`, `managed-ignores.test.ts:50`, `eslint/takeover.test.ts:88,164`).
  Do the `npm.test.ts` lines together with TGN-038: until then the manifest row runs `gspot apply` before line 85.
- Size: small

### TPP-029: Test data writes whole files and programs as one-line escaped strings

- Where: `tests/config/cli/policy/file.ts:4-172` (25 cases, 26 lines over 180 characters),
  `tests/config/cli/parsers/nextjs.ts:4`, `:22`, `tests/config/cli/parsers/lockfiles.ts:17`; in the general check
  data, 13 lines over 200 characters, for example `tests/config/cli/checks/general/naming/policy.ts:2` (576
  characters of TOML), `site/source.ts:32` (321), `structure/findings.ts:70` (317), `site/output.ts:17` (312),
  `structure/trivial-functions.ts:2` (300), `secrets/env/readers.ts:65` (248), `licenses.test.ts:156` (282); in the
  other check data, 27 lines over 200 characters, for example `tests/config/cli/checks/language/bash/structure.ts:21-150`,
  `tests/config/cli/checks/framework/svelte.ts:17-18`, `tests/config/cli/checks/language/python/structure.ts:5-6`,
  `tests/config/samples/python.ts:3,71,74`; in the generation data, `tests/config/cli/generation/eslint/functions.ts:3`
  (1,960 characters on one line), `eslint/eslint-deprecation.ts:6` (679), `eslint/overlaps.ts` (234 lines, every source
  listed twice for `.js` and `.ts`), `eslint/node-scripts.ts` (198 lines), `eslint/architecture.ts` (129 lines)
- Kind: simplify
- Problem: Each TOML document, Bash, Python, or SQL program, or source file is one long line with `\n` inside, so
  nobody can read the input or the expected output, and the expected line numbers are hard to check. In 8 of the 25
  settings-file cases `target` is a character-for-character copy of `source`, and the ESLint `.js`/`.ts` maps are
  copies.
- Fix: Write each document and program as a multi-line template literal with real line breaks when it moves to
  `tests/config/`, as the nginx and pydoclint data already do. In the settings-file cases, make `target` optional and
  use `source` when it is missing, name the cases with short sentences (for example 'default values are left out'),
  and split them into `DEFAULT_CASES`, `COMMENT_CASES`, and `LAYOUT_CASES` in `tests/config/settings/file.ts`. Build
  the ESLint `.js`/`.ts` pairs with `Object.fromEntries(... .flatMap(...))`; `functions.ts` goes (TGN-008) and the
  overlap data shrinks (TGN-028).
- Size: small

### ST5-015: Test data in `tests/config/` imports types and code, but may import only `tests/config/`

- Where: the rows listed in "Import rule for tests" in `architecture.md`; 29 data files under `tests/config/tools/` that
  import `InstalledScenario` and `FindingCase` from `tests/types/harness/`; the check data files
  `tests/config/cli/checks/general/dependencies/policy.ts:1-3` (`FindingCase`, `CaseChanges`, `InProcessScenario`),
  `framework/nextjs.ts:1-2`, `general/site/output.ts:2-3`, `general/structure/findings.ts:2-3`,
  `language/bash/structure.ts:1-2`, `language/python/structure.ts:2-3`, `library/drizzle.ts:1`,
  `library/swift-snapshot-testing.ts:2-3`, `library/translations.ts:2-3`, `platform/cloudflare/configuration.ts:1,3`,
  `platform/supabase/settings.ts:2-3`, `framework/expo.ts:3` (`DoctorResult`), `general/site/source.ts:1`
  (`SvgSavingCase`), `general/generated-code.ts:1` (the CLI's `Level`); the row types `SiteOutputCase`,
  `JsconfigCase`, `HtmlAccessibilityCheck`, `BashBoundary`, `ConfigurationScenario`; sandboxes that take dependency
  versions from `package.json` files (`cases.test.ts:126-136`, `framework/nextjs.test.ts:128-147`);
  `tests/config/tools/lifecycle/installer-failures.ts:1` (imports `CLI_PINS` from the CLI)
- Kind: simplify
- Problem: A `tests/config/` file may import only `tests/config/`. Today 98 values annotate themselves with a type from
  `tests/types/` (mostly `FindingCase`, `InProcessScenario`, `InstalledScenario`, `CaseChanges`) or from the CLI, four
  data files import their own row types, two read `#tests/package.json`, two import the CLI's `CLI_PINS`, several
  sandboxes read versions from JSON imports, and a few values are computed by calling code (`buildPolicy`, the CLI's
  `JAVASCRIPT_RUNTIMES`).
- Fix: Write each value in `tests/config/` `as const`, with no annotation and no type import; the test or the setup
  function that reads it (`runCheckSample`, `createSandbox`, `shareInstalledSandbox`, which take readonly parameters)
  checks the shape where the value is used, and `test.each` infers row types, so the five row types go. An `as const`
  table of object rows is passed to `test.each` as `[...TABLE]`. Values that need code stay in their test or in
  `tests/setup/`. gspot.toml text in `tests/config/` is written as text, never built with `settingsText`. Sandboxes in
  `tests/config/` carry no versions: the Next.js, NestJS, Svelte, Vue and Vitest tests add them from their JSON imports
  (`installedSandbox`), so `NEXT_PACKAGE` and `VITEST_PACKAGE` stay config items, and the other package versions are
  read where they are used. The fake `mise` version line and the mise failure table write a literal version and import
  nothing. `DoctorResult` and `SvgSavingCase` are deleted (TCO-029, TCG-035); `general/generated-code.ts` goes
  (TGN-037).
- Size: medium
