# Hooks, CI, and Runners

This document decides where checks run: git hooks, the CI job, and the tasks of the runner.

This repository resolves `gspot` through a checkout-local executable on mise PATH. The launcher
executes current source and preserves the caller directory, arguments, input streams, signals,
and status. Repository tasks use that same executable. The release-provider override belongs
to this checkout; generated consumer integrations retain their pinned executable behavior.

## What runs when

`gspot check` is the truth, and the hooks are the fast path.

| When                         | What runs                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                | every check of the commit and push stages, over the whole repository           |
| the commit hook              | staged files, and the whole-project checks of a project a staged file sits in  |
| the push hook                | the exact pushed trees, selected from every local/remote ref pair              |
| `gspot check --stage manual` | the checks that build, test, or scan a whole project, or that need credentials |
| CI                           | what the change touches, or everything with `[ci] run = "all"`                 |

File-list checks narrow adoption noise, but affected whole-project checks report all findings. Existing errors can still block a change; gspot records no baseline. A
full run alone sees the world change, such as a new advisory, and `gspot doctor` prints the date
of the last full run. `[hooks] push = "all"` is for a team that wants the full run on push
.

## Stages

Every check declares one stage.

| Stage     | Holds                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `commit`  | a check that takes the staged files, or that ends within five seconds on the planted repository of its preset                |
| `push`    | a check that reads a whole scope: type checkers, dead code, dependency audits, link checks                                   |
| `manual`  | a check that builds, tests, or scans a whole project: the Swift build and analyzer, Periphery, coverage, CodeQL, image scans |
| `message` | commitlint                                                                                                                   |

A release test measures the commit stage and fails a check over the ceiling that takes no file
list. No hook has a time budget that skips checks, because a gate that skips by the clock gives
two verdicts on two machines.

A check requires nothing, or one of `build`, `docker`, `database`, and `network`. A requirement
puts the check in `push` at least. A `docker` requirement with no daemon fails, with no silent
pass. A check that waits for a setting prints `skipped` and names the setting.

## Revision selection and changed files

A file-list check receives the changed source paths. A project-wide check runs when any changed,
renamed, or deleted path affects its inputs. Inputs include config and lockfiles.
Follow reverse project references for dependent scopes. When impact is uncertain, run the
broader set.

Once triggered, the check reports all findings. These include errors in unchanged callers
and findings without locations.
Missing tools, failed parsers, and tool crashes remain failures. A cache stores the complete
result and includes the full project inputs and revision identity. It never stores a
path-filtered verdict.

`gspot check --staged` reads the index. It includes staged deletions and both sides of renames.
Checks run over an isolated snapshot of the index. Unstaged edits neither repair nor break the
commit verdict. An unborn branch compares with the empty tree. No stash or working-tree
checkout occurs.

Hooks never run fixers.

Interactive `gspot check --changed[=<ref>]` compares the working tree with the merge base of
the resolved ref and HEAD, includes tracked working changes, and labels that content source.
If neither an upstream nor a default branch can be identified, request an explicit ref and exit 2.
It is a local check, not a statement about a different branch being pushed.

## The push hook

