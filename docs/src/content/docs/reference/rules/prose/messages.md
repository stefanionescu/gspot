---
title: "prose/messages"
description: "Checks the strings Vale cannot see: error messages start with a capital letter, client messages name no identifier, log messages are stable."
---

Checks the strings Vale cannot see: error messages start with a capital letter, client messages name no identifier, log messages are stable.

## Why

A message is prose a person reads under stress; an interpolated identifier in it leaks internals and breaks searching the logs.

## What to do

Capitalize the message, move the value into its own field, and keep the log line constant.

## Where it runs

- Preset: [the prose preset](/reference/presets/prose/)
- Stage: commit

Turn it off for a path with a reason: `gspot ignore prose/messages --paths <glob> --reason "<why>"`.
