---
title: "xcode/xcstrings"
description: "Checks that every string catalog parses, and that every string has a translation for every locale the catalog uses."
---

Checks that every string catalog parses, and that every string has a translation for every locale the catalog uses.

## Why

A string with no translation shows its source language in the middle of a translated screen.

## What to do

Add the translation, or mark the string as not translated in the catalog.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xcode/xcstrings --paths <glob> --reason "<why>"`.
