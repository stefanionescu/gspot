---
title: "express/routes-tested"
description: "Checks that some test file names every route file."
---

Checks that some test file names every route file.

## Why

A route with no test is the one that changes behavior without anyone noticing.

## What to do

Add a test file for the route, named after it.

## Where it runs

- Preset: [the express preset](/reference/presets/express/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore express/routes-tested --paths <glob> --reason "<why>"`.
