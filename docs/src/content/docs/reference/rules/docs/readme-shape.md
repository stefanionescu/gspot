---
title: "docs/readme-shape"
description: "Checks the shape of every README: one H1, an opening paragraph, a Contents list when long, a section on getting started."
---

Checks the shape of every README: one H1, an opening paragraph, a Contents list when long, a section on getting started.

## Why

A README with the right shape answers what this is and how to start before the reader scrolls.

## What to do

Add the missing piece; turn the check off with a reason under tools.docs.readme_shape when the shape does not fit.

## Where it runs

- Preset: [the docs preset](/reference/presets/docs/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore docs/readme-shape --paths <glob> --reason "<why>"`.
