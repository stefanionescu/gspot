---
title: "licenses/npm"
description: "Compares the license every installed npm package reports with the allowed list and the exceptions."
---

Compares the license every installed npm package reports with the allowed list and the exceptions.

## Why

A license the project cannot accept arrives silently with a transitive dependency.

## What to do

Replace the package, or record it with gspot allow licenses <name@version> --license <id> --reason. An exception holds only while the package reports that license.

## Where it runs

- Preset: [the licenses preset](/reference/presets/licenses/)
- Stage: push
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore licenses/npm --paths <glob> --reason "<why>"`.
