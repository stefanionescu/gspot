---
title: Working with an agent
description: How an agent reads a finding, runs explain, changes policy with the writing commands, and never edits .gspot/.
sidebar:
    order: 6
---

gspot installs its rule files under `.gspot/rules/` and links them from a managed block in
`CLAUDE.md` and `AGENTS.md`. An agent that reads those files knows the house style before it
writes a line.

## The loop

1. Run `gspot check --staged` before every commit; the pre-commit hook runs it anyway.
2. For each finding, run `gspot explain <check>` and do what the `help:` line says.
3. When a rule does not fit, change the policy with a writing command and a reason:
   `gspot ignore`, `gspot allow`, `gspot set`, `gspot declare`. Never edit a file under `.gspot/`.
4. Run `gspot apply` after any hand edit of `gspot.toml`.

## What an agent never does

- Edit `.gspot/`: every file there is generated, and `apply --check` fails on a hand edit.
- Add an ignore without a reason: the loader refuses it.
- Skip the hook with `--no-verify`: the push stage runs the same checks.

## What the rule files say

Each rule file states rules for one topic and names no tool. `general/agent/WORKING.md` says how
to work in the repository; `general/prose/WRITING.md` says how to write; the language, framework
and tool files say what code looks like here.
