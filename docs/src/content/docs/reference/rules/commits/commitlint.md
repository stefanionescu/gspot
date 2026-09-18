---
title: "commits/commitlint"
description: "Checks the commit message being written: a conventional type, a known scope, a short subject, and a wrapped body."
---

Checks the commit message being written: a conventional type, a known scope, a short subject, and a wrapped body.

## Why

A history of typed, scoped subjects is what release notes, blame and bisect are read from; a free-form message hides the change.

## What to do

Write <type>(<scope>): <subject>, with a type from the list and a subject under 72 characters, or change the list with gspot set tools.commitlint.types.

## Where it runs

- Preset: [the commits preset](/reference/presets/commits/)
- Stage: message
- Tool: commitlint

Turn it off for a path with a reason: `gspot ignore commits/commitlint --paths <glob> --reason "<why>"`.
