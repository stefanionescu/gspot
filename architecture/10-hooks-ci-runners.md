# Hooks, CI, and Runners

This document decides where checks run: git hooks, the CI job, and the tasks of the runner.

## What runs when

`gspot check` is the truth, and the hooks are the fast path (D-122).

| When                             | What runs                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `gspot check`                    | every check of the commit and push stages, over the whole repository           |
| the commit hook                  | staged files, and the whole-project checks of a project a staged file sits in  |
| the push hook                    | the commits being pushed, by the same rule, against the upstream branch        |
| `gspot check --stage manual`, CI | the checks that build, test, or scan a whole project, or that need credentials |

Checking only what changed keeps the whole repository clean, because `init` holds every old
finding. After that a new finding comes from a changed file or from a whole-project check. A
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
4. Holds the count of each staged file: it does not grow for a held rule.
5. Fails when a `.env*` file is staged, unless it is a template.

Staged mode reads the working-tree content of each staged path, not the staged blob. No stash
happens. When a staged file also has unstaged changes, the output says
`checked working tree; N files have unstaged changes`.

## The push hook

The push hook checks the commits being pushed. Git gives it the local and the remote id. With a
clean tree it checks in place, over the files that differ from the remote id. With a dirty tree
it adds a detached worktree of the local id in the cache folder of the platform, checks there,
and removes it (D-152). Uncommitted work in unrelated files never refuses a push.

## Hooks

gspot goes where the hook already points (D-114). `init` reads what each hook calls and proposes
the gspot line in a fixed order. The task the hook calls comes first, then the hook file, then
hooks of its own where none exist.

| `[hooks] tool` | gspot writes                                                                  | Proposed when                  |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| `existing`     | one managed block in the task or the hook file that git already runs          | the repository has hooks       |
| `husky`        | one line in each `.husky/` hook                                               | `.husky/` exists               |
| `lefthook`     | a `gspot` block in `lefthook.yml`                                             | `lefthook.yml` exists          |
| `gspot`        | `.gspot/hooks/pre-commit`, `pre-push`, and `commit-msg`, and `core.hooksPath` | no hooks exist                 |
| no table       | nothing                                                                       | the person passes `--no-hooks` |

A repository with hooks keeps them, and lines of a task that are no lint stay (D-101). gspot
sets `core.hooksPath` only where it owns the hooks, and never where a tracked file sets it. A
folder named `hooks` is no sign of git hooks: gspot asks `git config core.hooksPath` first.

`core.hooksPath` is one setting of one clone. The setup entry of the repository installs the
hooks (D-115), and `doctor` asks git whether the hooks run in this clone. It names one of three
states, and ends with the setup command where the hooks exist and do not run.

The hook of gspot runs under the Bash 3.2 that macOS ships (D-85):

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
needs no environment variable. `GSPOT_HOOK` tells the reporter to end a failing run with two
lines: the command that reproduces it, and `git commit --no-verify` as the way past it.

The pre-push hook calls `git lfs pre-push` first where git-lfs is installed. On Windows, git runs
hooks through the Bash that Git for Windows installs, and gspot marks them executable through
`git update-index --chmod=+x`.

Skips: `gspot.local.toml` for a tool this machine lacks, and `--skip` for one run. Both print. No
environment variable turns a hook off. A hook never runs `--fix`.

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

## CI

`--ci` takes `github` or `gitlab`, and the default follows the repository: its CI files first,
then the host of its remote (D-133). A repository whose CI already runs a lint job is told so
and gets no second job.

For GitHub, gspot writes `.github/workflows/gspot.yml`:

```yaml
name: gspot
on: [push, pull_request]
concurrency:
    group: gspot-${{ github.ref }}
    cancel-in-progress: true
jobs:
    check:
        runs-on: ubuntu-24.04
        timeout-minutes: 20
        steps:
            - uses: actions/checkout@<pinned sha>
              with: { fetch-depth: 0, persist-credentials: false }
            - uses: jdx/mise-action@<pinned sha>
            - run: mise install
            - run: gspot check --report gspot.json
            - run: gspot check --stage manual
              if: github.event_name == 'push' && github.ref_name == github.event.repository.default_branch
            - uses: github/codeql-action/upload-sarif@<pinned sha>
              if: always()
              with: { sarif_file: .gspot/report.sarif }
```

The job follows `GITHUB-ACTIONS.md`, the rule file gspot installs: a pinned runner image, a
timeout, and a concurrency group. The findings print to the log, and the JSON report is written
beside them. A macOS job appears only where a Swift scope exists. Actions are pinned by commit,
and `config-files/actions-pins` asks GitHub that each pinned commit exists. Drift of generated
files is the check `integrity/generated-drift` inside `gspot check`, so the job runs no `apply`.

For GitLab, gspot writes `.gitlab/ci/gspot.yml` with one job, and the plan shows the line that
includes it. gspot never edits `.gitlab-ci.yml`.

```yaml
include:
    - local: .gitlab/ci/gspot.yml
```

Without mise, the job installs gspot from the release asset by version and runs `gspot doctor`
first. It downloads `checksums.txt` from the same release and stops when the SHA-256 differs. One
table in the code holds the five targets, with the `uname` pair of each:

| Runner          | Asset                   |
| --------------- | ----------------------- |
| Linux, x86_64   | `gspot-linux-x64`       |
| Linux, aarch64  | `gspot-linux-arm64`     |
| macOS, arm64    | `gspot-darwin-arm64`    |
| macOS, x86_64   | `gspot-darwin-x64`      |
| Windows, x86_64 | `gspot-windows-x64.exe` |

## Reproduce lines

Every failing check prints the command that runs it alone:
`gspot check typescript/eslint --scope api`. The line is the same in the hook, in CI, and in the
terminal.

## The report

Every run but the message run writes `.gspot/report.json`, and `gspot check --json` prints the
same data (D-105). Its shape is part of `gspot.schema.json`. The report holds:

- the version, the stage, the start time, and the duration;
- each check with its status, file count, findings, and duration;
- the source files checked and unchecked;
- the ignores applied, the held counts, and the suppressions by form.

Paths in the report are relative to the repository. The CI job uploads a SARIF file with
locations for the tools that give them.
