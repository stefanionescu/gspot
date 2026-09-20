# Tests

Row 14 of the build order. The suite is large and proves less than its size says. A failed
`init` passes, and 59 of 60 installs use a runner no developer uses. A check counts as tested
when its name stands in a skip list, and many cases expect a word that any output holds. Every defect
of the first fix file lived where no test looked. This step makes the suite install as a
developer installs, fail every check once, and expect the sentence of each finding.

Two kinds of test change elsewhere. A test that expects a defect changes in the commit that
fixes it (T-20). A test that uses a removed flag changes with the flag (T-35).

## T-27: the harness lets a failed `init` pass

Closes T-27, T-4, T-8, T-21, and T-9.

**Partially implemented, September 20, 2026.** The harness rejects failed init
runs even when a policy exists, missing required mise tools, and failed Git setup.
An unmatched policy edit fails before any fixture mutation. Fixture PATH includes
the checkout's installed npm executables, so required formatters actually run.

Fixture restoration preserves binary bytes and file modes after execution errors
and partial setup. Native filesystem operations replace unchecked shell commands,
and cleanup removes directories created by planting.

The harness, typed-table, Docker, shell, and document acceptance suites pass locally.
The restoration run passes 10 tests with 119 assertions, and TypeScript passes.
Realistic isolated installs, shared fixture construction, and the caller audit
remain open. Windows filesystem execution remains deferred.

**What is wrong.** `install` in `tests/harness/planted.ts:137` reads only whether `gspot.toml`
exists, so an `init` that crashes after it wrote the config passes. Seven tests run `init` through
`run`, which checks nothing. `toolsPath` (line 89) leaves out a tool mise cannot find and says
nothing, so the test fails later with a message about a check. Four integrity tests cast a
partial object to the full `EngineInput`. The init command line, a `package.json` literal, and
the tool lists are repeated across the test files.

**Target.** A harness that fails early, with a message about the machine or about `init`.

**Files.** `tests/harness/planted.ts`, new `tests/harness/engine-input.ts`, new `tests/config/`
with `commands.ts`, `fixtures.ts`, `tools.ts`, and `timeouts.ts` (D-113).

**Logic.** `install` expects exit 0 when every tool of the install is on the `PATH` it was given.
`toolsPath` throws and names the tool it cannot find and the command that installs it. `plant`
fails when the pattern it replaces is absent. `engineInput(overrides)` builds a whole input from a
planted folder, and the four tests use it.

**What goes.** The casts, the seven bare `run` calls, and the repeated literals.

**Tests.** A unit test of the harness: a crashing `init` fails `install`.

**Done when.** It passes, and no test file holds the text `init --yes` outside `tests/config/`.

## T-24: the tests install the way no developer does

Closes T-24, T-1, T-2, and T-32.

**What is wrong.** Of 60 installs, 59 pass `--runner none` and one passes `bun`. `mise`, `npm`,
`pnpm`, and `uv` are never installed. 50 pass `--without` for most presets, so the default
selection is never run. No test installs the pinned npm tools into an empty folder.

**Target.** Each value of `--runner`, of the hooks choice, and of the CI choice is installed
once. One install starts from a repository that has hooks and mise tasks. One default `init` runs
in every test run.

**Files.** New `tests/repositories/installs.test.ts`. `tests/release/pins.test.ts` gains the
install of K-206.

**Logic.** A table of six installs in `tests/config/commands.ts`: mise with GitHub CI, npm, pnpm,
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

**Done when.** A table in `tests/config/fixtures.ts` maps each adoption finding to its case, and
a unit test fails an `A-` id with no case.

## T-28: checks that no test makes fail

Closes T-28, T-17, T-14, T-30, and G-2.

**What is wrong.** The guard test `every shipped check has a test` passes when the name of a check
stands in quotes anywhere in any test file, a `--skip` list included. Thirteen checks appear only
in a stage listing or run only on a clean repository, among them `docker/compose-config`, which
fails on every file (K-258). The library presets are proven by the rule names `no-restricted-imports`
and `no-restricted-syntax`, which every selector prints. Several test folders are empty.

**Status: partially implemented.** The source-text name guard is deleted. It did not prove
that a check ran or found a defect. The executable planted-case ledger remains open.
Deletion-only command and schema tests, duplicate process cases, and configuration
inventory assertions are also removed. Real input, process, and storage failure cases remain.

**Target.** Every shipped check has one planted defect that makes it fail, with the message of
its own rule.

**Files.** `packages/cli/tests/unit/presets/every-check-tested.test.ts`, the test of each preset,
`tests/acceptance/frameworks/libraries.test.ts`, `react.test.ts`, `handheld.test.ts`.

**Logic.** The guard test passes for a check name only inside a planted case that expects exit 1
and a finding of that check. A case is data: `{ check, plant, expects }` in the test file, and
the guard reads that data, not the text of the file. A check that needs the network or Docker
runs in the `manual` job of CI.

**What goes.** The empty test folders, and the loops that read no exit code.

**Tests.** The guard test, which fails today for the thirteen.

**Done when.** It passes with no exception list.

## T-29: expectations that any output holds

Closes T-29, T-26, T-5, and T-18.

**What is wrong.** Twenty cases expect a text that the planted path or the name already holds:
`The` for the typos check, and the folder names `turn` and `helpers` for two structure checks.
Two expectations look for the check name, which every run prints.

**Target.** A case expects the rule name or the sentence of its finding, and the exit code.

