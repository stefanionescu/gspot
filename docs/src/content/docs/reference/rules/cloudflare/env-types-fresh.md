---
title: "cloudflare/env-types-fresh"
description: "Checks that a tracked environment types file matches what wrangler writes."
---

Checks that a tracked environment types file matches what wrangler writes.

## Why

Stale binding types let code compile against a binding the configuration dropped.

## What to do

Run wrangler types and commit the file.

## Where it runs

- Preset: [the cloudflare preset](/reference/presets/cloudflare/)
- Stage: push
- Tool: wrangler
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore cloudflare/env-types-fresh --paths <glob> --reason "<why>"`.
