---
title: Overview
description: What gspot sets up in a repository, and where to read more.
---

gspot lints AI-generated code and installs rules for AI coding agents. Git hooks and CI run
the checks, and a finding stops the commit.

`gspot init` reads your repository, shows a plan, and sets up four things:

| What                                                                                                                                                | Where            | Read more                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| Configuration for the standard linters of your languages, such as ESLint, Ruff, and ShellCheck, with their npm and Python tools pinned in `.gspot/` | `.gspot/config/` | [Generated files](/guides/generated-files/) |
| Checks of its own for what agents write again and again: wrappers, one-file folders, names such as `utils`, and copied code                         | `gspot.toml`     | [Fix findings](/guides/findings/)           |
| Rules for coding agents, linked from `AGENTS.md`                                                                                                    | `.gspot/rules/`  | [Coding agents](/guides/agents/)            |
| Git hooks, and a CI job when you ask for one                                                                                                        | `.gspot/hooks/`  | [Hooks and CI](/guides/hooks/)              |

The default level, `recommended`, finds defects. `all` adds the house style. Your choices live
in `gspot.toml`, described in [the policy file](/guides/customize/).

## Next steps

- [Install gspot](/guides/install/).
- Follow the [quickstart](/guides/quick-start/): an agent's commit is rejected, then fixed.
- Add gspot to an [existing repository](/guides/existing-repository/).
