---
title: Coding agents
---

gspot writes Markdown files in `.gspot/rules/` that tell a coding agent how to write code that passes the checks of one
language, framework, or topic. Your configurations and your level decide which rule files gspot writes, and level `all`
adds sections to some of them.

## The `AGENTS.md` block

gspot points agents at the rule files from one block of text in `AGENTS.md`, between the comments
`<!-- >>> gspot managed >>> -->` and `<!-- <<< gspot managed <<< -->`, and it does not change your own text outside the
block. The block lists the rule files and says when to read each one, names the commands that change settings, and says
not to edit the files that gspot writes.

With the Git hooks on, it says what to run:

```text
Before you finish a change, stage it and run `gspot check --staged --only commit`. When you commit, fix what the hook reports.
```

With the hooks off, the second sentence reads "Before you push, run `gspot check --base origin/HEAD`."

## Agents that read `AGENTS.md`

Codex, Cursor, and GitHub Copilot read `AGENTS.md`.

Claude Code reads `CLAUDE.md`. From version 2.1.277, it reads `AGENTS.md` when your repository has no `CLAUDE.md` and no
`CLAUDE.local.md`, as [the Claude Code memory docs](https://code.claude.com/docs/en/memory) say. When a `CLAUDE.md`
exists, or with an older version, import `AGENTS.md` in `CLAUDE.md`:

```markdown title="CLAUDE.md"
# Instructions

@AGENTS.md
```

## Add your own rules

Write your own rules in `AGENTS.md`, outside the gspot block. To keep a rule in a separate file, link the file from your
text and say when to read it, as the gspot block does.

## Leave out some rules

List the paths in `rule_files.exclude`, and gspot deletes those files and removes them from the list in `AGENTS.md`.
`gspot set` replaces the whole list, so name every file that you want to leave out:

```shell
gspot set rule_files.exclude .gspot/rules/PLANNING.md .gspot/rules/TASKS.md
```

## Turn rules off

Run `gspot set rule_files.enabled false`. gspot deletes the rule files and its block in `AGENTS.md`, and it deletes
`AGENTS.md` when that file holds nothing else.

Leaving out a rule file, or turning rules off, is a
[change that needs a reason](/configure/gspot-toml/#changes-that-need-a-reason). The next push fails until you give one.

## Documentation for coding agents

The docs site serves `/llms.txt` for coding agents. It lists the languages and frameworks that gspot supports, and
gives the steps to try gspot and to set it up. It links the pages an agent reads when a step fails.
