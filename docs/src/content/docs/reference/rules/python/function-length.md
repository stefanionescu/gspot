---
title: "python/function-length"
description: "Checks that no Python function has more code lines than the ceiling."
---

Checks that no Python function has more code lines than the ceiling.

## Why

A function that fills a screen does several things, and a reader has to hold all of them.

## What to do

Move one job of the function into a function of its own.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/function-length --paths <glob> --reason "<why>"`.
