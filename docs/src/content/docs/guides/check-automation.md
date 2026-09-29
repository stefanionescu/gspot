---
slug: guides/hooks-and-ci
title: Hooks and CI
description: Understand staged and pushed-content checks, retained hooks, and CI reports.
---

Run commands from the initialized repository root with the [CLI available](/guides/install/).
`gspot.toml` records the selected hook integration and CI provider. Read the initialization
plan before adding either to an existing setup.

## Commit and push

The commit hook checks staged content, including the staged policy; unstaged edits do not
replace it. Run it yourself:

```bash
gspot check --staged
```

Push checks use the objects Git supplies to the hook and can inspect several pushed
references. Changed-path selection can trigger project-wide checks, which can report defects
in unchanged files of an affected project. Submodule contents are excluded, and staged and
pushed snapshots keep the submodule references without reading them. Python tools run from the
working tree's installed environment against the snapshot, so its manifests and locks must
match the selected revision.

Existing hooks remain part of the chain, receive their arguments and stdin, and a failure of
theirs still rejects the operation. `git commit --no-verify` and `git push --no-verify`
bypass local hooks, not CI or server policy: correct the defect or record a scoped exception
with a reason. If installation reports a differing native hook, keep its authored changes in
the hook manager configuration, regenerate the native hooks, and run `gspot install` again.

## Select a hook tool

Every integration is two commands, run from the Git root after installing the tool's own
dependency where it has one:

```shell
gspot set hooks.tool lefthook
gspot install
```

The tool is one of `gspot`, `husky`, `lefthook`, `pre-commit`, or `simple-git-hooks`.

Run `gspot install` after cloning, after changing the runner, and after updating the hook
tool. `gspot doctor` reports whether the installed hooks match the policy. `gspot uninstall`
restores unchanged owned hooks and managed blocks and keeps authored commands.

- `gspot` writes the built-in Git hooks. Existing local hook commands stay in the chain.
- `husky` (version 9) adds a managed invocation to each commit, push, and message script under
  `.husky/`, and keeps `core.hooksPath` and package lifecycle scripts, including `prepare`.
- `lefthook` (2.0.13 or newer) owns its three commands and `no_auto_install` in `lefthook.yml`
  or `.lefthook.yml`; authored commands and inherited settings stay active.
- `pre-commit` adds one local `gspot` hook to `.pre-commit-config.yaml` that runs the staged
  check once, without individual filenames. Rename an authored hook named `gspot` first, and
  stage the framework configuration before a commit. Findings exit `1`, setup failures `2`.
- `simple-git-hooks` keeps each existing package hook command and runs it before its check.
  Move commands from a separate `simple-git-hooks.*` file into the package field first.

In every integration the authored hooks run first with the original Git arguments. A failure
of theirs stops the chain, an early successful `exit` or `exec` still runs gspot, and push
input is replayed to both. Installation prepares the native runtime in a temporary repository
and publishes the chain at the resolved Git hook location without changing `core.hooksPath`.

## Choose a stage manually

```bash
gspot check --stage commit
gspot check --stage push
gspot check --stage manual
```

A manual-stage check runs only when asked. The [check reference](/reference/commands/check/)
lists the selectors.

## Generated CI

Select a provider with `gspot init --ci github` or `gspot init --ci gitlab`. Existing CI files
decide the default before the remote hostname, and an authored lint job the plan finds gets no
duplicate.

For GitLab, gspot writes `.gitlab/ci/gspot.yml`. Add its include to your pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The job runs for merge requests and the default branch and retains the JSON, SARIF, and
[Code Quality](https://docs.gitlab.com/ci/testing/code_quality/) reports after a failed check.

For GitHub, the workflow checks pull requests, merge queues, and pushed commits. It runs
manual checks in separate jobs on default-branch pushes and retains each stage's and
platform's reports. A separate code-scanning job uploads the SARIF reports after pushes:

```sh
gspot set ci.sarif false   # when the repository does not use code scanning
gspot set ci.run all       # to check the full tree on every run
```

CI checks changes relative to the event base; an absent base on a first push checks the full
tree, and an invalid comparison object fails the job. CI installs tracked tool locks before
checking. The mise integration provisions its pinned tools; without mise, provision the
package manager, uv when Python tools are selected, and the required native tools on the
runner.

## Keep an existing pipeline

When initialization detects an existing lint job or Bitbucket Pipelines, it prints setup
instructions instead of a competing workflow. Provision the pinned gspot version and required
runtimes on that runner, then run from the repository root, keeping nonzero exit codes:

```shell
gspot install
gspot check
gspot check --stage manual
```

Upload `.gspot/reports/report.*` after success or failure, under a separate artifact name per
stage and platform. Never upload `.gspot/state/`, installed dependencies, or credentials.
