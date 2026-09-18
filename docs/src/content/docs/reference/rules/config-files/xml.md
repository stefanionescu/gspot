---
title: "config-files/xml"
description: "Parses every XML file, storyboard, and xib with xmllint."
---

Parses every XML file, storyboard, and xib with xmllint.

## Why

Malformed XML is refused by the reader at the worst moment.

## What to do

Fix the line xmllint names.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: commit
- Tool: xmllint

Turn it off for a path with a reason: `gspot ignore config-files/xml --paths <glob> --reason "<why>"`.
