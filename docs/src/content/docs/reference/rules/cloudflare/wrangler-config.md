---
title: "cloudflare/wrangler-config"
description: "Checks that every wrangler configuration parses, names the worker, and pins a compatibility date."
---

Checks that every wrangler configuration parses, names the worker, and pins a compatibility date.

## Why

Without a pinned date the runtime changes behavior under a deployed worker.

## What to do

Add the name and a compatibility_date in the form 2025-01-31.

## Where it runs

- Preset: [the cloudflare preset](/reference/presets/cloudflare/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore cloudflare/wrangler-config --paths <glob> --reason "<why>"`.
