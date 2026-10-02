---
slug: guides/hooks-and-ci
title: Hooks and CI
description: When the checks run, how the Git hooks run them, and the CI job gspot writes.
---

gspot runs the checks at three points: before a commit, before a push, and in CI. Each check
belongs to a stage, and each point runs the checks of its stage.

## Before a commit

The commit hook runs:

```bash
gspot check --staged
```

It checks what you staged, not the rest of your working tree. A finding stops the commit.

## Before a push

The push hook checks every commit you push. It reads the changed files of those commits, and
runs the whole-project checks, such as type checks, for the projects they touch. A push can
then report a finding in a file you did not change, when that file belongs to a changed project.
The push hook skips the contents of submodules.

## How the hooks run

gspot writes three short scripts to `.gspot/hooks/`: `pre-commit`, `commit-msg`, and `pre-push`.
Each one runs one gspot check. `gspot install` points Git at them:

```shell
git config core.hooksPath .gspot/hooks
```

Run `gspot install` after you clone the repository. `gspot doctor` reports whether this clone
runs the hooks.

When the repository already runs hooks, gspot keeps them. This covers another `core.hooksPath`,
a Husky or Lefthook setup, a pre-commit configuration, and scripts in `.git/hooks`. In that
case `gspot install` prints the line to add to each of your hooks, such as:

```text
pre-commit: npm exec --no -- gspot check --staged
```

## Skip a hook

`git commit --no-verify` and `git push --no-verify` skip the local hooks. CI still runs. To
accept a finding for good, record an ignore with a reason instead; see
[the policy file](/guides/customize/#record-one-exception).

## Run one hook yourself

```bash
gspot check --hook commit
gspot check --hook push
```

Checks at the `manual` stage, such as CodeQL, run only when you name them with `--only`:

```bash
gspot check --only security/codeql
```

gspot runs as many checks at once as the machine has processor cores. Set `GSPOT_JOBS` to a
smaller number when the tools compete for memory, as on a small CI runner:

```bash
GSPOT_JOBS=2 gspot check
```

## The CI job

`gspot init --ci github` writes `.github/workflows/gspot.yml`. `gspot init --ci gitlab` writes
`.gitlab/ci/gspot.yml`. For GitLab, include it in your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The GitHub job checks pull requests, merge queues, and pushes. On pushes to the default branch,
it also runs the manual checks. The GitLab job checks merge requests and the default branch.

The job checks what changed from the comparison point, such as the pull request base. A first
push has no base, so the job checks the whole tree. To check the whole tree on every run:

```sh
gspot set ci.run all
```

With mise, the job installs the pinned tools. Without mise, install the package manager, uv
for Python tools, and the native tools on the runner.

## Keep your own pipeline

When init finds a lint job or Bitbucket Pipelines, it prints setup steps instead of writing a
second workflow. On your runner, install the pinned gspot version and the runtimes, then run
from the repository root:

```shell
gspot install
gspot check
gspot check --only security/codeql
```

Name each manual check you selected after `--only`. Keep the nonzero exit codes. For a machine-readable result, run `gspot check --json`. Do not
upload `.gspot/state/`, installed dependencies, or credentials.
