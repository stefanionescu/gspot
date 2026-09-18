---
title: "config-files/plist"
description: "Parses every property list and entitlements file with plutil."
---

Parses every property list and entitlements file with plutil.

## Why

A broken plist fails the build or, worse, ships an app whose settings silently fell back to defaults.

## What to do

Fix the element plutil names.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: plutil

Turn it off for a path with a reason: `gspot ignore config-files/plist --paths <glob> --reason "<why>"`.
