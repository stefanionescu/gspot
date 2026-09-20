# gspot Checks Itself

This is the self-verification workstream of the pre-adoption gate in
[22-remaining.md](../22-remaining.md), not the last feature to implement. gspot runs gspot with no `[[ignore]]` entry, and still
leaves parts of itself unread: its templates, its documents, its manual, and its tests in any
hook. This step closes those, after the renames, so the gate of this repository means what it
says.

S-13 to S-18 listed the sentences of `architecture/` that the code did not keep. Those documents
were written again to the target design on 2026-09-19. What is left of those rows is the check
that keeps them true.

## S-1: no linter reads a template

Closes S-1 and S-2.

**What is wrong.** The 61 templates under `presets/` get spelling, secrets, and two repository
checks. No parser reads them, and they are what gspot writes into every repository. The output of
a template is checked only for the 15 presets this repository selects.

**Target.** One repository check writes every template of every preset into the cache, at both
levels, and runs the parser and the formatter of each kind over the result.

**Files.** New `packages/cli/template-check.ts`, and a `[[check]]` entry `templates/output` in
`gspot.toml` with `inputs = ["presets/**"]`.

**Logic.** The script renders each preset with its planted policy, then runs `prettier --check`,
`taplo check`, `yamllint`, and `eslint --no-config-lookup` over the files of its kind. It shares
its renders with the snapshot test (T-36).

**What goes.** Nothing.

**Tests.** A template with a broken TOML line fails the check.

**Done when.** It passes on all 49 presets.

## S-3: no hook runs the tests

Closes S-3, S-7, S-8, S-9, and S-12.

**What is wrong.** `bun test` runs in CI only, and a failing unit test was committed once. CI
prints coverage and compares it with nothing. The planted test of the markdown, docs, and prose
presets skips itself when the Vale packages are absent, and the workflow fetches them one step
too late. The ESLint rules that catch a weak test are off here, because the template turns them
on with the vitest preset alone. Nobody read a run on GitHub, so 92 red runs went unseen.

**Target.** The unit tests run at the push stage with a coverage floor. No test skips itself. The
work of a change follows the [active CI bypass](../22-remaining.md#active-ci-bypass).
While it is active, local verification permits continued implementation without a GitHub run.

**Files.** `gspot.toml` (`tests/unit` as a `[[check]]` at push, with `inputs`),
`.github/workflows/ci.yml`, `tests/repositories/docs.test.ts`, `presets/javascript/eslint.config.js.tmpl`,
`CONTRIBUTING.md`.

**Logic.** The check runs `bun test packages --coverage` and fails under the floor in
`bunfig.toml`. The docs test fetches the Vale packages in its setup, or fails with the command
that fetches them. The jest preset of [08-frameworks.md](08-frameworks.md) reads `bun:test`
through `globalPackage`, and this repository selects it. This repository sets `level = "all"` and `[coverage] strict = true`.

`CONTRIBUTING.md` explains local verification and how to read CI results when CI is enabled.
It must not require a GitHub run while the active bypass applies.

**What goes.** `describe.skipIf` in the docs test.

**Tests.** These are the tests.

**Done when.** A commit with a failing unit test cannot be pushed.

## S-4: documents name paths that nothing verifies

Closes S-4, S-5, S-11, S-13, S-14, S-16, S-17, S-18, and K-225.

**What is wrong.** `integrity/stale-paths` skips `rules/**`, `architecture/**`, and `docs/**`,
because they name files of other repositories. A path in this folder that a rename broke is found
by no check. The link check skips the manual and relies on a build that no check runs. Nothing
loads the config samples of the manual, and a TOML block that parses can be a config gspot
refuses. The `fix` text of several checks names a command that D-129 to D-133 remove.

The preset pages, the ledger, and the file tree disagreed with the code in about 200
places.

**Target.** Every path, command, flag, key, and check name that a document names exists, held by a
check. The pages that repeat a manifest are written from it.

**Files.** `gspot.toml`, `checks/docs/stale-paths.ts`, new `checks/docs/samples.ts`,
`docs/reference-pages.ts`, and the public-reference contract tests (K-304).

**Logic.** The three folder exemptions go. One setting, `tools.docs.foreign_repositories`, names
the other repositories this folder writes about, and a path under one of those names is skipped.
`docs/samples` loads every `toml` block that holds `version = 1` through the config reader, and
parses every `gspot` line of a `bash` block with the program. It also reads each check name and
setting name in code ticks against the manifests, and every `gspot` command inside a `summary`,
a `why`, and a `help` of a manifest.

Do not add `architecture/presets.ts`. Generate implemented reference facts once in the public manual. Architecture pages state intended behavior and link to that reference where current detail is needed. Target-only names are checked against their explicit implementation gap, not falsely required to exist in today's code. Delete redundant current-state inventories instead of adding another generator to maintain them. The build of the manual runs as a `[[check]]` at the
`manual` stage, and the link exemption goes.

**What goes.** Three exemptions, one link exemption, and the tables of 49 preset pages as text
written by hand.

**Tests.** A document that names a removed flag fails `docs/samples`.

**Done when.** Public examples match shipped behavior; architecture distinguishes planned names with tracked gaps. No broad folder exemption hides broken links or untracked promises.

## S-15: `01-product.md` promises what no test holds

**What is wrong.** The product document states promises, such as that a first install never
breaks a build, and no test is named for any of them.

**Target.** Each promise names the test that holds it.

**Files.** `architecture/01-product.md`, and the tests it names.

**Logic.** A promise with no test is a row of [18-gaps.md](../18-gaps.md) or leaves the document.

**What goes.** Promises nobody can test.

**Tests.** `docs/samples` resolves each test path the document names.

**Done when.** It passes.

## K-309: repository CI repeats expensive work

**What is wrong.** `ci.yml` runs setup and self-check on three platforms for each main push
and pull request. `gspot.yml` repeats Ubuntu setup and self-check for the same revision.
Neither workflow cancels obsolete runs. Full coverage and builds run with every matrix job.

**Target.** Define the required checks and execution frequency before re-enabling CI.
Keep fast local feedback, one owner for each repository CI check, and explicit full-platform
and package acceptance checkpoints. Do not restore a full matrix on every intermediate commit.

**Files.** `.github/workflows/ci.yml`, the owner of generated `gspot.yml`, repository task
configuration, and contributor documentation. Never hand-edit generated workflow output.

**Logic.** Inventory duplicate jobs, preserve unique manual and report checks, share reusable
setup where it saves work, and cancel superseded runs in the same workflow/ref group. Choose
path filtering and required-check behavior together so a skipped required check cannot leave
an unexplained pending merge gate. Record cold and warm durations before claiming improvement.
Do not suppress failures, replace platform acceptance with a Linux-only badge, or enable paid
capacity. This work does not authorize running CI during the active bypass.

**Tests.** Validate trigger and job selection locally for documentation-only and source changes,
forks, main pushes, and concurrent revisions. After explicit re-enablement, verify the agreed
schedule and exact-revision results. Keep that remote evidence deferred until then.

**Done when.** Each required check has one execution owner, the user has agreed the execution
frequency, and the enabled workflow follows it. `[skip ci]` remains the temporary user override.
