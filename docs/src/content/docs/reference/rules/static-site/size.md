---
title: "static-site/size"
description: "Sums the compressed weight of the output paths each ceiling in tools.site.size_limits names."
---

Sums the compressed weight of the output paths each ceiling in tools.site.size_limits names.

## Why

Weight arrives a kilobyte at a time, and only a ceiling notices.

## What to do

Remove what the page does not need, or raise the ceiling with a reason.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity
- Required setting: `tools.site.size_limits`

Turn it off for a path with a reason: `gspot ignore static-site/size --paths <glob> --reason "<why>"`.
