---
title: "express/openapi-lint"
description: "Lints the OpenAPI document named in tools.openapi.document with the Spectral OpenAPI rules."
---

Lints the OpenAPI document named in tools.openapi.document with the Spectral OpenAPI rules.

## Why

Clients are written from this document, so an operation with no id or an undefined response becomes somebody's broken client.

## What to do

Change the document the way the rule says, or the code that writes it.

## Where it runs

- Preset: [the express preset](/reference/presets/express/)
- Stage: commit
- Tool: spectral
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore express/openapi-lint --paths <glob> --reason "<why>"`.
