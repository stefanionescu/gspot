---
title: CI
description: Run checks in GitHub Actions, GitLab, or an existing pipeline.
---

Choose CI during initialization:

```shell
gspot init --ci github
gspot init --ci gitlab
```

GitHub receives `.github/workflows/gspot.yml`. GitLab receives `.gitlab/ci/gspot.yml`; include it in your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The jobs check files changed after the pull or merge request base, or after the previous push. A first push without a base checks the whole tree. To check every file on every run:

```shell
gspot set ci.files all
```

GitHub can run operating-system jobs selected with `ci.platforms`:

```shell
gspot set ci.platforms linux macos windows --replace
```

Select platforms that support the applicable checks. Manual checks run separately when selected by the generated job.

## Tool setup

The generated mise job installs the committed tool pins. Without mise, native tools and any Python runtime requirements need explicit setup on your runner. Use your own pipeline when those prerequisites are not supplied by the generated job.

When initialization detects an existing lint job or Bitbucket Pipelines, it prints integration steps instead of creating a second pipeline. Preserve your existing job and add gspot after its tool setup.

## Your own pipeline

Install project dependencies and the native and Python requirements reported by `doctor`. On a POSIX shell:

```shell
npm install --global "@gspothq/cli@$(cat .gspot/version)"
gspot install
gspot doctor
gspot check
gspot check --only security/codeql
```

Name only manual checks your policy selects. Preserve nonzero exit codes. `gspot check --json` writes a machine-readable report. Do not save `.gspot/state/`, installed dependencies, or credentials as CI artifacts or caches.
