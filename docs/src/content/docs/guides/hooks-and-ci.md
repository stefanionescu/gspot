---
title: Use hooks and CI
description: Understand staged and pushed-content checks, retained hooks, and CI reports.
---

Run commands from the initialized repository root with the [CLI available](/guides/install/). Its `gspot.toml` records the selected hook integration
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

Submodule contents are excluded from checks. Initialization and `gspot doctor` report each
submodule path once. Staged and pushed snapshots preserve the Git submodule references
without checking out or reading their contents.

Use Python virtual environments with manifests and locks matching the selected revision,
and disable system site packages. Dependency symlinks must stay inside the copied package
trees, apart from the environment's declared host interpreter.

Existing hooks remain part of the chain. Hook arguments and stdin are forwarded to retained
hooks. A retained hook failure still rejects the operation. See
[adoption and restoration](/guides/existing-repository/) before replacing hook-manager setup.

`git commit --no-verify` and `git push --no-verify` bypass local hooks. They do not disable
CI or server policy. Correct the defect or record a scoped exception with a reason.

If installation reports a differing native hook, preserve its authored changes in the hook
manager configuration and regenerate the native hooks before running `gspot install` again.
gspot retains the existing launchers and publishes no hook changes until the conflict is
resolved. This prevents chaining the same native manager twice.

## Use Husky

Install the repository's Husky 9 dependency, then configure the integration:

```shell
gspot set hooks.tool husky
gspot install
```

gspot adds a managed invocation to each commit, push, and message script under `.husky/`.
Installation prepares the native runtime in a temporary Git repository and publishes the
chain at the existing Git hook location. It preserves `core.hooksPath` and package lifecycle
scripts, including `prepare`.

Use the installed Git hooks. They run authored scripts and initialization, then ensure gspot
runs after a successful early `exit` or `exec`. An authored failure stops the chain. Push input
is replayed independently, and gspot receives the original Git arguments even if the authored
script changes its directory or arguments. Missing integration scripts report setup failure.

Run `gspot install` after cloning, changing the runner, or updating the Husky dependency.
Uninstall restores unchanged owned hooks and managed blocks while preserving authored commands.

## Use Lefthook

Install the repository's Lefthook dependency at version 2.0.13 or newer. Configure this
integration from the Git root:

```shell
gspot set hooks.tool lefthook
gspot install
```

gspot owns its three commands and `no_auto_install` in `lefthook.yml` or `.lefthook.yml`.
Disabling native automatic installation keeps other Lefthook hooks from replacing the installed
dispatcher. Authored commands and inherited settings remain active. Installation preserves
`core.hooksPath` and records original hooks for restoration.

Use the installed Git hooks for native commit, push, and message checks. They carry exact Git
arguments and replay push input. gspot still runs when native file selection is empty or an
initialization script exits successfully. Initialization failures remain failures. A missing
executable or invalid configuration reports a setup failure. Run `gspot install` after cloning
or changing native hook-template settings. Uninstall restores unchanged owned fields and hooks.

## Use the pre-commit framework

Select the integration after installing the repository's pre-commit dependency:

```shell
gspot set hooks.tool pre-commit
gspot install
```

gspot adds one local `gspot` hook to `.pre-commit-config.yaml`. It runs the staged check once,
without passing individual filenames. Existing repository entries and comments remain intact.
An authored hook already named `gspot` must be renamed before selecting the integration.

Installed hooks distinguish gspot findings (`1`) from setup failures (`2`). Missing gspot or
framework executables and invalid framework configuration report setup failure. A successful
framework run that omits gspot also reports setup failure. Before a commit, stage the framework
configuration and resolve index conflicts. Authored hook failures remain failures, including
with the framework's `fail_fast` setting.

The installer validates the configuration and generates native commit, push, and message hooks
in a temporary repository. Existing local hooks stay in the chain. Push and message checks run
after the framework with Git's original arguments and replayed push input. Installation leaves
`core.hooksPath` unchanged. Use `gspot install` after cloning; use `gspot uninstall` to restore
unchanged integration files while retaining later edits.

The framework's [supported hook documentation](https://pre-commit.com/#supported-git-hooks)
describes its native stages.

## Use simple-git-hooks

Install the repository's simple-git-hooks dependency first. For a repository that configures
simple-git-hooks in `package.json`, select its integration:

```shell
gspot set hooks.tool simple-git-hooks
gspot install
```

gspot preserves
each existing package hook command and runs it before its check. Pre-push commands receive
the same arguments and a separate copy of Git's input. A failed original command stops the
chain. Existing local hooks remain executable siblings with restoration records.

The native installer generates hooks in a temporary repository. gspot installs
them at Git's resolved hook path without changing `core.hooksPath`. `gspot doctor` detects
missing or edited integration files. Uninstall restores unchanged package fields and local
hooks, while preserving later edits. Run `gspot install` after cloning or changing the runner.
A successful early exit from native initialization still runs gspot. Initialization failures
stop the chain, and consuming initialization input does not drain the gspot push input.

Move commands from a separate `simple-git-hooks.*` configuration file into the package field
before selecting this integration. gspot retains that file and refuses a competing package
configuration. See the [manager's configuration reference](https://github.com/toplenboren/simple-git-hooks#additional-configuration-options).

## Choose a stage manually

```bash
gspot check --stage commit
gspot check --stage push
gspot check --stage manual
```

A manual-stage check does not run merely because initialization completed. Use the
[check reference](/reference/commands/check/) for selectors and
[check definitions](/development/engines/) for execution behavior.

## Generated CI

Select a provider with `gspot init --ci github` or `gspot init --ci gitlab`. Existing CI files
determine the default before the remote hostname. When initialization finds an authored lint
job, the plan identifies it and proposes no duplicate job.

For GitLab, gspot writes `.gitlab/ci/gspot.yml`. Add its include to your existing pipeline:

```yaml
include:
  - local: .gitlab/ci/gspot.yml
```

The generated job runs for merge requests and the default branch. It retains JSON, SARIF, and
GitLab Code Quality reports after a failed check. See the GitLab documentation for
[local includes](https://docs.gitlab.com/ci/yaml/#includelocal) and
[Code Quality reports](https://docs.gitlab.com/ci/testing/code_quality/).

For GitHub, the workflow checks pull requests, merge queues, and pushed commits. Manual checks
run in separate jobs on default-branch pushes. Each stage and platform retains its own reports.
A separate code-scanning job uploads available SARIF reports after repository pushes. Set
`ci.sarif` to `false` when the repository does not use GitHub code scanning:

```sh
gspot set ci.sarif false
```

CI checks changes relative to the event base. An absent base on a first push checks the full
tree. An invalid or unavailable comparison object fails the job. To check the full tree on
every CI run:

```sh
gspot set ci.run all
```

CI installs tracked tool locks before checking. Generated shell steps require Bash.
Generated jobs require the selected installer
on the runner. The mise integration provisions its pinned tools; without mise, provision the
package manager, uv when Python tools are selected, and required native tools on the runner.
