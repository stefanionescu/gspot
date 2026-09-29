---
title: Existing repositories
description: What init replaces in a repository that already has linter configuration, and how to get the originals back.
sidebar:
    order: 2
---

Run commands from your repository root with [gspot installed](/guides/install/).

Preview the plan first:

```bash
gspot init --dry-run
```

The plan lists the kits init selects, the files it writes, the files it deletes, and the files
it leaves alone. Run `gspot init` to accept it.

## What init deletes

Each selected kit names the configuration files of its tools, such as `.eslintrc.json`,
`.prettierrc`, `ruff.toml`, `.stylelintrc.json`, `typos.toml`, and `.shellcheckrc`. Init deletes
those files and writes the generated configuration in their place. It reads nothing out of them.
Settings you still need go into `gspot.toml` by hand, with `gspot set` and `gspot ignore`.

Init refuses to run on a dirty working tree, so every deleted file stays in git history. Before
it deletes a file, it also saves the exact bytes and permissions under `.gspot/state/`, and
`gspot uninstall` restores them. Keep that directory private for as long as you want a way
back.

An unreadable file is listed in the plan, and init exits with status 2 before writing
anything. Fix the file and run `gspot init` again.

## What init leaves alone

A tool section inside a shared file, such as `[tool.ruff]` in `pyproject.toml` or the `prettier`
key of `package.json`, stays where it is. The plan names the section, and the generated
configuration takes over. Delete the section when you are ready.

Hooks you wrote by hand stay in the chain. Installation forwards their arguments and input, and
a failing hook still rejects the operation. Tracked hooks under a hook manager need that
manager's integration; see [hooks and CI](/guides/hooks-and-ci/).

The plan also names lint scripts and tool dependencies that stop running once gspot runs the
same tools. Add tools without a kit as [custom checks](/guides/custom-checks/).

## Run the checks

After accepting the plan, init writes the configuration and installs the selected tools unless
you pass `--no-install`. It runs no check. Run `gspot check` to see findings.

Reverse the recorded changes with the [uninstall procedure](/guides/uninstall/).
