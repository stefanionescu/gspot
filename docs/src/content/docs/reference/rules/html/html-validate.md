---
title: "html/html-validate"
description: "Validates every HTML file: elements where they may sit, required attributes, text alternatives, and one style for void elements."
---

Validates every HTML file: elements where they may sit, required attributes, text alternatives, and one style for void elements.

## Why

A browser repairs broken markup in its own way, and a screen reader reads what the repair left.

## What to do

Change the markup the way the rule page says. Turn one rule off with gspot ignore html/html-validate --rule <name> --reason.

## Where it runs

- Preset: [the html preset](/reference/presets/html/)
- Stage: commit
- Tool: html-validate

Turn it off for a path with a reason: `gspot ignore html/html-validate --paths <glob> --reason "<why>"`.
