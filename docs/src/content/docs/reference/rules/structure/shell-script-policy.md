---
title: "structure/shell-script-policy"
description: "Finds forwarding wrappers, compatibility aliases, and inline Node in shell scripts."
---

Finds forwarding wrappers, compatibility aliases, and inline Node in shell scripts.

## Why

A wrapper is a second entry point that drifts from the first; inline Node is a second language nobody lints.

## What to do

Call the target script directly, delete the alias, and move the Node code into a .js file.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-script-policy --paths <glob> --reason "<why>"`.
