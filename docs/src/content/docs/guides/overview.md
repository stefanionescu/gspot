---
title: Overview
description: What gspot does, how it enforces it, and where your choices live.
---

gspot lints AI-generated code and installs rules for AI coding agents. Git hooks and CI run
the checks, and a finding stops the commit.

## What gspot sets up

`gspot init` reads your repository and sets up four things.

**Linters.** gspot writes the configuration for the standard tools of your languages, such as
ESLint, Prettier, Ruff, ShellCheck, and SwiftLint. It installs them at pinned versions in a
private folder, `.gspot/`, so your own dependencies stay as they are.

**Checks for agent-written code.** Coding agents write some things again and again: functions
that only pass their arguments on, folders that hold one file, names such as `utils`, and code
copied between files. gspot has its own checks for these, next to the rules of the standard
tools.

**Guides for coding agents.** gspot installs Markdown guides under `.gspot/guides/` and links
them from `AGENTS.md`. `CLAUDE.md`, `GEMINI.md`, and the GitHub Copilot instructions get the
same link when they exist. The guides tell the agent how to write code in this repository, and
they match the checks.

**Enforcement.** Git hooks run the checks before each commit and push, and a finding stops the
commit. `gspot init --ci github` or `--ci gitlab` also writes a CI job. Each finding names the
file, the line, the rule, and what to do. The report prints the command that reruns each
failed check.

## Two levels

- `recommended`, the default, runs the checks that find defects: correctness, security,
  accessibility, type safety, dependency health, and formatting.
- `all` adds the house style: naming, trivial functions and files, one-file folders, copied
  code, declaration order, and complexity.

Neither level turns on experimental or preview rules. To change the level, run
`gspot set level all`.

## One policy file

Your choices live in `gspot.toml`: the kits, the level, the settings, and the exceptions.
`gspot set` and `gspot ignore` edit it and apply the change. After you edit it by hand, run
`gspot apply`. See [the policy file](/guides/customize/).

## Next steps

- [Install gspot](/guides/install/).
- Follow the [quickstart](/guides/quick-start/): an agent's commit is rejected, then fixed.
- Add gspot to an [existing repository](/guides/existing-repository/).
