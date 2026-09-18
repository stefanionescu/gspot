---
title: "javascript/knip"
description: "Finds files, exports, and dependencies nothing uses."
---

Finds files, exports, and dependencies nothing uses.

## Why

Dead code is read, maintained, and shipped for nobody.

## What to do

Delete what knip names, or add a knip entry point with gspot set tools.knip.entry if the file is loaded in a way knip cannot see.

## Where it runs

- Preset: [the javascript preset](/reference/presets/javascript/)
- Stage: push
- Tool: knip

Turn it off for a path with a reason: `gspot ignore javascript/knip --paths <glob> --reason "<why>"`.
