---
title: "integrity/docs-headings"
description: "Finds a heading from the banned list, such as Table of contents, or Project structure."
---

Finds a heading from the banned list, such as Table of contents, or Project structure.

## Why

An inventory heading promises a map that goes stale; the reader wanted an explanation.

## What to do

Replace the section with prose that explains, or delete it.

## Where it runs

- Preset: [the docs preset](/reference/presets/docs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/docs-headings --paths <glob> --reason "<why>"`.
