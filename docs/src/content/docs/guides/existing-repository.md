---
title: Existing repositories
description: What init replaces in a repository that already has linters, and how to get the originals back.
sidebar:
    order: 2
---

When your repository already has linter configuration, `gspot init` replaces it with the
configuration it generates. It keeps a copy of every file it replaces.

## Preview the plan

From the root of your repository, run:

```bash
gspot init --dry-run
```

The plan lists the kits gspot selects, the files it writes, the files it replaces, and the files
it leaves alone. The preview writes nothing. When the plan looks right, run `gspot init` and
accept it.

## What init replaces

Each kit knows the configuration files of its tools, such as `.eslintrc.json`, `.prettierrc`,
`ruff.toml`, `.stylelintrc.json`, `typos.toml`, and `.shellcheckrc`. Init deletes these files
and writes its own configuration instead. It does not read settings out of them. Move the
settings you still need into `gspot.toml` with `gspot set` and `gspot ignore`.

Init refuses uncommitted changes unless you pass `--allow-dirty`, so Git history keeps every
file it replaces. Init also saves the exact bytes and permissions of each file under
`.gspot/state/`. `gspot uninstall` puts them back from there, so keep that folder for as long
as you want a way back.

If init cannot read one of these files, the plan names it and init stops with exit code `2`
before it writes anything. Fix the file and run `gspot init` again.

## What init leaves alone

- **Tool sections in shared files.** `[tool.ruff]` in `pyproject.toml` or the `prettier` key
  in `package.json` stays where it is. The plan names the section, and the generated
  configuration takes over. Delete the section when you are ready.
- **Your Git hooks.** They stay in the chain and still receive their arguments and input. A
  failing hook still stops the commit. Hooks that a hook manager tracks need that manager's
  integration; see [hooks and CI](/guides/hooks-and-ci/).
- **Your scripts and dependencies.** The plan names lint scripts and tool dependencies that
  gspot now runs for you. Remove them when you are ready. A tool without a kit can run as a
  [custom check](/guides/custom-checks/).

## Run the checks

After you accept the plan, init writes the configuration and installs the tools. With
`--no-install`, it prints the install command instead. Init runs no check, so run one yourself:

```bash
gspot check
```

To put the original files back, follow [uninstall](/guides/uninstall/).
