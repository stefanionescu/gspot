---
title: Troubleshooting
description: Fix gspot.toml errors, missing tools, failed installs, version mismatches, and slow checks.
---

Start with `gspot doctor`. It lists missing tools, hook problems, and configurations that the repository needs.
`gspot apply --dry-run` shows the generated files that differ from `gspot.toml`.
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

If mise prints `GitHub rate limit exceeded`, set `MISE_GITHUB_TOKEN` to a GitHub token that can read public releases,
then run `gspot install` again. See
[mise: If something does not work](https://mise.jdx.dev/getting-started.html#if-something-doesn-t-work). To make new
tool lockfiles, delete the lockfiles in `.gspot/`, run `gspot install`, and commit them.

## `This repository pins gspot <version>`

The gspot that runs differs from `.gspot/version`. The error prints the command that installs the pinned version; run
it. To move the repository to the version that runs, follow [Upgrade gspot](/start/upgrade/).

## A generated file has local edits

Move any change you need into `gspot.toml` before you run `gspot apply`. Apply replaces owned generated files, including local edits. See [Generated files](/reference/generated-files/).

## A check runs slowly

Run `gspot check --verbose`. Each passed check then shows its number of files and its time, and the command that it
ran. Run one check alone with `gspot check --only <check>`. A tool command that runs longer than
`tool_timeout_seconds` stops with an error; the setting defaults to 600.

## `There is no terminal to ask in`

`gspot init` asks before it writes, and it cannot ask in CI or anywhere without a terminal. Pass `--yes` to accept the
plan, or `--dry-run` to print it.

## npm exec cannot find gspot

Add `@gspothq/cli` with your package manager; init does not add it.
See [Installation](/start/install/). In a fresh clone, run your package manager's install, then `gspot install`.

## A commit stops with `npm is not installed`

The Git hook did not find the program that starts gspot: npm, pnpm, Yarn, Bun, or mise. The message names it.
Install that program, run its install command, such as `npm install` or `mise install`, then commit again.
