# The Files gspot Writes

Rows 4 to 7 of the build order. They cover what gspot leaves in a repository: the root pointers,
the marks, the report, and the end of the local skip file. After this
step a developer can tell every file gspot wrote from every file gspot did not, and `apply`
deletes only the first kind.

K-47 (the copy stubs) and K-45 (the record of the message run) belong to these rows. They sit in
the two earlier files, because they are small and other fixes build on them. K-44 (the cache
limit and the build folder) sits in [04-speed.md](04-speed.md).

## A-5: a skip file hid a failing gate

Row 4, D-103. No gap row holds it, so [20-adoption.md](../20-adoption.md) is its evidence.

**What is wrong.** In the app an untracked `gspot.local.toml` skipped eight checks, so the gate
passed on one machine and failed on every other.

**Target.** D-173. `gspot.local.toml` is gone, and no file skips a check on one machine. `init`
runs no check (D-165), and its last lines name `gspot check` and `gspot check --fix`.

**Files.** Deleted: `policy/local-schema.ts` and its test. Changed: `policy/read-policy.ts`,
`run/plan.ts`, `output/reporter.ts`, `emit/managed-blocks.ts`, `lifecycle/init/command.ts`.

**Logic.** `read-policy.ts` reads `gspot.toml` alone. `plan.ts` loses the local skip list and
keeps `--skip`. A `gspot.local.toml` that still exists is named once by `doctor` as a file
nothing reads.

**What goes.** The local schema, the merge of two config files, the line of the `.gitignore`
block, the count of local skips in the summary, and the eight skips of the app.

**Tests.** A planted `gspot.local.toml` that skips `bash/shellcheck` changes nothing: the check
runs.

**Done when.** That case passes, and a search of `packages/` for `local.toml` finds `doctor`
alone.

## K-72: generated files show as code in a pull request

**What is wrong.** `init` writes nothing to `.gitattributes`, so `.gspot/`
counts as code on GitHub and GitLab (A-26).

**Target.** One managed block in `.gitattributes`: `.gspot/** linguist-generated`.

**Files.** `emit/managed-blocks.ts`, `emit/targets.ts`.

**Logic.** The block uses the `#` comment markers, as the `.gitignore` block does. `uninstall`
removes it, and deletes the file when the block was all it held.

**What goes.** Nothing.

**Tests.** The planted install holds the block, and `uninstall.test.ts` holds that it is gone.

**Done when.** Both pass.

## K-118: `apply` deletes files it did not write

**What is wrong.** `isStray` in `emit/drift.ts:86` calls every text file under `.gspot/` a stray
unless gspot wrote it in this run. `NEVER_STRAY` names three files. A hand-made
`.gspot/gitleaks-baseline.json`, which the secrets preset asks the developer to make, is a text
file under `.gspot/` that no template writes, so `apply` deletes it.

**Target.** `apply` deletes a file only when the file carries the mark of gspot (D-100). A file
with no mark is left alone and named by `gspot doctor` as not owned.

**Files.** `emit/apply-command.ts`, `checks/integrity/generated-drift.ts`, `doctor/changes.ts`.

**Logic.** `isStray` is `hasHeader(...)` for a text file and the `_gspot` key for a JSON file, and
nothing else. The path prefix test goes. The gitleaks baseline moves to the root of the
repository as `.gitleaks-baseline.json`, a file the developer owns, and the secrets manifest
names that path.

**What goes.** `NEVER_STRAY`, `isStrayCandidate`, and `isValePackageFile`, because a file with no
mark is never a stray.

**Tests.** A planted repository with a hand-made JSON file under `.gspot/` holds the file after
`apply`, and a line for it in `doctor`.

**Done when.** That case passes.

## K-296: nobody wrote down what the `.gitignore` block holds

**What is wrong.** No document lists the lines of the block, or says what happens in a
repository with no `.gitignore`. `gitignoreBlock()` in `emit/managed-blocks.ts` lists each Vale
package by hand and holds `.gspot/last.sarif`, a file name that is gone.

**Target.** D-170. The block holds the untracked paths of gspot alone, and it comes from the
manifests. gspot creates the file where none exists and adds no line for the files of the
developer.

**Files.** `emit/managed-blocks.ts`, `emit/targets.ts`, the prose manifest, `commands/uninstall.ts`.

**Logic.** The fixed lines are `.gspot/cache/`, `.gspot/node_modules/`,
`.gspot/.venv/`, and `.gspot/report.*`. A manifest adds a line through a field named
`untracked`, and the prose manifest names the folder of each Vale package there. The block goes
at the end of the file. In a folder with no git, `targets.ts` leaves the block out. `uninstall`
removes the block, and deletes the file when the block was all it held.

**What goes.** The hand-written list in `gitignoreBlock()`, and the line `.gspot/last.sarif`.

**Tests.** Three planted cases: no `.gitignore`, one with lines of the developer, and a folder
with no git. `uninstall.test.ts` holds that a file gspot created is deleted.

**Done when.** They pass, and `git status` is clean after `gspot install` in each planted
repository.
