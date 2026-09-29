# Hooks, CI, and Runners

This document decides where checks run: git hooks, the CI job, and the tasks of the runner.

## What runs when

`gspot check` is the truth, and the hooks are the fast path.

| When                         | What runs                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                | every check of the commit and push stages, over the whole repository           |
| the commit hook              | staged files, and the whole-project checks of a project a staged file sits in  |
| the push hook                | the exact pushed trees, selected from every local/remote ref pair              |
| `gspot check --stage manual` | the checks that build, test, or scan a whole project, or that need credentials |
| CI                           | what the change touches, or everything with `[ci] run = "all"`                 |

File-list checks narrow adoption noise, but affected whole-project checks report all findings.
Existing errors can still block a change; gspot records no baseline. A full run alone sees the
world change, such as a new advisory, and `gspot doctor` prints the date of the last full run.
`[hooks] push = "all"` is for a team that wants the full run on push.

## Stages

Every check declares one stage.

| Stage     | Holds                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `commit`  | a check that takes the staged files, or that ends within five seconds on the planted repository of its kit                   |
| `push`    | a check that reads a whole scope: type checkers, dead code, dependency audits, link checks                                   |
| `manual`  | a check that builds, tests, or scans a whole project: the Swift build and analyzer, Periphery, coverage, CodeQL, image scans |
| `message` | commitlint                                                                                                                   |

A release test measures the commit stage and fails a check over the ceiling that takes no file
list. No hook has a time budget that skips checks, because a gate that skips by the clock gives
two verdicts on two machines. A check requires nothing, or one of `build`, `docker`,
`database`, and `network`; a requirement puts the check in `push` at least. A `docker`
requirement with no daemon fails. A check that waits for a setting prints `skipped` and names
the setting.

## Revision selection and changed files

A file-list check receives the changed source paths. A project-wide check runs when any
changed, renamed, or deleted path affects its inputs, including config, and lockfiles.
Dependent scopes follow reverse project references. When impact is uncertain, the broader set
runs.

Once triggered, the check reports all findings, including errors in unchanged callers and
findings without locations. Missing tools, failed parsers, and tool crashes remain failures. A
cache stores the complete result with the full project inputs and revision identity, never a
path-filtered verdict.

`gspot check --staged` reads the index, with staged deletions, and both sides of renames.
Checks run over an isolated snapshot of the index, so unstaged edits neither repair nor break
the commit verdict. An unborn branch compares with the empty tree. No stash or working-tree
checkout occurs, and hooks never run fixers.

Interactive `gspot check --changed[=<ref>]` compares the working tree with the merge base of
the resolved ref and HEAD, includes tracked working changes, and labels that content source.
With neither an upstream nor a default branch it asks for an explicit ref and exits 2.

## The push hook

