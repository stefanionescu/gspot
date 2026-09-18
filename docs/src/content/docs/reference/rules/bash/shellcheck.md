---
title: "bash/shellcheck"
description: "Runs ShellCheck with every rule on, over every shell script, and the files they source."
---

Runs ShellCheck with every rule on, over every shell script, and the files they source.

## Why

ShellCheck catches the quoting, globbing and exit-status mistakes that make shell scripts fail on the one input nobody tested.

## What to do

Read the SC code in the finding; gspot explain shellcheck/SC2086 links to its page. Turn one code off with gspot ignore bash/shellcheck --rule SC2086 --reason.

## Where it runs

- Preset: [the bash preset](/reference/presets/bash/)
- Stage: commit
- Tool: shellcheck

Turn it off for a path with a reason: `gspot ignore bash/shellcheck --paths <glob> --reason "<why>"`.
