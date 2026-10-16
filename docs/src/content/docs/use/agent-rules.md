---
title: Coding agents
description: Write rules and preserve your own text.
---

gspot writes rules: Markdown files that tell coding agents how to write code that passes its checks. The checks
still decide whether code passes.

## Rules for agents

When `rules.enabled = true`, gspot writes the rules that fit your languages, frameworks, and level
under `.gspot/rules/`, and a section between gspot markers in `AGENTS.md` that lists them. gspot preserves your own text outside the block.

Codex, Cursor, and GitHub Copilot read `AGENTS.md`. gspot writes a section between gspot markers at the top of `CLAUDE.md` with
`@AGENTS.md`, so Claude Code reads the same rules. gspot keeps your own text outside both blocks.

Point any other coding agent to `AGENTS.md` in its own settings.

## Instructions in the block

The block lists the rules, gives the command to run before committing, and says how to change settings. Do not edit
files under `.gspot/`. To keep a finding, add an ignore with a reason: run `gspot ignore`.

## Turn rules off

Run `gspot set rules.enabled false`. This deletes the rules and the sections between gspot markers gspot wrote. gspot also deletes
an instruction file it created, unless you edited it. Your own text stays.
