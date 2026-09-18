---
title: "sql/block-comments"
description: "Refuses block comments in SQL, so every comment is a line comment."
---

Refuses block comments in SQL, so every comment is a line comment.

## Why

The prose and spelling checks read line comments, and a block comment hides text and dead code from them.

## What to do

Rewrite the block as line comments that start with two dashes.

## Where it runs

- Preset: [the sql preset](/reference/presets/sql/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore sql/block-comments --paths <glob> --reason "<why>"`.
