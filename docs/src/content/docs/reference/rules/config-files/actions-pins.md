---
title: "config-files/actions-pins"
description: "Verifies GitHub action commits and version comments without changing workflow files."
---

Verifies GitHub action commits and version comments without changing workflow files.

## Why

A nonexistent action commit prevents the workflow from starting.

## What to do

Replace the invalid action pin with a verified commit and its matching version comment.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: push
- Tool: pinact

Turn it off for a path with a reason: `gspot ignore config-files/actions-pins --paths <glob> --reason "<why>"`.
