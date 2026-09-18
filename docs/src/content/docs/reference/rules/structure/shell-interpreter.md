---
title: "structure/shell-interpreter"
description: "Checks the contract every Bash script keeps: the four-line header, strict mode, one main called last, readonly constants, declarative libraries, cleaned-up temporary files."
---

Checks the contract every Bash script keeps: the four-line header, strict mode, one main called last, readonly constants, declarative libraries, cleaned-up temporary files.

## Why

A script that skips strict mode or hides its runtime fails on the machine where it matters, silently.

## What to do

Open with the shebang, a bare #, one line saying what the script does, and the Runtime line. Run set -euo pipefail and shopt -s inherit_errexit first, and end an executable with a call to main.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/shell-interpreter --paths <glob> --reason "<why>"`.
