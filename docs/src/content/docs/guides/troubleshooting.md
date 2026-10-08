---
title: Troubleshooting
description: Fix a policy that does not load, a missing tool, lockfiles that disagree, a version mismatch, and slow checks.
---

Start with the diagnosis:

```bash
gspot doctor
```

`doctor` lists missing tools, hooks that do not match the policy, and generated files that
changed. Each problem comes with the command that fixes it. When you
[report a problem](https://github.com/stefanionescu/gspot/issues), include the output, the check ID, and the command that reproduces it.
Leave out credentials.

## The policy does not load

An error in `gspot.toml` names the line and the column. Fix the value or table it names and
run the command again. An unknown configuration or setting names the entry. When a change weakens a setting and requires a reason, the error prints the command with `--reason`.

## A tool is missing

Run `gspot install` to install the locked npm and Python tools. Native tools come from mise, or
from your own install. See [runners](/guides/runners/). A check whose tool is
missing fails, and `doctor` names the tool.

## A GitHub download returns HTTP 403

`gspot install` downloads the EditorConfig checker from GitHub. When the error says
`API rate limit exceeded`, GitHub refused the download. Set `GITHUB_TOKEN` to a token that reads public releases, then run `gspot install` again. If credentials are unavailable, wait for the limit to reset before retrying. Keep the token out of policy files and reports.

## The policy and the lockfiles disagree

`gspot install` prepares missing or outdated required lockfiles in scratch copies before installing. If a package install fails, the previous lockfiles and installed tool projects remain. Repair package-manager or registry errors and retry. To resolve the declared pins again intentionally, run `gspot install --refresh-lockfiles`. An integrity failure alone does not change a committed lockfile. See [Join a repository](/guides/join/).

## The gspot version differs from the pin

The pin is in `.gspot/version`. Use that version, or move the pin as
[upgrade gspot](/guides/upgrade/) describes.

## A generated file has local edits

`gspot apply` keeps a generated file you edited and names it. Move the change you want into
`gspot.toml`, then run `gspot apply` again.

## A check is slow

Run the reproduce command the report prints, to time that check alone. `--verbose` prints each
command gspot runs.

gspot runs as many checks at once as the machine has processor cores. Set `GSPOT_JOBS` to a
smaller number when the tools compete for memory, as on a small CI runner:

```bash
GSPOT_JOBS=2 gspot check
```

## A Windows path is refused

gspot refuses drive-relative paths, reserved device names, Universal Naming Convention (UNC)
paths, and output folders that are links. In `gspot.toml`, write paths relative to the
repository with forward slashes, then run `gspot apply`.

## The working tree has

Commit or stash authored work before `init`. If you just added the CLI dependency, include its manifest and lockfile in that commit.

## Initialization needs a terminal or --yes

If the error says `There is no terminal to ask in`, supply `--yes` for noninteractive initialization, including previews: `gspot init --dry-run --yes`.

## “This repository pins gspot”

Read `.gspot/version` and install that exact version through the repository's runner. Use [Upgrade gspot](/guides/upgrade/) only when intentionally moving the pin.

## A hook cannot find a native tool

Run `gspot doctor`, install the tool using the install command it prints, and rerun the hook. For mise, trust the generated pins and run `mise install`. An execution error exits `2` and blocks the Git operation.

## npm exec cannot find gspot

Install the exact CLI dependency in the repository. Initialization does not add `@gspothq/cli` to `devDependencies`. If the CLI is already installed, verify that hooks use the runner configured by `runner`.
