---
title: Coding Agents
description: What gspot writes for coding agents, and how to change it.
---

gspot writes rules: Markdown files for your configurations and level, in the `rules` folder of `.gspot/`. The rules
guide agents; the checks still block failing code.

## The `AGENTS.md` managed block

gspot writes one managed block, the part between the gspot markers, and keeps your own text outside it. The block lists
the rules and names `gspot check --staged --stage commit` before a commit and `gspot check --changed --stage push`
before a push.

It also names the commands that change settings. The gspot block of `.gitattributes` marks generated paths outside
`.gspot/` with `linguist-generated`; [Generated files](/reference/generated-files/) explains their contents.

When `AGENTS.md` already has its own top heading, gspot writes its managed block one heading level lower.

An agent that reads another file needs a pointer file. For Claude Code, this `CLAUDE.md` passes the gspot checks:

```markdown title="CLAUDE.md"
# Claude Code

@AGENTS.md
```

## Add your own rules

Write rules for your repository in `AGENTS.md`, outside the managed block. gspot leaves that text unchanged. To give
agents a separate file, link it from your text and say when to read it, the way the managed block lists the rules of
gspot.

## Leave out some rules

`gspot set rule_files.exclude <path>` leaves out one file, such as `BUN.md` in the `rules` folder of `.gspot/`.

## Turn rules off

Run `gspot set rule_files.enabled false`. gspot deletes the rules and its managed block. If `AGENTS.md` holds nothing else,
gspot deletes the file.

## These docs for agents

`/llms.txt` holds the steps to evaluate and set up gspot, and links these docs as plain text: `/llms-small.txt` without the
reference of commands, settings, configurations, and checks, and `/llms-full.txt` with every page.
