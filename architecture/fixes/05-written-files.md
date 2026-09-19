# The Files gspot Writes

Rows 4 to 7 of the build order. They cover what gspot leaves in a repository: the root pointers,
the marks, the one baseline file, the run record, and the first commit after `init`. After this
step a developer can tell every file gspot wrote from every file gspot did not, and `apply`
deletes only the first kind.

K-47 (the copy stubs) and K-45 (the record of the message run) belong to these rows. They sit in
the two earlier files, because they are small and other fixes build on them. K-44 (the cache
limit and the build folder) sits in [04-speed.md](04-speed.md).

## A-5: the first commit fails, so a skip file hid it

Row 4, D-103. No gap row holds it, so [20-adoption.md](../20-adoption.md) is its evidence.

**What is wrong.** `NEVER_BASELINED` in `run/baselines.ts` holds `format`, `syntax`, `schema`,
`coverage`, and `build`, which is right: nobody fixes a format finding by hand, so a baseline of
them never shrinks. A repository with one unformatted file then fails from the first commit. In
the app an untracked `gspot.local.toml` skipped eight checks, so the gate passed on one machine.

**Target.** `init` ends by offering `gspot check --fix`, and says how many files it changes. The
developer reads the diff and commits it. `gspot.local.toml` has one purpose: a tool that cannot
run on this machine. A skip of a check whose tool is present exits 2.

**Files.** `lifecycle/init/command.ts`, `lifecycle/first-check.ts`, `policy/local-schema.ts`,
`run/plan.ts`, `output/reporter.ts`.

**Logic.** `first-check.ts` runs the fixers with `--dry-run` and counts the changed files.
`plan.ts` asks `platform/tool-probe.ts` for the tool of each locally skipped check, and refuses
the skip where the probe finds it. Every summary line counts the checks a local skip removed.

**What goes.** No key is added. The eight skips of the app go when the app is redone.

**Tests.** A planted repository with one unformatted file commits after `init` and the fix run,
on a second clone with no local file. A local skip of `bash/shellcheck`, with ShellCheck
installed, exits 2.

**Done when.** Both cases pass.

## K-72: generated files show as code in a pull request

**What is wrong.** `init` writes nothing to `.gitattributes`, so `.gspot/` and the baseline file
count as code on GitHub and GitLab (A-26).

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

## K-46: a count that rises prints every finding of the rule

**What is wrong.** `applyBaselines` in `run/baselines.ts:179` keeps every finding of a rule whose
count rose. One new finding under a rule that holds 400 prints 401. The counts sit in one file
for each rule, 112 files in the app, and two branches conflict on the same path map (A-6).

**Target.** Baselines live in `.gspot/baseline.json`, sorted, one path on a line (D-104). When a
count rises, the run prints the findings of the files whose count rose, and one line that counts
the rest.

**Files.** `run/baselines.ts`, `run/baseline-command.ts`, `config/paths.ts`, and the manifests of
ESLint and basedpyright, which name the baseline file their tool keeps.

**Logic.** The file maps `check`, then `rule`, then `path`, to a count. `verdictFor` compares by
path, so a rise names its files. `gspot baseline` lowers every count to the last full record, and
`gspot baseline <check-id>` writes the first counts of one check (D-132). A lowered count is
written in place, so a merge of two branches conflicts on one line or none.

**What goes.** `.gspot/baselines/`, `emit/first-baseline.ts`, `emit/lower-baselines.ts`,
`emit/prune-baselines.ts`, `apply --lower-baselines`, and the entries of the Prettier ignore file
and the typos template that name the old folder (K-224).

**Tests.** Two planted branches each add a finding under one rule, and their merge has no
conflict. One new finding under a held rule prints one finding and one summary line.

**Done when.** Both pass, and `.gspot/` of this repository holds one baseline file.
