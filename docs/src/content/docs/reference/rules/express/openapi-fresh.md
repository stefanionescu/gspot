---
title: "express/openapi-fresh"
description: "Runs the command in tools.openapi.produced_by and fails when it changes the document."
---

Runs the command in tools.openapi.produced_by and fails when it changes the document.

## Why

A committed document that lags the routes describes a service that does not exist.

## What to do

Run the command and commit the document it writes.

## Where it runs

- Preset: [the express preset](/reference/presets/express/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore express/openapi-fresh --paths <glob> --reason "<why>"`.
