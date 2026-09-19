---
title: "static-site/webmanifest"
description: "Checks that the web manifest parses, names the app, and lists icons that exist."
---

Checks that the web manifest parses, names the app, and lists icons that exist.

## Why

A manifest with a missing icon installs an app with a blank tile.

## What to do

Correct the manifest, or add the icon.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/webmanifest --paths <glob> --reason "<why>"`.
