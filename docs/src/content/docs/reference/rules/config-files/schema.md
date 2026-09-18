---
title: "config-files/schema"
description: "Validates every configuration file that has a known schema against it: package.json, tsconfig.json, mise, workflows and the rest of the SchemaStore catalog."
---

Validates every configuration file that has a known schema against it: package.json, tsconfig.json, mise, workflows and the rest of the SchemaStore catalog.

## Why

A key the schema refuses is a setting that never applies, and nobody finds out until the behavior it was meant to change does not change.

## What to do

Fix the key v8r names, or map the file to its schema under tools.v8r.schemas.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: push
- Tool: v8r

Turn it off for a path with a reason: `gspot ignore config-files/schema --paths <glob> --reason "<why>"`.
