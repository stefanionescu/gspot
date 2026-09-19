---
title: "python/private-before-public"
description: "Checks that private functions sit above the public functions of a module."
---

Checks that private functions sit above the public functions of a module.

## Why

A reader who meets the parts first understands what is built from them.

## What to do

Move the private functions above the first public one.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/private-before-public --paths <glob> --reason "<why>"`.
