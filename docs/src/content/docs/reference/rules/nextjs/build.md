---
title: "nextjs/build"
description: "Builds the app with next build, for a repository that set tools.next.build_in_gate."
---

Builds the app with next build, for a repository that set tools.next.build_in_gate.

## Why

Some mistakes show only at build time: a server import in a client file, or a page that cannot be prerendered.

## What to do

Run next build and read the first error it prints.

## Where it runs

- Preset: [the nextjs preset](/reference/presets/nextjs/)
- Stage: push
- Engine: integrity
- Required setting: `tools.next.build_in_gate`

Turn it off for a path with a reason: `gspot ignore nextjs/build --paths <glob> --reason "<why>"`.
