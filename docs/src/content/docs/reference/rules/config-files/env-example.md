---
title: "config-files/env-example"
description: "Checks that every environment variable the code reads appears in the environment template."
---

Checks that every environment variable the code reads appears in the environment template.

## Why

A variable missing from the template is the one a new machine lacks on its first run.

## What to do

Add the key to the template (.env.example or the files under tools.dotenv.templates), or stop reading it.

## Where it runs

- Preset: [the config-files preset](/reference/presets/config-files/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore config-files/env-example --paths <glob> --reason "<why>"`.
