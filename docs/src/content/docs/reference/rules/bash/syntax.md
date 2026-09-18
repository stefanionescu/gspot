---
title: "bash/syntax"
description: "Checks that every shell script parses before anything else runs it."
---

Checks that every shell script parses before anything else runs it.

## Why

A script with a syntax error stops at the broken line, sometimes after it has already done half its work.

## What to do

Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Tool: bash

Turn it off for a path with a reason: `gspot ignore bash/syntax --paths <glob> --reason "<why>"`.
