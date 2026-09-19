---
title: "css/dead-selectors"
description: "Finds selectors of the built stylesheets that no built page or script uses."
---

Finds selectors of the built stylesheets that no built page or script uses.

## Why

A selector nobody uses is downloaded by every visitor and read by every maintainer.

## What to do

Delete the rule, or list a name a script adds at run time under tools.purgecss.safelist with a reason.

## Where it runs

- Preset: [the static-site preset](/reference/presets/static-site/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore css/dead-selectors --paths <glob> --reason "<why>"`.