The hook calls the hidden `gspot check --push` entry point. It reads every
`local-ref local-object remote-ref remote-object` row from stdin, as specified by
[Git pre-push](https://git-scm.com/docs/githooks#_pre_push). Both object IDs belong to the
contract; never substitute HEAD for the local object. Buffer the input once for hook chaining.

For an existing remote ref, compare its old object directly with the pushed local object.
For a new ref, identify commits reachable from that local object but from no fetched ref of
the destination remote. Select the union of paths changed by those commits. If no usable
fetched reachability exists, check the full local tree.

A deleted ref runs no source check. Resolve tags to commits. Report non-commit objects as not
applicable. Process multiple refs independently and deduplicate identical local trees and
input sets.

Missing required objects cause a clear setup failure. Never substitute HEAD or treat the
missing diff as empty. `[hooks] push = "all"` checks every pushed local tree in full, not the working tree.

Check the exact local commit in an isolated snapshot. Never stash or mutate the real working
tree. Resolve configuration from that snapshot and validate its version pin. Reuse
installed tool environments only when their manifests and locks match; otherwise fail with
the command to prepare the required version. Repository dependencies must also match the
snapshot or the check reports missing setup. Do not silently check against another tree's
dependencies.

Supported tool commands direct all output into scratch space. Arbitrary custom
commands remain trusted repository code, not sandboxed code.

A project-wide check sees all its snapshot inputs and all its findings affect the verdict.
Existing errors can block a push. The supported choices are to fix them, configure an ignore,
or bypass the local hook; CI still judges the submitted tree. No finding baseline is created.

## Hooks

gspot goes where the hook already points. `init` reads what each hook calls and proposes
the gspot line in a fixed order. The task the hook calls comes first, then the hook file, then
hooks of its own where none exist.

| `[hooks] tool`     | gspot writes                                                                             | Proposed when                     |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------- |
| `existing`         | one managed block in the task or the hook file that git already runs                     | the repository has hooks          |
| `husky`            | one line in each `.husky/` hook                                                          | `.husky/` exists                  |
| `lefthook`         | a `gspot` block in `lefthook.yml`                                                        | `lefthook.yml` exists             |
| `pre-commit`       | one `repo: local` hook in `.pre-commit-config.yaml`, as a managed block                  | that file exists                  |
| `simple-git-hooks` | the gspot line in its key of `package.json`, after a yes                                 | that key exists                   |
| `gspot`            | a dispatcher or new hook in the Git-resolved hooks directory, written by `gspot install` | no hook tool and no tracked hooks |
| no table           | nothing                                                                                  | the person passes `--no-hooks`    |

A repository with hooks keeps their behavior, arguments, input, and failure status. gspot
never sets `core.hooksPath`, because that setting turns every hook under `.git/hooks/` off: a
hook one developer wrote for one clone, and the hooks git-lfs installs. Where such a
local hook exists, `gspot install` installs the chain described below. Where a
husky hook calls lint-staged, the gspot line goes into the hook, and the plan lists the
lint-staged entries that run a tool gspot runs too. A
folder named `hooks` is no sign of git hooks: gspot asks `git config core.hooksPath` first.

A hook under `.git/hooks/` belongs to one clone. `gspot install` writes the gspot block of a clone, and
the developer runs it explicitly after cloning, and `doctor` asks git whether the hooks run in this clone. It names one of three
states, and ends with the setup command where the hooks exist and do not run.

The block gspot writes runs under the Bash 3.2 that macOS ships. In a new hook file it is
the whole file:

```bash
#!/usr/bin/env bash
#
# Written by gspot. Run `gspot uninstall` to remove.
# Runtime: Bash 3.2+. macOS, Linux, and Git for Windows.
set -euo pipefail

main() {
    GSPOT_HOOK=pre-commit exec mise exec -- gspot check --staged "$@"
}

main "$@"
```

`init` writes how the binary is found into the line:

- Under mise, use `mise exec -- gspot`.
- Under an npm runner, use `bunx gspot` or a package-manager local-exec form that cannot
  download a missing package.
- Otherwise, use a PATH-resolved pinned binary.

Each finds the version the repository pins. A hook that cannot find gspot prints the install command and fails. The line
asks the developer for no environment variable. The line itself sets `GSPOT_HOOK`, which tells
the reporter to end a failing run with two
lines: the command that reproduces it, and `git commit --no-verify` as the way past it.

On Windows, git runs
hooks through the Bash that Git for Windows installs, and gspot marks them executable through
`git update-index --chmod=+x` for tracked hooks; clone-local hooks use filesystem executable permissions.

One skip exists: `--skip` for one run, and it prints. No file and no environment variable turns
a check off on one machine. A hook never runs `--fix`.

### Hook chaining

Prefer a hook manager's supported composition mechanism. A recognized tracked task can receive
a managed gspot invocation only where its control flow reaches it and its non-lint behavior
remains intact. A hook body is not assumed to be shell merely because it is executable.

For an unmanaged local hook, preserve the original as an executable sibling in the Git-resolved
hooks directory and install a marked dispatcher. Run the original as a subprocess, then gspot,
with the same arguments, working directory, and environment. A nonzero original status stops
the chain and is preserved. A successful `exec` or `exit` in the original cannot skip gspot.

For pre-push, replay the buffered stdin independently to both commands. Install twice produces
one chain, never a chain of dispatchers. Recovery stores the original path, bytes, mode, and
installed dispatcher hash. Reject an existing sibling collision rather than overwrite it.

Do not move an unknown tracked hook behind the developer's back. The init plan must describe
the dispatcher and retained original; an unsupported hook manager or unapproved replacement
leaves the hook intact and reports the explicit installation step. Git LFS, non-shell hooks,
spaces in paths, linked worktrees, and `core.hooksPath` are integration cases.
Uninstall restores only an unchanged dispatcher and leaves edited originals intact.

## Tasks of the runner

Every task calls gspot, and the order of checks lives in gspot.

| `[runner] tool`              | gspot writes                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `mise`                       | `.mise/conf.d/gspot-tools.toml` with the tool pins, and the tasks below |
| `npm`, `pnpm`, `yarn`, `bun` | the `gspot` launcher in `devDependencies`, and the scripts below        |
| no table                     | nothing                                                                 |

Existing command names keep working. Where a `lint`, `format`, or `check` task exists,
the plan proposes a new body that calls gspot, and the developer accepts it. gspot writes a
`gspot:check` and a `gspot:fix` task only where the name is free. `[runner] tasks` holds the
names. Uninstall restores an old body only when its replacement is unchanged; otherwise it
preserves the developer edit and reports the recovery copy. gspot never creates or edits a
package lifecycle script, including `prepare`, and never injects a setup task.

The mise file has one place in every repository. gspot changes an existing task in `mise.toml` only when that exact replacement was accepted in the init plan. `init`
runs `mise trust` on its file before the install. The file pins gspot itself through the `github`
backend of mise, which is what `mise exec` and the hook find. A pin the repository already holds
for a tool is kept, and `doctor` reports a version below the floor of the preset.

The npm lint tools are no part of the runner. They install under `.gspot/`, from
`.gspot/package.json`, with the package manager the repository uses, under every runner.
A repository with no JavaScript takes bun or npm, whichever the machine has.

## CI

`--ci` takes `github` or `gitlab`, and the default follows the repository: its CI files first,
then the host of its remote. A repository whose CI already runs a lint job is told so
and gets no second job.

For GitHub, gspot writes `.github/workflows/gspot.yml`. The emitter supplies real, verified
action commit pins. The workflow contract is:

- Trigger on `pull_request`, `merge_group`, and `push`.
- Select the base from `pull_request.base.sha`, `merge_group.base_sha`, or `before`,
  respectively. An absent or all-zero base means a full check of the checked-out target tree.
  Missing history is fetched explicitly or fails; it never produces an empty successful run.
- Check the pull-request merge tree, merge-group tree, or pushed commit, respectively.
  Pass a validated base through an environment variable, not interpolated shell code.
- Run `gspot install` from tracked locks, then the commit and push checks.
- Run manual checks in a separate job on default-branch pushes. That job has its own setup
  and report artifact, so it cannot overwrite the first job's report.
- Upload each job's reports after its check, including a failed check, with an always-run
  artifact step. Artifact names include stage and platform.
- Run code scanning after success or failure of the producing jobs, with a failure-aware
  job condition such as `always() && !cancelled()`, limited to pushes in the repository.
- Download only artifacts that exist and upload each SARIF with a distinct stage/platform
  category. An absent report is reported, not presented as an empty successful scan.
- Keep workflow permissions at `contents: read`. Only the code-scanning job receives
  `security-events: write`. `[ci] sarif = false` omits that job.
- Cache installations by operating system, architecture, package-manager version, all selected
  lockfiles, and tool pins. Cache hits do not replace locked-install validation.
- Cancel superseded pull-request runs only. Use a pinned runner image and explicit timeout.

The dependency conditions follow [GitHub job behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs).
Workflow tests cover failed checks with reports, missing reports, forks, merge queues,
first pushes, and separate manual artifacts.

The job follows `GITHUB-ACTIONS.md`, the rule file gspot installs. It has least permissions, a
pinned runner image, a timeout, and a concurrency group that cancels pull request runs alone.
The upload to code scanning is a job of its own, and `[ci] sarif = false` leaves it out for a
repository without code scanning.

The findings print to the log, and the JSON report is written
beside them. A macOS job appears only where a Swift scope exists. Actions are pinned by commit,
and `configs/actions-pins` asks GitHub that each pinned commit exists. Drift of generated
files is the check `integrity/generated-drift` inside `gspot check`, so the job runs no `apply`.

For GitLab, gspot writes `.gitlab/ci/gspot.yml` with one job, and the plan shows the line that
includes it. gspot never edits `.gitlab-ci.yml`. The job sets `GIT_DEPTH: 0`, runs for merge
requests and the default branch, and declares `.gspot/report.codequality.json`. GitLab reads the
CodeClimate format there, and every run writes `.gspot/report.codequality.json` beside the JSON and the SARIF.

The CI system is found by its files, `.github/workflows/` or `.gitlab-ci.yml`, and never by a
host name, so a self-hosted host works. For every other system, such as Bitbucket, Jenkins,
CircleCI, or Azure, gspot writes no file. The plan prints the lines to paste: install gspot at
the pinned version, `gspot install`, and `gspot check`. The reports are the files under
`.gspot/report.*`.

```yaml
include:
    - local: .gitlab/ci/gspot.yml
```

Without mise, the job installs gspot from the release asset by version and runs `gspot doctor`
first. It downloads `checksums.txt` from the same release and stops when the SHA-256 differs. One
table in the code holds the seven targets, with the `uname` pair of each. The job uses these:

| Runner          | Asset                   |
| --------------- | ----------------------- |
| Linux, x86_64   | `gspot-linux-x64`       |
| Linux, aarch64  | `gspot-linux-arm64`     |
| macOS, arm64    | `gspot-darwin-arm64`    |
| macOS, x86_64   | `gspot-darwin-x64`      |
| Windows, x86_64 | `gspot-windows-x64.exe` |

## Reproduce lines

Every failing check prints the command that runs it alone:
`gspot check api --only typescript/eslint`. The line is the same in the hook, in CI, and in the
terminal.

## The report

Every run but the message run writes `.gspot/report.json`, and `gspot check --json` prints the
same data. Its shape is part of `gspot.schema.json`. The report holds:

- the version, the stage, the start time, and the duration;
- each check with its status, file count, findings, and duration;
- the source files checked and unchecked;
- the ignores applied, and the suppressions by form.

Paths in the report are relative to the repository. The CI job uploads a SARIF file with
locations for the tools that give them.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-56

`init` reads what each hook calls, and proposes the gspot line in a fixed order
. The task the hook calls comes first, then the hook file, then the hooks of gspot where
none exist. gspot
never sets `core.hooksPath`. `doctor` says when a clone runs no hooks, with
the explicit command `gspot install`.

`hook-calls.ts` parses a hook file for `mise run <task>`, `npm run <script>`,
`npx lefthook`, and `husky`, and returns the target. `[hooks]` holds `tool` (`gspot`, `husky`,
`lefthook`, or `existing`) and, for `existing`, `pre_commit` and `pre_push` with the file or task
that carries the line. Supported tracked task insertion must be reachable and preserve control flow.

Unsupported hook scripts stay intact with a setup error. Use the composition contract in [10-hooks-ci-runners.md](10-hooks-ci-runners.md), not textual append. Lines of the task that are no lint stay.

`hooks.test.ts` plants a `.githooks/pre-commit` that runs `mise run lint`, and holds
the gspot line in the task and an unchanged `core.hooksPath`.

### Acceptance K-58

Where such a name exists, the plan proposes a new body that calls gspot, and the
developer accepts it. gspot writes a `gspot:*` task only where the name is free.

`[runner] tasks` maps each gspot task to the name it lives under. `runner-tasks.ts`
writes that map after saving the original body and installed-body hash in local recovery and ownership records. `uninstall` restores the original only if the task is still the installed value; later developer edits stay intact with recovery instructions. A fresh clone without the original backup cannot invent a previous body.

A planted `mise.toml` with a `lint` task holds the new body after `init --yes`, and
the old body after `uninstall`.

### Acceptance K-59

A table in a shared manifest is read, carried, and left in place. The plan
lists each under the heading for what the developer removes by hand.

A takeover row takes `table = "tool.ruff"` or `key = "eslintConfig"` with
`shared = true`. `carryFrom` reads the table through the same reader as a file of that tool.

A planted `pyproject.toml` with `[tool.ruff] ignore = ["E501"]` holds the carried
ignore, the unchanged file, and the plan line.

### Acceptance K-60

A failing run from a hook ends with two lines: the command that reproduces it, and
`git commit --no-verify` as the way past it.

The hook sets `GSPOT_HOOK=<name>`, and the reporter adds the two lines when it is
set.

`hooks.test.ts` holds both lines in the output of a refused commit.

### Acceptance K-292

[10-hooks-ci-runners.md](10-hooks-ci-runners.md): supported composition actually runs both hooks and preserves failure semantics.

Resolve the hook location through Git. Include worktrees and configured paths.
Prefer native hook-manager composition. For unmanaged local hooks, preserve the executable in
a collision-checked sibling and write a marked dispatcher. Run the original as a child, then
gspot only on success.

Forward arguments, working directory, environment, and exit status. Replay the same buffered
stdin to each child. Record ownership and recovery before replacement. Reinstallation must
not nest dispatchers. Restore only an unchanged owned dispatcher on uninstall.

Assert observable execution of both hooks for originals ending in `exec` and `exit 0`; assert failure propagation for nonzero exits. Git LFS and gspot each receive the complete multi-ref stdin. Cover reinstall, custom hooks paths, linked worktrees, non-shell executables, collisions, and developer edits before uninstall.

### Acceptance K-69

A `[[check]]` is cached only when it names its inputs.

`paths` says when the check runs. A new key `inputs` says what it reads, and the cache
key holds the hashes of those files. A check with no `inputs` is never cached.

A planted `[[check]]` that reads a file outside its `paths` fails, is fixed, and
passes on the next run with the cache on.

### Acceptance K-70

The hook verifies the exact committed trees being pushed. HEAD and uncommitted work
do not change the result. Whole-project findings follow the whole-project contract below.

The dispatcher invokes internal `gspot check --push`, buffering all stdin ref rows.
Each supplies local and remote object IDs. Compare the actual endpoints and check a temporary
committed snapshot with matching config and dependency locks.

Follow [10-hooks-ci-runners.md](10-hooks-ci-runners.md) for multiple refs, new refs, tags,
force pushes, deletion-only pushes, missing objects, and a local ref other than HEAD.
Never read working-tree bytes as proof of a pushed commit. Reuse installed dependencies only
when their lock and manifest identity matches.

`hooks.test.ts` pushes a clean commit with a broken uncommitted file beside it, and
holds a passing push.

### Acceptance K-293

Changed paths select file-list tools and affected projects, never filter the findings of a whole-project tool. Existing project errors may block adoption; the plan must say so.

Preserve deleted paths and both sides of renames for impact selection. Configuration, locks, and shared project references trigger dependent projects. Keep every whole-project finding, fileless finding, and failed tool status. Unknown impact selects the broader set.

CI uses event-specific base and target objects, including merge queues and zero-base fallback, from [10-hooks-ci-runners.md](10-hooks-ci-runners.md). Managed tools use the package manager selected by the configuration contract and immutable locks.

Changing an export in `a.ts` must fail on a new error in unchanged `b.ts`. Cover deleted exports, renames, config-only changes, dependency changes, fileless failures, missing tools, old project errors, and every CI event. A clean commit with broken uncommitted work passes when its committed snapshot is clean.

### Acceptance K-295

`--changed` takes an optional ref, written `--changed=<ref>`. `--since` is
gone, with no alias.

The parser reads the value only after an equals sign, so `gspot check --changed api`
checks the folder `api`. With no value the ref is `@{upstream}`, then the default branch
(K-272). The push hook uses internal `--push`; CI uses explicit event-specific base and target snapshots. Missing upstream and default refs give a setup error instead of an empty successful run.

`check-command.test.ts` holds both forms, holds that `--changed api` reads `api` as a
path, and holds that `--since` is an unknown option with exit 2.

### Acceptance K-309

Define the required checks and execution frequency before re-enabling CI.
Keep fast local feedback, one owner for each repository CI check, and explicit full-platform
and package acceptance checkpoints. Do not restore a full matrix on every intermediate commit.

Inventory duplicate jobs, preserve unique manual and report checks, share reusable
setup where it saves work, and cancel superseded runs in the same workflow/ref group. Choose
path filtering and required-check behavior together so a skipped required check cannot leave
an unexplained pending merge gate. Record cold and warm durations before claiming improvement.
Do not suppress failures, replace platform acceptance with a Linux-only badge, or enable paid
capacity. This work does not authorize running CI during the active bypass.

Validate trigger and job selection locally for documentation-only and source changes,
forks, main pushes, and concurrent revisions. After explicit re-enablement, verify the agreed
schedule and exact-revision results. Keep that remote evidence deferred until then.

### Acceptance K-271

gspot works in any folder. Git adds the hooks, the changed-file runs, and the
history scans. Without git, every check that needs no history runs over the files the walk
finds.

`--staged` and `--changed` exit 2 with one sentence: this folder is no git
repository, so run `gspot check`. The secrets preset gains `secrets/gitleaks-files`, which runs
`gitleaks dir`, with `needs_git = false`, and the two history checks take `needs_git = true`.
`doctor` prints one line when a `.git` folder appeared after `init`, with the commands that add
the hooks and the presets that need git. A Mercurial, Perforce, or jj folder without `.git` is
this same mode, and the walk honors `.gitignore` and `.hgignore`.

A planted folder with no `.git` and a planted secret holds the finding, and
`gspot check --staged` there exits 2 with the sentence.

### Acceptance K-272

One stated behavior for each:

| Case                            | Behavior                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| no commit yet                   | `init` and `check` work; `--staged` compares with the empty tree                               |
| no remote, or no upstream       | `--changed` uses a resolvable default branch, or exits 2 asking for an explicit ref            |
| first push of a branch          | compare against fetched remote reachability; with no usable base, check the entire pushed tree |
| a deleted branch                | the push hook passes and runs nothing                                                          |
| a shallow clone                 | `--changed` says the history is cut, and names `git fetch --unshallow`                         |
| submodules                      | not read; `init` and `doctor` say so once, with the path of each                               |
| a linked worktree               | shares the hooks of its repository; `check` there says `Run: gspot install` once               |
| `gspot.toml` below the git root | checks run from the config root; the hook at the git root changes folder first                 |

`session.ts` holds two roots: the config root and the git root. Every path in the
report is relative to the config root. The hook resolves the config's repository-relative location from Git at runtime, with quoted arguments, rather than embedding a machine-specific absolute path. A push snapshot resolves the same relative config location inside the snapshot. Ref selection and snapshot semantics are owned by [10-hooks-ci-runners.md](10-hooks-ci-runners.md).

Exercise each distinct case in the central CLI integration and source acceptance suites.
Retain exact selected revisions, exits, findings, and preserved working-tree bytes; no dedicated
filename or fixed case count is required.

### Acceptance K-273

The managed `.gitattributes` block holds two lines: `.gspot/** linguist-generated`
and `.gspot/** text eol=lf`.

One more line in the block.

The Windows job of CI clones a planted repository with `autocrlf` on, and holds a
passing drift check.

### Acceptance K-275

`[hooks] tool` also takes `pre-commit` and `simple-git-hooks`, and `existing` reads a
lint-staged call.

For the pre-commit framework, gspot writes one `repo: local` hook into
`.pre-commit-config.yaml`, as a managed block, with `entry: gspot check --staged` and
`pass_filenames: false`. The takeover rows of the python manifest list the hooks of that file
that gspot replaces, such as ruff and black, under removal by hand. For lint-staged, the plan
proposes the gspot line in the husky hook, and lists the lint-staged entries that run a tool
gspot now runs. For `simple-git-hooks`, the line goes into its key of `package.json` after a yes,
as a task body does.

Three planted cases in `hooks.test.ts`, each with a commit that runs gspot once.

### Acceptance K-276

A job that passes on a fork, on a private repository, and in a merge queue.

`permissions` is `contents: read` for the workflow, and the upload step adds
`security-events: write` in a job of its own. That job uses `always() && !cancelled()` in addition to an event guard, so failed checks do not suppress their own report upload. It runs only on a push to the repository itself, and `[ci] sarif = false` turns it off. `on` gains `merge_group`. `cancel-in-progress` is
true for pull requests alone.

One setup step, `gspot install`, follows a cache keyed on
all actual managed lockfiles, tool pins, package-manager version, OS, and architecture. Select the base and target for each event, including `merge_group.base_sha` and `head_sha`; absent or zero bases require a full target-tree run. Upload stage-specific report artifacts after each check even on failure, including after the manual stage; never overwrite another stage's report.

The workflow snapshot, `zizmor` over it, and the planted CI case.

### Acceptance K-277

A job that shows findings in a merge request.

Every run but the message run writes three files under `.gspot/`: `report.json`,
`report.sarif`, and `report.codequality.json` in the CodeClimate form. The job sets `GIT_DEPTH: 0` and runs `gspot install`. Its `rules` select merge request
pipelines and the default branch, and it declares `.gspot/report.codequality.json` as the code quality artifact with `when: always`. Select the merge-request diff base or push-before SHA; missing or zero bases run the full target tree. The CI
system is found by `.gitlab-ci.yml` or `.github/workflows/`, never by the host name.

The snapshot of the file, and `glab ci lint` in the `manual` job.

### Acceptance K-278

gspot writes a file for GitHub and GitLab alone, and tells everybody else the three
lines.

With `--no-ci`, or where the CI files of another system are found, the plan ends with
the lines to paste: install gspot at the pinned version, `gspot install`, and
`gspot check`, with `.gspot/report.*` kept as artifacts. The guide shows them in the syntax of the four systems, and
`docs/samples` parses each command.

A planted `bitbucket-pipelines.yml` holds the three lines in the plan.

### Acceptance K-37

A hooks folder is `.githooks`, `.husky`, `.git-hooks`, or what `core.hooksPath`
names.

The name leaves the list. `existing-tooling.ts` reads `git config core.hooksPath`
first, and that answer wins over any folder name.

`takeover.test.ts` plants `hooks/use-thing.ts` and holds that the plan names no hooks.

### Acceptance K-45

A run of the `message` stage writes no report.

`execute.ts` calls `writeReport` only for a stage other than `message`.

`commits.test.ts` commits, then holds that the report still names the
earlier run. A rejected message check preserves both report formats byte for byte.

### Acceptance K-253

The workflow follows the rule file, and the task names preserve the developer’s existing task definitions.

`RUNNERS` holds `ubuntu-24.04`, `macos-15`, and `windows-2025`. The job gains
`timeout-minutes: 20` and a `concurrency` group on the ref. The task is `check` where the name is
free, and `gspot:check` where it is taken.

The workflow snapshot (T-36), and `zizmor` over it in the planted repository.

### Acceptance K-96

`--ci` takes `github` or `gitlab`, and the default follows the repository. For
GitLab gspot writes `.gitlab/ci/gspot.yml`, and the plan shows the one `include:` line for the
developer to add. gspot never edits `.gitlab-ci.yml`. A repository whose CI already runs a lint
job is told so and gets no second job.

Detection reads a `.gitlab-ci.yml` file or a GitLab remote, then a `.github/` folder or
a GitHub remote. The GitLab job runs `gspot install`, caches `.gspot/cache/`, and uploads a code quality report.
GitLab reads the CodeClimate format there and not SARIF, so every run writes that third
format beside the JSON and the SARIF file ([10-hooks-ci-runners.md](10-hooks-ci-runners.md), K-277).

A planted install with `--ci gitlab`, whose file `glab ci lint` accepts in the
`manual` job of CI.

Staged snapshots copy every required dependency tree before validating links across them. Workspace links must resolve inside the complete snapshot. Fixer previews own their isolated copies separately from Git revision materialization. CI remains paused under the sole status record.
