---
title: "cloudflare/redirects-syntax"
description: "Checks that every redirect is a source, a destination, and an optional status Cloudflare knows."
---

Checks that every redirect is a source, a destination, and an optional status Cloudflare knows.

## Why

A redirect Cloudflare cannot read is dropped, and the old address starts to answer 404.

## What to do

Write the rule as source, destination, status.

## Where it runs

- Preset: [the cloudflare preset](/reference/presets/cloudflare/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore cloudflare/redirects-syntax --paths <glob> --reason "<why>"`.
