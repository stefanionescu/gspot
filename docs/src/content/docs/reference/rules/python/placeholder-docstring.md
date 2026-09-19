---
title: "python/placeholder-docstring"
description: "Finds docstrings that hold a placeholder word, or the name of the function again."
---

Finds docstrings that hold a placeholder word, or the name of the function again.

## Why

A docstring that says nothing passes the docstring rule and wastes the line.

## What to do

Say what the function does that its name does not, or for whom it exists.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/placeholder-docstring --paths <glob> --reason "<why>"`.
