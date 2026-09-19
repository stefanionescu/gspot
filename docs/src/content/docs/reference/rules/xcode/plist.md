---
title: "xcode/plist"
description: "Asks plutil whether every property list and entitlements file parses."
---

Asks plutil whether every property list and entitlements file parses.

## Why

A property list that does not parse stops the build at the signing step, far from the edit that broke it.

## What to do

Correct the file at the line plutil names.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Tool: plutil

Turn it off for a path with a reason: `gspot ignore xcode/plist --paths <glob> --reason "<why>"`.
