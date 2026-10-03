---
title: Hooks and CI
description: When the checks run, how the Git hooks run them, and the CI job gspot writes.
---

gspot runs the checks at three points: before a commit, before a push, and in CI. Each check
belongs to a stage, and each point runs the checks of its stage.

## Before a commit and before a push

The commit hook runs `gspot check --staged`. It checks what you staged, not the rest of your
working tree, and a finding stops the commit.

The push hook checks every commit you push. It reads the changed files of those commits and runs
the whole-project checks, such as type checks, for the projects they touch. A push can therefore
report a finding in a file you did not change, when that file belongs to a changed project.

## How the hooks run

The hooks are short scripts in `.gspot/hooks/`, and `gspot install` points Git at them. Run
`gspot install` after you clone the repository; `gspot doctor` reports whether this clone runs
the hooks. When the repository already runs hooks, such as Husky or Lefthook, gspot keeps them,
and `gspot install` prints the line to add to each one:

```text
pre-commit: npm exec --no -- gspot check --staged
```

`git commit --no-verify` and `git push --no-verify` skip the local hooks, and CI still runs. To
accept a finding for good, [record an ignore](/guides/customize/#record-one-exception) instead.

## Run one hook yourself

```bash
gspot check --hook commit
gspot check --hook push
```

Checks at the `manual` stage, such as CodeQL, run only when `--only` names them:

```bash
gspot check --only security/codeql
```

## The CI job

`gspot init --ci github` writes `.github/workflows/gspot.yml`. `gspot init --ci gitlab` writes
`.gitlab/ci/gspot.yml`; include it in your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The GitHub job checks pull requests, merge queues, and pushes, and on pushes to the default branch
it also runs the manual checks you selected. The GitLab job checks merge requests and the default
branch. The job checks what changed
after the comparison point, such as the pull request base; a
first push has no base, so the job checks the whole tree. To check the whole tree on every run,
run `gspot set ci.run all`.

With mise, the job installs the pinned tools. Without mise, install the package manager, uv for
Python tools, and the native tools on the runner.

## Keep your own pipeline

When init finds a lint job or Bitbucket Pipelines, it prints setup steps instead of writing a
second workflow. On your runner, install the pinned gspot version and the runtimes, then run
from the repository root:

```shell
gspot install
gspot check
gspot check --only security/codeql
```

Name each manual check you selected after `--only`, and keep the nonzero exit codes. For a
machine-readable result, run `gspot check --json`. Do not upload `.gspot/state/`, installed
dependencies, or credentials.
