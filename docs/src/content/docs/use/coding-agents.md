---
title: Coding agents
description: Write rules and preserve your own text.
---

gspot writes rules: Markdown files that tell coding agents how to write code that passes the checks. The rules
only guide agents; the checks still block failing code.

## Rules for agents

When `rules.enabled = true`, gspot writes the rules that fit your languages, frameworks, and level
in the `rules/` folder of each configuration under `.gspot/configurations/`. A section between gspot markers in
`AGENTS.md` lists them.

gspot writes the rules into `AGENTS.md` only, and keeps your own text outside its section. Point a coding agent that
reads another file to `AGENTS.md`.

## Instructions in the section

The section lists the rules, gives the command to run before a commit, and says how to change settings. Do not edit
files under `.gspot/`. To accept a finding, run `gspot ignore` with a reason.

## Turn rules off

Run `gspot set rules.enabled false`. gspot then deletes the rules and its section between gspot markers. It also removes
an instruction file that it created, unless you edited that file. Your own text stays.
