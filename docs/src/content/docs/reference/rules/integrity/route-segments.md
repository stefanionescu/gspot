---
title: "integrity/route-segments"
description: "Checks that no route segment holds both a page and a route handler."
---

Checks that no route segment holds both a page and a route handler.

## Why

One address is served by one file, and the framework refuses the build when a segment holds two.

## What to do

Move the route handler into a segment of its own, such as an api folder.

## Where it runs

- Preset: [the nextjs preset](/reference/presets/nextjs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/route-segments --paths <glob> --reason "<why>"`.
