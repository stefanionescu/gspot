---
title: "fastapi/openapi-lint"
description: "Lints the OpenAPI document named in tools.openapi.document with the Spectral OpenAPI rules."
---

Lints the OpenAPI document named in tools.openapi.document with the Spectral OpenAPI rules.

## Why

Clients are written from this document, so an operation with no id becomes somebody's broken client.

## What to do

Change the route metadata that writes the document, then export it again.

## Where it runs

- Preset: [the fastapi preset](/reference/presets/fastapi/)
- Stage: commit
- Tool: spectral
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore fastapi/openapi-lint --paths <glob> --reason "<why>"`.
