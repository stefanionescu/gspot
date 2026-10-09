---
title: Add gspot to an existing repository
description: What init replaces in a repository that already has linters, and where the originals stay.
---

`gspot init` replaces existing tool files with its generated tool files. Git keeps every
file it replaces.

## Preview the plan

From the root of your repository, run:

```bash
gspot init --dry-run --yes
```

The plan lists the configurations gspot selects, the files it writes, the files it replaces, and the files
it leaves alone. The preview writes nothing. Without `--yes`, it asks the initialization questions first. When the plan looks right, run `gspot init` and
accept it.

## What init replaces

Each configuration knows its tool files, such as `.eslintrc.json`, `.prettierrc`,
`ruff.toml`, `.stylelintrc.json`, `typos.toml`, and `.shellcheckrc`. Init replaces these files: it deletes them and writes its own tool files instead. It does not read settings out of them. Move the
settings you still need into `gspot.toml` with `gspot set` and `gspot ignore`.

For Python, init writes a root `ruff.toml` that extends the generated Ruff tool file.
Editor formatting follows the same settings as `gspot check --fix`.
Ruff reads each project's `requires-python` before offering syntax changes.
See [Python-version inference in Ruff](https://docs.astral.sh/ruff/configuration/#inferring-the-python-version).

Init refuses uncommitted changes, so Git history keeps every file it replaces. To get one
back, check it out from the commit before init.

If init cannot read one of these files, the plan names it and init stops with exit code `2`
before it writes anything. Fix the file and run `gspot init` again.

## What init leaves alone

- **Tool sections in shared files.** `[tool.ruff]` in `pyproject.toml` or the `prettier` key
  in `package.json` stays where it is. The plan names the section, and the generated
  tool files take over. Delete the section when you are ready.
- **Your Git hooks.** If Husky, Lefthook, or an authored hook folder owns them, gspot installs none of its own and prints three integration lines. Add the lines, or checks will not run on commit or push. See [Git hooks](/guides/hooks/).
- **Your scripts and dependencies.** The `no longer runs` plan section names lint folders and manifests that hold only lint tools. Review your scripts and dependencies before removing them.

A tool without a tool file can run as a [command check](/guides/command-checks/).

## Run the checks

After you accept the plan, init writes the generated files and installs the tools. With
`--no-install`, it prints the install command instead. Init runs no check, so run one yourself:

```bash
gspot check
```
