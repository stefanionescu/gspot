---
title: "docs/links"
description: "Checks that every relative link names a tracked file and every anchor names a heading."
---

Checks that every relative link names a tracked file and every anchor names a heading.

## Why

A dead link inside the repository is a promise the docs broke without anyone noticing.

## What to do

Point the link at the file or heading that exists, or delete it.

## Where it runs

- Preset: [the docs preset](/reference/presets/docs/)
- Stage: commit
- Tool: lychee

Turn it off for a path with a reason: `gspot ignore docs/links --paths <glob> --reason "<why>"`.
