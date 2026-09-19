---
title: "python/trivial-function"
description: "Finds top-level functions of one or two statements that one place calls."
---

Finds top-level functions of one or two statements that one place calls.

## Why

A tiny function with one caller makes the reader jump to read two lines.

## What to do

Inline the body at its caller, or allow the name under structure.python.trivial_allowed with a reason.

## Where it runs

- Preset: [the python preset](/reference/presets/python/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore python/trivial-function --paths <glob> --reason "<why>"`.
