---
title: "fastapi/openapi-fresh"
description: "Runs the command in tools.openapi.produced_by and fails when it changes the document."
---

Runs the command in tools.openapi.produced_by and fails when it changes the document.

## Why

A committed document that lags the routes describes a service that does not exist.

## What to do

Run the command and commit the document it writes.

## Where it runs

- Preset: [the fastapi preset](/reference/presets/fastapi/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore fastapi/openapi-fresh --paths <glob> --reason "<why>"`.
