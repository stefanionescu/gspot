# Hooks, the Setup Entry, and Shared Manifests

Rows 2 and 2b of the build order. gspot installed its own hooks folder, its own task names, and
its own `prepare` script, over what a repository had. After this step gspot goes where the hook
of the repository already points, and keeps the command names a team types. It reads the lint
tables of a shared manifest without touching the file.

The stash `hooks-existing` holds a start of this work on an older design. This step builds the
value `existing` anew from D-101 and D-114, and the stash is dropped when the step is pushed.

## K-56: `init` never reads what a hook calls

Closes K-56 and K-57.

**What is wrong.** In five reference repositories the hook is one `exec mise run ...` line, and
the lint lives in the task. `hooksFound` in `repository/existing-tooling.ts:65` finds the folder
and reads nothing in it. `applyAll` (`emit/apply-command.ts:154`) sets `core.hooksPath` on every
apply, also where a tracked setup task sets another folder.

**Target.** `init` reads what each hook calls, and proposes the gspot line in a fixed order
(D-114). The task the hook calls comes first, then the hook file, then the hooks of gspot where
none exist. gspot
never sets `core.hooksPath` (D-167). `doctor` says when a clone runs no hooks, with
the setup command of the repository (D-115).

**Files.** `repository/existing-tooling.ts`, new `repository/hook-calls.ts`, `emit/hooks.ts`,
`emit/hook-managers.ts`, `emit/apply-command.ts`, `doctor/report.ts`, `policy/schema.ts`.

**Logic.** `hook-calls.ts` parses a hook file for `mise run <task>`, `npm run <script>`,
`npx lefthook`, and `husky`, and returns the target. `[hooks]` holds `tool` (`gspot`, `husky`,
`lefthook`, or `existing`) and, for `existing`, `pre_commit` and `pre_push` with the file or task
that carries the line. The line is one managed block. Lines of the task that are no lint stay.

**What goes.** The unconditional `git config core.hooksPath` of `applyAll`, and
`emit/lefthook.ts` as a file of its own.

**Tests.** `hooks.test.ts` plants a `.githooks/pre-commit` that runs `mise run lint`, and holds
the gspot line in the task and an unchanged `core.hooksPath`.

**Done when.** That case passes, and a commit in the planted repository runs gspot once.

## K-58: command names a team already types

**What is wrong.** `emit/runner-surface.ts` writes five `gspot:*` tasks and ignores the `lint`,
`format`, and `format:check` names a repository has. The README of the team then points at a
command that runs the old lint.

**Target.** Where such a name exists, the plan proposes a new body that calls gspot, and the
developer accepts it. gspot writes a `gspot:*` task only where the name is free (D-116).

**Files.** `emit/runner-tasks.ts`, `lifecycle/init/plan.ts`, `policy/schema.ts`, `readers/tasks.ts`.

**Logic.** `[runner] tasks` maps each gspot task to the name it lives under. `runner-tasks.ts`
writes that map, and `uninstall` puts back the body it replaced, which the policy holds in
`[runner] replaced`.

**What goes.** The fixed list of five names.

**Tests.** A planted `mise.toml` with a `lint` task holds the new body after `init --yes`, and
the old body after `uninstall`.

**Done when.** Both halves pass.

## K-59: lint tables in a shared manifest

**What is wrong.** Takeover reads no `[tool.ruff]` of `pyproject.toml` and no `eslintConfig` of
`package.json`. It names no lint-only dependency inside a manifest with other dependencies, and
no workspace entry of a lint folder.

**Target.** A table in a shared manifest is read, carried, and left in place (D-117). The plan
lists each under the heading for what the developer removes by hand.

**Files.** `lifecycle/carry.ts`, `lifecycle/takeover.ts`, the takeover rows of the python,
javascript, formatting, and commits manifests.

**Logic.** A takeover row takes `table = "tool.ruff"` or `key = "eslintConfig"` with
`shared = true`. `carryFrom` reads the table through the same reader as a file of that tool.

**What goes.** Nothing is written into either manifest, ever, but the launcher line (D-147).

**Tests.** A planted `pyproject.toml` with `[tool.ruff] ignore = ["E501"]` holds the carried
ignore, the unchanged file, and the plan line.

**Done when.** That case passes.

## K-60: a failing hook names no way out

**What is wrong.** `runText` in `output/reporter.ts:153` ends a failing hook run with the summary
and nothing else.

**Target.** A failing run from a hook ends with two lines: the command that reproduces it, and
`git commit --no-verify` as the way past it.

**Files.** `output/reporter.ts`, `emit/hooks.ts`.

**Logic.** The hook sets `GSPOT_HOOK=<name>`, and the reporter adds the two lines when it is
set.

**What goes.** Nothing.

**Tests.** `hooks.test.ts` holds both lines in the output of a refused commit.

**Done when.** That case passes.

## K-292: gspot turns the local hooks of a developer off

**What is wrong.** `apply` writes `.gspot/hooks/` and points `core.hooksPath` at it. Git then runs
no file under `.git/hooks/`: a hook one developer wrote for one clone, and the four hooks git-lfs
installs. Only `pre-push` of git-lfs is called on, and nothing says the others stopped.

**Target.** D-167. gspot adds one line and takes nothing away. It never sets `core.hooksPath`.

**Files.** `emit/hooks.ts`, `emit/apply-command.ts`, `lifecycle/install-tools.ts`,
`lifecycle/uninstall-command.ts`, `doctor/report.ts`. Deleted: the folder `.gspot/hooks/`.

**Logic.** `init` decides where the line lives, in the order of the table of D-167, and writes the
tracked forms once. `gspot install` writes the local forms in each clone. For a hook file that
exists under `.git/hooks/`, it adds its managed block at the end, after what the file already
runs. For no file, it writes a new one that holds the block alone.

`uninstall` removes the block,
and deletes a file that held nothing else. `doctor` reads the hook that git will run, by asking
`git rev-parse --git-path hooks`, and says whether the gspot block is in it.

**What goes.** Every `git config core.hooksPath` call, and the `git lfs pre-push` line of the
hook gspot wrote.

**Tests.** A planted clone with a hand-written `.git/hooks/pre-commit` and git-lfs installed
holds, after `gspot install`, both hooks unchanged above the gspot block, and an unset
`core.hooksPath`.

**Done when.** That case passes.
