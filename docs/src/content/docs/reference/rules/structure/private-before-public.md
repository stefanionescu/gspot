---
title: "structure/private-before-public"
description: "Checks that underscore functions come before the public ones and main comes last."
---

Checks that underscore functions come before the public ones and main comes last.

## Why

A file read top to bottom then explains its helpers before it uses them and ends where it starts.

## What to do

Move the private functions above the public ones and main to the end.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/private-before-public --paths <glob> --reason "<why>"`.
