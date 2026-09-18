---
title: "integrity/baselines-current"
description: "Checks that every baseline names a check that still runs and that every file in a tool's suppressions file is still tracked."
---

Checks that every baseline names a check that still runs and that every file in a tool's suppressions file is still tracked.

## Why

A baseline for a check that is gone hides nothing and misleads the reader; a suppression for a deleted file is a count nobody lowered.

## What to do

Run gspot apply --baseline to remove the stale baseline or prune the suppressions.

## Where it runs

- Preset: [the structure preset](/reference/presets/structure/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore integrity/baselines-current --paths <glob> --reason "<why>"`.
