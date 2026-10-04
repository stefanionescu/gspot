---
title: Coding agents
description: Install instructions for coding agents and preserve authored content.
---

gspot installs Markdown rules that describe what its checks look for. The check results decide whether code passes.

## Installed instructions

With `agent_rules.enabled = true`, gspot writes selected rules under `.gspot/rules/` and a managed block in `AGENTS.md`. The selection follows applicable configurations and the chosen level. Conditional rules install only when their inputs match.

[Codex reads `AGENTS.md`](https://developers.openai.com/codex/guides/agents-md). Other agents have their own instruction-file conventions. [Claude Code reads `CLAUDE.md`](https://code.claude.com/docs/en/memory), so an `AGENTS.md` file alone does not ensure Claude Code loads it.

When agent rules are enabled, initialization and apply move authored text from `CLAUDE.md` to the end of `AGENTS.md`, under `Other instructions`, and remove `CLAUDE.md`. Review this move in the plan. Configure your agent to load `AGENTS.md` when its default file differs.

Apart from this move, gspot changes only its managed blocks in instruction files. Authored content outside the blocks stays in place. To add an additional supported instruction file:

```shell
gspot set agent_rules.instruction_files .github/copilot-instructions.md
```

Paths are relative to the repository root. gspot writes the block to `AGENTS.md` and the files you list; review the plan before applying it.

## Working with findings

The managed block names the selected rules and the command to run before committing. It directs the agent to change policy with `gspot set` or `gspot ignore`, then apply the policy. Generated files under `.gspot/` are not edited by hand.

Run the check with your [runner's prefix](/guides/install/) and read each finding's `help:` line. When you accept a finding, record the required reason in policy.

## Disable agent rules

```shell
gspot set agent_rules.enabled false
```

This removes installed rules and managed instruction blocks. gspot deletes an instruction file it created unless you edited it. Authored instruction content remains yours.
