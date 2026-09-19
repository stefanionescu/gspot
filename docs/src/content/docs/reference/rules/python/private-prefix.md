---
title: "python/private-prefix"
description: "In a module with an export list, checks that every other definition starts with an underscore, and that the list holds no such name."
---

In a module with an export list, checks that every other definition starts with an underscore, and that the list holds no such name.

## Why

A name that is public by accident gets imported, and then it cannot change.

## What to do

Add the underscore, or list the name in the export list.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/private-prefix --paths <glob> --reason "<why>"`.
