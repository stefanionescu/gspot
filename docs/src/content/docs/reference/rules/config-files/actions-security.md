---
title: "config-files/actions-security"
description: "Audits every GitHub Actions workflow with zizmor: template injection, unpinned actions, excessive permissions, dangerous triggers."
---

Audits every GitHub Actions workflow with zizmor: template injection, unpinned actions, excessive permissions, dangerous triggers.

## Why

A workflow runs with the repository's credentials; an injectable expression or an unpinned action hands them to a stranger.

## What to do

Apply the fix zizmor names, or turn one audit off with gspot ignore config-files/actions-security --rule <audit> and a reason.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: zizmor

Turn it off for a path with a reason: `gspot ignore config-files/actions-security --paths <glob> --reason "<why>"`.
