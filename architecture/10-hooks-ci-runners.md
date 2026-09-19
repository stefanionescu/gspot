# Hooks, CI, and Runners

This document decides where checks run: git hooks, the CI job, and the tasks of the runner.

## What runs when

`gspot check` is the truth, and the hooks are the fast path (D-122).

| When                         | What runs                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                | every check of the commit and push stages, over the whole repository           |
| the commit hook              | staged files, and the whole-project checks of a project a staged file sits in  |
| the push hook                | the commits being pushed, by the same rule, against the upstream branch        |
| `gspot check --stage manual` | the checks that build, test, or scan a whole project, or that need credentials |
| CI                           | what the change touches, or everything with `[ci] run = "all"`                 |

Checking only what a change touches is how an old repository adopts gspot, because gspot records
no old findings (D-165). A file is judged when somebody changes it. A
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

## Staged mode

`gspot check --staged`:

1. Reads `git diff --cached --name-only --diff-filter=ACMRT`.
2. Runs the commit-stage checks over the staged files that each check claims.
3. Runs a commit-stage project check when a staged file is in its scope, or when `gspot.toml` or
   a generated file is staged.
4. Fails when a `.env*` file is staged, unless it is a template.

Staged mode reads the working-tree content of each staged path, not the staged blob. No stash
happens. When a staged file also has unstaged changes, the output says
`checked working tree; N files have unstaged changes`.

## The push hook

The push hook checks the files of the commits being pushed. Git gives it the local and the remote
id, and the hook runs `gspot check --changed=<remote id>` over the files that differ, in place. A file with uncommitted
work outside that list is not read, so it never refuses a push. Where a pushed file also has
uncommitted changes, the output says so, as staged mode does.

A run over changed files reports findings in those files alone (D-168). A type checker still
reads its whole project, and gspot keeps the findings of the files the change touches. One line
counts the rest.

## Hooks

gspot goes where the hook already points (D-114). `init` reads what each hook calls and proposes
the gspot line in a fixed order. The task the hook calls comes first, then the hook file, then
hooks of its own where none exist.

| `[hooks] tool`     | gspot writes                                                                            | Proposed when                     |
| ------------------ | --------------------------------------------------------------------------------------- | --------------------------------- |
| `existing`         | one managed block in the task or the hook file that git already runs                    | the repository has hooks          |
| `husky`            | one line in each `.husky/` hook                                                         | `.husky/` exists                  |
| `lefthook`         | a `gspot` block in `lefthook.yml`                                                       | `lefthook.yml` exists             |
| `pre-commit`       | one `repo: local` hook in `.pre-commit-config.yaml`, as a managed block                 | that file exists                  |
| `simple-git-hooks` | the gspot line in its key of `package.json`, after a yes                                | that key exists                   |
| `gspot`            | one managed block in `.git/hooks/pre-commit` and `pre-push`, written by `gspot install` | no hook tool and no tracked hooks |
| no table           | nothing                                                                                 | the person passes `--no-hooks`    |

A repository with hooks keeps them, and lines of a task that are no lint stay (D-101). gspot
never sets `core.hooksPath`, because that setting turns every hook under `.git/hooks/` off: a
hook one developer wrote for one clone, and the hooks git-lfs installs (D-167). Where such a
local hook exists, `gspot install` adds its block at the end of that file. Where a
husky hook calls lint-staged, the gspot line goes into the hook, and the plan lists the
lint-staged entries that run a tool gspot runs too. A
folder named `hooks` is no sign of git hooks: gspot asks `git config core.hooksPath` first.

A hook under `.git/hooks/` belongs to one clone. `gspot install` writes the gspot block of a clone, and
the setup entry of the repository calls it (D-115, D-156), and `doctor` asks git whether the hooks run in this clone. It names one of three
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

`init` writes how the binary is found into the line: `mise exec -- gspot` under mise, `bunx gspot`
or `npx gspot` under an npm runner, and the absolute path otherwise. Each finds the version the
repository pins. A hook that cannot find gspot prints the install command and fails. The line
asks the developer for no environment variable. The line itself sets `GSPOT_HOOK`, which tells
the reporter to end a failing run with two
lines: the command that reproduces it, and `git commit --no-verify` as the way past it.

On Windows, git runs
hooks through the Bash that Git for Windows installs, and gspot marks them executable through
`git update-index --chmod=+x`.

One skip exists: `--skip` for one run, and it prints. No file and no environment variable turns
a check off on one machine (D-173). A hook never runs `--fix`.

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
names, and `uninstall` puts back the body it replaced. gspot never writes a `prepare` script.

The mise file has one place in every repository (D-127). gspot never edits `mise.toml`. `init`
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

For GitHub, gspot writes `.github/workflows/gspot.yml`:

```yaml
name: gspot
on:
    push:
    pull_request:
    merge_group:
permissions:
    contents: read
concurrency:
    group: gspot-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
jobs:
    check:
        runs-on: ubuntu-24.04
        timeout-minutes: 20
        steps:
            - uses: actions/checkout@<pinned sha>
              with: { fetch-depth: 0, persist-credentials: false }
            - uses: jdx/mise-action@<pinned sha>
            - uses: actions/cache@<pinned sha>
              with:
                  path: |
                      .gspot/node_modules
                      .gspot/.venv
                  key: gspot-${{ runner.os }}-${{ hashFiles('.gspot/*.lock', '.mise/conf.d/gspot-tools.toml') }}
            - run: gspot install
            - run: gspot check --changed=${{ github.event.pull_request.base.sha || github.event.before }}
              # or plain gspot check, with [ci] run = "all"
            - uses: actions/upload-artifact@<pinned sha>
              if: always()
              with: { name: gspot-report, path: .gspot/report.* }
            - run: gspot check --stage manual
              if: github.event_name == 'push' && github.ref_name == github.event.repository.default_branch
    code-scanning:
        if: github.event_name == 'push' # never on a pull request from a fork
        needs: check
        permissions: { contents: read, security-events: write }
        runs-on: ubuntu-24.04
        timeout-minutes: 5
        steps: [download the report, github/codeql-action/upload-sarif@<pinned sha>]
```

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
requests and the default branch, and declares `gl-code-quality-report.json`. GitLab reads the
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
