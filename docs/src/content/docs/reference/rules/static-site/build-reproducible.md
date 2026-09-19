---
title: "static-site/build-reproducible"
description: "Builds the site twice and compares the two outputs file by file."
---

Builds the site twice and compares the two outputs file by file.

## Why

A build that differs from run to run cannot be cached, compared, or trusted to hold what was reviewed.

## What to do

Take the timestamp, the random value, or the unordered list out of the build.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore static-site/build-reproducible --paths <glob> --reason "<why>"`.
