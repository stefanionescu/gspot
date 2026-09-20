---
title: "structure/bash-safety"
description: "Finds discarded failures, broad process kills, recursive deletes outside their owners, unchecked cd, and sourced state files."
---

Finds discarded failures, broad process kills, recursive deletes outside their owners, unchecked cd, and sourced state files.

## Why

Each of these is a way a script destroys something it did not mean to and says nothing.

## What to do

Handle the failure, check the cd, and move the delete or kill into a script named under tools.bash.safety.owners.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/bash-safety --paths <glob> --reason "<why>"`.
