---
title: CI
description: Run checks in GitHub Actions, GitLab, or an existing pipeline.
---

`gspot init` plans CI for the provider that it finds. A template sets its own CI choice, and a template without one leaves CI off. To turn CI on later, run `gspot set ci.enabled true`. For GitLab, also run `gspot set ci.provider gitlab`.
`gspot set` writes the workflow file.

For GitHub, gspot writes `.github/workflows/gspot.yml`. For GitLab, it writes `.gitlab/ci/gspot.yml`. Include that
file in your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The job checks the files changed after the pull or merge request base, or after the previous push. The first push of
a branch checks every file.

On GitHub, the job runs on Linux. To add other systems, run
`gspot set ci.operating_systems linux macos windows`. To replace a list you wrote, run `gspot unset ci.operating_systems` first. Pick only systems where your checks can run; for example,
Xcode checks need macOS. On pushes to the default branch, a separate job runs the manual checks your configurations select.

## Tools

Each GitHub job installs mise, then runs `gspot install` with the gspot version pinned in the generated workflow. The GitLab job
needs mise on the CI machine. To prepare the project first, set one command, for
example `gspot set ci.setup_command npm ci`. The job runs it before `gspot install` and stops if it fails. gspot
quotes each argument, so spaces, quotes, and `$` reach the command as plain text.

On GitHub, the install step gives mise the job's token as `MISE_GITHUB_TOKEN`, so tool downloads skip the low rate limit
for anonymous requests. In other pipelines, set `MISE_GITHUB_TOKEN` yourself.

If gspot finds an existing lint job or another CI provider, such as Jenkins or CircleCI,
`init` writes no workflow. Add the steps below to that pipeline.

## Your own pipeline

Install mise and your project's runtime. Then install your dependencies and run gspot with the start command your
repository uses. See [Install gspot](/start/install/). With npm:

```shell
npm ci
npm exec --no -- gspot install
npm exec --no -- gspot check
```

With mise, run `mise exec -- gspot install`, then `mise exec -- gspot check`.

Run manual checks by name, for example `npm exec --no -- gspot check --only security/semgrep-registry`. Let the pipeline fail on the gspot exit code: `1` means
findings, and `2` means the run did not finish. A missing program gives exit 2, and the report names it. `gspot
check --json` prints the report as JSON. Do not cache or upload `.gspot/state/`, installed tools, or credentials.

## Turn CI off

Run `gspot set ci.enabled false`.
