---
title: "integrity/security-headers"
description: "Checks that the headers file sets the content type, referrer, and framing headers for every path."
---

Checks that the headers file sets the content type, referrer, and framing headers for every path.

## Why

A site of files has no server code, so the headers file is the only place these protections can live.

## What to do

Add the header to the block for every path.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/security-headers --paths <glob> --reason "<why>"`.
