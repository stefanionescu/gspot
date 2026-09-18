---
title: "structure/doc-comment"
description: "Checks that every shell function announces itself in a comment above it that says more than its name."
---

Checks that every shell function announces itself in a comment above it that says more than its name.

## Why

A function with no summary makes the reader run it in their head; a vague summary is a summary nobody will trust.

## What to do

Write "# name: what it does" above the function; when it carries doc sections, keep Globals, Arguments, Outputs, Returns in that order.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/doc-comment --paths <glob> --reason "<why>"`.
