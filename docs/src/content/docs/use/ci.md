---
title: Continuous integration
description: Run checks in GitHub Actions, GitLab, or an existing pipeline.
---

`gspot init` plans a workflow for GitHub or GitLab. It picks the provider from `.github/workflows/` or `.gitlab-ci.yml`,
or else from an `origin` remote on github.com or gitlab.com.

init plans no workflow when a GitHub or GitLab CI file already has a lint job, such as a job that runs `eslint`,
`ruff check`, or `gspot check`, and it keeps that job. A Jenkins, CircleCI, Bitbucket, Azure Pipelines, or Buildkite
file does not stop it. If that pipeline runs gspot, turn the gspot workflow off:

```shell
gspot set ci.enabled false
```

## Turn CI on

To turn CI on later, run the first command. For GitLab, run the second one too:

```shell
gspot set ci.enabled true
gspot set ci.provider gitlab
```

`gspot set` writes the workflow file. For GitHub, gspot writes `.github/workflows/gspot.yml`. For GitLab, it writes
`.gitlab/ci/gspot.yml`. Include that file in your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

## What the job checks

The job checks the files changed after the pull or merge request base, or after the previous push. The first push of a
branch checks every file. On pushes to the default branch, a second job runs the manual checks that your configurations
select.

## Systems

On GitHub, the job runs on Linux. When the repository selects the `swift` configuration, the workflow also runs on
macOS. To add other systems:

```shell
gspot set ci.operating_systems linux macos windows
```

This setting works on GitHub only; gspot refuses it with `ci.provider = "gitlab"`. Pick only systems where your checks
can run.

## Install steps

Each GitHub job installs mise, then runs `gspot install` with the gspot version pinned in the generated workflow. The
GitLab job needs mise on the CI machine.

To prepare the project first, set one command. The job runs it before `gspot install` and stops if it fails:

```shell
gspot set ci.setup_command npm ci
```

gspot quotes each argument, so spaces, quotes, and `$` reach the command as plain text.

On GitHub, the install step gives mise the token of the job as `MISE_GITHUB_TOKEN`, so tool downloads skip the low rate
limit for anonymous requests. In other pipelines, set `MISE_GITHUB_TOKEN` yourself.

## Your own pipeline

Install mise and the runtime of your project. Then install your dependencies and run gspot the way your repository
starts it; see [Install gspot](/start/install/#choose-how-to-install). With npm:

```shell
npm ci
npm exec --no -- gspot install
npm exec --no -- gspot check
```

With mise:

```shell
mise exec -- gspot install
mise exec -- gspot check
```

Run manual checks by name, for example:

```shell
npm exec --no -- gspot check --only security/semgrep-registry
```

Let the pipeline fail on the gspot exit code: `1` means findings, and `2` means the run did not finish. A missing
program gives exit 2, and the report names it. `gspot check --json` prints the report as JSON.

Do not cache or upload `.gspot/state/` or credentials. To cache downloads and installed tools, key the cache on
`gspot.toml` and the files in `.gspot/`, as the GitHub job does.

## Turn CI off

Run `gspot set ci.enabled false`. gspot deletes the workflow file.
