---
title: "dependencies/syncpack"
description: "Checks that every workspace package resolves each dependency to one version."
---

Checks that every workspace package resolves each dependency to one version.

## Why

Two versions of one dependency in a workspace mean two behaviors, and a bug that appears in one package only.

## What to do

Run syncpack fix-mismatches with the gspot configuration, or align the versions by hand.

## Where it runs

- Preset: [the dependencies preset](/reference/presets/dependencies/)
- Stage: push
- Tool: syncpack

Turn it off for a path with a reason: `gspot ignore dependencies/syncpack --paths <glob> --reason "<why>"`.
