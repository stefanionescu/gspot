---
title: "integrity/config-purity"
description: "Checks that every module under the config role holds literals only: no function, no control flow, no call, no value import from outside the config roots."
---

Checks that every module under the config role holds literals only: no function, no control flow, no call, no value import from outside the config roots.

## Why

A configuration module with logic in it is code nobody tests, hidden where reviewers expect a table.

## What to do

Move the logic into a module under src and keep the literal in the config module, or take the folder out of the config role.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/config-purity --paths <glob> --reason "<why>"`.
