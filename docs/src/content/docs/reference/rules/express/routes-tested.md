---
title: "express/routes-tested"
description: "Checks that a test in the same scope imports each route file."
---

Checks that a test in the same scope imports each route file.

## Why

A route with no test is the one that changes behavior without anyone noticing.

## What to do

Add a test that imports and exercises the route.

## Where it runs

- Preset: [the express preset](/reference/presets/express/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore express/routes-tested --paths <glob> --reason "<why>"`.
