---
title: "duplication/jscpd"
description: "Finds blocks of code copied between files, and fails when their share passes the ceiling."
---

Finds blocks of code copied between files, and fails when their share passes the ceiling.

## Why

A copied block is fixed in one place and stays broken in the other.

## What to do

Move the shared block into one function both callers use, or raise limits.duplication.threshold_percent with a reason.

## Where it runs

- Preset: [the duplication preset](/reference/presets/duplication/)
- Stage: push
- Tool: jscpd

Turn it off for a path with a reason: `gspot ignore duplication/jscpd --paths <glob> --reason "<why>"`.
