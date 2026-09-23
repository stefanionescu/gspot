---
title: Work with coding agents
description: Install selected rule guides and direct agents to policy-owned changes.
sidebar:
    order: 6
---

Run commands from the configured repository root with the [CLI available](/guides/install/).

gspot installs its rule files under `.gspot/rules/` and links them from a managed block in
`AGENTS.md`. Existing `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`
receive the same block. When `.cursor/` exists, gspot creates `.cursor/rules/gspot.mdc`
with `alwaysApply: true`. An authored file at that path is preserved.

Those links give an agent the selected repository instructions. The agent must still read and
follow them; installing files does not establish compliance.

To include another instruction file, run:

```shell
gspot set rules.agents TEAM.md
```

Destinations are relative to the repository root. gspot preserves content outside its managed
blocks. Uninstall restores recorded original files and removes files it created when they
have not been edited.

## Resolve findings with an agent

1. Run `gspot check --staged` before committing. An installed pre-commit integration also runs it.
2. For each finding, run `gspot explain <check>` and do what the `help:` line says.
3. When a rule does not fit, change the policy with a writing command and a reason:
   `gspot ignore`, `gspot set`. Never edit a file under `.gspot/`.
4. Run `gspot apply` after any hand edit of `gspot.toml`.

## Preserve policy ownership

- Keep managed outputs under `.gspot/` unchanged. Change `gspot.toml` and use `apply --dry-run` to preview generated differences. Apply preserves subsequent edits and recovery copies.
- Include a specific reason when `require_reasons = true`.
- Run the check explicitly after bypassing a local hook. A bypass is not a passing result. `git commit --no-verify` bypasses local
  commit hooks, and `git push --no-verify` bypasses the local push hook. Remote CI and server
  policy operate independently.

## What the rule files say

Each rule file states guidance for one topic, including applicable tools and checks. `general/agent/WORKING.md` says how
to work in the repository; `general/prose/WRITING.md` says how to write; the language, framework
and tool files say what code looks like here.
