---
title: "cloudflare/headers-syntax"
description: "Checks that the headers file is blocks of a path line and indented header lines."
---

Checks that the headers file is blocks of a path line and indented header lines.

## Why

Cloudflare skips a line it cannot read, so a typo silently drops a security header.

## What to do

Write each block as a path, then indented lines of a name, a colon, and a value.

## Where it runs

- Preset: [the cloudflare preset](/reference/presets/cloudflare/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore cloudflare/headers-syntax --paths <glob> --reason "<why>"`.
