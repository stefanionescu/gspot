# gspot Checks Itself

Row 24 of the build order, and the last. gspot runs gspot with no `[[ignore]]` entry, and still
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
work of a change ends when its run on GitHub is green.

**Files.** `gspot.toml` (`tests/unit` as a `[[check]]` at push, with `inputs`),
`.github/workflows/ci.yml`, `tests/repositories/docs.test.ts`, `presets/javascript/eslint.config.js.tmpl`,
`CONTRIBUTING.md`.

**Logic.** The check runs `bun test packages --coverage` and fails under the floor in
`bunfig.toml`. The docs test fetches the Vale packages in its setup, or fails with the command
that fetches them. The jest preset of [08-frameworks.md](08-frameworks.md) reads `bun:test`
through `globalPackage`, and this repository selects it. This repository sets `level = "all"`.
`CONTRIBUTING.md` says that a change is done when its run is green, and how to read the run.

**What goes.** `describe.skipIf` in the docs test, and `[inspection] strict`.

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

**Target.** Every path, command, flag, key, and check id that a document names exists, held by a
check. The pages that repeat a manifest are written from it.

**Files.** `gspot.toml`, `checks/docs/stale-paths.ts`, new `checks/docs/samples.ts`,
`docs/reference-pages.ts`, new `architecture/presets.ts`.

**Logic.** The three folder exemptions go. One setting, `tools.docs.foreign_repositories`, names
the other repositories this folder writes about, and a path under one of those names is skipped.
`docs/samples` loads every `toml` block that holds `version = 1` through the config reader, and
parses every `gspot` line of a `bash` block with the program. It also reads each check id and
setting name in code ticks against the manifests, and every `gspot` command inside a `summary`,
a `why`, and a `fix` of a manifest.

`architecture/presets.ts` writes the tables of
each preset page and the tree blocks of `16-file-tree.md` from the manifests and the disk, and
the hand-written text of a page stays. The build of the manual runs as a `[[check]]` at the
`manual` stage, and the link exemption goes.

**What goes.** Three exemptions, one link exemption, and the tables of 49 preset pages as text
written by hand.

**Tests.** A document that names a removed flag fails `docs/samples`.

**Done when.** It passes on `architecture/` and `docs/` with no exemption.

## S-15: `01-product.md` promises what no test holds

**What is wrong.** The product document states promises, such as that a first install never
breaks a build, and no test is named for any of them.

**Target.** Each promise names the test that holds it.

**Files.** `architecture/01-product.md`, and the tests it names.

**Logic.** A promise with no test is a row of [18-gaps.md](../18-gaps.md) or leaves the document.

**What goes.** Promises nobody can test.

**Tests.** `docs/samples` resolves each test path the document names.

**Done when.** It passes.
