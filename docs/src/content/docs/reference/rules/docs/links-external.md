---
title: "docs/links-external"
description: "Checks every external link over the network."
---

Checks every external link over the network.

## Why

An external link rots on its own schedule; this run says which ones did.

## What to do

Update or remove the link, or exclude the URL pattern with a reason under tools.lychee.exclude.

## Where it runs

- Preset: [the docs preset](/reference/presets/docs/)
- Stage: manual
- Tool: lychee

Turn it off for a path with a reason: `gspot ignore docs/links-external --paths <glob> --reason "<why>"`.
