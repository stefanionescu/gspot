---
title: Coding agents
description: What gspot writes for coding agents, and how to change it.
---

gspot writes rules for coding agents: Markdown files in `.gspot/rules/`. Your configurations and your level pick them.
Level `all` adds sections to some of them. The rules guide agents; the checks still stop code that fails.

## The `AGENTS.md` block

gspot writes one block in `AGENTS.md`, the part between the gspot markers, and keeps your own text outside it. The
block lists the rule files and says when to read each one. It says to commit and fix what the hook reports,
and to run `gspot check --changed --stage push` before a push. It also names the commands that change settings, and
says which files gspot generates.

When `AGENTS.md` already has its own top heading, gspot writes its block one heading level lower.

## Agents that read `AGENTS.md`

Codex, Cursor, and GitHub Copilot read `AGENTS.md`. Codex reads up to 32 KiB of instructions by default; see
[the Codex guide to AGENTS.md](https://developers.openai.com/codex/guides/agents-md).

Claude Code reads `CLAUDE.md`. From version 2.1.277, it reads `AGENTS.md` when the repository has no `CLAUDE.md` and no
`CLAUDE.local.md`; see [the Claude Code memory docs](https://code.claude.com/docs/en/memory). When a `CLAUDE.md`
exists, or for an older version, import `AGENTS.md` from it:

```markdown title="CLAUDE.md"
# Instructions

@AGENTS.md
```

## Add your own rules

Write rules for your repository in `AGENTS.md`, outside the gspot block. gspot leaves that text unchanged. To give
agents a separate file, link it from your text and say when to read it, the way the gspot block lists its rules.

## Leave out some rules

List the rule files to leave out by their path. `gspot set` replaces the whole list, so name every file:

```shell
gspot set rule_files.exclude .gspot/rules/PLANNING.md .gspot/rules/TASKS.md
```

gspot deletes those files and drops them from `AGENTS.md`.

## Turn rules off

Run `gspot set rule_files.enabled false`. gspot deletes the rule files and its block. If `AGENTS.md` holds nothing
else, gspot deletes the file.

## These docs for agents

`/llms.txt` says what gspot does, and holds the steps to evaluate and set up gspot. It links these docs as plain text:
`/llms-small.txt` without the reference of commands, settings, configurations, checks, and the ESLint plugin, and
`/llms-full.txt` with every page.
