---
title: Adopt an existing repository
description: Review the setup plan and move the settings you need.
---

## Read the plan

Run `gspot init --dry-run` to read the plan before accepting it. The plan names existing tool files it replaces, such as `.eslintrc.json`, `.prettierrc`, `ruff.toml`, `.stylelintrc.json`, `typos.toml`, and `.shellcheckrc`. `init` deletes those files and writes its own tool files; it does not read settings out of them. Move settings you still need into `gspot.toml` with `gspot set` and `gspot ignore`. A tool without a tool file can run as a [command check](/configure/command-checks/).

### What init leaves alone

gspot leaves your application settings and your text outside sections between gspot markers alone. Tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml` or `prettier` in `package.json`, stay in place. The plan names each section; the generated tool files take over. Delete the section when you have moved its settings.

If Husky, Lefthook, or your own hooks folder already runs your Git hooks, gspot leaves them alone and prints three gspot hook lines for you to add. See [Git hooks](/use/hooks/). Until you add them, gspot checks do not run on commit or push.

The list under `no longer runs` in the plan names folders of lint scripts and dependency files that list only lint tools. Check that nothing else uses them, then delete them.
