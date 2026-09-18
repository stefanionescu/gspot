---
title: "prose/source-bans"
description: "Finds Vale directives inside Markdown and block comments in SQL, which take text away from the prose check."
---

Finds Vale directives inside Markdown and block comments in SQL, which take text away from the prose check.

## Why

A directive in the text turns a rule off for everyone silently; a block comment is invisible to Vale.

## What to do

Delete the directive and change the text, or disable the rule with a reason; write SQL comments with two dashes.

## Where it runs

- Preset: [the prose preset](/reference/presets/prose/)
- Stage: commit
- Engine: prose

Turn it off for a path with a reason: `gspot ignore prose/source-bans --paths <glob> --reason "<why>"`.
