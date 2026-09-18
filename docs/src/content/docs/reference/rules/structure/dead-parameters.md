---
title: "structure/dead-parameters"
description: "Finds shell functions called with arguments they never read."
---

Finds shell functions called with arguments they never read.

## Why

An argument the callee ignores is a promise the call site believes in.

## What to do

Read the argument in the function, or drop it from every call.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/dead-parameters --paths <glob> --reason "<why>"`.
