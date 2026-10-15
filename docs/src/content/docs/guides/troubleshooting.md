---
title: Troubleshooting
description: Fix gspot.toml errors, missing tools, failed installs, version mismatches, and slow checks.
---

Start with `gspot doctor`. It lists missing tools, hook problems, and generated files that changed.
When you [report a problem](https://github.com/stefanionescu/gspot/issues), include the output, check name,
and command that reproduces it. Leave out credentials.

## gspot.toml has an error

Fix the value or table named by the error and run the command again.
A setting that loosens a check needs a reason beside its value.

## A tool cannot run

Run `gspot install`. It installs program tools with mise. Without mise, install the programs that
`gspot doctor` lists. See [What you need](/guides/install/#what-you-need).
A missing tool makes the run incomplete with exit code 2, which also stops a commit in the hook.

## `gspot install` fails

If mise prints `GitHub rate limit exceeded`, set `GITHUB_TOKEN` to a token that
can read public releases and run `gspot install` again. See [mise: If something does not work](https://mise.jdx.dev/getting-started.html#if-something-does-not-work).
For another error, fix the error and run `gspot install` again.
To make new lockfiles, delete them and run `gspot install`.

## The installed version differs from the pinned version

Install the version the repository pins, as [Join a repository](/guides/join/) shows.
To move the repository to a new version, see [Upgrade gspot](/guides/upgrade/).

## A generated file has local edits

See [Generated files](/guides/generated-files/) for how gspot keeps your edits.

## A check runs slowly

Run the reproduce command in the report to time that check alone. `--verbose` prints each command.
Set `GSPOT_JOBS` to a smaller number when tools compete for memory, as on a small CI machine:

```shell
GSPOT_JOBS=2 gspot check
```

On Windows, run `$env:GSPOT_JOBS = "2"` first, then `gspot check`.

## No terminal accepts the question

Pass `--yes` to accept the plan without the "Continue?" question.
A dry run never asks: `gspot init --dry-run`.

## npm exec cannot find gspot

Add `@gspothq/cli` with your package manager; init does not add it.
See [Install gspot](/guides/install/). In a fresh clone, run your package manager's install, then `gspot install`.
