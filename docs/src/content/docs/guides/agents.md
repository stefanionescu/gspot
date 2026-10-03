---
title: Coding agents
description: The rules gspot installs for coding agents, and how an agent works with findings.
sidebar:
    order: 6
---

gspot installs Markdown rules that tell a coding agent how to write code in your repository.
The rules match the checks, so code that follows them passes.

## What gspot installs

- **Rules** under `.gspot/rules/`, one for each topic: how to work, how to write, and one for
  each language, framework, and tool you selected.
- **A managed block in `AGENTS.md`** that lists the rules. gspot writes no other agent file.
  `gspot init` and `gspot apply` delete `CLAUDE.md`. Its own text moves to the end of
  `AGENTS.md`, under `## Other instructions`.

The rules follow your level. At `recommended` they cover safety and correctness. At `all` they
add naming, architecture, and style. After you change the policy, `gspot apply` updates them.

gspot writes only inside its managed blocks, so the rest of each file stays yours. To add the
block to another file, run:

```bash
gspot set rules.instructions TEAM.md
```

The path is relative to the repository root.

## How an agent resolves findings

The managed block tells the agent to run `gspot check --staged` before each commit and to follow
the `help:` line of each finding. When a rule does not fit, the agent changes the policy with
`gspot ignore` or `gspot set` and a reason, and it never edits a file under `.gspot/`.

## Remove the rules

Run `gspot set rules.install false`. It removes the rules and the managed blocks. A file
gspot created goes only when you did not edit it.
