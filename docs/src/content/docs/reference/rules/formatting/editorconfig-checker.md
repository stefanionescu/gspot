---
title: "formatting/editorconfig-checker"
description: "Checks line endings, final newlines and trailing whitespace in every file against .editorconfig."
---

Checks line endings, final newlines and trailing whitespace in every file against .editorconfig.

## Why

These rules cover the files no formatter touches, so a stray tab or missing newline never lands in a diff. Indentation is the formatters' job and is not checked here.

## What to do

Fix the line the checker names; most editors apply .editorconfig on save.

## Where it runs

- Preset: [the formatting preset](/reference/presets/formatting/)
- Stage: commit
- Tool: ec

Turn it off for a path with a reason: `gspot ignore formatting/editorconfig-checker --paths <glob> --reason "<why>"`.
