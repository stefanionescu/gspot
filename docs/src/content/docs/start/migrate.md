---
title: Migrate existing tools
description: Review the init plan and move the settings you need.
---

## Read the plan

Run `gspot init --dry-run` to read the plan before you accept it. The plan names the existing tool files that it replaces, such as `.eslintrc.json` and `ruff.toml`. `init` deletes those files and writes its own; it copies no settings from them. Move settings you still need into `gspot.toml` with `gspot set` and `gspot ignore`. A tool without a tool file can run as a [command check](/configure/command-checks/).

### What init leaves alone

gspot does not change your application settings or your text outside sections between gspot markers. Tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml` or `prettier` in `package.json`, stay in place. The plan names each one; the generated tool files take over. Delete a section after you move its settings.

If Husky, Lefthook, or your own hooks folder already runs your Git hooks, gspot keeps them and prints three hook lines to add. See [Git hooks](/use/hooks/). Until you add the lines, the checks do not run on commit or push.

The list under `no longer runs` in the plan names folders of lint scripts and dependency files that list only lint tools. Check that nothing else uses them, then delete them.
