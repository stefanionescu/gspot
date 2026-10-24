---
title: Coding agents
description: What gspot writes for coding agents, and how to change it.
---

gspot writes rules: Markdown files for your configurations and level, in the `rules/` folder of each configuration under
`.gspot/configurations/`. The rules guide agents; the checks still block failing code.

## The `AGENTS.md` managed block

gspot writes one managed block, the part between the gspot markers, and keeps your own text outside it. The block lists
the rules and names `gspot check --staged`, the command to run before a commit.

It also names the commands that change settings, and the generated files that agents must not edit, with the keys gspot
sets in your own files.

When `AGENTS.md` already has its own top heading, gspot writes its managed block one heading level lower.

An agent that reads another file needs a pointer. For Claude Code, this `CLAUDE.md` passes the gspot checks:

```markdown title="CLAUDE.md"
# Claude Code

@AGENTS.md
```

## Add your own rules

Write rules for your repository in `AGENTS.md`, outside the managed block. gspot leaves that text unchanged. To give
agents a separate file, link it from your text and say when to read it, the way the managed block lists the rules of
gspot.

## Leave out some rules

`gspot set rules.exclude .gspot/configurations/language/javascript/rules/BUN.md` leaves out one file. A folder, such as
`.gspot/configurations/language/bash`, leaves out every rule in it.

## Turn rules off

Run `gspot set rules.enabled false`. gspot deletes the rules and its managed block. If `AGENTS.md` holds nothing else,
gspot deletes the file.

## These docs for agents

Each page of these docs has a Markdown copy at its address plus `index.md`. For example, the Quickstart copy lives at
`https://generativespotting.com/start/quickstart/index.md`. A request with `Accept: text/markdown` gets the copy at the
page address. `/llms.txt` holds the setup steps for agents, and `/.well-known/agent-skills/index.json` lists the same
steps as an Agent Skill.
