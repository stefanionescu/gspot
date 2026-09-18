---
title: "prose/doc-tags"
description: "Checks that doc comments carry no types, which the language already states."
---

Checks that doc comments carry no types, which the language already states.

## Why

A type in a doc tag drifts from the signature and says nothing the reader cannot see.

## What to do

Delete the type from the tag and keep the description.

## Where it runs

- Preset: [the prose preset](/reference/presets/prose/)
- Stage: commit

Turn it off for a path with a reason: `gspot ignore prose/doc-tags --paths <glob> --reason "<why>"`.