The hook calls the hidden `gspot check --push` entry point. It reads every
`local-ref local-object remote-ref remote-object` row from stdin, as specified by
[Git pre-push](https://git-scm.com/docs/githooks#_pre_push). Both object IDs belong to the
contract; HEAD never stands in for the local object. The input is buffered once for hook
chaining.

For an existing remote ref, the old object is compared directly with the pushed local object.
For a new ref, the commits reachable from that local object but from no fetched ref of the
destination remote select the union of paths they changed. With no usable fetched
reachability, the full local tree is checked. A deleted ref runs no source check. Tags resolve
to commits, non-commit objects are reported as not applicable, and refs are processed
independently with identical local trees deduplicated. Missing required objects are a clear
setup failure, never an empty diff.

The exact local commit is checked in an isolated snapshot; the real working tree is never
stashed or mutated. Configuration is resolved from that snapshot and its version pin validated.
The tools run from the working tree's installed environment when its manifests and locks
match the snapshot; otherwise the check fails with the command to prepare the required
version. Supported tool commands direct all output into scratch space; custom commands remain
trusted repository code. A project-wide check sees all its snapshot inputs, and all its findings affect the verdict,
so existing errors can block a push. The choices are to fix them, configure an ignore, or
bypass the local hook, and CI still judges the submitted tree.

## Hooks

gspot goes where the hook already points. `init` reads what each hook calls and proposes the
gspot line in a fixed order. The task the hook calls comes first, then the hook file, then
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
never sets `core.hooksPath`, because that setting turns every hook under `.git/hooks/` off,
including the hooks git-lfs installs. Where a husky hook calls lint-staged, the gspot line goes
into the hook, and the plan lists the lint-staged entries that run a tool gspot runs too. A
folder named `hooks` is no sign of git hooks: gspot asks `git config core.hooksPath` first.

A hook under `.git/hooks/` belongs to one clone. `gspot install` writes the gspot block of a
clone, the developer runs it explicitly after cloning, and `doctor` asks git whether the hooks
run in this clone.

Every hook tool gets the same dispatcher script, rendered from one template by one function,
under the Bash 3.2 that macOS ships. Its data per tool is the native command, whether the stage reads a result file, and how the
message path arrives. The script exports one environment family: `GSPOT_HOOK_RESULT`,
`GSPOT_HOOK_INPUT`, `GSPOT_HOOK_MESSAGE`, `GSPOT_HOOK_REMOTE_NAME`,
`GSPOT_HOOK_REMOTE_LOCATION`, and `GSPOT_HOOK_ROOT`. The reporter reads them to end a failing
hook run with two lines: the command that reproduces it, and `git commit --no-verify` as the
way past it. A unit test renders every dispatcher for
every tool and stage and runs `sh -n` on it. Lefthook lines use `echo`, never `printf "%s\n"`,
because the YAML writer turns `\n` into a line break that Lefthook on Windows splits.

`init` writes how the binary is found into the line. Under mise it is `mise exec -- gspot`.
Under an npm runner it is a package-manager local-exec form that cannot download a missing
package. Without a runner it is a PATH-resolved pinned binary. Each finds the version the repository pins, and a
hook that cannot find gspot prints the install command and fails. The line asks the developer
for no environment variable.

On Windows, git runs hooks through the Bash that Git for Windows installs. The generated
`.gitattributes` block declares `text eol=lf` for every gspot-owned path, so a CRLF checkout
does not mark them, and gspot marks tracked hooks executable through
`git update-index --chmod=+x`; clone-local hooks use filesystem permissions.

One skip exists: `--skip` for one run, and it prints. No file and no environment variable turns
a check off on one machine. A hook never runs `--fix`.

### Hook chaining

A hook manager's supported composition mechanism comes first. A recognized tracked task can
receive a managed gspot invocation only where its control flow reaches it and its non-lint
behavior remains intact. A hook body is not assumed to be shell merely because it is
executable.

For an unmanaged local hook, the original is preserved as an executable sibling in the
Git-resolved hooks directory and a marked dispatcher is installed. It runs the original as a
subprocess, then gspot, with the same arguments, working directory, and environment. A nonzero
original status stops the chain and is preserved, and a successful `exec` or `exit` in the
original cannot skip gspot. For pre-push, the buffered stdin is replayed to both commands.
Installing twice produces one chain. Recovery stores the original path, bytes, mode, and
installed dispatcher hash, and an existing sibling collision is rejected rather than
overwritten.

The init plan describes the dispatcher and retained original; an unsupported hook manager or
unapproved replacement leaves the hook intact and reports the explicit installation step. Git
LFS, non-shell hooks, spaces in paths, linked worktrees, and `core.hooksPath` are integration
cases. Uninstall restores only an unchanged dispatcher and leaves edited originals intact.

## Tasks of the runner

Every task calls gspot, and the order of checks lives in gspot.

| `[runner] tool`              | gspot writes                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `mise`                       | `.mise/conf.d/gspot-tools.toml` with the tool pins, and the tasks below |
| `npm`, `pnpm`, `yarn`, `bun` | the `gspot` launcher in `devDependencies`, and the scripts below        |
| no table                     | nothing                                                                 |

Existing command names keep working. Where a `lint`, `format`, or `check` task exists, the plan
proposes a new body that calls gspot, and the developer accepts it. gspot writes a
`gspot:check` and a `gspot:fix` task only where the name is free, and `[runner] tasks` holds
the names. Uninstall restores an old body only when its replacement is unchanged. gspot never
creates or edits a package lifecycle script, including `prepare`, and never injects a setup
task.

The mise file has one place in every repository, and gspot changes an existing task in
`mise.toml` only when that exact replacement was accepted in the init plan. `init` runs
`mise trust` on its file before the install. The file pins gspot itself through the `github`
backend of mise, which is what `mise exec` and the hook find. Every tool a kit pins is written
into that file by gspot, and `mise.toml` keeps the runtimes; `doctor` reports a version below
the floor of the kit.

The npm lint tools are no part of the runner. They install under `.gspot/`, from
`.gspot/package.json`, with the package manager the repository uses, under every runner. A
repository with no JavaScript takes bun or npm, whichever the machine has.

## CI

`--ci` takes `github` or `gitlab`, and the default follows the repository: its CI files first,
then the host of its remote. A repository whose CI already runs a lint job is told so and gets
no second job.

For GitHub, gspot writes `.github/workflows/gspot.yml` with verified action commit pins, and
`files/actions-pins` asks GitHub that each pinned commit exists. The workflow:

- triggers on `pull_request`, `merge_group`, and `push`, and selects the base from
  `pull_request.base.sha`, `merge_group.base_sha`, or `before`;
- treats an absent or all-zero base as a full check of the target tree, and fetches missing
  history explicitly or fails;
- passes a validated base through an environment variable, never interpolated shell code;
- runs `gspot install` from tracked locks, then the commit and push checks, with manual checks
  in a separate job on default-branch pushes that has its own setup and report artifact;
- uploads each job's reports after its check, including a failed check, with an always-run
  artifact step whose names include stage and platform;
- runs code scanning after the producing jobs under `always() && !cancelled()`, limited to
  pushes in the repository;
- downloads only artifacts that exist, uploads each SARIF under a distinct category, and
  reports an absent report rather than an empty scan;
- keeps `contents: read` everywhere but the code-scanning job, which has
  `security-events: write`, and which `[ci] sarif = false` leaves out;
- caches installations by operating system, architecture, package-manager version, selected
  lockfiles, and tool pins, without replacing locked-install validation;
- uses a pinned runner image, an explicit timeout, and a concurrency group that cancels
  superseded pull-request runs alone. A macOS job appears only where a Swift scope exists.

Drift of generated files is the check `integrity/generated-drift` inside `gspot check`, so the
job runs no `apply`. Workflow tests cover failed checks with reports, missing reports, forks,
merge queues, first pushes, and separate manual artifacts.

For GitLab, gspot writes `.gitlab/ci/gspot.yml` with one job, and the plan shows the `include`
line for it. gspot never edits `.gitlab-ci.yml`. The job sets `GIT_DEPTH: 0`, runs for merge
requests and the default branch, and declares `.gspot/reports/report.codequality.json`, the
CodeClimate format GitLab reads.

The CI system is found by its files, `.github/workflows/` or `.gitlab-ci.yml`, and never by a
host name, so a self-hosted host works. For every other system gspot writes no file; the plan
prints the lines to paste: install gspot at the pinned version, `gspot install`, and
`gspot check`, keeping `.gspot/reports/report.*` as artifacts.

Without mise, the job installs gspot from the release asset by version and runs `gspot doctor`
first. It downloads `checksums.txt` from the same release and stops when the SHA-256 differs.
One table in the code holds the targets, with the `uname` pair of each: `gspot-linux-x64`,
`gspot-linux-arm64`, `gspot-darwin-arm64`, `gspot-darwin-x64`, and `gspot-windows-x64.exe`.

## Reproduce lines and the report

Every failing check prints the command that runs it alone:
`gspot check api --only typescript/eslint`. The line is the same in the hook, in CI, and in the
terminal.

Every run but the message run writes `.gspot/reports/report.json`, and `gspot check --json`
prints the same data. Its shape is part of `gspot.schema.json`. The report holds the version,
the stage, the start time, and the duration. It holds each check with its status, file count,
findings, and duration. It holds the source files checked and unchecked, the ignores applied,
and the suppressions by form.

Paths in the report are relative to the repository. The CI job uploads a SARIF file with
locations for the tools that give them.
