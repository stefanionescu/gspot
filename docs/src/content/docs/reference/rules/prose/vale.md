---
title: "prose/vale"
description: "Runs Vale over comments, and documentation with the gspot style, and the upstream packages; every alert is a finding."
---

Runs Vale over comments, and documentation with the gspot style, and the upstream packages; every alert is a finding.

## Why

Prose that hedges, markets or wanders is read by everyone who reads the code, and nothing else checks it.

## What to do

Rewrite the sentence the alert names, add a real name to prose.vocabulary, or turn one rule off with a reason under prose.disabled.

## Where it runs

- Preset: [the prose preset](/reference/presets/prose/)
- Stage: commit
- Engine: prose

Turn it off for a path with a reason: `gspot ignore prose/vale --paths <glob> --reason "<why>"`.
