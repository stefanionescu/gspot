---
title: "static-site/html-validate-built"
description: "Validates every built page with html-validate."
---

Validates every built page with html-validate.

## Why

Templates can each be valid and still join into a page with two main elements or a missing label.

## What to do

Fix the template or the content that writes the markup the rule names.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/html-validate-built --paths <glob> --reason "<why>"`.
