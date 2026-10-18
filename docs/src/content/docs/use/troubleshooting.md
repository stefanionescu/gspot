---
title: Troubleshooting
description: Fix gspot.toml errors, missing tools, failed installs, version mismatches, and slow checks.
---

Start with `gspot doctor`. It lists missing tools, hook problems, and generated files that changed.
When you [report a problem](https://github.com/stefanionescu/gspot/issues), include the output, the check ID,
and the command that reproduces it. Leave out credentials.

## gspot.toml has an error

Fix the value or table named by the error and run the command again.
A setting that loosens a check needs a reason beside its value.

## A tool cannot run

Run `gspot install`. It installs program tools with mise. Without mise, install the programs that
`gspot doctor` lists. See [What you need](/start/install/#what-you-need).
A missing tool makes the run incomplete with exit code 2, which also stops a commit in the hook.

## `gspot install` fails

If mise prints `GitHub rate limit exceeded`, set `GITHUB_TOKEN` to a token that
can read public releases and run `gspot install` again. See [mise: If something does not work](https://mise.jdx.dev/getting-started.html#if-something-doesn-t-work).
To make new lockfiles, delete them and run `gspot install`.

## The installed version differs from the pinned version

Install the version the repository pins, as [Set up a clone](/start/install/#set-up-a-clone) shows.
To move the repository to a new version, see [Upgrade gspot](/start/upgrade/).

## A generated file has local edits

Move any change you need into `gspot.toml` before you run `gspot apply`. Apply replaces owned generated files, including local edits. See [Generated files](/reference/generated-files/).

## A check runs slowly

Run the `run again:` command from the report to time that check alone. `--verbose` prints each command.

## `There is no terminal to ask in`

`gspot init` asks before it writes, and it cannot ask in CI or anywhere without a terminal. Pass `--yes` to accept the
plan, or `--dry-run` to print it.

## npm exec cannot find gspot

Add `@gspothq/cli` with your package manager; init does not add it.
See [Install gspot](/start/install/). In a fresh clone, run your package manager's install, then `gspot install`.
