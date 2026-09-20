# Hooks, CI, and Runners

This document decides where checks run: git hooks, the CI job, and the tasks of the runner.

## What runs when

`gspot check` is the truth, and the hooks are the fast path (D-122).

| When                         | What runs                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                | every check of the commit and push stages, over the whole repository           |
| the commit hook              | staged files, and the whole-project checks of a project a staged file sits in  |
| the push hook                | the exact pushed trees, selected from every local/remote ref pair              |
| `gspot check --stage manual` | the checks that build, test, or scan a whole project, or that need credentials |
| CI                           | what the change touches, or everything with `[ci] run = "all"`                 |

File-list checks narrow adoption noise, but affected whole-project checks report all findings (D-168). Existing errors can still block a change; gspot records no baseline (D-165). A
full run alone sees the world change, such as a new advisory, and `gspot doctor` prints the date
of the last full run. `[hooks] push = "all"` is for a team that wants the full run on push
(D-123).

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
two verdicts on two machines (D-102).

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

gspot goes where the hook already points (D-114). `init` reads what each hook calls and proposes
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

A repository with hooks keeps their behavior, arguments, input, and failure status (D-167). gspot
never sets `core.hooksPath`, because that setting turns every hook under `.git/hooks/` off: a
hook one developer wrote for one clone, and the hooks git-lfs installs (D-167). Where such a
local hook exists, `gspot install` installs the chain described below. Where a
husky hook calls lint-staged, the gspot line goes into the hook, and the plan lists the
lint-staged entries that run a tool gspot runs too. A
folder named `hooks` is no sign of git hooks: gspot asks `git config core.hooksPath` first.

A hook under `.git/hooks/` belongs to one clone. `gspot install` writes the gspot block of a clone, and
the developer runs it explicitly after cloning (D-115), and `doctor` asks git whether the hooks run in this clone. It names one of three
states, and ends with the setup command where the hooks exist and do not run.

The block gspot writes runs under the Bash 3.2 that macOS ships (D-85). In a new hook file it is
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
a check off on one machine (D-173). A hook never runs `--fix`.

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

Existing command names keep working (D-116). Where a `lint`, `format`, or `check` task exists,
the plan proposes a new body that calls gspot, and the developer accepts it. gspot writes a
`gspot:check` and a `gspot:fix` task only where the name is free. `[runner] tasks` holds the
names. Uninstall restores an old body only when its replacement is unchanged; otherwise it
preserves the developer edit and reports the recovery copy. gspot never creates or edits a
package lifecycle script, including `prepare`, and never injects a setup task.

The mise file has one place in every repository (D-127). gspot changes an existing task in `mise.toml` only when that exact replacement was accepted in the init plan. `init`
runs `mise trust` on its file before the install. The file pins gspot itself through the `github`
backend of mise, which is what `mise exec` and the hook find. A pin the repository already holds
for a tool is kept, and `doctor` reports a version below the floor of the preset.

The npm lint tools are no part of the runner. They install under `.gspot/`, from
`.gspot/package.json`, with the package manager the repository uses, under every runner (D-145).
A repository with no JavaScript takes bun or npm, whichever the machine has (D-171).

## CI

`--ci` takes `github` or `gitlab`, and the default follows the repository: its CI files first,
then the host of its remote (D-133). A repository whose CI already runs a lint job is told so
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
and `config-files/actions-pins` asks GitHub that each pinned commit exists. Drift of generated
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
same data (D-105). Its shape is part of `gspot.schema.json`. The report holds:

- the version, the stage, the start time, and the duration;
- each check with its status, file count, findings, and duration;
- the source files checked and unchecked;
- the ignores applied, and the suppressions by form.

Paths in the report are relative to the repository. The CI job uploads a SARIF file with
locations for the tools that give them.
