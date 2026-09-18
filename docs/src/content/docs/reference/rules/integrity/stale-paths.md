---
title: "integrity/stale-paths"
description: "Checks that every path a Markdown file names is tracked, and every mise run or bun run names a task that exists."
---

Checks that every path a Markdown file names is tracked, and every mise run or bun run names a task that exists.

## Why

A path in the docs that nothing tracks sends the reader to a file that is gone.

## What to do

Fix the path or the task name, or add the pattern with a reason under tools.docs.paths_allowed.

## Where it runs

- Preset: [the docs preset](/reference/presets/docs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/stale-paths --paths <glob> --reason "<why>"`.
