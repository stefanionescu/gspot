---
title: "structure/bash-embeds"
description: "Finds inline Python, Node and generated-script heredocs in shell scripts."
---

Finds inline Python, Node and generated-script heredocs in shell scripts.

## Why

Code inside a heredoc is checked by nothing.

## What to do

Move the embedded code into its own file and run that.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Engine: structure

Turn it off for a path with a reason: `gspot ignore structure/bash-embeds --paths <glob> --reason "<why>"`.
