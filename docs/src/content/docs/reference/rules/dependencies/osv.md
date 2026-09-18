---
title: "dependencies/osv"
description: "Looks up every locked dependency in the Open Source Vulnerabilities (OSV) advisory database."
---

Looks up every locked dependency in the Open Source Vulnerabilities (OSV) advisory database.

## Why

A dependency with a published advisory is an attack someone already wrote down.

## What to do

Upgrade the package the finding names. When no fix exists, record the advisory with gspot allow osv <id> --reason, and a date to look again.

## Where it runs

- Preset: [the dependencies preset](/reference/presets/dependencies/)
- Stage: push
- Tool: osv-scanner

Turn it off for a path with a reason: `gspot ignore dependencies/osv --paths <glob> --reason "<why>"`.
