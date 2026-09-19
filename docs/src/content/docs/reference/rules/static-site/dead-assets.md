---
title: "static-site/dead-assets"
description: "Finds files under an assets folder that no page, stylesheet, or script names."
---

Finds files under an assets folder that no page, stylesheet, or script names.

## Why

An asset nobody references ships with every deploy and is kept by everyone who fears deleting it.

## What to do

Delete the file.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/dead-assets --paths <glob> --reason "<why>"`.
