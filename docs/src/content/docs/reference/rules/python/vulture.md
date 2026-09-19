---
title: "python/vulture"
description: "Finds functions, classes, and variables nothing uses."
---

Finds functions, classes, and variables nothing uses.

## Why

Dead code is read and maintained by people who cannot tell it is dead.

## What to do

Delete the code, or list a name a framework calls under tools.vulture.ignore_names.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: push
- Tool: vulture

Turn it off for a path with a reason: `gspot ignore python/vulture --paths <glob> --reason "<why>"`.
