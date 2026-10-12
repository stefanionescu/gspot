---
title: Coding agents
description: Write rules and preserve your own text.
---

gspot writes rules: Markdown files that tell coding agents how to write code that passes its checks. The checks
still decide whether code passes.

## Rules for agents

When `rules.enabled = true`, gspot writes the rules that fit your languages, frameworks, and level
under `.gspot/rules/`, and a managed block in `AGENTS.md` that lists them. gspot preserves your own text outside the block.

[Codex reads `AGENTS.md`](https://developers.openai.com/codex/guides/agents-md).
[Claude Code reads `CLAUDE.md`](https://code.claude.com/docs/en/memory), not `AGENTS.md`. To give Claude Code the
rules, put this line in your `CLAUDE.md`:

```text
@AGENTS.md
```

gspot never changes `CLAUDE.md`.

To write the block into another instruction file too, run this example:

```shell title="Example instruction file"
gspot set rules.instruction_files .github/copilot-instructions.md
```

Write paths relative to the repository root.

## Instructions in the block

The block lists the rules, gives the command to run before committing, and says how to change settings. Do not edit
files under `.gspot/`. To keep a finding, add an ignore with a reason: run `gspot ignore`.

## Turn rules off

Run `gspot set rules.enabled false`. This deletes the rules and the managed blocks gspot wrote. gspot also deletes
an instruction file it created, unless you edited it. Your own text stays.
