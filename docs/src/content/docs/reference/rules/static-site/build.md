---
title: "static-site/build"
description: "Runs the build command of the site and fails when it fails or writes no output folder."
---

Runs the build command of the site and fails when it fails or writes no output folder.

## Why

Every other output check reads what the build wrote, so a broken build hides all of them.

## What to do

Run the build command by hand and fix what it prints. Name the command under tools.site.build.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/build --paths <glob> --reason "<why>"`.
