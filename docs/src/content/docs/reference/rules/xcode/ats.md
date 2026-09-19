---
title: "xcode/ats"
description: "Refuses a property list that allows arbitrary loads, which turns transport security off for every host."
---

Refuses a property list that allows arbitrary loads, which turns transport security off for every host.

## Why

With arbitrary loads the app speaks plain HTTP to anyone, and one forgotten debug setting ships it.

## What to do

Remove the key, and add an exception for the one host that needs it.

## Where it runs

- Preset: [the xcode preset](/reference/presets/xcode/)
- Stage: commit
- Engine: integrity

Turn it off for a path with a reason: `gspot ignore xcode/ats --paths <glob> --reason "<why>"`.
