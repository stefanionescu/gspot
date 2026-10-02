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

An agent works with findings this way. The managed block gives steps 1, 3, and 4:

1. Run `gspot check --staged` before each commit. The commit hook runs it too.
2. For each finding, run `gspot explain <check>` and do what the `help:` line says.
3. When a rule does not fit, change the policy with `gspot ignore` or `gspot set` and a reason.
   Never edit a file under `.gspot/`.
4. After editing `gspot.toml` by hand, run `gspot apply`.

## Hooks and bypasses

`git commit --no-verify` and `git push --no-verify` skip the local hooks. CI and server rules
still run. After a bypass, run `gspot check` yourself.

## Remove the rules

Run `gspot set rules.install false`. It removes the rules and the managed blocks. A file
gspot created goes only when you did not edit it.
