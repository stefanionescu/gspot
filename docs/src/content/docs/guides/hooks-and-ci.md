---
title: Use hooks and CI
description: Understand staged and pushed-content checks, retained hooks, and CI reports.
---

Start with an initialized repository. Its `gspot.toml` records the selected hook integration
and CI provider. Read the initialization plan before adding either to an existing setup.

## Commit and push

The commit hook checks staged content, including the staged policy. Unstaged edits do not
silently replace that content. Resolve index conflicts before checking. Run it yourself with:

```bash
gspot check --staged
```

Push checks use the objects Git supplies to the hook. They can inspect multiple pushed
references. Changed-path selection can trigger project-wide checks, which can report defects
in unchanged files within an affected project.

Existing hooks remain part of the chain. Hook arguments and stdin are forwarded to retained
hooks. A retained hook failure still rejects the operation. See
[adoption and restoration](/guides/existing-repository/) before replacing hook-manager setup.

`git commit --no-verify` and `git push --no-verify` bypass local hooks. They do not disable
CI or server policy. Correct the defect or record a scoped exception with a reason.

## Choose a stage manually

```bash
gspot check --stage commit
gspot check --stage push
gspot check --stage manual
```

A manual-stage check does not run merely because initialization completed. Use the
[check reference](/reference/commands/check/) for selectors and
[check definitions](/reference/engines/) for execution behavior.

## Generated CI

Select GitHub or GitLab in the initialization plan, or configure the provider and apply:

```toml
[ci]
provider = "github"
run = "changed"
```

```bash
gspot apply
```

Review the generated workflow and tool locks before committing them. GitHub generation includes
check and manual jobs; the manual job runs on default-branch pushes. GitLab generation provides
an include for the existing pipeline. Existing application jobs are retained.

Reports are written to `.gspot/report.json`, `.gspot/report.sarif`, and
`.gspot/report.codequality.json`. A check failure remains a failure when a report cannot be
written. Read setup failures and missing-artifact notices; an absent report is not a pass.

The gspot source repository uses a separate authored CI workflow and a paused execution policy.
Its [contributor cadence](/guides/build/#repository-acceptance) does not change generated
consumer workflows.
