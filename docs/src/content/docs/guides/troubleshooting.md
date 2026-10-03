---
title: Troubleshooting
description: Fix a policy that does not load, a missing tool, locks that disagree, a version mismatch, and slow checks.
---

Start with the diagnosis:

```bash
gspot doctor
```

`doctor` lists missing tools, hooks that do not match the policy, and generated files that
changed. Each problem comes with the command that fixes it. When you
report a problem, include the output, the check name, and the command that reproduces it.
Leave out credentials.

## The policy does not load

An error in `gspot.toml` names the line and the column. Fix the value or table it names and
run the command again. An unknown kit or setting names the entry. A loosening that needs a
reason prints the command that records one.

## A tool is missing

Run `gspot install` to install the locked npm and Python tools. Native tools come from mise, or
from your own install; see [package managers](/guides/without-mise/). A check whose tool is
missing fails, and `doctor` names the tool.

## A GitHub download returns HTTP 403

`gspot install` downloads the EditorConfig checker from GitHub. When the error says
`API rate limit exceeded`, GitHub refused the download. Wait for the
limit to reset, then run `gspot install` again. If `GITHUB_TOKEN` is set in your environment,
the download uses it. Keep the token out of policy files and reports.

## The policy and the locks disagree

`gspot install` installs only locks that match the policy; [join a configured
repository](/guides/install/#join-a-configured-repository) says who runs `gspot apply`.

## The gspot version differs from the pin

The pin is in `.gspot/version`. Use that version, or move the pin as
[upgrade gspot](/guides/customize/#upgrade-gspot) describes.

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
