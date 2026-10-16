---
title: CI
description: Run checks in GitHub Actions, GitLab, or an existing pipeline.
---

`gspot init` proposes CI from the provider it finds. A template supplies its CI choice; when the template leaves CI out, it stays off. To turn CI on later, run `gspot set ci.enabled true`. For GitLab, also run `gspot set ci.provider gitlab`.
`gspot set` writes the workflow file.

For GitHub, gspot writes `.github/workflows/gspot.yml`. For GitLab, it writes `.gitlab/ci/gspot.yml`. Include that
file in your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The job checks the files changed after the pull or merge request base, or after the previous push. The first push of
a branch checks every file.

On GitHub, the job runs on Linux. To add other operating systems, run
`gspot set ci.operating_systems linux macos windows`. To replace a list you wrote, run `gspot unset ci.operating_systems` first. Pick only systems where your checks can run; for example,
Xcode checks need macOS. On pushes to the default branch, a separate job runs the manual checks your configurations select.

## Tools

Each GitHub job installs mise, runs the npm version pinned in the generated workflow, and gspot installs its tools. The GitLab job
expects mise on the CI machine. To prepare the project before gspot installs its tools, set one command, for
example `gspot set ci.setup_command npm ci`. The job runs it before `gspot install` and stops if it fails. gspot
quotes each argument, so spaces, quotes, and `$` reach the command as plain text.

If gspot finds an existing lint job, or Bitbucket Pipelines, Jenkins, CircleCI, Azure Pipelines, or Buildkite,
`init` writes no workflow. Add the steps of "Your own pipeline" to that pipeline.

## Your own pipeline

Install mise and your project's runtime. Then install your dependencies and run gspot with the start command your
repository uses. See [Install gspot](/start/install/). With npm:

```shell
npm ci
npm exec --no -- gspot install
npm exec --no -- gspot check
```

With mise, run `mise exec -- gspot install`, then `mise exec -- gspot check`.

Run manual checks by name, for example `npm exec --no -- gspot check --only security/semgrep-registry`. Keep the exit code of gspot: `1` means
findings, and `2` means the run did not finish; a missing program gives exit 2, and the report names it. `gspot
check --json` prints the report as JSON. Do not cache or upload `.gspot/state/`, installed tools, or credentials.

## Turn CI off

Run `gspot set ci.enabled false`.
