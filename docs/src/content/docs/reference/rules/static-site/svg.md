---
title: "static-site/svg"
description: "Checks that svgo cannot make any SVG smaller."
---

Checks that svgo cannot make any SVG smaller.

## Why

An SVG straight from an editor carries metadata and precision a browser never needs.

## What to do

Run svgo over the file.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/svg --paths <glob> --reason "<why>"`.
