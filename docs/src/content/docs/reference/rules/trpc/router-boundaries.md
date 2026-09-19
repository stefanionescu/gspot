---
title: "trpc/router-boundaries"
description: "Checks that code outside the server paths imports from them as a type only."
---

Checks that code outside the server paths imports from them as a type only.

## Why

A value import of the router pulls the server, its secrets, and its database client into the client bundle.

## What to do

Import the router type with import type, and call the server through the client.

## Where it runs

- Preset: [the trpc preset](/reference/presets/trpc/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore trpc/router-boundaries --paths <glob> --reason "<why>"`.