**Files.** `config-files.test.ts`, `documents.test.ts`, `structure.test.ts`, `spelling` cases,
and the others the two rows list.

**Logic.** `expects` of a case takes `rule` or `message`, and the harness refuses an expectation
that is a substring of the planted path.

**What goes.** Twenty weak expectations.

**Tests.** The harness check above.

**Done when.** The suite passes with it on.

## T-23: folders and analyses with no unit test

Closes T-23, T-10, T-15, and T-16.

**What is wrong.** Unit tests exist for 14 folders of the CLI. None exists for `doctor/`,
`lifecycle/`, the profile reader, the language folders, or any of the 56 analyses of the
structure, bash, python, and swift presets. Eighteen unit test files hold one input each.
`require-server-only` and `tests-directory-contents` have thin cases.

**Target.** Each check under `src/checks/` and each analysis under `src/structure/analyses/` has
a unit test on a text. The test needs no tool and no repository.

**Files.** `packages/cli/tests/unit/checks/`, `tests/unit/structure/analyses/`,
`tests/unit/doctor/`, `tests/unit/lifecycle/`.

**Logic.** A check that reads text takes the text through `engineInput`, so its test needs no
disk. Each test holds the plain case, the edge of each limit, and one input that must not match.

**What goes.** Nothing.

**Tests.** A unit test walks `src/checks/` and `src/structure/analyses/` and fails a file with no
test file of the same name.

**Done when.** It passes.

## T-19: no test reads the shipped policy over ordinary code

Closes T-19 and T-33.

**What is wrong.** Each naming test builds a policy of its own, so `presets/naming/policy.json`
first met a React component in a real repository (K-136). The clean project of each test is
written in the house style. No test installs into a project the way `create-vite`,
`create-next-app`, `nest new`, `uv init`, or Xcode writes it, so what a stranger gets on day one
is unmeasured.

**Target.** The shipped defaults are measured on ordinary code.

**Files.** New `tests/repositories/generated/`, with one folder for each generator, committed as
its generator wrote it. New `tests/repositories/generated.test.ts`. New
`packages/cli/tests/unit/naming/shipped-policy.test.ts`.

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

**Target.** One snapshot folder for each preset.

**Files.** `packages/cli/tests/snapshots/<preset>/`, new `tests/unit/emit/snapshots.test.ts`.

**Logic.** For each preset the test renders every target for a fixed policy at both levels, and
compares it with the tracked copy. `bun test --update-snapshots` writes them.

**What goes.** Nothing.

**Tests.** This is the test.

**Done when.** A change of one template line shows as one changed snapshot line in the diff.

## T-12: no test measures time

**What is wrong.** Nothing fails when `init` or a staged check gets slower.

**Target.** Two ceilings, held in CI: a staged check of ten files in a planted repository of
5,000 files, and `init --yes` on the same repository.

**Files.** New `tests/release/timing.test.ts`, `tests/config/timeouts.ts`.

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

Closes T-31, T-11, and T-34.

**What is wrong.** `golang.test.ts`, `handheld.test.ts`, `components.test.ts`,
`documents.test.ts`, `repository-check.test.ts`, and `scope-languages.test.ts` do not carry the name
of the preset they test. The Xcode project of the xcode test is nine lines written by hand, so
the reader never meets a `project.pbxproj` that Xcode wrote.

**Target.** A repository test carries the name of its preset (D-128). The xcode fixture is a
project Xcode generated, with groups, build phases, and synchronized folders.

**Files.** Renames: `handheld` to `react-native`, `components` to `vue` and `svelte`, `documents`
to `docs` and `markdown`, `repository-check` to `declared-check`, `scope-languages` to `scope-presets` (D-113). New
`tests/repositories/fixtures/xcode/`.

**Logic.** Renames and one tracked fixture.

**What goes.** The hand-written project text.

**Tests.** The xcode tests run on the fixture.

**Done when.** Every file under `tests/repositories/` is named after a preset name or after what
it installs.

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

**Files.** `tests/harness/registry.ts` and release harness tests under T-24 and K-164.

**Logic.** Use a supported isolated listen address/port allocation, observe child startup and
exit, and verify readiness belongs to the child before returning a registry. An occupied port
must not allow publication into the existing service. Always await owned-child termination and
clean temporary storage, including failure before a registry object is returned. Keep retries
limited to documented startup readiness; never retry failed publication into another registry.

**Tests.** Cover an occupied port with a healthy unrelated HTTP responder, missing executable,
early child exit, a stalled ping, parallel registries, startup timeout, and normal shutdown.
Assert no publication reaches the unrelated responder and no owned child or temporary folder
survives each completed failure path. Run on supported platforms when CI is re-enabled.

**Done when.** Readiness identifies the owned server and all setup/teardown paths release it.

**Locally verified, September 20, 2026; platform verification deferred.** The registry harness
under `tests/harness/registry/` uses a dedicated child interprocess communication channel to learn
its bound loopback port. Readiness requests have a deadline. Child output is captured, termination is awaited,
and partial setup removes owned storage. Publication rejects an exited child.

Eight local regressions cover an occupied healthy responder, separate registries, missing executable,
early exit, startup timeout, stalled readiness, and writes failing before and after launch.
They assert released storage and terminated children. Bun signal termination is identified
through `signalCode` as well as `exitCode`. Supported Windows and Linux execution is deferred
while CI remains bypassed; this requirement stays open until that evidence exists.
