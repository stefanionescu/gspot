---
title: "xctest/recording"
description: "Refuses a snapshot test left in a recording mode."
---

Refuses a snapshot test left in a recording mode.

## Why

A recording test writes a new reference and passes, so it approves whatever the screen shows.

## What to do

Take the recording flag out, and commit the references it wrote after looking at them.

## Where it runs

- Preset: [the xctest preset](/reference/presets/xctest/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xctest/recording --paths <glob> --reason "<why>"`.
