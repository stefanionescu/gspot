---
title: "xcode/asset-catalogues"
description: "Checks that every asset Contents.json parses, that every image set holds the images it names, and that some source names every asset."
---

Checks that every asset Contents.json parses, that every image set holds the images it names, and that some source names every asset.

## Why

An image set with no image draws nothing at run time, and an asset nobody names ships in the app for nothing.

## What to do

Add the image, or delete the asset. Set tools.xcode.orphan_assets to false when assets are named at run time.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xcode/asset-catalogues --paths <glob> --reason "<why>"`.
