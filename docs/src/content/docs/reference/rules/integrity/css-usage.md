---
title: "integrity/css-usage"
description: "For every CSS module, checks that the code uses each class it defines, and that each class the code reads is defined."
---

For every CSS module, checks that the code uses each class it defines, and that each class the code reads is defined.

## Why

A class the code reads and the stylesheet lacks is undefined at run time, and the element silently loses its style.

## What to do

Delete the class nobody reads, or define the class the code reads.

## Where it runs

- Preset: [the css preset](/reference/presets/css/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/css-usage --paths <glob> --reason "<why>"`.
