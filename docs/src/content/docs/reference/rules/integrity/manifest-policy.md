---
title: "integrity/manifest-policy"
description: "Checks every package.json: exact versions, one packageManager across the workspace, a private root, and one kind of lockfile."
---

Checks every package.json: exact versions, one packageManager across the workspace, a private root, and one kind of lockfile.

## Why

A version range installs a different tree tomorrow, and two package managers produce two trees today.

## What to do

Pin the version the lockfile holds, name one packageManager, mark a workspace root private, and delete the lockfile of the manager the repository does not use.

## Where it runs

- Preset: [the dependencies preset](/reference/presets/dependencies/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/manifest-policy --paths <glob> --reason "<why>"`.
