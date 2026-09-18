---
title: "postgres/security-definer-search-path"
description: "Checks that every SECURITY DEFINER function sets its search_path."
---

Checks that every SECURITY DEFINER function sets its search_path.

## Why

A definer function runs with its owner's rights, and a caller who controls the search path chooses the objects it touches.

## What to do

Give the function an empty `search_path` in its definition, and qualify every name inside it.

## Where it runs

- Preset: [the postgres preset](/reference/presets/postgres/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore postgres/security-definer-search-path --paths <glob> --reason "<why>"`.
