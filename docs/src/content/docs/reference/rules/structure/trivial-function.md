---
title: "structure/trivial-function"
description: "Finds a shell function used once whose body fits the trivial ceiling."
---

Finds a shell function used once whose body fits the trivial ceiling.

## Why

A name for two lines used once hides the two lines and adds a jump.

## What to do

Inline the body at its one call, or explain the required boundary with `gspot-ignore structure/trivial-function -- reason` on the preceding comment line.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/trivial-function --paths <glob> --reason "<why>"`.
