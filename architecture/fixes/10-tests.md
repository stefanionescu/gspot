# Tests

The audit found a large suite whose passing result did not establish a working installation.
Historical failures below remain evidence; current cleanup status lives in
[22-remaining.md](../22-remaining.md#cleanup-acceptance-backlog). The acceptance contract is
[12-repository-layout.md](../12-repository-layout.md#tests).

Tests exercise real current behavior, not wrappers, deleted logic, source tokens, or filename
inventories. Delete obsolete assertions and move surviving behavioral regressions to their
new owner. Assert intended findings and corrected behavior. A test must not preserve a known
bug or weaken a rule to make the test pass.

Reference acceptance requires successful init, expected checks actually executed, reviewed
findings, and preserved worktrees. Worktree setup and cleanup failures are failures.
Release acceptance combines publication and installation into one fresh consumer journey.
Exercise embedded assets and plugin execution.

Checkout dependency symlinks and source entry
points cannot establish packaged acceptance. Metadata and version responses alone are insufficient.
Keep product restoration, serialization, malformed-input, and process tests. Registry setup
and cleanup support the installed-consumer journey; they do not need their own test suite.
Do not add tests of test directories, test helpers, repository layout, or test inventories.
Tests of gspot layout rules must demonstrate findings on user input and corrected-input success.

Temporary test directories use `testdirs` directly. Register disposal before calling
`createFileTree` so partial setup is cleaned. No private testing package or forwarding API
is required. Do not maintain a separate suite that tests this dependency.
Evaluate the [infrastructure reuse candidates](../15-prior-art.md#infrastructure-reuse-candidates)
before adding custom support. If a candidate fails a required case, record the failure and retain
only the unsupported behavior. Do not create a test framework or an internal filesystem API.

## T-27: the harness lets a failed `init` pass

Closes T-27, T-4, T-8, T-21, and T-9.

**Partially implemented, September 20, 2026.** The harness rejects failed init
runs even when a policy exists, missing required mise tools, and failed Git setup.
An unmatched policy edit fails before any test repository mutation. Sandbox PATH includes
the checkout's installed npm executables, so required formatters actually run.

Sandbox restoration preserves binary bytes and file modes after execution errors
and partial setup. Native filesystem operations replace unchecked shell commands,
and cleanup removes directories created by planting.

The harness, typed-table, Docker, shell, and document acceptance suites pass locally.
The restoration run passes 10 tests with 119 assertions, and TypeScript passes.
Realistic isolated installs, shared test repository construction, and the caller audit
remain open. Windows filesystem execution remains deferred.

**What is wrong.** `install` in `tests/harness/planted.ts:137` reads only whether `gspot.toml`
exists, so an `init` that crashes after it wrote the config passes. Seven tests run `init` through
`run`, which checks nothing. `toolsPath` (line 89) leaves out a tool mise cannot find and says
nothing, so the test fails later with a message about a check. Four integrity tests cast a
partial object to the full `EngineInput`. The init command line, a `package.json` literal, and
the tool lists are repeated across the test files.

**Target.** A harness that fails early, with a message about the machine or about `init`.

**Files.** `tests/harness/planted.ts` and the suites that exercise setup failures (D-113).

**Logic.** `install` expects exit 0 when every tool of the install is on the `PATH` it was given.
`toolsPath` throws and names the tool it cannot find and the command that installs it. `plant`
fails when the pattern it replaces is absent. `engineInput(overrides)` builds a whole input from a
planted folder, and the four tests use it.

**What goes.** The casts, the seven bare `run` calls, and the repeated literals.

**Tests.** Product acceptance checks the actual init exit and resulting policy. Do not add
a unit test of the harness or mock its assertions.

**Done when.** Failed initialization and missing tools fail setup, and restoration preserves
the original files after partial setup or execution failure.

## T-24: the tests install the way no developer does

Closes T-24, T-1, T-2, and T-32.

**What is wrong.** Of 60 installs, 59 pass `--runner none` and one passes `bun`. `mise`, `npm`,
`pnpm`, and `uv` are never installed. 50 pass `--without` for most presets, so the default
selection is never run. No test installs the pinned npm tools into an empty folder.

**Target.** Each value of `--runner`, of the hooks choice, and of the CI choice is installed
once. One install starts from a repository that has hooks and mise tasks. One default `init` runs
in every test run.

**Files.** The owning CLI installation acceptance and `tests/release/install.test.ts`.

**Logic.** Exercise six installs in the owning suite: mise with GitHub CI, npm, pnpm,
bun, no runner with GitLab CI, and the default with no flag. Each holds the files written, a
passing `gspot check --staged`, and a commit through the hook. The release test installs
`.gspot/package.json` of every npm preset with each package manager and runs one check there.

**What goes.** `--without` in a test of one preset. The preset under test is selected with
`--presets`, and the default selection is tested once.

**Tests.** These are the tests.

**Done when.** The six installs pass on Linux and macOS.

## T-3: planted cases the adoption findings need

Closes T-3, T-6, T-7, and T-13.

**What is wrong.** No planted repository holds two scopes of different languages, a nested scope,
or a scope outside a workspace. None holds snake_case or PascalCase siblings for the prefix rule.
None holds a `setup.cfg`, a `hooks/` folder of source files, `.mise/tasks/`, or hooks that must
keep running. None holds a hook that calls a task, a setup task that sets the hooks path, a fresh
clone, a `[tool.ruff]` table, or a `lint` script.

**Target.** Each finding of [20-adoption.md](../20-adoption.md) has one planted case.

**Files.** `tests/acceptance/cli/takeover.test.ts`, `hooks.test.ts`, `scope-languages.test.ts` (as
`scope-presets.test.ts`), `structure.test.ts`.

**Logic.** Each fix section of files 01 to 06 names its planted case. The cases are written with their fix and counted here.

**What goes.** Nothing.

**Tests.** Thirteen cases, one for each item above.

**Done when.** Each adoption defect has an executed regression whose finding or resulting
files prove the correction. Record that evidence in the owning fix section.

## T-28: checks that no test makes fail

Closes T-28, T-17, T-14, T-30, and G-2.

**What is wrong.** The guard test `every shipped check has a test` passes when the name of a check
stands in quotes anywhere in any test file, a `--skip` list included. Thirteen checks appear only
in a stage listing or run only on a clean repository, among them `docker/compose-config`, which
fails on every file (K-258). The library presets are proven by the rule names `no-restricted-imports`
and `no-restricted-syntax`, which every selector prints. Several test folders are empty.

**Status: partially implemented.** The source-text name guard is deleted. It did not prove
that a check ran or found a defect. Executed coverage of the remaining checks remains open.
Deletion-only command and schema tests, duplicate process cases, and configuration
inventory assertions are also removed. Real input, process, and storage failure cases remain.

The disabled-Boolean-rule test is removed: its unrelated `no-var` finding did not
establish the naming contract. Swift build regressions sit with CLI integration tests,
process regressions are named `spawn`. Standalone harness tests are removed.
Emission tests are grouped by selection, serialization, and alias discovery. Swift
error assertions use the existing assertion library instead of repeated catch blocks.

**Target.** Every shipped check has one planted defect that makes it fail, with the message of
its own rule.

**Files.** The acceptance suite that owns each preset or command behavior.

**Logic.** Execute each planted defect and assert the failing check, its rule or diagnostic,
and the affected location. A check that needs the network or Docker runs in the `manual` job
of CI. No source-text guard or separate test inventory establishes this behavior.

**What goes.** The empty test folders, and the loops that read no exit code.

**Tests.** The planted cases for the checks described above.

**Done when.** The checks report their planted defects through the public command.

## T-29: expectations that any output holds

Closes T-29, T-26, T-5, and T-18.

**What is wrong.** Twenty cases expect a text that the planted path or the name already holds:
`The` for the typos check, and the folder names `turn` and `helpers` for two structure checks.
Two expectations look for the check name, which every run prints.

**Target.** A case expects the rule name or the sentence of its finding, and the exit code.

**Files.** `config-files.test.ts`, `documents.test.ts`, `structure.test.ts`, `spelling` cases,
and the others the two rows list.

**Logic.** Assert the structured report's check, failing status, affected file, and rule or
diagnostic. Include line and column where the tool supplies them.

**What goes.** Twenty weak expectations.

**Tests.** The owning command acceptance suites.

**Done when.** The cases identify their planted defects through structured findings.

**Partially implemented, September 20, 2026.** TypeScript, structure, documents, and
configuration cases now assert structured findings instead of isolated words or filenames
in command output. Other language and framework suites still need review. The real v8r
Unicode-path regression also exposed a version probe that read malformed authored config
before the check selected its generated config. Check, correction, side-command, and
cache-version probes now receive the resolved check environment. Executable failures still
fail the probe.

## T-23: folders and analyses with no unit test

Closes T-23, T-10, T-15, and T-16.

**What is wrong.** Unit tests exist for 14 folders of the CLI. None exists for `doctor/`,
`lifecycle/`, the profile reader, the language folders, or any of the 56 analyses of the
structure, bash, python, and swift presets. Eighteen unit test files hold one input each.
`require-server-only` and `tests-directory-contents` have thin cases.

**Target.** Retained analyses have meaningful invalid and valid cases at their real boundary.
Pure text logic needs no tool or repository; filesystem and process behavior use their actual
boundaries. Do not invent a universal input abstraction solely to make every test look alike.

**Files.** CLI behavior tests belong under `packages/cli/tests/`. Group cases by behavior;
no mirrored source tree or new root unit-test hierarchy is required.

**Logic.** Test actual consumed inputs, relevant limit boundaries, and valid inputs that must
not match. Share established setup behavior without forcing every analysis through a test adapter.

**What goes.** Nothing.

**Tests.** Exercise each retained analysis with a demonstrated defect and valid code
that must pass. Group related cases by behavior; source filenames do not define test cases.

**Done when.** The cases detect their intended defects and accept the valid inputs.
A source-file inventory or matching test filename does not establish coverage.

## T-19: no test reads the shipped policy over ordinary code

Closes T-19 and T-33.

**What is wrong.** Each naming test builds a policy of its own, so `presets/concern/naming/policy.json`
first met a React component in a real repository (K-136). The clean project of each test is
written in the house style. No test installs into a project the way `create-vite`,
`create-next-app`, `nest new`, `uv init`, or Xcode writes it, so what a stranger gets on day one
is unmeasured.

**Target.** The shipped defaults are measured on ordinary code.

**Files.** Extend root command acceptance and package-owned naming tests. Keep actual generated
project inputs beside the consuming acceptance cases with their generator versions recorded.
Create test directories only for exercised projects, not every possible generator.

**Logic.** For each generated project and representative established multi-package project, run `init --yes` and `check`. Review each recommended finding for a demonstrated defect and false positives before accepting any message or count snapshot (K-301). Include valid API wrappers, framework adapters, and identifiers containing `generate` or `service`. A count alone is not an acceptance criterion. The naming test runs the shipped policy over one short file for each
language and framework, and expects no finding.

**What goes.** Nothing.

**Tests.** These are the tests.

**Done when.** Each recommended finding has a reviewed defect rationale, with no unexplained house-style finding; banned-term cases fail only at `all`.

## K-28: the ESLint template has 411 lines and its test has 21

**What is wrong.** The largest template of gspot is tested by one render that looks for a few
strings.

**Target.** The test resolves the final config for one file of each file class and compares the
rule lists.

**Files.** `packages/cli/tests/unit/emit/eslint-template.test.ts`.

**Logic.** The test renders the template for a fixed selection, loads it through ESLint, and
calls `calculateConfigForFile` for a source file, a test file, a script, a config file, and a
component. It holds each rule list as a snapshot.

**What goes.** The string search.

**Tests.** This is the test. It is also what K-209 compares.

**Done when.** It passes at both levels.

## T-36: no test holds a generated file byte for byte

**What is wrong.** `packages/cli/tests/snapshots/` is empty, git tracks nothing in it, and no
test calls a snapshot matcher. A change to a template changes the config of every repository, and
no test shows the difference to a reviewer.

**Target.** Test rendered behavior and retain snapshots only where exact serialization is a
meaningful contract. Every preset need not have a snapshot directory or every target a copy.

**Implementation.** Run pinned consumers against generated configuration and assert the intended
finding, valid input, and corrected behavior at each relevant level. Test escaping and output
preservation directly. A snapshot cannot replace these assertions. Remove redundant tracked
copies and text-presence tests once behavioral coverage owns their contract.

**Done when.** A broken template or policy is caught through its consumer or a meaningful
serialization assertion, rather than merely appearing as a changed snapshot line.

## T-12: no test measures time

**What is wrong.** Nothing fails when `init` or a staged check gets slower.

**Target.** Two ceilings, held in CI: a staged check of ten files in a planted repository of
5,000 files, and `init --yes` on the same repository.

**Files.** New `tests/release/timing.test.ts`, the timing suite's local limits.

**Logic.** The test writes the 5,000 files from a generator, and runs warm and cold. The staged
check has 5 seconds warm and 30 cold, and `init` has 60.
[04-speed.md](04-speed.md) holds the ceiling of a single check (K-196).

**What goes.** Nothing.

**Tests.** This is the test.

**Done when.** It passes on the three CI systems.

## T-22: tests that read a list written by hand

Closes T-22 and T-25.

**What is wrong.** The completion test expects a length over 100 and the word `gspot`, and its
list of commands is written by hand. Two release tests expect the text `0.1.0`.

**Status: open.** The completion test that checked script length and copied a command
list is deleted. Command and option completion behavior still needs executable coverage.

**Target.** A test reads what it checks from its one source.

**Files.** `packages/cli/tests/unit/output/completion.test.ts`, `tests/release/binary.test.ts`,
`install.test.ts`.

**Logic.** The completion test walks the commander program, and looks for each command and flag
in the bash and the zsh script. The release tests read `version` of
`packages/cli/package.json`.

**What goes.** Two hand-written values.

**Tests.** These are the tests.

**Done when.** They pass after a version bump with no edit.

## T-31: test files named after folders that are gone

**Partly retired.** T-11 and filename-only renames are retired: a suite can cover multiple
presets without matching a preset directory name. T-34 remains actionable where the Xcode
fixture is not a valid project. Exercise a valid Xcode project through the pinned consumer;
keep setup data beside the suite. Directory naming is not acceptance evidence.

## T-20: tests that change with their subject

Closes T-20 and T-35.

**What is wrong.** Four tests expect a defect as the right answer. They are `main.ts` as a
trivial file (K-186) and `Retry-After` as a case finding (K-192). They are also one Vale run for
each file (K-176) and `no-var` vanishing at takeover (K-193). Twenty-one files use a removed flag, a baseline file for each
rule, `tools.licenses.exceptions`, `route_glob`, or `produced_by`.

**Target.** Each changes in the commit that changes its subject, and that commit names the test.

**Files.** The test of each named row.

**Logic.** None of its own.

**What goes.** The wrong expectations.

**Tests.** The same files.

**Done when.** A search of the tests for the removed flags of
[00-delete-first.md](00-delete-first.md) finds nothing.

## K-310: the registry harness can accept an unrelated server

**What is wrong.** `tests/harness/registry.ts` derives a port from the PID modulo 1,000.
`waitFor()` accepts any successful ping at that address without checking whether the spawned
Verdaccio process owns it. Startup failure leaves the process and temporary directory behind.
Both streams are discarded; `stop()` kills without awaiting exit before deleting storage.
A fetch has no request deadline, so the polling count does not bound a stalled response.

**Target.** Package tests publish and install only against their own isolated local registry.
Startup, request and shutdown deadlines are bounded. Failed startup releases owned resources
and preserves useful process output without exposing credentials.

**Files.** `tests/harness/registry/` and installed-consumer release acceptance.

**Logic.** Use a supported isolated listen address/port allocation, observe child startup and
exit, and verify readiness belongs to the child before returning a registry. An occupied port
must not allow publication into the existing service. Always await owned-child termination and
clean temporary storage, including failure before a registry object is returned. Keep retries
limited to documented startup readiness; never retry failed publication into another registry.

**Tests.** Publish and install built packages through the isolated consumer journey.
Fail that journey on unsuccessful startup, publication, installation, or cleanup.
Do not recreate a standalone registry-harness suite.

**Done when.** Readiness identifies the owned server and all setup/teardown paths release it.

**Locally verified, September 20, 2026; platform verification deferred.** The registry harness
under `tests/harness/registry/` uses a dedicated child interprocess communication channel to learn
its bound loopback port. Readiness requests have a deadline. Child output is captured, termination is awaited,
and partial setup removes owned storage. Publication rejects an exited child.

Historical evidence from the subsequently removed harness suite: eight local regressions covered
an occupied healthy responder, separate registries, missing executable,
early exit, startup timeout, stalled readiness, and writes failing before and after launch.
They assert released storage and terminated children. Bun signal termination is identified
through `signalCode` as well as `exitCode`. Supported Windows and Linux execution is deferred
while CI remains bypassed; this requirement stays open until that evidence exists.
